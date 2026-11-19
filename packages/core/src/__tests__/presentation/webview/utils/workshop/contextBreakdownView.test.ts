/**
 * The summary by part, as drawn (ADR 2026-11-18 D1, D2, D7): the parts add
 * up to the provider's total with Conversation as the rest; the rest is
 * never negative; a part not measured is said so, never zero.
 */
import { contextBreakdownView } from '@utils/workshop/contextBreakdownView';
import { CONTEXT_BREAKDOWN_PARTS, ContextBreakdown, ContextBreakdownPart } from '@shared/types';

const parts = (tokens: Partial<Record<string, number | undefined>>, untallied = false): ContextBreakdown => ({
  parts: CONTEXT_BREAKDOWN_PARTS.map((part): ContextBreakdownPart => ({
    part,
    ...(tokens[part] !== undefined ? { tokens: tokens[part] } : {}),
    measure: part === 'requested' ? 'mixed' : 'estimate',
    pieces: part === 'persona' ? [{ name: 'Interaction mode: Balanced', tokens: 900 }, { name: 'Catch-ups', tokens: 400, count: 3 }] : []
  })),
  untalliedMessages: untallied
});

const full = { persona: 9_000, 'tool-use': 14_000, memory: 6_000, todos: 500, 'room-notes': 3_000, 'excerpt-context': 5_200, requested: 115_000 };

describe('contextBreakdownView (ADR 2026-11-18)', () => {
  it('adds Conversation as the rest, so the rows add up to the measured total', () => {
    const view = contextBreakdownView(parts(full), 160_656);
    const sum = view.rows.reduce((total, row) => total + (row.tokens ?? 0), 0);
    expect(sum).toBe(160_656);
    const conversation = view.rows.at(-1)!;
    expect(conversation).toMatchObject({ id: 'conversation', label: 'Conversation', tokens: 160_656 - 152_700, how: 'the rest' });
    expect(view.overflow).toBe(false);
    expect(view.rows.map((row) => row.label)).toEqual([
      'Persona and behavior', 'Tool-use instructions', 'Project memory', 'To-dos',
      'Room notes', 'Excerpt and context', 'Requested by the persona', 'Conversation'
    ]);
    expect(Math.round(view.rows.reduce((total, row) => total + row.share, 0))).toBe(100);
  });

  it('labels estimates, mixed parts and pieces', () => {
    const view = contextBreakdownView(parts(full), 160_656);
    expect(view.rows[0]).toMatchObject({ how: 'estimate', tokensText: '9K' });
    expect(view.rows.find((row) => row.id === 'requested')!.how).toBe('partly estimated');
    expect(view.rows[0].pieces).toEqual([
      { name: 'Interaction mode: Balanced', detail: 'about 900 tokens' },
      { name: 'Catch-ups', detail: 'about 400 tokens, in 3 messages' }
    ]);
  });

  it('never shows a negative: estimates over the total say so and the rest is 0', () => {
    const view = contextBreakdownView(parts(full), 100_000);
    expect(view.overflow).toBe(true);
    expect(view.rows.at(-1)!.tokens).toBe(0);
    expect(view.rows.every((row) => (row.tokens ?? 0) >= 0)).toBe(true);
    expect(view.accessibleSummary).toMatch(/more than the measured total/);
    expect(Math.round(view.rows.reduce((total, row) => total + row.share, 0))).toBe(100);
  });

  it('a part not measured says so, and the rest says it holds it (D7)', () => {
    const view = contextBreakdownView(parts({ persona: 9_000, 'tool-use': 14_000, requested: 1_000 }, true), 50_000);
    const memory = view.rows.find((row) => row.id === 'memory')!;
    expect(memory).toMatchObject({ tokensText: 'not measured', how: 'not measured', share: 0 });
    expect(memory.tokens).toBeUndefined();
    expect(view.rows.at(-1)).toMatchObject({ tokens: 26_000, how: 'the rest, with what was not measured' });
  });

  it('without a total: the measured parts, no shares, no overflow and no remainder (PR #285 F-01, F-02)', () => {
    const view = contextBreakdownView(parts(full), undefined);
    expect(view.hasTotal).toBe(false);
    expect(view.overflow).toBe(false);
    expect(view.rows.every((row) => row.share === 0)).toBe(true);
    expect(view.rows[0]).toMatchObject({ tokens: 9_000, tokensText: '9K', how: 'estimate' });
    const conversation = view.rows.at(-1)!;
    expect(conversation.tokens).toBeUndefined();
    expect(conversation).toMatchObject({ tokensText: 'not measured yet', how: 'the rest, once the next reply is measured' });
    expect(view.accessibleSummary).toMatch(/No measured total yet/);
  });
});
