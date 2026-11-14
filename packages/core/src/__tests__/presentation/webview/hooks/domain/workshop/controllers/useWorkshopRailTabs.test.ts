/** @jest-environment jsdom */

/**
 * useWorkshopRailTabs (ADR 2026-11-03 D1): the rail's tab is restored and
 * persisted per viewer, and the Notes badge counts open, current to-dos that
 * arrived while Notes was hidden, whoever added them. Slice 2: the Material
 * badge counts read-in rows by the same rule. Nothing ever switches the tab.
 */

import { act, renderHook } from '@testing-library/react';
import {
  parseWorkshopRailTab,
  useWorkshopRailTabs,
  UseWorkshopRailTabsOptions
} from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';
import { WorkshopBookmarkSummary, WorkshopTodoItem } from '@messages';
import type { ContextSourceEntry } from '@shared/types';

const row = (label: string, overrides: Partial<ContextSourceEntry> = {}): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label,
  configuredResource: { group: 'characters', path: label },
  sizeChars: 120,
  isEstimate: true,
  deliveredAt: 1_000,
  ...overrides
});

const todo = (id: string, overrides: Partial<WorkshopTodoItem> = {}): WorkshopTodoItem => ({
  id,
  text: `Task ${id}`,
  status: 'open',
  source: {
    kind: 'host_turn',
    personaId: 'jill',
    turnId: `turn-${id}`,
    participantLabel: 'Jill',
    findingKey: `finding-${id}`,
    findingText: `Task ${id}`,
    excerptVersion: 1
  },
  createdAt: 1,
  stale: false,
  ...overrides
});

const bookmark = (id: string, inWindow = true): WorkshopBookmarkSummary => ({
  id,
  turnId: `turn-${id}`,
  label: `Jill · ${id}`,
  participant: 'host',
  personaId: 'jill',
  inWindow
});

const renderTabs = (initial: Partial<UseWorkshopRailTabsOptions> = {}) =>
  renderHook((props: UseWorkshopRailTabsOptions) => useWorkshopRailTabs(props), {
    initialProps: { todos: [], roomKey: 'room:1', ...initial }
  });

describe('parseWorkshopRailTab', () => {
  it.each([
    ['material', 'material'],
    ['notes', 'notes'],
    [undefined, 'material'],
    ['bookmarks', 'material'],
    [7, 'material'],
    [{ tab: 'notes' }, 'material']
  ])('reads %p as %p', (stored, expected) => {
    expect(parseWorkshopRailTab(stored)).toBe(expected);
  });
});

describe('useWorkshopRailTabs', () => {
  it('starts on Material and persists the selected tab', () => {
    const { result } = renderTabs();
    expect(result.current.activeTab).toBe('material');
    expect(result.current.persistedState).toEqual({ workshopRailTab: 'material' });

    act(() => result.current.selectTab('notes'));
    expect(result.current.activeTab).toBe('notes');
    expect(result.current.persistedState).toEqual({ workshopRailTab: 'notes' });
  });

  it('restores a stored tab and falls back on a bad one', () => {
    expect(renderTabs({ initialTab: 'notes' }).result.current.activeTab).toBe('notes');
    expect(renderTabs({ initialTab: 'pins' }).result.current.activeTab).toBe('material');
  });

  it('badges a to-do added while Notes is hidden, and clears it on selecting Notes', () => {
    const { result, rerender } = renderTabs({ todos: [todo('a')] });
    expect(result.current.unseenNotesCount).toBe(0);

    rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(1);
    expect(result.current.activeTab).toBe('material');

    act(() => result.current.selectTab('notes'));
    expect(result.current.unseenNotesCount).toBe(0);

    act(() => result.current.selectTab('material'));
    expect(result.current.unseenNotesCount).toBe(0);
  });

  it('badges what arrives in the showing tab while the whole rail is collapsed', () => {
    const { result, rerender } = renderTabs({ initialTab: 'notes', railHidden: true, todos: [todo('a')] });
    expect(result.current.unseenNotesCount).toBe(0);

    rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1', railHidden: true, readIn: [row('Raven')] });
    expect(result.current.unseenNotesCount).toBe(1);
    expect(result.current.unseenMaterialCount).toBe(1);

    // Opened again, the showing tab's news is seen; the other tab keeps its badge.
    rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1', railHidden: false, readIn: [row('Raven')] });
    expect(result.current.activeTab).toBe('notes');
    expect(result.current.unseenNotesCount).toBe(0);
    expect(result.current.unseenMaterialCount).toBe(1);
  });

  it('never badges a to-do added while Notes is visible', () => {
    const { result, rerender } = renderTabs({ initialTab: 'notes' });
    rerender({ todos: [todo('a')], roomKey: 'room:1' });
    act(() => result.current.selectTab('material'));
    expect(result.current.unseenNotesCount).toBe(0);
  });

  it('never badges the writer\'s own edits, completions, or reorders', () => {
    const { result, rerender } = renderTabs({ todos: [todo('a'), todo('b')] });
    rerender({
      todos: [todo('b', { status: 'completed' }), todo('a', { text: 'Edited by the writer' })],
      roomKey: 'room:1'
    });
    expect(result.current.unseenNotesCount).toBe(0);
  });

  it('drops an unseen to-do from the count once it is no longer open and current', () => {
    const { result, rerender } = renderTabs();
    rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(2);

    rerender({ todos: [todo('a', { status: 'dismissed' }), todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(1);

    rerender({ todos: [todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(1);

    rerender({ todos: [todo('b', { stale: true })], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(0);
  });

  it('never badges the to-dos a reload or a replaced room brings in', () => {
    const { result, rerender } = renderTabs({ todos: [], roomKey: 'pending' });
    rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(0);

    rerender({ todos: [todo('a'), todo('b'), todo('c')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(1);

    rerender({ todos: [todo('x'), todo('y')], roomKey: 'room:2' });
    expect(result.current.unseenNotesCount).toBe(0);
  });

  it('counts each arrival once, however many renders follow', () => {
    const { result, rerender } = renderTabs();
    const todos = [todo('a')];
    rerender({ todos, roomKey: 'room:1' });
    rerender({ todos: [...todos], roomKey: 'room:1' });
    rerender({ todos: [...todos, todo('b')], roomKey: 'room:1' });
    expect(result.current.unseenNotesCount).toBe(2);
  });

  describe('the Material badge (Slice 2)', () => {
    const onNotes = (initial: Partial<UseWorkshopRailTabsOptions> = {}) =>
      renderTabs({ initialTab: 'notes', readInKey: 'jill', ...initial });

    it('badges a read-in row that arrives while Material is hidden, and clears on selecting it', () => {
      const first = row('characters/rabbit.md');
      const { result, rerender } = onNotes({ readIn: [first] });
      expect(result.current.unseenMaterialCount).toBe(0);

      rerender({ todos: [], roomKey: 'room:1', readInKey: 'jill', readIn: [first, row('characters/duchess.md')] });
      expect(result.current.unseenMaterialCount).toBe(1);
      expect(result.current.unseenNotesCount).toBe(0);
      expect(result.current.activeTab).toBe('notes');

      act(() => result.current.selectTab('material'));
      expect(result.current.unseenMaterialCount).toBe(0);
    });

    it('never badges while Material is showing', () => {
      const { result, rerender } = renderTabs({ readInKey: 'jill', readIn: [] });
      rerender({ todos: [], roomKey: 'room:1', readInKey: 'jill', readIn: [row('characters/rabbit.md')] });
      expect(result.current.unseenMaterialCount).toBe(0);
    });

    it('does not badge a row for being superseded, and drops a badge whose row went stale', () => {
      const early = row('characters/rabbit.md');
      const { result, rerender } = onNotes({ readIn: [early] });
      rerender({ todos: [], roomKey: 'room:1', readInKey: 'jill', readIn: [{ ...early, stale: true }] });
      expect(result.current.unseenMaterialCount).toBe(0);

      const reread = row('characters/rabbit.md', { deliveredAt: 2_000 });
      rerender({ todos: [], roomKey: 'room:1', readInKey: 'jill', readIn: [{ ...early, stale: true }, reread] });
      expect(result.current.unseenMaterialCount).toBe(1);

      rerender({
        todos: [],
        roomKey: 'room:1',
        readInKey: 'jill',
        readIn: [{ ...early, stale: true }, { ...reread, stale: true }]
      });
      expect(result.current.unseenMaterialCount).toBe(0);
    });

    it('never badges what another chat target already read', () => {
      const { result, rerender } = onNotes({ readIn: [row('characters/rabbit.md')] });
      rerender({
        todos: [],
        roomKey: 'room:1',
        readInKey: 'tool:continuity',
        readIn: [row('Continuity report', { kind: 'tool-evidence', origin: 'tool' }), row('characters/hatter.md')]
      });
      expect(result.current.unseenMaterialCount).toBe(0);

      rerender({
        todos: [],
        roomKey: 'room:1',
        readInKey: 'tool:continuity',
        readIn: [
          row('Continuity report', { kind: 'tool-evidence', origin: 'tool' }),
          row('characters/hatter.md'),
          row('characters/queen.md', { deliveredAt: 3_000 })
        ]
      });
      expect(result.current.unseenMaterialCount).toBe(1);
    });

    it('never badges the rows a replaced room brings in', () => {
      const { result, rerender } = onNotes({ readIn: [] , roomKey: 'pending' });
      rerender({ todos: [], roomKey: 'room:4', readInKey: 'jill', readIn: [row('characters/rabbit.md')] });
      expect(result.current.unseenMaterialCount).toBe(0);
    });

    it('keeps the two tabs\' badges apart', () => {
      const { result, rerender } = renderTabs({ readInKey: 'jill', readIn: [] });
      act(() => result.current.selectTab('notes'));
      rerender({ todos: [todo('a')], roomKey: 'room:1', readInKey: 'jill', readIn: [row('characters/rabbit.md')] });
      expect(result.current.unseenNotesCount).toBe(0);
      expect(result.current.unseenMaterialCount).toBe(1);

      act(() => result.current.selectTab('material'));
      rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1', readInKey: 'jill', readIn: [row('characters/rabbit.md')] });
      expect(result.current.unseenNotesCount).toBe(1);
      expect(result.current.unseenMaterialCount).toBe(0);
    });
  });

  describe('bookmarks on the Notes badge (Slice 5)', () => {
    it('badges a bookmark set while Notes is hidden, beside the to-dos, and clears on selecting Notes', () => {
      const { result, rerender } = renderTabs({ todos: [todo('a')], bookmarks: [bookmark('bookmark-1-1')] });
      expect(result.current.unseenNotesCount).toBe(0);

      rerender({ todos: [todo('a'), todo('b')], roomKey: 'room:1', bookmarks: [bookmark('bookmark-1-1'), bookmark('bookmark-2-1')] });
      expect(result.current.unseenNotesCount).toBe(2);
      expect(result.current.activeTab).toBe('material');

      act(() => result.current.selectTab('notes'));
      expect(result.current.unseenNotesCount).toBe(0);
    });

    it('never badges a bookmark set while Notes is showing', () => {
      const { result, rerender } = renderTabs({ initialTab: 'notes' });
      rerender({ todos: [], roomKey: 'room:1', bookmarks: [bookmark('bookmark-1-1')] });
      act(() => result.current.selectTab('material'));
      expect(result.current.unseenNotesCount).toBe(0);
    });

    it('drops the badge of a bookmark cleared before it was seen, and never for a rename', () => {
      const { result, rerender } = renderTabs({ bookmarks: [bookmark('bookmark-1-1')] });
      rerender({ todos: [], roomKey: 'room:1', bookmarks: [bookmark('bookmark-1-1'), bookmark('bookmark-2-1')] });
      expect(result.current.unseenNotesCount).toBe(1);

      rerender({ todos: [], roomKey: 'room:1', bookmarks: [{ ...bookmark('bookmark-1-1'), label: 'Renamed' }] });
      expect(result.current.unseenNotesCount).toBe(0);
    });

    it('never badges the bookmarks a reload or a replaced room brings in', () => {
      const { result, rerender } = renderTabs({ roomKey: 'pending' });
      rerender({ todos: [], roomKey: 'room:3', bookmarks: [bookmark('bookmark-1-1'), bookmark('bookmark-2-1')] });
      expect(result.current.unseenNotesCount).toBe(0);

      rerender({ todos: [], roomKey: 'room:4', bookmarks: [bookmark('bookmark-1-9')] });
      expect(result.current.unseenNotesCount).toBe(0);
    });
  });
});
