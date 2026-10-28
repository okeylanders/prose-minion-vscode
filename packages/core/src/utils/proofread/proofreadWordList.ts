/**
 * The writer's word list (Draft Edit Slice 3b, part 2; ADR 2026-10-21,
 * Amendment 2026-10-26): the names and invented words the writer accepts,
 * from `proseMinion.proofread.wordList`. Pure.
 *
 * - **Normalized at the gesture** (`proofreadWordList`). Strings only. An
 *   entry of several words counts word by word ("Mad Hatter" accepts "Mad"
 *   and "Hatter"). A word is letters and digits, with apostrophes or hyphens
 *   inside it ("O'Brien", "Glimmer-fox"). Repeats, by case, are dropped.
 * - **Matched as words, case set aside.** A curly apostrophe reads as a
 *   straight one, and a possessive "'s" is set aside, so "Dinah’s" is
 *   "Dinah". A hyphenated word holds its parts too.
 * - **Each chunk carries only the listed words it holds** (`acceptedWordsIn`),
 *   so a long list never fills a request.
 * - **The backstop** (`isAcceptedWord`): a quote that is one listed word,
 *   give or take the punctuation around it.
 */

/** One word of a text: a possessive "'s" set aside, so `end` stops before it. */
export interface ProofreadWord {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const WORD = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
const POSSESSIVE = /['’][sS]$/u;

/** The words of `text`, in order, each with its possessive set aside. */
export function proofreadWords(text: string): ProofreadWord[] {
  const words: ProofreadWord[] = [];
  for (const match of text.matchAll(WORD)) {
    const start = match.index ?? 0;
    const word = POSSESSIVE.test(match[0]) ? match[0].slice(0, -2) : match[0];
    words.push({ start, end: start + word.length, text: word });
  }
  return words;
}

/** How a word is compared: case and apostrophe shape set aside. */
export function proofreadWordKey(word: string): string {
  return word.normalize('NFC').replace(/’/g, "'").toLowerCase();
}

/** The setting's value as a run carries it: its words, in order, each once. Anything else names none. */
export function proofreadWordList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    for (const { text } of proofreadWords(entry.normalize('NFC'))) {
      const key = proofreadWordKey(text);
      if (!seen.has(key)) {
        seen.add(key);
        list.push(text);
      }
    }
  }
  return list;
}

/** The keys a run compares against. */
export function proofreadWordListKeys(list: readonly string[]): ReadonlySet<string> {
  return new Set(list.map(proofreadWordKey));
}

/** The listed words `text` holds, as listed, in the list's order. */
export function acceptedWordsIn(list: readonly string[], text: string): string[] {
  if (list.length === 0) {
    return [];
  }
  const present = new Set<string>();
  for (const word of proofreadWords(text)) {
    keysOf(word.text).forEach((key) => present.add(key));
  }
  return list.filter((word) => present.has(proofreadWordKey(word)));
}

/** Whether `quote` is one word the list accepts: whole, or every part of a hyphenated word. */
export function isAcceptedWord(accepted: ReadonlySet<string>, quote: string): boolean {
  if (accepted.size === 0) {
    return false;
  }
  const words = proofreadWords(quote);
  if (words.length !== 1) {
    return false;
  }
  const key = proofreadWordKey(words[0].text);
  return accepted.has(key) || (key.includes('-') && key.split('-').every((part) => accepted.has(part)));
}

/** A word's key, and its parts' keys when it is hyphenated. */
function keysOf(word: string): string[] {
  const key = proofreadWordKey(word);
  return key.includes('-') ? [key, ...key.split('-')] : [key];
}
