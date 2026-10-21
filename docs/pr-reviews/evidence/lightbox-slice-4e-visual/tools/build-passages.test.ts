/**
 * Builds the host messages the Slice 4E visual harness replays (../states/),
 * through the production LightboxService, LightboxHandler,
 * LightboxReadingHandler (for its estimate only: nothing is read) and
 * LightboxPassageHandler, over the real measurement services. No model is
 * called and no provider is reached: the runner's engine is never asked.
 *
 * The source is Chapter I of Lewis Carroll's "Alice's Adventures in
 * Wonderland" (1865), public domain, cut by
 * ../../lightbox-slice-2a-visual/tools/alice_chapter.py, and the whole book
 * (its twelve chapters, under the 50,000-word ceiling) for the row bound.
 * The changed text replaces three words of the longest paragraph with words
 * written for this evidence.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-passages.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR holding fixtures/alice-chapter-<1..12>.md. Delete
 * the copy after. Writes states/chapter.json and states/log.txt there.
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
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoard,
  type LightboxPassageItem
} from '@messages';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4e';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const CHAPTER_PATH = 'Drafts/alice-chapter-1.md';
const BOOK_PATH = 'Drafts/alice-whole-book.md';
const NOW = Date.UTC(2026, 9, 21, 14, 5);
/** The changed text: three words of Chapter I's longest paragraph (¶11), rewritten for this evidence. */
const BEFORE = 'soon began talking again';
const AFTER = 'soon began counting stars';

/** Keys sorted at every level, so the harness finds an answer by what the webview asks, whatever order it builds it in. */
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

it('dumps the boards, estimates and passages for the inspector\'s reading aids', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  const chapterOf = (n: number) => fs.readFileSync(`${DIR}/fixtures/alice-chapter-${n}.md`, 'utf8');
  const chapter = chapterOf(1);
  const book = Array.from({ length: 12 }, (_unused, offset) => chapterOf(offset + 1)).join('\n\n');
  expect(chapter.split(BEFORE)).toHaveLength(2);
  const files = new Map<string, string>([[`/workspace/${CHAPTER_PATH}`, chapter], [`/workspace/${BOOK_PATH}`, book]]);

  const nodeFs = createFakeFileSystem({
    readFile: async (p: string) => new Uint8Array(fs.readFileSync(p)),
    stat: async (p: string) => ({ type: FileType.File, size: fs.statSync(p).size, ctime: 0, mtime: 0 })
  } as never);
  let boards = 0;
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { now: () => NOW, mintBoardId: () => `board-alice-${++boards}` }
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
  const boardOf = async (relativePath: string, type = MessageType.LIGHTBOX_SET_SOURCE): Promise<{ board: LightboxBoard; message: ExtensionToWebviewMessage }> => {
    await route(type, type === MessageType.LIGHTBOX_SET_SOURCE ? { sourceUri: `file:///workspace/${relativePath}`, relativePath } : {});
    const message = last(MessageType.LIGHTBOX_BOARD);
    const board = message && (message.payload as { board: LightboxBoard | null }).board;
    if (!message || !board || board.source.displayPath !== relativePath) {
      throw new Error(`${relativePath} was not boarded`);
    }
    return { board, message: { ...message, timestamp: 1 } };
  };

  let requests = 0;
  const estimates: Array<Record<string, unknown>> = [];
  /** The host's estimate for the board on screen, with every lens on, as the tab asks for it. */
  const estimate = async (board: LightboxBoard) => {
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `evidence-${++requests}` });
    const found = last(MessageType.LIGHTBOX_RUN_ESTIMATE)?.payload as { requestId: string; estimate?: { boardId: string; key: string } } | undefined;
    if (!found?.estimate || found.estimate.boardId !== board.boardId) {
      throw new Error('no estimate for the board');
    }
    const { requestId: _requestId, ...answer } = found;
    estimates.push(answer);
    return found.estimate.key;
  };
  const passages: Record<string, unknown> = {};
  /** The host's passage for `item` on `board`, kept under the board and the item, without its request id. */
  const passage = async (board: LightboxBoard, item: LightboxPassageItem) => {
    await route(MessageType.LIGHTBOX_REQUEST_PASSAGE, {
      requestId: `evidence-${++requests}`, boardId: board.boardId, contentHash: board.source.contentHash, item
    });
    const reply = last(MessageType.LIGHTBOX_PASSAGE)?.payload as { requestId: string; passage: { kind: string } } | undefined;
    if (!reply || reply.passage.kind === 'refused') {
      throw new Error(`no passage for ${canonical(item)}`);
    }
    const { requestId: _requestId, ...answer } = reply;
    passages[`${board.boardId} ${canonical(item)}`] = answer;
    return reply.passage;
  };

  // Chapter I: its board, its estimate, and the passages the harness's states open.
  const idle = await boardOf(CHAPTER_PATH);
  const chapterBoard = idle.board;
  const keyBefore = await estimate(chapterBoard);
  const longest = chapterBoard.paragraphs.reduce((best, paragraph) => (paragraph.end - paragraph.start > best.end - best.start ? paragraph : best));
  expect(chapter.slice(longest.start, longest.end)).toContain(BEFORE);
  const measured = chapterBoard.measured;
  const alice = measured.topWords.find((entry) => entry.term === 'alice');
  const verb = measured.partsOfSpeech.verbs[0];
  const phrase = measured.phrases.bigrams[0];
  const weakVerbs = measured.styleFlags.find((flag) => flag.id === 'weak-verbs');
  const hapax = measured.hapax.find((entry) => entry.term === 'marmalade');
  if (!alice || !verb || !phrase || !weakVerbs || !hapax) {
    throw new Error('the chapter lacks an item a state opens');
  }
  await passage(chapterBoard, { kind: 'paragraphs', from: longest.index, to: longest.index });
  await passage(chapterBoard, { kind: 'instances', term: { kind: 'word', word: 'alice' } });
  for (const index of alice.paragraphs) {
    await passage(chapterBoard, { kind: 'paragraphs', from: index, to: index, via: { kind: 'word', word: 'alice' } });
  }
  await passage(chapterBoard, { kind: 'instances', term: { kind: 'pos', pos: 'verbs', word: verb.term } });
  await passage(chapterBoard, { kind: 'instances', term: { kind: 'phrase', phrase: phrase.term } });
  await passage(chapterBoard, { kind: 'instances', term: { kind: 'flag', flag: 'weak-verbs' } });
  await passage(chapterBoard, { kind: 'instances', term: { kind: 'hapax', word: hapax.term } });
  // Asking for passages changed nothing a press is priced on.
  expect(await estimate(chapterBoard)).toBe(keyBefore);

  // The text changes: three words of the longest paragraph are rewritten, and the file read again.
  files.set(`/workspace/${CHAPTER_PATH}`, chapter.replace(BEFORE, AFTER));
  const changed = await boardOf(CHAPTER_PATH, MessageType.LIGHTBOX_REFRESH_SOURCE);
  expect(changed.board.boardId).not.toBe(chapterBoard.boardId);
  await estimate(changed.board);

  // The whole book, for the row bound.
  const whole = await boardOf(BOOK_PATH);
  await estimate(whole.board);
  await passage(whole.board, { kind: 'instances', term: { kind: 'word', word: 'alice' } });

  fs.writeFileSync(path.join(OUT, 'chapter.json'), `${JSON.stringify({
    idle: [idle.message],
    changed: [changed.message],
    book: [whole.message],
    estimates,
    passages,
    items: {
      longestParagraph: longest.index,
      verb: verb.term,
      phrase: phrase.term,
      hapax: { term: hapax.term, written: hapax.written },
      changedFrom: BEFORE,
      changedTo: AFTER
    }
  })}\n`);
  fs.writeFileSync(path.join(OUT, 'log.txt'), `${logged.join('\n')}\n`);
  clock.mockRestore();

  // No log line carries the chapter's words; its file names may ("chapter" of alice-chapter-1.md).
  const named = new Set(`${CHAPTER_PATH} ${BOOK_PATH}`.toLowerCase().match(/[a-z]+/g));
  const words = new Set(chapter.toLowerCase().match(/[a-z]{6,}/g));
  expect(logged.flatMap((line) => line.toLowerCase().match(/[a-z]{6,}/g) ?? []).filter((word) => words.has(word) && !named.has(word))).toEqual([]);
});
