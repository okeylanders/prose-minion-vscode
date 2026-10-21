/**
 * The text a board was measured from, kept beside it host-side (Slice 4E;
 * ADR 2026-10-19 D12), so the inspector's passages are cut from exactly what
 * was counted. Pure apart from its own lazy caches; built once per board by
 * `LightboxService` and never posted whole.
 *
 * It holds the text, the paragraph model, and the tagger's occurrences as
 * the board placed them (`placeLightboxPosOccurrences`), mapped back from the
 * lowercased text the tagger read. Token streams and sentences are worked out
 * on first use and kept, so a second request costs a filter.
 */

import type { LightboxPassagePartOfSpeech, LightboxPassageTerm } from '@messages';
import type { WordFrequencyOutput } from '@/tools/measure/wordFrequency';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import type { LightboxParagraph } from '@/infrastructure/lightbox/LightboxParagraphs';
import { placeLightboxPosOccurrences } from '@/infrastructure/lightbox/LightboxMeasures';
import {
  LightboxSpan,
  LightboxTokenSpan,
  lightboxFrequencyTokenSpans,
  lightboxLowercaseSpanMap,
  lightboxPhraseInstances,
  lightboxProseTokenSpans,
  lightboxStyleFlagInstances,
  lightboxTokenInstances
} from '@/infrastructure/lightbox/LightboxInstances';

/** One sentence of one paragraph, by the paragraph's own sentence rule, in offsets of the whole text. */
export interface LightboxSentenceSpan extends LightboxSpan {
  paragraph: number;
  /** From 1, within its paragraph. */
  sentence: number;
}

/** A tagged word the board counted, where it stands in the text as measured. */
interface LightboxPosSpan extends LightboxSpan {
  list: LightboxPassagePartOfSpeech;
  word: string;
}

export interface LightboxPassageIndexInputs {
  /** The text the measure tools read. */
  text: string;
  /** Its paragraphs, by the shared splitter. */
  paragraphs: readonly LightboxParagraph[];
  /** The word-frequency output the board was built from (its tagged occurrences). */
  frequency: Pick<WordFrequencyOutput, 'pos'>;
}

export class LightboxPassageIndex {
  private frequencyTokens?: LightboxTokenSpan[];
  private proseTokens?: LightboxTokenSpan[];
  private sentenceSpans?: LightboxSentenceSpan[];

  private constructor(
    readonly text: string,
    readonly paragraphs: readonly LightboxParagraph[],
    /** Undefined when the tagger did not load: the board's lists are empty then. */
    private readonly pos: readonly LightboxPosSpan[] | undefined
  ) {}

  static build({ text, paragraphs, frequency }: LightboxPassageIndexInputs): LightboxPassageIndex {
    const toText = lightboxLowercaseSpanMap(text);
    const pos = placeLightboxPosOccurrences(frequency, text)?.map((occurrence) => ({
      list: occurrence.list,
      word: occurrence.word,
      ...toText({ start: occurrence.offset, end: occurrence.offset + occurrence.length })
    }));
    return new LightboxPassageIndex(text, paragraphs, pos);
  }

  /** Every instance of `term`, in text order, by the rule that made its count (`LightboxInstances`). */
  instancesOf(term: LightboxPassageTerm): LightboxSpan[] {
    switch (term.kind) {
      case 'word':
        return lightboxTokenInstances(this.frequencyStream(), term.word);
      case 'phrase':
        return lightboxPhraseInstances(this.frequencyStream(), term.phrase);
      case 'hapax':
        return lightboxTokenInstances(this.proseStream(), term.word);
      case 'flag':
        return lightboxStyleFlagInstances(this.text, term.flag);
      case 'pos':
        return (this.pos ?? [])
          .filter((occurrence) => occurrence.list === term.pos && occurrence.word === term.word)
          .map(({ start, end }) => ({ start, end }));
    }
  }

  /** Every sentence of every paragraph, in order: each paragraph's `proseSentenceSpans`. */
  sentences(): readonly LightboxSentenceSpan[] {
    if (!this.sentenceSpans) {
      this.sentenceSpans = this.paragraphs.flatMap((paragraph) =>
        proseSentenceSpans(paragraph.text).map((span, offset) => ({
          paragraph: paragraph.index,
          sentence: offset + 1,
          start: paragraph.start + span.start,
          end: paragraph.start + span.end
        }))
      );
    }
    return this.sentenceSpans;
  }

  private frequencyStream(): LightboxTokenSpan[] {
    this.frequencyTokens ??= lightboxFrequencyTokenSpans(this.text);
    return this.frequencyTokens;
  }

  private proseStream(): LightboxTokenSpan[] {
    this.proseTokens ??= lightboxProseTokenSpans(this.text);
    return this.proseTokens;
  }
}
