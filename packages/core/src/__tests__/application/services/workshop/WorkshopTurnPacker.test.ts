import {
  packWorkshopTurnsNewestFirst,
  WorkshopTurnPackingPolicy
} from '@/application/services/workshop/WorkshopTurnPacker';

const policy = (
  overrides: Partial<WorkshopTurnPackingPolicy> = {}
): WorkshopTurnPackingPolicy => ({
  turnLimit: 3,
  characterLimit: 100,
  headerAllowanceCharacters: 0,
  oversizedTurn: {
    kind: 'head-truncate',
    marker: '[trimmed]'
  },
  receiptOrder: 'frame-order',
  ...overrides
});

const turns = (...contents: string[]): Array<{ id: string; content: string }> =>
  contents.map((content, index) => ({ id: `turn-${index + 1}`, content }));

describe('packWorkshopTurnsNewestFirst', () => {
  it('keeps the newest window while rendering and receipting in frame order', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('one', 'two', 'three', 'four'),
      (turn) => turn.content,
      policy()
    );

    expect(packed.blocks).toEqual(['two', 'three', 'four']);
    expect(packed.deliveredTurnIds).toEqual(['turn-2', 'turn-3', 'turn-4']);
    expect(packed.omittedTurns).toBe(1);
  });

  it('can preserve the legacy newest-first receipt order independently of frame order', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('one', 'two', 'three'),
      (turn) => turn.content,
      policy({ receiptOrder: 'newest-first' })
    );

    expect(packed.blocks).toEqual(['one', 'two', 'three']);
    expect(packed.deliveredTurnIds).toEqual(['turn-3', 'turn-2', 'turn-1']);
  });

  it('head-truncates only the newest oversized turn and spends the remaining budget', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('older', 'x'.repeat(40)),
      (turn) => turn.content,
      policy({ characterLimit: 20 })
    );

    expect(packed.blocks).toEqual([`${'x'.repeat(11)}[trimmed]`]);
    expect(packed.deliveredTurnIds).toEqual(['turn-2']);
    expect(packed.omittedTurns).toBe(1);
    expect(packed.truncatedCharacters).toBe(29 + 'older'.length);
  });
});
