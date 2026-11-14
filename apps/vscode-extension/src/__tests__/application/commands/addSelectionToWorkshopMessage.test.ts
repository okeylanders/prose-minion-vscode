/**
 * Add Selection to Workshop Message (ADR 2026-11-14 D12): the selection is
 * captured at the gesture, before anything awaits; nothing selected opens
 * nothing; and the Workshop's answer settles the command with one notice,
 * or none. The host is a fake port, so no VS Code API is mocked.
 */

import type { WorkshopSeedOutcome } from '@prose-minion/core';
import {
  ADD_SELECTION_NOTICES,
  ADD_SELECTION_TO_WORKSHOP_MESSAGE_COMMAND,
  addSelectionNotice,
  addSelectionToWorkshopMessage
} from '@app/application/commands/addSelectionToWorkshopMessage';

function createHost(options: {
  editor?: boolean;
  snapshot?: { id: string };
  outcome?: WorkshopSeedOutcome | Error;
} = {}) {
  const events: string[] = [];
  const warnings: string[] = [];
  const logs: string[] = [];
  let settle!: () => void;
  const staged = new Promise<void>((resolve) => { settle = resolve; });
  const host = {
    hasEditor: () => options.editor ?? true,
    capture: jest.fn(() => {
      events.push('capture');
      return options.snapshot;
    }),
    stageSelectedText: jest.fn(async (snapshotId: string) => {
      events.push(`stage:${snapshotId}`);
      await staged;
      if (options.outcome instanceof Error) {
        throw options.outcome;
      }
      return options.outcome ?? { opened: true as const };
    }),
    showWarning: (message: string) => { warnings.push(message); },
    log: (line: string) => { logs.push(line); }
  };
  return { host, events, warnings, logs, settle };
}

describe('addSelectionToWorkshopMessage', () => {
  it('is the contributed command', () => {
    expect(ADD_SELECTION_TO_WORKSHOP_MESSAGE_COMMAND).toBe('prose-minion.addSelectionToWorkshopMessage');
  });

  it('captures the snapshot at the gesture, synchronously, and offers the Workshop its id only', async () => {
    const { host, events, warnings, settle } = createHost({ snapshot: { id: 'snap-1' } });
    const running = addSelectionToWorkshopMessage(host);
    // Before anything awaited: the selection was already read, and the offer already made.
    expect(events).toEqual(['capture', 'stage:snap-1']);
    expect(host.stageSelectedText).toHaveBeenCalledWith('snap-1');
    settle();
    await running;
    expect(warnings).toEqual([]);
  });

  it('warns and opens nothing when nothing is selected, or no editor has had focus', async () => {
    const empty = createHost({ editor: true });
    await addSelectionToWorkshopMessage(empty.host);
    expect(empty.warnings).toEqual(['No text selected']);
    expect(empty.host.stageSelectedText).not.toHaveBeenCalled();

    const none = createHost({ editor: false });
    await addSelectionToWorkshopMessage(none.host);
    expect(none.warnings).toEqual(['No active text editor']);
    expect(none.host.stageSelectedText).not.toHaveBeenCalled();
  });

  it.each<[WorkshopSeedOutcome, string | undefined]>([
    [{ opened: true }, undefined],
    [{ opened: false, reason: 'busy' }, ADD_SELECTION_NOTICES.busy],
    [{ opened: false, reason: 'full' }, ADD_SELECTION_NOTICES.full],
    [{ opened: false, reason: 'duplicate' }, ADD_SELECTION_NOTICES.duplicate],
    [{ opened: false, reason: 'replaced' }, undefined],
    [{ opened: false, reason: 'unavailable' }, ADD_SELECTION_NOTICES.notDelivered],
    [{ opened: false, reason: 'closed' }, ADD_SELECTION_NOTICES.notDelivered],
    [{ opened: false, reason: 'timeout' }, ADD_SELECTION_NOTICES.notDelivered],
    [{ opened: false, reason: 'reset' }, ADD_SELECTION_NOTICES.notDelivered]
  ])('settles %j with one notice, or none', async (outcome, notice) => {
    expect(addSelectionNotice(outcome)).toBe(notice);
    const { host, warnings, logs, settle } = createHost({ snapshot: { id: 'snap-1' }, outcome });
    settle();
    await addSelectionToWorkshopMessage(host);
    expect(warnings).toEqual(notice ? [notice] : []);
    expect(logs).toEqual([expect.stringContaining(outcome.opened ? 'staged' : outcome.reason)]);
  });

  it('says to try again when the busy Workshop refused it: an evicted snapshot reads as busy', () => {
    expect(ADD_SELECTION_NOTICES.busy).toMatch(/Try adding the selection again/);
  });

  it('shows one notice when the handoff throws, naming no detail of the selection', async () => {
    const { host, warnings, logs, settle } = createHost({ snapshot: { id: 'snap-1' }, outcome: new Error('alice-ch3.md lines 40-44') });
    settle();
    await addSelectionToWorkshopMessage(host);
    expect(warnings).toEqual([ADD_SELECTION_NOTICES.notDelivered]);
    expect(logs.join('\n')).not.toContain('alice-ch3');
  });
});
