/**
 * The rewind equivalence oracle's expected room (ADR 2026-09-30; Sprint 02
 * plan, "Tests"). Rewinding the canonical scripted room from its final state
 * to any rest point must reproduce the room that point recorded,
 * `{ workshop, archive }`, except for a closed list of intended differences.
 * Each one is applied below by a named rule, derived from the recorded point
 * and the final room, never from the transform under test.
 *
 * Which participants survive is judged independently of marks: a retained
 * history survives when the history the point recorded is still a prefix of
 * the history now. A fresh membership (a replaced sidecar, a re-invited
 * guest) starts a new conversation, so its history does not extend the old.
 *
 * Shared by the Rewind oracle and Branch's key proof, which must agree: a
 * branch is the same cut room in a new envelope (ADR §7).
 */

import type {
  ContextSourceEntry,
  WorkshopChatTarget
} from '@messages';
import type {
  WorkshopConversationLogicalKey,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import {
  workshopHostHeldContextRevision
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';
import type {
  WorkshopRetainedArchiveEntry
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import type { ScriptedRestPoint } from './ScriptedWorkshopRoom';

export interface ExpectedRewoundRoom {
  workshop: WorkshopSessionStateV1;
  archive: WorkshopRetainedArchiveEntry[];
  droppedConversationKeys: WorkshopConversationLogicalKey[];
  releasedWidgetConfigIds: string[];
}

const retainedKeys = (state: WorkshopSessionStateV1): WorkshopConversationLogicalKey[] => [
  ...(state.participants.host.conversationKey === 'host' ? ['host' as const] : []),
  ...state.participants.toolSidecars.map((sidecar) => sidecar.conversationKey),
  ...state.participants.personaGuests.flatMap((guest) =>
    guest.liveness === 'live' && guest.conversationKey ? [guest.conversationKey] : [])
];

/** The last excerpt version a host was handed, read from its pin rows. */
const deliveredExcerptVersion = (hostRows: readonly ContextSourceEntry[]): number | undefined =>
  [...hostRows].reverse().find((row) => row.kind === 'pin' && row.excerptVersion !== undefined)
    ?.excerptVersion;

/**
 * The recorded room at `point`, with each intended difference applied from
 * the final room. The rules, in the order the Sprint 02 plan lists them:
 *
 * 1. The working set stays current: excerpt, shelf, context attachments,
 *    staged composer attachments, widget configs, standing directives and
 *    the selected tool (ADR §2).
 * 2. Counters equal the final state's: ids never recur (ADR §5).
 * 3. Pending excerpt and context are re-queued against the current working
 *    set for a surviving host (ADR §2; kickoff decision 4).
 * 4. To-dos keep their current status (none are raised in this room).
 * 5. One-shot widget commits past the cut are released as retry tokens.
 * 6. A participant whose membership at the point was discarded since is
 *    dropped: a sidecar leaves, a guest stays a disposed tombstone whose
 *    offset is kept only if its turn survives (ADR §4).
 * 7. The chat target is routing state: it stays current, repaired to the
 *    host if it names a participant the cut room lacks.
 * 8. Archived histories keep the current artifact counter (never lowered)
 *    and wall-clock `lastActivity` (kickoff decision 3).
 * 9. A host context acknowledgement is valid only for its recorded history
 *    revision; a later baseline is invalidated for full resynchronization.
 */
export function expectedRewoundRoom(
  point: ScriptedRestPoint,
  final: ScriptedRestPoint
): ExpectedRewoundRoom {
  const recorded = clonePersistedJson(point.workshop);
  const now = clonePersistedJson(final.workshop);
  const keptTurnIds = new Set(recorded.turns.map((turn) => turn.id));
  const nowArchive = new Map(final.archive.map((entry) => [entry.key, entry]));

  const survivors = new Set(point.archive.flatMap((entry) => {
    const current = nowArchive.get(entry.key);
    const extends_ = current !== undefined
      && JSON.stringify(current.messages.slice(0, entry.messages.length))
        === JSON.stringify(entry.messages);
    return extends_ ? [entry.key] : [];
  }));

  // Rule 6: membership.
  const hostSurvives = recorded.participants.host.conversationKey === 'host' && survivors.has('host');
  const toolSidecars = recorded.participants.toolSidecars
    .filter((sidecar) => survivors.has(sidecar.conversationKey));
  const personaGuests = now.participants.personaGuests.map((guest) => {
    const key = `guest:${guest.personaId}` as const;
    const recordedGuest = recorded.participants.personaGuests
      .find((candidate) => candidate.personaId === guest.personaId);
    return recordedGuest && recordedGuest.liveness === 'live' && survivors.has(key)
      ? recordedGuest
      : {
          personaId: guest.personaId,
          ...(guest.lastSeenRoomTurnId !== undefined && keptTurnIds.has(guest.lastSeenRoomTurnId)
            ? { lastSeenRoomTurnId: guest.lastSeenRoomTurnId }
            : {}),
          liveness: 'disposed' as const
        };
  });
  const liveGuests = new Set(personaGuests
    .filter((guest) => guest.liveness === 'live')
    .map((guest) => guest.personaId));

  // Rule 7: routing.
  const target = now.participants.chatTarget;
  const chatTarget: WorkshopChatTarget =
    (target.kind === 'tool' && !toolSidecars.some((sidecar) => sidecar.toolId === target.toolId))
    || (target.kind === 'personaGuest' && !liveGuests.has(target.personaId))
      ? { kind: 'host' }
      : target;

  const workshop: WorkshopSessionStateV1 = {
    ...recorded,
    // Rule 1.
    excerpt: now.excerpt,
    shelvedExcerpt: now.shelvedExcerpt,
    scope: now.scope,
    contextAttachments: now.contextAttachments,
    // An acknowledgement for a later host history cannot describe the cut history.
    hostContextDelivery: hostSurvives
      && now.hostContextDelivery?.revision === recorded.hostContextDelivery?.revision
      ? now.hostContextDelivery : undefined,
    pendingMessageAttachments: now.pendingMessageAttachments,
    standingDirectives: now.standingDirectives,
    selectedToolId: now.selectedToolId,
    // Rules 1 and 5.
    widgetConfigs: now.widgetConfigs?.map((config) => {
      if (config.committedTurnId === undefined || keptTurnIds.has(config.committedTurnId)) {
        return config;
      }
      const { committedTurnId: _turnId, artifactId: _artifactId, ...released } = config;
      return released;
    }),
    // Rule 2.
    counters: now.counters,
    // Rules 1 and 3.
    revisions: {
      ...now.revisions,
      pendingExcerpt: hostSurvives
        && now.excerpt !== undefined
        && deliveredExcerptVersion(recorded.writerSources.host) !== now.excerpt.version
        ? now.excerpt.version
        : undefined,
      pendingContext: hostSurvives
        && workshopHostHeldContextRevision(recorded.revisions) < now.revisions.context
        ? now.revisions.context
        : undefined
    },
    // Rule 4.
    todos: now.todos.filter((todo) => keptTurnIds.has(todo.source.turnId)),
    participants: {
      host: hostSurvives
        ? recorded.participants.host
        : { personaId: recorded.participants.host.personaId },
      toolSidecars,
      personaGuests,
      chatTarget
    },
    writerSources: {
      host: hostSurvives ? recorded.writerSources.host : [],
      tools: Object.fromEntries(Object.entries(recorded.writerSources.tools)
        .filter(([toolId]) => toolSidecars.some((sidecar) => sidecar.toolId === toolId))),
      guests: recorded.writerSources.guests
        .filter((entry) => liveGuests.has(entry.personaId))
    },
    retainedHistoryMarks: recorded.retainedHistoryMarks
      ?.filter((mark) => survivors.has(mark.conversationKey))
  };

  // Rule 8.
  const archive = point.archive
    .filter((entry) => survivors.has(entry.key) && retainedKeys(workshop).includes(entry.key))
    .map((entry) => ({
      ...entry,
      nextArtifactNumber: nowArchive.get(entry.key)!.nextArtifactNumber,
      lastActivity: nowArchive.get(entry.key)!.lastActivity
    }));

  return {
    workshop: clonePersistedJson(workshop),
    archive: clonePersistedJson(archive),
    droppedConversationKeys: retainedKeys(now).filter((key) => !retainedKeys(workshop).includes(key)),
    // Rule 5, counted: every config whose commit turn the cut removed.
    releasedWidgetConfigIds: (now.widgetConfigs ?? []).flatMap((config) =>
      config.committedTurnId !== undefined && !keptTurnIds.has(config.committedTurnId)
        ? [config.id]
        : [])
  };
}
