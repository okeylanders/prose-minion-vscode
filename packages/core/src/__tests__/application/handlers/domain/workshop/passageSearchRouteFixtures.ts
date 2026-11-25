/**
 * Passage-search route fixtures (ADR 2026-11-20 D16–D21): a fake engine
 * that makes no call, an *Alice* result whose every writer- or
 * model-written string carries a sentinel, and the listing a request is
 * settled against. Made-up text.
 */

import type { PassageSearchAnalysis, PassageSearchPlan, PassageSearchProgress, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
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
  { group: 'chapters' as const, relativePath: CHAPTER, absolutePath: `/wonderland/${CHAPTER}` },
  { group: 'chapters' as const, relativePath: 'chapters/pool-of-tears.md', absolutePath: '/wonderland/chapters/pool-of-tears.md' },
  { group: 'characters' as const, relativePath: 'characters/alice.md', absolutePath: '/wonderland/characters/alice.md' }
];

/**
 * A result's read calls as the engine counts them (#295): what is not given is none, except `planned`, which is what
 * was answered unless given, and `dispatched`, which is always the calls that went out: answered, failed, cancelled.
 */
export function callsOf(given: Partial<Omit<PassageSearchResult['calls'], 'dispatched'>>): PassageSearchResult['calls'] {
  const answered = given.answered ?? 0;
  const failed = given.failed ?? 0;
  const cancelled = given.cancelled ?? 0;
  const unsent = given.unsent ?? 0;
  const tooLarge = given.tooLarge ?? 0;
  return {
    planned: given.planned ?? answered + failed + cancelled + unsent + tooLarge,
    answered, failed, cut: given.cut ?? 0, cancelled, unsent, tooLarge, dispatched: answered + failed + cancelled
  };
}

/** An organizing pass's checked output in #295's whole shape: nothing dropped, replaced or clipped unless given. */
export function analysisOf(overrides: Partial<PassageSearchAnalysis> & Pick<PassageSearchAnalysis, 'headline' | 'sections' | 'read'>): PassageSearchAnalysis {
  return {
    dropped: { claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 },
    replaced: { headline: false, titles: 0 },
    clipped: 0,
    ...overrides
  };
}

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
    calls: callsOf({ planned: 4, answered: 4 }),
    files: {
      planned: [{ key: 'f1', displayPath: CHAPTER, lines: 'document', instances, chunks: { planned: 4, admitted: 4, answered: 4 }, searched: 'full' }],
      searched: { full: 1, partial: 0, none: 0 },
      leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
    },
    ended: 'complete',
    // Every read went out, and no organizing pass did (#295).
    requests: overrides.calls?.dispatched ?? 4,
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
    calls: callsOf({ answered: files }),
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
  readonly matchPatterns: jest.Mock;
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
          calls: callsOf({ planned: fake.result.calls.planned, answered: 2, cancelled: 1, unsent: 1 }),
          requests: 3,
          files: { ...fake.result.files, searched: { full: 0, partial: 1, none: 0 } }
        }
        : fake.result;
    }),
    listGroupFiles: jest.fn(async () => LISTED),
    // No narrowing here: a narrowed group is settled against the real resolver (WorkshopPassageSearchGroupMatch.test.ts).
    matchPatterns: jest.fn(async () => undefined),
    save: jest.fn(async () => ({ status: 'saved' as const, filePath: 'prose-minion/reports/passage-search-20261120-120000.md', opened: true })),
    finish: () => release?.(),
    progress: (progress) => report?.(progress),
    requests: () => fake.plan.mock.calls.map(([request]) => request as PassageSearchRequest),
    ports: undefined as unknown as WorkshopPassageSearchPorts
  };
  (fake as { ports: WorkshopPassageSearchPorts }).ports = {
    engine: { plan: fake.plan, run: fake.run },
    listing: { listGroupFiles: fake.listGroupFiles, matchPatterns: fake.matchPatterns },
    reports: { save: fake.save }
  };
  return fake;
}
