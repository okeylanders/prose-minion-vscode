/**
 * useDictionaryPriorLookup — the "looked up before" check (ADR 2026-10-14, D9).
 *
 * Before a lookup is submitted, a phrase already in the history is offered
 * back to the writer: open the recorded entry for free, or look it up again.
 * A presentation controller: it holds only the pending offer, and reaches
 * history and submission through injected callbacks, never the transport.
 *
 * The offer keeps the phrase and mode, not the matches. Matches are derived
 * from the current list on every render, so a delete or eviction elsewhere
 * drops a stale offer instead of opening an entry that is gone, and a form
 * that no longer names the phrase hides it.
 */

import * as React from 'react';
import { DictionaryHistorySummary, DictionaryLookupMode } from '@messages';
import { dictionaryPhraseKey, findPriorDictionaryLookups } from '@utils/dictionaryHistoryNavigation';

export interface UseDictionaryPriorLookupOptions {
  /** Newest first, as the host sends them. */
  entries: DictionaryHistorySummary[];
  cursorId: string | null;
  /** The form's word as typed; the offer shows only while it names the phrase. */
  formWord: string;
  openEntry: (id: string) => void;
  /** Submit the form as it stands now, skipping this check. */
  submitFormLookup: (mode: DictionaryLookupMode) => void;
}

export interface DictionaryPriorLookupOffer {
  word: string;
  mode: DictionaryLookupMode;
  /** Newest first; never empty. */
  matches: DictionaryHistorySummary[];
}

export interface DictionaryPriorLookupState {
  priorLookup: DictionaryPriorLookupOffer | null;
}

export interface DictionaryPriorLookupActions {
  /**
   * Called by every submit path. Returns `true` when the phrase is in the
   * history and an offer now stands in for the lookup, so the caller must
   * not submit; `false` when the caller should submit as usual.
   */
  offerPriorLookup: (word: string, mode: DictionaryLookupMode) => boolean;
  /** Restore the newest matching entry. Nothing is generated. */
  openPriorLookup: () => void;
  /** Run the lookup the offer interrupted, against the form as it stands. */
  lookUpAgain: () => void;
  dismissPriorLookup: () => void;
}

export interface DictionaryPriorLookupPersistence {
  // The offer is transient; the host owns the history it points into.
}

export type UseDictionaryPriorLookupReturn = DictionaryPriorLookupState &
  DictionaryPriorLookupActions & {
    persistedState: DictionaryPriorLookupPersistence;
  };

interface PendingOffer {
  word: string;
  mode: DictionaryLookupMode;
}

export function useDictionaryPriorLookup({
  entries,
  cursorId,
  formWord,
  openEntry,
  submitFormLookup
}: UseDictionaryPriorLookupOptions): UseDictionaryPriorLookupReturn {
  const [pending, setPending] = React.useState<PendingOffer | null>(null);

  const offerPriorLookup = React.useCallback((word: string, mode: DictionaryLookupMode) => {
    if (findPriorDictionaryLookups(entries, word, cursorId).length === 0) {
      setPending(null);
      return false;
    }
    setPending({ word, mode });
    return true;
  }, [entries, cursorId]);

  const matches = React.useMemo(
    () => (pending && dictionaryPhraseKey(formWord) === dictionaryPhraseKey(pending.word)
      ? findPriorDictionaryLookups(entries, pending.word, cursorId)
      : []),
    [pending, formWord, entries, cursorId]
  );
  const priorLookup = pending && matches.length > 0 ? { ...pending, matches } : null;

  const openPriorLookup = React.useCallback(() => {
    if (matches.length === 0) {
      return;
    }
    setPending(null);
    openEntry(matches[0].id);
  }, [matches, openEntry]);

  const lookUpAgain = React.useCallback(() => {
    if (!pending) {
      return;
    }
    setPending(null);
    submitFormLookup(pending.mode);
  }, [pending, submitFormLookup]);

  const dismissPriorLookup = React.useCallback(() => setPending(null), []);

  return {
    priorLookup,
    offerPriorLookup,
    openPriorLookup,
    lookUpAgain,
    dismissPriorLookup,
    persistedState: {}
  };
}
