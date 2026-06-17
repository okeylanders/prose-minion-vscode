import { Genre, RangeInteger, RangeNumber, WordsPerPage } from '@/domain/models/PublishingStandards';

export type ComparisonStatus = 'below' | 'within' | 'above' | 'n/a';

export interface ComparisonItem {
  key: string;
  label: string;
  value: number | string;
  standard?: { min?: number; max?: number };
  status: ComparisonStatus;
}

export interface PublishingFormatSummary {
  trimSize: { width_inches: number; height_inches: number; label: string };
  wordsPerPage: number;
  estimatedPageCount: number;
  pageCountRange?: { min?: number; max?: number };
  status: ComparisonStatus;
}

export class StandardsComparisonService {
  compareNumber(value: number | undefined, range?: RangeInteger | RangeNumber): ComparisonStatus {
    if (value === undefined || !range) return 'n/a';
    if (typeof range.min === 'number' && value < range.min) return 'below';
    if (typeof range.max === 'number' && value > range.max) return 'above';
    return 'within';
  }

  makeItem(key: string, label: string, value: number | string | undefined, range?: RangeInteger | RangeNumber): ComparisonItem | undefined {
    if (value === undefined) return undefined;
    return {
      key,
      label,
      value,
      standard: range ? { min: (range as any).min, max: (range as any).max } : undefined,
      status: this.compareNumber(typeof value === 'number' ? value : Number.NaN, range)
    };
  }

  resolveEffectiveWPP(genre: Genre, pageSizeKey?: string): number | undefined {
    let wpp: WordsPerPage | undefined = undefined;
    if (pageSizeKey) {
      const ps = genre.page_sizes.find(ps => (ps.format && ps.format === pageSizeKey) || `${ps.width_inches}x${ps.height_inches}` === pageSizeKey);
      wpp = ps?.words_per_page;
    }
    if (!wpp) wpp = genre.words_per_page;
    return wpp?.average;
  }

  buildPublishingFormat(genre: Genre, wordCount: number, pageSizeKey?: string): PublishingFormatSummary | undefined {
    const ps = pageSizeKey
      ? genre.page_sizes.find(s => (s.format && s.format === pageSizeKey) || `${s.width_inches}x${s.height_inches}` === pageSizeKey)
      : genre.page_sizes.find(s => s.common) || genre.page_sizes[0];
    if (!ps) return undefined;

    const effectiveWPP = (ps.words_per_page?.average ?? genre.words_per_page?.average) || undefined;
    if (!effectiveWPP || effectiveWPP <= 0) return {
      trimSize: { width_inches: ps.width_inches, height_inches: ps.height_inches, label: ps.format || `${ps.width_inches}x${ps.height_inches}` },
      wordsPerPage: NaN,
      estimatedPageCount: NaN,
      pageCountRange: { ...genre.page_count_range },
      status: 'n/a'
    };

    const estimatedPageCount = Math.ceil(wordCount / effectiveWPP);
    const status: ComparisonStatus = this.compareNumber(estimatedPageCount, genre.page_count_range);
    return {
      trimSize: { width_inches: ps.width_inches, height_inches: ps.height_inches, label: ps.format || `${ps.width_inches}x${ps.height_inches}` },
      wordsPerPage: effectiveWPP,
      estimatedPageCount,
      pageCountRange: { ...genre.page_count_range },
      status
    };
  }
}

