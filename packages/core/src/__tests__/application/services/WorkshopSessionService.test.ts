/**
 * WorkshopSessionService tests — the Sprint 2 session aggregate + the
 * Sprint 3 conversation lifecycle.
 *
 * Behavior under test (sprint acceptance criteria):
 * - set-excerpt pins host-stamped excerpt state,
 * - a tool run appends a user+assistant turn pair and tracks the active tool,
 * - a successful completion ADOPTS its retained conversation id; follow-up
 *   message runs require it; reset returns-and-clears it (Sprint 3),
 * - reset clears the thread and active run (excerpt survives),
 * - stale completions (reset/preempt mid-stream) never corrupt the thread
 *   and never adopt a conversation,
 * - snapshots are copies, and are BOUNDED to the turn window (PR #67 #12).
 */

import {
  WorkshopSessionService,
  WORKSHOP_SNAPSHOT_TURN_WINDOW
} from '@/application/services/WorkshopSessionService';

describe('WorkshopSessionService', () => {
  let clock: number;
  let service: WorkshopSessionService;

  beforeEach(() => {
    clock = 1_000;
    service = new WorkshopSessionService(() => ++clock);
  });

  const pin = (text = 'She left the letter on the table.') =>
    service.setExcerpt({ text, sourceUri: 'file:///ch1.md', relativePath: 'chapters/ch1.md' });

  it('pins an excerpt with source metadata and a host-stamped pin time', () => {
    const excerpt = pin();

    expect(excerpt.text).toBe('She left the letter on the table.');
    expect(excerpt.relativePath).toBe('chapters/ch1.md');
    expect(excerpt.pinnedAt).toBeGreaterThan(1_000);
    expect(service.getSnapshot().excerpt).toEqual(excerpt);
  });

  it('refuses to begin a tool run without a usable excerpt', () => {
    expect(() => service.beginToolRun('prose', 'req-1')).toThrow(/pinned excerpt/);

    service.setExcerpt({ text: '   \n  ' });
    expect(() => service.beginToolRun('prose', 'req-1')).toThrow(/pinned excerpt/);
  });

  it('appends a user+assistant turn pair across a begin/complete run', () => {
    pin();
    const userTurn = service.beginToolRun('dialogue', 'req-1');
    const assistantTurn = service.completeRun(
      'req-1',
      'Beat analysis…',
      { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      true
    );

    const { turns } = service.getSnapshot();
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      role: 'user',
      kind: 'tool_run',
      toolId: 'dialogue',
      toolLabel: 'Dialogue & Beats'
    });
    expect(turns[0].content).toContain('Dialogue & Beats');
    expect(turns[1]).toMatchObject({
      role: 'assistant',
      toolId: 'dialogue',
      content: 'Beat analysis…',
      truncated: true
    });
    expect(turns[1].usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(turns[0].id).not.toBe(turns[1].id);
    expect(userTurn.id).toBe(turns[0].id);
    expect(assistantTurn?.id).toBe(turns[1].id);
  });

  it('tracks the active tool between begin and complete', () => {
    pin();
    service.beginToolRun('cliche', 'req-1');

    let snapshot = service.getSnapshot();
    expect(snapshot.selectedToolId).toBe('cliche');
    expect(snapshot.activeToolId).toBe('cliche');
    expect(snapshot.activeRequestId).toBe('req-1');

    service.completeRun('req-1', 'done');
    snapshot = service.getSnapshot();
    expect(snapshot.selectedToolId).toBe('cliche');
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.activeRequestId).toBeUndefined();
  });

  it('ignores a stale completion after the run was preempted by a newer one', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    service.beginToolRun('gestures', 'req-2'); // fresh turn preempts req-1

    expect(service.completeRun('req-1', 'late result')).toBeUndefined();

    const { turns, activeRequestId } = service.getSnapshot();
    // Two user turns, no assistant turn from the stale completion.
    expect(turns.map((t) => t.role)).toEqual(['user', 'user']);
    expect(activeRequestId).toBe('req-2');
  });

  it('abandon clears the active run but keeps the attempted user turn', () => {
    pin();
    service.beginToolRun('editor', 'req-1');
    service.abandonRun('req-1');

    const snapshot = service.getSnapshot();
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.turns).toHaveLength(1);
    expect(snapshot.turns[0].role).toBe('user');

    // Completion after abandon is stale too.
    expect(service.completeRun('req-1', 'late')).toBeUndefined();
  });

  it('reset clears turns and the active run while the excerpt survives', () => {
    const excerpt = pin();
    service.beginToolRun('style', 'req-1');
    service.completeRun('req-1', 'result');
    service.beginToolRun('fresh', 'req-2');

    service.reset();

    const snapshot = service.getSnapshot();
    expect(snapshot.turns).toEqual([]);
    expect(snapshot.selectedToolId).toBeUndefined();
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.activeRequestId).toBeUndefined();
    expect(snapshot.excerpt).toEqual(excerpt);

    // The pre-reset run can no longer land a turn.
    expect(service.completeRun('req-2', 'zombie result')).toBeUndefined();
    expect(service.getSnapshot().turns).toEqual([]);
  });

  // ── Sprint 3: conversation lifecycle ────────────────────────────────────

  it('adopts the retained conversation id on a successful completion', () => {
    pin();
    expect(service.getConversationId()).toBeUndefined();
    expect(service.getSnapshot().hasConversation).toBe(false);

    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');

    expect(service.getConversationId()).toBe('conv-1');
    expect(service.getSnapshot().hasConversation).toBe(true);
  });

  it('a completion without a conversation id keeps the existing conversation', () => {
    pin();
    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');

    service.beginMessageRun('now tighten it', 'req-2');
    service.completeRun('req-2', 'tightened');

    expect(service.getConversationId()).toBe('conv-1');
  });

  it('a stale (zombie) completion never adopts its conversation', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    service.beginToolRun('gestures', 'req-2'); // preempts req-1

    expect(service.completeRun('req-1', 'late', undefined, false, 'conv-zombie')).toBeUndefined();
    expect(service.getConversationId()).toBeUndefined();
  });

  it('a follow-up message run appends the user text and completes as a message turn', () => {
    pin();
    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');

    const userTurn = service.beginMessageRun('Now tighten variation two.', 'req-2');
    expect(userTurn).toMatchObject({
      role: 'user',
      kind: 'message',
      content: 'Now tighten variation two.'
    });
    expect(userTurn.toolId).toBeUndefined();
    expect(service.getSnapshot().activeRequestId).toBe('req-2');
    // No tool is running — a follow-up has no activeToolId.
    expect(service.getSnapshot().activeToolId).toBeUndefined();

    const assistantTurn = service.completeRun('req-2', 'Tightened version…', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    });
    expect(assistantTurn).toMatchObject({
      role: 'assistant',
      kind: 'message',
      content: 'Tightened version…'
    });
    expect(assistantTurn?.toolLabel).toBeUndefined();
    // The conversation id is stable across the follow-up.
    expect(service.getConversationId()).toBe('conv-1');
  });

  it('a message run can display a short label while sending a fuller prompt', () => {
    pin();
    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');

    const userTurn = service.beginMessageRun(
      'Generate three options with the strict variation-card markdown format.',
      'req-2',
      'Generate 3 tighter variations'
    );

    expect(userTurn.content).toBe('Generate 3 tighter variations');
    const turns = service.getSnapshot().turns;
    expect(turns[turns.length - 1]?.content).toBe('Generate 3 tighter variations');
  });

  it('refuses a message run without a conversation to continue', () => {
    pin();
    expect(() => service.beginMessageRun('hello?', 'req-1')).toThrow(/active conversation/);
  });

  it('reset clears and RETURNS the conversation id so the caller can discard it', () => {
    pin();
    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');

    expect(service.reset()).toBe('conv-1');
    expect(service.getConversationId()).toBeUndefined();
    expect(service.getSnapshot().hasConversation).toBe(false);
    // A reset with no conversation returns undefined (nothing to discard).
    expect(service.reset()).toBeUndefined();
  });

  it('a post-reset run adopts a fresh conversation id', () => {
    pin();
    service.beginToolRun('dialogue', 'req-1');
    service.completeRun('req-1', 'analysis', undefined, false, 'conv-1');
    service.reset();

    service.beginToolRun('prose', 'req-2');
    service.completeRun('req-2', 'fresh analysis', undefined, false, 'conv-2');

    expect(service.getConversationId()).toBe('conv-2');
  });

  // ── Sprint 3: bounded snapshots (PR #67 review #12) ─────────────────────

  it('windows snapshot turns and reports the total + truncated counts', () => {
    pin();
    const totalRuns = WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 5; // > window in turns
    for (let i = 0; i < totalRuns; i++) {
      service.beginToolRun('prose', `req-${i}`);
      service.completeRun(`req-${i}`, `analysis ${i}`);
    }

    const snapshot = service.getSnapshot();
    const totalTurns = totalRuns * 2;
    expect(snapshot.totalTurns).toBe(totalTurns);
    expect(snapshot.turns).toHaveLength(WORKSHOP_SNAPSHOT_TURN_WINDOW);
    expect(snapshot.truncatedTurns).toBe(totalTurns - WORKSHOP_SNAPSHOT_TURN_WINDOW);
    // The window keeps the MOST RECENT turns.
    expect(snapshot.turns[snapshot.turns.length - 1].content).toBe(`analysis ${totalRuns - 1}`);
  });

  it('reports zero truncation for a thread inside the window', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    service.completeRun('req-1', 'analysis');

    const snapshot = service.getSnapshot();
    expect(snapshot.totalTurns).toBe(2);
    expect(snapshot.truncatedTurns).toBe(0);
  });

  it('hands out copies — mutating a snapshot or returned turn never reaches session state', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    const returned = service.completeRun('req-1', 'result', {
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3
    });

    const snapshot = service.getSnapshot();
    snapshot.turns.pop();
    snapshot.turns[0].content = 'vandalized';
    snapshot.excerpt!.text = 'vandalized';
    returned!.content = 'vandalized';
    returned!.usage!.totalTokens = 999;

    const fresh = service.getSnapshot();
    expect(fresh.turns).toHaveLength(2);
    expect(fresh.turns[0].content).toContain('Prose');
    expect(fresh.turns[1].content).toBe('result');
    expect(fresh.turns[1].usage?.totalTokens).toBe(3);
    expect(fresh.excerpt?.text).toBe('She left the letter on the table.');
  });
});
