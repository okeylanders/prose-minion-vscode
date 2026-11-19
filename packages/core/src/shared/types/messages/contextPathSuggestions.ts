/**
 * The project's context paths, set up from Settings (ADR 2026-11-19 D18,
 * D21–D25): "Suggest from my folders", the review of one proposal, and the
 * writer's Apply.
 *
 * Every request names a webview-minted `requestId` the host echoes, so the
 * Settings sheet takes only the answer it still waits for. Apply names the
 * host's proposal id and the groups ticked, never a pattern: the host holds
 * the proposal, checks each ticked group again, and writes at the user level
 * (L1).
 *
 * The view is writer data (patterns, file paths): it goes to the writer's
 * webview, never to a log.
 */

import type { ContextPathGroup } from '../context';
import { MessageEnvelope, MessageType } from './base';

/** Where a group's live value comes from: the most specific level holding one (D25). */
export type ContextPathSettingLevel = 'default' | 'user' | 'workspace' | 'workspace-folder';

/** Why a proposed pattern was refused before any normalization (D22). */
export type ContextPathPatternRefusal =
  | 'empty'
  | 'comma'
  | 'absolute'
  | 'drive'
  | 'home'
  | 'workspace-prefix'
  | 'parent-segment'
  | 'backslash'
  | 'control-character'
  | 'too-long'
  | 'duplicate'
  | 'over-cap';

/**
 * Why a proposed pattern is not kept: refused as unsafe, matched nothing
 * when every search completed (`unmatched`), or could not be checked
 * completely (`incomplete`, D22a; never read as zero matches).
 */
export type ContextPathPatternDrop = ContextPathPatternRefusal | 'unmatched' | 'incomplete';

/** Why a group is shown but not offered for Apply. */
export type ContextPathNotOffered =
  /** The proposal left the group out: it keeps its patterns. */
  | 'not-proposed'
  /** Every proposed pattern was dropped or refused: it keeps its patterns. */
  | 'nothing-kept'
  /** A search failed or a match could not be read (D22a): left as it is. */
  | 'incomplete'
  /** The workspace's settings file sets the group, so a user-level write would not change it here (D25). */
  | 'workspace-set'
  /** The patterns kept are the group's patterns already. */
  | 'unchanged';

export type ContextPathOffer =
  | { offered: true }
  | { offered: false; reason: ContextPathNotOffered };

export interface ContextPathKeptPattern {
  pattern: string;
  /** Supported files it matches, across every open root. */
  count: number;
}

export interface ContextPathDroppedPattern {
  pattern: string;
  reason: ContextPathPatternDrop;
}

/** A file the group would share with another group after Apply. */
export interface ContextPathSharedFile {
  path: string;
  /** The other groups that match it. */
  groups: ContextPathGroup[];
}

export interface ContextPathProposedGroup {
  kept: ContextPathKeptPattern[];
  dropped: ContextPathDroppedPattern[];
  /** Distinct files the kept patterns match. */
  count: number;
  /** Up to `PROMPT_BUDGETS.contextPaths.examples` of them. */
  examples: string[];
  /** Files another group would also match, counted and a few shown. */
  shared: { count: number; examples: ContextPathSharedFile[] };
}

export interface ContextPathGroupView {
  group: ContextPathGroup;
  level: ContextPathSettingLevel;
  current: {
    patterns: string[];
    /** Distinct files the current patterns match; `null` when a search was incomplete ("couldn't count"). */
    count: number | null;
    examples: string[];
  };
  /** Absent when the proposal left the group out. */
  proposed?: ContextPathProposedGroup;
  offer: ContextPathOffer;
}

/** What the folder scan read and sent (counts only). */
export interface ContextPathScanSummary {
  /** Folders the scan kept (each holding a Markdown or text file, or one below it). */
  folders: number;
  /** Folders the helper was sent. */
  sent: number;
  /** The scan reached one of its bounds and left the deepest folders out. */
  stopped: boolean;
  /** Folders whose listing could not be read: the scan, and so the proposal, is partial (PR #288 P2). */
  unreadable: number;
}

export interface ContextPathProposalView {
  groups: ContextPathGroupView[];
  scan?: ContextPathScanSummary;
}

// Suggest

export interface ContextPathsSuggestPayload {
  requestId: string;
}

export interface ContextPathsSuggestMessage extends MessageEnvelope<ContextPathsSuggestPayload> {
  type: MessageType.CONTEXT_PATHS_SUGGEST;
}

export type ContextPathsSuggestionOutcome =
  /** A proposal to review: `proposalId` and `view` are present. */
  | 'proposed'
  /** The helper answered, and proposed nothing for any group. */
  | 'nothing-proposed'
  /** No folder is open. */
  | 'no-workspace'
  /** The scan read every folder and found none holding a Markdown or text file. */
  | 'no-folders'
  /** The scan found no such folder, but it stopped at a bound or could not read some folders: not "none". */
  | 'scan-incomplete'
  /** No API key: nothing was sent. */
  | 'unconfigured'
  /** A newer suggestion replaced this one. */
  | 'cancelled'
  /** The scan or the call failed, or the answer was dropped. The settings are as they were. */
  | 'failed';

export interface ContextPathsSuggestionPayload {
  requestId: string;
  outcome: ContextPathsSuggestionOutcome;
  proposalId?: string;
  view?: ContextPathProposalView;
}

export interface ContextPathsSuggestionMessage extends MessageEnvelope<ContextPathsSuggestionPayload> {
  type: MessageType.CONTEXT_PATHS_SUGGESTION;
}

// Apply

export interface ContextPathsApplyPayload {
  requestId: string;
  /** The host's id for the proposal on screen. */
  proposalId: string;
  /** The groups ticked. Never a pattern. */
  groups: ContextPathGroup[];
}

export interface ContextPathsApplyMessage extends MessageEnvelope<ContextPathsApplyPayload> {
  type: MessageType.CONTEXT_PATHS_APPLY;
}

/** Why a ticked group was left as it is at Apply (D24, D22a, D25). */
export type ContextPathLeftReason =
  /** Not offered in the view (or not a group of the proposal). */
  | 'not-offered'
  /** The workspace's settings file sets it now. */
  | 'workspace-set'
  /** Its value changed since the suggestion. */
  | 'changed'
  /** Checking it again was incomplete. */
  | 'incomplete'
  /** A kept pattern no longer matches anything. */
  | 'matches-changed'
  /** The write failed. */
  | 'write-failed'
  /** An earlier group's write failed, so this one was not tried. */
  | 'not-reached';

export type ContextPathGroupApplyOutcome =
  | { group: ContextPathGroup; outcome: 'applied' }
  | { group: ContextPathGroup; outcome: 'left'; reason: ContextPathLeftReason };

export interface ContextPathsAppliedPayload {
  requestId: string;
  /** `unknown-proposal`: the host no longer holds that proposal (a newer suggestion, or a reload). */
  outcome: 'done' | 'unknown-proposal';
  groups: ContextPathGroupApplyOutcome[];
}

export interface ContextPathsAppliedMessage extends MessageEnvelope<ContextPathsAppliedPayload> {
  type: MessageType.CONTEXT_PATHS_APPLIED;
}

// Status: whether every group matches nothing (the section's one line pointing at the button)

export interface ContextPathsStatusRequestPayload {
  requestId: string;
}

export interface ContextPathsStatusRequestMessage extends MessageEnvelope<ContextPathsStatusRequestPayload> {
  type: MessageType.CONTEXT_PATHS_STATUS_REQUEST;
}

export interface ContextPathsStatusPayload {
  requestId: string;
  /** True only when a folder is open, every search completed, and no group matches a file. */
  everyGroupEmpty: boolean;
}

export interface ContextPathsStatusMessage extends MessageEnvelope<ContextPathsStatusPayload> {
  type: MessageType.CONTEXT_PATHS_STATUS;
}
