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
  /** What the proposal was asked for, when that holds it to a stricter policy than its class (ADR 2026-11-10 D6). */
  readonly intent?: FileEditIntent;
}

export interface FileEditApplyOptions {
  /** `direct`: the card was the review (Apply); `preview`: Refactor Preview (Review in editor…). */
  readonly review: 'direct' | 'preview';
  /**
   * The caller's authority predicate (D7.6, D8): the claim is held, the room
   * generation captured at the action is unchanged, and the setting is still
   * `ask`. Called synchronously at the last boundary and before every
   * attempt, with nothing awaited before the host's call.
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

/**
 * What a proposal was asked for, when that is narrower than its file's class
 * allows (ADR 2026-11-10 D6). `fixes`: the answer to a reply's fixes offer.
 */
export type FileEditIntent = 'fixes';

export interface FileEditIntentPolicy {
  /** The only operations it takes. */
  readonly operations: ReadonlySet<TextEditOperation['op']>;
  /** The most one pair may change, on each side, measured as the rewrite ceiling measures `changed`. */
  readonly changedCharacters: number;
  readonly allowsNewlineChanges: boolean;
  readonly structure: DraftEditStructureMode;
}

/**
 * D6's table: data beside the class policies. An intent only narrows: the
 * gateway applies it on top of the class policy, at staging and on every
 * apply attempt. A proposal with no intent takes its class policy unchanged.
 */
export const FILE_EDIT_INTENT_POLICIES: Readonly<Record<FileEditIntent, FileEditIntentPolicy>> = {
  fixes: {
    operations: new Set(['replace']),
    changedCharacters: PROMPT_BUDGETS.workshopEditOffers.fixChangedCharacters,
    allowsNewlineChanges: false,
    structure: 'strict'
  }
};

/** The one fault an intent policy gives: the edit is more than what was asked for. */
export const FILE_EDIT_MORE_THAN_A_FIX = 'more-than-a-fix';

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
  | 'authority-changed'
  | 'host-failed';

/** An operation's fault at Apply: the planner's, freshness, or the class policy's. */
export type FileEditOperationFault =
  | TextEditFaultKind
  | 'baseline-changed'
  | 'insertion-too-long'
  | 'rewrite-ceiling'
  | 'rewrite-protected'
  | 'rewrite-too-large'
  | typeof FILE_EDIT_MORE_THAN_A_FIX;

/**
 * What one landed operation wrote (D10, N-01), for a future Revert: its text
 * before and after, up to `landedContextCharacters` of the text after the
 * apply on each side, and the document's version after. Past
 * `revertCharacters`, or when the version after is not known, only hashes.
 */
export type FileEditLandedRecord =
  | {
    readonly operation: number;
    readonly before: string;
    readonly after: string;
    readonly contextBefore: string;
    readonly contextAfter: string;
    readonly versionAfter: number;
  }
  | {
    readonly operation: number;
    readonly beforeSha256: string;
    readonly afterSha256: string;
  };

/** The card's state after an Apply (D8), less `pending` and `applying`, which are the handler's. */
export type FileEditApplyState = 'applied' | 'partial' | 'declined' | 'stale' | 'refused' | 'unknown';

export interface FileEditOperationOutcome {
  readonly index: number;
  readonly outcome: 'landed' | 'not-applied' | 'unknown' | 'refused' | 'stale';
  readonly reason?: string;
}

export interface FileEditApplyOutcome {
  readonly state: FileEditApplyState;
  /** Why it was refused or stale, when it was. */
  readonly reason?: string;
  /** Every operation, in the order given. */
  readonly operations: readonly FileEditOperationOutcome[];
  /** The document after, while it is open. */
  readonly document?: { readonly uri: string; readonly version: number };
  /** Whether the document was shown because no editor showed it. */
  readonly revealed: boolean;
  readonly message: string;
  /** One record per landed operation (D10), when any landed. */
  readonly landed?: readonly FileEditLandedRecord[];
}

/** A rewrite's card preview (D9): its before and after while the baseline holds, else stale or refused. Never a URI. */
export type FileEditPreview =
  | { readonly kind: 'rewrite'; readonly before: string; readonly after: string }
  | { readonly kind: 'stale'; readonly reason: 'baseline-changed' }
  | { readonly kind: 'refused'; readonly reason: FileEditApplyRefusal | 'not-a-rewrite' };

/**
 * Apply and a rewrite's preview, as a caller reaches them (D7, D9): the
 * gateway's two doors, named without the gateway, so the Workshop's handler
 * never names a document port, the applier or the gateway itself.
 */
export interface FileEditApplyPort {
  apply(staged: StagedFileEdit, options: FileEditApplyOptions): Promise<FileEditApplyOutcome>;
  preview(staged: StagedFileEdit): Promise<FileEditPreview>;
}
