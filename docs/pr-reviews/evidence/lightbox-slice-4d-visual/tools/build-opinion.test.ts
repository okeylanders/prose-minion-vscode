/**
 * Builds the host messages the Slice 4D visual harness replays (../states/),
 * through the production LightboxService (measuring the numbers against a
 * writer's average, and the Sections lane), LightboxHandler (with its
 * handoff route and tray), LightboxReadingHandler, LightboxReadingRunner,
 * prompt builder, codec, quote verifier, term counter, the Opinion's digest
 * and gates, the Workshop's own WorkshopLightboxTileHandler over a real
 * WorkshopSessionService, and the real WorkshopSeedDelivery. Only the
 * provider is played: groups A, B, D, E and F answer with the prompt
 * bundle's worked examples, verbatim, with group F's example's lenses on and
 * under its run token, so group F's request is its worked example's, byte
 * for byte. Two later answers are written for this evidence: an Opinion
 * re-read whose Blunt view prescribes (so code withholds it), and a stock
 * re-read (the worked example again, under new ids). The writer's average
 * is the test fixture's synthetic counts (`WRITER_AVERAGES`); no
 * publishing-standards preset, as the worked example's board. No provider
 * is called.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-opinion.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/chapter.json and states/workshop.json there (see ../README.md for
 * what each state holds) and states/log.txt.
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
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { PromptLoader } from '@/tools/shared/prompts';
import { FileType } from '@/platform';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxBoard,
  type LightboxLensId,
  type LightboxReadingGroupId,
  type LightboxWorkshopHandoff,
  type WorkshopSeedOutcome
} from '@messages';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { frame, framedJson, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { OPINION_EXAMPLE_LENSES_OFF, OPINION_EXAMPLE_PREFIX } from '@/__tests__/infrastructure/lightbox/lightboxOpinionFixtures';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4d';
const OUT = `${DIR}/states`;
const EXTENSION_PATH = `${__dirname}/../..`;
const MODEL = 'provider/reader-model';
/** Stub pricing for the stub model: $3 and $15 per million tokens. */
const PRICING = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };
const RELATIVE_PATH = 'Drafts/alice-chapter-1-opening.md';
const FILE_PATH = `/workspace/${RELATIVE_PATH}`;
const RECEIVER = 'receiver-evidence';
const NOW = Date.UTC(2026, 9, 21, 9, 12);
/** The sentence of the Blunt view that the re-read's answer turns into a prescription. */
const BLUNT_SENTENCE = 'In the fall that is the point; in the chase it costs momentum.';
const BLUNT_PRESCRIBES = 'In the chase the sentences should be shorter.';

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

it('dumps the read, bound, withheld, stale and Workshop states for group F', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  // The worked examples' own excerpt: Chapter I, ¶1–¶8.
  const paragraphs = readWorkedExample('A').paragraphs;
  const opening = paragraphs.join('\n\n');
  const files = new Map<string, string>([[FILE_PATH, opening]]);
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
  const answer = async (group: LightboxReadingGroupId, raw: string) => {
    const call = pending.get(group);
    if (!call) {
      throw new Error(`group ${group} was not asked`);
    }
    pending.delete(group);
    call.settle(reply(raw));
    await settle();
    return call.request;
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
      // The first run under group F's worked example's token, so its ids are the example's.
      mintToken: () => (++tokens === 1 ? `${OPINION_EXAMPLE_PREFIX}-evidence` : `run-${tokens}-evidence`)
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
  const lensesOff: LightboxLensId[] = [...OPINION_EXAMPLE_LENSES_OFF];
  let requests = 0;
  const estimate = async () => {
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff, requestId: `evidence-${++requests}` });
    await settle();
    const found = [...posted].reverse().find((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE);
    if (!found || !('estimate' in found.payload) || !found.payload.estimate) {
      throw new Error('expected an estimate');
    }
    return found.payload as { requestId?: string; estimate: { key: string } };
  };
  const press = async (scope: object) => {
    const priced = await estimate();
    await route(MessageType.LIGHTBOX_RUN, { boardId: board().boardId, scope, estimateKey: priced.estimate.key, model: MODEL });
    await settle();
  };
  const board = (): LightboxBoard => service.currentBoard() as LightboxBoard;
  const opinion = () => {
    const tile = lightboxOpinionTile(board());
    if (!tile) {
      throw new Error('expected the Opinion on the board');
    }
    return tile;
  };

  // The tab opens on the chapter's opening with group F's example's lenses, and asks for the estimate.
  await route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: `file://${FILE_PATH}`, relativePath: RELATIVE_PATH });
  await estimate();
  const idle = since(posted, 0);

  // The press: A, B, D and E answer with their worked examples; only then is F asked, on the board they left.
  let mark = posted.length;
  await press({ mode: 'all' });
  expect([...pending.keys()].sort()).toEqual(['A', 'B', 'D', 'E']);
  for (const group of ['A', 'B', 'D', 'E'] as const) {
    expect(pending.has('F')).toBe(false);
    await answer(group, readWorkedExample(group).response);
  }
  const fRequest = await answer('F', readWorkedExample('F').response);
  expect(fRequest.userMessage).toBe(readWorkedExample('F').request);
  const done = since(posted, mark);
  const estimates = { [lensesOff.slice().sort().join(',')]: answerOf(await estimate()) };
  const read = opinion();
  expect([read.observations.length, read.views.length, read.withheldViews.length]).toEqual([6, 3, 0]);

  // Bring the Blunt view, by name: the Workshop stages it, the tray and the answer follow.
  mark = posted.length;
  const bringing = route(MessageType.LIGHTBOX_HAND_OFF, { kind: 'tile', boardId: board().boardId, tileId: read.id, view: 'blunt' });
  await playWorkshopWebview();
  await bringing;
  await settle();
  const bound = since(posted, mark);
  expect(bound.map((message) => message.type)).toEqual([MessageType.LIGHTBOX_WORKSHOP_TRAY, MessageType.LIGHTBOX_HAND_OFF_RESULT]);
  expect(bound[1].payload).toMatchObject({ ok: true });
  const composer = [sessionState()];

  // The Opinion re-read: this answer's Blunt view prescribes, so code withholds that view and keeps the others.
  mark = posted.length;
  await press({ mode: 'lens', lens: 'opinion' });
  expect([...pending.keys()]).toEqual(['F']);
  const body = framedJson(readWorkedExample('F').response) as { opinion: { views: { blunt: { body: string } } } };
  expect(body.opinion.views.blunt.body).toContain(BLUNT_SENTENCE);
  body.opinion.views.blunt.body = body.opinion.views.blunt.body.replace(BLUNT_SENTENCE, BLUNT_PRESCRIBES);
  await answer('F', frame('F', body));
  const withheld = since(posted, mark);
  expect(opinion().views.map((view) => view.view)).toEqual(['enthusiastic', 'neutral']);
  expect(opinion().withheldViews.map((entry) => entry.view)).toEqual(['blunt']);

  // A lens the Opinion cites is read again: its tiles get new ids, and the Opinion is stale.
  mark = posted.length;
  await press({ mode: 'lens', lens: 'stock' });
  expect([...pending.keys()]).toEqual(['D']);
  await answer('D', readWorkedExample('D').response);
  const stale = since(posted, mark);
  const standing = lightboxOpinionStanding(opinion(), board());
  expect(standing).toMatchObject({ stale: true, readEarlier: false, changed: ['O1', 'O6'] });

  clock.mockRestore();
  write('chapter', { lensesOff, idle, done, estimates, bound, withheld, stale });
  write('workshop', { composer, handoff: since(workshopPosted, 0) });
  fs.writeFileSync(path.join(OUT, 'log.txt'), `${logged.join('\n')}\n`);

  // Only ids and a view's name leave the webview, and no writer text or reading text is logged.
  expect(handoffs.map((entry) => entry.kind)).toEqual(['tile']);
  for (const needle of ['Rabbit', 'Oh dear', 'deep well', 'marmalade', 'disappointment', 'momentum', 'stock phrase', 'narrator', 'should be shorter']) {
    expect(logged.join('\n')).not.toContain(needle);
  }
});
