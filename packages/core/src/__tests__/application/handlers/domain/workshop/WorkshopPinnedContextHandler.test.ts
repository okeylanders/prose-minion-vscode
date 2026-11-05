/**
 * WorkshopPinnedContextHandler (ADR 2026-11-04 D6, D8, D9; Pinned Context
 * Slice 3): the tab's routes through the real library, store and intake
 * service on a memory folder, with a real session aggregate. *Alice*, with
 * made-up paths and text.
 */
import * as path from 'node:path';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { decodeWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import { MessageType } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIST_FILE, ROOT, words } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { BUDGET, harness } from './workshopPinnedContextHandlerHost';

describe('WorkshopPinnedContextHandler: the list', () => {
  it('answers the list with the host\'s platform, each entry\'s group, words and state, and the totals', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Project/brief.md', 'A girl, a hole, a garden.');
    h.pin('Characters/alice.md', 'Project/brief.md', 'Characters/the-cheshire-cat.md');

    const answer = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    expect(answer).toMatchObject({
      platform: 'posix',
      availability: { available: true },
      file: { state: 'ok' },
      totals: { words: 9, budgetWords: BUDGET, files: 3, maxFiles: PROMPT_BUDGETS.workshopPinnedContext.files }
    });
    expect(answer.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(answer.entries).toEqual([
      { path: 'Characters/alice.md', label: 'alice.md', group: 'characters', words: 3, state: 'ready' },
      { path: 'Project/brief.md', label: 'brief.md', words: 6, state: 'ready' },
      { path: 'Characters/the-cheshire-cat.md', label: 'the-cheshire-cat.md', state: 'missing', stateWords: 'Not found' }
    ]);
  });

  it('answers an absent list as empty at the absent revision, and a missing folder as unavailable', async () => {
    const h = harness();
    await expect(h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {})).resolves.toMatchObject({
      file: { state: 'absent' }, revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, entries: []
    });
    h.folders.splice(0);
    await expect(h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {})).resolves.toMatchObject({
      availability: { available: false, reason: 'no-workspace', words: expect.stringContaining('No folder is open') },
      revision: null
    });
  });

  it('answers an unreadable list with its words and no revision', async () => {
    const h = harness();
    h.fileSystem.files.set(LIST_FILE, new TextEncoder().encode('{"format": 1, "files": [{"path": "a.md"}, {"path": "a.md"}]}'));
    await expect(h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {})).resolves.toMatchObject({
      file: { state: 'unreadable', words: expect.stringContaining('pinned-context.json can’t be read') },
      revision: null,
      entries: []
    });
  });

  it('posts the first room\'s seed report to the status line once, after the room is ready', async () => {
    const h = harness({ report: { pinnedCount: 2, attachedCount: 1, attachedWords: 3, leftOut: [{ label: 'the-cheshire-cat.md', reason: 'missing' }] } });
    await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
    await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    expect(h.effects.roomReady).toHaveBeenCalled();
    expect(h.effects.sendStatus).toHaveBeenCalledTimes(1);
    expect(h.effects.sendStatus).toHaveBeenCalledWith(
      'Started a new Workshop session. 1 of 2 pinned files attached; not attached: the-cheshire-cat.md (not found).'
    );
    expect(h.lines.join('\n')).not.toContain('cheshire');
  });
});

describe('WorkshopPinnedContextHandler: pinning', () => {
  it('pins catalog files by key, after the ones already pinned, and answers the new list', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }, { group: 'characters', path: 'Characters/the-hatter.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Characters/the-hatter.md', 'The Hatter keeps time.');
    h.write('Project/brief.md', 'A brief.');
    h.pin('Project/brief.md');
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision,
      items: [{ group: 'characters', path: 'Characters/the-hatter.md' }, { group: 'characters', path: 'Characters/alice.md' }]
    });

    expect(answer).toMatchObject({ action: 'pin-resources', ok: true });
    expect(answer.entries.map((entry) => entry.path)).toEqual(['Project/brief.md', 'Characters/the-hatter.md', 'Characters/alice.md']);
    expect(h.listOnDisk()).toEqual(['Project/brief.md', 'Characters/the-hatter.md', 'Characters/alice.md']);
    expect(h.lines.join('\n')).not.toMatch(/alice|hatter|brief/i);
  });

  it('creates the list at the absent revision', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      items: [{ group: 'characters', path: 'Characters/alice.md' }]
    });
    expect(answer).toMatchObject({ ok: true, file: { state: 'ok' } });
    expect(h.listOnDisk()).toEqual(['Characters/alice.md']);
  });

  it('pins a room\'s file attachments by id, by catalog key or relative path', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Notes/garden.md', 'The garden door is small.');
    const byKey = h.attachFile('Characters/alice.md', true);
    const byPath = h.attachFile('Notes/garden.md', false);

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      attachmentIds: [byKey, byPath]
    });

    expect(answer).toMatchObject({ action: 'pin-attachments', ok: true });
    expect(h.listOnDisk()).toEqual(['Characters/alice.md', 'Notes/garden.md']);
  });

  it('refuses a text note, and a path outside the project, with nothing written', async () => {
    const h = harness();
    const note = h.session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'Note', content: 'Alice is curious.', words: 3 });
    if (!note.ok) {
      throw new Error('not attached');
    }
    const outside = h.attachFile('../elsewhere/alice.md', false);

    for (const id of [note.attachment.id, outside]) {
      const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [id] });
      expect(answer).toMatchObject({ ok: false, notice: { kind: 'refused', text: 'Only files inside this project can be pinned.' } });
    }
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('on POSIX, keeps a backslash in an attachment\'s path as a filename character, which can\'t be pinned', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice is seven.');
    const id = h.attachFile('Characters\\alice.md', false);
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [id] }))
      .resolves.toMatchObject({ ok: false, notice: { kind: 'refused', text: 'Can’t pin Characters\\alice.md: pinned context can’t store a file name with a backslash in it.' } });
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('on Windows, reads a backslash in an attachment\'s path as a separator', async () => {
    const h = harness({ platform: 'windows' });
    h.write('Characters/alice.md', 'Alice is seven.');
    const id = h.attachFile('Characters\\alice.md', false);
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [id] }))
      .resolves.toMatchObject({ ok: true });
    const bytes = h.fileSystem.files.get(LIST_FILE)!;
    const decoded = decodeWorkshopPinnedContext(bytes, 'windows');
    expect(decoded.ok && decoded.list.files.map((entry) => entry.path)).toEqual(['Characters/alice.md']);
  });

  it('refuses a pin past the word budget, naming the file and the bound', async () => {
    const h = harness({ catalog: [{ group: 'manuscript', path: 'Manuscript/manuscript.md' }] });
    h.write('Characters/alice.md', words(30_000));
    h.write('Manuscript/manuscript.md', words(74_000));
    h.pin('Characters/alice.md');
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, { revision, items: [{ group: 'manuscript', path: 'Manuscript/manuscript.md' }] });

    expect(answer.notice).toEqual({
      kind: 'refused',
      text: 'Can’t pin manuscript.md: pinned context would come to about 104,000 of 100,000 words. Unpin another file, or shorten this one.'
    });
    expect(h.listOnDisk()).toEqual(['Characters/alice.md']);
  });

  it('refuses a pin past the file bound', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    const many = Array.from({ length: PROMPT_BUDGETS.workshopPinnedContext.files }, (_, index) => `Notes/note-${index}.md`);
    many.forEach((entry) => h.write(entry, 'Alice.'));
    h.write('Characters/alice.md', 'Alice is seven.');
    h.pin(...many);
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, { revision, items: [{ group: 'characters', path: 'Characters/alice.md' }] });

    expect(answer.notice).toEqual({ kind: 'refused', text: 'Pinned context holds at most 20 files. Unpin a file to make room.' });
  });

  it('refuses an unreadable file and an unavailable workspace', async () => {
    const h = harness();
    h.write('Notes/blank.md', '   ');
    const blank = h.attachFile('Notes/blank.md', false);
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [blank] }))
      .resolves.toMatchObject({ notice: { kind: 'refused', text: 'Can’t pin blank.md: it’s empty.' } });

    h.write('Notes/garden.md', 'The garden.');
    const garden = h.attachFile('Notes/garden.md', false);
    h.folders.push({ path: '/workspace/other', name: 'other' });
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [garden] }))
      .resolves.toMatchObject({ notice: { kind: 'refused', text: expect.stringContaining('several folders') } });
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('refuses a stale revision and answers with the current list', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Project/brief.md', 'A brief.');
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
    h.pin('Project/brief.md');

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, { revision, items: [{ group: 'characters', path: 'Characters/alice.md' }] });

    expect(answer).toMatchObject({ ok: false, notice: { kind: 'changed' } });
    expect(answer.entries.map((entry) => entry.path)).toEqual(['Project/brief.md']);
    expect(h.listOnDisk()).toEqual(['Project/brief.md']);
  });

  it('withdraws a write when the live room moved before its commit', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    const pinning = h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      items: [{ group: 'characters', path: 'Characters/alice.md' }]
    });
    h.scope.current = () => ({ available: true, liveSessionId: 'room-2' });
    await expect(pinning).resolves.toMatchObject({ ok: false, notice: { kind: 'refused', text: 'The workspace changed, so pinned context wasn’t changed.' } });
    expect(h.listOnDisk()).toBeUndefined();
  });
});

describe('WorkshopPinnedContextHandler: forged input', () => {
  it('refuses a catalog key not in the catalog without reading a file', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Secrets/elsewhere.md', 'Not in the catalog.');
    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      items: [{ group: 'characters', path: 'Secrets/elsewhere.md' }]
    });
    expect(answer.notice).toMatchObject({ kind: 'refused', text: expect.stringContaining('isn’t in your project’s context folders') });
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('refuses a ctx id not in the room, and a malformed one, without a read', async () => {
    const h = harness();
    const readFile = jest.spyOn(h.fileSystem, 'readFile');
    for (const attachmentIds of [['ctx-99'], ['../../alice.md']]) {
      const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds });
      expect(answer).toMatchObject({ ok: false, notice: { kind: 'refused' } });
    }
    expect(readFile.mock.calls.filter(([file]) => file !== LIST_FILE)).toEqual([]);
  });

  it('refuses an entry path not in the list: no unpin, no move, nothing opened', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice is seven.');
    h.pin('Characters/alice.md');
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
    const before = h.fileSystem.files.get(LIST_FILE);

    for (const [type, extra] of [
      [MessageType.WORKSHOP_UNPIN_CONTEXT, {}],
      [MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, { direction: 'down' }],
      [MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, {}]
    ] as const) {
      const answer = await h.send(type, { revision, entryPath: '../outside/secret.md', ...extra });
      expect(answer).toMatchObject({ ok: false, notice: { kind: 'refused', text: 'That file isn’t pinned any more. This is the current list.' } });
    }
    expect(h.fileSystem.files.get(LIST_FILE)).toBe(before);
    expect(h.shell.openFileInEditor).not.toHaveBeenCalled();
  });
});

describe('WorkshopPinnedContextHandler: unpin, move, open', () => {
  it('unpins and moves by entry path, against the list as read', async () => {
    const h = harness();
    ['Characters/alice.md', 'Characters/the-hatter.md', 'Project/brief.md'].forEach((entry) => h.write(entry, 'Alice.'));
    h.pin('Characters/alice.md', 'Characters/the-hatter.md', 'Project/brief.md');
    let { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});

    ({ revision } = await h.send(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, { revision, entryPath: 'Project/brief.md', direction: 'up' }));
    expect(h.listOnDisk()).toEqual(['Characters/alice.md', 'Project/brief.md', 'Characters/the-hatter.md']);

    const top = await h.send(MessageType.WORKSHOP_MOVE_PINNED_CONTEXT, { revision, entryPath: 'Characters/alice.md', direction: 'up' });
    expect(top).toMatchObject({ ok: true, revision });

    const unpinned = await h.send(MessageType.WORKSHOP_UNPIN_CONTEXT, { revision, entryPath: 'Characters/alice.md' });
    expect(unpinned).toMatchObject({ action: 'unpin', ok: true });
    expect(h.listOnDisk()).toEqual(['Project/brief.md', 'Characters/the-hatter.md']);
  });

  it('opens a pinned entry and the list file at their contained paths', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice.');
    h.pin('Characters/alice.md');

    await expect(h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, { entryPath: 'Characters/alice.md' })).resolves.toMatchObject({ ok: true });
    await expect(h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, {})).resolves.toMatchObject({ ok: true });
    expect(h.shell.openFileInEditor.mock.calls).toEqual([[path.join(ROOT, 'Characters', 'alice.md')], [LIST_FILE]]);
  });

  it('refuses to open the list file before it exists', async () => {
    const h = harness();
    await expect(h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, {})).resolves.toMatchObject({ ok: false, notice: { kind: 'refused' } });
    expect(h.shell.openFileInEditor).not.toHaveBeenCalled();
  });
});

describe('WorkshopPinnedContextHandler: attach missing', () => {
  it('attaches each ready pinned file the room lacks, in pinned order, through the ordinary add', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice is seven.');
    h.write('Project/brief.md', 'A brief.');
    h.write('Notes/garden.md', 'The garden.');
    h.pin('Characters/alice.md', 'Project/brief.md', 'Characters/the-cheshire-cat.md', 'Notes/garden.md');
    h.attachFile('Project/brief.md', false);

    const answer = await h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {});

    expect(answer).toMatchObject({ action: 'attach-missing', ok: true, notice: { kind: 'done', text: 'Attached 2 pinned files to this conversation. Not attached: the-cheshire-cat.md (not found).' } });
    expect(h.session.getContextAttachments().map((attachment) => attachment.relativePath))
      .toEqual(['Project/brief.md', 'Characters/alice.md', 'Notes/garden.md']);
    expect(h.session.getContextAttachments()[1].configuredResource).toEqual({ group: 'characters', path: 'Characters/alice.md' });
    expect(h.effects.markDirty).toHaveBeenCalledTimes(1);
    expect(h.effects.postSessionState).toHaveBeenCalledTimes(1);
  });

  it('leaves out a file that doesn\'t fit and attaches the next', async () => {
    const h = harness();
    h.write('Manuscript/manuscript.md', words(60_000));
    h.write('Characters/alice.md', 'Alice is seven.');
    h.pin('Manuscript/manuscript.md', 'Characters/alice.md');
    h.session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'Notes', content: words(50_000), words: 50_000 });

    const answer = await h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {});

    expect(answer.notice).toEqual({
      kind: 'done',
      text: 'Attached 1 pinned file to this conversation. Not attached: manuscript.md (doesn’t fit in the 100,000-word context limit).'
    });
  });

  it('is refused while a reply runs, and while a session operation is pending, with nothing attached', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice.');
    h.pin('Characters/alice.md');
    h.effects.activeRunLabel.mockReturnValue('response');
    await expect(h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {})).resolves.toMatchObject({
      ok: false, notice: { kind: 'refused', text: expect.stringContaining('Wait for the reply to finish') }
    });
    h.effects.activeRunLabel.mockReturnValue(undefined);
    h.gate.pending = true;
    await expect(h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {})).resolves.toMatchObject({
      ok: false, notice: { kind: 'refused', text: expect.stringContaining('session save or replacement') }
    });
    expect(h.session.getContextAttachments()).toEqual([]);
  });

  it('attaches nothing when the project folder changes while the pinned files are read (PR #208 F01)', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice.');
    h.pin('Characters/alice.md');
    const read = h.store.read.bind(h.store);
    jest.spyOn(h.store, 'read').mockImplementationOnce(async (options) => {
      const result = await read(options);
      h.folders.splice(0, 1, { path: '/workspace/other', name: 'other' });
      return result;
    });
    await expect(h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {})).resolves.toMatchObject({
      ok: false, notice: { kind: 'refused', text: 'The project folder changed, so nothing was attached. Try again.' }
    });
    expect(h.session.getContextAttachments()).toEqual([]);
  });

  it('refuses a pin by key when the folder changed after the tab was asked: nothing written in either project', async () => {
    const h = harness({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
    h.write('Characters/alice.md', 'Alice.');
    const pinning = h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      items: [{ group: 'characters', path: 'Characters/alice.md' }]
    });
    h.folders.splice(0, 1, { path: '/workspace/other', name: 'other' });
    await expect(pinning).resolves.toMatchObject({ ok: false, notice: { kind: 'refused' } });
    expect(h.listOnDisk()).toBeUndefined();
    expect([...h.fileSystem.files.keys()].some((file) => file.startsWith('/workspace/other'))).toBe(false);
  });

  it('says so when every pinned file is already here', async () => {
    const h = harness();
    h.write('Characters/alice.md', 'Alice.');
    h.pin('Characters/alice.md');
    h.attachFile('Characters/alice.md', false);
    await expect(h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {})).resolves.toMatchObject({
      ok: false, notice: { kind: 'refused', text: 'Every pinned file is already in this conversation.' }
    });
    expect(h.effects.markDirty).not.toHaveBeenCalled();
  });
});
