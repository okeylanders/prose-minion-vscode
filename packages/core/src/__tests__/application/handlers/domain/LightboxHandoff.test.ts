/**
 * Build as a lens (ADR 2026-10-19 D11): `LIGHTBOX_HAND_OFF` names a borrowed
 * field on the board on screen; the host checks the board and the file on
 * disk, resolves and re-checks the field, and hands a bounded seed of counted
 * facts to the composition root's Workshop port. Stale, withheld or unknown
 * fields, a changed file and a missing Workshop are refused with a reason,
 * and nothing is handed over. "Sent" waits for the Workshop's own answer:
 * opened by a visible Workshop, or refused with its reason (PR #150 F-03). The real LightboxHandler and LightboxService;
 * readings are group A's worked example, verified against its own excerpt of
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */
import type {
  LightboxBoard,
  LightboxHandOffResultPayload,
  LightboxWorkshopHandoff,
  LightboxWorkshopHandoffOutcome,
  LightboxWorkshopHandoffRefusal
} from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_HANDOFF_REFUSALS, LIGHTBOX_WORKSHOP_REFUSALS } from '@/infrastructure/lightbox/LightboxHandoff';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { createLightboxHost, deferred, settle } from './lightboxHandlerHarness';

const CHAPTER = readWorkedExample('A').paragraphs.join('\n\n');
/** A Workshop port that answers at once. */
const answering = (outcome: LightboxWorkshopHandoffOutcome = { opened: true }) =>
  jest.fn((_handoff: LightboxWorkshopHandoff) => Promise.resolve(outcome));

async function boardWithReadings(handOff?: jest.Mock) {
  const host = createLightboxHost();
  host.addFile('Drafts/alice-1.md', CHAPTER);
  const panel = host.openPanel({ handOff });
  await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('Drafts/alice-1.md'));
  await settle();
  const board = host.service.currentBoard() as LightboxBoard;
  host.service.updateReadings(board.boardId, (readings) => readings.map((group) => (group.group === 'A' ? readGroup('A') : group)));
  const fieldId = (title: string) => host.service.currentBoard()?.readings[0].tiles.find((tile) => tile.title === title)?.id ?? '';
  const results = () => panel.posted.flatMap((message) =>
    message.type === MessageType.LIGHTBOX_HAND_OFF_RESULT ? [message.payload as LightboxHandOffResultPayload] : []);
  const handOffField = async (title: string, boardId = board.boardId) => {
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'lexical-gravity-seed', boardId, fieldId: fieldId(title) });
    await settle();
  };
  return { host, panel, board, fieldId, results, handOffField };
}

describe('Build as a lens: the Lightbox handoff (D11)', () => {
  it('hands the Workshop a bounded seed of counted terms, and says where it went', async () => {
    const handOff = answering();
    const { handOffField, results, fieldId, panel } = await boardWithReadings(handOff);
    await handOffField('Ledger');

    expect(handOff).toHaveBeenCalledTimes(1);
    expect(handOff.mock.calls[0][0]).toEqual({
      kind: 'lexical-gravity-seed',
      seed: {
        origin: 'lightbox',
        field: 'Ledger',
        metaphor: 'An idle afternoon weighed like a purchase.',
        // Recounted against the current text, most frequent first; each found once.
        terms: [{ term: 'use', count: 1 }, { term: 'pleasure', count: 1 }, { term: 'worth the trouble', count: 1 }],
        sourceLabel: 'Drafts/alice-1.md'
      }
    });
    expect(results()).toEqual([expect.objectContaining({
      kind: 'lexical-gravity-seed',
      fieldId: fieldId('Ledger'),
      ok: true,
      message: 'Opened “Ledger” in Build lens in the Workshop’s Lexical Gravity. Nothing is built until you press Build there.'
    })]);
    // The log counts; it never carries the field's name or terms.
    expect(panel.logged()).toContain('The Workshop opened a borrowed field: 3 counted terms, 2 of 2 quotes found again');
    expect(panel.logged()).not.toMatch(/Ledger|pleasure|worth the trouble/);
  });

  it('refuses a field once the file on disk has changed, and hands nothing over', async () => {
    const handOff = answering();
    const { host, handOffField, results } = await boardWithReadings(handOff);
    host.addFile('Drafts/alice-1.md', CHAPTER.replace('worth the trouble', 'any use'));
    await handOffField('Ledger');
    expect(handOff).not.toHaveBeenCalled();
    expect(results()).toEqual([expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.fileChanged })]);
  });

  it('refuses a stale field after the chapter is re-read, until the lens is read again', async () => {
    const handOff = answering();
    const { host, panel, results, fieldId } = await boardWithReadings(handOff);
    host.addFile('Drafts/alice-1.md', CHAPTER.replace('Oh dear! Oh dear!', 'Oh dear!'));
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await settle();
    const changed = host.service.currentBoard() as LightboxBoard;
    expect(changed.readings[0].staleLenses?.map((mark) => mark.lens)).toContain('gravity');
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'lexical-gravity-seed', boardId: changed.boardId, fieldId: fieldId('Fire') });
    await settle();
    expect(handOff).not.toHaveBeenCalled();
    expect(results().at(-1)).toMatchObject({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.stale });
  });

  it('refuses a board that is not on screen, a field not on the board, a tile that is not a field, and a malformed request', async () => {
    const handOff = answering();
    const { panel, board, handOffField, results } = await boardWithReadings(handOff);
    await handOffField('Ledger', 'board-old');
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId: 'lbt-withheld' });
    await handOffField('Going down');
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'bring-tile', boardId: board.boardId, fieldId: 'x' });
    await settle();
    expect(handOff).not.toHaveBeenCalled();
    expect(results().map((result) => [result.ok, result.message])).toEqual([
      [false, LIGHTBOX_HANDOFF_REFUSALS.boardChanged],
      [false, LIGHTBOX_HANDOFF_REFUSALS.notOnBoard],
      [false, LIGHTBOX_HANDOFF_REFUSALS.notAField],
      [false, LIGHTBOX_HANDOFF_REFUSALS.unknown]
    ]);
  });

  it('takes one handoff at a time, and hands nothing over once the tab has closed', async () => {
    const handOff = answering();
    const { host, panel, board, fieldId, results } = await boardWithReadings(handOff);
    // Hold the file read the handoff makes, press twice, then close the tab.
    const read = deferred<string>();
    host.addFile('Drafts/alice-1.md', read);
    const request = { kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId: fieldId('Ledger') };
    const first = panel.route(MessageType.LIGHTBOX_HAND_OFF, request);
    await settle();
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, request);
    expect(results()).toEqual([expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.busy })]);

    panel.dispose();
    read.resolve(CHAPTER);
    await first;
    await settle();
    expect(handOff).not.toHaveBeenCalled();
    expect(results()).toHaveLength(1);
    expect(panel.logged()).toContain('Handoff dropped: the Lightbox closed while its file was checked');
    // A closed tab's later press is ignored outright.
    await panel.route(MessageType.LIGHTBOX_HAND_OFF, request);
    expect(results()).toHaveLength(1);
  });

  it('refuses when no Workshop is reachable, or the Workshop does not take it', async () => {
    const without = await boardWithReadings();
    await without.handOffField('Ledger');
    expect(without.results()).toEqual([expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.noWorkshop })]);

    const declined = await boardWithReadings(answering({ opened: false, reason: 'unavailable' }));
    await declined.handOffField('Ledger');
    expect(declined.results()).toEqual([expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.workshopRefused })]);
  });

  it('says "opened" only on the Workshop\'s word, and holds the next press until it answers', async () => {
    const answer = deferred<LightboxWorkshopHandoffOutcome>();
    const handOff = jest.fn((_handoff: LightboxWorkshopHandoff) => answer.promise);
    const { handOffField, results } = await boardWithReadings(handOff);
    const waiting = handOffField('Ledger');
    await settle();
    expect(handOff).toHaveBeenCalledTimes(1);
    expect(results()).toEqual([]);

    await handOffField('Ledger');
    expect(results()).toEqual([expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.busy })]);
    expect(handOff).toHaveBeenCalledTimes(1);

    answer.resolve({ opened: true });
    await waiting;
    expect(results().at(-1)).toMatchObject({ ok: true, message: expect.stringMatching(/^Opened “Ledger”/) });
  });

  it.each<[LightboxWorkshopHandoffRefusal, string]>([
    ['busy', LIGHTBOX_HANDOFF_REFUSALS.workshopBusy],
    ['closed', LIGHTBOX_HANDOFF_REFUSALS.workshopClosed],
    ['replaced', LIGHTBOX_HANDOFF_REFUSALS.workshopReplaced],
    ['timeout', LIGHTBOX_HANDOFF_REFUSALS.workshopSilent]
  ])('reports a Workshop that did not open the field (%s) with its reason, never as sent', async (reason, message) => {
    const { handOffField, results, panel } = await boardWithReadings(answering({ opened: false, reason }));
    await handOffField('Ledger');
    expect(LIGHTBOX_WORKSHOP_REFUSALS[reason]).toBe(message);
    expect(results()).toEqual([expect.objectContaining({ ok: false, message })]);
    expect(panel.logged()).not.toContain('The Workshop opened a borrowed field');
  });

  it('posts nothing when the Workshop answers after the Lightbox closed', async () => {
    const answer = deferred<LightboxWorkshopHandoffOutcome>();
    const { handOffField, results, panel } = await boardWithReadings(jest.fn(() => answer.promise));
    const waiting = handOffField('Ledger');
    await settle();
    panel.dispose();
    answer.resolve({ opened: true });
    await waiting;
    expect(results()).toEqual([]);
    expect(panel.logged()).toContain('Handoff answered after the Lightbox closed; nothing posted');
  });
});
