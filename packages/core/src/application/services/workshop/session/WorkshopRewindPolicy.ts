/**
 * Host-side rewindability policy (ADR 2026-09-30 §1, §4).
 *
 * Two layers, deliberately separate:
 * - The CUT layer answers "can the room be cut here?" for any
 *   `afterTurn`/`beforeTurn` position — dividers and session markers
 *   included — so callers that are not bubbles (Side Quests) can cut at a
 *   pinned rest point.
 * - The BUBBLE layer maps eligible thread bubbles to their cut (ADR §1 table)
 *   and then asks the cut layer.
 *
 * Pure: ledger facts, retained-history marks, and run state in; a verdict
 * out. The aggregate publishes bubble verdicts on its snapshot, and every
 * rewind operation re-checks its cut here, because webview gating is only
 * advisory.
 */

import type {
  WorkshopTurn,
  WorkshopTurnRewindability,
  WorkshopTurnRewindUnavailableReason
} from '@messages';
import type {
  WorkshopRetainedHistoryMarkV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

/** A rest point to cut the room at: keep through `turnId`, or keep everything before it. */
export interface WorkshopRewindCut {
  kind: 'afterTurn' | 'beforeTurn';
  turnId: string;
}

export type WorkshopCutRefusalReason =
  | 'not-a-rest-point'
  | WorkshopTurnRewindUnavailableReason;

export type WorkshopCutEvaluation =
  | {
      ok: true;
      /** The last turn the cut keeps: every cut normalizes to `afterTurn` of this. */
      keptThroughTurnId: string;
    }
  | { ok: false; reason: WorkshopCutRefusalReason };

/** The scalar turn facts rewind policy reads; never bodies or private evidence. */
export interface WorkshopRewindTurnFacts {
  id: string;
  role: WorkshopTurn['role'];
  participant: WorkshopTurn['participant'];
  artifact: WorkshopTurn['artifact'];
  /** Capability evidence is transcript material from a run, never a rest point. */
  capability: boolean;
}

export function workshopRewindTurnFacts(turn: Readonly<WorkshopTurn>): WorkshopRewindTurnFacts {
  return {
    id: turn.id,
    role: turn.role,
    participant: turn.participant,
    artifact: turn.artifact,
    capability: turn.capability !== undefined
  };
}

export interface WorkshopRewindPolicyInput {
  turns: readonly WorkshopRewindTurnFacts[];
  marks: readonly Pick<WorkshopRetainedHistoryMarkV1, 'turnId' | 'conversationKey'>[];
  /** A run is active or a session operation is pending. */
  busy: boolean;
}

/** A writer turn that starts a room run. */
const startsRun = (turn: WorkshopRewindTurnFacts): boolean =>
  turn.role === 'user'
  && turn.participant === 'writer'
  && (
    turn.artifact === 'persona_message'
    || turn.artifact === 'direct_tool_message'
    || turn.artifact === 'tool_request'
  );

/** A committed reply appended as its room run ends. */
const endsRun = (turn: WorkshopRewindTurnFacts): boolean =>
  turn.role === 'assistant'
  && !turn.capability
  && (
    (
      (turn.participant === 'host' || turn.participant === 'guest')
      && turn.artifact === 'persona_message'
    )
    || turn.artifact === 'persona_synthesis'
    || turn.artifact === 'direct_tool_response'
  );

/**
 * A writer-requested sidecar report. Its run may continue into host
 * synthesis, but the aggregate holds no active run between the report commit
 * and the synthesis start, so the report itself is a rest point.
 */
const commitsToolReport = (turn: WorkshopRewindTurnFacts): boolean =>
  turn.role === 'assistant'
  && !turn.capability
  && turn.participant === 'tool'
  && turn.artifact === 'tool_report';

const authoredByHost = (turn: WorkshopRewindTurnFacts): boolean =>
  turn.role === 'assistant' && turn.participant === 'host';

/** ADR §1: the bubbles that offer Rewind/Branch, mapped to their cut. */
export function workshopBubbleCut(turn: WorkshopRewindTurnFacts): WorkshopRewindCut | undefined {
  if (endsRun(turn) || commitsToolReport(turn)) {
    // Keep this reply; drop everything after it.
    return { kind: 'afterTurn', turnId: turn.id };
  }
  if (
    turn.role === 'user'
    && turn.participant === 'writer'
    && (turn.artifact === 'persona_message' || turn.artifact === 'direct_tool_message')
  ) {
    // Drop this message and everything after it; its text returns to the composer.
    return { kind: 'beforeTurn', turnId: turn.id };
  }
  return undefined;
}

/**
 * Positions after which the room was provably at rest between runs. The
 * ledger records no run boundaries, so this proves rest conservatively:
 * - after a committed run-ending reply, or a writer-requested tool report;
 * - after a ledger event appended while no run was open;
 * - immediately before any run-starting writer turn — one room run at a
 *   time, and preemption abandons the previous run before the next begins;
 * - at the ledger head whenever the room is idle.
 * A position inside an abandoned run's tail is unproven unless one of those
 * rules reaches it, and is refused.
 */
function provenRestPoints(turns: readonly WorkshopRewindTurnFacts[], busy: boolean): boolean[] {
  const rest = turns.map(() => false);
  let runOpen = false;
  turns.forEach((turn, index) => {
    if (startsRun(turn)) {
      if (index > 0) {
        rest[index - 1] = true;
      }
      runOpen = true;
    } else if (endsRun(turn)) {
      rest[index] = true;
      runOpen = false;
    } else if (commitsToolReport(turn)) {
      rest[index] = true;
      runOpen = true;
    } else if (turn.capability) {
      runOpen = true;
    } else {
      rest[index] = !runOpen;
    }
  });
  if (turns.length > 0 && !busy) {
    rest[turns.length - 1] = true;
  }
  return rest;
}

export class WorkshopRewindPolicy {
  private readonly positions: Map<string, number>;
  private readonly restAfter: boolean[];
  private readonly firstHostReplyIndex: number;
  private readonly firstHostMarkIndex: number;
  private readonly latestDirectiveChangeIndex: number;

  constructor(private readonly input: WorkshopRewindPolicyInput) {
    this.positions = new Map(input.turns.map((turn, index) => [turn.id, index]));
    this.restAfter = provenRestPoints(input.turns, input.busy);
    this.firstHostReplyIndex = input.turns.findIndex(authoredByHost);
    this.firstHostMarkIndex = input.marks.reduce((first, mark) => {
      const index = mark.conversationKey === 'host'
        ? this.positions.get(mark.turnId)
        : undefined;
      return index === undefined ? first : Math.min(first, index);
    }, Infinity);
    this.latestDirectiveChangeIndex = input.turns.reduce(
      (latest, turn, index) => turn.artifact === 'standing_directive_change' ? index : latest,
      -1
    );
  }

  /** The cut layer: any rest point, whether or not a bubble sits there. */
  evaluateCut(cut: WorkshopRewindCut): WorkshopCutEvaluation {
    if (this.input.busy) {
      return { ok: false, reason: 'busy' };
    }
    const position = this.positions.get(cut.turnId);
    const cutIndex = position === undefined
      ? undefined
      : cut.kind === 'afterTurn' ? position : position - 1;
    // A cut must keep at least one turn: before the first turn there is no
    // ledger position at which the room was ever at rest.
    if (cutIndex === undefined || cutIndex < 0 || !this.restAfter[cutIndex]) {
      return { ok: false, reason: 'not-a-rest-point' };
    }
    // Host exactness: the host's memory at the cut must be a recorded mark.
    // Marks cover every host commit since the host's first mark in its
    // current membership, so any host mark at or before the cut suffices.
    if (
      this.firstHostReplyIndex >= 0
      && this.firstHostReplyIndex <= cutIndex
      && this.firstHostMarkIndex > cutIndex
    ) {
      return { ok: false, reason: 'before-rewind-support' };
    }
    // v1 directive floor: a shifted directive's earlier draft is not retained.
    if (this.latestDirectiveChangeIndex > cutIndex) {
      return { ok: false, reason: 'before-directive-change' };
    }
    return { ok: true, keptThroughTurnId: this.input.turns[cutIndex].id };
  }

  /** The bubble layer: ineligible or unknown turns are not rest points to offer. */
  evaluateBubble(turnId: string): WorkshopCutEvaluation {
    const position = this.positions.get(turnId);
    const cut = position === undefined
      ? undefined
      : workshopBubbleCut(this.input.turns[position]);
    return cut ? this.evaluateCut(cut) : { ok: false, reason: 'not-a-rest-point' };
  }

  /**
   * Display verdicts for a set of turns (the snapshot window). Turns that
   * offer no action are omitted; eligible bubbles report available or a
   * disabled reason.
   */
  bubbleRewindability(turnIds: readonly string[]): Record<string, WorkshopTurnRewindability> {
    const verdicts: Record<string, WorkshopTurnRewindability> = {};
    for (const turnId of turnIds) {
      const evaluation = this.evaluateBubble(turnId);
      if (evaluation.ok) {
        verdicts[turnId] = { available: true };
      } else if (evaluation.reason !== 'not-a-rest-point') {
        verdicts[turnId] = { available: false, reason: evaluation.reason };
      }
    }
    return verdicts;
  }
}
