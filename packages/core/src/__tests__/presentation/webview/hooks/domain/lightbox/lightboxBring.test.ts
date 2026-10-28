/**
 * "Bring to Workshop" as the webview offers it (Slice 4), pure: Bound only
 * while the Workshop's tray holds the tile, a refusal's reason shown, one
 * handoff at a time, and a staged tile the writer sent or removed in the
 * Workshop offered again.
 */
import type { LightboxHandOffResultPayload } from '@messages';
import {
  LIGHTBOX_BOUND_LABEL,
  LIGHTBOX_BRING_LABEL,
  LIGHTBOX_BRING_SPARK_LABEL,
  lightboxBringRequest,
  lightboxBringView
} from '@hooks/domain/lightbox/lightboxBring';
import { lightboxBuildLensRequest } from '@hooks/domain/lightbox/lightboxHandoff';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const board = makeReadBoard();
const tiles = board.readings.flatMap((group) => group.tiles);
const subtext = tiles.find((tile) => tile.kind === 'subtext')!;
const spark = tiles.find((tile) => tile.kind === 'spark')!;
const answered = (over: Partial<Extract<LightboxHandOffResultPayload, { kind: 'tile' }>>) => ({
  status: 'answered' as const,
  result: { ...lightboxBringRequest(board.boardId, subtext.id), ok: true, message: 'Staged.', ...over }
});

describe('lightboxBringView', () => {
  it('offers Bring, and Bring as a question for a spark', () => {
    expect(lightboxBringView(board, subtext, null, [])).toMatchObject({ label: LIGHTBOX_BRING_LABEL, disabled: false, state: 'ready' });
    expect(lightboxBringView(board, spark, null, []).label).toBe(LIGHTBOX_BRING_SPARK_LABEL);
  });

  it('is Bound only while the tray holds this tile of this board', () => {
    const held = [{ boardId: board.boardId, tileId: subtext.id, label: 'x' }];
    expect(lightboxBringView(board, subtext, null, held)).toMatchObject({ label: LIGHTBOX_BOUND_LABEL, disabled: true, state: 'bound' });
    expect(lightboxBringView(board, subtext, null, [{ ...held[0], boardId: 'board-older' }]).state).toBe('ready');
  });

  it('waits while anything is on its way, and shows only its own answer', () => {
    const sending = { status: 'sending' as const, request: lightboxBringRequest(board.boardId, subtext.id) };
    expect(lightboxBringView(board, subtext, sending, [])).toMatchObject({ disabled: true, state: 'sending' });
    expect(lightboxBringView(board, spark, sending, [])).toMatchObject({ disabled: true, reason: 'Something else is on its way to the Workshop.' });
    const field = { status: 'sending' as const, request: lightboxBuildLensRequest(board.boardId, subtext.id) };
    // A field's handoff with the same id is not this tile's.
    expect(lightboxBringView(board, subtext, field, []).state).toBe('ready');

    expect(lightboxBringView(board, subtext, answered({ ok: false, message: 'Busy.' }), []))
      .toMatchObject({ disabled: false, note: 'Busy.', state: 'refused' });
    expect(lightboxBringView(board, spark, answered({ ok: false, message: 'Busy.' }), []).note).not.toBe('Busy.');
  });

  it('offers a tile again once the Workshop no longer holds it', () => {
    expect(lightboxBringView(board, subtext, answered({ ok: true }), [])).toMatchObject({ disabled: false, state: 'ready' });
    expect(lightboxBringView(board, subtext, answered({ ok: true }), []).note).not.toBe('Staged.');
  });
});
