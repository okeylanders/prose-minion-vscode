/**
 * The edit operations a quote-anchored change is made of (ADR 2026-11-05
 * D2, D3). Pure, feature-free: a memory note's field and a project file are
 * both one text these operate on.
 *
 * - **rewrite**: the text's content replaced whole (after any leading region
 *   the rules skip, such as a file's front matter);
 * - **replace**: a quote of the text as it stands (`find`), found exactly
 *   once, and what takes its place (`with`, which may be empty);
 * - **append** / **prepend**: a passage added at the end or the start of the
 *   content, joined to it by the rules' separator.
 *
 * Quotes, never offsets or line numbers (Draft Edit's rule).
 */

export type TextEditOperation =
  | { readonly op: 'rewrite'; readonly text: string }
  | { readonly op: 'replace'; readonly find: string; readonly with: string }
  | { readonly op: 'append' | 'prepend'; readonly text: string };

export type TextEditOperationKind = TextEditOperation['op'];

/** What a target lets a plan do. */
export interface TextEditRules {
  /** Whether `rewrite` is allowed; a refused one is `not-allowed`. */
  readonly allowsRewrite: boolean;
  /**
   * Characters at the start that `rewrite` and `prepend` leave alone (a
   * file's front matter). Quotes are still found in the whole text, so a
   * quote that also stands there is ambiguous. Default 0.
   */
  readonly skipLeading?: number;
  /** What joins an appended or prepended passage to the content. Default a blank line. */
  readonly separator?: string;
}

export const TEXT_EDIT_FAULTS = ['not-found', 'ambiguous', 'overlapping', 'conflicting-operations', 'not-allowed'] as const;
export type TextEditFaultKind = typeof TEXT_EDIT_FAULTS[number];

/** One operation's fault, by its index in the list given. */
export interface TextEditFault {
  readonly index: number;
  readonly fault: TextEditFaultKind;
}

/** One operation, placed: the range of the text it replaces and what it writes there. */
export interface PlannedTextOperation {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * One range to change, in the text as given. Operations whose ranges touch
 * are joined into one edit, so no two edits touch or overlap; `operations`
 * names the operations it carries, in the order written into it.
 */
export interface PlannedTextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly operations: readonly number[];
}

export type TextEditPlan =
  | {
    readonly kind: 'planned';
    /** Sorted by start, none touching. */
    readonly edits: readonly PlannedTextEdit[];
    /** Every operation, placed, in the order given. */
    readonly operations: readonly PlannedTextOperation[];
  }
  | {
    readonly kind: 'faulted';
    /** Every operation that faulted, by index; an operation may fault more than once. */
    readonly faults: readonly TextEditFault[];
  };
