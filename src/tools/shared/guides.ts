/**
 * Craft guide loading utilities
 * Loads writing craft guides from markdown files
 */

import * as vscode from 'vscode';

export class GuideLoader {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Load a craft guide from a markdown file
   * @param guidePath Can be either:
   *   - Simple name: "dialogue-tags" (assumes root + .md extension)
   *   - Full path: "scene-example-guides/basketball-game.md"
   */
  async loadGuide(guidePath: string): Promise<string> {
    // Determine if this is a simple name or a full path
    const isFullPath = guidePath.includes('/') || guidePath.endsWith('.md');

    let fullPath: vscode.Uri;
    if (isFullPath) {
      // Use path as-is (from GuideRegistry)
      fullPath = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        guidePath
      );
    } else {
      // Legacy behavior: assume root level and add .md extension
      fullPath = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        `${guidePath}.md`
      );
    }

    try {
      const content = await vscode.workspace.fs.readFile(fullPath);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      console.error(`Failed to load guide: ${guidePath}`, error);
      throw new Error(`Failed to load guide: ${guidePath}`);
    }
  }

  /**
   * Load multiple guides and concatenate them
   */
  async loadGuides(guideNames: string[]): Promise<string> {
    const guides = await Promise.all(
      guideNames.map(name => this.loadGuide(name))
    );
    return guides.join('\n\n---\n\n');
  }
}
