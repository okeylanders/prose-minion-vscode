/**
 * Field decoders for Lightbox reading blocks (ADR 2026-10-19 D7). Pure: no
 * host, no I/O. Every block codec (`LightboxReadingCodec` and its siblings)
 * reads a quote, a term, a list or a bounded string through these, so the
 * rules are the same in every lens. Each throws a shape error naming the
 * field's path (a host path, never a model's field name); the caller decides
 * whether that withholds an item or a block.
 *
 * **Asks, not gates (Slice 4H, epic decision 37).** A number a prompt
 * states (`PROMPT_BUDGETS.lightbox`) is what it asks for. A field longer
 * than its ask, or a list with more items than asked, is read and shown:
 * only a real fault throws here (a wrong type, a blank field, a list shorter
 * than its stated minimum).
 *
 * **Checked whole, clipped only as prose (PR #165 F-01).** Every field a
 * rule reads is read whole with `text`: a quote the verifier finds, a term
 * the counter counts, a title or name used as a key or counted, an example
 * anchored in its quote, and every field a text rule checks (a spark's
 * question, the Opinion's texts, craft steering's, a numbers reading's, an
 * echo's), fresh, on carry or at Bring. Only free prose no rule reads (a
 * claim, gist, note, friction, description or reason) is read with `prose`,
 * which clips a runaway one at the one safety ceiling, `safetyMultiple`
 * times its ask, with an ellipsis; each clip is counted
 * (`countLightboxClips`) so the reply's log line can say how many, and none
 * withholds anything. A clip is display: nothing ever checks a clipped
 * value against the chapter, so its ellipsis is never taken for the
 * chapter's text. A quote needs no ceiling: the verifier holds it to the
 * paragraph it names.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { clipLightboxText } from '@shared/constants/lightboxClip';
import type { LightboxMalformedItem, LightboxWireQuote } from '@/infrastructure/lightbox/LightboxReadingWire';
import { exactObject, objectAt, shapeError, stringAt } from '@/application/services/workshop/persistedValidation';

const B = PROMPT_BUDGETS.lightbox;

/**
 * A digit outside a ¶ address: a reading that states a number where the
 * board's counts belong (a spark, Slice 4; a numbers reading, Slice 4B).
 */
export const LIGHTBOX_BARE_DIGIT = /(?<!¶\s?\d*)\d/u;

/**
 * The fields clipped at the safety ceiling while one decode runs. Decoding
 * is synchronous, so a decode's clips are exactly those counted between its
 * start and its end; nesting keeps each its own.
 */
let clips: { count: number } | undefined;

/** Run `decode`, counting the fields it clips at the safety ceiling. */
export function countLightboxClips<T>(decode: () => T): { value: T; clipped: number } {
  const outer = clips;
  const own = { count: 0 };
  clips = own;
  try {
    return { value: decode(), clipped: own.count };
  } finally {
    clips = outer;
  }
}

/**
 * Display prose as kept: whole up to the safety ceiling for its ask, clipped
 * with an ellipsis past it, and counted. Never for a field a rule reads.
 */
export function lightboxFieldAtCeiling(value: string, ask: number): string {
  const ceiling = ask * B.safetyMultiple;
  if (value.length <= ceiling) {
    return value;
  }
  if (clips) {
    clips.count += 1;
  }
  return clipLightboxText(value, ceiling);
}

/**
 * A nonblank string, trimmed, whole: what a rule reads (a quote, a term, a
 * key, a field a text rule checks). However far past its ask, it is never
 * clipped, so every check sees what the model wrote.
 */
export function text(value: unknown, path: string): string {
  stringAt(value, path);
  const trimmed = (value as string).trim();
  if (trimmed.length === 0) {
    shapeError(path, 'a non-empty string');
  }
  return trimmed;
}

/**
 * Free prose no rule reads (a claim, gist, note, friction, description or
 * reason): a nonblank string, trimmed, shown whole past its `ask`, and
 * clipped only past the safety ceiling (`lightboxFieldAtCeiling`). Never a
 * quote, a term, a key, or a field any text rule checks, fresh, on carry or
 * at Bring: read those with `text`.
 */
export function prose(value: unknown, path: string, ask: number): string {
  return lightboxFieldAtCeiling(text(value, path), ask);
}

/**
 * A list with at least `minimum` entries. Its ask (how many a prompt asks
 * for) is never checked: more entries than asked are read and shown. A list
 * whose size is structural (one score per ribbon column, the two fields of a
 * collision) is checked where it is read, with `boundedArrayAt`.
 */
export function listAt(value: unknown, path: string, minimum: number, noun: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < minimum) {
    shapeError(path, minimum === 0 ? `an array of ${noun}` : `an array of ${minimum} or more ${noun}`);
  }
}

/** Words or short phrases as they stand in the chapter; the host counts them. */
export function terms(value: unknown, path: string, minimum = 1): string[] {
  listAt(value, path, minimum, 'terms');
  return value.map((term, index) => text(term, `${path}[${index}]`));
}

export function evidence(value: unknown, path: string, minimum: number): LightboxWireQuote[] {
  listAt(value, path, minimum, 'quotes');
  return value.map((item, index) => singleQuote(item, `${path}[${index}]`));
}

/** One `{para, quote}` pair, its quote whole: the verifier holds it to the paragraph it names (PR #165 F-01). */
export function singleQuote(value: unknown, path: string): LightboxWireQuote {
  const pair = strictObject(value, path, ['para', 'quote']);
  return { para: paragraphNumber(pair.para, `${path}.para`), quote: text(pair.quote, `${path}.quote`) };
}

/**
 * `exactObject`, except that fields the format does not define are counted,
 * never named: a field name is the model's, and this reason reaches the board
 * (PR #149 F-05).
 */
export function strictObject(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  const object = objectAt(value, path);
  const undefinedFields = Object.keys(object).filter((key) => !keys.includes(key)).length;
  if (undefinedFields > 0) {
    throw new Error(`${path} has ${lightboxFieldCount(undefinedFields)} the format does not define.`);
  }
  return exactObject(object, path, keys);
}

/** "1 field", "3 fields". */
export function lightboxFieldCount(count: number): string {
  return `${count} field${count === 1 ? '' : 's'}`;
}

/** Whether the paragraph was declared is the verifier's question, not the codec's. */
export function paragraphNumber(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    shapeError(path, 'a paragraph number (a whole number from 1)');
  }
  return value as number;
}

/** A claimed 0–1 figure (affinity, pull), rounded to two decimals. */
export function claimedFraction(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    shapeError(path, 'a number from 0 to 1');
  }
  return Math.round((value as number) * 100) / 100;
}

/**
 * Items decoded one by one: each that breaks its rules is withheld by its
 * title while the rest survive. The list needs `minimum` entries; more than
 * the prompt asked for are all read.
 */
export function decodeItems<T>(
  value: unknown,
  path: string,
  noun: string,
  decode: (item: Record<string, unknown>, itemPath: string) => T,
  minimum = 0
): { items: T[]; malformed: LightboxMalformedItem[] } {
  listAt(value, path, minimum, `${noun}s`);
  const items: T[] = [];
  const malformed: LightboxMalformedItem[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    try {
      items.push(decode(objectAt(item, itemPath), itemPath));
    } catch (error) {
      malformed.push({
        title: itemTitle(item, `${capitalize(noun)} ${index + 1}`),
        reason: `It broke the format: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  return { items, malformed };
}

/** One value of a closed vocabulary. */
export function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[], expected: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    shapeError(path, expected);
  }
  return value as T;
}

function itemTitle(item: unknown, fallback: string): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    for (const key of ['title', 'name', 'genre', 'speaker']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return lightboxFieldAtCeiling(value.trim(), B.labelCharacters);
      }
    }
  }
  return fallback;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
