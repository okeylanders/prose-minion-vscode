/**
 * An offer's status, derived from the thread (ADR 2026-11-10 D3, D7, U5;
 * epic Slice 2): one pure function over the full ledger, and the webview's
 * view built from it. Nothing about "used" is stored. Made-up text: Alice.
 */
import type { WorkshopEditOffer, WorkshopFileEditProposal, WorkshopFileEditState, WorkshopTurn } from '@messages';
import { WORKSHOP_FILE_EDIT_STATES } from '@messages';
import {
  workshopEditOfferMayBeAsked,
  workshopEditOfferStatus
} from '@/application/services/workshop/fileEdits/WorkshopEditOfferStatus';
import {
  workshopEditOfferRoomViewOnce,
  workshopTurnForWebview,
  type WorkshopEditOfferRoomView
} from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';

const URI = 'file:///ws/zzq-uri/chapters/one.md';
const offer = (kind: WorkshopEditOffer['kind'], count?: number): WorkshopEditOffer => ({
  kind, target: { kind: 'file', documentUri: URI, relativePath: 'chapters/one.md' }, ...(count ? { count } : {})
});
const turn = (id: string, extra: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id, role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message', personaId: 'jill', personaLabel: 'Jill',
  excerptVersion: 1, content: id, timestamp: 1, ...extra
} as WorkshopTurn);
const card = (state: WorkshopFileEditState, operations = 1): WorkshopFileEditProposal => ({
  requested: { kind: 'resource', group: 'chapters', path: 'chapters/one.md' },
  operations: Array.from({ length: operations }, (_, index) => ({ op: 'replace' as const, find: `a${index}`, with: `b${index}` })),
  why: 'Slips.',
  state
});
const SOURCE = turn('reply', { editOffers: [offer('fixes', 3), offer('rewrites')] });
const request = (id: string, kind: WorkshopEditOffer['kind'] = 'fixes', sourceTurnId = 'reply') =>
  turn(id, { role: 'user', participant: 'writer', editOfferRequest: { sourceTurnId, kind } });
const proposed = (id: string, cards: WorkshopFileEditProposal[], kind: WorkshopEditOffer['kind'] = 'fixes', sourceTurnId = 'reply') =>
  turn(id, { editOfferAnswer: { sourceTurnId, kind, outcome: 'proposed' }, fileEditProposals: cards });
const none = (id: string) => turn(id, { editOfferAnswer: { sourceTurnId: 'reply', kind: 'fixes', outcome: 'none', why: 'Reads right.' } });
const status = (ledger: WorkshopTurn[], runActive = false, kind: WorkshopEditOffer['kind'] = 'fixes') =>
  workshopEditOfferStatus(ledger, 'reply', kind, { runActive });

describe('workshopEditOfferStatus (D3)', () => {
  it('no answer names this turn and kind: open', () => {
    expect(status([SOURCE])).toEqual({ state: 'open' });
    // Another kind's answer, and another reply's, are not this offer's.
    expect(status([SOURCE, request('q1', 'rewrites'), proposed('a1', [card('pending')], 'rewrites')])).toEqual({ state: 'open' });
    expect(status([SOURCE, request('q1', 'fixes', 'other'), proposed('a1', [card('pending')], 'fixes', 'other')])).toEqual({ state: 'open' });
  });

  it('a run for it is going: asked', () => {
    expect(status([SOURCE, request('q1')], true)).toEqual({ state: 'asked' });
    // An earlier answer does not hide the run that is asking again.
    expect(status([SOURCE, request('q1'), none('a1'), request('q2')], true)).toEqual({ state: 'asked' });
    // Another run going is not a run for this offer.
    expect(status([SOURCE], true)).toEqual({ state: 'open' });
    expect(status([SOURCE, request('q1'), none('a1')], true).state).toBe('nothing-to-change');
    // A request left with no answer and no run (a session captured mid-run) reads open.
    expect(status([SOURCE, request('q1')], false)).toEqual({ state: 'open' });
  });

  it('the latest answer proposed: answered, with its turn, its cards and their changes', () => {
    expect(status([SOURCE, request('q1'), proposed('a1', [card('pending', 3)])]))
      .toEqual({ state: 'answered', answerTurnId: 'a1', cards: 1, changes: 3, askAgain: false });
    expect(status([SOURCE, request('q1'), proposed('a1', [card('applied', 2), card('declined', 1)])]))
      .toEqual({ state: 'answered', answerTurnId: 'a1', cards: 2, changes: 3, askAgain: false });
  });

  it('the latest answer was none: nothing to change, and it may be asked again', () => {
    expect(status([SOURCE, request('q1'), none('a1')])).toEqual({ state: 'nothing-to-change', answerTurnId: 'a1', askAgain: true });
  });

  it('reads the latest answer, wherever it stands in the ledger', () => {
    const ledger = [SOURCE, request('q1'), none('a1'), turn('other'), request('q2'), proposed('a2', [card('pending')])];
    expect(status(ledger)).toEqual({ state: 'answered', answerTurnId: 'a2', cards: 1, changes: 1, askAgain: false });
  });

  describe('asking again (D7): only when a second answer can double nothing', () => {
    const spent: WorkshopFileEditState[] = ['declined', 'stale', 'refused'];
    it.each(WORKSHOP_FILE_EDIT_STATES.map((state) => [state]))('one card %s', (state) => {
      const derived = status([SOURCE, request('q1'), proposed('a1', [card(state)])]);
      expect(derived.state).toBe(spent.includes(state) ? 'ask-again' : 'answered');
      expect(workshopEditOfferMayBeAsked(derived)).toBe(spent.includes(state));
    });

    it('every card must be spent: one pending, applied, partial, applying or unknown card holds it', () => {
      for (const live of ['pending', 'applying', 'applied', 'partial', 'unknown'] as const) {
        expect(status([SOURCE, request('q1'), proposed('a1', [card('declined'), card(live), card('stale')])]).state).toBe('answered');
      }
      expect(status([SOURCE, request('q1'), proposed('a1', [card('declined'), card('stale'), card('refused')])]))
        .toEqual({ state: 'ask-again', answerTurnId: 'a1', cards: 3, changes: 3, askAgain: true });
    });

    it('a press is taken only while open, or D7 holds; never while asked', () => {
      expect(workshopEditOfferMayBeAsked({ state: 'open' })).toBe(true);
      expect(workshopEditOfferMayBeAsked({ state: 'asked' })).toBe(false);
      expect(workshopEditOfferMayBeAsked({ state: 'nothing-to-change', answerTurnId: 'a', askAgain: true })).toBe(true);
      expect(workshopEditOfferMayBeAsked({ state: 'answered', answerTurnId: 'a', cards: 1, changes: 1, askAgain: false })).toBe(false);
    });
  });
});

describe('the webview\'s view of a turn\'s offers (D3, U5)', () => {
  const room = (overrides: Partial<WorkshopEditOfferRoomView> = {}): WorkshopEditOfferRoomView => ({
    fileEditsOpen: true, runActive: false, ledger: () => [SOURCE], authorPresent: () => true, ...overrides
  });

  it('carries each offer\'s derived status, its display path, and never the documentUri', () => {
    const answered = [SOURCE, request('q1'), proposed('a1', [card('pending', 2)])];
    const view = workshopTurnForWebview(SOURCE, room({ ledger: () => answered }));
    expect(view.editOffers).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: 'chapters/one.md' }, count: 3,
        status: { state: 'answered', answerTurnId: 'a1', cards: 1, changes: 2, askAgain: false } },
      { kind: 'rewrites', target: { kind: 'file', relativePath: 'chapters/one.md' }, status: { state: 'open' } }
    ]);
    expect(JSON.stringify(view)).not.toContain('zzq-uri');
    // The host's turn is not changed: its offers hold no status.
    expect(SOURCE.editOffers?.every((each) => each.status === undefined)).toBe(true);
  });

  it('reads the status from the full ledger, so an answer outside the window still counts', () => {
    const windowed = workshopTurnForWebview(SOURCE, room({ ledger: () => [SOURCE, request('q1'), none('far-away-answer')] }));
    expect(windowed.editOffers?.[0].status).toEqual({ state: 'nothing-to-change', answerTurnId: 'far-away-answer', askAgain: true });
  });

  it('draws no chip while file edits are off: the offers are left out, and the turn keeps the rest', () => {
    const view = workshopTurnForWebview({ ...SOURCE, fileEditProposals: [card('pending')] }, room({ fileEditsOpen: false }));
    expect(view.editOffers).toBeUndefined();
    expect('editOffers' in view).toBe(false);
    expect(view.fileEditProposals).toHaveLength(1);
    expect(view.content).toBe(SOURCE.content);
  });

  it('says when the reply\'s author left the room, except while a run for it is going', () => {
    const left = room({ authorPresent: () => false });
    expect(workshopTurnForWebview(SOURCE, left).editOffers?.map((each) => each.status)).toEqual([
      { state: 'open', blocked: 'author-left' }, { state: 'open', blocked: 'author-left' }
    ]);
    const asked = workshopTurnForWebview(SOURCE, room({ authorPresent: () => false, runActive: true, ledger: () => [SOURCE, request('q1')] }));
    expect(asked.editOffers?.[0].status).toEqual({ state: 'asked' });
  });

  it('reads the ledger only for a turn that holds an offer, and once for a whole snapshot', () => {
    const ledger = jest.fn(() => [SOURCE]);
    const once = workshopEditOfferRoomViewOnce(room({ ledger }));
    const plain = turn('plain');
    expect(workshopTurnForWebview(plain, once)).toBe(plain);
    workshopTurnForWebview(turn('cards', { fileEditProposals: [card('pending')] }), once);
    expect(ledger).not.toHaveBeenCalled();
    workshopTurnForWebview(SOURCE, once);
    workshopTurnForWebview(SOURCE, once);
    expect(ledger).toHaveBeenCalledTimes(1);
  });

  it('with no room view, passes offers with no status (a caller with no room)', () => {
    expect(workshopTurnForWebview(SOURCE).editOffers).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: 'chapters/one.md' }, count: 3 },
      { kind: 'rewrites', target: { kind: 'file', relativePath: 'chapters/one.md' } }
    ]);
  });
});

describe('status per option, and the view of an offer with options (second addendum)', () => {
  const LABELS = ['Version 1', 'Version 2', 'A third option'];
  const VERSIONED = turn('reply', { editOffers: [offer('fixes', 3), { ...offer('rewrites'), options: LABELS }] });
  const ask = (id: string, option?: number) =>
    turn(id, { role: 'user', participant: 'writer', editOfferRequest: { sourceTurnId: 'reply', kind: 'rewrites', ...(option !== undefined ? { option } : {}) } });
  const answer = (id: string, option: number | undefined, cards: WorkshopFileEditProposal[]) =>
    turn(id, { editOfferAnswer: { sourceTurnId: 'reply', kind: 'rewrites', ...(option !== undefined ? { option } : {}), outcome: 'proposed' }, fileEditProposals: cards });
  const of = (ledger: WorkshopTurn[], option?: number, runActive = false) =>
    workshopEditOfferStatus(ledger, 'reply', 'rewrites', { runActive }, option);

  it('an answer counts only for the option it names: one version never uses up another', () => {
    const ledger = [VERSIONED, ask('q1', 1), answer('a1', 1, [card('pending')])];
    expect(of(ledger, 1)).toEqual({ state: 'answered', answerTurnId: 'a1', cards: 1, changes: 1, askAgain: false });
    expect(of(ledger, 0)).toEqual({ state: 'open' });
    expect(of(ledger, 2)).toEqual({ state: 'open' });
    // Nor does it answer the offer read with no option, or the fixes.
    expect(of(ledger)).toEqual({ state: 'open' });
    expect(status(ledger)).toEqual({ state: 'open' });
    // And an answer that names no option is no version's.
    expect(of([VERSIONED, ask('q1'), answer('a1', undefined, [card('pending')])], 0)).toEqual({ state: 'open' });
  });

  it('asked is the one option whose request stands while a run is going', () => {
    const ledger = [VERSIONED, ask('q1', 1), answer('a1', 1, [card('pending')]), ask('q2', 2)];
    expect(of(ledger, 2, true)).toEqual({ state: 'asked' });
    expect(of(ledger, 1, true).state).toBe('answered');
    expect(of(ledger, 0, true)).toEqual({ state: 'open' });
  });

  it('D7 holds option by option', () => {
    const ledger = [VERSIONED, ask('q1', 0), answer('a1', 0, [card('declined')]), ask('q2', 1), answer('a2', 1, [card('applied')])];
    expect(of(ledger, 0)).toMatchObject({ state: 'ask-again', askAgain: true });
    expect(of(ledger, 1)).toMatchObject({ state: 'answered', askAgain: false });
    expect(workshopEditOfferMayBeAsked(of(ledger, 0))).toBe(true);
    expect(workshopEditOfferMayBeAsked(of(ledger, 1))).toBe(false);
  });

  it('the view carries the labels and one status per option in place of the offer\'s own, and still no URI', () => {
    const ledger = [VERSIONED, ask('q1', 1), answer('a1', 1, [card('pending')])];
    const room: WorkshopEditOfferRoomView = { fileEditsOpen: true, runActive: false, ledger: () => ledger, authorPresent: () => true };
    const view = workshopTurnForWebview(VERSIONED, room);
    expect(view.editOffers).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: 'chapters/one.md' }, count: 3, status: { state: 'open' } },
      {
        kind: 'rewrites',
        target: { kind: 'file', relativePath: 'chapters/one.md' },
        options: LABELS,
        optionStatuses: [{ state: 'open' }, { state: 'answered', answerTurnId: 'a1', cards: 1, changes: 1, askAgain: false }, { state: 'open' }]
      }
    ]);
    expect(JSON.stringify(view)).not.toContain('zzq-uri');
    // The labels are a copy: the view never hands the ledger's own list out.
    expect(view.editOffers![1].options).not.toBe(VERSIONED.editOffers![1].options);
  });

  it('an author who left blocks every option that would ask', () => {
    const room: WorkshopEditOfferRoomView = { fileEditsOpen: true, runActive: false, ledger: () => [VERSIONED], authorPresent: () => false };
    expect(workshopTurnForWebview(VERSIONED, room).editOffers![1].optionStatuses).toEqual(
      LABELS.map(() => ({ state: 'open', blocked: 'author-left' })));
  });

  it('with file edits off the offer and its labels are left out; with no room view the labels pass with no status', () => {
    const closed: WorkshopEditOfferRoomView = { fileEditsOpen: false, runActive: false, ledger: () => [VERSIONED], authorPresent: () => true };
    expect(workshopTurnForWebview(VERSIONED, closed).editOffers).toBeUndefined();
    expect(workshopTurnForWebview(VERSIONED).editOffers![1]).toEqual({ kind: 'rewrites', target: { kind: 'file', relativePath: 'chapters/one.md' }, options: LABELS });
  });
});

