/** @jest-environment jsdom */

/**
 * useWorkshopLocationsProposal (ADR 2026-11-19 D24, D27): Apply posts ids
 * and ticked groups only, under a minted request id and the room it was
 * shown in; only an answer still waited for, for the room on screen, is
 * taken; a refusal's words stay with the card; a new room drops everything;
 * nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopLocationsProposalResultPayload } from '@messages';
import {
  useWorkshopLocationsProposal,
  type UseWorkshopLocationsProposalOptions
} from '@hooks/domain/workshop/useWorkshopLocationsProposal';
import { WORKSHOP_LOCATIONS_RESULT_WORDS } from '@shared/constants/contextPathSuggestionWords';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const TURN = 'turn-4-assistant-1008';

const result = (payload: Partial<WorkshopLocationsProposalResultPayload> & { requestId: string }) => ({
  type: MessageType.WORKSHOP_LOCATIONS_PROPOSAL_RESULT,
  source: 'extension.workshop.locationsProposal',
  payload: { turnId: TURN, outcome: 'done', groups: [], ...payload },
  timestamp: 2
}) as never;

describe('useWorkshopLocationsProposal', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const applies = () => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL);
  const mount = (initial: UseWorkshopLocationsProposalOptions = { roomKey: 'room:3', roomRevision: 3 }) =>
    renderHook((props: UseWorkshopLocationsProposalOptions) => useWorkshopLocationsProposal(props), { initialProps: initial });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('posts a minted id, the room, the turn and the groups, never a pattern, once while its answer is out', () => {
    const { result: hook } = mount();
    act(() => {
      hook.current.apply(TURN, ['characters']);
      hook.current.apply(TURN, ['characters']);
    });
    expect(applies()).toHaveLength(1);
    expect(applies()[0].payload).toEqual({ requestId: expect.stringMatching(/^ws-locations-/), roomRevision: 3, turnId: TURN, groups: ['characters'] });
    expect(hook.current.applying.has(TURN)).toBe(true);
    expect(hook.current.persistedState).toEqual({});
  });

  it('posts nothing before the first snapshot', () => {
    const { result: hook } = mount({ roomKey: 'pending' });
    act(() => hook.current.apply(TURN, []));
    expect(applies()).toHaveLength(0);
  });

  it('takes only its own answer, keeps a refusal\'s words, and a new room drops everything', () => {
    const { result: hook, rerender } = mount();
    act(() => hook.current.apply(TURN, ['characters']));
    const requestId = applies()[0].payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId: 'someone-else', outcome: 'busy' })));
    expect(hook.current.applying.has(TURN)).toBe(true);
    act(() => hook.current.handleResult(result({ requestId, outcome: 'room-changed' })));
    expect(hook.current.applying.has(TURN)).toBe(false);
    expect(hook.current.feedback.get(TURN)).toBe(WORKSHOP_LOCATIONS_RESULT_WORDS['room-changed']);

    act(() => hook.current.apply(TURN, ['characters']));
    const second = applies()[1].payload.requestId as string;
    rerender({ roomKey: 'room:4', roomRevision: 4 });
    expect(hook.current.feedback.size).toBe(0);
    act(() => hook.current.handleResult(result({ requestId: second, outcome: 'answered' })));
    expect(hook.current.feedback.size).toBe(0);
  });
});
