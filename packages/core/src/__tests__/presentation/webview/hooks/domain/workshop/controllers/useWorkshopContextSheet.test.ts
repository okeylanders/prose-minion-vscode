/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopContextSheet,
  UseWorkshopContextSheetOptions
} from '@hooks/domain/workshop/controllers/useWorkshopContextSheet';
import { WorkshopContextAttachmentSnapshot } from '@messages';

const fileAttachment: WorkshopContextAttachmentSnapshot = {
  id: 'ctx-file',
  kind: 'file',
  origin: 'writer',
  label: 'character.md',
  words: 40,
  relativePath: 'notes/character.md',
  addedAt: 1
};

const options = (
  overrides: Partial<UseWorkshopContextSheetOptions> = {}
): UseWorkshopContextSheetOptions => ({
  hasHostConversation: false,
  excerpt: null,
  attachmentContent: null,
  verifiedExcerpt: null,
  shelvedPassageIsUnrecoverable: false,
  clearAttachmentContent: jest.fn(),
  requestContextAttachment: jest.fn(),
  openContextAttachmentFile: jest.fn(),
  pinExcerpt: jest.fn(),
  addContextText: jest.fn(),
  updateContextText: jest.fn(),
  openExcerptSelector: jest.fn(),
  requestShelfReplacement: jest.fn(),
  ...overrides
});

describe('useWorkshopContextSheet', () => {
  afterEach(() => jest.clearAllMocks());

  it('matches fetched attachment bodies to the sheet that requested them', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));

    act(() => result.current.openAttachmentSheet(fileAttachment));
    expect(props.requestContextAttachment).toHaveBeenCalledWith('ctx-file');
    expect(result.current.textSheet).toMatchObject({ attachmentId: 'ctx-file' });

    props.attachmentContent = {
      id: 'ctx-stale',
      content: 'Wrong body',
      canOpenInEditor: true
    };
    rerender();
    expect(result.current.sheetAttachment).toBeUndefined();

    props.attachmentContent = {
      id: 'ctx-file',
      content: 'Right body',
      canOpenInEditor: true
    };
    rerender();
    expect(result.current.sheetAttachment?.content).toBe('Right body');

    act(() => result.current.closeTextSheet());
    expect(props.clearAttachmentContent).toHaveBeenCalledTimes(1);
    expect(result.current.textSheet).toBeNull();
  });

  it('preserves verified excerpt provenance only for the exact applied text', () => {
    const source = {
      kind: 'editor-selection' as const,
      sourceUri: 'file:///draft.md',
      relativePath: 'draft.md',
      startLine: 2,
      endLine: 3
    };
    const props = options({
      verifiedExcerpt: { text: 'Exact passage', source }
    });
    const { result } = renderHook(() => useWorkshopContextSheet(props));

    act(() => result.current.openPasteSheet());
    expect(result.current.verifiedDisplay).toEqual({
      text: 'Exact passage',
      note: 'draft.md'
    });
    act(() => result.current.applyTextSheet('Exact passage'));
    expect(props.pinExcerpt).toHaveBeenCalledWith('Exact passage', source);

    act(() => result.current.openPasteSheet());
    act(() => result.current.applyTextSheet('Edited passage'));
    expect(props.pinExcerpt).toHaveBeenLastCalledWith('Edited passage', undefined);
  });

  it('delegates unrecoverable shelf replacement before opening either excerpt path', () => {
    const props = options({ shelvedPassageIsUnrecoverable: true });
    const { result } = renderHook(() => useWorkshopContextSheet(props));

    act(() => {
      result.current.addExcerptByPaste();
      result.current.addExcerptFromProject();
    });

    expect(props.requestShelfReplacement).toHaveBeenNthCalledWith(1, 'paste');
    expect(props.requestShelfReplacement).toHaveBeenNthCalledWith(2, 'choose');
    expect(result.current.textSheet).toBeNull();
    expect(props.openExcerptSelector).not.toHaveBeenCalled();
  });
});
