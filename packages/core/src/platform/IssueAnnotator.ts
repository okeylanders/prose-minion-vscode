/**
 * IssueAnnotator - platform port for showing Draft Edit's flags on a document
 * without changing it (ADR 2026-10-21 D3, D7).
 *
 * A `vscode`-free interface:
 *   - VS Code adapter = `VsCodeIssueAnnotator`: diagnostics (squiggles, the
 *     Problems panel, F8) and a Dismiss code action.
 *   - Another host may render annotations its own way, or not at all.
 *
 * The adapter keeps shown annotations on their text while the writer types,
 * so it, not core, knows where a shown flag now sits. That is why Dismiss is
 * `remove` by id rather than a fresh `show` from stale offsets, and why a
 * quick fix (Slice 2) asks `current` where its flag is before core writes.
 */

export type DocumentAnnotationSeverity = 'info' | 'warning';

export interface DocumentAnnotation {
  /** The issue's id: a code action's handle back to core. */
  readonly id: string;
  /** Offsets into the document at the `version` passed to `show`. */
  readonly start: number;
  readonly end: number;
  readonly severity: DocumentAnnotationSeverity;
  /** A stable kind, e.g. `proofread.tense`. */
  readonly code: string;
  readonly message: string;
  /**
   * The replacement a quick fix offers, routed back to core by `id`, never a
   * raw edit. `preferred`: a fix Proofread would make itself, not a judgment
   * call's suggestion.
   */
  readonly fix?: { readonly replacement: string; readonly preferred: boolean };
}

/** A document's shown annotations, where they sit now, at its current version. */
export interface ShownAnnotations {
  readonly version: number;
  readonly annotations: readonly DocumentAnnotation[];
}

export interface IssueAnnotator {
  /**
   * Replace every annotation this engine shows for `uri`. The adapter
   * refuses a `version` that is no longer the document's, so a flag is
   * never drawn on moved text; it returns whether the annotations are shown.
   */
  show(uri: string, version: number, annotations: readonly DocumentAnnotation[]): boolean;
  /** Withdraw some annotations, wherever the writer's edits have since moved them. */
  remove(uri: string, ids: readonly string[]): void;
  /** Withdraw a document's annotations, or every document's when `uri` is absent. */
  clear(uri?: string): void;
  /** Where `uri`'s shown annotations sit now; undefined when its document is not open or shows none. */
  current(uri: string): ShownAnnotations | undefined;
}
