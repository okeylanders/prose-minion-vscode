/** Conversation settings · Advanced: live web research. */

import * as React from 'react';
import { WorkshopWebResearchSettings } from '@messages';
import { Switch } from './WorkshopConversationSettingsControls';

interface WorkshopAdvancedSettingsPanelProps {
  draft: WorkshopWebResearchSettings;
  disabled: boolean;
  onDraftChange: React.Dispatch<React.SetStateAction<WorkshopWebResearchSettings>>;
}

export const WorkshopAdvancedSettingsPanel: React.FC<WorkshopAdvancedSettingsPanelProps> = ({
  draft,
  disabled,
  onDraftChange
}) => (
  <div className="pm-ws-profile-share-row">
    <div>
      <div className="pm-ws-behavior-row-name">Allow live web research</div>
      <div className="pm-ws-behavior-row-desc">
        Persona conversations may search current web information when it helps. Search queries can draw on the active room, excerpt, attachments, and shared profile, then run through OpenRouter and its search providers. Enable it only for material you are comfortable sharing. It can add latency and provider charges; Grok can also search X when supported.
      </div>
    </div>
    <Switch
      checked={draft.enabled}
      disabled={disabled}
      label="Allow live web research"
      onClick={() => onDraftChange((current) => ({ enabled: !current.enabled }))}
    />
  </div>
);
