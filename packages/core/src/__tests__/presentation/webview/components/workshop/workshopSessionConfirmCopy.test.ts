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
