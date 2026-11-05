/**
 * The three room starts (ADR 2026-11-04 D2, D7): the reset route takes one
 * `start`, refuses a missing or unknown one, and says what started.
 */

import {
  WORKSHOP_SESSION_START_REFUSAL,
  workshopSessionStartLog,
  workshopSessionStartOf,
  workshopSessionStartResult
} from '@handlers/domain/workshop/WorkshopSessionStartResult';
import type { WorkshopRoomSeedReport } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const seeded = (overrides: Partial<WorkshopRoomSeedReport> = {}): WorkshopRoomSeedReport => ({
  pinnedCount: 10,
  attachedCount: 10,
  attachedWords: 23_412,
  leftOut: [],
  ...overrides
});

const NOTHING_PINNED: WorkshopRoomSeedReport = {
  pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: []
};

describe('the reset route\'s start', () => {
  it.each(['carry', 'full-reset', 'empty'] as const)('passes %s to the coordinator as written', async (start) => {
    const { router, persistence, posted } = createWorkshopRouteTestHarness();

    await router.route(message(MessageType.WORKSHOP_RESET_SESSION, { start }) as never);

    expect(persistence.resetSession).toHaveBeenCalledWith({ start });
    expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload).toEqual({
      action: 'new', ok: true, message: workshopSessionStartResult(start)
    });
  });

  it.each([
    ['no start', {}],
    ['an unknown start', { start: 'wipe' }],
    ['the retired clearWorkingSet shape', { clearWorkingSet: true }],
    ['no payload', undefined]
  ])('refuses %s with a reason, and starts nothing', async (_label, payload) => {
    const { router, persistence, posted, log } = createWorkshopRouteTestHarness();

    await router.route(message(MessageType.WORKSHOP_RESET_SESSION, payload) as never);

    expect(persistence.resetSession).not.toHaveBeenCalled();
    expect(posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1).payload).toEqual({
      action: 'new', ok: false, message: WORKSHOP_SESSION_START_REFUSAL
    });
    expect(log.appendLine).toHaveBeenCalledWith(
      '[WorkshopSessionMessageHandler] New session refused: no known start'
    );
  });

  it('reads only the three starts', () => {
    expect(workshopSessionStartOf({ start: 'carry' })).toBe('carry');
    expect(workshopSessionStartOf({ start: 'CARRY' })).toBeUndefined();
    expect(workshopSessionStartOf({ start: 'empty', clearWorkingSet: false })).toBe('empty');
    expect(workshopSessionStartOf(null)).toBeUndefined();
    expect(workshopSessionStartOf('carry')).toBeUndefined();
  });
});

describe('workshopSessionStartResult (ADR 2026-11-04 D7)', () => {
  it('is today\'s copy with nothing seeded', () => {
    for (const seed of [undefined, NOTHING_PINNED]) {
      expect(workshopSessionStartResult('carry', seed)).toBe('Started a new Workshop session.');
      expect(workshopSessionStartResult('full-reset', seed))
        .toBe('Started an empty Workshop session — excerpt and context cleared.');
    }
  });

  it('says the empty start left pinned context out', () => {
    expect(workshopSessionStartResult('empty')).toBe(
      'Started an empty Workshop session: excerpt and context cleared, and pinned context left out.'
    );
  });

  it('says a carried room got its pinned context', () => {
    expect(workshopSessionStartResult('carry', seeded())).toBe(
      'Started a new Workshop session with your pinned context: 10 files, about 23,400 words.'
    );
    expect(workshopSessionStartResult('carry', seeded({ pinnedCount: 1, attachedCount: 1, attachedWords: 437 })))
      .toBe('Started a new Workshop session with your pinned context: 1 file, about 440 words.');
  });

  it('names each file left out, and why', () => {
    expect(workshopSessionStartResult('carry', seeded({
      attachedCount: 9,
      leftOut: [{ label: 'the-cheshire-cat.md', reason: 'missing' }]
    }))).toBe(
      'Started a new Workshop session. 9 of 10 pinned files attached; not attached: the-cheshire-cat.md (not found).'
    );
    expect(workshopSessionStartResult('carry', seeded({
      pinnedCount: 11,
      leftOut: [{ label: 'manuscript.md', reason: 'over-budget' }]
    }))).toBe(
      'Started a new Workshop session. 10 of 11 pinned files attached; not attached: ' +
      'manuscript.md (doesn’t fit in the 100,000-word context limit).'
    );
    expect(workshopSessionStartResult('full-reset', seeded({
      pinnedCount: 2,
      attachedCount: 0,
      leftOut: [
        { label: 'alice.md', reason: 'unreadable' },
        { label: 'rabbit.md', reason: 'missing' }
      ]
    }))).toBe(
      'Started a new Workshop session with the excerpt and context cleared. 0 of 2 pinned files ' +
      'attached; not attached: alice.md (couldn’t be read), rabbit.md (not found).'
    );
  });

  it('says a full reset cleared the room, then attached pinned context', () => {
    expect(workshopSessionStartResult('full-reset', seeded())).toBe(
      'Started a new Workshop session with the excerpt and context cleared and your pinned ' +
      'context: 10 files, about 23,400 words.'
    );
  });
});

describe('workshopSessionStartLog', () => {
  it('keeps today\'s line and adds the start', () => {
    expect(workshopSessionStartLog('carry', { attachmentLabels: [] })).toBe(
      '[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced (start=carry)'
    );
    expect(workshopSessionStartLog('empty', { excerptLabel: 'Pasted excerpt v2', attachmentLabels: ['Alice'] }))
      .toBe('[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced ' +
        '(start=empty — excerpt: Pasted excerpt v2; context cleared: Alice)');
  });

  it('logs the seed\'s counts and reasons, never a left-out file\'s label', () => {
    const line = workshopSessionStartLog('full-reset', {
      attachmentLabels: [],
      seed: seeded({
        pinnedCount: 3,
        attachedCount: 1,
        attachedWords: 400,
        leftOut: [
          { label: 'secret-alice.md', reason: 'missing' },
          { label: 'secret-rabbit.md', reason: 'over-budget' }
        ]
      })
    });

    expect(line).toBe('[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced ' +
      '(start=full-reset — excerpt: none; context cleared: none; pinned: attached=1/3, words=400, ' +
      'leftOut=missing:1,over-budget:1, kept=0)');
    expect(line).not.toContain('secret');
  });

  it('logs a kept file as kept, never as left out, and never by its label (Slice 2b)', () => {
    const line = workshopSessionStartLog('carry', {
      attachmentLabels: [],
      seed: seeded({
        pinnedCount: 2,
        attachedCount: 1,
        attachedWords: 400,
        leftOut: [{ label: 'secret-alice.md', reason: 'missing', kept: true }]
      })
    });

    expect(line).toBe('[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced ' +
      '(start=carry; pinned: attached=1/2, words=400, leftOut=none, kept=1)');
    expect(line).not.toContain('secret');
  });
});
