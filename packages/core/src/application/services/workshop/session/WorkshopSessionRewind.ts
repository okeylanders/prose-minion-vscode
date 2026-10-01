/**
 * The pure rewind transform (ADR 2026-09-30 §5).
 *
 * Cuts one persisted room, the aggregate and its conversation archive (the
 * pair a checkpoint writes), back to a real historical rest point. Each
 * retained history is sliced to its participant's last retained-history mark
 * at or before the cut; nothing here reads a provider message format. The
 * working set (excerpt, context, to-do statuses, widget configs) stays
 * current, and whatever the cut host has not yet been handed is queued again
 * through the ordinary delivery frames.
 *
 * Pure: no I/O and no clock. The inputs are never mutated. The output passes
 * strict validation, and every surviving mark equals its sliced history, so
 * it installs through the same import and hydration path Open uses.
 */

import type {
  ContextSourceEntry,
  WorkshopChatTarget,
  WorkshopConversationBehavior,
  WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ConversationArchiveEntryV1,
  withContextSourceSupersedeChain
} from '@orchestration/ConversationManager';
import type {
  WorkshopMessageAttachment
} from '@/application/services/workshop/WorkshopSessionRecords';
import {
  assertCurrentWorkshopSessionStateV1,
  WorkshopConversationLogicalKey,
  WorkshopRetainedHistoryMarkV1,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import {
  findUnverifiableRetainedHistoryMarkKeys,
  lastRetainedHistoryMarksAtOrBefore
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';
import {
  WorkshopCutRefusalReason,
  WorkshopRewindCut,
  WorkshopRewindPolicy,
  workshopRewindTurnFacts
} from '@/application/services/workshop/session/WorkshopRewindPolicy';

export type WorkshopRetainedArchiveEntry =
  ConversationArchiveEntryV1<WorkshopConversationLogicalKey>;

export interface WorkshopSessionRewindInput {
  workshop: WorkshopSessionStateV1;
  conversations: readonly WorkshopRetainedArchiveEntry[];
  cut: WorkshopRewindCut;
}

/**
 * What a cut removed, counted once here. The rewind action result and a Side
 * Quest's closing divider both read it rather than recounting.
 */
export interface WorkshopRewindCutSummary {
  /** The last turn the cut kept. */
  keptThroughTurnId: string;
  removedTurnCount: number;
  /**
   * Retained conversations the cut discarded: participants that did not exist
   * at the cut, or whose history there was already gone (ADR §4).
   */
  droppedConversationKeys: WorkshopConversationLogicalKey[];
  removedTodoCount: number;
  /**
   * One-shot widget configs whose commit the cut removed. Each keeps its
   * draft as a retry token (Sprint 03 kickoff decision 3).
   */
  releasedWidgetConfigIds: string[];
}

/** A writer-bubble cut is an edit: the removed message returns to the composer. */
export interface WorkshopRewindComposerRestore {
  text: string;
  /** Restaged as pending attachments under their original `ta-N` ids. */
  attachmentIds: string[];
  /**
   * Attachments that could not be restaged: a private message's bodies were
   * never retained outside the tool's provider history, or the per-message
   * staging limit was already full. The writer re-attaches these by hand.
   */
  unrestoredAttachmentLabels: string[];
}

/**
 * A writer-bubble cut on a widget commit's message edits that widget: its
 * released config reopens in the widget sheet, the widget twin of the
 * composer restore (Sprint 03 kickoff decision 3).
 */
export interface WorkshopRewindWidgetRestore {
  widgetConfigId: string;
}

export interface WorkshopSessionRewindResult {
  workshop: WorkshopSessionStateV1;
  conversations: WorkshopRetainedArchiveEntry[];
  summary: WorkshopRewindCutSummary;
  composerRestore?: WorkshopRewindComposerRestore;
  widgetRestore?: WorkshopRewindWidgetRestore;
  /**
   * Keys whose marks disagreed with their archive. Their marks are not
   * trusted, exactly as at the persisted-session boundary, so the cut treats
   * them as unmarked. Recorded for diagnostics; normally empty.
   */
  unverifiedConversationKeys: WorkshopConversationLogicalKey[];
}

/** The rewind policy refused the cut; nothing was changed. */
export class WorkshopRewindRefusedError extends Error {
  constructor(readonly reason: WorkshopCutRefusalReason) {
    super(`Workshop rewind refused: ${reason}`);
    this.name = 'WorkshopRewindRefusedError';
  }
}

type SurvivingMarks = ReadonlyMap<WorkshopConversationLogicalKey, WorkshopRetainedHistoryMarkV1>;

export function rewindWorkshopSession(
  input: WorkshopSessionRewindInput
): WorkshopSessionRewindResult {
  const source = clonePersistedJson(input.workshop, 'workshop');
  const archive = clonePersistedJson([...input.conversations], 'conversations');

  // A mark is only as good as the history it slices (ADR §3 Validation).
  const unverified = findUnverifiableRetainedHistoryMarkKeys(
    source.retainedHistoryMarks ?? [],
    archive
  );
  const marks = (source.retainedHistoryMarks ?? [])
    .filter((mark) => !unverified.has(mark.conversationKey));

  // The transform refuses what the policy refuses, whoever calls it. Run
  // state belongs to the caller, which re-checks busy before it gets here.
  const evaluation = new WorkshopRewindPolicy({
    turns: source.turns.map(workshopRewindTurnFacts),
    marks,
    busy: false
  }).evaluateCut(input.cut);
  if (!evaluation.ok) {
    throw new WorkshopRewindRefusedError(evaluation.reason);
  }

  const cutIndex = source.turns.findIndex((turn) => turn.id === evaluation.keptThroughTurnId);
  const turns = source.turns.slice(0, cutIndex + 1);
  const keptTurnIds = new Set(turns.map((turn) => turn.id));
  const positions = new Map(source.turns.map((turn, index) => [turn.id, index]));
  const archiveByKey = new Map(archive.map((entry) => [entry.key, entry]));

  // A participant survives with its last mark at or before the cut, and
  // only with a history there to import.
  const markedAtCut: SurvivingMarks = new Map(
    [...lastRetainedHistoryMarksAtOrBefore(marks, (turnId) => positions.get(turnId), cutIndex)]
      .filter(([key, mark]) => archiveByKey.has(key) && mark.messageCount > 0)
  );
  const { participants, writerSources } = cutParticipants(source, keptTurnIds, markedAtCut);
  const retainedAfter = new Set(retainedConversationKeys(participants));
  const survivors: SurvivingMarks = new Map(
    [...markedAtCut].filter(([key]) => retainedAfter.has(key))
  );
  const droppedConversationKeys = retainedConversationKeys(source.participants)
    .filter((key) => !retainedAfter.has(key));
  const hostMark = survivors.get('host');

  const writerTurn = input.cut.kind === 'beforeTurn' ? source.turns[cutIndex + 1] : undefined;
  const restore = composerRestoreFor(writerTurn, source);
  const todos = source.todos.filter((todo) => keptTurnIds.has(todo.source.turnId));
  const releasedWidgetConfigIds = (source.widgetConfigs ?? []).flatMap((config) =>
    config.committedTurnId !== undefined && !keptTurnIds.has(config.committedTurnId)
      ? [config.id]
      : []);
  const widgetRestore = widgetRestoreFor(writerTurn, releasedWidgetConfigIds);
  // An edit, in the composer or in its widget, goes back to the participant
  // the message was sent to, not whoever the room addressed after it.
  const editedTurn = restore || widgetRestore ? writerTurn : undefined;

  const workshop = clonePersistedJson<WorkshopSessionStateV1>({
    ...source,
    pendingMessageAttachments: [
      ...(restore?.restaged ?? []),
      ...source.pendingMessageAttachments
    ],
    threadArtifacts: source.threadArtifacts?.filter((artifact) => keptTurnIds.has(artifact.turnId)),
    revisions: {
      ...source.revisions,
      pendingExcerpt: hostMark
        ? pendingExcerptFor(source, writerSources.host)
        : undefined,
      // The host holds everything up to its cut mark's revision; anything
      // newer, before or after the cut, arrives as one current update.
      pendingContext: hostMark && (hostMark.contextRevision ?? 0) < source.revisions.context
        ? source.revisions.context
        : undefined
    },
    widgetConfigs: source.widgetConfigs?.map((config) =>
      releaseDroppedThreadCommit(config, keptTurnIds, source.turns)),
    writerSources,
    turns,
    participants: {
      ...participants,
      chatTarget: repairedChatTarget(
        editedTurn ? addresseeOf(editedTurn) : participants.chatTarget,
        participants
      )
    },
    todos,
    retainedHistoryMarks: source.retainedHistoryMarks === undefined
      ? undefined
      : marks.filter((mark) =>
        survivors.has(mark.conversationKey) && positions.get(mark.turnId)! <= cutIndex),
    lastCommittedPersonaBehavior: source.turns.slice(cutIndex + 1).some(isPersonaReply)
      ? lastCommittedPersonaBehavior(turns)
      : source.lastCommittedPersonaBehavior
  }, 'workshop');

  const conversations = archive.flatMap((entry) => {
    const mark = survivors.get(entry.key);
    return mark
      ? [{
          ...entry,
          messages: entry.messages.slice(0, mark.messageCount),
          contextSources: withContextSourceSupersedeChain(
            entry.contextSources.slice(0, mark.contextSourceCount)
          )
        }]
      : [];
  });

  // The output is a checkpoint like any other: strict shape and integrity,
  // and every surviving key's latest mark equal to its sliced history.
  assertCurrentWorkshopSessionStateV1(workshop);
  validateWorkshopSessionStateV1(workshop);
  const inexact = findUnverifiableRetainedHistoryMarkKeys(
    workshop.retainedHistoryMarks ?? [],
    conversations
  );
  if (inexact.size > 0) {
    throw new Error(
      `Rewind produced histories that do not match their marks (keys=${[...inexact].sort().join(',')})`
    );
  }

  return {
    workshop,
    conversations,
    summary: {
      keptThroughTurnId: evaluation.keptThroughTurnId,
      removedTurnCount: source.turns.length - turns.length,
      droppedConversationKeys,
      removedTodoCount: source.todos.length - todos.length,
      releasedWidgetConfigIds
    },
    composerRestore: restore?.composer,
    widgetRestore,
    unverifiedConversationKeys: [...unverified] as WorkshopConversationLogicalKey[]
  };
}

/** Every participant that holds a retained conversation. */
function retainedConversationKeys(
  participants: WorkshopSessionStateV1['participants']
): WorkshopConversationLogicalKey[] {
  return [
    ...(participants.host.conversationKey === 'host' ? ['host' as const] : []),
    ...participants.toolSidecars.map((sidecar) => sidecar.conversationKey),
    ...participants.personaGuests.flatMap((guest) =>
      guest.liveness === 'live' && guest.conversationKey ? [guest.conversationKey] : [])
  ];
}

/**
 * Participants and their writer-source manifests at the cut. A survivor
 * takes its reader offset and manifest length from its mark. A host without
 * one loses its binding (it had not spoken yet); a sidecar without one is
 * removed; a guest without one becomes a disposed tombstone (ADR §4–§5).
 */
function cutParticipants(
  source: WorkshopSessionStateV1,
  keptTurnIds: ReadonlySet<string>,
  survivors: SurvivingMarks
): Pick<WorkshopSessionStateV1, 'participants' | 'writerSources'> {
  const sliceRows = (
    rows: readonly ContextSourceEntry[] | undefined,
    mark: WorkshopRetainedHistoryMarkV1
  ): ContextSourceEntry[] => {
    if ((rows?.length ?? 0) < mark.writerSourceCount) {
      throw new Error(`Rewind mark for ${mark.conversationKey} claims more writer sources than it holds`);
    }
    return (rows ?? []).slice(0, mark.writerSourceCount);
  };
  const keptOffset = (turnId: string | undefined): string | undefined =>
    turnId !== undefined && keptTurnIds.has(turnId) ? turnId : undefined;

  const hostMark = source.participants.host.conversationKey === 'host'
    ? survivors.get('host')
    : undefined;
  const toolSidecars = source.participants.toolSidecars.filter((sidecar) =>
    survivors.has(sidecar.conversationKey) && keptTurnIds.has(sidecar.latestReportTurnId));
  const tools: WorkshopSessionStateV1['writerSources']['tools'] = {};
  for (const sidecar of toolSidecars) {
    const rows = source.writerSources.tools[sidecar.toolId];
    if (rows !== undefined) {
      tools[sidecar.toolId] = sliceRows(rows, survivors.get(sidecar.conversationKey)!);
    }
  }
  const personaGuests = source.participants.personaGuests.map((guest) => {
    const mark = guest.liveness === 'live' && guest.conversationKey
      ? survivors.get(guest.conversationKey)
      : undefined;
    return mark
      ? { ...guest, lastSeenRoomTurnId: mark.lastSeenRoomTurnId }
      : {
          personaId: guest.personaId,
          lastSeenRoomTurnId: keptOffset(guest.lastSeenRoomTurnId),
          liveness: 'disposed' as const
        };
  });

  return {
    participants: {
      host: hostMark
        ? {
            personaId: source.participants.host.personaId,
            conversationKey: 'host',
            lastSeenRoomTurnId: hostMark.lastSeenRoomTurnId
          }
        : { personaId: source.participants.host.personaId },
      toolSidecars,
      personaGuests,
      chatTarget: source.participants.chatTarget
    },
    writerSources: {
      host: hostMark ? withHostPinChain(sliceRows(source.writerSources.host, hostMark)) : [],
      tools,
      guests: source.writerSources.guests.flatMap((entry) => {
        const guest = personaGuests.find((candidate) => candidate.personaId === entry.personaId);
        return guest?.liveness === 'live' && guest.conversationKey
          ? [{
              personaId: entry.personaId,
              sources: sliceRows(entry.sources, survivors.get(guest.conversationKey)!)
            }]
          : [];
      })
    }
  };
}

/**
 * Only the last pin the cut host was handed is live. A pin superseded after
 * the cut becomes live again; every earlier pin stays dimmed history.
 */
function withHostPinChain(rows: readonly ContextSourceEntry[]): ContextSourceEntry[] {
  const lastPin = rows.map((row) => row.kind).lastIndexOf('pin');
  return rows.map((row, index) => {
    if (row.kind !== 'pin') {
      return row;
    }
    if (index === lastPin) {
      const { stale: _stale, ...live } = row;
      return live;
    }
    return { ...row, stale: true };
  });
}

/**
 * Re-queue the current passage when the cut host was handed an older one,
 * mirroring `WorkshopSessionService.queueExcerptDelivery`: the pin rows are
 * the delivery record (ADR §2 Excerpt).
 */
function pendingExcerptFor(
  source: WorkshopSessionStateV1,
  hostRows: readonly ContextSourceEntry[]
): number | undefined {
  const delivered = [...hostRows]
    .reverse()
    .find((row) => row.kind === 'pin' && row.excerptVersion !== undefined)?.excerptVersion;
  return delivered !== undefined && source.excerpt && source.excerpt.version !== delivered
    ? source.excerpt.version
    : undefined;
}

/**
 * A one-shot config whose commit turn was cut keeps its draft as a retry
 * token, following `WorkshopWidgetConfigLedger.rollbackThreadCommit`. A
 * standing config's marker can never be cut: the directive floor refuses it.
 */
function releaseDroppedThreadCommit(
  config: NonNullable<WorkshopSessionStateV1['widgetConfigs']>[number],
  keptTurnIds: ReadonlySet<string>,
  allTurns: readonly WorkshopTurn[]
): NonNullable<WorkshopSessionStateV1['widgetConfigs']>[number] {
  if (config.committedTurnId === undefined || keptTurnIds.has(config.committedTurnId)) {
    return config;
  }
  const commitTurn = allTurns.find((turn) => turn.id === config.committedTurnId);
  const commit = commitTurn?.widgetCommit;
  if (
    config.directiveId !== undefined
    || commit?.rail !== 'thread-artifact'
    || commit.widgetConfigId !== config.id
    || commit.artifactId !== config.artifactId
  ) {
    throw new Error(
      `Widget config ${config.id} is not a one-shot commit through ${config.committedTurnId}`
    );
  }
  const { committedTurnId: _turnId, artifactId: _artifactId, ...released } = config;
  return released;
}

/**
 * The composer edit for a writer-bubble cut (ADR §1): the message text, and
 * its one-shot attachments restaged under their original ids. A widget
 * commit's message is not re-seeded: widget copy belongs to the widget
 * sheet, where its released config reopens instead (`widgetRestoreFor`).
 */
function composerRestoreFor(
  writerTurn: WorkshopTurn | undefined,
  source: WorkshopSessionStateV1
): { composer: WorkshopRewindComposerRestore; restaged: WorkshopMessageAttachment[] } | undefined {
  if (
    !writerTurn
    || writerTurn.role !== 'user'
    || writerTurn.participant !== 'writer'
    || (writerTurn.artifact !== 'persona_message' && writerTurn.artifact !== 'direct_tool_message')
    || writerTurn.widgetCommit !== undefined
  ) {
    return undefined;
  }
  // Only room messages publish their bodies to the thread; a direct tool
  // message's bodies live only in the tool's provider history.
  const bodies = new Map(
    (source.threadArtifacts ?? [])
      .filter((artifact) => artifact.turnId === writerTurn.id)
      .map((artifact) => [artifact.id, artifact])
  );
  let capacity = PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage
    - source.pendingMessageAttachments.length;
  const restaged: WorkshopMessageAttachment[] = [];
  const unrestoredAttachmentLabels: string[] = [];
  for (const ref of writerTurn.messageAttachments ?? []) {
    const body = bodies.get(ref.id);
    const alreadyStaged = ref.configuredResource !== undefined
      && source.pendingMessageAttachments.some((pending) =>
        pending.configuredResource?.group === ref.configuredResource?.group
        && pending.configuredResource?.path === ref.configuredResource?.path);
    if (alreadyStaged) {
      continue;
    }
    if (!body || capacity <= 0) {
      unrestoredAttachmentLabels.push(ref.label);
      continue;
    }
    restaged.push({ ...ref, content: body.content });
    capacity -= 1;
  }
  return {
    composer: {
      text: writerTurn.content,
      attachmentIds: restaged.map((attachment) => attachment.id),
      unrestoredAttachmentLabels
    },
    restaged
  };
}

/**
 * The widget edit for a writer-bubble cut on a widget commit's own message:
 * its released config reopens where the writer built it. A cut that only
 * skips past a commit releases the config without reopening anything.
 */
function widgetRestoreFor(
  writerTurn: WorkshopTurn | undefined,
  releasedWidgetConfigIds: readonly string[]
): WorkshopRewindWidgetRestore | undefined {
  const commit = writerTurn?.role === 'user' && writerTurn.participant === 'writer'
    ? writerTurn.widgetCommit
    : undefined;
  return commit?.rail === 'thread-artifact' && releasedWidgetConfigIds.includes(commit.widgetConfigId)
    ? { widgetConfigId: commit.widgetConfigId }
    : undefined;
}

/** The participant a writer message was addressed to. */
function addresseeOf(writerTurn: WorkshopTurn): WorkshopChatTarget {
  if (writerTurn.artifact === 'direct_tool_message' && writerTurn.toolId) {
    return { kind: 'tool', toolId: writerTurn.toolId };
  }
  if (writerTurn.personaId) {
    return { kind: 'personaGuest', personaId: writerTurn.personaId };
  }
  return { kind: 'host' };
}

/** A chat target must name a participant the cut room still holds. */
function repairedChatTarget(
  target: WorkshopChatTarget,
  participants: WorkshopSessionStateV1['participants']
): WorkshopChatTarget {
  if (target.kind === 'tool') {
    return participants.toolSidecars.some((sidecar) => sidecar.toolId === target.toolId)
      ? target
      : { kind: 'host' };
  }
  if (target.kind === 'personaGuest') {
    return participants.personaGuests.some((guest) =>
      guest.personaId === target.personaId && guest.liveness === 'live')
      ? target
      : { kind: 'host' };
  }
  return target;
}

const isPersonaReply = (turn: WorkshopTurn): boolean =>
  turn.role === 'assistant' && (turn.participant === 'host' || turn.participant === 'guest');

/**
 * The behavior of the last persona reply the cut keeps: exactly what
 * `completeRun` recorded when that reply committed. Only consulted when the
 * cut drops a persona reply, so a room whose replies predate behavior
 * stamping keeps its recorded value.
 */
function lastCommittedPersonaBehavior(
  turns: readonly WorkshopTurn[]
): WorkshopSessionStateV1['lastCommittedPersonaBehavior'] {
  const behavior: WorkshopConversationBehavior | undefined = [...turns]
    .reverse()
    .find((turn) => isPersonaReply(turn) && turn.behavior !== undefined)
    ?.behavior;
  return behavior
    ? {
        interactionMode: behavior.interactionMode,
        expressionLevel: behavior.expressionLevel,
        relationalDepth: behavior.relationalDepth
      }
    : undefined;
}
