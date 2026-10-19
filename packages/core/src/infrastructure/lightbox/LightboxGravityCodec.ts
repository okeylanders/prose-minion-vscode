/**
 * The gravity and palette blocks of a group A response (ADR 2026-10-19 D7;
 * Slice 3). Pure: no host, no I/O. Called by `LightboxReadingCodec` once the
 * block's friction is known; a throw here withholds the whole block, and an
 * item that breaks its own rules is withheld by its title.
 *
 * Rules enforced here, not only asked for in the prompt:
 * - a gravity block must carry its `literal` set-aside list, with at least
 *   one entry: the board always shows what it decided is literal, not
 *   borrowed;
 * - a term's degree is 1, 2 or 3; any other value withholds its field;
 * - field names are unique, a literal set-aside never shares a field's name,
 *   and a collision names two distinct fields the block draws (a reading may
 *   refer only to what it declared: the widgets' referential-integrity rule);
 * - a swatch's color is `#RRGGBB`.
 * What the host counts (hits, degrees, drift, words) and what it verifies
 * (quotes, a collision's two fields in its quote) happens afterwards, in
 * `LightboxGravityTiles`.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { LightboxGravityDegree } from '@messages';
import {
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import {
  claimedFraction,
  decodeItems,
  evidence,
  terms,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import type {
  LightboxDecodedCluster,
  LightboxDecodedCollision,
  LightboxDecodedGravityBlock,
  LightboxDecodedGravityField,
  LightboxDecodedGravityTerm,
  LightboxDecodedLiteral,
  LightboxDecodedPaletteBlock,
  LightboxDecodedSwatch,
  LightboxMalformedItem
} from '@/infrastructure/lightbox/LightboxReadingWire';

const B = PROMPT_BUDGETS.lightbox;
const HEX = /^#[0-9a-f]{6}$/i;
const nameKey = (name: string): string => name.toLocaleLowerCase('en-US');

export function decodeGravityBlock(value: unknown, path: string, friction: string): LightboxDecodedGravityBlock {
  const block = exactObject(value, path, ['fields', 'collisions', 'literal', 'friction']);
  const decodedFields = decodeItems(block.fields, `${path}.fields`, B.gravityFields, 'field', decodeField);
  const fields = unique(decodedFields.items, decodedFields.malformed, (field) => field.name, 'field');

  const drawn = new Set(fields.map((field) => nameKey(field.name)));
  const collisions = decodeItems(block.collisions, `${path}.collisions`, B.gravityCollisions, 'collision',
    (item, itemPath) => decodeCollision(item, itemPath, drawn));
  const decodedLiterals = decodeItems(block.literal, `${path}.literal`, B.gravityLiterals, 'set-aside', (item, itemPath) => {
    const literal = decodeLiteral(item, itemPath);
    if (drawn.has(nameKey(literal.name))) {
      throw new Error(`"${literal.name}" is drawn as a borrowed field, so it cannot also be set aside as literal.`);
    }
    return literal;
  }, 1);
  const literal = unique(decodedLiterals.items, decodedLiterals.malformed, (item) => item.name, 'set-aside');
  return {
    lens: 'gravity',
    fields,
    collisions: collisions.items,
    literal,
    malformed: { fields: decodedFields.malformed, collisions: collisions.malformed, literal: decodedLiterals.malformed },
    friction
  };
}

export function decodePaletteBlock(value: unknown, path: string, friction: string): LightboxDecodedPaletteBlock {
  const block = exactObject(value, path, ['clusters', 'swatches', 'friction']);
  const clusters = decodeItems(block.clusters, `${path}.clusters`, B.paletteClusters, 'cluster', decodeCluster);
  const swatches = decodeItems(block.swatches, `${path}.swatches`, B.swatches, 'swatch', decodeSwatch);
  return {
    lens: 'palette',
    clusters: clusters.items,
    swatches: swatches.items,
    malformed: { clusters: clusters.malformed, swatches: swatches.malformed },
    friction
  };
}

function decodeField(item: Record<string, unknown>, path: string): LightboxDecodedGravityField {
  const field = exactObject(item, path, ['name', 'metaphor', 'pull', 'claim', 'terms', 'evidence']);
  const termList = decodeTermList(field.terms, `${path}.terms`);
  return {
    name: text(field.name, `${path}.name`, B.labelCharacters),
    metaphor: text(field.metaphor, `${path}.metaphor`, B.noteCharacters),
    pull: claimedFraction(field.pull, `${path}.pull`),
    claim: text(field.claim, `${path}.claim`, B.claimCharacters),
    terms: termList,
    evidence: evidence(field.evidence, `${path}.evidence`, 1)
  };
}

function decodeTermList(value: unknown, path: string): LightboxDecodedGravityTerm[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > B.gravityTerms) {
    shapeError(path, `an array of 1–${B.gravityTerms} terms`);
  }
  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const term = exactObject(entry, itemPath, ['term', 'degree']);
    return { term: text(term.term, `${itemPath}.term`, B.labelCharacters), degree: degreeAt(term.degree, `${itemPath}.degree`) };
  });
}

function degreeAt(value: unknown, path: string): LightboxGravityDegree {
  if (value !== 1 && value !== 2 && value !== 3) {
    shapeError(path, 'a degree: 1 (latent), 2 (felt) or 3 (overt)');
  }
  return value as LightboxGravityDegree;
}

function decodeCollision(item: Record<string, unknown>, path: string, drawn: ReadonlySet<string>): LightboxDecodedCollision {
  const collision = exactObject(item, path, ['fields', 'claim', 'evidence']);
  const names = terms(collision.fields, `${path}.fields`, 2, 2);
  if (nameKey(names[0]) === nameKey(names[1])) {
    shapeError(`${path}.fields`, 'two different fields');
  }
  const missing = names.find((name) => !drawn.has(nameKey(name)));
  if (missing !== undefined) {
    throw new Error(`It names "${missing.slice(0, B.labelCharacters)}", which is not one of the block's borrowed fields.`);
  }
  return {
    fields: [names[0], names[1]],
    claim: text(collision.claim, `${path}.claim`, B.claimCharacters),
    evidence: evidence(collision.evidence, `${path}.evidence`, 1)
  };
}

function decodeLiteral(item: Record<string, unknown>, path: string): LightboxDecodedLiteral {
  const literal = exactObject(item, path, ['name', 'reason', 'terms', 'evidence']);
  return {
    name: text(literal.name, `${path}.name`, B.labelCharacters),
    reason: text(literal.reason, `${path}.reason`, B.noteCharacters),
    terms: terms(literal.terms, `${path}.terms`),
    evidence: evidence(literal.evidence, `${path}.evidence`, 1)
  };
}

function decodeCluster(item: Record<string, unknown>, path: string): LightboxDecodedCluster {
  const cluster = exactObject(item, path, ['name', 'claim', 'words', 'evidence']);
  return {
    name: text(cluster.name, `${path}.name`, B.labelCharacters),
    claim: text(cluster.claim, `${path}.claim`, B.claimCharacters),
    words: terms(cluster.words, `${path}.words`, 2, B.clusterWords),
    evidence: evidence(cluster.evidence, `${path}.evidence`, 1)
  };
}

function decodeSwatch(item: Record<string, unknown>, path: string): LightboxDecodedSwatch {
  const swatch = exactObject(item, path, ['name', 'words', 'hex', 'note', 'evidence']);
  const hex = typeof swatch.hex === 'string' ? swatch.hex.trim() : swatch.hex;
  if (typeof hex !== 'string' || !HEX.test(hex)) {
    shapeError(`${path}.hex`, 'a color as #RRGGBB');
  }
  return {
    name: text(swatch.name, `${path}.name`, B.labelCharacters),
    words: terms(swatch.words, `${path}.words`, 1, B.swatchWords),
    hex: (hex as string).toUpperCase(),
    note: text(swatch.note, `${path}.note`, B.noteCharacters),
    evidence: evidence(swatch.evidence, `${path}.evidence`, 1)
  };
}

/** Keep the first item of each name; a repeat is withheld by its title. */
function unique<T>(items: T[], malformed: LightboxMalformedItem[], nameOf: (item: T) => string, noun: string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = nameKey(nameOf(item));
    if (seen.has(key)) {
      malformed.push({ title: nameOf(item), reason: `Another ${noun} in this reading already has that name.` });
      return false;
    }
    seen.add(key);
    return true;
  });
}
