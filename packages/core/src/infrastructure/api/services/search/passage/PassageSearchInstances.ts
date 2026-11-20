/**
 * From a model's quotes to the result's instances (ADR 2026-11-20 D9, D9a,
 * D10, D11a). Host code decides where every quote is, what is shown for it,
 * and what counts as one moment. Pure.
 *
 * - **Anchored in its own chunk** (`anchorQuote`). A quote the chunk does
 *   not hold is `quote-not-found`; one it holds more than once, with no
 *   context that places it, is `quote-ambiguous`. Both are dropped.
 * - **What is shown is the source.** An anchor is a range; the instance's
 *   quote and the context either side are slices of the plan's frozen text.
 *   The model's `quote`, `before` and `after` are discarded once they have
 *   placed it, so a quote written with straight marks shows the curly ones
 *   the file has.
 * - **One moment shows once.** Within a file, instances whose ranges overlap
 *   are one: the earliest-starting is kept, the rest are `duplicate`. This
 *   covers the overlap between chunks and a model listing a moment twice.
 *   Overlap is with the instance that stands, so a range clear of it is its
 *   own moment even when a dropped one touched both.
 * - **Labels are merged by a host key:** case and accents folded,
 *   whitespace collapsed; the first spelling in reading order is shown.
 * - **Numbered from 1 in reading order:** file by file, then by position.
 *   The line is computed from the range; a model never gives one.
 */

import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import { foldSearchText } from '@shared/utils/foldedTextSearch';
import type {
  PassageSearchInstance,
  PassageSearchLabel,
  PassageSearchPlanChunk,
  PassageSearchPlanFile,
  PassageSearchResultFile
} from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchReplyInstance } from '@services/search/passage/PassageSearchReplyCodec';

/** A quote host code found, as a range in its file. */
export interface PassageSearchFound {
  /** Index into the plan's files. */
  readonly file: number;
  readonly start: number;
  readonly end: number;
  readonly note: string;
  readonly label: string;
}

export interface PassageSearchAnchored {
  readonly found: readonly PassageSearchFound[];
  readonly notFound: number;
  readonly ambiguous: number;
}

/** Place one reply's instances in the chunk the call read. */
export function anchorPassageSearchInstances(
  file: Pick<PassageSearchPlanFile, 'text'>,
  chunk: PassageSearchPlanChunk,
  instances: readonly PassageSearchReplyInstance[]
): PassageSearchAnchored {
  const text = file.text.slice(chunk.start, chunk.end);
  const found: PassageSearchFound[] = [];
  let notFound = 0;
  let ambiguous = 0;
  for (const instance of instances) {
    const anchor = anchorQuote(text, {
      quote: instance.quote,
      ...(instance.before ? { before: instance.before } : {}),
      ...(instance.after ? { after: instance.after } : {})
    });
    if (anchor.kind === 'anchored') {
      found.push({ file: chunk.file, start: chunk.start + anchor.start, end: chunk.start + anchor.end, note: instance.note, label: instance.label });
    } else if (anchor.kind === 'ambiguous') {
      ambiguous += 1;
    } else {
      notFound += 1;
    }
  }
  return { found, notFound, ambiguous };
}

export interface PassageSearchMerged {
  readonly instances: readonly PassageSearchInstance[];
  readonly labels: readonly PassageSearchLabel[];
  readonly files: readonly PassageSearchResultFile[];
  readonly duplicates: number;
  /** Moments past `limit`, in reading order, not kept. */
  readonly overLimit: number;
}

/** How many moments `found` holds once overlaps are one: what a run counts against its bound as it goes. */
export function countPassageSearchMoments(found: readonly PassageSearchFound[]): number {
  return moments(found).kept.length;
}

/** The result's instances, label table and files, from everything found. */
export function mergePassageSearchInstances(
  files: readonly PassageSearchPlanFile[],
  found: readonly PassageSearchFound[],
  limit: number,
  contextCharacters: number
): PassageSearchMerged {
  const { kept: all, duplicates } = moments(found);
  const kept = all.slice(0, limit);
  const lineStarts = new Map<number, number[]>();
  const labels = new Map<string, { label: string; count: number; files: Set<number> }>();
  const perFile = new Map<number, number>();
  const instances = kept.map((moment, index): PassageSearchInstance => {
    const file = files[moment.file];
    const key = passageSearchLabelKey(moment.label);
    const row = labels.get(key) ?? { label: moment.label, count: 0, files: new Set<number>() };
    row.count += 1;
    row.files.add(moment.file);
    labels.set(key, row);
    perFile.set(moment.file, (perFile.get(moment.file) ?? 0) + 1);
    if (!lineStarts.has(moment.file)) {
      lineStarts.set(moment.file, lineStartsOf(file.text));
    }
    return {
      number: index + 1,
      file: file.key,
      displayPath: file.displayPath,
      line: file.lineOffset + lineAt(lineStarts.get(moment.file)!, moment.start),
      start: moment.start,
      end: moment.end,
      quote: file.text.slice(moment.start, moment.end),
      before: file.text.slice(wholeCharacterAt(file.text, Math.max(0, moment.start - contextCharacters)), moment.start),
      after: file.text.slice(moment.end, wholeCharacterAt(file.text, Math.min(file.text.length, moment.end + contextCharacters))),
      note: moment.note,
      label: key
    };
  });
  return {
    instances,
    // Most used first; ties keep reading order, which is the map's insertion order.
    labels: [...labels.entries()]
      .map(([key, row]) => ({ key, label: row.label, count: row.count, files: row.files.size }))
      .sort((a, b) => b.count - a.count),
    files: files.map((file, index) => ({
      key: file.key,
      displayPath: file.displayPath,
      ...(file.absolutePath !== undefined ? { absolutePath: file.absolutePath } : {}),
      lines: file.lines,
      instances: perFile.get(index) ?? 0
    })),
    duplicates,
    overLimit: all.length - kept.length
  };
}

/** The key two spellings of one label share. */
export function passageSearchLabelKey(label: string): string {
  return foldSearchText(label).replace(/ +/g, ' ').trim();
}

/** In reading order, overlaps within a file made one: the earliest-starting stands. */
function moments(found: readonly PassageSearchFound[]): { kept: PassageSearchFound[]; duplicates: number } {
  // A stable sort, so of two that start together the one read first stands.
  const ordered = [...found].sort((a, b) => a.file - b.file || a.start - b.start);
  const kept: PassageSearchFound[] = [];
  let duplicates = 0;
  for (const next of ordered) {
    const last = kept[kept.length - 1];
    if (last && last.file === next.file && next.start < last.end) {
      duplicates += 1;
    } else {
      kept.push(next);
    }
  }
  return { kept, duplicates };
}

function lineStartsOf(text: string): number[] {
  const starts = [0];
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    starts.push(index + 1);
  }
  return starts;
}

/** The 1-based line holding `offset`. */
function lineAt(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low + 1;
}

/** `offset`, moved off the middle of a surrogate pair so a context never starts or ends on half a character. */
function wholeCharacterAt(text: string, offset: number): number {
  const code = text.charCodeAt(offset);
  return offset > 0 && offset < text.length && code >= 0xdc00 && code <= 0xdfff ? offset + 1 : offset;
}
