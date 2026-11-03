/** @jest-environment jsdom */

/**
 * useWorkshopRailTabs (ADR 2026-11-03 D1): the rail's tab is restored and
 * persisted per viewer, and the Notes badge counts open, current to-dos that
 * arrived while Notes was hidden, whoever added them. Nothing ever switches
 * the tab.
 */

import { act, renderHook } from '@testing-library/react';
import {
  parseWorkshopRailTab,
  useWorkshopRailTabs,
  UseWorkshopRailTabsOptions
} from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';
import { WorkshopTodoItem } from '@messages';

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
});
