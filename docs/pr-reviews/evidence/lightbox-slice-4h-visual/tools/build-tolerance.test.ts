/**
 * Builds the host messages the Slice 4H visual harness replays (../states/),
 * through the production LightboxHandler, LightboxReadingHandler,
 * LightboxBoardsHandler, LightboxService, LightboxReadingRunner (its codec,
 * shared JSON parser, quote verifier and term counter), LightboxBoardStore
 * and LightboxBoardLibrary, over a memory file system that holds the
 * chapter, the boards folder and the recovery folder
 * (`lightboxBoardsHarness`, with a real `RejectedModelResponseRecoveryStore`).
 * Only the provider is played: each group answers with its worked example,
 * edited as below, and group F with the harness's stand-in Opinion. The
 * model it reports is the placeholder `provider/model-v1`. No provider is
 * called.
 *
 * Two boards:
 * 1. `overrun` (epic decision 37). Groups A–E answer past their asks: long
 *    gists, notes, claims and titles, about two and a half times their
 *    asks; six motifs where four are asked, one of them with six quotes
 *    where three are asked; more genre neighbours, sparks, echoes, handoffs,
 *    template beats and threads than asked; and one runaway motif gist, past
 *    eight times its ask, which the safety ceiling clips with an ellipsis.
 *    Nothing is withheld.
 * 2. `salvaged` (decision 40). Group E's reply is cut off at the output
 *    ceiling inside its summary block (`finishReason: "length"`); the other
 *    groups answer as their worked examples. Template, pressure and
 *    artifacts are read; Summary & movements is withheld with the host's
 *    reason and the place the paid reply was saved.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-tolerance.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/tolerance.json and states/log.txt there, and replies.json (the
 * edited replies, for reading through another commit's codec) beside them.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoard,
  type LightboxReadingGroupId,
  type LightboxReadingTile
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_ELLIPSIS } from '@shared/constants/lightboxClip';
import { RejectedModelResponseRecoveryStore } from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { LIGHTBOX_CUT_OFF_REASON } from '@/infrastructure/lightbox/LightboxReadingWire';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  CHAPTER,
  CHAPTER_PATH,
  WORKSPACE,
  createLightboxBoardsHost,
  quiet,
  type LightboxBoardsHostOptions,
  type LightboxBoardsTab
} from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';
import { examples, groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import { frame, framedJson } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are edited as plain JSON. */
type Body = Record<string, any>;

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4h';
const OUT = `${DIR}/states`;
const NOW = Date.UTC(2026, 9, 22, 14, 4, 30);
const B = PROMPT_BUDGETS.lightbox;
/** Sentences written for this evidence, with no digit, no question and nothing a text rule refuses. */
const MORE = [
  ' The reading holds across the chapter as a whole, from its opening lines to its close.',
  ' It returns to the same few images: the bank, the hole, the well, the shelves and the jar.',
  ' Each return is small, and none of them is announced, so the pattern builds without a signal.',
  ' A reader who stops at the bank would miss it; a reader who reaches the well will not.',
  ' The words are ordinary, which is why the repetition reads as rhythm rather than as emphasis.'
];
/** Sentences put before a spark's question, which must still end it. */
const SPARK_MORE = [
  'The jar comes down from one of the cupboards and book-shelves that line the well, among maps and pictures hung upon pegs.',
  'She will not drop it for fear of killing somebody underneath, so she puts it into a cupboard as she falls past it.',
  'Nothing in the chapter says who stocked the shelves, or who labelled the jar, or why it was left empty.',
  'Its label promises one thing, and the jar holds none of it, and the fall goes on past shelf after shelf.',
  'The reading holds across the chapter as a whole, from its opening lines to its close.'
];

/** `text` lengthened to about `times` its ask, a sentence at a time. */
const around = (text: string, ask: number, times = 2.5): string => {
  let out = text;
  for (let next = 0; out.length < ask * times; next++) {
    out += MORE[next % MORE.length];
  }
  return out;
};

const bodyOf = (group: LightboxReadingGroupId): Body => framedJson(examples[group].response) as Body;

/** Every quote the worked examples cite, by paragraph: each is the chapter's own words. */
function quotePool(): Array<{ para: number; quote: string }> {
  const seen = new Map<string, { para: number; quote: string }>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      const entry = value as Record<string, unknown>;
      if (typeof entry.para === 'number' && typeof entry.quote === 'string') {
        seen.set(`${entry.para}:${entry.quote}`, { para: entry.para, quote: entry.quote });
      }
      Object.values(entry).forEach(walk);
    }
  };
  (['A', 'B', 'C', 'D', 'E'] as const).forEach((group) => walk(bodyOf(group)));
  return [...seen.values()].sort((a, b) => a.para - b.para || a.quote.localeCompare(b.quote));
}

/** Groups A–E past their asks; F and G as their stand-ins. */
function overrunReply(group: LightboxReadingGroupId): string | undefined {
  const body = bodyOf(group);
  if (group === 'A') {
    body.headline.sentence = around(body.headline.sentence, B.noteCharacters, 1.6);
    const [first, second, third] = body.motifs.items;
    // A label past its ask: about one and a half times the eighty characters asked.
    first.title = `${first.title}: the bank, the hole, the well, the shelves, the jar, and a boast about tumbling down stairs`;
    first.gist = around(first.gist, B.noteCharacters);
    first.claim = around(first.claim, B.claimCharacters);
    const pool = quotePool().filter((entry) => !first.evidence.some((own: { quote: string }) => own.quote === entry.quote));
    first.evidence = [...first.evidence, ...pool.filter((entry) => / down /u.test(` ${entry.quote} `)).slice(0, 3)];
    // The runaway: past eight times its ask, clipped at the safety ceiling.
    second.gist = around(second.gist, B.noteCharacters, B.safetyMultiple + 1);
    third.gist = around(third.gist, B.noteCharacters);
    body.motifs.items.push(
      { ...first, title: 'Going down, again', gist: around('The same direction, read a second time.', B.noteCharacters), evidence: first.evidence.slice(0, 2) },
      { ...second, title: 'Pictures, once more', gist: around('Pictures turn up where she wanted them.', B.noteCharacters) },
      { ...third, title: 'The watch and the shelves', gist: around('His hurry, her browsing.', B.noteCharacters) }
    );
    body.motifs.friction = around(body.motifs.friction, B.frictionCharacters, 1.8);
  }
  if (group === 'B') {
    body.characters.items[0].energy = around(body.characters.items[0].energy, B.noteCharacters);
    body.voice.claim = around(body.voice.claim, B.claimCharacters, 1.8);
    body.subtext.items = [...body.subtext.items, ...body.subtext.items.slice(0, 2)];
  }
  if (group === 'C') {
    const [, second, third] = body.genre.neighbors;
    body.genre.neighbors.push({ ...second, genre: 'Dream-vision allegory' }, { ...third, genre: 'Comic fable' });
    body.genre.neighbors[0].claim = around(body.genre.neighbors[0].claim, B.claimCharacters, 1.8);
    // About twice its ask, and still a question: the sentences go before it.
    body.spark.items[0].question = `${SPARK_MORE.join(' ')} ${body.spark.items[0].question as string}`;
    body.spark.items.push({ ...body.spark.items[1], title: 'The door again' }, { ...body.spark.items[2], title: 'One more door' });
  }
  if (group === 'D') {
    const echo = body.stock.echoes[0];
    body.stock.echoes.push({ ...echo, title: 'A proverb’s turn, again' }, { ...echo, title: 'A third turn' }, { ...echo, title: 'A fourth turn' });
    body.stock.economy.note = around(body.stock.economy.note, B.claimCharacters, 1.6);
    body.stock.signature[0].note = around(body.stock.signature[0].note, B.noteCharacters);
    body.rhythm.movement = around(body.rhythm.movement, B.claimCharacters, 1.6);
    body.rhythm.handoffs.push(body.rhythm.handoffs[0]);
  }
  if (group === 'E') {
    // The writer's case: a freshness note past its ask withheld the whole template block before.
    body.template.freshness.note = around(body.template.freshness.note, B.noteCharacters, 3);
    body.template.description = around(body.template.description, B.claimCharacters, 1.6);
    body.template.beats = [...body.template.beats, ...body.template.beats.slice(0, 3)]
      .map((beat: Body, index: number) => (index === 1 ? { ...beat, note: around(beat.note, B.noteCharacters) } : beat));
    body.pressure.threads = [
      ...body.pressure.threads,
      ...body.pressure.threads.map((thread: Body) => ({ ...thread, question: `Read again: ${thread.question}` }))
    ];
    body.summary.movements[1].gist = around(body.summary.movements[1].gist, B.noteCharacters);
  }
  return group === 'F' || group === 'G' ? undefined : frame(group, body);
}

/** What a mount sees: the board, the shelf the rail's request gets, the board's shelf, and the estimate. */
async function scene(tab: LightboxBoardsTab, name: string) {
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  const board = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD).at(-1) as ExtensionToWebviewMessage;
  const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;
  await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `estimate-${name}` });
  const estimate = tab.posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
    .map((message) => message.payload as { requestId?: string }).find((payload) => payload.requestId === `estimate-${name}`);
  return {
    messages: [{ ...board, timestamp: 1 }],
    mount: withoutRequest(await tab.shelf(null, `mount-${name}`)),
    shelves: { 'board-1': withoutRequest(await tab.shelf('board-1', `shelf-${name}`)) },
    estimate: estimate ? withoutRequest(estimate) : undefined
  };
}

const boardOf = (state: Awaited<ReturnType<typeof scene>>): LightboxBoard =>
  (state.messages[0] as Extract<ExtensionToWebviewMessage, { type: MessageType.LIGHTBOX_BOARD }>).payload.board as LightboxBoard;
const tilesOf = (board: LightboxBoard, kind: string): LightboxReadingTile[] =>
  board.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === kind);

/** A host whose paid replies are saved by the real recovery store, into the same memory file system. */
function hostWith(respond: LightboxBoardsHostOptions['respond']) {
  const fileSystem = new MemoryFileSystem();
  const workspace = createFakeWorkspace({ workspaceFolders: () => [{ path: WORKSPACE, name: 'workspace' }] });
  const recovery = new RejectedModelResponseRecoveryStore(fileSystem, workspace, '/extension/recovery', undefined, () => new Date(NOW + 120_000));
  return createLightboxBoardsHost({ now: () => NOW, respond, fileSystem, recovery });
}

async function readEveryLens(host: ReturnType<typeof createLightboxBoardsHost>): Promise<LightboxBoardsTab> {
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null, 'first-mount');
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  return tab;
}

it('dumps the overrun and salvaged states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const fOf = (request: Parameters<typeof groupOf>[0]) => (groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);

  // 1. Every reply past its asks.
  const overrunHost = hostWith((request) => ok(groupOf(request), overrunReply(groupOf(request)) ?? fOf(request)));
  const overrunTab = await readEveryLens(overrunHost);
  const overrun = await scene(overrunTab, 'overrun');
  const board = boardOf(overrun);
  // Every group read: an assertion inside a reply would fail its group, so the replies are checked here, on the board.
  expect(board.readings.map((group) => [group.group, group.status])).toEqual(['A', 'B', 'C', 'D', 'E', 'G', 'F'].map((group) => [group, 'ok']));
  // Withheld exactly what the worked examples' own replies withhold on this board, and nothing for an overrun.
  const plainHost = hostWith((request) => ok(groupOf(request), fOf(request)));
  const plain = boardOf(await scene(await readEveryLens(plainHost), 'plain'));
  const withheld = (of: LightboxBoard) => ({
    blocks: of.readings.flatMap((group) => group.withheldBlocks),
    claims: of.readings.flatMap((group) => group.withheldClaims).map((claim) => [claim.lens, claim.title, claim.reason])
  });
  expect(withheld(board)).toEqual(withheld(plain));
  expect(withheld(board).blocks).toEqual([]);
  const motifs = tilesOf(board, 'motif');
  expect(motifs).toHaveLength(6);
  const runaway = motifs.find((tile) => tile.kind === 'motif' && tile.gist.endsWith(LIGHTBOX_ELLIPSIS));
  // Clipped at a word boundary near the ceiling, never past it.
  const runawayLength = runaway?.kind === 'motif' ? runaway.gist.length : 0;
  expect(runawayLength).toBeLessThanOrEqual(B.noteCharacters * B.safetyMultiple);
  expect(runawayLength).toBeGreaterThan(B.noteCharacters * B.safetyMultiple * 0.8);
  expect(Math.max(...motifs.map((tile) => tile.evidence.length))).toBe(6);
  expect(tilesOf(board, 'template-beat')).toHaveLength(8);
  expect(tilesOf(board, 'pressure-thread').length).toBeGreaterThan(B.pressureThreads);
  expect(tilesOf(board, 'spark').length).toBeGreaterThan(B.sparks);
  expect(Math.max(...tilesOf(board, 'spark').map((tile) => tile.claim.length))).toBeGreaterThan(B.sparkCharacters * 2);
  const template = tilesOf(board, 'template')[0];
  expect(template?.kind === 'template' && template.freshness.note.length).toBeGreaterThan(B.noteCharacters * 2);
  expect(overrunHost.logged()).toContain('[LightboxReadingRunner] Group A clipped 1 field at the safety ceiling');

  // 2. Group E cut off at the output ceiling, inside its summary block.
  const cut = examples.E.response.slice(0, examples.E.response.indexOf('"summary"') + 120);
  const salvagedHost = hostWith((request) => (groupOf(request) === 'E'
    ? { ...ok('E', cut), finishReason: 'length' }
    : ok(groupOf(request), fOf(request))));
  const salvagedTab = await readEveryLens(salvagedHost);
  const salvaged = await scene(salvagedTab, 'salvaged');
  const groupE = boardOf(salvaged).readings.find((group) => group.group === 'E');
  expect(groupE?.status).toBe('ok');
  expect(groupE?.withheldBlocks).toEqual([{
    kind: 'synopsis',
    lens: 'summary',
    reason: expect.stringMatching(new RegExp(`^${LIGHTBOX_CUT_OFF_REASON.replace(/\./g, '\\.')} Complete response saved for recovery at /workspace/prose-minion/recovery/`))
  }]);
  expect(groupE?.tiles.some((tile) => tile.lens === 'summary')).toBe(false);
  expect(groupE?.tiles.some((tile) => tile.kind === 'template')).toBe(true);
  const recovered = [...salvagedHost.fileSystem.files.keys()].filter((file) => file.includes('/prose-minion/recovery/'));
  expect(recovered.length).toBeGreaterThan(0);
  expect(salvagedHost.logged()).toContain('[LightboxReadingRunner] Group E reached the output ceiling: 3 blocks finished, cut inside summary');

  fs.writeFileSync(path.join(OUT, 'tolerance.json'), `${JSON.stringify({ overrun, salvaged })}\n`);
  // The replies themselves, beside states/, for reading them through another commit's codec (README, "Before").
  const replies = Object.fromEntries((['A', 'B', 'C', 'D', 'E'] as const).map((group) => [group, overrunReply(group)]));
  fs.writeFileSync(path.join(DIR, 'replies.json'), `${JSON.stringify({ overrun: replies, cutE: cut })}\n`);

  // The log names groups, kinds and counts; never the chapter's words or a reading's.
  const log = [overrunHost, salvagedHost].map((each) => `${each.lines.join('\n')}\n`).join('');
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  for (const sentence of [...MORE, ...SPARK_MORE]) {
    expect(log).not.toContain(sentence.trim().slice(0, 40));
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
