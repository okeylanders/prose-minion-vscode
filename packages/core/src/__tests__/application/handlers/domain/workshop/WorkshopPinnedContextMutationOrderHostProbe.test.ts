/**
 * Astra's PR #210 re-review probe (`docs/pr-reviews/probes/pr-210-mutation-order-host.test.ts.txt`),
 * promoted as a regression for F03. It is unchanged: the host still answers
 * the no-op pick with the list it read first, and that answer's lower
 * observation is what keeps the webview from showing it over the unpin's.
 */
import { MessageType } from '@messages';
import { ROOT } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { harness } from './workshopPinnedContextHandlerHost';
it('PROBE: native pick of an existing pin can answer with old list after successful unpin', async () => {
 const h = harness();
 h.write('Characters/alice.md','Alice is seven.');
 h.pin('Characters/alice.md');
 const initial = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT,{});
 h.shell.pickFile.mockResolvedValue({fsPath:`${ROOT}/Characters/alice.md`,uri:`file://${ROOT}/Characters/alice.md`});
 const open = h.intake.openCatalog.bind(h.intake);
 let release!: () => void;
 let entered!: () => void;
 const reached = new Promise<void>(resolve => {entered = resolve;});
 const held = new Promise<void>(resolve => {release = resolve;});
 // The no-op pick reaches its answer's describe(): list revision/entries read already,
 // but the description still awaits the catalog/files outside the store's queue.
 jest.spyOn(h.intake,'openCatalog').mockImplementationOnce(async () => {entered(); await held; return open();});
 const pick = h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE,{revision:initial.revision});
 await reached;
 const unpin = await h.send(MessageType.WORKSHOP_UNPIN_CONTEXT,{revision:initial.revision,entryPath:'Characters/alice.md'});
 expect(unpin.ok).toBe(true);
 expect(unpin.entries).toEqual([]);
 release();
 const late = await pick;
 expect(late.ok).toBe(true);
 expect(late.entries.map(entry=>entry.path)).toEqual(['Characters/alice.md']);
 expect(late.revision).toBe(initial.revision);
 expect(h.listOnDisk()).toEqual([]);
 expect(h.posted.map(payload=>payload.requestId)).toEqual(['req-1','req-3','req-2']);
});
