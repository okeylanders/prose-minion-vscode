import type { WorkshopTurn, WorkshopTurnRole } from '@messages';
import {
  WorkshopTurnLedger,
  WorkshopTurnLedgerState
} from '@/application/services/workshop/session/WorkshopTurnLedger';

const turn = (
  id: string,
  content: string,
  overrides: Partial<WorkshopTurn> = {}
): WorkshopTurn => ({
  id,
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  excerptVersion: 1,
  content,
  timestamp: 1,
  ...overrides
});

describe('WorkshopTurnLedger', () => {
  it('mints monotonic role-stamped identities and preserves append order', () => {
    let clock = 100;
    const ledger = new WorkshopTurnLedger(() => ++clock);
    const roles: WorkshopTurnRole[] = ['user', 'assistant', 'system'];

    const ids = roles.map((role) => ledger.nextId(role));
    ledger.append(turn(ids[0], 'First.'));
    ledger.append(turn(ids[1], 'Second.', { role: 'assistant', participant: 'host' }));
    ledger.append(turn(ids[2], 'Third.', { role: 'system', participant: 'session' }));

    expect(ids).toEqual([
      'turn-1-user-101',
      'turn-2-assistant-102',
      'turn-3-system-103'
    ]);
    expect(ledger.all().map((entry) => entry.id)).toEqual(ids);
    expect(ledger.count()).toBe(3);
    expect(ledger.head()?.id).toBe(ids[2]);
    expect(ledger.contains(ids[1])).toBe(true);
    expect(ledger.contains('turn-missing')).toBe(false);
    expect(() => ledger.append(turn(ids[1], 'Duplicate.')))
      .toThrow(`Duplicate Workshop turn ${ids[1]}`);
  });

  it('isolates appended input and returns defensive copies from every read surface', () => {
    const ledger = new WorkshopTurnLedger(() => 1);
    const input = turn('turn-1-user-1', 'Original.', {
      actionableFindings: [{ key: 'finding-1', ordinal: 1, text: 'Tighten this.' }],
      capability: {
        operation: 'resource.read',
        status: 'success',
        requestSummary: 'Read notes',
        requestedByPersonaId: 'jill',
        invokedBy: { kind: 'host' },
        metadata: { location: { path: 'notes/scene.md' } }
      }
    });

    ledger.append(input);
    input.content = 'Mutated input.';
    input.actionableFindings![0].text = 'Mutated input finding.';
    ((input.capability!.metadata!.location) as { path: string }).path = 'mutated.md';

    const found = ledger.find(input.id)!;
    found.actionableFindings![0].text = 'Mutated find result.';
    const head = ledger.head()!;
    head.content = 'Mutated head result.';
    const all = ledger.all();
    all[0].content = 'Mutated all result.';
    const window = ledger.window(1);
    window[0].content = 'Mutated window result.';

    const retained = ledger.find(input.id)!;
    expect(retained.content).toBe('Original.');
    expect(retained.actionableFindings![0].text).toBe('Tighten this.');
    expect(retained.capability?.metadata).toEqual({
      location: { path: 'notes/scene.md' }
    });
    expect(ledger.find('turn-missing')).toBeUndefined();
  });

  it('returns the newest bounded window while retaining ledger order', () => {
    const ledger = new WorkshopTurnLedger(() => 1);
    ledger.append(turn('turn-1-user-1', 'First.'));
    ledger.append(turn('turn-2-user-1', 'Second.'));
    ledger.append(turn('turn-3-user-1', 'Third.'));

    expect(ledger.window(2).map((entry) => entry.content)).toEqual(['Second.', 'Third.']);
    expect(ledger.window(10).map((entry) => entry.content)).toEqual([
      'First.',
      'Second.',
      'Third.'
    ]);
    expect(ledger.window(0)).toEqual([]);
    expect(() => ledger.window(-1)).toThrow('Workshop turn window must be a non-negative integer');
    expect(() => ledger.window(1.5)).toThrow('Workshop turn window must be a non-negative integer');
  });

  it('supports aggregate-owned updates without exposing or changing identity', () => {
    const ledger = new WorkshopTurnLedger(() => 1);
    const first = turn('turn-1-assistant-1', 'Evidence.', {
      role: 'assistant',
      participant: 'tool',
      kind: 'tool_run',
      artifact: 'resource_read',
      capability: {
        operation: 'resource.read',
        status: 'success',
        requestSummary: 'Read notes',
        requestedByPersonaId: 'jill',
        invokedBy: { kind: 'host' }
      }
    });
    const second = turn('turn-2-user-1', 'Reply.');
    ledger.append(first);
    ledger.append(second);

    const updated = ledger.update(first.id, (candidate) => {
      candidate.content = 'Published evidence.';
      candidate.capability!.publishedWithTurnId = second.id;
    })!;
    updated.content = 'Mutated update result.';

    expect(ledger.all().map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(ledger.find(first.id)).toMatchObject({
      id: first.id,
      content: 'Published evidence.',
      capability: { publishedWithTurnId: second.id }
    });
    expect(ledger.update('turn-missing', () => undefined)).toBeUndefined();

    expect(() => ledger.update(first.id, (candidate) => {
      candidate.id = 'turn-rewritten';
    })).toThrow(`Cannot change Workshop turn identity ${first.id} to turn-rewritten`);
    expect(ledger.find(first.id)?.id).toBe(first.id);
  });

  it('prepares and exports deep copies while installation adopts prepared state', () => {
    const source: WorkshopTurnLedgerState = {
      counter: 7,
      turns: [turn('turn-7-user-1', 'Hydrated.', {
        actionableFindings: [{ key: 'finding-1', ordinal: 1, text: 'Keep this.' }]
      })]
    };
    const ledger = new WorkshopTurnLedger(() => 200);
    const prepared = ledger.prepareState(source);

    source.counter = 99;
    source.turns[0].content = 'Mutated source.';
    source.turns[0].actionableFindings![0].text = 'Mutated nested source.';
    ledger.installPreparedState(prepared);

    expect(ledger.find('turn-7-user-1')).toMatchObject({
      content: 'Hydrated.',
      actionableFindings: [{ text: 'Keep this.' }]
    });
    expect(ledger.nextId('assistant')).toBe('turn-8-assistant-200');

    const exported = ledger.exportState();
    exported.counter = 0;
    exported.turns[0].content = 'Mutated export.';
    exported.turns[0].actionableFindings![0].text = 'Mutated nested export.';

    expect(ledger.exportState()).toMatchObject({
      counter: 8,
      turns: [{
        content: 'Hydrated.',
        actionableFindings: [{ text: 'Keep this.' }]
      }]
    });
  });

  it('clears turns on reset without reusing the monotonic identity counter', () => {
    const ledger = new WorkshopTurnLedger(() => 50);
    const firstId = ledger.nextId('user');
    ledger.append(turn(firstId, 'Old room.'));

    ledger.reset();

    expect(ledger.all()).toEqual([]);
    expect(ledger.count()).toBe(0);
    expect(ledger.head()).toBeUndefined();
    expect(ledger.exportState().counter).toBe(1);
    expect(ledger.nextId('assistant')).toBe('turn-2-assistant-50');
  });
});
