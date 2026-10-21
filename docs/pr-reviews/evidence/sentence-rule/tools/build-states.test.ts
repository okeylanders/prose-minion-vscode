/**
 * Builds the host messages the sentence-rule capture replays (../states/),
 * through the production LightboxService, LightboxHandler,
 * LightboxReadingHandler (for its estimate only: nothing is read) and
 * LightboxPassageHandler, over the real measurement services, adapted from
 * ../../lightbox-slice-4e-visual/tools/build-passages.test.ts. No model is
 * called and no provider is reached: the runner's engine is never asked.
 *
 * The source is the opening of Chapter VII, "A Mad Tea-Party", of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865), public domain, in
 * curly double quotes: `TEA_PARTY_CURLY` from the test fixtures.
 *
 * Not part of the test suite. Run it once on each rule:
 * copy it to packages/core/src/__tests__/ and run
 * `SENTENCE_RULE_EVIDENCE_OUT=$DIR/states/<before|after>.json npx jest packages/core/src/__tests__/build-states.test.ts`.
 * Delete the copy after.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { LightboxPassageHandler } from '@/application/handlers/domain/LightboxPassageHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { PromptLoader } from '@/tools/shared/prompts';
import { FileType } from '@/platform';
import { MessageType, type ExtensionToWebviewMessage, type LightboxBoard, type LightboxPassageItem } from '@messages';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { TEA_PARTY_CURLY } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

const OUT = process.env.SENTENCE_RULE_EVIDENCE_OUT || '/tmp/sentence-rule/states/after.json';
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const CHAPTER_PATH = 'Drafts/alice-tea-party.md';
const NOW = Date.UTC(2026, 9, 21, 18, 0);
/** The short dialogue paragraph the capture pins: one line of speech in two quotations. */
const PINNED = 8;

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await new Promise((done) => setImmediate(done));
  }
};

it('dumps the Tea-Party board, its estimate and ¶8\'s passage', async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  const files = new Map<string, string>([[`/workspace/${CHAPTER_PATH}`, TEA_PARTY_CURLY]]);
  const nodeFs = createFakeFileSystem({
    readFile: async (p: string) => new Uint8Array(fs.readFileSync(p)),
    stat: async (p: string) => ({ type: FileType.File, size: fs.statSync(p).size, ctime: 0, mtime: 0 })
  } as never);
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { now: () => NOW, mintBoardId: () => 'board-tea-party-1' }
  );
  const logged: string[] = [];
  const log = { appendLine: (line: string) => { logged.push(line); }, show: () => undefined, clear: () => undefined };
  const engine = { runInitial: async () => { throw new Error('No reading is run for this evidence.'); } };
  const runner = new LightboxReadingRunner(
    { getEngine: () => engine as never, getResolvedModel: () => MODEL },
    new PromptLoader(EXTENSION_PATH, nodeFs),
    { capture: async () => undefined } as never,
    { present: async () => undefined } as never,
    log,
    { catalog: { contextLength: () => 200_000, pricing: () => PRICING }, mintToken: () => 'run-evidence' }
  );
  const resolver = {
    resolve: async ({ pathText }: { pathText: string }) => {
      const text = files.get(pathText);
      if (text === undefined) {
        throw new Error('not found');
      }
      const relative = path.posix.relative('/workspace', pathText);
      return { text, relativePaths: [relative], displayPath: relative };
    }
  } as unknown as TextSourceResolver;
  const projectFiles = {
    catalog: { openCatalog: async () => ({ entries: () => [] }) },
    workspace: { workspaceFolders: () => [{ path: '/workspace', name: 'workspace' }] }
  } as never;

  const posted: ExtensionToWebviewMessage[] = [];
  const transport = async (message: ExtensionToWebviewMessage) => { posted.push(message); };
  const router = new MessageRouter();
  new LightboxHandler(service, resolver, { pickFile: async () => undefined }, projectFiles, transport, log).registerRoutes(router);
  new LightboxReadingHandler(
    service, runner, new LightboxContextShelf({ mintId: () => 'ctx-none' }), resolver, { pickFile: async () => undefined },
    projectFiles, transport, log
  ).registerRoutes(router);
  new LightboxPassageHandler(service, transport, log).registerRoutes(router);
  const route = async (type: MessageType, payload: object = {}) => {
    await router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
    await settle();
  };
  const last = (type: MessageType) => [...posted].reverse().find((message) => message.type === type);

  await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file:///workspace/${CHAPTER_PATH}`, relativePath: CHAPTER_PATH });
  const boardMessage = last(MessageType.LIGHTBOX_BOARD);
  const board = boardMessage && (boardMessage.payload as { board: LightboxBoard | null }).board;
  if (!boardMessage || !board) {
    throw new Error('the Tea-Party was not boarded');
  }

  await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: 'evidence-1' });
  const estimate = last(MessageType.LIGHTBOX_RUN_ESTIMATE)?.payload as { requestId: string; estimate?: { boardId: string } } | undefined;
  if (!estimate?.estimate || estimate.estimate.boardId !== board.boardId) {
    throw new Error('no estimate for the board');
  }
  const { requestId: _estimateRequest, ...estimateAnswer } = estimate;

  const item: LightboxPassageItem = { kind: 'paragraphs', from: PINNED, to: PINNED };
  await route(MessageType.LIGHTBOX_REQUEST_PASSAGE, {
    requestId: 'evidence-2', boardId: board.boardId, contentHash: board.source.contentHash, item
  });
  const reply = last(MessageType.LIGHTBOX_PASSAGE)?.payload as { requestId: string; passage: { kind: string } } | undefined;
  if (!reply || reply.passage.kind === 'refused') {
    throw new Error('no passage for ¶8');
  }
  const { requestId: _passageRequest, ...passageAnswer } = reply;

  fs.writeFileSync(OUT, `${JSON.stringify({
    idle: [{ ...boardMessage, timestamp: 1 }],
    estimates: [estimateAnswer],
    passages: { [`${board.boardId} ${canonical(item)}`]: passageAnswer },
    items: { pinnedParagraph: PINNED }
  })}\n`);
  clock.mockRestore();

  // No log line carries the chapter's words; its file name may ("party" of alice-tea-party.md).
  const named = new Set(CHAPTER_PATH.toLowerCase().match(/[a-z]+/g));
  const words = new Set(TEA_PARTY_CURLY.toLowerCase().match(/[a-z]{6,}/g));
  expect(logged.flatMap((line) => line.toLowerCase().match(/[a-z]{6,}/g) ?? []).filter((word) => words.has(word) && !named.has(word))).toEqual([]);
});
