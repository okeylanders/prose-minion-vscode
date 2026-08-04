/** Lexical Gravity semantics plugged into the shared standing transaction. */

import type {
  WorkshopStandingDirectiveOperationEntry,
  WorkshopStandingDirectiveRendering
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';
import {
  summarizeLexicalGravityDraft,
  validateLexicalGravityDraft
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  buildLexicalGravityDirectiveFrame,
  formatLexicalGravitySummary,
  lexicalGravityMarkerContent
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';

const renderLexicalGravityDirective = ({
  directive,
  config
}: WorkshopStandingDirectiveRendering): string => {
  if (
    directive.family !== 'lexical-gravity'
    || directive.widgetId !== 'lexical-gravity'
    || config.widgetId !== 'lexical-gravity'
  ) {
    throw new Error(`Lexical Gravity directive ${directive.id} has the wrong config`);
  }
  return buildLexicalGravityDirectiveFrame(directive, config.draft);
};

export const LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS = {
  widgetId: 'lexical-gravity',

  prepareApply: (payload) => {
    const draft = validateLexicalGravityDraft(payload.draft);
    return {
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      widgetConfigInput: { widgetId: 'lexical-gravity', draft },
      widgetConfigId: payload.widgetConfigId,
      editConflictMessage: 'Lexical Gravity can edit only its currently active configuration.',
      alreadyActiveMessage: 'Lexical Gravity is already active; reopen it to shift the directive.'
    };
  },

  render: renderLexicalGravityDirective,

  summarize: (directive, config) => {
    if (
      directive.family !== 'lexical-gravity'
      || directive.widgetId !== 'lexical-gravity'
      || config.widgetId !== 'lexical-gravity'
    ) {
      throw new Error(`Lexical Gravity directive ${directive.id} has the wrong config`);
    }
    return {
      ...directive,
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      ...summarizeLexicalGravityDraft(config.draft)
    };
  },

  markerContent: (action, directive, previousConfig, currentConfig) => {
    if (directive.family !== 'lexical-gravity' || directive.widgetId !== 'lexical-gravity') {
      throw new Error(`Lexical Gravity directive ${directive.id} has the wrong identity`);
    }
    return lexicalGravityMarkerContent(
      action,
      previousConfig?.widgetId === 'lexical-gravity' ? previousConfig : undefined,
      currentConfig?.widgetId === 'lexical-gravity' ? currentConfig : undefined
    );
  },

  formatSummary: (summary) => {
    if (summary.family !== 'lexical-gravity') {
      throw new Error(`Lexical Gravity cannot format ${summary.family}`);
    }
    return formatLexicalGravitySummary(summary);
  },

  describe: (input) => {
    const frame = renderLexicalGravityDirective(input);
    if (input.config.widgetId !== 'lexical-gravity') {
      throw new Error(`Lexical Gravity directive ${input.directive.id} has the wrong config`);
    }
    return `lens ${input.config.draft.lensSlug}, ${frame.length} chars`;
  }
} satisfies WorkshopStandingDirectiveOperationEntry;
