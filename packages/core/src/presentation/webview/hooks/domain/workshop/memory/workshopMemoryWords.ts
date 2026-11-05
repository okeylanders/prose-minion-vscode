/**
 * The words the Memory tab and the manager share (Slice 0d's copy; the
 * design README's "Words": the UI never says "pin"). Pure.
 */

import type { ProjectMemoryKind, ProjectMemoryOrigin } from '@shared/types/projectMemory';
import type { WorkshopMemoryEntry, WorkshopMemorySource } from './workshopMemoryViewInputs';

/** A count, as the design writes them: "1,800". Fixed to en-US, so tests and screens agree. */
export function memoryCount(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

/**
 * A token figure the writer reads as "about N": to the nearest 10 under a
 * thousand, the nearest 100 from there. An over-budget figure rounds up
 * (`over`), so a requested total past the budget never reads as within it.
 */
export function aboutTokens(value: number, over = false): string {
  const tokens = Math.max(0, value);
  const step = tokens < 1_000 ? 10 : 100;
  const rounded = over ? Math.ceil(tokens / step) * step : Math.round(tokens / step) * step;
  return memoryCount(tokens > 0 && rounded === 0 ? step : rounded);
}

/** "1 memory", "12 memories". */
export function memoriesWord(count: number): string {
  return `${memoryCount(count)} ${count === 1 ? 'memory' : 'memories'}`;
}

/** "1 file", "3 files". */
export function filesWord(count: number): string {
  return `${memoryCount(count)} ${count === 1 ? 'file' : 'files'}`;
}

/** A kind as a row's meta line says it. */
export const MEMORY_KIND_WORDS: Readonly<Record<ProjectMemoryKind, string>> = Object.freeze({
  decision: 'decision',
  canon: 'canon',
  preference: 'preference',
  'open-thread': 'open thread'
});

/** A kind's group heading, in the manager's order. */
export const MEMORY_KIND_GROUPS: ReadonlyArray<{ readonly kind: ProjectMemoryKind; readonly label: string }> = [
  { kind: 'decision', label: 'Decisions' },
  { kind: 'canon', label: 'Canon' },
  { kind: 'preference', label: 'Preferences' },
  { kind: 'open-thread', label: 'Open threads' }
];

/** Who saved a memory, in words (Slice 0d decision 12). */
export function memoryOriginWords(origin: ProjectMemoryOrigin, proposedByLabel: string | undefined): string {
  const persona = proposedByLabel?.trim() || 'a persona';
  switch (origin) {
    case 'writer':
      return 'written by you';
    case 'proposed':
      return `suggested by ${persona} · saved by you`;
    case 'auto':
      return `saved by ${persona}`;
  }
}

/**
 * Where a memory came from. Only a saved, named session is named; a source
 * that can't be named now (the current room, unnamed, deleted, unreadable)
 * says it isn't available, and none says none. Never "made in the manager",
 * which format 1 can't know (PR #196 watchpoint 5).
 */
export function memorySourceWords(source: WorkshopMemorySource): string {
  switch (source.kind) {
    case 'session':
      return `from “${source.title}”`;
    case 'unnamed':
      return 'source conversation not available';
    case 'none':
      return 'no source conversation';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 3": a memory's day, as its ISO time names it (UTC, as the file writes it). */
export function memoryDay(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) {
    return 'unknown date';
  }
  const date = new Date(time);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** “A”, “A” and “B”, “A”, “B” and “C”. */
export function quotedList(titles: readonly string[]): string {
  const quoted = titles.map((title) => `“${title}”`);
  if (quoted.length <= 1) {
    return quoted[0] ?? '';
  }
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

/** File names, plain, joined the same way. */
export function plainList(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The store's reason for bytes kept under a claim beside a standing file of
 * the row's name, that are not its earlier version (Slice 1, PR #194 F-02).
 * The row names the standing file, not the copy, so it offers no Open file:
 * opening it would show the standing file. The store restores the copy as
 * a file of its own once it can; nothing removes it.
 */
export const WORKSHOP_MEMORY_SET_ASIDE = 'set-aside';

/** Whether a memory loads at the start of a conversation: active and not superseded (D4, D5). */
export function memoryInEffect(entry: Pick<WorkshopMemoryEntry, 'status' | 'superseded'>): boolean {
  return entry.status === 'active' && !entry.superseded;
}

const KEY_WORDS: Readonly<Record<string, string>> = Object.freeze({
  kind: '“kind” isn’t one Memory knows: decision, canon, preference or open-thread',
  status: '“status” isn’t active or archived',
  origin: '“origin” isn’t writer, proposed or auto',
  pinned: '“pinned” isn’t true or false',
  format: '“format” isn’t a number this build reads'
});

/**
 * Why a file can't be read, in the writer's words (the codec's reasons,
 * Slice 1). `short` is the tab's list; the manager's row says it whole.
 */
export function unreadableReasonWords(reason: string, key: string | undefined, short = false): string {
  const at = key ? `“${key}”` : 'a value';
  switch (reason) {
    case 'no-frontmatter':
      return 'it doesn’t open with a --- line';
    case 'unclosed-frontmatter':
      return 'no closing --- line';
    case 'malformed-line':
      return 'a frontmatter line isn’t “key: value”';
    case 'unknown-key':
      return `${key ? `“${key}”` : 'a key'} isn’t a key Memory knows`;
    case 'duplicate-key':
      return `${key ? `“${key}”` : 'a key'} appears twice`;
    case 'missing-key':
      return `${key ? `“${key}”` : 'a required key'} is missing or empty`;
    case 'unsupported-format':
      return 'it’s written in a format this version doesn’t read';
    case 'invalid-value': {
      const words = key ? KEY_WORDS[key] : undefined;
      if (words) {
        return short ? words.split(':')[0] : words;
      }
      return `${at} isn’t in a shape Memory reads`;
    }
    case 'too-long':
      return `${at} is longer than Memory allows`;
    case 'proposal-without-provenance':
      return 'a suggested memory without its persona, session or turns';
    case 'turns-without-session':
      return 'source turns without the session they belong to';
    case 'updated-before-created':
      return '“updated” is earlier than “created”';
    case 'supersedes-itself':
      return 'it replaces itself';
    case 'too-large':
      return 'the file is too large to read';
    case 'not-text':
      return 'the file isn’t UTF-8 text';
    case 'read-failed':
      return 'the file couldn’t be read just now';
    case 'set-aside':
      return short
        ? 'a copy set aside, not yet put back'
        : 'a copy kept beside this file couldn’t be put back yet. Memory moves it to a file of its own as soon as it can, and never removes it';
    default:
      return 'it doesn’t read as a memory file';
  }
}

/** The same reason as the start of a sentence, ending in a period. */
export function unreadableReasonSentence(reason: string, key: string | undefined): string {
  const words = unreadableReasonWords(reason, key);
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
