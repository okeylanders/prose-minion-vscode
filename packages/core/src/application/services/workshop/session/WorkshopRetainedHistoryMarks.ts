/**
 * Pure grammar and consistency rules for retained-history marks
 * (ADR 2026-09-30 §3).
 *
 * One rule set serves every boundary that touches marks: the ledger
 * collaborator, strict integrity, checkpoint normalization, the persisted
 * archive check, and rewind policy. The rules know turn ids, ledger order, and
 * participant bindings; they never read provider message formats.
 */

import type { WorkshopTurn } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import type {
  WorkshopConversationLogicalKey,
  WorkshopRetainedHistoryMarkV1,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

/** Committed provider-history lengths, in the units an archive persists. */
export interface WorkshopRetainedHistoryCounts {
  messageCount: number;
  contextSourceCount: number;
}

/** What a completion boundary read from the conversation a run committed into. */
export interface WorkshopCommittedRetainedHistory extends WorkshopRetainedHistoryCounts {
  conversationId: string;
}

export type WorkshopImportedRetainedHistory = Partial<
  Record<WorkshopConversationLogicalKey, WorkshopRetainedHistoryCounts>
>;

export function parseWorkshopConversationLogicalKey(
  value: unknown
): WorkshopConversationLogicalKey | undefined {
  if (value === 'host') {
    return 'host';
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value.startsWith('tool:') && isWorkshopToolId(value.slice('tool:'.length))) {
    return value as WorkshopConversationLogicalKey;
  }
  if (value.startsWith('guest:') && isWorkshopPersonaId(value.slice('guest:'.length))) {
    return value as WorkshopConversationLogicalKey;
  }
  return undefined;
}

/**
 * The retained conversation a committed reply turn was written into, or
 * undefined for turns that commit no retained history (writer turns,
 * dividers, and capability evidence, whose provider runs are discarded).
 */
export function workshopRetainedHistoryKeyForCommitTurn(
  turn: Readonly<WorkshopTurn>
): WorkshopConversationLogicalKey | undefined {
  if (turn.role !== 'assistant' || turn.capability !== undefined) {
    return undefined;
  }
  if (
    turn.participant === 'host'
    && (turn.artifact === 'persona_message' || turn.artifact === 'persona_synthesis')
  ) {
    return 'host';
  }
  if (
    turn.participant === 'guest'
    && turn.artifact === 'persona_message'
    && turn.personaId !== undefined
  ) {
    return `guest:${turn.personaId}`;
  }
  if (
    turn.participant === 'tool'
    && turn.toolId !== undefined
    && (turn.artifact === 'tool_report' || turn.artifact === 'direct_tool_response')
  ) {
    return `tool:${turn.toolId}`;
  }
  return undefined;
}

const isCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/** Archived histories always hold complete user/assistant exchanges. */
export function isValidRetainedHistoryCounts(counts: WorkshopRetainedHistoryCounts): boolean {
  return isCount(counts.messageCount)
    && counts.messageCount % 2 === 0
    && isCount(counts.contextSourceCount);
}

export function cloneRetainedHistoryMark(
  mark: WorkshopRetainedHistoryMarkV1
): WorkshopRetainedHistoryMarkV1 {
  return { ...mark };
}

/**
 * The last mark per key whose turn sits at or before `cutIndex` in ledger
 * order. Marks naming unknown turns are ignored rather than trusted.
 */
export function lastRetainedHistoryMarksAtOrBefore(
  marks: readonly WorkshopRetainedHistoryMarkV1[],
  position: (turnId: string) => number | undefined,
  cutIndex: number
): Map<WorkshopConversationLogicalKey, WorkshopRetainedHistoryMarkV1> {
  const latest = new Map<
    WorkshopConversationLogicalKey,
    { mark: WorkshopRetainedHistoryMarkV1; index: number }
  >();
  for (const mark of marks) {
    const index = position(mark.turnId);
    if (index === undefined || index > cutIndex) {
      continue;
    }
    const current = latest.get(mark.conversationKey);
    if (!current || index > current.index) {
      latest.set(mark.conversationKey, { mark, index });
    }
  }
  return new Map(
    [...latest.entries()].map(([key, { mark }]) => [key, cloneRetainedHistoryMark(mark)])
  );
}

interface RetainedParticipantFacts {
  writerSourceCount: number;
  /** Absent for tool sidecars, which read nothing from the room. */
  reader?: { lastSeenRoomTurnId?: string };
}

/** Live, bound participants in a persisted state, keyed by their conversation. */
function retainedParticipants(
  state: WorkshopSessionStateV1
): Map<WorkshopConversationLogicalKey, RetainedParticipantFacts> {
  const participants = new Map<WorkshopConversationLogicalKey, RetainedParticipantFacts>();
  if (state.participants.host.conversationKey === 'host') {
    participants.set('host', {
      writerSourceCount: state.writerSources.host.length,
      reader: { lastSeenRoomTurnId: state.participants.host.lastSeenRoomTurnId }
    });
  }
  for (const sidecar of state.participants.toolSidecars) {
    participants.set(`tool:${sidecar.toolId}`, {
      writerSourceCount: state.writerSources.tools[sidecar.toolId]?.length ?? 0
    });
  }
  for (const guest of state.participants.personaGuests) {
    if (guest.liveness !== 'live' || guest.conversationKey === undefined) {
      continue;
    }
    participants.set(`guest:${guest.personaId}`, {
      writerSourceCount: state.writerSources.guests
        .find((entry) => entry.personaId === guest.personaId)?.sources.length ?? 0,
      reader: { lastSeenRoomTurnId: guest.lastSeenRoomTurnId }
    });
  }
  return participants;
}

/**
 * Keys whose marks cannot be trusted against this state. A key is judged as a
 * whole: one bad mark makes every mark of that key unusable, because a cut
 * picks "the last mark at or before C" and a hole in the sequence would slice
 * a history at the wrong commit.
 *
 * A key is consistent when every mark:
 * - names a well-formed key held by a live, bound participant;
 * - names an existing turn — for a commit mark, a reply turn that committed
 *   into this key's own conversation — and a reader offset that exists and
 *   does not follow the mark's own turn (tool marks carry no offset);
 * - carries safe non-negative counts with an even message count;
 * - follows the key's previous mark in strict ledger order without any count
 *   decreasing, with a baseline only ever as the key's first mark;
 * - never claims more writer-source rows than the participant holds, nor an
 *   offset beyond the participant's current offset (both only grow);
 * and every reply that committed into the key after its first mark carries a
 * mark. Membership changes prune a key, so its first surviving mark starts
 * the current membership: commits before it belong to discarded memberships
 * (or predate a baseline) and are not this sequence's to cover. Rewind policy
 * relies on that coverage: it treats any mark at or before a cut as proof that
 * the last commit before the cut is marked.
 */
export function findInconsistentRetainedHistoryMarkKeys(
  state: WorkshopSessionStateV1
): Set<string> {
  const marks = state.retainedHistoryMarks ?? [];
  if (marks.length === 0) {
    return new Set();
  }
  const positions = new Map(state.turns.map((turn, index) => [turn.id, index]));
  const commitKeys = state.turns.map((turn) => workshopRetainedHistoryKeyForCommitTurn(turn));
  const participants = retainedParticipants(state);
  const inconsistent = new Set<string>();
  const previousByKey = new Map<
    string,
    { mark: WorkshopRetainedHistoryMarkV1; index: number }
  >();
  const markedIndexesByKey = new Map<string, { first: number; all: Set<number> }>();

  for (const mark of marks) {
    const key = mark.conversationKey;
    if (inconsistent.has(key)) {
      continue;
    }
    const participant = parseWorkshopConversationLogicalKey(key)
      ? participants.get(key)
      : undefined;
    const index = positions.get(mark.turnId);
    const offsetIndex = mark.lastSeenRoomTurnId === undefined
      ? undefined
      : positions.get(mark.lastSeenRoomTurnId);
    const previous = previousByKey.get(key);
    const currentOffset = participant?.reader?.lastSeenRoomTurnId;
    const currentOffsetIndex = currentOffset === undefined
      ? undefined
      : positions.get(currentOffset);
    const consistent =
      participant !== undefined
      && index !== undefined
      // A commit mark is anchored to the reply that committed into its key;
      // a baseline may sit on any head turn.
      && (mark.origin === 'baseline' || commitKeys[index] === key)
      && isValidRetainedHistoryCounts(mark)
      && isCount(mark.writerSourceCount)
      && mark.writerSourceCount <= participant.writerSourceCount
      && (mark.origin === 'commit' || previous === undefined)
      && (participant.reader === undefined
        ? mark.lastSeenRoomTurnId === undefined
        : mark.lastSeenRoomTurnId === undefined
          || (
            offsetIndex !== undefined
            && offsetIndex <= index
            && currentOffsetIndex !== undefined
            && offsetIndex <= currentOffsetIndex
          ))
      && (previous === undefined || (
        index > previous.index
        && mark.messageCount >= previous.mark.messageCount
        && mark.contextSourceCount >= previous.mark.contextSourceCount
        && mark.writerSourceCount >= previous.mark.writerSourceCount
        && (
          previous.mark.lastSeenRoomTurnId === undefined
          || (
            offsetIndex !== undefined
            && offsetIndex >= (positions.get(previous.mark.lastSeenRoomTurnId) ?? Infinity)
          )
        )
      ));
    if (!consistent) {
      inconsistent.add(key);
      continue;
    }
    previousByKey.set(key, { mark, index });
    const marked = markedIndexesByKey.get(key) ?? { first: index, all: new Set<number>() };
    marked.all.add(index);
    markedIndexesByKey.set(key, marked);
  }

  // Coverage: no commit of the current membership may be missing its mark.
  for (const [key, marked] of markedIndexesByKey) {
    if (inconsistent.has(key)) {
      continue;
    }
    // Per-key order is strictly increasing, so the first mark seen is the floor.
    const uncovered = commitKeys.some(
      (commitKey, index) => commitKey === key && index > marked.first && !marked.all.has(index)
    );
    if (uncovered) {
      inconsistent.add(key);
    }
  }
  return inconsistent;
}

/**
 * Keys an archive cannot verify at the persisted boundary. Marks are only as
 * good as the history they slice: the key needs exactly one archive entry, no
 * mark may exceed it, and its latest mark must equal it. Equality matters as
 * much as the upper bound — a history that grew past its latest mark carries
 * an unmarked commit, and a cut between them would slice at the wrong point.
 */
export function findUnverifiableRetainedHistoryMarkKeys(
  marks: readonly WorkshopRetainedHistoryMarkV1[],
  archive: readonly unknown[]
): Set<string> {
  const unverifiable = new Set<string>();
  const marksByKey = new Map<string, WorkshopRetainedHistoryMarkV1[]>();
  for (const mark of marks) {
    marksByKey.set(mark.conversationKey, [
      ...(marksByKey.get(mark.conversationKey) ?? []),
      mark
    ]);
  }
  for (const [key, keyMarks] of marksByKey) {
    const entries = archive.filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null
        && typeof entry === 'object'
        && (entry as Record<string, unknown>).key === key
    );
    const entry = entries.length === 1 ? entries[0] : undefined;
    const messages = entry?.messages;
    const contextSources = entry?.contextSources;
    if (!Array.isArray(messages) || !Array.isArray(contextSources)) {
      unverifiable.add(key);
      continue;
    }
    const latest = keyMarks[keyMarks.length - 1];
    const verified =
      keyMarks.every((mark) =>
        mark.messageCount <= messages.length
        && mark.contextSourceCount <= contextSources.length
      )
      && latest.messageCount === messages.length
      && latest.contextSourceCount === contextSources.length;
    if (!verified) {
      unverifiable.add(key);
    }
  }
  return unverifiable;
}

/** Why a completion boundary's mark was or was not recorded; logged, never thrown. */
export type WorkshopRetainedHistoryMarkOutcome =
  | {
      recorded: true;
      mark: WorkshopRetainedHistoryMarkV1;
      /** Earlier marks of this key discarded because the new mark broke their order. */
      prunedMarks: number;
    }
  | {
      recorded: false;
      conversationKey?: WorkshopConversationLogicalKey;
      reason:
        | 'not-a-commit-turn'
        | 'participant-not-retained'
        | 'history-unreadable'
        | 'conversation-mismatch'
        | 'invalid-counts'
        | 'invalid-offset'
        | 'unknown-turn';
      prunedMarks: number;
    };

/** A live participant as hydration rebinds it, before installation. */
export interface WorkshopHydratedRetainedParticipant {
  conversationKey: WorkshopConversationLogicalKey;
  writerSourceCount: number;
  lastSeenRoomTurnId?: string;
}

export interface WorkshopHydratedRetainedHistoryMarks {
  marks: WorkshopRetainedHistoryMarkV1[];
  /** Keys whose marks disagreed with their freshly imported history. */
  unverifiedKeys: WorkshopConversationLogicalKey[];
}

/**
 * Marks that survive hydration. Only live, rebound participants keep marks —
 * degradation discards a conversation, so it discards its marks. A key whose
 * latest mark disagrees with the history just imported for it is treated as
 * unmarked. Every live participant left without a mark gains an
 * `origin: 'baseline'` mark at the ledger head from its imported counts, so a
 * legacy session becomes exactly rewindable from its reopen point onward.
 */
export function hydratedRetainedHistoryMarks(input: {
  marks: readonly WorkshopRetainedHistoryMarkV1[];
  participants: readonly WorkshopHydratedRetainedParticipant[];
  headTurnId?: string;
  importedHistory: WorkshopImportedRetainedHistory;
}): WorkshopHydratedRetainedHistoryMarks {
  const live = new Map(
    input.participants.map((participant) => [participant.conversationKey, participant])
  );
  const liveMarks = input.marks.filter((mark) => live.has(mark.conversationKey));
  const unverifiedKeys = [...live.keys()].filter((key) => {
    const imported = input.importedHistory[key];
    const latest = [...liveMarks].reverse().find((mark) => mark.conversationKey === key);
    return imported !== undefined
      && latest !== undefined
      && (
        latest.messageCount !== imported.messageCount
        || latest.contextSourceCount !== imported.contextSourceCount
      );
  });
  const marks = liveMarks
    .filter((mark) => !unverifiedKeys.includes(mark.conversationKey))
    .map(cloneRetainedHistoryMark);
  if (input.headTurnId !== undefined) {
    for (const participant of input.participants) {
      const imported = input.importedHistory[participant.conversationKey];
      if (
        imported === undefined
        || !isValidRetainedHistoryCounts(imported)
        || marks.some((mark) => mark.conversationKey === participant.conversationKey)
      ) {
        continue;
      }
      marks.push({
        turnId: input.headTurnId,
        conversationKey: participant.conversationKey,
        messageCount: imported.messageCount,
        contextSourceCount: imported.contextSourceCount,
        writerSourceCount: participant.writerSourceCount,
        ...(participant.lastSeenRoomTurnId !== undefined
          ? { lastSeenRoomTurnId: participant.lastSeenRoomTurnId }
          : {}),
        origin: 'baseline'
      });
    }
  }
  return { marks, unverifiedKeys };
}

/** A defensive copy of the state without the named keys' marks. */
export function withoutRetainedHistoryMarkKeys(
  state: WorkshopSessionStateV1,
  keys: ReadonlySet<string>
): WorkshopSessionStateV1 {
  if (keys.size === 0 || state.retainedHistoryMarks === undefined) {
    return state;
  }
  return {
    ...state,
    retainedHistoryMarks: state.retainedHistoryMarks
      .filter((mark) => !keys.has(mark.conversationKey))
      .map(cloneRetainedHistoryMark)
  };
}
