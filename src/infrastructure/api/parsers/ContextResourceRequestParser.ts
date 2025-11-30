/**
 * Parses AI responses for context resource requests.
 * Expected format: <context-request path=["path1", "path2"] />
 */

export interface ContextResourceRequest {
  hasResourceRequest: boolean;
  requestedPaths: string[];
}

export class ContextResourceRequestParser {
  private static readonly REQUEST_TAG = /<context-request\s+path=\[(.*?)\]\s*\/>/i;

  static parse(aiResponse: string): ContextResourceRequest {
    const match = aiResponse.match(this.REQUEST_TAG);

    if (!match) {
      return {
        hasResourceRequest: false,
        requestedPaths: []
      };
    }

    const requestedPaths = this.parsePathArray(match[1]);
    return {
      hasResourceRequest: requestedPaths.length > 0,
      requestedPaths
    };
  }

  static stripRequestTags(response: string): string {
    return response.replace(/<context-request\s+path=\[.*?\]\s*\/>/gi, '').trim();
  }

  private static parsePathArray(raw: string): string[] {
    const quotedStringRegex = /["']([^"']+)["']/g;
    const paths: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = quotedStringRegex.exec(raw)) !== null) {
      paths.push(match[1].trim());
    }

    return paths;
  }
}
