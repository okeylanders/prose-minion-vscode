/**
 * A Lightbox host for saved-board tests (Slice 5A): the real LightboxHandler,
 * LightboxReadingHandler and LightboxBoardsHandler on one router per tab, as
 * the panel provider composes them, over the real LightboxService,
 * LightboxReadingRunner, LightboxBoardStore and LightboxBoardLibrary.
 *
 * The workspace is a MemoryFileSystem: the chapter and the boards folder both
 * live in it, so a test changes the chapter on disk by writing it. A second
 * session (a reload) is a new host over the same file system and workspace
 * memento. Only the provider engine, the prompt files and the file reads'
 * resolver are stand-ins; a file read (before or after its bytes are read),
 * a press's preparation and an engine reply can be held, so a test can order
 * an open against a source choice, a press or a pushed shelf exactly. No
 * provider is called.
 *
 * The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain), the worked examples' text. Callers mock `p-limit` (ESM) as the
 * other Lightbox run tests do.
 */

import * as path from 'node:path';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { LightboxBoardsHandler } from '@/application/handlers/domain/LightboxBoardsHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxBoardLibrary } from '@/application/services/lightbox/LightboxBoardLibrary';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { LightboxBoardStore, type LightboxBoardMemory } from '@/infrastructure/storage/LightboxBoardStore';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { RejectedModelResponseRecovery } from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  ExtensionToWebviewMessage,
  LightboxBoard,
  LightboxBoardsPayload,
  LightboxLensId,
  LightboxRunEstimate,
  LightboxRunScope,
  LightboxSourceRefusal,
  MessageType
} from '@/shared/types/messages';
import { CHAPTER, groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import { deferred, type Deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

export { CHAPTER };
export const WORKSPACE = '/workspace';
export const CHAPTER_PATH = 'Drafts/alice-1.md';
/** The clock a store saves by: one minute apart from 14:05:09.123 on 2026-10-22. */
export const SAVED_AT = (index: number): number => Date.parse('2026-10-22T14:05:09.123Z') + index * 60_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Let every settled promise and queued file operation run. */
export async function quiet(): Promise<void> {
  for (let round = 0; round < 20; round++) {
    await new Promise((done) => setImmediate(done));
  }
}

/** A workspace memento, shared by the sessions of one test. */
export function boardMemory(): LightboxBoardMemory & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get: <T>(key: string) => values.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
      values.set(key, value);
    }
  };
}

export interface LightboxBoardsHostOptions {
  /** The file system and memento a reload keeps; fresh ones by default. */
  fileSystem?: MemoryFileSystem;
  memory?: ReturnType<typeof boardMemory>;
  /** Workspace folders; one, `/workspace`, by default. */
  folders?: string[];
  /** The engine's reply; the worked examples' by default. */
  respond?: (request: InitialRunRequest) => Promise<ExecutionResult> | ExecutionResult;
  /** When a board is measured; a fixed moment in 2023 by default. */
  now?: () => number;
  /** The store's claim clock (PR #164 F-01): the first save's moment by default, steady, so every claim taken here is live. */
  claimNow?: () => number;
  /** Where a paid reply the runner could not use, or salvaged, is saved (Slice 4H evidence); one that saves nothing by default. */
  recovery?: RejectedModelResponseRecovery;
}

export interface LightboxBoardsTab {
  route: (type: MessageType, payload?: object) => Promise<void>;
  posted: ExtensionToWebviewMessage[];
  /** Boards posted (`LIGHTBOX_BOARD`), in order. */
  boards: () => Array<LightboxBoard | null>;
  refusals: () => LightboxSourceRefusal[];
  /** Shelves posted (`LIGHTBOX_BOARDS`), in order. */
  shelves: () => LightboxBoardsPayload[];
  /** Ask for the shelf, as the rail does, and return the answer. */
  shelf: (boardId: string | null, requestId?: string) => Promise<LightboxBoardsPayload>;
  /** Board a workspace file, as the source panel does. */
  choose: (relativePath: string) => Promise<void>;
  /** Read every lens on the board on screen, as the Read button does. */
  read: () => Promise<void>;
  /** The estimate for the board on screen with every lens on, as the webview asks for it. */
  estimate: () => Promise<LightboxRunEstimate | null | undefined>;
  /** Press one lens on the board on screen at `estimate` (a fresh one by default), as a lens's Read does. */
  press: (lens: LightboxLensId, estimate?: LightboxRunEstimate | null) => Promise<void>;
  /** Press any scope on the board on screen at `estimate` (a fresh one by default): a call's Run or a widget's Analyze (Slice 4I). */
  run: (scope: LightboxRunScope, estimate?: LightboxRunEstimate | null) => Promise<void>;
  dispose: () => void;
}

export function createLightboxBoardsHost(options: LightboxBoardsHostOptions = {}) {
  const fileSystem = options.fileSystem ?? new MemoryFileSystem();
  const memory = options.memory ?? boardMemory();
  const folders = options.folders ?? [WORKSPACE];
  const workspace = createFakeWorkspace({ workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) })) });
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;

  let boardIds = 0;
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { now: options.now ?? (() => 1_700_000_000_000), mintBoardId: () => `board-${++boardIds}` }
  );
  const runInitial = jest.fn(async (request: InitialRunRequest) =>
    (options.respond ?? ((call) => ok(groupOf(call), groupOf(call) === 'F' ? opinionReplyFor(call) : undefined)))(request)
  );
  let tokens = 0;
  const runner = new LightboxReadingRunner(
    { getEngine: () => ({ runInitial }), getResolvedModel: () => 'provider/model-v1' },
    { loadPrompts: async (files: string[]) => `SYSTEM ${files.join(' + ')}` },
    options.recovery ?? { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log,
    {
      catalog: { contextLength: () => 200_000, pricing: () => ({ promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 }) },
      mintToken: () => `run-${++tokens}-token`
    }
  );
  let saves = 0;
  const claimNow = options.claimNow ?? (() => SAVED_AT(0));
  const store = new LightboxBoardStore(fileSystem, workspace, log, {
    memory,
    now: () => new Date(SAVED_AT(saves++)),
    claimNow: () => new Date(claimNow())
  });

  // File reads go to the memory file system; a read can be held, before or after its bytes are read, until the test releases it.
  const held = new Map<string, { gate: Deferred<void>; afterRead: boolean }>();
  const resolve = jest.fn(async ({ pathText }: { pathText: string }) => {
    const hold = held.get(pathText);
    held.delete(pathText);
    if (hold && !hold.afterRead) {
      await hold.gate.promise;
    }
    const text = decoder.decode(await fileSystem.readFile(pathText));
    if (hold?.afterRead) {
      await hold.gate.promise;
    }
    const displayPath = path.posix.relative(WORKSPACE, pathText);
    return { text, relativePaths: [displayPath], displayPath };
  });
  const resolver = { resolve } as unknown as TextSourceResolver;
  const library = new LightboxBoardLibrary({ service, store, runs: runner, textSourceResolver: resolver, workspace, outputChannel: log });

  /** Put a chapter in the workspace (or change it on disk); returns its absolute path. */
  const writeChapter = (relativePath: string, text: string): string => {
    const absolute = path.posix.join(WORKSPACE, relativePath);
    fileSystem.files.set(absolute, encoder.encode(text));
    return absolute;
  };
  /** Hold the next read of a workspace file until `release()`; `afterRead` holds it once it has read the bytes on disk. */
  const holdRead = (relativePath: string, options: { afterRead?: boolean } = {}) => {
    const gate = deferred<void>();
    held.set(path.posix.join(WORKSPACE, relativePath), { gate, afterRead: options.afterRead ?? false });
    return { release: () => gate.resolve() };
  };
  /** Hold the runner's next preparation (its prompt files loading; an estimate prepares too) until `release()`; `reached` settles when it begins. */
  const holdPrepare = () => {
    const gate = deferred<void>();
    const reached = deferred<void>();
    const prepare = runner.prepare.bind(runner);
    const spy = jest.spyOn(runner, 'prepare').mockImplementation(async (...args: Parameters<LightboxReadingRunner['prepare']>) => {
      spy.mockRestore();
      reached.resolve();
      await gate.promise;
      return prepare(...args);
    });
    return { reached: reached.promise, release: () => gate.resolve() };
  };
  /** Hold the store's next read of any file under the boards folder until `release()`. */
  const holdBoardRead = () => {
    const gate = deferred<void>();
    const read = fileSystem.readFile.bind(fileSystem);
    const spy = jest.spyOn(fileSystem, 'readFile').mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('.board.json')) {
        spy.mockRestore();
        await gate.promise;
      }
      return read(filePath);
    });
    return { release: () => gate.resolve() };
  };

  const openTab = (): LightboxBoardsTab => {
    const posted: ExtensionToWebviewMessage[] = [];
    const post = async (message: ExtensionToWebviewMessage) => {
      posted.push(message);
    };
    const projectPorts = { catalog: {} as never, workspace };
    const shelf = new LightboxContextShelf();
    const boards = new LightboxHandler(service, resolver, { pickFile: jest.fn() }, projectPorts, post, log);
    const readings = new LightboxReadingHandler(service, runner, shelf, resolver, { pickFile: jest.fn() }, projectPorts, post, log, library);
    const saved = new LightboxBoardsHandler(library, post, log);
    const router = new MessageRouter();
    boards.registerRoutes(router);
    readings.registerRoutes(router);
    saved.registerRoutes(router);
    const route = async (type: MessageType, payload: object = {}) =>
      router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
    const ofType = <T extends MessageType>(type: T) =>
      posted.filter((message) => message.type === type) as Array<Extract<ExtensionToWebviewMessage, { type: T }>>;
    let requests = 0;
    const estimateNow = async () => {
      const requestId = `estimate-${++requests}`;
      await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId });
      return ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).map((message) => message.payload).reverse()
        .find((payload) => payload.requestId === requestId)?.estimate;
    };
    return {
      route,
      posted,
      boards: () => ofType(MessageType.LIGHTBOX_BOARD).map((message) => message.payload.board),
      refusals: () => ofType(MessageType.LIGHTBOX_SOURCE_REFUSED).map((message) => message.payload.refusal),
      shelves: () => ofType(MessageType.LIGHTBOX_BOARDS).map((message) => message.payload),
      shelf: async (boardId, requestId = `shelf-${++requests}`) => {
        await route(MessageType.LIGHTBOX_REQUEST_BOARDS, { requestId, boardId });
        const answer = ofType(MessageType.LIGHTBOX_BOARDS).map((message) => message.payload).reverse().find((payload) => payload.requestId === requestId);
        if (!answer) {
          throw new Error(`no answer to ${requestId}`);
        }
        return answer;
      },
      choose: async (relativePath) => {
        await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file://${path.posix.join(WORKSPACE, relativePath)}`, relativePath });
      },
      read: async () => {
        const estimate = await estimateNow();
        await route(MessageType.LIGHTBOX_RUN, {
          boardId: service.currentBoard()?.boardId, scope: { mode: 'all' }, estimateKey: estimate?.key, model: estimate?.model
        });
      },
      estimate: () => estimateNow(),
      press: async (lens, given) => {
        const estimate = given === undefined ? await estimateNow() : given;
        await route(MessageType.LIGHTBOX_RUN, {
          boardId: service.currentBoard()?.boardId, scope: { mode: 'lens', lens }, estimateKey: estimate?.key, model: estimate?.model
        });
      },
      run: async (scope, given) => {
        const estimate = given === undefined ? await estimateNow() : given;
        await route(MessageType.LIGHTBOX_RUN, {
          boardId: service.currentBoard()?.boardId, scope, estimateKey: estimate?.key, model: estimate?.model
        });
      },
      dispose: () => {
        boards.dispose();
        readings.dispose();
        saved.dispose();
      }
    };
  };

  /** The saved files, by file id (`<source-slug>-<source-hash>/<name>`), sorted. */
  const savedFiles = (): string[] => [...fileSystem.files.keys()]
    .filter((file) => file.startsWith(path.posix.join(WORKSPACE, 'prose-minion', 'boards')) && file.endsWith('.board.json'))
    .map((file) => path.posix.relative(path.posix.join(WORKSPACE, 'prose-minion', 'boards'), file))
    .sort();

  return {
    fileSystem,
    memory,
    service,
    runner,
    runInitial,
    store,
    library,
    resolve,
    lines,
    logged: () => lines.join('\n'),
    writeChapter,
    holdRead,
    holdPrepare,
    holdBoardRead,
    openTab,
    savedFiles
  };
}
