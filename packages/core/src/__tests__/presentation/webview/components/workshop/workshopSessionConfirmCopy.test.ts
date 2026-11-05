import {
  workshopSessionConfirmCopy
} from '@components/workshop/workshopSessionConfirmCopy';

describe('workshopSessionConfirmCopy', () => {
  it('keeps the existing session confirmations', () => {
    expect(workshopSessionConfirmCopy(null, {}).title).toBe('Start a new session?');
    expect(workshopSessionConfirmCopy({ kind: 'new' }, {}).confirmLabel).toBe('New session');
    expect(workshopSessionConfirmCopy({ kind: 'new-full' }, {}).confirmLabel).toBe('Clear everything');
    expect(workshopSessionConfirmCopy(
      { kind: 'open', sessionId: 's-1', title: 'Chapter Two' },
      {}
    ).title).toBe('Open “Chapter Two”?');
    expect(workshopSessionConfirmCopy(
      { kind: 'replace-shelf', resume: 'paste' },
      { shelvedExcerptTitle: 'Cold sill' }
    ).body).toContain('“Cold sill” was typed or pasted');
  });

  it('says the full reset starts with the pinned files once any are pinned (Pinned Context Slice 3)', () => {
    const none = workshopSessionConfirmCopy({ kind: 'new-full' }, { pinnedFileCount: 0 });
    expect(none.body).toMatch(/^This starts an empty room:/);
    expect(workshopSessionConfirmCopy({ kind: 'new-full' }, {})).toEqual(none);

    const one = workshopSessionConfirmCopy({ kind: 'new-full' }, { pinnedFileCount: 1 });
    expect(one.body).toBe('This starts a new room with your pinned context: the excerpt, anything on the shelf, ' +
      'every context attachment, the thread, tasks, guests, and conversation memory are all cleared, ' +
      'then the pinned file is attached. Saved sessions on disk are not touched.');
    expect(workshopSessionConfirmCopy({ kind: 'new-full' }, { pinnedFileCount: 10 }).body)
      .toContain('cleared, then the 10 pinned files are attached.');
    expect(one.title).toBe('Clear the excerpt and context?');
    expect(one.confirmLabel).toBe('Clear everything');
  });

  it('keeps the empty-context confirmation as it is at every count (Slice 2a)', () => {
    const at = (pinnedFileCount: number) => workshopSessionConfirmCopy({ kind: 'new-empty' }, { pinnedFileCount });
    expect(at(10)).toEqual(at(1));
    expect(at(1)).toEqual(workshopSessionConfirmCopy({ kind: 'new-empty' }, {}));
  });

  it('says the empty-context start leaves pinned context out (ADR 2026-11-04 D2)', () => {
    const copy = workshopSessionConfirmCopy({ kind: 'new-empty' }, {});
    expect(copy.title).toBe('Clear the excerpt and context?');
    expect(copy.body).toContain('pinned context left out');
    expect(copy.confirmLabel).toBe('Clear everything');
  });

  it('says what a rewind removes and what stays (ADR 2026-09-30, D4)', () => {
    expect(workshopSessionConfirmCopy(
      { kind: 'rewind', turnId: 't', removedCount: 1 },
      {}
    )).toEqual({
      title: 'Rewind to here?',
      body: '1 turn will be removed. Your excerpt and context stay as they are now. ' +
        'To keep this conversation too, use Branch instead.',
      confirmLabel: 'Rewind'
    });
    expect(workshopSessionConfirmCopy(
      { kind: 'rewind', turnId: 't', removedCount: 1, edit: 'composer' },
      {}
    ).body).toMatch(/^This message will be removed\. Its text returns to the composer/);
    expect(workshopSessionConfirmCopy(
      { kind: 'rewind', turnId: 't', removedCount: 2, edit: 'composer' },
      {}
    ).body).toMatch(/^This message and 1 turn after it will be removed\./);
  });

  it('asks an unsaved room to save before branching (ADR 2026-09-30, D2)', () => {
    expect(workshopSessionConfirmCopy({ kind: 'save-before-branch' }, {})).toEqual({
      title: 'Save before branching',
      body: 'Branching creates a new session from this point. ' +
        "Save this session first so it isn't replaced.",
      confirmLabel: 'Save session…'
    });
  });

  it('says a widget message reopens its widget (Sprint 03 kickoff decision 3)', () => {
    expect(workshopSessionConfirmCopy(
      { kind: 'rewind', turnId: 't', removedCount: 3, edit: 'widget' },
      {}
    )).toEqual({
      title: 'Edit this message?',
      body: 'This message and 2 turns after it will be removed. ' +
        'Its widget reopens so you can adjust it and send it again. ' +
        'Your excerpt and context stay as they are now. ' +
        'To keep this conversation too, use Branch instead.',
      confirmLabel: 'Rewind and edit'
    });
  });
});
