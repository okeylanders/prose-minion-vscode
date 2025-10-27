/**
 * Dialogue Microbeat Assistant Tool
 * Analyzes dialogue passages and suggests dialogue tags and action beats
 */

import { PromptLoader } from '../shared/prompts';
import { AIResourceOrchestrator, ExecutionResult } from '../../application/services/AIResourceOrchestrator';

export interface DialogueMicrobeatInput {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface DialogueMicrobeatOutput {
  analysis: string;
  suggestions: string;
}

export interface DialogueMicrobeatOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class DialogueMicrobeatAssistant {
  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader
  ) {}

  async analyze(input: DialogueMicrobeatInput, options?: DialogueMicrobeatOptions): Promise<ExecutionResult> {
    // Load system prompts (tool-specific and shared)
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();

    // Build system message (prompts only, no guides yet)
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts);

    // Build user message (just the dialogue text)
    const userMessage = this.buildUserMessage(input);

    // Use orchestrator to execute with agent capabilities (guide support)
    return await this.aiResourceOrchestrator.executeWithAgentCapabilities(
      'dialogue-microbeat-assistant',
      systemMessage,
      userMessage,
      {
        includeCraftGuides: options?.includeCraftGuides,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 10000
      }
    );
  }

  private async loadToolPrompts(): Promise<string> {
    try {
      return await this.promptLoader.loadPrompts([
        'dialog-microbeat-assistant/00-dialog-microbeat-assistant.md',
        'dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md'
      ]);
    } catch (error) {
      // Fallback to default instructions if files don't exist
      console.warn('Could not load dialog microbeat prompts, using defaults');
      return this.getDefaultInstructions();
    }
  }

  private buildSystemMessage(
    sharedPrompts: string,
    toolPrompts: string
  ): string {
    const parts = [
      'You are a creative writing assistant specializing in dialogue analysis.',
      toolPrompts || this.getDefaultInstructions(),
      sharedPrompts
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(input: DialogueMicrobeatInput): string {
    const lines: string[] = [
      'Please analyze this dialogue passage and provide suggestions for dialogue tags and action beats.',
      '',
      '### Dialogue Passage',
      '```markdown',
      input.text,
      '```',
      ''
    ];

    if (input.sourceFileUri) {
      lines.push(`Source File: ${input.sourceFileUri}`, '');
    }

    if (input.contextText && input.contextText.trim().length > 0) {
      lines.push('### Additional Context', input.contextText.trim(), '');
    }

    lines.push('Focus on the emotional beats, speaker intentions, and body language cues that will make the dialogue feel grounded.');

    return lines.join('\n');
  }

  private getDefaultInstructions(): string {
    return `# Dialogue Microbeat Assistant

Your task is to analyze dialogue passages and provide suggestions for:

1. **Dialogue Tags**: Ways to attribute speech (said, asked, whispered, etc.)
2. **Action Beats**: Physical actions that can replace or complement dialogue tags
3. **Emotional Subtext**: How to show emotion through action rather than telling

## Guidelines

- Focus on showing emotion through action
- Suggest specific, vivid action beats
- Avoid overusing dialogue tags
- Consider the pacing and rhythm of the dialogue
- Maintain character voice and consistency

## Output Format

Provide your analysis in clear sections:
1. Current dialogue assessment
2. Suggested dialogue tags (if needed)
3. Suggested action beats with specific examples
4. Overall recommendations`;
  }
}
