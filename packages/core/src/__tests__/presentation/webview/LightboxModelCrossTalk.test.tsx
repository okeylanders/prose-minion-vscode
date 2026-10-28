/** @jest-environment jsdom */

/**
 * The writer's symptom (Slice 4L, epic decision 51): choosing a model in the
 * Lightbox cleared the Workshop's prompt-cache timer, because the Lightbox
 * read with the shared assistant model scope and its picker changed the
 * Workshop's model too. Now the Lightbox has a model of its own.
 *
 * End to end through the real parts that meet there:
 *
 * - the real Lightbox root and its header's actual model picker;
 * - the real Workshop root, its header chip and the composer's cache
 *   indicator;
 * - a real `ConfigurationHandler` per webview over one settings store, the
 *   real `AIResourceManager`, and the config watcher's hot-swap and
 *   broadcasts (`modelSettingsHarness`).
 *
 * Each webview sees only its own host's messages, in the order its host sent
 * them: the Lightbox's are delivered live; the Workshop's are recorded and
 * replayed into the Workshop root. Model ids are placeholders and the catalog
 * is a stubbed fetch: no provider is called.
 */
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type ExtensionToWebviewMessage,
  type WebviewToExtensionMessage,
  type WorkshopSessionStateMessage
} from '@messages';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  createModelSettingsHosts,
  disposeModelSettingsHosts,
  settleModelSettings,
  stubModelCatalog,
  type ModelSettingsSurface
} from '@/__tests__/application/handlers/domain/modelSettingsHarness';

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
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const WORKSHOP = 'placeholder/workshop-model';
const WORKSHOP_NEXT = 'placeholder/workshop-model-next';
const LIGHTBOX = 'placeholder/lightbox-model';
const LABELS = {
  [WORKSHOP]: 'Workshop placeholder',
  [WORKSHOP_NEXT]: 'Next Workshop placeholder',
  [LIGHTBOX]: 'Lightbox placeholder'
};

jest.setTimeout(60_000);
const eventually = (assertion: () => void) => waitFor(assertion, { timeout: 15_000 });

const dispatch = (message: ExtensionToWebviewMessage) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: message }));
  });

/** A Workshop room whose host's retained cache is warm on the Workshop's model. */
function warmWorkshopSession(cacheModel: string): WorkshopSessionStateMessage {
  const measuredAt = Date.now();
  return {
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    payload: {
      session: {
        scope: 'open',
        participantSubjectReady: true,
        excerptVersion: 0,
        replacementCount: 0,
        roomRevision: 1,
        contextRevision: 0,
        contextAttachments: [],
        pendingMessageAttachments: [],
        widgetConfigs: [],
        standingDirectives: [],
        todos: [],
        turns: [],
        turnRewindability: {},
        totalTurns: 0,
        truncatedTurns: 0,
        roomHasMemory: true,
        participants: {
          host: { personaId: 'jill', hasConversation: true },
          toolSidecars: [],
          personaGuests: [],
          chatTarget: { kind: 'host' }
        },
        conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
        contextBudget: {
          label: 'Host',
          snapshot: {
            estimatedCacheExpiresAt: measuredAt + 4 * 60_000,
            cacheRequestModelId: cacheModel,
            modelId: cacheModel,
            contextTokens: 12_000,
            promptTokens: 12_000,
            completionTokens: 400,
            peakPromptTokensThisTurn: 12_000,
            requestedMaxOutputTokens: 4_000,
            callsThisTurn: 1,
            turnProcessedTokens: 12_400,
            contextCompression: 'not-applied',
            measuredAt
          },
          sources: []
        }
      },
      writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
      webResearch: { enabled: false },
      persistence: { available: true, degradedConversationKeys: [] }
    },
    timestamp: measuredAt
  };
}

/** The webview half: a root's posts reach its own host's handler, on a later task, as across the panel boundary. */
function connectWebview(router: MessageRouter | null) {
  const vscode = createMockVSCode();
  vscode.postMessage.mockImplementation((message: WebviewToExtensionMessage) => {
    if (router?.hasHandler(message.type)) {
      setTimeout(() => void router.route(message), 0);
    }
  });
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  return vscode;
}

async function createHosts(initial: Record<string, unknown>) {
  let live: ModelSettingsSurface | null = null;
  const host = await createModelSettingsHosts(initial, {
    // Only the root on screen hears its host live; the others' messages wait in their inboxes.
    deliver: (surface, message) => {
      if (surface === live) {
        setTimeout(() => dispatch(message), 0);
      }
    }
  });
  const routerFor = (surface: ModelSettingsSurface) => {
    const router = new MessageRouter();
    host.handlers[surface].registerRoutes(router);
    return router;
  };
  return { ...host, routerFor, goLive: (surface: ModelSettingsSurface | null) => { live = surface; } };
}

const cacheIndicator = () => screen.queryByText(/Est\. Cache Time Remaining:/);

describe('the Lightbox model never moves the Workshop’s (Slice 4L, the writer’s symptom)', () => {
  beforeEach(() => stubModelCatalog([WORKSHOP, WORKSHOP_NEXT, LIGHTBOX], LABELS));

  afterEach(() => {
    disposeModelSettingsHosts();
    jest.restoreAllMocks();
    OpenRouterModels.clearCache();
  });

  it('keeps the Workshop composer’s cache expiry when a model is chosen in the Lightbox', async () => {
    const host = await createHosts({ assistantModel: WORKSHOP });
    // What the Workshop's host told it before the writer went to the Lightbox.
    await host.handlers.workshop.sendModelData();
    const workshopBefore = host.inboxes.workshop.length;

    // The Lightbox: its header's own picker, as the writer uses it.
    host.goLive('lightbox');
    connectWebview(host.routerFor('lightbox'));
    const lightbox = render(<LightboxApp />);
    const picker = () => lightbox.container.querySelector('.pm-ws-header-actions .model-selector-trigger') as HTMLButtonElement;
    await eventually(() => expect(picker().disabled).toBe(false));
    fireEvent.click(picker());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Lightbox placeholder/ }));
    await settleModelSettings();
    await settleModelSettings();
    lightbox.unmount();

    // The Workshop: its room with a warm cache, then everything its host sent it since.
    host.goLive(null);
    connectWebview(null);
    render(<WorkshopApp />);
    dispatch(host.inboxes.workshop[workshopBefore - 1]);
    dispatch(warmWorkshopSession(WORKSHOP));
    await eventually(() => expect(cacheIndicator()).not.toBeNull());
    const broadcasts = host.inboxes.workshop.slice(workshopBefore);
    broadcasts.forEach(dispatch);

    // The symptom: the expiry stays, because the Workshop's model did not move (on cf7f260 it is gone here).
    expect(cacheIndicator()).not.toBeNull();
    expect(cacheIndicator()?.textContent).toMatch(/Est\. Cache Time Remaining: \d+ min/);
    expect(screen.getByRole('button', { name: /^Browse assistant model options\. Current model: Workshop placeholder$/ })).not.toBeNull();
    expect(host.values.assistantModel).toBe(WORKSHOP);
    expect(host.values.lightboxModel).toBe(LIGHTBOX);
    // The Workshop did hear the change (the watcher's broadcast), and it named its own model unchanged.
    expect(broadcasts.filter((message) => message.type === MessageType.MODEL_DATA).length).toBeGreaterThan(0);
    expect(host.latestModelData('workshop')?.selections.assistant).toBe(WORKSHOP);
    expect(host.manager.getEngine('assistant')?.getModel()).toBe(WORKSHOP);
  });
});

describe('a Workshop pick and the Lightbox picker (Slice 4L)', () => {
  beforeEach(() => stubModelCatalog([WORKSHOP, WORKSHOP_NEXT, LIGHTBOX], LABELS));

  afterEach(() => {
    disposeModelSettingsHosts();
    jest.restoreAllMocks();
    OpenRouterModels.clearCache();
  });

  it.each([
    ['unset, follows it', {}, 'Same as Workshop (Next Workshop placeholder)'],
    ['set, keeps its own', { lightboxModel: LIGHTBOX }, 'Lightbox placeholder']
  ])('the Lightbox model, %s', async (_name, lightboxSetting, chip) => {
    const host = await createHosts({ assistantModel: WORKSHOP, ...lightboxSetting });

    await host.select('workshop', { scope: 'assistant', modelId: WORKSHOP_NEXT });

    host.goLive('lightbox');
    connectWebview(host.routerFor('lightbox'));
    render(<LightboxApp />);
    await eventually(() => expect(screen.getByRole('button', {
      name: `Browse lightbox model options. Current model: ${chip}`
    })).not.toBeNull());
  });
});
