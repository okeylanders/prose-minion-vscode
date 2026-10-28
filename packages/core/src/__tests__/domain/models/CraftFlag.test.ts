/**
 * Craft Flags' vocabulary (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c):
 * the categories a run asks about, as the writer's setting names them, and
 * the kinds each category's flags carry.
 */
import {
  CRAFT_FLAG_CATEGORIES,
  CRAFT_FLAG_KINDS,
  CRAFT_FLAG_LEAVES_SPEECH,
  CONTINUITY_DEFINITIONS,
  CONTINUITY_KINDS,
  GESTURE_STRAIN_DEFINITIONS,
  GESTURE_STRAIN_KINDS,
  REGISTER_SHIFT_DEFINITIONS,
  REGISTER_SHIFT_KINDS,
  craftFlagCategoriesOf,
  isCraftFlagKind
} from '@/domain/models/CraftFlag';

describe('craftFlagCategoriesOf (Slice 3c part 2)', () => {
  it('keeps the known categories the setting names, each once, in their own order', () => {
    expect(craftFlagCategoriesOf(['register', 'cliche'])).toEqual(['cliche', 'register']);
    expect(craftFlagCategoriesOf(['gesture', 'register', 'cliche'])).toEqual(['cliche', 'register', 'gesture']);
    expect(craftFlagCategoriesOf(['continuity', 'cliche'])).toEqual(['cliche', 'continuity']);
    expect(craftFlagCategoriesOf(['register', 'register'])).toEqual(['register']);
    expect(craftFlagCategoriesOf(['cliche', 'plot', 'Gesture', 3, null])).toEqual(['cliche']);
  });

  it('turns nothing on for a setting that is not a list of categories', () => {
    for (const value of [undefined, null, 'cliche', {}, [], ['plot']]) {
      expect(craftFlagCategoriesOf(value)).toEqual([]);
    }
  });
});

describe('the categories and their kinds', () => {
  it('offers cliché, register shift, gesture strain and continuity, each leaving speech alone', () => {
    expect(CRAFT_FLAG_CATEGORIES).toEqual(['cliche', 'register', 'gesture', 'continuity']);
    expect(CRAFT_FLAG_LEAVES_SPEECH).toEqual({ cliche: true, register: true, gesture: true, continuity: true });
  });

  it('gives register shift its own four kinds, each defined, and no category another\'s', () => {
    expect(CRAFT_FLAG_KINDS.register).toEqual(REGISTER_SHIFT_KINDS);
    expect(Object.keys(REGISTER_SHIFT_DEFINITIONS)).toEqual([...REGISTER_SHIFT_KINDS]);
    expect(isCraftFlagKind('register', 'period')).toBe(true);
    expect(isCraftFlagKind('register', 'cliche')).toBe(false);
    expect(isCraftFlagKind('cliche', 'slang')).toBe(false);
  });
});

describe('gesture strain\'s kinds (Slice 3c part 3)', () => {
  it('are its own four, each defined, and no other category\'s', () => {
    expect(CRAFT_FLAG_KINDS.gesture).toEqual(GESTURE_STRAIN_KINDS);
    expect(GESTURE_STRAIN_KINDS).toEqual(['impossible', 'complicated', 'thin', 'redundant']);
    expect(Object.keys(GESTURE_STRAIN_DEFINITIONS)).toEqual([...GESTURE_STRAIN_KINDS]);
    expect(isCraftFlagKind('gesture', 'thin')).toBe(true);
    expect(isCraftFlagKind('gesture', 'cliche')).toBe(false);
    expect(isCraftFlagKind('register', 'thin')).toBe(false);
    expect(isCraftFlagKind('cliche', 'redundant')).toBe(false);
  });
});

describe('continuity\'s kinds (Slice 3c part 4)', () => {
  it('are its own five, each defined, and no other category\'s', () => {
    expect(CRAFT_FLAG_KINDS.continuity).toEqual(CONTINUITY_KINDS);
    expect(CONTINUITY_KINDS).toEqual(['body', 'object', 'place', 'time', 'people']);
    expect(Object.keys(CONTINUITY_DEFINITIONS)).toEqual([...CONTINUITY_KINDS]);
    expect(isCraftFlagKind('continuity', 'body')).toBe(true);
    expect(isCraftFlagKind('continuity', 'thin')).toBe(false);
    expect(isCraftFlagKind('gesture', 'body')).toBe(false);
  });
});
