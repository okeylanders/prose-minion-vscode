/**
 * What a `history.*` result says (ADR 2026-11-19 D11, D13). Pure: the
 * capability asks the host and measures; this module writes the text.
 *
 * - **A log page** lists `logPageCommits` commits, newest first: the short
 *   id, the author's date, the author's name (G3) and the subject. A
 *   continuation is written exactly when a later page exists, and is that
 *   page's complete call. A page past the end answers in words, with no
 *   call. A history read `logScanCommits` back says so on its last page.
 * - **A diff** shows whole changes, numbered in document order, from the
 *   change asked. A diff that shows fewer than it has ends with the
 *   complete call for the rest, naming a later `<startChange>`. A change is
 *   never cut; only the unchanged context beside a run is.
 * - **Every call written here decodes as written** through the codec, and
 *   names a later page or a later change than its request.
 * - Every subject, author and paragraph passes the copy's neutralizers.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { FileHistoryCommit } from '@/platform';
import type { WorkshopHistoryFile } from '@shared/types/workshopCapabilities';
import { workshopCapabilityPageOf } from '@/application/services/workshop/WorkshopCapabilityPaging';
import type {
  WorkshopHistoryChange,
  WorkshopHistoryContextParagraph,
  WorkshopHistoryWordPart
} from '@/application/services/workshop/history/WorkshopHistoryDiff';
import {
  workshopHistoryBody,
  workshopHistoryCut,
  workshopHistoryDiffCall,
  workshopHistoryLogCall,
  workshopHistoryProse,
  workshopHistoryText
} from '@/application/services/workshop/history/WorkshopHistoryCopy';

const number = (value: number): string => value.toLocaleString('en-US');
const count = (value: number, singular: string, plural = `${singular}s`): string =>
  `${number(value)} ${value === 1 ? singular : plural}`;

/** A commit's id as results show it: the first `shownIdCharacters`. */
export function workshopHistoryShownId(commit: Pick<FileHistoryCommit, 'id'>): string {
  return commit.id.slice(0, PROMPT_BUDGETS.workshopHistory.shownIdCharacters);
}

/**
 * A commit's id as a written call names it: the full hash, or its first 40
 * characters in a SHA-256 repository, so it always has the codec's form and
 * names exactly one commit of the log it came from.
 */
export function workshopHistoryCallId(commit: Pick<FileHistoryCommit, 'id'>): string {
  return commit.id.slice(0, 40);
}

/** The author's date as `YYYY-MM-DD`, or a word when the host gave none. */
function shownDate(commit: FileHistoryCommit): string {
  return commit.authoredAt && /^\d{4}-\d{2}-\d{2}/.test(commit.authoredAt) ? commit.authoredAt.slice(0, 10) : 'date unknown';
}

export interface WorkshopHistoryLogInput {
  readonly file: WorkshopHistoryFile;
  /** The file as the result names it: its configured path, or the excerpt's file. */
  readonly label: string;
  readonly page: number;
  /** What the host returned: up to `page × logPageCommits + 1`, never past `logScanCommits`. */
  readonly commits: readonly FileHistoryCommit[];
  /** The host was asked for `logScanCommits` and gave that many: older commits may exist unread. */
  readonly scanLimited: boolean;
}

export interface WorkshopHistoryRenderedLog {
  readonly content: string;
  readonly shown: number;
  readonly pastEnd: boolean;
  readonly hint?: string;
}

export function renderWorkshopHistoryLog(input: WorkshopHistoryLogInput): WorkshopHistoryRenderedLog {
  const budgets = PROMPT_BUDGETS.workshopHistory;
  const paged = workshopCapabilityPageOf(input.commits.length, budgets.logPageCommits, input.page);
  const shown = input.commits.slice(paged.start, paged.end);
  const hint = paged.next !== undefined ? workshopHistoryLogCall(input.file, paged.next) : undefined;
  const label = workshopHistoryText(input.label);
  const scanNote = `The history is read at most ${number(budgets.logScanCommits)} commits back; older commits are not listed.`;
  const lines = paged.pastEnd
    ? [
      input.commits.length === 0
        ? `Page ${number(input.page)} is past the end: no commit is listed for ${label}.`
        : `Page ${number(input.page)} is past the end: ${input.scanLimited ? 'at least ' : ''}` +
          `${count(input.commits.length, 'commit')}, ${count(paged.pages, 'page')}.`,
      ...(input.scanLimited ? [scanNote] : [])
    ]
    : [
      `History of ${label}, newest first: commits ${number(paged.start + 1)}–${number(paged.end)}` +
        `${hint || input.scanLimited ? '' : ` of ${number(input.commits.length)}`}. ` +
        'Each line: id · author\'s date · author · subject. Compare two versions with history.diff, by the ids shown.',
      ...shown.map((commit) =>
        `- ${workshopHistoryShownId(commit)} · ${shownDate(commit)} · ` +
        `${workshopHistoryCut(workshopHistoryText(commit.author), budgets.authorCharacters) || 'author unknown'} · ` +
        `${workshopHistoryCut(workshopHistoryText(commit.subject), budgets.subjectCharacters) || '(no subject)'}`
      ),
      ...(hint ? [`More commits follow. The next page: ${hint}`] : []),
      ...(!hint && input.scanLimited ? [scanNote] : [])
    ];
  return { content: workshopHistoryBody(lines), shown: shown.length, pastEnd: paged.pastEnd, ...(hint ? { hint } : {}) };
}

/** One side of a diff as its header names it. */
export interface WorkshopHistorySide {
  readonly kind: 'commit' | 'current';
  /** The commit, for a commit side. */
  readonly commit?: FileHistoryCommit;
  /** The file did not exist at that commit: read as empty. */
  readonly absent?: boolean;
}

export interface WorkshopHistoryDiffInput {
  readonly file: WorkshopHistoryFile;
  readonly label: string;
  readonly from: WorkshopHistorySide & { readonly commit: FileHistoryCommit };
  readonly to: WorkshopHistorySide;
  /** The saved text's mark, for a `current` side: what a continuation carries. */
  readonly currentMark?: string;
  readonly changes: readonly WorkshopHistoryChange[];
  /** The two texts are equal; with no changes but unequal texts, only the space between paragraphs differs. */
  readonly identical: boolean;
  /** The first change shown, from 1. */
  readonly startChange: number;
  /** How many changes, from `startChange`, this rendering shows. */
  readonly take: number;
  /** What limited the read, when it shows fewer changes than it has. */
  readonly limitedBy?: 'context-window' | 'diff-bytes';
}

export interface WorkshopHistoryRenderedDiff {
  readonly content: string;
  readonly shown: number;
  readonly hint?: string;
}

function sideLabel(side: WorkshopHistorySide): string {
  if (side.kind === 'current') {
    return 'current (the file as saved on disk; unsaved changes in the editor are not included)';
  }
  const commit = side.commit!;
  return `${workshopHistoryShownId(commit)} (${shownDate(commit)})${side.absent ? ', where the file did not exist' : ''}`;
}

/** The header lines every diff result opens with. */
function diffHeader(input: WorkshopHistoryDiffInput): string[] {
  const kinds = { added: 0, removed: 0, changed: 0 };
  for (const change of input.changes) {
    kinds[change.kind === 'changed-whole' ? 'changed' : change.kind] += 1;
  }
  const total = input.changes.length;
  return [
    `Diff of ${workshopHistoryText(input.label)}: ${sideLabel(input.from)} → ${sideLabel(input.to)}.`,
    total === 0
      ? (input.identical
        ? 'No changes: the two versions read the same.'
        : 'No paragraph changed: the two versions differ only in the space between paragraphs.')
      : `${count(total, 'change')}: ${number(kinds.changed)} changed, ${number(kinds.added)} added, ${number(kinds.removed)} removed ` +
        '(paragraphs, numbered ¶ in the newer version; "was ¶" in the older). ' +
        'Inside a changed paragraph, removed words are shown ~~like this~~ and added words **like this**; ' +
        'a literal \\* or \\~ in the text is shown with a backslash, and a line break inside a paragraph as " / ".'
  ];
}

export function renderWorkshopHistoryDiff(input: WorkshopHistoryDiffInput): WorkshopHistoryRenderedDiff {
  const total = input.changes.length;
  const start = input.startChange;
  if (total > 0 && start > total) {
    const lines = [...diffHeader(input), `Change ${number(start)} is past the end: ${count(total, 'change')}.`];
    return { content: workshopHistoryBody(lines), shown: 0 };
  }
  const shown = input.changes.slice(start - 1, start - 1 + input.take);
  const next = start + shown.length;
  const hint = next <= total
    ? workshopHistoryDiffCall(
      input.file,
      workshopHistoryCallId(input.from.commit),
      input.to.kind === 'current'
        ? { kind: 'current', fingerprint: input.currentMark! }
        : { kind: 'commit', commit: workshopHistoryCallId(input.to.commit!) },
      next
    )
    : undefined;
  const lines = [
    ...diffHeader(input),
    ...(input.limitedBy && hint
      ? [`This diff was limited to changes ${number(start)}–${number(next - 1)} of ${number(total)} by ` +
        `${input.limitedBy === 'context-window' ? 'the room left in your context window' : 'the size one diff result may have'}.`]
      : []),
    ...shown.flatMap((change, offset) => changeLines(change, start + offset, shown[offset - 1])),
    ...(hint
      ? [`Changes ${number(next)}–${number(total)} not shown. The exact call for them: ${hint}`]
      : [])
  ];
  return { content: workshopHistoryBody(lines), shown: shown.length, ...(hint ? { hint } : {}) };
}

function changeLines(change: WorkshopHistoryChange, ordinal: number, previous: WorkshopHistoryChange | undefined): string[] {
  // An unchanged paragraph between two runs is shown once, after the first.
  const shownAfter = new Set((previous?.after ?? []).map((paragraph) => paragraph.number));
  const lines = (change.before ?? [])
    .filter((paragraph) => !shownAfter.has(paragraph.number))
    .map((paragraph) => contextLine('before', paragraph));
  const head = `Change ${number(ordinal)} · `;
  switch (change.kind) {
    case 'added':
      lines.push(`${head}¶ ${number(change.newNumber)}, added: ${workshopHistoryProse(change.text)}`);
      break;
    case 'removed':
      lines.push(`${head}was ¶ ${number(change.oldNumber)}, removed: ${workshopHistoryProse(change.text)}`);
      break;
    case 'changed':
      lines.push(`${head}${numbers(change.newNumber, change.oldNumber)}, changed: ${marked(change.words)}`);
      break;
    case 'changed-whole':
      lines.push(
        `${head}${numbers(change.newNumber, change.oldNumber)}, changed, shown whole ` +
          `(${change.why === 'long-paragraph' ? 'the paragraph is too long' : 'it changed too much'} to compare word by word):`,
        `  Before: ${workshopHistoryProse(change.oldText)}`,
        `  After: ${workshopHistoryProse(change.newText)}`
      );
      break;
    default:
      return assertNever(change);
  }
  lines.push(...(change.after ?? []).map((paragraph) => contextLine('after', paragraph)));
  return lines;
}

const numbers = (newer: number, older: number): string =>
  `¶ ${number(newer)}${newer === older ? '' : ` (was ¶ ${number(older)})`}`;

function contextLine(where: 'before' | 'after', paragraph: WorkshopHistoryContextParagraph): string {
  const text = workshopHistoryCut(workshopHistoryProse(paragraph.text), PROMPT_BUDGETS.workshopHistory.contextCharacters);
  return `  Unchanged ${where}, ¶ ${number(paragraph.number)}: “${text}”`;
}

/** Word parts with the diff's marks; whitespace stays outside a mark, and a removal and an addition never touch. */
function marked(parts: readonly WorkshopHistoryWordPart[]): string {
  let out = '';
  let previous: WorkshopHistoryWordPart['kind'] | undefined;
  for (const part of parts) {
    const text = workshopHistoryProse(part.text);
    if (part.kind === 'same') {
      out += text;
    } else {
      const mark = part.kind === 'removed' ? '~~' : '**';
      const core = text.trim();
      const lead = text.slice(0, text.length - text.trimStart().length);
      const trail = text.slice(text.trimEnd().length);
      const gap = previous && previous !== 'same' && !/\s$/.test(out) && lead === '' ? ' ' : '';
      out += core ? `${gap}${lead}${mark}${core}${mark}${trail}` : text;
    }
    previous = part.kind;
  }
  return out;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history change: ${JSON.stringify(value)}`);
}
