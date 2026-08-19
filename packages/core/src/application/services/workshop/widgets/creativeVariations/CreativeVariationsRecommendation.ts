/** Creative Variations prompt copy and strict persona-prefill parser. */

import {
  WorkshopCreativeVariationsDistance,
  WorkshopCreativeVariationsRequestedCount,
  WorkshopWidgetRecommendation,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
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

const SUBJECT_PASSAGE_START = '<subject-passage>';
const SUBJECT_PASSAGE_END = '</subject-passage>';
const SURROUNDING_CONTEXT_START = '<surrounding-context>';
const SURROUNDING_CONTEXT_END = '</surrounding-context>';
const SOURCE_REFERENCES_START = '<source-references>';
const SOURCE_REFERENCES_END = '</source-references>';
const MUST_SURVIVE_START = '<must-survive>';
const MUST_SURVIVE_END = '</must-survive>';
const MUST_NOT_CHANGE_START = '<must-not-change>';
const MUST_NOT_CHANGE_END = '</must-not-change>';
const CREATIVE_AIM_START = '<creative-aim>';
const CREATIVE_AIM_END = '</creative-aim>';
const SAMPLING_DISTANCE_START = '<sampling-distance>';
const SAMPLING_DISTANCE_END = '</sampling-distance>';
const TAKE_COUNT_START = '<take-count>';
const TAKE_COUNT_END = '</take-count>';

export const CREATIVE_VARIATIONS_RECOMMENDATION_MARKERS = [
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  WIDGET_RECOMMENDATION_ID_END,
  SUBJECT_PASSAGE_START,
  SUBJECT_PASSAGE_END,
  SURROUNDING_CONTEXT_START,
  SURROUNDING_CONTEXT_END,
  SOURCE_REFERENCES_START,
  SOURCE_REFERENCES_END,
  MUST_SURVIVE_START,
  MUST_SURVIVE_END,
  MUST_NOT_CHANGE_START,
  MUST_NOT_CHANGE_END,
  CREATIVE_AIM_START,
  CREATIVE_AIM_END,
  SAMPLING_DISTANCE_START,
  SAMPLING_DISTANCE_END,
  TAKE_COUNT_START,
  TAKE_COUNT_END,
  WIDGET_RECOMMENDATION_FRAME_END
] as const;

type CreativeVariationsRecommendation = Extract<
  WorkshopWidgetRecommendation,
  { widgetId: 'creative-variations' }
>;

export type CreativeVariationsRecommendationField =
  | 'subjectText'
  | 'contextText'
  | 'sourceReferences'
  | 'mustSurvive'
  | 'mustNotChange'
  | 'aim'
  | 'distance'
  | 'requestedCount';

export type CreativeVariationsRecommendationInvalidFieldReason =
  | 'empty'
  | 'invalid_source_references'
  | 'invalid_distance'
  | 'invalid_requested_count';

export type CreativeVariationsRecommendationInspection =
  WorkshopWidgetRecommendationInspection<
    CreativeVariationsRecommendation,
    CreativeVariationsRecommendationField,
    CreativeVariationsRecommendationInvalidFieldReason
  >;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
export const CREATIVE_VARIATIONS_RECOMMENDATION_FRAME_CHARACTERS =
  BUDGET.creativeSubjectCharacters
  + BUDGET.creativeRecommendationContextCharacters
  + BUDGET.creativeSourceReferences * BUDGET.creativeSourceReferenceCharacters
  + BUDGET.creativeMustSurviveCharacters
  + BUDGET.creativeMustNotChangeCharacters
  + BUDGET.creativeAimCharacters
  + BUDGET.creativeRecommendationFrameAllowanceCharacters;
const DISTANCES: readonly WorkshopCreativeVariationsDistance[] = [
  'familiar',
  'adjacent',
  'tail',
  'far-tail'
];
const COUNTS: readonly WorkshopCreativeVariationsRequestedCount[] = [3, 4, 5];

export const CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION = [
  'Creative Variations Explorer frame:',
  'Use this when a passage would benefit from three to five genuinely different takes under writer-editable constraints. Prepare inputs only: never generate the workup, choose a take, accept a risk, or commit for the writer.',
  `- \`subject-passage\`: copy the exact passage to vary from material the writer supplied. Never paraphrase or invent it. This is the only required authoring input and may contain at most ${BUDGET.creativeSubjectCharacters.toLocaleString('en-US')} characters.`,
  `- \`surrounding-context\`: optionally copy useful consecutive prose before or after the subject, without summary or invention, within ${BUDGET.creativeRecommendationContextCharacters.toLocaleString('en-US')} characters. Leave the field empty when none should travel.`,
  `- \`source-references\`: use \`active-excerpt\` and/or exact \`context-attachment:ctx-N\` identifiers shown in the supplied Workshop material when generation should read those sources. Use \`none\` when no source should ride. Never invent an identifier; the complete field may contain at most ${BUDGET.creativeSourceReferences} references and ${(BUDGET.creativeSourceReferences * BUDGET.creativeSourceReferenceCharacters).toLocaleString('en-US')} characters.`,
  `- \`must-survive\`: optionally name supplied facts, character state, emotional truth, or effect every take must preserve, within ${BUDGET.creativeMustSurviveCharacters.toLocaleString('en-US')} characters. Do not infer a constraint merely because it seems prudent; leave the field empty when the writer declared none.`,
  `- \`must-not-change\`: optionally name hard boundaries such as POV, tense, plot outcome, or exact dialogue, within ${BUDGET.creativeMustNotChangeCharacters.toLocaleString('en-US')} characters. Keep this distinct from must-survive and leave it empty when the writer declared none.`,
  `- \`creative-aim\`: optionally state one open creative pressure within ${BUDGET.creativeAimCharacters.toLocaleString('en-US')} characters. Leave it empty for random generation; do not write \`Generate at random.\` into the field.`,
  '- `sampling-distance`: exactly one of `familiar`, `adjacent`, `tail`, or `far-tail`. Use `tail` when the writer did not request another distance.',
  '- `take-count`: exactly `3`, `4`, or `5`.',
  'Every tag is required. Only subject-passage, source-references, sampling-distance, and take-count must have content; optional prose fields may be empty. Everything remains editable and nothing runs until the writer presses Generate. Do not explain widget mechanics in prose—the chip and prefilled form do that.',
  '### Try a widget',
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  'creative-variations',
  WIDGET_RECOMMENDATION_ID_END,
  SUBJECT_PASSAGE_START,
  '[exact passage from supplied material]',
  SUBJECT_PASSAGE_END,
  SURROUNDING_CONTEXT_START,
  '[optional exact surrounding prose, or empty]',
  SURROUNDING_CONTEXT_END,
  SOURCE_REFERENCES_START,
  '[none, or one exact active-excerpt/context-attachment:ctx-N identifier per line]',
  SOURCE_REFERENCES_END,
  MUST_SURVIVE_START,
  '[optional declared preservation constraint, or empty]',
  MUST_SURVIVE_END,
  MUST_NOT_CHANGE_START,
  '[optional declared hard boundary, or empty]',
  MUST_NOT_CHANGE_END,
  CREATIVE_AIM_START,
  '[optional open aim, or empty for random generation]',
  CREATIVE_AIM_END,
  SAMPLING_DISTANCE_START,
  'tail',
  SAMPLING_DISTANCE_END,
  TAKE_COUNT_START,
  '3',
  TAKE_COUNT_END,
  WIDGET_RECOMMENDATION_FRAME_END
].join('\n');

export function inspectCreativeVariationsRecommendation(
  sectionLines: readonly string[]
): CreativeVariationsRecommendationInspection {
  const inspected = inspectExactWorkshopWidgetRecommendationFrame(
    sectionLines,
    CREATIVE_VARIATIONS_RECOMMENDATION_MARKERS
  );
  if (!(inspected instanceof Map)) {
    return inspected;
  }

  const field = (start: string, end: string): string =>
    workshopWidgetRecommendationField(sectionLines, inspected, start, end);
  const subjectText = field(SUBJECT_PASSAGE_START, SUBJECT_PASSAGE_END);
  const contextText = field(SURROUNDING_CONTEXT_START, SURROUNDING_CONTEXT_END);
  const sourceReferenceText = field(SOURCE_REFERENCES_START, SOURCE_REFERENCES_END);
  const mustSurvive = field(MUST_SURVIVE_START, MUST_SURVIVE_END);
  const mustNotChange = field(MUST_NOT_CHANGE_START, MUST_NOT_CHANGE_END);
  const aim = field(CREATIVE_AIM_START, CREATIVE_AIM_END);
  const distanceText = field(SAMPLING_DISTANCE_START, SAMPLING_DISTANCE_END);
  const requestedCountText = field(TAKE_COUNT_START, TAKE_COUNT_END);

  const requiredFields = [
    { field: 'subjectText' as const, value: subjectText },
    { field: 'sourceReferences' as const, value: sourceReferenceText },
    { field: 'distance' as const, value: distanceText },
    { field: 'requestedCount' as const, value: requestedCountText }
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
    field: CreativeVariationsRecommendationField;
    value: string;
    maximum: number;
  }> = [
    { field: 'subjectText', value: subjectText, maximum: BUDGET.creativeSubjectCharacters },
    {
      field: 'contextText',
      value: contextText,
      maximum: BUDGET.creativeRecommendationContextCharacters
    },
    {
      field: 'sourceReferences',
      value: sourceReferenceText,
      maximum: BUDGET.creativeSourceReferences * BUDGET.creativeSourceReferenceCharacters
    },
    {
      field: 'mustSurvive',
      value: mustSurvive,
      maximum: BUDGET.creativeMustSurviveCharacters
    },
    {
      field: 'mustNotChange',
      value: mustNotChange,
      maximum: BUDGET.creativeMustNotChangeCharacters
    },
    { field: 'aim', value: aim, maximum: BUDGET.creativeAimCharacters }
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

  const sourceReferences = parseSourceReferences(sourceReferenceText);
  if (!sourceReferences) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'sourceReferences',
      reason: 'invalid_source_references'
    };
  }
  if (!DISTANCES.includes(distanceText as WorkshopCreativeVariationsDistance)) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'distance',
      reason: 'invalid_distance'
    };
  }
  const requestedCount = Number(requestedCountText);
  if (!COUNTS.includes(requestedCount as WorkshopCreativeVariationsRequestedCount)) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'requestedCount',
      reason: 'invalid_requested_count'
    };
  }

  return {
    outcome: 'accepted',
    recommendation: {
      widgetId: 'creative-variations',
      seed: {
        subjectText,
        contextText,
        sourceReferences,
        mustSurvive,
        mustNotChange,
        aim,
        distance: distanceText as WorkshopCreativeVariationsDistance,
        requestedCount: requestedCount as WorkshopCreativeVariationsRequestedCount
      }
    }
  };
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
  if (lines.includes('none') || lines.length > BUDGET.creativeSourceReferences) {
    return undefined;
  }

  const seen = new Set<string>();
  const references: WorkshopWidgetSourceReference[] = [];
  for (const line of lines) {
    if (seen.has(line)) {
      return undefined;
    }
    seen.add(line);
    if (line === 'active-excerpt') {
      references.push({ kind: 'active-excerpt' });
      continue;
    }
    const match = CONTEXT_ATTACHMENT_REFERENCE.exec(line);
    if (!match || match[1].length > BUDGET.creativeSourceReferenceCharacters) {
      return undefined;
    }
    references.push({ kind: 'context-attachment', attachmentId: match[1] });
  }
  return references;
}

export const CREATIVE_VARIATIONS_WIDGET_RECOMMENDATION_ENTRY:
  WorkshopWidgetRecommendationEntry<
    CreativeVariationsRecommendation,
    CreativeVariationsRecommendationField,
    CreativeVariationsRecommendationInvalidFieldReason
  > = Object.freeze({
    widgetId: 'creative-variations',
    catalogSummary:
      'Creative Variations Explorer compares three to five writer-controlled takes on one passage under explicitly declared constraints',
    catalogOrder: 2,
    instructionOrder: 2,
    instruction: CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION,
    reservedMarkers: CREATIVE_VARIATIONS_RECOMMENDATION_MARKERS,
    frameCharacters: CREATIVE_VARIATIONS_RECOMMENDATION_FRAME_CHARACTERS,
    inspect: inspectCreativeVariationsRecommendation
  });
