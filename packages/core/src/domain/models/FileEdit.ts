/**
 * Persona file edits at Apply (ADR 2026-11-05 D5, D7): the staged proposal
 * the gateway takes, the policies by class, and the names of what it can
 * refuse. Pure data. Staging's own types are `FileEditStaging`.
 *
 * - **A request doesn't care where it came from** (D4, D12): a trailer's
 *   staged proposal today, a later capability the same.
 * - **The class is decided by identity** (D5), never by a trailer's group;
 *   policies are data keyed by class.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { DraftEditStructureMode } from '@/domain/models/DraftEdit';
import type { FileEditBaseline, FileEditClass, FileEditIdentity } from '@/domain/models/FileEditStaging';
import type { TextEditFaultKind, TextEditOperation } from '@/utils/textEdits/textEditOperations';

export type FileEditSource = { readonly kind: 'proposal'; readonly turnId: string; readonly index: number };

/** A proposal as staging left it: its identity, class and baseline, and its operations. */
export interface StagedFileEdit {
  readonly target: FileEditIdentity;
  readonly class: FileEditClass;
  readonly baseline: FileEditBaseline;
  readonly operations: readonly TextEditOperation[];
  readonly source: FileEditSource;
}

export interface FileEditApplyOptions {
  /** `direct`: the card was the review (Apply); `preview`: Refactor Preview (Review in editor…). */
  readonly review: 'direct' | 'preview';
  /**
   * The handler's last dispatch boundary (D8): whether the claim is held,
   * the room and turn are the same and the setting is still `ask`. Called
   * with nothing awaited between it and the applier's call.
   */
  readonly stillCurrent: () => boolean;
}

/** Context groups whose members are prose (D5). */
export const FILE_EDIT_PROSE_GROUPS: ReadonlySet<string> = new Set(['chapters', 'manuscript']);

export interface FileEditClassPolicy {
  /** Whether a whole-content rewrite (after front matter) is allowed. */
  readonly allowsRewrite: boolean;
  readonly allowsNewlineChanges: boolean;
  readonly structure: DraftEditStructureMode;
  /** Each append or prepend's bounds; undefined when unbounded. */
  readonly insertion?: { readonly words: number; readonly characters: number };
  /** The rewrite ceiling over the touched paragraphs; undefined when none. */
  readonly ceiling?: { readonly share: number; readonly floorCharacters: number };
}

const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

/** D5's table. */
export const FILE_EDIT_TARGET_POLICIES: Readonly<Record<FileEditClass, FileEditClassPolicy>> = {
  prose: {
    allowsRewrite: false,
    allowsNewlineChanges: true,
    structure: 'prose-paragraphs',
    insertion: { words: BOUNDS.insertWords, characters: BOUNDS.insertCharacters },
    ceiling: { share: BOUNDS.rewriteCeilingShare, floorCharacters: BOUNDS.rewriteFloorCharacters }
  },
  notes: { allowsRewrite: true, allowsNewlineChanges: true, structure: 'free' }
};

/** Why an Apply was refused, before or instead of any write. */
export type FileEditApplyRefusal =
  | 'no-operations'
  | 'no-longer-configured'
  | 'outside-workspace'
  | 'catalog-unreadable'
  | 'unreadable'
  | 'identity-changed'
  | 'not-text'
  | 'too-large'
  | 'superseded'
  | 'host-failed';

/** An operation's fault at Apply: the planner's, freshness, or the class policy's. */
export type FileEditOperationFault =
  | TextEditFaultKind
  | 'baseline-changed'
  | 'insertion-too-long'
  | 'rewrite-ceiling'
  | 'rewrite-protected'
  | 'rewrite-too-large';
