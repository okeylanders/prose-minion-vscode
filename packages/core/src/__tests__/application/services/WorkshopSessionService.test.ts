/**
 * WorkshopSessionService tests — the Sprint 2 session aggregate.
 *
 * Behavior under test (sprint acceptance criteria):
 * - set-excerpt pins host-stamped excerpt state,
 * - a tool run appends a user+assistant turn pair and tracks the active tool,
 * - reset clears the thread and active run (excerpt survives),
 * - stale completions (reset/preempt mid-stream) never corrupt the thread,
 * - snapshots are copies — mutating them cannot reach session truth.
 */

import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';

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
    const assistantTurn = service.completeToolRun(
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
    expect(snapshot.activeToolId).toBe('cliche');
    expect(snapshot.activeRequestId).toBe('req-1');

    service.completeToolRun('req-1', 'done');
    snapshot = service.getSnapshot();
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.activeRequestId).toBeUndefined();
  });

  it('ignores a stale completion after the run was preempted by a newer one', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    service.beginToolRun('gestures', 'req-2'); // fresh turn preempts req-1

    expect(service.completeToolRun('req-1', 'late result')).toBeUndefined();

    const { turns, activeRequestId } = service.getSnapshot();
    // Two user turns, no assistant turn from the stale completion.
    expect(turns.map((t) => t.role)).toEqual(['user', 'user']);
    expect(activeRequestId).toBe('req-2');
  });

  it('abandon clears the active run but keeps the attempted user turn', () => {
    pin();
    service.beginToolRun('editor', 'req-1');
    service.abandonToolRun('req-1');

    const snapshot = service.getSnapshot();
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.turns).toHaveLength(1);
    expect(snapshot.turns[0].role).toBe('user');

    // Completion after abandon is stale too.
    expect(service.completeToolRun('req-1', 'late')).toBeUndefined();
  });

  it('reset clears turns and the active run while the excerpt survives', () => {
    const excerpt = pin();
    service.beginToolRun('style', 'req-1');
    service.completeToolRun('req-1', 'result');
    service.beginToolRun('fresh', 'req-2');

    service.reset();

    const snapshot = service.getSnapshot();
    expect(snapshot.turns).toEqual([]);
    expect(snapshot.activeToolId).toBeUndefined();
    expect(snapshot.activeRequestId).toBeUndefined();
    expect(snapshot.excerpt).toEqual(excerpt);

    // The pre-reset run can no longer land a turn.
    expect(service.completeToolRun('req-2', 'zombie result')).toBeUndefined();
    expect(service.getSnapshot().turns).toEqual([]);
  });

  it('hands out copies — mutating a snapshot or returned turn never reaches session state', () => {
    pin();
    service.beginToolRun('prose', 'req-1');
    const returned = service.completeToolRun('req-1', 'result', {
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
