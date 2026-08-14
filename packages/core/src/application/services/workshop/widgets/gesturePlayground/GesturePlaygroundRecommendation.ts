/** Gesture Playground prompt copy and strict recommendation-field parser. */

import {
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

const TARGET_PHRASE_START = '<target-phrase>';
const TARGET_PHRASE_END = '</target-phrase>';
const WRITER_INSTRUCTIONS_START = '<writer-instructions>';
const WRITER_INSTRUCTIONS_END = '</writer-instructions>';
const SURROUNDING_CONTEXT_START = '<surrounding-context>';
const SURROUNDING_CONTEXT_END = '</surrounding-context>';
const SOURCE_REFERENCES_START = '<source-references>';
const SOURCE_REFERENCES_END = '</source-references>';
const CHARACTER_NOTES_START = '<character-notes>';
const CHARACTER_NOTES_END = '</character-notes>';

export const GESTURE_PLAYGROUND_RECOMMENDATION_MARKERS = [
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  WIDGET_RECOMMENDATION_ID_END,
  TARGET_PHRASE_START,
  TARGET_PHRASE_END,
  WRITER_INSTRUCTIONS_START,
  WRITER_INSTRUCTIONS_END,
  SURROUNDING_CONTEXT_START,
  SURROUNDING_CONTEXT_END,
  SOURCE_REFERENCES_START,
  SOURCE_REFERENCES_END,
  CHARACTER_NOTES_START,
  CHARACTER_NOTES_END,
  WIDGET_RECOMMENDATION_FRAME_END
] as const;

type GesturePlaygroundRecommendation = Extract<
  WorkshopWidgetRecommendation,
  { widgetId: 'gesture-playground' }
>;

export type GesturePlaygroundRecommendationField =
  | 'targetPhrase'
  | 'writerInstructions'
  | 'contextText'
  | 'sourceReferences'
  | 'characterNotes';

export type GesturePlaygroundRecommendationInvalidFieldReason =
  | 'empty'
  | 'target_missing_from_context'
  | 'invalid_source_references';

export type GesturePlaygroundRecommendationInspection =
  WorkshopWidgetRecommendationInspection<
    GesturePlaygroundRecommendation,
    GesturePlaygroundRecommendationField,
    GesturePlaygroundRecommendationInvalidFieldReason
  >;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export const GESTURE_PLAYGROUND_RECOMMENDATION_FRAME_CHARACTERS =
  BUDGET.gestureTargetPhraseCharacters
  + BUDGET.gestureWriterInstructionsCharacters
  + BUDGET.gestureContextCharacters
  + BUDGET.gestureCharacterNotesCharacters
  + BUDGET.gestureSourceReferenceCharacters
  + BUDGET.gestureRecommendationFrameAllowanceCharacters;

export const GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION = [
  'Gesture Playground frame:',
  'This is a quality-first handoff, not a token-saving exercise. Do not be thrifty, terse, or generically minimal in the prefill fields. Supply enough grounded material that the dictionary model can understand the dramatic problem without reconstructing it from scraps. Source references save duplicate transcription; they are not permission to thin out the creative direction or character thinking:',
  `- \`target-phrase\`: copy the exact phrase from the supplied passage, without quotation marks or paraphrase. Maximum ${BUDGET.gestureTargetPhraseCharacters.toLocaleString('en-US')} characters.`,
  `- \`writer-instructions\`: give substantive, specific direction explaining the beat's dramatic job, what an alternative must preserve, what to avoid, and which creative territory is worth exploring. Be complete but stay within ${BUDGET.gestureWriterInstructionsCharacters.toLocaleString('en-US')} characters.`,
  `- \`surrounding-context\`: copy a generous, consecutive stretch of the supplied prose around the phrase—normally the full relevant beat and useful paragraphs before and after—within ${BUDGET.gestureContextCharacters.toLocaleString('en-US')} characters. When a source reference below carries the full excerpt or attachment, include enough exact consecutive local prose to locate the beat without pointlessly copying the whole referenced source. Preserve source wording; never summarize, pad, or invent passage text.`,
  `- \`source-references\`: use \`active-excerpt\` and/or exact \`context-attachment:ctx-N\` reference identifiers shown in the supplied Workshop material when the dictionary model would benefit from reading those sources in full. Use \`none\` when no source should ride. Never invent an identifier. The complete field may contain at most ${BUDGET.gestureSourceReferences} references and ${BUDGET.gestureSourceReferenceCharacters.toLocaleString('en-US')} characters.`,
  `- \`character-notes\`: give grounded sentences about who this person is in this beat: immediate pressure, intention or defense, relationship dynamics, self-control, physical habits or constraints, and relevant voice/history. Distinguish supplied facts from reasonable scene inference; never invent project facts. Be complete but stay within ${BUDGET.gestureCharacterNotesCharacters.toLocaleString('en-US')} characters.`,
  'The four prose fields and the source-references field are required when you recommend the widget. If the supplied material cannot support them honestly, omit a discretionary recommendation; for an explicit writer request, say what material is missing instead of fabricating a frame or merely acknowledging the request. Everything remains editable and nothing runs until the writer chooses it. Do not explain widget mechanics in prose—the chip and prefilled form do that.',
  '### Try a widget',
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  'gesture-playground',
  WIDGET_RECOMMENDATION_ID_END,
  TARGET_PHRASE_START,
  '[exact phrase from the supplied passage]',
  TARGET_PHRASE_END,
  WRITER_INSTRUCTIONS_START,
  '[substantial, scene-specific creative direction]',
  WRITER_INSTRUCTIONS_END,
  SURROUNDING_CONTEXT_START,
  '[generous consecutive source prose around the phrase]',
  SURROUNDING_CONTEXT_END,
  SOURCE_REFERENCES_START,
  '[none, or one exact active-excerpt/context-attachment:ctx-N identifier per line]',
  SOURCE_REFERENCES_END,
  CHARACTER_NOTES_START,
  '[substantial, evidence-grounded character notes for this beat]',
  CHARACTER_NOTES_END,
  WIDGET_RECOMMENDATION_FRAME_END
].join('\n');

export function inspectGesturePlaygroundRecommendation(
  sectionLines: readonly string[]
): GesturePlaygroundRecommendationInspection {
  const inspected = inspectExactWorkshopWidgetRecommendationFrame(
    sectionLines,
    GESTURE_PLAYGROUND_RECOMMENDATION_MARKERS
  );
  if (!(inspected instanceof Map)) {
    return inspected;
  }

  const field = (start: string, end: string): string =>
    workshopWidgetRecommendationField(sectionLines, inspected, start, end);
  const targetPhrase = field(TARGET_PHRASE_START, TARGET_PHRASE_END);
  const writerInstructions = field(WRITER_INSTRUCTIONS_START, WRITER_INSTRUCTIONS_END);
  const contextText = field(SURROUNDING_CONTEXT_START, SURROUNDING_CONTEXT_END);
  const sourceReferenceText = field(SOURCE_REFERENCES_START, SOURCE_REFERENCES_END);
  const characterNotes = field(CHARACTER_NOTES_START, CHARACTER_NOTES_END);
  const fields: Array<{
    field: GesturePlaygroundRecommendationField;
    value: string;
    maximum: number;
  }> = [
    { field: 'targetPhrase', value: targetPhrase, maximum: BUDGET.gestureTargetPhraseCharacters },
    {
      field: 'writerInstructions',
      value: writerInstructions,
      maximum: BUDGET.gestureWriterInstructionsCharacters
    },
    { field: 'contextText', value: contextText, maximum: BUDGET.gestureContextCharacters },
    {
      field: 'sourceReferences',
      value: sourceReferenceText,
      maximum: BUDGET.gestureSourceReferenceCharacters
    },
    {
      field: 'characterNotes',
      value: characterNotes,
      maximum: BUDGET.gestureCharacterNotesCharacters
    }
  ];
  const emptyField = fields.find(({ value }) => value.length === 0);
  if (emptyField) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: emptyField.field,
      reason: 'empty'
    };
  }
  const overlongField = fields.find(({ value, maximum }) => value.length > maximum);
  if (overlongField) {
    return {
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: overlongField.field,
      actualCharacters: overlongField.value.length,
      maximumCharacters: overlongField.maximum
    };
  }
  if (!normalizeEvidenceText(contextText).includes(normalizeEvidenceText(targetPhrase))) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'contextText',
      reason: 'target_missing_from_context'
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

  return {
    outcome: 'accepted',
    recommendation: {
      widgetId: 'gesture-playground',
      seed: {
        targetPhrase,
        writerInstructions,
        contextText,
        characterNotes,
        sourceReferences
      }
    }
  };
}

const CONTEXT_ATTACHMENT_REFERENCE = /^context-attachment:(ctx-[1-9]\d*)$/;

function parseSourceReferences(value: string): WorkshopWidgetSourceReference[] | undefined {
  if (value.length === 0 || value.length > BUDGET.gestureSourceReferenceCharacters) {
    return undefined;
  }
  const lines = value.split('\n').map((line) => line.trim());
  if (lines.some((line) => line.length === 0)) {
    return undefined;
  }
  if (lines.length === 1 && lines[0] === 'none') {
    return [];
  }
  if (lines.includes('none') || lines.length > BUDGET.gestureSourceReferences) {
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
    if (!match) {
      return undefined;
    }
    references.push({ kind: 'context-attachment', attachmentId: match[1] });
  }
  return references;
}

function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export const GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY:
  WorkshopWidgetRecommendationEntry<
    GesturePlaygroundRecommendation,
    GesturePlaygroundRecommendationField,
    GesturePlaygroundRecommendationInvalidFieldReason
  > = Object.freeze({
    widgetId: 'gesture-playground',
    catalogSummary: 'Gesture Playground explores one exact embodied beat',
    catalogOrder: 0,
    instructionOrder: 1,
    instruction: GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION,
    reservedMarkers: GESTURE_PLAYGROUND_RECOMMENDATION_MARKERS,
    frameCharacters: GESTURE_PLAYGROUND_RECOMMENDATION_FRAME_CHARACTERS,
    inspect: inspectGesturePlaygroundRecommendation
  });
