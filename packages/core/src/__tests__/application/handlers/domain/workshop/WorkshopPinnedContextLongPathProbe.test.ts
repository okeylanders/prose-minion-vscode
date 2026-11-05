/**
 * Astra's PR #210 probe (`docs/pr-reviews/probes/pr-210-long-path.test.ts.txt`), promoted as a
 * regression for F07. The only change is braces on three one-line `if`s, for the lint rule `curly`. Its behavior and assertions are as
 * Astra wrote them.
 */
import { MessageType } from '@messages';
import { ROOT } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { harness } from './workshopPinnedContextHandlerHost';

const longPath = Array.from({ length: 10 }, (_, i) => `${i}-${'a'.repeat(110)}`).join('/') + '/alice.md';

it.each(['unpin', 'move', 'open'] as const)('can %s a valid long path created by the host picker', async (action) => {
  const h = harness();
  h.write(longPath, 'Alice is seven.');
  h.write('brief.md', 'A short brief.');
  h.pin('brief.md');
  const initial = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
  h.shell.pickFile.mockResolvedValueOnce({ fsPath: `${ROOT}/${longPath}`, uri: `file://${ROOT}/${longPath}` });
  const pinned = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, { revision: initial.revision });
  expect(pinned.ok).toBe(true);
  expect(pinned.entries.some(entry => entry.path === longPath)).toBe(true);
  const type = action === 'unpin' ? MessageType.WORKSHOP_UNPIN_CONTEXT : action === 'move' ? MessageType.WORKSHOP_MOVE_PINNED_CONTEXT : MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE;
  const result = await h.send(type, { revision: pinned.revision, entryPath: longPath, direction: 'up' });
  expect(result.ok).toBe(true);
  if (action === 'unpin') {expect(h.listOnDisk()).toEqual(['brief.md']);}
  if (action === 'move') {expect(h.listOnDisk()).toEqual([longPath, 'brief.md']);}
  if (action === 'open') {expect(h.shell.openFileInEditor).toHaveBeenCalledWith(`${ROOT}/${longPath}`);}
});
