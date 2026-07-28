/**
 * ListenerSet tests — the multicast contract every shared service now rides
 * (PR #67 review #2/#5): concurrent delivery to multiple subscribers,
 * own-registration-only release, per-listener fault isolation.
 */

import { ListenerSet } from '@/utils/ListenerSet';
import type { LogSink } from '@/platform';

describe('ListenerSet', () => {
  let log: { appendLine: jest.Mock };

  beforeEach(() => {
    log = { appendLine: jest.fn() };
  });

  it('delivers every emit to every live listener (two webviews, one signal)', () => {
    const set = new ListenerSet<[number]>('[test] listener', log as unknown as LogSink);
    const sidebar = jest.fn();
    const workshop = jest.fn();
    set.add(sidebar);
    set.add(workshop);

    set.emit(42);

    expect(sidebar).toHaveBeenCalledWith(42);
    expect(workshop).toHaveBeenCalledWith(42);
  });

  it('unsubscribing one listener never blinds the survivor', () => {
    const set = new ListenerSet<[string]>('[test] listener');
    const first = jest.fn();
    const second = jest.fn();
    const disposeFirst = set.add(first);
    set.add(second);

    disposeFirst();
    set.emit('after-dispose');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('after-dispose');
    expect(set.size).toBe(1);
  });

  it('unsubscribe is idempotent and scoped to its own registration', () => {
    const set = new ListenerSet<[]>('[test] listener');
    const listener = jest.fn();
    const dispose = set.add(listener);
    set.add(jest.fn());

    dispose();
    dispose(); // double-release must be harmless

    expect(set.size).toBe(1);
  });

  it('a throwing listener is contained and logged; later listeners still receive', () => {
    const set = new ListenerSet<[string]>('[test] listener', log as unknown as LogSink);
    const explosive = jest.fn(() => {
      throw new Error('webview A bug');
    });
    const survivor = jest.fn();
    set.add(explosive);
    set.add(survivor);

    expect(() => set.emit('payload')).not.toThrow();

    expect(survivor).toHaveBeenCalledWith('payload');
    expect(log.appendLine).toHaveBeenCalledWith('[test] listener threw: webview A bug');
  });

  it('a listener unsubscribing itself mid-dispatch does not skip its siblings', () => {
    const set = new ListenerSet<[]>('[test] listener');
    const calls: string[] = [];
    const disposeSelf = set.add(() => {
      calls.push('self-remover');
      disposeSelf();
    });
    set.add(() => calls.push('sibling'));

    set.emit();
    set.emit();

    // Snapshot iteration: first emit reaches both, second only the sibling.
    expect(calls).toEqual(['self-remover', 'sibling', 'sibling']);
  });

  it('clear() drops all registrations', () => {
    const set = new ListenerSet<[]>('[test] listener');
    const listener = jest.fn();
    set.add(listener);

    set.clear();
    set.emit();

    expect(listener).not.toHaveBeenCalled();
    expect(set.size).toBe(0);
  });
});
