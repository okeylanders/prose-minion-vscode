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

  it('replaces superseded same-resource manifest rows and clears them on reset (Phase 7)', () => {
    const manager = new ConversationManager();
    const id = manager.startConversation('host', 'System');
    const entry = (sizeChars: number, deliveredAt: number) => ({
      kind: 'resource' as const,
      origin: 'host' as const,
      label: 'chapters/ch-04.md',
      configuredResource: { group: 'chapters' as const, path: 'chapters/ch-04.md' },
      sizeChars,
      isEstimate: true,
      deliveredAt
    });

    manager.appendContextSources(id, [entry(400, 1)]);
    // Re-reading the same canonical resource REPLACES its row.
    manager.appendContextSources(id, [entry(520, 2)]);
    manager.appendContextSources(id, [{
      kind: 'dictionary', origin: 'host', label: 'liminal', sizeChars: 90, isEstimate: true, deliveredAt: 3
    }]);

    const sources = manager.getContextSources(id);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ label: 'chapters/ch-04.md', sizeChars: 520, deliveredAt: 2 });

    // Returned rows are clones — external mutation cannot reach storage.
    sources[0].sizeChars = 9999;
    expect(manager.getContextSources(id)[0].sizeChars).toBe(520);

    manager.resetConversation(id);
    expect(manager.getContextSources(id)).toEqual([]);
    expect(manager.getContextSources('missing')).toEqual([]);
    expect(() => manager.appendContextSources('missing', [entry(1, 1)])).toThrow('not found');
  });

  describe('conversation archive V1', () => {
    const completeConversation = (
      target: ConversationManager,
      systemMessage = 'Current secret system prompt'
    ) => {
      const id = target.startConversation('workshop_persona_jill', systemMessage);
      target.pinConversation(id);
      target.addMessages(id, [
        { role: 'user', content: 'First writer turn' },
        { role: 'assistant', content: 'First persona reply' }
      ]);
      return id;
    };

    it('exports committed non-system history with defensive source copies', () => {
      const id = completeConversation(manager);
      manager.appendContextSources(id, [{
        kind: 'resource',
        origin: 'host',
        label: 'chapters/one.md',
        configuredResource: { group: 'chapters', path: 'chapters/one.md' },
        sizeChars: 120,
        isEstimate: true,
        artifactId: 'art-1',
        deliveredAt: 10
      }]);
      expect(manager.nextArtifactId(id)).toBe('art-1');

      const archive = manager.exportConversations([{ key: 'host' as const, conversationId: id }]);

      expect(archive[0]).toMatchObject({
        key: 'host',
        toolName: 'workshop_persona_jill',
        messages: [
          { role: 'user', content: 'First writer turn' },
          { role: 'assistant', content: 'First persona reply' }
        ],
        nextArtifactNumber: 1
      });
      expect(JSON.stringify(archive)).not.toContain('Current secret system prompt');

      archive[0].messages[0].content = 'mutated';
      archive[0].contextSources[0].configuredResource!.path = 'mutated.md';
      expect(manager.getMessages(id)[1].content).toBe('First writer turn');
      expect(manager.getContextSources(id)[0].configuredResource?.path).toBe('chapters/one.md');
    });

    it('imports with a fresh pinned id while restoring sources, activity, and skipped counters', () => {
      const id = completeConversation(manager);
      manager.setContextBudget(id, {
        modelId: 'old/model',
        contextTokens: 20,
        promptTokens: 15,
        completionTokens: 5,
        peakPromptTokensThisTurn: 15,
        requestedMaxOutputTokens: 100,
        callsThisTurn: 1,
        turnProcessedTokens: 20,
        contextCompression: 'unknown',
        measuredAt: 20
      });
      const entry = manager.exportConversations([{ key: 'host' as const, conversationId: id }])[0];
      entry.lastActivity = 1234;
      entry.nextArtifactNumber = 7;
      entry.contextSources = [{
        kind: 'dictionary',
        origin: 'host',
        label: 'liminal',
        sizeChars: 30,
        isEstimate: true,
        deliveredAt: 22
      }];

      const restored = new ConversationManager();
      const [outcome] = restored.importConversations([{
        entry,
        systemMessage: 'Rebuilt current system prompt'
      }]);

      expect(outcome.status).toBe('imported');
      if (outcome.status !== 'imported') {
        throw new Error(outcome.reason);
      }
      expect(outcome.conversationId).not.toBe(id);
      expect(restored.getMessages(outcome.conversationId)).toEqual([
        { role: 'system', content: 'Rebuilt current system prompt' },
        { role: 'user', content: 'First writer turn' },
        { role: 'assistant', content: 'First persona reply' }
      ]);
      expect(restored.getConversationInfo(outcome.conversationId)?.lastActivity).toBe(1234);
      expect(restored.getContextSources(outcome.conversationId)).toHaveLength(1);
      expect(restored.getContextBudget(outcome.conversationId)).toBeUndefined();
      expect(restored.nextArtifactId(outcome.conversationId)).toBe('art-8');
      expect(restored.clearOldConversations(-1)).toEqual([]);
    });

    it('degrades one malformed entry without blocking a valid sibling', () => {
      const id = completeConversation(manager);
      const valid = manager.exportConversations([{ key: 'host' as const, conversationId: id }])[0];
      const malformed = {
        ...valid,
        key: 'guest:margot' as const,
        messages: [{ role: 'system', content: 'smuggled prompt' }]
      } as unknown as typeof valid;

      const outcomes = new ConversationManager().importConversations([
        { entry: valid, systemMessage: 'New host prompt' },
        { entry: malformed, systemMessage: 'New guest prompt' }
      ]);

      expect(outcomes[0]).toMatchObject({ key: 'host', status: 'imported' });
      expect(outcomes[1]).toMatchObject({ key: 'guest:margot', status: 'degraded' });
    });

    it('rejects duplicate logical keys and artifact-counter regression', () => {
      const id = completeConversation(manager);
      const entry = manager.exportConversations([{ key: 'host', conversationId: id }])[0];
      const duplicated = new ConversationManager().importConversations([
        { entry, systemMessage: 'Host prompt' },
        { entry: { ...entry }, systemMessage: 'Other prompt' }
      ]);
      expect(duplicated).toEqual([
        expect.objectContaining({ key: 'host', status: 'degraded' }),
        expect.objectContaining({ key: 'host', status: 'degraded' })
      ]);

      const regressed = {
        ...entry,
        messages: [
          { role: 'user' as const, content: '<agent-artifact id="art-3">evidence</agent-artifact>' },
          { role: 'assistant' as const, content: 'reply' }
        ],
        nextArtifactNumber: 2
      };
      expect(new ConversationManager().importConversations([
        { entry: regressed, systemMessage: 'Prompt' }
      ])[0]).toMatchObject({
        status: 'degraded',
        reason: expect.stringContaining('below retained art-3')
      });
    });
  });
});
