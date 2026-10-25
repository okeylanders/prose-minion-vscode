/** Closed response contracts for durable rejected-model-response recovery artifacts (Conversation Widgets and the Lightbox). */

/* eslint-disable @typescript-eslint/naming-convention -- persisted tool ids are protocol literals. */
export const RECOVERABLE_RESPONSE_CONTRACTS = {
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
  'creative-variations': {
    id: 'creative-variations-v1',
    intendedContentType: 'application/json',
    protocol: 'First-line ===CREATIVE_VARIATIONS_V1===, then JSON {version: 1, cards: [{position, approach, direction, prose, tradeoff: {gain, cost}, invariantFlags: [{invariantField, kind, note}]}]}, then final-line ===END_CREATIVE_VARIATIONS_V1===.'
  },
  'show-vs-tell': {
    id: 'show-vs-tell-v1',
    intendedContentType: 'application/json',
    protocol: 'First-line ===SHOW_VS_TELL_V1===, then JSON {version: 1, groups: [four {kind, variants: [1-2 {prose, channels, gains, costs, direction, invariantFlags: [{invariantField, kind, note}]}]}] in fixed kind order}, then final-line ===END_SHOW_VS_TELL_V1===.'
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
  },
  'lightbox-readings': {
    id: 'lightbox-reading-group-v1',
    intendedContentType: 'application/json',
    // The default only: every Lightbox capture names its own group's sentinels and blocks (`lightboxRecoveryContract`, Slice 4H).
    protocol: 'First-line ===LIGHTBOX_GROUP_<group>_V1===, then JSON {version: 1, one block per lens the call requested, each with friction}, then final-line ===END_LIGHTBOX_GROUP_<group>_V1===.'
  }
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type RecoverableToolName = keyof typeof RECOVERABLE_RESPONSE_CONTRACTS;

/**
 * The contract a recovery sidecar records for its body. A tool's default is
 * its entry above; a capture may name a narrower one for the request it
 * made (a Lightbox group's own sentinels and blocks, Slice 4H).
 */
export interface RejectedModelResponseContract {
  id: string;
  intendedContentType: 'application/json' | 'text/plain';
  protocol: string;
}
