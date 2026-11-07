/** @jest-environment jsdom */

/**
 * The helper drafts only from the note the sheet holds (PR #231 F-01), with
 * the real memory hook, the real draft handler and a scripted room's own
 * webview snapshot (Astra's probes, as regressions of the corrected
 * behavior):
 *
 * - **A capability card's bubble** (Save to memory…, and an in-window
 *   Remember this) holds its evidence, which the helper never reads, so the
 *   sheet asks for nothing and shows nothing. A request for it anyway is
 *   answered `withheld`, with no model call, and renders as silence.
 * - **Outside the window**, the sheet holds the host's preview, the same
 *   safe projection the helper reads: it drafts, and the helper's input is
 *   the sheet's body.
 * - **Writer and reply bubbles** hold what their projection holds: they
 *   draft, the helper's input the sheet's body.
 *
 * *Alice*, made-up text.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopProjectMemory } from '@hooks/domain/workshop/useWorkshopProjectMemory';
import { WorkshopMemoryDraftHandler } from '@handlers/domain/workshop/WorkshopMemoryDraftHandler';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { MessageType, type WorkshopMemoryDraftResultPayload, type WorkshopTurn } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const DRAFT = { title: 'Alice counts the cups', summary: 'Alice counts the cups at the tea party.', kind: 'canon' as const };

type Posted = { type: MessageType; payload: Record<string, unknown> };

function setup() {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Check the cups.', { capabilityRounds: 1, reply: 'Alice counts the cups.' });
  // The webview's own snapshot, not a view of the host ledger.
  const turns = room.session.getSnapshot().turns;
  const card = turns.find((turn) => turn.capability)!;
  const reply = [...turns].reverse().find((turn) => turn.role === 'assistant' && !turn.capability)!;
  const writer = turns.find((turn) => turn.role === 'user' && turn.kind === 'message')!;
  const vscode = createMockVSCode();
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  const hook = renderHook(() => useWorkshopProjectMemory({ roomRevision: room.session.readRoomRevision() }));
  const run = jest.fn(async () => ({ kind: 'drafted' as const, value: DRAFT }));
  const answers: WorkshopMemoryDraftResultPayload[] = [];
  const handler = new WorkshopMemoryDraftHandler(
    { helper: { run }, settings: { get: () => true } as never },
    room.session,
    { savedTurn: jest.fn() as never },
    async (message) => { answers.push((message as { payload: WorkshopMemoryDraftResultPayload }).payload); },
    { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() }
  );
  const requests = () => vscode.postMessage.mock.calls
    .map(([message]: [Posted]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST);
  /** Hand the hook's request to the host and its answer back to the hook. */
  const deliver = async (payload: Record<string, unknown>) => {
    await handler.handleDraftRequest({ type: MessageType.WORKSHOP_MEMORY_DRAFT_REQUEST, source: 'webview.workshop.memory', timestamp: 1, payload } as never);
    const answer = answers[answers.length - 1];
    act(() => hook.result.current.handleMemoryDraftResult({
      type: MessageType.WORKSHOP_MEMORY_DRAFT_RESULT, source: 'extension.workshop', timestamp: 2, payload: answer
    }));
    return answer;
  };
  return { room, card, reply, writer, hook, run, answers, requests, deliver };
}

const helperInput = (run: jest.Mock) => (run.mock.calls[0] as unknown as [string, { text: string }])[1].text;

describe('the helper drafts only from the sheet\'s own note (PR #231 F-01)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it.each(['Save to memory…', 'an in-window Remember this'] as const)(
    'asks for nothing on a capability card\'s %s, and shows nothing', (opening) => {
      const { card, hook, run, requests } = setup();
      act(() => {
        if (opening === 'Save to memory…') {
          hook.result.current.saveTurn(card);
        } else {
          hook.result.current.rememberRoomBookmark({ turnId: card.id, roomRevision: 1, turn: card });
        }
      });
      const sheet = hook.result.current.sheet!;
      expect(requests()).toEqual([]);
      expect(run).not.toHaveBeenCalled();
      expect(sheet.helper).toBeUndefined();
      expect(sheet.helperWithheld).toBe(true);
      // The sheet's own note is untouched: the bubble's text, as before.
      expect(sheet.draft.body).toBe(card.content.trim());
      hook.unmount();
    }
  );

  it('withholds a capability card\'s bubble the host is asked for anyway: no model call, and silence', async () => {
    const { card, hook, run, deliver } = setup();
    act(() => hook.result.current.saveTurn(card));
    // A request the sheet would not send (a forged one): the host still refuses to draft it.
    const forged = 'forged-1';
    const answer = await deliver({ requestId: forged, turnId: card.id, note: 'bubble' });
    expect(answer).toEqual({ requestId: forged, outcome: 'withheld' });
    expect(run).not.toHaveBeenCalled();
    // The sheet, which asked for nothing, changes nothing.
    expect(hook.result.current.sheet?.helper).toBeUndefined();
    hook.unmount();
  });

  it('renders `withheld` as silence, like the setting off: no placeholder, no line', async () => {
    const { reply, hook, requests } = setup();
    act(() => hook.result.current.saveTurn(reply));
    const requestId = requests()[0].payload.requestId as string;
    act(() => hook.result.current.handleMemoryDraftResult({
      type: MessageType.WORKSHOP_MEMORY_DRAFT_RESULT, source: 'extension.workshop', timestamp: 2, payload: { requestId, outcome: 'withheld' }
    }));
    expect(hook.result.current.sheet?.helper?.status).toBe('stopped');
    expect(hook.result.current.sheet?.draft).toMatchObject({ title: '', summary: '' });
    hook.unmount();
  });

  it('drafts a capability card outside the window, where the sheet holds the preview the helper reads', async () => {
    const { room, card, hook, run, requests, deliver } = setup();
    act(() => hook.result.current.rememberRoomBookmark({
      turnId: card.id, roomRevision: room.session.readRoomRevision(), message: workshopTurnPreview(card)!
    }));
    const [request] = requests();
    expect(request.payload).toMatchObject({ note: 'preview' });
    const answer = await deliver(request.payload);
    expect(answer.outcome).toBe('drafted');
    expect(helperInput(run)).toBe(hook.result.current.sheet!.draft.body);
    expect(helperInput(run)).not.toBe(card.content);
    expect(hook.result.current.sheet!.draft).toMatchObject(DRAFT);
    hook.unmount();
  });

  it.each(['writer', 'reply'] as const)('drafts a %s bubble from exactly the sheet\'s body', async (which) => {
    const fixture = setup();
    const turn: WorkshopTurn = which === 'writer' ? fixture.writer : fixture.reply;
    act(() => fixture.hook.result.current.saveTurn(turn));
    const [request] = fixture.requests();
    expect(request.payload).toMatchObject({ note: 'bubble' });
    const answer = await fixture.deliver(request.payload);
    expect(answer.outcome).toBe('drafted');
    expect(helperInput(fixture.run)).toBe(fixture.hook.result.current.sheet!.draft.body);
    fixture.hook.unmount();
  });
});
