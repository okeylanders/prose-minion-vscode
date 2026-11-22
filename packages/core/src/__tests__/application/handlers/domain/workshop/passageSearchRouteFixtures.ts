/**
 * Passage-search route fixtures (ADR 2026-11-20 D16–D21): a fake engine
 * that makes no call, an *Alice* result whose every writer- or
 * model-written string carries a sentinel, and the listing a request is
 * settled against. Made-up text.
 */

import type { PassageSearchPlan, PassageSearchProgress, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchRequest } from '@/application/services/passageSearch/PassageSearchRequest';
import type { WorkshopPassageSearchPorts } from '@handlers/domain/workshop/WorkshopPassageSearchHandler';

export const QUESTION_SENTINEL = 'ZZQ-QUESTION';
export const QUOTE_SENTINEL = 'ZZQ-QUOTE';
export const NOTE_SENTINEL = 'ZZQ-NOTE';
export const LABEL_SENTINEL = 'ZZQ-LABEL';
export const PATH_SENTINEL = 'zzq-rabbit-hole';

export const QUESTION = `Find every time the White Rabbit checks his watch ${QUESTION_SENTINEL}.`;
export const CHAPTER = `chapters/${PATH_SENTINEL}.md`;

export const searchFrame = (inner = `<question>${QUESTION}</question>\n<group>chapters</group>\n<path group="chapters">${CHAPTER}</path>\n<excerpt/>`): string =>
  `<prose-minion-passage-search>\n${inner}\n</prose-minion-passage-search>`;

export const LISTED = [
  { group: 'chapters' as const, relativePath: CHAPTER },
  { group: 'chapters' as const, relativePath: 'chapters/pool-of-tears.md' },
  { group: 'characters' as const, relativePath: 'characters/alice.md' }
];

export function aliceResult(instances = 3, overrides: Partial<PassageSearchResult> = {}): PassageSearchResult {
  return {
    question: QUESTION,
    model: 'model/search',
    instances: Array.from({ length: instances }, (_, index) => ({
      number: index + 1,
      file: 'f1',
      displayPath: CHAPTER,
      line: 10 + index,
      start: index * 100,
      end: index * 100 + 40,
      quote: `took a watch out of its waistcoat-pocket ${QUOTE_SENTINEL} ${index + 1}`,
      before: 'the Rabbit actually ',
      after: ', and looked at it',
      note: `He checks the time ${NOTE_SENTINEL}.`,
      label: 'watch'
    })),
    labels: instances > 0 ? [{ key: 'watch', label: `Checks the watch ${LABEL_SENTINEL}`, count: instances, files: 1 }] : [],
    // eslint-disable-next-line @typescript-eslint/naming-convention -- the engine's kebab-case drop reasons.
    dropped: { 'quote-not-found': 1, 'quote-ambiguous': 0, malformed: 0, duplicate: 2 },
    overLimit: 0,
    calls: { planned: 4, answered: 4, failed: 0, cut: 0, cancelled: 0, unsent: 0 },
    files: {
      planned: [{ key: 'f1', displayPath: CHAPTER, lines: 'document', instances, chunks: { planned: 4, admitted: 4, answered: 4 }, searched: 'full' }],
      searched: { full: 1, partial: 0, none: 0 },
      leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
    },
    ended: 'complete',
    ...overrides
  };
}

/** `instances` in the first of `files` chapters, every one read whole in a call of its own: a match among many files searched. */
export function aliceAcrossFiles(instances: number, files: number): PassageSearchResult {
  const base = aliceResult(instances);
  const planned = Array.from({ length: files }, (_, index) => ({
    ...base.files.planned[0], key: `f${index + 1}`, displayPath: `chapters/chapter-${index + 1}.md`, instances: index === 0 ? instances : 0
  }));
  return aliceResult(instances, {
    calls: { planned: files, answered: files, failed: 0, cut: 0, cancelled: 0, unsent: 0 },
    files: { ...base.files, planned, searched: { full: files, partial: 0, none: 0 } }
  });
}

export function planOf(planKey: string): PassageSearchPlan {
  return {
    planKey,
    model: 'model/search',
    question: QUESTION,
    organize: true,
    systemMessage: '',
    chunkWords: 12_000,
    ceilings: { readOutputTokens: 12_000, organizeOutputTokens: 4_000 },
    files: [],
    chunks: [],
    estimate: {
      model: 'model/search', files: 2, calls: 4, inputTokens: 9_000, outputTokens: 3_200, usd: 0.42,
      reads: { calls: 3, inputTokens: 3_000, outputTokens: 2_400 },
      organize: { inputTokens: 6_000, outputTokens: 800 },
      leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
    }
  };
}

export interface FakePassageSearch {
  readonly ports: WorkshopPassageSearchPorts;
  readonly plan: jest.Mock;
  readonly run: jest.Mock;
  readonly listGroupFiles: jest.Mock;
  readonly save: jest.Mock;
  /** The key the next plan carries. */
  planKey: string;
  /** What the next run returns once it is finished. */
  result: PassageSearchResult;
  /** When set, a run waits for `finish()`; a Stop finishes it as stopped. */
  hold: boolean;
  finish(): void;
  progress(progress: PassageSearchProgress): void;
  requests(): PassageSearchRequest[];
}

export function fakePassageSearch(): FakePassageSearch {
  let release: (() => void) | undefined;
  let report: ((progress: PassageSearchProgress) => void) | undefined;
  const fake: FakePassageSearch = {
    planKey: 'key-1',
    result: aliceResult(),
    hold: false,
    plan: jest.fn(async () => ({ kind: 'planned' as const, plan: planOf(fake.planKey) })),
    run: jest.fn(async (_plan: PassageSearchPlan, options?: { signal?: AbortSignal; onProgress?: (progress: PassageSearchProgress) => void }) => {
      report = options?.onProgress;
      if (fake.hold) {
        await new Promise<void>((resolve) => {
          release = resolve;
          options?.signal?.addEventListener('abort', () => resolve());
        });
      }
      return options?.signal?.aborted
        ? {
          ...fake.result,
          ended: 'stopped' as const,
          calls: { ...fake.result.calls, answered: 2, cancelled: 1, unsent: 1 },
          files: { ...fake.result.files, searched: { full: 0, partial: 1, none: 0 } }
        }
        : fake.result;
    }),
    listGroupFiles: jest.fn(async () => LISTED),
    save: jest.fn(async () => ({ status: 'saved' as const, filePath: 'prose-minion/reports/passage-search-20261120-120000.md', opened: true })),
    finish: () => release?.(),
    progress: (progress) => report?.(progress),
    requests: () => fake.plan.mock.calls.map(([request]) => request as PassageSearchRequest),
    ports: undefined as unknown as WorkshopPassageSearchPorts
  };
  (fake as { ports: WorkshopPassageSearchPorts }).ports = {
    engine: { plan: fake.plan, run: fake.run },
    listing: { listGroupFiles: fake.listGroupFiles },
    reports: { save: fake.save }
  };
  return fake;
}
