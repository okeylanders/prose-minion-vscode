/**
 * Group D's blocks: stock and signature, rhythm and handoffs, the numbers
 * (ADR 2026-10-19 D7 and its 2026-10-20 addendum; Slice 4B). Pure: no host,
 * no I/O. Called by `LightboxReadingCodec` once the block's friction is
 * known; a throw here withholds the whole block, and an item that breaks its
 * own rules is withheld by its title (a host title where the item has none).
 *
 * Rules enforced here, not only asked for in the prompt:
 * - **Stock.** The `economy` object is required (its beats may be empty);
 *   each beat's tier and each familiar phrase's kind is in its vocabulary.
 *   An echo carries no likelihood: a `%` or "percent" in its title, in what
 *   it sounds reminiscent of, or in its note, withholds it. A digit alone
 *   does not: a source's name can hold one ("Nineteen Eighty-Four, chapter
 *   1"). Familiar phrasing names
 *   its phrase as it stands, for the host to count.
 * - **Rhythm.** Exactly one ending per ribbon column, each in its
 *   vocabulary, or the block is withheld (the tension arc's rule). A
 *   handoff names two quotes and an effect in its vocabulary; whether its
 *   sentences are adjacent is the chapter's question, checked afterwards.
 * - **Numbers.** A reading names one of the host's figures the numbers
 *   lens reads by id (`LIGHTBOX_NUMBERS_READ_STATS`: being verbs, adverbs
 *   and intensifiers are craft steering's since Slice 4F), at most
 *   once, with a usage in its vocabulary, and its claim never directs: a
 *   claim holding a word of `LIGHTBOX_NUMBERS_DIRECTIVE_WORDS` is withheld.
 *   Nor does it state a figure: a claim with a digit outside a ¶ address, a
 *   `%` or "percent" is withheld, as a spark's is, since the board shows
 *   the measured one beside it.
 *   **The limit, stated:** word lists, not a parse. A directive without a
 *   listed word passes ("It would read better shorter."), as does a figure
 *   in words ("twice as often"); a listed word used to describe ("the cut
 *   of her coat") is withheld, the safe failure. Tests pin each.
 * Every object decodes with `strictObject`: a field the format does not
 * define is counted, never named, and every reason is host-owned.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { boundedArrayAt, shapeError } from '@/application/services/workshop/persistedValidation';
import {
  decodeItems,
  evidence,
  LIGHTBOX_BARE_DIGIT,
  paragraphNumber,
  strictObject,
  text
} from '@/infrastructure/lightbox/LightboxReadingFields';
import {
  LIGHTBOX_FAMILIAR_KINDS,
  LIGHTBOX_HANDOFF_EFFECTS,
  LIGHTBOX_NUMBER_USAGES,
  LIGHTBOX_PARAGRAPH_ENDINGS,
  LIGHTBOX_STOCK_TIERS,
  type LightboxDecodedEcho,
  type LightboxDecodedFamiliar,
  type LightboxDecodedHandoff,
  type LightboxDecodedNotedLine,
  type LightboxDecodedNumberReading,
  type LightboxDecodedNumbersBlock,
  type LightboxDecodedRhythmBlock,
  type LightboxDecodedStockBlock,
  type LightboxWireQuote
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxNumberLabel } from '@/infrastructure/lightbox/LightboxNumbers';
import { isLightboxNumberStat } from '@shared/constants/lightbox';
import { LIGHTBOX_NUMBERS_READ_STATS } from '@shared/constants/lightboxSteering';

const B = PROMPT_BUDGETS.lightbox;

/** Words a numbers reading may not use: it describes how a figure is used, and never directs a change. */
export const LIGHTBOX_NUMBERS_DIRECTIVE_WORDS = [
  'fix', 'cut', 'trim', 'remove', 'reduce', 'replace', 'rewrite', 'revise', 'delete', 'tighten', 'eliminate',
  'should', 'must', 'consider', 'try'
] as const;

const DIRECTIVE = new RegExp(`\\b(?:${LIGHTBOX_NUMBERS_DIRECTIVE_WORDS.join('|')})\\b`, 'i');
const LIKELIHOOD = /%|\bper\s?cent\b/i;

export function decodeStockBlock(value: unknown, path: string, friction: string): LightboxDecodedStockBlock {
  const block = strictObject(value, path, ['economy', 'signature', 'familiar', 'airLocks', 'echoes', 'friction']);
  const economy = strictObject(block.economy, `${path}.economy`, ['note', 'beats']);
  const beats = decodeItems(economy.beats, `${path}.economy.beats`, B.stockBeats, 'beat', (item, itemPath) => {
    const beat = strictObject(item, itemPath, ['para', 'quote', 'tier']);
    return {
      para: paragraphNumber(beat.para, `${itemPath}.para`),
      quote: text(beat.quote, `${itemPath}.quote`, B.quoteCharacters),
      tier: oneOf(beat.tier, `${itemPath}.tier`, LIGHTBOX_STOCK_TIERS, 'functional, decorated, weighted or signature')
    };
  });
  const signature = decodeItems(block.signature, `${path}.signature`, B.signaturePhrases, 'signature phrase', notedLine);
  const familiar = decodeItems(block.familiar, `${path}.familiar`, B.familiarPhrases, 'familiar phrase', decodeFamiliar);
  const airLocks = decodeItems(block.airLocks, `${path}.airLocks`, B.airLocks, 'air-lock', notedLine);
  const echoes = decodeItems(block.echoes, `${path}.echoes`, B.echoes, 'echo', decodeEcho);
  return {
    lens: 'stock',
    economy: { note: text(economy.note, `${path}.economy.note`, B.claimCharacters), beats: beats.items },
    signature: signature.items,
    familiar: familiar.items,
    airLocks: airLocks.items,
    echoes: echoes.items,
    malformed: {
      beats: beats.malformed,
      signature: signature.malformed,
      familiar: familiar.malformed,
      airLocks: airLocks.malformed,
      echoes: echoes.malformed
    },
    friction
  };
}

export function decodeRhythmBlock(
  value: unknown,
  path: string,
  friction: string,
  columnCount: number
): LightboxDecodedRhythmBlock {
  const block = strictObject(value, path, ['endings', 'movement', 'evidence', 'handoffs', 'friction']);
  boundedArrayAt(block.endings, `${path}.endings`, columnCount, columnCount, 'endings, one per ribbon column');
  const endings = block.endings.map((ending, index) =>
    oneOf(ending, `${path}.endings[${index}]`, LIGHTBOX_PARAGRAPH_ENDINGS, 'lands, holds or opens'));
  const handoffs = decodeItems(block.handoffs, `${path}.handoffs`, B.handoffs, 'handoff', decodeHandoff);
  return {
    lens: 'rhythm',
    endings,
    movement: text(block.movement, `${path}.movement`, B.claimCharacters),
    evidence: evidence(block.evidence, `${path}.evidence`, 1),
    handoffs: handoffs.items,
    malformed: handoffs.malformed,
    friction
  };
}

export function decodeNumbersBlock(value: unknown, path: string, friction: string): LightboxDecodedNumbersBlock {
  const block = strictObject(value, path, ['items', 'friction']);
  const decoded = decodeItems(block.items, `${path}.items`, B.numberReadings, 'reading', decodeNumberReading);
  const seen = new Set<string>();
  const items = decoded.items.filter((item) => {
    if (seen.has(item.stat)) {
      decoded.malformed.push({ title: lightboxNumberLabel(item.stat), reason: 'Another reading in this block already reads that figure.' });
      return false;
    }
    seen.add(item.stat);
    return true;
  });
  return { lens: 'numbers', items, malformed: decoded.malformed, friction };
}

function notedLine(item: Record<string, unknown>, path: string): LightboxDecodedNotedLine {
  const line = strictObject(item, path, ['title', 'note', 'evidence']);
  return {
    title: text(line.title, `${path}.title`, B.labelCharacters),
    note: text(line.note, `${path}.note`, B.noteCharacters),
    evidence: evidence(line.evidence, `${path}.evidence`, 1)
  };
}

function decodeFamiliar(item: Record<string, unknown>, path: string): LightboxDecodedFamiliar {
  const familiar = strictObject(item, path, ['phrase', 'kind', 'note', 'evidence']);
  return {
    phrase: text(familiar.phrase, `${path}.phrase`, B.labelCharacters),
    kind: oneOf(familiar.kind, `${path}.kind`, LIGHTBOX_FAMILIAR_KINDS, 'idiom, cliche, stock or weighted'),
    note: text(familiar.note, `${path}.note`, B.noteCharacters),
    evidence: evidence(familiar.evidence, `${path}.evidence`, 1)
  };
}

function decodeEcho(item: Record<string, unknown>, path: string): LightboxDecodedEcho {
  const echo = strictObject(item, path, ['title', 'reminiscentOf', 'note', 'evidence']);
  const title = text(echo.title, `${path}.title`, B.labelCharacters);
  const reminiscentOf = text(echo.reminiscentOf, `${path}.reminiscentOf`, B.labelCharacters);
  const note = text(echo.note, `${path}.note`, B.noteCharacters);
  if ([title, reminiscentOf, note].some((field) => LIKELIHOOD.test(field))) {
    throw new Error('An echo states no likelihood: it holds a percentage.');
  }
  return {
    title,
    reminiscentOf,
    note,
    evidence: evidence(echo.evidence, `${path}.evidence`, 1)
  };
}

function decodeHandoff(item: Record<string, unknown>, path: string): LightboxDecodedHandoff {
  const handoff = strictObject(item, path, ['from', 'to', 'carried', 'changes', 'effect']);
  return {
    from: singleQuote(handoff.from, `${path}.from`),
    to: singleQuote(handoff.to, `${path}.to`),
    carried: text(handoff.carried, `${path}.carried`, B.noteCharacters),
    changes: text(handoff.changes, `${path}.changes`, B.noteCharacters),
    effect: oneOf(handoff.effect, `${path}.effect`, LIGHTBOX_HANDOFF_EFFECTS, 'continues, pause, closure or loses')
  };
}

function decodeNumberReading(item: Record<string, unknown>, path: string): LightboxDecodedNumberReading {
  const reading = strictObject(item, path, ['stat', 'usage', 'claim', 'evidence']);
  if (!isLightboxNumberStat(reading.stat) || !LIGHTBOX_NUMBERS_READ_STATS.includes(reading.stat)) {
    shapeError(`${path}.stat`, 'one of the figures the task lists');
  }
  const claim = text(reading.claim, `${path}.claim`, B.claimCharacters);
  if (DIRECTIVE.test(claim)) {
    throw new Error('A numbers reading describes how a figure is used and never directs a change; its claim does.');
  }
  if (LIGHTBOX_BARE_DIGIT.test(claim) || LIKELIHOOD.test(claim)) {
    throw new Error('A numbers reading never states a figure: the board shows the measured one beside it.');
  }
  return {
    stat: reading.stat,
    usage: oneOf(reading.usage, `${path}.usage`, LIGHTBOX_NUMBER_USAGES, 'deliberate, mixed or habit'),
    claim,
    evidence: evidence(reading.evidence, `${path}.evidence`, 1)
  };
}

function singleQuote(value: unknown, path: string): LightboxWireQuote {
  const quote = strictObject(value, path, ['para', 'quote']);
  return { para: paragraphNumber(quote.para, `${path}.para`), quote: text(quote.quote, `${path}.quote`, B.quoteCharacters) };
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[], expected: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    shapeError(path, expected);
  }
  return value as T;
}
