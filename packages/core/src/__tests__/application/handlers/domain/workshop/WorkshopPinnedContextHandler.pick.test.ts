/**
 * WorkshopPinnedContextHandler: Explore project folders… in pin mode
 * (Pinned Context Slice 3): the host's own picker, in the project folder;
 * only a file inside the project is pinned. *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { MessageType } from '@messages';
import { ROOT } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { harness } from './workshopPinnedContextHandlerHost';

describe('WorkshopPinnedContextHandler: Explore project folders… (the host\'s picker)', () => {
  const picks = (h: ReturnType<typeof harness>, fsPath: string | undefined) =>
    h.shell.pickFile.mockResolvedValueOnce(fsPath === undefined ? undefined : { fsPath, uri: `file://${fsPath}` });

  it('pins a file inside the project, opening the picker in the project folder', async () => {
    const h = harness();
    h.write('Notes/garden.md', 'The garden door is small.');
    picks(h, path.join(ROOT, 'Notes', 'garden.md'));
    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION });
    expect(answer).toMatchObject({ action: 'pin-file', ok: true });
    expect(h.shell.pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: ROOT }));
    expect(h.listOnDisk()).toEqual(['Notes/garden.md']);
    expect(h.lines.join('\n')).not.toContain('garden');
  });

  it('refuses a file outside the project, with nothing read or written', async () => {
    const h = harness();
    h.fileSystem.files.set('/elsewhere/alice.md', new TextEncoder().encode('Alice.'));
    const readFile = jest.spyOn(h.fileSystem, 'readFile');
    picks(h, '/elsewhere/alice.md');
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION }))
      .resolves.toMatchObject({ ok: false, notice: { kind: 'refused', text: 'Only files inside this project can be pinned.' } });
    expect(readFile.mock.calls.filter(([file]) => file === '/elsewhere/alice.md')).toEqual([]);
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('answers nothing when the picker is dismissed', async () => {
    const h = harness();
    picks(h, undefined);
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION }))
      .rejects.toThrow('no answer');
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('refuses a stale revision and answers with the current list', async () => {
    const h = harness();
    h.write('Project/brief.md', 'A brief.');
    h.write('Notes/garden.md', 'The garden.');
    h.pin('Project/brief.md');
    picks(h, path.join(ROOT, 'Notes', 'garden.md'));
    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION });
    expect(answer).toMatchObject({ ok: false, notice: { kind: 'changed' } });
    expect(answer.entries.map((entry) => entry.path)).toEqual(['Project/brief.md']);
    expect(h.listOnDisk()).toEqual(['Project/brief.md']);
  });

  it('binds the pick to the folder the room was asked in: a folder switch during the pick writes nothing (PR #208 F01)', async () => {
    const h = harness();
    h.write('Notes/garden.md', 'The garden.');
    h.shell.pickFile.mockImplementationOnce(async () => {
      h.folders.splice(0, 1, { path: '/workspace/other', name: 'other' });
      return { fsPath: path.join(ROOT, 'Notes', 'garden.md'), uri: 'file:///picked' };
    });
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION }))
      .resolves.toMatchObject({ ok: false, notice: { kind: 'refused' } });
    expect(h.shell.pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: ROOT }));
    expect(h.listOnDisk()).toBeUndefined();
  });
});
