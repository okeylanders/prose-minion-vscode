/**
 * Builds the host messages the Slice 3 visual harness replays (../states/),
 * through the production LightboxService, LightboxHandler,
 * LightboxReadingHandler, LightboxReadingRunner, codec, quote verifier, term
 * counter and stale-readings carry, and the Workshop's own
 * WorkshopLexicalGravityHandler. Only the provider is played: its replies are
 * the prompt bundle's worked examples (groups B and C verbatim; group A as
 * described in ../README.md). No provider is called.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-gravity.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR (default /tmp/lightbox-3) holding
 * fixtures/alice-chapter-1.md (from ../../lightbox-slice-2a-visual/tools/alice_chapter.py).
 * Delete the copy after. Writes states/chapter.json (the Lightbox's idle,
 * done, sent and stale messages, each state adding to the one before, except
 * that `sent` and `stale` each follow `done`) and states/workshop.json (what
 * the Workshop panel's handler posted for the handoff) there. chapter.json
 * also holds `estimates` and `staleEstimates`: the host's estimate answer for
 * the read board and for the board rebuilt from the edited chapter, keyed by
 * the lenses that are off. The harness answers the tab's own requests with
 * them, echoing each request's id (PR #149 F-03), as the Slice 2B harness
 * does.
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
import { LIGHTBOX_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxHandoff';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import {
  WorkshopLexicalGravityHandler
} from '@/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler';
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
import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoard,
  type LightboxReadingGroupId
} from '@messages';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { frame, framedJson, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-3';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const RELATIVE_PATH = 'Drafts/alice-chapter-1.md';
const FILE_PATH = `/workspace/${RELATIVE_PATH}`;

/**
 * Lexical gravity for the whole chapter, hand-written for this evidence. Four
 * borrowed fields, the last too faint to clear the gravity line; one
 * collision; three literal set-asides. Terms and quotes are the chapter's own
 * words; the host counts every term.
 */
const GRAVITY = {
  fields: [
    {
      name: 'Telescope',
      metaphor: 'Her body as an instrument that shuts up and draws out.',
      pull: 0.46,
      claim: 'Alice imagines herself as a telescope before anything changes, and when her body does shrink she reaches for the same instrument. It gives her a word for growing small that the ordinary size words around it do not.',
      terms: [
        { term: 'telescope', degree: 3 },
        { term: 'telescopes', degree: 3 },
        { term: 'shut up', degree: 2 },
        { term: 'shutting', degree: 2 },
        { term: 'size', degree: 1 },
        { term: 'shrink', degree: 1 }
      ],
      evidence: [
        { para: 15, quote: 'Oh, how I wish I could shut up like a telescope!' },
        { para: 22, quote: 'I must be shutting up like a telescope.' }
      ]
    },
    {
      name: 'Ledger',
      metaphor: 'Choices weighed like accounts.',
      pull: 0.28,
      claim: 'Alice keeps accounts: a book is judged by its use, a daisy-chain by whether its pleasure is worth the trouble, crying by whether it is any use, and she once cheated herself at croquet. Her choices arrive as bookkeeping.',
      terms: [
        { term: 'use', degree: 1 },
        { term: 'pleasure', degree: 1 },
        { term: 'advice', degree: 1 },
        { term: 'worth the trouble', degree: 2 },
        { term: 'cheated', degree: 2 }
      ],
      evidence: [
        { para: 2, quote: 'what is the use of a book' },
        { para: 3, quote: 'whether the pleasure of making a daisy-chain would be worth the trouble' },
        { para: 25, quote: 'there’s no use in crying like that!' }
      ]
    },
    {
      name: 'Candle',
      metaphor: 'Vanishing pictured as a flame blown out.',
      pull: 0.22,
      claim: 'When Alice fears she may shrink away entirely, the chapter lends her a candle: going out, a flame, a candle blown out. The borrowing is brief and concentrated in one paragraph.',
      terms: [
        { term: 'candle', degree: 3 },
        { term: 'flame', degree: 2 },
        { term: 'blown out', degree: 2 },
        { term: 'going out', degree: 1 }
      ],
      evidence: [
        { para: 23, quote: 'in my going out altogether, like a candle' },
        { para: 23, quote: 'what the flame of a candle is like after the candle is blown out' }
      ]
    },
    {
      name: 'Wind',
      metaphor: 'Her running as weather.',
      pull: 0.12,
      claim: 'Once, as she chases the Rabbit along the passage, Alice moves like the wind. Nothing else in the chapter is told as weather.',
      terms: [{ term: 'like the wind', degree: 3 }],
      evidence: [{ para: 12, quote: 'away went Alice like the wind' }]
    }
  ],
  collisions: [
    {
      fields: ['Ledger', 'Telescope'],
      claim: 'The sentence that weighs waiting as of no use goes on to wish for a book of rules for shutting people up like telescopes: the accounting voice and the instrument meet in one breath.',
      evidence: [{
        para: 16,
        quote: 'There seemed to be no use in waiting by the little door, so she went back to the table, half hoping she might find another key on it, or at any rate a book of rules for shutting people up like telescopes'
      }]
    }
  ],
  literal: [
    {
      name: 'Falling',
      reason: 'She really falls down a deep well, so nothing is borrowed.',
      terms: ['fall', 'fell', 'falling', 'fallen', 'down'],
      evidence: [
        { para: 6, quote: 'she found herself falling down a very deep well' },
        { para: 11, quote: 'and the fall was over' }
      ]
    },
    {
      name: 'Doors and keys',
      reason: 'The hall really is lined with locked doors, and the key really is on the table.',
      terms: ['door', 'doors', 'key', 'locked', 'lock'],
      evidence: [
        { para: 13, quote: 'There were doors all round the hall, but they were all locked' },
        { para: 14, quote: 'there was nothing on it except a tiny golden key' }
      ]
    },
    {
      name: 'Eating and drinking',
      reason: 'She really drinks from the bottle and eats the cake.',
      terms: ['drink', 'bottle', 'cake', 'eat'],
      evidence: [{ para: 28, quote: 'very soon finished off the cake' }]
    }
  ],
  friction: 'Telescope rests on one comparison Alice makes twice, so much of its pull is a repeated phrase, and “size” is ordinary English. Wind is a single simile and is drawn below the line. “Use” in ¶15 and ¶25 is plain usage as much as accounting.'
};

/** The palette for the whole chapter, hand-written for this evidence. */
const PALETTE = {
  clusters: [
    {
      name: 'The way down',
      claim: 'The most counted words keep one direction and one place: down, the well, the hole she follows the Rabbit into, and how she fell.',
      words: ['down', 'well', 'rabbit-hole', 'fell', 'fall'],
      evidence: [{ para: 5, quote: 'In another moment down went Alice after it' }]
    },
    {
      name: 'Little things',
      claim: 'Once she lands, the chapter’s attention narrows to small sizes: a little door, a little bottle, a little golden key, and Alice herself grown small.',
      words: ['little', 'small', 'size', 'inches'],
      evidence: [
        { para: 14, quote: 'a little door about fifteen inches high' },
        { para: 23, quote: 'she was now only ten inches high' }
      ]
    },
    {
      name: 'Thinking it over',
      claim: 'Alice considers, thinks and wonders all the way down and all the way round the hall.',
      words: ['think', 'thought', 'wonder', 'considering'],
      evidence: [{ para: 3, quote: 'So she was considering in her own mind' }]
    },
    {
      name: 'The hall and the garden',
      claim: 'The second half of the chapter is furnished by one room and the place beyond it: the hall, its doors, the key and the garden she can see but not reach.',
      words: ['door', 'key', 'garden', 'hall', 'table'],
      evidence: [{ para: 15, quote: 'looked along the passage into the loveliest garden you ever saw' }]
    }
  ],
  swatches: [
    {
      name: 'White Rabbit',
      words: ['White'],
      hex: '#F2EEE6',
      note: 'The Rabbit’s coat, named twice.',
      evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
    },
    {
      name: 'Pink eyes',
      words: ['pink'],
      hex: '#E8A2B2',
      note: 'The Rabbit’s eyes.',
      evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
    },
    {
      name: 'Marmalade',
      words: ['ORANGE'],
      hex: '#E07B24',
      note: 'A label on a jar that turns out to be empty.',
      evidence: [{ para: 7, quote: 'it was labelled “ORANGE MARMALADE”' }]
    },
    {
      name: 'Too dark to see',
      words: ['dark'],
      hex: '#1E1A16',
      note: 'The bottom of the well, the roof of the hall, the hall she longs to leave.',
      evidence: [{ para: 7, quote: 'it was too dark to see anything' }]
    },
    {
      name: 'Golden key',
      words: ['golden'],
      hex: '#D4A62A',
      note: 'The key she finds, uses and then leaves on the table.',
      evidence: [{ para: 14, quote: 'there was nothing on it except a tiny golden key' }]
    },
    {
      name: 'Red-hot poker',
      words: ['red-hot'],
      hex: '#C8381E',
      note: 'One of the simple rules she remembers before she drinks.',
      evidence: [{ para: 17, quote: 'a red-hot poker will burn you if you hold it too long' }]
    }
  ],
  friction: 'The clusters are this reading’s grouping of counted words; another reader could group them as fairly. “Dark” names a well and a hall more than a color, and “golden” may be the key’s metal rather than its shade. The swatch colors are the reading’s choice.'
};

/**
 * Group A for the whole chapter: the worked example with Slice 2B's changes
 * (31 tension columns scored, a third peak, one motif quote paraphrased on
 * purpose), and this file's gravity and palette blocks in place of the
 * example's ¶1–¶8 ones.
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
  body.gravity = GRAVITY;
  body.palette = PALETTE;
  return frame('A', body);
}

/** The writer's revision for the stale state: ¶15's telescope becomes a fan. */
function revised(chapter: string): string {
  const from = 'Oh, how I wish I could shut up like a telescope! I think I could, if I only know how to begin.';
  const to = 'Oh, how I wish I could fold up like a paper fan! I think I could, if I only knew how to begin.';
  if (!chapter.includes(from)) {
    throw new Error('the revision no longer applies');
  }
  return chapter.replace(from, to);
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

/** An estimate answer without the request id, which the harness echoes per request. */
const answerOf = ({ requestId: _requestId, ...payload }: { requestId?: string }) => payload;

/** Everything posted since `from`, timestamps fixed so the files diff cleanly. */
const since = <T extends { timestamp: number }>(posted: T[], from: number) =>
  posted.slice(from).map((message) => ({ ...message, timestamp: 1 }));

function write(name: string, states: Record<string, unknown>): void {
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(states)}\n`);
}

const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await new Promise((done) => setImmediate(done));
  }
};

it('dumps the gravity, palette, handoff and stale states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chapter = fs.readFileSync(`${DIR}/fixtures/alice-chapter-1.md`, 'utf8');
  const files = new Map<string, string>([[FILE_PATH, chapter]]);

  // The host, as the Lightbox panel's MessageHandler composes it: the real
  // service, both Lightbox handlers on one transport, and the Workshop's own
  // Lexical Gravity handler behind the composition root's handoff port.
  const nodeFs = createFakeFileSystem({
    readFile: async (p: string) => new Uint8Array(fs.readFileSync(p)),
    stat: async (p: string) => ({ type: FileType.File, size: fs.statSync(p).size, ctime: 0, mtime: 0 })
  } as never);
  const settings = createFakeSettings({ 'publishingStandards.preset': 'genre:mg', 'publishingStandards.pageSizeKey': '' });
  let boards = 0;
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    new StandardsService(EXTENSION_PATH, nodeFs, settings),
    { now: () => Date.UTC(2026, 9, 19, 15, 42), mintBoardId: () => `board-alice-${++boards}` }
  );
  const pending = new Map<LightboxReadingGroupId, { request: InitialRunRequest; settle: (result: ExecutionResult) => void }>();
  const engine = {
    runInitial: (request: InitialRunRequest) => new Promise<ExecutionResult>((done) => {
      const group = request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId;
      pending.set(group, { request, settle: done });
    })
  };
  const logged: string[] = [];
  const log = { appendLine: (line: string) => { logged.push(line); }, show: () => undefined, clear: () => undefined };
  let tokens = 0;
  const runner = new LightboxReadingRunner(
    { getEngine: () => engine, getResolvedModel: () => MODEL },
    new PromptLoader(EXTENSION_PATH, nodeFs),
    { capture: async () => undefined } as never,
    { present: async () => undefined } as never,
    log,
    {
      catalog: { contextLength: () => 200_000, pricing: () => PRICING },
      mintToken: () => `run-${++tokens}-evidence`
    }
  );
  const resolver = {
    resolve: async ({ pathText }: { pathText: string }) => {
      const text = files.get(pathText);
      if (text === undefined) {
        throw new Error('not found');
      }
      return { text, relativePaths: [RELATIVE_PATH], displayPath: RELATIVE_PATH };
    }
  } as unknown as TextSourceResolver;

  const workshopPosted: Array<{ type: MessageType; timestamp: number }> = [];
  const workshop = new WorkshopLexicalGravityHandler(
    { buildLenses: async () => { throw new Error('no build in evidence'); }, preview: async () => { throw new Error('no preview'); } } as never,
    {
      list: async () => ({ lenses: [], incompatibleResources: [] }),
      availability: () => ({ available: true, displayPath: 'prose-minion/lexical-gravity' })
    } as never,
    async (message) => { workshopPosted.push(message as never); },
    log
  );
  const workshopRouter = new MessageRouter();
  workshop.registerRoutes(workshopRouter, ((type: MessageType, handle: (message: never) => unknown) =>
    workshopRouter.register(type, handle as never)) as never);
  const handoffs: unknown[] = [];

  const posted: ExtensionToWebviewMessage[] = [];
  const transport = async (message: ExtensionToWebviewMessage) => { posted.push(message); };
  const lightbox = new LightboxHandler(
    service,
    resolver,
    { pickFile: async () => undefined },
    transport,
    log,
    async (handoff) => {
      // What extension.ts and the Workshop panel provider do: a synthetic message through the
      // Workshop panel's own handler, carrying the provider's delivery id. The Workshop webview
      // (harness.js renders it) opens the sheet and answers "opened", which settles the handoff.
      handoffs.push(handoff);
      await workshopRouter.route({
        type: MessageType.WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD,
        source: 'extension.lightbox',
        payload: { seed: handoff.seed, deliveryId: 'lexical-build-seed-evidence-1' },
        timestamp: 1
      } as never);
      return { opened: true as const };
    }
  );
  const reading = new LightboxReadingHandler(
    service,
    runner,
    new LightboxContextShelf({ mintId: () => 'ctx-none' }),
    resolver,
    { pickFile: async () => undefined },
    transport,
    log
  );
  const router = new MessageRouter();
  lightbox.registerRoutes(router);
  reading.registerRoutes(router);
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  let requests = 0;
  /** Ask for the estimate as the tab does, and return the host's answer's payload. */
  const estimate = async (lensesOff: string[] = []) => {
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff, requestId: `evidence-${++requests}` });
    await settle();
    const answer = [...posted].reverse().find((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE);
    if (!answer || !('estimate' in answer.payload) || !answer.payload.estimate) {
      throw new Error('expected an estimate');
    }
    return answer.payload as { requestId?: string; estimate: { key: string } };
  };
  const board = (): LightboxBoard => {
    const current = service.currentBoard();
    if (!current) {
      throw new Error('expected a board');
    }
    return current;
  };
  const field = (name: string) => {
    const tile = board().readings.flatMap((group) => group.tiles).find((candidate) => candidate.kind === 'gravity-field' && candidate.title === name);
    if (!tile) {
      throw new Error(`no field ${name}`);
    }
    return tile;
  };

  // The tab opens on Chapter I and asks for the estimate (all lenses on).
  await route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file://${FILE_PATH}`, relativePath: RELATIVE_PATH });
  const priced = await estimate();
  const idle = since(posted, 0);

  // Read the chapter, naming the estimate the press was shown; every group comes back.
  let mark = posted.length;
  await route(MessageType.LIGHTBOX_RUN, { boardId: board().boardId, scope: { mode: 'all' }, estimateKey: priced.estimate.key });
  await settle();
  expect([...pending.keys()].sort()).toEqual(['A', 'B', 'C']);
  for (const group of ['A', 'B', 'C'] as const) {
    pending.get(group)?.settle(reply(replies[group]));
  }
  await settle();
  const done = since(posted, mark);
  const estimates = { '': answerOf(await estimate()) };
  const groupA = board().readings.find((group) => group.group === 'A');
  expect(groupA?.status).toBe('ok');
  // Every block and claim of group A decodes and is drawn; only the one paraphrased motif quote is withheld.
  expect({ blocks: groupA?.withheldBlocks, claims: groupA?.withheldClaims }).toEqual({ blocks: [], claims: [] });

  // Build the Telescope field as a lens: the host checks it, the Workshop's
  // own handler opens Build lens with it, and nothing is built.
  mark = posted.length;
  const telescope = field('Telescope');
  // The seed id carries the clock; fix it so the file diffs cleanly.
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 19, 15, 45));
  await route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'lexical-gravity-seed', boardId: board().boardId, fieldId: telescope.id });
  await settle();
  clock.mockRestore();
  const sent = since(posted, mark);
  expect(sent.map((message) => message.type)).toEqual([MessageType.LIGHTBOX_HAND_OFF_RESULT]);
  expect(handoffs).toHaveLength(1);
  const seedMessages = since(workshopPosted, 0);
  expect(seedMessages.map((message) => message.type)).toEqual([MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED]);
  await workshopRouter.route({
    type: MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES,
    source: 'webview.workshop.lexical-gravity',
    payload: {},
    timestamp: 1
  } as never);
  const lenses = since(workshopPosted, seedMessages.length);

  // The writer revises ¶15 and re-reads the file: the readings come along,
  // marked stale, each quote checked again.
  files.set(FILE_PATH, revised(chapter));
  mark = posted.length;
  await route(MessageType.LIGHTBOX_REFRESH_SOURCE);
  await settle();
  const stale = since(posted, mark);
  // The tab asks for the new board's estimate when the board arrives.
  const staleEstimates = { '': answerOf(await estimate()) };
  const staleTelescope = field('Telescope');
  expect(board().readings.every((group) => (group.staleLenses ?? []).length > 0)).toBe(true);

  // The stale field cannot be handed over, whatever the webview sends.
  const before = posted.length;
  await route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'lexical-gravity-seed', boardId: board().boardId, fieldId: staleTelescope.id });
  await settle();
  expect(posted.slice(before).map((message) => message.payload)).toEqual([
    expect.objectContaining({ ok: false, message: LIGHTBOX_HANDOFF_REFUSALS.stale })
  ]);
  expect(handoffs).toHaveLength(1);

  write('chapter', { idle, done, sent, stale, estimates, staleEstimates });
  write('workshop', { build: seedMessages, lenses });
  fs.writeFileSync(path.join(OUT, 'log.txt'), `${logged.join('\n')}\n`);

  // No writer text in any log line: no quote, no field or term.
  for (const needle of ['telescope', 'Telescope', 'shutting', 'candle', 'White Rabbit', 'paper fan']) {
    expect(logged.join('\n')).not.toContain(needle);
  }
});
