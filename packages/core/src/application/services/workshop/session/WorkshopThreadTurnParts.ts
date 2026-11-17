/**
 * What the thread draws for a list of turns (ADR 2026-11-17 D2, D3).
 *
 * The snapshot's window and a page of earlier turns are both built here, so
 * an earlier bubble shows exactly what it would have shown in the window:
 * the turns, the host's Rewind verdicts, the reaction summaries and the
 * widget-config summaries. `WorkshopSessionService` supplies the sources;
 * this module knows no ledger and computes no verdict of its own.
 *
 * It also holds the page's bounds: how far back from a turn one page reads.
 */

import type {
  WorkshopTurn,
  WorkshopTurnReactionSummary,
  WorkshopTurnRewindability,
  WorkshopWidgetConfigSummary
} from '@messages';

/** The aggregate's own rules, read per call and never cached here. */
export interface WorkshopThreadTurnSources {
  rewindability(turnIds: readonly string[]): Record<string, WorkshopTurnRewindability>;
  reactions(turns: readonly WorkshopTurn[]): WorkshopTurnReactionSummary[];
  widgetConfigs(configIds: ReadonlySet<string>): WorkshopWidgetConfigSummary[];
}

export interface WorkshopThreadTurnParts {
  turns: WorkshopTurn[];
  turnRewindability: Record<string, WorkshopTurnRewindability>;
  reactions: WorkshopTurnReactionSummary[];
  widgetConfigs: WorkshopWidgetConfigSummary[];
}

/**
 * The per-turn parts for `turns`, in the order given.
 *
 * @param alsoWidgetConfigIds Configs shown beside the turns' own (the
 * snapshot's standing directives).
 */
export function workshopThreadTurnParts(
  turns: WorkshopTurn[],
  sources: WorkshopThreadTurnSources,
  alsoWidgetConfigIds: readonly string[] = []
): WorkshopThreadTurnParts {
  const widgetConfigIds = new Set(
    [
      ...turns.map((turn) => turn.widgetCommit?.widgetConfigId),
      ...alsoWidgetConfigIds
    ].filter((id): id is string => id !== undefined)
  );
  return {
    turns,
    turnRewindability: sources.rewindability(turns.map((turn) => turn.id)),
    reactions: sources.reactions(turns),
    widgetConfigs: sources.widgetConfigs(widgetConfigIds)
  };
}

export interface WorkshopEarlierTurnsBounds {
  /** Turns one page holds. */
  pageTurns: number;
  /** The UTF-8 size of a page's turns. */
  pageBytes: number;
  /** A turn's size as it will be sent; the stored record's JSON when absent. */
  bytesOf?: (turn: Readonly<WorkshopTurn>) => number;
}

/** The UTF-8 size of a turn's JSON. */
export function workshopTurnBytes(turn: Readonly<WorkshopTurn>): number {
  return Buffer.byteLength(JSON.stringify(turn), 'utf8');
}

/**
 * Whether a page walking back from its newest turn keeps the next older one:
 * until it holds `pageTurns`, or the next would pass `pageBytes`. The first
 * turn is always kept, so a turn larger than `pageBytes` is sent alone and
 * paging always makes progress.
 */
export function workshopEarlierTurnsTake(
  bounds: WorkshopEarlierTurnsBounds
): (turn: Readonly<WorkshopTurn>, taken: number) => boolean {
  const bytesOf = bounds.bytesOf ?? workshopTurnBytes;
  let bytes = 0;
  return (turn, taken) => {
    if (taken === 0) {
      bytes = bytesOf(turn);
      return true;
    }
    if (taken >= bounds.pageTurns) {
      return false;
    }
    const next = bytes + bytesOf(turn);
    if (next > bounds.pageBytes) {
      return false;
    }
    bytes = next;
    return true;
  };
}
