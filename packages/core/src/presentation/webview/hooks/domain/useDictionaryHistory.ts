/**
 * useDictionaryHistory - Dictionary lookup history navigation (ADR 2026-10-14, D5 and D6)
 *
 * The host owns the history. This hook holds the summary list it broadcasts,
 * a cursor naming the entry the result pane shows (`null` is live), the one
 * pending entry load, and an in-memory draft of unsaved input. `‹` `›` step
 * through the log like browser back and forward; restoring an entry reruns
 * nothing and changes no settings.
 *
 * Message handlers can run back to back before React re-renders (a lookup's
 * DICTIONARY_RESULT is followed at once by the DICTIONARY_HISTORY broadcast
 * that lists it), so every decision reads `navigationRef`, which each change
 * updates synchronously, never a render's closure.
 */

import * as React from 'react';
import {
  MessageType,
  DictionaryHistoryDurability,
  DictionaryHistoryEntryMessage,
  DictionaryHistoryMessage,
  DictionaryHistorySummary
} from '@messages';
import { DICTIONARY_HISTORY_LIMIT } from '@shared/constants/dictionaryHistory';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';
import { DictionaryView, UseDictionaryReturn } from '@hooks/domain/useDictionary';
import {
  DictionaryHistoryDirection,
  DictionaryHistoryPosition,
  DictionaryHistoryStep,
  describeDictionaryHistoryPosition,
  dictionaryViewFromEntry,
  isDictionaryFormDirty,
  stepDictionaryHistory
} from '@utils/dictionaryHistoryNavigation';

const SOURCE = 'webview.dictionary.history';

/** The narrow slice of the dictionary hook that history reads and restores. */
export type DictionaryHistoryTarget = Pick<
  UseDictionaryReturn,
  | 'word'
  | 'context'
  | 'includeEncyclopedia'
  | 'includePalettes'
  | 'sourceUri'
  | 'relativePath'
  | 'result'
  | 'toolName'
  | 'lookupSubject'
  | 'restoreView'
  | 'loading'
  | 'isFastGenerating'
  | 'isStreaming'
>;

export interface DictionaryHistoryState {
  /** Newest first. */
  entries: DictionaryHistorySummary[];
  /** `null` until the host's first list arrives. */
  durability: DictionaryHistoryDurability | null;
  limit: number;
  /** The entry the result pane shows; `null` is live. */
  cursorId: string | null;
  /** The entry being loaded; only a reply for this id is applied. */
  pendingEntryId: string | null;
  /** Unsaved input stashed on navigation; `›` from the newest entry restores it. */
  draft: DictionaryView | null;
  /** True while a lookup is generating; navigation does nothing then. */
  navigationLocked: boolean;
  canGoOlder: boolean;
  canGoNewer: boolean;
  /** Where navigation stands (`pendingEntryId ?? cursorId`), for the `3 / 12` label. */
  position: DictionaryHistoryPosition;
  cursorSummary: DictionaryHistorySummary | null;
  /** The entry `‹` would load, for its tooltip. */
  olderSummary: DictionaryHistorySummary | null;
  /** The entry `›` would load; `null` when it leads to the draft or nowhere. */
  newerSummary: DictionaryHistorySummary | null;
}

export interface DictionaryHistoryActions {
  requestHistory: () => void;
  handleHistory: (message: DictionaryHistoryMessage) => void;
  handleHistoryEntry: (message: DictionaryHistoryEntryMessage) => void;
  goOlder: () => void;
  goNewer: () => void;
  /** Load one entry by id (the history popup), stashing unsaved input first. */
  openEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  clearHistory: () => void;
  /**
   * A lookup's result settled it; point the cursor at the entry it was
   * recorded as. Callers apply only results that settle the awaited lookup
   * (`useDictionary.isAwaitedResult`), so a replay never moves the cursor.
   */
  followRecordedEntry: (id?: string) => void;
  /** Every submit path calls this: the new lookup becomes live. */
  beginNewLookup: () => void;
}

/** Entries come from the host on mount and the draft lives in memory only. */
export interface DictionaryHistoryPersistence {
  dictionaryHistoryCursorId: string | null;
}

export type UseDictionaryHistoryReturn = DictionaryHistoryState & DictionaryHistoryActions & {
  persistedState: DictionaryHistoryPersistence;
};

interface HistoryNavigation {
  entries: DictionaryHistorySummary[];
  durability: DictionaryHistoryDurability | null;
  limit: number;
  cursorId: string | null;
  pendingEntryId: string | null;
  draft: DictionaryView | null;
}

const idsOf = (entries: readonly DictionaryHistorySummary[]): string[] => entries.map(entry => entry.id);

const summaryFor = (
  entries: readonly DictionaryHistorySummary[],
  id: string | null
): DictionaryHistorySummary | null => (id === null ? null : entries.find(entry => entry.id === id) ?? null);

const stepSummary = (
  entries: readonly DictionaryHistorySummary[],
  step: DictionaryHistoryStep
): DictionaryHistorySummary | null => (step?.kind === 'entry' ? summaryFor(entries, step.id) : null);

const viewOf = (target: DictionaryHistoryTarget): DictionaryView => ({
  word: target.word,
  context: target.context,
  includeEncyclopedia: target.includeEncyclopedia,
  includePalettes: target.includePalettes,
  sourceUri: target.sourceUri,
  relativePath: target.relativePath,
  result: target.result,
  toolName: target.toolName,
  lookupSubject: target.lookupSubject
});

export const useDictionaryHistory = (target: DictionaryHistoryTarget): UseDictionaryHistoryReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{ dictionaryHistoryCursorId?: string | null }>();

  const [navigation, setNavigation] = React.useState<HistoryNavigation>(() => ({
    entries: [],
    durability: null,
    limit: DICTIONARY_HISTORY_LIMIT,
    cursorId: persisted?.dictionaryHistoryCursorId ?? null,
    pendingEntryId: null,
    draft: null
  }));
  const navigationRef = React.useRef(navigation);

  const commit = React.useCallback((patch: Partial<HistoryNavigation>) => {
    navigationRef.current = { ...navigationRef.current, ...patch };
    setNavigation(navigationRef.current);
  }, []);

  const navigationLocked = target.loading || target.isFastGenerating || target.isStreaming;

  const requestHistory = React.useCallback(() => {
    vscode.postMessage({
      type: MessageType.REQUEST_DICTIONARY_HISTORY,
      source: SOURCE,
      payload: {},
      timestamp: Date.now()
    });
  }, [vscode]);

  // The MessageHandler result cache does not replay the list, so ask on mount.
  React.useEffect(() => {
    requestHistory();
  }, [requestHistory]);

  const handleHistory = React.useCallback((message: DictionaryHistoryMessage) => {
    const { entries, durability, limit } = message.payload;
    const listed = new Set(idsOf(entries));
    const { cursorId, pendingEntryId, draft } = navigationRef.current;
    commit({
      entries,
      durability,
      limit,
      cursorId: cursorId !== null && listed.has(cursorId) ? cursorId : null,
      pendingEntryId: pendingEntryId !== null && listed.has(pendingEntryId) ? pendingEntryId : null,
      draft: entries.length === 0 ? null : draft
    });
  }, [commit]);

  const { restoreView } = target;
  const handleHistoryEntry = React.useCallback((message: DictionaryHistoryEntryMessage) => {
    const { pendingEntryId } = navigationRef.current;
    const payload = message.payload;

    if (payload.status === 'found') {
      // Latest wins: a reply for a load the writer has since moved past is stale.
      if (payload.entry.id !== pendingEntryId) {
        return;
      }
      restoreView(dictionaryViewFromEntry(payload.entry));
      commit({ cursorId: payload.entry.id, pendingEntryId: null });
      return;
    }

    if (payload.id === pendingEntryId) {
      commit({ pendingEntryId: null });
    }
    // The entry is gone (deleted or evicted elsewhere), so the list is stale.
    requestHistory();
  }, [commit, requestHistory, restoreView]);

  const loadEntry = React.useCallback((id: string) => {
    commit({ pendingEntryId: id });
    vscode.postMessage({
      type: MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY,
      source: SOURCE,
      payload: { id },
      timestamp: Date.now()
    });
  }, [commit, vscode]);

  /**
   * Stash the current view when leaving it would lose input: it is live, or
   * the form no longer matches the request behind the result. While a load is
   * pending the first step already stashed, and the view has not changed.
   */
  const stashDraftWhenLeavingUnsavedView = React.useCallback(() => {
    const { cursorId, pendingEntryId, entries } = navigationRef.current;
    if (pendingEntryId !== null) {
      return;
    }
    const isLive = summaryFor(entries, cursorId) === null;
    if (isLive || isDictionaryFormDirty(target, target.lookupSubject)) {
      commit({ draft: viewOf(target) });
    }
  }, [commit, target]);

  const applyStep = React.useCallback((step: NonNullable<DictionaryHistoryStep>) => {
    stashDraftWhenLeavingUnsavedView();
    if (step.kind === 'entry') {
      loadEntry(step.id);
      return;
    }
    // The slot now holds the newest unsaved input: the draft the step saw,
    // or edits to the newest entry that the stash just took in its place.
    const { draft } = navigationRef.current;
    if (draft) {
      restoreView(draft);
    }
    commit({ cursorId: null, pendingEntryId: null, draft: null });
  }, [commit, loadEntry, restoreView, stashDraftWhenLeavingUnsavedView]);

  const go = React.useCallback((direction: DictionaryHistoryDirection) => {
    if (navigationLocked) {
      return;
    }
    const { entries, cursorId, pendingEntryId, draft } = navigationRef.current;
    const step = stepDictionaryHistory({
      ids: idsOf(entries),
      position: pendingEntryId ?? cursorId,
      direction,
      hasDraft: draft !== null
    });
    if (step) {
      applyStep(step);
    }
  }, [applyStep, navigationLocked]);

  const goOlder = React.useCallback(() => go('older'), [go]);
  const goNewer = React.useCallback(() => go('newer'), [go]);

  const openEntry = React.useCallback((id: string) => {
    if (navigationLocked) {
      return;
    }
    applyStep({ kind: 'entry', id });
  }, [applyStep, navigationLocked]);

  const deleteEntry = React.useCallback((id: string) => {
    vscode.postMessage({
      type: MessageType.DELETE_DICTIONARY_HISTORY_ENTRY,
      source: SOURCE,
      payload: { id },
      timestamp: Date.now()
    });
  }, [vscode]);

  const clearHistory = React.useCallback(() => {
    commit({ draft: null });
    vscode.postMessage({
      type: MessageType.CLEAR_DICTIONARY_HISTORY,
      source: SOURCE,
      payload: {},
      timestamp: Date.now()
    });
  }, [commit, vscode]);

  const followRecordedEntry = React.useCallback((id?: string) => {
    commit({ cursorId: id ?? null, pendingEntryId: null });
  }, [commit]);

  const beginNewLookup = React.useCallback(() => {
    commit({ cursorId: null, pendingEntryId: null, draft: null });
  }, [commit]);

  const { entries, durability, limit, cursorId, pendingEntryId, draft } = navigation;
  const ids = React.useMemo(() => idsOf(entries), [entries]);
  const positionId = pendingEntryId ?? cursorId;
  const hasDraft = draft !== null;
  const olderStep = stepDictionaryHistory({ ids, position: positionId, direction: 'older', hasDraft });
  const newerStep = stepDictionaryHistory({ ids, position: positionId, direction: 'newer', hasDraft });

  return {
    // State
    entries,
    durability,
    limit,
    cursorId,
    pendingEntryId,
    draft,
    navigationLocked,
    canGoOlder: !navigationLocked && olderStep !== null,
    canGoNewer: !navigationLocked && newerStep !== null,
    position: describeDictionaryHistoryPosition(ids, positionId),
    cursorSummary: summaryFor(entries, cursorId),
    olderSummary: stepSummary(entries, olderStep),
    newerSummary: stepSummary(entries, newerStep),

    // Actions
    requestHistory,
    handleHistory,
    handleHistoryEntry,
    goOlder,
    goNewer,
    openEntry,
    deleteEntry,
    clearHistory,
    followRecordedEntry,
    beginNewLookup,

    // Persistence
    persistedState: {
      dictionaryHistoryCursorId: cursorId
    }
  };
};
