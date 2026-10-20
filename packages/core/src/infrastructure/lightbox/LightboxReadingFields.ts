/**
 * Field decoders for Lightbox reading blocks (ADR 2026-10-19 D7). Pure: no
 * host, no I/O. The gravity and palette decoders (`LightboxGravityCodec`)
 * use these; they read a quote, a term or a bounded string exactly as
 * `LightboxReadingCodec`'s own private helpers do, so the rules are the same
 * in every lens. Each throws a shape error naming the field's path (a host
 * path, never a model's field name); the caller decides whether that
 * withholds an item or a block.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { LightboxMalformedItem, LightboxWireQuote } from '@/infrastructure/lightbox/LightboxReadingWire';
import {
  boundedArrayAt,
  boundedStringAt,
  exactObject,
  objectAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const B = PROMPT_BUDGETS.lightbox;

/**
 * A digit outside a ¶ address: a reading that states a number where the
 * board's counts belong (a spark, Slice 4; a numbers reading, Slice 4B).
 */
export const LIGHTBOX_BARE_DIGIT = /(?<!¶\s?\d*)\d/u;

/** A nonblank string within its ceiling, trimmed. */
export function text(value: unknown, path: string, maximum: number): string {
  boundedStringAt(value, path, maximum, false);
  return (value as string).trim();
}

/** Words or short phrases as they stand in the chapter; the host counts them. */
export function terms(value: unknown, path: string, minimum = 1, maximum: number = B.termsPerClaim): string[] {
  boundedArrayAt(value, path, minimum, maximum, 'terms');
  return value.map((term, index) => text(term, `${path}[${index}]`, B.labelCharacters));
}

export function evidence(value: unknown, path: string, minimum: number): LightboxWireQuote[] {
  boundedArrayAt(value, path, minimum, B.quotesPerClaim, 'quotes');
  return value.map((item, index) => quote(item, `${path}[${index}]`));
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
    throw new Error(`${path} has ${undefinedFields} field${undefinedFields === 1 ? '' : 's'} the format does not define.`);
  }
  return exactObject(object, path, keys);
}

function quote(value: unknown, path: string): LightboxWireQuote {
  const pair = strictObject(value, path, ['para', 'quote']);
  return { para: paragraphNumber(pair.para, `${path}.para`), quote: text(pair.quote, `${path}.quote`, B.quoteCharacters) };
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
 * title while the rest survive. The array's own bounds are the block's.
 */
export function decodeItems<T>(
  value: unknown,
  path: string,
  maximum: number,
  noun: string,
  decode: (item: Record<string, unknown>, itemPath: string) => T,
  minimum = 0
): { items: T[]; malformed: LightboxMalformedItem[] } {
  boundedArrayAt(value, path, minimum, maximum, `${noun}s`);
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

function itemTitle(item: unknown, fallback: string): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    for (const key of ['title', 'name', 'genre', 'speaker']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim().slice(0, B.labelCharacters);
      }
    }
  }
  return fallback;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
