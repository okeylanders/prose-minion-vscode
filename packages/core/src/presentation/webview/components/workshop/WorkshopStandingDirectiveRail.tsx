/** Generic composer-adjacent rail for active standing directive families. */

import * as React from 'react';
import {
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSummary
} from '@messages';
import { Icon } from '@components/shared/Icon';

interface WorkshopStandingDirectiveRailProps {
  directives: WorkshopStandingDirectiveSummary[];
  disabled?: boolean;
  onEdit: (widgetConfigId: string) => void;
  onRemove: (family: WorkshopStandingDirectiveFamily) => void;
}

const directiveConfig = (directive: WorkshopStandingDirectiveSummary): string => {
  switch (directive.family) {
    case 'lexical-gravity':
      return `${directive.lensName} · ${directive.weight}% · ${directive.reach}°${directive.metaphorPull ? ' · metaphor' : ''}`;
    default:
      return '';
  }
};

const directiveLabel = (directive: WorkshopStandingDirectiveSummary): string => {
  switch (directive.family) {
    case 'lexical-gravity': return 'Lexical Gravity';
    default: return directive.family;
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
          <b>{directiveLabel(directive)}</b>
          <span className="pm-ws-standing-config">{directiveConfig(directive)}</span>
          <span className="pm-ws-standing-spacer" />
          <button type="button" disabled={disabled} onClick={() => onEdit(directive.widgetConfigId)}>Edit</button>
          <button
            type="button"
            className="pm-ws-standing-kill"
            disabled={disabled}
            title={`Remove ${directiveLabel(directive)}`}
            aria-label={`Remove ${directiveLabel(directive)}`}
            onClick={() => onRemove(directive.family)}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      ))}
    </div>
  );
};
