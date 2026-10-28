/**
 * Lexical Gravity's Build lens seed (ADR 2026-10-19 D11). Pure.
 *
 * Another tab may hand the Workshop a subject for Build lens: today, a
 * borrowed field the Lightbox found in a chapter, with its governing metaphor
 * and the terms it counted. The Workshop owns what happens with it: the seed
 * is checked here on arrival (exact keys, bounds), and its subject is
 * composed here, within Build lens's own query bound.
 *
 * Build lens takes one subject string and nothing else, so the counted terms
 * cannot be offered as separate seed vocabulary without changing the build
 * contract. They ride in the subject instead, after the field's name, as
 * many whole terms as fit; the sheet shows the full seed beside it, and the
 * writer can edit the subject before pressing Build.
 */

import {
  LEXICAL_GRAVITY_BUILD_SEED_LIMITS,
  WorkshopLexicalGravityBuildSeed,
  WorkshopLexicalGravityBuildSeedTerm
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  boundedArrayAt,
  boundedStringAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const LIMITS = LEXICAL_GRAVITY_BUILD_SEED_LIMITS;

/** A seed exactly as the contract allows it, trimmed; throws naming the field that is wrong. */
export function validateLexicalGravityBuildSeed(value: unknown): WorkshopLexicalGravityBuildSeed {
  const seed = exactObject(value, 'seed', ['origin', 'field', 'metaphor', 'terms', 'sourceLabel']);
  if (seed.origin !== 'lightbox') {
    shapeError('seed.origin', '"lightbox"');
  }
  const text = (field: string, maximum: number, allowBlank = false): string => {
    boundedStringAt(seed[field], `seed.${field}`, maximum, allowBlank);
    return (seed[field] as string).trim();
  };
  boundedArrayAt(seed.terms, 'seed.terms', 0, LIMITS.terms, 'terms');
  const terms = seed.terms.map((entry, index): WorkshopLexicalGravityBuildSeedTerm => {
    const path = `seed.terms[${index}]`;
    const term = exactObject(entry, path, ['term', 'count']);
    boundedStringAt(term.term, `${path}.term`, LIMITS.termCharacters, false);
    if (!Number.isSafeInteger(term.count) || (term.count as number) < 1) {
      shapeError(`${path}.count`, 'a whole number from 1');
    }
    return { term: (term.term as string).trim(), count: term.count as number };
  });
  return {
    origin: 'lightbox',
    field: text('field', LIMITS.fieldCharacters),
    metaphor: text('metaphor', LIMITS.metaphorCharacters, true),
    terms,
    sourceLabel: text('sourceLabel', LIMITS.sourceLabelCharacters, true)
  };
}

/**
 * The Build lens subject: the field's name, then as many of its counted terms
 * as fit whole within the build query's bound ("Liturgy: presence, vigil").
 */
export function composeLexicalGravityBuildSubject(
  seed: Pick<WorkshopLexicalGravityBuildSeed, 'field' | 'terms'>,
  maximumCharacters = PROMPT_BUDGETS.workshopWidgets.lexicalBuildQueryCharacters
): string {
  let subject = seed.field.slice(0, maximumCharacters).trim();
  const named = new Set([subject.toLocaleLowerCase('en-US')]);
  const kept: string[] = [];
  for (const { term } of seed.terms) {
    const key = term.toLocaleLowerCase('en-US');
    if (named.has(key)) {
      continue;
    }
    const next = `${seed.field}: ${[...kept, term].join(', ')}`;
    if (next.length > maximumCharacters) {
      break;
    }
    kept.push(term);
    named.add(key);
  }
  if (kept.length > 0) {
    subject = `${seed.field}: ${kept.join(', ')}`;
  }
  return subject;
}
