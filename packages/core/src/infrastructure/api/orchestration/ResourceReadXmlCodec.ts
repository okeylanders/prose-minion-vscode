import { SaxesParser, SaxesTagPlain } from 'saxes';

export interface ResourceReadRequest {
  readonly operation: 'resource.read';
  readonly paths: readonly string[];
}

const TOOL_CALL_ROOT = 'prose-minion-tool-call';
const RESOURCE_READ_OPERATION = 'resource.read';

/**
 * The one provider-neutral instruction appended immediately after a resource
 * catalog. Catalogs own their allow-list; this only defines the wire.
 */
export const RESOURCE_READ_XML_INSTRUCTION = [
  '## Resource Request Protocol',
  '',
  'If you need catalog resources before answering, respond with exactly one XML document and no prose before or after it:',
  '',
  '```xml',
  '<prose-minion-tool-call name="resource.read">',
  '  <paths>',
  '    <path>allow-listed/path.md</path>',
  '  </paths>',
  '</prose-minion-tool-call>',
  '```',
  '',
  'Request only exact paths from the catalog shown above. If no resources are needed, provide the final response instead.'
].join('\n');

/**
 * Strict decoder for the closed, initial resource-read operation. Saxes is a
 * direct XML dependency rather than a permissive regular-expression parser.
 */
export class ResourceReadXmlCodec {
  parseExactRequest(candidate: string): ResourceReadRequest | undefined {
    const source = candidate.trim();
    if (!source) return undefined;

    let invalid = false;
    let depth = 0;
    let rootCount = 0;
    let pathsElementCount = 0;
    let operation: string | undefined;
    let currentPath: string | undefined;
    const paths: string[] = [];
    const parser = new SaxesParser();

    parser.on('error', () => { invalid = true; });
    parser.on('xmldecl', () => { invalid = true; });
    parser.on('processinginstruction', () => { invalid = true; });
    parser.on('doctype', () => { invalid = true; });
    parser.on('comment', () => { invalid = true; });
    parser.on('opentag', (tag: SaxesTagPlain) => {
      const attributes = tag.attributes;
      if (depth === 0) {
        rootCount += 1;
        if (tag.name !== TOOL_CALL_ROOT || Object.keys(attributes).length !== 1 || attributes.name !== RESOURCE_READ_OPERATION) {
          invalid = true;
        }
        operation = attributes.name;
      } else if (depth === 1) {
        if (tag.name !== 'paths' || Object.keys(attributes).length !== 0) invalid = true;
        pathsElementCount += 1;
      } else if (depth === 2) {
        if (tag.name !== 'path' || Object.keys(attributes).length !== 0) invalid = true;
        currentPath = '';
      } else {
        invalid = true;
      }
      depth += 1;
    });
    parser.on('text', (text: string) => {
      if (depth === 3 && currentPath !== undefined) {
        currentPath += text;
      } else if (text.trim()) {
        invalid = true;
      }
    });
    parser.on('cdata', (text: string) => {
      if (depth === 3 && currentPath !== undefined) {
        currentPath += text;
      } else {
        invalid = true;
      }
    });
    parser.on('closetag', () => {
      if (depth === 3 && currentPath !== undefined) {
        paths.push(currentPath.trim());
        currentPath = undefined;
      }
      depth -= 1;
      if (depth < 0) invalid = true;
    });

    try {
      parser.write(source).close();
    } catch {
      invalid = true;
    }

    if (
      invalid ||
      rootCount !== 1 ||
      depth !== 0 ||
      operation !== RESOURCE_READ_OPERATION ||
      pathsElementCount !== 1 ||
      paths.length === 0 ||
      paths.some(path => !path) ||
      new Set(paths).size !== paths.length
    ) {
      return undefined;
    }

    return { operation: RESOURCE_READ_OPERATION, paths };
  }

  /** The only content that is executable as a resource call is never visible. */
  stripExactRequest(content: string): string {
    if (this.parseExactRequest(content)) return '';

    // An invalid or mixed response is not a call. Hide protocol-shaped markup
    // rather than letting an unexecutable request become visible chat content.
    // Structural parsing remains exclusively SAX-based above; this is a
    // conservative display guard, not an XML parser.
    return content.includes(`<${TOOL_CALL_ROOT}`) ? '' : content.trim();
  }
}
