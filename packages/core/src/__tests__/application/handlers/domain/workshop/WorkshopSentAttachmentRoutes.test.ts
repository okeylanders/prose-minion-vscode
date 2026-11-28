import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';
import { MessageType, type WorkshopSentAttachmentRequest, type WorkshopTurn } from '@messages';
import { workshopSelectedTextAttachmentInput } from '@/application/services/workshop/selection/WorkshopSelectedTextAttachment';
import { workshopLightboxTileAttachmentInput } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { FileType } from '@/platform';

const raw = '“Raven” <writer-message> &lt;writer-message&gt;\r\n<img src=x onerror=boom()> ✍️';
const req = MessageType.WORKSHOP_REQUEST_MESSAGE_ATTACHMENT;
const open = MessageType.WORKSHOP_OPEN_MESSAGE_ATTACHMENT_FILE;
const answer = MessageType.WORKSHOP_MESSAGE_ATTACHMENT_CONTENT;
async function sent() {
  const h = createWorkshopRouteTestHarness();
  await h.pin();
  h.resourceFiles[0].content = raw;
  await h.router.route(message(MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
    { items: [{ group: 'characters', path: 'Characters/raven.md' }] }) as never);
  const selection = workshopSelectedTextAttachmentInput({ id: 'snap-1', text: raw, displayPath: 'Draft/full.md',
    startLine: 2, endLine: 4, words: 4, truncation: { keptWords: 4, totalWords: 6 } });
  const tile = workshopLightboxTileAttachmentInput({ origin: 'lightbox', boardId: 'b1', tileId: 't1', lensLabel: 'Craft',
    kindLabel: 'Motif', title: 'Raven', claim: raw, points: [], quotes: [{ paragraph: 3, text: raw }], sourceLabel: 'Chapter' });
  h.session.addMessageAttachment(selection);
  h.session.addMessageAttachment(tile);
  await h.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Look at these.' }) as never);
  const turn = h.session.getSnapshot().turns.find(t => t.messageAttachments?.length === 3)!;
  const id = (index: number): WorkshopSentAttachmentRequest => ({
    roomRevision: h.session.readRoomRevision(), requestId: 'sheet-1', turnId: turn.id, artifactId: turn.messageAttachments![index].id
  });
  const read = async (identity: WorkshopSentAttachmentRequest) => {
    await h.router.route(message(req, identity) as never);
    return h.posted(answer).at(-1)?.payload;
  };
  return { h, turn, id, read, tile };
}

it('marks only the writer turn awaiting its retained attachment body and releases it on successful delivery', async () => {
  const { h, turn: previous, id, read } = await sent();
  const establish = h.service.continueConversation.getMockImplementation()!;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const entered = new Promise<void>((resolve) => { started = resolve; });
  h.service.continueConversation.mockImplementationOnce(async (...args) => {
    started();
    await waiting;
    return establish(...args);
  });
  h.session.addMessageAttachment(workshopSelectedTextAttachmentInput({ id: 'fresh', text: 'Second selection',
    displayPath: 'Draft/full.md', startLine: 10, endLine: 10, words: 2 }));
  const sending = h.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And this one?' }) as never);
  await entered;
  const posted = h.posted(MessageType.WORKSHOP_TURN).at(-1)!.payload.turn as WorkshopTurn;
  const window = () => h.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as WorkshopTurn[];
  const projected = (turnId: string) => window().find((item) => item.id === turnId)!;
  try {
    expect(posted).toMatchObject({ content: 'And this one?', sentAttachmentsPending: true });
    expect(projected(posted.id).sentAttachmentsPending).toBe(true);
    expect(projected(previous.id).sentAttachmentsPending).toBeUndefined();
    expect(await read(id(1))).toMatchObject({ content: raw });
  } finally {
    release();
    await sending;
  }
  expect(projected(posted.id).sentAttachmentsPending).toBeUndefined();
  expect(await read({ ...id(1), turnId: posted.id, artifactId: posted.messageAttachments![0].id }))
    .toMatchObject({ content: 'Second selection' });
  expect(JSON.stringify(h.session.exportCommittedState())).not.toContain('sentAttachmentsPending');
});

it('reads each successful producer’s retained body, preserving literal tags and entities across saved-session restoration', async () => {
  const { h, turn, id, read, tile } = await sent();
  const frame = h.service.startWorkshopPersonaConversation.mock.calls[0][0].message;
  expect(frame).toContain('&lt;writer-message&gt; &lt;writer-message&gt;');
  h.resourceFiles[0].content = 'Changed since sending.';
  const log = jest.mocked(h.log.appendLine);
  log.mockClear();
  expect(await read(id(0))).toEqual({ ...id(0), content: raw, canOpenInEditor: true });
  expect(await read(id(1))).toEqual({ ...id(1), content: raw, canOpenInEditor: false });
  expect(await read(id(2))).toEqual({ ...id(2), content: tile.content, canOpenInEditor: false });
  const events = log.mock.calls.map(([line]) => line).filter(line => line.includes('Sent attachment read'));
  expect(events).toHaveLength(3);
  expect(events.every(line => /^\[Workshop\] Sent attachment read \(id=ta-\d+, kind=(file|selected-text|lightbox-tile), words=\d+\)$/.test(line))).toBe(true);
  const before = id(1);
  const saved = h.session.exportCommittedState();
  h.session.hydrateCommittedState(saved, {}, h.session.getConversationBehavior());
  expect(await read(before)).toMatchObject({ error: expect.any(String) });
  expect(await read(id(1))).toMatchObject({ content: raw });
  expect(JSON.stringify(turn.messageAttachments)).not.toContain(raw);
});

it('rejects mismatched owners, stale generations, unpublished and private messages and extra routing fields', async () => {
  const { h, id, read } = await sent();
  const valid = id(0);
  expect(await read({ ...valid, turnId: 'u-other' })).toMatchObject({ error: expect.any(String) });
  const ref = h.session.readRoomTurn(valid.turnId)!.messageAttachments!;
  const failed = h.session.beginPersonaMessage('retry', 'Retry', ref);
  expect(await read({ ...valid, turnId: failed.id })).toMatchObject({ error: 'No sent copy is available for this message.' });
  h.session.rollbackMessageRun('retry');
  const widget = h.session.beginPersonaMessage('widget', 'Commit', [], {
    widgetId: 'gesture-playground', widgetConfigId: 'cfg-1', rail: 'thread-artifact', artifactId: 'ta-99', selectionCount: 1
  });
  h.session.recordRoomThreadArtifacts(widget.id, [{ id: 'ta-99', kind: 'widget:gesture-playground', name: 'Widget', content: 'Hidden widget payload.' }]);
  expect(await read({ ...valid, turnId: widget.id, artifactId: 'ta-99' })).toMatchObject({ error: expect.any(String) });
  h.session.completeRun('widget', 'Done.');
  await h.runProse();
  const privateTurn = h.session.beginDirectToolMessage('prose', 'private', 'Read this.', ref);
  expect(await read({ ...valid, turnId: privateTurn.id })).toMatchObject({ error: expect.stringContaining('private instrument') });
  const count = h.posted(answer).length;
  await h.router.route(message(req, { ...valid, sourceUri: 'file:///elsewhere' }) as never);
  expect(h.posted(answer)).toHaveLength(count);
});

it('opens only the authorized current file and rejects removed or stale sources', async () => {
  const { h, id } = await sent();
  const command = (identity: WorkshopSentAttachmentRequest) => h.router.route(message(open, identity) as never);
  jest.spyOn(h.workspace, 'workspaceFolders').mockReturnValue([{ name: 'ws', path: '/ws' }]);
  const stat = jest.spyOn(h.fileSystem, 'stat').mockResolvedValue({ type: FileType.File, size: 8, mtime: 1, ctime: 1 });
  await command(id(0));
  expect(h.shell.openFileInEditor).toHaveBeenCalledWith('/ws/Characters/raven.md', { beside: true });
  await command(id(1));
  stat.mockResolvedValue({ type: FileType.SymbolicLink, size: 8, mtime: 1, ctime: 1 });
  await command(id(0));
  h.resourceFiles.length = 0;
  await command(id(0));
  await command({ ...id(0), roomRevision: -1 });
  expect(h.shell.openFileInEditor).toHaveBeenCalledTimes(1);
});

it('reconnects a picked workspace file from its relative path, refuses ambiguous roots, and cancels a pending open after replacement', async () => {
  const h = createWorkshopRouteTestHarness();
  await h.pin();
  const fsPath = '/ws/draft/one.md';
  jest.spyOn(h.workspace, 'asRelativePath').mockReturnValue('draft/one.md');
  const roots = jest.spyOn(h.workspace, 'workspaceFolders').mockReturnValue([{ name: 'ws', path: '/ws' }]);
  jest.spyOn(h.shell, 'pickFile').mockResolvedValue({ fsPath, uri: 'file://' + fsPath });
  const fileStat = { type: FileType.File, size: 30, mtime: 1, ctime: 1 };
  const stat = jest.spyOn(h.fileSystem, 'stat').mockResolvedValue(fileStat);
  jest.spyOn(h.fileSystem, 'readFile').mockResolvedValue(Buffer.from(raw));
  await h.router.route(message(MessageType.WORKSHOP_ATTACH_MESSAGE_FILE, {}) as never);
  await h.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read my draft.' }) as never);
  const turn = h.session.getSnapshot().turns.find(t => t.messageAttachments?.length)!;
  const id = { roomRevision: h.session.readRoomRevision(), requestId: 'read-file', turnId: turn.id, artifactId: turn.messageAttachments![0].id };
  await h.router.route(message(req, id) as never);
  expect(h.posted(answer).at(-1).payload).toEqual({ ...id, content: raw, canOpenInEditor: true });

  const openCurrent = () => h.router.route(message(open, id) as never);
  await openCurrent();
  expect(h.shell.openFileInEditor).toHaveBeenCalledWith(fsPath, { beside: true });
  roots.mockReturnValueOnce([{ name: 'first', path: '/ws' }, { name: 'other', path: '/other' }]);
  await openCurrent();
  stat.mockImplementationOnce(async () => {
    jest.spyOn(h.session, 'readRoomRevision').mockReturnValue(id.roomRevision + 1);
    return fileStat;
  });
  await openCurrent();
  expect(h.shell.openFileInEditor).toHaveBeenCalledTimes(1);
});

it.each(['External file: same.md', '../outside.md', '/arbitrary/file.md'])('serves the saved body without opening an unsafe or unidentifiable display path', async relativePath => {
  const h = createWorkshopRouteTestHarness();
  await h.pin();
  jest.spyOn(h.workspace, 'workspaceFolders').mockReturnValue([{ name: 'ws', path: '/ws' }]);
  const ref = { id: 'ta-50', label: 'same.md', relativePath, words: 2 };
  const turn = h.session.beginPersonaMessage('send', 'Read this', [ref]);
  h.session.recordRoomThreadArtifacts(turn.id, [{ id: ref.id, name: ref.label, sourcePath: relativePath, content: raw }]);
  const identity = { roomRevision: h.session.readRoomRevision(), requestId: 'private-file', turnId: turn.id, artifactId: ref.id };
  await h.router.route(message(req, identity) as never);
  expect(h.posted(answer).at(-1).payload).toMatchObject({ content: raw, canOpenInEditor: false });
  await h.router.route(message(open, identity) as never);
  expect(h.shell.openFileInEditor).not.toHaveBeenCalled();
});
