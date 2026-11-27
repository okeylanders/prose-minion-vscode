import { WorkshopHighlightProposal } from '@/application/handlers/domain/workshop/WorkshopHighlightProposal';

const details = { roomRevision: 4, count: 2, persona: 'Jill', title: 'Rhythm', displayPath: 'Drafts/Chapter.md' };

describe('the pending Workshop highlight proposal', () => {
  it('settles only the matching prompt, room and choice, once', async () => {
    const changed = jest.fn();
    const broker = new WorkshopHighlightProposal(changed);
    const run = broker.ask(details, new AbortController().signal);
    const first = broker.current()!;
    const answer = { promptId: first.promptId, roomRevision: first.roomRevision, choice: 'apply' as const };
    broker.answer({ ...answer, promptId: 'another-prompt' });
    broker.answer({ ...answer, roomRevision: 5 });
    broker.answer({ ...answer, choice: 'restore' });
    expect(broker.current()).toEqual(first);
    expect(changed).toHaveBeenCalledTimes(1);
    broker.answer(answer);
    broker.answer(answer);
    expect(await run).toBe(true);
    expect(broker.current()).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('releases the old run on replacement and ignores its late answer and cancellation', async () => {
    const broker = new WorkshopHighlightProposal(jest.fn());
    const old = new AbortController();
    const first = broker.ask(details, old.signal);
    const stale = broker.current()!;
    const second = broker.ask(details, new AbortController().signal);
    const current = broker.current()!;
    expect(await first).toBe(false);
    expect(stale.promptId).not.toBe(current.promptId);
    old.abort();
    broker.answer({ ...stale, choice: 'apply' });
    expect(broker.current()).toEqual(current);
    broker.answer({ ...current, choice: 'skip' });
    expect(await second).toBe(false);
  });

  it('skips aborted work without posting a question and releases an unanswered question on teardown', async () => {
    const changed = jest.fn();
    const broker = new WorkshopHighlightProposal(changed);
    const old = new AbortController();
    old.abort();
    expect(await broker.ask(details, old.signal)).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    const pending = broker.ask(details, new AbortController().signal);
    broker.cancel();
    expect(await pending).toBe(false);
    expect(broker.current()).toBeUndefined();
  });
});
