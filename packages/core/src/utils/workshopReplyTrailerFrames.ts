/**
 * Finding a Workshop reply's trailer frames (ADR 2026-11-04 D6; ADR
 * 2026-11-05 D2). Pure. The tail extractor (`workshopReplyControls`) reads
 * every trailer kind in one pass, so a project-memory frame followed by a
 * file-edit frame (or the reverse) still stands at the tail: the frames come
 * last, one after another, in any order.
 *
 * - A frame runs from its opening tag to the closing tag that brings the
 *   depth back to zero, counting every trailer tag (a frame opened inside it
 *   is part of it, and makes it `nested`: PR #200 F-03), or to the reply's end
 *   when it is unclosed. A closing tag of another kind marks it `mismatched`.
 * - A stray closing tag is a frame of its own, with no inside.
 * - A marker that is not exactly `<tag>` or `</tag>` makes everything from it
 *   (or from the frame it is inside) one malformed frame, to the reply's end.
 */

/** One trailer frame found in a reply. */
export interface WorkshopReplyTrailerFrame {
  /** Its kind: the opening tag's name (a stray closing tag's own). */
  readonly tag: string;
  readonly start: number;
  /** Where the frame's text ends (after its closing tag, or the reply's end). */
  readonly end: number;
  /** Its inside, between the tags; undefined for a stray closing tag. */
  readonly inner?: string;
  readonly closed: boolean;
  /** Whether another frame opened inside it: never a proposal (PR #200 F-03). */
  readonly nested?: boolean;
  /** A marker that was not exactly `<tag>` or `</tag>`, or a closing tag of another kind (PR #200 F-03 recheck). */
  readonly malformedTag?: boolean;
}

/** Why a frame is dropped before its inside is read; undefined when it is well placed and well formed. */
export type WorkshopReplyTrailerStructureRejection =
  | 'misplaced'
  | 'malformed:unclosed'
  | 'malformed:unopened'
  | 'malformed:nested'
  | 'malformed:tag';

export function findWorkshopReplyTrailerFrames(reply: string, tags: readonly string[]): WorkshopReplyTrailerFrame[] {
  const marker = new RegExp(`<(/?)(${tags.map(escapeTag).join('|')})(?![a-z0-9_-])`, 'gi');
  const frames: WorkshopReplyTrailerFrame[] = [];
  let depth = 0;
  let opening: { tag: string; start: number; innerStart: number } | undefined;
  let nested = false;
  // One pass, left to right: each search resumes after the marker it found,
  // so no token is ever read inside another's bytes (PR #200 F-03 recheck).
  for (let found = nextMarker(reply, marker, 0); found; found = nextMarker(reply, marker, found.end)) {
    if (!found.exact) {
      const start = opening ? opening.start : found.start;
      const innerStart = opening ? opening.innerStart : found.start;
      frames.push({
        tag: opening?.tag ?? found.tag,
        start,
        end: reply.length,
        inner: reply.slice(innerStart),
        closed: false,
        nested,
        malformedTag: true
      });
      return frames;
    }
    if (found.open) {
      if (depth === 0) {
        opening = { tag: found.tag, start: found.start, innerStart: found.end };
        nested = false;
      } else {
        nested = true;
      }
      depth += 1;
      continue;
    }
    if (depth === 0) {
      // A closing tag with no frame open: debris, removed with no inside.
      frames.push({ tag: found.tag, start: found.start, end: found.end, closed: true });
      continue;
    }
    depth -= 1;
    if (depth === 0 && opening) {
      // The outer frame ends only where its own depth closes, so nothing
      // inside a nested frame is ever read as text after it (PR #200 F-03).
      frames.push({
        tag: opening.tag,
        start: opening.start,
        end: found.end,
        inner: reply.slice(opening.innerStart, found.start),
        closed: true,
        nested,
        ...(found.tag !== opening.tag ? { malformedTag: true } : {})
      });
      opening = undefined;
    }
  }
  if (opening) {
    // Unclosed at any depth: everything from its opening tag is removed.
    frames.push({ tag: opening.tag, start: opening.start, end: reply.length, inner: reply.slice(opening.innerStart), closed: false, nested });
  }
  return frames;
}

/**
 * Whether each frame stands at the reply's tail: only whitespace in every
 * gap after it, up to the end. One pass from the end, so the check is
 * linear however many frames a reply holds.
 */
export function workshopReplyTrailerFramesAtTail(reply: string, frames: readonly WorkshopReplyTrailerFrame[]): boolean[] {
  const atTail = new Array<boolean>(frames.length);
  let clean = true;
  let gapEnd = reply.length;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    clean = clean && reply.slice(frames[index].end, gapEnd).trim().length === 0;
    atTail[index] = clean;
    gapEnd = frames[index].start;
  }
  return atTail;
}

/** A frame's structural verdict, in the order every trailer kind checks it. */
export function workshopReplyTrailerStructureRejection(
  frame: WorkshopReplyTrailerFrame,
  atTail: boolean
): WorkshopReplyTrailerStructureRejection | undefined {
  if (frame.inner === undefined) {
    return 'malformed:unopened';
  }
  if (frame.malformedTag) {
    return 'malformed:tag';
  }
  if (!frame.closed) {
    return 'malformed:unclosed';
  }
  if (frame.nested) {
    return 'malformed:nested';
  }
  return atTail ? undefined : 'misplaced';
}

/**
 * The reply with each frame replaced by its kind's replacement. Where a
 * frame stood between two stretches of text, the blank lines around it
 * collapse to one, so a frame removed from the middle leaves no gap; the
 * first line after it keeps its indentation.
 */
export function removeWorkshopReplyTrailerFrames(
  reply: string,
  frames: readonly WorkshopReplyTrailerFrame[],
  replacement: (frame: WorkshopReplyTrailerFrame) => string
): string {
  let out = '';
  let at = 0;
  let replaced = false;
  for (const frame of frames) {
    const text = replacement(frame);
    replaced = replaced || text.length > 0;
    // Text after a removed frame starts at its first line that holds something, as the tail does.
    const stretch = reply.slice(at, frame.start);
    out = at > 0
      ? join(join(out, stretch.trim().length > 0 ? stretch.replace(/^[ \t]*\r?\n(?:[ \t]*\r?\n)*/, '') : ''), text)
      : join(stretch, text);
    at = frame.end;
  }
  const tail = reply.slice(at);
  if (tail.trim().length === 0) {
    return replaced ? out : out.replace(/\s+$/, '');
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

/**
 * The next trailer marker at or after `from` (a tag name whole, any case),
 * and whether it is exactly `<tag>` or `</tag>`: the only forms the grammar
 * writes.
 */
function nextMarker(
  reply: string,
  marker: RegExp,
  from: number
): { readonly tag: string; readonly open: boolean; readonly exact: boolean; readonly start: number; readonly end: number } | undefined {
  marker.lastIndex = from;
  const match = marker.exec(reply);
  if (!match) {
    return undefined;
  }
  const exact = reply[match.index + match[0].length] === '>';
  return {
    tag: match[2].toLowerCase(),
    open: match[1] === '',
    exact,
    start: match.index,
    end: match.index + match[0].length + (exact ? 1 : 0)
  };
}

function escapeTag(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
