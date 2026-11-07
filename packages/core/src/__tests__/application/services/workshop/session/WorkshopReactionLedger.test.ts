/**
 * The reaction ledger (ADR 2026-11-07 D2): idempotent adds and removes by
 * the identity triple, refused on a turn its author may not react to, and
 * bounded by `PROMPT_BUDGETS.workshopReactions.perSession`.
 */

import type { WorkshopTurn } from '@messages';
import {
  WorkshopReactionLedger,
  WorkshopReactionRefusedError
} from '@/application/services/workshop/session/WorkshopReactionLedger';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const turn = (id: string, facts: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'Alice is late again.',
  timestamp: 1,
  ...facts
});

const WRITER_MESSAGE = turn('turn-1', { role: 'user', participant: 'writer', personaId: undefined, personaLabel: undefined });
const REPLY = turn('turn-2');
const GUEST_REPLY = turn('turn-3', { participant: 'guest', personaId: 'margot', personaLabel: 'Margot' });
const TURNS = [WRITER_MESSAGE, REPLY, GUEST_REPLY];
const find = (id: string) => TURNS.find((candidate) => candidate.id === id);
const WRITER = { kind: 'writer' } as const;

const refusal = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof WorkshopReactionRefusedError ? error.reason : 'other';
  }
};

describe('WorkshopReactionLedger', () => {
  it('adds a reaction once, and removes it once', () => {
    const ledger = new WorkshopReactionLedger(() => 42);

    expect(ledger.add({ turnId: REPLY.id, reaction: 'fire', author: WRITER }, REPLY)).toBe('added');
    expect(ledger.add({ turnId: REPLY.id, reaction: 'fire', author: WRITER }, REPLY)).toBe('unchanged');
    expect(ledger.list()).toEqual([{ turnId: REPLY.id, reaction: 'fire', author: WRITER, createdAt: 42 }]);
    expect(ledger.remove({ turnId: REPLY.id, reaction: 'fire', author: WRITER })).toBe('removed');
    expect(ledger.remove({ turnId: REPLY.id, reaction: 'fire', author: WRITER })).toBe('unchanged');
  });

  it('keys a reaction by its author too: the writer\'s and a persona\'s are different entries', () => {
    const ledger = new WorkshopReactionLedger(() => 1);
    ledger.add({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'host' }, viaTurnId: REPLY.id }, WRITER_MESSAGE);
    ledger.add({
      turnId: WRITER_MESSAGE.id,
      reaction: 'heart',
      author: { kind: 'personaGuest', personaId: 'margot' },
      viaTurnId: GUEST_REPLY.id
    }, WRITER_MESSAGE);

    expect(ledger.remove({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: WRITER })).toBe('unchanged');
    expect(ledger.remove({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'personaGuest', personaId: 'theo' } }))
      .toBe('unchanged');
    expect(ledger.remove({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'host' } })).toBe('removed');
    expect(ledger.list().map((reaction) => reaction.author)).toEqual([{ kind: 'personaGuest', personaId: 'margot' }]);
  });

  it('refuses an unknown or ineligible turn, changing nothing', () => {
    const ledger = new WorkshopReactionLedger(() => 1);

    expect(refusal(() => ledger.add({ turnId: 'gone', reaction: 'fire', author: WRITER }, undefined))).toBe('unknown-turn');
    expect(refusal(() => ledger.add({ turnId: REPLY.id, reaction: 'fire', author: WRITER }, GUEST_REPLY))).toBe('unknown-turn');
    expect(refusal(() => ledger.add({ turnId: WRITER_MESSAGE.id, reaction: 'fire', author: WRITER }, WRITER_MESSAGE)))
      .toBe('ineligible-turn');
    expect(ledger.list()).toEqual([]);
  });

  it('refuses an add past the session bound', () => {
    const ledger = new WorkshopReactionLedger(() => 1);
    const bound = PROMPT_BUDGETS.workshopReactions.perSession;
    ledger.installPreparedState(ledger.prepareState(Array.from({ length: bound }, (_, index) => ({
      turnId: `turn-${index}`,
      reaction: 'fire' as const,
      author: WRITER,
      createdAt: index
    }))));

    expect(refusal(() => ledger.add({ turnId: REPLY.id, reaction: 'sad', author: WRITER }, REPLY))).toBe('session-full');
    // An entry already there is still unchanged, not refused.
    expect(ledger.add({ turnId: 'turn-0', reaction: 'fire', author: WRITER }, turn('turn-0'))).toBe('unchanged');
  });

  it('summarizes the window\'s turns in thread order, each turn\'s writer reactions first', () => {
    const ledger = new WorkshopReactionLedger(() => 1);
    ledger.add({ turnId: GUEST_REPLY.id, reaction: 'eyes', author: WRITER }, GUEST_REPLY);
    ledger.add({ turnId: WRITER_MESSAGE.id, reaction: 'thanks', author: { kind: 'personaGuest', personaId: 'margot' }, viaTurnId: GUEST_REPLY.id }, WRITER_MESSAGE);
    ledger.add({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'host' }, viaTurnId: REPLY.id }, WRITER_MESSAGE);
    ledger.add({ turnId: REPLY.id, reaction: 'fire', author: WRITER }, REPLY);

    expect(ledger.summaries(TURNS, find, 'jill')).toEqual([
      { turnId: WRITER_MESSAGE.id, reaction: 'thanks', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot' },
      { turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'host' }, label: 'Jill' },
      { turnId: REPLY.id, reaction: 'fire', author: WRITER, label: 'You' },
      { turnId: GUEST_REPLY.id, reaction: 'eyes', author: WRITER, label: 'You' }
    ]);
    // Only the window's turns are summarized.
    expect(ledger.summaries([REPLY], find, 'jill').map((summary) => summary.turnId)).toEqual([REPLY.id]);
  });

  it('prunes a persona\'s reaction with the reply that carried it', () => {
    const ledger = new WorkshopReactionLedger(() => 1);
    ledger.add({ turnId: WRITER_MESSAGE.id, reaction: 'heart', author: { kind: 'host' }, viaTurnId: REPLY.id }, WRITER_MESSAGE);
    ledger.add({ turnId: GUEST_REPLY.id, reaction: 'eyes', author: WRITER }, GUEST_REPLY);

    expect(ledger.pruneTo(new Set([WRITER_MESSAGE.id, GUEST_REPLY.id]))).toBe(1);
    expect(ledger.list().map((reaction) => reaction.reaction)).toEqual(['eyes']);
  });

  it('hands out copies, never its own entries', () => {
    const ledger = new WorkshopReactionLedger(() => 1);
    ledger.add({ turnId: REPLY.id, reaction: 'fire', author: WRITER }, REPLY);
    const listed = ledger.list();
    listed[0].reaction = 'sad';

    expect(ledger.list()[0].reaction).toBe('fire');
  });
});
