import { SaxesParser, SaxesTagPlain } from 'saxes';

export interface ResourceReadRequest {
  readonly operation: 'resource.read';
  readonly paths: readonly string[];
}

export type ResourceReadRejectionReason =
  | 'xml-declaration'
  | 'processing-instruction'
  | 'doctype'
  | 'comment'
  | 'malformed-xml'
  | 'unexpected-root'
  | 'invalid-root-attributes'
  | 'unexpected-element'
  | 'element-attributes'
  | 'mixed-content'
  | 'duplicate-paths-container'
  | 'empty-path'
  | 'duplicate-path'
  | 'path-not-allowlisted';

export type ResourceReadInspection =
  | { readonly kind: 'none' }
  | { readonly kind: 'request'; readonly request: ResourceReadRequest }
  | {
      readonly kind: 'invalid';
      readonly reason: ResourceReadRejectionReason;
      readonly pathCount?: number;
      readonly allowlistedPathCount?: number;
    };

const TOOL_CALL_ROOT = 'prose-minion-tool-call';
const RESOURCE_READ_OPERATION = 'resource.read';

/**
 * Disambiguates BROKEN protocol-shaped tails only; a valid tail call is
 * accepted regardless of preamble length. Below this depth, unparseable
 * tag-shaped text is a failed call attempt (correction turn); deeper, it is
 * a genuine answer mentioning the protocol, and an answer must never be
 * discarded in favor of a correction turn.
 */
const MAX_TOLERATED_PREAMBLE_CHARS = 500;

/**
 * The first protocol marker that could be an invocation rather than a
 * mention. A marker immediately preceded by a backtick is inline-code
 * quotation — a genuine answer explaining the protocol — and is never
 * executable. Returns -1 when only mentions (or nothing) exist.
 */
export const findExecutableMarkerIndex = (source: string): number => {
  for (const match of source.matchAll(/<\s*\/?\s*prose-minion-tool-call\b/gi)) {
    const index = match.index ?? 0;
    if (index === 0 || source[index - 1] !== '`') {
      return index;
    }
  }
  return -1;
};

const escapeXmlText = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * The one provider-neutral instruction appended immediately after a resource
 * catalog. Catalogs supply an actual displayed key so the model can copy one
 * opaque identifier rather than trying to assemble a directory and filename.
 */
export const createResourceReadXmlInstruction = (examplePath?: string): string => {
  if (!examplePath) {
    return [
      '## Resource Request Protocol',
      '',
      'This catalog contains no resource keys. Do not send XML or narrate a lookup; provide the complete final response now.'
    ].join('\n');
  }

  return [
    '## Resource Request Protocol',
    '',
    'There are only two valid response shapes:',
    '',
    '1. If you need catalog resources, respond with exactly one bare XML document and no prose, Markdown fence, or other characters before or after it:',
    '',
    '<prose-minion-tool-call name="resource.read">',
    '  <paths>',
    `    <path>${escapeXmlText(examplePath)}</path>`,
    '  </paths>',
    '</prose-minion-tool-call>',
    '',
    'The value inside each `<path>` is one complete opaque resource key copied verbatim from the catalog: its directory/path and filename stay together. Do not construct it from a label, group, workspace name, directory, or filename.',
    '',
    '2. If you do not need catalog resources, provide the complete final response now.',
    '',
    'Never narrate an intended lookup or a future action (for example, “Let me pull guides” or “I will check the files”). You cannot access a catalog resource unless you send the exact XML document above.',
    '',
    'Request only exact paths from the catalog shown above. After resource evidence is supplied, provide the complete final response rather than another plan.'
  ].join('\n');
};

/** Default export for consumers that do not have a catalog example available. */
export const RESOURCE_READ_XML_INSTRUCTION = createResourceReadXmlInstruction();

/**
 * Decoder for the closed, initial resource-read operation. Saxes is a direct
 * XML dependency rather than a permissive regular-expression parser. The
 * prompt instruction stays strict (one bare XML document); the decoder
 * additionally tolerates preamble and fence garnish around a valid tail call
 * so faster models that narrate before complying are not rejected.
 */
export class ResourceReadXmlCodec {
  inspect(candidate: string): ResourceReadInspection {
    const source = candidate.trim();
    if (!source) {
      return { kind: 'none' };
    }

    // A backtick-quoted marker is a mention, never a call (skipped above).
    const markerIndex = findExecutableMarkerIndex(source);
    if (markerIndex === -1) {
      return { kind: 'none' };
    }

    // The prompt demands one bare XML document, but faster models narrate at
    // length before complying. Tolerate exactly that garnish: discard
    // everything before the first executable marker plus one trailing fence
    // close, then parse the remaining tail as a single strict tool-call
    // document. A VALID tail is accepted no matter how long the preamble —
    // the complete well-formed document at the end of the response is itself
    // the structural evidence of intent, and it heals in-turn without
    // burning the correction budget. Any content after the closing tag still
    // rejects, so protocol markup quoted mid-prose remains non-executable.
    const segment = source.slice(markerIndex).replace(/\s*```\s*$/, '').trim();

    const closingTag = '</prose-minion-tool-call>';
    const closingTagIndex = segment.toLowerCase().lastIndexOf(closingTag);
    let rejectionReason: ResourceReadRejectionReason | undefined;
    if (closingTagIndex !== -1 && segment.slice(closingTagIndex + closingTag.length).trim()) {
      rejectionReason = 'mixed-content';
    }
    const reject = (reason: ResourceReadRejectionReason): void => {
      rejectionReason ??= reason;
    };
    let depth = 0;
    let rootCount = 0;
    let pathsElementCount = 0;
    let operation: string | undefined;
    let currentPath: string | undefined;
    const paths: string[] = [];
    const parser = new SaxesParser();

    parser.on('error', () => { reject('malformed-xml'); });
    parser.on('xmldecl', () => { reject('xml-declaration'); });
    parser.on('processinginstruction', () => { reject('processing-instruction'); });
    parser.on('doctype', () => { reject('doctype'); });
    parser.on('comment', () => { reject('comment'); });
    parser.on('opentag', (tag: SaxesTagPlain) => {
      const attributes = tag.attributes;
      if (depth === 0) {
        rootCount += 1;
        if (tag.name !== TOOL_CALL_ROOT) {
          reject('unexpected-root');
        }
        if (Object.keys(attributes).length !== 1 || attributes.name !== RESOURCE_READ_OPERATION) {
          reject('invalid-root-attributes');
        }
        operation = attributes.name;
      } else if (depth === 1) {
        if (tag.name !== 'paths') {
          reject('unexpected-element');
        }
        if (Object.keys(attributes).length !== 0) {
          reject('element-attributes');
        }
        pathsElementCount += 1;
        if (pathsElementCount > 1) {
          reject('duplicate-paths-container');
        }
      } else if (depth === 2) {
        if (tag.name !== 'path') {
          reject('unexpected-element');
        }
        if (Object.keys(attributes).length !== 0) {
          reject('element-attributes');
        }
        currentPath = '';
      } else {
        reject('unexpected-element');
      }
      depth += 1;
    });
    parser.on('text', (text: string) => {
      if (depth === 3 && currentPath !== undefined) {
        currentPath += text;
      } else if (text.trim()) {
        reject('mixed-content');
      }
    });
    parser.on('cdata', (text: string) => {
      if (depth === 3 && currentPath !== undefined) {
        currentPath += text;
      } else {
        reject('mixed-content');
      }
    });
    parser.on('closetag', () => {
      if (depth === 3 && currentPath !== undefined) {
        paths.push(currentPath.trim());
        currentPath = undefined;
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
    if (operation !== RESOURCE_READ_OPERATION) {
      reject('invalid-root-attributes');
    }
    if (pathsElementCount !== 1) {
      reject(pathsElementCount > 1 ? 'duplicate-paths-container' : 'unexpected-element');
    }
    if (paths.length === 0 || paths.some(path => !path)) {
      reject('empty-path');
    }
    if (new Set(paths).size !== paths.length) {
      reject('duplicate-path');
    }

    if (rejectionReason) {
      // A broken protocol-shaped tail near the top of the response is a
      // failed call attempt and earns the correction turn. The same broken
      // markup deeper than any plausible narration is a genuine answer that
      // happens to mention the protocol — classify it as prose so the
      // answer is delivered rather than traded for a correction.
      if (markerIndex > MAX_TOLERATED_PREAMBLE_CHARS) {
        return { kind: 'none' };
      }
      return { kind: 'invalid', reason: rejectionReason, pathCount: paths.length || undefined };
    }

    return {
      kind: 'request',
      request: { operation: RESOURCE_READ_OPERATION, paths }
    };
  }

  parseExactRequest(candidate: string): ResourceReadRequest | undefined {
    const inspection = this.inspect(candidate);
    return inspection.kind === 'request' ? inspection.request : undefined;
  }

  /**
   * A binary display gate, not a redactor: any protocol-shaped response —
   * a valid call (kind 'request') or a failed attempt (kind 'invalid') —
   * blanks to '' so no protocol markup or half-request reaches visible
   * chat. Ordinary prose (kind 'none', including answers that merely quote
   * the tag) passes through whole. Callers never receive a partial string.
   */
  hideIfProtocolShaped(content: string): string {
    const inspection = this.inspect(content);
    if (inspection.kind !== 'none') {
      return '';
    }
    return content.trim();
  }
}
