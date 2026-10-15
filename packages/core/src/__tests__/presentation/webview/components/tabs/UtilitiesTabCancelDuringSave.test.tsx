/** @jest-environment jsdom */

/**
 * Cancel during the history save, end to end (PR #144 re-review, Astra F-05).
 *
 * The real Utilities tab and Dictionary hooks talk to the real
 * DictionaryHandler and a project-backed DictionaryHistoryStore through a
 * message bridge. Only the dictionary service (generation) and the file
 * system are fakes, and one file write is held open so the writer can press
 * the visible Cancel button while the entry is being saved.
 */

// Must load before the host modules below, which create text coders at load time.
import '@/__tests__/mocks/jsdomTextCoding';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useDictionaryHistory } from '@hooks/domain/useDictionaryHistory';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { AppMessageRouterDeps, buildAppMessageRoutes } from '@hooks/useAppMessageRouter';
import { MessageHandlerMap } from '@hooks/useMessageRouter';
import { DictionaryHandler } from '@handlers/domain/DictionaryHandler';
import { MessageRouter } from '@handlers/MessageRouter';
import { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { MessageType } from '@messages';
import type { LogSink } from '@/platform';

jest.mock('@hooks/useVSCodeApi');

const HISTORY_FILE = '/novel/prose-minion/history/dictionary.json';

type BridgedMessage = { type: MessageType; source: string; payload: unknown; timestamp: number };

/** Other domains' routes are never delivered here; the builder only reads their properties. */
const OTHER_DOMAINS = {
  analysis: {}, metrics: {}, context: {}, search: {}, publishingSettings: {}, wordSearchSettings: {},
  wordFrequencySettings: {}, tokensSettings: {}, themeSettings: {}, tokenTracking: {},
  contextPathsSettings: {}, modelsSettings: {}, accountBalance: {}
};

describe('UtilitiesTab cancel during the history save', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  let routes: MessageHandlerMap;
  let fileSystem: MemoryFileSystem;
  let history: DictionaryHistoryStore;
  let handler: DictionaryHandler;
  let hostRouter: MessageRouter;
  let toHost: BridgedMessage[];
  let toWebview: BridgedMessage[];
  let releaseWrite: () => void;
  let heldWrite: jest.SpyInstance;

  function Harness() {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();
    routes = buildAppMessageRoutes({
      ...OTHER_DOMAINS,
      dictionary,
      dictionaryHistory,
      selection,
      settings,
      setActiveTab: jest.fn(),
      setError: jest.fn()
    } as unknown as AppMessageRouterDeps);
    return <UtilitiesTab
      vscode={vscode}
      dictionary={dictionary}
      dictionaryHistory={dictionaryHistory}
      selection={selection}
      settings={settings}
    />;
  }

  /**
   * Carry messages both ways until the bridge is quiet. Each host message
   * reaches the webview in its own act, with a render between, as streamed
   * tokens do in VS Code. Back-to-back delivery before a re-render is
   * UtilitiesTabLookupSettlement's subject. Host handlers run unawaited, so a
   * held write keeps its lookup suspended exactly as it would in VS Code.
   */
  const pump = async (): Promise<void> => {
    for (let round = 0; round < 25; round += 1) {
      const outbound = toWebview.splice(0);
      for (const message of outbound) {
        act(() => {
          routes[message.type]?.(message as never);
        });
      }
      for (const message of toHost.splice(0)) {
        if (hostRouter.hasHandler(message.type)) {
          void hostRouter.route(message as never);
        }
      }
      // jsdom has no setImmediate; a zero timeout is the same macrotask flush.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      if (toWebview.length === 0 && toHost.length === 0 && outbound.length === 0) {
        return;
      }
    }
  };

  const sent = (type: MessageType) => [...hostPosted].filter(message => message.type === type);
  let hostPosted: BridgedMessage[];

  const runButton = () => screen.getByRole('button', { name: 'Run Dictionary Lookup' }) as HTMLButtonElement;
  const cancelButton = () => screen.queryByTitle('Cancel') as HTMLButtonElement | null;
  const positionLabel = () => document.querySelector('.pm-dictionary-history-position');

  const startLookup = async (word: string): Promise<void> => {
    fireEvent.change(screen.getByPlaceholderText(/Enter the word or phrase/), { target: { value: word } });
    fireEvent.click(runButton());
    await pump();
  };

  beforeEach(() => {
    toHost = [];
    toWebview = [];
    hostPosted = [];
    vscode = createMockVSCode();
    vscode.getState.mockReturnValue({});
    vscode.postMessage.mockImplementation((message: BridgedMessage) => { toHost.push(message); });
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);

    fileSystem = new MemoryFileSystem();
    const log: LogSink = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() } as never;
    history = new DictionaryHistoryStore(
      fileSystem,
      createFakeWorkspace({ workspaceFolders: () => [{ path: '/novel', name: 'novel' }] }),
      log,
      { createId: () => 'hist-1', now: () => new Date('2026-10-14T14:02:00.000Z') }
    );

    // The first file write (the entry's save) waits until the test releases it.
    const gate = new Promise<void>(resolve => { releaseWrite = resolve; });
    const writeFile = fileSystem.writeFile.bind(fileSystem);
    heldWrite = jest.spyOn(fileSystem, 'writeFile').mockImplementationOnce(async (filePath, data) => {
      await gate;
      return writeFile(filePath, data);
    });

    const dictionaryService = {
      lookupWordStreaming: jest.fn(async (_word: string, _context: string | undefined, onToken: (token: string) => void) => {
        onToken('Generated ');
        onToken('entry.');
        return { content: 'Generated entry.', toolName: 'dictionary_lookup', finishReason: 'stop', outcome: 'entry', modelId: 'model/A' };
      })
    };
    handler = new DictionaryHandler(dictionaryService as never, history, async (message) => {
      hostPosted.push(message as BridgedMessage);
      toWebview.push(message as BridgedMessage);
      return true;
    }, log);
    hostRouter = new MessageRouter();
    handler.registerRoutes(hostRouter);
  });

  afterEach(() => {
    handler.dispose();
    jest.clearAllMocks();
  });

  it('pressing Cancel while the entry saves is honored everywhere: acknowledged, cancelled, no result, nothing retained', async () => {
    render(<Harness />);
    await pump();

    await startLookup('gloaming');

    // Generation is done and the entry's save is in flight; Cancel is still offered.
    expect(heldWrite).toHaveBeenCalledTimes(1);
    expect(cancelButton()).not.toBeNull();
    expect(runButton().disabled).toBe(true);

    fireEvent.click(cancelButton()!);
    await pump();
    expect(sent(MessageType.STATUS).map(message => (message.payload as { message: string }).message))
      .toContain('Dictionary lookup cancelled');

    releaseWrite();
    await pump();

    expect(sent(MessageType.STREAM_COMPLETE)).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ cancelled: true }) })
    ]);
    expect(sent(MessageType.DICTIONARY_RESULT)).toEqual([]);
    expect((await history.snapshot()).entries).toEqual([]);
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({ entries: [] });
    // The webview kept what streamed, released the lock, and never saw an entry.
    expect(screen.getByText('Generated entry.')).toBeTruthy();
    expect(runButton().disabled).toBe(false);
    expect(positionLabel()).toBeNull();
    expect(document.querySelector('.pm-dictionary-history-meta')).toBeNull();
  });

  it('without a cancel, the same save completes as a recorded success (control)', async () => {
    render(<Harness />);
    await pump();

    await startLookup('gloaming');
    expect(heldWrite).toHaveBeenCalledTimes(1);
    releaseWrite();
    await pump();

    expect(sent(MessageType.STREAM_COMPLETE)).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ cancelled: false }) })
    ]);
    expect(sent(MessageType.DICTIONARY_RESULT)).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ historyEntryId: 'hist-1' }) })
    ]);
    expect((await history.snapshot()).entries.map(entry => entry.id)).toEqual(['hist-1']);
    expect(screen.getByText('Generated entry.')).toBeTruthy();
    expect(runButton().disabled).toBe(false);
    expect(positionLabel()?.textContent).toBe('1 / 1');
    expect(document.querySelector('.pm-dictionary-history-meta')?.textContent).toContain('model/A');
  });
});
