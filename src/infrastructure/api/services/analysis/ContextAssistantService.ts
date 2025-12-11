/**
 * ContextAssistantService
 *
 * Single Responsibility: Wrap ContextAssistant for AI-powered context generation
 *
 * This service provides a clean interface for context generation:
 * - Generates scene/character/setting context from writing excerpts
 * - Integrates with resource providers (files, globs, snippets)
 * - Supports conversation continuity and streaming
 * - Handles source file priming for context-aware generation
 *
 * This wrapper:
 * - Centralizes context tool orchestration
 * - Handles AI resource management and initialization
 * - Manages resource provider creation and resolution
 * - Provides clean extension point for context features
 */

import * as vscode from 'vscode';
import { ContextAssistant } from '@/tools/assist/contextAssistant';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { ResourceLoaderService } from '@orchestration/ResourceLoaderService';
import { ToolOptionsProvider } from '../shared/ToolOptionsProvider';
import {
  ContextGenerationRequest,
  ContextGenerationResult,
  ContextResourceProvider,
  DEFAULT_CONTEXT_GROUPS
} from '@/domain/models/ContextGeneration';
import { ContextPathGroup } from '@shared/types';
import { StreamingTokenCallback } from '@orchestration/AIResourceOrchestrator';

/**
 * Options for streaming context generation operations
 */
export interface ContextStreamingOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback for streaming tokens (enables streaming mode) */
  onToken?: StreamingTokenCallback;
}

/**
 * Service wrapper for AI-powered context generation
 *
 * Provides context generation capabilities:
 * - Scene context (setting, mood, atmosphere)
 * - Character context (traits, motivations, relationships)
 * - Plot context (events, conflicts, goals)
 * - Resource integration (files, globs, custom content)
 * - Conversation streaming and continuity
 */
export class ContextAssistantService {
  private contextAssistant?: ContextAssistant;
  private contextResourceResolver: ContextResourceResolver;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly resourceLoader: ResourceLoaderService,
    private readonly toolOptions: ToolOptionsProvider,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.contextResourceResolver = new ContextResourceResolver(this.outputChannel);

    // Context assistant will be initialized when AI resources are available
    void this.initializeContextAssistant();
  }

  /**
   * Initialize context assistant with AI orchestrator
   *
   * Called during construction and when configuration changes
   */
  private async initializeContextAssistant(): Promise<void> {
    // Wait for AI resources to be initialized
    await this.aiResourceManager.initializeResources();

    // Get context orchestrator from AIResourceManager
    const orchestrator = this.aiResourceManager.getOrchestrator('context');

    if (orchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();

      // Initialize context assistant
      this.contextAssistant = new ContextAssistant(orchestrator, promptLoader);
    } else {
      // No orchestrator available (no API key configured)
      this.contextAssistant = undefined;
    }
  }

  /**
   * Reinitialize context assistant after configuration changes
   *
   * Should be called when model selections or API key changes
   * SPRINT 05 FIX: Always reinitialize after AIResourceManager refresh
   * (comparison was failing because resolvedModel was already updated)
   */
  async refreshConfiguration(): Promise<void> {
    // Always reinitialize to get the latest orchestrator from AIResourceManager
    await this.initializeContextAssistant();
  }

  /**
   * Generate context using AI assistant
   *
   * @param request - Context generation request with excerpt and options
   * @param streamingOptions - Optional streaming configuration (signal, onToken)
   * @returns Context generation result with content and resource metadata
   */
  async generateContext(
    request: ContextGenerationRequest,
    streamingOptions?: ContextStreamingOptions
  ): Promise<ContextGenerationResult> {
    // Ensure context assistant is initialized with correct model
    await this.refreshConfiguration();

    if (!this.contextAssistant) {
      return {
        toolName: 'context_assistant',
        content: this.getApiKeyWarning(),
        timestamp: new Date()
      };
    }

    try {
      // Use requested groups or default groups
      const groups = (request.requestedGroups && request.requestedGroups.length > 0)
        ? request.requestedGroups
        : [...DEFAULT_CONTEXT_GROUPS];

      // Create resource provider for context groups
      const resourceProvider = await this.createContextResourceProvider(groups);

      // Try to read the full source document if provided, to prime the model
      let sourceContent: string | undefined;
      if (request.sourceFileUri) {
        try {
          const uri = vscode.Uri.parse(request.sourceFileUri);
          const raw = await vscode.workspace.fs.readFile(uri);
          sourceContent = Buffer.from(raw).toString('utf8');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.outputChannel?.appendLine(
            `[ContextAssistantService] Failed to read source file for context: ${message}`
          );
        }
      }

      // Get options from ToolOptionsProvider
      const toolOptions = this.toolOptions.getOptions();

      // Log streaming status for transparency
      const isStreaming = !!streamingOptions?.onToken;
      this.outputChannel?.appendLine(
        `[ContextAssistantService] Context Generation - Streaming: ${isStreaming}`
      );

      // Generate context with assistant
      const executionResult = await this.contextAssistant.generate(
        {
          excerpt: request.excerpt,
          existingContext: request.existingContext,
          sourceFileUri: request.sourceFileUri,
          sourceContent,
          requestedGroups: groups
        },
        {
          resourceProvider,
          temperature: toolOptions.temperature,
          maxTokens: toolOptions.maxTokens,
          signal: streamingOptions?.signal,
          onToken: streamingOptions?.onToken
        }
      );

      // Note: orchestrator now catches AbortError internally and returns partial content
      // The executionResult.content will contain whatever was received before cancellation
      return {
        toolName: 'context_assistant',
        content: executionResult.content,
        timestamp: new Date(),
        requestedResources: executionResult.requestedResources,
        usage: executionResult.usage
      };
    } catch (error) {
      // AbortError is now caught in the orchestrator, so this is only for other errors
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[ContextAssistantService] Context generation error: ${message}`);

      return {
        toolName: 'context_assistant',
        content: `Error generating context: ${message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Create context resource provider from path groups
   *
   * @param groups - Context path groups (files, globs, custom content)
   * @returns Resource provider for context generation
   */
  private async createContextResourceProvider(
    groups: ContextPathGroup[]
  ): Promise<ContextResourceProvider> {
    return await this.contextResourceResolver.createProvider(groups);
  }

  /**
   * Get warning message for missing API key
   */
  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered context generation, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Click the ⚙️ gear icon at the top of the Prose Minion view
3. Enter your API key in the "OpenRouter API Key" field
4. Click Save
5. Select your preferred models for assistants and utilities

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
