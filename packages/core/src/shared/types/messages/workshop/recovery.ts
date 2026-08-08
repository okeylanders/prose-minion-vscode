/** Closed response contracts for durable rejected-widget recovery artifacts. */

/* eslint-disable @typescript-eslint/naming-convention -- persisted tool ids are protocol literals. */
export const RECOVERABLE_WIDGET_RESPONSE_CONTRACTS = {
  'gesture-playground': {
    id: 'gesture-playground-composite-v1',
    intendedContentType: 'text/plain',
    protocol: 'First-line ===GESTURE_DICTIONARY_V1=== Markdown, then ===END_GESTURE_DICTIONARY_V1===; followed only by ===GESTURE_MENU_V1=== JSON {version: 1, groups: [{heading, options}]} ===END_GESTURE_MENU_V1===.'
  },
  'gesture-playground-more': {
    id: 'gesture-playground-menu-v1',
    intendedContentType: 'application/json',
    protocol: 'First-line ===GESTURE_MENU_V1===, then JSON {version: 1, groups: [{heading, options}]}, then final-line ===END_GESTURE_MENU_V1===.'
  },
  'lexical-gravity-build': {
    id: 'lexical-gravity-lenses-v2',
    intendedContentType: 'application/json',
    protocol: 'First-line ===LEXICAL_GRAVITY_LENSES_V2===, then JSON {version: 2, candidates: [three lenses]}, then final-line ===END_LEXICAL_GRAVITY_LENSES_V2===.'
  },
  'lexical-gravity-preview': {
    id: 'lexical-gravity-preview-v2',
    intendedContentType: 'application/json',
    protocol: 'First-line ===LEXICAL_GRAVITY_PREVIEW_V2===, then JSON {version, semanticPositions, selectedDynamicId, openEntailment, text}, then final-line ===END_LEXICAL_GRAVITY_PREVIEW_V2===.'
  }
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type RecoverableWidgetToolName = keyof typeof RECOVERABLE_WIDGET_RESPONSE_CONTRACTS;
export type RejectedModelResponseContract = typeof RECOVERABLE_WIDGET_RESPONSE_CONTRACTS[RecoverableWidgetToolName];
