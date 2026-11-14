/**
 * EditorSelectionSnapshots: what you saw is what was sent (ADR 2026-11-14
 * D11).
 *
 * A snapshot is the editor's selection at one moment, under a host-minted
 * opaque id. The Workshop shows a snapshot's metadata on a pill and names
 * the snapshot by id when it stages or sends it, so the text attached is the
 * text the pill described, whatever the editor's selection is by then. The
 * selection's text never travels to a webview, and never comes back from one.
 *
 * - **One selection, one id.** Capturing the same document, lines and text
 *   as the newest snapshot returns that snapshot.
 * - **Cut at capture** to `PROMPT_BUDGETS.workshopSelectedText` (words and
 *   characters, whichever is tighter), at a word boundary, line breaks kept.
 * - **The newest `snapshots` are kept.** A staged pill has already copied
 *   its text into the session, so a snapshot is needed only between the pill
 *   and the send. An evicted id is simply unknown.
 * - **The cache is the window's, not a room's.** Replacing the room empties
 *   nothing here; eviction is by count alone. What binds a pill to the room
 *   it was shown in is the send's `roomRevision`.
 * - **Watching is throttled:** at most one capture per `pushIntervalMs`, and
 *   the trailing edge always fires, so the last selection of a drag is the
 *   one shown. The port's event is raw; the throttle is here, so it is
 *   tested with fake timers and no VS Code.
 *
 * Built only in `extension.ts`, one per window, and placed in `CoreServices`.
 * Logs carry ids and counts, never the text, a path or lines.
 */

import { createHash, randomUUID } from 'crypto';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import type { ActiveSelectionInfo, EditorContext, LogSink, PlatformDisposable } from '@/platform';
import type { EditorSelectionSnapshot } from '@/application/services/workshop/selection/WorkshopSelectedTextAttachment';

export type EditorSelectionSource = Pick<EditorContext, 'currentSelection' | 'onDidChangeSelection'>;

/** Hears the current selection as a snapshot, or `undefined` when nothing is selected. */
export type EditorSelectionWatcher = (current: EditorSelectionSnapshot | undefined) => void;

export interface EditorSelectionSnapshotsOptions {
  /** Mints a snapshot's id; a UUID by default. */
  mintId?: () => string;
}

interface StoredSnapshot {
  readonly snapshot: EditorSelectionSnapshot;
  /** What makes two captures one selection: the document, its lines and the whole text's hash. Host-private. */
  readonly key: string;
}

const ABSOLUTE_PATH = /^(?:[a-zA-Z]:[\\/]|[\\/])/;
const BOUNDS = PROMPT_BUDGETS.workshopSelectedText;

export class EditorSelectionSnapshots {
  /** Oldest first; at most `BOUNDS.snapshots`. */
  private readonly kept: StoredSnapshot[] = [];
  private readonly watchers = new Set<EditorSelectionWatcher>();
  private readonly mintId: () => string;
  private subscription?: PlatformDisposable;
  private timer?: ReturnType<typeof setTimeout>;
  private lastPushAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly editor: EditorSelectionSource,
    private readonly log: LogSink,
    options: EditorSelectionSnapshotsOptions = {}
  ) {
    this.mintId = options.mintId ?? randomUUID;
  }

  /**
   * The selection now, as a snapshot: the newest one again when nothing
   * about it changed, a new one otherwise. `undefined` when no editor has
   * had focus, its document has closed, or nothing is selected.
   */
  capture(): EditorSelectionSnapshot | undefined {
    const selection = this.editor.currentSelection();
    if (!selection || selection.isEmpty || selection.text.trim().length === 0) {
      return undefined;
    }
    const startLine = Number.isSafeInteger(selection.startLine) && (selection.startLine as number) >= 1
      ? (selection.startLine as number)
      : 1;
    const endLine = Number.isSafeInteger(selection.endLine) && (selection.endLine as number) >= startLine
      ? (selection.endLine as number)
      : startLine;
    const key = selectionKey(selection, startLine, endLine);
    const newest = this.kept[this.kept.length - 1];
    if (newest && newest.key === key) {
      return newest.snapshot;
    }
    const cut = cutToSelectedTextBound(selection.text);
    const snapshot: EditorSelectionSnapshot = {
      id: this.mintId(),
      text: cut.text,
      displayPath: displayPathOf(selection),
      startLine,
      endLine,
      words: cut.words,
      ...(cut.truncation ? { truncation: cut.truncation } : {})
    };
    this.kept.push({ snapshot, key });
    const evicted = Math.max(0, this.kept.length - BOUNDS.snapshots);
    if (evicted > 0) {
      this.kept.splice(0, evicted);
    }
    this.log.appendLine(
      `[EditorSelectionSnapshots] Snapshot captured: id=${snapshot.id}, words=${snapshot.words}, ` +
      `cut=${snapshot.truncation ? `yes (of ${snapshot.truncation.totalWords})` : 'no'}, kept=${this.kept.length}, evicted=${evicted}`
    );
    return snapshot;
  }

  /** A kept snapshot by id; `undefined` once it was evicted, or for an id this window never minted. */
  find(id: string): EditorSelectionSnapshot | undefined {
    return this.kept.find((stored) => stored.snapshot.id === id)?.snapshot;
  }

  /**
   * Hear the selection as it changes, throttled, with the trailing edge.
   * Nothing is sent on subscribe: a watcher reads `capture()` for the state
   * it starts from. The port is listened to only while someone watches.
   */
  watch(watcher: EditorSelectionWatcher): PlatformDisposable {
    this.watchers.add(watcher);
    this.subscription ??= this.editor.onDidChangeSelection(() => this.selectionChanged());
    return {
      dispose: () => {
        this.watchers.delete(watcher);
        if (this.watchers.size === 0) {
          this.stopListening();
        }
      }
    };
  }

  dispose(): void {
    this.watchers.clear();
    this.stopListening();
    this.kept.length = 0;
  }

  private selectionChanged(): void {
    if (this.timer !== undefined) {
      return; // The pending push will read the selection as it stands then: the trailing edge.
    }
    const wait = this.lastPushAt + BOUNDS.pushIntervalMs - Date.now();
    if (wait <= 0) {
      this.push();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.push();
    }, wait);
  }

  private push(): void {
    this.lastPushAt = Date.now();
    const current = this.capture();
    for (const watcher of Array.from(this.watchers)) {
      try {
        watcher(current);
      } catch {
        // A watcher's failure is its own; the others still hear the selection.
      }
    }
  }

  private stopListening(): void {
    this.subscription?.dispose();
    this.subscription = undefined;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}

function selectionKey(selection: ActiveSelectionInfo, startLine: number, endLine: number): string {
  const text = createHash('sha256').update(selection.text, 'utf8').digest('hex');
  return `${selection.uriString}\n${startLine}-${endLine}\n${text}`;
}

/** Workspace-relative as the host gave it; a path the host could only give absolutely is shown by its file name. */
function displayPathOf(selection: ActiveSelectionInfo): string {
  const path = selection.relativePath.trim();
  if (path.length === 0) {
    return 'Untitled';
  }
  if (!ABSOLUTE_PATH.test(path)) {
    return path;
  }
  return path.split(/[\\/]/).filter((part) => part.length > 0).pop() ?? 'Untitled';
}

/**
 * The head slice a selection is cut to (ADR 2026-11-14 D15): at most the
 * bound's words and characters, ending at a word's end, with the text's own
 * line breaks and spacing kept. A selection inside both bounds is returned
 * as it is.
 */
export function cutToSelectedTextBound(text: string): {
  text: string;
  words: number;
  truncation?: { keptWords: number; totalWords: number };
} {
  const totalWords = countWords(text);
  if (totalWords <= BOUNDS.words && text.length <= BOUNDS.characters) {
    return { text, words: totalWords };
  }
  const word = /\S+/g;
  let end = 0;
  let keptWords = 0;
  for (let match = word.exec(text); match !== null; match = word.exec(text)) {
    const wordEnd = match.index + match[0].length;
    if (keptWords >= BOUNDS.words || wordEnd > BOUNDS.characters) {
      break;
    }
    end = wordEnd;
    keptWords += 1;
  }
  if (keptWords === 0) {
    // One unbroken run longer than the character bound: cut inside it, never inside a surrogate pair.
    const head = text.trimStart().slice(0, BOUNDS.characters);
    const last = head.charCodeAt(head.length - 1);
    const kept = last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
    return { text: kept, words: 1, truncation: { keptWords: 1, totalWords } };
  }
  return { text: text.slice(0, end), words: keptWords, truncation: { keptWords, totalWords } };
}
