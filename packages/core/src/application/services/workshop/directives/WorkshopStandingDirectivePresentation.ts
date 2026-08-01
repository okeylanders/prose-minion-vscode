/** Closed presentation registry for standing-directive summaries and markers. */

import {
  WorkshopStandingDirectiveSnapshot,
  WorkshopStandingDirectiveSummary,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  lexicalGravityMarkerContent
} from '@/application/services/workshop/lexicalGravity/LexicalGravityDirective';
import {
  summarizeLexicalGravityDraft
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';

export function summarizeWorkshopStandingDirective(
  directive: WorkshopStandingDirectiveSnapshot,
  config: WorkshopWidgetConfigSnapshot
): WorkshopStandingDirectiveSummary {
  if (directive.widgetId !== config.widgetId) {
    throw new Error(`Standing directive ${directive.id} has no matching widget config`);
  }
  switch (directive.family) {
    case 'lexical-gravity': {
      if (directive.widgetId !== 'lexical-gravity' || config.widgetId !== 'lexical-gravity') {
        throw new Error(`Lexical Gravity directive ${directive.id} has the wrong config`);
      }
      return {
        ...directive,
        family: 'lexical-gravity',
        widgetId: 'lexical-gravity',
        ...summarizeLexicalGravityDraft(config.draft)
      };
    }
    case 'prose-controller':
      throw new Error('Prose Controller standing directives are not implemented');
    default:
      return assertNever(directive.family);
  }
}

export function workshopStandingDirectiveMarkerContent(
  action: 'installed' | 'shifted' | 'removed',
  directive: WorkshopStandingDirectiveSnapshot,
  previousConfig?: WorkshopWidgetConfigSnapshot,
  currentConfig?: WorkshopWidgetConfigSnapshot
): string {
  switch (directive.family) {
    case 'lexical-gravity':
      return lexicalGravityMarkerContent(
        action,
        previousConfig?.widgetId === 'lexical-gravity' ? previousConfig : undefined,
        currentConfig?.widgetId === 'lexical-gravity' ? currentConfig : undefined
      );
    case 'prose-controller': {
      const verb = action === 'installed'
        ? 'Installed'
        : action === 'shifted'
          ? 'Shifted'
          : 'Removed';
      return `${verb} ${workshopWidgetLabel(directive.widgetId)}.`;
    }
    default:
      return assertNever(directive.family);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported standing directive family: ${String(value)}`);
}
