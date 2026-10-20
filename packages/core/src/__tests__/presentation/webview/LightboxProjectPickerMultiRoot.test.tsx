/** @jest-environment jsdom */

/**
 * The Lightbox's Context picker marks a row attached by the file's host key,
 * never by its display path (PR #154 F-02).
 *
 * A real multi-root host: the real ContextResourceResolver, the real
 * WorkshopContextIntakeService catalog, the real TextSourceResolver, the
 * real LightboxContextShelf, and the real LightboxHandler and
 * LightboxReadingHandler, rendered through the real LightboxApp. Only the
 * platform ports are stand-ins: two workspace folders on an in-memory file
 * system, the settings, and the system file picker. The provider engine is
 * never reached.
 *
 * Both folders hold `Notes/cast.md` with different text. The resolver lists
 * one of them (the first folder's; its cross-folder collapse is older and
 * out of scope here), and both show the same display path on the shelf.
 * File names and text are synthetic.
 */

jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ExtensionToWebviewMessage,
  LightboxContextFile,
  LightboxProjectCatalogEntry,
  MessageType
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { createFakeEditorContext, createFakeSettings } from '@/__tests__/mocks/platform';
import { FileType, type FileStat, type FileSystem, type Workspace } from '@/platform';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { LightboxReadingHandler } from '@/application/handlers/domain/LightboxReadingHandler';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import type { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const ROOT_A = '/root-a';
const ROOT_B = '/root-b';
const CAST_A = `${ROOT_A}/Notes/cast.md`;
const CAST_B = `${ROOT_B}/Notes/cast.md`;
const FOLDERS = [{ path: ROOT_A, name: 'root-a' }, { path: ROOT_B, name: 'root-b' }];

/** Two workspace folders on an in-memory disk: the only stand-ins are the platform ports. */
function createPlatform() {
  const files = new Map<string, string>([
    [CAST_A, 'Cast for the first folder: the keeper of the lamp and the ferryman.'],
    [CAST_B, 'Cast for the second folder: the gardener and the clockmaker.']
  ]);
  const isDirectory = (candidate: string) => [...files.keys()].some((file) => file.startsWith(`${candidate}/`));
  const fileSystem: FileSystem = {
    readFile: async (filePath) => {
      const text = files.get(filePath);
      if (text === undefined) {
        throw new Error(`ENOENT ${filePath}`);
      }
      return new Uint8Array(Buffer.from(text, 'utf8'));
    },
    stat: async (filePath): Promise<FileStat> => {
      const text = files.get(filePath);
      if (text !== undefined) {
        return { type: FileType.File, ctime: 0, mtime: 0, size: Buffer.byteLength(text) };
      }
      if (isDirectory(filePath)) {
        return { type: FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error(`ENOENT ${filePath}`);
    },
    writeFile: async () => undefined,
    rename: async () => undefined,
    delete: async () => undefined,
    readDirectory: async () => [],
    createDirectory: async () => undefined
  };
  const folderOf = (filePath: string) => FOLDERS.find((folder) => filePath.startsWith(`${folder.path}/`));
  const workspace: Workspace = {
    workspaceFolders: () => FOLDERS,
    extensionPath: '/ext',
    // As VS Code's asRelativePath(file, false): relative to its folder, without the folder's name.
    asRelativePath: (filePath: string) => {
      const folder = folderOf(filePath);
      return folder ? path.posix.relative(folder.path, filePath) : filePath;
    },
    findFiles: async (root: string, include: string) => {
      const pattern = new RegExp(`^${include.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
      return [...files.keys()].filter((file) => file.startsWith(`${root}/`) && pattern.test(path.posix.relative(root, file)));
    }
  };
  // eslint-disable-next-line @typescript-eslint/naming-convention -- a settings key, as the configuration names it.
  const settings = createFakeSettings({ 'contextPaths.characters': 'Notes/*.md' });
  const pickFile = jest.fn();
  return { files, fileSystem, workspace, settings, pickFile };
}

/** The real host for one Lightbox tab, and the tab rendered over it. */
function openTab() {
  const platform = createPlatform();
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const textSources = new TextSourceResolver(
    platform.fileSystem,
    platform.workspace,
    platform.settings,
    createFakeEditorContext(),
    log
  );
  const catalog = new WorkshopContextIntakeService(
    new ContextResourceResolver(platform.settings, platform.fileSystem, platform.workspace, log),
    platform.fileSystem,
    platform.workspace
  );
  const projectFilePorts = { catalog, workspace: platform.workspace };
  const service = new LightboxService(
    new ProseStatsService(platform.fileSystem, platform.workspace),
    new WordFrequencyService({} as ToolOptionsProvider),
    new StyleFlagsService(),
    { enrichWithStandards: async (stats: object) => stats } as never
  );
  const runner = new LightboxReadingRunner(
    { getEngine: () => undefined, getResolvedModel: () => 'provider/model-v1' },
    { loadPrompts: async () => 'SYSTEM' },
    { capture: async () => undefined },
    { present: async () => undefined },
    log,
    { catalog: { contextLength: () => 200_000, pricing: () => ({ promptUsdPerToken: 0, completionUsdPerToken: 0 }) } }
  );
  const shelf = new LightboxContextShelf();

  const posted: ExtensionToWebviewMessage[] = [];
  const queued: ExtensionToWebviewMessage[] = [];
  const transport = async (message: ExtensionToWebviewMessage) => {
    posted.push(message);
    queued.push(message);
  };
  const router = new MessageRouter();
  new LightboxHandler(service, textSources, { pickFile: platform.pickFile }, projectFilePorts, transport, log).registerRoutes(router);
  new LightboxReadingHandler(
    service, runner, shelf, textSources, { pickFile: platform.pickFile }, projectFilePorts, transport, log
  ).registerRoutes(router);
  const hostRoutes = new Set<string>([
    MessageType.LIGHTBOX_REQUEST_BOARD,
    MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG,
    MessageType.LIGHTBOX_ADD_CONTEXT_FILES,
    MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT
  ]);
  const vscode = createMockVSCode();
  vscode.postMessage.mockImplementation((message: { type: MessageType; payload?: object }) => {
    if (hostRoutes.has(message.type)) {
      void router.route({ type: message.type, source: 'webview.lightbox', payload: message.payload ?? {}, timestamp: 1 } as never);
    }
  });
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  render(<LightboxApp />);

  /** Let the host finish, then deliver what it posted, in order. */
  const exchange = async () => {
    await act(async () => {
      for (let round = 0; round < 8; round++) {
        await new Promise((done) => setTimeout(done, 0));
      }
    });
    act(() => {
      for (const message of queued.splice(0)) {
        window.dispatchEvent(new MessageEvent('message', { data: message }));
      }
    });
  };
  const dialog = () => screen.getByRole('dialog', { name: 'Choose from project' });
  /** Open Add from project…, wait for the catalog, and open Characters. */
  const openCharacters = async () => {
    fireEvent.click(within(screen.getByLabelText('Context')).getByRole('button', { name: 'Add from project…' }));
    await exchange();
    fireEvent.click(within(dialog()).getByRole('button', { name: /Characters/ }));
    return within(dialog()).getByRole('checkbox', { name: /Notes\/cast\.md/ }) as HTMLButtonElement;
  };
  /** Explore project folders…: the system picker, which returns `fsPath`. */
  const attachNatively = async (fsPath: string) => {
    platform.pickFile.mockResolvedValueOnce({ fsPath, uri: `file://${fsPath}` });
    fireEvent.click(within(dialog()).getByRole('button', { name: /Explore project folders/ }));
    await exchange();
  };
  const latest = <T,>(type: MessageType): T | undefined =>
    posted.filter((message) => message.type === type).map((message) => message.payload as T).at(-1);
  return { platform, shelf, posted, exchange, dialog, openCharacters, attachNatively, latest };
}

describe('the Lightbox Context picker across workspace folders (PR #154 F-02)', () => {
  beforeEach(() => __resetOverlayFocusStateForTests());
  afterEach(() => __resetOverlayFocusStateForTests());

  it('leaves the first folder\'s file choosable while the second folder\'s same-named file is attached, and adds it', async () => {
    const tab = openTab();
    await tab.exchange();

    // The catalog lists the first folder's Notes/cast.md.
    expect((await tab.openCharacters()).disabled).toBe(false);
    await tab.attachNatively(CAST_B);
    expect(tab.latest<{ files: LightboxContextFile[] }>(MessageType.LIGHTBOX_CONTEXT_FILES)?.files.map((file) => file.displayPath))
      .toEqual(['Notes/cast.md']);

    const row = await tab.openCharacters();
    expect(row.disabled).toBe(false);
    expect(row.textContent).not.toContain('attached');

    fireEvent.click(row);
    fireEvent.click(within(tab.dialog()).getByRole('button', { name: /^Add 1/ }));
    await tab.exchange();

    // The host takes it too: two files, one per folder, under one display path.
    expect(tab.shelf.materials()).toEqual([
      { displayPath: 'Notes/cast.md', text: tab.platform.files.get(CAST_B) },
      { displayPath: 'Notes/cast.md', text: tab.platform.files.get(CAST_A) }
    ]);
    expect(within(screen.getByLabelText('Context')).getAllByText('Notes/cast.md')).toHaveLength(2);
    expect(tab.latest<{ notice?: string }>(MessageType.LIGHTBOX_CONTEXT_FILES)?.notice).toBeUndefined();

    // Now the listed file is on the shelf, its row is attached.
    const attached = await tab.openCharacters();
    expect(attached.disabled).toBe(true);
    expect(attached.textContent).toContain('attached');
  });

  it('shows the listed file attached when the system picker added it, under the catalog row\'s own key, and posts no folder path', async () => {
    const tab = openTab();
    await tab.exchange();
    await tab.openCharacters();
    await tab.attachNatively(CAST_A);

    const row = await tab.openCharacters();
    expect(row.disabled).toBe(true);
    expect(row.textContent).toContain('attached');

    const [entry] = tab.latest<{ entries: LightboxProjectCatalogEntry[] }>(MessageType.LIGHTBOX_PROJECT_CATALOG)?.entries ?? [];
    const [file] = tab.latest<{ files: LightboxContextFile[] }>(MessageType.LIGHTBOX_CONTEXT_FILES)?.files ?? [];
    expect(entry?.fileKey).toMatch(/^[0-9a-f]{32}$/);
    expect(file?.fileKey).toBe(entry?.fileKey);
    expect(JSON.stringify(tab.posted)).not.toMatch(/\/root-[ab]/);
  });
});
