/**
 * Astra's PR #210 probe (`docs/pr-reviews/probes/pr-210-host-boundary-controls.test.ts.txt`), promoted as a
 * regression for the room, symlink and nested-root safety controls. It is unchanged. Its behavior and assertions are as
 * Astra wrote them.
 */
import { MessageType } from '@messages';
import { FileType } from '@/platform';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { ROOT } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { harness } from './workshopPinnedContextHandlerHost';

it('refuses a host pick completed after the room identity changes', async () => {
  const h = harness();
  h.write('Notes/garden.md', 'A private garden.');
  h.shell.pickFile.mockImplementationOnce(async () => {
    h.scope.current = () => ({available:true,liveSessionId:'room-2'});
    return {fsPath:`${ROOT}/Notes/garden.md`,uri:`file://${ROOT}/Notes/garden.md`};
  });
  const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE,{revision:WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION});
  expect(answer.ok).toBe(false);
  expect(h.listOnDisk()).toBeUndefined();
});

it('refuses a symlink-ancestor picked source without reading its content', async () => {
  const h = harness();
  h.write('Linked/secret.md', 'Private outside data.');
  const stat = h.fileSystem.stat.bind(h.fileSystem);
  jest.spyOn(h.fileSystem,'stat').mockImplementation(async file => file === `${ROOT}/Linked`
    ? {type:FileType.SymbolicLink,ctime:0,mtime:0,size:0} : stat(file));
  const read = jest.spyOn(h.fileSystem,'readFile');
  h.shell.pickFile.mockResolvedValueOnce({fsPath:`${ROOT}/Linked/secret.md`,uri:`file://${ROOT}/Linked/secret.md`});
  const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE,{revision:WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION});
  expect(answer.ok).toBe(false);
  expect(read).not.toHaveBeenCalledWith(`${ROOT}/Linked/secret.md`);
  expect(h.listOnDisk()).toBeUndefined();
});

it('refuses a same-key nested-project catalog row returned after A-B-A switching', async () => {
  const h = harness();
  const nested = `${ROOT}/other-project`;
  const load = jest.fn(async () => []);
  h.providerFactory.createProvider.mockImplementationOnce(async () => {
    h.moveTo(nested);
    const summary = {group:'characters' as const,path:'Characters/alice.md',label:'alice',sizeBytes:5,
      absolutePath:`${nested}/Characters/alice.md`,workspaceFolder:nested};
    h.moveTo(ROOT);
    return {listResources:()=>[summary],loadResources:load};
  });
  const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES,{revision:WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
    items:[{group:'characters',path:'Characters/alice.md'}]});
  expect(answer.ok).toBe(false);
  expect(load).not.toHaveBeenCalled();
  expect(h.listOnDisk()).toBeUndefined();
});
