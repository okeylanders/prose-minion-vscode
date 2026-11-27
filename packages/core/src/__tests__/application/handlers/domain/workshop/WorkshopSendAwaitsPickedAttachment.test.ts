/**
 * A send that arrives while a file picked for it is still being read
 * (PR #271 F-01).
 *
 * Picking `@file` in the composer posts WORKSHOP_ATTACH_MESSAGE_RESOURCES and
 * Enter is a send key again at once, so the send can reach the host before
 * the catalog and the file have been read. Through the real composed routes,
 * with the catalog (or the file read) held behind a deferred promise: the
 * send waits for the pick, carries its file, and leaves nothing staged for
 * the next message. A pick that is refused, a read that outlasts the wait,
 * or a room replaced meanwhile refuses the whole send and gives the draft
 * back. The same holds for the project picker (the same route) and the
 * system picker.
 */

import { FileType } from '@/platform';
import { MessageType } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_MESSAGE_ATTACHMENT_READ_WAIT_MS,
  WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS
} from '@handlers/domain/workshop/WorkshopMessageAttachmentReads';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const DRAFT = 'compare with @raven.md';
const RAVEN = 'Raven is seventeen and keeps the marked token.';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Let every microtask queued so far run (the routes under test await nothing slower while the gate is held). */
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
  }
};

describe('a send that arrives while a picked file is still being read', () => {
  let routes: WorkshopRouteTestHarness;

  const route = (type: MessageType, payload: unknown) => routes.router.route(message(type, payload) as never);
  const pickRaven = () => route(MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES, {
    items: [{ group: 'characters', path: 'Characters/raven.md' }]
  });
  const send = (text = DRAFT) => route(MessageType.WORKSHOP_SEND_MESSAGE, { text });
  const modelCalls = () => [
    ...routes.service.startWorkshopPersonaConversation.mock.calls,
    ...routes.service.continueConversation.mock.calls
  ];
  const pending = () => routes.session.getSnapshot().pendingMessageAttachments.map(({ label }) => label);
  const errors = () => routes.posted(MessageType.ERROR).map((entry) => entry.payload.message as string);
  const restored = () => routes.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map((entry) => entry.payload.text as string);

  /** Hold the catalog the next pick opens; the returned function lets it through. */
  const holdCatalog = (): (() => void) => {
    const gate = deferred();
    const open = routes.resourceProviderFactory.createProvider.getMockImplementation()!;
    routes.resourceProviderFactory.createProvider.mockImplementationOnce(async (...args: unknown[]) => {
      await gate.promise;
      return open(...args);
    });
    return gate.resolve;
  };

  beforeEach(async () => {
    routes = createWorkshopRouteTestHarness();
    await route(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for the pick, sends the message with its file, and leaves nothing for the next message', async () => {
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();

    // The send is held, said so, and nothing has gone to a model.
    expect(modelCalls()).toHaveLength(0);
    expect(routes.posted(MessageType.STATUS).at(-1)?.payload.message).toMatch(/attaching/i);

    release();
    await Promise.all([picking, sending]);

    expect(routes.service.startWorkshopPersonaConversation).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(modelCalls()[0]);
    expect(sent).toContain('@raven.md');
    expect(sent).toContain(RAVEN);
    expect(pending()).toEqual([]);
    expect(errors()).toEqual([]);
    expect(restored()).toEqual([]);
    const writerTurn = routes.session.getSnapshot().turns.find((turn) => turn.content === DRAFT);
    expect(writerTurn?.messageAttachments?.map(({ label }) => label)).toEqual(['raven.md']);

    // No leak: the next message carries no file.
    await send('And the second beat?');
    expect(modelCalls()).toHaveLength(2);
    expect(JSON.stringify(modelCalls()[1])).not.toContain(RAVEN);
  });

  it('a refused pick refuses the whole send and restores the draft; the writer’s second send goes without it', async () => {
    routes.resourceFiles[0].sizeBytes = PROMPT_BUDGETS.contextAttachments.fileBytes + 1;
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();
    release();
    await Promise.all([picking, sending]);

    expect(modelCalls()).toHaveLength(0);
    expect(routes.session.getSnapshot().turns.some((turn) => turn.content === DRAFT)).toBe(false);
    expect(errors()[0]).toMatch(/too large to attach safely/i);
    expect(errors().at(-1)).toBe(WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS.refused);
    expect(routes.posted(MessageType.ERROR).at(-1)?.payload.details).toMatch(/too large to attach safely/i);
    expect(restored()).toEqual([DRAFT]);

    // The explicit second action: nothing is being read now, so it goes, without the file.
    await send();
    expect(modelCalls()).toHaveLength(1);
    expect(JSON.stringify(modelCalls()[0])).not.toContain(RAVEN);
  });

  it('a catalog that cannot be read refuses the send the same way', async () => {
    const gate = deferred();
    routes.resourceProviderFactory.createProvider.mockImplementationOnce(async () => {
      await gate.promise;
      throw new Error('workspace unavailable');
    });
    const picking = pickRaven();
    const sending = send();
    await flush();
    gate.resolve();
    await Promise.all([picking, sending]);

    expect(modelCalls()).toHaveLength(0);
    expect(errors().at(-1)).toBe(WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS.refused);
    expect(restored()).toEqual([DRAFT]);
  });

  it('a pick over the attachment limit refuses the send', async () => {
    for (let index = 0; index < PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage; index += 1) {
      routes.session.addMessageAttachment({ label: `note-${index}.md`, content: 'A note.', words: 2, relativePath: `Notes/note-${index}.md` });
    }
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();
    release();
    await Promise.all([picking, sending]);

    expect(modelCalls()).toHaveLength(0);
    expect(errors()[0]).toMatch(/at most 7/);
    expect(restored()).toEqual([DRAFT]);
  });

  it('a file already staged is no refusal: the send goes with it', async () => {
    await pickRaven();
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();
    release();
    await Promise.all([picking, sending]);

    expect(modelCalls()).toHaveLength(1);
    expect(JSON.stringify(modelCalls()[0])).toContain(RAVEN);
    expect(restored()).toEqual([]);
  });

  it('a room replaced during the read gets neither the file nor the message', async () => {
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();

    // New lands while the file is being read.
    routes.session.reset();
    await route(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' });
    release();
    await Promise.all([picking, sending]);

    expect(pending()).toEqual([]);
    expect(modelCalls()).toHaveLength(0);
    expect(routes.session.getSnapshot().turns.some((turn) => turn.content === DRAFT)).toBe(false);
    expect(errors()).toEqual([WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS['room-changed']]);
    expect(restored()).toEqual([DRAFT]);

    // The old read gates nothing in the new room.
    await send('A fresh start.');
    expect(modelCalls()).toHaveLength(1);
    expect(JSON.stringify(modelCalls()[0])).not.toContain(RAVEN);
  });

  it('a pick whose room was replaced stages nothing, with no send waiting', async () => {
    const release = holdCatalog();
    const picking = pickRaven();
    await flush();
    routes.session.reset();
    release();
    await picking;

    expect(pending()).toEqual([]);
    const lines = (routes.log.appendLine as jest.Mock).mock.calls.map(([line]) => line as string);
    const dropped = lines.find((line) => line.includes('Message attachment dropped'));
    expect(dropped).toBeDefined();
    expect(dropped).not.toMatch(/raven/i);
  });

  it('the replacement room can send while the prior room is still opening its file catalog', async () => {
    const release = holdCatalog();
    const picking = pickRaven();
    await flush();
    routes.session.reset();
    await route(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' });
    const sending = send('Read the new room.');
    try {
      await flush();
      expect(modelCalls()).toHaveLength(1);
      expect(JSON.stringify(modelCalls()[0])).not.toContain(RAVEN);
    } finally {
      release();
      await Promise.all([picking, sending]);
    }
    expect(pending()).toEqual([]);
    expect(errors()).toEqual([]);
    expect(restored()).toEqual([]);
  });

  it.each(['opened', 'failed'])('a stale catalog that %s cannot load a file or report its old error', async outcome => {
    const loading = deferred();
    const loadResources = jest.fn();
    routes.resourceProviderFactory.createProvider.mockImplementationOnce(async () => {
      await loading.promise;
      if (outcome === 'failed') {
        throw new Error('Catalog in the previous room failed');
      }
      return { listResources: () => routes.resourceFiles, loadResources };
    });
    const picking = pickRaven();
    routes.session.reset();
    loading.resolve();
    await picking;
    expect(loadResources).not.toHaveBeenCalled();
    expect(errors()).toEqual([]);
  });

  it.each([
    MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
    MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES
  ])('closing the handler withdraws %s while another handler resumes the same room', async type => {
    const release = holdCatalog();
    const picking = route(type, { items: [{ group: 'characters', path: 'Characters/raven.md' }] });
    const sending = type === MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES ? send() : undefined;
    await flush();
    routes.handler.dispose();
    const resumed = createWorkshopRouteTestHarness({ session: routes.session });
    const before = routes.postMessage.mock.calls.length;
    routes.persistence.markDirty.mockClear();
    release();
    await Promise.all([picking, sending]);
    expect(resumed.session.getContextAttachments()).toEqual([]);
    expect(pending()).toEqual([]);
    expect(modelCalls()).toEqual([]);
    expect(routes.postMessage).toHaveBeenCalledTimes(before);
    expect(routes.persistence.markDirty).not.toHaveBeenCalled();
    resumed.handler.dispose();
  });

  it.each([
    MessageType.WORKSHOP_ADD_CONTEXT_FILE,
    MessageType.WORKSHOP_ATTACH_MESSAGE_FILE
  ])('%s drops a completed disk read after disposal without marking the shared session dirty', async type => {
    const begun = deferred();
    const bytes = deferred<Uint8Array>();
    const file = { fsPath: '/ws/Characters/raven.md', uri: 'file:///ws/Characters/raven.md' };
    routes.shell.pickFile = jest.fn().mockResolvedValue(file);
    routes.fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: RAVEN.length });
    routes.fileSystem.readFile = jest.fn(() => {
      begun.resolve();
      return bytes.promise;
    });
    const picking = route(type, {});
    await begun.promise;
    routes.handler.dispose();
    const before = routes.postMessage.mock.calls.length;
    routes.persistence.markDirty.mockClear();
    bytes.resolve(new TextEncoder().encode(RAVEN));
    await picking;
    expect(routes.session.getContextAttachments()).toEqual([]);
    expect(pending()).toEqual([]);
    expect(routes.postMessage).toHaveBeenCalledTimes(before);
    expect(routes.persistence.markDirty).not.toHaveBeenCalled();
  });

  it('hiding a panel while its file is being read still stages the pending attachment', async () => {
    const release = holdCatalog();
    const picking = pickRaven();
    routes.handler.setSurfaceVisible(false);
    release();
    await picking;
    expect(pending()).toEqual(['raven.md']);
    expect(errors()).toEqual([]);
  });

  it('a read that outlasts the wait refuses the send; the pill still lands, and the next send carries it', async () => {
    jest.useFakeTimers();
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();

    jest.advanceTimersByTime(WORKSHOP_MESSAGE_ATTACHMENT_READ_WAIT_MS);
    await sending;

    expect(modelCalls()).toHaveLength(0);
    expect(errors()).toEqual([WORKSHOP_SEND_WITHOUT_ATTACHMENT_REFUSALS['still-reading']]);
    expect(restored()).toEqual([DRAFT]);

    release();
    await picking;
    expect(pending()).toEqual(['raven.md']);

    await send();
    expect(modelCalls()).toHaveLength(1);
    expect(JSON.stringify(modelCalls()[0])).toContain(RAVEN);
    expect(pending()).toEqual([]);
  });

  it('the system picker’s read is waited for too', async () => {
    const content = 'Ava keeps watch at the door.';
    const gate = deferred();
    routes.shell.pickFile = jest.fn().mockResolvedValue({ fsPath: '/ws/Characters/ava.md', uri: 'file:///ws/Characters/ava.md' });
    routes.fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: content.length });
    routes.fileSystem.readFile = jest.fn(async () => {
      await gate.promise;
      return new TextEncoder().encode(content);
    });
    const picking = route(MessageType.WORKSHOP_ATTACH_MESSAGE_FILE, {});
    await flush();
    const sending = send('compare with ava');
    await flush();
    expect(modelCalls()).toHaveLength(0);

    gate.resolve();
    await Promise.all([picking, sending]);

    expect(modelCalls()).toHaveLength(1);
    expect(JSON.stringify(modelCalls()[0])).toContain(content);
    expect(pending()).toEqual([]);
  });

  it('logs the refusal by kind, never the message or a file name', async () => {
    routes.resourceFiles[0].sizeBytes = PROMPT_BUDGETS.contextAttachments.fileBytes + 1;
    const release = holdCatalog();
    const picking = pickRaven();
    const sending = send();
    await flush();
    release();
    await Promise.all([picking, sending]);

    const refusal = (routes.log.appendLine as jest.Mock).mock.calls.map(([line]) => line as string)
      .find((line) => line.includes('Send refused whole'));
    expect(refusal).toContain('(refused)');
    expect(refusal).not.toMatch(/raven|compare/i);
  });
});
