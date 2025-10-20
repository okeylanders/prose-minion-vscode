/**
 * Dialogue Microbeat Assistant Tool
 * Analyzes dialogue passages and suggests dialogue tags and action beats
 */

import { OpenRouterClient, OpenRouterMessage } from '../../infrastructure/api/OpenRouterClient';
import { PromptLoader } from '../shared/prompts';
import { GuideLoader } from '../shared/guides';

export interface DialogueMicrobeatInput {
  text: string;
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
    private readonly openRouterClient: OpenRouterClient,
    private readonly promptLoader: PromptLoader,
    private readonly guideLoader: GuideLoader
  ) {}

  async analyze(input: DialogueMicrobeatInput, options?: DialogueMicrobeatOptions): Promise<string> {
    // Load system prompts
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();
    const guides = options?.includeCraftGuides !== false ? await this.loadGuides() : '';

    // Build system message
    const systemMessage = this.buildSystemMessage(
      sharedPrompts,
      toolPrompts,
      guides
    );

    // Build user message
    const userMessage = this.buildUserMessage(input.text);

    // Call OpenRouter API
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];

    return await this.openRouterClient.createChatCompletion(messages, {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2000
    });
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

  private async loadGuides(): Promise<string> {
    try {
      return await this.guideLoader.loadGuides([
        'dialogue-tags',
        'action-beats',
        'showing-emotion'
      ]);
    } catch (error) {
      // Guides are optional
      return '';
    }
  }

  private buildSystemMessage(
    sharedPrompts: string,
    toolPrompts: string,
    guides: string
  ): string {
    const parts = [
      'You are a creative writing assistant specializing in dialogue analysis.',
      toolPrompts || this.getDefaultInstructions(),
      sharedPrompts,
      guides
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(text: string): string {
    return `Please analyze this dialogue passage and provide suggestions for dialogue tags and action beats:\n\n${text}`;
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
