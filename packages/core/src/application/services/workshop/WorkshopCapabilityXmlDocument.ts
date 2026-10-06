/**
 * The document a Workshop capability call must be: one bare, well-formed
 * `<prose-minion-tool-call name="…">` root whose children are text-only
 * fields. This module finds the call in a reply and parses it; the codec
 * validates each operation's fields.
 *
 * An ordinary answer may name the opening marker literally or quote it in a
 * blockquote, and narration or a Markdown fence may precede one valid tail
 * call. Anything else that mixes a call with other markup is refused.
 */

import { SaxesParser, SaxesTagPlain } from 'saxes';
import { findExecutableMarkerIndex } from '@orchestration/ResourceReadXmlCodec';
import type {
  WorkshopCapabilityInspection,
  WorkshopCapabilityRejectionReason
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';

const ROOT = 'prose-minion-tool-call';

type Rejection = Extract<WorkshopCapabilityInspection, { kind: 'invalid' }>;

/** One field element, in document order, its text trimmed. */
export interface WorkshopCapabilityXmlField {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly value: string;
}

/**
 * A parsed call: its operation name, each unique field's trimmed text, and
 * every field element in order (a repeatable field appears once per element).
 */
export interface WorkshopCapabilityXmlCall {
  readonly kind: 'call';
  readonly operation: string | undefined;
  readonly fields: ReadonlyMap<string, string>;
  readonly elements: readonly WorkshopCapabilityXmlField[];
}

/**
 * Which fields of an operation may repeat, and which attributes a field may
 * carry. Every other field is unique and bare, so the policy only ever
 * admits more than the strict default.
 */
export interface WorkshopCapabilityXmlFieldPolicy {
  repeatable(operation: string | undefined, field: string): boolean;
  attributes(operation: string | undefined, field: string): readonly string[];
}

const BARE_FIELDS: WorkshopCapabilityXmlFieldPolicy = {
  repeatable: () => false,
  attributes: () => []
};

export type WorkshopCapabilityXmlDocument =
  | { readonly kind: 'none' }
  | Rejection
  | WorkshopCapabilityXmlCall;

export function parseWorkshopCapabilityXmlDocument(
  candidate: string,
  policy: WorkshopCapabilityXmlFieldPolicy = BARE_FIELDS
): WorkshopCapabilityXmlDocument {
  const source = candidate.trim();
  if (!source) {
    return { kind: 'none' };
  }

  const markerIndex = findExecutableMarkerIndex(source);
  if (markerIndex === -1) {
    return { kind: 'none' };
  }
  if (markerIndex !== 0) {
    const linePrefix = source.slice(source.lastIndexOf('\n', markerIndex - 1) + 1, markerIndex);
    const isBlockquoteMention = /^\s*>\s*$/.test(linePrefix);
    const hasCompleteCall = source.toLowerCase().indexOf(
      '</prose-minion-tool-call>',
      markerIndex
    ) !== -1;
    // An invocation after narration is rejected, but an ordinary answer
    // may name the opening marker literally or quote it in a blockquote.
    if (isBlockquoteMention || !hasCompleteCall) {
      return { kind: 'none' };
    }
    const preamble = source.slice(0, markerIndex).trim();
    const isMarkdownFence = /^```(?:xml)?$/i.test(preamble);
    // Tolerate ordinary narration or fence garnish before one valid tail
    // call. Unlike ResourceReadXmlCodec's length heuristic, this stricter
    // contract rejects markup-bearing preambles as mixed executable content.
    if (!isMarkdownFence && /[<>]/.test(preamble)) {
      return { kind: 'invalid', reason: 'mixed-content' };
    }
  }
  const segment = source.slice(markerIndex).replace(/\s*```\s*$/, '').trim();
  const openingCalls = segment.match(/<\s*prose-minion-tool-call\b/gi) ?? [];
  if (openingCalls.length !== 1) {
    return { kind: 'invalid', reason: 'mixed-content' };
  }
  const closingTag = '</prose-minion-tool-call>';
  const closingIndex = segment.toLowerCase().lastIndexOf(closingTag);
  if (
    closingIndex !== -1 &&
    segment.slice(closingIndex + closingTag.length).trim().length > 0
  ) {
    return { kind: 'invalid', reason: 'mixed-content' };
  }

  let rejection: Rejection | undefined;
  const reject = (reason: WorkshopCapabilityRejectionReason, field?: string): void => {
    rejection ??= { kind: 'invalid', reason, field };
  };
  let depth = 0;
  let rootCount = 0;
  let operation: string | undefined;
  let currentField: string | undefined;
  let currentAttributes: Readonly<Record<string, string>> = {};
  let currentValue = '';
  const fields = new Map<string, string>();
  const elements: WorkshopCapabilityXmlField[] = [];
  const parser = new SaxesParser();

  parser.on('error', () => reject('malformed-xml'));
  parser.on('xmldecl', () => reject('xml-declaration'));
  parser.on('processinginstruction', () => reject('processing-instruction'));
  parser.on('doctype', () => reject('doctype'));
  parser.on('comment', () => reject('comment'));
  parser.on('opentag', (tag: SaxesTagPlain) => {
    if (depth === 0) {
      rootCount += 1;
      if (tag.name !== ROOT) {
        reject('unexpected-root');
      }
      if (Object.keys(tag.attributes).length !== 1 || typeof tag.attributes.name !== 'string') {
        reject('invalid-root-attributes');
      }
      operation = typeof tag.attributes.name === 'string' ? tag.attributes.name : undefined;
    } else if (depth === 1) {
      const allowed = policy.attributes(operation, tag.name);
      if (Object.keys(tag.attributes).some((attribute) => !allowed.includes(attribute))) {
        reject('field-attributes', tag.name);
      }
      if ((fields.has(tag.name) || currentField === tag.name) && !policy.repeatable(operation, tag.name)) {
        reject('duplicate-field', tag.name);
      }
      currentField = tag.name;
      currentAttributes = { ...tag.attributes };
      currentValue = '';
    } else {
      reject('unexpected-field', tag.name);
    }
    depth += 1;
  });
  parser.on('text', (text: string) => {
    if (depth === 2 && currentField) {
      currentValue += text;
    } else if (text.trim()) {
      reject('mixed-content');
    }
  });
  parser.on('cdata', () => reject('mixed-content'));
  parser.on('closetag', () => {
    if (depth === 2 && currentField) {
      fields.set(currentField, currentValue.trim());
      elements.push({ name: currentField, attributes: currentAttributes, value: currentValue.trim() });
      currentField = undefined;
      currentAttributes = {};
      currentValue = '';
    }
    depth -= 1;
    if (depth < 0) {
      reject('malformed-xml');
    }
  });

  try {
    parser.write(segment).close();
  } catch {
    reject('malformed-xml');
  }
  if (rootCount !== 1 || depth !== 0) {
    reject('malformed-xml');
  }
  if (rejection) {
    return operation ? { ...rejection, operation } : rejection;
  }
  return { kind: 'call', operation, fields, elements };
}
