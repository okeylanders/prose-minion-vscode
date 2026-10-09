/** Show vs. Tell prompt copy and strict persona-prefill parser. */

import {
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellLengthBudget,
  WorkshopShowVsTellPovMode,
  WorkshopWidgetRecommendation,
  WorkshopWidgetSourceReference
} from '@messages';
import {
  NARRATIVE_HANDLING_POSITIONS,
  NarrativeHandlingPosition
} from '@shared/constants/narrativeHandlingVocabulary';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_LENGTH_BUDGETS,
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  inspectExactWorkshopWidgetRecommendationFrame,
  WorkshopWidgetRecommendationEntry,
  WorkshopWidgetRecommendationInspection,
  workshopWidgetRecommendationField,
  WIDGET_RECOMMENDATION_FRAME_END,
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_END,
  WIDGET_RECOMMENDATION_ID_START
} from '@/utils/workshopWidgetRecommendationProtocol';

// Tag names are distinct from the draft's generic words so a forged tag in a
// field value can be neutralized without catching ordinary prose
// (see RESERVED_PERSONA_FRAME in utils/workshopPromptFrames.ts).
const TOLD_BEAT_START = '<told-beat>';
const TOLD_BEAT_END = '</told-beat>';
const CHIP_SUBJECT_START = '<chip-subject>';
const CHIP_SUBJECT_END = '</chip-subject>';
const SOURCE_REFERENCES_START = '<source-references>';
const SOURCE_REFERENCES_END = '</source-references>';
const MUST_SURVIVE_START = '<must-survive>';
const MUST_SURVIVE_END = '</must-survive>';
const MUST_NOT_CHANGE_START = '<must-not-change>';
const MUST_NOT_CHANGE_END = '</must-not-change>';
const POV_MODE_START = '<pov-mode>';
const POV_MODE_END = '</pov-mode>';
const POV_FOCAL_CHARACTER_START = '<pov-focal-character>';
const POV_FOCAL_CHARACTER_END = '</pov-focal-character>';
const HANDLING_POSITION_START = '<handling-position>';
const HANDLING_POSITION_END = '</handling-position>';
const EMPHASIS_CHANNELS_START = '<emphasis-channels>';
const EMPHASIS_CHANNELS_END = '</emphasis-channels>';
const LENGTH_ALLOWANCE_START = '<length-allowance>';
const LENGTH_ALLOWANCE_END = '</length-allowance>';

export const SHOW_VS_TELL_RECOMMENDATION_MARKERS = [
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  WIDGET_RECOMMENDATION_ID_END,
  TOLD_BEAT_START,
  TOLD_BEAT_END,
  CHIP_SUBJECT_START,
  CHIP_SUBJECT_END,
  SOURCE_REFERENCES_START,
  SOURCE_REFERENCES_END,
  MUST_SURVIVE_START,
  MUST_SURVIVE_END,
  MUST_NOT_CHANGE_START,
  MUST_NOT_CHANGE_END,
  POV_MODE_START,
  POV_MODE_END,
  POV_FOCAL_CHARACTER_START,
  POV_FOCAL_CHARACTER_END,
  HANDLING_POSITION_START,
  HANDLING_POSITION_END,
  EMPHASIS_CHANNELS_START,
  EMPHASIS_CHANNELS_END,
  LENGTH_ALLOWANCE_START,
  LENGTH_ALLOWANCE_END,
  WIDGET_RECOMMENDATION_FRAME_END
] as const;

type ShowVsTellRecommendation = Extract<
  WorkshopWidgetRecommendation,
  { widgetId: 'show-vs-tell' }
>;

export type ShowVsTellRecommendationField =
  | 'beatText'
  | 'subject'
  | 'sourceReferences'
  | 'mustSurvive'
  | 'mustNotChange'
  | 'povMode'
  | 'povFocalCharacter'
  | 'position'
  | 'channels'
  | 'lengthBudget';

export type ShowVsTellRecommendationInvalidFieldReason =
  | 'empty'
  | 'multiline'
  | 'invalid_source_references'
  | 'invalid_pov_mode'
  | 'invalid_focal_character'
  | 'invalid_position'
  | 'invalid_channels'
  | 'invalid_length_budget';

export type ShowVsTellRecommendationInspection =
  WorkshopWidgetRecommendationInspection<
    ShowVsTellRecommendation,
    ShowVsTellRecommendationField,
    ShowVsTellRecommendationInvalidFieldReason
  >;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
export const SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS =
  BUDGET.showVsTellBeatCharacters
  + BUDGET.showVsTellRecommendationSubjectCharacters
  + BUDGET.showVsTellSourceReferences * BUDGET.showVsTellSourceReferenceCharacters
  + BUDGET.showVsTellMustSurviveCharacters
  + BUDGET.showVsTellMustNotChangeCharacters
  + BUDGET.showVsTellPovFocalCharacterCharacters
  + BUDGET.showVsTellRecommendationFrameAllowanceCharacters;

const POV_MODE_IDS: readonly string[] = SHOW_VS_TELL_POV_MODES.map(({ id }) => id);
const CHANNEL_IDS: readonly WorkshopShowVsTellChannel[] =
  SHOW_VS_TELL_CHANNELS.map(({ id }) => id);
const LENGTH_BUDGET_IDS: readonly string[] = SHOW_VS_TELL_LENGTH_BUDGETS.map(({ id }) => id);
const LINE_BREAK = /[\r\n\u2028\u2029]/;

/**
 * Frozen copy (Sprint 05, Slice 5): "when to use it" and "diagnosis, not
 * verdict". Do not edit these sentences in passing; a conflict with the frame
 * mechanics is a contract question, not a quiet rewrite.
 */
export const SHOW_VS_TELL_WHEN_TO_USE_COPY = [
  'Show vs. Tell Playground frame:',
  'Use this when one told beat — a stated feeling, a summarized stretch of time, a named state of mind — is a live decision for the writer, and seeing that same fact carried at several distances, from stated outright to fully inhabited, would help them choose. Prepare inputs only: never generate the workup, keep a variant, choose how a variant is carried, write the note, or commit for the writer.'
].join('\n');

export const SHOW_VS_TELL_DIAGNOSIS_COPY =
  'Diagnose; never deliver a verdict. A told beat is a choice the writer has not made yet, not a flaw. Summary buys time, clarity, and pace; scene buys intimacy, ambiguity, and weight; either can be right for this beat. Before the frame, tell the writer in your own voice what the line buys and what it spends where it stands — for example, that it carries a year in nine words, which serves a beat that is a bridge and starves a beat that is the destination — and offer the comparison as a way to decide. Never call the line weak, lazy, flat, or wrong. Never invoke the slogan "show, don\'t tell", and never imply that showing is the fix, the goal, or the more literary end. Never promise the playground will improve the line: it lays the same fact out at five distances, and the writer decides which, if any, to carry. If the beat already does its job where it sits, say so and do not recommend the widget.';

export const SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION = [
  SHOW_VS_TELL_WHEN_TO_USE_COPY,
  SHOW_VS_TELL_DIAGNOSIS_COPY,
  `- \`told-beat\`: copy exactly one told beat from material the writer supplied: a single line of at most ${BUDGET.showVsTellBeatCharacters} characters. Never paraphrase, trim it mid-sentence, or invent it.`,
  `- \`chip-subject\`: optionally, a short label for the chip, at most ${BUDGET.showVsTellRecommendationSubjectCharacters} characters on one line, naming the beat the way you would to the writer (for example \`the funeral line\`). It is shown, never sent to generation. Leave it empty when no label helps.`,
  `- \`source-references\`: \`none\`, or at most ${BUDGET.showVsTellSourceReferences} exact \`active-excerpt\` or \`context-attachment:ctx-N\` identifier shown in the supplied Workshop material, when generation should read that passage for POV and meaning. Never invent an identifier.`,
  `- \`must-survive\`: the fact, feeling, or turn the beat already carries, which every distance must keep (for example \`the distrust is old and funeral-rooted\`), within ${BUDGET.showVsTellMustSurviveCharacters} characters. Take it from the beat and the writer's words, and add no new story.`,
  `- \`must-not-change\`: optionally, a hard boundary the writer actually declared, within ${BUDGET.showVsTellMustNotChangeCharacters} characters. Leave it empty otherwise.`,
  `- \`pov-mode\`: the POV mode the passage already uses, exactly one of ${SHOW_VS_TELL_POV_MODES
    .filter(({ id }) => id !== 'unspecified')
    .map(({ id }) => `\`${id}\``)
    .join(', ')}. Use \`unspecified\` when the material does not settle it.`,
  `- \`pov-focal-character\`: the focal character's name on one line, within ${BUDGET.showVsTellPovFocalCharacterCharacters} characters, only when the material makes it clear and the mode is not \`unspecified\`. Never guess a name; otherwise leave it empty.`,
  `- \`handling-position\`: optionally, where the panel opens, exactly one of ${NARRATIVE_HANDLING_POSITIONS
    .map((id) => `\`${id}\``)
    .join(', ')}. Suggest it only when the writer has said which way they lean; a suggested position is where the panel opens, never the answer. Otherwise leave it empty.`,
  `- \`emphasis-channels\`: optionally, one channel per line from ${SHOW_VS_TELL_CHANNELS
    .map(({ id }) => `\`${id}\``)
    .join(', ')}. Suggest them only when the writer has said which way they lean; otherwise leave the field empty and the playground opens on its defaults.`,
  `- \`length-allowance\`: optionally, exactly one of ${SHOW_VS_TELL_LENGTH_BUDGETS
    .map(({ id }) => `\`${id}\``)
    .join(', ')}. Suggest it only when the writer has said how long the beat may grow; otherwise leave it empty.`,
  'Every tag is required. Only told-beat, source-references, and must-survive must have content; every other field may be empty. Everything remains editable and nothing runs until the writer presses Generate. Do not explain widget mechanics in prose—the chip and prefilled form do that.',
  '### Try a widget',
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  'show-vs-tell',
  WIDGET_RECOMMENDATION_ID_END,
  TOLD_BEAT_START,
  '[exact told beat from supplied material, one line]',
  TOLD_BEAT_END,
  CHIP_SUBJECT_START,
  '[short chip label, or empty]',
  CHIP_SUBJECT_END,
  SOURCE_REFERENCES_START,
  'none',
  SOURCE_REFERENCES_END,
  MUST_SURVIVE_START,
  '[what the beat already carries that every distance must keep]',
  MUST_SURVIVE_END,
  MUST_NOT_CHANGE_START,
  '[optional declared hard boundary, or empty]',
  MUST_NOT_CHANGE_END,
  POV_MODE_START,
  'unspecified',
  POV_MODE_END,
  POV_FOCAL_CHARACTER_START,
  POV_FOCAL_CHARACTER_END,
  HANDLING_POSITION_START,
  HANDLING_POSITION_END,
  EMPHASIS_CHANNELS_START,
  EMPHASIS_CHANNELS_END,
  LENGTH_ALLOWANCE_START,
  LENGTH_ALLOWANCE_END,
  WIDGET_RECOMMENDATION_FRAME_END
].join('\n');

export function inspectShowVsTellRecommendation(
  sectionLines: readonly string[]
): ShowVsTellRecommendationInspection {
  const inspected = inspectExactWorkshopWidgetRecommendationFrame(
    sectionLines,
    SHOW_VS_TELL_RECOMMENDATION_MARKERS
  );
  if (!(inspected instanceof Map)) {
    return inspected;
  }

  const field = (start: string, end: string): string =>
    workshopWidgetRecommendationField(sectionLines, inspected, start, end);
  const beatText = field(TOLD_BEAT_START, TOLD_BEAT_END);
  const subject = field(CHIP_SUBJECT_START, CHIP_SUBJECT_END);
  const sourceReferenceText = field(SOURCE_REFERENCES_START, SOURCE_REFERENCES_END);
  const mustSurvive = field(MUST_SURVIVE_START, MUST_SURVIVE_END);
  const mustNotChange = field(MUST_NOT_CHANGE_START, MUST_NOT_CHANGE_END);
  const povModeText = field(POV_MODE_START, POV_MODE_END);
  const povFocalCharacter = field(POV_FOCAL_CHARACTER_START, POV_FOCAL_CHARACTER_END);
  const positionText = field(HANDLING_POSITION_START, HANDLING_POSITION_END);
  const channelsText = field(EMPHASIS_CHANNELS_START, EMPHASIS_CHANNELS_END);
  const lengthBudgetText = field(LENGTH_ALLOWANCE_START, LENGTH_ALLOWANCE_END);

  const requiredFields = [
    { field: 'beatText' as const, value: beatText },
    { field: 'sourceReferences' as const, value: sourceReferenceText },
    { field: 'mustSurvive' as const, value: mustSurvive }
  ];
  const emptyField = requiredFields.find(({ value }) => value.length === 0);
  if (emptyField) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: emptyField.field,
      reason: 'empty'
    };
  }

  const boundedFields: Array<{
    field: ShowVsTellRecommendationField;
    value: string;
    maximum: number;
  }> = [
    { field: 'beatText', value: beatText, maximum: BUDGET.showVsTellBeatCharacters },
    {
      field: 'subject',
      value: subject,
      maximum: BUDGET.showVsTellRecommendationSubjectCharacters
    },
    {
      field: 'sourceReferences',
      value: sourceReferenceText,
      maximum: BUDGET.showVsTellSourceReferences * BUDGET.showVsTellSourceReferenceCharacters
    },
    { field: 'mustSurvive', value: mustSurvive, maximum: BUDGET.showVsTellMustSurviveCharacters },
    {
      field: 'mustNotChange',
      value: mustNotChange,
      maximum: BUDGET.showVsTellMustNotChangeCharacters
    },
    {
      field: 'povFocalCharacter',
      value: povFocalCharacter,
      maximum: BUDGET.showVsTellPovFocalCharacterCharacters
    }
  ];
  const overlongField = boundedFields.find(({ value, maximum }) => value.length > maximum);
  if (overlongField) {
    return {
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: overlongField.field,
      actualCharacters: overlongField.value.length,
      maximumCharacters: overlongField.maximum
    };
  }

  // The beat, the chip label, and the focal character are single-line fields.
  // The invariants may span lines (Q2), so they are not checked here.
  const multilineField = [
    { field: 'beatText' as const, value: beatText },
    { field: 'subject' as const, value: subject },
    { field: 'povFocalCharacter' as const, value: povFocalCharacter }
  ].find(({ value }) => LINE_BREAK.test(value));
  if (multilineField) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: multilineField.field,
      reason: 'multiline'
    };
  }

  const sourceReferences = parseSourceReferences(sourceReferenceText);
  if (!sourceReferences) {
    return invalidField('sourceReferences', 'invalid_source_references');
  }

  // A blank mode and `unspecified` mean the same thing: no POV suggestion.
  if (povModeText.length > 0 && !POV_MODE_IDS.includes(povModeText)) {
    return invalidField('povMode', 'invalid_pov_mode');
  }
  const povMode = (povModeText || 'unspecified') as WorkshopShowVsTellPovMode;
  if (povMode === 'unspecified' && povFocalCharacter.length > 0) {
    return invalidField('povFocalCharacter', 'invalid_focal_character');
  }

  if (
    positionText.length > 0
    && !(NARRATIVE_HANDLING_POSITIONS as readonly string[]).includes(positionText)
  ) {
    return invalidField('position', 'invalid_position');
  }
  const channels = parseChannels(channelsText);
  if (!channels) {
    return invalidField('channels', 'invalid_channels');
  }
  if (lengthBudgetText.length > 0 && !LENGTH_BUDGET_IDS.includes(lengthBudgetText)) {
    return invalidField('lengthBudget', 'invalid_length_budget');
  }

  return {
    outcome: 'accepted',
    recommendation: {
      widgetId: 'show-vs-tell',
      seed: {
        beatText,
        ...(subject ? { subject } : {}),
        sourceReferences,
        mustSurvive,
        ...(mustNotChange ? { mustNotChange } : {}),
        ...(povMode !== 'unspecified'
          ? { pov: { mode: povMode, focalCharacter: povFocalCharacter } }
          : {}),
        ...(positionText
          ? { position: positionText as NarrativeHandlingPosition }
          : {}),
        ...(channels.length > 0 ? { channels } : {}),
        ...(lengthBudgetText
          ? { lengthBudget: lengthBudgetText as WorkshopShowVsTellLengthBudget }
          : {})
      }
    }
  };
}

function invalidField(
  field: ShowVsTellRecommendationField,
  reason: ShowVsTellRecommendationInvalidFieldReason
): ShowVsTellRecommendationInspection {
  return { outcome: 'rejected', rejection: 'invalid_field', field, reason };
}

const CONTEXT_ATTACHMENT_REFERENCE = /^context-attachment:(ctx-[1-9]\d*)$/;

function parseSourceReferences(value: string): WorkshopWidgetSourceReference[] | undefined {
  const lines = value.split('\n').map((line) => line.trim());
  if (lines.some((line) => line.length === 0)) {
    return undefined;
  }
  if (lines.length === 1 && lines[0] === 'none') {
    return [];
  }
  if (lines.includes('none') || lines.length > BUDGET.showVsTellSourceReferences) {
    return undefined;
  }

  const references: WorkshopWidgetSourceReference[] = [];
  for (const line of lines) {
    if (line === 'active-excerpt') {
      references.push({ kind: 'active-excerpt' });
      continue;
    }
    const match = CONTEXT_ATTACHMENT_REFERENCE.exec(line);
    if (!match || match[1].length > BUDGET.showVsTellSourceReferenceCharacters) {
      return undefined;
    }
    references.push({ kind: 'context-attachment', attachmentId: match[1] });
  }
  return references;
}

/** Empty means "no suggestion"; otherwise known, unrepeated ids in the fixed channel order. */
function parseChannels(value: string): WorkshopShowVsTellChannel[] | undefined {
  if (value.length === 0) {
    return [];
  }
  const lines = value.split('\n').map((line) => line.trim());
  const named = new Set<string>();
  for (const line of lines) {
    if (!(CHANNEL_IDS as readonly string[]).includes(line) || named.has(line)) {
      return undefined;
    }
    named.add(line);
  }
  return CHANNEL_IDS.filter((id) => named.has(id));
}

export const SHOW_VS_TELL_WIDGET_RECOMMENDATION_ENTRY:
  WorkshopWidgetRecommendationEntry<
    ShowVsTellRecommendation,
    ShowVsTellRecommendationField,
    ShowVsTellRecommendationInvalidFieldReason
  > = Object.freeze({
    widgetId: 'show-vs-tell',
    catalogSummary:
      'Show vs. Tell Playground lays one told beat out at five distances, from stated outright to fully inhabited, so the writer can see what each distance buys and spends',
    catalogOrder: 3,
    instructionOrder: 3,
    instruction: SHOW_VS_TELL_RECOMMENDATION_INSTRUCTION,
    reservedMarkers: SHOW_VS_TELL_RECOMMENDATION_MARKERS,
    frameCharacters: SHOW_VS_TELL_RECOMMENDATION_FRAME_CHARACTERS,
    inspect: inspectShowVsTellRecommendation
  });
