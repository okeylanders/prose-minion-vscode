/**
 * Sprint 13A — session scope in the aggregate.
 *
 * The contract under test is the one the sprint's exit criteria name:
 * scope is EXPLICIT state assigned by writer actions (never derived from
 * excerpt presence at read time), both reversals shelve rather than delete,
 * every transition stays inside one retained session, and a retained host is
 * told — in reason-appropriate language — what actually changed.
 */

import {
  WorkshopSessionService,
  workshopTextNoteLabel
} from '@/application/services/workshop/WorkshopSessionService';
import {
  buildWorkshopHostUpdateFrame
} from '@/application/services/workshop/WorkshopPromptBuilder';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

describe('WorkshopSessionService — session scope (Sprint 13A)', () => {
  let clock: number;
  let service: WorkshopSessionService;

  beforeEach(() => {
    clock = 1_000;
    service = new WorkshopSessionService(() => ++clock);
  });

  const pin = (text = 'She leaves the letter on the table.') => service.setExcerpt({
    text,
    source: { kind: 'file', sourceUri: 'file:///chapter-one.md', relativePath: 'chapters/one.md' }
  });

  /** Bring the host conversation into existence, the only way the aggregate can. */
  const startHostConversation = (): void => {
    service.beginPersonaMessage('req-host', 'Where does this scene sag?');
    service.completeRun('req-host', 'Right at the doorway.', undefined, undefined, 'host-conv');
  };

  describe('scope assignment', () => {
    it('starts unchosen — an excerpt-free room is not automatically open chat', () => {
      expect(service.getScope()).toBeNull();
      expect(service.getSnapshot().scope).toBeNull();
    });

    it('refuses a host turn until the writer chooses a path', () => {
      expect(() => service.beginPersonaMessage('req-1', 'Hello?'))
        .toThrow(/Choose how to start/);
    });

    it('treats pinning as choosing the passage path', () => {
      pin();
      expect(service.getScope()).toBe('excerpt');
    });

    it('treats running a tool as choosing the passage path', () => {
      // Reset carries the passage across the boundary with scope null (§3).
      pin();
      service.reset();
      expect(service.getScope()).toBeNull();

      service.beginToolRun('prose', 'req-tool');
      expect(service.getScope()).toBe('excerpt');
    });

    it('permits a host turn in open chat with no excerpt at all', () => {
      service.setSessionScope('open');
      const turn = service.beginPersonaMessage('req-open', 'Help me plan the next scene.');

      expect(turn.participant).toBe('writer');
      expect(service.getExcerpt()).toBeUndefined();
    });

    it('still refuses a tool run and a guest join without a passage', () => {
      service.setSessionScope('open');
      expect(() => service.beginToolRun('prose', 'req-tool')).toThrow(/without a pinned excerpt/);
      expect(() => service.beginPersonaGuestJoin('felix', 'req-guest', 'Read the room.'))
        .toThrow(/without a pinned excerpt/);
    });
  });

  describe('passage → open (set aside)', () => {
    it('shelves the passage instead of deleting it, and keeps its version', () => {
      const pinned = pin();
      const transition = service.setSessionScope('open');

      expect(transition.changed).toBe(true);
      expect(service.getExcerpt()).toBeUndefined();
      expect(service.getShelvedExcerpt()).toEqual(pinned);
      // Shelved, not revised: turn/task staleness must stay truthful about
      // which text each one was written against.
      expect(service.getExcerptVersion()).toBe(pinned.version);
    });

    it('mints one visible "conversation retained" divider', () => {
      pin();
      const { dividerTurn } = service.setSessionScope('open');

      expect(dividerTurn?.artifact).toBe('scope_change');
      expect(dividerTurn?.participant).toBe('session');
      expect(dividerTurn?.content).toBe(
        'Excerpt set aside · one v1 — same session, conversation retained'
      );
      expect(service.getSnapshot().turns.at(-1)?.id).toBe(dividerTurn?.id);
    });

    it('keeps the transcript, tasks, and attachments across the transition', () => {
      pin();
      startHostConversation();
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Kayla', words: 3, content: 'She lies here.'
      });
      const turnsBefore = service.getSnapshot().turns.length;

      service.setSessionScope('open');

      expect(service.getSnapshot().turns.length).toBe(turnsBefore + 1); // + the divider
      expect(service.hasHostConversation()).toBe(true);
      expect(service.getContextAttachments()).toHaveLength(1);
    });

    it('queues an explicit withdrawal for a retained host', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerptWithdrawn).toBe(true);
      expect(updates?.excerpt).toBeUndefined();

      const frame = buildWorkshopHostUpdateFrame(updates);
      expect(frame).toContain('set the excerpt aside');
      expect(frame).toContain('Do not quote it');
    });

    it('queues nothing when no host has been told about the passage yet', () => {
      pin();
      service.setSessionScope('open');
      expect(service.collectPendingHostUpdates()).toBeUndefined();
    });

    it('is idempotent — asking for open chat twice mints one divider', () => {
      pin();
      service.setSessionScope('open');
      const second = service.setSessionScope('open');

      expect(second.changed).toBe(false);
      expect(second.dividerTurn).toBeUndefined();
      expect(service.getSnapshot().turns.filter((t) => t.artifact === 'scope_change')).toHaveLength(1);
    });
  });

  describe('open → passage', () => {
    it('re-pins the shelved passage at its original version, staying open', () => {
      const pinned = pin();
      service.setSessionScope('open');
      const transition = service.repinShelvedExcerpt();

      expect(transition.scope).toBe('open');
      expect(service.getExcerpt()).toEqual(pinned);
      expect(service.getShelvedExcerpt()).toBeUndefined();
      expect(service.getExcerptVersion()).toBe(pinned.version);
      expect(transition.dividerTurn?.content).toContain('Excerpt re-pinned · one v1');
    });

    it('tells a retained host the passage is back, not that it was revised', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');
      service.commitPendingHostUpdates(service.collectPendingHostUpdates()!);
      service.repinShelvedExcerpt();

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerptChange).toBe('repinned');
      expect(buildWorkshopHostUpdateFrame(updates)).toContain('re-pinned the excerpt');
    });

    it('adopts a NEW excerpt mid-open-chat as an addition, keeping the scope open', () => {
      service.setSessionScope('open');
      startHostConversation();

      const replacement = service.replaceExcerpt({
        text: 'They moved toward the auditorium as a group.',
        source: { kind: 'manual' }
      });

      expect(service.getScope()).toBe('open');
      expect(replacement.dividerTurn?.artifact).toBe('scope_change');
      expect(replacement.dividerTurn?.content).toContain('Excerpt added · Pasted passage v1');

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerptChange).toBe('added');
      const frame = buildWorkshopHostUpdateFrame(updates);
      expect(frame).toContain('FIRST passage you have been given here');
      expect(frame).not.toContain('revised the pinned excerpt');
    });

    it('reports a genuine replacement as a revision, not an addition', () => {
      pin();
      startHostConversation();
      service.replaceExcerpt({ text: 'A later draft.', source: { kind: 'manual' } });

      expect(buildWorkshopHostUpdateFrame(service.collectPendingHostUpdates()))
        .toContain('revised the pinned excerpt');
    });

    it('refuses the passage path when nothing is pinned or shelved', () => {
      expect(() => service.setSessionScope('excerpt')).toThrow(/without an excerpt/);
    });

    it('restores the shelved passage when the writer continues the passage path', () => {
      const pinned = pin();
      service.setSessionScope('open');
      const transition = service.setSessionScope('excerpt');

      expect(transition.scope).toBe('excerpt');
      expect(service.getExcerpt()).toEqual(pinned);
    });

    /**
     * Regression (PR #86 review, blocking): `replaceExcerpt` branched on
     * `this.excerpt`, which shelving empties while the passage lives on in
     * `shelvedExcerpt` — so pinning over a shelved passage took the "first
     * pin" branch and skipped every staleness protection. The shelf counts as
     * previously carried: the sidecars read that passage and so did the host.
     */
    it('treats a pin over a SHELVED passage as a replacement, not a first pin', () => {
      pin();
      startHostConversation();
      // A tool that read the shelved passage, and a room pointed at it.
      service.beginToolRun('prose', 'prose-run');
      service.completeToolReport('prose-run', 'Prose report on v1.', 'prose-conv');
      service.setChatTarget({ kind: 'tool', toolId: 'prose' });
      service.setSessionScope('open');
      service.commitPendingHostUpdates(service.collectPendingHostUpdates()!);

      const replacement = service.replaceExcerpt({
        text: 'A different chapter entirely.',
        source: { kind: 'manual' }
      });

      // The sidecar's conversation only ever read the shelved passage.
      expect(replacement.disposedConversationIds).toEqual(['prose-conv']);
      expect(replacement.retiredSidecarCount).toBe(1);
      expect(replacement.replacementCount).toBe(1);
      // The room must not still be aimed at a tool that is about the old text.
      expect(service.getChatTarget()).toEqual({ kind: 'host' });
    });

    it('never tells a host holding a shelved passage that this is its FIRST one', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');
      service.commitPendingHostUpdates(service.collectPendingHostUpdates()!);

      service.replaceExcerpt({ text: 'A different chapter.', source: { kind: 'manual' } });

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerptChange).toBe('revised');
      const frame = buildWorkshopHostUpdateFrame(updates);
      expect(frame).toContain('revised the pinned excerpt');
      // The host's own transcript still holds v1 — asserting it has never seen
      // a passage would contradict its own history.
      expect(frame).not.toContain('FIRST passage you have been given here');
    });

    /**
     * Regression (PR #86 review, high): the shelf is one slot with no history,
     * so a pin that displaces it destroys writer-authored text. It may not do
     * so silently — the divider names what went, and the caller gets it back
     * to log and to confirm against.
     */
    it('names the set-aside passage it discarded, in the divider and to the caller', () => {
      const shelved = pin();
      service.setSessionScope('open');

      const replacement = service.replaceExcerpt({
        text: 'Something else entirely.',
        source: { kind: 'manual' }
      });

      expect(replacement.discardedShelvedExcerpt).toEqual(shelved);
      expect(replacement.dividerTurn?.artifact).toBe('scope_change');
      expect(replacement.dividerTurn?.content)
        .toBe('Excerpt added · Pasted passage v2 — set-aside “one” v1 discarded, conversation retained');
      expect(service.getShelvedExcerpt()).toBeUndefined();
    });

    it('reports nothing discarded when the shelf was empty', () => {
      service.setSessionScope('open');
      const replacement = service.replaceExcerpt({ text: 'First one.', source: { kind: 'manual' } });

      expect(replacement.discardedShelvedExcerpt).toBeUndefined();
      expect(replacement.dividerTurn?.content)
        .toBe('Excerpt added · Pasted passage v1 — same session, conversation retained');
    });

    /**
     * Regression (PR #86 review, high): shelving dropped a queued-but-never-
     * delivered revision, and the re-pin hardcoded `repinned` — telling a host
     * holding v1 that it had the passage back "unchanged" at v2.
     */
    it('calls a re-pin a revision when the host never received the newer version', () => {
      // The opening prompt hands the host v1; no delta frame is involved.
      pin();
      startHostConversation();
      // v2 is queued for the host and then shelved before any turn ships it.
      service.replaceExcerpt({ text: 'The revised draft.', source: { kind: 'manual' } });
      service.setSessionScope('open');
      service.repinShelvedExcerpt();

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerpt?.version).toBe(2);
      expect(updates?.excerptChange).toBe('revised');
      const frame = buildWorkshopHostUpdateFrame(updates);
      expect(frame).toContain('Earlier versions in this conversation are superseded');
      expect(frame).not.toContain('unchanged');
    });

    it('does not tell a host to withdraw a passage it was never handed', () => {
      // A host conversation exists, but the pin was queued and never shipped.
      service.setSessionScope('open');
      startHostConversation();
      service.replaceExcerpt({ text: 'Queued but never sent.', source: { kind: 'manual' } });
      service.setSessionScope('open');

      expect(service.collectPendingHostUpdates()?.excerptWithdrawn).toBeUndefined();
    });

    it('clears a queued withdrawal once the passage comes back', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');
      service.repinShelvedExcerpt();

      expect(service.collectPendingHostUpdates()?.excerptWithdrawn).toBeUndefined();
    });
  });

  describe('new-session boundary (§3)', () => {
    it('keeps the excerpt and attachments, drops the path and the shelf', () => {
      pin();
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Kayla', words: 3, content: 'She lies here.'
      });
      startHostConversation();
      service.setSessionScope('open');

      service.reset();

      const snapshot = service.getSnapshot();
      expect(snapshot.scope).toBeNull();
      expect(snapshot.excerpt?.text).toBe('She leaves the letter on the table.');
      expect(snapshot.shelvedExcerpt).toBeUndefined();
      expect(snapshot.contextAttachments).toHaveLength(1);
      expect(snapshot.turns).toEqual([]);
      expect(snapshot.todos).toEqual([]);
      expect(service.hasHostConversation()).toBe(false);
    });
  });

  describe('full reset — an empty room (Sprint 13A follow-up)', () => {
    const seedFullRoom = () => {
      pin();
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Kayla', words: 3, content: 'She lies here.'
      });
      startHostConversation();
    };

    it('clears the working set the ordinary boundary deliberately keeps', () => {
      seedFullRoom();
      service.reset({ clearWorkingSet: true });

      const snapshot = service.getSnapshot();
      expect(snapshot.excerpt).toBeUndefined();
      expect(snapshot.shelvedExcerpt).toBeUndefined();
      expect(snapshot.contextAttachments).toEqual([]);
      expect(snapshot.scope).toBeNull();
      expect(snapshot.turns).toEqual([]);
      expect(service.hasHostConversation()).toBe(false);
    });

    it('takes a SHELVED passage with it, not just the pinned one', () => {
      pin();
      service.setSessionScope('open');
      expect(service.getShelvedExcerpt()).toBeDefined();

      service.reset({ clearWorkingSet: true });
      expect(service.getExcerpt()).toBeUndefined();
      expect(service.getShelvedExcerpt()).toBeUndefined();
    });

    it('returns the excerpt revision to zero so the next checkpoint validates', () => {
      seedFullRoom();
      service.replaceExcerpt({ text: 'A second draft.', source: { kind: 'manual' } });
      expect(service.getExcerptVersion()).toBeGreaterThan(1);

      service.reset({ clearWorkingSet: true });

      // The revision counter belongs to a passage. With none in either slot it
      // must be zero, or export → validate throws "revision without an excerpt".
      expect(service.getExcerptVersion()).toBe(0);
      expect(() => service.exportCommittedState()).not.toThrow();
      const restored = new WorkshopSessionService(() => ++clock);
      expect(() => restored.hydrateCommittedState(
        service.exportCommittedState(),
        {},
        service.getConversationBehavior()
      )).not.toThrow();
    });

    it('leaves no queued host delivery behind', () => {
      seedFullRoom();
      service.setSessionScope('open');
      expect(service.collectPendingHostUpdates()).toBeDefined();

      service.reset({ clearWorkingSet: true });
      expect(service.collectPendingHostUpdates()).toBeUndefined();
    });

    it('lets attachment ids start over cleanly', () => {
      seedFullRoom();
      service.reset({ clearWorkingSet: true });

      const added = service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Fresh', words: 2, content: 'New note.'
      });
      expect(added.ok && added.attachment.id).toBe('ctx-1');
      expect(() => service.exportCommittedState()).not.toThrow();
    });

    it('still keeps the working set when the flag is absent', () => {
      seedFullRoom();
      service.reset();

      expect(service.getExcerpt()).toBeDefined();
      expect(service.getContextAttachments()).toHaveLength(1);
    });
  });

  describe('committed-state round trip', () => {
    it('carries scope, the shelf, and a queued withdrawal through export/hydrate', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');
      const exported = service.exportCommittedState();

      expect(exported.scope).toBe('open');
      expect(exported.shelvedExcerpt?.version).toBe(1);
      expect(exported.revisions.pendingExcerptWithdrawal).toBe(true);

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(
        exported,
        { host: 'host-conv' },
        service.getConversationBehavior()
      );

      expect(restored.getScope()).toBe('open');
      expect(restored.getShelvedExcerpt()?.version).toBe(1);
      expect(restored.collectPendingHostUpdates()?.excerptWithdrawn).toBe(true);
    });

    it('migrates a pre-scope checkpoint once, at the hydration boundary', () => {
      pin();
      const exported = service.exportCommittedState();
      const legacy = { ...exported };
      delete legacy.scope;

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(legacy, {}, service.getConversationBehavior());

      expect(restored.getScope()).toBe('excerpt');
    });

    it('migrates an excerpt-free pre-scope checkpoint to an unchosen path', () => {
      const exported = service.exportCommittedState();
      const legacy = { ...exported };
      delete legacy.scope;

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(legacy, {}, service.getConversationBehavior());

      expect(restored.getScope()).toBeNull();
    });

    it('drops a queued withdrawal when the host memory did not survive', () => {
      pin();
      startHostConversation();
      service.setSessionScope('open');

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(
        service.exportCommittedState(),
        {}, // no runtime binding: the host starts fresh and receives current scope
        service.getConversationBehavior()
      );

      expect(restored.collectPendingHostUpdates()).toBeUndefined();
    });
  });

  describe('editing an authored attachment (§6)', () => {
    const addNote = () => service.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: workshopTextNoteLabel('# Kayla — running notes\n\nShe does not believe it.'),
      words: 8,
      content: '# Kayla — running notes\n\nShe does not believe it.'
    });

    it('derives the label from the note’s first line', () => {
      expect(workshopTextNoteLabel('# Kayla — running notes\n\nmore')).toBe('Kayla — running notes');
      expect(workshopTextNoteLabel('\n\n  plain opening line')).toBe('plain opening line');
      expect(workshopTextNoteLabel('   ')).toBe('Text note');
    });

    it('re-derives the label and word count from the edit', () => {
      const added = addNote();
      expect(added.ok).toBe(true);

      const result = service.updateContextAttachmentText(
        'ctx-1',
        '## Kayla — revised\n\nShorter now.',
        4
      );

      expect(result.ok).toBe(true);
      expect(service.getContextAttachment('ctx-1')).toMatchObject({
        label: 'Kayla — revised',
        words: 4
      });
    });

    it('excludes the edited attachment from its own budget headroom', () => {
      const budget = PROMPT_BUDGETS.contextAttachments.words;
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Big', words: budget, content: 'x'
      });

      // Same size: a rewrite that does not grow must not be refused.
      expect(service.updateContextAttachmentText('ctx-1', 'y', budget).ok).toBe(true);
      const overflow = service.updateContextAttachmentText('ctx-1', 'z', budget + 1);
      expect(overflow).toMatchObject({ ok: false, reason: 'over-budget', remainingWords: budget });
    });

    it('refuses to edit a plain project file’s session copy', () => {
      service.addContextAttachment({
        kind: 'file',
        origin: 'writer',
        label: 'character-ava.md',
        words: 12,
        content: 'Ava keeps watch.',
        relativePath: 'Characters/character-ava.md'
      });

      expect(service.updateContextAttachmentText('ctx-1', 'Rewritten.', 1))
        .toMatchObject({ ok: false, reason: 'not-editable' });
    });

    it('allows editing a wizard suggestion, which is session-only by contract', () => {
      service.addContextAttachment({
        kind: 'file',
        origin: 'wizard',
        label: 'kayla-voice-guide.md',
        words: 12,
        content: 'Clipped sentences under pressure.',
        relativePath: 'Characters/kayla-voice-guide.md'
      });

      const result = service.updateContextAttachmentText('ctx-1', 'Trimmed for this room.', 4);
      expect(result.ok).toBe(true);
      // A file-origin label stays the file's name; only text notes retitle.
      expect(service.getContextAttachment('ctx-1')?.label).toBe('kayla-voice-guide.md');
    });

    it('reports an unknown attachment rather than silently doing nothing', () => {
      expect(service.updateContextAttachmentText('ctx-99', 'Anything.', 1))
        .toMatchObject({ ok: false, reason: 'unknown' });
    });
  });
});
