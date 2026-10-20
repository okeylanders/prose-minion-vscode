/**
 * LightboxHandler (ADR 2026-10-19 D10): the `LIGHTBOX_*` routes, source
 * resolution through the shared TextSourceResolver and the ShellService
 * picker, refusals, and logs that never carry the writer's text. Runs the
 * real handler and service; only file I/O and the picker are stand-ins.
 * Source ownership across requests and panels is in
 * LightboxSourceOwnership.test.ts; refusal replay and dismissal in
 * LightboxRefusalReplay.test.ts.
 */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';
import { ALICE_OPENING_CURLY, ALICE_PARAGRAPHS, aliceWords } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { createLightboxHost } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

const TEXT_MARKER = ALICE_PARAGRAPHS[3];

describe('LightboxHandler', () => {
  it('registers exactly the Lightbox routes', () => {
    const host = createLightboxHost();
    const router = new MessageRouter();
    host.openPanel().handler.registerRoutes(router);
    expect([
      MessageType.LIGHTBOX_REQUEST_BOARD,
      MessageType.LIGHTBOX_SET_SOURCE,
      MessageType.LIGHTBOX_PICK_SOURCE_FILE,
      MessageType.LIGHTBOX_REFRESH_SOURCE,
      MessageType.LIGHTBOX_DISMISS_REFUSAL,
      MessageType.LIGHTBOX_HAND_OFF,
      MessageType.LIGHTBOX_OPEN_WORKSHOP
    ].every((type) => router.hasHandler(type))).toBe(true);
    expect(router.handlerCount).toBe(7);
  });

  it('answers a board request with the current board, or null before the first', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    expect(panel.posted).toEqual([expect.objectContaining({
      type: MessageType.LIGHTBOX_BOARD,
      source: 'extension.lightbox',
      payload: { board: null, refusal: null }
    })]);

    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ALICE_OPENING_CURLY, relativePath: 'Drafts/alice-1.md' });
    const reopened = host.openPanel();
    await reopened.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    expect(reopened.boardPaths()).toEqual(['Drafts/alice-1.md']);
  });

  it('boards a selection from its own text, without reading a file', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, {
      text: ALICE_OPENING_CURLY,
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      relativePath: 'Drafts/alice-1.md',
      startLine: 3,
      endLine: 14
    });

    expect(host.resolve).not.toHaveBeenCalled();
    expect(panel.posted).toEqual([expect.objectContaining({ type: MessageType.LIGHTBOX_BOARD })]);
    expect(host.service.currentBoard()?.source).toEqual(expect.objectContaining({
      kind: 'selection',
      displayPath: 'Drafts/alice-1.md',
      sourceUri: 'file:///workspace/Drafts/alice-1.md',
      startLine: 3,
      endLine: 14
    }));
    expect(panel.logged()).toContain('Board built for Drafts/alice-1.md');
    expect(panel.logged()).not.toContain(TEXT_MARKER);
  });

  it('reads a file source through the resolver by its absolute path', async () => {
    const host = createLightboxHost();
    host.addFile('Drafts/alice-1.md', ALICE_OPENING_CURLY);
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('Drafts/alice-1.md'));

    expect(host.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: '/workspace/Drafts/alice-1.md' });
    expect(panel.boardPaths()).toEqual(['Drafts/alice-1.md']);
    expect(host.service.currentBoard()?.source.kind).toBe('file');
    expect(host.service.currentRereadTarget()?.rereadPath).toBe('/workspace/Drafts/alice-1.md');
    expect(JSON.stringify(panel.posted)).not.toContain('rereadPath');
  });

  it('refuses an unsaved document instead of guessing a file', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: 'untitled:Untitled-1', relativePath: 'Untitled-1' });

    expect(host.resolve).not.toHaveBeenCalled();
    expect(panel.refusals()).toEqual([expect.objectContaining({ reason: 'unreadable', displayPath: 'Untitled-1' })]);
  });

  it('posts LIGHTBOX_SOURCE_REFUSED for a source over the ceiling, with its count', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    const text = aliceWords(60_000);
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text, relativePath: 'Drafts/whole-book.md' });

    expect(panel.posted).toEqual([expect.objectContaining({
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
    expect(panel.logged()).toContain('Source refused (over-ceiling) for Drafts/whole-book.md: 60000 words');
    expect(panel.logged()).not.toContain(text.slice(0, 40));
  });

  it('does nothing when the writer dismisses the picker, and boards the chosen file', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    expect(host.pickFile).toHaveBeenCalledWith(expect.objectContaining({ openLabel: 'Open' }));
    expect(panel.posted).toEqual([]);

    const chosen = host.addFile('Drafts/alice-1.md', ALICE_OPENING_CURLY);
    host.pickFile.mockResolvedValueOnce({ fsPath: chosen, uri: `file://${chosen}` });
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    expect(host.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: chosen });
    expect(panel.boardPaths()).toEqual(['Drafts/alice-1.md']);
  });

  it('refuses a picked file outside the workspace in the Lightbox\'s words, naming it', async () => {
    const host = createLightboxHost();
    host.files.set('/elsewhere/notes.md', new Error('Text source path must be inside an open workspace folder.'));
    host.pickFile.mockResolvedValueOnce({ fsPath: '/elsewhere/notes.md', uri: 'file:///elsewhere/notes.md' });
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);

    expect(panel.refusals()).toEqual([expect.objectContaining({
      reason: 'unreadable',
      message: 'The Lightbox reads files inside an open workspace folder.',
      displayPath: 'notes.md'
    })]);
    expect(panel.logged()).toContain('Could not read a source file');
  });

  it('re-reads the current file, or refuses when there is none', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(panel.refusals()).toEqual([expect.objectContaining({ reason: 'not-refreshable' })]);

    const file = host.addFile('Drafts/alice-1.md', ALICE_OPENING_CURLY);
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('Drafts/alice-1.md'));
    host.resolve.mockClear();
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(host.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: file });
    expect(panel.boardPaths()).toEqual(['Drafts/alice-1.md', 'Drafts/alice-1.md']);
    expect(panel.logged()).toContain('Board unchanged for Drafts/alice-1.md');
  });
});
