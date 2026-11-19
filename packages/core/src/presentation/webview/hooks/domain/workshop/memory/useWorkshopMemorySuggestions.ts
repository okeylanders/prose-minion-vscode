/**
 * How readily personas suggest notes, as the Workshop tab holds and changes
 * it (Everyday Conveniences, Round Two, item B;
 * `proseMinion.workshop.memory.suggestions`).
 *
 * - **Heard, never guessed.** The level is the host's, from each
 *   `WORKSHOP_SESSION_STATE`. Absent or unknown reads Sparingly, the default.
 * - **Written through the settings route.** A choice posts `UPDATE_SETTING`.
 *   The host's settings watcher rebuilds the persona prompts and sends the
 *   session state again, and only then does the level here move. An edit in
 *   VS Code Settings and a choice here therefore arrive the same way.
 * - It persists nothing: the setting is the host's.
 */

import * as React from 'react';
import { MessageType, type WorkshopSessionStateMessage } from '@messages';
import {
  coerceWorkshopMemorySuggestionLevel,
  DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL,
  WORKSHOP_MEMORY_SUGGESTIONS_SETTING,
  type WorkshopMemorySuggestionLevel
} from '@shared/constants/workshopMemorySuggestions';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export interface WorkshopMemorySuggestionsState {
  /** The level as the host last said it. */
  readonly level: WorkshopMemorySuggestionLevel;
}

export interface WorkshopMemorySuggestionsActions {
  handleSessionState: (message: WorkshopSessionStateMessage) => void;
  /** Ask the host to save `level`; the level here moves when the host says so. */
  setLevel: (level: WorkshopMemorySuggestionLevel) => void;
}

export interface WorkshopMemorySuggestionsPersistence {
  // Nothing: the host owns the setting.
}

export type UseWorkshopMemorySuggestionsReturn = WorkshopMemorySuggestionsState &
  WorkshopMemorySuggestionsActions & { persistedState: WorkshopMemorySuggestionsPersistence };

const SOURCE = 'webview.hooks.useWorkshopMemorySuggestions';

export function useWorkshopMemorySuggestions(): UseWorkshopMemorySuggestionsReturn {
  const vscode = useVSCodeApi();
  const [level, setLevelState] = React.useState<WorkshopMemorySuggestionLevel>(DEFAULT_WORKSHOP_MEMORY_SUGGESTION_LEVEL);

  const handleSessionState = React.useCallback((message: WorkshopSessionStateMessage) => {
    setLevelState(coerceWorkshopMemorySuggestionLevel(message.payload?.memorySuggestions));
  }, []);

  const setLevel = React.useCallback((next: WorkshopMemorySuggestionLevel) => {
    vscode.postMessage({
      type: MessageType.UPDATE_SETTING,
      source: SOURCE,
      payload: { key: WORKSHOP_MEMORY_SUGGESTIONS_SETTING.key, value: next },
      timestamp: Date.now()
    });
  }, [vscode]);

  return { level, handleSessionState, setLevel, persistedState: {} };
}
