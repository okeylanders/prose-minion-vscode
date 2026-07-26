import {
  buildWorkshopContextAttachmentsFrame,
  buildWorkshopExcerptSourceFrame
} from '@/application/services/workshop/WorkshopPromptBuilder';
import type { WorkshopContextAttachment } from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopAnalysisInputProvenance,
  WorkshopAnalysisInputSelection
} from '@shared/types/workshopCapabilities';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WorkshopConfiguredResourceRef,
  WorkshopExcerpt
} from '@messages';
import { countWords } from '@/utils/textUtils';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export interface WorkshopPersonaAnalysisRunInputs {
  excerptText: string;
  context?: string;
  excerptSourceFrame?: string;
  workshopSource?: WorkshopConfiguredResourceRef;
  provenance: {
    excerpt: WorkshopAnalysisInputProvenance;
    context: WorkshopAnalysisInputProvenance;
  };
}

export type WorkshopAnalysisInputResolution =
  | { kind: 'resolved'; inputs: WorkshopPersonaAnalysisRunInputs }
  | {
      kind: 'rejected';
      error: string;
      field: 'excerpt' | 'context';
      reason: 'input-mode-text-mismatch' | 'missing-inherited-input' | 'oversized-input';
    };

interface ResolveWorkshopAnalysisInputsInput {
  excerpt?: WorkshopExcerpt;
  contextAttachments: readonly WorkshopContextAttachment[];
  personaLabel: string;
  selections: {
    excerpt: WorkshopAnalysisInputSelection;
    context: WorkshopAnalysisInputSelection;
  };
}

interface InheritedInput {
  text?: string;
  material: string;
  words: number;
  truncation?: string;
}

interface ResolvedInput {
  text?: string;
  provenance: WorkshopAnalysisInputProvenance;
}

type SingleInputResolution =
  | { kind: 'resolved'; input: ResolvedInput }
  | {
      kind: 'rejected';
      error: string;
      field: 'excerpt' | 'context';
      reason: 'input-mode-text-mismatch' | 'missing-inherited-input' | 'oversized-input';
    };

export function describeWorkshopInheritedExcerpt(
  excerpt: WorkshopExcerpt
): InheritedInput {
  return {
    text: excerpt.text,
    material: `pinned excerpt v${excerpt.version}`,
    words: countWords(excerpt.text),
    truncation: excerpt.truncation
      ? `${excerpt.truncation.pinnedWords.toLocaleString('en-US')} of ` +
        `${excerpt.truncation.totalWords.toLocaleString('en-US')} words pinned`
      : undefined
  };
}

export function describeWorkshopInheritedContext(
  attachments: readonly WorkshopContextAttachment[]
): InheritedInput {
  const truncations = attachments
    .filter((attachment) => attachment.truncation)
    .map((attachment) =>
      `${attachment.label}: ${attachment.truncation!.keptWords.toLocaleString('en-US')} of ` +
      `${attachment.truncation!.totalWords.toLocaleString('en-US')} words`
    );
  return {
    text: buildWorkshopContextAttachmentsFrame(attachments),
    material: attachments.length === 0
      ? 'no context attachments'
      : `${attachments.length} context ${attachments.length === 1 ? 'attachment' : 'attachments'} ` +
        `(${attachments.map((attachment) => attachment.label).join(', ')})`,
    words: attachments.reduce((total, attachment) => total + attachment.words, 0),
    truncation: truncations.length > 0 ? truncations.join('; ') : undefined
  };
}

export function resolveWorkshopPersonaAnalysisInputs(
  input: ResolveWorkshopAnalysisInputsInput
): WorkshopAnalysisInputResolution {
  const inheritedExcerpt = input.excerpt
    ? describeWorkshopInheritedExcerpt(input.excerpt)
    : { material: 'no pinned excerpt', words: 0 };
  const excerpt = resolveInput({
    slot: 'excerpt',
    selection: input.selections.excerpt,
    inherited: inheritedExcerpt,
    wordLimit: PROMPT_BUDGETS.personaExcerpt.words,
    characterLimit: PROMPT_BUDGETS.personaExcerpt.characters,
    personaLabel: input.personaLabel
  });
  if (excerpt.kind === 'rejected') return excerpt;

  const context = resolveInput({
    slot: 'context',
    selection: input.selections.context,
    inherited: describeWorkshopInheritedContext(input.contextAttachments),
    wordLimit: PROMPT_BUDGETS.contextAttachments.words,
    characterLimit: PROMPT_BUDGETS.contextAttachments.characters,
    personaLabel: input.personaLabel
  });
  if (context.kind === 'rejected') return context;

  const inheritsExcerpt =
    input.selections.excerpt.mode === 'inherit' ||
    input.selections.excerpt.mode === 'prepend';
  return {
    kind: 'resolved',
    inputs: {
      excerptText: excerpt.input.text ?? '',
      context: context.input.text,
      excerptSourceFrame: inheritsExcerpt && input.excerpt
        ? buildWorkshopExcerptSourceFrame(input.excerpt.source)
        : undefined,
      workshopSource: inheritsExcerpt &&
        input.excerpt &&
        input.excerpt.source.kind !== 'manual'
        ? input.excerpt.source.configuredResource
        : undefined,
      provenance: {
        excerpt: excerpt.input.provenance,
        context: context.input.provenance
      }
    }
  };
}

function resolveInput(input: {
  slot: 'excerpt' | 'context';
  selection: WorkshopAnalysisInputSelection;
  inherited: InheritedInput;
  wordLimit: number;
  characterLimit: number;
  personaLabel: string;
}): SingleInputResolution {
  const supplied = input.selection.text?.trim();
  const requiresSupplied =
    input.selection.mode === 'prepend' || input.selection.mode === 'replace';
  if (requiresSupplied && !supplied) {
    return {
      kind: 'rejected',
      field: input.slot,
      reason: 'input-mode-text-mismatch',
      error: `${input.selection.mode} requires non-empty persona-supplied ${input.slot} text. Nothing was run.`
    };
  }
  const suppliedWords = supplied ? countWords(supplied) : 0;
  const missingInherited = !input.inherited.text || input.inherited.words === 0;
  if (
    missingInherited &&
    (
      input.selection.mode === 'prepend' ||
      (input.selection.mode === 'inherit' && input.slot === 'excerpt')
    )
  ) {
    return {
      kind: 'rejected',
      field: input.slot,
      reason: 'missing-inherited-input',
      error: `Cannot ${input.selection.mode} ${input.slot} material because this room has no inherited ${input.slot} material. Use replace or omit instead.`
    };
  }
  if (
    supplied &&
    (suppliedWords > input.wordLimit || supplied.length > input.characterLimit)
  ) {
    return {
      kind: 'rejected',
      field: input.slot,
      reason: 'oversized-input',
      error:
        `The persona-supplied ${input.slot} input is ${suppliedWords.toLocaleString('en-US')} words ` +
        `and ${supplied.length.toLocaleString('en-US')} characters; the limits are ` +
        `${input.wordLimit.toLocaleString('en-US')} words and ` +
        `${input.characterLimit.toLocaleString('en-US')} characters. Nothing was truncated or run.`
    };
  }

  const safeSupplied = supplied
    ? neutralizeReservedPersonaPromptDelimiters(supplied)
    : undefined;
  if (safeSupplied && safeSupplied.length > input.characterLimit) {
    return {
      kind: 'rejected',
      field: input.slot,
      reason: 'oversized-input',
      error:
        `The safely encoded persona-supplied ${input.slot} input is ` +
        `${safeSupplied.length.toLocaleString('en-US')} characters, above the ` +
        `${input.characterLimit.toLocaleString('en-US')}-character limit. ` +
        'Reserved prompt delimiters expanded during safe encoding; nothing was truncated or run.'
    };
  }
  const suppliedText = safeSupplied ?? '';
  let text: string | undefined;
  let material: string;
  let words: number;
  let chosenBy: string;
  let truncation: string | undefined;

  switch (input.selection.mode) {
    case 'inherit':
      text = input.inherited.text;
      material = input.inherited.material;
      words = input.inherited.words;
      chosenBy = 'Writer';
      truncation = input.inherited.truncation;
      break;
    case 'prepend':
      text = `${suppliedText}\n\n${input.inherited.text}`;
      material = `persona-supplied prefix + ${input.inherited.material}`;
      words = suppliedWords + input.inherited.words;
      chosenBy = `${input.personaLabel} + Writer`;
      truncation = input.inherited.truncation;
      break;
    case 'replace':
      text = suppliedText;
      material = `persona-supplied ${input.slot}`;
      words = suppliedWords;
      chosenBy = input.personaLabel;
      break;
    case 'omit':
      text = undefined;
      material = 'omitted';
      words = 0;
      chosenBy = input.personaLabel;
      break;
  }

  return {
    kind: 'resolved',
    input: {
      text,
      provenance: {
        mode: input.selection.mode,
        material,
        chosenBy,
        words,
        truncation
      }
    }
  };
}
