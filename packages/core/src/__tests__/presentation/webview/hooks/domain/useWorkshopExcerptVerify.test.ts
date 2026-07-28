/**
 * @jest-environment jsdom
 */

/**
 * useWorkshopExcerptVerify — the Workshop panel's paste-to-selection lane
 * (Sprint 12). Provenance is stamped ONLY for an exact selection match;
 * everything else stays honestly unverified.
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkshopExcerptVerify } from '@hooks/domain/useWorkshopExcerptVerify';
import { MessageType, SelectionDataMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const selectionData = (
  payload: Partial<SelectionDataMessage['payload']>
): SelectionDataMessage => ({
  type: MessageType.SELECTION_DATA,
  source: 'extension.ui',
  payload: {
    target: 'workshop_excerpt_verify',
    content: '',
    ...payload
  },
  timestamp: 0
});

describe('useWorkshopExcerptVerify', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests the selection under the workshop verify target', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('She pockets the marked token.'));

    expect(mockVSCode.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.REQUEST_SELECTION,
        payload: { target: 'workshop_excerpt_verify' }
      })
    );
  });

  it('keeps the standard persistence shape while persisting no verification claim', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    expect(result.current.persistedState).toEqual({});
  });

  it('stamps editor-selection provenance with line range on an exact match', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('She pockets the marked token.'));
    act(() => result.current.handleSelectionData(selectionData({
      content: 'She pockets the marked token.',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      startLine: 143,
      endLine: 151
    })));

    expect(result.current.verified).toEqual({
      text: 'She pockets the marked token.',
      source: {
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md',
        startLine: 143,
        endLine: 151
      }
    });
  });

  it('never borrows the active editor for non-matching clipboard text', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('Unrelated clipboard text.'));
    act(() => result.current.handleSelectionData(selectionData({
      content: 'What the editor actually has selected.',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md'
    })));

    expect(result.current.verified).toBeNull();
  });

  it('requires source metadata even when the text matches', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('Matches but sourceless.'));
    act(() => result.current.handleSelectionData(selectionData({
      content: 'Matches but sourceless.'
    })));

    expect(result.current.verified).toBeNull();
  });

  it('ignores selection data for other targets and consumes each claim once', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('The pasted text.'));
    act(() => result.current.handleSelectionData(selectionData({
      target: 'assistant_excerpt_verify',
      content: 'The pasted text.',
      sourceUri: 'file:///a.md',
      relativePath: 'a.md'
    })));
    expect(result.current.verified).toBeNull();

    // Sidebar traffic must not consume the pending claim.
    act(() => result.current.handleSelectionData(selectionData({
      content: 'The pasted text.',
      sourceUri: 'file:///a.md',
      relativePath: 'a.md'
    })));
    expect(result.current.verified?.source).toMatchObject({ kind: 'editor-selection' });

    // A second, unsolicited SELECTION_DATA clears rather than re-verifies.
    act(() => result.current.handleSelectionData(selectionData({
      content: 'The pasted text.',
      sourceUri: 'file:///a.md',
      relativePath: 'a.md'
    })));
    expect(result.current.verified).toBeNull();
  });

  it('clearVerified drops both the claim and any pending request', () => {
    const { result } = renderHook(() => useWorkshopExcerptVerify());

    act(() => result.current.requestVerify('Pending text.'));
    act(() => result.current.clearVerified());
    act(() => result.current.handleSelectionData(selectionData({
      content: 'Pending text.',
      sourceUri: 'file:///a.md',
      relativePath: 'a.md'
    })));

    expect(result.current.verified).toBeNull();
  });
});
