/**
 * The earlier turns the webview holds, as plain data (ADR 2026-11-17 D5):
 * one contiguous run that ends directly before the snapshot window's first
 * turn. Pure; the hook owns the requests.
 *
 * Each entry keeps its turn beside what the host said of it (its Rewind
 * verdict, its reaction summaries, its widget config's summary), so a slice
 * of the run is always whole. Nothing here works out a verdict: an entry's
 * parts are the host's, copied from a page or from the snapshot the turn
 * slid out of.
 */

import type {
  WorkshopEarlierTurnsPage,
  WorkshopTurn,
  WorkshopTurnReactionSummary,
  WorkshopTurnRewindability,
  WorkshopWidgetConfigSummary
} from '@messages';
import {
  workshopModelsBeforeWindow,
  type WorkshopModelsBeforeWindow
} from '@shared/workshop/workshopModelSlices';

export interface WorkshopEarlierTurnEntry {
  readonly turn: WorkshopTurn;
  readonly rewindability?: WorkshopTurnRewindability;
  readonly reactions: readonly WorkshopTurnReactionSummary[];
  readonly widgetConfig?: WorkshopWidgetConfigSummary;
}

export interface WorkshopEarlierTurnsRun {
  /** Oldest first. */
  readonly entries: readonly WorkshopEarlierTurnEntry[];
  /** Turns the room holds before the run's first, as the host last said. */
  readonly remainingBefore: number;
  /** The model-slice seed for the run's first reply. */
  readonly modelsBefore?: WorkshopModelsBeforeWindow;
}

export const WORKSHOP_NO_EARLIER_TURNS: WorkshopEarlierTurnsRun = { entries: [], remainingBefore: 0 };

/** The per-turn parts a page and a snapshot both carry. */
export type WorkshopEarlierTurnsParts = Pick<
  WorkshopEarlierTurnsPage,
  'turns' | 'turnRewindability' | 'reactions' | 'widgetConfigs'
>;

const NO_REACTIONS: readonly WorkshopTurnReactionSummary[] = [];

/** One entry per turn, each with the host's parts for it. */
export function workshopEarlierTurnEntries(
  parts: WorkshopEarlierTurnsParts,
  turns: readonly WorkshopTurn[] = parts.turns
): WorkshopEarlierTurnEntry[] {
  const reactions = new Map<string, WorkshopTurnReactionSummary[]>();
  for (const summary of parts.reactions ?? []) {
    reactions.set(summary.turnId, [...(reactions.get(summary.turnId) ?? []), summary]);
  }
  const configs = new Map((parts.widgetConfigs ?? []).map((config) => [config.id, config]));
  return turns.map((turn) => {
    const rewindability = parts.turnRewindability?.[turn.id];
    const widgetConfig = turn.widgetCommit ? configs.get(turn.widgetCommit.widgetConfigId) : undefined;
    return {
      turn,
      reactions: reactions.get(turn.id) ?? NO_REACTIONS,
      ...(rewindability ? { rewindability } : {}),
      ...(widgetConfig ? { widgetConfig } : {})
    };
  });
}

/** "Show earlier turns" landed: the page leads the run, and its start is the run's. */
export function workshopEarlierRunWithOlderPage(
  run: WorkshopEarlierTurnsRun,
  page: WorkshopEarlierTurnsPage
): WorkshopEarlierTurnsRun {
  const held = new Set(run.entries.map((entry) => entry.turn.id));
  return {
    entries: [...workshopEarlierTurnEntries(page).filter((entry) => !held.has(entry.turn.id)), ...run.entries],
    remainingBefore: page.remainingBefore,
    ...(page.modelsBefore ? { modelsBefore: page.modelsBefore } : {})
  };
}

/**
 * The window slid: the turns that left it for the hidden range join the end
 * of the run as the earlier snapshot showed them, so the thread has no gap
 * while they are read again. A window that does not continue the earlier one
 * carries nothing; the re-read fills it.
 */
export function workshopEarlierRunCarrying(
  run: WorkshopEarlierTurnsRun,
  earlierWindow: WorkshopEarlierTurnsParts,
  windowFirstTurnId: string | undefined
): WorkshopEarlierTurnsRun {
  const slidCount = earlierWindow.turns.findIndex((turn) => turn.id === windowFirstTurnId);
  if (slidCount <= 0) {
    return run;
  }
  const held = new Set(run.entries.map((entry) => entry.turn.id));
  const slid = workshopEarlierTurnEntries(earlierWindow, earlierWindow.turns.slice(0, slidCount))
    .filter((entry) => !held.has(entry.turn.id));
  return slid.length === 0 ? run : { ...run, entries: [...run.entries, ...slid] };
}

/**
 * The run while it is read again: the entries read so far (`fresh`, which end
 * directly before the window) replace everything the run held from their
 * place on. A held turn the answers covering its place did not return is
 * gone; the turns older than `fresh` wait for their own answer.
 */
export function workshopEarlierRunRereadSoFar(
  run: WorkshopEarlierTurnsRun,
  fresh: readonly WorkshopEarlierTurnEntry[]
): WorkshopEarlierTurnsRun {
  const read = new Set(fresh.map((entry) => entry.turn.id));
  const covered = run.entries.findIndex((entry) => read.has(entry.turn.id));
  const older = covered < 0 ? run.entries : run.entries.slice(0, covered);
  return { ...run, entries: [...older, ...fresh] };
}

export interface WorkshopEarlierRereadStep {
  /** Everything read so far, oldest first, ending directly before the window. */
  readonly fresh: readonly WorkshopEarlierTurnEntry[];
  /** Set once the walk has read back to the oldest turn held: the run as read. */
  readonly run?: WorkshopEarlierTurnsRun;
}

/**
 * One answer of a re-read walk. The walk ends when the answer holds the
 * oldest turn the run held (the run then starts there, and the answer's
 * older turns are left out), at the room's first turn, or at `limit` turns,
 * which stops a walk whose oldest turn the room no longer holds.
 */
export function workshopEarlierRereadStep(
  freshSoFar: readonly WorkshopEarlierTurnEntry[],
  page: WorkshopEarlierTurnsPage,
  oldestHeldTurnId: string,
  limit: number
): WorkshopEarlierRereadStep {
  const pageEntries = workshopEarlierTurnEntries(page);
  const start = pageEntries.findIndex((entry) => entry.turn.id === oldestHeldTurnId);
  if (start >= 0) {
    // The seed moves forward over the answer's turns the run does not keep.
    const before = page.turns.slice(0, start);
    const modelsBefore = { ...page.modelsBefore, ...workshopModelsBeforeWindow(before, before.length) };
    const fresh = [...pageEntries.slice(start), ...freshSoFar];
    return {
      fresh,
      run: {
        entries: fresh,
        remainingBefore: page.remainingBefore + start,
        ...(Object.keys(modelsBefore).length > 0 ? { modelsBefore } : {})
      }
    };
  }
  const fresh = [...pageEntries, ...freshSoFar];
  if (page.remainingBefore > 0 && pageEntries.length > 0 && fresh.length < limit) {
    return { fresh };
  }
  return {
    fresh,
    run: {
      entries: fresh,
      remainingBefore: page.remainingBefore,
      ...(page.modelsBefore ? { modelsBefore: page.modelsBefore } : {})
    }
  };
}

/** What the thread draws for the run, beside the window's own. */
export interface WorkshopEarlierTurnsThreadParts {
  /** The run's turns the window does not already show, oldest first. */
  readonly turns: readonly WorkshopTurn[];
  readonly turnRewindability: Readonly<Record<string, WorkshopTurnRewindability>>;
  readonly reactionsByTurn: ReadonlyMap<string, readonly WorkshopTurnReactionSummary[]>;
  readonly widgetConfigSummaries: Readonly<Record<string, WorkshopWidgetConfigSummary>>;
}

export function workshopEarlierTurnsThreadParts(
  run: WorkshopEarlierTurnsRun,
  windowTurns: readonly WorkshopTurn[]
): WorkshopEarlierTurnsThreadParts {
  const inWindow = new Set(windowTurns.map((turn) => turn.id));
  const turns: WorkshopTurn[] = [];
  const turnRewindability: Record<string, WorkshopTurnRewindability> = {};
  const reactionsByTurn = new Map<string, readonly WorkshopTurnReactionSummary[]>();
  const widgetConfigSummaries: Record<string, WorkshopWidgetConfigSummary> = {};
  for (const entry of run.entries) {
    if (inWindow.has(entry.turn.id)) {
      continue;
    }
    turns.push(entry.turn);
    if (entry.rewindability) {
      turnRewindability[entry.turn.id] = entry.rewindability;
    }
    if (entry.reactions.length > 0) {
      reactionsByTurn.set(entry.turn.id, entry.reactions);
    }
    if (entry.widgetConfig) {
      widgetConfigSummaries[entry.widgetConfig.id] = entry.widgetConfig;
    }
  }
  return { turns, turnRewindability, reactionsByTurn, widgetConfigSummaries };
}

/** "100 earlier turns shown." */
export function workshopEarlierTurnsShownAnnouncement(count: number): string {
  return `${count.toLocaleString()} earlier ${count === 1 ? 'turn' : 'turns'} shown.`;
}

/** Whether the run holds a turn (D6, amended 2026-11-18): a jump to it needs no page. */
export function workshopEarlierRunHolds(run: WorkshopEarlierTurnsRun, turnId: string): boolean {
  return run.entries.some((entry) => entry.turn.id === turnId);
}

/** What one page of a jump means for the walk. */
export type WorkshopEarlierJumpStep =
  /** The page holds the target: the walk ends, and the thread shows it. */
  | { readonly kind: 'landed'; readonly loaded: number }
  /** Not yet: ask for the page before the page's oldest turn. */
  | { readonly kind: 'next'; readonly loaded: number; readonly beforeTurnId: string }
  /** The room's first turn was reached without it (the host checked it was there): the walk ends unshown. */
  | { readonly kind: 'lost'; readonly loaded: number };

/**
 * One answer of a jump's walk (D6, amended 2026-11-18). `loadedSoFar`
 * counts the turns the walk's earlier pages added; the host decides the
 * target exists and is in reach, the page only says whether it holds it.
 */
export function workshopEarlierJumpStep(
  loadedSoFar: number,
  page: WorkshopEarlierTurnsPage,
  targetTurnId: string
): WorkshopEarlierJumpStep {
  const loaded = loadedSoFar + page.turns.length;
  if (page.turns.some((turn) => turn.id === targetTurnId)) {
    return { kind: 'landed', loaded };
  }
  const oldest = page.turns[0]?.id;
  if (oldest === undefined || page.remainingBefore <= 0) {
    return { kind: 'lost', loaded };
  }
  return { kind: 'next', loaded, beforeTurnId: oldest };
}

/** "140 earlier turns shown. Showing bookmark: The barn." */
export function workshopEarlierJumpAnnouncement(loaded: number, label?: string): string {
  const showing = label ? `Showing bookmark: ${label}.` : 'Showing the bookmarked turn.';
  return loaded > 0 ? `${workshopEarlierTurnsShownAnnouncement(loaded)} ${showing}` : showing;
}
