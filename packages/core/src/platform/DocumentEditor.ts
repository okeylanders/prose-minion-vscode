/**
 * DocumentEditor - platform port for following the writer's open documents
 * (ADR 2026-10-21 D3).
 *
 * A `vscode`-free interface so Draft Edit can place its findings against the
 * live text in any host:
 *   - VS Code adapter = `VsCodeDocumentEditor`, over the open `TextDocument`
 *     and its change and close events (the buffer, unsaved edits included).
 *   - Desktop adapter = the desktop app's own document model.
 *
 * Slice 1 is the read half: a watch. A run starts one on the open document
 * at the version its gesture read, before anything is awaited. While the
 * model works, the watch collects each edit the writer makes. It settles to
 * the live text and those edits, so each finding follows its own occurrence
 * through the edits, never a search for its words (PR #171 F-03). It settles
 * to `closed` once the document closes, even if it opens again or changes
 * language: a late reply is never drawn on another lifetime of the document,
 * and a closed document is never reopened to place one (F-04).
 *
 * The write half (Slice 2) is `applyEdits`: one change to the live buffer,
 * checked against the version the edits were placed in, as one undo step,
 * through the writer's review when asked. It never saves. Only Draft Edit's
 * applier calls it, and it never trusts the result alone: it reads what
 * landed from a watch (ADR D4 step 7).
 */

export interface DocumentSnapshot {
  /** Opaque host id (`uri.toString()` in VS Code). */
  readonly uri: string;
  /** Changes on every edit to the buffer. */
  readonly version: number;
  /** The LIVE buffer, unsaved edits included; never the disk. */
  readonly text: string;
  readonly languageId: string;
}

/** One replacement, in offsets of the document as it stood before its change event. */
export interface DocumentTextChange {
  readonly offset: number;
  /** Characters replaced, from `offset`. */
  readonly length: number;
  /** The text that replaced them. */
  readonly text: string;
}

export type DocumentWatchResult =
  /** The document closed while it was watched; whatever opened since is another lifetime. */
  | { readonly kind: 'closed' }
  | {
      readonly kind: 'open';
      readonly snapshot: DocumentSnapshot;
      /** Each change event since the watch began, in order; an event's changes refer to the text before it. */
      readonly edits: ReadonlyArray<readonly DocumentTextChange[]>;
    };

export interface DocumentWatch {
  /** The document now, and how it got there; ends the watch. */
  settle(): DocumentWatchResult;
  /** Ends the watch without reading it. */
  dispose(): void;
}

/** One replacement, in offsets of the document at the `expectedVersion` its apply names. */
export interface DocumentTextEdit {
  readonly start: number;
  readonly end: number;
  readonly newText: string;
  /** What the edit is, for the writer's review: Refactor Preview groups entries by it. */
  readonly label: string;
  /** A longer note beside it in review. */
  readonly description?: string;
}

/** `preview`: the writer reviews the edits and keeps any of them; `direct`: they land at once. */
export type DocumentEditReview = 'preview' | 'direct';

/**
 * What the host did. Whatever it says, only a watch shows what landed: a
 * submitted review may keep some edits and not others.
 */
export type DocumentApplyOutcome =
  /** The host applied the edits, or the ones the writer kept in review. */
  | { readonly kind: 'submitted' }
  /** The writer discarded the review: nothing changed. */
  | { readonly kind: 'declined' }
  /** The document moved past `expectedVersion`, before the edit or during its review: nothing changed. */
  | { readonly kind: 'stale' }
  /** The document is not open. */
  | { readonly kind: 'closed' }
  /** The host refused the edits for another reason. */
  | { readonly kind: 'failed'; readonly message: string };

export interface DocumentEditor {
  /** Follow an open document from `version`; undefined when it is not open at that version. */
  watch(uri: string, version: number): DocumentWatch | undefined;
  /**
   * Make `edits` (non-overlapping, in offsets at `expectedVersion`) one change
   * to the open document: refused at once unless it is open at that version.
   */
  applyEdits(
    uri: string,
    edits: readonly DocumentTextEdit[],
    options: { readonly expectedVersion: number; readonly review: DocumentEditReview }
  ): Promise<DocumentApplyOutcome>;
}
