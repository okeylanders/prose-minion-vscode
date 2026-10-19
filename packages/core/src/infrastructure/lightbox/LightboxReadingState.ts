/**
 * How a board's reading groups change as runs start, settle and stop (ADR
 * 2026-10-19 D3, D6). Pure: every function returns new groups.
 *
 * - A full run of a group clears it and marks it `running` with every lens
 *   it reads `pending`; its outcome replaces it.
 * - A tile's re-read (one lens) leaves the group's other lenses' tiles in
 *   place: only that lens is `pending`, and only its tiles, withheld blocks
 *   and withheld claims are replaced when it lands. If the re-read fails or
 *   is stopped, the earlier readings stay.
 * - Stopping a run marks its still-running groups `cancelled`; groups that
 *   already landed keep what they hold.
 * - Usage accumulates per group, so a group's usage is what its readings on
 *   this board have cost.
 * - A stale lens (read against an earlier text, D4) stays stale until a fresh
 *   reading of it lands: a full run clears the group's marks with its
 *   readings, a re-read clears its own lens's mark, and a failed or stopped
 *   call clears nothing.
 */

import type {
  LightboxLensId,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxStaleLens
} from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { sumUsage, type LightboxGroupOutcome } from '@/infrastructure/lightbox/LightboxReadingRunContracts';

/** What one call of a run reads. */
export interface LightboxGroupCall {
  group: LightboxReadingGroupId;
  lenses: readonly LightboxLensId[];
}

/** Mark the run's groups `running`. `lens` makes it a single-lens re-read. */
export function startLightboxGroups(
  readings: readonly LightboxReadingGroup[],
  calls: readonly LightboxGroupCall[],
  lens?: LightboxLensId
): LightboxReadingGroup[] {
  return readings.map((group) => {
    const call = calls.find((candidate) => candidate.group === group.group);
    if (!call) {
      return group;
    }
    if (lens) {
      return withoutError({ ...group, status: 'running', pending: [lens] });
    }
    return {
      group: group.group,
      status: 'running',
      lenses: [],
      pending: [...call.lenses],
      ...(group.usage ? { usage: group.usage } : {}),
      tiles: [],
      withheldBlocks: [],
      withheldClaims: [],
      frictions: [],
      quoteChecks: []
    };
  });
}

/** Apply a settled call to its group. */
export function settleLightboxGroup(
  group: LightboxReadingGroup,
  outcome: LightboxGroupOutcome,
  lens?: LightboxLensId
): LightboxReadingGroup {
  const usage = sumUsage([group.usage, outcome.usage]);
  const base = {
    group: group.group,
    ...(outcome.model ? { model: outcome.model } : group.model ? { model: group.model } : {}),
    ...(usage ? { usage } : {})
  };
  if (outcome.status === 'failed') {
    // A full run cleared the group when it started; a re-read keeps what was there.
    return {
      ...base,
      status: 'failed',
      lenses: group.lenses,
      tiles: group.tiles,
      withheldBlocks: group.withheldBlocks,
      withheldClaims: group.withheldClaims,
      frictions: group.frictions,
      quoteChecks: group.quoteChecks,
      error: outcome.error ?? 'The reading failed.',
      ...staleField(group.staleLenses)
    };
  }
  if (!lens) {
    return {
      ...base,
      status: 'ok',
      lenses: [...outcome.lenses],
      tiles: outcome.tiles,
      withheldBlocks: outcome.withheldBlocks,
      withheldClaims: outcome.withheldClaims,
      frictions: outcome.frictions,
      quoteChecks: outcome.quoteChecks
    };
  }
  const others = <T extends { lens: LightboxLensId }>(entries: readonly T[]): T[] =>
    entries.filter((entry) => entry.lens !== lens);
  return {
    ...base,
    status: 'ok',
    lenses: inRailOrder([...group.lenses, lens]),
    tiles: inLensOrder([...others(group.tiles), ...outcome.tiles]),
    withheldBlocks: inLensOrder([...others(group.withheldBlocks), ...outcome.withheldBlocks]),
    withheldClaims: inLensOrder([...others(group.withheldClaims), ...outcome.withheldClaims]),
    frictions: inLensOrder([...others(group.frictions), ...outcome.frictions]),
    quoteChecks: inLensOrder([...others(group.quoteChecks), ...outcome.quoteChecks]),
    ...staleField(group.staleLenses?.filter((mark) => mark.lens !== lens))
  };
}

function staleField(marks: readonly LightboxStaleLens[] | undefined): { staleLenses?: LightboxStaleLens[] } {
  return marks && marks.length > 0 ? { staleLenses: [...marks] } : {};
}

/** Mark the stopped run's still-running groups `cancelled`, keeping what they hold. */
export function stopLightboxGroups(
  readings: readonly LightboxReadingGroup[],
  groups: readonly LightboxReadingGroupId[],
  message: string
): LightboxReadingGroup[] {
  return readings.map((group) => {
    if (!groups.includes(group.group) || group.status !== 'running') {
      return group;
    }
    const { pending: _pending, ...rest } = group;
    return { ...rest, status: 'cancelled', error: message };
  });
}

function withoutError(group: LightboxReadingGroup): LightboxReadingGroup {
  const { error: _error, ...rest } = group;
  return rest;
}

const RAIL_ORDER = LIGHTBOX_LENSES.map((lens) => lens.id);

function inRailOrder(lenses: readonly LightboxLensId[]): LightboxLensId[] {
  return RAIL_ORDER.filter((lens) => lenses.includes(lens));
}

/** Stable: entries keep their order within a lens. */
function inLensOrder<T extends { lens: LightboxLensId }>(entries: T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => RAIL_ORDER.indexOf(a.entry.lens) - RAIL_ORDER.indexOf(b.entry.lens) || a.index - b.index)
    .map(({ entry }) => entry);
}
