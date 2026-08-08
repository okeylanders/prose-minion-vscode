/** Lexical Gravity semantics plugged into the shared standing transaction. */

import type {
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopStandingDirectiveSnapshot
} from '@messages';
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

type LexicalGravityDirective = WorkshopStandingDirectiveSnapshot & {
  family: 'lexical-gravity';
  widgetId: 'lexical-gravity';
};

interface LexicalGravityRendering {
  directive: LexicalGravityDirective;
  config: WorkshopLexicalGravityWidgetConfigSnapshot;
}

const asLexicalGravityDirective = (
  directive: WorkshopStandingDirectiveSnapshot
): LexicalGravityDirective => {
  if (
    directive.family !== 'lexical-gravity'
    || directive.widgetId !== 'lexical-gravity'
  ) {
    throw new Error(`Lexical Gravity directive ${directive.id} has the wrong identity`);
  }
  return directive as LexicalGravityDirective;
};

const asLexicalGravityRendering = ({
  directive,
  config
}: WorkshopStandingDirectiveRendering): LexicalGravityRendering => {
  const lexicalDirective = asLexicalGravityDirective(directive);
  if (config.widgetId !== 'lexical-gravity') {
    throw new Error(`Lexical Gravity directive ${directive.id} has the wrong config`);
  }
  return { directive: lexicalDirective, config };
};

const renderLexicalGravityDirective = (input: WorkshopStandingDirectiveRendering): string => {
  const { directive, config } = asLexicalGravityRendering(input);
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
    const lexical = asLexicalGravityRendering({ directive, config });
    return {
      ...lexical.directive,
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      ...summarizeLexicalGravityDraft(lexical.config.draft)
    };
  },

  markerContent: (action, directive, previousConfig, currentConfig) => {
    asLexicalGravityDirective(directive);
    return lexicalGravityMarkerContent(
      action,
      previousConfig?.widgetId === 'lexical-gravity' ? previousConfig : undefined,
      currentConfig?.widgetId === 'lexical-gravity' ? currentConfig : undefined
    );
  },

  formatSummary: formatLexicalGravitySummary,

  describe: (input) => {
    const { config } = asLexicalGravityRendering(input);
    return `lens ${config.draft.lensSlug}, ${config.draft.applicationMode} gear, ${config.draft.evidenceMode} evidence, ${config.draft.weight}% weight, ${config.draft.reach}° reach`;
  }
} satisfies WorkshopStandingDirectiveOperationEntry;
