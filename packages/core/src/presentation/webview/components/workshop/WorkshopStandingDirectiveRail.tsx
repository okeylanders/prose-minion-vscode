/** Generic composer-adjacent rail for active standing directive families. */

import * as React from 'react';
import {
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSummary
} from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  formatLexicalGravitySummary
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';

interface WorkshopStandingDirectiveRailProps {
  directives: WorkshopStandingDirectiveSummary[];
  disabled?: boolean;
  onEdit: (widgetConfigId: string) => void;
  onRemove: (family: WorkshopStandingDirectiveFamily) => void;
}

const directiveConfig = (directive: WorkshopStandingDirectiveSummary): string => {
  switch (directive.family) {
    case 'lexical-gravity':
      return formatLexicalGravitySummary(directive);
    default:
      return '';
  }
};

export const WorkshopStandingDirectiveRail: React.FC<WorkshopStandingDirectiveRailProps> = ({
  directives,
  disabled,
  onEdit,
  onRemove
}) => {
  if (directives.length === 0) {return null;}
  return (
    <div className="pm-ws-standing-rail" aria-label="Active prose directives">
      {directives.map((directive) => (
        <div className="pm-ws-standing-active" key={directive.id}>
          <span className="pm-ws-standing-pulse" aria-hidden="true" />
          <b>{workshopWidgetLabel(directive.widgetId)}</b>
          <span className="pm-ws-standing-config">{directiveConfig(directive)}</span>
          <span className="pm-ws-standing-spacer" />
          <button type="button" disabled={disabled} onClick={() => onEdit(directive.widgetConfigId)}>Edit</button>
          <button
            type="button"
            className="pm-ws-standing-kill"
            disabled={disabled}
            title={`Remove ${workshopWidgetLabel(directive.widgetId)}`}
            aria-label={`Remove ${workshopWidgetLabel(directive.widgetId)}`}
            onClick={() => onRemove(directive.family)}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      ))}
    </div>
  );
};
