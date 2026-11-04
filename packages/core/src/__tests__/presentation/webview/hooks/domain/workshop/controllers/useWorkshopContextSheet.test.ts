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
  readInScopeKey: 'room:1\u0000jill',
  turnPreview: null,
  requestTurnPreview: jest.fn(() => 'ws-preview-1'),
  clearTurnPreview: jest.fn(),
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

      // The delivery time names the row, so the host answers from its reading.
      expect(props.requestReadInResource).toHaveBeenCalledWith({ ...rabbit, deliveredAt: 5_000 });
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
        canOpenInEditor: false,
        lineRange: undefined,
        changedSinceRead: undefined
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
        deliveredAt: 5_000,
        content: 'The wrong file.',
        canOpenInEditor: true
      };
      rerender();
      expect(result.current.sheetBody?.loading).toBe(true);
      expect(result.current.sheetBody?.value).toBeUndefined();

      props.readInContent = {
        requestId: 'readin-1', ...rabbit, deliveredAt: 5_000, content: 'Down the hole.', truncated: true, canOpenInEditor: true
      };
      rerender();
      expect(result.current.sheetBody).toEqual({
        value: 'Down the hole.',
        loading: false,
        error: undefined,
        truncated: true,
        canOpenInEditor: true,
        lineRange: undefined,
        changedSinceRead: undefined
      });

      props.readInContent = {
        requestId: 'readin-1', ...rabbit, deliveredAt: 5_000, error: 'That file could not be read.', canOpenInEditor: false
      };
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

    it('closes the reader and drops its request when the room or chat target changes', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));

      props.readInScopeKey = 'room:1\u0000cliff';
      rerender();
      expect(result.current.textSheet).toBeNull();
      expect(props.clearReadInContent).toHaveBeenCalledTimes(1);

      act(() => result.current.openReadInSheet(readInRow(), 'Cliff'));
      props.readInScopeKey = 'room:2\u0000cliff';
      rerender();
      expect(result.current.textSheet).toBeNull();
      expect(props.clearReadInContent).toHaveBeenCalledTimes(2);
    });

    it('leaves another sheet open when the scope changes', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openAddTextSheet());
      props.readInScopeKey = 'room:2\u0000jill';
      rerender();
      expect(result.current.textSheet?.mode).toEqual({ kind: 'context-new' });
    });

    it('gives each reader request its own sheet key, and every authoring mode one shared key (PR #186 F-02)', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));

      act(() => result.current.openAddTextSheet());
      expect(result.current.sheetKey).toBe('sheet');
      act(() => result.current.openPasteSheet());
      expect(result.current.sheetKey).toBe('sheet');

      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));
      props.readInContent = { requestId: 'readin-1', ...rabbit, deliveredAt: 5_000, canOpenInEditor: false };
      rerender();
      const first = result.current.sheetKey;
      expect(first).toBe('read-in:readin-1');

      act(() => result.current.openReadInSheet(readInRow({
        label: 'characters/hatter.md',
        configuredResource: { group: 'characters', path: 'characters/hatter.md' }
      }), 'Jill'));
      // Before the hook's state for B lands, B still keys apart from A.
      expect(result.current.sheetKey).not.toBe(first);
      props.readInContent = {
        requestId: 'readin-2', group: 'characters', path: 'characters/hatter.md', deliveredAt: 5_000, canOpenInEditor: false
      };
      rerender();
      expect(result.current.sheetKey).toBe('read-in:readin-2');
    });

    it('carries the row\'s card and the reply\'s line range and "changed since" (Wayfinding Slice 3)', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow({ turnId: 'turn-7-assistant-1' }), 'Jill'));
      expect(result.current.textSheet?.mode).toMatchObject({ kind: 'read-in', turnId: 'turn-7-assistant-1' });

      props.readInContent = {
        requestId: 'readin-1',
        ...rabbit,
        deliveredAt: 5_000,
        content: 'Down the hole.',
        lineRange: { start: 1, end: 64 },
        changedSinceRead: true,
        canOpenInEditor: true
      };
      rerender();
      expect(result.current.sheetBody).toMatchObject({
        value: 'Down the hole.',
        lineRange: { start: 1, end: 64 },
        changedSinceRead: true
      });
    });

    it('never takes another reading\'s reply for the same file', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));
      // The same file, read at another time: its range and change state
      // belong to that row, not this one.
      props.readInContent = {
        requestId: 'readin-1',
        ...rabbit,
        deliveredAt: 9_000,
        content: 'Down the hole.',
        lineRange: { start: 40, end: 60 },
        changedSinceRead: false,
        canOpenInEditor: true
      };
      rerender();
      expect(result.current.sheetBody).toMatchObject({ loading: true, value: undefined, lineRange: undefined });
    });
  });

  describe('the turn preview (ADR 2026-11-03 D6)', () => {
    const preview = { kind: 'reply' as const, speaker: 'Jill', content: 'An older reply.', timestamp: 1 };

    it('asks for the turn and opens its own sheet, keyed by the request', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));

      act(() => result.current.openTurnPreviewSheet('turn-0', 'Jill · An older reply'));

      expect(props.requestTurnPreview).toHaveBeenCalledWith('turn-0');
      expect(result.current.textSheet?.mode).toEqual({
        kind: 'turn-preview',
        turnId: 'turn-0',
        requestId: 'ws-preview-1',
        label: 'Jill · An older reply'
      });
      expect(result.current.sheetKey).toBe('turn-preview:ws-preview-1');
      expect(result.current.sheetBody).toMatchObject({ loading: true, value: undefined, canOpenInEditor: false });
    });

    it('fills the body only from the reply to its own request', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openTurnPreviewSheet('turn-0'));

      props.turnPreview = { requestId: 'ws-preview-0', turnId: 'turn-0', turn: { ...preview, content: 'Late' } };
      rerender();
      expect(result.current.sheetBody?.value).toBeUndefined();

      props.turnPreview = { requestId: 'ws-preview-1', turnId: 'turn-0', turn: preview };
      rerender();
      expect(result.current.sheetBody).toMatchObject({ loading: false, value: 'An older reply.', turnPreview: preview });

      props.turnPreview = { requestId: 'ws-preview-1', turnId: 'turn-0', error: 'That message is no longer in this session.' };
      rerender();
      expect(result.current.sheetBody).toMatchObject({ loading: false, error: 'That message is no longer in this session.' });
    });

    it('replaces an open reader in place, dropping the reader\'s request', () => {
      const props = options();
      const { result } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openReadInSheet(readInRow(), 'Jill'));

      act(() => result.current.openTurnPreviewSheet('turn-0'));

      expect(result.current.textSheet?.mode.kind).toBe('turn-preview');
      expect(props.clearReadInContent).toHaveBeenCalled();
    });

    it('applies nothing, and drops its request on close and when the room or chat target changes', () => {
      const props = options();
      const { result, rerender } = renderHook(() => useWorkshopContextSheet(props));
      act(() => result.current.openTurnPreviewSheet('turn-0'));
      act(() => result.current.applyTextSheet('edited'));
      expect(props.addContextText).not.toHaveBeenCalled();
      expect(result.current.textSheet?.mode.kind).toBe('turn-preview');

      act(() => result.current.closeTextSheet());
      expect(props.clearTurnPreview).toHaveBeenCalledTimes(1);

      act(() => result.current.openTurnPreviewSheet('turn-0'));
      props.readInScopeKey = 'room:1\u0000cliff';
      rerender();
      expect(result.current.textSheet).toBeNull();
      expect(props.clearTurnPreview).toHaveBeenCalledTimes(2);

      act(() => result.current.openTurnPreviewSheet('turn-0'));
      props.readInScopeKey = 'room:2\u0000cliff';
      rerender();
      expect(result.current.textSheet).toBeNull();
    });
  });
});
