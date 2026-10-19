/**
 * Builds the host messages the Slice 2B visual harness replays (../states/),
 * through the production LightboxService, LightboxReadingHandler,
 * LightboxReadingRunner, codec, quote verifier and context shelf. Only the
 * provider is played: its replies are the prompt bundle's worked examples
 * (groups B and C verbatim; group A as described in ../README.md). No
 * provider is called.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-readings.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR (default /tmp/lightbox-2b) holding
 * fixtures/alice-chapter-<1..12>.md (from ../../lightbox-slice-2a-visual/tools/alice_chapter.py).
 * Delete the copy after. Writes states/chapter.json (the chapter's idle,
 * running and done messages, each state adding to the one before) and
 * states/book.json (the whole book against a 32,768-token window) there.
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
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import { StandardsService } from '@services/resources/StandardsService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { PromptLoader } from '@/tools/shared/prompts';
import { FileType } from '@/platform';
import { MessageType, type ExtensionToWebviewMessage, type LightboxReadingGroupId } from '@messages';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { frame, framedJson, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-2b';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const CONTEXT_NOTE = [
  'Cast notes, for the reader only.',
  'Alice: about seven; curious, talkative, quick to scold herself.',
  'Dinah: her cat, left at home.',
  'The White Rabbit: always late, always in a hurry.'
].join('\n');

/**
 * Group A for the whole chapter. The worked example reads ¶1–¶8 of this same
 * chapter, so its headline and motifs stand; its tension arc scores eight
 * columns, so ¶9–¶31 are scored here by hand, with a third peak. One motif
 * quote is paraphrased on purpose, so the verifier has one to withhold.
 */
function groupAForTheChapter(): string {
  const body = framedJson(readWorkedExample('A').response) as Record<string, any>;
  body.tension.scores = [
    0, 1, 3, 6, 7, 8, 3, 2, // ¶1–¶8, as the worked example reads them
    2, 2, 3, 6, 5, 4, 5, 3, 4, 5, 0, 0, 0, 4, 5, 7, 5, 3, 4, 2, 0, 0, 0
  ];
  body.tension.claim = 'Tension climbs to the drop in ¶6, idles through the long fall, '
    + 'rises again as the Rabbit vanishes and the doors stay locked, and peaks in ¶24, '
    + 'when the key is out of reach; the scene breaks score nothing.';
  body.tension.peaks.push({ para: 24, quote: 'she found she had forgotten the little golden key', note: 'The key out of reach.' });
  body.motifs.items[0].evidence[1].quote = 'and then it dropped straight down';
  return frame('A', body);
}

const replies: Record<LightboxReadingGroupId, string> = {
  A: groupAForTheChapter(),
  B: readWorkedExample('B').response,
  C: readWorkedExample('C').response
};

function reply(raw: string): ExecutionResult {
  return {
    content: '',
    rawContent: raw,
    usedGuides: [],
    requestedResources: [],
    artifacts: [],
    finishReason: 'stop',
    modelId: MODEL
  };
}

interface EvidenceSource {
  text: string;
  displayPath: string;
}

const chapterText = (number: number) => fs.readFileSync(`${DIR}/fixtures/alice-chapter-${number}.md`, 'utf8');

async function harness(contextLength: number, source: EvidenceSource) {
  const nodeFs = createFakeFileSystem({
    readFile: async (p: string) => new Uint8Array(fs.readFileSync(p)),
    stat: async (p: string) => ({ type: FileType.File, size: fs.statSync(p).size, ctime: 0, mtime: 0 })
  } as never);
  const settings = createFakeSettings({ 'publishingStandards.preset': 'genre:mg', 'publishingStandards.pageSizeKey': '' });
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    new StandardsService(EXTENSION_PATH, nodeFs, settings),
    { now: () => Date.UTC(2026, 9, 19, 15, 42), mintBoardId: () => 'board-alice' }
  );
  const pending = new Map<LightboxReadingGroupId, { request: InitialRunRequest; settle: (result: ExecutionResult) => void }>();
  const engine = {
    runInitial: (request: InitialRunRequest) => new Promise<ExecutionResult>((settle) => {
      const group = request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId;
      pending.set(group, { request, settle });
    })
  };
  let tokens = 0;
  const log = { appendLine: () => undefined, show: () => undefined, clear: () => undefined };
  const runner = new LightboxReadingRunner(
    { getEngine: () => engine, getResolvedModel: () => MODEL },
    new PromptLoader(EXTENSION_PATH, nodeFs),
    { capture: async () => undefined } as never,
    { present: async () => undefined } as never,
    log,
    {
      catalog: { contextLength: () => contextLength, pricing: () => PRICING },
      mintToken: () => `run-${++tokens}-evidence`
    }
  );
  const posted: ExtensionToWebviewMessage[] = [];
  const handler = new LightboxReadingHandler(
    service,
    runner,
    new LightboxContextShelf({ mintId: () => 'ctx-cast' }),
    {
      resolve: async () => ({ text: CONTEXT_NOTE, relativePaths: ['Notes/cast.md'], displayPath: 'Notes/cast.md' })
    } as unknown as TextSourceResolver,
    { pickFile: async () => ({ fsPath: '/workspace/Notes/cast.md', uri: 'file:///workspace/Notes/cast.md' }) },
    async (message) => { posted.push(message); },
    log
  );
  const router = new MessageRouter();
  handler.registerRoutes(router);
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  const built = await service.buildBoard({
    kind: 'file',
    text: source.text,
    displayPath: source.displayPath,
    sourceUri: `file:///workspace/${source.displayPath}`,
    rereadPath: `/workspace/${source.displayPath}`
  });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  const boardMessage = {
    type: MessageType.LIGHTBOX_BOARD,
    source: 'extension.lightbox',
    payload: { board: built.board, refusal: null },
    timestamp: 1
  };
  const settle = () => new Promise((done) => setImmediate(done));
  return { route, posted, pending, board: built.board, boardMessage, settle };
}

/** Everything the host posted since `from`, timestamps fixed so the files diff cleanly. */
const since = (posted: ExtensionToWebviewMessage[], from: number) =>
  posted.slice(from).map((message) => ({ ...message, timestamp: 1 }));

function write(name: string, states: Record<string, unknown[]>): void {
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(states)}\n`);
}

it('dumps the reading states', async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // Chapter I against a 200,000-token window. The tab opens (lenses sync,
  // estimate) and the writer adds a context file.
  const fits = await harness(200_000, { text: chapterText(1), displayPath: 'Drafts/alice-chapter-1.md' });
  await fits.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [] });
  await fits.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
  const idle = [fits.boardMessage, ...since(fits.posted, 0)];

  // Read the chapter; group A comes back while B and C are still out.
  let mark = fits.posted.length;
  await fits.route(MessageType.LIGHTBOX_RUN, { boardId: fits.board.boardId, scope: { mode: 'all' } });
  await fits.settle();
  expect([...fits.pending.keys()].sort()).toEqual(['A', 'B', 'C']);
  for (const group of ['A', 'B', 'C'] as const) {
    // Stream a little of each reply, as a provider would.
    fits.pending.get(group)?.request.options?.onToken?.(replies[group].slice(0, 1_200));
  }
  fits.pending.get('A')?.settle(reply(replies.A));
  await fits.settle();
  const running = since(fits.posted, mark);

  mark = fits.posted.length;
  fits.pending.get('B')?.settle(reply(replies.B));
  fits.pending.get('C')?.settle(reply(replies.C));
  await fits.settle();
  await fits.settle();
  const done = since(fits.posted, mark);
  write('chapter', { idle, running, done });

  // The whole book against a 32,768-token window: book-sized, and no call fits.
  const book = Array.from({ length: 12 }, (_, offset) => chapterText(offset + 1)).join('\n\n');
  const tight = await harness(32_768, { text: book, displayPath: 'Drafts/alice-whole-book.md' });
  await tight.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [] });
  write('book', { 'too-large': [tight.boardMessage, ...since(tight.posted, 0)] });

  const types = (messages: Array<{ type: string }>) => messages.map((message) => message.type);
  expect(types(done)).toEqual(expect.arrayContaining([MessageType.LIGHTBOX_GROUP_RESULT, MessageType.LIGHTBOX_RUN_PROGRESS]));
  const estimate = tight.posted.find((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE);
  expect(estimate && 'estimate' in estimate.payload ? estimate.payload.estimate : undefined)
    .toMatchObject({ fit: 'too-large', bookSized: true });
});
