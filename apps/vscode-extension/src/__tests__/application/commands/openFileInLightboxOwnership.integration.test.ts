/* eslint-disable no-restricted-imports -- this test drives the real LightboxHandler, LightboxService and measurement services through core's lightboxHandlerHarness, which the host-side barrel does not export. */
/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's export names. */

/**
 * Open File in Lightbox owns its source before the document loads (PR #152
 * F-01). The real command, the real LightboxPanelProvider and its panel
 * lifecycle, and the real LightboxHandler, LightboxService and measurement
 * services (core's lightboxHandlerHarness, behind a small stand-in for the
 * panel's MessageHandler). Only VS Code's document loading, the editor tab,
 * the file reads, the picker and the standards enrichment are stand-ins, and
 * each document load can be held until the test releases it. All prose is
 * synthetic.
 *
 * Every test in the first block failed before the fix: the launch took its
 * ticket only after the document loaded, so whichever load finished last
 * won. The second block pins what the fix keeps.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { LightboxPanelProvider } from '@app/application/providers/LightboxPanelProvider';
import {
  LightboxFileDocument,
  LightboxFileUri,
  OpenFileInLightboxHost,
  OpenFileInLightboxOutcome,
  openFileInLightbox
} from '@app/application/commands/openFileInLightbox';
import type { CoreServices, LightboxSetSourcePayload, LightboxSourceTicket, Platform } from '@prose-minion/core';
import { MessageType } from '@messages';
import {
  Deferred,
  LightboxPanel,
  WORKSPACE,
  createLightboxHost,
  deferred,
  settle
} from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

let mockLightbox: ReturnType<typeof createLightboxHost>;
const mockPanels: LightboxPanel[] = [];

jest.mock('@prose-minion/core', () => {
  const messages = jest.requireActual('@messages');
  return {
    MessageType: messages.MessageType,
    coerceWebviewErrorText: messages.coerceWebviewErrorText,
    SURFACE_LIGHTBOX: 'lightbox',
    // The panel's MessageHandler: its Lightbox routes and the host's seeds reach a real LightboxHandler over the shared service.
    MessageHandler: jest.fn(() => {
      const panel = mockLightbox.openPanel();
      mockPanels.push(panel);
      return {
        handleMessage: (message: { type: MessageType; payload?: object }) => panel.route(message.type, message.payload),
        seedLightboxSource: (payload: LightboxSetSourcePayload, ticket: LightboxSourceTicket) =>
          panel.handler.seedSource(payload, ticket),
        flushCachedResults: jest.fn(),
        handleConfigurationChange: jest.fn(),
        dispose: () => panel.dispose()
      };
    })
  };
});
jest.mock('@app/application/providers/webviewHtml', () => ({ getWebviewHtml: () => '<html></html>' }));

const OLDER = 'An older chapter waits by the gate, and the lamp burns low.';
const NEWER = 'A newer chapter walks along the river, counting the stones.';
const CHAPTER = 'The chapter on the desk has three sentences. It is short. It is enough.';

class FakeUri implements LightboxFileUri {
  constructor(readonly scheme: string, readonly path: string) {}

  toString(): string {
    return this.scheme === 'file' ? `file://${this.path}` : `${this.scheme}:${this.path}`;
  }
}

const fileUri = (relativePath: string) => new FakeUri('file', path.posix.join(WORKSPACE, relativePath));
const doc = (uri: FakeUri, languageId = 'markdown'): LightboxFileDocument<FakeUri> => ({ uri, languageId, isDirty: false });

/** An editor tab: closing it (or `dispose()`) fires its disposal listeners, as VS Code does. */
function fakeEditorTab() {
  const disposeListeners: Array<() => void> = [];
  let closed = false;
  return {
    visible: true,
    iconPath: undefined as unknown,
    reveal: jest.fn(),
    webview: {
      options: {},
      html: '',
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() }))
    },
    onDidChangeViewState: jest.fn(() => ({ dispose: jest.fn() })),
    onDidDispose: jest.fn((listener: () => void) => {
      disposeListeners.push(listener);
      return { dispose: jest.fn() };
    }),
    dispose: jest.fn(() => {
      if (!closed) {
        closed = true;
        disposeListeners.forEach((listener) => listener());
      }
    })
  };
}

function createScene() {
  mockLightbox = createLightboxHost();
  mockPanels.length = 0;
  const tabs: Array<ReturnType<typeof fakeEditorTab>> = [];
  Object.assign(vscode.window, {
    createWebviewPanel: jest.fn(() => {
      const tab = fakeEditorTab();
      tabs.push(tab);
      return tab;
    })
  });
  Object.assign(vscode.workspace, { onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })) });
  const provider = new LightboxPanelProvider(
    vscode.Uri.file('/extension'),
    { lightboxService: mockLightbox.service } as unknown as CoreServices,
    { appendLine: jest.fn() } as unknown as vscode.OutputChannel,
    {} as Platform
  );

  const loads = new Map<string, Deferred<LightboxFileDocument<FakeUri>>>();
  const warnings: string[] = [];
  const logs: string[] = [];
  // The composition root's port, over the same provider and service.
  const host: OpenFileInLightboxHost<FakeUri> = {
    toUri: (value) => (value instanceof FakeUri ? value : undefined),
    activeDocument: () => undefined,
    openTextDocument: (uri) => loads.get(uri.toString())?.promise ?? Promise.resolve(doc(uri)),
    asRelativePath: (uri) => path.posix.relative(WORKSPACE, uri.path),
    beginSourceRequest: () => mockLightbox.service.beginSourceRequest(),
    seedSource: (payload, ticket) => provider.seedSource(payload, ticket),
    showWarning: (message) => {
      warnings.push(message);
    },
    showInformation: () => undefined,
    log: (line) => {
      logs.push(line);
    }
  };

  return {
    provider,
    tabs,
    warnings,
    logs,
    addFile: (relativePath: string, text: string) => mockLightbox.addFile(relativePath, text),
    /** Hold VS Code's load of a file until the test releases it. */
    hold: (relativePath: string) => {
      const uri = fileUri(relativePath);
      const load = deferred<LightboxFileDocument<FakeUri>>();
      loads.set(uri.toString(), load);
      return {
        release: (languageId = 'markdown') => load.resolve(doc(uri, languageId)),
        fail: () => load.reject(new Error('File seems to be binary and cannot be opened as text'))
      };
    },
    /** Open File in Lightbox from the Explorer. */
    launch: (target: string | FakeUri): Promise<OpenFileInLightboxOutcome> =>
      openFileInLightbox(typeof target === 'string' ? fileUri(target) : target, host),
    /** The Lightbox command, then the webview's mount-time request. */
    openLightbox: async () => {
      provider.openOrReveal();
      await mockPanels.at(-1)!.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    },
    /** The writer closes the editor tab. */
    closeTab: () => tabs.at(-1)!.dispose(),
    /** The webview of the current tab. */
    panel: () => mockPanels.at(-1)!,
    pick: (relativePath: string) => {
      const fsPath = path.posix.join(WORKSPACE, relativePath);
      mockLightbox.pickFile.mockResolvedValueOnce({ fsPath, uri: `file://${fsPath}` });
    },
    board: () => mockLightbox.service.currentBoard()?.source.displayPath,
    refusal: () => mockLightbox.service.currentOutcome().refusal
  };
}

const DROPPED_A = '[Lightbox] Open File in Lightbox: dropped older-A.md; a newer source was chosen while it loaded';

describe('Open File in Lightbox owns its source before the document loads (PR #152 F-01)', () => {
  it('file → file: a launch whose document loads after a newer launch never replaces it', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    scene.addFile('newer-B.md', NEWER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await scene.launch('newer-B.md');
    await settle();
    expect(scene.board()).toBe('newer-B.md');

    a.release();
    const outcome = await earlier;
    await settle();

    expect(scene.board()).toBe('newer-B.md');
    expect(scene.panel().boardPaths()).toEqual([null, 'newer-B.md']);
    expect(outcome.kind).toBe('superseded');
    expect(scene.logs).toContain(DROPPED_A);
  });

  it.each([
    ['Open Selection in Lightbox', (scene: ReturnType<typeof createScene>) => {
      scene.provider.seedSource({ text: NEWER, sourceUri: 'file:///workspace/notes.md', relativePath: 'newer-selection.md', startLine: 2, endLine: 4 });
    }],
    ['a LIGHTBOX_SET_SOURCE selection', (scene: ReturnType<typeof createScene>) =>
      scene.panel().route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer-selection.md' })]
  ])('file → selection (%s): the newer selection keeps the board', async (_route, select) => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await select(scene);
    await settle();
    expect(scene.board()).toBe('newer-selection.md');

    a.release();
    await earlier;
    await settle();

    expect(scene.board()).toBe('newer-selection.md');
    expect(scene.panel().boardPaths()).toEqual([null, 'newer-selection.md']);
  });

  it('file → picked file: the file the writer picks while the launch loads keeps the board', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    scene.addFile('picked.md', NEWER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    scene.pick('picked.md');
    await scene.panel().route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    expect(scene.board()).toBe('picked.md');

    a.release();
    await earlier;
    await settle();

    expect(scene.board()).toBe('picked.md');
    expect(scene.panel().boardPaths()).toEqual([null, 'picked.md']);
  });

  it('file → re-read: a re-read asked for while the launch loads keeps the board', async () => {
    const scene = createScene();
    scene.addFile('chapter.md', CHAPTER);
    scene.addFile('older-A.md', OLDER);
    await scene.openLightbox();
    await scene.launch('chapter.md');
    await settle();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await scene.panel().route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(scene.panel().boardPaths()).toEqual([null, 'chapter.md', 'chapter.md']);

    a.release();
    await earlier;
    await settle();

    expect(scene.board()).toBe('chapter.md');
    expect(scene.panel().boardPaths()).toEqual([null, 'chapter.md', 'chapter.md']);
  });

  it('a launch superseded while it loaded does not reopen the Lightbox the writer closed', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    scene.provider.seedSource({ text: NEWER, relativePath: 'newer-selection.md' });
    await settle();
    scene.closeTab();

    a.release();
    const outcome = await earlier;
    await settle();

    expect(scene.tabs).toHaveLength(1);
    expect(scene.board()).toBe('newer-selection.md');
    expect(outcome.kind).toBe('superseded');
    expect(scene.logs).toContain(DROPPED_A);
  });

  it('a pending launch lands in the tab that replaced a closed one, unless a newer choice was made there', async () => {
    const scene = createScene();
    scene.addFile('first-A.md', OLDER);
    scene.addFile('older-A.md', OLDER);
    scene.addFile('picked.md', NEWER);
    await scene.openLightbox();
    const firstPanel = scene.panel();

    // Still the newest choice when it loads: it boards in the reopened tab.
    const first = scene.hold('first-A.md');
    const firstLaunch = scene.launch('first-A.md');
    scene.closeTab();
    await scene.openLightbox();
    const secondPanel = scene.panel();
    first.release();
    expect((await firstLaunch).kind).toBe('seeded');
    await settle();
    expect(scene.tabs).toHaveLength(2);
    expect(secondPanel.boardPaths()).toEqual([null, 'first-A.md']);
    expect(firstPanel.boardPaths()).toEqual([null]);

    // Overtaken by a file picked in the replacement tab: dropped.
    const older = scene.hold('older-A.md');
    const olderLaunch = scene.launch('older-A.md');
    scene.closeTab();
    await scene.openLightbox();
    const thirdPanel = scene.panel();
    scene.pick('picked.md');
    await thirdPanel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    older.release();
    expect((await olderLaunch).kind).toBe('superseded');
    await settle();

    expect(scene.tabs).toHaveLength(3);
    expect(scene.board()).toBe('picked.md');
    expect(thirdPanel.boardPaths()).toEqual(['first-A.md', 'picked.md']);
    expect(secondPanel.boardPaths()).toEqual([null, 'first-A.md']);
  });

  it('a refused older launch leaves the newer board intact and publishes no refusal', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', '');
    scene.addFile('newer-B.md', NEWER);
    scene.addFile('newer-C.md', CHAPTER);
    await scene.openLightbox();

    // The Lightbox would refuse it (an empty file).
    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await scene.launch('newer-B.md');
    await settle();
    a.release();
    await earlier;
    await settle();
    expect(scene.board()).toBe('newer-B.md');
    expect(scene.refusal()).toBeNull();

    // The host refuses it once loaded (another language): a warning, and nothing sent.
    const x = scene.hold('older-X.md');
    const xLaunch = scene.launch('older-X.md');
    await scene.launch('newer-C.md');
    await settle();
    x.release('json');
    expect(await xLaunch).toEqual(expect.objectContaining({ kind: 'refused', reason: 'unsupported-language' }));
    await settle();

    expect(scene.board()).toBe('newer-C.md');
    expect(scene.refusal()).toBeNull();
    expect(scene.panel().refusals()).toEqual([]);
    expect(scene.panel().boardPaths()).toEqual([null, 'newer-B.md', 'newer-C.md']);
    expect(scene.warnings).toEqual(['The Lightbox opens Markdown and plain-text files, and “older-X.md” is neither.']);
  });

  it('an older launch never clears the refusal of a newer source', async () => {
    const scene = createScene();
    scene.addFile('chapter.md', CHAPTER);
    scene.addFile('older-A.md', OLDER);
    scene.addFile('newer-empty.md', '');
    await scene.openLightbox();
    await scene.launch('chapter.md');
    await settle();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await scene.launch('newer-empty.md');
    await settle();
    const standing = scene.refusal();
    expect(standing).toEqual(expect.objectContaining({ reason: 'empty', displayPath: 'newer-empty.md' }));

    a.release();
    await earlier;
    await settle();

    expect(scene.board()).toBe('chapter.md');
    expect(scene.refusal()).toEqual(standing);
    expect(scene.panel().refusals()).toEqual([standing]);
    expect(scene.panel().boardPaths()).toEqual([null, 'chapter.md']);
  });

  it('a launch the host refuses after loading is still the newer choice, and blocks no later one', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    scene.addFile('later.md', NEWER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    const cover = scene.hold('cover.png');
    const coverLaunch = scene.launch('cover.png');
    cover.fail();
    expect((await coverLaunch).kind).toBe('refused');
    a.release();
    expect((await earlier).kind).toBe('superseded');
    await settle();
    expect(scene.board()).toBeUndefined();
    expect(scene.refusal()).toBeNull();

    await scene.launch('later.md');
    await settle();
    expect(scene.board()).toBe('later.md');
    expect(scene.panel().boardPaths()).toEqual([null, 'later.md']);
  });
});

describe('what the launch keeps (unchanged by PR #152 F-01)', () => {
  it('a refusal made without loading takes no request: the launch still loading lands', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    expect((await scene.launch(new FakeUri('untitled', 'Untitled-1'))).kind).toBe('refused');
    expect((await scene.launch(new FakeUri('git', '/workspace/older-A.md'))).kind).toBe('refused');
    a.release();
    expect((await earlier).kind).toBe('seeded');
    await settle();

    expect(scene.board()).toBe('older-A.md');
  });

  it('a picker dismissed while a launch loads is no choice: the launch lands', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);
    await scene.openLightbox();

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    await scene.panel().route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    a.release();
    expect((await earlier).kind).toBe('seeded');
    await settle();

    expect(mockLightbox.pickFile).toHaveBeenCalledTimes(1);
    expect(scene.board()).toBe('older-A.md');
  });

  it('a launch with nothing newer opens the Lightbox when its document loads', async () => {
    const scene = createScene();
    scene.addFile('older-A.md', OLDER);

    const a = scene.hold('older-A.md');
    const earlier = scene.launch('older-A.md');
    expect(scene.tabs).toHaveLength(0);
    a.release();
    expect((await earlier).kind).toBe('seeded');
    await settle();

    expect(scene.tabs).toHaveLength(1);
    expect(scene.board()).toBe('older-A.md');
    expect(scene.panel().boardPaths()).toEqual(['older-A.md']);
  });
});
