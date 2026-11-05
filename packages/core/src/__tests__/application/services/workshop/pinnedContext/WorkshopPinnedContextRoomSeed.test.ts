/**
 * The pinned-context room seed's planning and install (ADR 2026-11-04 D2,
 * D3, D5, D6; Slice 2b), through the real store, intake service and
 * library, into a real in-memory session aggregate:
 *
 * - order, re-read in its slot, missing ones appended, carried unpinned
 *   ones left alone;
 * - over budget skips that file and tries the next; duplicates;
 * - an empty list, and an unreadable one, which seeds nothing and says why;
 * - a plan installed under another workspace identity installs nothing;
 * - `prepare` never rejects, whatever the store or the intake service throws.
 *
 * *Alice*, with made-up paths and text.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WORKSHOP_NO_ROOM_SEED } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { workshopSessionStartResult } from '@/application/handlers/domain/workshop/WorkshopSessionStartResult';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIST_FILE, ROOT, seedHost, words } from './pinnedContextSeedHost';

const BUDGET = PROMPT_BUDGETS.contextAttachments.words;
const room = () => new WorkshopSessionService(() => Date.parse('2026-11-05T10:00:00.000Z'));
const labels = (session: WorkshopSessionService) => session.getContextAttachments().map((attachment) => attachment.label);

/** A carried file attachment, as an earlier room left it. */
function carry(session: WorkshopSessionService, relativePath: string, content: string) {
  const label = relativePath.split('/').pop()!;
  const added = session.addContextAttachment({
    kind: 'file',
    origin: 'writer',
    label,
    content,
    words: content.split(' ').length,
    sourceUri: `file://${ROOT}/${relativePath}`,
    relativePath
  });
  if (!added.ok) {
    throw new Error(`could not carry ${label}`);
  }
  return added.attachment;
}

describe('the pinned-context room seed: planning and install (Slice 2b)', () => {
  it('attaches every pinned file in pinned order, catalog files with their key and workspace files without', async () => {
    const host = seedHost({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    host.write('Project/brief.md', 'Alice follows the Rabbit down the hole.');
    host.write('Characters/alice.md', 'Alice is seven and curious.');
    host.write('Places/garden.md', 'The garden lies past the little door.');
    host.pin('Project/brief.md', 'Characters/alice.md', 'Places/garden.md');
    const session = room();

    const report = host.seed.install(await host.seed.prepare('first'), session);

    expect(labels(session)).toEqual(['brief.md', 'alice.md', 'garden.md']);
    const [brief, alice] = session.getContextAttachments();
    expect(brief).toMatchObject({ kind: 'file', origin: 'writer', relativePath: 'Project/brief.md', content: 'Alice follows the Rabbit down the hole.' });
    expect(brief.configuredResource).toBeUndefined();
    expect(alice).toMatchObject({ relativePath: 'Characters/alice.md', configuredResource: { group: 'characters', path: 'Characters/alice.md' } });
    expect(report).toEqual({ pinnedCount: 3, attachedCount: 3, attachedWords: 7 + 5 + 7, leftOut: [] });
    expect(host.lines).toContain('[WorkshopPinnedContext] Seeded first room (attached=3, missing=0, unreadable=0, over-budget=0)');
  });

  it('New re-reads a carried pinned file in its slot, appends the missing ones in pinned order, and leaves the rest alone', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is now nine.');
    host.write('Characters/the-hatter.md', 'The Hatter keeps six o’clock.');
    host.write('Project/brief.md', 'A girl, a hole, a garden.');
    host.pin('Project/brief.md', 'Characters/alice.md', 'Characters/the-hatter.md');
    const session = room();
    const note = session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'Tea-party notes', content: 'Tea at six.', words: 3 });
    const alice = carry(session, 'Characters/alice.md', 'Alice is seven.');
    const queen = carry(session, 'Characters/the-queen.md', 'The Queen shouts.');

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(labels(session)).toEqual(['Tea-party notes', 'alice.md', 'the-queen.md', 'brief.md', 'the-hatter.md']);
    const after = session.getContextAttachments();
    expect(after[1]).toMatchObject({ id: alice.id, content: 'Alice is now nine.', words: 4 });
    expect(after[2]).toMatchObject({ id: queen.id, content: 'The Queen shouts.' });
    expect(after[0]).toMatchObject({ id: note.ok ? note.attachment.id : '', content: 'Tea at six.' });
    expect(report).toEqual({ pinnedCount: 3, attachedCount: 3, attachedWords: 6 + 4 + 5, leftOut: [] });
  });

  it('skips a file that doesn’t fit and tries the next; nothing is truncated to fit', async () => {
    const host = seedHost();
    host.write('Drafts/manuscript.md', words(30_000));
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Drafts/manuscript.md', 'Characters/alice.md');
    const session = room();
    carry(session, 'Research/notes.md', words(BUDGET - 20_000, 'notes'));

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(labels(session)).toEqual(['notes.md', 'alice.md']);
    expect(report).toEqual({
      pinnedCount: 2,
      attachedCount: 1,
      attachedWords: 3,
      leftOut: [{ label: 'manuscript.md', reason: 'over-budget' }]
    });
    expect(workshopSessionStartResult('carry', report)).toBe(
      'Started a new Workshop session. 1 of 2 pinned files attached; not attached: manuscript.md (doesn’t fit in the 100,000-word context limit).'
    );
  });

  it('a carried pinned file that grew past the room keeps the body it had, and says so', async () => {
    const host = seedHost();
    host.write('Drafts/manuscript.md', words(30_000));
    host.pin('Drafts/manuscript.md');
    const session = room();
    const kept = carry(session, 'Drafts/manuscript.md', 'Chapter one.');
    carry(session, 'Research/notes.md', words(BUDGET - 20_000, 'notes'));

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(session.getContextAttachments()[0]).toMatchObject({ id: kept.id, content: 'Chapter one.' });
    expect(report.leftOut).toEqual([{ label: 'manuscript.md', reason: 'over-budget' }]);
  });

  it('never attaches one file twice: a carried copy under another path is re-read in its slot', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is nine.');
    host.pin('Characters/alice.md');
    const session = room();
    // The same file, carried under an older display path the match rule can't read.
    const added = session.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'alice.md', content: 'Alice is seven.', words: 3,
      sourceUri: `file://${ROOT}/Characters/alice.md`, relativePath: 'External file: alice.md'
    });

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(session.getContextAttachments()).toHaveLength(1);
    expect(session.getContextAttachments()[0]).toMatchObject({ id: added.ok ? added.attachment.id : '', content: 'Alice is nine.' });
    expect(report).toMatchObject({ pinnedCount: 1, attachedCount: 1, leftOut: [] });
  });

  it('leaves out a missing file and an unreadable one by name, and attaches the rest', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.write('Characters/blank.md', '   ');
    host.pin('Characters/the-cheshire-cat.md', 'Characters/blank.md', 'Characters/alice.md');
    const session = room();

    const report = host.seed.install(await host.seed.prepare('full-reset'), session);

    expect(labels(session)).toEqual(['alice.md']);
    expect(report.leftOut).toEqual([
      { label: 'the-cheshire-cat.md', reason: 'missing' },
      { label: 'blank.md', reason: 'unreadable' }
    ]);
    expect(host.lines).toContain('[WorkshopPinnedContext] Seeded full-reset room (attached=1, missing=1, unreadable=1, over-budget=0)');
  });

  it.each([
    ['no list file', (host: ReturnType<typeof seedHost>) => void host],
    ['an empty list', (host: ReturnType<typeof seedHost>) => host.pin()]
  ])('%s plans nothing, attaches nothing and reports nothing', async (_name, arrange) => {
    const host = seedHost();
    arrange(host);
    const session = room();

    const report = host.seed.install(await host.seed.prepare('first'), session);

    expect(session.getContextAttachments()).toEqual([]);
    expect(report).toEqual({ pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [] });
    expect(workshopSessionStartResult('carry', report)).toBe('Started a new Workshop session.');
    expect(host.seed.takeFirstRoomReport()).toBeUndefined();
  });

  it('an unreadable list seeds nothing, and the report says why', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.fileSystem.files.set(LIST_FILE, new TextEncoder().encode('{"format": 1, "files": [{"path": "Characters/alice.md"}], "extra": true}'));
    const session = room();

    const report = host.seed.install(await host.seed.prepare('full-reset'), session);

    expect(session.getContextAttachments()).toEqual([]);
    expect(report).toEqual({ pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [{ label: 'pinned-context.json', reason: 'unreadable' }] });
    expect(workshopSessionStartResult('full-reset', report)).toBe(
      'Started a new Workshop session with the excerpt and context cleared. No pinned context attached: pinned-context.json (couldn’t be read).'
    );
    expect(host.lines).toContain('[WorkshopPinnedContext] List unreadable for a seed (unknown-key)');
  });

  it('installs nothing from a plan made under another workspace', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Characters/alice.md');
    const plan = await host.seed.prepare('full-reset');
    host.folders.splice(0, 1, { path: '/workspace/other', name: 'other' });
    const session = room();

    expect(host.seed.install(plan, session)).toEqual({ pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [] });
    expect(session.getContextAttachments()).toEqual([]);
    expect(host.lines).toContain('[WorkshopPinnedContext] Seed dropped: the workspace changed before the full-reset room started');
  });

  it('installs nothing from a plan made for another live room, or from a plan it did not make', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Characters/alice.md');
    const plan = await host.seed.prepare('new');
    host.scope.current = () => ({ available: true, liveSessionId: 'room-2' });
    const session = room();

    expect(host.seed.install(plan, session).pinnedCount).toBe(0);
    expect(host.seed.install(await WORKSHOP_NO_ROOM_SEED.prepare('new'), session).pinnedCount).toBe(0);
    expect(session.getContextAttachments()).toEqual([]);
  });

  it('a plan installs once: the coordinator never hands it back, and a second install attaches nothing', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Characters/alice.md');
    const plan = await host.seed.prepare('first');
    host.seed.install(plan, room());
    const second = room();

    expect(host.seed.install(plan, second).pinnedCount).toBe(0);
    expect(second.getContextAttachments()).toEqual([]);
  });

  it('keeps the first room’s report once, for the status ticker', async () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Characters/alice.md');

    host.seed.install(await host.seed.prepare('first'), room());

    expect(host.seed.takeFirstRoomReport()).toEqual({ pinnedCount: 1, attachedCount: 1, attachedWords: 3, leftOut: [] });
    expect(host.seed.takeFirstRoomReport()).toBeUndefined();
    host.seed.install(await host.seed.prepare('new'), room());
    expect(host.seed.takeFirstRoomReport()).toBeUndefined();
  });
});

describe('prepare never rejects (Slice 2a\'s port contract)', () => {
  const ready = () => {
    const host = seedHost();
    host.write('Characters/alice.md', 'Alice is seven.');
    host.pin('Characters/alice.md');
    return host;
  };

  it('a store whose read throws, at the first room: the report names the list', async () => {
    const host = ready();
    jest.spyOn(host.store, 'read').mockRejectedValue(Object.assign(new Error(`EACCES: ${LIST_FILE}`), { code: 'EACCES' }));

    const plan = await host.seed.prepare('first');

    expect(host.seed.install(plan, room()).leftOut).toEqual([{ label: 'pinned-context.json', reason: 'unreadable' }]);
    expect(host.lines.join('\n')).not.toContain(ROOT);
    expect(host.lines).toContain('[WorkshopPinnedContext] List read failed for a seed (EACCES)');
  });

  it('a store whose availability throws', async () => {
    const host = ready();
    jest.spyOn(host.store, 'availability').mockImplementation(() => { throw new Error('folders unreadable'); });

    await expect(host.seed.prepare('first')).resolves.toEqual({ kind: 'first' });
  });

  it('a scope that throws', async () => {
    const host = ready();
    host.scope.current = () => { throw new Error('not ready'); };

    await expect(host.seed.prepare('new')).resolves.toEqual({ kind: 'new' });
  });

  it('a catalog that throws: the files read as workspace files', async () => {
    const host = ready();
    host.providerFactory.createProvider.mockRejectedValue(new Error('catalog unreadable'));
    const session = room();

    expect(host.seed.install(await host.seed.prepare('first'), session)).toMatchObject({ attachedCount: 1, leftOut: [] });
    expect(host.lines).toContain('[WorkshopPinnedContext] Catalog unreadable for a seed; pinned files read as workspace files');
  });

  it.each([
    ['authorizeExcerptReread'],
    ['loadFile']
  ] as const)('an intake service whose %s throws: that file is unreadable, the room still starts', async (method) => {
    const host = ready();
    jest.spyOn(host.intake, method).mockRejectedValue(new Error(`EIO: ${ROOT}/Characters/alice.md`));

    const report = host.seed.install(await host.seed.prepare('first'), room());

    expect(report).toEqual({ pinnedCount: 1, attachedCount: 0, attachedWords: 0, leftOut: [{ label: 'alice.md', reason: 'unreadable' }] });
    expect(host.lines.join('\n')).not.toContain('alice');
  });

  it('a file system whose stat fails for another reason than a missing file', async () => {
    const host = ready();
    const stat = host.fileSystem.stat.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'stat').mockImplementation(async (filePath) => {
      if (filePath.endsWith('alice.md')) {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      }
      return stat(filePath);
    });

    expect(host.seed.install(await host.seed.prepare('new'), room()).leftOut).toEqual([{ label: 'alice.md', reason: 'unreadable' }]);
  });

  it('a library whose readForSeed throws', async () => {
    const host = ready();
    jest.spyOn(host.library, 'readForSeed').mockRejectedValue(new Error('surprise'));

    const plan = await host.seed.prepare('full-reset');

    expect(host.seed.install(plan, room()).leftOut).toEqual([{ label: 'pinned-context.json', reason: 'unreadable' }]);
  });
});
