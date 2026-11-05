/**
 * The Conversation settings tabs, in strip order. The tab strip, each tab's
 * ARIA wiring and the arrow-key navigation all read this one list, so a new
 * tab is one entry here plus its panel (Project Memory Slice 4a).
 */

export type WorkshopConversationSettingsTab = 'behavior' | 'profile' | 'pinned-context' | 'memory' | 'advanced';

export interface WorkshopConversationSettingsTabEntry {
  id: WorkshopConversationSettingsTab;
  label: string;
  /** The tab button's element id; its panel is labelled by it. */
  tabElementId: string;
  /** The panel's element id; the tab button controls it. */
  panelElementId: string;
  panelClassName: string;
}

export const WORKSHOP_CONVERSATION_SETTINGS_TABS: readonly WorkshopConversationSettingsTabEntry[] = [
  {
    id: 'behavior',
    label: 'Behavior',
    tabElementId: 'pm-ws-behavior-tab',
    panelElementId: 'pm-ws-behavior-panel',
    panelClassName: 'pm-ws-behavior-body'
  },
  {
    id: 'profile',
    label: 'About you',
    tabElementId: 'pm-ws-profile-tab',
    panelElementId: 'pm-ws-profile-panel',
    panelClassName: 'pm-ws-behavior-body pm-ws-profile-body'
  },
  {
    // Pinned Context Slice 3 (ADR 2026-11-04 D8, question 1): after About you, beside Memory.
    id: 'pinned-context',
    label: 'Pinned context',
    tabElementId: 'pm-ws-pinned-context-tab',
    panelElementId: 'pm-ws-pinned-context-panel',
    panelClassName: 'pm-ws-behavior-body pm-ws-pinned-context-body'
  },
  {
    id: 'memory',
    label: 'Memory',
    tabElementId: 'pm-ws-memory-tab',
    panelElementId: 'pm-ws-memory-panel',
    panelClassName: 'pm-ws-behavior-body pm-ws-memory-body'
  },
  {
    id: 'advanced',
    label: 'Advanced',
    tabElementId: 'pm-ws-advanced-tab',
    panelElementId: 'pm-ws-advanced-panel',
    panelClassName: 'pm-ws-behavior-body pm-ws-profile-body'
  }
];

/**
 * The tab a key moves to from `current`, or undefined for a key the strip
 * does not handle. Home and End go to the ends; the arrows wrap.
 */
export function workshopConversationSettingsTabForKey<Tab extends string>(
  tabs: ReadonlyArray<{ id: Tab }>,
  current: Tab,
  key: string
): Tab | undefined {
  if (tabs.length === 0) {
    return undefined;
  }
  const currentIndex = tabs.findIndex((entry) => entry.id === current);
  switch (key) {
    case 'Home':
      return tabs[0].id;
    case 'End':
      return tabs[tabs.length - 1].id;
    case 'ArrowLeft':
      return tabs[(currentIndex + tabs.length - 1) % tabs.length].id;
    case 'ArrowRight':
      return tabs[(currentIndex + 1) % tabs.length].id;
    default:
      return undefined;
  }
}
