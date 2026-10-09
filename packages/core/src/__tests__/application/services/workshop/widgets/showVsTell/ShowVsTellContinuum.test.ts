import {
  NARRATIVE_HANDLING_POSITIONS,
  type NarrativeHandlingPosition
} from '@shared/constants/narrativeHandlingVocabulary';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_CONTINUUM_END_LABELS,
  SHOW_VS_TELL_DEFAULTS,
  SHOW_VS_TELL_GROUPS,
  SHOW_VS_TELL_LENGTH_BUDGETS,
  SHOW_VS_TELL_POSITIONS,
  SHOW_VS_TELL_POV_MODES,
  SHOW_VS_TELL_READOUT,
  SHOW_VS_TELL_READOUT_CAPTION,
  SHOW_VS_TELL_READOUT_SEGMENTS,
  SHOW_VS_TELL_READOUT_VERSION
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';

const levelsInPositionOrder = (label: string): number[] => {
  const dimension = SHOW_VS_TELL_READOUT.find((candidate) => candidate.label === label);
  if (!dimension) {
    throw new Error(`Missing readout dimension ${label}`);
  }
  return NARRATIVE_HANDLING_POSITIONS.map((position) => dimension.levels[position]);
};

const peakPositions = (label: string): NarrativeHandlingPosition[] => {
  const levels = levelsInPositionOrder(label);
  const peak = Math.max(...levels);
  return NARRATIVE_HANDLING_POSITIONS.filter((_, index) => levels[index] === peak);
};

describe('ShowVsTellContinuum', () => {
  it('pins the five positions and their frozen shipped copy, in the shared order', () => {
    expect(SHOW_VS_TELL_POSITIONS.map(({ id }) => id)).toEqual([...NARRATIVE_HANDLING_POSITIONS]);
    expect(SHOW_VS_TELL_POSITIONS).toEqual([
      {
        id: 'state-it',
        name: 'State it',
        subtitle: 'direct tell',
        tradeoff: 'Gets the fact across in the fewest words. Spends nothing, teaches nothing.'
      },
      {
        id: 'summarize',
        name: 'Summarize',
        subtitle: 'compressed narrative',
        tradeoff: 'Buys a stretch of time in a clause — right when the beat is a bridge to somewhere else.'
      },
      {
        id: 'hinge',
        name: 'Hinge',
        subtitle: 'tell the bridge, show the fulcrum',
        tradeoff: 'Tells the bridge, shows the moment that turns. Usually the working answer — so distrust it once.'
      },
      {
        id: 'evidence',
        name: 'Evidence',
        subtitle: 'observable action & sense',
        tradeoff: 'Nothing is claimed, so nothing can be argued with. The most ambiguous position, on purpose.'
      },
      {
        id: 'inhabit',
        name: 'Inhabit',
        subtitle: 'full scene time',
        tradeoff: 'The scene becomes the argument. Costs the most page of anything here.'
      }
    ]);
    expect(SHOW_VS_TELL_CONTINUUM_END_LABELS).toEqual({
      tell: 'compress / explain',
      show: 'dramatize / embody'
    });
  });

  it('keeps every tradeoff line generic rather than quoting the design fixture', () => {
    for (const { tradeoff } of SHOW_VS_TELL_POSITIONS) {
      expect(tradeoff).not.toMatch(/nine words|a year|the year|the room|the second/i);
    }
  });

  it('pins the versioned seven-dimension readout exactly', () => {
    expect(SHOW_VS_TELL_READOUT_VERSION).toBe('show-vs-tell-readout-v1');
    expect(SHOW_VS_TELL_READOUT_SEGMENTS).toBe(4);
    expect(SHOW_VS_TELL_READOUT_CAPTION).toBe(
      'deterministic tradeoff readout · no model call · no bar is a score'
    );
    expect(
      SHOW_VS_TELL_READOUT.map(({ label }) => [label, levelsInPositionOrder(label)])
    ).toEqual([
      ['reader speed', [4, 4, 3, 2, 1]],
      ['fact clarity', [4, 4, 3, 2, 2]],
      ['intimacy', [1, 1, 2, 3, 4]],
      ['page emphasis', [1, 2, 3, 3, 4]],
      ['ambiguity', [0, 1, 2, 4, 3]],
      ['scene time', [0, 1, 2, 3, 4]],
      ['reader work', [0, 1, 3, 4, 3]]
    ]);
    for (const { levels } of SHOW_VS_TELL_READOUT) {
      expect(Object.keys(levels)).toEqual([...NARRATIVE_HANDLING_POSITIONS]);
    }
  });

  it.each(['ambiguity', 'reader work'])(
    'lets %s peak at Evidence and fall back at Inhabit (a deliberate craft claim)',
    (label) => {
      const levels = levelsInPositionOrder(label);
      const evidence = NARRATIVE_HANDLING_POSITIONS.indexOf('evidence');
      const inhabit = NARRATIVE_HANDLING_POSITIONS.indexOf('inhabit');

      expect(peakPositions(label)).toEqual(['evidence']);
      expect(levels[inhabit]).toBeLessThan(levels[evidence]);
    }
  );

  it('pins the four workup groups, their sub-labels, and their fixed order', () => {
    expect(SHOW_VS_TELL_GROUPS).toEqual([
      { kind: 'told-cleanly', header: 'Told, cleanly', subLabel: 'compress / explain' },
      {
        kind: 'shown-as-evidence',
        header: 'Shown as evidence',
        subLabel: 'observable action & sense'
      },
      {
        kind: 'shown-from-inside',
        header: 'Shown from inside',
        subLabel: "POV-legal — the POV character's read, not another's mind"
      },
      {
        kind: 'mixed',
        header: 'Mixed — tell the bridge, show the fulcrum',
        subLabel: 'the hinge'
      }
    ]);
  });

  it('pins the channels, length budgets, and POV modes with their labels', () => {
    expect(SHOW_VS_TELL_CHANNELS).toEqual([
      { id: 'observable-action', label: 'observable action' },
      { id: 'sensory-evidence', label: 'sensory evidence' },
      { id: 'interiority', label: 'interiority' },
      { id: 'dialogue-subtext', label: 'dialogue / subtext' },
      { id: 'summary-exposition', label: 'summary / exposition' }
    ]);
    expect(SHOW_VS_TELL_LENGTH_BUDGETS).toEqual([
      { id: 'tighter', label: 'tighter' },
      { id: 'same-length', label: 'same length' },
      { id: 'plus-one-sentence', label: '+1 sentence' },
      { id: 'plus-one-paragraph', label: '+1 paragraph' }
    ]);
    expect(SHOW_VS_TELL_POV_MODES).toEqual([
      { id: 'unspecified', label: 'unspecified' },
      { id: 'first', label: 'first' },
      { id: 'close-third', label: 'close third' },
      { id: 'distant-third', label: 'distant third' },
      { id: 'second', label: 'second' },
      { id: 'omniscient', label: 'omniscient' }
    ]);
  });

  it('pins the shipped new-draft defaults', () => {
    expect(SHOW_VS_TELL_DEFAULTS).toEqual({
      position: 'hinge',
      channels: ['observable-action', 'sensory-evidence'],
      lengthBudget: 'same-length',
      pov: { mode: 'unspecified', focalCharacter: '' },
      carryMode: 'direction'
    });
    expect(Object.isFrozen(SHOW_VS_TELL_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(SHOW_VS_TELL_DEFAULTS.channels)).toBe(true);
  });
});
