/** Drive registered commands and native panel IPC through the actual activation graph. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { activate, deactivate } from '@app/extension';
import { LightboxPanelProvider } from '@app/application/providers/LightboxPanelProvider';
import { WorkshopPanelProvider } from '@app/application/providers/WorkshopPanelProvider';
import { WorkshopPanelTab } from '@app/application/providers/WorkshopPanelTab';
import { AIResourceManager, MessageHandler, MessageType, WorkshopSessionPersistenceCoordinator, WorkshopSessionService, WorkshopSessionStore, type ExtensionToWebviewMessage, type WebviewToExtensionMessage } from '@prose-minion/core';
/* eslint-disable no-restricted-imports -- real provider transport and reusable test fixtures live outside the host barrel. */
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { OpenRouterClient } from '@providers/OpenRouterClient';
/* eslint-enable no-restricted-imports */

/* eslint-disable @typescript-eslint/naming-convention -- these mocks use VS Code's public property names. */
jest.mock('vscode', () => {
  const noop = () => ({ dispose() {} });
  const uri = (path: string) => ({ fsPath: path, path, toString: () => 'file://' + path });
  return {
    languages: { createDiagnosticCollection: noop, registerCodeActionsProvider: noop },
    CodeActionKind: { QuickFix: 'quickfix' }, RelativePattern: class {}, ViewColumn: { Active: -1 },
    Uri: { file: uri, joinPath: (base: {path: string}, ...parts: string[]) => uri([base.path, ...parts].join('/')) },
    window: { createOutputChannel: () => ({ appendLine: mockOutputLine, dispose() {} }), showErrorMessage: jest.fn() },
    workspace: {}, commands: {}
  };
}, { virtual: true });
jest.mock('p-limit', () => () => (work: () => unknown) => work());
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));
jest.mock('@app/platform/vscode/VsCodeFileSystem', () => ({ VsCodeFileSystem: jest.fn(() => mockFiles) }));

/* eslint-enable @typescript-eslint/naming-convention */

const mockFiles = new MemoryFileSystem();
const mockOutputLine = jest.fn();
const unsub = () => ({ dispose() {} });
const deliveries = new WeakMap<object, ReturnType<typeof deferred<void>>>();
function editorPanel(activatePanel: () => void) {
  const ready = deferred<void>();
  let receive!: (message: unknown) => unknown;
  let closed!: () => void;
  let focus!: () => void;
  const posted: ExtensionToWebviewMessage[] = [];
  return {
    active: true, visible: true,
    webview: {
      onDidReceiveMessage: (listen: typeof receive) => { receive = listen; ready.resolve(); return unsub(); },
      postMessage: async (msg: ExtensionToWebviewMessage) => { posted.push(msg); return true; }
    },
    onDidDispose: (listen: typeof closed) => { closed = listen; return unsub(); },
    onDidChangeViewState: (listen: typeof focus) => { focus = listen; return unsub(); },
    reveal: jest.fn(() => {
      activatePanel();
      focus();
    }),
    dispose() { closed?.(); },
    async send(type: MessageType, payload = {}) {
      await ready.promise;
      const msg = { type, source: 'webview.workshop', payload, timestamp: Date.now() };
      const completed = deferred<void>();
      deliveries.set(msg, completed);
      receive(msg);
      return completed.promise;
    },
    posted,
    snapshot() {
      const last = posted.filter(msg => msg.type === MessageType.WORKSHOP_SESSION_STATE).at(-1);
      if (!last || last.type !== MessageType.WORKSHOP_SESSION_STATE) {
        throw new Error('No session snapshot');
      }
      return last.payload.session;
    }
  };
}

describe.each([
  { shape: 'single folder', folders: ['Book'] },
  { shape: 'no folders', folders: [] },
  { shape: 'two roots', folders: ['First', 'Second'] },
  { shape: 'two roots before first attachment', folders: ['Book', 'Other'] }
])('activated Workshop rooms with $shape', ({ folders, shape }) => {
  const panels: ReturnType<typeof editorPanel>[] = [];
  const serializers = jest.fn((_type: string, _provider: vscode.WebviewPanelSerializer) => unsub());
  const commands = new Map<string, () => unknown>();
  const subscriptions: vscode.Disposable[] = [];
  const engines = new Set<AIResourceManager>();
  let shutdownAfterWorkspaceChange = false;
  beforeAll(async () => {
    mockFiles.files.clear();
    jest.clearAllMocks();
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline test'));
    const initialize = AIResourceManager.prototype.ensureInitialized;
    jest.spyOn(AIResourceManager.prototype, 'ensureInitialized').mockImplementation(function (this: AIResourceManager) {
      engines.add(this);
      return initialize.call(this);
    });
    // Load the actual bundled prompts; writer files and checkpoints live in the test workspace.
    const readWorkspace = mockFiles.readFile.bind(mockFiles);
    jest.spyOn(mockFiles, 'readFile').mockImplementation(file => file.startsWith('/extension/resources/')
      ? readFile(path.join(__dirname, '../../../../../packages/core', file.slice('/extension/'.length)))
      : readWorkspace(file));
    Object.assign(vscode.window, {
      showTextDocument: async () => undefined,
      onDidChangeTextEditorSelection: unsub, onDidChangeActiveTextEditor: unsub,
      registerWebviewPanelSerializer: serializers, registerWebviewViewProvider: unsub,
      createWebviewPanel: () => {
        const panel = editorPanel(() => {
          panels.forEach(other => { other.active = other === panel; });
        });
        panels.forEach(other => { other.active = false; });
        panels.push(panel);
        return panel;
      }
    });
    Object.assign(vscode.workspace, {
      onDidChangeConfiguration: unsub, onDidChangeTextDocument: unsub,
      onDidCloseTextDocument: unsub, onDidChangeWorkspaceFolders: unsub,
      workspaceFolders: folders.map(name => ({ name, uri: vscode.Uri.file('/' + name) })),
      asRelativePath: (uri: vscode.Uri) => uri.fsPath.replace(/^\/Book\//, ''),
      findFiles: async () => [], openTextDocument: async () => ({}),
      getConfiguration: () => ({ get: (_: string, fallback: unknown) => fallback, inspect: () => undefined })
    });
    Object.assign(vscode.commands, {
      registerCommand: (name: string, action: () => unknown) => { commands.set(name, action); return unsub(); }
    });
    // Native IPC does not await the route. Observe its completion without replacing what it does.
    const realHandle = MessageHandler.prototype.handleMessage;
    jest.spyOn(MessageHandler.prototype, 'handleMessage').mockImplementation(function (this: MessageHandler, msg: WebviewToExtensionMessage) {
      const result = realHandle.call(this, msg);
      const completed = deliveries.get(msg);
      if (completed) {
        void result.then(() => completed.resolve(), completed.reject);
      }
      return result;
    });
    await activate({
      subscriptions, globalStorageUri: vscode.Uri.file('/storage'), extension: { packageJSON: { version: 'test' } }, extensionUri: vscode.Uri.file('/extension'),
      secrets: { get: async (key: string) => key === 'openRouterApiKey' ? 'offline-test-key' : undefined, onDidChange: unsub },
      globalState: { get: () => undefined, update: async () => {} }
    } as unknown as vscode.ExtensionContext);
  });
  afterAll(async () => {
    try {
      if (shutdownAfterWorkspaceChange) {
        await expect(deactivate()).rejects.toThrow('The Workshop workspace changed after this session was loaded');
      } else {
        await deactivate();
      }
    } finally {
      engines.forEach(manager => manager.dispose());
      subscriptions.reverse().forEach(part => part.dispose());
      jest.restoreAllMocks();
    }
  });

  if (shape === 'single folder') {
    it('registers every Workshop restore type to the same provider and Lightbox to its own provider', () => {
      const registrations = new Map(serializers.mock.calls);
      expect(serializers).toHaveBeenCalledTimes(4);
      const workshop = registrations.get('prose-minion.workshop');
      expect(workshop).toBeInstanceOf(WorkshopPanelProvider);
      expect(registrations.get('prose-minion.workshop.primary')).toBe(workshop);
      expect(registrations.get('prose-minion.workshop.tab')).toBe(workshop);
      expect(registrations.get('prose-minion.lightbox')).toBeInstanceOf(LightboxPanelProvider);
    });
  }

  // A failed send reports through IPC; surface that error when it never reaches the held transport.
  const waitForModel = (started: Promise<AbortSignal>, sending: Promise<void>, panel: ReturnType<typeof editorPanel>) =>
    Promise.race([started, sending.then(() => {
      throw new Error(JSON.stringify(panel.posted.filter(msg => msg.type === MessageType.ERROR)));
    })]);

  const open = async (command: 'openWorkshop' | 'newWorkshopTab', excerpt: string) => {
    const create = commands.get('prose-minion.' + command);
    if (!create) {
      throw new Error('Workshop command missing: ' + command);
    }
    await create();
    const panel = panels.find(candidate => candidate.active)!;
    await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: excerpt, source: { kind: 'manual' } });
    expect(panel.snapshot().excerpt?.text).toBe(excerpt);
    return panel;
  };

  if (shape === 'two roots before first attachment') {
    it('binds the first ordinary Workshop to the workspace at attachment, then protects that binding', async () => {
      const current = '/Book/prose-minion/sessions/current.json';
      const fixture = await readFile(path.join(__dirname,
        '../../../../../packages/core/src/__tests__/fixtures/workshop-session-v2-before-memory.json'));
      await mockFiles.writeFile(current, fixture);
      const saved = JSON.parse(fixture.toString()) as { sessionId: string; workshop: { excerpt: { text: string } } };
      const book = { name: 'Book', uri: vscode.Uri.file('/Book') };
      Object.assign(vscode.workspace, { workspaceFolders: [book] });
      await commands.get('prose-minion.newWorkshopTab')!();
      const panel = panels.at(-1)!;
      await panel.send(MessageType.WORKSHOP_REQUEST_SESSION);
      expect(panel.snapshot().excerpt?.text).toBe(saved.workshop.excerpt.text);

      const revised = 'The jar held a silver thimble.';
      await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: revised, source: { kind: 'manual' } });
      await panel.send(MessageType.WORKSHOP_LIST_SESSIONS, { requestId: 'after-edit' });
      expect(mockFiles.json(current)).toMatchObject({ sessionId: saved.sessionId, workshop: { excerpt: { text: revised } } });

      // An already attached slot keeps its original project when the sole folder changes again.
      Object.assign(vscode.workspace, { workspaceFolders: [{ name: 'Other', uri: vscode.Uri.file('/Other') }] });
      try {
        await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: 'Different manuscript.', source: { kind: 'manual' } });
        await panel.send(MessageType.WORKSHOP_LIST_SESSIONS, { requestId: 'after-root-change' });
        expect(mockFiles.json(current)).toMatchObject({ workshop: { excerpt: { text: revised } } });
        expect(mockFiles.files.has('/Other/prose-minion/sessions/current.json')).toBe(false);
        // The close drain must report that protected edit even after the former workspace returns.
        shutdownAfterWorkspaceChange = true;
      } finally {
        Object.assign(vscode.workspace, { workspaceFolders: [book] });
      }
    });
    return;
  }

  if (folders.length !== 1) {
    it('recovers each closed in-memory room from the native picker without a project file', async () => {
      const a = await open('openWorkshop', 'The door swung open.');
      const b = await open('newWorkshopTab', 'The rabbit checked the time.');
      a.dispose();
      b.dispose();

      const reopen = commands.get('prose-minion.reopenWorkshopRoom');
      expect(reopen).toBeDefined();
      let pick = 0;
      Object.assign(vscode.window, {
        showQuickPick: async (choices: { roomId: string }[]) => {
          expect(choices).toHaveLength(2 - pick);
          pick += 1;
          return choices[0];
        }
      });
      const found: string[] = [];
      for (let i = 0; i < 2; i++) {
        await reopen!();
        const restored = panels.at(-1)!;
        await restored.send(MessageType.WORKSHOP_REQUEST_SESSION);
        found.push(restored.snapshot().excerpt!.text);
      }
      expect(found.sort()).toEqual(['The door swung open.', 'The rabbit checked the time.']);
      expect([...mockFiles.files.keys()].filter(file => file.includes('/prose-minion/sessions/'))).toEqual([]);
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
    return;
  }

  it('reopens the latest scratch edit from the picker when its first checkpoint never reached disk', async () => {
    const firstWrite = deferred<string>();
    const failedClose = deferred<void>();
    const retried = deferred<void>();
    const rename = mockFiles.rename.bind(mockFiles);
    let failWrites = true;
    let checkpointPath: string | undefined;
    const publishing = jest.spyOn(mockFiles, 'rename').mockImplementation(async (source, target, options) => {
      if (!checkpointPath && /^current-[0-9a-f-]+\.json$/.test(path.basename(target))) {
        checkpointPath = target;
      }
      if (target === checkpointPath && failWrites) {
        firstWrite.resolve(target);
        throw new Error('EIO: simulated scratch checkpoint write failure');
      }
      await rename(source, target, options);
      if (target === checkpointPath) {
        retried.resolve();
      }
    });
    jest.mocked(vscode.window.showErrorMessage).mockImplementationOnce(async () => {
      failedClose.resolve();
      return undefined;
    });

    try {
      await commands.get('prose-minion.openWorkshop')!();
      const panel = await open('newWorkshopTab', 'First take.');
      const file = await firstWrite.promise;
      const manuscript = 'Second take.\nThe tea was cold; the cup was warm.';
      await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: manuscript, source: { kind: 'manual' } });
      panel.dispose();
      await failedClose.promise;
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Reopen the room to retry'));
      expect(mockFiles.files.has(file)).toBe(false);

      const roomId = path.basename(file, '.json').slice('current-'.length);
      const picker = jest.fn(async (choices: { roomId: string }[]) => choices.find(room => room.roomId === roomId));
      Object.assign(vscode.window, { showQuickPick: picker });
      const reopen = commands.get('prose-minion.reopenWorkshopRoom');
      expect(reopen).toBeDefined();
      await reopen!();
      expect(picker).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ roomId })]), expect.anything());
      const restored = panels.at(-1)!;
      expect(restored).not.toBe(panel);
      await restored.send(MessageType.WORKSHOP_REQUEST_SESSION);
      expect(restored.snapshot().excerpt?.text).toBe(manuscript);
      expect(mockFiles.files.has(file)).toBe(false);

      failWrites = false;
      restored.dispose();
      await retried.promise;
      expect(mockFiles.json(file)).toMatchObject({ workshop: { excerpt: { text: manuscript } } });
    } finally {
      publishing.mockRestore();
    }
  });

  it('opens the verified recovery in a new native tab after a disputed checkpoint closes', async () => {
    const initial = 'Original unshared text.';
    const latest = 'Local revision preserved after another window published.';
    const opened = deferred<{ sessionId: string; slot: string }>();
    const follow = WorkshopPanelTab.prototype.openNamedSession;
    const action = jest.spyOn(WorkshopPanelTab.prototype, 'openNamedSession').mockImplementation(async function (this: WorkshopPanelTab, id: string) {
      await follow.call(this, id);
      opened.resolve({ sessionId: id, slot: this.roomId });
    });
    const notice = jest.fn(async (_message: string, selected: string) => selected);
    const priorInfo = vscode.window.showInformationMessage;
    Object.assign(vscode.window, { showInformationMessage: notice });
    try {
      await commands.get('prose-minion.openWorkshop')!();
      const panel = await open('newWorkshopTab', initial);
      // The Sessions route flushes edits before listing the writer's current checkpoint.
      await panel.send(MessageType.WORKSHOP_LIST_SESSIONS, { requestId: 'list-before-competing-edit' });
      const original = [...mockFiles.files.keys()].find(file =>
        /^current-[0-9a-f-]+\.json$/.test(path.basename(file)) &&
        (mockFiles.json(file) as { workshop: { excerpt?: { text: string } } }).workshop.excerpt?.text === initial
      );
      if (!original) { throw new Error('Missing original checkpoint'); }
      const sourceSlot = path.basename(original, '.json').slice('current-'.length);
      const store = new WorkshopSessionStore(mockFiles, {
        workspaceFolders: () => [{ name: 'Book', path: '/Book' }], extensionPath: '/extension',
        asRelativePath: value => value, findFiles: async () => []
      }, { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });
      const competing = store.forRoom(sourceSlot);
      const base = await competing.readCurrent();
      if (!base?.workshop.excerpt) { throw new Error('Missing original manuscript'); }
      await competing.writeCurrent({
        ...base, workshop: { ...base.workshop, excerpt: { ...base.workshop.excerpt, text: 'Other writer manuscript.' } }
      });
      const winner = await mockFiles.readFile(original);

      await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: latest, source: { kind: 'manual' } });
      panel.dispose();
      const destination = await opened.promise;
      expect(notice).toHaveBeenCalledWith(expect.stringContaining('Workshop Sessions'), 'Open saved recovery');
      expect(action).toHaveBeenCalledTimes(1);
      const restored = panels.at(-1)!;
      expect(restored).not.toBe(panel);
      expect(destination.slot).not.toBe(sourceSlot);
      expect(restored.snapshot().excerpt?.text).toBe(latest);
      expect(await store.forRoom(destination.slot).readCurrent())
        .toMatchObject({ sessionId: destination.sessionId, workshop: { excerpt: { text: latest } } });
      expect((await store.list()).sessions).toContainEqual(expect.objectContaining({ sessionId: destination.sessionId }));
      expect((await store.readNamed(destination.sessionId))?.workshop.excerpt?.text).toBe(latest);
      expect(await mockFiles.readFile(original)).toEqual(winner);
      restored.dispose();
    } finally {
      Object.assign(vscode.window, { showInformationMessage: priorInfo });
      action.mockRestore();
    }
  });

  it('keeps concurrent sends, cancellation, transcript export and rewind in the originating room', async () => {
    const a = await open('openWorkshop', 'Alice opened the door.');
    const gateA = deferred<string>();
    const gateB = deferred<string>();
    const startedA = deferred<AbortSignal>();
    const startedB = deferred<AbortSignal>();
    const model = jest.spyOn(OpenRouterClient.prototype, 'createStreamingChatCompletion')
      .mockImplementationOnce(async function* (messages, options) {
        startedA.resolve(options!.signal!);
        expect(JSON.stringify(messages)).toContain('Alice opened the door.');
        yield { token: await gateA.promise, done: false };
        yield { token: '', done: true };
      })
      .mockImplementationOnce(async function* (messages, options) {
        startedB.resolve(options!.signal!);
        expect(JSON.stringify(messages)).toContain('The Rabbit checked his watch.');
        yield { token: await gateB.promise, done: false };
        yield { token: '', done: true };
      })
      .mockImplementation(async function* () {
        yield { token: 'The watch ticks.', done: false };
        yield { token: '', done: true };
      });
    const sendingA = a.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the door scene.' });
    const signalA = await waitForModel(startedA.promise, sendingA, a);
    const b = await open('newWorkshopTab', 'The Rabbit checked his watch.');
    const sendingB = b.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'First watch reading.' });
    const signalB = await waitForModel(startedB.promise, sendingB, b);
    await b.send(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId: b.snapshot().activeRequestId, domain: 'workshop' });
    expect(signalB.aborted).toBe(true);
    expect(signalA.aborted).toBe(false);
    gateB.resolve('Late cancelled reply.');
    await sendingB;
    gateA.resolve('The door creaks.');
    await sendingA;
    await b.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Second watch reading.' });
    expect(model).toHaveBeenCalledTimes(3);
    await a.send(MessageType.WORKSHOP_REQUEST_SESSION);
    await b.send(MessageType.WORKSHOP_REQUEST_SESSION);
    expect(a.posted.filter(msg => msg.type === MessageType.ERROR)).toEqual([]);
    expect(b.posted.filter(msg => msg.type === MessageType.ERROR)).toEqual([]);
    expect(a.snapshot().turns.map(turn => turn.content)).toContain('The door creaks.');
    expect(b.snapshot().turns.map(turn => turn.content)).toContain('The watch ticks.');
    expect(b.snapshot().turns.map(turn => turn.content)).not.toContain('Late cancelled reply.');

    for (const [panel, title, own, foreign] of [
      [a, 'door', 'The door creaks.', 'The watch ticks.'],
      [b, 'watch', 'The watch ticks.', 'The door creaks.']
    ] as const) {
      await panel.send(MessageType.WORKSHOP_EXPORT_SESSION, { format: 'markdown', title });
      const text = new TextDecoder().decode(await mockFiles.readFile('/Book/prose-minion/exports/' + title + '.md'));
      expect(text).toContain(own);
      expect(text).not.toContain(foreign);
    }
    const writer = a.snapshot().turns.find(turn => turn.content === 'Read the door scene.')!;
    await a.send(MessageType.WORKSHOP_REWIND_SESSION, { turnId: writer.id });
    expect(a.posted).toContainEqual(expect.objectContaining({
      type: MessageType.WORKSHOP_SESSION_ACTION_RESULT, payload: expect.objectContaining({ action: 'rewind', ok: true })
    }));
    expect(a.snapshot().turns.map(turn => turn.content)).not.toContain('The door creaks.');
    await b.send(MessageType.WORKSHOP_REQUEST_SESSION);
    expect(b.snapshot().turns.map(turn => turn.content)).toContain('The watch ticks.');
    model.mockRestore();
  });

  it('attributes out-of-order provider usage to each room’s own turn and bills the window once', async () => {
    const a = await open('newWorkshopTab', 'The door was painted blue.');
    const b = await open('newWorkshopTab', 'The watch ran backwards.');
    await a.send(MessageType.RESET_TOKEN_USAGE);
    const usageA = { promptTokens: 20, completionTokens: 5, totalTokens: 25, costUsd: 0.25 };
    const usageB = { promptTokens: 7, completionTokens: 3, totalTokens: 10, costUsd: 0.50 };
    const startedA = deferred<AbortSignal>();
    const startedB = deferred<AbortSignal>();
    const finishA = deferred<void>();
    const finishB = deferred<void>();
    const transport = jest.spyOn(OpenRouterClient.prototype, 'createStreamingChatCompletion')
      .mockImplementationOnce(async function* (_messages, options) {
        startedA.resolve(options!.signal!);
        await finishA.promise;
        yield { token: 'A blue door.', done: false };
        yield { token: '', done: true, usage: usageA };
      })
      .mockImplementationOnce(async function* (_messages, options) {
        startedB.resolve(options!.signal!);
        await finishB.promise;
        yield { token: 'A slow watch.', done: false };
        yield { token: '', done: true, usage: usageB };
      })
      .mockImplementationOnce(async function* () {
        yield { token: 'The watch stopped.', done: false };
        yield { token: '', done: true };
      });
    const windowUsage = (panel: ReturnType<typeof editorPanel>) =>
      panel.posted.filter(msg => msg.type === MessageType.TOKEN_USAGE_UPDATE).at(-1)?.payload;
    const turnReceipts = (panel: ReturnType<typeof editorPanel>) =>
      panel.snapshot().turns.filter(turn => turn.usage).map(turn => ({ content: turn.content, usage: turn.usage }));

    try {
      const sendingA = a.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the door.' });
      await waitForModel(startedA.promise, sendingA, a);
      const sendingB = b.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the watch.' });
      await waitForModel(startedB.promise, sendingB, b);

      finishB.resolve();
      await sendingB;
      expect(turnReceipts(a)).toEqual([]);
      expect(turnReceipts(b)).toMatchObject([{ content: 'A slow watch.', usage: usageB }]);
      for (const panel of [a, b]) {
        expect(windowUsage(panel)).toMatchObject({ totals: usageB, lastRequestCostUsd: usageB.costUsd });
      }

      finishA.resolve();
      await sendingA;
      expect(turnReceipts(a)).toMatchObject([{ content: 'A blue door.', usage: usageA }]);
      expect(turnReceipts(b)).toMatchObject([{ content: 'A slow watch.', usage: usageB }]);
      const late = await open('newWorkshopTab', 'A new scene.');
      await late.send(MessageType.REQUEST_TOKEN_USAGE);
      expect(turnReceipts(late)).toEqual([]);
      for (const panel of [a, b, late]) {
        expect(windowUsage(panel)).toMatchObject({
          totals: { promptTokens: 27, completionTokens: 8, totalTokens: 35, costUsd: 0.75 },
          lastRequestCostUsd: usageA.costUsd
        });
      }

      await b.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'What happens next?' });
      expect(b.snapshot().turns.find(turn => turn.content === 'The watch stopped.')).toBeDefined();
      expect(turnReceipts(b)).toMatchObject([{ content: 'A slow watch.', usage: usageB }]);
      const afterUnmeasured = await open('newWorkshopTab', 'One more scene.');
      await afterUnmeasured.send(MessageType.REQUEST_TOKEN_USAGE);
      for (const panel of [a, b, late, afterUnmeasured]) {
        expect(windowUsage(panel)?.totals).toMatchObject({
          promptTokens: 27, completionTokens: 8, totalTokens: 35, costUsd: 0.75
        });
        expect(windowUsage(panel)?.lastRequestCostUsd).toBeUndefined();
      }
    } finally {
      finishA.resolve();
      finishB.resolve();
      transport.mockRestore();
    }
  });

  it('restores the private OpenRouter routing hint and cache clock through saved Workshop rooms and cuts', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- OpenRouter request JSON.
    type WireRequest = { model: string; session_id: string; messages: unknown[] };
    const requests: WireRequest[] = [];
    const fetch = jest.mocked(globalThis.fetch);
    const offlineFetch = fetch.getMockImplementation()!;
    const settings = vscode.workspace.getConfiguration;
    const ttl = jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section, scope) => {
      const config = settings(section, scope);
      return { ...config, get: (key: string, fallback?: unknown) =>
        section === 'proseMinion' && key === 'claudeCacheTtl' ? '1h' : config.get(key, fallback) } as vscode.WorkspaceConfiguration;
    });
    const logStart = mockOutputLine.mock.calls.length;
    try {
      fetch.mockImplementation(async (url, init) => {
        if (!String(url).endsWith('/chat/completions')) { return offlineFetch(url, init); }
        const request = JSON.parse(String(init?.body)) as WireRequest;
        requests.push(request);
        /* eslint-disable @typescript-eslint/naming-convention -- OpenRouter SSE wire fields. */
        const event = { model: request.model, choices: [{ delta: { content: 'Wire reply ' + requests.length }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105, prompt_tokens_details: { cached_tokens: 50 } } };
        /* eslint-enable @typescript-eslint/naming-convention */
        return new Response('data: ' + JSON.stringify(event) + '\n\ndata: [DONE]\n\n');
      });
      const source = await open('newWorkshopTab', 'A bird circled the orchard.');
      const before = Date.now();
      await source.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the opening.' });
      const after = Date.now();
      expect(requests).toHaveLength(1);
      await source.send(MessageType.WORKSHOP_SAVE_SESSION, { title: 'Cache orchard' });
      const file = [...mockFiles.files.keys()].find(file => file.endsWith('.json') && !file.includes('current') &&
        (mockFiles.json(file) as {title?: string}).title === 'Cache orchard')!;
      const archive = mockFiles.json(file) as { sessionId: string; conversations: Array<{
        key: string; routingKey: string; estimatedCacheExpiresAt: number; cacheRequestModelId: string
      }> };
      const host = archive.conversations.find(entry => entry.key === 'host')!;
      const wireId = 'prose-minion:' + createHash('sha256').update(host.routingKey).digest('hex');
      expect(requests[0].session_id).toBe(wireId);
      expect(host.cacheRequestModelId).toBe(requests[0].model);
      expect(host.estimatedCacheExpiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
      expect(host.estimatedCacheExpiresAt).toBeLessThanOrEqual(after + 3_600_000);
      await source.send(MessageType.WORKSHOP_RESET_SESSION, { start: 'full-reset' });
      await source.send(MessageType.WORKSHOP_OPEN_SESSION, { sessionId: archive.sessionId });
      expect(source.snapshot().contextBudget?.cacheEstimate).toEqual({
        estimatedCacheExpiresAt: host.estimatedCacheExpiresAt, cacheRequestModelId: requests[0].model
      });
      expect(source.snapshot().contextBudget?.snapshot).toBeUndefined();
      const expired = jest.spyOn(Date, 'now').mockReturnValue(host.estimatedCacheExpiresAt + 1);
      try {
        await source.send(MessageType.WORKSHOP_REQUEST_SESSION);
        expect(source.snapshot().contextBudget?.cacheEstimate).toBeUndefined();
      } finally {
        expired.mockRestore();
      }
      const firstReply = source.snapshot().turns.find(turn => turn.content === 'Wire reply 1')!;
      await source.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the next line.' });
      expect(requests).toHaveLength(2);
      expect(requests[1].session_id).toBe(wireId);
      await source.send(MessageType.WORKSHOP_REWIND_SESSION, { turnId: firstReply.id });
      await source.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read again from the first reply.' });
      expect(requests).toHaveLength(3);
      expect(requests[2].session_id).toBe(wireId);
      expect(JSON.stringify(requests[2].messages)).not.toContain('Read the next line.');
      await source.send(MessageType.WORKSHOP_BRANCH_SESSION, { turnId: firstReply.id, title: 'Orchard branch' });
      const branch = panels.find(panel => panel.active)!;
      await branch.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Continue the branch.' });
      expect(requests).toHaveLength(4);
      expect(requests[3].session_id).toBe(wireId);
      expect(JSON.stringify(requests[3].messages)).not.toContain('Read again from the first reply.');
      await branch.send(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'agnes', openingMessage: 'Read as a fresh guest.' });
      expect(requests).toHaveLength(5);
      expect(requests[4].session_id).toMatch(/^prose-minion:[a-f0-9]{64}$/);
      expect(requests[4].session_id).not.toBe(wireId);
      const surfaces = [];
      for (const [format, extension] of [['markdown', 'md'], ['json', 'json'], ['html', 'html']]) {
        await branch.send(MessageType.WORKSHOP_EXPORT_SESSION, { format, title: 'orchard-privacy' });
        const exported = new TextDecoder().decode(await mockFiles.readFile('/Book/prose-minion/exports/orchard-privacy.' + extension));
        expect(exported).toContain('Continue the branch.');
        surfaces.push(exported);
      }
      await branch.send(MessageType.WORKSHOP_RESET_SESSION, { start: 'full-reset' });
      await branch.send(MessageType.WORKSHOP_SET_EXCERPT, { text: 'A kite crossed the orchard.', source: { kind: 'manual' } });
      await branch.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read after a full reset.' });
      expect(requests).toHaveLength(6);
      const fresh = await open('newWorkshopTab', 'A fox crossed the orchard.');
      await fresh.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read in a new room.' });
      expect(requests).toHaveLength(7);
      const independent = [wireId, ...requests.slice(4).map(request => request.session_id)];
      expect(independent.every(key => /^prose-minion:[a-f0-9]{64}$/.test(key))).toBe(true);
      expect(new Set(independent).size).toBe(4);
      surfaces.push(JSON.stringify([...source.posted, ...branch.posted, ...fresh.posted]),
        JSON.stringify(mockOutputLine.mock.calls.slice(logStart)));
      for (const surface of surfaces) {
        expect(surface).not.toContain(host.routingKey);
        expect(surface).not.toContain('routingKey');
        for (const key of independent) { expect(surface).not.toContain(key); }
      }
      expect(JSON.stringify(requests)).not.toContain(host.routingKey);
    } finally {
      ttl.mockRestore();
      fetch.mockImplementation(offlineFetch);
    }
  });

  it('branches a writer bubble into a new saved tab and delivers its edit only to that tab', async () => {
    const source = await open('newWorkshopTab', 'The lantern waited under the eaves.');
    const transport = jest.spyOn(OpenRouterClient.prototype, 'createStreamingChatCompletion')
      .mockImplementation(async function* () {
        yield { token: 'The lantern waited for the boat.', done: false };
        yield { token: '', done: true };
      });
    const panelCount = panels.length;
    const draftText = 'Why does the lantern stay lit?';
    try {
      await source.send(MessageType.WORKSHOP_SEND_MESSAGE, { text: draftText });
      const writer = source.snapshot().turns.find(turn => turn.content === draftText)!;
      await source.send(MessageType.WORKSHOP_BRANCH_SESSION, { turnId: writer.id });
      expect(source.posted).toContainEqual(expect.objectContaining({
        type: MessageType.WORKSHOP_SESSION_ACTION_RESULT,
        payload: expect.objectContaining({ action: 'branch', ok: false, message: expect.stringContaining('Save') })
      }));
      expect(panels).toHaveLength(panelCount);

      await source.send(MessageType.WORKSHOP_SAVE_SESSION, { title: 'Lantern source' });
      const namedFiles = () => [...mockFiles.files.keys()].filter(file =>
        file.endsWith('.json') && !file.endsWith('.summary.json') && !path.basename(file).startsWith('current')
      );
      const namedFile = (title: string) => namedFiles().find(file => (mockFiles.json(file) as { title?: string }).title === title)!;
      const original = namedFile('Lantern source');
      const sourceBytes = await mockFiles.readFile(original);
      const sourceRecord = mockFiles.json(original) as { sessionId: string };
      const turnIds = source.snapshot().turns.map(turn => turn.id);
      const revision = source.snapshot().roomRevision;
      // The writer initiated Branch from the second editor group.
      Object.assign(source, { viewColumn: 2 });
      const create = jest.spyOn(vscode.window, 'createWebviewPanel');
      try {
        await source.send(MessageType.WORKSHOP_BRANCH_SESSION, { turnId: writer.id, title: 'Lantern branch' });
        expect(panels).toHaveLength(panelCount + 1);
        expect(create.mock.calls[0][2]).toBe(2);
        const destination = panels.at(-1)!;
        const drafts = (panel: ReturnType<typeof editorPanel>) => panel.posted
          .filter(msg => msg.type === MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map(msg => msg.payload.text);
        // Native focus refreshes can precede the React listener. The actual mount requests the edit once.
        destination.reveal();
        expect(drafts(destination)).toEqual([]);
        await destination.send(MessageType.WORKSHOP_REQUEST_SESSION);
        await destination.send(MessageType.WORKSHOP_REQUEST_SESSION);
        expect(destination.active).toBe(true);
        expect(source.snapshot().turns.map(turn => turn.id)).toEqual(turnIds);
        expect(source.snapshot().roomRevision).toBe(revision);
        expect(await mockFiles.readFile(original)).toEqual(sourceBytes);
        const branch = mockFiles.json(namedFile('Lantern branch')) as { sessionId: string };
        expect(branch.sessionId).not.toBe(sourceRecord.sessionId);
        const cut = turnIds.indexOf(writer.id);
        expect(destination.snapshot().turns.map(turn => turn.id)).toEqual(turnIds.slice(0, cut));
        expect(drafts(source)).toEqual([]);
        expect(drafts(destination)).toEqual([draftText]);
        expect(source.posted).toContainEqual(expect.objectContaining({
          type: MessageType.WORKSHOP_SESSION_ACTION_RESULT, payload: expect.objectContaining({ action: 'branch', ok: true })
        }));
      } finally {
        create.mockRestore();
      }
    } finally {
      transport.mockRestore();
    }
  });

  it('reveals the owner when a different room opens a named session', async () => {
    const a = await open('newWorkshopTab', 'The Cheshire Cat vanished.');
    await a.send(MessageType.WORKSHOP_SAVE_SESSION, { title: 'Cheshire' });
    const saved = [...mockFiles.files.keys()].find(file => file.endsWith('.json') && !file.includes('current') &&
      (mockFiles.json(file) as {title?: string}).title === 'Cheshire');
    if (!saved) {
      throw new Error('Missing named session checkpoint');
    }
    const { sessionId } = mockFiles.json(saved) as {sessionId: string};
    const b = await open('newWorkshopTab', 'The Duchess stayed.');
    a.reveal.mockClear();
    await b.send(MessageType.WORKSHOP_OPEN_SESSION, { sessionId });
    expect(a.reveal).toHaveBeenCalledTimes(1);
    expect(a.active).toBe(true);
    expect(b.active).toBe(false);
    expect(b.snapshot().excerpt?.text).toBe('The Duchess stayed.');
  });

  it('closing a room while its picker waits prevents a late read and leaves the other room intact', async () => {
    const file = '/Book/late-selection.md';
    await mockFiles.writeFile(file, new TextEncoder().encode('Late croquet instructions.'));
    const a = await open('newWorkshopTab', 'A room about croquet.');
    const entered = deferred<void>();
    const picked = deferred<vscode.Uri[]>();
    Object.assign(vscode.window, { showOpenDialog: () => { entered.resolve(); return picked.promise; } });
    const read = a.send(MessageType.WORKSHOP_ADD_CONTEXT_FILE);
    await entered.promise;
    const b = await open('newWorkshopTab', 'A room about cards.');
    a.dispose();
    const published = a.posted.length;
    picked.resolve([vscode.Uri.file(file)]);
    await read;
    expect(mockFiles.readFileCalls).not.toContain(file);
    expect(a.posted).toHaveLength(published);
    await b.send(MessageType.WORKSHOP_REQUEST_SESSION);
    expect(b.snapshot().excerpt?.text).toBe('A room about cards.');
    expect(b.snapshot().contextAttachments).toEqual([]);
  });
  it('drops a queued manual refresh when its panel closes during autosave', async () => {
    const file = '/Book/refresh-guide.md';
    const panel = await open('newWorkshopTab', 'The tide was falling.');
    await mockFiles.writeFile(file, new TextEncoder().encode('Original guide.'));
    Object.assign(vscode.window, { showOpenDialog: async () => [vscode.Uri.file(file)] });
    await panel.send(MessageType.WORKSHOP_ADD_CONTEXT_FILE);
    expect(panel.snapshot().contextAttachments).toHaveLength(1);
    await mockFiles.writeFile(file, new TextEncoder().encode('Revised guide.'));

    const writing = deferred<void>();
    const release = deferred<void>();
    const queued = deferred<void>();
    const write = WorkshopSessionStore.prototype.writeCurrent;
    const save = jest.spyOn(WorkshopSessionStore.prototype, 'writeCurrent').mockImplementationOnce(async function (this: WorkshopSessionStore, ...args) {
      writing.resolve();
      await release.promise;
      return write.apply(this, args);
    });
    const runRefresh = WorkshopSessionPersistenceCoordinator.prototype.runContextRefresh;
    const schedule = jest.spyOn(WorkshopSessionPersistenceCoordinator.prototype, 'runContextRefresh').mockImplementationOnce(function (this: WorkshopSessionPersistenceCoordinator, scan) {
      const completion = runRefresh.call(this, scan);
      queued.resolve();
      return completion;
    });
    const mutate = jest.spyOn(WorkshopSessionService.prototype, 'refreshContextFileAttachments');
    const markDirty = jest.spyOn(WorkshopSessionPersistenceCoordinator.prototype, 'markDirty');
    try {
      await panel.send(MessageType.WORKSHOP_SET_EXCERPT, { text: 'The tide had turned.', source: { kind: 'manual' } });
      await writing.promise;
      const refresh = panel.send(MessageType.WORKSHOP_REFRESH_CONTEXT_FILES);
      await queued.promise;
      const reads = mockFiles.readFileCalls.filter(path => path === file).length;
      panel.dispose();
      const posted = panel.posted.length;
      release.resolve();
      await refresh;
      expect(mockFiles.readFileCalls.filter(path => path === file)).toHaveLength(reads);
      expect(mutate).not.toHaveBeenCalled();
      expect(markDirty).not.toHaveBeenCalledWith('context files refreshed');
      expect(panel.posted).toHaveLength(posted);
    } finally {
      release.resolve();
      markDirty.mockRestore();
      mutate.mockRestore();
      schedule.mockRestore();
      save.mockRestore();
    }
  });

  it('attaches a shared project pin to the room that requested it while another tab is focused', async () => {
    const a = await open('newWorkshopTab', 'The Dormouse told a story.');
    const b = await open('newWorkshopTab', 'The Hare poured the tea.');
    const file = 'table.md';
    mockFiles.setJson('/Book/prose-minion/pinned-context.json', { format: 1, files: [{ path: file }] });
    await mockFiles.writeFile('/Book/' + file, new TextEncoder().encode('The table was set for tea.'));
    await a.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, { requestId: 'attach-table' });
    expect(a.snapshot().contextAttachments.map(attachment => attachment.label)).toEqual([file]);
    await b.send(MessageType.WORKSHOP_REQUEST_SESSION);
    expect(b.snapshot().contextAttachments).toEqual([]);
  });

});
