import {
  WorkshopPassageScope,
  WorkshopPassageScopeState,
  WorkshopScopeLockedError,
  workshopParticipantSubjectStatus
} from '@/application/services/workshop/session/WorkshopPassageScope';

describe('WorkshopPassageScope', () => {
  let clock: number;
  let passage: WorkshopPassageScope;

  beforeEach(() => {
    clock = 1_000;
    passage = new WorkshopPassageScope(() => ++clock);
  });

  const pin = (text = 'She leaves the letter on the table.') => passage.setExcerpt({
    text,
    source: {
      kind: 'file',
      sourceUri: 'file:///chapter-one.md',
      relativePath: 'chapters/one.md',
      configuredResource: { group: 'chapters', path: 'chapters/one.md' }
    },
    truncation: { pinnedWords: 8, totalWords: 20 },
    sourceFingerprint: 'fingerprint-one'
  });

  it('checks idempotence before the room-memory lock', () => {
    pin();
    passage.setSessionScope('open', false);

    expect(passage.setSessionScope('open', true)).toMatchObject({
      changed: false,
      scope: 'open'
    });
    expect(() => passage.setSessionScope('excerpt', true))
      .toThrow(WorkshopScopeLockedError);
    expect(() => passage.setSessionScope('excerpt', true))
      .toThrow('this room already has a conversation');
  });

  it('shelves and re-pins one passage without revising it', () => {
    const pinned = pin();

    const shelved = passage.setSessionScope('open', false);
    expect(shelved).toEqual({
      changed: true,
      scope: 'open',
      excerpt: undefined,
      shelvedExcerpt: pinned
    });
    expect(passage.getExcerptVersion()).toBe(1);

    const repinned = passage.repinShelvedExcerpt(false);
    expect(repinned).toEqual({
      changed: true,
      scope: 'excerpt',
      excerpt: pinned,
      shelvedExcerpt: undefined
    });
    expect(passage.getExcerptVersion()).toBe(1);
  });

  it('refuses a locked re-pin and an excerpt scope with no passage', () => {
    expect(() => passage.setSessionScope('excerpt', false))
      .toThrow('Cannot start a passage session without an excerpt');

    pin();
    passage.setSessionScope('open', false);
    expect(() => passage.repinShelvedExcerpt(true)).toThrow(WorkshopScopeLockedError);
  });

  it('distinguishes a first pin from revisions and reports a discarded shelf', () => {
    const first = passage.replaceExcerpt({
      text: 'First passage.',
      source: { kind: 'manual' }
    }, false);
    expect(first).toMatchObject({
      replaced: false,
      replacementCount: 0,
      excerpt: { text: 'First passage.', version: 1 }
    });

    const second = passage.replaceExcerpt({
      text: 'Second passage.',
      source: { kind: 'manual' }
    }, false);
    expect(second).toMatchObject({
      replaced: true,
      replacementCount: 1,
      excerpt: { text: 'Second passage.', version: 2 }
    });
    expect(second.discardedShelvedExcerpt).toBeUndefined();

    passage.setSessionScope('open', false);
    const shelved = passage.getShelvedExcerpt()!;
    const third = passage.replaceExcerpt({
      text: 'Third passage.',
      source: { kind: 'manual' }
    }, false);
    expect(third).toMatchObject({
      replaced: true,
      replacementCount: 2,
      discardedShelvedExcerpt: shelved,
      excerpt: { text: 'Third passage.', version: 3 }
    });
  });

  it('refuses to add a passage to a locked open conversation', () => {
    passage.setSessionScope('open', false);

    expect(() => passage.replaceExcerpt({
      text: 'Late passage.',
      source: { kind: 'manual' }
    }, true)).toThrow('Cannot add an excerpt to this open conversation');
    expect(passage.getExcerpt()).toBeUndefined();
  });

  it('queues only deliverable excerpt revisions and commits exact generations', () => {
    pin();
    passage.queueExcerptDelivery(false, 1);
    passage.queueExcerptDelivery(true, undefined);
    expect(passage.collectPendingExcerptDelivery()).toBeUndefined();

    passage.queueExcerptDelivery(true, 1);
    const pending = passage.collectPendingExcerptDelivery()!;
    pending.text = 'Returned-copy mutation.';
    expect(passage.collectPendingExcerptDelivery()?.text)
      .toBe('She leaves the letter on the table.');

    expect(passage.commitPendingExcerptDelivery(99)).toBe(false);
    expect(passage.getPendingRevisionVersion()).toBe(1);
    expect(passage.commitPendingExcerptDelivery(1)).toBe(true);
    expect(passage.collectPendingExcerptDelivery()).toBeUndefined();

    passage.queueExcerptDelivery(true, 1);
    passage.clearPendingExcerptDelivery();
    expect(passage.getPendingRevisionVersion()).toBeUndefined();
  });

  it('chooses excerpt scope for a carried passage and refuses a missing one', () => {
    pin();
    passage.reset();
    expect(passage.getScope()).toBeNull();

    passage.chooseExcerptScopeIfUnchosen();
    expect(passage.getScope()).toBe('excerpt');

    passage.reset({ clearWorkingSet: true });
    expect(() => passage.chooseExcerptScopeIfUnchosen())
      .toThrow('without a pinned excerpt');
  });

  it('owns participant-subject readiness without participant state', () => {
    expect(workshopParticipantSubjectStatus(null))
      .toEqual({ ready: false, reason: 'scope-unchosen' });
    expect(workshopParticipantSubjectStatus('excerpt'))
      .toEqual({ ready: false, reason: 'excerpt-missing' });
    expect(workshopParticipantSubjectStatus('excerpt', { text: 'Passage.' }))
      .toEqual({ ready: true });
    expect(workshopParticipantSubjectStatus('open'))
      .toEqual({ ready: true });

    expect(() => passage.requireParticipantSubject()).toThrow('Choose how to start');
    passage.setSessionScope('open', false);
    expect(() => passage.requireParticipantSubject()).not.toThrow();
  });

  it('ordinary reset restores the shelf and retains the passage revision', () => {
    pin();
    passage.replaceExcerpt({ text: 'Revision two.', source: { kind: 'manual' } }, false);
    passage.queueExcerptDelivery(true, 1);
    passage.setSessionScope('open', false);

    passage.reset();

    expect(passage.getExcerpt()).toMatchObject({ text: 'Revision two.', version: 2 });
    expect(passage.getShelvedExcerpt()).toBeUndefined();
    expect(passage.getScope()).toBeNull();
    expect(passage.getExcerptVersion()).toBe(2);
    expect(passage.getReplacementCount()).toBe(0);
    expect(passage.getPendingRevisionVersion()).toBeUndefined();
  });

  it('full reset clears both passage slots and returns the revision to zero', () => {
    pin();
    passage.setSessionScope('open', false);

    passage.reset({ clearWorkingSet: true });

    expect(passage.exportState()).toEqual({
      excerpt: undefined,
      scope: null,
      shelvedExcerpt: undefined,
      excerptVersion: 0,
      replacementCount: 0,
      pendingRevisionVersion: undefined
    });
  });

  it('exports and prepares defensive state before assignment-only installation', () => {
    pin();
    passage.queueExcerptDelivery(true, 1);
    const exported = passage.exportState();
    exported.excerpt!.text = 'Export mutation.';
    exported.excerpt!.source = { kind: 'manual' };
    expect(passage.getExcerpt()).toMatchObject({
      text: 'She leaves the letter on the table.',
      source: { kind: 'file', relativePath: 'chapters/one.md' }
    });

    const hydrationInput: WorkshopPassageScopeState = passage.exportState();
    const restored = new WorkshopPassageScope(() => 9_000);
    const prepared = restored.prepareState(hydrationInput);
    hydrationInput.excerpt!.text = 'Hydration-input mutation.';
    const fileSource = hydrationInput.excerpt!.source;
    if (fileSource.kind !== 'manual') {
      fileSource.configuredResource!.path = 'mutated.md';
    }
    restored.installPreparedState(prepared);

    expect(restored.getExcerpt()).toMatchObject({
      text: 'She leaves the letter on the table.',
      source: {
        kind: 'file',
        configuredResource: { group: 'chapters', path: 'chapters/one.md' }
      },
      truncation: { pinnedWords: 8, totalWords: 20 }
    });
    expect(restored.getPendingRevisionVersion()).toBe(1);

    const returned = restored.getExcerpt()!;
    returned.truncation!.pinnedWords = 999;
    expect(restored.getExcerpt()?.truncation?.pinnedWords).toBe(8);
  });
});
