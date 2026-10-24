/**
 * The lens views of Slice 4J, pure: a reading kept while its call reads it
 * again, a reading kept by a call that did not replace it (decision 49),
 * and a call that did not land said once, in its note, each lens pointing
 * there (decision 52). The readings are the worked examples' (Alice, public
 * domain).
 */
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { LIGHTBOX_CEILING_CUT_REASON, LIGHTBOX_CEILING_UNREACHED_REASON } from '@shared/constants/lightboxCallNotes';
import {
  lightboxCallNoteOf,
  lightboxCallNotes,
  lightboxCallPointer,
  lightboxPointsToCallNote
} from '@hooks/domain/lightbox/lightboxCallNotes';
import { lightboxLensView, lightboxOwnWithheldBlocks } from '@hooks/domain/lightbox/lightboxReadings';
import { buildLightboxRunLine } from '@hooks/domain/lightbox/lightboxRunLine';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const FAILED = 'The reading came back unusable (x). Complete response saved for recovery at /r/a.txt. Press Finish or Analyze to try again.';
const read = makeReadBoard();
const a = read.readings.find((group) => group.group === 'A') as LightboxReadingGroup;
const withA = (group: LightboxReadingGroup): LightboxBoard => ({ ...read, readings: read.readings.map((entry) => (entry.group === 'A' ? group : entry)) });

describe('a lens view over an earlier reading (decision 49)', () => {
  it('shows a lens read again as read, re-analyzing, its tiles kept; one with none as reading', () => {
    const running = withA({ ...a, status: 'running', pending: ['motif'] });
    expect(lightboxLensView(running, 'motif')).toMatchObject({ phase: 'ok', reanalyzing: true });
    expect(lightboxLensView(running, 'motif').tiles.length).toBeGreaterThan(0);
    expect(lightboxLensView(running, 'headline')).toMatchObject({ phase: 'ok', reanalyzing: false });
    const first = withA({ ...emptyLightboxReadingGroup('A'), status: 'running', pending: ['motif'] });
    expect(lightboxLensView(first, 'motif')).toMatchObject({ phase: 'reading', reanalyzing: false });
  });

  it('says an earlier reading is one, with the reason, in a call that landed and in one that failed', () => {
    const reason = 'The motifs block names no friction; every lens must say where it strains.';
    expect(lightboxLensView(withA({ ...a, earlierLenses: [{ lens: 'motif', reason }] }), 'motif')).toMatchObject({ phase: 'ok', earlier: reason });
    const failed = withA({ ...a, status: 'failed', error: FAILED, earlierLenses: a.lenses.map((lens) => ({ lens, reason: FAILED })) });
    const view = lightboxLensView(failed, 'motif');
    expect(view).toMatchObject({ phase: 'ok', earlier: FAILED });
    expect(view.notice).toBeUndefined();
    // While read again, it is not yet said to be kept: the live note is.
    expect(lightboxLensView({ ...failed, readings: failed.readings.map((group) => (group.group === 'A' ? { ...group, status: 'running', pending: ['motif'] } : group)) }, 'motif').earlier)
      .toBeUndefined();
  });

  it('ignores an earlier mark on a lens with no reading left', () => {
    const empty = withA({ ...a, tiles: a.tiles.filter((tile) => tile.lens !== 'motif'), earlierLenses: [{ lens: 'motif', reason: 'x' }] });
    expect(lightboxLensView(empty, 'motif').earlier).toBeUndefined();
  });
});

describe('a call that did not land, said once (decision 52)', () => {
  it('notes a failed or stopped call by its error, and none for a call being read or landed', () => {
    expect(lightboxCallNoteOf({ ...emptyLightboxReadingGroup('B'), status: 'failed', error: FAILED })).toEqual({
      groups: ['B'], kind: 'failed', label: 'Call B · failed', message: FAILED, id: 'pm-lb-call-note-B'
    });
    expect(lightboxCallNoteOf({ ...emptyLightboxReadingGroup('B'), status: 'cancelled', error: 'Stopped.' })).toMatchObject({ kind: 'stopped', label: 'Call B · stopped' });
    expect(lightboxCallNoteOf(a)).toBeUndefined();
    expect(lightboxCallNoteOf({ ...a, status: 'running', pending: ['motif'], earlierLenses: [{ lens: 'motif', reason: FAILED }] })).toBeUndefined();
  });

  it('gathers calls that did not land in the same words into one note, each widget naming its own call', () => {
    const stopped = (id: 'A' | 'B' | 'C'): LightboxReadingGroup => ({ ...emptyLightboxReadingGroup(id), status: 'cancelled', error: 'Stopped before this group came back.' });
    const board: LightboxBoard = { ...read, readings: read.readings.map((group) => (['A', 'C'].includes(group.group) ? stopped(group.group as 'A' | 'C') : group)) };
    expect(lightboxCallNotes(board)).toEqual([{
      groups: ['A', 'C'], kind: 'stopped', label: 'Calls A, C · stopped', message: 'Stopped before this group came back.', id: 'pm-lb-call-note-A'
    }]);
    const note = lightboxLensView(board, 'genre').callNote as NonNullable<ReturnType<typeof lightboxLensView>['callNote']>;
    expect(note.id).toBe('pm-lb-call-note-A');
    expect(lightboxCallPointer('C', note, false).lead).toBe('Call C was stopped: ');
  });

  it('notes a cut-off call by the block it was cut inside, else the first it never reached', () => {
    const cut = `${LIGHTBOX_CEILING_CUT_REASON} Complete response saved for recovery at /r/c.txt.`;
    const unreached = `${LIGHTBOX_CEILING_UNREACHED_REASON} Complete response saved for recovery at /r/c.txt.`;
    const c: LightboxReadingGroup = {
      ...emptyLightboxReadingGroup('C'), status: 'ok', lenses: ['genre', 'lineage', 'spark'],
      withheldBlocks: [{ kind: 'spark', lens: 'spark', reason: unreached }],
      earlierLenses: [{ lens: 'lineage', reason: cut }]
    };
    expect(lightboxCallNoteOf(c)).toMatchObject({ kind: 'cut-off', label: 'Call C · cut off', message: cut });
    expect(lightboxCallNoteOf({ ...c, earlierLenses: undefined })).toMatchObject({ message: unreached });
    expect(lightboxPointsToCallNote(lightboxCallNoteOf(c), unreached)).toBe(true);
    expect(lightboxPointsToCallNote(lightboxCallNoteOf(c), 'The spark block broke the format: x.')).toBe(false);
  });

  it('points a lens to the note when what it shows is the note\'s message, and words its short line', () => {
    const failed = withA({ ...emptyLightboxReadingGroup('A'), status: 'failed', error: FAILED });
    const view = lightboxLensView(failed, 'motif');
    expect(view.callNote?.id).toBe('pm-lb-call-note-A');
    expect(lightboxCallNotes(failed).map((note) => note.groups)).toEqual([['A']]);
    expect(lightboxCallPointer('A', view.callNote as NonNullable<typeof view.callNote>, false))
      .toEqual({ lead: 'Call A failed: ', link: 'see its note', after: ' by the run line. Analyze to try again.' });
    expect(lightboxCallPointer('A', view.callNote as NonNullable<typeof view.callNote>, true))
      .toEqual({ lead: 'this call failed: ', link: 'see its note', after: ' by the run line.' });
  });

  it('keeps a lens\'s own withheld block, and the cut its call notes once, apart', () => {
    const cut = `${LIGHTBOX_CEILING_CUT_REASON} Saved at /r/c.txt.`;
    const own = { kind: 'motif' as const, lens: 'motif' as const, reason: 'The motifs block broke the format: items.' };
    const board = withA({ ...a, tiles: a.tiles.filter((tile) => tile.lens !== 'motif' && tile.lens !== 'tension'), withheldBlocks: [own, { kind: 'tension-arc', lens: 'tension', reason: cut }] });
    expect(lightboxLensView(board, 'tension').callNote?.kind).toBe('cut-off');
    expect(lightboxOwnWithheldBlocks(lightboxLensView(board, 'tension'))).toEqual([]);
    expect(lightboxLensView(board, 'motif').callNote).toBeUndefined();
    expect(lightboxOwnWithheldBlocks(lightboxLensView(board, 'motif'))).toEqual([own]);
  });

  it('a reason an older call left, with no note now, is the lens\'s own', () => {
    const board = withA({ ...a, earlierLenses: [{ lens: 'motif', reason: FAILED }] });
    expect(lightboxCallNotes(board)).toEqual([]);
    expect(lightboxLensView(board, 'motif')).toMatchObject({ earlier: FAILED });
    expect(lightboxLensView(board, 'motif').callNote).toBeUndefined();
  });
});

describe('the run line counts the earlier readings kept', () => {
  it('beside the quotes and calls', () => {
    const board = withA({ ...a, status: 'failed', error: FAILED, earlierLenses: a.lenses.map((lens) => ({ lens, reason: FAILED })) });
    const withEstimate = buildLightboxRunLine({
      board,
      estimate: {
        boardId: read.boardId, key: 'k', model: 'provider/model-v1', contextLength: 200_000,
        groups: [{ group: 'A', lenses: a.lenses, inputTokens: 1, expectedOutputTokens: 1, reservedOutputTokens: 1, fit: 'fits', costUsd: 0.01 }],
        rereads: [], fit: 'fits', costUsd: 0.01, bookSized: false, sourceWords: 1, contextWords: 0
      },
      awaitingStart: false,
      providerPaused: false
    });
    expect(withEstimate.note).toContain(`${a.lenses.length} earlier readings kept`);
    expect(withEstimate.action?.label).toBe('Finish');
  });
});
