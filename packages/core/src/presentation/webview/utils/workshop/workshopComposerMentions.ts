/**
 * `@` in the Workshop composer (Everyday Conveniences round two, item G): the
 * pure rules. Where an `@` opens the file list, which configured files a
 * query keeps, the token a picked file leaves in the sentence, and the draft
 * after a pick.
 *
 * The token is prose (decision A1): the staged pill is what is sent, and
 * nothing here reads a token back out of a draft.
 *
 * A file token can never read as a persona token (decision A2). Its first
 * word, the stretch before any whitespace, always holds a `.` or a `/`:
 * the file's extension, or enough of its path. A persona token (`@Jill`,
 * later) holds neither.
 *
 * Matching is folded substring search (`foldedTextSearch`): no pattern is
 * ever built from what the writer typed.
 */

import type { ConfiguredResourceEntry, ConfiguredResourceRef } from '@messages';
import { foldSearchQuery, foldSearchText } from '@shared/utils/foldedTextSearch';

export const WORKSHOP_MENTION_LIMITS = {
  /** File rows drawn at once; the rest are counted, and typing narrows them. */
  rows: 50,
  /** Characters of a query that are searched; a longer one is clipped, never refused. */
  queryCharacters: 120
} as const;

/** An `@` the caret is typing after. */
export interface WorkshopMentionTrigger {
  /** Offset of the `@`. */
  start: number;
  /** Offset of the caret: the query is the text between. */
  end: number;
  query: string;
}

/** What may stand directly before an `@` that opens the list: nothing, whitespace, or an opening bracket or quote. */
const OPENERS = new Set(['(', '[', '{', '<', '"', "'", '“', '‘', '«']);

const isWhitespace = (character: string): boolean => /\s/.test(character);

/**
 * The `@` the caret stands after, if it opens the list: at the start of the
 * text, or after whitespace or an opening bracket or quote, with no
 * whitespace typed since. An `@` inside a word (an email address) opens
 * nothing.
 */
export function detectWorkshopMentionTrigger(text: string, caret: number): WorkshopMentionTrigger | null {
  const end = Math.max(0, Math.min(caret, text.length));
  for (let offset = end - 1; offset >= 0; offset -= 1) {
    const character = text[offset];
    if (isWhitespace(character)) {
      return null;
    }
    if (character === '@') {
      const before = offset === 0 ? '' : text[offset - 1];
      return before === '' || isWhitespace(before) || OPENERS.has(before)
        ? { start: offset, end, query: text.slice(offset + 1, end) }
        : null;
    }
  }
  return null;
}

/** One resource's identity, as the shared picker compares them: group and path. */
export const workshopMentionKey = (ref: ConfiguredResourceRef): string => `${ref.group}\u0000${ref.path}`;

const segmentsOf = (path: string): string[] => path.split('/').filter((segment) => segment.length > 0);

/** Decision A2's rule: the token's first word holds a `.` or a `/`. */
export function isWorkshopFileMentionToken(token: string): boolean {
  const firstWord = token.split(/\s/, 1)[0] ?? '';
  return firstWord.includes('.') || firstWord.includes('/');
}

/**
 * The token each catalog file leaves in the sentence, without the `@`: the
 * shortest run of its path's last segments that no other file's path ends
 * with and that keeps decision A2's rule. A file alone in its name is its
 * base name (`alice-ch3.md`), which is its pill's label; two `notes.md` are
 * `characters/notes.md` and `locations/notes.md`, each the end of its pill's
 * path. A file whose whole path still cannot hold the rule takes `./`.
 */
export function workshopMentionTokens(catalog: readonly ConfiguredResourceEntry[]): Map<string, string> {
  const pathsBySuffix = new Map<string, Set<string>>();
  for (const entry of catalog) {
    const segments = segmentsOf(entry.path);
    for (let take = 1; take <= segments.length; take += 1) {
      const suffix = segments.slice(-take).join('/').toLowerCase();
      const paths = pathsBySuffix.get(suffix) ?? new Set<string>();
      paths.add(entry.path);
      pathsBySuffix.set(suffix, paths);
    }
  }

  const tokens = new Map<string, string>();
  for (const entry of catalog) {
    const segments = segmentsOf(entry.path);
    let token = segments.join('/');
    for (let take = 1; take <= segments.length; take += 1) {
      const suffix = segments.slice(-take).join('/');
      if ((pathsBySuffix.get(suffix.toLowerCase())?.size ?? 0) <= 1 && isWorkshopFileMentionToken(suffix)) {
        token = suffix;
        break;
      }
    }
    tokens.set(workshopMentionKey(entry), isWorkshopFileMentionToken(token) ? token : `./${token}`);
  }
  return tokens;
}

/** One file row of the list. */
export interface WorkshopMentionFileRow {
  entry: ConfiguredResourceEntry;
  /** What a pick writes after the `@`. */
  token: string;
  /** Already a pill on this message: a pick writes the token and stages nothing. */
  staged: boolean;
}

export interface WorkshopMentionFileMatches {
  rows: WorkshopMentionFileRow[];
  /** Every file the query keeps, drawn or not. */
  total: number;
}

/**
 * The files a query keeps, best first: a name that starts with it, then a
 * name that holds it, then a path that holds it; the catalog's own order
 * within each. An empty query keeps every file.
 */
export function filterWorkshopMentionFiles(
  catalog: readonly ConfiguredResourceEntry[],
  query: string,
  stagedKeys: ReadonlySet<string>,
  limit: number = WORKSHOP_MENTION_LIMITS.rows
): WorkshopMentionFileMatches {
  const folded = foldSearchQuery(query, WORKSHOP_MENTION_LIMITS.queryCharacters);
  const ranked: ConfiguredResourceEntry[][] = [[], [], []];
  for (const entry of catalog) {
    if (folded.length === 0) {
      ranked[0].push(entry);
      continue;
    }
    const label = foldSearchText(entry.label);
    if (label.startsWith(folded)) {
      ranked[0].push(entry);
    } else if (label.includes(folded)) {
      ranked[1].push(entry);
    } else if (foldSearchText(entry.path).includes(folded)) {
      ranked[2].push(entry);
    }
  }
  const kept = ranked.flat();
  const tokens = workshopMentionTokens(catalog);
  return {
    total: kept.length,
    rows: kept.slice(0, Math.max(0, limit)).map((entry) => {
      const key = workshopMentionKey(entry);
      return { entry, token: tokens.get(key) ?? entry.path, staged: stagedKeys.has(key) };
    })
  };
}

/** A draft after the list changed it, and where the caret goes. */
export interface WorkshopMentionEdit {
  text: string;
  caret: number;
}

/**
 * The draft with the typed `@…` replaced by a picked file's token. A space
 * follows the token unless whitespace already does, so the sentence goes on.
 */
export function applyWorkshopMentionPick(
  text: string,
  trigger: WorkshopMentionTrigger,
  token: string
): WorkshopMentionEdit {
  const after = text.slice(trigger.end);
  const gap = after.length > 0 && isWhitespace(after[0]) ? '' : ' ';
  const inserted = `@${token}${gap}`;
  const caret = trigger.start + inserted.length + (gap === '' && after.length > 0 ? 1 : 0);
  return { text: `${text.slice(0, trigger.start)}${inserted}${after}`, caret };
}

/** The draft with the typed `@…` taken out: it asked for the picker, and names no file. */
export function removeWorkshopMentionTrigger(text: string, trigger: WorkshopMentionTrigger): WorkshopMentionEdit {
  return { text: `${text.slice(0, trigger.start)}${text.slice(trigger.end)}`, caret: trigger.start };
}

/** A file's size, as the project picker writes it. */
export const workshopMentionSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
