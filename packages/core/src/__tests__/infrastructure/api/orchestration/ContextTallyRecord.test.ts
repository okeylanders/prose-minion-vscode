/**
 * The context tally beside the manifest (ADR 2026-11-18 D6, D7): one entry
 * per committed message, kept through export and import, cut by a mark's
 * message count, cleared on reset, and dropped (never degrading the
 * conversation) when an archive's tally is malformed.
 */

import { ConversationManager } from '@orchestration/ConversationManager';
import {
  archivedContextTallyWithin,
  CONTEXT_TALLY_LIMITS,
  contextTallyFault,
  contextTallyWithin,
  isContextTallyPieces,
  StoredContextTallyEntry
} from '@orchestration/ContextTallyRecord';

const commitTurn = (manager: ConversationManager, id: string, text: string): void =>
  manager.addMessages(id, [
    { role: 'user', content: text },
    { role: 'assistant', content: `Reply to ${text}` }
  ]);

describe('context tally record (ADR 2026-11-18 D6)', () => {
  it('accepts bounded piece ids and token counts, and nothing else', () => {
    expect(isContextTallyPieces({ 'memory.start': 120, 'room.time': 0 })).toBe(true);
    expect(isContextTallyPieces({ 'Memory start': 1 })).toBe(false);
    expect(isContextTallyPieces({ 'memory.start': -1 })).toBe(false);
    expect(isContextTallyPieces({ 'memory.start': 1.5 })).toBe(false);
    expect(isContextTallyPieces([])).toBe(false);
    const many = Object.fromEntries(
      Array.from({ length: CONTEXT_TALLY_LIMITS.piecesPerEntry + 1 }, (_, index) => [`p${index}`, 1])
    );
    expect(isContextTallyPieces(many)).toBe(false);
    expect(isContextTallyPieces({ [`a${'b'.repeat(CONTEXT_TALLY_LIMITS.pieceIdCharacters)}`]: 1 })).toBe(false);
  });

  it('names faults: order, range, shape', () => {
    expect(contextTallyFault([{ messageIndex: 0, pieces: {} }, { messageIndex: 2, pieces: {} }], 4)).toBeUndefined();
    expect(contextTallyFault([{ messageIndex: 2, pieces: {} }, { messageIndex: 2, pieces: {} }], 4)).toMatch(/entry 1/);
    expect(contextTallyFault([{ messageIndex: 4, pieces: {} }], 4)).toMatch(/names message 4/);
    expect(contextTallyFault([{ messageIndex: 0, pieces: {}, text: 'Alice' }], 4)).toMatch(/malformed/);
    expect(contextTallyFault('not a list', 4)).toBe('not a list');
  });

  it('a cut keeps exactly the entries of the messages it keeps', () => {
    const tally: StoredContextTallyEntry[] = [
      { messageIndex: 0, pieces: { 'memory.start': 300 } },
      { messageIndex: 2, pieces: { 'todos.snapshot': 40 } },
      { messageIndex: 6, pieces: { 'room.catch-up': 90 } }
    ];
    expect(contextTallyWithin(tally, 6).map((entry) => entry.messageIndex)).toEqual([0, 2]);
    expect(contextTallyWithin(tally, 2).map((entry) => entry.messageIndex)).toEqual([0]);
    expect(archivedContextTallyWithin({}, 6)).toEqual({});
    expect(archivedContextTallyWithin({ contextTally: tally }, 3)).toEqual({ contextTally: tally.slice(0, 2) });
  });
});

describe('ConversationManager and the tally (ADR 2026-11-18 D6, D7)', () => {
  it('stores one entry per committed message, and reads it back with the held system message', () => {
    const manager = new ConversationManager();
    const id = manager.startConversation('workshop_persona_jill', 'System for Alice');
    commitTurn(manager, id, 'First');
    expect(manager.appendContextTally(id, { messageIndex: 0, pieces: { 'memory.start': 120 } })).toBe(true);
    commitTurn(manager, id, 'Second');
    expect(manager.appendContextTally(id, { messageIndex: 2, pieces: {} })).toBe(true);

    expect(manager.getContextAccount(id)).toEqual({
      systemMessage: 'System for Alice',
      messageCount: 4,
      tally: [
        { messageIndex: 0, pieces: { 'memory.start': 120 } },
        { messageIndex: 2, pieces: {} }
      ]
    });
  });

  it('leaves out, and logs, a tally that does not fit the history; never throws past a commit', () => {
    const lines: string[] = [];
    const manager = new ConversationManager({ appendLine: (line: string) => lines.push(line) } as never);
    const id = manager.startConversation('workshop_persona_jill', 'System');
    commitTurn(manager, id, 'First');
    expect(manager.appendContextTally(id, { messageIndex: 5, pieces: { 'memory.start': 1 } })).toBe(false);
    expect(manager.appendContextTally('gone', { messageIndex: 0, pieces: {} })).toBe(false);
    expect(manager.getContextAccount(id)?.tally).toEqual([]);
    expect(lines.join('\n')).toMatch(/left out/);
  });

  it('exports the tally only when it holds entries, and imports it back', () => {
    const manager = new ConversationManager();
    const id = manager.startConversation('workshop_persona_jill', 'System');
    commitTurn(manager, id, 'First');
    const [before] = manager.exportConversations([{ key: 'host', conversationId: id }]);
    expect('contextTally' in before).toBe(false);

    manager.appendContextTally(id, { messageIndex: 0, pieces: { 'room.time': 12 } });
    const [entry] = manager.exportConversations([{ key: 'host', conversationId: id }]);
    expect(entry.contextTally).toEqual([{ messageIndex: 0, pieces: { 'room.time': 12 } }]);

    const restored = new ConversationManager();
    const [outcome] = restored.importConversations([{ entry, systemMessage: 'Rebuilt system' }]);
    expect(outcome.status).toBe('imported');
    const restoredId = (outcome as { conversationId: string }).conversationId;
    expect(restored.getContextAccount(restoredId)).toEqual({
      systemMessage: 'Rebuilt system',
      messageCount: 2,
      tally: [{ messageIndex: 0, pieces: { 'room.time': 12 } }]
    });
  });

  it('drops a malformed archived tally and keeps the conversation (D7)', () => {
    const lines: string[] = [];
    const manager = new ConversationManager({ appendLine: (line: string) => lines.push(line) } as never);
    const [outcome] = manager.importConversations([{
      entry: {
        key: 'host',
        toolName: 'workshop_persona_jill',
        messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }],
        lastActivity: 1,
        contextSources: [],
        nextArtifactNumber: 0,
        contextTally: [{ messageIndex: 9, pieces: {} }]
      },
      systemMessage: 'System'
    }]);
    expect(outcome.status).toBe('imported');
    expect(manager.getContextAccount((outcome as { conversationId: string }).conversationId)?.tally).toEqual([]);
    expect(lines.join('\n')).toMatch(/Context tally of host dropped on import/);
  });

  it('clears on reset, and keeps the tally through a system-message replacement', () => {
    const manager = new ConversationManager();
    const id = manager.startConversation('workshop_persona_jill', 'System');
    commitTurn(manager, id, 'First');
    manager.appendContextTally(id, { messageIndex: 0, pieces: { 'memory.start': 5 } });
    manager.replaceSystemMessages([{ conversationId: id, systemMessage: 'New system' }]);
    expect(manager.getContextAccount(id)?.tally).toHaveLength(1);
    expect(manager.getContextAccount(id)?.systemMessage).toBe('New system');
    manager.resetConversation(id);
    expect(manager.getContextAccount(id)?.tally).toEqual([]);
  });
});
