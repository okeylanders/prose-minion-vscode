/**
 * Craft guide loading utilities
 * Loads writing craft guides from markdown files
 */

import * as vscode from 'vscode';

export class GuideLoader {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Load a craft guide from a markdown file
   */
  async loadGuide(guideName: string): Promise<string> {
    const fullPath = vscode.Uri.joinPath(
      this.extensionUri,
      'resources',
      'craft-guides',
      `${guideName}.md`
    );

    try {
      const content = await vscode.workspace.fs.readFile(fullPath);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      console.error(`Failed to load guide: ${guideName}`, error);
      throw new Error(`Failed to load guide: ${guideName}`);
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
