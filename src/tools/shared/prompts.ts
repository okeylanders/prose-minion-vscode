/**
 * Prompt loading utilities
 * Loads system prompts from markdown files
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PromptLoader {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Load a system prompt from a markdown file
   */
  async loadPrompt(promptPath: string): Promise<string> {
    const fullPath = vscode.Uri.joinPath(
      this.extensionUri,
      'resources',
      'system-prompts',
      promptPath
    );

    try {
      const content = await vscode.workspace.fs.readFile(fullPath);
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
