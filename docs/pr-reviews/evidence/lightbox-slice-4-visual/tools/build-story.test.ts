/**
 * Builds the host messages the Slice 4 visual harness replays (../states/),
 * through the production LightboxService, LightboxHandler (with its handoff
 * route and tray), LightboxReadingHandler, LightboxReadingRunner, codec,
 * quote verifier and term counter, the Workshop's own
 * WorkshopLightboxTileHandler over a real WorkshopSessionService, and the
 * real WorkshopSeedDelivery. Only the provider is played: groups B and C
 * answer with the prompt bundle's worked examples, verbatim; group A's
 * lenses are off. No provider is called.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-story.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR (default /tmp/lightbox-4) holding
 * fixtures/alice-chapter-1.md (from ../../lightbox-slice-2a-visual/tools/alice_chapter.py).
 * Delete the copy after. Writes states/chapter.json and states/workshop.json
 * there (see ../README.md for what each state holds) and states/log.txt.
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
import { WorkshopLightboxTileHandler } from '@/application/handlers/domain/workshop/WorkshopLightboxTileHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { WorkshopSeedDelivery } from '@/application/services/workshop/WorkshopSeedDelivery';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopLightboxTray } from '@/application/services/workshop/WorkshopLightboxTray';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import { StandardsService } from '@services/resources/StandardsService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { PromptLoader } from '@/tools/shared/prompts';
import { FileType } from '@/platform';
import { lightboxGroupLenses } from '@shared/constants/lightbox';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoard,
  type LightboxReadingGroupId,
  type LightboxWorkshopHandoff,
  type WorkshopSeedOutcome
} from '@messages';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const RELATIVE_PATH = 'Drafts/alice-chapter-1.md';
const FILE_PATH = `/workspace/${RELATIVE_PATH}`;
const RECEIVER = 'receiver-evidence';
const NOW = Date.UTC(2026, 9, 20, 15, 42);

function reply(raw: string): ExecutionResult {
  return { content: '', rawContent: raw, usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', modelId: MODEL };
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

it('dumps the story, spark lane, bring, bound, refusal and Workshop states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  const chapter = fs.readFileSync(`${DIR}/fixtures/alice-chapter-1.md`, 'utf8');
  const files = new Map<string, string>([[FILE_PATH, chapter]]);
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
    { now: () => NOW, mintBoardId: () => `board-alice-${++boards}` }
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
    { catalog: { contextLength: () => 200_000, pricing: () => PRICING }, mintToken: () => `run-${++tokens}-evidence` }
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

  // The Workshop: one shared session, its tile handler behind the panel's own
  // router, and the panel provider's real seed delivery for kind `lightbox-tile`.
  const session = new WorkshopSessionService(() => NOW);
  session.setSessionScope('open');
  const workshopPosted: Array<{ type: MessageType; timestamp: number; payload?: any }> = [];
  const sessionState = () => ({
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    timestamp: 1,
    payload: {
      session: session.getSnapshot(),
      writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
      webResearch: { enabled: false },
      persistence: { available: true, degradedConversationKeys: [] }
    }
  });
  let responseRunning = false;
  const tileHandler = new WorkshopLightboxTileHandler(
    session,
    async (message) => { workshopPosted.push(message as never); },
    log,
    { postSessionState: () => { workshopPosted.push(sessionState() as never); }, markDirty: () => undefined, isRoomRunActive: () => responseRunning }
  );
  const workshopRouter = new MessageRouter();
  tileHandler.registerRoutes(workshopRouter, ((type: MessageType, handle: (message: never) => unknown) =>
    workshopRouter.register(type, handle as never)) as never);
  let deliveries = 0;
  const tiles = new WorkshopSeedDelivery<'workshop'>('lightbox-tile', {
    isReady: () => true,
    receiverOf: () => RECEIVER,
    postClaimResult: (_panel, result) => {
      workshopPosted.push({ type: MessageType.WORKSHOP_SEED_CLAIM_RESULT, source: 'extension.workshop', payload: result, timestamp: 1 } as never);
    }
  }, { mintDeliveryId: () => `lightbox-tile-evidence-${++deliveries}` });
  const handoffs: LightboxWorkshopHandoff[] = [];
  const handOffToWorkshop = (handoff: LightboxWorkshopHandoff): Promise<WorkshopSeedOutcome> => {
    handoffs.push(handoff);
    if (handoff.kind !== 'tile') {
      throw new Error('this evidence brings tiles only');
    }
    // What extension.ts and WorkshopPanelProvider.stageLightboxTile do.
    return tiles.offer('workshop', (deliveryId) => {
      void workshopRouter.route({
        type: MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE,
        source: 'extension.lightbox',
        payload: { tile: handoff.tile, deliveryId },
        timestamp: 1
      } as never);
    });
  };
  /** The Workshop webview's side, as useWorkshopLightboxTiles plays it: claim, accept after the grant, answer. */
  const playWorkshopWebview = async () => {
    await settle();
    const offered = [...workshopPosted].reverse().find((message) => message.type === MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED);
    const deliveryId = offered?.payload.deliveryId as string;
    tiles.claim('workshop', deliveryId, RECEIVER);
    await workshopRouter.route({ type: MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE, source: 'webview.workshop.lightbox-tile', payload: { deliveryId }, timestamp: 1 } as never);
    const staged = [...workshopPosted].reverse().find((message) => message.type === MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED);
    tiles.answer('workshop', staged?.payload.staged
      ? { deliveryId, opened: true }
      : { deliveryId, opened: false, reason: staged?.payload.reason }, RECEIVER);
    await settle();
  };

  const posted: ExtensionToWebviewMessage[] = [];
  const transport = async (message: ExtensionToWebviewMessage) => { posted.push(message); };
  const lightbox = new LightboxHandler(
    service, resolver, { pickFile: async () => undefined }, transport, log, handOffToWorkshop,
    { tray: workshopLightboxTray(session), openWorkshop: () => undefined }
  );
  const reading = new LightboxReadingHandler(
    service, runner, new LightboxContextShelf({ mintId: () => 'ctx-none' }), resolver, { pickFile: async () => undefined }, transport, log
  );
  const router = new MessageRouter();
  lightbox.registerRoutes(router);
  reading.registerRoutes(router);
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  const lensesOff = lightboxGroupLenses('A');
  let requests = 0;
  const estimate = async () => {
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff, requestId: `evidence-${++requests}` });
    await settle();
    const answer = [...posted].reverse().find((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE);
    if (!answer || !('estimate' in answer.payload) || !answer.payload.estimate) {
      throw new Error('expected an estimate');
    }
    return answer.payload as { requestId?: string; estimate: { key: string } };
  };
  const board = (): LightboxBoard => service.currentBoard() as LightboxBoard;
  const tileOf = (kind: string, title?: string) => {
    const tile = board().readings.flatMap((group) => group.tiles)
      .find((candidate) => candidate.kind === kind && (title === undefined || candidate.title === title));
    if (!tile) {
      throw new Error(`no ${kind} ${title ?? ''}`);
    }
    return tile;
  };

  // The tab opens on Chapter I with group A's lenses off, and asks for the estimate.
  await route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file://${FILE_PATH}`, relativePath: RELATIVE_PATH });
  const priced = await estimate();
  const idle = since(posted, 0);

  // Read groups B and C; the stub answers each with its worked example.
  let mark = posted.length;
  await route(MessageType.LIGHTBOX_RUN, { boardId: board().boardId, scope: { mode: 'all' }, estimateKey: priced.estimate.key, model: MODEL });
  await settle();
  expect([...pending.keys()].sort()).toEqual(['B', 'C']);
  for (const group of ['B', 'C'] as const) {
    pending.get(group)?.settle(reply(readWorkedExample(group).response));
  }
  await settle();
  const done = since(posted, mark);
  const estimates = { [lensesOff.slice().sort().join(',')]: answerOf(await estimate()) };
  for (const group of board().readings.filter((entry) => entry.group !== 'A')) {
    expect({ group: group.group, status: group.status, blocks: group.withheldBlocks }).toEqual({ group: group.group, status: 'ok', blocks: [] });
  }

  // "Not for me" on The empty jar, then Undo: the host marks the board's own spark.
  const jar = tileOf('spark', 'The empty jar');
  mark = posted.length;
  await route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: board().boardId, tileId: jar.id, dismissed: true });
  const dismissed = since(posted, mark);
  mark = posted.length;
  await route(MessageType.LIGHTBOX_SET_SPARK_DISMISSED, { boardId: board().boardId, tileId: jar.id, dismissed: false });
  const undone = since(posted, mark);

  // Bring the Rabbit's said/meant pair: the Workshop stages it, the tray and the answer follow.
  const rabbit = tileOf('subtext');
  mark = posted.length;
  const bringing = route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board().boardId, tileId: rabbit.id });
  await playWorkshopWebview();
  await bringing;
  await settle();
  const bound = since(posted, mark);
  expect(bound.map((message) => message.type)).toEqual([MessageType.LIGHTBOX_WORKSHOP_TRAY, MessageType.LIGHTBOX_HAND_OFF_RESULT]);
  expect(bound[1].payload).toMatchObject({ ok: true });

  // Bring a spark as a question too: two tiles bound.
  mark = posted.length;
  const sparking = route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board().boardId, tileId: jar.id });
  await playWorkshopWebview();
  await sparking;
  await settle();
  const sparkBound = since(posted, mark);
  expect(sparkBound.at(-1)?.payload).toMatchObject({ ok: true });

  // A refusal: a lineage story brought while a Workshop response runs.
  const hart = tileOf('lineage', 'The white hart');
  responseRunning = true;
  mark = posted.length;
  const refusing = route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board().boardId, tileId: hart.id });
  await playWorkshopWebview();
  await refusing;
  await settle();
  responseRunning = false;
  const refused = since(posted, mark);
  expect(refused.at(-1)?.payload).toMatchObject({ ok: false, message: expect.stringMatching(/^The Workshop is busy/) });

  // The Workshop as it stands: two pills above the composer.
  expect(session.getSnapshot().pendingMessageAttachments.map((attachment) => attachment.label)).toHaveLength(2);
  const composer = [sessionState()];

  clock.mockRestore();
  write('chapter', { lensesOff, idle, done, estimates, dismissed, undone, bound, sparkBound, refused });
  write('workshop', { composer, handoff: since(workshopPosted, 0) });
  fs.writeFileSync(path.join(OUT, 'log.txt'), `${logged.join('\n')}\n`);

  // Only ids leave the webview, and no writer text or reading text is logged.
  expect(handoffs.map((handoff) => handoff.kind)).toEqual(['tile', 'tile', 'tile']);
  for (const needle of ['Rabbit', 'late', 'marmalade', 'MARMALADE', 'hart', 'Persephone', 'jar']) {
    expect(logged.join('\n')).not.toContain(needle);
  }
});
