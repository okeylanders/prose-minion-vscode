/**
 * A fake Passage Search engine and *Alice*-style results for the sidebar
 * route's tests. No model, no file, no network.
 */

import { PassageSearchRoute } from '@/application/handlers/domain/PassageSearchRoute';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import {
  ExtensionToWebviewMessage,
  MessageType,
  PassageSearchPlanPayload,
  PassageSearchResultPayload
} from '@messages';
import type { LogSink } from '@/platform';
import type { PassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import type {
  PassageSearchPlan,
  PassageSearchPlanOutcome,
  PassageSearchResult,
  PassageSearchRunOptions
} from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganizePlan, PassageSearchOrganizePlanOutcome } from '@services/search/passage/PassageSearchOrganizer';
import type { PassageSearchRequest } from '@/application/services/passageSearch/PassageSearchRequest';

export const ALICE_ABSOLUTE = '/home/dodgson/novel/chapters/alice-ch1.md';
export const ALICE_QUESTION = 'Find every time the White Rabbit checks his watch.';
export const ALICE_QUOTE = 'took a watch out of its waistcoat-pocket';
export const ALICE_NOTE = 'The Rabbit consults the watch and hurries on.';
export const ALICE_LABEL = 'Watch checked';

export function alicePlan(overrides: Partial<PassageSearchPlan['estimate']> = {}): PassageSearchPlan {
  return {
    planKey: 'key-1',
    model: 'test/reader',
    question: ALICE_QUESTION,
    organize: true,
    systemMessage: 'system',
    chunkWords: 12000,
    ceilings: { readOutputTokens: 12000, organizeOutputTokens: 4000 },
    files: [],
    chunks: [],
    estimate: {
      model: 'test/reader',
      files: 3,
      calls: 4,
      inputTokens: 9000,
      outputTokens: 3200,
      usd: 0.42,
      reads: { calls: 3, inputTokens: 3000, outputTokens: 2400 },
      organize: { inputTokens: 6000, outputTokens: 800 },
      leftOut: { unreadable: 0, unsplittable: 1, empty: 0 },
      ...overrides
    }
  };
}

const WHOLE = { planned: 1, admitted: 1, answered: 1 };

export function aliceResult(overrides: Partial<PassageSearchResult> = {}): PassageSearchResult {
  return {
    question: ALICE_QUESTION,
    model: 'test/reader',
    instances: [
      {
        number: 1,
        file: 'f1',
        displayPath: 'chapters/alice-ch1.md',
        line: 12,
        start: 100,
        end: 140,
        quote: ALICE_QUOTE,
        before: 'when the Rabbit actually ',
        after: ', and looked at it',
        note: ALICE_NOTE,
        label: 'watch checked'
      },
      {
        number: 2,
        file: 'f2',
        displayPath: 'Selected text',
        line: 3,
        start: 10,
        end: 30,
        quote: 'Oh dear! Oh dear! I shall be late!',
        before: '',
        after: '',
        note: 'Said while hurrying.',
        label: 'watch checked'
      }
    ],
    labels: [{ key: 'watch checked', label: ALICE_LABEL, count: 2, files: 2 }],
    dropped: { 'quote-not-found': 1, 'quote-ambiguous': 0, malformed: 0, duplicate: 2 },
    overLimit: 0,
    calls: { planned: 3, answered: 3, failed: 0, cut: 0, cancelled: 0, unsent: 0 },
    files: {
      planned: [
        { key: 'f1', displayPath: 'chapters/alice-ch1.md', absolutePath: ALICE_ABSOLUTE, lines: 'document', instances: 1, chunks: WHOLE, searched: 'full' },
        { key: 'f2', displayPath: 'Selected text', lines: 'text', instances: 1, chunks: WHOLE, searched: 'full' },
        { key: 'f3', displayPath: 'chapters/alice-ch2.md', absolutePath: '/home/dodgson/novel/chapters/alice-ch2.md', lines: 'document', instances: 0, chunks: WHOLE, searched: 'full' }
      ],
      searched: { full: 3, partial: 0, none: 0 },
      leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
    },
    ended: 'complete',
    ...overrides
  };
}

export const ORGANIZE_PLAN: PassageSearchOrganizePlan = {
  planKey: 'organize-key',
  model: 'test/reader',
  estimate: { model: 'test/reader', calls: 1, inputTokens: 900, outputTokens: 1200, usd: 0.03 },
  instances: { read: 2, of: 2 },
  systemMessage: 'SYSTEM',
  userMessage: 'USER',
  shown: [1, 2],
  ceilings: { organizeOutputTokens: 4000 }
};

/** A promise a test settles by hand, to hold a call open. */
export function held<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface FakePassageSearchEngine extends PassageSearchEngine {
  plan: jest.Mock<Promise<PassageSearchPlanOutcome>, [PassageSearchRequest]>;
  run: jest.Mock<Promise<PassageSearchResult>, [PassageSearchPlan, PassageSearchRunOptions?]>;
  planOrganize: jest.Mock<Promise<PassageSearchOrganizePlanOutcome>, [PassageSearchResult]>;
  organize: jest.Mock<Promise<PassageSearchResult>, [PassageSearchResult, PassageSearchOrganizePlan, Pick<PassageSearchRunOptions, 'signal'>?]>;
  organizerAvailable: jest.Mock<boolean, []>;
}

/** Plans the *Alice* plan, runs to the *Alice* result, and has no organizer unless a test gives it one. */
export function fakePassageSearchEngine(): FakePassageSearchEngine {
  const unavailable: PassageSearchOrganizePlanOutcome = { kind: 'unavailable', message: 'Organizing the results is not available yet.' };
  return {
    plan: jest.fn<Promise<PassageSearchPlanOutcome>, [PassageSearchRequest]>(async () => ({ kind: 'planned', plan: alicePlan() })),
    run: jest.fn<Promise<PassageSearchResult>, [PassageSearchPlan, PassageSearchRunOptions?]>(async () => aliceResult()),
    organizerAvailable: jest.fn<boolean, []>(() => false),
    planOrganize: jest.fn<Promise<PassageSearchOrganizePlanOutcome>, [PassageSearchResult]>(async () => unavailable),
    organize: jest.fn<Promise<PassageSearchResult>, [PassageSearchResult, PassageSearchOrganizePlan, Pick<PassageSearchRunOptions, 'signal'>?]>(async (result) => result)
  };
}

export const PATTERN = 'drafts/looking-glass/*.md';
export const SCOPES = { activeFile: true, selection: false, groups: ['chapters'], pattern: PATTERN };

/** A route over the fake engine, with what a test sends to it and reads back from it. */
export function passageSearchRouteHost() {
  const postMessage = jest.fn().mockResolvedValue(undefined);
  const openFileInEditor = jest.fn().mockResolvedValue(undefined);
  const copyToClipboard = jest.fn().mockResolvedValue(undefined);
  const createDirectory = jest.fn().mockResolvedValue(undefined);
  const writeFile = jest.fn().mockResolvedValue(undefined);
  const workspaceFolders = jest.fn(() => [{ path: '/home/dodgson/novel', name: 'novel', uriString: 'file:///home/dodgson/novel' }]);
  const appendLine = jest.fn();
  const log = { appendLine, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
  const engine = fakePassageSearchEngine();
  const router = new MessageRouter();
  const route = new PassageSearchRoute({
    engine,
    shell: { openFileInEditor, copyToClipboard },
    fileSystem: { createDirectory, writeFile },
    workspace: { workspaceFolders },
    now: () => new Date(2026, 10, 21, 9, 5, 7)
  }, postMessage, log);
  route.registerRoutes(router);

  const send = (type: MessageType, payload: unknown): Promise<void> =>
    router.route({ type, source: 'webview.search.passage', payload, timestamp: 1 } as never);
  const posted = <T>(type: MessageType): T[] =>
    postMessage.mock.calls.map(([message]) => message as ExtensionToWebviewMessage)
      .filter((message) => message.type === type)
      .map((message) => message.payload as T);
  const plans = () => posted<PassageSearchPlanPayload>(MessageType.PASSAGE_SEARCH_PLAN);
  const results = () => posted<PassageSearchResultPayload>(MessageType.PASSAGE_SEARCH_RESULT);
  const logs = (): string => appendLine.mock.calls.flat().join('\n');
  const planRequest = (requestId: string, overrides: Record<string, unknown> = {}) =>
    send(MessageType.PASSAGE_SEARCH_PLAN_REQUEST, { requestId, question: ALICE_QUESTION, scopes: SCOPES, organize: true, ...overrides });

  /** Plan and return the held plan's id. */
  const planned = async (requestId = 'plan-1'): Promise<string> => {
    await planRequest(requestId);
    const answer = plans().find((plan) => plan.requestId === requestId);
    if (answer?.status !== 'planned') {
      throw new Error('expected a plan');
    }
    return answer.planId;
  };

  /** Plan, run to the end, and return the held result's id. */
  const finished = async (result?: PassageSearchResult): Promise<string> => {
    if (result) {
      engine.run.mockResolvedValueOnce(result);
    }
    await send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-1', planId: await planned() });
    const answer = results().find((found) => found.requestId === 'run-1');
    if (answer?.status !== 'finished') {
      throw new Error('expected a result');
    }
    return answer.result.resultId;
  };

  return { router, route, engine, postMessage, openFileInEditor, copyToClipboard, createDirectory, writeFile, workspaceFolders, send, posted, plans, results, logs, planRequest, planned, finished };
}

export type PassageSearchRouteHost = ReturnType<typeof passageSearchRouteHost>;
