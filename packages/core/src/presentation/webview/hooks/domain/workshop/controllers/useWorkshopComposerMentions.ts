/**
 * Presentation controller for `@` in the Workshop composer (Everyday
 * Conveniences round two, item G): whether the file list is open, what it
 * shows, which option is active, and what a key or a pick does to the draft.
 *
 * The composer owns the draft. It tells this controller the draft and the
 * caret (`syncDraft`), offers it each key first (`keyDown`), and applies the
 * edit a pick returns. The pure rules are `workshopComposerMentions`.
 *
 * - **The pill is the truth** (decision A1). A pick stages the file by its
 *   catalog key through the message-attach action the project picker uses,
 *   and writes the file's token into the sentence as prose. Nothing reads a
 *   token back: deleting one leaves its pill, and removing a pill leaves the
 *   text.
 * - **No double attach.** A file already staged for this message takes its
 *   token and stages nothing.
 * - **Sectioned** (decision A2): Files now, so People can join later. The
 *   last option, Browse project…, opens the project picker for this message.
 * - **Enter and Tab pick only an active option.** With matches the first is
 *   active. With none, nothing is, and Enter sends as it always has; ↓
 *   reaches Browse project….
 * - **Escape closes the list for that `@`** and keeps what was typed. A new
 *   `@` opens it again.
 * - **Nothing shows during IME composition.**
 *
 * The catalog is asked for each time the list opens; the last one held
 * shows meanwhile. Nothing here is persisted, and nothing is logged.
 *
 * A controller: every host effect is injected, and nothing here posts.
 */

import * as React from 'react';
import type {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  WorkshopMessageAttachmentSnapshot
} from '@messages';
import {
  applyWorkshopMentionPick,
  detectWorkshopMentionTrigger,
  filterWorkshopMentionFiles,
  removeWorkshopMentionTrigger,
  workshopMentionKey,
  type WorkshopMentionEdit,
  type WorkshopMentionFileRow,
  type WorkshopMentionTrigger
} from '@utils/workshop/workshopComposerMentions';

export interface UseWorkshopComposerMentionsOptions {
  /** The configured-resource catalog; null until the host has answered once. */
  catalog: readonly ConfiguredResourceEntry[] | null;
  /** The pills already staged for this message (host truth). */
  staged: readonly WorkshopMessageAttachmentSnapshot[];
  /** False while the composer cannot attach (no session yet). */
  enabled: boolean;
  /** Asks the host for a fresh catalog. */
  onRequestCatalog: () => void;
  /** Stages configured files for this message, by catalog key. */
  onAttach: (items: ConfiguredResourceRef[]) => void;
  /** Opens the project picker for this message. */
  onBrowse: () => void;
}

/** One section of the list. Files is the only one today (decision A2). */
export interface WorkshopMentionSection {
  id: 'files';
  label: string;
  rows: readonly WorkshopMentionFileRow[];
  /** Files the query keeps beyond the rows drawn. */
  more: number;
}

export interface WorkshopComposerMentionsState {
  open: boolean;
  /** Open, and the first catalog has not arrived. */
  loading: boolean;
  query: string;
  sections: readonly WorkshopMentionSection[];
  /** Index of Browse project…, the last option: file rows come first. */
  browseIndex: number;
  /** The active option's index, or -1 for none. */
  activeIndex: number;
  /** What a screen reader hears of the list ("6 files"). */
  status: string;
}

/** A key as the composer offers it. */
export interface WorkshopMentionKey {
  key: string;
  shiftKey: boolean;
}

export interface WorkshopMentionKeyResult {
  /** True when the list took the key: the composer does nothing else with it. */
  handled: boolean;
  /** The draft to apply, when the key picked an option. */
  edit?: WorkshopMentionEdit;
}

export interface WorkshopComposerMentionsActions {
  /** The draft and caret as they now stand. */
  syncDraft: (text: string, caret: number) => void;
  /** Offers a key to the list before the composer acts on it. */
  keyDown: (input: WorkshopMentionKey, text: string) => WorkshopMentionKeyResult;
  /** Picks an option by index (a click); returns the draft to apply. */
  pickOption: (index: number, text: string) => WorkshopMentionEdit | undefined;
  setActiveIndex: (index: number) => void;
  /** Closes the list (the composer lost focus); the draft is untouched. */
  close: () => void;
  setComposing: (composing: boolean) => void;
}

export interface WorkshopComposerMentionsPersistence {
  // The list is transient: nothing of it outlives the composer.
}

export type UseWorkshopComposerMentionsReturn = WorkshopComposerMentionsState &
  WorkshopComposerMentionsActions & {
    persistedState: WorkshopComposerMentionsPersistence;
  };

const NO_ROWS: readonly WorkshopMentionFileRow[] = [];
const PERSISTED: WorkshopComposerMentionsPersistence = {};

const sameTrigger = (a: WorkshopMentionTrigger | null, b: WorkshopMentionTrigger | null): boolean =>
  a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end && a.query === b.query);

function mentionStatus(loading: boolean, hasQuery: boolean, shown: number, total: number): string {
  if (loading) {
    return 'Loading project files';
  }
  if (total === 0) {
    return hasQuery ? 'No files match' : 'No project files are configured';
  }
  const count = `${total.toLocaleString('en-US')} ${total === 1 ? 'file' : 'files'}`;
  return total > shown ? `${count}, the first ${shown.toLocaleString('en-US')} shown` : count;
}

export function useWorkshopComposerMentions({
  catalog,
  staged,
  enabled,
  onRequestCatalog,
  onAttach,
  onBrowse
}: UseWorkshopComposerMentionsOptions): UseWorkshopComposerMentionsReturn {
  const [trigger, setTrigger] = React.useState<WorkshopMentionTrigger | null>(null);
  /** The `@` Escape closed the list for; another `@` opens it again. */
  const [dismissedStart, setDismissedStart] = React.useState<number | null>(null);
  /** The option the writer moved to, and the `@…` it was moved in: typing more gives the default back. */
  const [moved, setMoved] = React.useState<{ index: number; start: number; query: string } | null>(null);
  const [composing, setComposing] = React.useState(false);

  const open = enabled && !composing && trigger !== null && trigger.start !== dismissedStart;
  const query = trigger?.query ?? '';

  const stagedKeys = React.useMemo(
    () => new Set(staged.flatMap((attachment) =>
      attachment.configuredResource ? [workshopMentionKey(attachment.configuredResource)] : []
    )),
    [staged]
  );
  const matches = React.useMemo(
    () => (open && catalog ? filterWorkshopMentionFiles(catalog, query, stagedKeys) : { rows: NO_ROWS, total: 0 }),
    [open, catalog, query, stagedKeys]
  );
  const rows = matches.rows;
  const browseIndex = rows.length;
  const movedIndex = moved !== null && moved.start === trigger?.start && moved.query === query ? moved.index : null;
  const activeIndex = !open ? -1 : movedIndex !== null ? Math.min(movedIndex, browseIndex) : rows.length > 0 ? 0 : -1;
  const loading = open && catalog === null;

  const requestCatalogWhenOpened = React.useCallback(() => {
    if (open) {
      onRequestCatalog();
    }
  }, [open, onRequestCatalog]);
  React.useEffect(requestCatalogWhenOpened, [requestCatalogWhenOpened]);

  const syncDraft = React.useCallback((text: string, caret: number) => {
    const next = detectWorkshopMentionTrigger(text, caret);
    setTrigger((current) => (sameTrigger(current, next) ? current : next));
    setDismissedStart((current) => (current !== null && next?.start !== current ? null : current));
  }, []);

  const close = React.useCallback(() => {
    setTrigger(null);
  }, []);

  const setActiveIndex = React.useCallback((index: number) => {
    setMoved(trigger === null ? null : { index, start: trigger.start, query: trigger.query });
  }, [trigger]);

  const pickOption = React.useCallback((index: number, text: string): WorkshopMentionEdit | undefined => {
    if (!open || trigger === null || index < 0 || index > browseIndex) {
      return undefined;
    }
    close();
    if (text.slice(trigger.start, trigger.end) !== `@${trigger.query}`) {
      // The draft moved on without telling us: touch nothing.
      return undefined;
    }
    if (index === browseIndex) {
      onBrowse();
      return removeWorkshopMentionTrigger(text, trigger);
    }
    const row = rows[index];
    if (!row.staged) {
      onAttach([{ group: row.entry.group, path: row.entry.path }]);
    }
    return applyWorkshopMentionPick(text, trigger, row.token);
  }, [open, trigger, browseIndex, rows, close, onAttach, onBrowse]);

  const keyDown = React.useCallback((input: WorkshopMentionKey, text: string): WorkshopMentionKeyResult => {
    if (!open || trigger === null) {
      return { handled: false };
    }
    const count = browseIndex + 1;
    switch (input.key) {
      case 'ArrowDown':
        setActiveIndex((activeIndex + 1) % count);
        return { handled: true };
      case 'ArrowUp':
        setActiveIndex(activeIndex <= 0 ? count - 1 : activeIndex - 1);
        return { handled: true };
      case 'Escape':
        setDismissedStart(trigger.start);
        return { handled: true };
      case 'Enter':
      case 'Tab':
        if (input.shiftKey || activeIndex < 0) {
          return { handled: false };
        }
        return { handled: true, edit: pickOption(activeIndex, text) };
      default:
        return { handled: false };
    }
  }, [open, trigger, browseIndex, activeIndex, pickOption, setActiveIndex]);

  const sections = React.useMemo<readonly WorkshopMentionSection[]>(
    () => [{ id: 'files', label: 'Files', rows, more: matches.total - rows.length }],
    [rows, matches.total]
  );

  return {
    open,
    loading,
    query,
    sections,
    browseIndex,
    activeIndex,
    status: open ? mentionStatus(loading, query.length > 0, rows.length, matches.total) : '',
    syncDraft,
    keyDown,
    pickOption,
    setActiveIndex,
    close,
    setComposing,
    persistedState: PERSISTED
  };
}
