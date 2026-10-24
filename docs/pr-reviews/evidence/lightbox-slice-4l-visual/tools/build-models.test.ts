/**
 * Builds the host messages the Slice 4L visual harness replays (../states/),
 * through the production ConfigurationHandler (one per webview: the sidebar,
 * the Lightbox tab and the Workshop tab), the AIResourceManager the
 * composition root owns, the config watcher's hot-swap and broadcasts
 * (`modelSettingsHarness`), and the production LightboxHandler,
 * LightboxReadingHandler, LightboxService and LightboxReadingRunner, whose
 * engines are that manager and whose prices are the real OpenRouterModels
 * cache. Only the catalog fetch is stubbed, with two placeholder models; no
 * provider is called, and nothing is read.
 *
 * What it records:
 * 1. Each tab's mount: the `MODEL_DATA` its own host answers with while the
 *    Lightbox has no model of its own (following the Workshop's), the
 *    Lightbox's board and its estimate on that model.
 * 2. A pick, for each payload a Lightbox picker can post when the writer
 *    chooses "Lightbox placeholder": this branch's (`scope: 'lightbox'`) and
 *    `cf7f260`'s (`scope: 'assistant'`, its header chip's only scope). Each
 *    runs on its own hosts: what the Lightbox's host answered, its estimate
 *    after, and what the watcher broadcast to the sidebar and the Workshop.
 *    The harness replays the one the page actually posted.
 * 3. "Same as Workshop" after this branch's pick (`modelId: null`).
 *
 * The Workshop's room (a warm cache on the Workshop's model) is written for
 * this evidence in the host's shape; it is not host output.
 *
 * Not part of the test suite: copy it to packages/core/src/__tests__/ and run
 * `npx jest packages/core/src/__tests__/build-models.test.ts`, with
 * $LIGHTBOX_EVIDENCE_DIR for its output. Delete the copy after. Writes
 * states/models.json and states/log.txt there.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type ExtensionToWebviewMessage,
  type SetModelSelectionPayload
} from '@messages';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { CHAPTER } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import {
  createModelSettingsHosts,
  disposeModelSettingsHosts,
  stubModelCatalog,
  type ModelSettingsSurface
} from '@/__tests__/application/handlers/domain/modelSettingsHarness';

const DIR = process.env.LIGHTBOX_EVIDENCE_DIR || '/tmp/lightbox-4l';
const OUT = `${DIR}/states`;
const WORKSHOP = 'placeholder/workshop-model';
const LIGHTBOX = 'placeholder/lightbox-model';
/** The other four scopes' model, so every id in the states is a placeholder. */
const OTHER = 'placeholder/other-model';
const LABELS = { [WORKSHOP]: 'Workshop placeholder', [LIGHTBOX]: 'Lightbox placeholder', [OTHER]: 'Other placeholder' };
/** Per token: the Workshop's model $3 / $15 per million, the Lightbox's $0.80 / $4. */
const PRICES = {
  [WORKSHOP]: { prompt: '0.000003', completion: '0.000015' },
  [LIGHTBOX]: { prompt: '0.0000008', completion: '0.000004' }
};

type Message = ExtensionToWebviewMessage;
/**
 * Recorded as sent, at timestamp 1, but for `MODEL_DATA`'s `categoryOptions`:
 * the curated category-search catalog, which these pages never read, is left
 * out so every model id in the states is a placeholder.
 */
const stamped = (messages: Message[]) => messages.map((message) => (message.type === MessageType.MODEL_DATA
  ? { ...message, timestamp: 1, payload: { ...message.payload, categoryOptions: undefined } }
  : { ...message, timestamp: 1 }));
const withoutRequest = <T extends { requestId?: unknown }>({ requestId: _requestId, ...payload }: T) => payload;

/** One world: the three tabs' configuration hosts, and the Lightbox's board and reading handlers over the same manager. */
async function world(lines: string[]) {
  const log = { appendLine: (line: string) => lines.push(line), show: () => undefined, clear: () => undefined };
  const hosts = await createModelSettingsHosts({
    assistantModel: WORKSHOP, dictionaryModel: OTHER, contextModel: OTHER, categoryModel: OTHER, widgetModel: OTHER
  });
  const lightboxPosted: Message[] = [];
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => 'board-alice' }
  );
  // The runner's engines are the composition root's manager; its prices the live catalog cache.
  const runner = new LightboxReadingRunner(
    hosts.manager,
    { loadPrompts: async (files: string[]) => `SYSTEM ${files.join(' + ')}` },
    { capture: async () => undefined },
    { present: async () => undefined },
    log
  );
  const router = new MessageRouter();
  const resolver = {} as TextSourceResolver;
  const picker = { pickFile: async () => undefined };
  const projectFiles = { catalog: { openCatalog: () => undefined }, workspace: { workspaceFolders: () => [] } };
  const deliver = async (message: Message) => { lightboxPosted.push(message); };
  new LightboxHandler(service, resolver, picker, projectFiles as never, deliver, log).registerRoutes(router);
  new LightboxReadingHandler(service, runner, new LightboxContextShelf(), resolver, picker, projectFiles as never, deliver, log)
    .registerRoutes(router);
  await service.buildBoard({ kind: 'file', text: CHAPTER, displayPath: 'Drafts/alice-1.md' });
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);

  /** The host's estimate for the board with every lens on, without its request id. */
  const estimate = async (name: string) => {
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: `estimate-${name}` });
    const answer = lightboxPosted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE)
      .map((message) => message.payload as { requestId?: string })
      .find((payload) => payload.requestId === `estimate-${name}`);
    if (!answer) {
      throw new Error(`no estimate for ${name}`);
    }
    return withoutRequest(answer);
  };
  const since = (surface: ModelSettingsSurface, from: number) =>
    stamped(hosts.inboxes[surface].slice(from).filter((message) => message.type === MessageType.MODEL_DATA));
  const mark = () => ({ sidebar: hosts.inboxes.sidebar.length, lightbox: hosts.inboxes.lightbox.length, workshop: hosts.inboxes.workshop.length });

  /** Each tab's mount: its host's answer to the chrome's REQUEST_MODEL_DATA. */
  const mount = async () => {
    const from = mark();
    for (const surface of ['sidebar', 'lightbox', 'workshop'] as const) {
      await hosts.handlers[surface].handleRequestModelData({
        type: MessageType.REQUEST_MODEL_DATA, source: `webview.${surface}`, payload: {}, timestamp: 1
      });
    }
    await route(MessageType.LIGHTBOX_REQUEST_BOARD);
    const board = lightboxPosted.filter((message) => message.type === MessageType.LIGHTBOX_BOARD).at(-1) as Message;
    return {
      sidebar: since('sidebar', from.sidebar),
      lightbox: since('lightbox', from.lightbox),
      workshop: since('workshop', from.workshop),
      board: stamped([board]),
      estimate: await estimate('mount')
    };
  };

  /** A pick as a Lightbox picker posts it: what each tab's host sent it after, and the Lightbox's estimate. */
  const pick = async (payload: SetModelSelectionPayload, name: string) => {
    const from = mark();
    await hosts.select('lightbox', payload);
    return {
      posted: payload,
      lightbox: since('lightbox', from.lightbox),
      sidebar: since('sidebar', from.sidebar),
      workshop: since('workshop', from.workshop),
      estimate: await estimate(name),
      settings: { assistantModel: hosts.values.assistantModel ?? null, lightboxModel: hosts.values.lightboxModel ?? null },
      engines: { assistant: hosts.manager.getEngine('assistant')?.getModel(), lightbox: hosts.manager.getEngine('lightbox')?.getModel() }
    };
  };
  return { hosts, mount, pick };
}

/**
 * The Workshop's room, written for this evidence in the host's shape (not
 * host output): one turn back, its cache warm on the Workshop's model, the
 * estimate four minutes from the harness's pinned clock (3:00 PM UTC,
 * Oct 24, 2026).
 */
function workshopRoom() {
  const measuredAt = Date.parse('2026-10-24T15:00:00.000Z');
  return {
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    timestamp: 1,
    payload: {
      session: {
        scope: 'open', participantSubjectReady: true, excerptVersion: 0, replacementCount: 0,
        roomRevision: 1, contextRevision: 0, contextAttachments: [], pendingMessageAttachments: [],
        widgetConfigs: [], standingDirectives: [], todos: [], turnRewindability: {},
        turns: [
          { id: 'turn-1', role: 'user', kind: 'message', participant: 'writer', artifact: 'persona_message', content: 'What does the rabbit hole open with?', timestamp: measuredAt - 60_000, excerptVersion: 0 },
          { id: 'turn-2', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message', personaId: 'jill', content: 'With a girl beside her sister on the bank, and a book with no pictures in it.', timestamp: measuredAt, excerptVersion: 0 }
        ],
        totalTurns: 2, truncatedTurns: 0, roomHasMemory: true,
        participants: { host: { personaId: 'jill', hasConversation: true }, toolSidecars: [], personaGuests: [], chatTarget: { kind: 'host' } },
        conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
        contextBudget: {
          label: 'Host',
          snapshot: {
            estimatedCacheExpiresAt: measuredAt + 4 * 60_000, cacheRequestModelId: WORKSHOP, modelId: WORKSHOP,
            contextTokens: 12_000, promptTokens: 12_000, completionTokens: 400, peakPromptTokensThisTurn: 12_000,
            requestedMaxOutputTokens: 4_000, callsThisTurn: 1, turnProcessedTokens: 12_400,
            contextCompression: 'not-applied', measuredAt
          },
          sources: []
        }
      },
      writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
      webResearch: { enabled: false },
      persistence: { available: true, degradedConversationKeys: [] }
    }
  };
}

afterEach(() => {
  disposeModelSettingsHosts();
  jest.restoreAllMocks();
  OpenRouterModels.clearCache();
});

it('dumps the mount, pick and follow-again states', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  stubModelCatalog([WORKSHOP, LIGHTBOX, OTHER], LABELS, PRICES);
  const lines: string[] = [];

  // This branch's picker: the Lightbox's own scope.
  const own = await world(lines);
  const mounted = await own.mount();
  expect(mounted.lightbox.at(-1)?.payload).toMatchObject({ selections: { assistant: WORKSHOP, lightbox: WORKSHOP }, following: ['lightbox'] });
  expect(mounted.estimate).toMatchObject({ estimate: { model: WORKSHOP } });
  const ownPick = await own.pick({ scope: 'lightbox', modelId: LIGHTBOX }, 'own');
  expect(ownPick.settings).toEqual({ assistantModel: WORKSHOP, lightboxModel: LIGHTBOX });
  expect(ownPick.engines).toEqual({ assistant: WORKSHOP, lightbox: LIGHTBOX });
  expect(ownPick.lightbox.at(-1)?.payload).toMatchObject({ selections: { assistant: WORKSHOP, lightbox: LIGHTBOX }, following: [] });
  expect(ownPick.workshop.at(-1)?.payload).toMatchObject({ selections: { assistant: WORKSHOP } });
  expect(ownPick.estimate).toMatchObject({ estimate: { model: LIGHTBOX } });
  const followAgain = await own.pick({ scope: 'lightbox', modelId: null }, 'follow');
  expect(followAgain.settings).toEqual({ assistantModel: WORKSHOP, lightboxModel: null });
  expect(followAgain.lightbox.at(-1)?.payload).toMatchObject({ selections: { lightbox: WORKSHOP }, following: ['lightbox'] });

  // cf7f260's picker: the shared assistant scope, the writer's symptom.
  stubModelCatalog([WORKSHOP, LIGHTBOX, OTHER], LABELS, PRICES);
  const shared = await world(lines);
  await shared.mount();
  const sharedPick = await shared.pick({ scope: 'assistant', modelId: LIGHTBOX }, 'shared');
  expect(sharedPick.settings).toEqual({ assistantModel: LIGHTBOX, lightboxModel: null });
  expect(sharedPick.workshop.at(-1)?.payload).toMatchObject({ selections: { assistant: LIGHTBOX } });

  const states = {
    models: LABELS,
    workshopRoom: workshopRoom(),
    mount: mounted,
    picks: {
      [`lightbox:${LIGHTBOX}`]: ownPick,
      [`assistant:${LIGHTBOX}`]: sharedPick
    },
    followAgain
  };
  fs.writeFileSync(path.join(OUT, 'models.json'), `${JSON.stringify(states, null, 2)}\n`);
  // Every model id the states carry is a placeholder.
  const ids = new Set(JSON.stringify(states).match(/"[a-z0-9-]+\/[a-z0-9.:-]+"/g) ?? []);
  expect([...ids].filter((id) => !id.startsWith('"placeholder/') && !id.includes('alice'))).toEqual([]);
  // The log names scopes, keys and model ids; never the chapter's words.
  const hostLines = [own, shared].flatMap(({ hosts }) => hosts.log.appendLine.mock.calls.map(([line]) => String(line)));
  const log = `${[...hostLines, ...lines].join('\n')}\n`;
  for (const paragraph of CHAPTER.split('\n\n')) {
    expect(log.includes(paragraph.slice(0, 40))).toBe(false);
  }
  fs.writeFileSync(path.join(OUT, 'log.txt'), log);
});
