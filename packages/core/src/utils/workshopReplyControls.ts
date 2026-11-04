/**
 * The one owner of a Workshop reply's tail (ADR 2026-11-04 D6; PR #192
 * F-01). Pure. It runs first on every persona or tool reply, before any other
 * reader, and splits off the project-memory proposal frame, which comes
 * **last**, after any `### Try a widget` section.
 *
 * - It removes **every** `<prose-minion-memory-proposal>` frame: from its
 *   opening tag to its closing tag, or to the end of the reply when it is
 *   unclosed (which takes anything written after it, a widget frame
 *   included: that was already out of order). A stray closing tag is
 *   removed too.
 * - `rest` is the reply without memory frames: what the widget inspector,
 *   the actionable-findings reader, the bubble and retention read. The
 *   widget inspector therefore never sees memory text as trailing content.
 * - `redacted` is the reply with each frame replaced by
 *   `[project memory proposal removed]`: what every log and diagnostic reads
 *   (D9: no memory payload in any log).
 * - `memory` is `none`, an eligible `proposal`, or `rejected` with its
 *   reason. A proposal is eligible only when memory is open, exactly one
 *   frame was found, it was closed, and nothing but whitespace followed it.
 */

import {
  decodeWorkshopMemoryProposal,
  WORKSHOP_MEMORY_PROPOSAL_TAG,
  type WorkshopMemoryProposalDraft,
  type WorkshopMemoryProposalFault
} from '@/utils/workshopMemoryProposalProtocol';
import { sanitizeWorkshopWidgetRecommendationForRetention } from '@/utils/workshopWidgetRecommendationProtocol';

export const WORKSHOP_MEMORY_PROPOSAL_REDACTION = '[project memory proposal removed]';

/** What retained history and the bubble hold when a reply was only a proposal (D6). */
export const WORKSHOP_MEMORY_ONLY_REPLY_LINE = 'Proposed a project memory.';

export type WorkshopReplyMemoryRejection =
  | 'misplaced'
  | 'duplicate'
  | 'memory-off'
  | `malformed:${'unclosed' | 'unopened' | WorkshopMemoryProposalFault}`;

export type WorkshopReplyMemoryControl =
  | { readonly kind: 'none' }
  | { readonly kind: 'proposal'; readonly proposal: WorkshopMemoryProposalDraft }
  | { readonly kind: 'rejected'; readonly reason: WorkshopReplyMemoryRejection };

export interface WorkshopReplyControls {
  readonly rest: string;
  readonly redacted: string;
  readonly memory: WorkshopReplyMemoryControl;
}

export interface WorkshopReplyControlsOptions {
  /** Whether personas may propose now (the mode is on and the workspace holds). */
  readonly memoryOpen: boolean;
}

const OPEN = new RegExp(`<${WORKSHOP_MEMORY_PROPOSAL_TAG}(?:\\s[^>]*)?>`, 'gi');
const CLOSE = new RegExp(`</${WORKSHOP_MEMORY_PROPOSAL_TAG}\\s*>`, 'gi');

interface Frame {
  readonly start: number;
  /** Where the frame's text ends (after its closing tag, or the reply's end). */
  readonly end: number;
  /** Its inside, between the tags; undefined for a stray closing tag. */
  readonly inner?: string;
  readonly closed: boolean;
}

/** Split a reply into its prose (and any widget control) and its memory frames. */
export function extractWorkshopReplyControls(
  reply: string,
  options: WorkshopReplyControlsOptions
): WorkshopReplyControls {
  const frames = findFrames(reply);
  if (frames.length === 0) {
    return { rest: reply, redacted: reply, memory: { kind: 'none' } };
  }
  return {
    rest: removeFrames(reply, frames, ''),
    redacted: removeFrames(reply, frames, WORKSHOP_MEMORY_PROPOSAL_REDACTION),
    memory: judge(reply, frames, options)
  };
}

/** Whether a reply holds anything the extractor would remove (a cheap check before a listing is read). */
export function hasWorkshopMemoryProposalText(reply: string): boolean {
  return reply.toLowerCase().includes(WORKSHOP_MEMORY_PROPOSAL_TAG);
}

/**
 * Retained history's copy of a reply (D6, "stripped twice"): without memory
 * frames, and the host's line when a proposal was all it held. The widget
 * sanitizer runs after this, on what is left.
 */
export function stripWorkshopMemoryProposalForRetention(reply: string): string {
  const controls = extractWorkshopReplyControls(reply, { memoryOpen: false });
  if (controls.memory.kind !== 'none' && controls.rest.trim().length === 0) {
    return WORKSHOP_MEMORY_ONLY_REPLY_LINE;
  }
  return controls.rest;
}

function judge(reply: string, frames: readonly Frame[], options: WorkshopReplyControlsOptions): WorkshopReplyMemoryControl {
  if (!options.memoryOpen) {
    return rejected('memory-off');
  }
  const opened = frames.filter((frame) => frame.inner !== undefined);
  if (opened.length === 0) {
    return rejected('malformed:unopened');
  }
  if (opened.length > 1) {
    return rejected('duplicate');
  }
  const frame = opened[0];
  if (!frame.closed) {
    return rejected('malformed:unclosed');
  }
  const after = removeFrames(reply.slice(frame.end), frames
    .filter((other) => other.start >= frame.end)
    .map((other) => ({ ...other, start: other.start - frame.end, end: other.end - frame.end })), '');
  if (after.trim().length > 0) {
    return rejected('misplaced');
  }
  const decoded = decodeWorkshopMemoryProposal(frame.inner as string);
  return decoded.kind === 'proposal'
    ? { kind: 'proposal', proposal: decoded.proposal }
    : rejected(`malformed:${decoded.fault}`);
}

function findFrames(reply: string): Frame[] {
  const frames: Frame[] = [];
  let at = 0;
  while (at < reply.length) {
    OPEN.lastIndex = at;
    CLOSE.lastIndex = at;
    const open = OPEN.exec(reply);
    const close = CLOSE.exec(reply);
    if (!open && !close) {
      break;
    }
    if (close && (!open || close.index < open.index)) {
      // A closing tag with no frame open: debris, removed with no inside.
      frames.push({ start: close.index, end: close.index + close[0].length, closed: true });
      at = close.index + close[0].length;
      continue;
    }
    const opening = open as RegExpExecArray;
    const innerStart = opening.index + opening[0].length;
    CLOSE.lastIndex = innerStart;
    const closing = CLOSE.exec(reply);
    if (!closing) {
      frames.push({ start: opening.index, end: reply.length, inner: reply.slice(innerStart), closed: false });
      break;
    }
    frames.push({
      start: opening.index,
      end: closing.index + closing[0].length,
      inner: reply.slice(innerStart, closing.index),
      closed: true
    });
    at = closing.index + closing[0].length;
  }
  return frames;
}

/**
 * The reply with each frame replaced. Where a frame stood between two
 * stretches of text, the blank lines around it collapse to one, so a
 * frame removed from the middle leaves no gap; the first line after it
 * keeps its indentation.
 */
function removeFrames(reply: string, frames: readonly Frame[], replacement: string): string {
  let out = '';
  let at = 0;
  for (const frame of frames) {
    out = join(out + reply.slice(at, frame.start), replacement);
    at = frame.end;
  }
  const tail = reply.slice(at);
  if (tail.trim().length === 0) {
    return replacement ? out : out.replace(/\s+$/, '');
  }
  return join(out, tail.replace(/^[ \t]*\r?\n(?:[ \t]*\r?\n)*/, ''));
}

function join(before: string, after: string): string {
  const head = before.replace(/\s+$/, '');
  if (!after) {
    return head;
  }
  return head ? `${head}\n\n${after}` : after;
}

function rejected(reason: WorkshopReplyMemoryRejection): WorkshopReplyMemoryControl {
  return { kind: 'rejected', reason };
}

/**
 * Retained history's sanitizer for persona and tool replies: memory frames
 * first (the tail's owner), then the widget control on what is left (D6;
 * `AssistantToolService` hands this to the engine).
 */
export function sanitizeWorkshopReplyForRetention(reply: string): string {
  const withoutMemory = stripWorkshopMemoryProposalForRetention(reply);
  return withoutMemory === WORKSHOP_MEMORY_ONLY_REPLY_LINE
    ? withoutMemory
    : sanitizeWorkshopWidgetRecommendationForRetention(withoutMemory);
}
