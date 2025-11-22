/**
 * Prose Assistant Tool
 * General prose analysis and improvement suggestions ( Prose Excerpt Assistant )
 */

import { PromptLoader } from '../shared/prompts';
import { AIResourceOrchestrator, ExecutionResult } from '@/application/services/AIResourceOrchestrator';

export interface ProseAssistantInput {
  text: string;
  contextText?: string;
  sourceFileUri?: string;
}

export interface ProseAssistantOptions {
  includeCraftGuides?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class ProseAssistant {
  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader
  ) {}

  async analyze(input: ProseAssistantInput, options?: ProseAssistantOptions): Promise<ExecutionResult> {
    // Load system prompts (tool-specific and shared)
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();

    // Build system message (prompts only, no guides yet)
    const systemMessage = this.buildSystemMessage(sharedPrompts, toolPrompts);

    // Build user message (just the prose text)
    const userMessage = this.buildUserMessage(input);

    // Use orchestrator to execute with agent capabilities (guide support)
    return await this.aiResourceOrchestrator.executeWithAgentCapabilities(
      'prose-assistant',
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
        'prose-assistant/00-prose-assistant.md'
      ]);
    } catch (error) {
      // Fallback to default instructions
      console.warn('Could not load prose assistant prompts, using defaults');
      return this.getDefaultInstructions();
    }
  }

  private buildSystemMessage(
    sharedPrompts: string,
    toolPrompts: string
  ): string {
    const parts = [
      'You are a creative writing assistant specializing in prose analysis and improvement.',
      toolPrompts || this.getDefaultInstructions(),
      sharedPrompts
    ].filter(Boolean);

    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(input: ProseAssistantInput): string {
    const lines: string[] = [
      'Please analyze this prose passage and provide suggestions for improvement.',
      '',
      '### Prose Passage',
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

    lines.push('Focus on voice, clarity, pacing, sensory detail, and opportunities to reinforce character or theme.');

    return lines.join('\n');
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
