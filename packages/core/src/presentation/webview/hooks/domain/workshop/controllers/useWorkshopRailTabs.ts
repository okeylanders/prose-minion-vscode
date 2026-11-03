/**
 * Presentation controller for the Workshop rail's two tabs (ADR 2026-11-03 D1).
 *
 * It owns which tab is showing and how many to-dos arrived while Notes was
 * hidden. It never switches a tab by itself: a badge is the whole signal.
 * The selected tab is a per-viewer preference (webview state, never the
 * session file); the seen-id set is deliberately not persisted, so a reload
 * re-baselines on whatever the room already holds.
 */

import * as React from 'react';
import type { WorkshopTodoItem } from '@messages';

export const WORKSHOP_RAIL_TABS = ['material', 'notes'] as const;
export type WorkshopRailTab = (typeof WORKSHOP_RAIL_TABS)[number];

/** Reads a stored tab, falling back to Material for anything unrecognized. */
export function parseWorkshopRailTab(value: unknown): WorkshopRailTab {
  return WORKSHOP_RAIL_TABS.find((tab) => tab === value) ?? 'material';
}

/**
 * Whatever lands in a hidden tab badges it, whoever added it (ADR D1, amended
 * 2026-11-03). Stale to-dos are left out, so the badge never exceeds the
 * tab's open count.
 */
const isBadgeable = (todo: WorkshopTodoItem): boolean =>
  todo.status === 'open' && !todo.stale;

export interface UseWorkshopRailTabsOptions {
  /** The room's current to-dos, as the snapshot carries them. */
  todos: readonly WorkshopTodoItem[];
  /**
   * Identity of the room generation the to-dos belong to. When it changes
   * (first load, New, Open, Rewind, Branch) everything the new room holds
   * counts as seen, so a replaced room never badges its old items.
   */
  roomKey: string;
  /** The stored tab from webview state, read by the caller; may be anything. */
  initialTab?: unknown;
}

export interface WorkshopRailTabsState {
  activeTab: WorkshopRailTab;
  /** Open, current to-dos that arrived while Notes was hidden. */
  unseenNotesCount: number;
}

export interface WorkshopRailTabsActions {
  selectTab: (tab: WorkshopRailTab) => void;
}

export interface WorkshopRailTabsPersistence {
  workshopRailTab: WorkshopRailTab;
}

export type UseWorkshopRailTabsReturn = WorkshopRailTabsState &
  WorkshopRailTabsActions & {
    persistedState: WorkshopRailTabsPersistence;
  };

const sameIds = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean =>
  left.size === right.size && [...left].every((id) => right.has(id));

export function useWorkshopRailTabs({
  todos,
  roomKey,
  initialTab
}: UseWorkshopRailTabsOptions): UseWorkshopRailTabsReturn {
  const [activeTab, setActiveTab] = React.useState<WorkshopRailTab>(
    () => parseWorkshopRailTab(initialTab)
  );
  const [unseenIds, setUnseenIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const seenIdsRef = React.useRef<Set<string>>(new Set(todos.map((todo) => todo.id)));
  const roomKeyRef = React.useRef(roomKey);

  const replaceUnseen = React.useCallback((next: ReadonlySet<string>) => {
    setUnseenIds((current) => (sameIds(current, next) ? current : next));
  }, []);

  const markAllSeen = React.useCallback(() => {
    seenIdsRef.current = new Set(todos.map((todo) => todo.id));
    replaceUnseen(new Set());
  }, [replaceUnseen, todos]);

  const syncSeenTodosWhenRoomReplaced = React.useCallback((): boolean => {
    if (roomKeyRef.current === roomKey) {
      return false;
    }
    roomKeyRef.current = roomKey;
    markAllSeen();
    return true;
  }, [markAllSeen, roomKey]);

  const syncSeenTodosWhenNotesVisible = React.useCallback((): boolean => {
    if (activeTab !== 'notes') {
      return false;
    }
    markAllSeen();
    return true;
  }, [activeTab, markAllSeen]);

  const collectUnseenTodosWhileNotesHidden = React.useCallback(() => {
    const badgeable = new Set(todos.filter(isBadgeable).map((todo) => todo.id));
    const next = new Set([...unseenIds].filter((id) => badgeable.has(id)));
    for (const todo of todos) {
      if (seenIdsRef.current.has(todo.id)) {
        continue;
      }
      seenIdsRef.current.add(todo.id);
      if (badgeable.has(todo.id)) {
        next.add(todo.id);
      }
    }
    replaceUnseen(next);
  }, [replaceUnseen, todos, unseenIds]);

  React.useEffect(() => {
    if (syncSeenTodosWhenRoomReplaced() || syncSeenTodosWhenNotesVisible()) {
      return;
    }
    collectUnseenTodosWhileNotesHidden();
  }, [
    collectUnseenTodosWhileNotesHidden,
    syncSeenTodosWhenNotesVisible,
    syncSeenTodosWhenRoomReplaced
  ]);

  const selectTab = React.useCallback((tab: WorkshopRailTab) => {
    setActiveTab(tab);
  }, []);

  const persistedState = React.useMemo<WorkshopRailTabsPersistence>(
    () => ({ workshopRailTab: activeTab }),
    [activeTab]
  );

  return {
    activeTab,
    unseenNotesCount: activeTab === 'notes' ? 0 : unseenIds.size,
    selectTab,
    persistedState
  };
}
