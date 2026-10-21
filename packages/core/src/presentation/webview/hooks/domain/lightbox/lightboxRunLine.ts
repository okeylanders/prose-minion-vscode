/**
 * The run line: what the Read button says and does (ADR 2026-10-19 D6, D8).
 * Pure: no React, no transport.
 *
 * Before any press it states the call count and the estimated cost, warns
 * when the text is book-sized, and is disabled with the reason when a call
 * would not fit the model's window. While a run is in flight it counts the
 * groups back and offers Stop. Afterwards it counts the quotes checked and
 * withheld, and offers the next press: "Read the rest" when a group stopped
 * or failed, "Re-read" when everything landed, and says how many lenses are
 * stale after the text changed (D4). Every figure comes from the host's
 * estimate and board. The Opinion (Slice 4D) is priced "up to" its
 * digest's bound, and the cost note says so; while it is the one group
 * still out, the line says it is weighing the board.
 *
 * Everything is the board's own (PR #149 F-03): an estimate for another
 * board is no estimate ("Estimating the cost…", nothing to press), and Stop
 * and the groups being read come from the board's own run, never from a
 * token another board's progress carried.
 */

import type {
  LightboxActiveRun,
  LightboxBoard,
  LightboxCallEstimate,
  LightboxLensId,
  LightboxReadingGroupId,
  LightboxRunEstimate,
  LightboxRunProgress,
  LightboxRunScope
} from '@messages';
import { LIGHTBOX_BOARD_GROUP, lightboxLensLabel, lightboxRereadLenses } from '@shared/constants/lightbox';
import { lightboxQuoteTally, lightboxStaleLensCount, pluralize } from '@hooks/domain/lightbox/lightboxReadings';

export type LightboxRunLineStatus = 'estimating' | 'idle' | 'running' | 'done' | 'stopped' | 'none';

export interface LightboxRunLineAction {
  label: 'Read the chapter' | 'Read the rest' | 'Re-read';
  scope: LightboxRunScope;
  /** "3 calls · est. $0.04". */
  cost: string;
  disabled: boolean;
  reason?: string;
}

export interface LightboxRunLineView {
  status: LightboxRunLineStatus;
  note: string;
  /** The book-sized warning: the press is still allowed. */
  warning?: string;
  action?: LightboxRunLineAction;
  /** The token Stop sends; absent until the host names the run. */
  stopToken?: string;
  /** A refusal or other message from the host, writer-facing. */
  notice?: string;
}

export interface LightboxRunLineInput {
  board: LightboxBoard;
  /** `undefined` until the host answers; `null` when there is nothing to estimate. */
  estimate: LightboxRunEstimate | null | undefined;
  /** The latest progress for this board: its run's, or a refusal of a press on it. */
  progress?: LightboxRunProgress | null;
  /** The board's run in flight, by its token. */
  activeRun?: LightboxActiveRun | null;
  /** The press was sent and the host has not answered yet. */
  awaitingStart: boolean;
  providerPaused: boolean;
}

/** "$0.04", or "< $0.01" for a cost that rounds to nothing. */
export function formatLightboxCost(usd: number): string {
  return usd > 0 && usd < 0.005 ? '< $0.01' : `$${usd.toFixed(2)}`;
}

/** The cost line for some calls: their count, then the estimate or why there is none. */
export function lightboxCallsNote(calls: readonly LightboxCallEstimate[]): string {
  const count = pluralize(calls.length, 'call');
  if (calls.length === 0) {
    return 'measure only · free';
  }
  const costs = calls.map((call) => call.costUsd);
  const cost = costs.every((value) => value !== undefined)
    ? `est. ${formatLightboxCost(costs.reduce<number>((sum, value) => sum + (value as number), 0))}`
    : 'cost unavailable';
  const unknown = calls.some((call) => call.fit === 'unknown') ? ' · model window unknown' : '';
  // The Opinion's digest is built when it starts, so its call is priced at the digest's bound (Slice 4D).
  const bound = calls.some((call) => call.inputBound === 'digest')
    ? calls.length === 1 ? ' · up to its digest bound' : ' · the Opinion up to its digest bound'
    : '';
  return `${count} · ${cost}${unknown}${bound}`;
}

/** What a tile's "Re-read" would cost. */
export function lightboxRereadNote(
  estimate: LightboxRunEstimate | null | undefined,
  lens: LightboxLensId,
  lensesOff: readonly LightboxLensId[] = []
): string | undefined {
  const call = rereadCall(estimate, lens, lensesOff);
  return call ? lightboxCallsNote([call]) : undefined;
}

export interface LightboxRereadInput {
  /** The current board's estimate (`undefined` while it is being asked for). */
  estimate: LightboxRunEstimate | null | undefined;
  lens: LightboxLensId;
  lensesOff: readonly LightboxLensId[];
  providerPaused: boolean;
  /** A reading of this board is in flight or being started. */
  running: boolean;
}

/**
 * Whether a tile's "Re-read" can run now (PR #149 F-08): its lens must be on,
 * and the current estimate must price a call for that lens alone that fits
 * the model's window. Otherwise the press is disabled with the reason, not
 * offered only for the host to refuse it.
 */
export function lightboxRereadAvailability(input: LightboxRereadInput): { note?: string; reason?: string } {
  const { estimate, lens } = input;
  if (input.providerPaused) {
    return { reason: 'Add an OpenRouter API key in Settings to read.' };
  }
  if (input.running) {
    return { reason: 'A reading is running. Stop it, or wait for it to finish.' };
  }
  if (input.lensesOff.includes(lens)) {
    return { reason: `The ${lightboxLensLabel(lens)} lens is off. Turn it on in the rail to re-read this tile.` };
  }
  if (estimate === undefined) {
    return { reason: 'Estimating the cost…' };
  }
  const call = rereadCall(estimate, lens, input.lensesOff);
  if (!call) {
    return { reason: 'This tile cannot be re-read until the board is estimated.' };
  }
  if (call.fit === 'too-large') {
    const window = (estimate?.contextLength ?? 0).toLocaleString('en-US');
    return {
      reason: `Re-reading this tile would send about ${call.inputTokens.toLocaleString('en-US')} tokens and reserve ` +
        `${call.reservedOutputTokens.toLocaleString('en-US')} for the reply, more than ` +
        `${estimate?.model ?? 'the assistant model'}'s ${window}-token window allows.`
    };
  }
  return { note: lightboxCallsNote([call]) };
}

/**
 * The estimate of what "Re-read" sends for `lens`: the call the host priced
 * for exactly the lenses it reads with this one (`lightboxRereadLenses`:
 * template and summary are read together, Slice 4C).
 */
function rereadCall(
  estimate: LightboxRunEstimate | null | undefined,
  lens: LightboxLensId,
  lensesOff: readonly LightboxLensId[]
): LightboxCallEstimate | undefined {
  const lenses = lightboxRereadLenses(lens, lensesOff);
  return estimate?.rereads.find((candidate) =>
    candidate.lenses.length === lenses.length && candidate.lenses.every((entry, index) => entry === lenses[index]));
}

export function buildLightboxRunLine(input: LightboxRunLineInput): LightboxRunLineView {
  const { board, providerPaused } = input;
  const activeRun = input.activeRun?.boardId === board.boardId ? input.activeRun : null;
  const progress = input.progress?.boardId === board.boardId ? input.progress : null;
  const notice = progress?.phase === 'refused' ? progress.message : undefined;
  // Another board's estimate prices nothing here.
  const estimate = input.estimate && input.estimate.boardId !== board.boardId ? undefined : input.estimate;
  const running = board.readings.filter((group) => group.status === 'running');

  if (running.length > 0 || input.awaitingStart) {
    const groups = activeRun?.groups.length ? activeRun.groups : running.map((group) => group.group);
    const back = groups.length - running.length;
    // The Opinion runs last, once the others are back (Slice 4D).
    const weighing = running.length === 1 && running[0].group === LIGHTBOX_BOARD_GROUP && groups.length > 1;
    return {
      status: 'running',
      note: running.length === 0
        ? 'Starting…'
        : `${weighing ? 'Weighing the board for the Opinion…' : 'Reading…'} ${back} of ${pluralize(groups.length, 'lens group')} back`,
      ...(activeRun && running.length > 0 ? { stopToken: activeRun.token } : {})
    };
  }

  if (estimate === undefined) {
    // The button keeps its place, disabled, until the host has priced the press.
    return {
      status: 'estimating',
      note: 'Estimating the cost…',
      action: { label: 'Read the chapter', scope: { mode: 'all' }, cost: '', disabled: true },
      ...(notice ? { notice } : {})
    };
  }
  const planned = estimate?.groups ?? [];
  if (planned.length === 0) {
    return { status: 'none', note: 'measure only · free', ...(notice ? { notice } : {}) };
  }

  const statusOf = (group: LightboxReadingGroupId) => board.readings.find((reading) => reading.group === group)?.status;
  const ran = board.readings.some((group) => group.status !== 'not-run');
  const rest = planned.filter((call) => statusOf(call.group) !== 'ok');
  const stopped = board.readings.some((group) => group.status === 'cancelled');
  const warning = estimate?.bookSized
    ? `Book-sized: ${estimate.sourceWords.toLocaleString('en-US')} words`
    : undefined;

  const action = (label: LightboxRunLineAction['label'], scope: LightboxRunScope, calls: readonly LightboxCallEstimate[]): LightboxRunLineAction => {
    const tooLarge = calls.some((call) => call.fit === 'too-large');
    const reason = providerPaused
      ? 'Add an OpenRouter API key in Settings to read the chapter.'
      : tooLarge
        ? estimate?.reason ?? 'A call is too large for the model\'s window.'
        : undefined;
    return { label, scope, cost: lightboxCallsNote(calls), disabled: reason !== undefined, ...(reason ? { reason } : {}) };
  };

  if (!ran) {
    return {
      status: 'idle',
      note: lightboxCallsNote(planned),
      ...(warning ? { warning } : {}),
      action: action('Read the chapter', { mode: 'all' }, planned),
      ...(notice ? { notice } : {})
    };
  }

  const tally = lightboxQuoteTally(board);
  const parts = [
    `${pluralize(tally.checked, 'quote')} checked`,
    `${tally.withheld.toLocaleString('en-US')} withheld`,
    pluralize(tally.calls, 'call')
  ];
  if (tally.failed > 0) {
    parts.push(`${pluralize(tally.failed, 'group')} failed`);
  }
  if (stopped) {
    parts.push('stopped, finished groups kept');
  }
  const stale = lightboxStaleLensCount(board);
  if (stale > 0) {
    parts.push(`${pluralize(stale, 'lens', 'lenses')} stale`);
  }
  const note = parts.join(' · ');
  if (rest.length > 0) {
    return {
      status: stopped ? 'stopped' : 'done',
      note,
      ...(warning ? { warning } : {}),
      action: action('Read the rest', { mode: 'rest' }, rest),
      ...(notice ? { notice } : {})
    };
  }
  return {
    status: 'done',
    note,
    ...(warning ? { warning } : {}),
    action: action('Re-read', { mode: 'all' }, planned),
    ...(notice ? { notice } : {})
  };
}
