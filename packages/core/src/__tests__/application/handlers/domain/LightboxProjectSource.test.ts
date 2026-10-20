/**
 * Lightbox "Choose from project…" (2026-10-20): the shared project picker's
 * host side. The real LightboxHandler, LightboxService and measurement
 * services, and the real configured-resource catalog
 * (WorkshopContextIntakeService) over a stand-in context-path provider.
 * Only the file reads, the picker and the standards enrichment are stand-ins,
 * and reads can be held to order events exactly.
 *
 * - The catalog the webview sees holds Markdown and plain text only, by key.
 * - A pick names a catalog key; the host resolves it inside the workspace and
 *   boards it as a file source, so Re-read file and the handoff's hash check
 *   (both read `currentRereadTarget()`) keep working.
 * - The ticket is taken when the pick arrives, before the catalog opens
 *   (PR #148 F-01, PR #152 F-01): later choices win over a pick still loading.
 *
 * All prose is public-domain (Alice's Adventures in Wonderland) or synthetic.
 */

import { MessageType } from '@/shared/types/messages';
import type {
  ConfiguredResourceSearchResults,
  ExtensionToWebviewMessage,
  LightboxProjectCatalogPayload
} from '@/shared/types/messages';
import { ALICE_OPENING_CURLY, aliceWords } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import {
  createLightboxHost,
  deferred,
  settle,
  WORKSPACE
} from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

const OLDER = 'An older chapter waits by the gate, and the lamp burns low.';
const NEWER = 'A newer chapter walks along the river, counting the stones.';

const payloadsOf = <T>(posted: ExtensionToWebviewMessage[], type: MessageType): T[] =>
  posted.filter((message) => message.type === type).map((message) => message.payload as T);

const choose = (group: string, path: string) => ({ group, path });

describe('Lightbox Choose from project: the catalog', () => {
  it('answers with the configured Markdown and plain-text files by key, and leaves anything else out', async () => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/01-down-the-rabbit-hole.md', ALICE_OPENING_CURLY);
    host.addProjectFile('characters', 'Characters/white-rabbit.txt', 'Always late.');
    host.addProjectFile('general', 'References/cover.png', 'binary');
    host.addProjectFile('general', 'References/notes.markdown', 'A note.');
    const panel = host.openPanel();

    await panel.route(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG);

    const [catalog] = payloadsOf<LightboxProjectCatalogPayload>(panel.posted, MessageType.LIGHTBOX_PROJECT_CATALOG);
    expect(catalog).toEqual({
      entries: [
        expect.objectContaining({ group: 'chapters', path: 'Chapters/01-down-the-rabbit-hole.md', label: '01-down-the-rabbit-hole' }),
        expect.objectContaining({ group: 'characters', path: 'Characters/white-rabbit.txt' }),
        expect.objectContaining({ group: 'general', path: 'References/notes.markdown' })
      ]
    });
    expect(Object.keys(catalog.entries[0]).sort()).toEqual(['group', 'label', 'path', 'sizeBytes']);
    expect(JSON.stringify(panel.posted)).not.toContain(`${WORKSPACE}/`);
    expect(panel.logged()).toContain('[LightboxProjectFiles] Catalog: 3 text file(s); 1 other file(s) left out');
    // Asking for the catalog is not a source choice: nothing is boarded or refused.
    expect(panel.boardPaths()).toEqual([]);
    expect(panel.refusals()).toEqual([]);
  });

  it('says the folders could not be read, with an empty list', async () => {
    const host = createLightboxHost();
    host.failCatalog();
    const panel = host.openPanel();

    await panel.route(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG);

    expect(payloadsOf(panel.posted, MessageType.LIGHTBOX_PROJECT_CATALOG)).toEqual([{ entries: [], unreadable: true }]);
    expect(panel.logged()).toContain('Could not read the configured resource catalog');
  });

  it('searches the text files\' content, never the files it leaves out', async () => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/01-down-the-rabbit-hole.md', ALICE_OPENING_CURLY);
    host.addProjectFile('characters', 'Characters/cheshire-cat.md', 'A grin without a cat.');
    host.addProjectFile('general', 'References/rabbit.png', 'a White Rabbit with pink eyes');
    const panel = host.openPanel();

    await panel.route(MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG, { query: '  White Rabbit ' });
    await panel.route(MessageType.LIGHTBOX_SEARCH_PROJECT_CATALOG, { query: '   ' });

    expect(payloadsOf<ConfiguredResourceSearchResults>(panel.posted, MessageType.LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS))
      .toEqual([{
        query: 'White Rabbit',
        matches: [{ group: 'chapters', path: 'Chapters/01-down-the-rabbit-hole.md' }],
        bounded: false
      }]);
  });

  it('posts nothing from a closed panel', async () => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/one.md', OLDER);
    const panel = host.openPanel();
    const catalog = host.holdCatalog();

    const request = panel.route(MessageType.LIGHTBOX_REQUEST_PROJECT_CATALOG);
    panel.dispose();
    catalog.release();
    await request;

    expect(panel.posted).toEqual([]);
  });
});

describe('Lightbox Choose from project: boarding', () => {
  it('boards a picked file through the measurements, and Re-read file reads it again', async () => {
    const host = createLightboxHost();
    const absolute = host.addProjectFile('chapters', 'Chapters/01-down-the-rabbit-hole.md', ALICE_OPENING_CURLY);
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_REQUEST_BOARD);

    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/01-down-the-rabbit-hole.md'));

    const board = host.service.currentBoard();
    expect(board?.source).toEqual(expect.objectContaining({
      kind: 'file',
      displayPath: 'Chapters/01-down-the-rabbit-hole.md',
      sourceUri: `file://${absolute}`
    }));
    expect(board?.source.wordCount).toBeGreaterThan(100);
    expect(board?.paragraphs.length).toBeGreaterThan(3);
    // What Re-read file and the handoff's hash check read: the file on disk.
    expect(host.service.currentRereadTarget()).toEqual(expect.objectContaining({ rereadPath: absolute }));
    expect(host.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: absolute });

    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    expect(panel.boardPaths()).toEqual([null, 'Chapters/01-down-the-rabbit-hole.md', 'Chapters/01-down-the-rabbit-hole.md']);
    expect(host.service.currentBoard()?.boardId).toBe(board?.boardId);
    expect(panel.logged()).not.toContain('Down the Rabbit-Hole');
  });

  it('is the same board as the same file chosen with the system picker, whatever its URI escapes', async () => {
    const host = createLightboxHost();
    const relative = 'Chapters/01 down the rabbit-hole (draft).md';
    const absolute = host.addProjectFile('chapters', relative, ALICE_OPENING_CURLY);
    const panel = host.openPanel();

    // VS Code's Uri.toString() escapes the parentheses; Node's pathToFileURL does not.
    host.pickFile.mockResolvedValueOnce({
      fsPath: absolute,
      uri: 'file:///workspace/Chapters/01%20down%20the%20rabbit-hole%20%28draft%29.md'
    });
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    const picked = host.service.currentBoard();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', relative));

    expect(host.service.currentBoard()?.boardId).toBe(picked?.boardId);
    expect(panel.logged()).toContain(`Board unchanged for ${relative}`);
  });
});

describe('Lightbox Choose from project: refusals', () => {
  it.each([
    ['a path the catalog does not list', 'chapters', '../../etc/passwd', 'That file is no longer in your configured project folders.'],
    ['a group the catalog does not use', 'locations', 'Chapters/one.md', 'That file is no longer in your configured project folders.'],
    ['a file that is not text', 'general', 'References/cover.png', 'The Lightbox reads Markdown and plain-text files, and “cover.png” is neither.']
  ])('refuses %s without reading anything, and keeps the board', async (_case, group, path, message) => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/one.md', NEWER);
    host.addProjectFile('general', 'References/cover.png', 'binary');
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/one.md'));
    host.resolve.mockClear();

    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose(group, path));

    expect(host.resolve).not.toHaveBeenCalled();
    expect(panel.refusals()).toEqual([expect.objectContaining({ reason: 'unreadable', message })]);
    expect(host.service.currentBoard()?.source.displayPath).toBe('Chapters/one.md');
  });

  it('refuses a listed file outside every open workspace folder, before reading it', async () => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/elsewhere.md', OLDER, { absolutePath: '/elsewhere/Chapters/elsewhere.md' });
    const panel = host.openPanel();

    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/elsewhere.md'));

    expect(host.resolve).not.toHaveBeenCalled();
    expect(panel.refusals()).toEqual([expect.objectContaining({
      reason: 'unreadable',
      message: 'The Lightbox reads files inside an open workspace folder.',
      displayPath: 'Chapters/elsewhere.md'
    })]);
    expect(host.service.currentBoard()).toBeUndefined();
  });

  it('refuses when the catalog cannot be opened', async () => {
    const host = createLightboxHost();
    host.failCatalog();
    const panel = host.openPanel();

    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/one.md'));

    expect(panel.refusals()).toEqual([expect.objectContaining({
      reason: 'unreadable',
      message: 'Could not read your configured project folders.',
      suggestion: 'Use Explore project folders… to choose the file instead.'
    })]);
  });

  it.each([
    ['unreadable', new Error('EACCES: permission denied'), { reason: 'unreadable', message: 'Could not read that file.' }],
    ['empty', '   \n', { reason: 'empty' }],
    ['over the ceiling', aliceWords(50_001), { reason: 'over-ceiling', wordCount: 50_001, ceilingWords: 50_000 }]
  ])('refuses a file that is %s as today\'s file sources are, and keeps the board', async (_case, entry, expected) => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/one.md', NEWER);
    host.addProjectFile('manuscript', 'Manuscript/whole.md', entry);
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/one.md'));

    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('manuscript', 'Manuscript/whole.md'));

    expect(panel.refusals()).toEqual([expect.objectContaining({ ...expected, displayPath: 'Manuscript/whole.md' })]);
    expect(host.service.currentBoard()?.source.displayPath).toBe('Chapters/one.md');
    expect(host.service.currentOutcome().refusal).toEqual(panel.refusals()[0]);
  });
});

describe('Lightbox Choose from project: source ownership (PR #148 F-01, PR #152 F-01)', () => {
  it('pick → pick: a row picked while an earlier one reads keeps the board', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older.md', read);
    host.addProjectFile('chapters', 'Chapters/newer.md', NEWER);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/newer.md'));
    read.resolve(OLDER);
    await older;

    expect(panel.boardPaths()).toEqual(['Chapters/newer.md']);
    expect(panel.logged()).toContain('Dropped the outcome for Chapters/older.md: a newer source was chosen');
  });

  it('pick → pick: the ticket is taken before the catalog opens, so a slow catalog loses to a later pick', async () => {
    const host = createLightboxHost();
    host.addProjectFile('chapters', 'Chapters/older.md', OLDER);
    host.addProjectFile('chapters', 'Chapters/newer.md', NEWER);
    const panel = host.openPanel();
    const catalog = host.holdCatalog();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/newer.md'));
    catalog.release();
    await older;

    expect(panel.boardPaths()).toEqual(['Chapters/newer.md']);
    expect(host.service.currentBoard()?.source.displayPath).toBe('Chapters/newer.md');
  });

  it('pick → selection: a selection sent while a pick reads keeps the board', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older.md', read);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: NEWER, relativePath: 'newer-selection.md' });
    read.resolve(OLDER);
    await older;

    expect(panel.boardPaths()).toEqual(['newer-selection.md']);
  });

  it('selection → pick: a row picked while a selection is measured keeps the board', async () => {
    const host = createLightboxHost();
    const measuring = deferred<object>();
    host.enrich.mockImplementationOnce(() => measuring.promise);
    host.addProjectFile('chapters', 'Chapters/picked.md', NEWER);
    const panel = host.openPanel();

    const selection = panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: OLDER, relativePath: 'older-selection.md' });
    await settle();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/picked.md'));
    measuring.resolve({});
    await selection;

    expect(panel.boardPaths()).toEqual(['Chapters/picked.md']);
    expect(panel.logged()).toContain('Dropped the outcome for older-selection.md: a newer source was chosen');
  });

  it('pick → system picker, and pick → re-read: either later choice keeps the board', async () => {
    const host = createLightboxHost();
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/first.md', firstRead);
    host.addProjectFile('chapters', 'Chapters/second.md', secondRead);
    const picked = host.addFile('picked.md', NEWER);
    const panel = host.openPanel();

    const first = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/first.md'));
    await settle();
    host.pickFile.mockResolvedValueOnce({ fsPath: picked, uri: `file://${picked}` });
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    firstRead.resolve(OLDER);
    await first;
    expect(panel.boardPaths()).toEqual(['picked.md']);

    const second = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/second.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_REFRESH_SOURCE);
    secondRead.resolve(OLDER);
    await second;

    expect(panel.boardPaths()).toEqual(['picked.md', 'picked.md']);
  });

  it('a refusal of an older pick never displaces a newer board, and publishes nothing', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older-empty.md', read);
    host.addProjectFile('chapters', 'Chapters/newer.md', NEWER);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older-empty.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/newer.md'));
    read.resolve('');
    await older;

    expect(panel.refusals()).toEqual([]);
    expect(host.service.currentOutcome()).toEqual({ board: expect.objectContaining({ boardId: host.service.currentBoard()?.boardId }), refusal: null });
    expect(panel.boardPaths()).toEqual(['Chapters/newer.md']);
  });

  it('an older pick never clears the refusal of a newer one', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older.md', read);
    host.addProjectFile('chapters', 'Chapters/newer-empty.md', '');
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/newer-empty.md'));
    const standing = host.service.currentOutcome().refusal;
    read.resolve(OLDER);
    await older;

    expect(standing).toEqual(expect.objectContaining({ reason: 'empty', displayPath: 'Chapters/newer-empty.md' }));
    expect(host.service.currentOutcome().refusal).toEqual(standing);
    expect(panel.boardPaths()).toEqual([]);
  });

  it('a payload that names no file takes no ticket: the pick still reading lands', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older.md', read);
    const panel = host.openPanel();

    const older = panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await settle();
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, { group: 'chapters' });
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, { group: 'not-a-group', path: 'x.md' });
    await panel.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, { sourceUri: 'file:///etc/passwd' });
    // Neither is opening the system picker and dismissing it.
    await panel.route(MessageType.LIGHTBOX_PICK_SOURCE_FILE);
    read.resolve(OLDER);
    await older;

    expect(panel.boardPaths()).toEqual(['Chapters/older.md']);
    expect(panel.refusals()).toEqual([]);
    expect(panel.logged()).toContain('Ignored a project source that named no catalog file');
  });

  it('a pick that outlives its panel lands in the panel that replaced it', async () => {
    const host = createLightboxHost();
    const read = deferred<string>();
    host.addProjectFile('chapters', 'Chapters/older.md', read);
    const first = host.openPanel();
    await first.route(MessageType.LIGHTBOX_REQUEST_BOARD);

    const pick = first.route(MessageType.LIGHTBOX_CHOOSE_PROJECT_SOURCE, choose('chapters', 'Chapters/older.md'));
    await settle();
    first.dispose();
    const second = host.openPanel();
    await second.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    read.resolve(OLDER);
    await pick;

    expect(first.boardPaths()).toEqual([null]);
    expect(second.boardPaths()).toEqual([null, 'Chapters/older.md']);
  });
});
