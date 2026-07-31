/**
 * Closed registry for Conversation Widget authoring-state codecs.
 *
 * The session aggregate owns config identity and lifecycle; each widget owns
 * only how its draft is copied and summarized. Adding another widget family
 * extends this registry instead of teaching WorkshopSessionService its shape.
 */

import {
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetConfigSummary
} from '@messages';
import {
  WorkshopWidgetConfigIdentity,
  WorkshopWidgetConfigInput,
  WorkshopWidgetConfigOperations
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import {
  cloneGesturePlaygroundDraft,
  summarizeGesturePlaygroundDraft
} from '@/application/services/workshop/widgets/GesturePlaygroundConfigCodec';
import {
  cloneLexicalGravityDraft
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
import {
  summarizeLexicalGravityDraft
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';

const unsupportedConfig = (value: never): never => {
  throw new Error(`Unsupported Workshop widget config: ${JSON.stringify(value)}`);
};

const unlinkedIdentity = (
  config: WorkshopWidgetConfigSnapshot
): WorkshopWidgetConfigIdentity => ({
  id: config.id,
  revision: config.revision + 1,
  clonedFromConfigId: config.clonedFromConfigId,
  createdAt: config.createdAt
});

export const WORKSHOP_WIDGET_CONFIG_OPERATIONS: WorkshopWidgetConfigOperations = {
  createSnapshot: (identity, input) => {
    switch (input.widgetId) {
      case 'gesture-playground':
        return {
          ...identity,
          widgetId: input.widgetId,
          draft: cloneGesturePlaygroundDraft(input.draft)
        };
      case 'lexical-gravity':
        return {
          ...identity,
          widgetId: input.widgetId,
          draft: cloneLexicalGravityDraft(input.draft)
        };
      default:
        return unsupportedConfig(input);
    }
  },

  reviseSnapshot: (current, input) => {
    if (current.widgetId !== input.widgetId) {
      throw new Error(`Widget config ${current.id} belongs to ${current.widgetId}`);
    }
    const identity = unlinkedIdentity(current);
    switch (input.widgetId) {
      case 'gesture-playground':
        return {
          ...identity,
          widgetId: input.widgetId,
          draft: cloneGesturePlaygroundDraft(input.draft)
        };
      case 'lexical-gravity':
        return {
          ...identity,
          widgetId: input.widgetId,
          draft: cloneLexicalGravityDraft(input.draft)
        };
      default:
        return unsupportedConfig(input);
    }
  },

  cloneSnapshot: (config) => {
    switch (config.widgetId) {
      case 'gesture-playground':
        return { ...config, draft: cloneGesturePlaygroundDraft(config.draft) };
      case 'lexical-gravity':
        return { ...config, draft: cloneLexicalGravityDraft(config.draft) };
      default:
        return unsupportedConfig(config);
    }
  },

  summarizeSnapshot: (config): WorkshopWidgetConfigSummary => {
    switch (config.widgetId) {
      case 'gesture-playground': {
        const { draft, ...identity } = config;
        return { ...identity, ...summarizeGesturePlaygroundDraft(draft) };
      }
      case 'lexical-gravity': {
        const { draft, ...identity } = config;
        return { ...identity, ...summarizeLexicalGravityDraft(draft) };
      }
      default:
        return unsupportedConfig(config);
    }
  }
};
