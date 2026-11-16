/**
 * The Workshop's collapsed rail: one icon per rail tab, with the tab's count
 * and its badge, so collapsing never hides news (Everyday Conveniences,
 * item D). Presentational only. Each icon carries the name its tab has in the
 * open rail ("Material, 4 items, 1 new") and reopens the rail on that tab.
 *
 * `FullTabShell` shows this in place of the rail's content while collapsed;
 * the shell knows nothing of the Workshop's tabs.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  summarizeWorkshopRailTabs,
  WORKSHOP_RAIL_TAB_ICONS,
  WorkshopRailProps
} from '@components/workshop/WorkshopRail';
import {
  WORKSHOP_RAIL_TABS,
  WorkshopRailTab
} from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';

export interface WorkshopRailStripProps {
  /** The open rail's own props: the strip counts exactly what the rail shows. */
  rail: WorkshopRailProps;
  onOpenTab: (tab: WorkshopRailTab) => void;
}

export const WorkshopRailStrip: React.FC<WorkshopRailStripProps> = ({ rail, onOpenTab }) => {
  const summaries = summarizeWorkshopRailTabs({
    excerpt: rail.excerpt,
    context: rail.context,
    readIn: rail.readIn,
    todos: rail.todos,
    bookmarks: rail.bookmarks,
    unseenNotesCount: rail.tabs.unseenNotesCount,
    unseenMaterialCount: rail.tabs.unseenMaterialCount
  });

  return (
    <div className="pm-ws-rail-strip" role="group" aria-label="Open a rail section">
      {WORKSHOP_RAIL_TABS.map((tab) => {
        const summary = summaries[tab];
        return (
          <button
            key={tab}
            className="pm-ws-rail-strip-tab"
            type="button"
            aria-label={summary.name}
            title={summary.name}
            onClick={() => onOpenTab(tab)}
          >
            <Icon name={WORKSHOP_RAIL_TAB_ICONS[tab]} size={16} />
            <span className="pm-ws-rail-tab-count" aria-hidden="true">{summary.count}</span>
            {summary.badge ? (
              <span className="pm-ws-rail-tab-badge" aria-hidden="true">{summary.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
