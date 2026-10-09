import {
  NARRATIVE_HANDLING_POSITIONS,
  NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION,
  NARRATIVE_HANDLING_SHOW_TELL_LABELS,
  NARRATIVE_HANDLING_SHOW_TELL_VALUES
} from '@shared/constants/narrativeHandlingVocabulary';

/* eslint-disable @typescript-eslint/naming-convention -- vocabulary ids are persisted protocol literals. */
describe('narrativeHandlingVocabulary', () => {
  it('pins the five positions in their telling → showing order', () => {
    expect(NARRATIVE_HANDLING_POSITIONS).toEqual([
      'state-it',
      'summarize',
      'hinge',
      'evidence',
      'inhabit'
    ]);
  });

  it('pins the three Controller show:tell values and their display labels', () => {
    expect(NARRATIVE_HANDLING_SHOW_TELL_VALUES).toEqual([
      'summary-allowed',
      'mixed',
      'scene-only'
    ]);
    expect(NARRATIVE_HANDLING_SHOW_TELL_LABELS).toEqual({
      'summary-allowed': 'summary allowed',
      mixed: 'mixed',
      'scene-only': 'scene only'
    });
  });

  it('pins a total position → Controller mapping', () => {
    expect(NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION).toEqual({
      'state-it': 'summary-allowed',
      summarize: 'summary-allowed',
      hinge: 'mixed',
      evidence: 'scene-only',
      inhabit: 'scene-only'
    });
    expect(Object.keys(NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION))
      .toEqual([...NARRATIVE_HANDLING_POSITIONS]);
  });

  it('maps five positions onto all three values without reversing the continuum', () => {
    const valueOrder = NARRATIVE_HANDLING_POSITIONS.map((position) =>
      NARRATIVE_HANDLING_SHOW_TELL_VALUES.indexOf(
        NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION[position]
      )
    );

    expect(new Set(valueOrder)).toEqual(new Set([0, 1, 2]));
    expect(valueOrder).toEqual([...valueOrder].sort((left, right) => left - right));
  });

  it('freezes every shared table at runtime', () => {
    expect(Object.isFrozen(NARRATIVE_HANDLING_POSITIONS)).toBe(true);
    expect(Object.isFrozen(NARRATIVE_HANDLING_SHOW_TELL_VALUES)).toBe(true);
    expect(Object.isFrozen(NARRATIVE_HANDLING_SHOW_TELL_LABELS)).toBe(true);
    expect(Object.isFrozen(NARRATIVE_HANDLING_SHOW_TELL_BY_POSITION)).toBe(true);
  });
});
/* eslint-enable @typescript-eslint/naming-convention */
