/**
 * AssistantToolService
 *
 * Single Responsibility: Wrap AI-powered assistant tools (dialogue and prose analysis)
 *
 * This service provides a unified interface for AI-powered content analysis:
 * - DialogueMicrobeatAssistant: Analyzes dialogue and suggests tags/action beats
 * - ProseAssistant: General prose analysis and improvement suggestions
 *
 * This wrapper:
 * - Centralizes assistant tool orchestration
 * - Handles AI resource management and initialization
 * - Provides clean extension point for analysis features
 * - Maintains consistent abstraction level across the codebase
 */

import * as vscode from 'vscode';
import { DialogueMicrobeatAssistant } from '../../../../tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '../../../../tools/assist/proseAssistant';
import { AIResourceManager } from '../resources/AIResourceManager';
import { ResourceLoaderService } from '../resources/ResourceLoaderService';
import { ToolOptionsProvider } from '../shared/ToolOptionsProvider';
import { AnalysisResult, AnalysisResultFactory } from '../../../../domain/models/AnalysisResult';

/**
 * Service wrapper for AI-powered assistant analysis
 *
 * Provides dialogue and prose analysis capabilities:
 * - Dialogue: Tags, microbeats, action beats with configurable focus
 * - Prose: Writing quality, style, and improvement suggestions
 * - Craft guides integration (optional)
 * - Context-aware analysis with source file tracking
 */
export class AssistantToolService {
  private dialogueAssistant?: DialogueMicrobeatAssistant;
  private proseAssistant?: ProseAssistant;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly resourceLoader: ResourceLoaderService,
    private readonly toolOptions: ToolOptionsProvider,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // Assistants will be initialized when AI resources are available
    void this.initializeAssistants();
  }

  /**
   * Initialize assistant tools with AI orchestrators
   *
   * Called during construction and when configuration changes
   */
  private async initializeAssistants(): Promise<void> {
    // Wait for AI resources to be initialized
    await this.aiResourceManager.initializeResources();

    // Get assistant orchestrator from AIResourceManager
    const orchestrator = this.aiResourceManager.getOrchestrator('assistant');

    if (orchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();

      // Initialize dialogue assistant
      this.dialogueAssistant = new DialogueMicrobeatAssistant(
        orchestrator,
        promptLoader,
        this.outputChannel
      );

      // Initialize prose assistant
      this.proseAssistant = new ProseAssistant(
        orchestrator,
        promptLoader
      );
    } else {
      // No orchestrator available (no API key configured)
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
    }
  }

  /**
   * Reinitialize assistants after configuration changes
   *
   * Should be called when model selections or API key changes
   */
  async refreshConfiguration(): Promise<void> {
    await this.initializeAssistants();
  }

  /**
   * Analyze dialogue with AI assistant
   *
   * @param text - Dialogue text to analyze
   * @param contextText - Optional surrounding context
   * @param sourceFileUri - Optional source file URI for tracking
   * @param focus - Analysis focus: 'dialogue' (tags only), 'microbeats' (beats only), or 'both' (default)
   * @returns Analysis result with suggestions and optional usage metrics
   */
  async analyzeDialogue(
    text: string,
    contextText?: string,
    sourceFileUri?: string,
    focus?: 'dialogue' | 'microbeats' | 'both'
  ): Promise<AnalysisResult> {
    if (!this.dialogueAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      // Get options from ToolOptionsProvider
      const options = this.toolOptions.getOptions(focus);

      // Log analysis focus for transparency
      this.outputChannel?.appendLine(
        `[AssistantToolService] Dialogue Analysis - Focus: ${options.focus} | Craft Guides: ${options.includeCraftGuides ? 'enabled' : 'disabled'}`
      );

      const executionResult = await this.dialogueAssistant.analyze(
        {
          text,
          contextText,
          sourceFileUri
        },
        options
      );

      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        executionResult.content,
        executionResult.usedGuides,
        executionResult.usage
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze prose with AI assistant
   *
   * @param text - Prose text to analyze
   * @param contextText - Optional surrounding context
   * @param sourceFileUri - Optional source file URI for tracking
   * @returns Analysis result with suggestions and optional usage metrics
   */
  async analyzeProse(
    text: string,
    contextText?: string,
    sourceFileUri?: string
  ): Promise<AnalysisResult> {
    if (!this.proseAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      // Get options from ToolOptionsProvider
      const options = this.toolOptions.getOptions();

      const executionResult = await this.proseAssistant.analyze(
        {
          text,
          contextText,
          sourceFileUri
        },
        options
      );

      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        executionResult.content,
        executionResult.usedGuides,
        executionResult.usage
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get warning message for missing API key
   */
  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered analysis tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Click the ⚙️ gear icon at the top of the Prose Minion view
3. Enter your API key in the "OpenRouter API Key" field
4. Click Save
5. Select your preferred models for assistants and utilities

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
