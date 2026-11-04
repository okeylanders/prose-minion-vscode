/**
 * The frame is session-stable by placement (ADR 2026-11-04 D5): it rides
 * the first user message, which a second turn, a Conversation settings
 * change (the system prompt replaced) and an archive import (a reopen) all
 * leave byte-identical. Through the real capability and conversation
 * manager. *Alice*, with made-up ids.
 */
import { ConversationManager } from '@orchestration/ConversationManager';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { libraryHost, memory, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

function capabilityOver(host: ReturnType<typeof libraryHost>) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  session.beginPersonaMessage('host-request', 'What did we settle?');
  return new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService,
    {} as WorkshopAnalysisSidePass,
    { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
    session,
    { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
    {} as WorkshopTranscriptRecallPort,
    host.library
  ).create({
    requestId: 'host-request',
    excerptVersion: 0,
    personaId: 'jill',
    owner: { kind: 'host' },
    signal: new AbortController().signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
}

describe('the frame stays as it was delivered', () => {
  it('is byte-identical after a second turn, a system-prompt replacement and a reopen, even as the folder changes', async () => {
    const host = libraryHost();
    host.put(memory());
    host.put(writerMemory({ id: 'mem-1a9e04', pinned: true, title: 'Structure first' }));
    const capability = capabilityOver(host);
    const first = await capability.appendContract('<writer-message>What did we settle?</writer-message>');
    expect(first).toContain('<project-memory ');

    const manager = new ConversationManager();
    const id = manager.startConversation('workshop_persona_jill', 'System prompt, memory off');
    manager.pinConversation(id);
    manager.addMessages(id, [{ role: 'user', content: first }, { role: 'assistant', content: 'The watch runs backward.' }]);

    // The folder changes; nothing rebuilds the frame.
    host.put(writerMemory({ id: 'mem-0d0d0d', title: 'Alice grows twice', updated: '2026-11-04T08:00:00Z' }));
    const second = await capability.appendTurnContract('<writer-message>And the Hatter?</writer-message>');
    manager.addMessages(id, [{ role: 'user', content: second }, { role: 'assistant', content: 'Always six.' }]);
    expect(second).not.toContain('<project-memory');

    manager.replaceSystemMessages([{ conversationId: id, systemMessage: 'System prompt, memory on, grammar taught' }]);
    expect(manager.getMessages(id)[1].content).toBe(first);

    const [archive] = manager.exportConversations([{ key: 'host' as const, conversationId: id }]);
    const reopened = new ConversationManager();
    const [outcome] = reopened.importConversations([{ entry: archive, systemMessage: 'Rebuilt current system prompt' }]);
    expect(outcome.status).toBe('imported');
    const messages = reopened.getMessages((outcome as { conversationId: string }).conversationId);
    expect(messages[0]).toEqual({ role: 'system', content: 'Rebuilt current system prompt' });
    expect(messages[1].content).toBe(first);
    expect(messages[1].content).not.toContain('mem-0d0d0d');
  });
});
