import {
  WORKSHOP_CONVERSATION_SETTINGS_TABS,
  workshopConversationSettingsTabForKey
} from '@components/workshop/settings/workshopConversationSettingsTabs';

describe('workshopConversationSettingsTabs', () => {
  it('lists the tabs in strip order with distinct ids', () => {
    expect(WORKSHOP_CONVERSATION_SETTINGS_TABS.map((entry) => entry.label))
      .toEqual(['Behavior', 'About you', 'Pinned context', 'Memory', 'Advanced']);
    const ids = WORKSHOP_CONVERSATION_SETTINGS_TABS.flatMap((entry) => [
      entry.id,
      entry.tabElementId,
      entry.panelElementId
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('moves along the listed order: arrows wrap, Home and End reach the ends', () => {
    const tabs = WORKSHOP_CONVERSATION_SETTINGS_TABS;
    expect(workshopConversationSettingsTabForKey(tabs, 'behavior', 'ArrowRight')).toBe('profile');
    expect(workshopConversationSettingsTabForKey(tabs, 'advanced', 'ArrowRight')).toBe('behavior');
    expect(workshopConversationSettingsTabForKey(tabs, 'behavior', 'ArrowLeft')).toBe('advanced');
    expect(workshopConversationSettingsTabForKey(tabs, 'profile', 'Home')).toBe('behavior');
    expect(workshopConversationSettingsTabForKey(tabs, 'profile', 'End')).toBe('advanced');
    // Pinned Context Slice 3: the fifth tab sits between About you and Memory.
    expect(workshopConversationSettingsTabForKey(tabs, 'profile', 'ArrowRight')).toBe('pinned-context');
    expect(workshopConversationSettingsTabForKey(tabs, 'pinned-context', 'ArrowRight')).toBe('memory');
    expect(workshopConversationSettingsTabForKey(tabs, 'memory', 'ArrowLeft')).toBe('pinned-context');
    expect(workshopConversationSettingsTabForKey(tabs, 'pinned-context', 'Home')).toBe('behavior');
    expect(workshopConversationSettingsTabForKey(tabs, 'pinned-context', 'End')).toBe('advanced');
  });

  it('ignores keys the strip does not handle', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'Tab']) {
      expect(workshopConversationSettingsTabForKey(WORKSHOP_CONVERSATION_SETTINGS_TABS, 'profile', key))
        .toBeUndefined();
    }
  });

  it('follows a longer list without other changes, so a new tab is one entry', () => {
    const tabs = [{ id: 'behavior' }, { id: 'profile' }, { id: 'memory' }, { id: 'advanced' }] as const;
    expect(workshopConversationSettingsTabForKey(tabs, 'profile', 'ArrowRight')).toBe('memory');
    expect(workshopConversationSettingsTabForKey(tabs, 'advanced', 'ArrowLeft')).toBe('memory');
    expect(workshopConversationSettingsTabForKey(tabs, 'memory', 'End')).toBe('advanced');
    expect(workshopConversationSettingsTabForKey(tabs, 'advanced', 'ArrowRight')).toBe('behavior');
  });

  it('moves nowhere in an empty list', () => {
    expect(workshopConversationSettingsTabForKey([], 'behavior', 'Home')).toBeUndefined();
  });
});
