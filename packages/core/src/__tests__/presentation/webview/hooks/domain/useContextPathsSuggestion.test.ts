/**
 * @jest-environment jsdom
 */

/**
 * useContextPathsSuggestion (ADR 2026-11-19 D21, D23, D24): tripartite with
 * empty persistence; every request carries a webview-minted id and only the
 * answer still waited for is taken; Apply sends ids and ticked groups only;
 * a failure is one quiet line. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import {
  MessageType,
  type ContextPathGroupView,
  type ContextPathProposalView,
  type ContextPathsAppliedMessage,
  type ContextPathsAppliedPayload,
  type ContextPathsSuggestionMessage,
  type ContextPathsSuggestionPayload
} from '@shared/types';
import {
  useContextPathsSuggestion,
  type ContextPathsSuggestionActions,
  type ContextPathsSuggestionPersistence,
  type ContextPathsSuggestionState
} from '@hooks/domain/useContextPathsSuggestion';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');
import { useVSCodeApi } from '@hooks/useVSCodeApi';

const row = (group: ContextPathGroupView['group'], offer: ContextPathGroupView['offer']): ContextPathGroupView => ({
  group,
  level: 'user',
  current: { patterns: [`${group}/**/*`], count: 0, examples: [] },
  proposed: { kept: [{ pattern: 'Cast/**/*', count: 3 }], dropped: [], count: 3, examples: ['Cast/Alice.md'], shared: { count: 0, examples: [] } },
  offer
});

const VIEW: ContextPathProposalView = {
  groups: [
    row('characters', { offered: true }),
    row('locations', { offered: false, reason: 'workspace-set' }),
    row('chapters', { offered: true })
  ]
};

describe('useContextPathsSuggestion', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const lastId = (type: MessageType) => posted(type).at(-1)!.payload.requestId as string;
  const suggestion = (payload: ContextPathsSuggestionPayload): ContextPathsSuggestionMessage => ({ type: MessageType.CONTEXT_PATHS_SUGGESTION, source: 'extension.configuration', payload, timestamp: 1 });
  const applied = (payload: ContextPathsAppliedPayload): ContextPathsAppliedMessage => ({ type: MessageType.CONTEXT_PATHS_APPLIED, source: 'extension.configuration', payload, timestamp: 1 });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('keeps the tripartite interfaces explicit and persists nothing', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    const state: ContextPathsSuggestionState = result.current;
    const actions: ContextPathsSuggestionActions = result.current;
    const persistence: ContextPathsSuggestionPersistence = result.current.persistedState;
    expect(state.phase).toBe('idle');
    expect(typeof actions.suggest).toBe('function');
    expect(persistence).toEqual({});
  });

  it('asks with a minted id, takes only its own answer, and ticks every offered group', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    act(() => result.current.suggest());
    expect(result.current.phase).toBe('suggesting');
    const requestId = lastId(MessageType.CONTEXT_PATHS_SUGGEST);
    expect(requestId).toMatch(/^cpw-/);
    act(() => result.current.handleSuggestion(suggestion({ requestId: 'someone-else', outcome: 'proposed', proposalId: 'p0', view: VIEW })));
    expect(result.current.phase).toBe('suggesting');
    act(() => result.current.handleSuggestion(suggestion({ requestId, outcome: 'proposed', proposalId: 'cps-h:1', view: VIEW })));
    expect(result.current.phase).toBe('review');
    expect(result.current.ticked).toEqual(['characters', 'chapters']);
  });

  it('never ticks a group not offered, and sends ids and ticked groups only on Apply', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    act(() => result.current.suggest());
    act(() => result.current.handleSuggestion(suggestion({ requestId: lastId(MessageType.CONTEXT_PATHS_SUGGEST), outcome: 'proposed', proposalId: 'cps-h:1', view: VIEW })));
    act(() => result.current.toggleGroup('locations'));
    act(() => result.current.toggleGroup('chapters'));
    expect(result.current.ticked).toEqual(['characters']);
    act(() => result.current.apply());
    const [message] = posted(MessageType.CONTEXT_PATHS_APPLY);
    expect(message.payload).toEqual({ requestId: expect.stringMatching(/^cpw-/), proposalId: 'cps-h:1', groups: ['characters'] });
    expect(result.current.phase).toBe('applying');
    act(() => result.current.handleApplied(applied({ requestId: message.payload.requestId, outcome: 'done', groups: [{ group: 'characters', outcome: 'applied' }] })));
    expect(result.current.phase).toBe('applied');
    expect(result.current.applied).toEqual([{ group: 'characters', outcome: 'applied' }]);
  });

  it('drops an answer once a newer suggestion or a dismissal stops the wait', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    act(() => result.current.suggest());
    const first = lastId(MessageType.CONTEXT_PATHS_SUGGEST);
    act(() => result.current.suggest());
    act(() => result.current.handleSuggestion(suggestion({ requestId: first, outcome: 'proposed', proposalId: 'old', view: VIEW })));
    expect(result.current.phase).toBe('suggesting');
    const second = lastId(MessageType.CONTEXT_PATHS_SUGGEST);
    act(() => result.current.dismiss());
    act(() => result.current.handleSuggestion(suggestion({ requestId: second, outcome: 'proposed', proposalId: 'new', view: VIEW })));
    expect(result.current.phase).toBe('idle');
  });

  it('leaves one quiet line when nothing comes to review', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    act(() => result.current.suggest());
    act(() => result.current.handleSuggestion(suggestion({ requestId: lastId(MessageType.CONTEXT_PATHS_SUGGEST), outcome: 'failed' })));
    expect(result.current.phase).toBe('idle');
    expect(result.current.note).toBe('The suggestion didn\'t work this time; your context paths are as they were.');
  });

  it('takes its own status answer only', () => {
    const { result } = renderHook(() => useContextPathsSuggestion());
    act(() => result.current.requestStatus());
    const requestId = lastId(MessageType.CONTEXT_PATHS_STATUS_REQUEST);
    act(() => result.current.handleStatus({ type: MessageType.CONTEXT_PATHS_STATUS, source: 'extension.configuration', payload: { requestId: 'other', everyGroupEmpty: true }, timestamp: 1 }));
    expect(result.current.everyGroupEmpty).toBe(false);
    act(() => result.current.handleStatus({ type: MessageType.CONTEXT_PATHS_STATUS, source: 'extension.configuration', payload: { requestId, everyGroupEmpty: true }, timestamp: 1 }));
    expect(result.current.everyGroupEmpty).toBe(true);
  });
});
