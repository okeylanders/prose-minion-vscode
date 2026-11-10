/** @jest-environment jsdom */

/**
 * useWorkshopEditOffers (ADR 2026-11-10 D4, U2, U5, U6; epic Slice 3): a
 * press posts ids only, under a minted request id and the room it was shown
 * in; only an answer still waited for, for the room on screen, is taken; a
 * press that left no answer keeps the host's words until the next snapshot;
 * the outcome is announced once; a new room drops everything; nothing
 * persists. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopEditOfferResultPayload } from '@messages';
import { useWorkshopEditOffers, type UseWorkshopEditOffersOptions } from '@hooks/domain/workshop/useWorkshopEditOffers';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const TURN = 'turn-4-assistant-1008';
const CHIP = `${TURN}#fixes`;
const ANSWERED = 'Jill suggested 3 fixes to chapters/down-the-rabbit-hole.md. They are at the end of the conversation.';

const result = (payload: Partial<WorkshopEditOfferResultPayload> & { requestId: string }) => ({
  type: MessageType.WORKSHOP_EDIT_OFFER_RESULT,
  source: 'extension.workshop',
  payload: { roomRevision: 3, turnId: TURN, kind: 'fixes', answer: 'answered', message: ANSWERED, ...payload },
  timestamp: 2
}) as never;

describe('useWorkshopEditOffers', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const presses = () => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; source: string; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_EDIT_OFFER_ACTION);
  const mount = (initial: UseWorkshopEditOffersOptions = { roomKey: 'room:3', roomRevision: 3 }) =>
    renderHook((props: UseWorkshopEditOffersOptions) => useWorkshopEditOffers(props), { initialProps: initial });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('a press posts a minted id, the room, the turn and the kind, and nothing else', () => {
    const { result: hook } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const [sent] = presses();
    expect(sent.payload).toEqual({ requestId: expect.stringMatching(/^ws-edit-offer-/), roomRevision: 3, turnId: TURN, kind: 'fixes' });
    expect(sent.source).toBe('webview.workshop.editOffers');
    expect(hook.current.askingOffers.has(CHIP)).toBe(true);
  });

  it('posts nothing before the first snapshot, and once per chip while its answer is out', () => {
    const { result: hook, rerender } = mount({ roomKey: 'pending' });
    act(() => hook.current.ask(TURN, 'fixes'));
    expect(presses()).toHaveLength(0);

    rerender({ roomKey: 'room:3', roomRevision: 3 });
    act(() => {
      hook.current.ask(TURN, 'fixes');
      hook.current.ask(TURN, 'fixes');
    });
    expect(presses()).toHaveLength(1);
    // The sibling chip is its own request.
    act(() => hook.current.ask(TURN, 'rewrites'));
    expect(presses()).toHaveLength(2);
  });

  it('takes its own answer once: the chip stops asking and the outcome is announced once', () => {
    const { result: hook } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const requestId = presses()[0].payload.requestId as string;

    act(() => hook.current.handleResult(result({ requestId, answerTurnId: 'turn-6', outcome: 'proposed', cards: 1, changes: 3 })));
    expect(hook.current.askingOffers.has(CHIP)).toBe(false);
    expect(hook.current.offerFeedback.has(CHIP)).toBe(false);
    expect(hook.current.announcement).toBe(ANSWERED);
    expect(hook.current.announcementSerial).toBe(1);

    // A duplicate of the same answer says nothing again.
    act(() => hook.current.handleResult(result({ requestId })));
    expect(hook.current.announcementSerial).toBe(1);
  });

  it('ignores an answer it never asked for, another chip\'s, and another room\'s', () => {
    const { result: hook } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const requestId = presses()[0].payload.requestId as string;

    act(() => hook.current.handleResult(result({ requestId: 'someone-else-1' })));
    expect(hook.current.askingOffers.has(CHIP)).toBe(true);
    expect(hook.current.announcement).toBe('');

    // The id is spent by a mismatched answer: neither it nor a repeat is taken.
    act(() => hook.current.handleResult(result({ requestId, roomRevision: 2 })));
    act(() => hook.current.handleResult(result({ requestId })));
    expect(hook.current.announcement).toBe('');
  });

  it('holds a refusal\'s words for its chip until the next snapshot, and announces them', () => {
    const { result: hook } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const requestId = presses()[0].payload.requestId as string;
    const words = 'Wait for the current reply to finish.';

    act(() => hook.current.handleResult(result({ requestId, answer: 'refused', reason: 'run-active', message: words })));
    expect(hook.current.askingOffers.has(CHIP)).toBe(false);
    expect(hook.current.offerFeedback.get(CHIP)).toBe(words);
    expect(hook.current.announcement).toBe(words);

    act(() => hook.current.noteSessionState());
    expect(hook.current.offerFeedback.size).toBe(0);
    // The announcement was said; a snapshot does not say it again.
    expect(hook.current.announcementSerial).toBe(1);
  });

  it('a failed run reads as the chip open again, with the host\'s reason; the next press clears it', () => {
    const { result: hook } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const first = presses()[0].payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId: first, answer: 'failed', reason: 'stopped', message: 'Stopped. Nothing was suggested.' })));
    expect(hook.current.offerFeedback.get(CHIP)).toBe('Stopped. Nothing was suggested.');

    act(() => hook.current.ask(TURN, 'fixes'));
    expect(hook.current.offerFeedback.has(CHIP)).toBe(false);
    expect(presses()).toHaveLength(2);
    expect(presses()[1].payload.requestId).not.toBe(first);
  });

  it('a new room drops what the old one waited on and said, and its late answer is ignored', () => {
    const { result: hook, rerender } = mount();
    act(() => hook.current.ask(TURN, 'fixes'));
    const requestId = presses()[0].payload.requestId as string;

    rerender({ roomKey: 'room:4', roomRevision: 4 });
    expect(hook.current.askingOffers.size).toBe(0);

    act(() => hook.current.handleResult(result({ requestId })));
    act(() => hook.current.handleResult(result({ requestId, roomRevision: 4 })));
    expect(hook.current.announcement).toBe('');
    expect(hook.current.offerFeedback.size).toBe(0);
  });

  it('persists nothing', () => {
    const { result: hook } = mount();
    expect(hook.current.persistedState).toEqual({});
  });
});
