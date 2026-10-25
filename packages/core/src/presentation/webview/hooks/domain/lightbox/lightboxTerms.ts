/**
 * The board's counted terms as items (ADR 2026-10-19 D4, D5; Slice 4E): a
 * top word, a word on a part-of-speech list, a repeated phrase, a hapax word
 * and an instance-counting style flag. Pure: no React, no transport.
 *
 * A term is named exactly as the host names it in a passage request
 * (`LightboxPassageTerm`), so a pinned term is also what the inspector asks
 * the host for. Every count shown is the host's; hovering a term lights the
 * paragraphs the host placed it in.
 */

import type { LightboxBoard, LightboxCountedTerm, LightboxPassagePartOfSpeech, LightboxPassageTerm } from '@messages';
import { LIGHTBOX_STYLE_FLAG_RULES, isLightboxStyleFlagId } from '@shared/constants/lightboxPassages';
import type { LightboxResolvedItem } from '@hooks/domain/lightbox/lightboxItems';

/** A counted term the inspector can open: the passage contract's own shapes. */
export type LightboxTermRef = LightboxPassageTerm;

export type LightboxPartOfSpeech = LightboxPassagePartOfSpeech;

export const LIGHTBOX_PARTS_OF_SPEECH: readonly LightboxPartOfSpeech[] = ['nouns', 'verbs', 'adjectives', 'adverbs'];

export const LIGHTBOX_POS_LABELS: Readonly<Record<LightboxPartOfSpeech, string>> = {
  nouns: 'Noun',
  verbs: 'Verb',
  adjectives: 'Adjective',
  adverbs: 'Adverb'
};

const TERM_KINDS: ReadonlySet<string> = new Set(['word', 'pos', 'phrase', 'hapax', 'flag']);

export function isLightboxTermRef(ref: { kind: string } | null | undefined): ref is LightboxTermRef {
  return ref !== null && ref !== undefined && TERM_KINDS.has(ref.kind);
}

/** A stable identity for a term. */
export function lightboxTermKey(term: LightboxTermRef): string {
  switch (term.kind) {
    case 'word':
      return `word:${term.word}`;
    case 'pos':
      return `pos:${term.pos}:${term.word}`;
    case 'phrase':
      return `phrase:${term.phrase}`;
    case 'hapax':
      return `hapax:${term.word}`;
    case 'flag':
      return `flag:${term.flag}`;
  }
}

/** Restore a persisted term; anything malformed is none. */
export function parseLightboxTermRef(value: unknown): LightboxTermRef | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const text = (key: string): string | undefined =>
    typeof record[key] === 'string' && (record[key] as string).length > 0 ? (record[key] as string) : undefined;
  const word = text('word');
  switch (record.kind) {
    case 'word':
      return word ? { kind: 'word', word } : null;
    case 'hapax':
      return word ? { kind: 'hapax', word } : null;
    case 'pos': {
      const pos = LIGHTBOX_PARTS_OF_SPEECH.find((candidate) => candidate === record.pos);
      return word && pos ? { kind: 'pos', pos, word } : null;
    }
    case 'phrase': {
      const phrase = text('phrase');
      return phrase ? { kind: 'phrase', phrase } : null;
    }
    case 'flag':
      return isLightboxStyleFlagId(record.flag) ? { kind: 'flag', flag: record.flag } : null;
    default:
      return null;
  }
}

/** What a term means on this board, or undefined when the board does not list it. */
export function resolveLightboxTerm(board: LightboxBoard, term: LightboxTermRef): LightboxResolvedItem | undefined {
  const measured = board.measured;
  switch (term.kind) {
    case 'word': {
      const entry = measured.topWords.find((candidate) => candidate.term === term.word);
      return entry ? countedTermItem(term, entry, 'Word') : undefined;
    }
    case 'pos': {
      const entry = measured.partsOfSpeech[term.pos].find((candidate) => candidate.term === term.word);
      return entry ? countedTermItem(term, entry, LIGHTBOX_POS_LABELS[term.pos]) : undefined;
    }
    case 'phrase': {
      const entry = [...measured.phrases.bigrams, ...measured.phrases.trigrams].find((candidate) => candidate.term === term.phrase);
      return entry ? countedTermItem(term, entry, 'Repeated phrase', `“${entry.term}”`) : undefined;
    }
    case 'hapax': {
      const entry = measured.hapax.find((candidate) => candidate.term === term.word);
      if (!entry) {
        return undefined;
      }
      const counted = entry.written.toLowerCase() === entry.term ? '' : ` Counted as “${entry.term}”: the stats row keeps letters and apostrophes only.`;
      return {
        ref: term,
        register: 'measured',
        where: 'Measure · Used once',
        title: entry.written,
        claim: `Used once, in ¶${entry.paragraph}.${counted} Counted by code; nothing here is a reading.`,
        paragraphs: [entry.paragraph],
        support: [`${entry.term} ×1`, `${measured.hapax.length.toLocaleString('en-US')} words used once`]
      };
    }
    case 'flag': {
      const flag = measured.styleFlags.find((candidate) => candidate.id === term.flag);
      if (!flag) {
        return undefined;
      }
      const places = flag.paragraphs.length;
      return {
        ref: term,
        register: 'measured',
        where: 'Measure · Style flag',
        title: flag.type,
        claim:
          `Appears ${lightboxTimesLabel(flag.count)}` + (places > 0 ? ` across ${lightboxParagraphCountLabel(places)}` : '') +
          `. ${LIGHTBOX_STYLE_FLAG_RULES[term.flag]} Counted by code; nothing here is a reading.`,
        paragraphs: [...flag.paragraphs],
        support: [`${flag.type} ×${flag.count}`, ...(flag.examples.length > 0 ? [`e.g. ${flag.examples.slice(0, 3).join(', ')}`] : [])]
      };
    }
  }
}

/** How a term is named in a sentence: “alice”, “do” (verb), Adverbs (-ly words). */
export function lightboxTermLabel(board: LightboxBoard, term: LightboxTermRef): string {
  switch (term.kind) {
    case 'word':
      return `“${term.word}”`;
    case 'pos':
      return `“${term.word}” (${LIGHTBOX_POS_LABELS[term.pos].toLowerCase()})`;
    case 'phrase':
      return `“${term.phrase}”`;
    case 'hapax':
      return `“${board.measured.hapax.find((entry) => entry.term === term.word)?.written ?? term.word}”`;
    case 'flag':
      return board.measured.styleFlags.find((flag) => flag.id === term.flag)?.type ?? term.flag;
  }
}

/** A counted word or phrase: its count and the paragraphs the host placed it in. */
export function countedTermItem(
  ref: LightboxTermRef,
  term: LightboxCountedTerm,
  kindLabel: string,
  title = term.term
): LightboxResolvedItem {
  const places = term.paragraphs.length;
  return {
    ref,
    register: 'measured',
    where: `Measure · ${kindLabel}`,
    title,
    claim:
      `Appears ${lightboxTimesLabel(term.count)}` +
      (places > 0 ? ` across ${lightboxParagraphCountLabel(places)}` : '') +
      '. Counted by code; nothing here is a reading.',
    paragraphs: [...term.paragraphs],
    support: [`${term.term} ×${term.count}`, `${term.percentage}% of words`]
  };
}

export function lightboxTimesLabel(count: number): string {
  return count === 1 ? 'once' : `${count.toLocaleString('en-US')} times`;
}

export function lightboxParagraphCountLabel(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'paragraph' : 'paragraphs'}`;
}
