/**
 * LightboxHandler (ADR 2026-10-19 D10): the four `LIGHTBOX_*` routes, source
 * resolution through the shared TextSourceResolver and the ShellService
 * picker, refusals, and logs that never carry the writer's text.
 */

import { LightboxHandler } from '@/application/handlers/domain/LightboxHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { ProseStatsService } from '@services/measurement/ProseStatsService';
import type { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import type { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import {
  ExtensionToWebviewMessage,
  LightboxBoard,
  MessageType
} from '@/shared/types/messages';
import { ALICE_OPENING_CURLY, ALICE_PARAGRAPHS, aliceWords } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';

const TEXT_MARKER = ALICE_PARAGRAPHS[3];

const board = (displayPath = 'Drafts/alice-1.md'): LightboxBoard => ({
  boardVersion: 0,
  boardId: 'board-1',
  source: {
    kind: 'file',
    displayPath,
    contentHash: 'hash',
    wordCount: 226,
    paragraphCount: 6,
    capturedAt: 1,
    preview: 'Chapter I'
  },
  paragraphs: [],
  ribbon: [],
  measured: {} as LightboxBoard['measured'],
  readings: []
});

function setup(overrides: {
  service?: Partial<Record<'buildBoard' | 'currentBoard' | 'currentRereadTarget', jest.Mock>>;
  realService?: LightboxService;
  resolve?: jest.Mock;
  pickFile?: jest.Mock;
} = {}) {
  const posted: ExtensionToWebviewMessage[] = [];
  const postMessage = jest.fn(async (message: ExtensionToWebviewMessage) => {
    posted.push(message);
  });
  const log = { appendLine: jest.fn() };
  const service = overrides.realService ?? ({
    buildBoard: jest.fn().mockResolvedValue({ kind: 'board', board: board(), reused: false }),
    currentBoard: jest.fn().mockReturnValue(undefined),
    currentRereadTarget: jest.fn().mockReturnValue(undefined),
    ...overrides.service
  } as unknown as LightboxService);
  const resolve = overrides.resolve ?? jest.fn().mockResolvedValue({
    text: ALICE_OPENING_CURLY,
    relativePaths: ['Drafts/alice-1.md'],
    displayPath: 'Drafts/alice-1.md'
  });
  const pickFile = overrides.pickFile ?? jest.fn().mockResolvedValue(undefined);
  const handler = new LightboxHandler(
    service,
    { resolve } as unknown as TextSourceResolver,
    { pickFile },
    postMessage,
    log as never
  );
  const router = new MessageRouter();
  handler.registerRoutes(router);
  const route = (type: MessageType, payload: object = {}) =>
    router.route({ type, source: 'webview.lightbox', payload, timestamp: 1 } as never);
  const logged = () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
  return { handler, router, route, posted, service, resolve, pickFile, logged };
}

describe('LightboxHandler', () => {
  it('registers exactly the four Lightbox routes', () => {
    const { router } = setup();
    expect([
      MessageType.LIGHTBOX_REQUEST_BOARD,
      MessageType.LIGHTBOX_SET_SOURCE,
      MessageType.LIGHTBOX_PICK_SOURCE_FILE,
      MessageType.LIGHTBOX_REFRESH_SOURCE
    ].every((type) => router.hasHandler(type))).toBe(true);
    expect(router.handlerCount).toBe(4);
  });

  it('answers a board request with the current board, or null before the first', async () => {
    const current = board();
    const empty = setup();
    await empty.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    expect(empty.posted).toEqual([
      expect.objectContaining({ type: MessageType.LIGHTBOX_BOARD, source: 'extension.lightbox', payload: { board: null } })
    ]);

    const filled = setup({ service: { currentBoard: jest.fn().mockReturnValue(current) } });
    await filled.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    expect(filled.posted).toEqual([expect.objectContaining({ payload: { board: current } })]);
  });

  it('boards a selection from its own text, without reading a file', async () => {
    const { route, service, resolve, posted, logged } = setup();
    await route(MessageType.LIGHTBOX_SET_SOURCE, {
      text: ALICE_OPENING_CURLY,
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      relativePath: 'Drafts/alice-1.md',
      startLine: 3,
      endLine: 14
    });

    expect(resolve).not.toHaveBeenCalled();
    expect(service.buildBoard).toHaveBeenCalledWith({
      kind: 'selection',
      text: ALICE_OPENING_CURLY,
      displayPath: 'Drafts/alice-1.md',
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      startLine: 3,
      endLine: 14
    });
    expect(posted).toEqual([expect.objectContaining({ type: MessageType.LIGHTBOX_BOARD })]);
    expect(logged()).not.toContain(TEXT_MARKER);
  });

  it('reads a file source through the resolver by its absolute path', async () => {
    const { route, service, resolve } = setup();
    await route(MessageType.LIGHTBOX_SET_SOURCE, {
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      relativePath: 'Drafts/alice-1.md'
    });

    expect(resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: '/workspace/Drafts/alice-1.md' });
    expect(service.buildBoard).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'file',
      displayPath: 'Drafts/alice-1.md',
      rereadPath: '/workspace/Drafts/alice-1.md'
    }));
  });

  it('refuses an unsaved document instead of guessing a file', async () => {
    const { route, service, posted } = setup();
    await route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: 'untitled:Untitled-1', relativePath: 'Untitled-1' });

    expect(service.buildBoard).not.toHaveBeenCalled();
    expect(posted).toEqual([expect.objectContaining({
      type: MessageType.LIGHTBOX_SOURCE_REFUSED,
      payload: { refusal: expect.objectContaining({ reason: 'unreadable' }) }
    })]);
  });

  it('posts LIGHTBOX_SOURCE_REFUSED for a source over the ceiling, with its count', async () => {
    const realService = new LightboxService(
      { analyze: jest.fn() } as unknown as ProseStatsService,
      { analyze: jest.fn() } as unknown as WordFrequencyService,
      { analyze: jest.fn() } as unknown as StyleFlagsService,
      { enrichWithStandards: jest.fn() }
    );
    const text = aliceWords(60_000);
    const { route, posted, logged } = setup({ realService });
    await route(MessageType.LIGHTBOX_SET_SOURCE, { text, relativePath: 'Drafts/whole-book.md' });

    expect(posted).toEqual([expect.objectContaining({
      type: MessageType.LIGHTBOX_SOURCE_REFUSED,
      source: 'extension.lightbox',
      payload: {
        refusal: expect.objectContaining({
          reason: 'over-ceiling',
          wordCount: 60_000,
          ceilingWords: 50_000,
          displayPath: 'Drafts/whole-book.md'
        })
      }
    })]);
    expect(logged()).toContain('Source refused (over-ceiling) for Drafts/whole-book.md: 60000 words');
    expect(logged()).not.toContain(text.slice(0, 40));
  });

  it('does nothing when the writer dismisses the picker, and boards the chosen file', async () => {
    const dismissed = setup();
    await dismissed.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    expect(dismissed.pickFile).toHaveBeenCalledWith(expect.objectContaining({ openLabel: 'Open' }));
    expect(dismissed.posted).toEqual([]);

    const chosen = setup({
      pickFile: jest.fn().mockResolvedValue({ fsPath: '/workspace/Drafts/alice-1.md', uri: 'file:///workspace/Drafts/alice-1.md' })
    });
    await chosen.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    expect(chosen.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: '/workspace/Drafts/alice-1.md' });
    expect(chosen.posted).toEqual([expect.objectContaining({ type: MessageType.LIGHTBOX_BOARD })]);
  });

  it('refuses a picked file outside the workspace in the Lightbox\'s words', async () => {
    const { route, posted, logged } = setup({
      pickFile: jest.fn().mockResolvedValue({ fsPath: '/elsewhere/notes.md', uri: 'file:///elsewhere/notes.md' }),
      resolve: jest.fn().mockRejectedValue(new Error('Text source path must be inside an open workspace folder.'))
    });
    await route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);

    expect(posted).toEqual([expect.objectContaining({
      type: MessageType.LIGHTBOX_SOURCE_REFUSED,
      payload: {
        refusal: expect.objectContaining({
          reason: 'unreadable',
          message: 'The Lightbox reads files inside an open workspace folder.'
        })
      }
    })]);
    expect(logged()).toContain('Could not read a source file');
  });

  it('re-reads the current file, or refuses when there is none', async () => {
    const none = setup();
    await none.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(none.posted).toEqual([expect.objectContaining({
      payload: { refusal: expect.objectContaining({ reason: 'not-refreshable' }) }
    })]);

    const current = setup({
      service: {
        currentRereadTarget: jest.fn().mockReturnValue({
          displayPath: 'Drafts/alice-1.md',
          rereadPath: '/workspace/Drafts/alice-1.md',
          sourceUri: 'file:///workspace/Drafts/alice-1.md'
        })
      }
    });
    await current.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(current.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: '/workspace/Drafts/alice-1.md' });
    expect(current.posted).toEqual([expect.objectContaining({ type: MessageType.LIGHTBOX_BOARD })]);
  });

  it('posts nothing for a build a newer source overtook', async () => {
    const { route, posted } = setup({ service: { buildBoard: jest.fn().mockResolvedValue({ kind: 'superseded' }) } });
    await route(MessageType.LIGHTBOX_SET_SOURCE, { text: ALICE_OPENING_CURLY });
    expect(posted).toEqual([]);
  });
});
