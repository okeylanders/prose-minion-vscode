/**
 * The lineage, subtext and Spark blocks of a group's response (ADR
 * 2026-10-19 D7; Slice 4). Pure: no host, no I/O. Called by
 * `LightboxReadingCodec` once the block's friction is known; a throw here
 * withholds the whole block, and an item that breaks its own rules is
 * withheld by its title.
 *
 * Rules enforced here, not only asked for in the prompt:
 * - **Lineage.** A block carries its `setAside` list (possibly empty): the
 *   stories it checked and set aside, each with a reason. A story carries one
 *   to three stances, each `matches`, `departs` or `subverts` and each at
 *   most once; any other stance withholds the story. A story set aside is
 *   never also drawn. An empty `items` list is valid, and the block's
 *   required friction says why.
 * - **Subtext.** A pair names its speaker, its `said` line as one quote, and
 *   what the line is read as meaning (`meant`). Whether the said line stands
 *   inside dialogue is the chapter's question, checked afterwards against
 *   the paragraph (`LightboxTileGates`).
 * - **Spark.** A spark names at least one term the host will count, quotes
 *   the chapter, and is phrased as a question that instructs nothing and
 *   states no number (`LightboxSparkPhrasing`).
 * Every block decodes with `strictObject`: a field the format does not
 * define is counted, never named, and every reason here is host-owned.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { LightboxLineageSetAside, LightboxLineageStance, LightboxLineageStanceNote } from '@messages';
import { boundedArrayAt, shapeError } from '@/application/services/workshop/persistedValidation';
import {
  decodeItems,
  evidence,
  paragraphNumber,
  strictObject,
  terms,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import { lightboxSparkPhrasingFault } from '@/infrastructure/lightbox/LightboxSparkPhrasing';
import type {
  LightboxDecodedLineageBlock,
  LightboxDecodedLineageStory,
  LightboxDecodedSpark,
  LightboxDecodedSparkBlock,
  LightboxDecodedSubtextBlock,
  LightboxDecodedSubtextPair,
  LightboxWireQuote
} from '@/infrastructure/lightbox/LightboxReadingWire';

const B = PROMPT_BUDGETS.lightbox;
const STANCES: readonly LightboxLineageStance[] = ['matches', 'departs', 'subverts'];
const nameKey = (name: string): string => name.toLocaleLowerCase('en-US');

export function decodeLineageBlock(value: unknown, path: string, friction: string): LightboxDecodedLineageBlock {
  const block = strictObject(value, path, ['items', 'setAside', 'friction']);
  const setAside = decodeSetAside(block.setAside, `${path}.setAside`);
  const set = new Set(setAside.map((entry) => nameKey(entry.title)));
  const decoded = decodeItems(block.items, `${path}.items`, B.lineageStories, 'story', (item, itemPath) => {
    const story = decodeStory(item, itemPath);
    if (set.has(nameKey(story.title))) {
      throw new Error('It is also listed as checked and set aside, so it cannot be drawn.');
    }
    return story;
  });
  const seen = new Set<string>();
  const items = decoded.items.filter((story) => {
    const key = nameKey(story.title);
    if (seen.has(key)) {
      decoded.malformed.push({ title: story.title, reason: 'Another story in this reading already has that title.' });
      return false;
    }
    seen.add(key);
    return true;
  });
  return { lens: 'lineage', items, setAside, malformed: decoded.malformed, friction };
}

export function decodeSubtextBlock(value: unknown, path: string, friction: string): LightboxDecodedSubtextBlock {
  const block = strictObject(value, path, ['items', 'friction']);
  const { items, malformed } = decodeItems(block.items, `${path}.items`, B.subtextPairs, 'pair', decodePair);
  return { lens: 'subtext', items, malformed, friction };
}

export function decodeSparkBlock(value: unknown, path: string, friction: string): LightboxDecodedSparkBlock {
  const block = strictObject(value, path, ['items', 'friction']);
  const { items, malformed } = decodeItems(block.items, `${path}.items`, B.sparks, 'spark', decodeSpark);
  return { lens: 'spark', items, malformed, friction };
}

function decodeStory(item: Record<string, unknown>, path: string): LightboxDecodedLineageStory {
  const story = strictObject(item, path, ['title', 'source', 'stances', 'claim', 'evidence']);
  return {
    title: text(story.title, `${path}.title`, B.labelCharacters),
    source: text(story.source, `${path}.source`, B.labelCharacters),
    stances: decodeStances(story.stances, `${path}.stances`),
    claim: text(story.claim, `${path}.claim`, B.claimCharacters),
    evidence: evidence(story.evidence, `${path}.evidence`, 1)
  };
}

function decodeStances(value: unknown, path: string): LightboxLineageStanceNote[] {
  boundedArrayAt(value, path, 1, B.lineageStances, 'stances');
  const seen = new Set<LightboxLineageStance>();
  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const row = strictObject(entry, itemPath, ['stance', 'note']);
    const stance = row.stance;
    if (typeof stance !== 'string' || !STANCES.includes(stance as LightboxLineageStance)) {
      shapeError(`${itemPath}.stance`, 'matches, departs or subverts');
    }
    if (seen.has(stance as LightboxLineageStance)) {
      shapeError(`${itemPath}.stance`, 'a stance not already given for this story');
    }
    seen.add(stance as LightboxLineageStance);
    return { stance: stance as LightboxLineageStance, note: text(row.note, `${itemPath}.note`, B.noteCharacters) };
  });
}

/** Required as a key (`strictObject` withholds a block without it), possibly empty. */
function decodeSetAside(value: unknown, path: string): LightboxLineageSetAside[] {
  boundedArrayAt(value, path, 0, B.lineageSetAsides, 'stories set aside');
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const row = strictObject(entry, itemPath, ['title', 'reason']);
    const title = text(row.title, `${itemPath}.title`, B.labelCharacters);
    if (seen.has(nameKey(title))) {
      shapeError(`${itemPath}.title`, 'a story not already set aside');
    }
    seen.add(nameKey(title));
    return { title, reason: text(row.reason, `${itemPath}.reason`, B.noteCharacters) };
  });
}

function decodePair(item: Record<string, unknown>, path: string): LightboxDecodedSubtextPair {
  const pair = strictObject(item, path, ['speaker', 'said', 'meant', 'evidence']);
  return {
    speaker: text(pair.speaker, `${path}.speaker`, B.labelCharacters),
    said: saidQuote(pair.said, `${path}.said`),
    meant: text(pair.meant, `${path}.meant`, B.noteCharacters),
    evidence: contextQuotes(pair.evidence, `${path}.evidence`)
  };
}

function saidQuote(value: unknown, path: string): LightboxWireQuote {
  const said = strictObject(value, path, ['para', 'quote']);
  return { para: paragraphNumber(said.para, `${path}.para`), quote: text(said.quote, `${path}.quote`, B.quoteCharacters) };
}

function contextQuotes(value: unknown, path: string): LightboxWireQuote[] {
  boundedArrayAt(value, path, 0, B.subtextContextQuotes, 'quotes');
  return evidence(value, path, 0);
}

function decodeSpark(item: Record<string, unknown>, path: string): LightboxDecodedSpark {
  const spark = strictObject(item, path, ['title', 'question', 'terms', 'evidence']);
  const question = text(spark.question, `${path}.question`, B.sparkCharacters);
  const fault = lightboxSparkPhrasingFault(question);
  if (fault) {
    throw new Error(fault);
  }
  return {
    title: text(spark.title, `${path}.title`, B.labelCharacters),
    question,
    terms: terms(spark.terms, `${path}.terms`),
    evidence: evidence(spark.evidence, `${path}.evidence`, 1)
  };
}
