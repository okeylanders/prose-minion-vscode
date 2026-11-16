import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isWorkshopToolId } from '@shared/constants/workshopTools';
import {
  WorkshopAnalysisInputMode,
  WorkshopCapabilityRequest
} from '@shared/types/workshopCapabilities';
import { ContextPathGroup } from '@shared/types';
import { parseWorkshopCapabilityXmlDocument } from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import {
  inspectWorkshopTranscriptRecallCall,
  WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY
} from '@/application/services/workshop/WorkshopTranscriptRecallXmlCodec';
import {
  inspectWorkshopProjectMemoryCall,
  WORKSHOP_PROJECT_MEMORY_FIELD_POLICY
} from '@/application/services/workshop/memory/WorkshopProjectMemoryXmlCodec';
import {
  inspectWorkshopResourceCall,
  WORKSHOP_RESOURCE_FIELD_POLICY
} from '@/application/services/workshop/WorkshopResourceXmlCodec';
import { workshopResourceInstructionLines } from '@/application/services/workshop/WorkshopResourceInstruction';
import type { WorkshopCapabilityXmlFieldPolicy } from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import { countWords } from '@/utils/textUtils';

/** Each family's repeatable fields and attributes; every other field is unique and bare. */
const FIELD_POLICY: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: (operation, field) =>
    WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY.repeatable(operation, field) ||
    WORKSHOP_PROJECT_MEMORY_FIELD_POLICY.repeatable(operation, field) ||
    WORKSHOP_RESOURCE_FIELD_POLICY.repeatable(operation, field),
  attributes: (operation, field) => [
    ...WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY.attributes(operation, field),
    ...WORKSHOP_RESOURCE_FIELD_POLICY.attributes(operation, field)
  ]
};

export type WorkshopCapabilityRejectionReason =
  | 'xml-declaration'
  | 'processing-instruction'
  | 'doctype'
  | 'comment'
  | 'malformed-xml'
  | 'mixed-content'
  | 'unexpected-root'
  | 'invalid-root-attributes'
  | 'unknown-capability'
  | 'unexpected-field'
  | 'field-attributes'
  | 'duplicate-field'
  | 'missing-field'
  | 'empty-field'
  | 'unknown-tool-id'
  | 'unknown-input-mode'
  | 'input-mode-text-mismatch'
  | 'unknown-resource-group'
  | 'invalid-resource-path'
  | 'invalid-line-range'
  // A multi-file resource.read (ADR 2026-11-14 D4).
  | 'ambiguous-lines'
  | 'too-many-paths'
  | 'duplicate-path'
  | 'oversized-input'
  // Session recall (WorkshopTranscriptRecallXmlCodec).
  | 'invalid-session-id'
  | 'invalid-turn-selection'
  | 'ambiguous-turns'
  | 'too-many-sessions'
  | 'duplicate-session'
  | 'invalid-detail'
  | 'conflicting-detail'
  | 'unknown-persona'
  | 'unknown-source'
  | 'invalid-status'
  | 'invalid-recent'
  | 'conflicting-session-selection'
  // Bookmark recall (ADR 2026-11-05 D2).
  | 'invalid-scope'
  | 'conflicting-scope'
  | 'unknown-speaker'
  | 'invalid-date'
  | 'invalid-bookmark-ref'
  | 'invalid-from'
  // Project memory (WorkshopProjectMemoryXmlCodec).
  | 'invalid-kind'
  | 'invalid-memory-id'
  | 'too-many-memories'
  | 'duplicate-memory';

export type WorkshopCapabilityInspection =
  | { readonly kind: 'none' }
  | { readonly kind: 'request'; readonly request: WorkshopCapabilityRequest }
  | {
      readonly kind: 'invalid';
      readonly reason: WorkshopCapabilityRejectionReason;
      readonly field?: string;
      readonly operation?: string;
      /** Opening markers found in a rejected response, not validated calls. */
      readonly callMarkerCount?: number;
    };

export interface WorkshopResourceGroupAvailability {
  readonly group: ContextPathGroup;
  readonly fileCount: number;
}

export const createWorkshopCapabilityTurnReminder = (): string =>
  `This writer message starts a new user turn with a fresh allowance of ` +
  `${PROMPT_BUDGETS.workshopCapability.callsPerTurn} capability calls. ` +
  'A limit reached in an earlier turn does not carry forward. Use the available calls when fresh evidence would materially improve the answer.';

export const createWorkshopCapabilityInstruction = (
  resourceGroups: readonly WorkshopResourceGroupAvailability[] = []
): string => {
  const budgets = PROMPT_BUDGETS.workshopCapability;
  const lines = [
    '## Workshop Capability Protocol',
    '',
    `You may make at most ${budgets.callsPerTurn} capability calls during this user turn. ` +
      `You may request dictionary.full-entry at most ${timesAllowed(budgets.fullEntriesPerTurn)} and analysis.run at most ${timesAllowed(budgets.analysisRunsPerTurn)}.`,
    'This allowance resets with every new writer message. Never carry an exhausted capability budget forward from an earlier turn.',
    'A capability call must be your entire response: one bare, well-formed XML document with no prose, Markdown fence, second call, or characters before or after it.',
    '',
    'Focused Writer\'s Dictionary lookup:',
    '<prose-minion-tool-call name="dictionary.lookup">',
    '  <word>liminal</word>',
    '  <context>The word appears in a quiet threshold scene.</context>',
    '  <purpose>Clarify its tone and connotations.</purpose>',
    '</prose-minion-tool-call>',
    '',
    'Full Writer\'s Dictionary entry (use sparingly because it runs several dictionary sections):',
    '<prose-minion-tool-call name="dictionary.full-entry">',
    '  <word>liminal</word>',
    '  <context>The word appears in a quiet threshold scene.</context>',
    '  <purpose>Compare diction options for this passage.</purpose>',
    '</prose-minion-tool-call>',
    '',
    'The stable analysis.run grammar and its validation rules are in your system instructions. The reserved analysis-scope frame beside this writer turn reports only the current inherited inputs.',
    // Unconditional (ADR 2026-10-05 §8): this contract freezes at the first
    // message, and whether recall is available is a per-call fact each
    // transcript.* result reports.
    'The stable transcript.* grammar is in your system instructions.',
    `Dictionary input ceilings are word ${budgets.wordCharacters} characters, context ${budgets.contextCharacters}, ` +
      `and purpose ${budgets.purposeCharacters}. Do not split or truncate an input to evade a ceiling.`,
    'After evidence is returned, use it honestly. The dictionary and analysis agents remain separately attributed; never claim their report as your own.'
  ];

  lines.push(...workshopResourceInstructionLines(resourceGroups));
  return lines.join('\n');
};

/** Strict single-root decoder for the closed Workshop operation set. */
export class WorkshopCapabilityXmlCodec {
  inspect(candidate: string): WorkshopCapabilityInspection {
    const document = parseWorkshopCapabilityXmlDocument(candidate, FIELD_POLICY);
    if (document.kind !== 'call') return document;
    const { operation, fields } = document;
    switch (operation) {
      case 'dictionary.lookup':
      case 'dictionary.full-entry':
        return this.dictionaryRequest(operation, fields);
      case 'analysis.run':
        return this.analysisRequest(fields);
      case 'resource.catalog':
      case 'resource.search':
      case 'resource.read':
        return inspectWorkshopResourceCall(operation, document);
      case 'transcript.catalog':
      case 'transcript.search':
      case 'transcript.read':
      case 'transcript.todos':
      // By hand too: without this case, the operation falls to `unknown-capability`.
      case 'transcript.bookmarks':
        return inspectWorkshopTranscriptRecallCall(operation, document);
      // The family's codec, by hand: this switch has no `never` guard (ADR 2026-11-04 D12).
      case 'memory.catalog':
      case 'memory.search':
      case 'memory.read':
        return inspectWorkshopProjectMemoryCall(operation, document);
      default:
        return { kind: 'invalid', reason: 'unknown-capability' };
    }
  }

  stripToolCalls(content: string): string {
    return this.inspect(content).kind === 'none' ? content.trim() : '';
  }

  private dictionaryRequest(
    capability: 'dictionary.lookup' | 'dictionary.full-entry',
    fields: ReadonlyMap<string, string>
  ): WorkshopCapabilityInspection {
    const fieldError = this.validateFields(fields, ['word', 'context', 'purpose'], []);
    if (fieldError) return fieldError;
    const budgets = PROMPT_BUDGETS.workshopCapability;
    const oversized = this.firstOversized(fields, {
      word: budgets.wordCharacters,
      context: budgets.contextCharacters,
      purpose: budgets.purposeCharacters
    });
    if (oversized) return oversized;
    return {
      kind: 'request',
      request: {
        capability,
        word: fields.get('word')!,
        context: fields.get('context')!,
        purpose: fields.get('purpose')!
      }
    };
  }

  private analysisRequest(fields: ReadonlyMap<string, string>): WorkshopCapabilityInspection {
    const fieldError = this.validateFields(
      fields,
      ['toolId', 'excerptMode', 'contextMode'],
      ['excerptText', 'contextText']
    );
    if (fieldError) return { ...fieldError, operation: 'analysis.run' };
    const toolId = fields.get('toolId')!;
    if (!isWorkshopToolId(toolId)) {
      return {
        kind: 'invalid',
        reason: 'unknown-tool-id',
        field: 'toolId',
        operation: 'analysis.run'
      };
    }
    const excerpt = this.analysisInput(fields, 'excerpt');
    if ('kind' in excerpt) return excerpt;
    const context = this.analysisInput(fields, 'context');
    if ('kind' in context) return context;
    return {
      kind: 'request',
      request: {
        capability: 'analysis.run',
        toolId,
        excerpt,
        context
      }
    };
  }

  private analysisInput(
    fields: ReadonlyMap<string, string>,
    slot: 'excerpt' | 'context'
  ):
    | { mode: WorkshopAnalysisInputMode; text?: string }
    | Extract<WorkshopCapabilityInspection, { kind: 'invalid' }> {
    const modeField = `${slot}Mode`;
    const textField = `${slot}Text`;
    const mode = fields.get(modeField)!;
    const text = fields.get(textField);
    if (!this.isAnalysisInputMode(mode)) {
      return {
        kind: 'invalid',
        reason: 'unknown-input-mode',
        field: modeField,
        operation: 'analysis.run'
      };
    }
    const requiresText = mode === 'prepend' || mode === 'replace';
    if (requiresText && !text) {
      return {
        kind: 'invalid',
        reason: 'input-mode-text-mismatch',
        field: textField,
        operation: 'analysis.run'
      };
    }
    if (!requiresText && text !== undefined) {
      return {
        kind: 'invalid',
        reason: 'input-mode-text-mismatch',
        field: textField,
        operation: 'analysis.run'
      };
    }
    const wordLimit = slot === 'excerpt'
      ? PROMPT_BUDGETS.personaExcerpt.words
      : PROMPT_BUDGETS.contextAttachments.words;
    const characterLimit = slot === 'excerpt'
      ? PROMPT_BUDGETS.personaExcerpt.characters
      : PROMPT_BUDGETS.contextAttachments.characters;
    if (text && (countWords(text) > wordLimit || text.length > characterLimit)) {
      return {
        kind: 'invalid',
        reason: 'oversized-input',
        field: textField,
        operation: 'analysis.run'
      };
    }
    return { mode, text };
  }

  private isAnalysisInputMode(value: string): value is WorkshopAnalysisInputMode {
    return value === 'inherit' || value === 'prepend' || value === 'replace' || value === 'omit';
  }

  private validateFields(
    fields: ReadonlyMap<string, string>,
    required: readonly string[],
    optional: readonly string[]
  ): Extract<WorkshopCapabilityInspection, { kind: 'invalid' }> | undefined {
    const allowed = new Set([...required, ...optional]);
    const unexpected = [...fields.keys()].find(field => !allowed.has(field));
    if (unexpected) return { kind: 'invalid', reason: 'unexpected-field', field: unexpected };
    const missing = required.find(field => !fields.has(field));
    if (missing) return { kind: 'invalid', reason: 'missing-field', field: missing };
    const empty = required.find(field => !fields.get(field));
    return empty ? { kind: 'invalid', reason: 'empty-field', field: empty } : undefined;
  }

  private firstOversized(
    fields: ReadonlyMap<string, string>,
    ceilings: Readonly<Record<string, number>>
  ): Extract<WorkshopCapabilityInspection, { kind: 'invalid' }> | undefined {
    const field = Object.entries(ceilings).find(([name, ceiling]) =>
      (fields.get(name)?.length ?? 0) > ceiling
    )?.[0];
    return field ? { kind: 'invalid', reason: 'oversized-input', field } : undefined;
  }
}

/** "1 time", "3 times": how often the turn allows a capability with its own ceiling. */
function timesAllowed(count: number): string {
  return `${count} ${count === 1 ? 'time' : 'times'}`;
}
