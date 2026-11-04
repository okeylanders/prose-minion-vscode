/**
 * The bookmark ledger (ADR 2026-11-03 D5): host-minted ids, one bookmark per
 * turn, idempotent set and clear, the label rule, the deterministic default,
 * pruning, and thread-order summaries whose `inWindow` is the caller's window.
 */

import {
  isWorkshopBookmarkableTurn,
  WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS,
  WorkshopBookmarkLedger,
  workshopBookmarkDefaultLabel
} from '@/application/services/workshop/session/WorkshopBookmarkLedger';
import { WORKSHOP_BOOKMARK_LABEL_CHARACTERS, WorkshopTurn } from '@messages';

const turn = (overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id: 'turn-2-assistant-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'Right now her reaction lands a beat late.',
  timestamp: 1,
  ...overrides
});

const writer = (overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => turn({
  id: 'turn-1-user-1',
  role: 'user',
  participant: 'writer',
  personaId: undefined,
  personaLabel: undefined,
  content: 'What if the lantern never lights?',
  ...overrides
});

const report = (): WorkshopTurn => turn({
  id: 'turn-3-assistant-1',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'tool_report',
  personaId: undefined,
  personaLabel: undefined,
  toolId: 'dialogue',
  toolLabel: 'Dialogue & Beats',
  content: '## Summary\n\nThe father never answers.'
});

const card = (): WorkshopTurn => turn({
  id: 'turn-4-assistant-1',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'resource_read',
  personaId: undefined,
  personaLabel: undefined,
  toolLabel: 'Project Resources',
  capability: {
    operation: 'resource.read',
    status: 'success',
    requestSummary: 'notes/lantern.md',
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  },
  content: 'SECRET EVIDENCE BODY: the whole file.'
});

const divider = (overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => turn({
  id: 'turn-5-system-1',
  role: 'system',
  kind: 'divider',
  participant: 'session',
  artifact: 'session_resume',
  personaId: undefined,
  personaLabel: undefined,
  content: 'Session resumed',
  ...overrides
});

const ledgerAt = (start = 100) => {
  let now = start;
  return new WorkshopBookmarkLedger(() => ++now);
};

describe('WorkshopBookmarkLedger', () => {
  it('sets one bookmark per turn with a host-minted id, and is idempotent', () => {
    const ledger = ledgerAt();
    const reply = turn();

    expect(ledger.set(reply.id, reply, true)).toBe('set');
    expect(ledger.set(reply.id, reply, true)).toBe('unchanged');

    const [bookmark] = ledger.list();
    expect(ledger.list()).toHaveLength(1);
    expect(bookmark).toEqual({ id: 'bookmark-1-101', turnId: reply.id, createdAt: 102 });
    expect(bookmark).not.toHaveProperty('label');
  });

  it('clears a bookmark, and clearing an unmarked turn changes nothing', () => {
    const ledger = ledgerAt();
    const reply = turn();
    ledger.set(reply.id, reply, true);

    expect(ledger.set(reply.id, reply, false)).toBe('cleared');
    expect(ledger.set(reply.id, reply, false)).toBe('unchanged');
    expect(ledger.set('turn-gone', undefined, false)).toBe('unchanged');
    expect(ledger.list()).toEqual([]);
  });

  it('never reuses an id number after a clear or a reset', () => {
    const ledger = ledgerAt();
    const reply = turn();
    ledger.set(reply.id, reply, true);
    ledger.set(reply.id, reply, false);
    ledger.reset();
    ledger.set(reply.id, reply, true);

    expect(ledger.list()[0].id).toMatch(/^bookmark-2-/);
  });

  it.each<[string, WorkshopTurn]>([
    ['a host reply', turn()],
    ['a guest reply', turn({ participant: 'guest', personaId: 'margot', personaLabel: 'Margot' })],
    ['a writer message', writer()],
    ['a direct message to a tool', writer({ artifact: 'direct_tool_message', toolId: 'prose' })],
    ['a tool report', report()],
    ['a capability card', card()],
    ['a direct tool reply', turn({ participant: 'tool', artifact: 'direct_tool_response', toolId: 'prose' })]
  ])('accepts %s', (_label, candidate) => {
    expect(isWorkshopBookmarkableTurn(candidate)).toBe(true);
    expect(ledgerAt().set(candidate.id, candidate, true)).toBe('set');
  });

  it.each<[string, WorkshopTurn]>([
    ['a session resume divider', divider()],
    ['a session start divider', divider({ artifact: 'session_start' })],
    ['an excerpt revision divider', divider({ artifact: 'excerpt_revision' })],
    ['a context change divider', divider({ artifact: 'context_change' })],
    ['a standing-directive marker', divider({ artifact: 'standing_directive_change' })],
    ['a direct tool-run request', writer({ kind: 'tool_run', artifact: 'tool_request', toolId: 'prose' })]
  ])('refuses %s and changes nothing', (_label, candidate) => {
    const ledger = ledgerAt();

    expect(isWorkshopBookmarkableTurn(candidate)).toBe(false);
    expect(() => ledger.set(candidate.id, candidate, true))
      .toThrow(expect.objectContaining({ reason: 'ineligible-turn' }));
    expect(ledger.list()).toEqual([]);
  });

  it('refuses to set a bookmark on a turn it was not given', () => {
    const ledger = ledgerAt();

    expect(() => ledger.set('turn-9', undefined, true))
      .toThrow(expect.objectContaining({ reason: 'unknown-turn' }));
    expect(() => ledger.set('turn-9', turn(), true))
      .toThrow(expect.objectContaining({ reason: 'unknown-turn' }));
    expect(ledger.list()).toEqual([]);
  });

  describe('rename', () => {
    const marked = () => {
      const ledger = ledgerAt();
      const reply = turn();
      ledger.set(reply.id, reply, true);
      return { ledger, id: ledger.list()[0].id };
    };

    it('trims and stores the label', () => {
      const { ledger, id } = marked();

      expect(ledger.rename(id, '  The late beat  ')).toBe('set');
      expect(ledger.list()[0].label).toBe('The late beat');
      expect(ledger.rename(id, 'The late beat')).toBe('unchanged');
    });

    it.each([null, '', '   '])('restores the default for %p', (label) => {
      const { ledger, id } = marked();
      ledger.rename(id, 'Named');

      expect(ledger.rename(id, label)).toBe('set');
      expect(ledger.list()[0]).not.toHaveProperty('label');
    });

    it('accepts a label at the limit and refuses one past it', () => {
      const { ledger, id } = marked();

      expect(ledger.rename(id, 'x'.repeat(WORKSHOP_BOOKMARK_LABEL_CHARACTERS))).toBe('set');
      expect(() => ledger.rename(id, 'y'.repeat(WORKSHOP_BOOKMARK_LABEL_CHARACTERS + 1)))
        .toThrow(expect.objectContaining({ reason: 'invalid-label' }));
      expect(ledger.list()[0].label).toBe('x'.repeat(WORKSHOP_BOOKMARK_LABEL_CHARACTERS));
    });

    it.each(['two\nlines', 'a\ttab', 'line\u2028separator', 'carriage\rreturn'])(
      'refuses a label that is not one line (%p)',
      (label) => {
        const { ledger, id } = marked();

        expect(() => ledger.rename(id, label)).toThrow(expect.objectContaining({ reason: 'invalid-label' }));
        expect(ledger.list()[0]).not.toHaveProperty('label');
      }
    );

    it('refuses an unknown bookmark', () => {
      expect(() => ledgerAt().rename('bookmark-9-9', 'Named'))
        .toThrow(expect.objectContaining({ reason: 'unknown-bookmark' }));
    });
  });

  describe('the default label', () => {
    it('is the participant and the first line', () => {
      expect(workshopBookmarkDefaultLabel(turn())).toBe('Jill · Right now her reaction lands a beat late.');
      expect(workshopBookmarkDefaultLabel(writer())).toBe('You · What if the lantern never lights?');
    });

    it('skips blank lines, drops leading Markdown marks, and collapses whitespace', () => {
      expect(workshopBookmarkDefaultLabel(report())).toBe('Dialogue & Beats · Summary');
      expect(workshopBookmarkDefaultLabel(turn({ content: '\n\n  -   Let   the father\tanswer.\nMore.' })))
        .toBe('Jill · Let the father answer.');
    });

    it('cuts at the limit with an ellipsis, never splitting a character', () => {
      const label = workshopBookmarkDefaultLabel(turn({ content: `${'word '.repeat(30)}end` }));
      expect(Array.from(label)).toHaveLength(WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS);
      expect(label.endsWith('…')).toBe(true);

      const emoji = workshopBookmarkDefaultLabel(turn({ content: '🕯️'.repeat(60) }));
      expect(Array.from(emoji).length).toBeLessThanOrEqual(WORKSHOP_BOOKMARK_DEFAULT_LABEL_CHARACTERS);
      expect(emoji).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    });

    it('names a capability card by its family and request, never its evidence', () => {
      const label = workshopBookmarkDefaultLabel(card());

      expect(label).toBe('Project Resources · notes/lantern.md');
      expect(label).not.toContain('SECRET');
    });

    it('falls back to the participant alone when there is no line', () => {
      expect(workshopBookmarkDefaultLabel(turn({ content: '   ' }))).toBe('Jill');
      expect(workshopBookmarkDefaultLabel(writer({ content: '' }))).toBe('You');
    });

    it('is deterministic', () => {
      expect(workshopBookmarkDefaultLabel(turn())).toBe(workshopBookmarkDefaultLabel(turn()));
    });
  });

  it('prunes bookmarks whose turn is gone', () => {
    const ledger = ledgerAt();
    const reply = turn();
    const mine = writer();
    ledger.set(reply.id, reply, true);
    ledger.set(mine.id, mine, true);

    expect(ledger.pruneTo(new Set([mine.id]))).toBe(1);
    expect(ledger.list().map((bookmark) => bookmark.turnId)).toEqual([mine.id]);
  });

  it('summarizes in thread order, not set order, with the window it is given', () => {
    const ledger = ledgerAt();
    const turns = [writer(), turn(), report(), card()];
    ledger.set(turns[3].id, turns[3], true);
    ledger.set(turns[0].id, turns[0], true);
    ledger.set(turns[2].id, turns[2], true);
    ledger.rename(ledger.list()[2].id, 'The report');

    const summaries = ledger.summaries(turns, new Set([turns[2].id, turns[3].id]));

    expect(summaries).toEqual([
      { id: 'bookmark-2-103', turnId: turns[0].id, label: 'You · What if the lantern never lights?', participant: 'writer', inWindow: false },
      { id: 'bookmark-3-105', turnId: turns[2].id, label: 'The report', participant: 'tool', toolId: 'dialogue', inWindow: true },
      { id: 'bookmark-1-101', turnId: turns[3].id, label: 'Project Resources · notes/lantern.md', participant: 'tool', inWindow: true }
    ]);
  });

  it('hands out copies, and resumes numbering past the ids it is given', () => {
    const ledger = ledgerAt();
    const prepared = ledger.prepareState([
      { id: 'bookmark-7-50', turnId: 'turn-1-user-1', createdAt: 50 },
      { id: 'bookmark-3-40', turnId: 'turn-2-assistant-1', label: 'Late', createdAt: 40 }
    ]);
    ledger.installPreparedState(prepared);
    ledger.list()[1].label = 'Mutated';

    expect(ledger.list()[1].label).toBe('Late');
    const reply = report();
    ledger.set(reply.id, reply, true);
    expect(ledger.list()[2].id).toMatch(/^bookmark-8-/);
  });
});
