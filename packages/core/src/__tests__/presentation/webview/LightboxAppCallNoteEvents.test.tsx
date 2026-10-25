/** @jest-environment jsdom */

/**
 * The call notes of decision 52, drawn, as PR #170's review asked:
 * - **F-01.** Two cut replies of one call, each kept by its own lens, are
 *   two notes, each holding its own saved reply's place, once. Each widget's
 *   "see its note" brings the focus to its own reply's note, never the
 *   other's. One whole-call cut stays one note.
 * - **N-01.** A lens rerun on its own fails: the message stands once on the
 *   board, in the note, and its siblings say nothing of it. A whole-call
 *   failure still says it once.
 * The host is played by window messages; readings are the worked examples'
 * through the production codec and verifier (Alice, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LightboxBoard, LightboxReadingGroup, LightboxReadingGroupId, LightboxRunEstimate, MessageType } from '@messages';
import { LIGHTBOX_READING_GROUPS, lightboxGroupLenses } from '@shared/constants/lightbox';
import { LIGHTBOX_CUT_BEFORE_REASON, LIGHTBOX_CUT_INSIDE_REASON } from '@shared/constants/lightboxCallNotes';
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

const CALL_1 = '/workspace/prose-minion/recovery/model-responses/lightbox-call-1.response.txt';
const CALL_2 = '/workspace/prose-minion/recovery/model-responses/lightbox-call-2.response.txt';
const saved = (place: string) => `Complete response saved for recovery at ${place}.`;
const FAILED = `The reading came back unusable (the frame could not be read). ${saved(CALL_1)} Press Finish or Analyze to try again.`;

const MOTIFS = 'Motifs · where they recur';
const GRAVITY = 'Lexical gravity · borrowed fields the prose leans on';
const groupOf = (board: LightboxBoard, id: LightboxReadingGroupId) => board.readings.find((group) => group.group === id) as LightboxReadingGroup;
const withA = (board: LightboxBoard, over: Partial<LightboxReadingGroup>): LightboxBoard =>
  ({ ...board, readings: board.readings.map((group) => (group.group === 'A' ? { ...group, ...over } : group)) });
/** How many times `text` stands in the document's visible text. */
const timesShown = (text: string) => (document.body.textContent ?? '').split(text).length - 1;
const describedBy = (element: Element) => (element.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
  .map((id) => document.getElementById(id)?.textContent ?? '');

describe('LightboxApp: each call note is its own call or cut (PR #170)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const show = (board: LightboxBoard) => {
    render(<LightboxApp />);
    fromHost(MessageType.MODEL_DATA, { options: [], selections: { lightbox: 'provider/model-v1' } });
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    const request = posted(MessageType.LIGHTBOX_SET_LENSES).at(-1);
    fromHost(MessageType.LIGHTBOX_RUN_ESTIMATE, { requestId: request?.payload.requestId, estimate: estimate() });
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('F-01: two cut lens reruns keep both places once, and each widget\'s link focuses its own reply\'s note', () => {
    const read = makeReadBoard();
    show(withA(read, {
      earlierLenses: [
        { lens: 'motif', reason: `${LIGHTBOX_CUT_INSIDE_REASON} ${saved(CALL_1)}` },
        { lens: 'tension', reason: `${LIGHTBOX_CUT_INSIDE_REASON} ${saved(CALL_2)}` }
      ]
    }));
    // Both replies' places stand on the board, each once, in its own note.
    expect(timesShown(CALL_1)).toBe(1);
    expect(timesShown(CALL_2)).toBe(1);
    const notes = within(document.querySelector('.pm-lb-call-notes') as HTMLElement).getAllByRole('alert');
    expect(notes.map((note) => note.id)).toEqual(['pm-lb-call-note-A', 'pm-lb-call-note-A-2']);

    // The tension line's link brings the focus to the second reply's note.
    const tension = document.querySelector('.pm-lb-tension-kept') as HTMLElement;
    fireEvent.click(within(tension).getByRole('button', { name: 'see its note: Call A · cut off (Tension arc)' }));
    expect(document.activeElement?.id).toBe('pm-lb-call-note-A-2');
    expect(document.activeElement?.textContent).toContain(CALL_2);
    expect(document.activeElement?.textContent).not.toContain(CALL_1);

    // The Motifs widget's, to the first's; and it is described by that one only.
    const motifs = screen.getByLabelText(MOTIFS);
    fireEvent.click(within(motifs).getByRole('button', { name: 'see its note: Call A · cut off (Theme & motif)' }));
    expect(document.activeElement?.id).toBe('pm-lb-call-note-A');
    expect(document.activeElement?.textContent).toContain(CALL_1);
    expect(describedBy(motifs).some((text) => text.includes(CALL_1))).toBe(true);
    expect(describedBy(motifs).some((text) => text.includes(CALL_2))).toBe(false);
  });

  it('F-01 control: one whole-call cut is one note, its place said once, every widget it touched pointing there', () => {
    const read = makeReadBoard();
    show(withA(read, {
      earlierLenses: [
        { lens: 'motif', reason: `${LIGHTBOX_CUT_INSIDE_REASON} ${saved(CALL_1)}` },
        ...(['tension', 'gravity', 'palette'] as const).map((lens) => ({ lens, reason: `${LIGHTBOX_CUT_BEFORE_REASON} ${saved(CALL_1)}` }))
      ]
    }));
    expect(timesShown(CALL_1)).toBe(1);
    expect(within(document.querySelector('.pm-lb-call-notes') as HTMLElement).getAllByRole('alert').map((note) => note.id)).toEqual(['pm-lb-call-note-A']);
    for (const label of [MOTIFS, GRAVITY, 'Palette']) {
      fireEvent.click(within(screen.getByLabelText(label)).getByRole('button', { name: 'see its note: Call A · cut off' }));
      expect(document.activeElement?.id).toBe('pm-lb-call-note-A');
    }
  });

  it('N-01: a lens rerun on its own fails, and the message stands once on the board; its siblings say nothing of it', () => {
    const read = makeReadBoard();
    show(withA(read, { status: 'failed', error: FAILED, earlierLenses: [{ lens: 'motif', reason: FAILED }] }));
    expect(timesShown(FAILED)).toBe(1);
    expect(screen.getByLabelText(MOTIFS).querySelector('.pm-lb-earlier-note')?.textContent)
      .toBe('Earlier reading · this call failed: see its note by the run line.');
    for (const label of [GRAVITY, 'Palette']) {
      const sibling = screen.getByLabelText(label);
      expect(sibling.querySelector('.pm-lb-earlier-note, .pm-lb-call-line, .pm-lb-reading-notice')).toBeNull();
      expect(sibling.getAttribute('aria-describedby') ?? '').not.toContain('pm-lb-call-note');
    }
    expect(document.querySelector('.pm-lb-tension-kept')).toBeNull();
  });

  it('N-01 control: a whole-call failure still says its message once, every widget pointing to it', () => {
    const read = makeReadBoard();
    const a = groupOf(read, 'A');
    show(withA(read, { status: 'failed', error: FAILED, earlierLenses: a.lenses.map((lens) => ({ lens, reason: FAILED })) }));
    expect(timesShown(FAILED)).toBe(1);
    for (const label of [MOTIFS, GRAVITY, 'Palette']) {
      expect(screen.getByLabelText(label).querySelector('.pm-lb-earlier-note')?.textContent)
        .toBe('Earlier reading · this call failed: see its note by the run line.');
    }
  });
});
