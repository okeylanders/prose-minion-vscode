import {
  inspectShowVsTellRecommendation,
  SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS,
  SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION,
  SHOW_VS_TELL_RECOMMENDATION_MARKERS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellRecommendation';
import {
  inspectWorkshopWidgetRecommendation,
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

interface RecommendationFields {
  beat: string;
  subject: string;
  contextText: string;
  sourceReferences: string;
  mustSurvive: string;
  mustNotChange: string;
  povMode: string;
  povFocalCharacter: string;
  position: string;
  channels: string;
  lengthBudget: string;
}

const MINIMAL: RecommendationFields = {
  beat: 'She hadn’t trusted him since the funeral.',
  subject: '',
  contextText: '',
  sourceReferences: 'none',
  mustSurvive: '',
  mustNotChange: '',
  povMode: '',
  povFocalCharacter: '',
  position: '',
  channels: '',
  lengthBudget: ''
};

const COMPLETE: RecommendationFields = {
  beat: 'She hadn’t trusted him since the funeral.',
  subject: 'the funeral line',
  contextText: 'He set the mug down.\nShe hadn’t trusted him since the funeral.',
  sourceReferences: 'context-attachment:ctx-2\nactive-excerpt',
  mustSurvive: 'The distrust is old and funeral-rooted.\nIt predates tonight.',
  mustNotChange: 'No flashback; stay in the kitchen.',
  povMode: 'close-third',
  povFocalCharacter: 'Mara',
  position: 'evidence',
  channels: 'interiority\nobservable-action',
  lengthBudget: 'plus-one-sentence'
};

function section(overrides: Partial<RecommendationFields> = {}): string[] {
  const f = { ...MINIMAL, ...overrides };
  return [
    '<workshop-widget-recommendation version="1">',
    '<widget-id>', 'show-vs-tell', '</widget-id>',
    '<told-beat>', f.beat, '</told-beat>',
    '<chip-subject>', f.subject, '</chip-subject>',
    '<surrounding-context>', f.contextText, '</surrounding-context>',
    '<source-references>', f.sourceReferences, '</source-references>',
    '<must-survive>', f.mustSurvive, '</must-survive>',
    '<must-not-change>', f.mustNotChange, '</must-not-change>',
    '<pov-mode>', f.povMode, '</pov-mode>',
    '<pov-focal-character>', f.povFocalCharacter, '</pov-focal-character>',
    '<handling-position>', f.position, '</handling-position>',
    '<emphasis-channels>', f.channels, '</emphasis-channels>',
    '<length-allowance>', f.lengthBudget, '</length-allowance>',
    '</workshop-widget-recommendation>'
  ].join('\n').split('\n');
}

const FROZEN_WHEN_TO_USE = [
  'Show vs. Tell Playground frame:',
  'Use this when one told beat — a stated feeling, a summarized stretch of time, a named state of mind — is a live decision for the writer, and seeing that same fact carried at several distances, from stated outright to fully inhabited, would help them choose. Prepare inputs only: never generate the workup, keep a variant, choose how a variant is carried, write the note, or commit for the writer.'
].join('\n');

const FROZEN_DIAGNOSIS =
  'Diagnose; never deliver a verdict. A told beat is a choice the writer has not made yet, not a flaw. Summary buys time, clarity, and pace; scene buys intimacy, ambiguity, and weight; either can be right for this beat. Before the frame, tell the writer in your own voice what the line buys and what it spends where it stands — for example, that it carries a year in nine words, which serves a beat that is a bridge and starves a beat that is the destination — and offer the comparison as a way to decide. Never call the line weak, lazy, flat, or wrong. Never invoke the slogan "show, don\'t tell", and never imply that showing is the fix, the goal, or the more literary end. Never promise the playground will improve the line: it lays the same fact out at five distances, and the writer decides which, if any, to carry. If the beat already does its job where it sits, say so and do not recommend the widget.';

describe('ShowVsTellRecommendation parser', () => {
  it('accepts the minimal frame and opens every optional suggestion absent', () => {
    const inspected = inspectShowVsTellRecommendation(section());
    expect(inspected).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'show-vs-tell',
        seed: {
          beatText: 'She hadn’t trusted him since the funeral.',
          sourceReferences: []
        }
      }
    });
    const seed = inspected.outcome === 'accepted' && inspected.recommendation.widgetId === 'show-vs-tell'
      ? inspected.recommendation.seed
      : undefined;
    // Must survive is optional (D3): a blank field opens with no declared "same".
    for (const absent of ['subject', 'contextText', 'mustSurvive', 'mustNotChange', 'pov', 'position', 'channels', 'lengthBudget']) {
      expect(seed).not.toHaveProperty(absent);
    }
  });

  it('accepts every optional field and canonicalizes channel and source order', () => {
    expect(inspectShowVsTellRecommendation(section(COMPLETE))).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'show-vs-tell',
        seed: {
          beatText: 'She hadn’t trusted him since the funeral.',
          subject: 'the funeral line',
          contextText: 'He set the mug down.\nShe hadn’t trusted him since the funeral.',
          sourceReferences: [
            { kind: 'active-excerpt' },
            { kind: 'context-attachment', attachmentId: 'ctx-2' }
          ],
          mustSurvive: 'The distrust is old and funeral-rooted.\nIt predates tonight.',
          mustNotChange: 'No flashback; stay in the kitchen.',
          pov: { mode: 'close-third', focalCharacter: 'Mara' },
          position: 'evidence',
          channels: ['observable-action', 'interiority'],
          lengthBudget: 'plus-one-sentence'
        }
      }
    });
  });

  it('treats an explicit unspecified POV like a blank one', () => {
    const inspected = inspectShowVsTellRecommendation(section({ povMode: 'unspecified' }));
    expect(inspected.outcome).toBe('accepted');
    expect(inspected.recommendation).not.toHaveProperty('seed.pov');
  });

  it('accepts a POV mode without a focal character and a context attachment source', () => {
    expect(inspectShowVsTellRecommendation(section({
      povMode: 'omniscient',
      sourceReferences: 'context-attachment:ctx-3'
    }))).toMatchObject({
      outcome: 'accepted',
      recommendation: {
        seed: {
          pov: { mode: 'omniscient', focalCharacter: '' },
          sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-3' }]
        }
      }
    });
  });

  it('accepts up to eight references, in any order, and stores them canonically (D2)', () => {
    const listed = [
      'context-attachment:ctx-10',
      'context-attachment:ctx-3',
      'active-excerpt',
      'context-attachment:ctx-7',
      'context-attachment:ctx-1',
      'context-attachment:ctx-2',
      'context-attachment:ctx-9',
      'context-attachment:ctx-4'
    ];
    expect(listed).toHaveLength(BUDGET.showVsTellSourceReferences);
    expect(inspectShowVsTellRecommendation(section({ sourceReferences: listed.join('\n') })))
      .toMatchObject({
        outcome: 'accepted',
        recommendation: {
          seed: {
            sourceReferences: [
              { kind: 'active-excerpt' },
              { kind: 'context-attachment', attachmentId: 'ctx-1' },
              { kind: 'context-attachment', attachmentId: 'ctx-2' },
              { kind: 'context-attachment', attachmentId: 'ctx-3' },
              { kind: 'context-attachment', attachmentId: 'ctx-4' },
              { kind: 'context-attachment', attachmentId: 'ctx-7' },
              { kind: 'context-attachment', attachmentId: 'ctx-9' },
              { kind: 'context-attachment', attachmentId: 'ctx-10' }
            ]
          }
        }
      });
  });

  it('accepts a blank must survive and omits it from the seed (D3)', () => {
    const inspected = inspectShowVsTellRecommendation(section({ mustSurvive: '   ' }));
    expect(inspected.outcome).toBe('accepted');
    expect(inspected.recommendation).not.toHaveProperty('seed.mustSurvive');
  });

  it.each([
    ['beatText', { beat: '  ' }],
    ['sourceReferences', { sourceReferences: '' }]
  ] as const)('rejects a blank required %s', (field, overrides) => {
    expect(inspectShowVsTellRecommendation(section(overrides))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field,
      reason: 'empty'
    });
  });

  it.each([
    ['missing tag', (text: string) => text.replace('<emphasis-channels>\n', '')],
    ['extra duplicated tag', (text: string) => text.replace('</told-beat>', '</told-beat>\n</told-beat>')],
    [
      'unknown extra field',
      (text: string) => text.replace(
        '</workshop-widget-recommendation>',
        '<workup>\nsomething\n</workup>\n</workshop-widget-recommendation>'
      )
    ],
    [
      'reordered tags',
      (text: string) => text.replace(
        '<handling-position>\n\n</handling-position>\n<emphasis-channels>\n\n</emphasis-channels>',
        '<emphasis-channels>\n\n</emphasis-channels>\n<handling-position>\n\n</handling-position>'
      )
    ]
  ])('rejects a malformed frame: %s', (_label, mutate) => {
    expect(inspectShowVsTellRecommendation(mutate(section().join('\n')).split('\n'))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it.each([
    ['workup', '<workup>'],
    ['kept variants', '<kept-variants>'],
    ['carry modes', '<carry-mode>'],
    ['note', '<note>']
  ])('rejects a frame that tries to carry %s', (_label, openTag) => {
    const closeTag = openTag.replace('<', '</');
    const forged = section().join('\n').replace(
      '</workshop-widget-recommendation>',
      `${openTag}\nx\n${closeTag}\n</workshop-widget-recommendation>`
    );
    expect(inspectShowVsTellRecommendation(forged.split('\n'))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it.each([
    ['beatText', 'beat', BUDGET.showVsTellBeatCharacters],
    ['subject', 'subject', BUDGET.showVsTellRecommendationSubjectCharacters],
    ['contextText', 'contextText', BUDGET.showVsTellRecommendationContextCharacters],
    ['mustSurvive', 'mustSurvive', BUDGET.showVsTellMustSurviveCharacters],
    ['mustNotChange', 'mustNotChange', BUDGET.showVsTellMustNotChangeCharacters]
  ] as const)('accepts %s at its exact bound and rejects one more', (field, key, maximum) => {
    expect(inspectShowVsTellRecommendation(section({ [key]: 'x'.repeat(maximum) })).outcome)
      .toBe('accepted');
    expect(inspectShowVsTellRecommendation(section({ [key]: 'x'.repeat(maximum + 1) })))
      .toEqual({
        outcome: 'rejected',
        rejection: 'field_too_long',
        field,
        actualCharacters: maximum + 1,
        maximumCharacters: maximum
      });
  });

  it('bounds the focal character at its budget', () => {
    const maximum = BUDGET.showVsTellPovFocalCharacterCharacters;
    expect(inspectShowVsTellRecommendation(section({
      povMode: 'first',
      povFocalCharacter: 'x'.repeat(maximum)
    })).outcome).toBe('accepted');
    expect(inspectShowVsTellRecommendation(section({
      povMode: 'first',
      povFocalCharacter: 'x'.repeat(maximum + 1)
    }))).toMatchObject({
      rejection: 'field_too_long',
      field: 'povFocalCharacter',
      maximumCharacters: maximum
    });
  });

  it('bounds the source-reference field at the declared count of references of the declared length', () => {
    const maximum = BUDGET.showVsTellSourceReferences * BUDGET.showVsTellSourceReferenceCharacters;
    expect(inspectShowVsTellRecommendation(section({
      sourceReferences: `context-attachment:ctx-${'9'.repeat(maximum)}`
    }))).toMatchObject({
      rejection: 'field_too_long',
      field: 'sourceReferences',
      maximumCharacters: maximum
    });
  });

  it.each([
    ['beatText', { beat: 'First line.\nSecond line.' }],
    ['subject', { subject: 'the funeral\nline' }],
    ['povFocalCharacter', { povMode: 'first', povFocalCharacter: 'Mara\nJones' }]
  ] as const)('rejects a multi-line %s', (field, overrides) => {
    expect(inspectShowVsTellRecommendation(section(overrides))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field,
      reason: 'multiline'
    });
  });

  it('allows the two invariants to span lines (Q2)', () => {
    expect(inspectShowVsTellRecommendation(section({
      mustSurvive: 'One.\nTwo.',
      mustNotChange: 'Three.\nFour.'
    })).outcome).toBe('accepted');
  });

  it.each([
    ['povMode', { povMode: 'third' }, 'invalid_pov_mode'],
    ['position', { position: 'show-it' }, 'invalid_position'],
    ['channels', { channels: 'observable-action\nmind-reading' }, 'invalid_channels'],
    ['channels', { channels: 'interiority\ninteriority' }, 'invalid_channels'],
    ['channels', { channels: 'interiority\n\ndialogue-subtext' }, 'invalid_channels'],
    ['lengthBudget', { lengthBudget: 'longer' }, 'invalid_length_budget']
  ] as const)('rejects an out-of-vocabulary %s', (field, overrides, reason) => {
    expect(inspectShowVsTellRecommendation(section(overrides))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field,
      reason
    });
  });

  it.each([
    ['blank mode', { povMode: '', povFocalCharacter: 'Mara' }],
    ['unspecified mode', { povMode: 'unspecified', povFocalCharacter: 'Mara' }]
  ])('rejects a focal character set under a %s', (_label, overrides) => {
    expect(inspectShowVsTellRecommendation(section(overrides))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'povFocalCharacter',
      reason: 'invalid_focal_character'
    });
  });

  it.each([
    ['more than eight references', Array.from({ length: 9 }, (_, index) => `context-attachment:ctx-${index + 1}`).join('\n')],
    ['a repeated reference', 'active-excerpt\nactive-excerpt'],
    ['a repeated attachment', 'context-attachment:ctx-2\ncontext-attachment:ctx-2'],
    ['an invented identifier', 'attachment-7'],
    ['a malformed attachment id', 'context-attachment:ctx-0'],
    ['a blank line between references', 'active-excerpt\n\ncontext-attachment:ctx-1'],
    ['none beside a reference', 'none\nactive-excerpt']
  ])('rejects %s', (_label, sourceReferences) => {
    expect(inspectShowVsTellRecommendation(section({ sourceReferences }))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'sourceReferences',
      reason: 'invalid_source_references'
    });
  });

  it('keeps even the fullest frame inside the exact ceiling the registry enforces', () => {
    const fullest = section({
      beat: 'b'.repeat(BUDGET.showVsTellBeatCharacters),
      subject: 's'.repeat(BUDGET.showVsTellRecommendationSubjectCharacters),
      contextText: 'c'.repeat(BUDGET.showVsTellRecommendationContextCharacters),
      // Eight distinct ids, each exactly at the per-reference ceiling.
      sourceReferences: Array.from({ length: BUDGET.showVsTellSourceReferences }, (_, index) => {
        const ordinal = String(index + 1);
        const digits = BUDGET.showVsTellSourceReferenceCharacters - 'ctx-'.length - ordinal.length;
        return `context-attachment:ctx-${ordinal}${'9'.repeat(digits)}`;
      }).join('\n'),
      mustSurvive: 'm'.repeat(BUDGET.showVsTellMustSurviveCharacters),
      mustNotChange: 'n'.repeat(BUDGET.showVsTellMustNotChangeCharacters),
      povMode: 'distant-third',
      povFocalCharacter: 'p'.repeat(BUDGET.showVsTellPovFocalCharacterCharacters),
      position: 'summarize',
      channels: 'observable-action\nsensory-evidence\ninteriority\ndialogue-subtext\nsummary-exposition',
      lengthBudget: 'plus-one-paragraph'
    });
    const characters = fullest.join('\n').length;
    expect(characters).toBeLessThanOrEqual(SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS);
    expect(SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS).toBe(25_700);
    expect(SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS).toBe(
      BUDGET.showVsTellBeatCharacters
      + BUDGET.showVsTellRecommendationSubjectCharacters
      + BUDGET.showVsTellRecommendationContextCharacters
      + BUDGET.showVsTellSourceReferences * BUDGET.showVsTellSourceReferenceCharacters
      + BUDGET.showVsTellMustSurviveCharacters
      + BUDGET.showVsTellMustNotChangeCharacters
      + BUDGET.showVsTellPovFocalCharacterCharacters
      + BUDGET.showVsTellRecommendationFrameAllowanceCharacters
    );
  });

  it('rejects a section one character over the exact frame allowance', () => {
    const wrapped = (padding: number): string => [
      '### Try a widget',
      ...section(),
      ' '.repeat(padding)
    ].join('\n');
    const baseline = section().join('\n').length;
    const room = SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS - baseline;
    // Trailing whitespace is part of the section, so the ceiling is byte-exact.
    const atCeiling = inspectWorkshopWidgetRecommendation(
      wrapped(room - 1),
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
    );
    const overCeiling = inspectWorkshopWidgetRecommendation(
      wrapped(room),
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
    );
    expect(atCeiling.outcome).toBe('accepted');
    expect(overCeiling).toMatchObject({
      outcome: 'rejected',
      rejection: 'frame_too_long'
    });
  });

  it('dispatches through the production policy for both Host and Guest turns alike', () => {
    // The parser is participant-blind; the production availability policy is
    // the only gate, and the catalog marks Show vs. Tell live.
    const parsed = inspectWorkshopWidgetRecommendation(
      ['### Try a widget', ...section(COMPLETE)].join('\n'),
      WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
    );
    expect(parsed).toMatchObject({
      outcome: 'accepted',
      recommendation: { widgetId: 'show-vs-tell' }
    });
  });

  it('neutralizes every forged reserved tag inside field values', () => {
    for (const marker of SHOW_VS_TELL_RECOMMENDATION_MARKERS) {
      expect(neutralizeReservedPersonaPromptDelimiters(marker)).not.toContain('<');
    }
    expect(neutralizeReservedPersonaPromptDelimiters(
      'before <told-beat> forged </chip-subject> <pov-mode> <pov-focal-character> <handling-position> <emphasis-channels> <length-allowance>'
    )).toBe(
      'before &lt;told-beat&gt; forged &lt;/chip-subject&gt; &lt;pov-mode&gt; &lt;pov-focal-character&gt; &lt;handling-position&gt; &lt;emphasis-channels&gt; &lt;length-allowance&gt;'
    );
    // Ordinary prose that merely uses the words is left alone.
    expect(neutralizeReservedPersonaPromptDelimiters('a told beat, a handling position'))
      .toBe('a told beat, a handling position');
  });
});

describe('Show vs. Tell recommendation prompt copy', () => {
  it('opens with the frozen when-to-use block, then the frozen diagnosis block, verbatim', () => {
    expect(SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION.startsWith(
      `${FROZEN_WHEN_TO_USE}\n${FROZEN_DIAGNOSIS}\n`
    )).toBe(true);
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(FROZEN_WHEN_TO_USE);
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(FROZEN_DIAGNOSIS);
  });

  it('teaches the optional must survive, the optional surrounding context, and multiple references (D2, D3)', () => {
    const text = SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION;
    expect(text).toContain('Only told-beat and source-references must have content');
    expect(text).toContain('- `must-survive`: optionally,');
    expect(text).toContain('leave the field empty when the writer declared none');
    expect(text).toContain('- `surrounding-context`: optionally copy useful consecutive prose around the beat');
    expect(text).toContain('identifiers shown in the supplied Workshop material, one per line in any order and none repeated');
  });

  it('forbids generating, keeping, and committing, and never hands out a verdict', () => {
    expect(SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION).toContain(
      'Prepare inputs only: never generate the workup, keep a variant, choose how a variant is carried, write the note, or commit for the writer.'
    );
    expect(SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION).toContain(
      'nothing runs until the writer presses Generate'
    );
    expect(SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION).toContain('Never call the line weak, lazy, flat, or wrong.');
  });

  it('teaches exactly the numbers PROMPT_BUDGETS declares', () => {
    const text = SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION;
    expect(text).toContain(`at most ${BUDGET.showVsTellBeatCharacters} characters`);
    expect(text).toContain(`at most ${BUDGET.showVsTellRecommendationSubjectCharacters} characters`);
    expect(text).toContain(`at most ${BUDGET.showVsTellSourceReferences} exact`);
    expect(text).toContain(`within ${BUDGET.showVsTellRecommendationContextCharacters.toLocaleString('en-US')} characters`);
    expect(text).toContain(`at most ${(BUDGET.showVsTellSourceReferences * BUDGET.showVsTellSourceReferenceCharacters).toLocaleString('en-US')} characters`);
    expect(text).toContain(`within ${BUDGET.showVsTellMustSurviveCharacters} characters`);
    expect(text).toContain(`within ${BUDGET.showVsTellMustNotChangeCharacters} characters`);
    expect(text).toContain(`within ${BUDGET.showVsTellPovFocalCharacterCharacters} characters`);
  });

  it('teaches every closed vocabulary the parser accepts', () => {
    const text = SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION;
    for (const id of [
      'first', 'close-third', 'distant-third', 'second', 'omniscient',
      'state-it', 'summarize', 'hinge', 'evidence', 'inhabit',
      'observable-action', 'sensory-evidence', 'interiority', 'dialogue-subtext', 'summary-exposition',
      'tighter', 'same-length', 'plus-one-sentence', 'plus-one-paragraph'
    ]) {
      expect(text).toContain(`\`${id}\``);
    }
  });

  it('ships an example frame that the real parser accepts', () => {
    const example = SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION
      .split('\n### Try a widget\n')[1]
      .split('\n');
    expect(inspectShowVsTellRecommendation(example)).toMatchObject({
      outcome: 'accepted',
      recommendation: { widgetId: 'show-vs-tell', seed: { sourceReferences: [] } }
    });
    expect(example).toContain('<surrounding-context>');
    expect(example).toContain('[optional: what the beat already carries that every distance must keep, or empty]');
    // The example is also the exact marker list, in order, once each.
    expect(example.filter((line) => (SHOW_VS_TELL_RECOMMENDATION_MARKERS as readonly string[])
      .includes(line))).toEqual([...SHOW_VS_TELL_RECOMMENDATION_MARKERS]);
  });

  it('is composed once into the production recommendation contract', () => {
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.split(
      SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION
    )).toHaveLength(2);
  });
});
