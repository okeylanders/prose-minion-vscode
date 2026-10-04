import { WorkshopContextDelivery } from '@/application/services/workshop/WorkshopContextDelivery';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { buildWorkshopHostUpdateFrame } from '@/application/services/workshop/WorkshopPromptBuilder';
import type { WorkshopContextAttachment } from '@/application/services/workshop/WorkshopSessionRecords';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { assertCurrentWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { validateWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1Integrity';

const attachment = (id: string, content: string): WorkshopContextAttachment => ({
  id, kind: 'text', origin: 'writer', label: id, content, words: 1, addedAt: 0
});

describe('acknowledged standing-context delivery', () => {
  it('ships only changed/new bodies and explicitly removes delivered ids', () => {
    const delivery = new WorkshopContextDelivery();
    const unchanged = attachment('ctx-1', 'large unchanged manuscript '.repeat(20_000));
    delivery.acknowledge(delivery.prepare(1, [unchanged, attachment('ctx-2', 'old'), attachment('ctx-3', 'removed')]).baseline);
    const delta = delivery.prepare(2, [unchanged, attachment('ctx-2', 'new'), attachment('ctx-4', 'added')]);
    expect(delta).toMatchObject({ mode: 'delta', attachments: [
      expect.objectContaining({ id: 'ctx-2', content: 'new' }),
      expect.objectContaining({ id: 'ctx-4', content: 'added' })
    ], removedAttachmentIds: ['ctx-3'] });
    const frame = buildWorkshopHostUpdateFrame({ contextAttachments: delta })!;
    expect(frame).not.toContain(unchanged.content);
    expect(frame).not.toContain('context-attachment:ctx-1');
    expect(frame).toContain('keep all other attachments unchanged');
    expect(frame).toContain('Removed context attachment: context-attachment:ctx-3');
    expect(frame).not.toContain('This list supersedes');
  });

  it('coalesces changes back to the acknowledged state and retries unchanged until acknowledgement', () => {
    const delivery = new WorkshopContextDelivery();
    const original = attachment('ctx-1', 'old');
    delivery.acknowledge(delivery.prepare(1, [original]).baseline);
    const next = attachment('ctx-1', 'new');
    expect(delivery.prepare(2, [next])).toEqual(delivery.prepare(2, [next]));
    expect(buildWorkshopHostUpdateFrame({ contextAttachments: delivery.prepare(3, [original]) })).toBeUndefined();
    const removed = delivery.prepare(4, []);
    expect(removed.removedAttachmentIds).toEqual(['ctx-1']);
    delivery.acknowledge(removed.baseline);
    expect(delivery.prepare(5, []).removedAttachmentIds).toEqual([]);
  });

  it('acknowledges the dispatched generation while a newer edit stays pending', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Excerpt.', source: { kind: 'manual' } });
    session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'a', content: 'original', words: 1 });
    const initial = session.prepareInitialHostContextDelivery();
    session.beginPersonaMessage('first', 'Hello');
    session.updateContextAttachmentText('ctx-1', 'during initial response', 3);
    session.completeRun('first', 'Reply', undefined, false, 'host-runtime');
    session.commitPendingHostUpdates({ contextAttachments: initial });
    expect(session.collectPendingHostUpdates()?.contextAttachments).toMatchObject({
      mode: 'delta', attachments: [expect.objectContaining({ content: 'during initial response' })]
    });
    const dispatched = session.collectPendingHostUpdates()!;
    session.updateContextAttachmentText('ctx-1', 'during next response', 3);
    session.commitPendingHostUpdates(dispatched);
    const pending = session.collectPendingHostUpdates()!;
    expect(pending.contextAttachments?.attachments[0].content).toBe('during next response');
    // A failed attempt does not acknowledge; retry keeps the same pending delta.
    expect(session.collectPendingHostUpdates()).toEqual(pending);
    session.commitPendingHostUpdates(pending);
    expect(session.collectPendingHostUpdates()).toBeUndefined();
  });

  it('preserves the acknowledged baseline across checkpoint restore and clears it with host loss', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Excerpt.', source: { kind: 'manual' } });
    session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'a', content: 'original', words: 1 });
    const initial = session.prepareInitialHostContextDelivery();
    session.beginPersonaMessage('first', 'Hello');
    session.completeRun('first', 'Reply', undefined, false, 'host-runtime');
    session.commitPendingHostUpdates({ contextAttachments: initial });
    session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'b', content: 'new', words: 1 });
    const checkpoint = session.exportCommittedState();
    expect(JSON.stringify(checkpoint.hostContextDelivery)).not.toContain('original');
    const restored = new WorkshopSessionService(() => 2);
    restored.hydrateCommittedState(checkpoint, { host: 'restored-host' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(restored.collectPendingHostUpdates()?.contextAttachments).toMatchObject({
      mode: 'delta', attachments: [expect.objectContaining({ id: 'ctx-2' })]
    });
    restored.clearAllConversations();
    expect(restored.exportCommittedState().hostContextDelivery).toBeUndefined();
    expect(restored.prepareInitialHostContextDelivery()).toMatchObject({ mode: 'replace', attachments: [
      expect.objectContaining({ id: 'ctx-1' }), expect.objectContaining({ id: 'ctx-2' })
    ] });
  });

  it('rejects malformed or impossible persisted acknowledgement metadata', () => {
    const session = new WorkshopSessionService(() => 1);
    session.addContextAttachment({ kind: 'text', origin: 'writer', label: 'a', content: 'original', words: 1 });
    session.commitPendingHostUpdates({ contextAttachments: session.prepareInitialHostContextDelivery() });
    const state = session.exportCommittedState();
    state.hostContextDelivery!.attachments[0].fingerprint = 'invalid';
    expect(() => assertCurrentWorkshopSessionStateV1(state)).toThrow(/fingerprint/);
    state.hostContextDelivery!.attachments[0].fingerprint = 'a'.repeat(64);
    state.hostContextDelivery!.revision = state.revisions.context + 1;
    expect(() => validateWorkshopSessionStateV1(state)).toThrow(/ahead of the working set/);
    state.hostContextDelivery!.revision = state.revisions.context;
    state.hostContextDelivery!.attachments.push({ ...state.hostContextDelivery!.attachments[0] });
    expect(() => validateWorkshopSessionStateV1(state)).toThrow(/duplicate or unissued/);
  });
});
