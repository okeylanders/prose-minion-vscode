/**
 * Craft guide loading utilities
 * Loads writing craft guides from markdown files
 */

import * as path from 'path';
import { FileSystem } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';

export class GuideLoader {
  constructor(
    private readonly extensionPath: string,
    private readonly fileSystem: FileSystem
  ) {}

  /**
   * Load a craft guide from a markdown file
   * @param guidePath Can be either:
   *   - Simple name: "dialogue-tags" (assumes root + .md extension)
   *   - Full path: "scene-example-guides/basketball-game.md"
   */
  async loadGuide(guidePath: string): Promise<string> {
    // Determine if this is a simple name or a full path
    const isFullPath = guidePath.includes('/') || guidePath.endsWith('.md');

    // Use path as-is (from GuideRegistry); legacy simple names get .md appended.
    const relative = isFullPath ? guidePath : `${guidePath}.md`;
    const root = path.join(this.extensionPath, 'resources', 'craft-guides');
    const fullPath = path.join(root, relative);

    // `guidePath` can originate from tool-orchestration / AI-named files, so a
    // `../` traversal must not escape the bundled craft-guides root (same guard
    // UIHandler applies to its guide/docs/resource opens).
    if (!isPathWithinRoot(root, fullPath)) {
      throw new Error(`Failed to load guide: ${guidePath}`);
    }

    try {
      const content = await this.fileSystem.readFile(fullPath);
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
