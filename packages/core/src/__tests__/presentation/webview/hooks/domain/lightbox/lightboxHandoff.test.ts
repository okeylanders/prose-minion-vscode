/**
 * "Build as a lens" as the webview offers it (ADR 2026-10-19 D11; Slice 3):
 * it names a pinned borrowed field and nothing more, waits for one handoff at
 * a time, takes only the answer to its own request, and is disabled with a
 * reason wherever the host would refuse.
 */
import type { LightboxBoard, LightboxGravityFieldTile, LightboxHandOffResultPayload } from '@messages';
import {
  LIGHTBOX_BUILD_LENS_LABEL,
  lightboxBuildLensRequest,
  lightboxBuildLensView,
  lightboxHandOffAnswers
} from '@hooks/domain/lightbox/lightboxHandoff';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const board = makeReadBoard();
const fields = board.readings[0].tiles.filter((tile): tile is LightboxGravityFieldTile => tile.kind === 'gravity-field');
const [ledger, fire] = fields;
type FieldAnswer = Extract<LightboxHandOffResultPayload, { kind: 'lexical-gravity-seed' }>;
const answer = (over: Partial<Omit<FieldAnswer, 'kind'>> = {}): LightboxHandOffResultPayload => ({
  ...lightboxBuildLensRequest(board.boardId, ledger.id),
  ok: true,
  message: 'Sent.',
  ...over
});

describe('Build as a lens in the webview', () => {
  it('names the field and the board, nothing more', () => {
    expect(lightboxBuildLensRequest(board.boardId, ledger.id)).toEqual({
      kind: 'lexical-gravity-seed', boardId: board.boardId, fieldId: ledger.id
    });
  });

  it('is offered for a current field, says what it does, and shows the host\'s answer for that field only', () => {
    expect(lightboxBuildLensView(board, ledger, null)).toEqual({
      label: LIGHTBOX_BUILD_LENS_LABEL,
      disabled: false,
      note: 'Opens Lexical Gravity in the Workshop with this field as the subject. Nothing is built until you press Build there.'
    });
    const answered = { status: 'answered' as const, result: answer({ ok: false, message: 'Refused.' }) };
    expect(lightboxBuildLensView(board, ledger, answered)).toMatchObject({ disabled: false, note: 'Refused.', outcome: 'refused' });
    expect(lightboxBuildLensView(board, fire, answered).outcome).toBeUndefined();
  });

  it('waits on one handoff at a time, for every field', () => {
    const sending = { status: 'sending' as const, request: lightboxBuildLensRequest(board.boardId, ledger.id) };
    expect(lightboxBuildLensView(board, ledger, sending)).toMatchObject({ disabled: true, reason: 'Opening the Workshop…' });
    expect(lightboxBuildLensView(board, fire, sending)).toMatchObject({
      disabled: true, reason: 'Another field is on its way to the Workshop.'
    });
  });

  it('takes only the answer to the request it is waiting on', () => {
    const sending = { status: 'sending' as const, request: lightboxBuildLensRequest(board.boardId, ledger.id) };
    expect(lightboxHandOffAnswers(sending, answer())).toBe(true);
    expect(lightboxHandOffAnswers(sending, answer({ fieldId: fire.id }))).toBe(false);
    expect(lightboxHandOffAnswers(sending, answer({ boardId: 'board-old' }))).toBe(false);
    expect(lightboxHandOffAnswers(null, answer())).toBe(false);
    expect(lightboxHandOffAnswers({ status: 'answered', result: answer() }, answer())).toBe(false);
  });

  it('is disabled with its reason for a stale field, or one whose lens is being read again', () => {
    const marked = (group: LightboxBoard['readings'][number]) => ({ ...group, staleLenses: [{ lens: 'gravity' as const, readAgainst: 'hash-old' }] });
    const stale: LightboxBoard = { ...board, readings: board.readings.map((group, index) => (index === 0 ? marked(group) : group)) };
    expect(lightboxBuildLensView(stale, ledger, null)).toMatchObject({
      disabled: true,
      reason: 'Read against an earlier version of the chapter. Read the lens again before building it.'
    });
    const rereading: LightboxBoard = {
      ...board,
      readings: board.readings.map((group, index) => (index === 0 ? { ...group, status: 'running' as const, pending: ['gravity' as const] } : group))
    };
    expect(lightboxBuildLensView(rereading, ledger, null)).toMatchObject({ disabled: true, reason: 'This lens is being read again.' });
  });
});
