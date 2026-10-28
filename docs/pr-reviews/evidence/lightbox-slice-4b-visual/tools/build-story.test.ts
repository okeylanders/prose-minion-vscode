/**
 * Builds the host messages the Slice 4B visual harness replays (../states/),
 * through the production LightboxService (measuring the numbers against the
 * MG preset and a writer's average), LightboxHandler (with its handoff route
 * and tray), LightboxReadingHandler, LightboxReadingRunner, codec, quote
 * verifier and term counter, the Workshop's own WorkshopLightboxTileHandler
 * over a real WorkshopSessionService, and the real WorkshopSeedDelivery.
 * Only the provider is played: group D answers with the prompt bundle's
 * worked example, verbatim; groups A, B and C are off. The writer's average
 * is the test fixture's synthetic counts (`WRITER_AVERAGES`): the evidence
 * has no project folders. No provider is called.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-story.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR (default /tmp/lightbox-4b) for its output. Delete
 * the copy after. Writes states/chapter.json and states/workshop.json there
 * (see ../README.md for what each state holds) and states/log.txt.
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
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4b';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const RELATIVE_PATH = 'Drafts/alice-chapter-1-opening.md';
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

it('dumps the measured, read, stale, bound and Workshop states for group D', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  // The worked example's own excerpt: Chapter I, ¶1–¶8, as the example reads it.
  const opening = readWorkedExample('D').paragraphs.join('\n\n');
  const files = new Map<string, string>([[FILE_PATH, opening]]);
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
    { now: () => NOW, mintBoardId: () => `board-alice-${++boards}` },
    { measure: async () => WRITER_AVERAGES }
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
  const projectFiles = {
    catalog: { openCatalog: async () => ({ entries: () => [] }) },
    workspace: { workspaceFolders: () => [{ path: '/workspace', name: 'workspace' }] }
  } as never;

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
  const tileHandler = new WorkshopLightboxTileHandler(
    session,
    async (message) => { workshopPosted.push(message as never); },
    log,
    { postSessionState: () => { workshopPosted.push(sessionState() as never); }, markDirty: () => undefined, isRoomRunActive: () => false }
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
    if (!tiles.isGranted('workshop', deliveryId, RECEIVER)) {
      throw new Error('the accept is not under a grant');
    }
    await workshopRouter.route({
      type: MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE,
      source: 'webview.workshop.lightbox-tile',
      payload: { deliveryId, receiver: RECEIVER },
      timestamp: 1
    } as never);
    const staged = [...workshopPosted].reverse().find((message) => message.type === MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED);
    tiles.answer('workshop', staged?.payload.staged
      ? { deliveryId, opened: true }
      : { deliveryId, opened: false, reason: staged?.payload.reason }, RECEIVER);
    await settle();
  };

  const posted: ExtensionToWebviewMessage[] = [];
  const transport = async (message: ExtensionToWebviewMessage) => { posted.push(message); };
  const lightbox = new LightboxHandler(
    service, resolver, { pickFile: async () => undefined }, projectFiles, transport, log, handOffToWorkshop,
    { tray: workshopLightboxTray(session), openWorkshop: () => undefined }
  );
  const reading = new LightboxReadingHandler(
    service, runner, new LightboxContextShelf({ mintId: () => 'ctx-none' }), resolver, { pickFile: async () => undefined },
    projectFiles, transport, log
  );
  const router = new MessageRouter();
  lightbox.registerRoutes(router);
  reading.registerRoutes(router);
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  const lensesOff = [...lightboxGroupLenses('A'), ...lightboxGroupLenses('B'), ...lightboxGroupLenses('C')];
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
  const tileOf = (kind: string) => {
    const tile = board().readings.flatMap((group) => group.tiles).find((candidate) => candidate.kind === kind);
    if (!tile) {
      throw new Error(`no ${kind}`);
    }
    return tile;
  };

  // The tab opens on the chapter's opening with groups A–C off, and asks for the estimate.
  await route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file://${FILE_PATH}`, relativePath: RELATIVE_PATH });
  const priced = await estimate();
  const idle = since(posted, 0);
  expect(board().measured.numbers.rows.filter((row) => row.standout).map((row) => row.stat))
    .toEqual(['sentence-length', 'dialogue', 'intensifiers']);

  // Read group D; the stub answers with its worked example.
  let mark = posted.length;
  await route(MessageType.LIGHTBOX_RUN, { boardId: board().boardId, scope: { mode: 'all' }, estimateKey: priced.estimate.key, model: MODEL });
  await settle();
  expect([...pending.keys()]).toEqual(['D']);
  pending.get('D')?.settle(reply(readWorkedExample('D').response));
  await settle();
  const done = since(posted, mark);
  const estimates = { [lensesOff.slice().sort().join(',')]: answerOf(await estimate()) };
  const groupD = board().readings.find((entry) => entry.group === 'D');
  expect({ status: groupD?.status, blocks: groupD?.withheldBlocks, claims: groupD?.withheldClaims })
    .toEqual({ status: 'ok', blocks: [], claims: [] });

  // Bring the ¶4 handoff: the Workshop stages it, the tray and the answer follow.
  const handoff = tileOf('handoff');
  mark = posted.length;
  const bringing = route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board().boardId, tileId: handoff.id });
  await playWorkshopWebview();
  await bringing;
  await settle();
  const bound = since(posted, mark);
  expect(bound.map((message) => message.type)).toEqual([MessageType.LIGHTBOX_WORKSHOP_TRAY, MessageType.LIGHTBOX_HAND_OFF_RESULT]);
  expect(bound[1].payload).toMatchObject({ ok: true });
  const composer = [sessionState()];

  // The chapter changes on disk (¶7 edited) and is re-read: the readings carry over, stale.
  files.set(FILE_PATH, opening.replace('it was too dark to see anything', 'it was hard to see anything'));
  mark = posted.length;
  await route(MessageType.LIGHTBOX_REFRESH_SOURCE);
  await settle();
  const stale = since(posted, mark);
  expect(board().readings.find((entry) => entry.group === 'D')?.staleLenses?.map((entry) => entry.lens)).toEqual(['stock', 'rhythm', 'numbers']);
  // The changed text is a new estimate: the tab asks again, and the host prices the new board.
  const estimatesStale = { [lensesOff.slice().sort().join(',')]: answerOf(await estimate()) };

  clock.mockRestore();
  write('chapter', { lensesOff, idle, done, estimates, bound, stale, estimatesStale });
  write('workshop', { composer, handoff: since(workshopPosted, 0) });
  fs.writeFileSync(path.join(OUT, 'log.txt'), `${logged.join('\n')}\n`);

  // Only ids leave the webview, and no writer text or reading text is logged.
  expect(handoffs.map((entry) => entry.kind)).toEqual(['tile']);
  for (const needle of ['Rabbit', 'late', 'dear', 'curiosity', 'very', 'daisy', 'jar']) {
    expect(logged.join('\n')).not.toContain(needle);
  }
});
