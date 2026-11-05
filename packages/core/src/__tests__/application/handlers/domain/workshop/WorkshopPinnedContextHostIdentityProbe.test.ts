/**
 * Astra's PR #210 probe (`docs/pr-reviews/probes/pr-210-host-identity.test.ts.txt`), promoted as a
 * regression for F01, F05 and F06. The only change is braces on one one-line `if`, for the lint rule `curly`. Its behavior and assertions are as
 * Astra wrote them.
 */
import { MessageType } from '@messages';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { ROOT } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { harness } from './workshopPinnedContextHandlerHost';

it.each(['missing', 'unreadable'] as const)('does not claim every pinned file is attached when the only source is %s', async state => {
  const h = harness();
  h.pin('Characters/alice.md');
  if (state === 'unreadable') {h.write('Characters/alice.md', '   ');}
  const answer = await h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {});
  console.log({state, answer, attachments: h.session.getContextAttachments()});
  expect(h.session.getContextAttachments()).toEqual([]);
  expect(answer.notice).not.toEqual({kind: 'refused', text: 'Every pinned file is already in this conversation.'});
});

it('opens the same normalized catalog source that the pinned list describes and attaches', async () => {
  const nfd = 'Characters/cafe\u0301.md';
  const nfc = 'Characters/caf\u00e9.md';
  const h = harness({ platform: 'posix', catalog: [{group:'characters', path:nfd}] });
  h.pin(nfc); h.write(nfd, 'The café source.');
  const described = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
  const attached = await h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {});
  await h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, { entryPath: nfc });
  console.log({described, attached, source: h.session.getContextAttachments()[0], opened: h.shell.openFileInEditor.mock.calls});
  expect(h.shell.openFileInEditor).toHaveBeenCalledWith(`${ROOT}/${nfd}`);
});

it('pins the exact file selected in the host picker instead of a normalized catalog neighbour', async () => {
  const nfd = 'Characters/cafe\u0301.md';
  const nfc = 'Characters/caf\u00e9.md';
  const h = harness({ platform: 'posix', catalog: [{group:'characters', path:nfd}] });
  h.write(nfd, 'An unrelated decomposed file.');
  h.write(nfc, 'The exact selected file.');
  h.shell.pickFile.mockResolvedValueOnce({ fsPath: `${ROOT}/${nfc}`, uri: `file://${ROOT}/${nfc}` });
  const pinned = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_PICK_FILE, {revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION});
  const attached = await h.send(MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, {});
  console.log({pinned, attached, attachments: h.session.getContextAttachments()});
  expect(h.session.getContextAttachments()[0]).toMatchObject({ content:'The exact selected file.', relativePath:nfc });
});
