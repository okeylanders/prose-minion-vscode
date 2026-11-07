/**
 * The one owner of a Workshop reply's tail (ADR 2026-11-04 D6; PR #192
 * F-01). Pure. It runs first on every persona or tool reply, before any other
 * reader, and splits off the project-memory proposal frame, which comes
 * **last**, after any `### Try a widget` section.
 *
 * - It removes **every** `<prose-minion-memory-proposal>` frame: from its
 *   opening tag to the closing tag that brings its depth back to zero (a
 *   frame opened inside it is part of it, PR #200 F-03), or to the end of
 *   the reply when it is unclosed (which takes anything written after it, a widget frame
 *   included: that was already out of order). A stray closing tag is
 *   removed too.
 * - `rest` is the reply without memory frames: what the widget inspector,
 *   the actionable-findings reader, the bubble and retention read. The
 *   widget inspector therefore never sees memory text as trailing content.
 * - `redacted` is the reply with each frame replaced by
 *   `[project memory proposal removed]`: what every log and diagnostic reads
 *   (D9: no memory payload in any log).
 * - `memory` is `none` when the reply held no frame. Otherwise it lists
 *   the eligible proposals, in the order written, and one rejection per
 *   frame it dropped (Slice 6b). Each frame is judged on its own, so one
 *   malformed frame drops only itself:
 *   - memory must be open, the frame closed, not nested, and exactly
 *     tagged; a stray closing tag is a frame of its own, `unopened`;
 *   - the frame stands at the reply's tail: nothing but whitespace and
 *     other frames after it (`misplaced` otherwise);
 *   - its inside decodes (`malformed:<fault>` otherwise);
 *   - its title is no earlier proposal's, or, for an edit (Slice 6c), its
 *     target no earlier edit's (`duplicate`);
 *   - at most `proposalsPerReply` proposals are kept: a well-formed one past
 *     them is `over-cap`, dropped whole and counted, never cut.
 * - **File edits** (ADR 2026-11-05 D2, D9): `<prose-minion-file-edit>`
 *   frames are found in the same pass (`workshopReplyTrailerFrames`), so the
 *   two kinds stand at the tail together, in any order. They are removed from
 *   `rest` like memory frames, redacted as `[file edit proposal removed]`, and
 *   judged by `workshopReplyFileEdits` into `fileEdits`, which is absent when
 *   the reply held none.
 * - **Reactions** (ADR 2026-11-07 D5): `<prose-minion-reaction>` frames join
 *   the same pass, removed from `rest`, redacted as `[reaction removed]`, and
 *   judged by `workshopReplyReaction` into `reaction`, absent when the reply
 *   held none. A reply of trailers alone keeps the host's line (R1).
 */

import {
  decodeWorkshopMemoryProposal,
  WORKSHOP_MEMORY_PROPOSAL_TAG,
  type WorkshopMemoryProposalDraft,
  type WorkshopMemoryProposalFault
} from '@/utils/workshopMemoryProposalProtocol';
import { isWorkshopMemoryEditDraft, type WorkshopMemoryEditDraft } from '@/utils/workshopMemoryEditProtocol';
import { WORKSHOP_FILE_EDIT_TAG } from '@/utils/workshopFileEditProtocol';
import { judgeWorkshopReplyFileEdits, type WorkshopReplyFileEditControl } from '@/utils/workshopReplyFileEdits';
import {
  findWorkshopReplyTrailerFrames,
  removeWorkshopReplyTrailerFrames,
  workshopReplyTrailerFramesAtTail,
  workshopReplyTrailerStructureRejection,
  type WorkshopReplyTrailerFrame
} from '@/utils/workshopReplyTrailerFrames';
import {
  decodeWorkshopReactionTrailer,
  judgeWorkshopReplyReactions,
  WORKSHOP_REACTION_REDACTION,
  WORKSHOP_REACTION_TAG,
  type WorkshopReplyReactionControl,
  type WorkshopReplyReactionOptions
} from '@/utils/workshopReplyReaction';
import { workshopReaction, type WorkshopReactionId } from '@shared/constants/workshopReactions';
import { sanitizeWorkshopWidgetRecommendationForRetention } from '@/utils/workshopWidgetRecommendationProtocol';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export const WORKSHOP_MEMORY_PROPOSAL_REDACTION = '[project memory proposal removed]';

export const WORKSHOP_FILE_EDIT_REDACTION = '[file edit proposal removed]';

/** What retained history and the bubble hold when a reply was only a proposal (D6). */
export const WORKSHOP_MEMORY_ONLY_REPLY_LINE = 'Proposed a project memory.';
/** The same, for a reply that was only file edits (ADR 2026-11-05 D2). */
export const WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE = 'Proposed an edit to a project file.';
/** The same, for a reply that was only trailers of both kinds. */
export const WORKSHOP_TRAILERS_ONLY_REPLY_LINE = 'Proposed a project memory and an edit to a project file.';

/**
 * The ledger's line for a reply whose only trailer was a reaction that was
 * dropped (ADR 2026-11-07 D5; PR #247 M1): it names no reaction, since none
 * was kept, and the turn takes no reaction of its own (`noMessage`).
 */
export const WORKSHOP_NO_MESSAGE_REPLY_LINE = 'Replied without a message.';

/**
 * The trailer kinds a reply held, for the host's line (ADR 2026-11-07 R1).
 * `reaction` is a reaction to name, `true` for one it cannot name, absent
 * for none: retention passes the reply's intent, read from its text; the
 * ledger passes only a reaction that was kept.
 */
export interface WorkshopTrailerKinds {
  readonly memory: boolean;
  readonly fileEdits: boolean;
  readonly reaction?: WorkshopReactionId | true;
}

/** The reaction's object, named so a reader of the room's catch-up knows what it was on (PR #247 L4). */
const REACTION_OBJECT = "the writer's message";

/**
 * The host's line for a reply that held only trailers, by the kinds it
 * names: "Reacted with heart to the writer's message.", "Proposed a project
 * memory and reacted with heart to the writer's message.", and so on. With
 * nothing to name, it is `WORKSHOP_NO_MESSAGE_REPLY_LINE`.
 */
export function workshopTrailersOnlyReplyLine(kinds: WorkshopTrailerKinds): string {
  const proposals = kinds.memory || kinds.fileEdits
    ? kinds.memory && kinds.fileEdits
      ? WORKSHOP_TRAILERS_ONLY_REPLY_LINE
      : kinds.fileEdits ? WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE : WORKSHOP_MEMORY_ONLY_REPLY_LINE
    : undefined;
  if (kinds.reaction === undefined) {
    return proposals ?? WORKSHOP_NO_MESSAGE_REPLY_LINE;
  }
  const reacted = kinds.reaction === true
    ? `reacted to ${REACTION_OBJECT}`
    : `reacted with ${workshopReaction(kinds.reaction).label} to ${REACTION_OBJECT}`;
  if (!proposals) {
    return `R${reacted.slice(1)}.`;
  }
  const joiner = kinds.memory && kinds.fileEdits ? ', and ' : ' and ';
  return `${proposals.slice(0, -1)}${joiner}${reacted}.`;
}

export type WorkshopReplyMemoryRejection =
  | 'misplaced'
  | 'duplicate'
  | 'over-cap'
  | 'memory-off'
  | `malformed:${'unclosed' | 'unopened' | 'nested' | 'tag' | WorkshopMemoryProposalFault}`;

export type WorkshopReplyMemoryControl =
  | { readonly kind: 'none' }
  | {
    readonly kind: 'frames';
    /** The eligible proposals, new notes and edits, in the order written, at most `proposalsPerReply`. */
    readonly proposals: ReadonlyArray<WorkshopMemoryProposalDraft | WorkshopMemoryEditDraft>;
    /** One reason per frame dropped, in the order written. */
    readonly rejections: readonly WorkshopReplyMemoryRejection[];
  };

/** How many suggestions one reply may carry (Slice 6b). */
export const WORKSHOP_MEMORY_PROPOSALS_PER_REPLY = PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply;

export interface WorkshopReplyControls {
  readonly rest: string;
  readonly redacted: string;
  readonly memory: WorkshopReplyMemoryControl;
  /** The reply's file-edit frames, judged (ADR 2026-11-05 D2); absent when it held none. */
  readonly fileEdits?: WorkshopReplyFileEditControl;
  /** The reply's reaction frames, judged (ADR 2026-11-07 D5); absent when it held none. */
  readonly reaction?: WorkshopReplyReactionControl;
  /** The trailer kinds it held, for the host's line (R1). */
  readonly trailers: WorkshopTrailerKinds;
}

export interface WorkshopReplyControlsOptions {
  /** Whether personas may propose now (the mode is on and the workspace holds). */
  readonly memoryOpen: boolean;
  /** Whether personas may propose file edits now (`fileEdits: ask`, read with the reply; D9). Absent reads as off. */
  readonly fileEditsOpen?: boolean;
  /** Whether personas may react now, and whether this reply answers a writer message (Q8, D5). Absent reads as off. */
  readonly reactions?: WorkshopReplyReactionOptions;
}

/** Every trailer kind the tail holds, found in one pass. */
const TRAILER_TAGS = [WORKSHOP_MEMORY_PROPOSAL_TAG, WORKSHOP_FILE_EDIT_TAG, WORKSHOP_REACTION_TAG] as const;

const NO_TRAILERS: WorkshopTrailerKinds = { memory: false, fileEdits: false };

const REDACTIONS: Readonly<Record<string, string>> = {
  [WORKSHOP_MEMORY_PROPOSAL_TAG]: WORKSHOP_MEMORY_PROPOSAL_REDACTION,
  [WORKSHOP_FILE_EDIT_TAG]: WORKSHOP_FILE_EDIT_REDACTION,
  [WORKSHOP_REACTION_TAG]: WORKSHOP_REACTION_REDACTION
};

type Frame = WorkshopReplyTrailerFrame;

/** Split a reply into its prose (and any widget control) and its memory frames. */
export function extractWorkshopReplyControls(
  reply: string,
  options: WorkshopReplyControlsOptions
): WorkshopReplyControls {
  const frames = findWorkshopReplyTrailerFrames(reply, TRAILER_TAGS);
  if (frames.length === 0) {
    return { rest: reply, redacted: reply, memory: { kind: 'none' }, trailers: NO_TRAILERS };
  }
  const atTail = workshopReplyTrailerFramesAtTail(reply, frames);
  const placed = frames.map((frame, index) => ({ frame, atTail: atTail[index] }));
  const memoryFrames = placed.filter(({ frame }) => frame.tag === WORKSHOP_MEMORY_PROPOSAL_TAG);
  const fileEditFrames = placed.filter(({ frame }) => frame.tag === WORKSHOP_FILE_EDIT_TAG);
  const reactionFrames = placed.filter(({ frame }) => frame.tag === WORKSHOP_REACTION_TAG);
  // The first well-formed known id: the one the judge keeps whenever it keeps one, read from the text alone.
  const named = reactionFrames
    .map(({ frame, atTail: tail }) => workshopReplyTrailerStructureRejection(frame, tail) || frame.inner === undefined
      ? undefined
      : decodeWorkshopReactionTrailer(frame.inner))
    .find((id) => id !== undefined);
  return {
    rest: removeWorkshopReplyTrailerFrames(reply, frames, () => ''),
    redacted: removeWorkshopReplyTrailerFrames(reply, frames, (frame) => REDACTIONS[frame.tag] ?? WORKSHOP_MEMORY_PROPOSAL_REDACTION),
    memory: memoryFrames.length > 0 ? judge(memoryFrames, options) : { kind: 'none' },
    ...(fileEditFrames.length > 0 ? { fileEdits: judgeWorkshopReplyFileEdits(fileEditFrames, options.fileEditsOpen === true) } : {}),
    ...(reactionFrames.length > 0
      ? { reaction: judgeWorkshopReplyReactions(reactionFrames, options.reactions ?? { open: false, hasTarget: false }) }
      : {}),
    trailers: {
      memory: memoryFrames.length > 0,
      fileEdits: fileEditFrames.length > 0,
      ...(reactionFrames.length > 0 ? { reaction: named ?? true } : {})
    }
  };
}

/** Whether a reply holds a file-edit tag (a cheap check before anything is staged; ADR 2026-11-05 D4). */
export function hasWorkshopFileEditText(reply: string): boolean {
  return reply.toLowerCase().includes(WORKSHOP_FILE_EDIT_TAG);
}

/** Whether a reply holds anything the extractor would remove (a cheap check before a listing is read). */
export function hasWorkshopMemoryProposalText(reply: string): boolean {
  return reply.toLowerCase().includes(WORKSHOP_MEMORY_PROPOSAL_TAG);
}

/**
 * Retained history's copy of a reply (D6, "stripped twice"): without trailer
 * frames (memory, file edits and reactions), and the host's line when
 * trailers were all it held (`hostLine`). The widget sanitizer runs after
 * this, on what is left, but never on the host's line.
 */
function retainedWithoutTrailers(reply: string): { readonly text: string; readonly hostLine: boolean } {
  const controls = extractWorkshopReplyControls(reply, { memoryOpen: false });
  const { trailers } = controls;
  if ((trailers.memory || trailers.fileEdits || trailers.reaction !== undefined) && controls.rest.trim().length === 0) {
    return { text: workshopTrailersOnlyReplyLine(trailers), hostLine: true };
  }
  return { text: controls.rest, hostLine: false };
}

export function stripWorkshopReplyTrailersForRetention(reply: string): string {
  return retainedWithoutTrailers(reply).text;
}

/**
 * What a reply still streaming may show (PR #200 F-02): every trailer frame
 * (memory, file edits and reactions) removed as `rest` removes it (an unclosed one to
 * the end, so a frame being written never shows), and a trailing fragment
 * that could still become a frame's tag held back until the next token
 * settles it. Pure over the text so far; the final reply is the extractor's.
 */
export function stripWorkshopReplyTrailersForStreaming(partial: string): string {
  const { rest } = extractWorkshopReplyControls(partial, { memoryOpen: false });
  const lastOpen = rest.lastIndexOf('<');
  if (lastOpen < 0) {
    return rest;
  }
  const tail = rest.slice(lastOpen).toLowerCase();
  const name = tail.startsWith('</') ? tail.slice(2) : tail.slice(1);
  const pending = TRAILER_TAGS.some((tag) => tag.startsWith(name)
    || (name.startsWith(tag) && /^\s/.test(name.slice(tag.length)) && !name.includes('>')));
  return pending ? rest.slice(0, lastOpen).replace(/\s+$/, '') : rest;
}

function judge(
  frames: ReadonlyArray<{ readonly frame: Frame; readonly atTail: boolean }>,
  options: WorkshopReplyControlsOptions
): WorkshopReplyMemoryControl {
  const proposals: Array<WorkshopMemoryProposalDraft | WorkshopMemoryEditDraft> = [];
  const rejections: WorkshopReplyMemoryRejection[] = [];
  const titles = new Set<string>();
  for (const { frame, atTail } of frames) {
    const verdict = judgeFrame(frame, atTail, options);
    if (typeof verdict === 'string') {
      rejections.push(verdict);
      continue;
    }
    const title = isWorkshopMemoryEditDraft(verdict) ? `edit ${verdict.target}` : `new ${verdict.title.toLowerCase()}`;
    if (titles.has(title)) {
      rejections.push('duplicate');
    } else if (proposals.length >= WORKSHOP_MEMORY_PROPOSALS_PER_REPLY) {
      rejections.push('over-cap');
    } else {
      titles.add(title);
      proposals.push(verdict);
    }
  }
  return { kind: 'frames', proposals, rejections };
}

/** One frame's verdict: its proposal, or why it is dropped. */
function judgeFrame(
  frame: Frame,
  atTail: boolean,
  options: WorkshopReplyControlsOptions
): WorkshopMemoryProposalDraft | WorkshopMemoryEditDraft | WorkshopReplyMemoryRejection {
  if (!options.memoryOpen) {
    return 'memory-off';
  }
  const structural = workshopReplyTrailerStructureRejection(frame, atTail);
  if (structural) {
    return structural;
  }
  const decoded = decodeWorkshopMemoryProposal(frame.inner ?? '');
  switch (decoded.kind) {
    case 'proposal':
      return decoded.proposal;
    case 'edit':
      return decoded.edit;
    default:
      return `malformed:${decoded.fault}`;
  }
}

/**
 * Retained history's sanitizer for persona and tool replies: trailer frames
 * first (the tail's owner), then the widget control on what is left (D6;
 * `AssistantToolService` hands this to the engine).
 */
export function sanitizeWorkshopReplyForRetention(reply: string): string {
  const withoutTrailers = retainedWithoutTrailers(reply);
  return withoutTrailers.hostLine
    ? withoutTrailers.text
    : sanitizeWorkshopWidgetRecommendationForRetention(withoutTrailers.text);
}
