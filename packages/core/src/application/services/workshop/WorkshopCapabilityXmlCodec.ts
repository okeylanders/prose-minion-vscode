import { SaxesParser, SaxesTagPlain } from 'saxes';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isWorkshopToolId, WORKSHOP_TOOL_CATALOG } from '@shared/constants/workshopTools';
import { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import { findExecutableMarkerIndex } from '@orchestration/ResourceReadXmlCodec';

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
  | 'oversized-input';

export type WorkshopCapabilityInspection =
  | { readonly kind: 'none' }
  | { readonly kind: 'request'; readonly request: WorkshopCapabilityRequest }
  | {
      readonly kind: 'invalid';
      readonly reason: WorkshopCapabilityRejectionReason;
      readonly field?: string;
    };

const ROOT = 'prose-minion-tool-call';

export const createWorkshopCapabilityInstruction = (): string => {
  const budgets = PROMPT_BUDGETS.workshopCapability;
  const toolIds = WORKSHOP_TOOL_CATALOG.map(tool => tool.id).join(', ');
  return [
    '## Workshop Capability Protocol',
    '',
    `You may make at most ${budgets.callsPerTurn} capability calls during this user turn. ` +
      `You may request dictionary.full-entry at most ${budgets.fullEntriesPerTurn} time and analysis.run at most ${budgets.analysisRunsPerTurn} time.`,
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
    'Isolated analysis side pass:',
    '<prose-minion-tool-call name="analysis.run">',
    '  <toolId>continuity</toolId>',
    '  <instructions>Check whether the revised blocking is internally consistent.</instructions>',
    '</prose-minion-tool-call>',
    '',
    `Allowed analysis tool ids: ${toolIds}.`,
    `Input ceilings are word ${budgets.wordCharacters} characters, context ${budgets.contextCharacters}, ` +
      `purpose ${budgets.purposeCharacters}, and instructions ${budgets.instructionsCharacters}. Do not split or truncate an input to evade a ceiling.`,
    'Never include excerpt text or a filesystem path in analysis.run; the host pins the current excerpt and stamps its provenance.',
    'After evidence is returned, use it honestly. The dictionary and analysis agents remain separately attributed; never claim their report as your own.'
  ].join('\n');
};

/** Strict single-root decoder for the closed Workshop operation set. */
export class WorkshopCapabilityXmlCodec {
  inspect(candidate: string): WorkshopCapabilityInspection {
    const source = candidate.trim();
    if (!source) return { kind: 'none' };

    const markerIndex = findExecutableMarkerIndex(source);
    if (markerIndex === -1) return { kind: 'none' };
    if (markerIndex !== 0) return { kind: 'invalid', reason: 'mixed-content' };
    const openingCalls = source.match(/<\s*prose-minion-tool-call\b/gi) ?? [];
    if (openingCalls.length !== 1) return { kind: 'invalid', reason: 'mixed-content' };
    const closingTag = '</prose-minion-tool-call>';
    const closingIndex = source.toLowerCase().lastIndexOf(closingTag);
    if (
      closingIndex !== -1 &&
      source.slice(closingIndex + closingTag.length).trim().length > 0
    ) {
      return { kind: 'invalid', reason: 'mixed-content' };
    }

    let rejection: WorkshopCapabilityInspection & { kind: 'invalid' } | undefined;
    const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): void => {
      rejection ??= { kind: 'invalid', reason, field };
    };
    let depth = 0;
    let rootCount = 0;
    let operation: string | undefined;
    let currentField: string | undefined;
    let currentValue = '';
    const fields = new Map<string, string>();
    const parser = new SaxesParser();

    parser.on('error', () => reject('malformed-xml'));
    parser.on('xmldecl', () => reject('xml-declaration'));
    parser.on('processinginstruction', () => reject('processing-instruction'));
    parser.on('doctype', () => reject('doctype'));
    parser.on('comment', () => reject('comment'));
    parser.on('opentag', (tag: SaxesTagPlain) => {
      if (depth === 0) {
        rootCount += 1;
        if (tag.name !== ROOT) reject('unexpected-root');
        if (Object.keys(tag.attributes).length !== 1 || typeof tag.attributes.name !== 'string') {
          reject('invalid-root-attributes');
        }
        operation = typeof tag.attributes.name === 'string' ? tag.attributes.name : undefined;
      } else if (depth === 1) {
        if (Object.keys(tag.attributes).length !== 0) reject('field-attributes', tag.name);
        if (fields.has(tag.name) || currentField === tag.name) reject('duplicate-field', tag.name);
        currentField = tag.name;
        currentValue = '';
      } else {
        reject('unexpected-field', tag.name);
      }
      depth += 1;
    });
    parser.on('text', (text: string) => {
      if (depth === 2 && currentField) currentValue += text;
      else if (text.trim()) reject('mixed-content');
    });
    parser.on('cdata', () => reject('mixed-content'));
    parser.on('closetag', () => {
      if (depth === 2 && currentField) {
        fields.set(currentField, currentValue.trim());
        currentField = undefined;
        currentValue = '';
      }
      depth -= 1;
      if (depth < 0) reject('malformed-xml');
    });

    try {
      parser.write(source).close();
    } catch {
      reject('malformed-xml');
    }
    if (rootCount !== 1 || depth !== 0) reject('malformed-xml');
    if (rejection) return rejection;

    switch (operation) {
      case 'dictionary.lookup':
      case 'dictionary.full-entry':
        return this.dictionaryRequest(operation, fields);
      case 'analysis.run':
        return this.analysisRequest(fields);
      default:
        return { kind: 'invalid', reason: 'unknown-capability' };
    }
  }

  stripToolCalls(content: string): string {
    return findExecutableMarkerIndex(content.trim()) === -1 ? content.trim() : '';
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
    const fieldError = this.validateFields(fields, ['toolId'], ['instructions']);
    if (fieldError) return fieldError;
    const toolId = fields.get('toolId')!;
    if (!isWorkshopToolId(toolId)) {
      return { kind: 'invalid', reason: 'unknown-tool-id', field: 'toolId' };
    }
    const instructions = fields.get('instructions');
    if (
      instructions !== undefined &&
      instructions.length > PROMPT_BUDGETS.workshopCapability.instructionsCharacters
    ) {
      return { kind: 'invalid', reason: 'oversized-input', field: 'instructions' };
    }
    return {
      kind: 'request',
      request: {
        capability: 'analysis.run',
        toolId,
        instructions: instructions || undefined
      }
    };
  }

  private validateFields(
    fields: ReadonlyMap<string, string>,
    required: readonly string[],
    optional: readonly string[]
  ): WorkshopCapabilityInspection | undefined {
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
  ): WorkshopCapabilityInspection | undefined {
    const field = Object.entries(ceilings).find(([name, ceiling]) =>
      (fields.get(name)?.length ?? 0) > ceiling
    )?.[0];
    return field ? { kind: 'invalid', reason: 'oversized-input', field } : undefined;
  }
}
