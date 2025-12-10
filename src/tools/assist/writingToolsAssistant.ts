/**
 * Writing Tools Assistant
 * Dedicated assistant for specialized writing analysis tools:
 * - Cliche Analysis
 * - Scene Continuity Check
 * - Style Consistency
 * - Editor (Grammar & Mechanics)
 */

import type * as vscode from 'vscode';
import { PromptLoader } from '../shared/prompts';
import { AIResourceOrchestrator, ExecutionResult, StreamingTokenCallback } from '@orchestration/AIResourceOrchestrator';
import { AssistantFocus } from '@messages';

/** Focus modes supported by WritingToolsAssistant */
export type WritingToolsFocus = 'cliche' | 'continuity' | 'style' | 'editor';

export interface WritingToolsInput {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface WritingToolsOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
  focus: WritingToolsFocus;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback for streaming tokens (enables streaming mode) */
  onToken?: StreamingTokenCallback;
}

export class WritingToolsAssistant {
  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  async analyze(input: WritingToolsInput, options: WritingToolsOptions): Promise<ExecutionResult> {
    const { focus } = options;

    // Load prompts: minimal base + focus-specific (which contains everything)
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts(focus);

    // Build system message
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts, focus);

    // Build user message
    const userMessage = this.buildUserMessage(input, focus);

    // Log for transparency
    this.outputChannel?.appendLine(`[WritingToolsAssistant] Analyzing with focus="${focus}"`);

    // Use orchestrator to execute with agent capabilities
    return await this.aiResourceOrchestrator.executeWithAgentCapabilities(
      `writing-tools-${focus}`,
      systemMessage,
      userMessage,
      {
        includeCraftGuides: options?.includeCraftGuides,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 10000,
        signal: options?.signal,
        onToken: options?.onToken
      }
    );
  }

  private async loadToolPrompts(focus: WritingToolsFocus): Promise<string> {
    try {
      // Load minimal base prompt + comprehensive focus prompt
      const paths = [
        'writing-tools-assistant/00-writing-tools-base.md',
        `writing-tools-assistant/focus/${focus}.md`
      ];

      this.outputChannel?.appendLine(`[WritingToolsAssistant] Loading prompts:`);
      paths.forEach((path, index) => {
        this.outputChannel?.appendLine(`  ${index + 1}. ${path}`);
      });

      return await this.promptLoader.loadPrompts(paths);
    } catch (error) {
      console.warn(`Could not load writing tools prompts for focus="${focus}", using defaults`);
      return this.getDefaultInstructions(focus);
    }
  }

  private buildSystemMessage(
    sharedPrompts: string,
    toolPrompts: string,
    focus: WritingToolsFocus
  ): string {
    const roleDescription = this.getRoleDescription(focus);

    const parts = [
      roleDescription,
      toolPrompts || this.getDefaultInstructions(focus),
      sharedPrompts
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private getRoleDescription(focus: WritingToolsFocus): string {
    const roles: Record<WritingToolsFocus, string> = {
      cliche: 'You are a writing assistant specializing in identifying cliches, dead metaphors, and overused expressions in creative writing.',
      continuity: 'You are a writing assistant specializing in detecting scene continuity errors, choreography issues, and logical inconsistencies.',
      style: 'You are a writing assistant specializing in detecting stylistic drift, tense shifts, POV breaks, and register inconsistencies.',
      editor: 'You are a copyeditor specializing in grammar, spelling, punctuation, and mechanical correctness in creative writing.'
    };
    return roles[focus];
  }

  private buildUserMessage(input: WritingToolsInput, focus: WritingToolsFocus): string {
    const instructions = this.getAnalysisInstruction(focus);

    const lines: string[] = [
      instructions,
      '',
      '### Passage to Analyze',
      '```markdown',
      input.text,
      '```',
      ''
    ];

    if (input.sourceFileUri) {
      lines.push(`Source File: ${input.sourceFileUri}`, '');
    }

    if (input.contextText && input.contextText.trim().length > 0) {
      lines.push('### Supplemental Context', input.contextText.trim(), '');
    }

    return lines.join('\n');
  }

  private getAnalysisInstruction(focus: WritingToolsFocus): string {
    const instructions: Record<WritingToolsFocus, string> = {
      cliche: 'Please analyze this passage for cliches, dead metaphors, stock phrases, and overused expressions. Provide fresh alternatives.',
      continuity: 'Please analyze this passage for continuity errors, choreography issues, object tracking problems, and logical inconsistencies.',
      style: 'Please analyze this passage for stylistic drift, tense shifts, POV breaks, and register inconsistencies.',
      editor: 'Please copyedit this passage for grammar, spelling, punctuation, and mechanical errors.'
    };
    return instructions[focus];
  }

  private getDefaultInstructions(focus: WritingToolsFocus): string {
    const defaults: Record<WritingToolsFocus, string> = {
      cliche: `# Cliche Analysis

Identify and flag:
- Dead metaphors ("cold as ice", "heart of gold")
- Stock phrases ("at the end of the day")
- Overused descriptors ("piercing blue eyes")
- Tired similes and comparisons
- Genre-specific cliches

Rate severity (mild/moderate/egregious) and suggest fresh alternatives.`,

      continuity: `# Scene Continuity Check

Identify:
- Choreography issues (character teleportation)
- Object continuity errors (vanishing props)
- Timeline inconsistencies
- Character state contradictions
- Environmental inconsistencies

Provide specific line references and suggested fixes.`,

      style: `# Style Consistency

Identify:
- Tense shifts (past to present drift)
- POV breaks (head-hopping, unearned omniscience)
- Register drift (formal to casual shifts)
- Voice inconsistencies
- Punctuation/formatting inconsistencies

Provide specific corrections with explanations.`,

      editor: `# Editor (Grammar & Mechanics)

Check for:
- Subject-verb agreement
- Pronoun reference clarity
- Homophones (their/there/they're)
- Dialogue punctuation
- Comma splices and run-ons
- Spelling and typos

Provide specific corrections with explanations.`
    };
    return defaults[focus];
  }
}

/**
 * Type guard to check if a focus is a WritingTools focus
 */
export function isWritingToolsFocus(focus: AssistantFocus): focus is WritingToolsFocus {
  return ['cliche', 'continuity', 'style', 'editor'].includes(focus);
}
