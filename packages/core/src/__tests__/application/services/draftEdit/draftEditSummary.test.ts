/**
 * The words a host shows for a Draft Edit outcome (ADR 2026-10-21 D8): counts,
 * the honest cost, and the interruption, never the writer's text.
 */
import { describeDraftEditOutcome } from '@/application/services/draftEdit/draftEditSummary';
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
      message: 'a.md was closed before Proofread finished, so no flags were shown · 1 part unreadable, saved for recovery · $0.0020.',
      hasFlags: false
    });
    expect(describeDraftEditOutcome({ kind: 'closed', rejectedChunks: { saved: 0, unsaved: 0 } }, 'a.md'))
      .toMatchObject({ message: 'a.md was closed before Proofread finished, so no flags were shown.' });
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
