/**
 * A Lightbox reading host for handler tests: the real LightboxReadingHandler,
 * LightboxService (over the real measurement services), LightboxReadingRunner
 * and LightboxContextShelf. Only the provider engine, the prompt files, the
 * file picker and the context file reads are stand-ins. The prompt files can
 * be held open, the assistant model and its prices switched, and a second tab
 * opened over the same shared services, so a test can order a press's
 * preparation against a close, a reopen or an input change exactly. No
 * provider is called.
 *
 * The project picker's catalog is the real WorkshopContextIntakeService over
 * a stand-in context-path provider (2026-10-20): `addProjectFile` lists a
 * file and gives the reads its text, so context can be added by catalog key.
 *
 * The writer's average (Slice 4B) is the real LightboxWriterBaseline over
 * that catalog: `writerChapters` lists files in the `chapters` group before
 * the board is built, and the baseline reads them through a seeded file
 * system. With none, the board measures no average of the writer's own.
 *
 * Callers mock `p-limit` (ESM) as the other Lightbox tests do.
 */

import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { LightboxWriterBaseline } from '@/infrastructure/lightbox/LightboxWriterBaseline';
import type { LightboxModelPricing } from '@/infrastructure/lightbox/LightboxRunEstimate';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  ExtensionToWebviewMessage,
  LightboxLensId,
  LightboxReadingGroupId,
  LightboxRunScope,
  MessageType
} from '@/shared/types/messages';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { LIGHTBOX_LENSES, LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ContextPathGroup } from '@/shared/types/context';

export const examples = Object.fromEntries(
  LIGHTBOX_READING_GROUPS.map((group) => [group, readWorkedExample(group)])
) as Record<LightboxReadingGroupId, ReturnType<typeof readWorkedExample>>;
export const CHAPTER = examples.A.paragraphs.join('\n\n');
export const CONTEXT_TEXT = 'Notes for the reader: the White Rabbit is a royal herald who fears the Queen.';
/** Every lens on the rail, from the one list (Slice 3 adds gravity and palette). */
export const ALL_LENSES_OFF: LightboxLensId[] = LIGHTBOX_LENSES.map((lens) => lens.id);

export const ok = (group: LightboxReadingGroupId, raw = examples[group].response): ExecutionResult => ({
  content: 'visible',
  rawContent: raw,
  usedGuides: [],
  requestedResources: [],
  artifacts: [],
  usage: { promptTokens: 1_000, completionTokens: 200, totalTokens: 1_200, costUsd: 0.01 },
  finishReason: 'stop',
  modelId: 'provider/model-v1'
});

export const groupOf = (request: InitialRunRequest) => request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId;

/** Let every settled promise run its continuations. */
export const settle = async (): Promise<void> => {
  for (let round = 0; round < 5; round++) {
    await new Promise((done) => setImmediate(done));
  }
};

export interface LightboxReadingHostOptions {
  respond?: (request: InitialRunRequest) => Promise<ExecutionResult> | ExecutionResult;
  engine?: boolean;
  contextLength?: number;
  /** The board's text; the worked examples' chapter by default. */
  text?: string;
  /** The writer's other chapters, by path under `/workspace/`, read for the writer's average (Slice 4B). */
  writerChapters?: Record<string, string>;
}

/** One webview tab: its own handler, router, transport and log, over the host's shared services. */
export interface LightboxReadingTab {
  handler: LightboxReadingHandler;
  router: MessageRouter;
  route: (type: MessageType, payload?: object) => Promise<void>;
  posted: ExtensionToWebviewMessage[];
  ofType: <T extends MessageType>(type: T) => Array<Extract<ExtensionToWebviewMessage, { type: T }>>;
  logged: () => string;
  /** Send the lens toggles (remembered for later presses) and return the estimate's key. */
  setLenses: (lensesOff?: LightboxLensId[], requestId?: string) => Promise<string | undefined>;
  /**
   * Press Read as the webview does: naming the key and the model of a fresh
   * estimate for this tab's lenses (or of `estimateKey` and `model`).
   */
  run: (scope?: LightboxRunScope, options?: { boardId?: string; estimateKey?: string; model?: string }) => Promise<void>;
}

export async function createLightboxReadingHost(options: LightboxReadingHostOptions = {}) {
  let boardIds = 0;
  const runInitial = jest.fn(async (request: InitialRunRequest) =>
    (options.respond ?? ((call) => ok(groupOf(call))))(request)
  );

  // The prompt files: answered at once, or held until `releasePrompts()`.
  let promptGate: Promise<void> | undefined;
  let openGate: (() => void) | undefined;
  const loadPrompts = jest.fn(async (files: string[]) => {
    if (promptGate) {
      await promptGate;
    }
    return `SYSTEM ${files.join(' + ')}`;
  });
  const holdPrompts = (): void => {
    promptGate = new Promise((done) => { openGate = done; });
  };
  const releasePrompts = (): void => {
    openGate?.();
    promptGate = undefined;
  };

  // The assistant model and its live prices, switchable mid-test.
  let model = 'provider/model-v1';
  let pricing: LightboxModelPricing = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  let tokens = 0;
  const runner = new LightboxReadingRunner(
    { getEngine: () => (options.engine === false ? undefined : { runInitial }), getResolvedModel: () => model },
    { loadPrompts },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log,
    {
      catalog: { contextLength: () => options.contextLength ?? 200_000, pricing: () => pricing },
      mintToken: () => `run-${++tokens}-token`
    }
  );
  let shelved = 0;
  const shelf = new LightboxContextShelf({ mintId: () => `ctx-${++shelved}` });
  // A file's text: a project file's own, or the context note for any other path.
  const texts = new Map<string, string | Error>();
  const resolve = jest.fn(async ({ pathText }: { pathText: string }) => {
    const text = texts.get(pathText) ?? CONTEXT_TEXT;
    if (text instanceof Error) {
      throw text;
    }
    return { text, relativePaths: [pathText.replace('/workspace/', '')], displayPath: pathText.replace('/workspace/', '') };
  });
  const projectFiles: ContextResourceSummary[] = [];
  const catalog = new WorkshopContextIntakeService(
    {
      createProvider: async () => {
        const listed = [...projectFiles];
        return {
          listResources: () => listed,
          loadResources: async (paths: string[]) => listed
            .filter((summary) => paths.includes(summary.path))
            .map((summary) => ({ ...summary, content: String(texts.get(summary.absolutePath) ?? CONTEXT_TEXT) }))
        };
      }
    },
    createFakeFileSystem(),
    createFakeWorkspace()
  );
  /** List a project file (text, or a read failure); `absolutePath` places it elsewhere. Returns its absolute path. */
  const addProjectFile = (
    group: ContextPathGroup,
    relativePath: string,
    text: string | Error = CONTEXT_TEXT,
    absolutePath = `/workspace/${relativePath}`
  ): string => {
    texts.set(absolutePath, text);
    projectFiles.push({
      group,
      path: relativePath,
      label: relativePath,
      sizeBytes: typeof text === 'string' ? Buffer.byteLength(text) : 1_000,
      absolutePath,
      workspaceFolder: 'workspace'
    });
    return absolutePath;
  };
  const pickFile = jest.fn(async () => ({ fsPath: '/workspace/Notes/cast.md', uri: 'file:///workspace/Notes/cast.md' }));

  // The writer's other chapters, listed in the catalog and readable by the real baseline.
  const chapterFiles: Record<string, string> = {};
  for (const [relativePath, text] of Object.entries(options.writerChapters ?? {})) {
    chapterFiles[addProjectFile('chapters', relativePath, text)] = text;
  }
  const writerBaseline = new LightboxWriterBaseline({
    catalog,
    fileSystem: createFakeFileSystem({}, chapterFiles),
    outputChannel: log
  });
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => `board-${++boardIds}` },
    writerBaseline
  );

  const openTab = (): LightboxReadingTab => {
    const posted: ExtensionToWebviewMessage[] = [];
    const tabLog = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const handler = new LightboxReadingHandler(
      service,
      runner,
      shelf,
      { resolve } as unknown as TextSourceResolver,
      { pickFile },
      { catalog, workspace: { workspaceFolders: () => [{ path: '/workspace', name: 'workspace' }] } },
      async (message: ExtensionToWebviewMessage) => {
        posted.push(message);
      },
      tabLog
    );
    const router = new MessageRouter();
    handler.registerRoutes(router);
    const route = async (type: MessageType, payload: object = {}) =>
      router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
    const ofType = <T extends MessageType>(type: T) =>
      posted.filter((message) => message.type === type) as Array<Extract<ExtensionToWebviewMessage, { type: T }>>;
    let lensesOff: LightboxLensId[] = [];
    const setLenses = async (next: LightboxLensId[] = lensesOff, requestId?: string) => {
      lensesOff = next;
      await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: next, ...(requestId ? { requestId } : {}) });
      return ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate?.key;
    };
    const run = async (
      scope: LightboxRunScope = { mode: 'all' },
      press: { boardId?: string; estimateKey?: string; model?: string } = {}
    ) => {
      const estimateKey = press.estimateKey ?? await setLenses();
      // The webview names the model its estimate priced (the selected, confirmed one).
      const priced = ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).map((message) => message.payload.estimate)
        .reverse().find((estimate) => estimate?.key === estimateKey);
      await route(MessageType.LIGHTBOX_RUN, {
        boardId: press.boardId ?? board.boardId, scope, estimateKey, model: press.model ?? priced?.model ?? model
      });
    };
    return {
      handler,
      router,
      route,
      posted,
      ofType,
      logged: () => [...log.appendLine.mock.calls, ...tabLog.appendLine.mock.calls].map(([line]) => String(line)).join('\n'),
      setLenses,
      run
    };
  };

  const built = await service.buildBoard({
    kind: 'file',
    text: options.text ?? CHAPTER,
    displayPath: 'Drafts/alice-1.md',
    rereadPath: '/workspace/Drafts/alice-1.md'
  });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  const board = built.board;

  return {
    service,
    runner,
    shelf,
    runInitial,
    loadPrompts,
    holdPrompts,
    releasePrompts,
    pickFile,
    resolve,
    catalog,
    addProjectFile,
    board,
    openTab,
    setModel: (next: string) => { model = next; },
    setPricing: (next: LightboxModelPricing) => { pricing = next; }
  };
}
