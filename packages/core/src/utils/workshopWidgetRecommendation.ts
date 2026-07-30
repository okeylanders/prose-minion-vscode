/**
 * Deterministic extraction of persona widget recommendations
 * (ADR 2026-07-22 decision 13, actionable-findings mold): a bounded contract
 * instruction, a strict fail-closed parse, and a typed field on the turn.
 * Malformed sections reject wholesale, and ids that are not `live` in the
 * widget registry reject too — comp-only widgets never render chips. The
 * model recommends; only the writer commits.
 *
 * Lives under `@/utils` (not the application layer) for the same reason as
 * workshopPromptFrames: the contract instruction rides the INITIAL persona
 * envelope, which is assembled in infrastructure, and infrastructure must
 * not import application.
 */

import {
  WorkshopWidgetRecommendation,
  WorkshopWidgetSourceReference
} from '@messages';
import { isLiveWorkshopWidgetId } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export const WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION = [
  '<workshop-widget-recommendation-contract>',
  'The writer has an interactive Gesture Playground widget. It creates a writer-facing Gesture Dictionary and a menu of gesture/expression directions for one exact phrase; the writer edits the setup and chooses what to keep.',
  'When reworking a specific gesture, expression, or embodied reaction would genuinely help, recommend the widget at most once by ending your response with the exact multiline control frame below. If you also emit `### Next steps`, put that section before `### Try a widget`; the widget frame must be the final content in the response.',
  'This is a quality-first handoff, not a token-saving exercise. Do not be thrifty, terse, or generically minimal in the prefill fields. Supply enough grounded material that the dictionary model can understand the dramatic problem without reconstructing it from scraps. Source references save duplicate transcription; they are not permission to thin out the creative direction or character thinking:',
  '- `target-phrase`: copy the exact phrase from the supplied passage, without quotation marks or paraphrase.',
  '- `writer-instructions`: give several substantive, specific sentences explaining the beat\'s dramatic job, what an alternative must preserve, what to avoid, and which creative territory is worth exploring.',
  '- `surrounding-context`: copy a generous, consecutive stretch of the supplied prose around the phrase—normally the full relevant beat and useful paragraphs before and after, up to the field limit. When a source reference below carries the full excerpt or attachment, include enough exact consecutive local prose to locate the beat without pointlessly copying the whole referenced source. Preserve source wording; never summarize, pad, or invent passage text.',
  '- `source-references`: use `active-excerpt` and/or exact `context-attachment:ctx-N` reference identifiers shown in the supplied Workshop material when the dictionary model would benefit from reading those sources in full. Use `none` when no source should ride. Never invent an identifier.',
  '- `character-notes`: give several grounded sentences about who this person is in this beat: immediate pressure, intention or defense, relationship dynamics, self-control, physical habits or constraints, and relevant voice/history. Distinguish supplied facts from reasonable scene inference; never invent project facts.',
  'The four prose fields and the source-references field are required when you recommend the widget. If the supplied material cannot support them honestly, omit the recommendation. Everything remains editable and nothing runs until the writer chooses it. Do not explain widget mechanics in prose—the chip and prefilled form do that.',
  'Use this reserved heading and these tags exactly once, alone on their lines. Do not repeat the heading or use any of the reserved tags inside a field:',
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>',
  'gesture-playground',
  '</widget-id>',
  '<target-phrase>',
  '[exact phrase from the supplied passage]',
  '</target-phrase>',
  '<writer-instructions>',
  '[substantial, scene-specific creative direction]',
  '</writer-instructions>',
  '<surrounding-context>',
  '[generous consecutive source prose around the phrase]',
  '</surrounding-context>',
  '<source-references>',
  '[none, or one exact active-excerpt/context-attachment:ctx-N identifier per line]',
  '</source-references>',
  '<character-notes>',
  '[substantial, evidence-grounded character notes for this beat]',
  '</character-notes>',
  '</workshop-widget-recommendation>',
  '</workshop-widget-recommendation-contract>'
].join('\n');

const TRY_WIDGET_HEADING = '### Try a widget';
const FRAME_START = '<workshop-widget-recommendation version="1">';
const FRAME_END = '</workshop-widget-recommendation>';
const WIDGET_ID_START = '<widget-id>';
const WIDGET_ID_END = '</widget-id>';
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
const ORDERED_MARKERS = [
  FRAME_START,
  WIDGET_ID_START,
  WIDGET_ID_END,
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
  FRAME_END
] as const;

export type WorkshopWidgetRecommendationRejection =
  | 'duplicate_heading'
  | 'frame_too_long'
  | 'invalid_frame'
  | 'unknown_or_unavailable_widget'
  | 'invalid_field'
  | 'field_too_long';

export type WorkshopWidgetRecommendationInspection =
  | { outcome: 'absent'; recommendation?: undefined }
  | { outcome: 'accepted'; recommendation: WorkshopWidgetRecommendation }
  | {
      outcome: 'rejected';
      recommendation?: undefined;
      rejection: WorkshopWidgetRecommendationRejection;
    };

/**
 * Parse one exact `### Try a widget` section carrying a versioned multiline
 * frame. The frame is deliberately not JSON: copied prose can contain quotes,
 * newlines, and punctuation without making the control brittle. Anything
 * malformed, incomplete, duplicated, or over budget rejects wholesale.
 */
export function inspectWorkshopWidgetRecommendation(
  content: string
): WorkshopWidgetRecommendationInspection {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headingIndexes = lines.flatMap((line, index) =>
    line === TRY_WIDGET_HEADING ? [index] : []
  );
  if (headingIndexes.length === 0) {
    return { outcome: 'absent' };
  }
  if (headingIndexes.length > 1) {
    return { outcome: 'rejected', rejection: 'duplicate_heading' };
  }

  const sectionLines = lines.slice(headingIndexes[0] + 1);
  const sectionCharacters = sectionLines.join('\n').length;
  const maximumSectionCharacters =
    PROMPT_BUDGETS.workshopWidgets.gestureTargetPhraseCharacters
    + PROMPT_BUDGETS.workshopWidgets.gestureWriterInstructionsCharacters
    + PROMPT_BUDGETS.workshopWidgets.gestureContextCharacters
    + PROMPT_BUDGETS.workshopWidgets.gestureCharacterNotesCharacters
    + PROMPT_BUDGETS.workshopWidgets.gestureSourceReferenceCharacters
    + PROMPT_BUDGETS.workshopWidgets.gestureRecommendationFrameAllowanceCharacters;
  if (sectionCharacters > maximumSectionCharacters) {
    return { outcome: 'rejected', rejection: 'frame_too_long' };
  }

  const markerIndexes = new Map<string, number>();
  for (const marker of ORDERED_MARKERS) {
    const indexes = sectionLines.flatMap((line, index) =>
      line === marker ? [index] : []
    );
    if (indexes.length !== 1) {
      return { outcome: 'rejected', rejection: 'invalid_frame' };
    }
    markerIndexes.set(marker, indexes[0]);
  }

  const orderedIndexes = ORDERED_MARKERS.map((marker) => markerIndexes.get(marker)!);
  if (orderedIndexes.some((index, ordinal) => ordinal > 0 && index <= orderedIndexes[ordinal - 1])) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }
  const frameStartIndex = markerIndexes.get(FRAME_START)!;
  const frameEndIndex = markerIndexes.get(FRAME_END)!;
  if (
    sectionLines.slice(0, frameStartIndex).some((line) => line.trim().length > 0)
    || sectionLines.slice(frameEndIndex + 1).some((line) => line.trim().length > 0)
  ) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }

  const field = (start: string, end: string): string => sectionLines
    .slice(markerIndexes.get(start)! + 1, markerIndexes.get(end)!)
    .join('\n')
    .trim();
  const onlyBlankBetween = (left: string, right: string): boolean => sectionLines
    .slice(markerIndexes.get(left)! + 1, markerIndexes.get(right)!)
    .every((line) => line.trim().length === 0);
  if (
    !onlyBlankBetween(FRAME_START, WIDGET_ID_START)
    || !onlyBlankBetween(WIDGET_ID_END, TARGET_PHRASE_START)
    || !onlyBlankBetween(TARGET_PHRASE_END, WRITER_INSTRUCTIONS_START)
    || !onlyBlankBetween(WRITER_INSTRUCTIONS_END, SURROUNDING_CONTEXT_START)
    || !onlyBlankBetween(SURROUNDING_CONTEXT_END, SOURCE_REFERENCES_START)
    || !onlyBlankBetween(SOURCE_REFERENCES_END, CHARACTER_NOTES_START)
    || !onlyBlankBetween(CHARACTER_NOTES_END, FRAME_END)
  ) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }

  const widgetId = field(WIDGET_ID_START, WIDGET_ID_END);
  if (!isLiveWorkshopWidgetId(widgetId)) {
    return { outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' };
  }

  const budget = PROMPT_BUDGETS.workshopWidgets;
  const targetPhrase = field(TARGET_PHRASE_START, TARGET_PHRASE_END);
  const writerInstructions = field(
    WRITER_INSTRUCTIONS_START,
    WRITER_INSTRUCTIONS_END
  );
  const contextText = field(SURROUNDING_CONTEXT_START, SURROUNDING_CONTEXT_END);
  const sourceReferenceText = field(SOURCE_REFERENCES_START, SOURCE_REFERENCES_END);
  const characterNotes = field(CHARACTER_NOTES_START, CHARACTER_NOTES_END);
  const fields: Array<{ value: string; maximum: number }> = [
    { value: targetPhrase, maximum: budget.gestureTargetPhraseCharacters },
    { value: writerInstructions, maximum: budget.gestureWriterInstructionsCharacters },
    { value: contextText, maximum: budget.gestureContextCharacters },
    { value: characterNotes, maximum: budget.gestureCharacterNotesCharacters }
  ];
  if (fields.some(({ value }) => value.length === 0)) {
    return { outcome: 'rejected', rejection: 'invalid_field' };
  }
  if (fields.some(({ value, maximum }) => value.length > maximum)) {
    return { outcome: 'rejected', rejection: 'field_too_long' };
  }
  if (
    normalizeEvidenceText(contextText).includes(normalizeEvidenceText(targetPhrase)) === false
  ) {
    return { outcome: 'rejected', rejection: 'invalid_field' };
  }
  const sourceReferences = parseSourceReferences(sourceReferenceText);
  if (!sourceReferences) {
    return { outcome: 'rejected', rejection: 'invalid_field' };
  }

  return {
    outcome: 'accepted',
    recommendation: {
      widgetId,
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
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (value.length === 0 || value.length > budget.gestureSourceReferenceCharacters) {
    return undefined;
  }
  const lines = value.split('\n').map((line) => line.trim());
  if (lines.some((line) => line.length === 0)) {
    return undefined;
  }
  if (lines.length === 1 && lines[0] === 'none') {
    return [];
  }
  if (lines.includes('none') || lines.length > budget.gestureSourceReferences) {
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

/**
 * A recommendation control renders as a chip and editable form, not as a wall
 * of machine framing in the transcript. The exact reserved heading owns the
 * final tail even when the frame later rejects, so malformed or truncated
 * control debris cannot become persisted, copied, or saved prose.
 */
export function stripWorkshopWidgetRecommendationControl(content: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headingIndex = lines.findIndex((line) => line === TRY_WIDGET_HEADING);
  return headingIndex >= 0
    ? lines.slice(0, headingIndex).join('\n').trimEnd()
    : content;
}
