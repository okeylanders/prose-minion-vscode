import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { workshopPanelRooms } from './workshopPanelRooms';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { MessageHandler, MessageType, Platform } from '@prose-minion/core';

jest.mock('@prose-minion/core', () => ({
  MessageType: { WORKSHOP_REQUEST_SESSION: 'workshop_request_session', WORKSHOP_SESSION_STATE: 'workshop_session_state' },
  workshopExcerptTitle: jest.requireActual('@messages').workshopExcerptTitle,
  SURFACE_WORKSHOP: 'workshop',
  // The provider's own seed delivery is real; nothing here offers a seed. (The
  // whole barrel cannot load under jest, so its module is required directly.)
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  ...jest.requireActual('@/application/services/workshop/WorkshopRoomSlot'),
  WorkshopSeedDelivery: jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery').WorkshopSeedDelivery,
  MessageHandler: jest.fn(() => ({
    handleMessage: jest.fn().mockResolvedValue(undefined),
    flushCachedResults: jest.fn(),
    dispose: jest.fn()
  }))
}));
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));

describe('WorkshopPanelProvider retained session loading', () => {
  it('rechecks named state when a retained tab becomes visible, but not when it hides', async () => {
    let viewChanged!: () => void;
    const disposable = { dispose: jest.fn() };
    Object.assign(vscode.workspace, {
      onDidChangeConfiguration: jest.fn(() => disposable)
    });
    const panel = {
      visible: false,
      webview: {
        options: {},
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(() => disposable)
      },
      onDidChangeViewState: jest.fn((callback: () => void) => {
        viewChanged = callback;
        return disposable;
      }),
      onDidDispose: jest.fn(),
      dispose: jest.fn()
    };
    const provider = new WorkshopPanelProvider(
      vscode.Uri.file('/extension'),
      workshopPanelRooms(),
      { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
      {} as Platform
    );
    await provider.deserializeWebviewPanel(panel as unknown as vscode.WebviewPanel, undefined);
    const handler = (MessageHandler as jest.Mock).mock.results.at(-1)!.value;

    viewChanged();
    expect(handler.handleMessage).not.toHaveBeenCalled();
    panel.visible = true;
    viewChanged();
    expect(handler.handleMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_SESSION,
      source: 'webview.workshop',
      payload: {}
    }));
    expect(handler.flushCachedResults).toHaveBeenCalledTimes(1);
  });

  it('restores legacy and individual checkpoints, assigns fresh slots to duplicates and invalid state, and reopens a closed slot', async () => {
    const disposable = { dispose: jest.fn() };
    const makePanel = () => {
      let onClose!: () => void;
      const panel = {
        webview: { options: {}, html: '', onDidReceiveMessage: () => disposable, postMessage: jest.fn() },
        onDidChangeViewState: () => disposable,
        onDidDispose: (callback: () => void) => { onClose = callback; return disposable; },
        reveal: jest.fn(),
        dispose: () => onClose()
      };
      return panel as unknown as vscode.WebviewPanel;
    };
    Object.assign(vscode.workspace, { onDidChangeConfiguration: () => disposable });
    const rooms = workshopPanelRooms();
    const acquire = jest.spyOn(rooms, 'acquire');
    const release = jest.spyOn(rooms, 'release');
    const other = randomUUID();
    const picker = jest.fn(async (choices: unknown[]) => choices[0]);
    const create = jest.fn(makePanel);
    Object.assign(vscode.window, { showQuickPick: picker, createWebviewPanel: create });
    const workshop = new WorkshopPanelProvider(vscode.Uri.file('/ext'), rooms,
      { appendLine: jest.fn() } as unknown as vscode.OutputChannel, {} as Platform);
    const legacy = makePanel();
    const original = makePanel();
    await workshop.deserializeWebviewPanel(legacy, { workshopRailTab: 'about' });
    await workshop.deserializeWebviewPanel(original, { workshopRoomId: other });
    await workshop.deserializeWebviewPanel(original, { workshopRoomId: other });
    await workshop.deserializeWebviewPanel(makePanel(), { workshopRoomId: other });
    await workshop.deserializeWebviewPanel(makePanel(), { workshopRoomId: '../named' });
    await workshop.deserializeWebviewPanel(makePanel(), 'invalid');
    const ids = acquire.mock.calls.map(([id]) => id);
    expect(ids.slice(0, 2)).toEqual(['legacy', other]);
    expect(ids.slice(2)).toEqual(Array(3).fill(expect.stringMatching(/^[a-f0-9-]{36}$/)));
    expect(new Set(ids).size).toBe(5);
    // Both sessions name the same source. Only its basename is shown, and titles stay distinguishable.
    const post = (index: number) => (MessageHandler as jest.Mock).mock.calls.slice(-5)[index][1];
    const session = { excerpt: { source: { kind: 'file', relativePath: 'Drafts/chapter-3.md' } } };
    post(0)({ type: MessageType.WORKSHOP_SESSION_STATE, payload: { session } });
    post(1)({ type: MessageType.WORKSHOP_SESSION_STATE, payload: { session } });
    expect(legacy.title).toBe('Workshop · chapter-3');
    expect(original.title).toBe(`Workshop · chapter-3 (${other.slice(0, 8)})`);
    original.dispose();
    expect(release).toHaveBeenCalledWith(other);
    rooms.listRoomCheckpoints = async () => ids.map(roomId => ({ roomId, title: roomId, updatedAt: 'today' }));
    await workshop.reopenClosedRoom();
    expect(picker.mock.calls[0][0]).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(acquire.mock.calls.at(-1)).toEqual([other]);
    workshop.dispose();
  });
});
