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
   * Supports both formats:
   * - Single tag with array: <guide-request path=["path1", "path2"] />
   * - Multiple tags: <guide-request path=["path1"] /> <guide-request path=["path2"] />
   */
  static parse(aiResponse: string): ResourceRequest {
    const guideRequestRegex = /<guide-request\s+path=\[(.*?)\]\s*\/>/gi;
    const matches = Array.from(aiResponse.matchAll(guideRequestRegex));

    if (matches.length === 0) {
      return {
        hasGuideRequest: false,
        requestedGuides: []
      };
    }

    // Collect paths from all matched tags
    const allPaths: string[] = [];
    for (const match of matches) {
      const pathArrayString = match[1];
      const paths = this.parsePathArray(pathArrayString);
      allPaths.push(...paths);
    }

    // De-duplicate paths (in case AI requests same guide multiple times)
    const uniquePaths = Array.from(new Set(allPaths));

    // Detect unexpected format usage for monitoring
    if (matches.length > 1) {
      console.log(
        `[ResourceRequestParser] AI used ${matches.length} separate guide-request tags ` +
        `instead of single tag with array. Extracted ${uniquePaths.length} unique guides.`
      );
    }

    // Warn if de-duplication removed paths
    if (allPaths.length !== uniquePaths.length) {
      console.log(
        `[ResourceRequestParser] De-duplicated ${allPaths.length - uniquePaths.length} ` +
        `duplicate guide request(s)`
      );
    }

    return {
      hasGuideRequest: uniquePaths.length > 0,
      requestedGuides: uniquePaths
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
