/**
 * An edit-offer chip as drawn (ADR 2026-11-10 U2, U5, U6 and its addendum;
 * epic Slice 3): every status in its own words, an accessible name that
 * starts with the visible label, `askAgain` drawn as a press, and the
 * reasons a chip waits. Pure; *Alice*.
 */

import type { WorkshopEditOffer, WorkshopEditOfferStatus } from '@messages';
import {
  workshopEditOfferChipView,
  workshopEditOfferGroupLabel,
  workshopEditOfferKey,
  type WorkshopEditOfferChipFacts
} from '@hooks/domain/workshop/editOffers/workshopEditOfferChipView';
import { workshopEditOfferRefusalWords } from '@shared/constants/workshopEditOfferWords';

const PATH = 'chapters/down-the-rabbit-hole.md';
const offer = (status?: WorkshopEditOfferStatus, change: Partial<WorkshopEditOffer> = {}): WorkshopEditOffer => ({
  kind: 'fixes',
  target: { kind: 'file', relativePath: PATH },
  count: 3,
  ...(status ? { status } : {}),
  ...change
});
const facts = (change: Partial<WorkshopEditOfferChipFacts> = {}): WorkshopEditOfferChipFacts => ({
  personaLabel: 'Jill',
  asking: false,
  running: false,
  locked: false,
  ...change
});
const view = (status?: WorkshopEditOfferStatus, change: Partial<WorkshopEditOffer> = {}, room: Partial<WorkshopEditOfferChipFacts> = {}) =>
  workshopEditOfferChipView(offer(status, change), facts(room));

describe('workshopEditOfferChipView', () => {
  it('open: the persona\'s count and kind, and a press that asks', () => {
    expect(view({ state: 'open' })).toEqual({
      face: 'open',
      count: 3,
      words: 'fixes',
      label: '3 fixes',
      name: `3 fixes. Ask Jill to suggest them as edits to ${PATH}.`,
      press: { kind: 'ask' }
    });
  });

  it('reads the bare kind with no count, the singular for one, and rewrites by their name', () => {
    expect(view({ state: 'open' }, { count: undefined })).toMatchObject({ label: 'fixes', name: `fixes. Ask Jill to suggest them as edits to ${PATH}.` });
    expect(view({ state: 'open' }, { count: 1 })).toMatchObject({ label: '1 fix', name: `1 fix. Ask Jill to suggest it as edits to ${PATH}.` });
    expect(view({ state: 'open' }, { kind: 'rewrites', count: 2 }).label).toBe('2 rewrites');
    expect(view({ state: 'open' }, { kind: 'rewrites', count: 1 }).label).toBe('1 rewrite');
  });

  it('an offer with no status reads as open (a caller with no room view)', () => {
    expect(view(undefined).face).toBe('open');
  });

  it('asked: says who is asked for what, and a press does nothing', () => {
    const asked = view({ state: 'asked' });
    expect(asked).toMatchObject({ face: 'asked', label: 'Asking Jill for 3 fixes…', press: { kind: 'none' } });
    expect(asked.name.startsWith(asked.label)).toBe(true);
    expect(asked.waiting).toBeUndefined();
  });

  it('this webview\'s own press reads as asked before the host\'s status says so', () => {
    expect(view({ state: 'open' }, {}, { asking: true })).toMatchObject({ face: 'asked', press: { kind: 'none' } });
  });

  it('answered: shows what came, which may differ from the count, and a press goes to the answer', () => {
    expect(view({ state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 2, askAgain: false })).toEqual({
      face: 'answered',
      count: 2,
      words: 'fixes suggested',
      label: '2 fixes suggested',
      name: '2 fixes suggested. Go to the edits.',
      press: { kind: 'go', answerTurnId: 'turn-6' }
    });
  });

  it('nothing to change: says so, and the second press is plain (the addendum)', () => {
    const none = view({ state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true });
    expect(none).toMatchObject({ face: 'nothing-to-change', label: '3 fixes · nothing to change · ask again', press: { kind: 'ask' } });
    expect(none.name).toBe(`3 fixes, nothing to change, ask again. Ask Jill again to suggest them as edits to ${PATH}.`);
  });

  it('ask again: every card of the last answer is spent, so a press asks', () => {
    const again = view({ state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true });
    expect(again).toMatchObject({ face: 'ask-again', label: '3 fixes · ask again', press: { kind: 'ask' } });
    expect(again.name).toContain('3 fixes, ask again.');
  });

  it('an answered status that carries askAgain is drawn as ask again, never as a way to the cards', () => {
    expect(view({ state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true }))
      .toMatchObject({ face: 'ask-again', label: '3 fixes suggested · ask again', press: { kind: 'ask' } });
  });

  it('every face has its own words, and every name starts with what is visible', () => {
    const statuses: WorkshopEditOfferStatus[] = [
      { state: 'open' },
      { state: 'asked' },
      { state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false },
      { state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true },
      { state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true }
    ];
    const views = statuses.map((status) => view(status));
    expect(new Set(views.map((each) => each.label)).size).toBe(statuses.length);
    for (const each of views) {
      // The label's separators read as commas in the name; its words lead it either way.
      expect(each.name.startsWith(each.label.replace(/ · /g, ', ').replace(/…$/, '…'))).toBe(true);
    }
  });

  describe('waiting (U5)', () => {
    it('a run going: the chip keeps its face and carries the host\'s reason', () => {
      expect(view({ state: 'open' }, {}, { running: true, locked: true }))
        .toMatchObject({ face: 'open', label: '3 fixes', press: { kind: 'ask' }, waiting: workshopEditOfferRefusalWords('run-active') });
    });

    it('the room\'s lock held for something else: the room\'s own wording', () => {
      expect(view({ state: 'ask-again', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: true }, {}, { locked: true }).waiting)
        .toBe(workshopEditOfferRefusalWords('session-operation'));
    });

    it('the author left: named, and said before any other reason', () => {
      expect(view({ state: 'open', blocked: 'author-left' }, {}, { running: true }).waiting).toBe('Jill isn’t in this room now');
      expect(view({ state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true, blocked: 'author-left' }).waiting)
        .toBe('Jill isn’t in this room now');
    });

    it('a chip that goes to its answer never waits', () => {
      const answered = view({ state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false, blocked: 'author-left' }, {}, { running: true, locked: true });
      expect(answered.waiting).toBeUndefined();
      expect(answered.press).toEqual({ kind: 'go', answerTurnId: 'turn-6' });
    });
  });

  it('carries the host\'s words for a press that left no answer, on a chip that asks', () => {
    expect(view({ state: 'open' }, {}, { feedback: 'Stopped. Nothing was suggested.' }).feedback).toBe('Stopped. Nothing was suggested.');
    expect(view({ state: 'answered', answerTurnId: 'turn-6', cards: 1, changes: 3, askAgain: false }, {}, { feedback: 'x' }).feedback).toBeUndefined();
  });

  it('keys a chip by its turn and kind, and names the group for the persona', () => {
    expect(workshopEditOfferKey('turn-2', 'rewrites')).toBe('turn-2#rewrites');
    expect(workshopEditOfferGroupLabel('Jill')).toBe('Edits Jill can suggest from this reply');
  });
});
