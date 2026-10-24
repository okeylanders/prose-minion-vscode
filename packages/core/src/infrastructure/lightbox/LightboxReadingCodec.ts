/**
 * The provider-response boundary for Lightbox readings (ADR 2026-10-19 D6,
 * D7). Pure: no host, no I/O.
 *
 * A group's response is one sentinel-framed JSON object. The frame and the
 * root are all-or-nothing: a frame that cannot be read even after its
 * structural repairs (`LightboxReadingFrame`, a member closed out of its
 * block moved back included) or a wrong version fails the whole group,
 * which the runner quarantines. Below the root,
 * validation is per lens block: a block that breaks its rules (a missing
 * `friction` included) is withheld by lens while its siblings survive, and
 * an item that breaks its rules inside a valid block (one motif, one
 * character, one neighbor) is withheld by its title.
 *
 * **Asks, not gates (Slice 4H, epic decision 37).** Lengths and counts a
 * prompt states are asks: a field or a list that runs past one is read and
 * shown (`LightboxReadingFields`). What withholds is a real fault: a missing
 * or mistyped field, a value outside its vocabulary, fewer items than a
 * stated minimum, or a structural rule (one tension score per ribbon
 * column).
 *
 * **Fields the format does not define are ignored (Slice 4K, epic decision
 * 50)**, at every level: the root, a block, an item, an object inside one.
 * Each is counted for the reply's log line (`LightboxDecodeReport.ignored`)
 * and never named, and none withholds anything. A required field that is
 * missing still withholds, so a misspelled one is withheld for the field it
 * stands in for.
 *
 * **A reply cut off at the output ceiling** (epic decision 40) is read for
 * the blocks it finished; the one it was cut inside is withheld with
 * `LIGHTBOX_CUT_OFF_REASON`, and lenses it never reached are reported as
 * any missing lens is.
 *
 * The decoded result is still the model's word. Quotes are checked, terms are
 * counted and ids are minted afterwards (`LightboxReadingTiles`); nothing
 * here trusts a paragraph number beyond it being a positive whole number.
 * The vocabulary (sentinels, keys, shapes) is `LightboxReadingWire`.
 *
 * Every reason is host-owned (PR #149 F-05): it names the protocol's paths,
 * counts and positions, never a field name or a value the model wrote,
 * because reasons are logged and shown on the board. A field the format does
 * not define is counted, never named, anywhere.
 */

import type { LightboxLensId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  LIGHTBOX_CUT_OFF_REASON,
  LIGHTBOX_LENS_KEYS,
  LIGHTBOX_MINIMUM_GENRE_NEIGHBORS,
  LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS,
  LIGHTBOX_NEAR_MISS_AFFINITY,
  LIGHTBOX_READING_PROTOCOL_VERSION,
  LIGHTBOX_TENSION_TOP_SCORE,
  LIGHTBOX_VOICE_TRAITS,
  LightboxGroupFrameError,
  type LightboxCutPlace,
  type LightboxDecodedBlock,
  type LightboxDecodedCharacter,
  type LightboxDecodedGroup,
  type LightboxDecodedMotif,
  type LightboxDecodedNeighbor,
  type LightboxGroupDecodeContext,
  type LightboxWirePeak
} from '@/infrastructure/lightbox/LightboxReadingWire';
import {
  boundedArrayAt,
  numberAt,
  objectAt,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import {
  decodeItems,
  evidence,
  listAt,
  paragraphNumber,
  replyObject,
  tallyLightboxDecode,
  terms,
  prose,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import { LIGHTBOX_BLOCK_FIELDS } from '@/infrastructure/lightbox/LightboxBlockFormat';
import { readLightboxFrame, type LightboxFrame } from '@/infrastructure/lightbox/LightboxReadingFrame';
import { decodeGravityBlock, decodePaletteBlock } from '@/infrastructure/lightbox/LightboxGravityCodec';
import { decodeLineageBlock, decodeSparkBlock, decodeSubtextBlock } from '@/infrastructure/lightbox/LightboxStoryCodec';
import { decodeNumbersBlock, decodeRhythmBlock, decodeStockBlock } from '@/infrastructure/lightbox/LightboxCraftCodec';
import {
  decodeArtifactsBlock,
  decodePressureBlock,
  decodeSummaryBlock,
  decodeTemplateBlock
} from '@/infrastructure/lightbox/LightboxPlotCodec';
import { decodeOpinionBlock } from '@/infrastructure/lightbox/LightboxOpinionCodec';
import { decodeSteeringBlock } from '@/infrastructure/lightbox/LightboxSteeringCodec';

const B = PROMPT_BUDGETS.lightbox;

// ---------------------------------------------------------------------------
// The root
// ---------------------------------------------------------------------------

export function decodeLightboxGroup(content: string, context: LightboxGroupDecodeContext): LightboxDecodedGroup {
  const frame = readLightboxFrame(content, context.group, context.end ?? 'stop');
  const root = frame.root;
  if (root.version !== LIGHTBOX_READING_PROTOCOL_VERSION) {
    throw new LightboxGroupFrameError(
      `The group ${context.group} response must carry "version": ${LIGHTBOX_READING_PROTOCOL_VERSION}`
    );
  }
  // A root field the format does not define is ignored and counted, never named: its name is the model's (decision 50).
  const lensKeys = Object.values(LIGHTBOX_LENS_KEYS);
  const rootIgnored = Object.keys(root).filter((key) => key !== 'version' && !lensKeys.includes(key)).length;

  const cut = frame.cutOff;
  const { value, clipped, ignored } = tallyLightboxDecode(() => decodeBlocks(root, context, cut));
  return {
    ...value,
    report: { repairs: frame.repairs, clipped, ignored: rootIgnored + ignored, cutOff: cut !== undefined, ...cutWithin(cut, context) }
  };
}

function decodeBlocks(
  root: Record<string, unknown>,
  context: LightboxGroupDecodeContext,
  cut: LightboxFrame['cutOff']
): Omit<LightboxDecodedGroup, 'report'> {
  const blocks: LightboxDecodedBlock[] = [];
  const withheld: LightboxDecodedGroup['withheld'] = [];
  // The block the reply was cut inside is never trusted (decision 40): not beside an earlier copy of it, and not when
  // the member it was cut inside had been closed out of it (PR #168 F-01).
  const cutKeys = new Set([cut?.cutKey, cut?.cutBlock].filter((key): key is string => key !== undefined));
  for (const lens of context.lenses) {
    const key = LIGHTBOX_LENS_KEYS[lens];
    if (cutKeys.has(key)) {
      withheld.push({ lens, reason: LIGHTBOX_CUT_OFF_REASON });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(root, key)) {
      // A lens the reply never reached is missing.
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

/**
 * Where a reply cut off at the output ceiling stopped, when that was inside
 * a root member but not a block the call asked for: for its log line, in
 * host words, never the member's key, which may be the model's text.
 */
function cutWithin(cut: LightboxFrame['cutOff'], context: LightboxGroupDecodeContext): { cutWithin?: LightboxCutPlace } {
  const key = cut?.cutBlock ?? cut?.cutKey;
  if (key === undefined) {
    return {};
  }
  const lens = (Object.keys(LIGHTBOX_LENS_KEYS) as LightboxLensId[]).find((candidate) => LIGHTBOX_LENS_KEYS[candidate] === key);
  if (lens === undefined) {
    return { cutWithin: 'root-member' };
  }
  return context.lenses.includes(lens) ? {} : { cutWithin: 'unrequested-block' };
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
      const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.headline);
      return {
        lens,
        sentence: prose(block.sentence, `${path}.sentence`, B.noteCharacters),
        terms: terms(block.terms, `${path}.terms`),
        evidence: evidence(block.evidence, `${path}.evidence`, 1),
        friction
      };
    }
    case 'motif': {
      const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.motif);
      const { items, malformed } = decodeItems(block.items, `${path}.items`, 'motif', decodeMotif);
      return { lens, items, malformed, friction };
    }
    case 'tension': {
      const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.tension);
      return {
        lens,
        scores: scores(block.scores, `${path}.scores`, context.columnCount),
        claim: prose(block.claim, `${path}.claim`, B.claimCharacters),
        peaks: peaks(block.peaks, `${path}.peaks`),
        friction
      };
    }
    case 'characters': {
      const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.characters);
      const { items, malformed } = decodeItems(block.items, `${path}.items`, 'character', decodeCharacter);
      return { lens, items, malformed, friction };
    }
    case 'voice': {
      const keys = LIGHTBOX_VOICE_TRAITS.map(([key]) => key);
      const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.voice);
      return {
        lens,
        traits: keys.map((key) => ({ key, value: prose(block[key], `${path}.${key}`, B.noteCharacters) })),
        claim: prose(block.claim, `${path}.claim`, B.claimCharacters),
        evidence: evidence(block.evidence, `${path}.evidence`, 1),
        friction
      };
    }
    case 'genre':
      return decodeGenre(value, path, friction);
    case 'gravity':
      return decodeGravityBlock(value, path, friction);
    case 'palette':
      return decodePaletteBlock(value, path, friction);
    case 'subtext':
      return decodeSubtextBlock(value, path, friction);
    case 'lineage':
      return decodeLineageBlock(value, path, friction);
    case 'spark':
      return decodeSparkBlock(value, path, friction);
    case 'stock':
      return decodeStockBlock(value, path, friction);
    case 'rhythm':
      return decodeRhythmBlock(value, path, friction, context.columnCount);
    case 'numbers':
      return decodeNumbersBlock(value, path, friction);
    case 'template':
      return decodeTemplateBlock(value, path, friction);
    case 'pressure':
      return decodePressureBlock(value, path, friction);
    case 'artifacts':
      return decodeArtifactsBlock(value, path, friction);
    case 'summary':
      return decodeSummaryBlock(value, path, friction);
    case 'opinion':
      return decodeOpinionBlock(value, path, friction);
    case 'steering':
      return decodeSteeringBlock(value, path, friction);
  }
}

/** Friction first, so a block without one names that as its reason (D7). */
function requireFriction(value: unknown, path: string): string {
  const block = objectAt(value, path);
  const friction = block.friction;
  if (typeof friction !== 'string' || friction.trim().length === 0) {
    throw new Error(`The ${path} block names no friction; every lens must say where it strains.`);
  }
  return prose(friction, `${path}.friction`, B.frictionCharacters);
}

function decodeGenre(value: unknown, path: string, friction: string): LightboxDecodedBlock {
  const block = replyObject(value, path, LIGHTBOX_BLOCK_FIELDS.genre);
  const { items, malformed } = decodeItems(
    block.neighbors, `${path}.neighbors`, 'neighbor', decodeNeighbor, LIGHTBOX_MINIMUM_GENRE_NEIGHBORS
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
  const promise = replyObject(block.promise, `${path}.promise`, ['text', 'evidence']);
  return {
    lens: 'genre',
    neighbors: items,
    malformed,
    promise: {
      text: prose(promise.text, `${path}.promise.text`, B.noteCharacters),
      evidence: evidence(promise.evidence, `${path}.promise.evidence`, 1)
    },
    friction
  };
}

// ---------------------------------------------------------------------------
// Items: each decoded on its own, withheld by title when it breaks its rules
// ---------------------------------------------------------------------------

function decodeMotif(item: Record<string, unknown>, path: string): LightboxDecodedMotif {
  const motif = replyObject(item, path, ['title', 'gist', 'claim', 'terms', 'evidence']);
  return {
    title: text(motif.title, `${path}.title`),
    gist: prose(motif.gist, `${path}.gist`, B.noteCharacters),
    claim: prose(motif.claim, `${path}.claim`, B.claimCharacters),
    terms: terms(motif.terms, `${path}.terms`),
    evidence: evidence(motif.evidence, `${path}.evidence`, LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS)
  };
}

function decodeCharacter(item: Record<string, unknown>, path: string): LightboxDecodedCharacter {
  const character = replyObject(item, path, [
    'name', 'aliases', 'archetype', 'energy', 'wants', 'hides', 'claim', 'evidence'
  ]);
  listAt(character.aliases, `${path}.aliases`, 0, 'aliases');
  return {
    name: text(character.name, `${path}.name`),
    aliases: character.aliases.map((alias, index) => text(alias, `${path}.aliases[${index}]`)),
    archetype: text(character.archetype, `${path}.archetype`),
    energy: prose(character.energy, `${path}.energy`, B.noteCharacters),
    wants: prose(character.wants, `${path}.wants`, B.noteCharacters),
    hides: prose(character.hides, `${path}.hides`, B.noteCharacters),
    claim: prose(character.claim, `${path}.claim`, B.claimCharacters),
    evidence: evidence(character.evidence, `${path}.evidence`, 1)
  };
}

/**
 * A near miss (affinity at or below `LIGHTBOX_NEAR_MISS_AFFINITY`, as drawn:
 * rounded to two decimals) must say what matches and what does not, so a
 * blank `nearMiss` withholds it (PR #149 F-06). A closer neighbor has no near
 * miss to explain: its `nearMiss` must still be a string, but is not a
 * withholding rule; whatever it holds is not kept, since the tile draws a
 * near miss only for a low-affinity neighbor.
 */
function decodeNeighbor(item: Record<string, unknown>, path: string): LightboxDecodedNeighbor {
  const neighbor = replyObject(item, path, ['genre', 'affinity', 'claim', 'nearMiss', 'evidence']);
  numberAt(neighbor.affinity, `${path}.affinity`);
  const claimed = neighbor.affinity as number;
  if (claimed < 0 || claimed > 1) {
    shapeError(`${path}.affinity`, 'a number from 0 to 1');
  }
  const affinity = Math.round(claimed * 100) / 100;
  stringAt(neighbor.nearMiss, `${path}.nearMiss`);
  const nearMiss = affinity <= LIGHTBOX_NEAR_MISS_AFFINITY
    ? prose(neighbor.nearMiss, `${path}.nearMiss`, B.noteCharacters)
    : '';
  return {
    genre: text(neighbor.genre, `${path}.genre`),
    affinity,
    claim: prose(neighbor.claim, `${path}.claim`, B.claimCharacters),
    nearMiss,
    evidence: evidence(neighbor.evidence, `${path}.evidence`, 1)
  };
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

function peaks(value: unknown, path: string): LightboxWirePeak[] {
  listAt(value, path, 1, 'peaks');
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const peak = replyObject(item, itemPath, ['para', 'quote', 'note']);
    return {
      para: paragraphNumber(peak.para, `${itemPath}.para`),
      quote: text(peak.quote, `${itemPath}.quote`),
      note: prose(peak.note, `${itemPath}.note`, B.noteCharacters)
    };
  });
}

/** One score per ribbon column: a structural rule, so its count is checked exactly. */
function scores(value: unknown, path: string, columnCount: number): number[] {
  boundedArrayAt(value, path, columnCount, columnCount, 'scores, one per ribbon column');
  return value.map((score, index) => {
    if (!Number.isSafeInteger(score) || (score as number) < 0 || (score as number) > LIGHTBOX_TENSION_TOP_SCORE) {
      shapeError(`${path}[${index}]`, `a whole number from 0 to ${LIGHTBOX_TENSION_TOP_SCORE}`);
    }
    return score as number;
  });
}
