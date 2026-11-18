/**
 * A participant's context by part (ADR 2026-11-18 D1–D3, D7, D8): the host's
 * projection from the measured system prompt, each turn's tally and the
 * read-in rows. Pieces sum to their part; memory reads roll up into Project
 * memory; provider-measured rows keep their number; an untallied history is
 * "not measured", never zero; and no text but the host's names gets out.
 */

import { buildWorkshopContextBreakdown } from '@/application/services/workshop/WorkshopContextBreakdown';
import { projectWorkshopContextBudget } from '@/application/services/workshop/WorkshopContextBudgetView';
import { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import type { WorkshopConversationMeasure } from '@services/analysis/WorkshopSystemPromptMeasures';
import { WorkshopSystemPromptMeasures } from '@services/analysis/WorkshopSystemPromptMeasures';
import { ConversationManager } from '@orchestration/ConversationManager';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { decodeWorkshopPersistedSessionCheckpoint, parseWorkshopPersistedSession } from '@/application/services/workshop/WorkshopPersistedSession';
import { CONTEXT_BREAKDOWN_PARTS, ContextSourceEntry } from '@shared/types';

const row = (overrides: Partial<ContextSourceEntry>): ContextSourceEntry => ({
  kind: 'resource', origin: 'host', label: 'chapters/alice-01.md', sizeChars: 4_000, isEstimate: false, deliveredAt: 1, ...overrides
});

const measure = (overrides: Partial<WorkshopConversationMeasure> = {}): WorkshopConversationMeasure => ({
  systemTokens: 3_000,
  sections: [
    { part: 'persona', name: 'Persona: Jill', tokens: 1_200 },
    { part: 'persona', name: 'Interaction mode: Balanced', tokens: 900 },
    { part: 'tool-use', name: 'Analysis capability', tokens: 600 },
    { part: 'tool-use', name: 'Help capability', tokens: 300 }
  ],
  messageCount: 6,
  tally: [
    { messageIndex: 0, pieces: { 'tool-use.contract': 800, 'memory.start': 2_000, 'context.excerpt': 5_000, 'room.time': 20 } },
    { messageIndex: 2, pieces: { 'tool-use.reminder': 100, 'memory.update': 150, 'todos.snapshot': 70, 'room.catch-up': 400 } },
    { messageIndex: 4, pieces: { 'tool-use.reminder': 100, 'room.trailer-outcomes': 30, 'a.future-piece': 999 } }
  ],
  ...overrides
});

const part = (breakdown: ReturnType<typeof buildWorkshopContextBreakdown>, id: string) =>
  breakdown.parts.find((candidate) => candidate.part === id)!;

describe('buildWorkshopContextBreakdown (ADR 2026-11-18)', () => {
  it('builds one part per measured part, in order, each the sum of its pieces', () => {
    const breakdown = buildWorkshopContextBreakdown(measure(), [
      row({ promptTokensDelta: 1_500 }),
      row({ kind: 'transcript', label: 'Tea party', sizeChars: 8_000 }),
      row({ kind: 'memory', label: 'A note', promptTokensDelta: 90 })
    ]);
    expect(breakdown.parts.map((candidate) => candidate.part)).toEqual([...CONTEXT_BREAKDOWN_PARTS]);
    expect(breakdown.untalliedMessages).toBe(false);
    for (const candidate of breakdown.parts) {
      expect(candidate.tokens).toBe(candidate.pieces.reduce((sum, piece) => sum + (piece.tokens ?? 0), 0));
    }
    expect(part(breakdown, 'persona').tokens).toBe(2_100);
    // Sections, the frozen contract and the reminders (D1, D4).
    expect(part(breakdown, 'tool-use').tokens).toBe(600 + 300 + 800 + 200);
    expect(part(breakdown, 'tool-use').pieces).toContainEqual({ name: 'Turn reminders', tokens: 200, count: 2 });
    // The start block, an update note, and a note read: reads roll up here, by their row (D3).
    expect(part(breakdown, 'memory')).toMatchObject({ tokens: 2_000 + 150 + 90, measure: 'mixed' });
    expect(part(breakdown, 'todos')).toMatchObject({ tokens: 70, measure: 'estimate' });
    expect(part(breakdown, 'room-notes').tokens).toBe(20 + 400 + 30);
    expect(part(breakdown, 'excerpt-context').tokens).toBe(5_000);
    // A provider-measured row keeps its number; one without is its size estimated (D3).
    expect(part(breakdown, 'requested')).toMatchObject({ tokens: 1_500 + 2_000, measure: 'mixed' });
    expect(part(breakdown, 'requested').pieces.map((piece) => piece.name)).toEqual(['Files (1)', 'Past sessions (1)']);
    // An id this build does not know adds nothing.
    expect(JSON.stringify(breakdown)).not.toContain('999');
  });

  it('an apportioned delta keeps its number but is an estimate, alone or beside an exact row (PR #285 F-03)', () => {
    const apportioned = (kind: ContextSourceEntry['kind'], label: string) =>
      row({ kind, label, promptTokensDelta: 49, isEstimate: true });
    const only = buildWorkshopContextBreakdown(measure(), [apportioned('resource', 'a.md'), apportioned('resource', 'b.md')]);
    expect(part(only, 'requested')).toMatchObject({ tokens: 98, measure: 'estimate' });

    const beside = buildWorkshopContextBreakdown(measure(), [
      apportioned('resource', 'a.md'),
      row({ label: 'c.md', promptTokensDelta: 300, isEstimate: false })
    ]);
    expect(part(beside, 'requested')).toMatchObject({ tokens: 349, measure: 'mixed' });

    // One read's split can fall across two parts: a note read (memory) and a file (requested).
    const split = buildWorkshopContextBreakdown(measure(), [apportioned('memory', 'A note'), apportioned('resource', 'a.md')]);
    expect(part(split, 'memory').measure).toBe('estimate');
    expect(part(split, 'requested')).toMatchObject({ tokens: 49, measure: 'estimate' });
  });

  it('shows a held prompt it could not split as one persona piece', () => {
    const breakdown = buildWorkshopContextBreakdown(measure({ sections: undefined }), []);
    expect(part(breakdown, 'persona').pieces).toEqual([{ name: 'System prompt, not split by section', tokens: 3_000 }]);
    expect(part(breakdown, 'tool-use').tokens).toBe(800 + 200);
  });

  it('a history from before the tally: the tallied parts are not measured, never zero (D7)', () => {
    const breakdown = buildWorkshopContextBreakdown(measure({ tally: [{ messageIndex: 4, pieces: { 'memory.update': 40 } }] }), []);
    expect(breakdown.untalliedMessages).toBe(true);
    for (const id of ['memory', 'todos', 'room-notes', 'excerpt-context']) {
      expect(part(breakdown, id).tokens).toBeUndefined();
    }
    expect(part(breakdown, 'persona').tokens).toBe(2_100);
    expect(part(breakdown, 'tool-use').pieces).toContainEqual({ name: 'Contract in the first message' });
  });

  it('a fresh conversation with nothing committed is fully measured', () => {
    expect(buildWorkshopContextBreakdown(measure({ messageCount: 0, tally: [] }), []).untalliedMessages).toBe(false);
  });
});

describe('the recorder measures what it is given (D3, D6)', () => {
  it('estimates each text with the engine\'s estimator, and always has an entry', () => {
    const tally = new WorkshopContextTallyRecorder();
    expect(tally.snapshot()).toEqual({});
    tally.add('room.time', '<workshop-time>Alice</workshop-time>', undefined, '');
    tally.add('room.time', 'tea');
    expect(tally.snapshot()).toEqual({ 'room.time': estimateTextTokens('<workshop-time>Alice</workshop-time>') + estimateTextTokens('tea') });
  });
});

describe('an authentic session from before the tally (D7)', () => {
  const text = JSON.stringify(require('../../../fixtures/workshop-session-v2-before-context-tally.json'));

  it('reads and saves byte for byte, with nothing to normalize and no contextTally key', () => {
    expect(text).not.toContain('contextTally');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    expect(reopened.session.schemaVersion).toBe(2);
  });

  it('imports, and shows the parts it can with the rest not measured', () => {
    const session = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session;
    const manager = new ConversationManager();
    const host = session.conversations.find((entry) => entry.key === 'host')!;
    const [outcome] = manager.importConversations([{ entry: host, systemMessage: 'Rebuilt host prompt' }]);
    const id = (outcome as { conversationId: string }).conversationId;
    const held = new WorkshopSystemPromptMeasures().measure(manager.getContextAccount(id))!;
    expect(held.tally).toEqual([]);
    const breakdown = buildWorkshopContextBreakdown(held, manager.getContextSources(id));
    expect(breakdown.untalliedMessages).toBe(true);
    expect(part(breakdown, 'memory').tokens).toBeUndefined();
    expect(part(breakdown, 'persona').tokens).toBe(estimateTextTokens('Rebuilt host prompt'));
    // Its exported archive writes as it was: still no tally key.
    expect('contextTally' in manager.exportConversations([{ key: 'host', conversationId: id }])[0]).toBe(false);
  });
});

describe('the panel projection is display-safe (D8, D9)', () => {
  const SECRET = 'SYSTEM-PROMPT-TEXT-ALICE';
  const session = (kind: 'host' | 'tool') => ({
    getChatTarget: () => (kind === 'host' ? { kind: 'host' } : { kind: 'tool', toolId: 'prose' }),
    getToolSidecarConversationId: () => 'conversation-tool',
    getPersonaGuestConversationId: () => undefined,
    getSelectedPersonaId: () => 'jill',
    getHostConversationId: () => 'conversation-host-secret-id',
    collectWriterSources: () => []
  }) as never;
  // A real conversation whose held system prompt and messages carry the secret.
  const manager = new ConversationManager();
  const held = manager.startConversation('workshop_persona_jill', `${SECRET} system prompt`);
  manager.addMessages(held, [{ role: 'user', content: `${SECRET} message` }, { role: 'assistant', content: `${SECRET} reply` }]);
  manager.appendContextTally(held, { messageIndex: 0, pieces: { 'memory.start': 10 } });
  const assistant = {
    getConversationContextBudget: () => ({ contextTokens: 20_000 }) as never,
    getConversationContextSources: () => [row({ label: 'chapters/alice-01.md', sourceFingerprint: 'f'.repeat(64) } as never)],
    measureWorkshopConversation: jest.fn(() => new WorkshopSystemPromptMeasures().measure(manager.getContextAccount(held)))
  };

  it('carries part ids, host names and numbers, and never prompt text, a fingerprint or a conversation id', () => {
    const projected = projectWorkshopContextBudget(session('host'), assistant as never);
    expect(projected.breakdown?.parts).toHaveLength(CONTEXT_BREAKDOWN_PARTS.length);
    const json = JSON.stringify(projected);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain('conversation-host-secret-id');
    expect(json).not.toContain('sourceFingerprint');
    for (const breakdownPart of projected.breakdown!.parts) {
      expect(Object.keys(breakdownPart).sort()).toEqual(expect.arrayContaining(['measure', 'part', 'pieces']));
      for (const piece of breakdownPart.pieces) {
        expect(Object.keys(piece).every((key) => ['name', 'tokens', 'count'].includes(key))).toBe(true);
      }
    }
  });

  it('a reopened room shows its known parts before any reply: no total, but a breakdown (PR #285 F-01)', () => {
    const text = JSON.stringify(require('../../../fixtures/workshop-session-v2-before-context-tally.json'));
    const host = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session.conversations.find((entry) => entry.key === 'host')!;
    const reopened = new ConversationManager();
    const [outcome] = reopened.importConversations([{ entry: host, systemMessage: 'Rebuilt host prompt' }]);
    const id = (outcome as { conversationId: string }).conversationId;
    const facade = {
      getConversationContextBudget: (conversationId: string | undefined) => reopened.getContextBudget(conversationId),
      getConversationContextSources: (conversationId: string | undefined) => reopened.getContextSources(conversationId),
      measureWorkshopConversation: (conversationId: string | undefined) =>
        new WorkshopSystemPromptMeasures().measure(reopened.getContextAccount(conversationId))
    };
    const reopenedSession = { ...(session('host') as object), getHostConversationId: () => id } as never;
    const projected = projectWorkshopContextBudget(reopenedSession, facade as never);
    expect(projected.snapshot).toBeUndefined();
    expect(projected.breakdown?.untalliedMessages).toBe(true);
    expect(part(projected.breakdown!, 'persona').tokens).toBe(estimateTextTokens('Rebuilt host prompt'));
  });

  it('shows no breakdown for a tool sidecar', () => {
    assistant.measureWorkshopConversation.mockClear();
    expect(projectWorkshopContextBudget(session('tool'), assistant as never).breakdown).toBeUndefined();
    expect(assistant.measureWorkshopConversation).not.toHaveBeenCalled();
  });
});
