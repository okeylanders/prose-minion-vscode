/**
 * The Workshop's rail content: two file-style tabs, Material and Notes
 * (ADR 2026-11-03 D1). Presentational only; tab state lives in
 * `useWorkshopRailTabs`, and every panel's state lives above it in
 * WorkshopApp, so the inactive panel can unmount without losing anything.
 *
 * The tabs sit inside the rail's content: `FullTabRail` and `FullTabShell`
 * are unchanged, and the Lightbox rail is unaffected.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { IconName } from '@components/shared/Icon';
import { ExcerptPanel } from '@components/workshop/ExcerptPanel';
import { ContextPanel } from '@components/workshop/ContextPanel';
import { WorkshopTodoList } from '@components/workshop/WorkshopTodoList';
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
  todos: React.ComponentProps<typeof WorkshopTodoList>;
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

function summarizeTabs({
  excerpt,
  context,
  todos,
  unseenNotesCount
}: Omit<WorkshopRailProps, 'tabs'> & { unseenNotesCount: number }): Record<WorkshopRailTab, TabSummary> {
  const materialCount = (excerpt.excerpt ? 1 : 0) + context.attachments.length;
  const openTodos = todos.todos.filter((todo) => todo.status === 'open' && !todo.stale).length;
  const badge = unseenNotesCount > 0 ? `${unseenNotesCount} new` : undefined;
  return {
    material: {
      count: materialCount,
      name: `Material, ${materialCount} ${materialCount === 1 ? 'item' : 'items'}`
    },
    notes: {
      count: openTodos,
      name: `Notes, ${openTodos} open${badge ? `, ${badge}` : ''}`,
      badge
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

export const WorkshopRail: React.FC<WorkshopRailProps> = ({ tabs, excerpt, context, todos }) => {
  const { activeTab, unseenNotesCount, selectTab } = tabs;
  const tabRefs = React.useRef<Partial<Record<WorkshopRailTab, HTMLButtonElement | null>>>({});
  const summaries = summarizeTabs({ excerpt, context, todos, unseenNotesCount });

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

      <div
        className="pm-ws-rail-panel"
        role="tabpanel"
        id={workshopRailPanelId(activeTab)}
        aria-labelledby={workshopRailTabId(activeTab)}
      >
        {activeTab === 'material' ? (
          <>
            <ExcerptPanel {...excerpt} />
            <ContextPanel {...context} />
          </>
        ) : (
          <WorkshopTodoList {...todos} />
        )}
      </div>
    </>
  );
};
