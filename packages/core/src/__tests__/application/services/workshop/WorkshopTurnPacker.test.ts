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

  it('keeps receipts in the same ledger order as rendered blocks', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('one', 'two', 'three'),
      (turn) => turn.content,
      policy()
    );

    expect(packed.blocks).toEqual(['one', 'two', 'three']);
    expect(packed.deliveredTurnIds).toEqual(['turn-1', 'turn-2', 'turn-3']);
  });

  it('omits an oversized newest turn whole instead of quoting part of it', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('older', 'x'.repeat(40)),
      (turn) => turn.content,
      policy({ characterLimit: 20 })
    );

    expect(packed.blocks).toEqual([]);
    expect(packed.deliveredTurnIds).toEqual([]);
    expect(packed.omittedTurns).toBe(2);
  });

  it('omits one contiguous older prefix when the next whole turn does not fit', () => {
    const packed = packWorkshopTurnsNewestFirst(
      turns('old', 'x'.repeat(18), 'new'),
      (turn) => turn.content,
      policy({ characterLimit: 20 })
    );

    expect(packed.blocks).toEqual(['new']);
    expect(packed.deliveredTurnIds).toEqual(['turn-3']);
    expect(packed.omittedTurns).toBe(2);
  });
});
