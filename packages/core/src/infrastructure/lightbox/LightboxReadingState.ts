/**
 * How a board's reading groups change as runs start, settle and stop (ADR
 * 2026-10-19 D3, D6; its 2026-10-24 addendum). Pure: every function returns
 * new groups.
 *
 * **Keep, lens by lens, until replaced (Slice 4J, epic decision 49).** Every
 * run scope (every call, the calls not back, one call, one tile's lens) is
 * one rule, applied to each lens its call reads:
 * - **While running**, a lens with a reading keeps it on the board, its
 *   lens `pending`; a lens without one is cleared of its earlier withheld
 *   notes, as a first read is.
 * - **A usable new block** (one that drew at least one tile) replaces the
 *   lens's readings, withheld notes, friction and quote checks, clears its
 *   stale and earlier marks, and records its provenance: the run, the
 *   provider-reported model and the time it landed.
 * - **Otherwise the earlier reading stays**: the call failed or was
 *   stopped, the reply was cut off before the lens's block, the block was
 *   withheld, or it drew no tile. The reading keeps its own standing, stale
 *   mark and provenance, and gains an earlier mark with the reason. A lens
 *   with no earlier reading shows the new state, failed or withheld, as a
 *   first read does.
 * - **Each lens is decided on its own**, so one call can replace lens X and
 *   keep lens Y, except lenses kept together (`LIGHTBOX_KEPT_TOGETHER`:
 *   template and summary, since engagement sits on the movements): if one
 *   keeps its earlier reading, so does the other.
 * - **The Opinion follows the same rule** in every scope (decision 47 is the
 *   case of its call run on its own).
 * - Lenses the call does not read are untouched.
 *
 * Usage accumulates per group, so a group's usage is what every call it has
 * made on this board cost, whichever readings landed. The group's `model`
 * and `error` are its latest call's; what is on screen, lens by lens, is
 * the provenance and the earlier marks. Once a call settles, every reading
 * its group shows has a provenance entry: a reading from a board read
 * before Slice 4J takes its group's model then, before the group's model
 * moves on (PR #170 F-02).
 */

import type {
  LightboxEarlierLens,
  LightboxLensId,
  LightboxLensProvenance,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxStaleLens
} from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import {
  LIGHTBOX_KEEP_REASONS,
  LIGHTBOX_KEPT_TOGETHER,
  lightboxLensHasReading,
  lightboxLensProvenance,
  lightboxLensWasRead
} from '@shared/constants/lightboxProvenance';
import { sumUsage, type LightboxGroupOutcome } from '@/infrastructure/lightbox/LightboxReadingRunContracts';

/** What one call of a run reads. */
export interface LightboxGroupCall {
  group: LightboxReadingGroupId;
  lenses: readonly LightboxLensId[];
}

/** Which run's call landed, and when: recorded on each lens it replaces (Slice 4J). */
export interface LightboxLanding {
  /** The run's host-minted token. */
  run: string;
  /** ISO 8601. */
  at: string;
}

/** What a settled call does to one lens it read. */
type LensVerdict =
  | { kind: 'replace' }
  | { kind: 'keep'; reason: string }
  /** No earlier reading to keep: the new state stands, withheld or empty. */
  | { kind: 'fresh' }
  /** No earlier reading, and the call failed: the lens holds nothing. */
  | { kind: 'drop' };

/**
 * Mark the run's groups `running`, with the lenses each call reads
 * `pending`. A pending lens with a reading keeps it; one without is cleared
 * of what an earlier call left (a withheld block, its friction), so it
 * shows as a first read does.
 */
export function startLightboxGroups(
  readings: readonly LightboxReadingGroup[],
  calls: readonly LightboxGroupCall[]
): LightboxReadingGroup[] {
  return readings.map((group) => {
    const call = calls.find((candidate) => candidate.group === group.group);
    if (!call) {
      return group;
    }
    const cleared = call.lenses.filter((lens) => !lightboxLensHasReading(group, lens));
    return { ...withoutError(withoutLenses(group, cleared)), status: 'running', pending: [...call.lenses] };
  });
}

/** Apply a settled call to its group, lens by lens (see the module note). */
export function settleLightboxGroup(
  group: LightboxReadingGroup,
  outcome: LightboxGroupOutcome,
  landing: LightboxLanding
): LightboxReadingGroup {
  const verdicts = lightboxLensVerdicts(group, outcome);
  const read = [...verdicts.keys()];
  const taken = read.filter((lens) => {
    const kind = verdicts.get(lens)?.kind;
    return kind === 'replace' || kind === 'fresh';
  });
  const fromGroup = (lens: LightboxLensId) => !taken.includes(lens);
  const merged = <T extends { lens: LightboxLensId }>(before: readonly T[], after: readonly T[]): T[] =>
    inLensOrder([...before.filter((entry) => fromGroup(entry.lens)), ...after.filter((entry) => taken.includes(entry.lens))]);
  // A lens dropped (a failed call, nothing to keep) holds nothing; every other lens of the group keeps or takes its own.
  const base = withoutLenses(group, read.filter((lens) => verdicts.get(lens)?.kind === 'drop'));
  const kept = read.flatMap((lens) => {
    const verdict = verdicts.get(lens);
    return verdict?.kind === 'keep' ? [{ lens, reason: verdict.reason }] : [];
  });
  const provenance: LightboxLensProvenance[] = [
    ...(base.provenance ?? []).filter((entry) => fromGroup(entry.lens)),
    ...carriedProvenance(base, taken, group.model),
    ...taken.map((lens) => ({ lens, run: landing.run, ...(outcome.model ? { model: outcome.model } : {}), at: landing.at }))
  ];
  const earlier: LightboxEarlierLens[] = [
    ...(base.earlierLenses ?? []).filter((mark) => !read.includes(mark.lens)),
    ...kept
  ];
  const usage = sumUsage([group.usage, outcome.usage]);
  const model = outcome.model ?? group.model;
  return {
    group: group.group,
    status: outcome.status,
    lenses: inRailOrder([...base.lenses.filter((lens) => fromGroup(lens)), ...taken]),
    ...(model ? { model } : {}),
    ...(usage ? { usage } : {}),
    tiles: merged(base.tiles, outcome.tiles),
    withheldBlocks: merged(base.withheldBlocks, outcome.withheldBlocks),
    withheldClaims: merged(base.withheldClaims, outcome.withheldClaims),
    frictions: merged(base.frictions, outcome.frictions),
    quoteChecks: merged(base.quoteChecks, outcome.quoteChecks),
    ...(outcome.status === 'failed' ? { error: outcome.error ?? 'The reading failed.' } : {}),
    ...staleField(base.staleLenses?.filter((mark) => fromGroup(mark.lens))),
    ...provenanceField(inLensOrder(provenance)),
    ...earlierField(inLensOrder(earlier))
  };
}

/**
 * What a settled call does to each lens it read: replaced by a usable new
 * block, its earlier reading kept with the reason, or (with none to keep)
 * the new state as it came back.
 */
export function lightboxLensVerdicts(group: LightboxReadingGroup, outcome: LightboxGroupOutcome): Map<LightboxLensId, LensVerdict> {
  const verdicts = new Map<LightboxLensId, LensVerdict>();
  for (const lens of outcome.lenses) {
    const earlier = lightboxLensHasReading(group, lens);
    if (outcome.status === 'failed') {
      verdicts.set(lens, earlier ? { kind: 'keep', reason: outcome.error ?? 'The reading failed.' } : { kind: 'drop' });
      continue;
    }
    if (outcome.tiles.some((tile) => tile.lens === lens)) {
      verdicts.set(lens, { kind: 'replace' });
      continue;
    }
    verdicts.set(lens, earlier ? { kind: 'keep', reason: notReplaced(outcome, lens) } : { kind: 'fresh' });
  }
  // Lenses kept together: when one keeps its earlier reading, every one of them that has one keeps it too.
  for (const unit of LIGHTBOX_KEPT_TOGETHER) {
    const keeper = unit.find((lens) => verdicts.get(lens)?.kind === 'keep');
    if (!keeper) {
      continue;
    }
    for (const lens of unit) {
      if (lens !== keeper && verdicts.get(lens)?.kind === 'replace' && lightboxLensHasReading(group, lens)) {
        verdicts.set(lens, { kind: 'keep', reason: LIGHTBOX_KEEP_REASONS.together(keeper) });
      }
    }
  }
  return verdicts;
}

/**
 * A reading the call leaves on the board with no provenance of its own (a
 * board read before Slice 4J) keeps the model that read it: its group's,
 * taken now, before the group's model becomes this call's (PR #170 F-02).
 * Only the model: the board never held that reading's run or time. A group
 * that named no model gives an entry with none, so the reading is never
 * said to be the latest call's.
 */
function carriedProvenance(
  group: LightboxReadingGroup,
  taken: readonly LightboxLensId[],
  model: string | undefined
): LightboxLensProvenance[] {
  return RAIL_ORDER
    .filter((lens) => !taken.includes(lens) && lightboxLensWasRead(group, lens) && !lightboxLensProvenance(group, lens))
    .map((lens) => ({ lens, ...(model ? { model } : {}) }));
}

/** Why a call that came back drew no reading of `lens`: its block withheld (cut off, missing, broken), or no tile. */
function notReplaced(outcome: LightboxGroupOutcome, lens: LightboxLensId): string {
  const block = outcome.withheldBlocks.find((entry) => entry.lens === lens);
  if (block) {
    return block.reason;
  }
  const withheld = outcome.withheldClaims.filter((claim) => claim.lens === lens).length;
  return withheld > 0 ? LIGHTBOX_KEEP_REASONS.noTile(withheld) : LIGHTBOX_KEEP_REASONS.empty;
}

/**
 * Mark the stopped run's still-running groups `cancelled`, keeping what
 * they hold: each pending lens with a reading keeps it, marked earlier with
 * `message`.
 */
export function stopLightboxGroups(
  readings: readonly LightboxReadingGroup[],
  groups: readonly LightboxReadingGroupId[],
  message: string
): LightboxReadingGroup[] {
  return readings.map((group) => (groups.includes(group.group) && group.status === 'running' ? cancelLightboxGroup(group, message) : group));
}

/**
 * A running group whose call will not land (stopped, or its text changed
 * underneath it, D4): `cancelled` with `message`, every pending lens that
 * still holds a reading marked earlier with it.
 */
export function cancelLightboxGroup(group: LightboxReadingGroup, message: string): LightboxReadingGroup {
  const { pending = [], ...rest } = group;
  const kept = pending.filter((lens) => lightboxLensHasReading(group, lens)).map((lens) => ({ lens, reason: message }));
  const earlier = inLensOrder([...(group.earlierLenses ?? []).filter((mark) => !pending.includes(mark.lens)), ...kept]);
  const { earlierLenses: _earlier, ...cancelled } = rest;
  return { ...cancelled, status: 'cancelled', error: message, ...earlierField(earlier) };
}

/** The group without anything of `lenses`: no tiles, notes, checks, marks or provenance. */
function withoutLenses(group: LightboxReadingGroup, lenses: readonly LightboxLensId[]): LightboxReadingGroup {
  if (lenses.length === 0) {
    return group;
  }
  const keep = <T extends { lens: LightboxLensId }>(entries: readonly T[]): T[] => entries.filter((entry) => !lenses.includes(entry.lens));
  const { staleLenses, provenance, earlierLenses, ...rest } = group;
  return {
    ...rest,
    lenses: group.lenses.filter((lens) => !lenses.includes(lens)),
    tiles: keep(group.tiles),
    withheldBlocks: keep(group.withheldBlocks),
    withheldClaims: keep(group.withheldClaims),
    frictions: keep(group.frictions),
    quoteChecks: keep(group.quoteChecks),
    ...staleField(staleLenses && keep(staleLenses)),
    ...provenanceField(provenance && keep(provenance)),
    ...earlierField(earlierLenses && keep(earlierLenses))
  };
}

function staleField(marks: readonly LightboxStaleLens[] | undefined): { staleLenses?: LightboxStaleLens[] } {
  return marks && marks.length > 0 ? { staleLenses: [...marks] } : {};
}

function provenanceField(entries: readonly LightboxLensProvenance[] | undefined): { provenance?: LightboxLensProvenance[] } {
  return entries && entries.length > 0 ? { provenance: [...entries] } : {};
}

function earlierField(marks: readonly LightboxEarlierLens[] | undefined): { earlierLenses?: LightboxEarlierLens[] } {
  return marks && marks.length > 0 ? { earlierLenses: [...marks] } : {};
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
