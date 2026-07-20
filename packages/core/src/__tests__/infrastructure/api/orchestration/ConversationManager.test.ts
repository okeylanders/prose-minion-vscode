/**
 * ConversationManager tests — the multi-turn store under the Workshop's
 * continuation seam (ADR 2026-07-03, Sprint 3).
 *
 * Behavior under test: pinned conversations survive idle cleanup (a Workshop
 * session outlives the 5-minute reaper by design) while explicit deletion
 * always works; unknown ids fail loud with the typed ConversationNotFoundError
 * the handler branches on; and mode changes may atomically batch-replace
 * retained system messages between runs (ADR 2026-07-20) without disturbing
 * ids, committed history, pinning, or artifact numbering.
 */

import {
  ConversationManager,
  ConversationNotFoundError
} from '@orchestration/ConversationManager';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  const start = () => manager.startConversation('test-tool', 'You are a test assistant.');

  it('starts a conversation with the system message and reports it via hasConversation', () => {
    const id = start();

    expect(manager.hasConversation(id)).toBe(true);
    expect(manager.getMessages(id)).toEqual([
      { role: 'system', content: 'You are a test assistant.' }
    ]);
    expect(manager.hasConversation('nope')).toBe(false);
  });

  it('idle cleanup reaps unpinned conversations but spares pinned ones', () => {
    const reapable = start();
    const pinned = start();
    manager.pinConversation(pinned);

    // maxAgeMs of -1 makes every conversation "idle" — the pin is the only shield.
    const retired = manager.clearOldConversations(-1);

    expect(manager.hasConversation(reapable)).toBe(false);
    expect(manager.hasConversation(pinned)).toBe(true);
    expect(retired).toEqual([reapable]);
  });

  it('explicit deletion always works, pinned or not', () => {
    const pinned = start();
    manager.pinConversation(pinned);

    manager.deleteConversation(pinned);

    expect(manager.hasConversation(pinned)).toBe(false);
    // Idempotent on unknown ids.
    expect(() => manager.deleteConversation(pinned)).not.toThrow();
  });

  it('unknown ids fail loud with the typed error the handler branches on', () => {
    expect(() => manager.getMessages('ghost')).toThrow(ConversationNotFoundError);
    expect(() => manager.addMessage('ghost', { role: 'user', content: 'hi' })).toThrow(
      ConversationNotFoundError
    );
    expect(() => manager.pinConversation('ghost')).toThrow(ConversationNotFoundError);

    try {
      manager.getMessages('ghost');
    } catch (error) {
      // The handler matches on `name`, which must survive serialization seams.
      expect((error as Error).name).toBe('ConversationNotFoundError');
    }
  });

  it('addMessage grows the conversation and getMessages returns defensive copies', () => {
    const id = start();
    manager.addMessage(id, { role: 'user', content: 'first' });
    manager.addMessage(id, { role: 'assistant', content: 'reply' });

    const messages = manager.getMessages(id);
    expect(messages).toHaveLength(3);
    expect(manager.getConversationInfo(id)?.messageCount).toBe(3);

    messages.push({ role: 'user', content: 'smuggled' });
    expect(manager.getMessages(id)).toHaveLength(3);
  });

  it('owns committed context telemetry beside the retained thread', () => {
    const id = start();
    const snapshot = {
      modelId: 'model/a',
      contextTokens: 110,
      promptTokens: 100,
      completionTokens: 10,
      peakPromptTokensThisTurn: 100,
      requestedMaxOutputTokens: 10_000,
      callsThisTurn: 1,
      turnProcessedTokens: 110,
      contextCompression: 'unknown' as const,
      measuredAt: 1
    };

    manager.setContextBudget(id, snapshot);
    const returned = manager.getContextBudget(id)!;
    expect(returned).toEqual(snapshot);
    returned.contextTokens = 999;
    expect(manager.getContextBudget(id)?.contextTokens).toBe(110);

    manager.resetConversation(id);
    expect(manager.getContextBudget(id)).toBeUndefined();
  });

  it('mints monotonic per-conversation artifact ids and never reuses one (ADR 2026-07-18)', () => {
    const manager = new ConversationManager();
    const first = manager.startConversation('host', 'System');
    const second = manager.startConversation('tool', 'System');

    expect(manager.nextArtifactId(first)).toBe('art-1');
    expect(manager.nextArtifactId(first)).toBe('art-2');
    // Independent conversations mint independently.
    expect(manager.nextArtifactId(second)).toBe('art-1');
    expect(() => manager.nextArtifactId('missing')).toThrow('not found');
  });

  // The between-run mode-change primitive (ADR 2026-07-20): a retained system
  // message may be replaced atomically between runs; the complete batch is
  // validated before any conversation changes.
  describe('replaceSystemMessages', () => {
    const budget = () => ({
      modelId: 'model/a',
      contextTokens: 110,
      promptTokens: 100,
      completionTokens: 10,
      peakPromptTokensThisTurn: 100,
      requestedMaxOutputTokens: 10_000,
      callsThisTurn: 1,
      turnProcessedTokens: 110,
      contextCompression: 'unknown' as const,
      measuredAt: 1
    });

    it('batch-replaces system prompts while preserving ids, history identity, and artifact numbering', () => {
      const host = manager.startConversation('host', 'Old host prompt');
      const guest = manager.startConversation('guest', 'Old guest prompt');
      manager.addMessage(host, { role: 'user', content: 'Writer turn' });
      manager.addMessage(host, { role: 'assistant', content: 'Persona reply' });
      expect(manager.nextArtifactId(host)).toBe('art-1');
      manager.setContextBudget(host, budget());
      manager.setContextBudget(guest, budget());
      const historyBefore = manager.getMessages(host);
      const activityBefore = manager.getConversationInfo(host)!.lastActivity;

      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(activityBefore + 60_000);
      try {
        manager.replaceSystemMessages([
          { conversationId: host, systemMessage: 'New host prompt' },
          { conversationId: guest, systemMessage: 'New guest prompt' }
        ]);
      } finally {
        nowSpy.mockRestore();
      }

      // Same ids, new sole leading system entry, committed history intact.
      expect(manager.getMessages(host)).toEqual([
        { role: 'system', content: 'New host prompt' },
        { role: 'user', content: 'Writer turn' },
        { role: 'assistant', content: 'Persona reply' }
      ]);
      expect(manager.getMessages(guest)).toEqual([
        { role: 'system', content: 'New guest prompt' }
      ]);
      // Non-system history survives by identity, not as re-created copies.
      expect(manager.getMessages(host)[1]).toBe(historyBefore[1]);
      expect(manager.getMessages(host)[2]).toBe(historyBefore[2]);
      // The budget was measured against the previous prompt — cleared, not carried.
      expect(manager.getContextBudget(host)).toBeUndefined();
      expect(manager.getContextBudget(guest)).toBeUndefined();
      // Metadata survives: tool name unchanged, activity stamped, numbering continues.
      expect(manager.getConversationInfo(host)?.toolName).toBe('host');
      expect(manager.getConversationInfo(host)?.lastActivity).toBe(activityBefore + 60_000);
      expect(manager.nextArtifactId(host)).toBe('art-2');
    });

    it('keeps a replaced conversation pinned through idle cleanup', () => {
      const pinned = manager.startConversation('host', 'Old host prompt');
      const reapable = manager.startConversation('guest', 'Old guest prompt');
      manager.pinConversation(pinned);

      manager.replaceSystemMessages([
        { conversationId: pinned, systemMessage: 'New host prompt' },
        { conversationId: reapable, systemMessage: 'New guest prompt' }
      ]);

      // Replacement neither strips an existing pin nor grants one.
      expect(manager.clearOldConversations(-1)).toEqual([reapable]);
      expect(manager.hasConversation(pinned)).toBe(true);
    });

    it('treats an empty batch as a valid no-op', () => {
      const id = start();
      const before = manager.getMessages(id);

      expect(() => manager.replaceSystemMessages([])).not.toThrow();
      expect(manager.getMessages(id)).toEqual(before);
    });

    it('never mutates the system-message object earlier callers already hold', () => {
      const id = start();
      const copyBefore = manager.getMessages(id);

      manager.replaceSystemMessages([{ conversationId: id, systemMessage: 'Replaced prompt' }]);

      // The copy a caller took before the swap still shows the prompt its
      // turns actually ran against; only fresh reads see the new one.
      expect(copyBefore[0]).toEqual({ role: 'system', content: 'You are a test assistant.' });
      expect(manager.getMessages(id)[0]).toEqual({ role: 'system', content: 'Replaced prompt' });
      expect(manager.getMessages(id)[0]).not.toBe(copyBefore[0]);
    });

    it('validates the whole batch first: a missing final entry leaves earlier entries untouched', () => {
      const first = manager.startConversation('host', 'First prompt');
      const second = manager.startConversation('guest', 'Second prompt');
      manager.setContextBudget(first, budget());
      const batch = [
        { conversationId: first, systemMessage: 'New first prompt' },
        { conversationId: second, systemMessage: 'New second prompt' },
        { conversationId: 'ghost', systemMessage: 'New ghost prompt' }
      ];

      expect(() => manager.replaceSystemMessages(batch)).toThrow(ConversationNotFoundError);
      try {
        manager.replaceSystemMessages(batch);
      } catch (error) {
        // The handler matches on `name`, which must survive serialization seams.
        expect((error as Error).name).toBe('ConversationNotFoundError');
      }

      // Entries 1-2 were valid, but entry 3 poisoned the whole batch.
      expect(manager.getMessages(first)[0]).toEqual({ role: 'system', content: 'First prompt' });
      expect(manager.getMessages(second)[0]).toEqual({ role: 'system', content: 'Second prompt' });
      expect(manager.getContextBudget(first)).toBeDefined();
    });

    it('rejects duplicate conversation ids without applying the first occurrence', () => {
      const id = start();

      expect(() => manager.replaceSystemMessages([
        { conversationId: id, systemMessage: 'First replacement' },
        { conversationId: id, systemMessage: 'Second replacement' }
      ])).toThrow(`Duplicate conversation ${id}`);
      expect(manager.getMessages(id)[0]).toEqual({ role: 'system', content: 'You are a test assistant.' });
    });

    it('rejects a blank replacement prompt and names the conversation', () => {
      const kept = manager.startConversation('host', 'Kept prompt');
      const blank = manager.startConversation('guest', 'Guest prompt');

      expect(() => manager.replaceSystemMessages([
        { conversationId: kept, systemMessage: 'New kept prompt' },
        { conversationId: blank, systemMessage: '  \n\t ' }
      ])).toThrow(`Blank replacement system message for conversation ${blank}`);
      expect(manager.getMessages(kept)[0]).toEqual({ role: 'system', content: 'Kept prompt' });
      expect(manager.getMessages(blank)[0]).toEqual({ role: 'system', content: 'Guest prompt' });
    });

    it('rejects a conversation carrying a second system entry instead of guessing which one to swap', () => {
      const kept = manager.startConversation('host', 'Kept prompt');
      manager.setContextBudget(kept, budget());
      const doubled = manager.startConversation('guest', 'Guest prompt');
      manager.addMessage(doubled, { role: 'user', content: 'Writer turn' });
      manager.addMessage(doubled, { role: 'system', content: 'Smuggled second system entry' });

      expect(() => manager.replaceSystemMessages([
        { conversationId: kept, systemMessage: 'New kept prompt' },
        { conversationId: doubled, systemMessage: 'New guest prompt' }
      ])).toThrow(`Conversation ${doubled} does not hold a sole leading system message`);
      expect(manager.getMessages(kept)[0]).toEqual({ role: 'system', content: 'Kept prompt' });
      expect(manager.getContextBudget(kept)).toBeDefined();
      expect(manager.getMessages(doubled)).toHaveLength(3);
    });

    it('rejects a conversation whose first message is not the system entry', () => {
      const id = start();
      manager.addMessage(id, { role: 'user', content: 'Writer turn' });
      // No public path produces this shape — startConversation always seeds
      // the system entry — so reach into the store to model corrupted state
      // and prove the guard fails closed instead of silently repairing it.
      const store = (manager as unknown as {
        conversations: Map<string, { messages: unknown[] }>;
      }).conversations;
      store.get(id)!.messages = store.get(id)!.messages.slice(1);

      expect(() => manager.replaceSystemMessages([
        { conversationId: id, systemMessage: 'New prompt' }
      ])).toThrow(`Conversation ${id} does not hold a sole leading system message`);
    });
  });
});
