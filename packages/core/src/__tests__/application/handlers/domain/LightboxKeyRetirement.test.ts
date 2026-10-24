/**
 * PR #169 F-01: once the API key is removed or replaced, a Lightbox run in
 * progress starts no new provider request through the engine it holds.
 *
 * Through the production ConfigurationHandler (its key routes),
 * LightboxReadingHandler, LightboxService, LightboxReadingRunner,
 * AIResourceManager and AgentRunEngine, with real OpenRouterClients whose
 * streaming transport is the only stand-in: it records each request it
 * starts, and holds the first (group A) until the test releases it. A press
 * reads group A's lenses and the Opinion (group F), which starts only after A
 * settles, so F is the request a key change must stop. The p-limit mock runs
 * every chapter call at once, as the runner's default concurrency (one slot
 * per reading group) does. Group A answers with its worked example (Lewis
 * Carroll's "Alice's Adventures in Wonderland", 1865, public domain); model
 * ids and keys are placeholders. Nothing reaches a provider.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import {
  MessageType,
  type ExtensionToWebviewMessage,
  type LightboxLensId,
  type LightboxReadingGroup,
  type LightboxRunEstimate
} from '@messages';
import { LIGHTBOX_LENSES, lightboxGroupLenses } from '@shared/constants/lightbox';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const FIRST_KEY = 'sk-placeholder-first';
const NEXT_KEY = 'sk-placeholder-next';
const MISSING_KEY = 'Add an OpenRouter API key in Settings to run AI analyses.';
const exampleA = readWorkedExample('A');
/** Group A's lenses and the Opinion; every other lens off. */
const READ: LightboxLensId[] = [...lightboxGroupLenses('A'), 'opinion'];
const LENSES_OFF = LIGHTBOX_LENSES.map((lens) => lens.id).filter((lens) => !READ.includes(lens));

/** Let the host's queued work run: timers and promise continuations. */
const settle = async (rounds = 20) => {
  for (let round = 0; round < rounds; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
const until = async (condition: () => boolean, what: string) => {
  for (let attempt = 0; attempt < 400 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (!condition()) {
    throw new Error(`timed out waiting for ${what}`);
  }
};

async function createHost() {
  let savedKey: string | undefined = FIRST_KEY;
  const secrets = {
    getApiKey: jest.fn(async () => savedKey),
    setApiKey: jest.fn(async (next: string) => { savedKey = next; }),
    deleteApiKey: jest.fn(async () => { savedKey = undefined; }),
    onDidChange: jest.fn(() => ({ dispose: jest.fn() }))
  };
  const values: Record<string, unknown> = { assistantModel: 'placeholder/workshop-model' };
  const settings = {
    get: (_section: string, key: string, fallback?: unknown) => (values[key] !== undefined ? values[key] : fallback),
    update: async (_section: string, key: string, value: unknown) => { values[key] = value; }
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    secrets as never,
    settings as never,
    { createProvider: jest.fn() } as never,
    log
  );
  await manager.ensureInitialized();

  // The transport: every streaming request a client starts, by client; the first is held until released.
  const starts: OpenRouterClient[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstHeld = new Promise<void>((release) => { releaseFirst = release; });
  jest.spyOn(OpenRouterClient.prototype, 'createStreamingChatCompletion').mockImplementation(
    async function* stream(this: OpenRouterClient) {
      const index = starts.push(this) - 1;
      if (index === 0) {
        await firstHeld;
      }
      yield { token: index === 0 ? exampleA.response : 'Not a reading.', done: false };
      yield {
        token: '', done: true, finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costUsd: 0.001 }
      };
    }
  );

  const posted: ExtensionToWebviewMessage[] = [];
  const deliver = async (message: ExtensionToWebviewMessage) => { posted.push(message); };
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => 'board-alice' }
  );
  const runner = new LightboxReadingRunner(
    manager,
    { loadPrompts: async (files: string[]) => `SYSTEM ${files.join(' + ')}` },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log
  );
  const router = new MessageRouter();
  const refreshes = { refreshConfiguration: jest.fn(async () => undefined) };
  new ConfigurationHandler(
    manager, refreshes as never, refreshes as never, refreshes as never, secrets, settings as never,
    { showInformationMessage: jest.fn(async () => undefined) } as never, deliver, log
  ).registerRoutes(router);
  const projectFiles = { catalog: { openCatalog: jest.fn() }, workspace: { workspaceFolders: () => [] } };
  new LightboxReadingHandler(
    service, runner, new LightboxContextShelf(), {} as TextSourceResolver, { pickFile: jest.fn(async () => undefined) },
    projectFiles as never, deliver, log
  ).registerRoutes(router);
  const built = await service.buildBoard({ kind: 'file', text: exampleA.paragraphs.join('\n\n'), displayPath: 'Drafts/alice-1.md' });
  if (built.kind !== 'board') {
    throw new Error('expected a board');
  }
  const boardId = built.board.boardId;
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  const ofType = <T extends MessageType>(type: T) =>
    posted.filter((message) => message.type === type) as Array<Extract<ExtensionToWebviewMessage, { type: T }>>;

  let estimates = 0;
  /** Press as the webview does: ask for the estimate, then run what it priced. */
  const press = async (scope: object = { mode: 'all' }) => {
    const requestId = `estimate-${++estimates}`;
    await route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: LENSES_OFF, requestId });
    const estimate = ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).find((message) => message.payload.requestId === requestId)
      ?.payload.estimate as LightboxRunEstimate;
    await route(MessageType.LIGHTBOX_RUN, { boardId, scope, estimateKey: estimate.key, model: estimate.model });
    await settle();
  };
  const progress = () => ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
  const finished = () => progress().some((payload) => payload.phase === 'finished');
  const group = (id: string): LightboxReadingGroup | undefined =>
    ofType(MessageType.LIGHTBOX_GROUP_RESULT).map((message) => message.payload.group).filter((each) => each.group === id).at(-1);
  const keyStatus = () => ofType(MessageType.API_KEY_STATUS).map((message) => message.payload.hasSavedKey);

  return {
    manager, starts, boardId, route, press, progress, finished, group, keyStatus,
    release: () => releaseFirst?.(),
    engine: () => manager.getEngine('lightbox'),
    clientOf: (engine: unknown) => Reflect.get(engine as object, 'openRouterClient') as OpenRouterClient | undefined,
    keyOf: (client: OpenRouterClient | undefined) => (client ? Reflect.get(client, 'apiKey') as string : undefined)
  };
}

describe('a Lightbox run after its key is removed or replaced (PR #169 F-01)', () => {
  let host: Awaited<ReturnType<typeof createHost>>;

  afterEach(() => {
    host?.manager.dispose();
    jest.restoreAllMocks();
  });

  it('control: with the key kept, A and then the Opinion each start a request', async () => {
    host = await createHost();
    await host.press();
    await until(() => host.starts.length === 1, 'group A to start');
    host.release();
    await until(host.finished, 'the run to finish');

    expect(host.starts).toHaveLength(2);
    expect(host.group('A')?.status).toBe('ok');
  });

  it('starts no Opinion request once clearing the key is acknowledged; A, already sent, lands', async () => {
    host = await createHost();
    await host.press();
    await until(() => host.starts.length === 1, 'group A to start');

    await host.route(MessageType.DELETE_API_KEY);
    expect(host.keyStatus()).toEqual([false]);
    expect(host.engine()).toBeUndefined();

    host.release();
    await until(host.finished, 'the run to finish');

    expect(host.starts).toHaveLength(1);
    expect(host.group('A')?.status).toBe('ok');
    expect(host.group('F')).toMatchObject({ status: 'failed', error: MISSING_KEY });
  });

  it('retires the held engine when the key is replaced, through every webview\'s refresh, and the next press uses the new key', async () => {
    host = await createHost();
    await host.press();
    await until(() => host.starts.length === 1, 'group A to start');
    const held = host.engine();
    expect(host.keyOf(host.starts[0])).toBe(FIRST_KEY);

    // The handler's own refresh, then the other webviews' secret listeners, all at once.
    await Promise.all([
      host.route(MessageType.UPDATE_API_KEY, { apiKey: NEXT_KEY }),
      host.manager.refreshConfiguration(),
      host.manager.refreshConfiguration()
    ]);
    await host.manager.refreshModelSelections();
    expect(host.keyStatus()).toEqual([true]);
    const current = host.engine();
    expect(current).toBeDefined();
    expect(current).not.toBe(held);
    expect(held?.isProviderAvailable()).toBe(false);
    expect(host.keyOf(host.clientOf(current))).toBe(NEXT_KEY);

    host.release();
    await until(host.finished, 'the run to finish');
    expect(host.starts).toHaveLength(1);
    expect(host.group('A')?.status).toBe('ok');
    expect(host.group('F')).toMatchObject({ status: 'failed', error: MISSING_KEY });
    // No later refresh brings the old transport back.
    expect(held?.isProviderAvailable()).toBe(false);

    // Pressed again, the Opinion runs on the new engine and key.
    await host.press({ mode: 'group', group: 'F' });
    await until(() => host.starts.length === 2, 'the Opinion to start');
    expect(host.keyOf(host.starts[1])).toBe(NEXT_KEY);
    expect(host.starts[1]).toBe(host.clientOf(current));
  });

  it('control: Stop keeps the queued Opinion from starting', async () => {
    host = await createHost();
    await host.press();
    await until(() => host.starts.length === 1, 'group A to start');
    const run = host.progress().find((payload) => payload.phase === 'started');

    await host.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: host.boardId, token: run?.token });
    host.release();
    await settle(40);

    expect(host.starts).toHaveLength(1);
    expect(host.finished()).toBe(false);
  });

  it('control: without a key a press is refused before anything is reserved; with one again, it runs', async () => {
    host = await createHost();
    await host.route(MessageType.DELETE_API_KEY);
    await host.press();

    expect(host.starts).toHaveLength(0);
    expect(host.progress().at(-1)).toMatchObject({ phase: 'refused', message: MISSING_KEY });

    await host.route(MessageType.UPDATE_API_KEY, { apiKey: NEXT_KEY });
    await host.press();
    await until(() => host.starts.length === 1, 'group A to start');
    expect(host.keyOf(host.starts[0])).toBe(NEXT_KEY);
    host.release();
    await until(host.finished, 'the run to finish');
    expect(host.starts).toHaveLength(2);
  });
});
