/**
 * The Pinned context tab's props for settings-modal tests that don't open
 * it (Pinned Context Slice 3): the host hasn't answered yet, and every
 * callback is a mock.
 */
import type { WorkshopPinnedContextSettingsPanelProps } from '@components/workshop/settings/WorkshopPinnedContextSettingsPanel';
import { workshopPinnedContextTabView } from '@hooks/domain/workshop/pinnedContext/workshopPinnedContextTabView';

export function pinnedContextPanelPropsStub(
  overrides: Partial<WorkshopPinnedContextSettingsPanelProps> = {}
): WorkshopPinnedContextSettingsPanelProps {
  return {
    view: workshopPinnedContextTabView({ attachments: [], running: false, pending: false }),
    noteOpen: true,
    catalog: null,
    searchResults: null,
    onRequestList: jest.fn(),
    onRequestCatalog: jest.fn(),
    onSearch: jest.fn(),
    onClearSearch: jest.fn(),
    onToggleNote: jest.fn(),
    onPinResources: jest.fn(() => 'pin-1'),
    onPinAttachments: jest.fn(() => 'pin-2'),
    onPinPickedFile: jest.fn(() => 'pick-1'),
    onUnpin: jest.fn(() => 'unpin-1'),
    onMove: jest.fn(() => 'move-1'),
    onAttachMissing: jest.fn(() => 'attach-1'),
    onOpenFile: jest.fn(() => 'open-1'),
    ...overrides
  };
}
