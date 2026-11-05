/**
 * Persona file edits (ADR 2026-11-05 D4, D5): the request the one gateway
 * takes, the policies by target, and what it answers. Pure data.
 *
 * - **A request doesn't care where it came from** (D4.1): a trailer's
 *   proposal builds it today, a later capability builds the same one (D10).
 * - **Targets are keys, never paths** (D4.2): a configured resource by
 *   `{ group, path }`, looked up in a fresh catalog, or the room's excerpt
 *   at the version the proposal was made against.
 * - **Policies are data** (D5): every group has a kind, and every kind a
 *   policy row. A new group does not compile until it has one.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types/context';
import type { TextEditFaultKind, TextEditOperation } from '@/utils/textEdits/textEditOperations';

export type FileEditTarget =
  | { readonly kind: 'resource'; readonly group: ContextPathGroup; readonly path: string }
  /** The room's excerpt document, as it stood at `excerptVersion`. */
  | { readonly kind: 'excerpt'; readonly excerptVersion: number };

export type FileEditSource = { readonly kind: 'proposal'; readonly turnId: string; readonly index: number };

export interface FileEditRequest {
  readonly target: FileEditTarget;
  readonly operations: readonly TextEditOperation[];
  readonly source: FileEditSource;
}

export interface FileEditApplyOptions {
  /** `direct`: the card was the review (Apply); `preview`: Refactor Preview (Review in editor…). */
  readonly review: 'direct' | 'preview';
}

/** Prose is the writer's draft; notes are everything else the project keeps. */
export type FileEditTargetKind = 'prose' | 'notes';

export const FILE_EDIT_GROUP_KINDS: Readonly<Record<ContextPathGroup, FileEditTargetKind>> = {
  chapters: 'prose',
  manuscript: 'prose',
  characters: 'notes',
  locations: 'notes',
  themes: 'notes',
  things: 'notes',
  projectBrief: 'notes',
  general: 'notes'
};

export interface FileEditTargetPolicy {
  /** Whether a whole-file rewrite (after front matter) is allowed. */
  readonly allowsRewrite: boolean;
  /** The applier's rules (ADR 2026-10-21 D4). */
  readonly allowsNewlineChanges: boolean;
  readonly preservesMarkdownStructure: boolean;
  /** With structure preserved, whether paragraphs may still merge, split or be added. */
  readonly paragraphsMayMergeOrSplit: boolean;
  /** Words an append or prepend may add; undefined when unbounded. */
  readonly passageWords?: number;
  /** The share of the touched paragraphs' characters replaces may change; undefined when unbounded. */
  readonly rewriteCeilingShare?: number;
}

const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

/** D5's table. */
export const FILE_EDIT_TARGET_POLICIES: Readonly<Record<FileEditTargetKind, FileEditTargetPolicy>> = {
  // A chapter is never rewritten whole; paragraphs may merge or split, its Markdown structure holds.
  prose: {
    allowsRewrite: false,
    allowsNewlineChanges: true,
    preservesMarkdownStructure: true,
    paragraphsMayMergeOrSplit: true,
    passageWords: BOUNDS.appendWords,
    rewriteCeilingShare: BOUNDS.rewriteCeilingShare
  },
  notes: { allowsRewrite: true, allowsNewlineChanges: true, preservesMarkdownStructure: false, paragraphsMayMergeOrSplit: true }
};

/** Why a request was refused before anything was planned. */
export type FileEditRefusal =
  | 'no-operations'
  | 'unknown-group'
  | 'unsafe-path'
  | 'not-configured'
  | 'ambiguous-path'
  | 'outside-workspace'
  | 'not-text'
  | 'too-large'
  | 'catalog-unreadable'
  | 'no-excerpt'
  | 'excerpt-manual'
  | 'excerpt-stale'
  | 'unreadable';

/** An operation's fault: the planner's, or the prose policy's. */
export type FileEditOperationFault = TextEditFaultKind | 'passage-too-long' | 'over-rewrite-ceiling';
