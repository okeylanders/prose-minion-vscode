/**
 * The pure rewind transform, as a table of scripted rooms by cut points
 * (ADR 2026-09-30 §5). Each case drives the real aggregate through the
 * scripted room, rewinds its final state, and checks the rule it names. The
 * whole-room equivalence proof lives in WorkshopSessionRewind.oracle.test.ts.
 */

import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopConversationLogicalKey
} from '@/application/services/workshop/WorkshopSessionStateV1';
import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import {
  rewindWorkshopSession,
  WorkshopRewindRefusedError,
  WorkshopSessionRewindResult
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, WorkshopTurn } from '@messages';
import {
  runCanonicalScriptedRoom,
  ScriptedRestPoint,
  ScriptedWorkshopRoom
} from './ScriptedWorkshopRoom';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const rewind = (room: ScriptedWorkshopRoom, cut: WorkshopRewindCut): WorkshopSessionRewindResult =>
  rewindWorkshopSession({
    workshop: room.session.exportCommittedState(),
    conversations: room.archive(),
    cut
  });

const history = (result: WorkshopSessionRewindResult, key: WorkshopConversationLogicalKey) =>
  result.conversations.find((entry) => entry.key === key);

const restPoint = (room: ScriptedWorkshopRoom, label: string): ScriptedRestPoint => {
  const point = room.restPoints.find((candidate) => candidate.label === label);
  if (!point) {
    throw new Error(`No scripted rest point "${label}"`);
  }
  return point;
};

/** The writer message that started the run a reply ended. */
const writerTurnOf = (room: ScriptedWorkshopRoom, reply: WorkshopTurn): WorkshopTurn => {
  const turns = room.session.readRoomLedger();
  const index = turns.findIndex((turn) => turn.id === reply.id);
  return [...turns.slice(0, index)].reverse().find((turn) =>
    turn.role === 'user' && turn.participant === 'writer')!;
};

const NEXT_STEPS = (step: string) => `Here is my read.\n\n### Next steps\n- ${step}`;

describe('rewindWorkshopSession (ADR 2026-09-30 §5)', () => {
  it('host-only: keeps the thread and host memory through the cut, and counts what it removed', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('First question?');
    room.hostMessage('Second question?');
    const atFirst = restPoint(room, 'host reply: First question?');

    const result = rewind(room, after(first.id));

    expect(result.workshop.turns.map((turn) => turn.id))
      .toEqual(atFirst.workshop.turns.map((turn) => turn.id));
    expect(history(result, 'host')?.messages).toEqual(
      atFirst.archive.find((entry) => entry.key === 'host')!.messages
    );
    expect(result.workshop.participants.host).toEqual(atFirst.workshop.participants.host);
    expect(result.summary).toEqual({
      keptThroughTurnId: first.id,
      removedTurnCount: 2,
      droppedConversationKeys: [],
      removedTodoCount: 0,
      releasedWidgetConfigIds: []
    });
    expect(result.composerRestore).toBeUndefined();
    expect(result.widgetRestore).toBeUndefined();
  });

  it('capability rounds: slices every committed round and keeps the run\'s published cards', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Scan the cast?', {
      capabilityRounds: 2,
      resources: ['Characters/margot.md', 'Chapters/ch-02.md']
    });
    room.hostMessage('Once more?', { capabilityRounds: 1, resources: ['Characters/margot.md'] });

    const result = rewind(room, after(first.id));
    const host = history(result, 'host')!;

    // One exchange plus two request/evidence pairs.
    expect(host.messages).toHaveLength(6);
    // Margot's row was superseded only after the cut, so it is live again.
    expect(host.contextSources.map((row) => [row.label, row.stale === true])).toEqual([
      ['Characters/margot.md', false],
      ['Chapters/ch-02.md', false]
    ]);
    // art-3 left with the cut history; its number is never minted again.
    expect(host.nextArtifactNumber).toBe(3);
    const cards = result.workshop.turns.filter((turn) => turn.capability !== undefined);
    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.capability?.publishedWithTurnId === first.id)).toBe(true);
  });

  it('tool report: a cut at the report keeps the sidecar; a cut at the synthesis keeps both', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('What is this scene doing?');
    const { report, synthesis } = room.toolRun('prose');
    room.hostMessage('And after that?');

    const atReport = rewind(room, after(report.id));
    expect(atReport.workshop.turns.at(-1)?.id).toBe(report.id);
    expect(history(atReport, 'tool:prose')?.messages).toHaveLength(2);
    expect(history(atReport, 'host')?.messages).toHaveLength(2);
    expect(atReport.workshop.participants.toolSidecars).toEqual([
      { toolId: 'prose', conversationKey: 'tool:prose', latestReportTurnId: report.id }
    ]);

    const atSynthesis = rewind(room, after(synthesis.id));
    expect(history(atSynthesis, 'host')?.messages).toHaveLength(4);
    expect(history(atSynthesis, 'tool:prose')?.messages).toHaveLength(2);
    expect(atSynthesis.summary.droppedConversationKeys).toEqual([]);
  });

  it('direct sidecar follow-ups: slices the sidecar history and manifest at the follow-up', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Opening?');
    room.toolRun('prose');
    const first = room.directToolMessage('prose', 'Which sentence drags?', {
      attachment: { label: 'draft-notes.md', content: 'The second sentence runs long.' }
    });
    room.directToolMessage('prose', 'And the ending?', {
      attachment: { label: 'ending.md', content: 'It stops short.' }
    });
    const atFirst = restPoint(room, 'prose follow-up: Which sentence drags?');

    const result = rewind(room, after(first.id));

    expect(history(result, 'tool:prose')?.messages).toHaveLength(4);
    expect(result.workshop.writerSources.tools.prose)
      .toEqual(atFirst.workshop.writerSources.tools.prose);
    expect(result.workshop.participants.chatTarget).toEqual({ kind: 'tool', toolId: 'prose' });
  });

  it('drops and reports a sidecar replaced after the cut, and repairs the chat target', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Opening?');
    room.toolRun('prose');
    const followUp = room.directToolMessage('prose', 'Which sentence drags?');
    room.toolRun('prose');
    // The writer is talking to the replacement sidecar when they rewind.
    expect(room.session.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(true);

    const result = rewind(room, after(followUp.id));

    expect(result.workshop.participants.toolSidecars).toEqual([]);
    expect(result.workshop.writerSources.tools).toEqual({});
    expect(history(result, 'tool:prose')).toBeUndefined();
    expect(result.summary.droppedConversationKeys).toEqual(['tool:prose']);
    expect(result.workshop.participants.chatTarget).toEqual({ kind: 'host' });
  });

  it('disposes a guest who joined after the cut', () => {
    const room = new ScriptedWorkshopRoom().start();
    const host = room.hostMessage('Opening?');
    room.inviteGuest('margot', 'Margot, read this with us.');
    room.guestMessage('margot', 'How does the voice sound?');

    const result = rewind(room, after(host.id));

    expect(result.workshop.participants.personaGuests).toEqual([
      { personaId: 'margot', liveness: 'disposed' }
    ]);
    expect(result.workshop.writerSources.guests).toEqual([]);
    expect(history(result, 'guest:margot')).toBeUndefined();
    expect(result.summary.droppedConversationKeys).toEqual(['guest:margot']);
    expect(result.workshop.participants.chatTarget).toEqual({ kind: 'host' });
  });

  it('keeps a guest dismissed after the cut disposed: a discarded history is not resurrected', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Opening?');
    room.inviteGuest('margot', 'Margot, read this with us.');
    const reply = room.guestMessage('margot', 'How does the voice sound?');
    room.dismissGuest('margot');

    const result = rewind(room, after(reply.id));

    expect(result.workshop.participants.personaGuests).toEqual([
      expect.objectContaining({ personaId: 'margot', liveness: 'disposed' })
    ]);
    expect(result.workshop.participants.personaGuests[0].conversationKey).toBeUndefined();
    // Only a participant retained now can be dropped by the cut.
    expect(result.summary.droppedConversationKeys).toEqual([]);
  });

  it('removes the host binding for a cut before its first reply, so the persona is selectable again', () => {
    const room = new ScriptedWorkshopRoom().start();
    const reply = room.hostMessage('Hello?');
    const start = restPoint(room, 'start');

    const result = rewind(room, after(start.headTurnId));

    expect(result.workshop.participants.host).toEqual({
      personaId: room.session.getSelectedPersonaId()
    });
    expect(result.workshop.writerSources.host).toEqual([]);
    expect(result.conversations).toEqual([]);
    expect(result.summary.droppedConversationKeys).toEqual(['host']);
    expect(result.workshop.lastCommittedPersonaBehavior).toBeUndefined();
    // A writer-bubble cut on the first message reaches the same room.
    const edit = rewind(room, before(writerTurnOf(room, reply).id));
    expect(edit.workshop).toEqual(result.workshop);
    expect(edit.composerRestore).toEqual({
      text: 'Hello?',
      attachmentIds: [],
      unrestoredAttachmentLabels: []
    });

    const reopened = new WorkshopSessionService(() => 9_000);
    reopened.hydrateCommittedState(result.workshop, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, {});
    expect(reopened.isPersonaSelectionLocked()).toBe(false);
  });

  it('re-queues the current passage when the cut host was handed an older one', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Opening?');
    room.reviseExcerpt('The first cup waits on the cold sill.');
    room.hostMessage('Does the revision land?');
    expect(room.session.exportCommittedState().revisions.pendingExcerpt).toBeUndefined();

    const result = rewind(room, after(first.id));

    expect(result.workshop.excerpt?.version).toBe(2);
    expect(result.workshop.revisions.pendingExcerpt).toBe(2);
    // The v1 pin was superseded only after the cut: it is the live pin again.
    expect(result.workshop.writerSources.host
      .filter((row) => row.kind === 'pin')
      .map((row) => [row.excerptVersion, row.stale === true])).toEqual([[1, false]]);
  });

  describe('pending context (Sprint 02 kickoff decision 4)', () => {
    const contextRoom = () => {
      const room = new ScriptedWorkshopRoom().start();
      const first = room.hostMessage('Opening?');
      room.addContext('Continuity note', 'The cup was blue in chapter two.');
      const delivered = room.hostMessage('Does the note change anything?');
      const last = room.hostMessage('Anything else?');
      return { room, first, delivered, last };
    };

    it('re-queues a context change made after the cut', () => {
      const { room, first } = contextRoom();
      const result = rewind(room, after(first.id));
      expect(result.workshop.revisions).toMatchObject({ context: 1, pendingContext: 1 });
      expect(result.workshop.hostContextDelivery).toBeUndefined();
    });

    it('re-queues a change whose divider the cut keeps but the host never received', () => {
      const { room } = contextRoom();
      const added = restPoint(room, 'context added: Continuity note');
      expect(added.workshop.revisions.pendingContext).toBe(1);

      const result = rewind(room, after(added.headTurnId));

      expect(result.workshop.turns.at(-1)?.artifact).toBe('context_change');
      expect(result.workshop.revisions.pendingContext).toBe(1);
    });

    it('re-queues nothing when the cut host already holds the current revision', () => {
      const { room, delivered } = contextRoom();
      const result = rewind(room, after(delivered.id));
      expect(result.workshop.revisions.pendingContext).toBeUndefined();
      expect(result.workshop.hostContextDelivery).toEqual(room.session.exportCommittedState().hostContextDelivery);
    });
  });

  it('removes to-dos sourced after the cut; earlier ones keep their current status', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('What should I fix?', { reply: NEXT_STEPS('Tighten the opening.') });
    const kept = room.session.addTodoFromFinding(first.id, first.actionableFindings![0].key);
    const second = room.hostMessage('What next?', { reply: NEXT_STEPS('Cut the adverb.') });
    room.session.addTodoFromFinding(second.id, second.actionableFindings![0].key);
    room.session.setTodoStatus(kept.id, 'completed');
    const counters = room.session.exportCommittedState().counters;

    const result = rewind(room, after(first.id));

    expect(result.workshop.todos).toEqual([
      expect.objectContaining({ id: kept.id, status: 'completed' })
    ]);
    expect(result.summary.removedTodoCount).toBe(1);
    expect(result.workshop.counters).toEqual(counters);
  });

  it('releases a one-shot widget committed after the cut as a retry token', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Opening?');
    const widgetReply = room.hostWidgetCommit();
    const writerTurn = writerTurnOf(room, widgetReply);
    const commit = writerTurn.widgetCommit!;
    const configBefore = room.session.getWidgetConfig(commit.widgetConfigId)!;
    expect(configBefore.committedTurnId).toBe(writerTurn.id);

    const result = rewind(room, after(first.id));

    const config = result.workshop.widgetConfigs!.find((entry) => entry.id === commit.widgetConfigId)!;
    expect(config.committedTurnId).toBeUndefined();
    expect(config.artifactId).toBeUndefined();
    expect(config.draft).toEqual(configBefore.draft);
    expect(result.workshop.threadArtifacts).toEqual([]);
    expect(result.workshop.writerSources.host.some((row) => row.kind === 'message-attachment'))
      .toBe(false);
    // Skipping past the commit releases it silently (kickoff decision 3).
    expect(result.summary.releasedWidgetConfigIds).toEqual([commit.widgetConfigId]);
    expect(result.widgetRestore).toBeUndefined();
    // A writer-bubble cut on the widget message releases it the same way and
    // is an edit of that widget: the composer gets nothing, because widget
    // copy belongs to the widget sheet, and the released config reopens there.
    const edit = rewind(room, before(writerTurn.id));
    expect(edit.workshop).toEqual(result.workshop);
    expect(edit.composerRestore).toBeUndefined();
    expect(edit.summary.releasedWidgetConfigIds).toEqual([commit.widgetConfigId]);
    expect(edit.widgetRestore).toEqual({ widgetConfigId: commit.widgetConfigId });
    // A cut that keeps the commit releases nothing.
    const kept = rewind(room, after(widgetReply.id));
    expect(kept.summary.releasedWidgetConfigIds).toEqual([]);
    expect(kept.widgetRestore).toBeUndefined();
  });

  describe('writer-bubble cuts (ADR §1)', () => {
    it('restages the message\'s one-shot attachments under their original ids', () => {
      const room = new ScriptedWorkshopRoom().start();
      const first = room.hostMessage('Opening?');
      const reply = room.hostMessage('Does the beat sheet help?', {
        attachment: { label: 'beat-sheet.md', content: 'Beat one: the cup.' }
      });
      const writerTurn = writerTurnOf(room, reply);
      const [ref] = writerTurn.messageAttachments!;

      const result = rewind(room, before(writerTurn.id));

      expect(result.summary.keptThroughTurnId).toBe(first.id);
      expect(result.composerRestore).toEqual({
        text: 'Does the beat sheet help?',
        attachmentIds: [ref.id],
        unrestoredAttachmentLabels: []
      });
      expect(result.workshop.pendingMessageAttachments).toEqual([
        { id: ref.id, label: 'beat-sheet.md', words: ref.words, content: 'Beat one: the cup.' }
      ]);
      expect(result.workshop.threadArtifacts).toEqual([]);
      expect(result.workshop.participants.chatTarget).toEqual({ kind: 'host' });
    });

    it('names attachments a private tool message never retained, and targets the tool again', () => {
      const room = new ScriptedWorkshopRoom().start();
      room.hostMessage('Opening?');
      room.toolRun('prose');
      const reply = room.directToolMessage('prose', 'Which sentence drags?', {
        attachment: { label: 'draft-notes.md', content: 'The second sentence runs long.' }
      });
      room.session.setChatTarget({ kind: 'host' });

      const result = rewind(room, before(writerTurnOf(room, reply).id));

      expect(result.composerRestore).toEqual({
        text: 'Which sentence drags?',
        attachmentIds: [],
        unrestoredAttachmentLabels: ['draft-notes.md']
      });
      expect(result.workshop.pendingMessageAttachments).toEqual([]);
      expect(result.workshop.participants.chatTarget).toEqual({ kind: 'tool', toolId: 'prose' });
    });

    it('targets the guest a rewound guest message was addressed to', () => {
      const room = new ScriptedWorkshopRoom().start();
      room.hostMessage('Opening?');
      room.inviteGuest('margot', 'Margot, read this with us.');
      const reply = room.guestMessage('margot', 'How does the voice sound?');
      room.hostMessage('Back to you, host.');

      const result = rewind(room, before(writerTurnOf(room, reply).id));

      expect(result.workshop.participants.chatTarget).toEqual({ kind: 'personaGuest', personaId: 'margot' });
      expect(result.composerRestore?.text).toBe('How does the voice sound?');
    });

    it.each<[string, (room: ScriptedWorkshopRoom) => void]>([
      ['a guest', (room) => room.guestMessage('margot', 'How does the voice sound?')],
      ['a tool', (room) => room.directToolMessage('prose', 'Which sentence drags?')]
    ])('targets the host a rewound widget message was sent to, though %s was addressed later', (_later, addressLater) => {
      const room = new ScriptedWorkshopRoom().start();
      room.hostMessage('Opening?');
      room.toolRun('prose');
      room.inviteGuest('margot', 'Margot, read this with us.');
      const reply = room.hostWidgetCommit();
      addressLater(room);
      expect(room.session.getChatTarget()).not.toEqual({ kind: 'host' });

      const result = rewind(room, before(writerTurnOf(room, reply).id));

      // Both later participants survive the cut; the edit still goes to the host.
      expect(result.widgetRestore).toEqual({ widgetConfigId: writerTurnOf(room, reply).widgetCommit!.widgetConfigId });
      expect(result.workshop.participants.personaGuests).toEqual([
        expect.objectContaining({ personaId: 'margot', liveness: 'live' })
      ]);
      expect(result.workshop.participants.toolSidecars).toEqual([
        expect.objectContaining({ toolId: 'prose' })
      ]);
      expect(result.workshop.participants.chatTarget).toEqual({ kind: 'host' });
    });
  });

  describe('refusals', () => {
    it.each<[string, (room: ScriptedWorkshopRoom) => WorkshopRewindCut, string]>([
      ['inside a run, after a capability card', (room) => {
        const card = room.session.readRoomLedger().find((turn) => turn.capability !== undefined)!;
        return after(card.id);
      }, 'not-a-rest-point'],
      ['an unknown turn', () => after('turn-999-assistant-1'), 'not-a-rest-point'],
      ['across the standing-directive change', (room) => after(restPoint(room, 'start').headTurnId), 'before-directive-change']
    ])('refuses a cut %s, and changes nothing', (_label, cutFor, reason) => {
      const room = runCanonicalScriptedRoom();
      const workshop = room.session.exportCommittedState();
      const conversations = room.archive();
      const frozen = JSON.stringify({ workshop, conversations });

      let refusal: unknown;
      try {
        rewindWorkshopSession({ workshop, conversations, cut: cutFor(room) });
      } catch (error) {
        refusal = error;
      }

      expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
      expect((refusal as WorkshopRewindRefusedError).reason).toBe(reason);
      expect(JSON.stringify({ workshop, conversations })).toBe(frozen);
    });

    it('treats marks that disagree with their archive as unmarked, refusing host-exact cuts', () => {
      const room = runCanonicalScriptedRoom();
      const conversations = room.archive();
      const host = conversations.find((entry) => entry.key === 'host')!;
      host.messages.push({ role: 'user', content: 'Unmarked.' }, { role: 'assistant', content: 'Commit.' });

      let refusal: unknown;
      try {
        rewindWorkshopSession({
          workshop: room.session.exportCommittedState(),
          conversations,
          cut: after(room.restPoints.at(-2)!.headTurnId)
        });
      } catch (error) {
        refusal = error;
      }
      expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
      expect((refusal as WorkshopRewindRefusedError).reason).toBe('before-rewind-support');
    });
  });

  describe('properties', () => {
    const room = runCanonicalScriptedRoom();
    const workshop = room.session.exportCommittedState();
    const conversations = room.archive();

    it('rewinding to the head is the identity', () => {
      const result = rewindWorkshopSession({
        workshop,
        conversations,
        cut: after(workshop.turns.at(-1)!.id)
      });

      expect(result.workshop).toEqual(clonePersistedJson(workshop));
      expect(result.conversations).toEqual(clonePersistedJson(conversations));
      expect(result.summary).toMatchObject({
        removedTurnCount: 0,
        droppedConversationKeys: [],
        removedTodoCount: 0,
        releasedWidgetConfigIds: []
      });
    });

    it('never lowers a counter, never mutates its inputs, and validates strictly at every accepted cut', () => {
      const frozen = JSON.stringify({ workshop, conversations });
      let accepted = 0;
      for (const turn of workshop.turns) {
        for (const cut of [after(turn.id), before(turn.id)]) {
          let result: WorkshopSessionRewindResult;
          try {
            result = rewindWorkshopSession({ workshop, conversations, cut });
          } catch (error) {
            expect(error).toBeInstanceOf(WorkshopRewindRefusedError);
            continue;
          }
          accepted += 1;
          // Model-visible ids (`ta-N`, `pd-N`, `art-N`) and webview ids can
          // never recur: every mint continues from the pre-rewind counter.
          expect(result.workshop.counters).toEqual(workshop.counters);
          for (const entry of result.conversations) {
            const original = conversations.find((candidate) => candidate.key === entry.key)!;
            expect(entry.nextArtifactNumber).toBe(original.nextArtifactNumber);
            expect(entry.lastActivity).toBe(original.lastActivity);
          }
          expect(result.workshop.retainedHistoryMarks?.every((mark) =>
            result.workshop.turns.some((kept) => kept.id === mark.turnId))).toBe(true);
          // The transform validated its own output; a hydration boundary agrees.
          expect(() => new WorkshopSessionService(() => 9_000).hydrateCommittedState(
            result.workshop,
            Object.fromEntries(result.conversations.map((entry) => [entry.key, `runtime-${entry.key}`])),
            DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
            Object.fromEntries(result.conversations.map((entry) => [entry.key, {
              messageCount: entry.messages.length,
              contextSourceCount: entry.contextSources.length
            }]))
          )).not.toThrow();
        }
      }
      expect(accepted).toBeGreaterThan(20);
      expect(JSON.stringify({ workshop, conversations })).toBe(frozen);
    });
  });
});
