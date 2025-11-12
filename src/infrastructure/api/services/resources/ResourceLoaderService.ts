/**
 * ResourceLoaderService
 *
 * Single Responsibility: Load and manage prompts, guides, and guide registry
 *
 * This service provides lazy-loaded access to shared resources used by AI tools.
 * Resources are loaded once and cached for the lifetime of the service.
 */

import * as vscode from 'vscode';
import { PromptLoader } from '../../../../tools/shared/prompts';
import { GuideLoader } from '../../../../tools/shared/guides';
import { GuideRegistry } from '../../../guides/GuideRegistry';

export class ResourceLoaderService {
  private promptLoader?: PromptLoader;
  private guideLoader?: GuideLoader;
  private guideRegistry?: GuideRegistry;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  /**
   * Get the prompt loader instance (lazy initialization)
   *
   * @returns PromptLoader instance
   */
  getPromptLoader(): PromptLoader {
    this.ensureLoaded();
    return this.promptLoader!;
  }

  /**
   * Get the guide loader instance (lazy initialization)
   *
   * @returns GuideLoader instance
   */
  getGuideLoader(): GuideLoader {
    this.ensureLoaded();
    return this.guideLoader!;
  }

  /**
   * Get the guide registry instance (lazy initialization)
   *
   * @returns GuideRegistry instance
   */
  getGuideRegistry(): GuideRegistry {
    this.ensureLoaded();
    return this.guideRegistry!;
  }

  /**
   * Ensure all resources are loaded (lazy initialization pattern)
   *
   * This method is called automatically by the getter methods.
   * Resources are loaded once and cached for performance.
   */
  private ensureLoaded(): void {
    if (!this.promptLoader) {
      this.promptLoader = new PromptLoader(this.extensionUri);
    }

    if (!this.guideLoader) {
      this.guideLoader = new GuideLoader(this.extensionUri);
    }

    if (!this.guideRegistry) {
      this.guideRegistry = new GuideRegistry(this.extensionUri, this.outputChannel);
    }
  }

  /**
   * Dispose of resources (cleanup)
   *
   * Currently a no-op as resources don't require cleanup,
   * but provided for future extensibility.
   */
  dispose(): void {
    // No-op: PromptLoader, GuideLoader, and GuideRegistry don't require cleanup
  }
}
