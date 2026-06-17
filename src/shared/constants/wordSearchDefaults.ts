/**
 * Word-search default values — the single source of truth.
 *
 * Lives in `shared/` (vscode-free) so BOTH bundles consume the same numbers:
 *   - extension host: `ConfigurationHandler.getWordSearchSettings`,
 *     `ToolOptionsProvider.getWordSearchOptions`
 *   - webview: `useWordSearchSettings` initial defaults
 *
 * These mirror the contributed defaults in `package.json` — specifically the
 * `proseMinion.wordSearch.{contextWords,clusterWindow,minClusterSize,caseSensitive,
 * enableAssistantExpansion}.default` values. package.json can't import a TS
 * constant, so it is the ONE place that must match by hand — but the drift is NOT
 * left to memory: `src/__tests__/architecture/wordSearchDefaultsSync.test.ts`
 * reads package.json and fails CI if these two ever disagree.
 *
 * History: a prior unified-settings ADR proposed 7 / 150; that intent never
 * shipped (package.json stayed 3 / 50), so the running extension's effective
 * default has always been 3 / 50 / 2. Centralizing on the shipped values is
 * behavior-preserving; revisiting the 7 / 150 intent is a separate, deliberate
 * default change (see migration decision tracker D18).
 */

export interface WordSearchDefaults {
  contextWords: number;
  clusterWindow: number;
  minClusterSize: number;
  caseSensitive: boolean;
  enableAssistantExpansion: boolean;
}

export const WORD_SEARCH_DEFAULTS: WordSearchDefaults = {
  contextWords: 3,
  clusterWindow: 50,
  minClusterSize: 2,
  caseSensitive: false,
  enableAssistantExpansion: false,
};
