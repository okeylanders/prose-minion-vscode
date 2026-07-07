import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopToolId } from '@messages';
import { workshopQuickActionsForTool } from '@shared/constants/workshopQuickActions';
import { workshopToolLabel } from '@shared/constants/workshopTools';

interface WorkshopQuickActionBarProps {
  toolId: WorkshopToolId;
  disabled?: boolean;
  onAction: (toolId: WorkshopToolId, label: string) => void;
}

export const WorkshopQuickActionBar: React.FC<WorkshopQuickActionBarProps> = ({
  toolId,
  disabled = false,
  onAction
}) => {
  const actions = workshopQuickActionsForTool(toolId);

  return (
    <div className="pm-ws-qbar">
      <div className="pm-ws-qbar-label">
        <Icon name="sparkle" size={13} /> Next, for <b>{workshopToolLabel(toolId)}</b>
      </div>
      <div className="pm-ws-qbar-actions">
        {actions.map((action) => (
          <button
            key={action.label}
            className={`pm-ws-qa ${action.primary ? 'pm-ws-qa-primary' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => onAction(toolId, action.label)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
