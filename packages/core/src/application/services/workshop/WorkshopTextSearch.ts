/** Shared lexical rules for transcript, project memory and bundled help searches. */

/** One word of visible text: where it sits, and the form search compares. */
export interface WorkshopWord {
  readonly start: number;
  readonly end: number;
  readonly normalized: string;
}

/**
 * Unicode words: letters, marks, and digits, with inner apostrophes kept
 * inside the word ("don't", "Jill's"). Normalization folds case,
 * diacritics, and compatibility forms, strips a possessive "'s", and drops
 * other apostrophes, so "café" finds "cafe", "dont" finds "don't", and
 * "keeper's" finds "keeper".
 */
export function workshopWords(text: string): WorkshopWord[] {
  const words: WorkshopWord[] = [];
  for (const match of text.matchAll(WORD)) {
    const normalized = normalizeWord(match[0]);
    if (normalized) {
      words.push({ start: match.index, end: match.index + match[0].length, normalized });
    }
  }
  return words;
}

export function normalizeWorkshopText(text: string): string {
  return workshopWords(text).map((word) => word.normalized).join(' ');
}

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

function normalizeWord(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // A possessive keeps its stem, so "keeper's" finds "keeper" and "keepers".
    .replace(/['’]s$/u, '')
    .replace(/['’\s]/g, '');
}

export const WORKSHOP_QUERY_TERMS = 8;

export type WorkshopMatchMode = 'all-terms' | 'any-term';

export interface WorkshopQuery {
  /** Distinct normalized terms that search matches, at most eight. */
  readonly terms: readonly string[];
  /** Distinct terms past the eight-term limit; disclosed, never searched. */
  readonly overflowTerms: readonly string[];
  /** Every normalized query word in order, for the phrase bonus. */
  readonly phrase: readonly string[];
}

export function parseWorkshopQuery(query: string): WorkshopQuery {
  const words = workshopWords(query).map((word) => word.normalized);
  const distinct = [...new Set(words)];
  const content = distinct.filter((word) => !STOP_WORDS.has(word));
  const candidates = content.length > 0 ? content : distinct;
  return {
    terms: candidates.slice(0, WORKSHOP_QUERY_TERMS),
    overflowTerms: candidates.slice(WORKSHOP_QUERY_TERMS),
    phrase: words
  };
}

export interface WorkshopSearchRank {
  readonly matchedTerms: number;
  readonly phrase: boolean;
  readonly wholeWords: number;
}

export class WorkshopQueryMatcher {
  private readonly phraseText?: string;

  constructor(readonly query: WorkshopQuery) {
    // Whole words, except the last, which may still be a prefix: "keeper's mo"
    // finds "keeper's mother".
    this.phraseText = query.phrase.length > 1 ? ` ${query.phrase.join(' ')}` : undefined;
  }

  /** Rank one normalized, space-separated text. */
  rank(searchText: string): WorkshopSearchRank {
    const padded = ` ${searchText} `;
    let matchedTerms = 0;
    let wholeWords = 0;
    for (const term of this.query.terms) {
      if (padded.includes(` ${term}`)) {
        matchedTerms += 1;
        if (padded.includes(` ${term} `)) {
          wholeWords += 1;
        }
      }
    }
    const phrase = this.phraseText !== undefined && padded.includes(this.phraseText);
    return { matchedTerms, phrase, wholeWords };
  }

  matchesWord(normalizedWord: string): boolean {
    return this.query.terms.some((term) => normalizedWord.startsWith(term));
  }
}

const ELLIPSIS = '…';
/** How far a cut may move to land on a word boundary. */
const BOUNDARY_SLACK = 24;

/**
 * At most `limit` characters around the first matching word, with the match
 * about a third of the way in, cut at word boundaries where one is near.
 */
export function workshopSearchSnippet(text: string, matcher: WorkshopQueryMatcher, limit: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) {
    return collapsed;
  }
  const first = workshopWords(collapsed).find((word) => matcher.matchesWord(word.normalized));
  const window = limit - 2 * ELLIPSIS.length;
  const anchor = first?.start ?? 0;
  let start = Math.max(0, Math.min(anchor - Math.floor(window / 3), collapsed.length - window));
  let end = Math.min(collapsed.length, start + window);
  if (start > 0) {
    const space = collapsed.indexOf(' ', start);
    if (space >= 0 && space < Math.min(anchor, start + BOUNDARY_SLACK)) {
      start = space + 1;
    }
  }
  if (end < collapsed.length) {
    const space = collapsed.lastIndexOf(' ', end);
    if (space > Math.max(start, end - BOUNDARY_SLACK)) {
      end = space;
    }
  }
  return `${start > 0 ? ELLIPSIS : ''}${collapsed.slice(start, end).trim()}${end < collapsed.length ? ELLIPSIS : ''}`;
}

/** Common English function words, in normalized form (apostrophes dropped). */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'but', 'by', 'can',
  'could', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'im', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself',
  'ive', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'wasnt', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'youre', 'your', 'yours', 'yourself', 'yourselves'
]);
