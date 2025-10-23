/**
 * Shared types for text source selection used by metrics tools.
 */

export type TextSourceMode = 'activeFile' | 'manuscript' | 'chapters' | 'selection';

export interface TextSourceSpec {
  mode: TextSourceMode;
  /**
   * User-edited path text.
   * - activeFile: single workspace-relative or absolute path to a file.
   * - manuscript: comma-separated glob patterns.
   * - selection: expected to be the literal "[selected text]"; other values are treated as invalid.
   */
  pathText?: string;
}

export interface ResolvedTextSource {
  text: string;
  /**
   * Workspace-relative paths included in the resolution.
   */
  relativePaths: string[];
  /**
   * Optional display string for UI/debugging.
   */
  displayPath?: string;
}
