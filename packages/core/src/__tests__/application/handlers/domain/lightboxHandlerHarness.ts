/**
 * A Lightbox host for handler tests: the real LightboxHandler and
 * LightboxService over the real measurement services. Only file I/O (the
 * resolver), the picker and the standards enrichment are stand-ins, and each
 * can be held open, so a test can order reads, builds and failures exactly.
 *
 * Each `openPanel()` is one webview: its own handler, router, transport and
 * log, all over the one shared service, as the panel provider builds them.
 */

import * as path from 'node:path';
import {
  LightboxHandler,
  type LightboxWorkshopHandoffPort,
  type LightboxWorkshopPorts
} from '@/application/handlers/domain/LightboxHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { PickedFile } from '@/platform';
import { ExtensionToWebviewMessage, LightboxBoard, LightboxSourceRefusal, MessageType } from '@/shared/types/messages';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';

export const WORKSPACE = '/workspace';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every settled promise run its continuations. */
export async function settle(): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** What a file read returns: its text, a read still in flight, or a failure. */
export type LightboxFileEntry = string | Deferred<string> | Error;

export interface LightboxPanel {
  handler: LightboxHandler;
  route: (type: MessageType, payload?: object) => Promise<void>;
  posted: ExtensionToWebviewMessage[];
  /** Board messages' display paths (`null` for an empty answer), in order. */
  boardPaths: () => Array<string | null>;
  /** Refusals posted live, in order. */
  refusals: () => LightboxSourceRefusal[];
  logged: () => string;
  dispose: () => void;
}

export function createLightboxHost(options: { enrich?: jest.Mock } = {}) {
  const enrich = options.enrich ?? jest.fn(async (stats: object) => stats);
  let id = 0;
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    // Board options are fixed, so the settings-backed provider is never read.
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: enrich },
    { now: () => 1_700_000_000_000, mintBoardId: () => `board-${++id}` }
  );

  const files = new Map<string, LightboxFileEntry>();
  const resolve = jest.fn(async ({ pathText }: { pathText: string }) => {
    const entry = files.get(pathText);
    if (entry === undefined) {
      throw new Error(`Active file not found. ${pathText}`);
    }
    if (entry instanceof Error) {
      throw entry;
    }
    const text = typeof entry === 'string' ? entry : await entry.promise;
    const displayPath = path.posix.relative(WORKSPACE, pathText);
    return { text, relativePaths: [displayPath], displayPath };
  });
  const pickFile = jest.fn<Promise<PickedFile | undefined>, []>().mockResolvedValue(undefined);

  /** Register a workspace file; returns its absolute path. */
  const addFile = (relativePath: string, entry: LightboxFileEntry): string => {
    const absolute = path.posix.join(WORKSPACE, relativePath);
    files.set(absolute, entry);
    return absolute;
  };

  const openPanel = (
    options: { handOff?: LightboxWorkshopHandoffPort; workshop?: LightboxWorkshopPorts } = {}
  ): LightboxPanel => {
    const posted: ExtensionToWebviewMessage[] = [];
    const log = { appendLine: jest.fn() };
    const handler = new LightboxHandler(
      service,
      { resolve } as unknown as TextSourceResolver,
      { pickFile },
      async (message: ExtensionToWebviewMessage) => {
        posted.push(message);
      },
      log as never,
      options.handOff,
      options.workshop
    );
    const router = new MessageRouter();
    handler.registerRoutes(router);
    const route = async (type: MessageType, payload: object = {}) =>
      router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
    const boards = () => posted.flatMap((message) =>
      message.type === MessageType.LIGHTBOX_BOARD ? [(message.payload as { board: LightboxBoard | null }).board] : []
    );
    return {
      handler,
      route,
      posted,
      boardPaths: () => boards().map((board) => board?.source.displayPath ?? null),
      refusals: () => posted.flatMap((message) =>
        message.type === MessageType.LIGHTBOX_SOURCE_REFUSED
          ? [(message.payload as { refusal: LightboxSourceRefusal }).refusal]
          : []
      ),
      logged: () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n'),
      dispose: () => handler.dispose()
    };
  };

  /** A `LIGHTBOX_SET_SOURCE` payload for a saved workspace file. */
  const fileSource = (relativePath: string) => ({
    sourceUri: `file://${path.posix.join(WORKSPACE, relativePath)}`,
    relativePath
  });

  return { service, enrich, files, resolve, pickFile, addFile, fileSource, openPanel };
}
