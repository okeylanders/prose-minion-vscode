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
  WorkshopScopeLockedError,
  WorkshopSessionService,
  workshopTextNoteLabel
} from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
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

    it('admits persona guests but still refuses tool sidecars without a passage', () => {
      service.setSessionScope('open');
      expect(() => service.beginToolRun('prose', 'req-tool')).toThrow(/without a pinned excerpt/);
      expect(service.beginPersonaGuestJoin('felix', 'req-guest', 'Read the room.'))
        .toMatchObject({ participant: 'writer', personaId: 'felix' });
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

    it('keeps the tasks and attachments across the transition', () => {
      pin();
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Kayla', words: 3, content: 'She lies here.'
      });
      const turnsBefore = service.getSnapshot().turns.length;

      service.setSessionScope('open');

      // No divider: nobody has been prompted, so nobody experienced a change.
      expect(service.getSnapshot().turns.length).toBe(turnsBefore);
      expect(service.getContextAttachments()).toHaveLength(1);
    });

    it('queues nothing for anyone — the room has no memory to correct', () => {
      pin();
      service.setSessionScope('open');
      expect(service.collectPendingHostUpdates()).toBeUndefined();
    });

    it('is idempotent — asking for open chat twice changes nothing the second time', () => {
      pin();
      service.setSessionScope('open');
      const second = service.setSessionScope('open');

      expect(second.changed).toBe(false);
      expect(service.getSnapshot().turns.filter((t) => t.artifact === 'scope_change')).toHaveLength(0);
    });
  });

  /**
   * ADR 2026-07-25: scope is chosen freely until the room has a memory and is
   * fixed thereafter. These are the refusals that make findings #1 and #3 of
   * the PR #86 review unreachable rather than merely derived correctly.
   */
  describe('the scope lock', () => {
    it('refuses to shelve a passage the host has already read', () => {
      pin();
      startHostConversation();

      expect(() => service.setSessionScope('open')).toThrow(/already has a conversation/);
      expect(service.getScope()).toBe('excerpt');
      expect(service.getExcerpt()).toBeDefined();
    });

    it('refuses to open a passage session once a TOOL has read the excerpt', () => {
      // A sidecar holds the passage just as the host would; letting the room
      // reverse here is the stale-sidecar defect wearing new paint.
      pin();
      service.beginToolRun('prose', 'prose-run');
      service.completeToolReport('prose-run', 'Prose report.', 'prose-conv');

      expect(() => service.setSessionScope('open')).toThrow(/already has a conversation/);
    });

    it('refuses to hand a passage to a conversation that has been running without one', () => {
      service.setSessionScope('open');
      startHostConversation();

      expect(() => service.replaceExcerpt({ text: 'Read this now.', source: { kind: 'manual' } }))
        .toThrow(/already has a conversation/);
      expect(service.getExcerpt()).toBeUndefined();
      expect(service.getScope()).toBe('open');
    });

    it('refuses a re-pin once the room has a memory', () => {
      pin();
      service.setSessionScope('open');
      startHostConversation();

      expect(() => service.repinShelvedExcerpt()).toThrow(/already has a conversation/);
      expect(service.getShelvedExcerpt()).toBeDefined();
    });

    it('returns a typed refusal so presentation owns the recovery copy', () => {
      pin();
      startHostConversation();

      try {
        service.setSessionScope('open');
        throw new Error('Expected the scope change to be refused');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkshopScopeLockedError);
        expect(error).toMatchObject({
          code: 'workshop-scope-locked',
          attempt: 'set this session to an open conversation'
        });
      }
    });

    it('still allows revising the pinned passage — that is not a path change', () => {
      pin();
      startHostConversation();

      const replacement = service.replaceExcerpt({
        text: 'The revised draft.',
        source: { kind: 'manual' }
      });

      expect(replacement.excerpt.version).toBe(2);
      expect(service.getScope()).toBe('excerpt');
    });

    /**
     * The hazard that decides the predicate. `resetSession` records a
     * `session_start` marker and `resumeSession` a `session_resume`, so EVERY
     * session holds a turn before the writer acts. A turn-based lock would
     * fire on session creation and strand the writer on the path chooser.
     */
    it('is not tripped by a fresh session marker before the writer acts', () => {
      service.recordSessionMarker('start', 'Session started at 10:00 AM.');

      expect(service.getSnapshot().turns.length).toBeGreaterThan(0);
      expect(service.hasRoomMemory()).toBe(false);
      expect(() => service.setSessionScope('open')).not.toThrow();
      expect(service.getScope()).toBe('open');
    });

    it('locks on a persona guest and stays locked after the guest is dismissed', () => {
      pin();
      const writerTurn = service.beginPersonaGuestJoin(
        'margot',
        'guest-join',
        'Read this with me.'
      );
      const guestTurn = service.completeRun(
        'guest-join',
        'The voice pulls away in the second paragraph.',
        undefined,
        false,
        'guest-conv'
      )!;

      expect(service.hasRoomMemory()).toBe(true);
      expect(service.dismissPersonaGuest('margot')).toBe('guest-conv');
      expect(service.hasRoomMemory()).toBe(true);
      expect(() => service.setSessionScope('open'))
        .toThrow(WorkshopScopeLockedError);
      // Dismissal retires the provider sidecar, not the historical exchange.
      // It remains honest host evidence because the passage path stayed fixed.
      expect(new WorkshopRoomDeliveryService(service)
        .prepare({ kind: 'host' }).turns.map((turn) => turn.id))
        .toEqual([writerTurn.id, guestTurn.id]);
    });

    it('is not tripped by a run that failed without leaving a conversation', () => {
      service.setSessionScope('open');
      service.beginPersonaMessage('doomed', 'Are you there?');
      service.abandonRun('doomed');

      expect(service.hasRoomMemory()).toBe(false);
      expect(() => service.setSessionScope('excerpt')).toThrow(/without an excerpt/);
      service.setExcerpt({ text: 'Now a passage.', source: { kind: 'manual' } });
      expect(service.getScope()).toBe('excerpt');
    });
  });

  describe('open → passage', () => {
    it('re-pins the shelved passage at its original version', () => {
      const pinned = pin();
      service.setSessionScope('open');
      const transition = service.repinShelvedExcerpt();

      // The room is workshopping the passage again, so it says so.
      expect(transition.scope).toBe('excerpt');
      expect(service.getExcerpt()).toEqual(pinned);
      expect(service.getShelvedExcerpt()).toBeUndefined();
      expect(service.getExcerptVersion()).toBe(pinned.version);
    });

    it('makes an adopted passage a passage session — no open-with-excerpt hybrid', () => {
      service.setSessionScope('open');
      service.replaceExcerpt({
        text: 'They moved toward the auditorium as a group.',
        source: { kind: 'manual' }
      });

      expect(service.getScope()).toBe('excerpt');
      // Nobody was prompted, so nothing is queued and no divider is minted.
      expect(service.collectPendingHostUpdates()).toBeUndefined();
      expect(service.getSnapshot().turns.filter((t) => t.artifact === 'scope_change')).toHaveLength(0);
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
     * `shelvedExcerpt`, so a pin over a shelved passage took the "first pin"
     * branch and skipped every staleness protection. The scope lock now keeps
     * this in the pre-memory window, but the shelf still counts as previously
     * carried and the replacement bookkeeping must still run.
     */
    it('treats a pin over a SHELVED passage as a replacement, not a first pin', () => {
      pin();
      service.setSessionScope('open');

      const replacement = service.replaceExcerpt({
        text: 'A different chapter entirely.',
        source: { kind: 'manual' }
      });

      expect(replacement.replacementCount).toBe(1);
      expect(replacement.excerpt.version).toBe(2);
      expect(service.getShelvedExcerpt()).toBeUndefined();
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
      expect(replacement.dividerTurn?.artifact).toBe('excerpt_revision');
      expect(replacement.dividerTurn?.content)
        .toBe('Excerpt v2 pinned · Pasted excerpt · retired: none · set-aside “one” v1 discarded');
      expect(service.getShelvedExcerpt()).toBeUndefined();
    });

    it('reports nothing discarded when the shelf was empty', () => {
      service.setSessionScope('open');
      const replacement = service.replaceExcerpt({ text: 'First one.', source: { kind: 'manual' } });

      expect(replacement.discardedShelvedExcerpt).toBeUndefined();
      // First pin of the room: nothing displaced, so no divider at all.
      expect(replacement.dividerTurn).toBeUndefined();
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
      service.replaceExcerpt({ text: 'The revised draft.', source: { kind: 'manual' } });

      const updates = service.collectPendingHostUpdates();
      expect(updates?.excerpt?.version).toBe(2);
      const frame = buildWorkshopHostUpdateFrame(updates);
      expect(frame).toContain('Earlier versions in this conversation are superseded');
      expect(frame).not.toContain('unchanged');
    });

    /**
     * The delivery record is still what decides, even though the lock leaves
     * only one reason: a host that was never handed the original must not be
     * sent a "revision" of it.
     */
    it('queues nothing for a host that was never handed the original', () => {
      service.setSessionScope('open');
      startHostConversation();
      // Reaching a passage session from here is refused, so pin BEFORE the
      // conversation and confirm the queue still keys off delivery.
      expect(() => service.replaceExcerpt({ text: 'Nope.', source: { kind: 'manual' } }))
        .toThrow(/already has a conversation/);
      expect(service.collectPendingHostUpdates()).toBeUndefined();
    });
  });

  describe('new-session boundary (§3)', () => {
    it('keeps the excerpt and attachments, drops the path and the shelf', () => {
      pin();
      service.addContextAttachment({
        kind: 'text', origin: 'writer', label: 'Kayla', words: 3, content: 'She lies here.'
      });
      service.setSessionScope('open');
      startHostConversation();

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
      service.replaceExcerpt({ text: 'A later draft.', source: { kind: 'manual' } });
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
    it('carries scope and the shelf through export/hydrate', () => {
      pin();
      service.setSessionScope('open');
      const exported = service.exportCommittedState();

      expect(exported.scope).toBe('open');
      expect(exported.shelvedExcerpt?.version).toBe(1);
      // Retired by ADR 2026-07-25 and never written again.
      expect(exported.revisions.pendingExcerptWithdrawal).toBeUndefined();
      expect(exported.revisions.pendingExcerptChange).toBeUndefined();

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(exported, {}, service.getConversationBehavior());

      expect(restored.getScope()).toBe('open');
      expect(restored.getShelvedExcerpt()?.version).toBe(1);
      expect(restored.collectPendingHostUpdates()).toBeUndefined();
    });

    /**
     * ADR 2026-07-25 §7. A checkpoint written before the lock can hold an
     * UNDELIVERED withdrawal: the writer shelved a passage but the frame
     * telling the host to stop treating it as read never shipped, and that
     * frame no longer exists. The host therefore still holds the passage, so
     * the room is normalized to agree with what the host believes rather than
     * with a reversal that never took effect.
     */
    it('normalizes a legacy checkpoint whose withdrawal never shipped', () => {
      pin();
      const exported = service.exportCommittedState();
      const legacy = {
        ...exported,
        scope: 'open' as const,
        excerpt: undefined,
        shelvedExcerpt: exported.excerpt,
        revisions: { ...exported.revisions, pendingExcerptWithdrawal: true as const }
      };

      const restored = new WorkshopSessionService(() => ++clock);
      const result = restored.hydrateCommittedState(
        legacy,
        { host: 'host-conv' },
        service.getConversationBehavior()
      );

      expect(restored.getScope()).toBe('excerpt');
      expect(restored.getExcerpt()?.version).toBe(1);
      expect(restored.getShelvedExcerpt()).toBeUndefined();
      expect(result.migrations).toEqual([
        'restored-undelivered-withdrawal',
        'discarded-legacy-scope-transition'
      ]);
    });

    it('normalizes a legacy open conversation that already carries an excerpt', () => {
      pin();
      startHostConversation();
      const legacy = {
        ...service.exportCommittedState(),
        // Sprint 13A could persist this hybrid through both add and re-pin.
        scope: 'open' as const
      };

      const restored = new WorkshopSessionService(() => ++clock);
      const result = restored.hydrateCommittedState(
        legacy,
        { host: 'host-conv-restored' },
        service.getConversationBehavior()
      );

      expect(result.migrations).toContain('normalized-open-session-with-excerpt');
      expect(restored.getScope()).toBe('excerpt');
      expect(restored.getExcerpt()?.version).toBe(1);
      expect(restored.hasRoomMemory()).toBe(true);
      expect(() => restored.replaceExcerpt({
        text: 'The passage remains revisable.',
        source: { kind: 'manual' }
      })).not.toThrow();
      expect(restored.getExcerpt()?.version).toBe(2);
    });

    it('leaves a legacy checkpoint alone when its withdrawal DID ship', () => {
      // No pending flag: the host was told, so open scope with a shelf is
      // already consistent and must survive untouched.
      pin();
      const exported = service.exportCommittedState();
      const legacy = {
        ...exported,
        scope: 'open' as const,
        excerpt: undefined,
        shelvedExcerpt: exported.excerpt
      };

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(legacy, { host: 'host-conv' }, service.getConversationBehavior());

      expect(restored.getScope()).toBe('open');
      expect(restored.getShelvedExcerpt()?.version).toBe(1);
    });

    it('treats a legacy delivery reason as a revision when host memory survives', () => {
      pin();
      startHostConversation();
      service.replaceExcerpt({ text: 'A later draft.', source: { kind: 'manual' } });
      const exported = service.exportCommittedState();
      const legacy = {
        ...exported,
        revisions: {
          ...exported.revisions,
          pendingExcerptChange: 'repinned' as const
        }
      };

      const restored = new WorkshopSessionService(() => ++clock);
      const result = restored.hydrateCommittedState(
        legacy,
        { host: 'host-conv-restored' },
        service.getConversationBehavior()
      );

      expect(buildWorkshopHostUpdateFrame(restored.collectPendingHostUpdates()))
        .toContain('revised the pinned excerpt');
      expect(restored.exportCommittedState().revisions.pendingExcerptChange).toBeUndefined();
      expect(result.migrations).toContain('discarded-legacy-scope-transition');
    });

    it('drops a legacy pending delivery when no host memory survives', () => {
      pin();
      const exported = service.exportCommittedState();
      const legacy = {
        ...exported,
        revisions: {
          ...exported.revisions,
          pendingExcerpt: 1,
          pendingExcerptChange: 'added' as const
        }
      };

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(legacy, {}, service.getConversationBehavior());

      expect(restored.collectPendingHostUpdates()).toBeUndefined();
      expect(restored.exportCommittedState().revisions.pendingExcerptChange).toBeUndefined();
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

    it('drops a queued revision when the host memory did not survive', () => {
      pin();
      startHostConversation();
      service.replaceExcerpt({ text: 'A later draft.', source: { kind: 'manual' } });

      const restored = new WorkshopSessionService(() => ++clock);
      restored.hydrateCommittedState(
        service.exportCommittedState(),
        {}, // no runtime binding: the host starts fresh and receives current state
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
