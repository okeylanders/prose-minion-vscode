/**
 * Lightbox source ownership (PR #148 F-01). The shared LightboxService owns
 * the writer's source intent: each request takes a ticket before anything is
 * awaited, and only the newest ticket may adopt a board or publish a refusal.
 * Outcomes reach webviews through the service, whichever panel's handler
 * started the request.
 *
 * Real handler, service and measurement services throughout; only the file
 * reads, the picker and the standards enrichment are held open to order
 * events exactly.
 */

import { MessageType } from '@/shared/types/messages';
import { ALICE_OPENING_CURLY, ALICE_OPENING_STRAIGHT } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import {
  createLightboxHost,
  deferred,
  settle
} from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

const OLDER = 'An older choice stands by the gate.';
const NEWER = 'A newer choice waits beside the river.';

describe('Lightbox source ownership (PR #148 F-01)', () => {
  it('never lets a slower, older file read replace a newer selection', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addFile('older.md', read);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('older.md'));
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    read.resolve(OLDER);
    await older;

    expect(panel.boardPaths()).toEqual(['newer.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('newer.md');
    expect(panel.logged()).toContain('Dropped the outcome for older.md: a newer source was chosen');
  });

  it('keeps the newer of two files whose reads resolve out of order', async () => {
    const host = createLightboxHost();
    const first = deferred<string>();
    const second = deferred<string>();
    host.addFile('first.md', first);
    host.addFile('second.md', second);
    const panel = host.openPanel();

    const firstRequest = panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('first.md'));
    const secondRequest = panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('second.md'));
    second.resolve(NEWER);
    await secondRequest;
    first.resolve(OLDER);
    await firstRequest;

    expect(panel.boardPaths()).toEqual(['second.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('second.md');
  });

  it('drops a re-read that a newer selection overtook, and lets a later re-read win', async () => {
    const host = createLightboxHost();
    const file = host.addFile('chapter.md', ALICE_OPENING_CURLY);
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('chapter.md'));

    // Re-read first, then a selection: the selection is the newer choice.
    const reread = deferred<string>();
    host.files.set(file, reread);
    const rereading = panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'notes.md' });
    reread.resolve(ALICE_OPENING_STRAIGHT);
    await rereading;
    expect(panel.boardPaths()).toEqual(['chapter.md', 'notes.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('notes.md');

    // A selection still measuring, then a re-read: the re-read is newer.
    host.files.set(file, ALICE_OPENING_CURLY);
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('chapter.md'));
    const enrichment = deferred<object>();
    host.enrich.mockImplementationOnce(() => enrichment.promise);
    const selecting = panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: OLDER, relativePath: 'scrap.md' });
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    enrichment.resolve({});
    await selecting;
    expect(panel.boardPaths().slice(2)).toEqual(['chapter.md', 'chapter.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('chapter.md');
  });

  it('posts no refusal when an older read fails after a newer choice', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addFile('older.md', read);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('older.md'));
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    read.reject(new Error('Active file not found. older.md'));
    await older;

    expect(panel.posted.map((message) => message.type)).toEqual([MessageType.LIGHTBOX_BOARD]);
    expect(panel.refusals()).toEqual([]);
    expect(host.service.currentBoard()?.source.displayPath).toBe('newer.md');
  });

  it('posts no refusal when an older build fails after a newer choice', async () => {
    const host = createLightboxHost();
    const enrichment = deferred<object>();
    host.enrich.mockImplementationOnce(() => enrichment.promise);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: OLDER, relativePath: 'older.md' });
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    enrichment.reject(new Error('standards unavailable'));
    await older;

    expect(panel.boardPaths()).toEqual(['newer.md']);
    expect(panel.refusals()).toEqual([]);
    expect(panel.logged()).toContain('Board failed for older.md');
  });

  it('lands a request that outlived its panel in the panel that replaced it', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addFile('chapter.md', read);
    const closed = host.openPanel();

    const pending = closed.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('chapter.md'));
    closed.dispose();
    const reopened = host.openPanel();
    await reopened.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    read.resolve(ALICE_OPENING_CURLY);
    await pending;

    expect(reopened.boardPaths()).toEqual([null, 'chapter.md']);
    expect(closed.posted).toEqual([]);
  });

  it('never lets a closed panel\'s older request outrank the replacement panel\'s newer choice', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addFile('older.md', read);
    const closed = host.openPanel();

    const pending = closed.route(MessageType.LIGHTBOX_SET_SOURCE, host.fileSource('older.md'));
    closed.dispose();
    const reopened = host.openPanel();
    await reopened.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    read.resolve(OLDER);
    await pending;

    expect(reopened.boardPaths()).toEqual(['newer.md']);
    expect(closed.posted).toEqual([]);
    expect(host.service.currentBoard()?.source.displayPath).toBe('newer.md');
  });

  it('treats a dismissed picker as no choice: a pending source still lands', async () => {
    const host = createLightboxHost();
    const enrichment = deferred<object>();
    host.enrich.mockImplementationOnce(() => enrichment.promise);
    const panel = host.openPanel();

    const pending = panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    enrichment.resolve({});
    await pending;

    expect(host.pickFile).toHaveBeenCalledTimes(1);
    expect(panel.boardPaths()).toEqual(['newer.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('newer.md');
  });

  it('makes a picked file the choice when the picker returns it, not when it opened', async () => {
    const host = createLightboxHost();
    const chosen = host.addFile('picked.md', ALICE_OPENING_CURLY);
    const picker = deferred<{ fsPath: string; uri: string } | undefined>();
    host.pickFile.mockImplementationOnce(() => picker.promise);
    const panel = host.openPanel();

    const picking = panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'sent-while-open.md' });
    picker.resolve({ fsPath: chosen, uri: `file://${chosen}` });
    await picking;

    expect(panel.boardPaths()).toEqual(['sent-while-open.md', 'picked.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('picked.md');
  });

  it('boards a host seed under the ticket the host took, so a choice made after it wins (PR #152 F-01)', async () => {
    const host = createLightboxHost();
    host.addFile('launched.md', OLDER);
    const panel = host.openPanel();

    const launch = host.service.beginSourceRequest();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    await panel.handler.seedSource(host.fileSource('launched.md'), launch);
    expect(panel.boardPaths()).toEqual(['newer.md']);
    expect(panel.logged()).toContain('Dropped the outcome for launched.md: a newer source was chosen');

    const current = host.service.beginSourceRequest();
    await panel.handler.seedSource(host.fileSource('launched.md'), current);
    expect(panel.boardPaths()).toEqual(['newer.md', 'launched.md']);
  });

  it('mints a new ticket for every webview LIGHTBOX_SET_SOURCE, whatever its payload names', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    const held = host.service.beginSourceRequest();

    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md', ticket: held });

    // The route minted its own ticket; the one the payload named was never adopted.
    expect(host.service.isCurrentRequest(held)).toBe(false);
    expect(panel.boardPaths()).toEqual(['newer.md']);
  });

  it('sends no Lightbox board to a webview that never asked for one', async () => {
    const host = createLightboxHost();
    const sidebar = host.openPanel();
    const lightbox = host.openPanel();

    await lightbox.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer.md' });
    await settle();

    expect(lightbox.boardPaths()).toEqual(['newer.md']);
    expect(sidebar.posted).toEqual([]);
  });
});
