/**
 * The words a host shows for a Draft Edit outcome (ADR 2026-10-21 D8): counts,
 * the honest cost, and the interruption, never the writer's text.
 */
import { describeDraftEditOutcome, describeQuickFixOutcome } from '@/application/services/draftEdit/draftEditSummary';
import type { DraftEditOutcome } from '@/domain/models/DraftEdit';

const NONE = { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0 };
const completed = (overrides: Partial<Extract<DraftEditOutcome, { kind: 'completed' }>> = {}): DraftEditOutcome => ({
  kind: 'completed',
  flagged: 9,
  judgmentCalls: 2,
  dropped: NONE,
  rejectedChunks: { saved: 0, unsaved: 0 },
  chunks: { total: 3, completed: 3 },
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.004 },
  ...overrides
});

describe('describeDraftEditOutcome', () => {
  it('summarizes a completed run with counts and cost', () => {
    expect(describeDraftEditOutcome(completed(), 'chapter-03.md')).toEqual({
      level: 'info',
      message: 'Proofread chapter-03.md: 9 issues flagged (2 tense or agreement) · $0.0040',
      hasFlags: true
    });
  });

  it('says when nothing was found, and never invents a cost the provider did not report', () => {
    expect(describeDraftEditOutcome(completed({ flagged: 0, judgmentCalls: 0, usage: undefined }), 'notes.txt'))
      .toEqual({ level: 'info', message: 'Proofread notes.txt: no issues found', hasFlags: false });
  });

  it('counts a selection run\'s kept flags, and offers the problems view for them alone (Slice 3)', () => {
    expect(describeDraftEditOutcome(completed({ flagged: 2, judgmentCalls: 0, kept: 5 }), 'chapter-03.md')).toEqual({
      level: 'info',
      message: 'Proofread chapter-03.md: 2 issues flagged · 5 earlier flags outside the selection kept · $0.0040',
      hasFlags: true
    });
    expect(describeDraftEditOutcome(completed({ flagged: 0, judgmentCalls: 0, kept: 1, usage: undefined }), 'chapter-03.md')).toEqual({
      level: 'info',
      message: 'Proofread chapter-03.md: no issues found in the selection · 1 earlier flag outside the selection kept',
      hasFlags: true
    });
  });

  it('counts what was not placed and what could not be read', () => {
    const outcome = completed({
      flagged: 1,
      judgmentCalls: 0,
      dropped: { unanchored: 1, protected: 1, overlapping: 1, stale: 1, malformed: 1 },
      rejectedChunks: { saved: 1, unsaved: 0 },
      usage: undefined
    });
    expect(describeDraftEditOutcome(outcome, 'a.md')).toEqual({
      level: 'warning',
      message: 'Proofread a.md: 1 issue flagged · 5 not placed · 1 part unreadable, saved for recovery',
      hasFlags: true
    });
  });

  it('never calls an unreadable part saved when its recovery copy could not be written (PR #171 F-06)', () => {
    const summary = (saved: number, unsaved: number) =>
      describeDraftEditOutcome(completed({ flagged: 0, judgmentCalls: 0, rejectedChunks: { saved, unsaved }, usage: undefined }), 'a.md');

    expect(summary(0, 1)).toEqual({
      level: 'warning',
      message: 'Proofread a.md: no issues found · 1 part unreadable and not saved for recovery (see the Prose Minion output)',
      hasFlags: false
    });
    expect(summary(2, 1)).toMatchObject({
      level: 'warning',
      message: 'Proofread a.md: no issues found · 3 parts unreadable: 2 saved for recovery, 1 not saved (see the Prose Minion output)'
    });
    expect(summary(2, 0)).toMatchObject({ message: 'Proofread a.md: no issues found · 2 parts unreadable, saved for recovery' });
  });

  it('names an interruption and how much was proofread', () => {
    const outcome = completed({
      chunks: { total: 3, completed: 1 },
      interrupted: { cause: 'key-changed', message: 'The API key changed during the run, so the remaining chunks were not sent.' }
    });
    expect(describeDraftEditOutcome(outcome, 'a.md')).toMatchObject({
      level: 'warning',
      message: 'Proofread a.md: 9 issues flagged (2 tense or agreement) · $0.0040. '
        + 'The API key changed during the run, so the remaining chunks were not sent. (1 of 3 parts proofread.)'
    });
  });

  it('says a closed document showed nothing, with its unreadable parts and cost (PR #171 F-04)', () => {
    expect(describeDraftEditOutcome(
      { kind: 'closed', rejectedChunks: { saved: 1, unsaved: 0 }, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.002 } },
      'a.md'
    )).toEqual({
      level: 'warning',
      message: 'a.md was closed or changed language before Proofread finished, so no flags were shown · 1 part unreadable, saved for recovery · $0.0020.',
      hasFlags: false
    });
    expect(describeDraftEditOutcome({ kind: 'closed', rejectedChunks: { saved: 0, unsaved: 0 } }, 'a.md'))
      .toMatchObject({ message: 'a.md was closed or changed language before Proofread finished, so no flags were shown.' });
  });

  it('words the runs that send nothing', () => {
    expect(describeDraftEditOutcome({ kind: 'changed' }, 'a.md'))
      .toMatchObject({ level: 'warning', message: 'a.md changed before Proofread could start, so nothing was sent. Run it again.' });
    expect(describeDraftEditOutcome({ kind: 'empty' }, 'a.md')).toMatchObject({ message: 'Nothing to proofread in a.md.' });
    expect(describeDraftEditOutcome({ kind: 'unconfigured' }, 'a.md')).toMatchObject({ level: 'warning', message: 'Proofread needs an OpenRouter API key.' });
    expect(describeDraftEditOutcome({ kind: 'busy' }, 'a.md')).toMatchObject({ message: 'Proofread is already running on a.md.' });
    expect(describeDraftEditOutcome({ kind: 'cancelled' }, 'a.md')).toMatchObject({ message: 'Proofread cancelled. No flags changed.' });
    expect(describeDraftEditOutcome({ kind: 'cancelled', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.0012 } }, 'a.md'))
      .toMatchObject({ message: 'Proofread cancelled. No flags changed (spent $0.0012).' });
  });
});

describe('describeDraftEditOutcome: Proofread and Fix (Slice 2)', () => {
  const fixed = (fix: NonNullable<Extract<DraftEditOutcome, { kind: 'completed' }>['fix']>, flagged = 3, judgmentCalls = 2) =>
    completed({ flagged, judgmentCalls, fix });

  it('leads with the fixes applied, then what is flagged', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'submitted', applied: 7, notApplied: 0, unknown: 0 }), 'chapter-03.md'))
      .toEqual({ level: 'info', message: 'Proofread chapter-03.md: 7 fixes applied · 3 issues flagged (2 tense or agreement) · $0.0040', hasFlags: true });
  });

  it('says how many fixes the writer left unticked, now flagged', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'submitted', applied: 1, notApplied: 2, unknown: 0 }, 4), 'a.md').message)
      .toBe('Proofread a.md: 1 fix applied (2 left unticked, flagged) · 4 issues flagged (2 tense or agreement) · $0.0040');
  });

  it('says a discarded preview changed nothing', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'declined', applied: 0, notApplied: 7, unknown: 0 }, 9), 'a.md'))
      .toMatchObject({ level: 'info', message: 'Proofread a.md: fixes discarded, nothing changed · 9 issues flagged (2 tense or agreement) · $0.0040' });
  });

  it('warns when the file changed during review, and says what the writer edited was left alone', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'stale', applied: 0, notApplied: 5, unknown: 2 }, 7), 'a.md'))
      .toMatchObject({
        level: 'warning',
        message: 'Proofread a.md: the file changed during review, so no fixes were applied · 7 issues flagged (2 tense or agreement)'
          + ' · 2 fixes you edited during review left as you wrote them · $0.0040'
      });
  });

  it('gives the editor\'s reason when it refused the change', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'direct', answer: 'failed', applied: 0, notApplied: 2, unknown: 0, failure: 'read-only' }, 2, 0), 'a.md'))
      .toMatchObject({ level: 'warning', message: 'Proofread a.md: the editor did not apply the fixes (read-only) · 2 issues flagged · $0.0040' });
  });

  it('reads like Flag when there was nothing safe to fix, and says when nothing was found at all', () => {
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'none', applied: 0, notApplied: 0, unknown: 0 }, 1, 1), 'a.md').message)
      .toBe('Proofread a.md: 1 issue flagged (1 tense or agreement) · $0.0040');
    expect(describeDraftEditOutcome(fixed({ review: 'preview', answer: 'submitted', applied: 2, notApplied: 0, unknown: 0 }, 0, 0), 'a.md').message)
      .toBe('Proofread a.md: 2 fixes applied · $0.0040');
  });
});

describe('describeQuickFixOutcome (Slice 2)', () => {
  const done = (answer: 'submitted' | 'declined' | 'stale' | 'failed' | 'none', applied: number, notApplied = 0) =>
    ({ kind: 'done' as const, refused: 0, review: 'direct' as const, answer, applied, notApplied, unknown: 0 });

  it('says nothing when one fix simply landed', () => {
    expect(describeQuickFixOutcome(done('submitted', 1), 'a.md')).toMatchObject({ quiet: true });
  });

  it('counts a Fix all, and what it left as flags', () => {
    expect(describeQuickFixOutcome(done('submitted', 5, 1), 'a.md')).toEqual({
      level: 'info', message: 'Proofread a.md: 5 fixes applied · 1 left as flags.', hasFlags: false, quiet: false
    });
  });

  it.each([
    [{ kind: 'changed' as const }, 'a.md changed since the fix was offered, so nothing was changed.'],
    [{ kind: 'nothing' as const }, 'That Proofread fix is no longer there: its flag was dismissed, or its text edited.'],
    [{ kind: 'busy' as const }, 'Proofread is already working on a.md.'],
    [{ kind: 'closed' as const }, 'a.md was closed or changed language before the fix finished. Check it: the fix may have gone in.'],
    [done('stale', 0, 1), 'a.md changed as the fix went in, so it was not applied.'],
    [{ ...done('stale', 0, 1), review: 'preview' as const }, 'a.md changed during review, so no fixes were applied.'],
    [done('none', 0), 'That fix was not applied: its text has changed, or it would change a line break or the Markdown around it.']
  ])('explains a quick fix that did not land', (outcome, message) => {
    expect(describeQuickFixOutcome(outcome, 'a.md')).toMatchObject({ message, quiet: false });
  });
});
