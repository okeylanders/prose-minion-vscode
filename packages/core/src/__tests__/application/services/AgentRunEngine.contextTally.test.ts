/**
 * The engine's tally seam (ADR 2026-11-18 D6): the owner's measure of a
 * turn's opening message is committed beside the turn, at that message's
 * index, and only when the turn commits: held retention commits it with the
 * exchange, and a cancelled turn commits nothing.
 */

import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';

describe('AgentRunEngine context tally (ADR 2026-11-18 D6)', () => {
  let client: { createChatCompletion: jest.Mock; createStreamingChatCompletion: jest.Mock };
  let conversations: ConversationManager;
  let engine: AgentRunEngine;

  beforeEach(() => {
    client = { createChatCompletion: jest.fn().mockResolvedValue({ content: 'Reply' }), createStreamingChatCompletion: jest.fn() };
    conversations = new ConversationManager();
    engine = new AgentRunEngine(client as never, conversations);
  });

  afterEach(() => engine.dispose());

  const policy = AGENT_RUN_POLICIES.workshopToolWithoutResources;

  it('commits each turn\'s pieces at its opening message, asking once per commit', async () => {
    const first = jest.fn(() => ({ 'memory.start': 120, 'tool-use.contract': 80 }));
    const started = await engine.runInitial({
      toolName: 'workshop_persona_jill', systemMessage: 'System', userMessage: 'Alice asks',
      policy, options: { contextTally: first }
    });
    const id = started.conversationId!;
    const second = jest.fn(() => ({}));
    await engine.continueConversation({ conversationId: id, userMessage: 'Alice again', policy, options: { contextTally: second } });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(engine.getConversationContextAccount(id)).toEqual({
      systemMessage: 'System',
      messageCount: 4,
      tally: [
        { messageIndex: 0, pieces: { 'memory.start': 120, 'tool-use.contract': 80 } },
        { messageIndex: 2, pieces: {} }
      ]
    });
  });

  it('commits nothing for a cancelled turn', async () => {
    const started = await engine.runInitial({
      toolName: 'workshop_persona_jill', systemMessage: 'System', userMessage: 'Alice asks', policy,
      options: { contextTally: () => ({ 'room.time': 5 }) }
    });
    const id = started.conversationId!;
    const controller = new AbortController();
    controller.abort();
    const tally = jest.fn(() => ({ 'room.time': 9 }));
    await engine.continueConversation({ conversationId: id, userMessage: 'Stopped', policy, options: { signal: controller.signal, contextTally: tally } })
      .catch(() => undefined);

    expect(tally).not.toHaveBeenCalled();
    expect(engine.getConversationContextAccount(id)?.tally).toEqual([{ messageIndex: 0, pieces: { 'room.time': 5 } }]);
  });

  it('commits the tally with held retention, and only when the owner commits', async () => {
    const started = await engine.runInitial({
      toolName: 'workshop_persona_jill', systemMessage: 'System', userMessage: 'Alice asks', policy
    });
    const id = started.conversationId!;
    expect(engine.getConversationContextAccount(id)?.tally).toEqual([]);
    const commits: Array<() => boolean> = [];
    await engine.continueConversation({
      conversationId: id, userMessage: 'Press', policy,
      options: { contextTally: () => ({ 'room.directive': 30 }), deferRetention: (commit) => commits.push(commit) }
    });
    expect(engine.getConversationContextAccount(id)?.tally).toEqual([]);
    expect(commits[0]()).toBe(true);
    expect(engine.getConversationContextAccount(id)?.tally).toEqual([{ messageIndex: 2, pieces: { 'room.directive': 30 } }]);
  });
});
