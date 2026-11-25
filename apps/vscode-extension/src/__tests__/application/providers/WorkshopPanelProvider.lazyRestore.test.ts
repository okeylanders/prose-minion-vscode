/** VS Code can show a restored tab in tabGroups before supplying its WebviewPanel to the serializer. */
import * as vscode from 'vscode';
import { MessageHandler, type Platform } from '@prose-minion/core';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { WorkshopPanelTab } from '@app/application/providers/WorkshopPanelTab';
import { workshopPanelRooms } from './workshopPanelRooms';

/* eslint-disable @typescript-eslint/naming-convention -- mocks match VS Code and core export names. */
jest.mock('vscode', () => ({
  window: {},
  commands: { executeCommand: jest.fn() },
  workspace: { workspaceFolders: [], onDidChangeConfiguration: () => ({ dispose() {} }) },
  Uri: { file: (value: string) => ({ path: value }), joinPath: () => ({}) },
  TabInputWebview: class { constructor(readonly viewType: string) {} },
  ViewColumn: { Active: -1, One: 1, Two: 2 }
}), { virtual: true });
jest.mock('@prose-minion/core', () => ({
  ...jest.requireActual('@/application/services/workshop/WorkshopRoomSlot'),
  WorkshopSeedDelivery: jest.requireActual('@/application/services/workshop/WorkshopSeedDelivery').WorkshopSeedDelivery,
  workshopExcerptTitle: jest.requireActual('@messages').workshopExcerptTitle,
  MessageHandler: jest.fn(() => ({ dispose: jest.fn(), handleMessage: jest.fn(), flushCachedResults: jest.fn() })),
  MessageType: { WORKSHOP_REQUEST_SESSION: 'workshop_request_session', WORKSHOP_SET_EXCERPT: 'workshop_set_excerpt' },
  SURFACE_WORKSHOP: 'workshop'
}));
/* eslint-enable @typescript-eslint/naming-convention */
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));

const originalType = 'prose-minion.workshop';
const secondary = 'b38c89b6-8417-40dc-b7bc-a756bd73dac0';
const disposable = { dispose() {} };
const buildOffer = { kind: 'lexical-gravity-seed' as const, seed: {
  origin: 'lightbox' as const, field: 'Clockwork', metaphor: 'The hour hand hesitates.', terms: [], sourceLabel: 'Chapter 2'
} };

function nativeHost() {
  const rooms = { ...workshopPanelRooms(), focus: jest.fn() };
  const acquire = jest.spyOn(rooms, 'acquire');
  const provider = new WorkshopPanelProvider(vscode.Uri.file('/extension'), rooms,
    { appendLine: jest.fn() } as unknown as vscode.OutputChannel, {} as Platform);
  type Group = { viewColumn: number; isActive: boolean; tabs: Tab[]; activeTab?: Tab };
  type Tab = { group: Group; label: string; input: object; isActive: boolean; attach?: () => Promise<void>; notifyClosed?: () => void };
  const groups: Group[] = [1, 2].map(viewColumn => ({ viewColumn, isActive: viewColumn === 1, tabs: [] }));
  let activeGroup = groups[0];
  const native = { all: groups, get activeTabGroup() { return activeGroup; } };
  const activate = (tab: Tab) => {
    activeGroup = tab.group;
    for (const group of groups) { group.isActive = group === tab.group; }
    for (const editor of tab.group.tabs) { editor.isActive = editor === tab; }
    tab.group.activeTab = tab;
  };
  const makeTab = (group: Group, input: object, label: string) => {
    const tab: Tab = { group, input, label, isActive: false };
    group.tabs.push(tab);
    return tab;
  };
  const panelFor = (tab: Tab, viewType: string) => ({
    title: tab.label, viewType, viewColumn: tab.group.viewColumn,
    get active() { return tab.group.isActive && tab.isActive; },
    get visible() { return tab.isActive; },
    webview: { options: {}, html: '', onDidReceiveMessage: () => disposable, postMessage: jest.fn() },
    onDidChangeViewState: () => disposable,
    onDidDispose: (notify: () => void) => { tab.notifyClosed = notify; return disposable; },
    reveal: jest.fn(() => activate(tab)), dispose: jest.fn()
  }) as unknown as vscode.WebviewPanel;
  // Both groups initially display documents, even though their Workshop tabs already exist.
  for (const group of groups) {
    group.activeTab = makeTab(group, {}, 'Manuscript.md');
    group.activeTab.isActive = true;
  }
  const serialized = jest.fn();
  const hidden = (roomId: string, viewType = originalType, delaySerialization = false) => {
    const tab = makeTab(groups[1], new vscode.TabInputWebview(`mainThreadWebview-${viewType}`), 'Workshop · Same title');
    const panel = panelFor(tab, viewType);
    const attach = async () => {
      tab.attach = undefined;
      serialized(roomId);
      // Old primary editors can contain only UI preferences, from before slot identifiers existed.
      await provider.deserializeWebviewPanel(panel, roomId === 'legacy' ? { workshopRailTab: 'about' } : { workshopRoomId: roomId });
    };
    if (delaySerialization) {
      // Native focus can complete a turn before VS Code calls the extension serializer.
      tab.attach = async () => { tab.attach = undefined; setTimeout(() => void attach(), 0); };
    } else {
      tab.attach = attach;
    }
    return tab;
  };
  const close = (tab: Tab) => {
    tab.group.tabs.splice(tab.group.tabs.indexOf(tab), 1);
    if (tab.group.activeTab === tab) { activate(tab.group.tabs[0]); }
    tab.notifyClosed?.();
  };
  const create = jest.fn((type: string, label: string) => {
    const tab = makeTab(activeGroup, new vscode.TabInputWebview(`mainThreadWebview-${type}`), label);
    activate(tab);
    return panelFor(tab, type);
  });
  Object.assign(vscode.window, { tabGroups: native, createWebviewPanel: create });
  const commands = (vscode.commands.executeCommand as jest.Mock).mockReset().mockImplementation(async (command: string, index?: number) => {
    if (command === 'workbench.action.focusNextGroup') {
      activeGroup = groups[(groups.indexOf(activeGroup) + 1) % groups.length];
      for (const group of groups) { group.isActive = group === activeGroup; }
      return;
    }
    if (command === 'workbench.action.openEditorAtIndex' && typeof index === 'number') {
      const target = activeGroup.tabs[index];
      if (!target) { throw new Error('No editor at that index in the active group'); }
      activate(target);
      await target.attach?.();
      return;
    }
    throw new Error(`Unexpected native editor command: ${command}`);
  });
  const holdSerializer = (tab: Tab) => {
    const resume = tab.attach!;
    const selected = new Promise<void>(resolve => {
      tab.attach = async () => { tab.attach = undefined; resolve(); };
    });
    // Let the native selection command finish independently of extension-host deserialization.
    return { selected: selected.then(() => new Promise<void>(resolve => setImmediate(resolve))), resume };
  };
  const excerpts = () => {
    const handlers = MessageHandler as unknown as jest.Mock;
    return acquire.mock.results.flatMap(({ value: { services } }, index) => {
      const instance = handlers.mock.calls.findIndex(([owner]) => owner === services);
      const handler = handlers.mock.results[instance]?.value;
      return (handler?.handleMessage.mock.calls ?? [])
        .filter(([msg]: [{ type: string }]) => msg.type === 'workshop_set_excerpt')
        .map(([msg]: [{ payload: { text: string } }]) => ({ roomId: acquire.mock.calls[index][0], text: msg.payload.text }));
    });
  };
  return { provider, acquire, focus: rooms.focus, hidden, serialized, holdSerializer, excerpts, close, create, commands, groups,
    active: () => activeGroup.activeTab };
}

describe('Workshop launchers with lazy native editors', () => {
  it.each([originalType, `${originalType}.primary`, `${originalType}.tab`])(
    '+ opens a new UUID slot when a %s tab exists but no panel has attached', async viewType => {
      const host = nativeHost();
      host.hidden(viewType === originalType + '.primary' ? 'legacy' : secondary, viewType);
      await host.provider.newWorkshopTab();
      expect(host.create.mock.calls.map(([type]) => type)).toEqual([originalType + '.tab']);
      expect(host.acquire.mock.calls).toEqual([[expect.stringMatching(/^[a-f0-9-]{36}$/)]]);
      expect(host.serialized).not.toHaveBeenCalled();
      expect(host.commands).not.toHaveBeenCalled();
    }
  );

  it('uses the primary for the first + when only unrelated editors exist', () => {
    const host = nativeHost();
    host.hidden(secondary, 'prose-minion.lightbox');
    host.hidden(secondary, originalType + '.unrelated');
    host.provider.newWorkshopTab();
    expect(host.acquire.mock.calls).toEqual([['legacy']]);
    expect(host.create.mock.calls.map(([type]) => type)).toEqual([originalType + '.primary']);
    expect(host.commands).not.toHaveBeenCalled();
  });

  it('restores the native primary directly when a hidden secondary has the same title', async () => {
    const host = nativeHost();
    host.hidden(secondary, originalType + '.tab');
    const original = host.hidden('legacy', originalType + '.primary', true);
    await Promise.all([host.provider.openOrReveal(), host.provider.openOrReveal()]);
    expect(host.serialized.mock.calls).toEqual([['legacy']]);
    expect(host.acquire.mock.calls).toEqual([['legacy']]);
    expect(host.active()).toBe(original);
    expect(host.create).not.toHaveBeenCalled();
  });

  it('sends an excerpt to the original dormant primary without creating a replacement native editor', async () => {
    const host = nativeHost();
    const original = host.hidden('legacy', originalType + '.primary');
    const excerpt = { text: 'A candle in the fourth-floor window.' };
    await host.provider.seedExcerpt(excerpt);
    // The native editor can also deserialize later through a manual tab selection.
    await original.attach?.();
    expect(host.acquire.mock.calls).toEqual([['legacy']]);
    expect(host.create).not.toHaveBeenCalled();
    expect(host.excerpts()).toEqual([{ roomId: 'legacy', text: excerpt.text }]);
  });

  it('captures a dormant Lightbox recipient without navigation and sends to the existing primary', async () => {
    const host = nativeHost();
    const original = host.hidden('legacy', originalType + '.primary');
    const offer = host.provider.captureLightboxTarget();
    expect(host.commands).not.toHaveBeenCalled();
    expect(host.acquire).not.toHaveBeenCalled();
    const receive = jest.spyOn(WorkshopPanelTab.prototype, 'seedLexicalGravityBuild').mockResolvedValue({ opened: true });
    try {
      await expect(offer.send(buildOffer)).resolves.toEqual({ opened: true });
      await original.attach?.();
      expect(host.create).not.toHaveBeenCalled();
      expect(host.acquire.mock.calls).toEqual([['legacy']]);
      expect(receive.mock.contexts.map(tab => tab.roomId)).toEqual(['legacy']);
    } finally {
      receive.mockRestore();
    }
  });

  it('declines Selected Text when only a dormant secondary exists and no recipient was selected', async () => {
    const host = nativeHost();
    host.hidden(secondary, originalType + '.tab');
    const receive = jest.spyOn(WorkshopPanelTab.prototype, 'stageSelectedText').mockResolvedValue({ opened: true });
    try {
      await expect(host.provider.stageSelectedText('captured-selection')).resolves.toMatchObject({ opened: false });
      expect(host.create).not.toHaveBeenCalled();
      expect(host.acquire).not.toHaveBeenCalled();
      expect(receive).not.toHaveBeenCalled();
    } finally {
      receive.mockRestore();
    }
  });

  it('joins a restoring Home for an excerpt and keeps its recipient through a subsequent +', async () => {
    const host = nativeHost();
    const original = host.hidden('legacy', originalType + '.primary');
    const held = host.holdSerializer(original);
    const home = host.provider.openOrReveal();
    await held.selected;
    const excerpt = { text: 'The watchman had already left.' };
    const delivery = host.provider.seedExcerpt(excerpt);
    host.provider.newWorkshopTab();
    await held.resume();
    await Promise.all([home, delivery]);
    expect(host.create.mock.calls.map(([type]) => type)).toEqual([originalType + '.tab']);
    expect(host.acquire.mock.calls).toEqual([[expect.stringMatching(/^[a-f0-9-]{36}$/)], ['legacy']]);
    expect(host.excerpts()).toEqual([{ roomId: 'legacy', text: excerpt.text }]);
  });

  it('keeps the newer + active and routes the next Lightbox handoff there after delayed Home', async () => {
    const host = nativeHost();
    const original = host.hidden('legacy', originalType + '.primary');
    const held = host.holdSerializer(original);
    const home = host.provider.openOrReveal();
    await held.selected;
    host.provider.newWorkshopTab();
    const fresh = host.active();
    const freshId = host.acquire.mock.calls[0][0];
    const ticket = host.provider.captureLightboxTarget().trayToken;
    expect(ticket).toEqual(expect.any(String));
    await held.resume();
    await home;
    expect(host.active()).toBe(fresh);
    expect(host.focus).toHaveBeenLastCalledWith(freshId);
    const next = host.provider.captureLightboxTarget();
    expect(next.trayToken).toBe(ticket);
    const receive = jest.spyOn(WorkshopPanelTab.prototype, 'seedLexicalGravityBuild').mockResolvedValue({ opened: true });
    try {
      await expect(next.send(buildOffer)).resolves.toEqual({ opened: true });
      expect(receive.mock.contexts.map(tab => tab.roomId)).toEqual([freshId]);
      expect(host.active()).toBe(fresh);
    } finally {
      receive.mockRestore();
    }
  });

  it('stops navigating historical editors when + supersedes Home during group selection', async () => {
    const host = nativeHost();
    const original = host.hidden('legacy');
    const execute = host.commands.getMockImplementation()!;
    let releaseFocus!: () => void;
    const paused = new Promise<void>(resolve => { releaseFocus = resolve; });
    const focused = new Promise<void>(resolve => {
      host.commands.mockImplementation(async (command, ...args) => {
        await execute(command, ...args);
        if (command === 'workbench.action.focusNextGroup') {
          resolve();
          await paused;
        }
      });
    });
    const home = host.provider.openOrReveal();
    await focused;
    host.provider.newWorkshopTab();
    const latest = host.active();
    const invoked = host.commands.mock.calls.length;
    releaseFocus();
    await original.attach?.(); // A dormant native editor may also deserialize in the background.
    await home;
    expect(host.commands.mock.calls.slice(invoked)).toEqual([]);
    expect(host.active()).toBe(latest);
    expect(host.focus).toHaveBeenLastCalledWith(host.acquire.mock.calls[0][0]);
  });

  it('keeps the UUID assigned to a colliding native primary after a new host starts', async () => {
    const primaryType = originalType + '.primary';
    const host = nativeHost();
    const original = host.hidden('legacy', primaryType);
    const duplicate = host.hidden('legacy', primaryType);
    await original.attach!();
    await duplicate.attach!();
    const [[primaryId], [reassigned]] = host.acquire.mock.calls;
    expect(primaryId).toBe('legacy');
    expect(reassigned).toMatch(/^[a-f0-9-]{36}$/);

    host.close(original);
    await host.provider.openOrReveal();
    expect(host.acquire.mock.calls).toEqual([['legacy'], [reassigned], ['legacy']]);
    expect(host.create.mock.calls.map(([type]) => type)).toEqual([primaryType]);

    const fresh = nativeHost();
    const retained = fresh.hidden(reassigned, primaryType);
    await fresh.provider.openOrReveal();
    expect(fresh.acquire.mock.calls).toEqual([[reassigned], ['legacy']]);
    expect(fresh.groups[1].tabs).toContain(retained);
    expect(fresh.create.mock.calls.map(([type]) => type)).toEqual([primaryType]);
  });

  it('finds a historical primary when a newer primary-type editor has a restored UUID', async () => {
    const host = nativeHost();
    host.hidden(secondary, originalType + '.primary');
    const original = host.hidden('legacy');
    await host.provider.openOrReveal();
    expect(host.acquire.mock.calls.filter(([id]) => id === 'legacy')).toHaveLength(1);
    expect(host.active()).toBe(original);
    expect(host.create).not.toHaveBeenCalled();
  });

  it('creates the missing primary without deserializing a tab already known to be secondary', async () => {
    const host = nativeHost();
    const existing = host.hidden(secondary, originalType + '.tab');
    await host.provider.openOrReveal();
    expect(host.create.mock.calls.map(([type]) => type)).toEqual([originalType + '.primary']);
    expect(host.acquire.mock.calls).toEqual([['legacy']]);
    expect(host.serialized).not.toHaveBeenCalled();
    expect(host.groups[1].tabs).toContain(existing);
  });

  it('Workshop finds the original hidden primary among identical native titles', async () => {
    const host = nativeHost();
    host.hidden(secondary);
    const original = host.hidden('legacy');
    await host.provider.openOrReveal();
    expect(host.create).not.toHaveBeenCalled();
    expect(host.serialized).toHaveBeenCalledWith('legacy');
    expect(host.active()).toBe(original);
    expect(host.acquire.mock.calls.filter(([id]) => id === 'legacy')).toHaveLength(1);
  });

  it('Workshop creates the genuinely missing primary without taking over the only hidden secondary', async () => {
    const host = nativeHost();
    const existing = host.hidden(secondary);
    await host.provider.openOrReveal();
    expect(host.serialized.mock.calls).toEqual([[secondary]]);
    expect(host.acquire.mock.calls).toEqual([[secondary], ['legacy']]);
    expect(host.create).toHaveBeenCalledTimes(1);
    expect(host.groups[1].tabs).toContain(existing);
    expect(host.active()).not.toBe(existing);
    // Invoking the same launcher again reveals the newly created primary.
    await host.provider.openOrReveal();
    expect(host.create).toHaveBeenCalledTimes(1);
    expect(host.acquire.mock.calls).toEqual([[secondary], ['legacy']]);
  });
});
