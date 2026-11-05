/**
 * Pinned Context Slice 5, the live pass: Pin what's attached now with more
 * room attachments than the list's 20-file bound. The handler used that bound
 * as its message-shape check, so 22 attachments were refused as an unreadable
 * request ("That request couldn't be read"), before the list's own bound could
 * say why. The list's bound is the writes', with words that name it; the
 * message shape only caps a request at a size no room reaches. *Alice*, with
 * made-up paths and text.
 */
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { MessageType } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { harness } from './workshopPinnedContextHandlerHost';

const BOUND = PROMPT_BUDGETS.workshopPinnedContext.files;

function notes(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Notes/note-${index + 1}.md`);
}

describe('WorkshopPinnedContextHandler: more attachments than the list holds (Slice 5 live pass)', () => {
  it('refuses pinning 22 attachments by the list\'s bound, in words, not as an unreadable request', async () => {
    const h = harness();
    const ids = notes(BOUND + 2).map((note) => {
      h.write(note, 'Alice was beginning to get very tired.');
      return h.attachFile(note, false);
    });

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: ids });

    expect(answer).toMatchObject({
      ok: false,
      notice: { kind: 'refused', text: 'Pinned context holds at most 20 files, and this would make 22. Pin fewer, or unpin some first.' }
    });
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('pins exactly the bound by attachment id', async () => {
    const h = harness();
    const all = notes(BOUND);
    const ids = all.map((note) => {
      h.write(note, 'Alice was beginning to get very tired.');
      return h.attachFile(note, false);
    });

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: ids });

    expect(answer).toMatchObject({ ok: true });
    expect(h.listOnDisk()).toEqual(all);
  });

  it('refuses more catalog keys than the bound by the bound, in words', async () => {
    const all = notes(BOUND + 1);
    const h = harness({ catalog: all.map((note) => ({ group: 'characters' as const, path: note })) });
    all.forEach((note) => h.write(note, 'Alice.'));

    const answer = await h.send(MessageType.WORKSHOP_PIN_CONTEXT_RESOURCES, {
      revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
      items: all.map((note) => ({ group: 'characters', path: note }))
    });

    expect(answer.notice).toEqual({ kind: 'refused', text: 'Pinned context holds at most 20 files, and this would make 21. Pin fewer, or unpin some first.' });
    expect(h.listOnDisk()).toBeUndefined();
  });

  it('still refuses a request that is malformed, as one', async () => {
    const h = harness();
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: ['not-an-id'] }))
      .resolves.toMatchObject({ notice: { kind: 'refused', text: 'That request couldn’t be read. Nothing was changed.' } });
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [] }))
      .resolves.toMatchObject({ notice: { kind: 'refused', text: 'That request couldn’t be read. Nothing was changed.' } });
  });
});
