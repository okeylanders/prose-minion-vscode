/**
 * The Workshop's rail content: two file-style tabs, Material and Notes
 * (ADR 2026-11-03 D1). Presentational only; tab state lives in
 * `useWorkshopRailTabs`. Both panels stay mounted and the inactive one is
 * hidden, so a draft a panel holds (an unsaved to-do edit, an open bookmark
 * rename) survives a tab switch (PR #184 F-01), and each tab's
 * `aria-controls` names a panel that exists (N-01). A new room remounts the
 * to-do and bookmark lists, so their drafts are dropped on purpose, never
 * carried into another room.
 *
 * The tabs sit inside the rail's content: `FullTabRail` and `FullTabShell`
 * are unchanged, and the Lightbox rail is unaffected.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { IconName } from '@components/shared/Icon';
import { ExcerptPanel } from '@components/workshop/ExcerptPanel';
import { ContextPanel } from '@components/workshop/ContextPanel';
import { WorkshopReadInPanel } from '@components/workshop/WorkshopReadInPanel';
import { WorkshopTodoList } from '@components/workshop/WorkshopTodoList';
import { WorkshopBookmarkList } from '@components/workshop/WorkshopBookmarkList';
import {
  WORKSHOP_RAIL_TABS,
  WorkshopRailTab,
  WorkshopRailTabsActions,
  WorkshopRailTabsState
} from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';

export interface WorkshopRailProps {
  tabs: WorkshopRailTabsState & WorkshopRailTabsActions;
  excerpt: React.ComponentProps<typeof ExcerptPanel>;
  context: React.ComponentProps<typeof ContextPanel>;
  /** The chat target's read-in rows (ADR 2026-11-03 D2). */
  readIn: React.ComponentProps<typeof WorkshopReadInPanel>;
  todos: React.ComponentProps<typeof WorkshopTodoList>;
  /** The writer's bookmarks, under the to-dos (ADR 2026-11-03 D5). */
  bookmarks: React.ComponentProps<typeof WorkshopBookmarkList>;
  /** Identity of the room generation; a change resets panel-local drafts. */
  roomKey: string;
}

const TAB_LABELS: Record<WorkshopRailTab, string> = {
  material: 'Material',
  notes: 'Notes'
};

const TAB_ICONS: Record<WorkshopRailTab, IconName> = {
  material: 'doc',
  notes: 'list'
};

export const workshopRailTabId = (tab: WorkshopRailTab): string => `pm-ws-rail-tab-${tab}`;
export const workshopRailPanelId = (tab: WorkshopRailTab): string => `pm-ws-rail-panel-${tab}`;

interface TabSummary {
  count: number;
  /** The tab's accessible name: its label, the count, and any badge. */
  name: string;
  badge?: string;
}

const newBadge = (unseen: number): string | undefined =>
  unseen > 0 ? `${unseen} new` : undefined;

function summarizeTabs({
  excerpt,
  context,
  readIn,
  todos,
  bookmarks,
  unseenNotesCount,
  unseenMaterialCount
}: Omit<WorkshopRailProps, 'tabs' | 'roomKey'> &
  Pick<WorkshopRailTabsState, 'unseenNotesCount' | 'unseenMaterialCount'>): Record<WorkshopRailTab, TabSummary> {
  const materialCount = (excerpt.excerpt ? 1 : 0) + context.attachments.length + readIn.entries.length;
  const openTodos = todos.todos.filter((todo) => todo.status === 'open' && !todo.stale).length;
  const bookmarkCount = bookmarks.bookmarks.length;
  const bookmarkPart = bookmarkCount > 0
    ? `, ${bookmarkCount} ${bookmarkCount === 1 ? 'bookmark' : 'bookmarks'}`
    : '';
  const materialBadge = newBadge(unseenMaterialCount);
  const notesBadge = newBadge(unseenNotesCount);
  return {
    material: {
      count: materialCount,
      name: `Material, ${materialCount} ${materialCount === 1 ? 'item' : 'items'}${materialBadge ? `, ${materialBadge}` : ''}`,
      badge: materialBadge
    },
    notes: {
      count: openTodos + bookmarkCount,
      name: `Notes, ${openTodos} open${bookmarkPart}${notesBadge ? `, ${notesBadge}` : ''}`,
      badge: notesBadge
    }
  };
}

/** WAI-ARIA tabs keyboard model with automatic activation. */
function nextTabForKey(key: string, current: WorkshopRailTab): WorkshopRailTab | undefined {
  const index = WORKSHOP_RAIL_TABS.indexOf(current);
  const last = WORKSHOP_RAIL_TABS.length - 1;
  switch (key) {
    case 'ArrowRight':
      return WORKSHOP_RAIL_TABS[index === last ? 0 : index + 1];
    case 'ArrowLeft':
      return WORKSHOP_RAIL_TABS[index === 0 ? last : index - 1];
    case 'Home':
      return WORKSHOP_RAIL_TABS[0];
    case 'End':
      return WORKSHOP_RAIL_TABS[last];
    default:
      return undefined;
  }
}

export const WorkshopRail: React.FC<WorkshopRailProps> = ({
  tabs,
  excerpt,
  context,
  readIn,
  todos,
  bookmarks,
  roomKey
}) => {
  const { activeTab, unseenNotesCount, unseenMaterialCount, selectTab } = tabs;
  const tabRefs = React.useRef<Partial<Record<WorkshopRailTab, HTMLButtonElement | null>>>({});
  const summaries = summarizeTabs({
    excerpt,
    context,
    readIn,
    todos,
    bookmarks,
    unseenNotesCount,
    unseenMaterialCount
  });

  const moveWithKeyboard = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const next = nextTabForKey(event.key, activeTab);
      if (!next) {
        return;
      }
      event.preventDefault();
      selectTab(next);
      tabRefs.current[next]?.focus();
    },
    [activeTab, selectTab]
  );

  return (
    <>
      <div className="pm-ws-rail-tabs" role="tablist" aria-label="Rail sections">
        {WORKSHOP_RAIL_TABS.map((tab) => {
          const selected = tab === activeTab;
          const summary = summaries[tab];
          return (
            <button
              key={tab}
              ref={(element) => { tabRefs.current[tab] = element; }}
              id={workshopRailTabId(tab)}
              className={`pm-ws-rail-tab${selected ? ' pm-ws-rail-tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={workshopRailPanelId(tab)}
              aria-label={summary.name}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={moveWithKeyboard}
            >
              <Icon name={TAB_ICONS[tab]} size={14} />
              {TAB_LABELS[tab]}
              <span className="pm-ws-rail-tab-count" aria-hidden="true">{summary.count}</span>
              {summary.badge ? (
                <span className="pm-ws-rail-tab-badge" aria-hidden="true">{summary.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* tabIndex 0: a panel is a tab stop even when it holds nothing
          focusable, such as an empty to-do list (WAI-ARIA tabs; N-02). */}
      <div
        className="pm-ws-rail-panel"
        role="tabpanel"
        id={workshopRailPanelId('material')}
        aria-labelledby={workshopRailTabId('material')}
        tabIndex={0}
        hidden={activeTab !== 'material'}
      >
        <ExcerptPanel {...excerpt} />
        <ContextPanel {...context} />
        <WorkshopReadInPanel {...readIn} />
      </div>
      <div
        className="pm-ws-rail-panel"
        role="tabpanel"
        id={workshopRailPanelId('notes')}
        aria-labelledby={workshopRailTabId('notes')}
        tabIndex={0}
        hidden={activeTab !== 'notes'}
      >
        <WorkshopTodoList key={`todos:${roomKey}`} {...todos} />
        <WorkshopBookmarkList key={`bookmarks:${roomKey}`} {...bookmarks} />
      </div>
    </>
  );
};
