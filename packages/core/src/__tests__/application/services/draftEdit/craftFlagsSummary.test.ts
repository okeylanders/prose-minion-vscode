/**
 * The words a host shows for Craft Flags (ADR 2026-10-21, Amendment
 * 2026-10-26: Slice 3c): the priced confirmation, and one line after a run.
 */
import { describeCraftFlagsOutcome, describeCraftFlagsPlan } from '@/application/services/draftEdit/craftFlagsSummary';
import type { CraftFlagsOutcome } from '@/domain/models/CraftFlag';

const ESTIMATE = { model: 'anthropic/claude-sonnet-5', calls: 1, inputTokens: 9000, outputTokens: 1500 };
const NONE = { unanchored: 0, protected: 0, dialogue: 0, overlapping: 0, stale: 0, malformed: 0 };
const completed = (extra: Partial<Extract<CraftFlagsOutcome, { kind: 'completed' }>> = {}): CraftFlagsOutcome => ({
  kind: 'completed',
  flagged: 4,
  reads: 'document',
  dropped: NONE,
  notesWithheld: 0,
  rejectedCalls: { saved: 0, unsaved: 0 },
  calls: { total: 1, completed: 1 },
  ...extra
});

describe('describeCraftFlagsPlan', () => {
  it('names the words, the requests, the model without its provider, and an estimated price', () => {
    expect(describeCraftFlagsPlan({ kind: 'ready', words: 3214, reads: 'document', selection: false, estimate: { ...ESTIMATE, usd: 0.0612 } }, 'chapter-03.md'))
      .toBe('Craft Flags reads all 3,214 words of chapter-03.md. That is 1 request to claude-sonnet-5 (≈ $0.06).');
  });

  it('says a price that rounds to nothing as under a cent, and an unknown one as unknown', () => {
    const plan = { kind: 'ready' as const, words: 400, reads: 'document' as const, selection: false };
    expect(describeCraftFlagsPlan({ ...plan, estimate: { ...ESTIMATE, usd: 0.0012 } }, 'a.md')).toMatch(/\(< \$0\.01\)\.$/);
    expect(describeCraftFlagsPlan({ ...plan, estimate: ESTIMATE }, 'a.md')).toMatch(/\(price unknown: the model catalog has no live price for it\)\.$/);
  });

  it('says what a selection run reads: the chapter for context, or the selection alone over the ceiling', () => {
    expect(describeCraftFlagsPlan({ kind: 'ready', words: 3214, reads: 'document', selection: true, estimate: { ...ESTIMATE, usd: 0.06 } }, 'a.md'))
      .toBe('Craft Flags reads all 3,214 words of a.md for context, and flags only the selection. That is 1 request to claude-sonnet-5 (≈ $0.06).');
    expect(describeCraftFlagsPlan({ kind: 'ready', words: 2100, reads: 'selection', selection: true, estimate: { ...ESTIMATE, usd: 0.02 } }, 'a.md'))
      .toBe('a.md is too long to read whole, so Craft Flags reads the selection alone: 2,100 words. That is 1 request to claude-sonnet-5 (≈ $0.02).');
  });
});

describe('describeCraftFlagsOutcome', () => {
  it('counts the flags, those left alone in dialogue, those not placed, notes held back, and the cost', () => {
    expect(describeCraftFlagsOutcome(completed({
      dropped: { ...NONE, dialogue: 1, unanchored: 1, stale: 1 },
      notesWithheld: 1,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.061 }
    }), 'chapter-03.md')).toEqual({
      level: 'info',
      message: 'Craft Flags chapter-03.md: 4 flags · 1 left alone in dialogue · 2 not placed · 1 note not shown as written · $0.0610',
      hasFlags: true
    });
  });

  it('says when nothing was flagged, in the selection when it was one, and keeps earlier flags in view', () => {
    expect(describeCraftFlagsOutcome(completed({ flagged: 0 }), 'a.md')).toEqual({ level: 'info', message: 'Craft Flags a.md: no flags', hasFlags: false });
    expect(describeCraftFlagsOutcome(completed({ flagged: 0, kept: 2 }), 'a.md'))
      .toEqual({ level: 'info', message: 'Craft Flags a.md: no flags in the selection · 2 earlier flags outside the selection kept', hasFlags: true });
  });

  it('warns of unreadable calls and a provider refusal', () => {
    expect(describeCraftFlagsOutcome(completed({ flagged: 0, rejectedCalls: { saved: 1, unsaved: 0 } }), 'a.md'))
      .toMatchObject({ level: 'warning', message: 'Craft Flags a.md: no flags · 1 part unreadable, saved for recovery' });
    expect(describeCraftFlagsOutcome(completed({
      flagged: 0,
      calls: { total: 1, completed: 0 },
      interrupted: { cause: 'provider', message: 'The provider call failed, so the remaining categories were not sent: 402.' }
    }), 'a.md')).toMatchObject({
      level: 'warning',
      message: 'Craft Flags a.md: no flags. The provider call failed, so the remaining categories were not sent: 402. (0 of 1 category read.)'
    });
  });

  it.each<[CraftFlagsOutcome, string]>([
    [{ kind: 'empty' }, 'Nothing for Craft Flags to read in a.md.'],
    [{ kind: 'too-long', words: 30000, limit: 25000 }, 'a.md has 30,000 words, and Craft Flags reads up to 25,000 at once. Select a part of it to read that alone.'],
    [{ kind: 'unconfigured' }, 'Craft Flags needs an OpenRouter API key.'],
    [{ kind: 'busy' }, 'Craft Flags is already running on a.md.'],
    [{ kind: 'changed' }, 'a.md changed before Craft Flags could start, so nothing was sent. Run it again.'],
    [{ kind: 'cancelled', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.01 } }, 'Craft Flags cancelled. No flags changed (spent $0.0100).'],
    [{ kind: 'closed', rejectedCalls: { saved: 0, unsaved: 0 } }, 'a.md was closed or changed language before Craft Flags finished, so no flags were shown.']
  ])('words every other outcome once (%#)', (outcome, message) => {
    expect(describeCraftFlagsOutcome(outcome, 'a.md')).toMatchObject({ message, hasFlags: false });
  });
});
