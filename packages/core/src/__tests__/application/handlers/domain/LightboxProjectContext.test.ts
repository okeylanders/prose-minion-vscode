/**
 * Lightbox context from the project picker (2026-10-20): the shared picker's
 * attach mode over the Lightbox's own route, `LIGHTBOX_ADD_PROJECT_CONTEXT`.
 *
 * The real LightboxReadingHandler, LightboxService, LightboxReadingRunner and
 * context shelf, and the real configured-resource catalog
 * (WorkshopContextIntakeService) over a stand-in context-path provider; the
 * provider engine is a stub, so no provider is called.
 *
 * - Files are named by catalog key and resolved inside the workspace; the
 *   shelf's own rules hold (not the board's source, not empty, not already
 *   there, within `PROMPT_BUDGETS.contextFiles.words`), and every refusal is
 *   reported with its reason.
 * - An attach moves the shelf's revision: the next estimate has a new key,
 *   and a press priced before the attach is refused.
 * - Context is never evidence: a reading that quotes a context file loses
 *   that claim, as for a file the system picker added.
 *
 * Context notes are synthetic; the chapter is the worked examples'
 * (Alice's Adventures in Wonderland, public domain).
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@/shared/types/messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { lightboxFileKey } from '@/infrastructure/lightbox/LightboxFileKey';
import { frame, framedJson } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import {
  CONTEXT_TEXT,
  createLightboxReadingHost,
  examples,
  groupOf,
  ok,
  settle
} from '@/__tests__/application/handlers/domain/lightboxReadingHarness';

const ESTIMATE_CHANGED = /^The estimate changed since it was shown/;
const CAST = 'The Dormouse sleeps through every tea party and wakes only to tell a story about treacle.';
const PLACES = 'The garden lies behind a tiny door, and the key sits on a glass table.';

const item = (group: string, path: string) => ({ group, path });

async function setup() {
  const host = await createLightboxReadingHost();
  const tab = host.openTab();
  host.addProjectFile('characters', 'Characters/dormouse.md', CAST);
  host.addProjectFile('locations', 'Locations/garden.md', PLACES);
  const attach = (...items: object[]) => tab.route(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, { items });
  const lastList = () => tab.ofType(MessageType.LIGHTBOX_CONTEXT_FILES).at(-1)?.payload;
  return { host, tab, attach, lastList };
}

describe('Lightbox context from the project picker', () => {
  it('attaches one file by its catalog key, read from inside the workspace', async () => {
    const { host, attach, lastList } = await setup();

    await attach(item('characters', 'Characters/dormouse.md'));

    expect(lastList()).toEqual({
      files: [{ id: 'ctx-1', displayPath: 'Characters/dormouse.md', wordCount: 16, fileKey: lightboxFileKey('/workspace/Characters/dormouse.md') }],
      totalWords: 16,
      ceilingWords: PROMPT_BUDGETS.contextFiles.words
    });
    expect(host.resolve).toHaveBeenCalledWith({ mode: 'activeFile', pathText: '/workspace/Characters/dormouse.md' });
    expect(host.shelf.revision()).toBe(1);
  });

  it('attaches several in the writer\'s order, with one answer', async () => {
    const { host, tab, attach, lastList } = await setup();

    await attach(item('locations', 'Locations/garden.md'), item('characters', 'Characters/dormouse.md'));

    expect(lastList()?.files.map((file) => file.displayPath)).toEqual(['Locations/garden.md', 'Characters/dormouse.md']);
    expect(lastList()?.notice).toBeUndefined();
    expect(tab.ofType(MessageType.LIGHTBOX_CONTEXT_FILES)).toHaveLength(1);
    expect(host.shelf.revision()).toBe(2);
  });

  it('refuses a duplicate, whichever door added the first, and says so', async () => {
    const { host, tab, attach, lastList } = await setup();
    host.pickFile.mockResolvedValueOnce({ fsPath: '/workspace/Characters/dormouse.md', uri: 'file:///workspace/Characters/dormouse.md' });
    await tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);

    await attach(
      item('characters', 'Characters/dormouse.md'),
      item('locations', 'Locations/garden.md'),
      item('locations', 'Locations/garden.md')
    );

    expect(lastList()?.files.map((file) => file.displayPath)).toEqual(['Characters/dormouse.md', 'Locations/garden.md']);
    expect(lastList()?.notice).toBe(
      'Added 1 of 3. Characters/dormouse.md is already in the context. Locations/garden.md is already in the context.'
    );
    expect(host.shelf.revision()).toBe(2);
  });

  it('holds each file to the words the earlier ones left, and names the one over the ceiling', async () => {
    const { host, attach, lastList } = await setup();
    const ceiling = PROMPT_BUDGETS.contextFiles.words;
    host.addProjectFile('manuscript', 'Manuscript/long-notes.md', Array.from({ length: ceiling - 10 }, () => 'word').join(' '));

    await attach(item('characters', 'Characters/dormouse.md'), item('manuscript', 'Manuscript/long-notes.md'));

    expect(lastList()?.files.map((file) => file.displayPath)).toEqual(['Characters/dormouse.md']);
    expect(lastList()?.notice).toBe(
      `Added 1 of 2. Manuscript/long-notes.md has ${(ceiling - 10).toLocaleString('en-US')} words, and the context holds ` +
        `16 of its ${ceiling.toLocaleString('en-US')}. Remove a file, or choose a shorter one.`
    );
  });

  it.each([
    ['outside every open workspace folder', () => item('characters', 'Characters/elsewhere.md'),
      'Characters/elsewhere.md: The Lightbox reads files inside an open workspace folder.'],
    ['not text', () => item('general', 'References/cover.png'),
      'References/cover.png: The Lightbox reads Markdown and plain-text files, and “cover.png” is neither.'],
    ['not in the catalog', () => item('characters', '../../etc/passwd'),
      '../../etc/passwd: That file is no longer in your configured project folders.'],
    ['the board\'s own source', () => item('chapters', 'Drafts/alice-1.md'),
      'Drafts/alice-1.md: That file is the board\'s own source. Context informs the chapter; it is not the chapter.'],
    ['unreadable', () => item('characters', 'Characters/locked.md'),
      'Characters/locked.md: Could not read that file. Choose a text or Markdown file inside an open workspace folder.']
  ])('refuses a file %s, with its reason, and changes nothing', async (_case, named, notice) => {
    const { host, attach, lastList } = await setup();
    host.addProjectFile('characters', 'Characters/elsewhere.md', CAST, '/elsewhere/Characters/elsewhere.md');
    host.addProjectFile('general', 'References/cover.png', 'binary');
    host.addProjectFile('chapters', 'Drafts/alice-1.md', CONTEXT_TEXT);
    host.addProjectFile('characters', 'Characters/locked.md', new Error('EACCES: permission denied'));
    host.resolve.mockClear();

    await attach(named());

    expect(lastList()).toEqual(expect.objectContaining({ files: [], totalWords: 0, notice }));
    expect(host.shelf.revision()).toBe(0);
    if (!/unreadable/.test(_case)) {
      expect(host.resolve).not.toHaveBeenCalled();
    }
  });

  it('answers a request that names no file with a reason, and changes nothing', async () => {
    const { host, tab, lastList } = await setup();

    await tab.route(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, { items: [{ sourceUri: 'file:///etc/passwd' }] });
    expect(lastList()?.notice).toBe('Choose at least one file from the project list.');
    await tab.route(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, {});
    expect(lastList()?.notice).toBe('Choose at least one file from the project list.');
    await tab.route(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, {
      items: [{ group: 'characters', path: 'Characters/dormouse.md' }, { path: 'x.md' }]
    });
    expect(lastList()?.notice).toBe('Added 1 of 2. 1 of the chosen files could not be found in the project list.');
    expect(host.shelf.list().map((file) => file.displayPath)).toEqual(['Characters/dormouse.md']);
  });

  it('removes an attached file as before, and the escape hatch is still the system picker', async () => {
    const { host, tab, attach, lastList } = await setup();
    await attach(item('characters', 'Characters/dormouse.md'));

    await tab.route(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id: 'ctx-1' });
    expect(lastList()?.files).toEqual([]);
    expect(host.shelf.revision()).toBe(2);

    // Explore project folders… sends LIGHTBOX_ADD_CONTEXT_FILES: the system picker, as before.
    await tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    expect(host.pickFile).toHaveBeenCalledTimes(1);
    expect(lastList()?.files).toEqual([
      { id: 'ctx-2', displayPath: 'Notes/cast.md', wordCount: 15, fileKey: lightboxFileKey('/workspace/Notes/cast.md') }
    ]);
    // A dismissed picker changes nothing and posts nothing.
    const before = tab.ofType(MessageType.LIGHTBOX_CONTEXT_FILES).length;
    host.pickFile.mockResolvedValueOnce(undefined as never);
    await tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    expect(tab.ofType(MessageType.LIGHTBOX_CONTEXT_FILES)).toHaveLength(before);
  });
});

describe('Lightbox context from the project picker: the estimate (PR #149 F-02)', () => {
  it('moves the estimate: an attach gives the next estimate a new key and its words', async () => {
    const { tab, attach } = await setup();
    const before = await tab.setLenses([]);
    const wordsBefore = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate?.contextWords;

    await attach(item('characters', 'Characters/dormouse.md'));
    // The host never estimates unasked; the webview asks when it sees the list change.
    const estimates = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).length;
    const after = await tab.setLenses([]);

    expect(tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE)).toHaveLength(estimates + 1);
    expect(after).not.toBe(before);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate?.contextWords).toBe((wordsBefore ?? 0) + 16);
  });

  it('refuses a press priced before the attach, with nothing sent; a fresh estimate runs', async () => {
    const { host, tab, attach } = await setup();
    const stale = await tab.setLenses([]);
    await attach(item('characters', 'Characters/dormouse.md'));

    await tab.run({ mode: 'all' }, { estimateKey: stale });
    await settle();
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload)
      .toEqual(expect.objectContaining({ phase: 'refused', message: expect.stringMatching(ESTIMATE_CHANGED) }));

    await tab.run({ mode: 'all' });
    await settle();
    expect(host.runInitial).toHaveBeenCalled();
    expect(host.runInitial.mock.calls[0][0].userMessage).toContain(`## Context file 1: Characters/dormouse.md\n\n${CAST}`);
  });

  it('refuses a press still being prepared when the attach lands', async () => {
    const { host, tab, attach } = await setup();
    const key = await tab.setLenses([]);
    host.holdPrompts();
    const press = tab.run({ mode: 'all' }, { estimateKey: key });
    await settle();

    await attach(item('locations', 'Locations/garden.md'));
    host.releasePrompts();
    await press;
    await settle();

    expect(host.runInitial).not.toHaveBeenCalled();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload)
      .toEqual(expect.objectContaining({ phase: 'refused', message: expect.stringMatching(ESTIMATE_CHANGED) }));
  });
});

describe('Lightbox context from the project picker is never evidence (ADR 2026-10-19 D9)', () => {
  it('withholds a claim that quotes an attached context file, though the call carried its text', async () => {
    const quotingContext = framedJson(examples.A.response) as {
      headline: { evidence: Array<{ para: number; quote: string }> };
    };
    quotingContext.headline.evidence = [
      { para: 2, quote: 'The Dormouse sleeps through every tea party' },
      { para: 4, quote: 'wakes only to tell a story about treacle' }
    ];
    const host = await createLightboxReadingHost({
      respond: (request) => (groupOf(request) === 'A' ? ok('A', frame('A', quotingContext)) : ok(groupOf(request)))
    });
    const tab = host.openTab();
    host.addProjectFile('characters', 'Characters/dormouse.md', CAST);
    await tab.route(MessageType.LIGHTBOX_ADD_PROJECT_CONTEXT, { items: [item('characters', 'Characters/dormouse.md')] });

    await tab.run({ mode: 'lens', lens: 'headline' });
    await settle();

    const [request] = host.runInitial.mock.calls[0];
    expect(request.userMessage).toContain(CAST);
    const group = host.service.currentBoard()!.readings.find((reading) => reading.group === 'A')!;
    expect(group.tiles.some((tile) => tile.kind === 'headline')).toBe(false);
    expect(group.withheldClaims).toEqual([expect.objectContaining({
      kind: 'headline',
      quotes: [
        expect.objectContaining({ paragraph: 2, reason: 'not-in-chapter' }),
        expect.objectContaining({ paragraph: 4, reason: 'not-in-chapter' })
      ]
    })]);
  });
});
