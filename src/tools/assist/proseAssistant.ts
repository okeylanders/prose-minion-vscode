/**
 * Prose Assistant Tool
 * General prose analysis and improvement suggestions
 */

import { OpenRouterClient, OpenRouterMessage } from '../../infrastructure/api/OpenRouterClient';
import { PromptLoader } from '../shared/prompts';
import { GuideLoader } from '../shared/guides';

export interface ProseAssistantInput {
  text: string;
}

export interface ProseAssistantOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class ProseAssistant {
  constructor(
    private readonly openRouterClient: OpenRouterClient,
    private readonly promptLoader: PromptLoader,
    private readonly guideLoader: GuideLoader
  ) {}

  async analyze(input: ProseAssistantInput, options?: ProseAssistantOptions): Promise<string> {
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
      maxTokens: options?.maxTokens ?? 2500
    });
  }

  private async loadToolPrompts(): Promise<string> {
    try {
      return await this.promptLoader.loadPrompts([
        'prose-assistant/00-prose-assistant.md'
      ]);
    } catch (error) {
      // Fallback to default instructions
      console.warn('Could not load prose assistant prompts, using defaults');
      return this.getDefaultInstructions();
    }
  }

  private async loadGuides(): Promise<string> {
    try {
      return await this.guideLoader.loadGuides([
        'show-dont-tell',
        'pacing',
        'sensory-details',
        'voice'
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
      'You are a creative writing assistant specializing in prose analysis and improvement.',
      toolPrompts || this.getDefaultInstructions(),
      sharedPrompts,
      guides
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(text: string): string {
    return `Please analyze this prose passage and provide suggestions for improvement:\n\n${text}`;
  }

  private getDefaultInstructions(): string {
    return `# Prose Assistant

Your task is to analyze prose passages and provide constructive feedback on:

1. **Show vs Tell**: Identify opportunities to show rather than tell
2. **Sensory Details**: Suggest ways to engage the senses
3. **Pacing**: Assess the rhythm and flow of the prose
4. **Voice**: Evaluate consistency and strength of narrative voice
5. **Clarity**: Identify any confusing or unclear passages
6. **Word Choice**: Suggest more precise or evocative language

## Guidelines

- Be specific and actionable in your suggestions
- Provide examples when suggesting changes
- Respect the author's voice and style
- Focus on the most impactful improvements
- Balance criticism with recognition of strengths

## Output Format

Provide your analysis in clear sections:
1. Strengths of the passage
2. Areas for improvement with specific examples
3. Suggested revisions
4. Overall recommendations`;
  }
}
