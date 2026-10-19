/**
 * The strict provider-response boundary for Lightbox readings (ADR 2026-10-19
 * D6, D7). Pure: no host, no I/O.
 *
 * A group's response is one sentinel-framed JSON object. The frame and the
 * root are all-or-nothing: a missing or repeated sentinel, invalid JSON, a
 * wrong version or an unknown key fails the whole group, which the runner
 * quarantines. Below the root, validation is per lens block: a block that
 * breaks its rules (a missing `friction` included) is withheld by lens while
 * its siblings survive, and an item that breaks its rules inside a valid
 * block (one motif, one character, one neighbor) is withheld by its title.
 *
 * The decoded result is still the model's word. Quotes are checked, terms are
 * counted and ids are minted afterwards (`LightboxReadingTiles`); nothing
 * here trusts a paragraph number beyond it being a positive whole number.
 * The vocabulary (sentinels, keys, shapes) is `LightboxReadingWire`.
 */

import type { LightboxLensId, LightboxReadingGroupId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  LIGHTBOX_LENS_KEYS,
  LIGHTBOX_MINIMUM_GENRE_NEIGHBORS,
  LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS,
  LIGHTBOX_NEAR_MISS_AFFINITY,
  LIGHTBOX_READING_PROTOCOL_VERSION,
  LIGHTBOX_TENSION_TOP_SCORE,
  LIGHTBOX_VOICE_TRAITS,
  LightboxGroupFrameError,
  lightboxGroupSentinels,
  type LightboxDecodedBlock,
  type LightboxDecodedCharacter,
  type LightboxDecodedGroup,
  type LightboxDecodedMotif,
  type LightboxDecodedNeighbor,
  type LightboxGroupDecodeContext,
  type LightboxMalformedItem,
  type LightboxWirePeak,
  type LightboxWireQuote
} from '@/infrastructure/lightbox/LightboxReadingWire';
import {
  boundedArrayAt,
  boundedStringAt,
  exactObject,
  numberAt,
  objectAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const B = PROMPT_BUDGETS.lightbox;

// ---------------------------------------------------------------------------
// The frame and the root
// ---------------------------------------------------------------------------

export function decodeLightboxGroup(content: string, context: LightboxGroupDecodeContext): LightboxDecodedGroup {
  const root = parseFrame(content, context.group);
  const lensKeys = Object.values(LIGHTBOX_LENS_KEYS);
  const unknown = Object.keys(root).filter((key) => key !== 'version' && !lensKeys.includes(key));
  if (unknown.length > 0) {
    throw new LightboxGroupFrameError(`The group ${context.group} response has unknown fields: ${unknown.join(', ')}`);
  }
  if (root.version !== LIGHTBOX_READING_PROTOCOL_VERSION) {
    throw new LightboxGroupFrameError(
      `The group ${context.group} response must carry "version": ${LIGHTBOX_READING_PROTOCOL_VERSION}`
    );
  }

  const blocks: LightboxDecodedBlock[] = [];
  const withheld: LightboxDecodedGroup['withheld'] = [];
  for (const lens of context.lenses) {
    const key = LIGHTBOX_LENS_KEYS[lens];
    if (!Object.prototype.hasOwnProperty.call(root, key)) {
      withheld.push({ lens, reason: `The reading returned no ${key} block.` });
      continue;
    }
    try {
      blocks.push(decodeBlock(lens, root[key], key, context));
    } catch (error) {
      withheld.push({ lens, reason: blockReason(key, error) });
    }
  }
  const ignored = (Object.keys(LIGHTBOX_LENS_KEYS) as LightboxLensId[]).filter(
    (lens) => !context.lenses.includes(lens) && Object.prototype.hasOwnProperty.call(root, LIGHTBOX_LENS_KEYS[lens])
  );
  return { blocks, withheld, ignored };
}

function parseFrame(content: string, group: LightboxReadingGroupId): Record<string, unknown> {
  if (content.length > B.groupResponseCharacters) {
    throw new LightboxGroupFrameError(
      `The group ${group} response exceeds ${B.groupResponseCharacters.toLocaleString('en-US')} characters`
    );
  }
  const { start, end } = lightboxGroupSentinels(group);
  const normalized = content.replace(/\r\n?/g, '\n').trim();
  for (const marker of [start, end]) {
    if (normalized.split(marker).length !== 2) {
      throw new LightboxGroupFrameError(`The group ${group} response must contain exactly one ${marker}`);
    }
  }
  const lines = normalized.split('\n');
  if (lines[0].trim() !== start) {
    throw new LightboxGroupFrameError(`The group ${group} opening sentinel must be the first line`);
  }
  if (lines[lines.length - 1].trim() !== end) {
    throw new LightboxGroupFrameError(`The group ${group} closing sentinel must be the final line`);
  }
  const jsonText = lines.slice(1, -1).join('\n').trim();
  if (jsonText.length === 0) {
    throw new LightboxGroupFrameError(`The group ${group} response JSON is empty`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    // The parser's message can echo a slice of the response, which may quote
    // the chapter; reasons are logged, so keep only the position.
    const position = /position (\d+)/.exec(error instanceof Error ? error.message : '')?.[1];
    throw new LightboxGroupFrameError(
      `The group ${group} response JSON is invalid${position ? ` (at character ${position})` : ''}`
    );
  }
  try {
    return objectAt(parsed, `group ${group}`);
  } catch (error) {
    throw new LightboxGroupFrameError(error instanceof Error ? error.message : String(error));
  }
}

function blockReason(key: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.startsWith('The ') ? detail : `The ${key} block broke the format: ${detail}`;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function decodeBlock(
  lens: LightboxLensId,
  value: unknown,
  path: string,
  context: LightboxGroupDecodeContext
): LightboxDecodedBlock {
  const friction = requireFriction(value, path);
  switch (lens) {
    case 'headline': {
      const block = exactObject(value, path, ['sentence', 'terms', 'evidence', 'friction']);
      return {
        lens,
        sentence: text(block.sentence, `${path}.sentence`, B.noteCharacters),
        terms: terms(block.terms, `${path}.terms`),
        evidence: evidence(block.evidence, `${path}.evidence`, 1),
        friction
      };
    }
    case 'motif': {
      const block = exactObject(value, path, ['items', 'friction']);
      const { items, malformed } = decodeItems(block.items, `${path}.items`, B.motifs, 'motif', decodeMotif);
      return { lens, items, malformed, friction };
    }
    case 'tension': {
      const block = exactObject(value, path, ['scores', 'claim', 'peaks', 'friction']);
      return {
        lens,
        scores: scores(block.scores, `${path}.scores`, context.columnCount),
        claim: text(block.claim, `${path}.claim`, B.claimCharacters),
        peaks: peaks(block.peaks, `${path}.peaks`),
        friction
      };
    }
    case 'characters': {
      const block = exactObject(value, path, ['items', 'friction']);
      const { items, malformed } = decodeItems(
        block.items, `${path}.items`, B.characters, 'character', decodeCharacter
      );
      return { lens, items, malformed, friction };
    }
    case 'voice': {
      const keys = LIGHTBOX_VOICE_TRAITS.map(([key]) => key);
      const block = exactObject(value, path, [...keys, 'claim', 'evidence', 'friction']);
      return {
        lens,
        traits: keys.map((key) => ({ key, value: text(block[key], `${path}.${key}`, B.noteCharacters) })),
        claim: text(block.claim, `${path}.claim`, B.claimCharacters),
        evidence: evidence(block.evidence, `${path}.evidence`, 1),
        friction
      };
    }
    case 'genre':
      return decodeGenre(value, path, friction);
  }
}

/** Friction first, so a block without one names that as its reason (D7). */
function requireFriction(value: unknown, path: string): string {
  const block = objectAt(value, path);
  const friction = block.friction;
  if (typeof friction !== 'string' || friction.trim().length === 0) {
    throw new Error(`The ${path} block names no friction; every lens must say where it strains.`);
  }
  return text(friction, `${path}.friction`, B.frictionCharacters);
}

function decodeGenre(value: unknown, path: string, friction: string): LightboxDecodedBlock {
  const block = exactObject(value, path, ['neighbors', 'promise', 'friction']);
  const { items, malformed } = decodeItems(
    block.neighbors, `${path}.neighbors`, B.genreNeighbors, 'neighbor', decodeNeighbor, LIGHTBOX_MINIMUM_GENRE_NEIGHBORS
  );
  if (items.length < LIGHTBOX_MINIMUM_GENRE_NEIGHBORS) {
    throw new Error(`The ${path} block kept fewer than ${LIGHTBOX_MINIMUM_GENRE_NEIGHBORS} well-formed neighbors.`);
  }
  if (!items.some((neighbor) => neighbor.affinity <= LIGHTBOX_NEAR_MISS_AFFINITY)) {
    throw new Error(
      `The ${path} block drew no near miss: a neighborhood needs a neighbor at ` +
        `${LIGHTBOX_NEAR_MISS_AFFINITY.toFixed(2)} or below.`
    );
  }
  const promise = exactObject(block.promise, `${path}.promise`, ['text', 'evidence']);
  return {
    lens: 'genre',
    neighbors: items,
    malformed,
    promise: {
      text: text(promise.text, `${path}.promise.text`, B.noteCharacters),
      evidence: evidence(promise.evidence, `${path}.promise.evidence`, 1)
    },
    friction
  };
}

// ---------------------------------------------------------------------------
// Items: each decoded on its own, withheld by title when it breaks its rules
// ---------------------------------------------------------------------------

function decodeItems<T>(
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

function decodeMotif(item: Record<string, unknown>, path: string): LightboxDecodedMotif {
  const motif = exactObject(item, path, ['title', 'gist', 'claim', 'terms', 'evidence']);
  return {
    title: text(motif.title, `${path}.title`, B.labelCharacters),
    gist: text(motif.gist, `${path}.gist`, B.noteCharacters),
    claim: text(motif.claim, `${path}.claim`, B.claimCharacters),
    terms: terms(motif.terms, `${path}.terms`),
    evidence: evidence(motif.evidence, `${path}.evidence`, LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS)
  };
}

function decodeCharacter(item: Record<string, unknown>, path: string): LightboxDecodedCharacter {
  const character = exactObject(item, path, [
    'name', 'aliases', 'archetype', 'energy', 'wants', 'hides', 'claim', 'evidence'
  ]);
  boundedArrayAt(character.aliases, `${path}.aliases`, 0, 3, 'aliases');
  return {
    name: text(character.name, `${path}.name`, B.labelCharacters),
    aliases: character.aliases.map((alias, index) => text(alias, `${path}.aliases[${index}]`, B.labelCharacters)),
    archetype: text(character.archetype, `${path}.archetype`, B.labelCharacters),
    energy: text(character.energy, `${path}.energy`, B.noteCharacters),
    wants: text(character.wants, `${path}.wants`, B.noteCharacters),
    hides: text(character.hides, `${path}.hides`, B.noteCharacters),
    claim: text(character.claim, `${path}.claim`, B.claimCharacters),
    evidence: evidence(character.evidence, `${path}.evidence`, 1)
  };
}

function decodeNeighbor(item: Record<string, unknown>, path: string): LightboxDecodedNeighbor {
  const neighbor = exactObject(item, path, ['genre', 'affinity', 'claim', 'nearMiss', 'evidence']);
  numberAt(neighbor.affinity, `${path}.affinity`);
  const affinity = neighbor.affinity as number;
  if (affinity < 0 || affinity > 1) {
    shapeError(`${path}.affinity`, 'a number from 0 to 1');
  }
  boundedStringAt(neighbor.nearMiss, `${path}.nearMiss`, B.noteCharacters);
  return {
    genre: text(neighbor.genre, `${path}.genre`, B.labelCharacters),
    affinity: Math.round(affinity * 100) / 100,
    claim: text(neighbor.claim, `${path}.claim`, B.claimCharacters),
    nearMiss: (neighbor.nearMiss as string).trim(),
    evidence: evidence(neighbor.evidence, `${path}.evidence`, 1)
  };
}

function itemTitle(item: unknown, fallback: string): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    for (const key of ['title', 'name', 'genre']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim().slice(0, B.labelCharacters);
      }
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** A nonblank string within its ceiling, trimmed. */
function text(value: unknown, path: string, maximum: number): string {
  boundedStringAt(value, path, maximum, false);
  return (value as string).trim();
}

function terms(value: unknown, path: string): string[] {
  boundedArrayAt(value, path, 1, B.termsPerClaim, 'terms');
  return value.map((term, index) => text(term, `${path}[${index}]`, B.labelCharacters));
}

function evidence(value: unknown, path: string, minimum: number): LightboxWireQuote[] {
  boundedArrayAt(value, path, minimum, B.quotesPerClaim, 'quotes');
  return value.map((item, index) => quote(item, `${path}[${index}]`));
}

function quote(value: unknown, path: string): LightboxWireQuote {
  const pair = exactObject(value, path, ['para', 'quote']);
  return { para: paragraphNumber(pair.para, `${path}.para`), quote: text(pair.quote, `${path}.quote`, B.quoteCharacters) };
}

function peaks(value: unknown, path: string): LightboxWirePeak[] {
  boundedArrayAt(value, path, 1, B.tensionPeaks, 'peaks');
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const peak = exactObject(item, itemPath, ['para', 'quote', 'note']);
    return {
      para: paragraphNumber(peak.para, `${itemPath}.para`),
      quote: text(peak.quote, `${itemPath}.quote`, B.quoteCharacters),
      note: text(peak.note, `${itemPath}.note`, B.noteCharacters)
    };
  });
}

/** Whether the paragraph was declared is the verifier's question, not the codec's. */
function paragraphNumber(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    shapeError(path, 'a paragraph number (a whole number from 1)');
  }
  return value as number;
}

function scores(value: unknown, path: string, columnCount: number): number[] {
  boundedArrayAt(value, path, columnCount, columnCount, 'scores, one per ribbon column');
  return value.map((score, index) => {
    if (!Number.isSafeInteger(score) || (score as number) < 0 || (score as number) > LIGHTBOX_TENSION_TOP_SCORE) {
      shapeError(`${path}[${index}]`, `a whole number from 0 to ${LIGHTBOX_TENSION_TOP_SCORE}`);
    }
    return score as number;
  });
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
