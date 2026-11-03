/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopContextSheet,
  UseWorkshopContextSheetOptions
} from '@hooks/domain/workshop/controllers/useWorkshopContextSheet';
import { WorkshopContextAttachmentSnapshot } from '@messages';
import type { ContextSourceEntry } from '@shared/types';

const readInRow = (overrides: Partial<ContextSourceEntry> = {}): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label: 'characters/rabbit.md',
  configuredResource: { group: 'characters', path: 'characters/rabbit.md' },
  sizeChars: 240,
  isEstimate: true,
  deliveredAt: 5_000,
  ...overrides
});

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
  readInContent: null,
  requestReadInResource: jest.fn(),
  openReadInResource: jest.fn(),
  clearReadInContent: jest.fn(),
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

  describe('the Read in reader (Wayfinding Slice 2)', () => {
    const rabbit = { group: 'characters' as const, path: 'characters/rabbit.md' };

    it('opens a read-in row read-only and asks the host for that file', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));

      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));

      expect(props.requestReadInResource).toHaveBeenCalledWith(rabbit);
      expect(result.current.textSheet?.mode).toEqual({
        kind: 'read-in',
        label: 'characters/rabbit.md',
        group: 'characters',
        path: 'characters/rabbit.md',
        participantLabel: 'Jill',
        deliveredAt: 5_000
      });
      expect(result.current.sheetBody).toEqual({
        value: undefined,
        loading: true,
        error: undefined,
        truncated: undefined,
        canOpenInEditor: false
      });
    });

    it('opens nothing for a row with no configured file', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow({ configuredResource: undefined }), 'Jill'));
      act(() => result.current.openReadInSheet(readInRow({ kind: 'dictionary' }), 'Jill'));
      expect(result.current.textSheet).toBeNull();
      expect(props.requestReadInResource).not.toHaveBeenCalled();
    });

    it('shows only the reply for the file on screen, with its truncation and error', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));

      props.readInContent = {
        requestId: 'readin-2',
        group: 'characters',
        path: 'characters/hatter.md',
        content: 'The wrong file.',
        canOpenInEditor: true
      };
      rerender();
      expect(result.current.sheetBody?.loading).toBe(true);
      expect(result.current.sheetBody?.value).toBeUndefined();

      props.readInContent = { requestId: 'readin-1', ...rabbit, content: 'Down the hole.', truncated: true, canOpenInEditor: true };
      rerender();
      expect(result.current.sheetBody).toEqual({
        value: 'Down the hole.',
        loading: false,
        error: undefined,
        truncated: true,
        canOpenInEditor: true
      });

      props.readInContent = { requestId: 'readin-1', ...rabbit, error: 'That file could not be read.', canOpenInEditor: false };
      rerender();
      expect(result.current.sheetBody).toMatchObject({ loading: false, error: 'That file could not be read.' });
    });

    it('opens the file beside through the reader transport, never as an attachment', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));
      act(() => result.current.openAttachmentInEditor());
      expect(props.openReadInResource).toHaveBeenCalledWith(rabbit);
      expect(props.openContextAttachmentFile).not.toHaveBeenCalled();
    });

    it('applies nothing, and clears the reader on close', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));
      act(() => result.current.applyTextSheet('Anything at all'));
      expect(props.addContextText).not.toHaveBeenCalled();
      expect(props.updateContextText).not.toHaveBeenCalled();
      expect(props.pinExcerpt).not.toHaveBeenCalled();
      expect(result.current.textSheet).not.toBeNull();

      act(() => result.current.closeTextSheet());
      expect(props.clearReadInContent).toHaveBeenCalledTimes(1);
      expect(result.current.textSheet).toBeNull();
      expect(result.current.sheetBody).toBeUndefined();
    });
  });
});
