/**
 * Resource Request Parser - Application Layer
 * Parses AI responses for resource requests (guides, etc.)
 */

export interface ResourceRequest {
  hasGuideRequest: boolean;
  requestedGuides: string[];
}

export class ResourceRequestParser {
  /**
   * Parse an AI response for resource requests
   * Looks for: <guide-request path=["path1", "path2"] />
   */
  static parse(aiResponse: string): ResourceRequest {
    const guideRequestRegex = /<guide-request\s+path=\[(.*?)\]\s*\/>/i;
    const match = aiResponse.match(guideRequestRegex);

    if (!match) {
      return {
        hasGuideRequest: false,
        requestedGuides: []
      };
    }

    // Parse the path array from the match
    const pathArrayString = match[1];
    const requestedGuides = this.parsePathArray(pathArrayString);

    return {
      hasGuideRequest: requestedGuides.length > 0,
      requestedGuides
    };
  }

  /**
   * Parse the path array from the guide-request tag
   * Handles both single and double quotes
   */
  private static parsePathArray(pathArrayString: string): string[] {
    // Match quoted strings (single or double quotes)
    const quotedStringRegex = /["']([^"']+)["']/g;
    const paths: string[] = [];
    let match;

    while ((match = quotedStringRegex.exec(pathArrayString)) !== null) {
      paths.push(match[1].trim());
    }

    return paths;
  }

  /**
   * Strip all resource request tags from the response
   * This should be called before returning the final response to the user
   */
  static stripResourceTags(response: string): string {
    // Remove guide-request tags
    let cleaned = response.replace(/<guide-request\s+path=\[.*?\]\s*\/>/gi, '');

    // Remove any extra whitespace left behind
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    return cleaned;
  }

  /**
   * Extract guide display names from paths for UI display
   * Converts "scene-example-guides/basketball-game.md" to "Basketball Game"
   */
  static extractDisplayNames(guidePaths: string[]): string[] {
    return guidePaths.map(path => {
      // Get the filename without extension
      const filename = path.split('/').pop() || path;
      const nameWithoutExt = filename.replace(/\.md$/i, '');

      // Convert hyphens to spaces and capitalize
      return nameWithoutExt
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });
  }

  /**
   * Format guide names for status message display
   * Creates a comma-separated list for ticker animation
   */
  static formatGuideNamesForStatus(guidePaths: string[]): string {
    const displayNames = this.extractDisplayNames(guidePaths);
    return displayNames.join(', ');
  }
}
