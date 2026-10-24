/** @jest-environment jsdom */

/**
 * The webview's side of keeping readings until they are replaced (Slice
 * 4J): what the host's board says, drawn.
 * - **Decision 49.** A lens read again keeps its reading on show with
 *   "Analyzing… This is the earlier reading until the new one lands." and no
 *   skeleton; after a call that did not replace it, the quiet "Earlier
 *   reading" label and the reason, the frame described by it. A lens with no
 *   earlier reading shows the skeleton and the failure as before. The
 *   inspector names the model and time of the reading pinned, and says when
 *   it is an earlier one; the run line counts the earlier readings kept.
 * - **Decision 52.** A call that did not land (failed, stopped, cut off) is
 *   said once, in its note under the run line, its whole message there and
 *   nowhere else; each widget of the call says so in a short line that
 *   points to the note, and is described by it.
 * - **Focus.** A widget's focused Analyze keeps the focus through its call's
 *   rerun over earlier readings, the landing, a failure and a stop.
 * The host is played by window messages; readings are the worked examples'
 * through the production codec and verifier (Alice, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LightboxBoard, LightboxLensId, LightboxReadingGroup, LightboxReadingGroupId, LightboxRunEstimate, MessageType } from '@messages';
import { emptyLightboxReadingGroup, LIGHTBOX_READING_GROUPS, lightboxGroupLenses } from '@shared/constants/lightbox';
import { LIGHTBOX_KEEP_WORDS } from '@shared/constants/lightboxProvenance';
import { LIGHTBOX_CEILING_CUT_REASON, LIGHTBOX_CEILING_UNREACHED_REASON } from '@shared/constants/lightboxCallNotes';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/lightbox/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/board.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/ribbon.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/tiles.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/rail.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/inspector.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/readings.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/gravity.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/story.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/craft.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/plot.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/opinion.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/steering.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/boards.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, source: 'extension.lightbox', payload, timestamp: 1 } }));
  });

function estimate(): LightboxRunEstimate {
  const groups = LIGHTBOX_READING_GROUPS.map((group) => ({
    group, lenses: lightboxGroupLenses(group), inputTokens: 3_000, expectedOutputTokens: 900, reservedOutputTokens: 12_000,
    fit: 'fits' as const, costUsd: 0.04, ...(group === 'F' ? { inputBound: 'digest' as const } : {})
  }));
  return {
    boardId: 'board-8', key: 'estimate-board-8', model: 'provider/model-v1', contextLength: 200_000,
    groups, rereads: [], fit: 'fits', costUsd: 0.28, bookSized: false, sourceWords: 260, contextWords: 0
  };
}

const FAILED = 'The reading came back unusable (the frame could not be read). Complete response saved for recovery at ' +
  '/workspace/prose-minion/recovery/model-responses/lightbox-2026-10-24.response.txt. Press Finish or Analyze to try again.';
const STOPPED = 'Stopped before this group came back.';
const SAVED = 'Complete response saved for recovery at /workspace/prose-minion/recovery/model-responses/lightbox-c.response.txt.';

const groupOf = (board: LightboxBoard, id: LightboxReadingGroupId) => board.readings.find((group) => group.group === id) as LightboxReadingGroup;
const withGroup = (board: LightboxBoard, group: LightboxReadingGroup): LightboxBoard =>
  ({ ...board, readings: board.readings.map((entry) => (entry.group === group.group ? group : entry)) });
/** Every lens of `id` read again, its earlier readings still on the board. */
const reanalyzing = (board: LightboxBoard, id: LightboxReadingGroupId) =>
  withGroup(board, { ...groupOf(board, id), status: 'running', pending: groupOf(board, id).lenses });
/** `id`'s call failed or was stopped, every lens with a reading kept, marked earlier with `error`. */
const kept = (board: LightboxBoard, id: LightboxReadingGroupId, status: 'failed' | 'cancelled', error: string) => {
  const group = groupOf(board, id);
  return withGroup(board, { ...group, status, error, earlierLenses: group.lenses.map((lens) => ({ lens, reason: error })) });
};
/** `id`'s first call failed or was stopped, nothing to keep. */
const firstFailed = (board: LightboxBoard, id: LightboxReadingGroupId, status: 'failed' | 'cancelled', error: string) =>
  withGroup(board, { ...emptyLightboxReadingGroup(id), status, error });

const MOTIFS = 'Motifs · where they recur';
const CHARACTERS = 'Characters · the vibes they give';
const SUBTEXT = 'Subtext · said and meant';
const LINEAGE = 'Lineage · adjacent stories';
const GRAVITY = 'Lexical gravity · borrowed fields the prose leans on';
const frame = (label: string) => screen.getByLabelText(label);
const analyzeOf = (element: HTMLElement) => element.querySelector('.pm-lb-call-button') as HTMLButtonElement;
const describedBy = (element: Element) => (element.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
  .map((id) => document.getElementById(id)?.textContent);
/** How many times `text` stands in the document's visible text. */
const timesShown = (text: string) => (document.body.textContent ?? '').split(text).length - 1;

describe('LightboxApp: readings kept until replaced (Slice 4J)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const estimateFromHost = () => {
    const request = posted(MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate: estimate() });
  };
  const show = (board: LightboxBoard) => {
    render(<LightboxApp />);
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { assistant: 'provider/model-v1' } });
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    estimateFromHost();
  };
  const board = (next: LightboxBoard) => fromHost(MessageType.LIGHTBOX_BOARD, { board: next, refusal: null });
  const progress = (token: string, phase: 'started' | 'finished' | 'cancelled', groups: LightboxReadingGroupId[], groupsBack = 0) =>
    fromHost(MessageType.LIGHTBOX_RUN_PROGRESS, { boardId: 'board-8', token, phase, groups, groupsBack, outputCharacters: 0 });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  describe('while a call reads again (decision 49)', () => {
    it('keeps every widget\'s earlier reading on show, said to be the earlier one, never a skeleton', () => {
      const read = makeReadBoard();
      show(read);
      board(reanalyzing(read, 'A'));
      const motifs = frame(MOTIFS);
      expect(within(motifs).getByRole('button', { name: /Going down/ })).not.toBeNull();
      expect(within(motifs).getByRole('status').textContent).toBe(LIGHTBOX_KEEP_WORDS.reading);
      expect(motifs.querySelector('.pm-lb-skeleton')).toBeNull();
      expect(describedBy(motifs)).toEqual([LIGHTBOX_KEEP_WORDS.reading]);
      expect(analyzeOf(motifs).textContent).toBe('Analyzing…');
      expect(analyzeOf(motifs).getAttribute('aria-disabled')).toBe('true');
      // The headline and the tension line keep theirs too.
      expect(screen.getByRole('heading', { name: /A bored girl follows a hurried white rabbit/ })).not.toBeNull();
      expect(within(document.querySelector('.pm-lb-headline-state') as HTMLElement).getByText(LIGHTBOX_KEEP_WORDS.reading)).not.toBeNull();
      expect(screen.getByText(/^Tension, as read:/)).not.toBeNull();
      expect(document.querySelector('.pm-lb-earlier-badge')?.textContent).toBe('earlier');
      // A call with nothing to keep shows the skeleton as before.
      board(withGroup(reanalyzing(read, 'A'), { ...emptyLightboxReadingGroup('B'), status: 'running', pending: ['characters', 'voice', 'subtext'] }));
      expect(frame(CHARACTERS).querySelector('.pm-lb-skeleton.is-live')).not.toBeNull();
      expect(frame(CHARACTERS).textContent).not.toContain(LIGHTBOX_KEEP_WORDS.reading);
    });

    it('keeps the earlier sparks in the Spark lane while call C reads again', () => {
      const read = makeReadBoard();
      show(read);
      const sparks = within(frame('Spark lane')).getAllByRole('button', { name: /Not for me/ }).length;
      board(reanalyzing(read, 'C'));
      expect(within(frame('Spark lane')).getAllByRole('button', { name: /Not for me/ })).toHaveLength(sparks);
      expect(within(frame('Spark lane')).getByRole('status').textContent).toBe(LIGHTBOX_KEEP_WORDS.reading);
    });
  });

  describe('after a call that did not replace them (decisions 49 and 52)', () => {
    it('keeps each earlier reading under the quiet label, its call\'s whole message said once, in its note under the run line', () => {
      const read = makeReadBoard();
      show(read);
      board(kept(read, 'A', 'failed', FAILED));
      const notes = document.querySelector('.pm-lb-call-notes') as HTMLElement;
      expect(within(notes).getByRole('alert').textContent).toBe(`Call A · failed ${FAILED}`);
      // The message, path and all, stands once on the board.
      expect(timesShown(FAILED)).toBe(1);
      const motifs = frame(MOTIFS);
      expect(within(motifs).getByRole('button', { name: /Going down/ })).not.toBeNull();
      const note = motifs.querySelector('.pm-lb-earlier-note') as HTMLElement;
      expect(note.textContent).toBe('Earlier reading · this call failed: see its note by the run line.');
      expect(describedBy(motifs)).toEqual([note.textContent, `Call A · failed ${FAILED}`]);
      expect(analyzeOf(motifs).textContent).toContain('Re-analyze');
      // Every widget of call A points there: the headline and the tension line too.
      for (const label of [GRAVITY, 'Palette']) {
        expect(frame(label).querySelector('.pm-lb-earlier-note')?.textContent).toBe(note.textContent);
      }
      expect(document.querySelector('.pm-lb-headline-state .pm-lb-earlier-note')?.textContent).toBe(note.textContent);
      expect(document.querySelector('.pm-lb-tension-kept .pm-lb-earlier-note')?.textContent).toBe(note.textContent);
      // "see its note" brings the writer there.
      fireEvent.click(within(note).getByRole('button', { name: 'see its note: Call A · failed' }));
      expect(document.activeElement).toBe(within(notes).getByRole('alert'));
      // The run line counts them.
      expect(screen.getByText(/5 earlier readings kept/)).not.toBeNull();
    });

    it('shows a call with no earlier readings the same way: one note, and a short line in each widget', () => {
      const read = makeReadBoard();
      show(withGroup(read, emptyLightboxReadingGroup('B')));
      board(firstFailed(read, 'B', 'failed', FAILED));
      expect(timesShown(FAILED)).toBe(1);
      for (const label of [CHARACTERS, 'Voice', SUBTEXT]) {
        const widget = frame(label);
        expect(widget.querySelector('.pm-lb-call-line')?.textContent).toBe('Call B failed: see its note by the run line. Analyze to try again.');
        expect(describedBy(widget)).toEqual(['Call B failed: see its note by the run line. Analyze to try again.', `Call B · failed ${FAILED}`]);
        expect(within(widget).queryByRole('alert')).toBeNull();
      }
    });

    it('treats a stopped call the same way, as a status, not an alert', () => {
      const read = makeReadBoard();
      show(read);
      board(kept(firstFailed(read, 'B', 'cancelled', STOPPED), 'A', 'cancelled', STOPPED));
      const notes = document.querySelector('.pm-lb-call-notes') as HTMLElement;
      expect(within(notes).getAllByRole('status').map((entry) => entry.textContent)).toEqual([`Call A · stopped ${STOPPED}`, `Call B · stopped ${STOPPED}`]);
      expect(within(notes).queryByRole('alert')).toBeNull();
      expect(frame(MOTIFS).querySelector('.pm-lb-earlier-note')?.textContent).toBe('Earlier reading · this call was stopped: see its note by the run line.');
      expect(frame('Voice').querySelector('.pm-lb-call-line')?.textContent).toBe('Call B was stopped: see its note by the run line. Analyze to try again.');
      expect(timesShown(STOPPED)).toBe(2);
    });

    it('treats a cut-off call the same way: the cut said once, the lenses it touched pointing to it, one it finished replaced', () => {
      const read = makeReadBoard();
      const c = groupOf(read, 'C');
      show(withGroup(read, { ...c, tiles: c.tiles.filter((tile) => tile.lens === 'genre'), lenses: ['genre'] }));
      const cut = `${LIGHTBOX_CEILING_CUT_REASON} ${SAVED}`;
      board(withGroup(read, {
        ...c,
        tiles: c.tiles.filter((tile) => tile.lens !== 'spark'),
        withheldBlocks: [{ kind: 'spark', lens: 'spark', reason: `${LIGHTBOX_CEILING_UNREACHED_REASON} ${SAVED}` }],
        earlierLenses: [{ lens: 'lineage', reason: cut }]
      }));
      expect(document.querySelector('.pm-lb-call-notes')?.textContent).toBe(`Call C · cut off ${cut}`);
      expect(timesShown(SAVED)).toBe(1);
      expect(frame(LINEAGE).querySelector('.pm-lb-earlier-note')?.textContent).toBe('Earlier reading · this call was cut off: see its note by the run line.');
      expect(frame('Spark lane').querySelector('.pm-lb-call-line')?.textContent)
        .toBe('Call C was cut off at the output ceiling: see its note by the run line. Analyze to try again.');
      expect(frame('Spark lane').querySelector('.pm-lb-withheld-block')).toBeNull();
      expect(frame('Genre neighborhood').querySelector('.pm-lb-earlier-note')).toBeNull();
    });

    it('says a reason that is no call\'s note in the widget itself: a block withheld for its own fault', () => {
      const read = makeReadBoard();
      show(read);
      const reason = 'The motifs block names no friction; every lens must say where it strains.';
      board(withGroup(read, { ...groupOf(read, 'A'), earlierLenses: [{ lens: 'motif', reason }] }));
      expect(document.querySelector('.pm-lb-call-notes')).toBeNull();
      expect(frame(MOTIFS).querySelector('.pm-lb-earlier-note')?.textContent).toBe(`Earlier reading ${LIGHTBOX_KEEP_WORDS.kept} ${reason}`);
      expect(screen.getByText(/1 earlier reading kept/)).not.toBeNull();
    });
  });

  describe('the inspector', () => {
    it('names the model and time of the reading pinned, and says when it is an earlier one', () => {
      const read = makeReadBoard();
      const a = groupOf(read, 'A');
      const provenance = a.lenses.map((lens: LightboxLensId) => ({ lens, run: 'run-1-token', model: 'provider/model-v1', at: '2026-10-24T09:08:00.000Z' }));
      show(withGroup(read, { ...a, provenance }));
      fireEvent.click(screen.getByRole('button', { name: /Going down/ }));
      const inspector = screen.getByLabelText('Inspector');
      const line = inspector.querySelector('.pm-lb-inspector-provenance')?.textContent ?? '';
      expect(line).toMatch(/^Read by model-v1 · Oct 24, 2026, \d{1,2}:\d{2} [AP]M$/);
      expect(inspector.querySelector('.pm-lb-earlier-note')).toBeNull();
      // Kept by a failed call: the inspector points to the call's note too, so the message still stands once.
      board(kept(withGroup(read, { ...a, provenance }), 'A', 'failed', FAILED));
      expect(screen.getByLabelText('Inspector').querySelector('.pm-lb-earlier-note')?.textContent)
        .toBe('Earlier reading · this call failed: see its note by the run line.');
      expect(timesShown(FAILED)).toBe(1);
      // Kept for a reason of its own: said there.
      const reason = 'The motifs block names no friction; every lens must say where it strains.';
      board(withGroup(read, { ...a, provenance, earlierLenses: [{ lens: 'motif', reason }] }));
      expect(screen.getByLabelText('Inspector').querySelector('.pm-lb-earlier-note')?.textContent)
        .toBe(`Earlier reading ${LIGHTBOX_KEEP_WORDS.kept} ${reason}`);
      board(reanalyzing(withGroup(read, { ...a, provenance }), 'A'));
      expect(within(screen.getByLabelText('Inspector')).getByText(LIGHTBOX_KEEP_WORDS.reading)).not.toBeNull();
    });
  });

  describe('a widget\'s Analyze keeps the focus through its call\'s rerun over earlier readings', () => {
    it('through the start, the landing, a failure and a stop', () => {
      const read = makeReadBoard();
      show(read);
      const button = analyzeOf(frame(MOTIFS));
      expect(button.getAttribute('aria-label')).toMatch(/^Re-analyze, call A:/);
      button.focus();
      fireEvent.click(button);
      expect(posted(MessageType.LIGHTBOX_RUN).at(-1)?.payload).toMatchObject({ scope: { mode: 'group', group: 'A', lens: 'motif' } });

      progress('run-2', 'started', ['A']);
      board(reanalyzing(read, 'A'));
      expect(analyzeOf(frame(MOTIFS))).toBe(button);
      expect(document.activeElement).toBe(button);
      expect(button.textContent).toBe('Analyzing…');

      board(read);
      progress('run-2', 'finished', ['A'], 1);
      estimateFromHost();
      expect(document.activeElement).toBe(button);
      expect(button.getAttribute('aria-label')).toMatch(/^Re-analyze, call A:/);

      fireEvent.click(button);
      progress('run-3', 'started', ['A']);
      board(reanalyzing(read, 'A'));
      board(kept(read, 'A', 'failed', FAILED));
      progress('run-3', 'finished', ['A'], 1);
      estimateFromHost();
      expect(analyzeOf(frame(MOTIFS))).toBe(button);
      expect(document.activeElement).toBe(button);
      // It still has a reading, so it reads again.
      expect(button.getAttribute('aria-label')).toMatch(/^Re-analyze, call A:/);

      fireEvent.click(button);
      progress('run-4', 'started', ['A']);
      board(reanalyzing(kept(read, 'A', 'failed', FAILED), 'A'));
      board(kept(read, 'A', 'cancelled', STOPPED));
      progress('run-4', 'cancelled', ['A']);
      expect(analyzeOf(frame(MOTIFS))).toBe(button);
      expect(document.activeElement).toBe(button);
    });
  });
});
