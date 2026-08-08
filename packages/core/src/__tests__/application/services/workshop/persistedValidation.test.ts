import {
  boundedArrayAt,
  nullableBoundedStringAt
} from '@/application/services/workshop/persistedValidation';

describe('persistedValidation', () => {
  describe('boundedArrayAt', () => {
    it.each([
      ['minimum', ['one']],
      ['maximum', ['one', 'two', 'three']]
    ])('accepts the inclusive %s boundary', (_label, value) => {
      expect(() => boundedArrayAt(value, 'draft.items', 1, 3, 'items')).not.toThrow();
    });

    it.each([
      ['one below', []],
      ['one above', ['one', 'two', 'three', 'four']]
    ])('rejects %s the permitted range', (_label, value) => {
      expect(() => boundedArrayAt(value, 'draft.items', 1, 3, 'items'))
        .toThrow('draft.items must be an array of 1–3 items');
    });

    it('rejects non-arrays with the same bounded diagnostic', () => {
      expect(() => boundedArrayAt({}, 'draft.items', 0, 3, 'items'))
        .toThrow('draft.items must be an array of at most 3 items');
    });

    it('names exact domain items without implying their JSON representation', () => {
      expect(() => boundedArrayAt([], 'draft.poles', 2, 2, 'poles'))
        .toThrow('draft.poles must be an array containing exactly 2 poles');
    });
  });

  describe('nullableBoundedStringAt', () => {
    it.each([null, '', 'four'])('accepts null, blank-by-policy, and the exact bound (%p)', (value) => {
      expect(() => nullableBoundedStringAt(value, 'draft.note', 4)).not.toThrow();
    });

    it('enforces non-blank policy for non-null strings', () => {
      expect(() => nullableBoundedStringAt('  ', 'draft.note', 4, false))
        .toThrow('draft.note must be a non-empty string');
    });

    it('rejects overflow', () => {
      expect(() => nullableBoundedStringAt('five!', 'draft.note', 4))
        .toThrow('draft.note must be a string of at most 4 characters');
    });
  });
});
