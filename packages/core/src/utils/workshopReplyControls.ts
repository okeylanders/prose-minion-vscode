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
  | `malformed:${'unclosed' | 'unopened' | 'nested' | 'tag' | WorkshopMemoryProposalFault}`;

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

/** A tag marker: `<` or `</`, then the whole tag name (not a longer name). */
const MARKER = new RegExp(`<(/?)${WORKSHOP_MEMORY_PROPOSAL_TAG}(?![a-z0-9_-])`, 'gi');

interface Frame {
  readonly start: number;
  /** Where the frame's text ends (after its closing tag, or the reply's end). */
  readonly end: number;
  /** Its inside, between the tags; undefined for a stray closing tag. */
  readonly inner?: string;
  readonly closed: boolean;
  /** Whether another frame opened inside it: never a proposal (PR #200 F-03). */
  readonly nested?: boolean;
  /** A marker that was not exactly `<tag>` or `</tag>`: removed to the reply's end (PR #200 F-03 recheck). */
  readonly malformedTag?: boolean;
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

/**
 * What a reply still streaming may show (PR #200 F-02): every memory frame
 * removed as `rest` removes it (an unclosed one to the end, so a frame
 * being written never shows), and a trailing fragment that could still
 * become a frame's tag held back until the next token settles it. Pure
 * over the text so far; the final reply is the extractor's.
 */
export function stripWorkshopMemoryProposalForStreaming(partial: string): string {
  const { rest } = extractWorkshopReplyControls(partial, { memoryOpen: false });
  const lastOpen = rest.lastIndexOf('<');
  if (lastOpen < 0) {
    return rest;
  }
  const tail = rest.slice(lastOpen).toLowerCase();
  const name = tail.startsWith('</') ? tail.slice(2) : tail.slice(1);
  const pending = `${WORKSHOP_MEMORY_PROPOSAL_TAG}`.startsWith(name)
    || (name.startsWith(WORKSHOP_MEMORY_PROPOSAL_TAG) && /^\s/.test(name.slice(WORKSHOP_MEMORY_PROPOSAL_TAG.length)) && !name.includes('>'));
  return pending ? rest.slice(0, lastOpen).replace(/\s+$/, '') : rest;
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
  if (frame.malformedTag) {
    return rejected('malformed:tag');
  }
  if (!frame.closed) {
    return rejected('malformed:unclosed');
  }
  if (frame.nested) {
    return rejected('malformed:nested');
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
  let depth = 0;
  let opening: { start: number; innerStart: number } | undefined;
  let nested = false;
  // One pass, left to right: each search resumes after the marker it found,
  // so no token is ever read inside another's bytes (PR #200 F-03 recheck).
  for (let marker = nextMarker(reply, 0); marker; marker = nextMarker(reply, marker.end)) {
    if (!marker.exact) {
      // Not exactly `<tag>` or `</tag>` (attributes, a missing `>`, a marker
      // inside the tag): malformed, and everything from here is removed.
      const start = opening ? opening.start : marker.start;
      const innerStart = opening ? opening.innerStart : marker.start;
      frames.push({ start, end: reply.length, inner: reply.slice(innerStart), closed: false, nested, malformedTag: true });
      return frames;
    }
    if (marker.open) {
      if (depth === 0) {
        opening = { start: marker.start, innerStart: marker.end };
        nested = false;
      } else {
        nested = true;
      }
      depth += 1;
      continue;
    }
    if (depth === 0) {
      // A closing tag with no frame open: debris, removed with no inside.
      frames.push({ start: marker.start, end: marker.end, closed: true });
      continue;
    }
    depth -= 1;
    if (depth === 0 && opening) {
      // The outer frame ends only where its own depth closes, so nothing
      // inside a nested frame is ever read as text after it (PR #200 F-03).
      frames.push({
        start: opening.start,
        end: marker.end,
        inner: reply.slice(opening.innerStart, marker.start),
        closed: true,
        nested
      });
      opening = undefined;
    }
  }
  if (opening) {
    // Unclosed at any depth: everything from its opening tag is removed.
    frames.push({ start: opening.start, end: reply.length, inner: reply.slice(opening.innerStart), closed: false, nested });
  }
  return frames;
}

/**
 * The next `<tag` or `</tag` at or after `from` (the tag name whole, any
 * case), and whether it is exactly `<tag>` or `</tag>`: the only forms the
 * grammar writes.
 */
function nextMarker(
  reply: string,
  from: number
): { readonly open: boolean; readonly exact: boolean; readonly start: number; readonly end: number } | undefined {
  MARKER.lastIndex = from;
  const match = MARKER.exec(reply);
  if (!match) {
    return undefined;
  }
  const open = match[1] === '';
  const exact = reply[match.index + match[0].length] === '>';
  return { open, exact, start: match.index, end: match.index + match[0].length + (exact ? 1 : 0) };
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
