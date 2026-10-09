/** @jest-environment jsdom */

/**
 * PR #140 review, F-01: a passage-selection reply is bound to the request
 * that asked for it and to the authoring lifetime. These regressions drive
 * the real `UIHandler` (clipboard fallback deferred, so the host's reply can
 * land arbitrarily late) and deliver its reply to the real `WorkshopApp`.
 *
 * Astra's four witnesses, now asserting the safe behaviour: a reply
 * superseded by later work, a reply across close and reopen, reversed
 * replies, and a reply across a room replacement. Plus: an ask invalidated by
 * a generation or a commit stays rejected after it settles, and current
 * asynchronous intake still works.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WORKSHOP_WRITER_PROFILE, MessageType } from '@messages';
import { UIHandler } from '@/application/handlers/domain/UIHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  createFakeEditorContext,
  createFakeFileSystem,
  createFakeGlobalState,
  createFakeShellService,
  createFakeWorkspace
} from '@/__tests__/mocks/platform';
import {
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

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
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const deliver = (data: unknown): void => {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data })); });
};

const room = (service: WorkshopSessionService) => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  timestamp: 0,
  payload: {
    session: service.getSnapshot(),
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
});

const roomWithExcerpt = (text: string): WorkshopSessionService => {
  const service = new WorkshopSessionService(() => 1);
  service.setSessionScope('open');
  service.replaceExcerpt({ text, source: { kind: 'manual' } });
  service.setSessionScope('excerpt');
  return service;
};

describe('Show vs. Tell passage intake is bound to its request and lifetime (F-01)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  /** One pending host clipboard read per Use selection click, in click order. */
  let clipboardReads: Array<(text: string) => void>;
  let forwarded: number;
  let host: UIHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    clipboardReads = [];
    forwarded = 0;
    host = new UIHandler(
      // The host's reply travels the real wire into the app.
      (message: unknown) => { deliver(message); return Promise.resolve(); },
      { appendLine: jest.fn() } as never,
      createFakeFileSystem(),
      createFakeWorkspace(),
      createFakeShellService({
        readClipboard: () => new Promise<string>((resolve) => { clipboardReads.push(resolve); })
      }),
      createFakeEditorContext(),
      createFakeGlobalState()
    );
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const sent = (type: MessageType) =>
    vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const sheet = (): HTMLElement | null => screen.queryByRole('dialog', { name: 'Show vs. Tell Playground' });
  const passageBox = (): HTMLTextAreaElement =>
    within(sheet()!).getByRole('textbox', { name: /Surrounding passage/ }) as HTMLTextAreaElement;

  /** Hand every not-yet-forwarded selection request to the real host handler. */
  const forwardRequests = async (): Promise<void> => {
    const calls = vscode.postMessage.mock.calls.map(([message]) => message);
    const pending = calls.slice(forwarded).filter((message) => message.type === MessageType.REQUEST_SELECTION);
    forwarded = calls.length;
    for (const request of pending) {
      await act(async () => { await host.handleSelectionRequest(request as never); });
    }
  };

  /** Click Use selection with no editor selection: the host parks on the clipboard. */
  const useSelection = async (): Promise<void> => {
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Use selection' }));
    // The handler awaits the clipboard, so the forward returns while the read is still parked.
    const calls = vscode.postMessage.mock.calls.map(([message]) => message);
    const pending = calls.slice(forwarded).filter((message) => message.type === MessageType.REQUEST_SELECTION);
    forwarded = calls.length;
    for (const request of pending) {
      void host.handleSelectionRequest(request as never);
    }
    await act(async () => { await Promise.resolve(); });
  };

  /** Resolve the `index`-th clipboard read; the host then posts its reply into the app. */
  const resolveClipboard = async (index: number, text: string): Promise<void> => {
    await act(async () => {
      clipboardReads[index](text);
      for (let tick = 0; tick < 6; tick += 1) {
        await Promise.resolve();
      }
    });
  };

  const openSheet = (service: WorkshopSessionService): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Show vs\. Tell Playground/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));
    expect(sheet()).not.toBeNull();
    void service;
  };

  const mount = (service: WorkshopSessionService): void => {
    render(<WorkshopApp />);
    deliver(room(service));
    openSheet(service);
    fireEvent.change(within(sheet()!).getByRole('textbox', { name: /Selected beat/ }), {
      target: { value: 'She hadn’t trusted him since the funeral.' }
    });
  };

  const generateAndSettle = (): void => {
    fireEvent.click(within(sheet()!).getByRole('button', { name: /Generate the workup/ }));
    const workup = generatedShowVsTellDraft().workup!;
    deliver({
      type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
      source: 'extension.workshop',
      timestamp: 5,
      payload: {
        widgetId: 'show-vs-tell',
        token: sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE).at(-1)!.payload.token,
        workupId: workup.workupId,
        ok: true,
        workup
      }
    });
    expect(within(sheet()!).getByRole('region', { name: 'Generated workup' })).toBeTruthy();
  };

  it('control: a current asynchronous clipboard reply fills the box, carrying the echoed request id', async () => {
    mount(roomWithExcerpt('Excerpt.'));
    await useSelection();
    expect(clipboardReads).toHaveLength(1);
    expect(sent(MessageType.REQUEST_SELECTION).at(-1)!.payload).toEqual({
      target: 'workshop_show_vs_tell_passage',
      requestId: expect.stringMatching(/^show-vs-tell-passage-/)
    });

    await resolveClipboard(0, 'From the clipboard, later.');

    expect(passageBox().value).toBe('From the clipboard, later.');
  });

  it('witness 1: a reply superseded by later work never replaces the newer passage or clears its workup', async () => {
    mount(roomWithExcerpt('Excerpt.'));
    await useSelection();
    fireEvent.change(passageBox(), { target: { value: 'Newer passage.' } });
    generateAndSettle();
    fireEvent.click(within(sheet()!).getByRole('checkbox', { name: 'Keep variant 3' }));

    await resolveClipboard(0, 'Old clipboard passage.');

    expect(passageBox().value).toBe('Newer passage.');
    expect(within(sheet()!).getByRole('region', { name: 'Generated workup' })).toBeTruthy();
    expect(within(sheet()!).getByRole('checkbox', { name: 'Keep variant 3' }).getAttribute('aria-checked')).toBe('true');
    expect(within(sheet()!).queryByText(/cleared because the surrounding passage changed/)).toBeNull();
  });

  it('witness 2: a reply requested before Cancel never fills a reopened sheet', async () => {
    const service = roomWithExcerpt('Excerpt.');
    mount(service);
    await useSelection();
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Cancel' }));
    expect(sheet()).toBeNull();
    openSheet(service);

    await resolveClipboard(0, 'From before the reopen.');

    expect(passageBox().value).toBe('');
  });

  it('witness 3: two asks fulfilled in reverse order leave the newer selection in the box', async () => {
    mount(roomWithExcerpt('Excerpt.'));
    await useSelection();
    await useSelection();
    expect(clipboardReads).toHaveLength(2);

    await resolveClipboard(1, 'Second ask.');
    await resolveClipboard(0, 'First ask.');

    expect(passageBox().value).toBe('Second ask.');
  });

  it('witness 4: a reply across a room replacement never overwrites text copied from the new excerpt', async () => {
    mount(roomWithExcerpt('Old room excerpt.'));
    await useSelection();
    deliver(room(roomWithExcerpt('New room excerpt.')));
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Use excerpt' }));
    expect(passageBox().value).toBe('New room excerpt.');

    await resolveClipboard(0, 'From the old room.');

    expect(passageBox().value).toBe('New room excerpt.');
  });

  it('an ask invalidated by a generation stays rejected after the workup settles', async () => {
    mount(roomWithExcerpt('Excerpt.'));
    await useSelection();
    generateAndSettle();

    await resolveClipboard(0, 'Settled late.');

    expect(passageBox().value).toBe('');
    expect(within(sheet()!).getByRole('region', { name: 'Generated workup' })).toBeTruthy();
  });

  it('an ask invalidated by a pending commit stays rejected after the host refuses it', async () => {
    mount(roomWithExcerpt('Excerpt.'));
    generateAndSettle();
    fireEvent.click(within(sheet()!).getByRole('checkbox', { name: 'Keep variant 3' }));
    await useSelection();
    fireEvent.click(within(sheet()!).getByRole('button', { name: 'Commit to thread' }));
    const [posted] = sent(MessageType.WORKSHOP_COMMIT_WIDGET);
    deliver({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 9,
      payload: { action: 'commit', requestToken: posted.payload.requestToken, widgetId: 'show-vs-tell', ok: false, message: 'Refused for the test.' }
    });
    expect(within(sheet()!).getByRole('button', { name: 'Commit to thread' })).toBeTruthy();

    await resolveClipboard(0, 'After the refusal.');

    expect(passageBox().value).toBe('');
    expect(within(sheet()!).getByRole('checkbox', { name: 'Keep variant 3' }).getAttribute('aria-checked')).toBe('true');
  });
});
