/** @jest-environment jsdom */

/**
 * Reading waits for the selected model to be saved and confirmed (PR #149
 * F-03 re-review), end to end through the real parts that meet there:
 *
 * - the real Lightbox root, with the shared header's actual model picker, on
 *   the Lightbox's own model scope (Slice 4L);
 * - the real `ConfigurationHandler`, whose settings write can be held open,
 *   which then sends `MODEL_DATA` as it does in the extension;
 * - the real `LightboxHandler`, `LightboxReadingHandler`, `LightboxService`
 *   and `LightboxReadingRunner`, pricing from the real `OpenRouterModels`
 *   catalog, served by a stubbed `fetch`;
 * - the config watcher's model hot-swap when the write lands, as
 *   `MessageHandler.handleConfigurationChange` applies it, resolved by the
 *   real `resolveModelScopeSelections`: the Lightbox follows the assistant
 *   model until it has one of its own.
 *
 * Messages cross between the webview and the host asynchronously, as in the
 * panel. Only the provider is played: its engine records the model each call
 * runs on and answers with the prompt bundle's worked examples (Lewis
 * Carroll's "Alice's Adventures in Wonderland", 1865, public domain). No
 * provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  ExtensionToWebviewMessage,
  LightboxReadingGroupId,
  MessageType,
  WebviewToExtensionMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { OpenRouterModels, type OpenRouterModel } from '@providers/OpenRouterModels';
import { resolveModelScopeSelections } from '@orchestration/ModelScopeSelections';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/lightbox/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/board.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/ribbon.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/tiles.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/rail.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/inspector.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/readings.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/gravity.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/story.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/craft.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/plot.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/opinion.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/steering.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/boards.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const CHEAP = 'provider/cheap';
const EXPENSIVE = 'provider/expensive';
const examples = Object.fromEntries(
  (['A', 'B', 'C'] as const).map((group) => [group, readWorkedExample(group)])
) as Record<LightboxReadingGroupId, ReturnType<typeof readWorkedExample>>;

const catalogEntry = (id: string, name: string, prompt: string, completion: string): OpenRouterModel => ({
  id, name, description: `${name} (stub)`, family: 'Stub', pricing: { prompt, completion },
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the catalog's wire field.
  context_length: 200_000
});

/**
 * Wait out a host round trip. A cold mount builds the board, fetches the
 * catalog and prices it, which on a busy test machine takes longer than
 * `waitFor`'s one-second default.
 */
const eventually = (assertion: () => void) => waitFor(assertion, { timeout: 10_000 });
jest.setTimeout(30_000);

/** Let host and webview exchange whatever is in flight. */
const settle = () => act(async () => {
  for (let round = 0; round < 10; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});

async function createHost() {
  // Settings: the assistant model, the Lightbox's following it, with a write that can be held open.
  const values: Record<string, unknown> = { assistantModel: CHEAP };
  const heldWrites: Array<() => void> = [];
  let holdWrites = false;
  const settings = {
    get: (_section: string, key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
    update: async (_section: string, key: string, value: unknown) => {
      if (holdWrites) {
        await new Promise<void>((resume) => heldWrites.push(resume));
      }
      values[key] = value;
      // The config watcher's refreshModelSelections: every scope's model resolved again.
      resolved = resolveModelScopeSelections(settings as never);
    }
  };
  // The resolved models, hot-swapped when a model write lands.
  let resolved: Record<string, string> = resolveModelScopeSelections(settings as never);

  // The live catalog, served to the real OpenRouterModels by a stubbed fetch.
  let catalog: OpenRouterModel[] = [
    catalogEntry(CHEAP, 'Cheap model', '0.000003', '0.000015'),
    catalogEntry(EXPENSIVE, 'Expensive new model', '0.00003', '0.00015')
  ];
  OpenRouterModels.clearCache();
  jest.spyOn(OpenRouterModels, 'getRecommendedModels').mockReturnValue(
    catalog.map(({ id, name, family, description }) => ({ id, name, family: family ?? 'Stub', description: description ?? '' })) as never
  );
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: catalog }) }));

  // The provider: records the model each call runs on (the hot-swapped client's).
  const models: string[] = [];
  let promptGate: Promise<void> | undefined;
  let openPrompts: (() => void) | undefined;
  const runInitial = jest.fn(async (request: InitialRunRequest): Promise<ExecutionResult> => {
    models.push(resolved.lightbox);
    const group = request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId;
    return {
      content: '', rawContent: examples[group].response, usedGuides: [], requestedResources: [], artifacts: [],
      finishReason: 'stop', modelId: resolved.lightbox
    };
  });
  // Only the Lightbox's engine runs readings; the assistant's must never be asked for.
  const enginesAsked: string[] = [];
  const resources = {
    getResolvedModelSelections: () => ({ ...resolved }),
    getResolvedModel: (scope: string) => resolved[scope],
    getEngine: (scope: string) => {
      enginesAsked.push(scope);
      return { runInitial };
    }
  };

  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const posted: ExtensionToWebviewMessage[] = [];
  // The host's messages reach the webview on a later task, as across the panel boundary.
  const deliver = async (message: ExtensionToWebviewMessage) => {
    posted.push(message);
    setTimeout(() => act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }));
    }), 0);
  };
  const service = new LightboxService(
    new ProseStatsService(createFakeFileSystem(), createFakeWorkspace()),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never,
    { mintBoardId: () => 'board-alice' }
  );
  const runner = new LightboxReadingRunner(
    resources,
    { loadPrompts: async (files: string[]) => { if (promptGate) { await promptGate; } return `SYSTEM ${files.join(' + ')}`; } },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log
  );
  const resolver = {} as TextSourceResolver;
  const picker = { pickFile: jest.fn(async () => undefined) };
  const router = new MessageRouter();
  new ConfigurationHandler(
    resources as never, {} as never, {} as never, {} as never, {} as never,
    { getApiKey: async () => 'sk-test' } as never,
    settings as never, {} as never, deliver, log
  ).registerRoutes(router);
  const projectFiles = { catalog: { openCatalog: jest.fn() }, workspace: { workspaceFolders: () => [] } };
  new LightboxHandler(service, resolver, picker, projectFiles as never, deliver, log).registerRoutes(router);
  new LightboxReadingHandler(service, runner, new LightboxContextShelf(), resolver, picker, projectFiles as never, deliver, log)
    .registerRoutes(router);

  await service.buildBoard({ kind: 'file', text: examples.A.paragraphs.join('\n\n'), displayPath: 'Drafts/alice-1.md' });

  // The webview's messages reach the host asynchronously, as in the panel.
  const vscode = createMockVSCode();
  vscode.postMessage.mockImplementation((message: WebviewToExtensionMessage) => {
    if (router.hasHandler(message.type)) {
      setTimeout(() => void router.route(message), 0);
    }
  });
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);

  const sent = (type: MessageType) =>
    vscode.postMessage.mock.calls.map(([message]) => message as WebviewToExtensionMessage).filter((message) => message.type === type);
  const answers = () => posted.filter((message) => message.type === MessageType.LIGHTBOX_RUN_ESTIMATE);
  return {
    runInitial,
    models,
    values,
    enginesAsked,
    sent,
    answers,
    posted,
    holdWrites: () => { holdWrites = true; },
    releaseWrites: () => { holdWrites = false; heldWrites.splice(0).forEach((resume) => resume()); },
    pendingWrites: () => heldWrites.length,
    holdPrompts: () => { promptGate = new Promise((open) => { openPrompts = open; }); },
    releasePrompts: () => { openPrompts?.(); promptGate = undefined; },
    setPrices: (id: string, prompt: string, completion: string) => {
      catalog = catalog.map((entry) => (entry.id === id ? { ...entry, pricing: { prompt, completion } } : entry));
    }
  };
}

const press = () => screen.getByRole('button', { name: /Run AI analyses/ }) as HTMLButtonElement;
const lensCost = () => screen.getByLabelText('Lenses').querySelector('.pm-lb-meta')?.textContent;
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /^Browse lightbox model options/ }));
const pick = (label: string) => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(label) }));

describe('reading waits for the selected model to be saved and confirmed (PR #149 F-03 re-review)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    OpenRouterModels.clearCache();
  });

  it('offers no press while a picked model is saving, then reads on the model the writer picked', async () => {
    const host = await createHost();
    render(<LightboxApp />);
    await eventually(() => expect(press().disabled).toBe(false));
    const cheapCost = lensCost();

    host.holdWrites();
    openPicker();
    await settle();
    pick('Expensive new model');
    await settle();
    expect(host.pendingWrites()).toBe(1);
    expect(screen.getByRole('button', { name: /Current model: Expensive new model/ })).not.toBeNull();

    // While the selection saves there is no price to press: the old model's would be the wrong one.
    expect(press().disabled).toBe(true);
    expect(screen.getByText('Estimating the cost…')).not.toBeNull();
    expect(lensCost()).toBe('Estimating…');
    fireEvent.click(press());
    await settle();
    expect(host.sent(MessageType.LIGHTBOX_RUN)).toEqual([]);
    expect(host.runInitial).not.toHaveBeenCalled();

    // The write lands; the host confirms it with MODEL_DATA; the Lightbox asks again and prices the new model.
    const confirmations = host.posted.filter((message) => message.type === MessageType.MODEL_DATA).length;
    host.releaseWrites();
    await eventually(() => expect(host.posted.filter((message) => message.type === MessageType.MODEL_DATA).length).toBeGreaterThan(confirmations));
    await eventually(() => expect(press().disabled).toBe(false));
    expect(host.answers().at(-1)?.payload).toMatchObject({ estimate: { model: EXPENSIVE } });
    expect(lensCost()).not.toBe(cheapCost);

    fireEvent.click(press());
    // Groups A–E and G, then the Opinion (Slices 4D, 4F), all on the model the writer picked.
    await eventually(() => expect(host.runInitial).toHaveBeenCalledTimes(7));
    expect(host.models).toEqual(Array(7).fill(EXPENSIVE));
    expect(host.sent(MessageType.LIGHTBOX_RUN).map((message) => (message.payload as { model: string }).model)).toEqual([EXPENSIVE]);
    expect(host.posted.some((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS && message.payload.phase === 'refused')).toBe(false);
    // The pick was the Lightbox's own (Slice 4L): the Workshop's assistant model never moved.
    expect(host.values).toMatchObject({ assistantModel: CHEAP, lightboxModel: EXPENSIVE });
    expect(new Set(host.enginesAsked)).toEqual(new Set(['lightbox']));
  });

  it('refuses an old-model answer even when it answers the latest request', async () => {
    const host = await createHost();
    render(<LightboxApp />);
    await eventually(() => expect(press().disabled).toBe(false));

    host.holdWrites();
    openPicker();
    await settle();
    pick('Expensive new model');
    await settle();
    // A lens toggle asks again while the selection saves; the host can only price the model it still has.
    // Group C's lenses all off (genre, and Slice 4's lineage and Spark), so a press makes five calls (A, B, D, E and F).
    for (const lens of [/Genre neighborhood/, /^Lineage/, /^Spark/]) {
      fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: lens }));
    }
    await settle();
    const request = host.sent(MessageType.LIGHTBOX_SET_LENSES).at(-1)?.payload as { requestId: string };
    const reply = host.answers().at(-1);
    expect(reply?.payload).toMatchObject({ requestId: request.requestId, estimate: { model: CHEAP } });
    expect(press().disabled).toBe(true);

    host.releaseWrites();
    await eventually(() => expect(press().disabled).toBe(false));
    expect(host.answers().at(-1)?.payload).toMatchObject({ estimate: { model: EXPENSIVE } });
    expect(lensCost()).toMatch(/^6 calls · /);
  });

  it('withdraws the price on a same-model catalog refresh until the new price is estimated', async () => {
    const host = await createHost();
    render(<LightboxApp />);
    await eventually(() => expect(press().disabled).toBe(false));
    const before = lensCost();

    // New prices for the same model; opening the picker refreshes the catalog and the host confirms it.
    host.setPrices(CHEAP, '0.000006', '0.00003');
    host.holdPrompts();
    const confirmations = host.posted.filter((message) => message.type === MessageType.MODEL_DATA).length;
    openPicker();
    await eventually(() => expect(host.posted.filter((message) => message.type === MessageType.MODEL_DATA).length).toBeGreaterThan(confirmations));
    await settle();
    expect(host.posted.filter((message) => message.type === MessageType.MODEL_DATA).at(-1)?.payload)
      .toMatchObject({ selections: { assistant: CHEAP, lightbox: CHEAP }, following: ['lightbox'] });
    expect(press().disabled).toBe(true);
    expect(lensCost()).toBe('Estimating…');

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    host.releasePrompts();
    await eventually(() => expect(press().disabled).toBe(false));
    expect(lensCost()).not.toBe(before);
    fireEvent.click(press());
    await eventually(() => expect(host.runInitial).toHaveBeenCalledTimes(7));
    expect(host.models).toEqual(Array(7).fill(CHEAP));
    expect(host.posted.some((message) => message.type === MessageType.LIGHTBOX_RUN_PROGRESS && message.payload.phase === 'refused')).toBe(false);
  });
});
