/**
 * Per-call run controls, as the webview draws them (ADR 2026-10-19 D6;
 * Slice 4I, epic decisions 41–45). Pure: no React, no transport.
 *
 * Each model call (groups A–G) can be run on its own, from two places:
 * - **a widget's Analyze**: every AI-read widget's header. It runs that
 *   widget's call: the call's lenses that are on, with the widget's own lens
 *   even when it is off (the host resolves it the same way, from the
 *   `group` scope). "Analyze" before its lens has a reading, "Re-analyze"
 *   after, "Analyzing…" while the call reading it is in flight;
 * - **a call's Run in the Lenses panel**: "Run A" before the call holds any
 *   reading, "Rerun A" after, "Running A…" while it is in flight. It reads
 *   the call's lenses that are on.
 * The Opinion's (group F) reads the board as it stands: with nothing on it
 * read and current, it is disabled with the Opinion's own reason
 * (`lightboxOpinionNothingToWeigh`), which the host also refuses with.
 *
 * Every price is the host's estimate of exactly that call (`estimate.groups`
 * prices each call with its lenses that are on). While any run of the board
 * is in flight or starting, every control is disabled with the reason, and
 * Stop stays on the run line. Nothing here posts anything: a press goes
 * through the run line's own `run(scope)`, with the estimate it was shown.
 */

import type {
  LightboxBoard,
  LightboxCallEstimate,
  LightboxLensId,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxRunEstimate,
  LightboxRunScope
} from '@messages';
import {
  LIGHTBOX_BOARD_GROUP,
  LIGHTBOX_LENSES,
  LIGHTBOX_READING_GROUPS,
  lightboxGroupCallLenses,
  lightboxLensGroup,
  lightboxLensLabel
} from '@shared/constants/lightbox';
import { lightboxOpinionNothingToWeigh } from '@shared/constants/lightboxOpinion';
import { lightboxLensView } from '@hooks/domain/lightbox/lightboxReadings';
import { formatLightboxCost, LIGHTBOX_RUN_BUSY, LIGHTBOX_RUN_NO_KEY } from '@hooks/domain/lightbox/lightboxRunLine';

/** One call's run control, a widget's or the Lenses panel's. */
export interface LightboxCallControl {
  group: LightboxReadingGroupId;
  /** What the press reads, in rail order, as the host will resolve it. */
  lenses: LightboxLensId[];
  scope: LightboxRunScope;
  /** "Analyze", "Re-analyze", "Analyzing…"; or "Run A", "Rerun A", "Running A…". */
  label: string;
  /** Shown beside the label: "≈ $0.06", "up to $0.05", "< $0.01"; absent when the call is not priced. */
  cost?: string;
  /** The accessible name and tooltip: "Analyze call B: Characters, Voice, Subtext · ≈ $0.04". */
  name: string;
  /** Why it cannot run now; absent when it can. */
  reason?: string;
  /**
   * The reason is this call's own (the Opinion with nothing to weigh, a call
   * too large for the window, every lens of the call off), not a run in
   * flight or a missing key: the widget shows it.
   */
  blocked: boolean;
  /** The call that reads it is in flight. */
  inFlight: boolean;
  /** It reads again what already has a reading ("Re-analyze", "Rerun"). */
  again: boolean;
}

export interface LightboxCallControlsInput {
  board: LightboxBoard;
  /** The current board's estimate; `undefined` while it is asked for. */
  estimate: LightboxRunEstimate | null | undefined;
  lensesOff: readonly LightboxLensId[];
  providerPaused: boolean;
  /** A run of this board is in flight or being started (the run line is `running`). */
  running: boolean;
}

export interface LightboxCallControls {
  /** A widget's Analyze, by its lens. */
  lens: Readonly<Record<LightboxLensId, LightboxCallControl>>;
  /** A call's Run in the Lenses panel, by its group. */
  group: Readonly<Record<LightboxReadingGroupId, LightboxCallControl>>;
}

const ESTIMATING = 'Its cost is being estimated.';
const NOT_PRICED = 'This call has no estimate yet. Wait for the cost, then press again.';

/** Every call's controls on this board, the Opinion's reason read once. */
export function lightboxCallControls(input: LightboxCallControlsInput): LightboxCallControls {
  const opinionReason = lightboxOpinionNothingToWeigh(input.board);
  const lens = Object.fromEntries(LIGHTBOX_LENSES.map(({ id }) => [id, analyzeControl(input, id, opinionReason)]));
  const group = Object.fromEntries(LIGHTBOX_READING_GROUPS.map((id) => [id, runControl(input, id, opinionReason)]));
  return {
    lens: lens as Record<LightboxLensId, LightboxCallControl>,
    group: group as Record<LightboxReadingGroupId, LightboxCallControl>
  };
}

/** A widget's Analyze: its call, with its own lens even when that lens is off. */
function analyzeControl(input: LightboxCallControlsInput, lens: LightboxLensId, opinionReason: string | undefined): LightboxCallControl {
  const group = lightboxLensGroup(lens);
  const lenses = lightboxGroupCallLenses(group, input.lensesOff, lens);
  const view = lightboxLensView(input.board, lens);
  const inFlight = view.phase === 'reading';
  const again = !inFlight && read(groupOf(input.board, group), lens);
  const verb = inFlight ? 'Analyzing' : again ? 'Re-analyze' : 'Analyze';
  return control(input, {
    group,
    lenses,
    scope: { mode: 'group', group, lens },
    label: inFlight ? 'Analyzing…' : verb,
    verb,
    inFlight,
    again,
    opinionReason
  });
}

/** A call's Run in the Lenses panel: the call with its lenses that are on. */
function runControl(input: LightboxCallControlsInput, group: LightboxReadingGroupId, opinionReason: string | undefined): LightboxCallControl {
  const lenses = lightboxGroupCallLenses(group, input.lensesOff);
  const reading = groupOf(input.board, group);
  const inFlight = reading?.status === 'running';
  const again = !inFlight && (reading?.lenses.length ?? 0) > 0;
  const verb = inFlight ? 'Running' : again ? 'Rerun' : 'Run';
  return control(input, {
    group,
    lenses,
    scope: { mode: 'group', group },
    label: inFlight ? `Running ${group}…` : `${verb} ${group}`,
    verb,
    inFlight,
    again,
    opinionReason
  });
}

interface ControlParts {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
  scope: LightboxRunScope;
  label: string;
  /** The name's verb: "Analyze call B: …", "Rerun call A: …". */
  verb: string;
  inFlight: boolean;
  again: boolean;
  opinionReason: string | undefined;
}

function control(input: LightboxCallControlsInput, parts: ControlParts): LightboxCallControl {
  const call = callEstimate(input.estimate, parts.group, parts.lenses);
  const cost = call ? lightboxCallCost(call) : undefined;
  const { reason, blocked } = availability(input, parts, call);
  const lensNames = parts.lenses.map(lightboxLensLabel).join(', ');
  return {
    group: parts.group,
    lenses: parts.lenses,
    scope: parts.scope,
    label: parts.label,
    ...(cost ? { cost } : {}),
    name: `${parts.verb} call ${parts.group}${lensNames ? `: ${lensNames}` : ''}${cost ? ` · ${cost}` : ''}`,
    ...(reason ? { reason } : {}),
    blocked,
    inFlight: parts.inFlight,
    again: parts.again
  };
}

/** Why the control cannot run now, in the order the writer can act on it. */
function availability(
  input: LightboxCallControlsInput,
  parts: ControlParts,
  call: LightboxCallEstimate | undefined
): { reason?: string; blocked: boolean } {
  if (parts.inFlight) {
    return { reason: `Call ${parts.group} is running. Stop is on the run line.`, blocked: false };
  }
  if (input.providerPaused) {
    return { reason: LIGHTBOX_RUN_NO_KEY, blocked: false };
  }
  if (input.running) {
    return { reason: LIGHTBOX_RUN_BUSY, blocked: false };
  }
  if (parts.lenses.length === 0) {
    return { reason: `Every lens of call ${parts.group} is off. Turn one on to run it.`, blocked: true };
  }
  if (parts.group === LIGHTBOX_BOARD_GROUP && parts.opinionReason) {
    return { reason: parts.opinionReason, blocked: true };
  }
  if (input.estimate === undefined) {
    return { reason: ESTIMATING, blocked: false };
  }
  if (!call) {
    return { reason: NOT_PRICED, blocked: false };
  }
  if (call.fit === 'too-large') {
    const window = (input.estimate?.contextLength ?? 0).toLocaleString('en-US');
    return {
      reason: `Call ${parts.group} would send about ${call.inputTokens.toLocaleString('en-US')} tokens and reserve ` +
        `${call.reservedOutputTokens.toLocaleString('en-US')} for the reply, more than ` +
        `${input.estimate?.model ?? 'the assistant model'}'s ${window}-token window allows.`,
      blocked: true
    };
  }
  return { blocked: false };
}

/**
 * A call's price as its button shows it: "≈ $0.06", "< $0.01", or for the
 * Opinion, priced at its digest's bound, "up to $0.05"; absent without live
 * pricing.
 */
export function lightboxCallCost(call: Pick<LightboxCallEstimate, 'costUsd' | 'inputBound'>): string | undefined {
  if (call.costUsd === undefined) {
    return undefined;
  }
  const amount = formatLightboxCost(call.costUsd);
  if (call.inputBound === 'digest') {
    return `up to ${amount}`;
  }
  return amount.startsWith('<') ? amount : `≈ ${amount}`;
}

/** The host's estimate of exactly this call: the group with exactly these lenses. */
function callEstimate(
  estimate: LightboxRunEstimate | null | undefined,
  group: LightboxReadingGroupId,
  lenses: readonly LightboxLensId[]
): LightboxCallEstimate | undefined {
  return estimate?.groups.find((call) =>
    call.group === group && call.lenses.length === lenses.length && call.lenses.every((lens, index) => lens === lenses[index]));
}

function groupOf(board: LightboxBoard, group: LightboxReadingGroupId): LightboxReadingGroup | undefined {
  return board.readings.find((candidate) => candidate.group === group);
}

/** Whether the lens has a reading on the board: its group's latest landed readings came from it. */
function read(group: LightboxReadingGroup | undefined, lens: LightboxLensId): boolean {
  return group?.lenses.includes(lens) ?? false;
}
