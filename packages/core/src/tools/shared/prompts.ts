/**
 * Prompt loading utilities
 * Loads system prompts from markdown files
 */

import * as path from 'path';
import { FileSystem } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';

export class PromptLoader {
  constructor(
    private readonly extensionPath: string,
    private readonly fileSystem: FileSystem
  ) {}

  /**
   * Load a system prompt from a markdown file
   */
  async loadPrompt(promptPath: string): Promise<string> {
    const root = path.join(this.extensionPath, 'resources', 'system-prompts');
    const fullPath = path.join(root, promptPath);

    // `promptPath` can originate from tool-orchestration / AI-named files, so a
    // `../` traversal must not escape the bundled system-prompts root (same guard
    // UIHandler applies to its guide/docs/resource opens).
    if (!isPathWithinRoot(root, fullPath)) {
      throw new Error(`Failed to load prompt: ${promptPath}`);
    }

    try {
      const content = await this.fileSystem.readFile(fullPath);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      console.error(`Failed to load prompt: ${promptPath}`, error);
      throw new Error(`Failed to load prompt: ${promptPath}`);
    }
  }

  /**
   * Load multiple prompts and concatenate them
   */
  async loadPrompts(promptPaths: string[]): Promise<string> {
    const prompts = await Promise.all(
      promptPaths.map(path => this.loadPrompt(path))
    );
    return prompts.join('\n\n---\n\n');
  }

  /**
   * Load shared prompts (used by all tools)
   * Currently no shared prompts exist - reserved for future use
   */
  async loadSharedPrompts(): Promise<string> {
    // Reserved for future shared prompts
    return '';
  }
}
