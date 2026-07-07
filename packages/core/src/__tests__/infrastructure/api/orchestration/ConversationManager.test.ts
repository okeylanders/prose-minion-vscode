/**
 * ConversationManager tests — the multi-turn store under the Workshop's
 * continuation seam (ADR 2026-07-03, Sprint 3).
 *
 * Behavior under test: pinned conversations survive idle cleanup (a Workshop
 * session outlives the 5-minute reaper by design) while explicit deletion
 * always works; unknown ids fail loud with the typed ConversationNotFoundError
 * the handler branches on.
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
    manager.clearOldConversations(-1);

    expect(manager.hasConversation(reapable)).toBe(false);
    expect(manager.hasConversation(pinned)).toBe(true);
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
});
