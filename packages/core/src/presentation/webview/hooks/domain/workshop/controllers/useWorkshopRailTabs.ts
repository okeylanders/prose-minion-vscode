/**
 * Presentation controller for the Workshop rail's two tabs (ADR 2026-11-03 D1).
 *
 * It owns which tab is showing and, per tab, how many items arrived while
 * that tab was hidden: to-dos for Notes, read-in rows for Material (D2). It
 * never switches a tab by itself: a badge is the whole signal.
 * The selected tab is a per-viewer preference (webview state, never the
 * session file); the seen-id set is deliberately not persisted, so a reload
 * re-baselines on whatever the room already holds.
 */

import * as React from 'react';
import type { WorkshopTodoItem } from '@messages';
import type { ContextSourceEntry } from '@shared/types';
import { readInRowIdentity } from '@utils/workshop/contextSources';

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
const isBadgeableTodo = (todo: WorkshopTodoItem): boolean =>
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
  /**
   * The chat target's read-in rows (`partitionContextSources(...).readIn`).
   * A row's identity is what the manifest gives it (`readInRowIdentity`).
   */
  readIn?: readonly ContextSourceEntry[];
  /**
   * Whose rows `readIn` holds: the chat target's identity. A change counts
   * everything that participant already read as seen, so switching
   * participants never badges Material.
   */
  readInKey?: string;
  /** The stored tab from webview state, read by the caller; may be anything. */
  initialTab?: unknown;
}

export interface WorkshopRailTabsState {
  activeTab: WorkshopRailTab;
  /** Open, current to-dos that arrived while Notes was hidden. */
  unseenNotesCount: number;
  /** Current read-in rows that arrived while Material was hidden. */
  unseenMaterialCount: number;
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

interface HiddenTabArrivalsOptions {
  /** Whether the tab is showing; while it is, everything counts as seen. */
  visible: boolean;
  /** Every item the tab holds, by identity. */
  ids: readonly string[];
  /** The ones that may badge (open, current). */
  badgeableIds: ReadonlySet<string>;
  /** When it changes, everything the tab holds counts as seen. */
  baselineKey: string;
}

/**
 * The one seen-set rule (Slice 1's to-do rule, per tab): an item badges when
 * it first appears while its tab is hidden and stays badgeable, until the
 * tab is shown or the baseline moves.
 */
function useHiddenTabArrivals({
  visible,
  ids,
  badgeableIds,
  baselineKey
}: HiddenTabArrivalsOptions): number {
  const [unseenIds, setUnseenIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const seenIdsRef = React.useRef<Set<string>>(new Set(ids));
  const baselineKeyRef = React.useRef(baselineKey);

  const replaceUnseen = React.useCallback((next: ReadonlySet<string>) => {
    setUnseenIds((current) => (sameIds(current, next) ? current : next));
  }, []);

  const markAllSeen = React.useCallback(() => {
    seenIdsRef.current = new Set(ids);
    replaceUnseen(new Set());
  }, [ids, replaceUnseen]);

  const syncSeenWhenBaselineMoved = React.useCallback((): boolean => {
    if (baselineKeyRef.current === baselineKey) {
      return false;
    }
    baselineKeyRef.current = baselineKey;
    markAllSeen();
    return true;
  }, [baselineKey, markAllSeen]);

  const syncSeenWhenVisible = React.useCallback((): boolean => {
    if (!visible) {
      return false;
    }
    markAllSeen();
    return true;
  }, [markAllSeen, visible]);

  const collectUnseenWhileHidden = React.useCallback(() => {
    const next = new Set([...unseenIds].filter((id) => badgeableIds.has(id)));
    for (const id of ids) {
      if (seenIdsRef.current.has(id)) {
        continue;
      }
      seenIdsRef.current.add(id);
      if (badgeableIds.has(id)) {
        next.add(id);
      }
    }
    replaceUnseen(next);
  }, [badgeableIds, ids, replaceUnseen, unseenIds]);

  React.useEffect(() => {
    if (syncSeenWhenBaselineMoved() || syncSeenWhenVisible()) {
      return;
    }
    collectUnseenWhileHidden();
  }, [collectUnseenWhileHidden, syncSeenWhenBaselineMoved, syncSeenWhenVisible]);

  return visible ? 0 : unseenIds.size;
}

const NO_READ_IN: readonly ContextSourceEntry[] = [];

export function useWorkshopRailTabs({
  todos,
  roomKey,
  readIn = NO_READ_IN,
  readInKey = '',
  initialTab
}: UseWorkshopRailTabsOptions): UseWorkshopRailTabsReturn {
  const [activeTab, setActiveTab] = React.useState<WorkshopRailTab>(
    () => parseWorkshopRailTab(initialTab)
  );

  const todoIds = React.useMemo(() => todos.map((todo) => todo.id), [todos]);
  const badgeableTodoIds = React.useMemo(
    () => new Set(todos.filter(isBadgeableTodo).map((todo) => todo.id)),
    [todos]
  );
  const unseenNotesCount = useHiddenTabArrivals({
    visible: activeTab === 'notes',
    ids: todoIds,
    badgeableIds: badgeableTodoIds,
    baselineKey: roomKey
  });

  const readInIds = React.useMemo(() => readIn.map(readInRowIdentity), [readIn]);
  const badgeableReadInIds = React.useMemo(
    () => new Set(readIn.filter((entry) => !entry.stale).map(readInRowIdentity)),
    [readIn]
  );
  const unseenMaterialCount = useHiddenTabArrivals({
    visible: activeTab === 'material',
    ids: readInIds,
    badgeableIds: badgeableReadInIds,
    // A new room or a new chat target both re-baseline Material.
    baselineKey: `${roomKey}\u0000${readInKey}`
  });

  const selectTab = React.useCallback((tab: WorkshopRailTab) => {
    setActiveTab(tab);
  }, []);

  const persistedState = React.useMemo<WorkshopRailTabsPersistence>(
    () => ({ workshopRailTab: activeTab }),
    [activeTab]
  );

  return {
    activeTab,
    unseenNotesCount,
    unseenMaterialCount,
    selectTab,
    persistedState
  };
}
