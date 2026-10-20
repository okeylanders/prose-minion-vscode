/** @jest-environment jsdom */

/**
 * A Build lens opening handed over from the Lightbox installs nothing the
 * writer did not choose (PR #150 F-01). The production Workshop app on one
 * side; on the other, the real Apply boundary: WorkshopStandingDirectiveHandler,
 * WorkshopStandingDirectiveService and WorkshopSessionService. Only the
 * prompt-frame replacement and the handler's persistence callbacks are mocked,
 * and no provider is called. Every Apply the webview posts is routed through
 * that boundary, and its answer back to the webview.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopApplyStandingWidgetMessage,
  WorkshopLexicalGravityBuildSeedPayload,
  WorkshopSessionStateMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { WorkshopStandingDirectiveHandler } from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import {
  WorkshopStandingDirectiveService
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  builtInLexicalGravityLens,
  builtInLexicalGravityLenses
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
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
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const seedPayload = (seedId: string): WorkshopLexicalGravityBuildSeedPayload => ({
  seedId,
  seed: {
    origin: 'lightbox',
    field: 'Telescope',
    metaphor: 'The body as an instrument that folds and unfolds.',
    terms: [{ term: 'telescope', count: 2 }, { term: 'shutting', count: 2 }],
    sourceLabel: 'Drafts/alice-chapter-1.md'
  },
  subject: 'Telescope: telescope, shutting'
});

/** The real Apply boundary, and the state it commits. */
function createApplyBoundary() {
  const session = new WorkshopSessionService(() => 100);
  const replaceStandingDirectiveFrames = jest.fn().mockResolvedValue(undefined);
  const service = new WorkshopStandingDirectiveService(session, { replaceStandingDirectiveFrames } as never);
  const answers: unknown[] = [];
  const options = { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() };
  const handler = new WorkshopStandingDirectiveHandler(
    service,
    async (message) => {
      answers.push(message);
    },
    { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() },
    options
  );
  const installed = () => session.getStandingDirectives().map((directive) => ({
    revision: directive.revision,
    lensSlug: (session.getWidgetConfig(directive.widgetConfigId)?.draft as { lensSlug?: string } | undefined)?.lensSlug
  }));
  return { session, handler, options, answers, installed };
}

describe('WorkshopApp: a handed-over Build lens opening and the Apply boundary', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  let boundary: ReturnType<typeof createApplyBoundary>;
  let routed: number;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    boundary = createApplyBoundary();
    routed = 0;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const post = (data: unknown) => act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
  /** The room as the host would post it, with the boundary's real standing state. */
  const postRoom = () => {
    const snapshot = boundary.session.getSnapshot();
    const message: WorkshopSessionStateMessage = {
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
          widgetConfigs: snapshot.widgetConfigs,
          standingDirectives: snapshot.standingDirectives,
          todos: [],
          turns: [],
          turnRewindability: {},
          totalTurns: 0,
          truncatedTurns: 0,
          roomHasMemory: false,
          participants: {
            host: { personaId: 'jill', hasConversation: false },
            toolSidecars: [],
            personaGuests: [],
            chatTarget: { kind: 'host' }
          },
          conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
        },
        writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
        webResearch: { enabled: false },
        persistence: { available: true, degradedConversationKeys: [] }
      },
      timestamp: 0
    };
    post(message);
  };
  const postLenses = () => post({
    type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
    source: 'extension.workshop.lexical-gravity',
    timestamp: 1,
    payload: { lenses: builtInLexicalGravityLenses(), incompatibleResources: [], storagePath: 'prose-minion/lenses' }
  });
  /** The host sends the seed, the webview claims it, and the host grants the claim (PR #150 F-03). */
  const deliverSeed = (seedId: string) => {
    post({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 2,
      payload: seedPayload(seedId)
    });
    expect((vscode.postMessage as jest.Mock).mock.calls.at(-1)?.[0]).toMatchObject({
      type: MessageType.WORKSHOP_SEED_CLAIM,
      payload: { kind: 'lexical-gravity-build', deliveryId: seedId }
    });
    post({
      type: MessageType.WORKSHOP_SEED_CLAIM_RESULT,
      source: 'extension.workshop',
      timestamp: 3,
      payload: { kind: 'lexical-gravity-build', deliveryId: seedId, granted: true }
    });
  };
  const applies = () => (vscode.postMessage as jest.Mock).mock.calls
    .map(([message]) => message as WorkshopApplyStandingWidgetMessage)
    .filter((message) => message.type === MessageType.WORKSHOP_APPLY_STANDING_WIDGET);
  /** Route each new Apply through the real boundary, and its answer back to the webview. */
  const routeApplies = async () => {
    const pending = applies().slice(routed);
    routed += pending.length;
    for (const message of pending) {
      const before = boundary.answers.length;
      await act(async () => {
        await boundary.handler.handleApply(message);
      });
      boundary.answers.slice(before).forEach((answer) => post(answer));
    }
    return pending;
  };
  const sheet = () => screen.getByRole('dialog', { name: /Lexical Gravity/ });
  const install = () => within(sheet()).getByRole('button', { name: 'Install on passage' }) as HTMLButtonElement;
  const chooseLibraryLens = (name: string) => {
    fireEvent.click(within(sheet()).getByRole('tab', { name: /Library/ }));
    fireEvent.click(within(sheet()).getByTitle(name));
  };
  const openWorkshop = () => {
    render(<WorkshopApp />);
    postRoom();
    postLenses();
  };

  /** The opening as delivered: no lens, so nothing to preview or install. */
  const expectNoLensChosen = async () => {
    expect(within(sheet()).getByText(/No lens chosen yet\./)).not.toBeNull();
    expect(install().disabled).toBe(true);
    expect((within(sheet()).getByRole('button', { name: /Preview the Effect/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet()).queryByText('What the room is told')).toBeNull();
    fireEvent.click(install());
    expect(await routeApplies()).toEqual([]);
  };

  it('installs nothing until the writer picks a lens, then installs exactly that lens', async () => {
    openWorkshop();
    deliverSeed('lexical-build-seed-1');
    await expectNoLensChosen();
    expect(boundary.installed()).toEqual([]);
    expect(boundary.options.markDirty).not.toHaveBeenCalled();

    chooseLibraryLens('Music');
    expect(install().disabled).toBe(false);
    fireEvent.click(install());
    const [apply] = await routeApplies();
    expect(apply.payload).toMatchObject({ widgetId: 'lexical-gravity', draft: { lensSlug: 'music', resolvedLens: { name: 'Music' } } });
    expect(boundary.installed()).toEqual([{ revision: 1, lensSlug: 'music' }]);
    expect(boundary.options.postTurn).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringMatching(/^Lexical Gravity installed — Music · /)
    }));
    // The boundary's answer closes the sheet.
    expect(screen.queryByRole('dialog', { name: /Lexical Gravity/ })).toBeNull();
  });

  it('reopens without the earlier choice: a second opening has no lens either', async () => {
    openWorkshop();
    deliverSeed('lexical-build-seed-1');
    chooseLibraryLens('Music');
    expect(install().disabled).toBe(false);
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: /Lexical Gravity/ })).toBeNull();

    deliverSeed('lexical-build-seed-2');
    await expectNoLensChosen();
    expect(boundary.installed()).toEqual([]);
  });

  it('leaves an installed widget alone: the opening offers no lens, and a picked one is refused rather than shifted', async () => {
    const photography = builtInLexicalGravityLens('photography')!;
    await boundary.handler.handleApply({
      type: MessageType.WORKSHOP_APPLY_STANDING_WIDGET,
      source: 'webview.workshop',
      timestamp: 0,
      payload: {
        requestToken: 'apply-earlier',
        widgetId: 'lexical-gravity',
        draft: {
          lensSlug: 'photography',
          applicationMode: 'interpret',
          evidenceMode: 'blend',
          weight: 60,
          reach: 2,
          metaphorPull: false,
          resolvedLens: photography
        }
      }
    });
    expect(boundary.installed()).toEqual([{ revision: 1, lensSlug: 'photography' }]);
    openWorkshop();

    deliverSeed('lexical-build-seed-1');
    await expectNoLensChosen();
    expect(boundary.installed()).toEqual([{ revision: 1, lensSlug: 'photography' }]);

    chooseLibraryLens('Music');
    fireEvent.click(install());
    await routeApplies();
    expect(within(sheet()).getByRole('alert').textContent).toBe('Lexical Gravity is already active; reopen it to shift the directive.');
    expect(boundary.installed()).toEqual([{ revision: 1, lensSlug: 'photography' }]);
    expect(boundary.options.markDirty).toHaveBeenCalledTimes(1);
  });
});
