/**
 * The Workshop's adapter for provider-native function calls.
 *
 * A persona asks for a capability by writing a `<prose-minion-tool-call>`
 * XML request in its reply. Some models, above all when the request also
 * carries a provider tool such as web search, send the same request as a
 * structured tool call instead. This module rewrites such a call as the
 * exact XML envelope the persona should have written. It runs nothing and
 * validates nothing: `WorkshopCapabilityXmlCodec` decodes the envelope
 * exactly as it decodes typed XML, and stays the one validator.
 *
 * The mapping is closed:
 * - the call's name must be an operation in `WORKSHOP_CAPABILITY_OPERATIONS`
 *   (letter case and the separators `.`, `-`, `_` aside, since a provider's
 *   function names may not carry a dot);
 * - each argument must be a field of that operation's grammar
 *   (`WORKSHOP_NATIVE_CALL_FIELDS`), written under the field's own name or,
 *   for a field that repeats, its listed plural;
 * - a value is text or a number; a repeating field also takes a list; a
 *   field with attributes also takes an object of its text and attributes;
 * - a repeating field's list may arrive as text holding a JSON array, which
 *   is how a live model sent several paths (2026-11-17). It is read as that
 *   list, and each item is still the codec's to check.
 * Anything else is untranslatable, by a fault kind that carries no model
 * text. So is a call the provider boundary marked with a `fault`. The envelope is built by escaping every value, never by joining raw
 * model text, so no argument can add a field, close the call or open another.
 */

import {
  WORKSHOP_CAPABILITY_OPERATIONS,
  type WorkshopCapabilityOperation
} from '@shared/types/workshopCapabilities';

export interface WorkshopNativeCallFieldRule {
  /** The field may appear more than once: an argument may be a list. */
  readonly repeatable?: boolean;
  /** Another argument name read as this field (a repeating field's plural). */
  readonly plural?: string;
  /** Attributes the field's element may carry. */
  readonly attributes?: readonly string[];
  /** In an object value, the keys that may hold the element's text; the field's own name always may. */
  readonly textKeys?: readonly string[];
}

const TEXT: WorkshopNativeCallFieldRule = {};
const DICTIONARY_FIELDS = { word: TEXT, context: TEXT, purpose: TEXT };

/**
 * Every field each operation's XML grammar defines. Keyed by the closed
 * operation list, so a new operation does not compile until its fields are
 * listed; a test holds each entry to the codec's own field policy.
 */
/* eslint-disable @typescript-eslint/naming-convention -- keyed by the operations' own names. */
export const WORKSHOP_NATIVE_CALL_FIELDS: Readonly<Record<
  WorkshopCapabilityOperation,
  Readonly<Record<string, WorkshopNativeCallFieldRule>>
>> = {
  'dictionary.lookup': DICTIONARY_FIELDS,
  'dictionary.full-entry': DICTIONARY_FIELDS,
  'analysis.run': { toolId: TEXT, excerptMode: TEXT, excerptText: TEXT, contextMode: TEXT, contextText: TEXT },
  'resource.catalog': { group: TEXT },
  'resource.search': { query: TEXT, group: TEXT },
  'resource.read': {
    group: TEXT,
    path: { repeatable: true, plural: 'paths', attributes: ['group'] },
    startLine: TEXT,
    endLine: TEXT
  },
  'transcript.catalog': { persona: TEXT, match: TEXT },
  'transcript.search': { query: TEXT, session: TEXT, persona: TEXT },
  'transcript.read': {
    session: { repeatable: true, plural: 'sessions', attributes: ['turns'], textKeys: ['id'] },
    turns: TEXT,
    detail: TEXT
  },
  'transcript.todos': { status: TEXT, recent: TEXT, session: TEXT, match: TEXT, source: TEXT, persona: TEXT },
  'transcript.bookmarks': {
    bookmark: TEXT,
    from: TEXT,
    scope: TEXT,
    recent: TEXT,
    session: { repeatable: true, plural: 'sessions' },
    match: TEXT,
    persona: TEXT,
    query: TEXT,
    speaker: TEXT,
    since: TEXT,
    until: TEXT
  },
  'memory.catalog': { kind: TEXT, page: TEXT },
  'memory.search': { query: TEXT, status: TEXT },
  'memory.read': { memory: { repeatable: true, plural: 'memories' } },
  'help.search': { query: TEXT },
  'help.read': { section: { repeatable: true, plural: 'sections' } },
  'lens.catalog': { page: TEXT },
  'lens.read': { lens: TEXT, section: { repeatable: true, plural: 'sections' } },
  'history.log': { group: TEXT, path: TEXT, page: TEXT },
  'history.diff': { group: TEXT, path: TEXT, from: TEXT, to: TEXT, startChange: TEXT, current: TEXT }
};
/* eslint-enable @typescript-eslint/naming-convention */

/** Why a native call has no XML form. Log-safe: never the name, an argument or a value. */
export type WorkshopNativeToolCallFault =
  | 'malformed-call'
  | 'oversized-call'
  | 'unknown-name'
  | 'unparseable-arguments'
  | 'arguments-not-object'
  | 'unmapped-argument'
  | 'duplicate-argument'
  | 'unmappable-value';

export type WorkshopNativeToolCallTranslation =
  | { readonly kind: 'translated'; readonly operation: WorkshopCapabilityOperation; readonly envelope: string }
  | { readonly kind: 'untranslatable'; readonly fault: WorkshopNativeToolCallFault };

/** An operation name with case and separators set aside: `transcript_catalog` is `transcript.catalog`. */
const foldName = (name: string): string => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

const OPERATIONS_BY_FOLDED_NAME: ReadonlyMap<string, WorkshopCapabilityOperation> = new Map(
  WORKSHOP_CAPABILITY_OPERATIONS.map((operation) => [foldName(operation), operation])
);

/** The closed operation a native call names, if it names one. */
export function workshopNativeCallOperation(name: string): WorkshopCapabilityOperation | undefined {
  return OPERATIONS_BY_FOLDED_NAME.get(foldName(name));
}

const escapeText = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** Attribute values also escape the quote, and the whitespace XML would otherwise fold to a space. */
const escapeAttribute = (value: string): string => escapeText(value)
  .replace(/"/g, '&quot;')
  .replace(/\t/g, '&#9;')
  .replace(/\n/g, '&#10;')
  .replace(/\r/g, '&#13;');

interface Element {
  readonly name: string;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
  readonly text: string;
}

class Untranslatable extends Error {
  constructor(readonly fault: WorkshopNativeToolCallFault) {
    super(fault);
  }
}

/** Text or a finite number, as the text a persona would have typed. */
function scalar(value: unknown): string {
  if (typeof value === 'string') {return value;}
  if (typeof value === 'number' && Number.isFinite(value)) {return String(value);}
  throw new Untranslatable('unmappable-value');
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One element from one value: text, or for a field with attributes an object of its text and attributes. */
function element(name: string, rule: WorkshopNativeCallFieldRule, value: unknown): Element {
  if (!isPlainObject(value)) {
    return { name, attributes: [], text: scalar(value) };
  }
  const allowedAttributes = rule.attributes ?? [];
  if (allowedAttributes.length === 0) {
    throw new Untranslatable('unmappable-value');
  }
  const textKeys = [name, ...(rule.textKeys ?? [])];
  let text: string | undefined;
  const attributes: Array<readonly [string, string]> = [];
  for (const [key, inner] of Object.entries(value)) {
    if (inner === null || inner === undefined) {continue;}
    if (textKeys.includes(key)) {
      if (text !== undefined) {throw new Untranslatable('duplicate-argument');}
      text = scalar(inner);
    } else if (allowedAttributes.includes(key)) {
      attributes.push([key, scalar(inner)]);
    } else {
      throw new Untranslatable('unmapped-argument');
    }
  }
  if (text === undefined) {throw new Untranslatable('unmappable-value');}
  return { name, attributes, text };
}

/**
 * A list a model wrote as text: `"[\"a.md\", \"b.md\"]"` where the wire wanted an
 * array. Only text that is a whole JSON array is read so; anything else, a
 * name that merely opens with a bracket included, stays the one value it is.
 */
function listWrittenAsText(value: unknown): unknown[] | undefined {
  if (typeof value !== 'string' || !value.trimStart().startsWith('[')) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function elementsOf(
  fields: Readonly<Record<string, WorkshopNativeCallFieldRule>>,
  args: Record<string, unknown>
): Element[] {
  const elements: Element[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(args)) {
    // Own keys only: `constructor` and its kin are never fields.
    const name = Object.prototype.hasOwnProperty.call(fields, key)
      ? key
      : Object.keys(fields).find((field) => fields[field].plural === key);
    if (name === undefined) {throw new Untranslatable('unmapped-argument');}
    // An optional argument a model fills with null is one it left out.
    if (value === null || value === undefined) {continue;}
    if (seen.has(name)) {throw new Untranslatable('duplicate-argument');}
    seen.add(name);
    const rule = fields[name];
    if (Array.isArray(value) && !rule.repeatable) {
      throw new Untranslatable('unmappable-value');
    }
    const list = Array.isArray(value) ? value : rule.repeatable ? listWrittenAsText(value) : undefined;
    if (list) {
      elements.push(...list.map((item) => element(name, rule, item)));
    } else {
      elements.push(element(name, rule, value));
    }
  }
  return elements;
}

function parseArguments(raw: string): Record<string, unknown> {
  // A call with no arguments arrives as an empty string from some providers.
  if (!raw.trim()) {return {};}
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Untranslatable('unparseable-arguments');
  }
  if (!isPlainObject(parsed)) {throw new Untranslatable('arguments-not-object');}
  return parsed;
}

const render = (operation: WorkshopCapabilityOperation, elements: readonly Element[]): string => [
  `<prose-minion-tool-call name="${escapeAttribute(operation)}">`,
  ...elements.map(({ name, attributes, text }) =>
    `  <${name}${attributes.map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join('')}>${escapeText(text)}</${name}>`),
  '</prose-minion-tool-call>'
].join('\n');

/** One native call as the XML request it stands for, or why it has none. */
export function translateWorkshopNativeToolCall(
  call: { readonly name: string; readonly arguments: string; readonly fault?: 'malformed' | 'oversized' }
): WorkshopNativeToolCallTranslation {
  // A call the provider boundary marked is refused before anything is read: its empty
  // arguments stand for a payload that was dropped, never for "no arguments" (PR #267 F-01).
  if (call.fault) {
    return { kind: 'untranslatable', fault: call.fault === 'oversized' ? 'oversized-call' : 'malformed-call' };
  }
  const operation = workshopNativeCallOperation(call.name);
  if (!operation) {
    return { kind: 'untranslatable', fault: 'unknown-name' };
  }
  try {
    const elements = elementsOf(WORKSHOP_NATIVE_CALL_FIELDS[operation], parseArguments(call.arguments));
    return { kind: 'translated', operation, envelope: render(operation, elements) };
  } catch (error) {
    if (error instanceof Untranslatable) {
      return { kind: 'untranslatable', fault: error.fault };
    }
    throw error;
  }
}

/**
 * What a persona is told when its reply held more native calls than the one
 * that ran. The XML wire carries one request a reply, so only the first is
 * translated; the rest are said plainly, never run and never dropped in silence.
 */
export function workshopUnrunNativeCallsNote(count: number): string {
  return `Your reply held ${count} more tool ${count === 1 ? 'call' : 'calls'} after this one. ` +
    `${count === 1 ? 'It was' : 'They were'} not run: a reply carries one capability request. ` +
    'If you still need one, send it as its own <prose-minion-tool-call> XML request and wait for its result.';
}
