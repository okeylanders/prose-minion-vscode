import type { AppMessageRouterDeps } from '@hooks/useAppMessageRouter';

type UtilitiesHooks = 'dictionary' | 'dictionaryHistory' | 'settings' | 'selection' | 'setActiveTab' | 'setError';

/** Utilities tests install their real hooks separately and never deliver these other domains' messages. */
export const otherUtilitiesRouterDomains = {
  analysis: {}, metrics: {}, context: {}, search: {}, passageSearch: {},
  recentSessions: { receive: jest.fn() }, unsavedSessions: { receive: jest.fn() }, publishingSettings: {}, wordSearchSettings: {},
  wordFrequencySettings: {}, tokensSettings: {}, themeSettings: {}, tokenTracking: {},
  contextPathsSettings: {}, contextPathsSuggestion: {}, modelsSettings: {}, accountBalance: {}
} satisfies Record<Exclude<keyof AppMessageRouterDeps, UtilitiesHooks>, unknown>;
