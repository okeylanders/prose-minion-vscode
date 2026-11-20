/**
 * Shared stand-ins for Passage Search's tests: made-up source files and an
 * *Alice*-style chapter. No provider is reached anywhere they are used.
 */
import type { PassageSearchInstance, PassageSearchResult, PassageSearchSourceFile } from '@services/search/passage/PassageSearchContracts';

export const PASSAGE_MODEL = 'placeholder/passage-model';
export const SYSTEM_MESSAGE = 'SYSTEM passage-search';
export const QUESTION = 'Find every time the White Rabbit checks its watch.';

export const RABBIT_CHAPTER = [
  'Suddenly a White Rabbit with pink eyes ran close by her. “Oh dear! Oh dear! I shall be late!” it said to itself.',
  'It took a watch out of its waistcoat-pocket, and hurried on. Alice ran across the field after it.',
  'The Rabbit glanced at its watch again, and was gone round the corner.'
].join('\n\n');

export const QUEEN_CHAPTER = [
  'The Queen of Hearts, she made some tarts, all on a summer day.',
  'The Knave of Hearts, he stole those tarts, and took them quite away.'
].join('\n\n');

export function sourceFile(path: string, text: string, overrides: Partial<PassageSearchSourceFile> = {}): PassageSearchSourceFile {
  return { identity: `/book/${path}`, displayPath: path, absolutePath: `/book/${path}`, text, lineOffset: 0, lines: 'document', ...overrides };
}

/** A paragraph of `words` filler words in sentences of ten, the first word naming it. */
export function fillerParagraph(name: string, words: number): string {
  const sentences: string[] = [];
  for (let written = 0; written < words; written += 10) {
    const count = Math.min(10, words - written);
    sentences.push(`${[`${name}${written / 10 + 1}`, ...Array.from({ length: count - 1 }, () => 'tea')].join(' ')}.`);
  }
  return sentences.join(' ');
}

/** A reply as a model writes one. */
export function replyOf(...instances: Array<{ quote: string; label?: string; note?: string; before?: string; after?: string }>): string {
  return JSON.stringify({ instances: instances.map((instance) => ({ note: 'A note.', label: 'checks its watch', ...instance })) });
}

/** A checked instance as a run returns one; its label is its own key. */
export function instanceOf(number: number, overrides: Partial<PassageSearchInstance> = {}): PassageSearchInstance {
  return {
    number,
    file: 'f1',
    displayPath: 'chapters/1.md',
    line: number,
    start: number * 100,
    end: number * 100 + 10,
    quote: 'looked at its watch',
    before: '',
    after: '',
    note: 'It checks its watch.',
    label: 'checks its watch',
    ...overrides
  };
}

/** A result over `instances`, its label table counted from them as the host counts it. */
export function resultOf(instances: readonly PassageSearchInstance[], overrides: Partial<PassageSearchResult> = {}): PassageSearchResult {
  const labels = new Map<string, { count: number; files: Set<string> }>();
  for (const instance of instances) {
    const row = labels.get(instance.label) ?? { count: 0, files: new Set<string>() };
    row.count += 1;
    row.files.add(instance.file);
    labels.set(instance.label, row);
  }
  return {
    question: QUESTION,
    model: PASSAGE_MODEL,
    instances,
    labels: [...labels.entries()].map(([key, row]) => ({ key, label: key, count: row.count, files: row.files.size })),
    // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the closed drop reasons.
    dropped: { 'quote-not-found': 0, 'quote-ambiguous': 0, malformed: 0, duplicate: 0 },
    overLimit: 0,
    calls: { planned: 1, answered: 1, failed: 0, cut: 0, unsent: 0 },
    files: { read: [], leftOut: { unreadable: 0, unsplittable: 0, empty: 0 } },
    ended: 'complete',
    ...overrides
  };
}
