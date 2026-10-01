/**
 * The equivalence oracle (ADR 2026-09-30; Sprint 02 plan, "Tests").
 *
 * Rewinding the canonical scripted room from its final state to any rest
 * point must reproduce the room that point recorded, `{ workshop, archive }`,
 * except for a closed list of intended differences. Each one is applied
 * below by a named rule, derived from the recorded point and the final room,
 * never from the transform under test. Anything else that differs is a
 * rewind bug.
 *
 * Which participants survive is judged independently of marks: a retained
 * history survives when the history the point recorded is still a prefix of
 * the history now. A fresh membership (a replaced sidecar, a re-invited
 * guest) starts a new conversation, so its history does not extend the old.
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
import {
  rewindWorkshopSession,
  WorkshopRetainedArchiveEntry,
  WorkshopRewindRefusedError,
  WorkshopSessionRewindResult
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  runCanonicalScriptedRoom,
  ScriptedRestPoint,
  ScriptedWorkshopRoom
} from './ScriptedWorkshopRoom';

interface ExpectedRoom {
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
 */
function expectedRewind(point: ScriptedRestPoint, final: ScriptedRestPoint): ExpectedRoom {
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

describe('the rewind equivalence oracle over the canonical scripted room', () => {
  let room: ScriptedWorkshopRoom;
  let final: ScriptedRestPoint;

  beforeAll(() => {
    room = runCanonicalScriptedRoom();
    final = room.restPoints.at(-1)!;
  });

  const rewindTo = (point: ScriptedRestPoint): WorkshopSessionRewindResult =>
    rewindWorkshopSession({
      workshop: final.workshop,
      conversations: final.archive,
      cut: { kind: 'afterTurn', turnId: point.headTurnId }
    });

  it('covers every commit type, discard and rest shape of the canonical room', () => {
    // A guard against the script shrinking under the oracle.
    expect(room.restPoints.length).toBeGreaterThanOrEqual(18);
  });

  it('reproduces every rest point after the directive floor, modulo the intended differences', () => {
    const floor = final.workshop.turns.findIndex((turn) => turn.artifact === 'standing_directive_change');
    const compared: string[] = [];
    for (const point of room.restPoints) {
      const index = final.workshop.turns.findIndex((turn) => turn.id === point.headTurnId);
      if (index < floor) {
        continue;
      }
      // The recorded ledger is a prefix of the final ledger.
      expect(final.workshop.turns.slice(0, index + 1).map((turn) => turn.id))
        .toEqual(point.workshop.turns.map((turn) => turn.id));

      const result = rewindTo(point);
      const expected = expectedRewind(point, final);

      expect({ point: point.label, workshop: result.workshop })
        .toEqual({ point: point.label, workshop: expected.workshop });
      expect({ point: point.label, archive: result.conversations })
        .toEqual({ point: point.label, archive: expected.archive });
      expect({ point: point.label, summary: result.summary }).toEqual({
        point: point.label,
        summary: {
          keptThroughTurnId: point.headTurnId,
          removedTurnCount: final.workshop.turns.length - point.workshop.turns.length,
          droppedConversationKeys: expected.droppedConversationKeys,
          removedTodoCount: 0,
          releasedWidgetConfigIds: expected.releasedWidgetConfigIds
        }
      });
      compared.push(point.label);
    }
    // Every rest point but the start, which precedes the directive change.
    expect(compared).toHaveLength(room.restPoints.length - 1);
  });

  it('refuses the rest point before the standing-directive change (the v1 floor)', () => {
    const start = room.restPoints.find((point) => point.label === 'start')!;
    let refusal: unknown;
    try {
      rewindTo(start);
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
    expect((refusal as WorkshopRewindRefusedError).reason).toBe('before-directive-change');
  });

  it('exercises each intended difference at least once, so none of the rules is vacuous', () => {
    const differences = new Set<string>();
    for (const point of room.restPoints.slice(1)) {
      const expected = expectedRewind(point, final);
      const recorded = clonePersistedJson(point.workshop);
      if (JSON.stringify(expected.workshop.excerpt) !== JSON.stringify(recorded.excerpt)) {
        differences.add('excerpt stays current');
      }
      if (JSON.stringify(expected.workshop.contextAttachments) !== JSON.stringify(recorded.contextAttachments)) {
        differences.add('context stays current');
      }
      if (JSON.stringify(expected.workshop.counters) !== JSON.stringify(recorded.counters)) {
        differences.add('counters never lowered');
      }
      if (expected.workshop.revisions.pendingExcerpt !== recorded.revisions.pendingExcerpt) {
        differences.add('pending excerpt re-queued');
      }
      if (expected.workshop.revisions.pendingContext !== recorded.revisions.pendingContext) {
        differences.add('pending context re-queued');
      }
      if (JSON.stringify(expected.workshop.widgetConfigs) !== JSON.stringify(recorded.widgetConfigs)) {
        differences.add('widget configs stay current or release');
      }
      if (expected.droppedConversationKeys.length > 0) {
        differences.add('discarded memberships dropped');
      }
      if (JSON.stringify(expected.workshop.participants.chatTarget)
        !== JSON.stringify(recorded.participants.chatTarget)) {
        differences.add('chat target stays current');
      }
    }
    expect([...differences].sort()).toEqual([
      'chat target stays current',
      'context stays current',
      'counters never lowered',
      'discarded memberships dropped',
      'excerpt stays current',
      'pending context re-queued',
      'pending excerpt re-queued',
      'widget configs stay current or release'
    ]);
  });
});
