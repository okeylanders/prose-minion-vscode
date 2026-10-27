/**
 * Craft Flags' vocabulary (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c):
 * the categories a run asks about, as the writer's setting names them, and
 * the kinds each category's flags carry.
 */
import {
  CRAFT_FLAG_CATEGORIES,
  CRAFT_FLAG_KINDS,
  CRAFT_FLAG_LEAVES_SPEECH,
  REGISTER_SHIFT_DEFINITIONS,
  REGISTER_SHIFT_KINDS,
  craftFlagCategoriesOf,
  isCraftFlagKind
} from '@/domain/models/CraftFlag';

describe('craftFlagCategoriesOf (Slice 3c part 2)', () => {
  it('keeps the known categories the setting names, each once, in their own order', () => {
    expect(craftFlagCategoriesOf(['register', 'cliche'])).toEqual(['cliche', 'register']);
    expect(craftFlagCategoriesOf(['register', 'register'])).toEqual(['register']);
    expect(craftFlagCategoriesOf(['cliche', 'gesture', 'Register', 3, null])).toEqual(['cliche']);
  });

  it('turns nothing on for a setting that is not a list of categories', () => {
    for (const value of [undefined, null, 'cliche', {}, [], ['continuity']]) {
      expect(craftFlagCategoriesOf(value)).toEqual([]);
    }
  });
});

describe('the categories and their kinds', () => {
  it('offers cliché and register shift, each leaving speech alone', () => {
    expect(CRAFT_FLAG_CATEGORIES).toEqual(['cliche', 'register']);
    expect(CRAFT_FLAG_LEAVES_SPEECH).toEqual({ cliche: true, register: true });
  });

  it('gives register shift its own four kinds, each defined, and no category another\'s', () => {
    expect(CRAFT_FLAG_KINDS.register).toEqual(REGISTER_SHIFT_KINDS);
    expect(Object.keys(REGISTER_SHIFT_DEFINITIONS)).toEqual([...REGISTER_SHIFT_KINDS]);
    expect(isCraftFlagKind('register', 'period')).toBe(true);
    expect(isCraftFlagKind('register', 'cliche')).toBe(false);
    expect(isCraftFlagKind('cliche', 'slang')).toBe(false);
  });
});
