/**
 * Context Assistant Tool (scaffolding)
 * Generates contextual briefings to accompany prose excerpts
 */

import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AgentCapability, StreamingTokenCallback } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { PromptLoader } from '../shared/prompts';
import { ContextPathGroup } from '@shared/types';
import { DEFAULT_CONTEXT_GROUPS } from '@/domain/models/ContextGeneration';
import { TokenUsage } from '@shared/types';

export interface ContextAssistantInput {
  excerpt: string;
  existingContext?: string;
  sourceFileUri?: string;
  /** Full or pre-bounded source document; the caller owns the word cap. */
  sourceContent?: string;
  /** Why a configured source file could not be read — distinct from "no source". */
  sourceUnavailableReason?: string;
  requestedGroups?: ContextPathGroup[];
}

export interface ContextAssistantOptions {
  capability: AgentCapability;
  temperature?: number;
  maxTokens?: number;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback for streaming tokens (enables streaming mode) */
  onToken?: StreamingTokenCallback;
}

export interface ContextAssistantExecutionResult {
  content: string;
  requestedResources?: string[];
  usage?: TokenUsage;
}

export class ContextAssistant {
  constructor(
    private readonly agentRunEngine: AgentRunEngine,
    private readonly promptLoader: PromptLoader
  ) {}

  async generate(
    input: ContextAssistantInput,
    options: ContextAssistantOptions
  ): Promise<ContextAssistantExecutionResult> {
    const groups = this.normalizeGroups(input.requestedGroups);
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();
    const systemMessage = this.buildSystemMessage(toolPrompts, sharedPrompts);

    const userMessage = this.buildUserMessage({
      excerpt: input.excerpt,
      existingContext: input.existingContext,
      sourceFileUri: input.sourceFileUri,
      sourceContent: input.sourceContent,
      sourceUnavailableReason: input.sourceUnavailableReason,
      groups
    });

    const executionResult = await this.agentRunEngine.runInitial({
      toolName: 'context-assistant',
      systemMessage,
      userMessage,
      policy: AGENT_RUN_POLICIES.context,
      capability: options.capability,
      options: {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 10000,
        signal: options.signal,
        onToken: options.onToken
      }
    });

    return {
      content: executionResult.content,
      requestedResources: executionResult.requestedResources,
      usage: executionResult.usage
    };
  }

  private async loadToolPrompts(): Promise<string> {
    try {
      return await this.promptLoader.loadPrompts([
        'context-assistant/00-context-briefing.md'
      ]);
    } catch (error) {
      console.warn('Failed to load context assistant prompts; falling back to defaults.', error);
      return this.getFallbackInstructions();
    }
  }

  private buildSystemMessage(toolPrompts: string, sharedPrompts: string): string {
    const parts = [toolPrompts, sharedPrompts].filter(Boolean);
    return parts.join('\n\n---\n\n');
  }

  private buildUserMessage(args: {
    excerpt: string;
    existingContext?: string;
    sourceFileUri?: string;
    sourceContent?: string;
    sourceUnavailableReason?: string;
    groups: ContextPathGroup[];
  }): string {
    const { excerpt, existingContext, sourceFileUri, sourceContent, sourceUnavailableReason, groups } = args;
    const lines: string[] = [];

    lines.push('# Excerpt');
    lines.push('```markdown');
    lines.push(excerpt || '(No excerpt provided)');
    lines.push('```', '');

    lines.push('## User-Provided Context');
    if (existingContext && existingContext.trim().length > 0) {
      lines.push(existingContext.trim(), '');
    } else {
      lines.push('No extra context was supplied by the user.', '');
    }

    if (sourceFileUri) {
      lines.push('## Excerpt Source');
      lines.push(`The excerpt comes from: ${sourceFileUri}`, '');
    }

    if (sourceContent !== undefined && sourceContent.length > 0) {
      lines.push('## Source Document');
      lines.push('```markdown');
      lines.push(sourceContent);
      lines.push('```', '');
    } else if (sourceFileUri && sourceUnavailableReason) {
      lines.push('## Source Document');
      lines.push(
        `The configured source file could not be read (${sourceUnavailableReason}). ` +
        'Note this gap in the briefing and continue using the excerpt and other evidence.',
        ''
      );
    }

    lines.push('## Context Groups Considered');
    lines.push(groups.map(group => `- ${group}`).join('\n') || '- (none)', '');

    return lines.join('\n');
  }

  private normalizeGroups(groups?: ContextPathGroup[]): ContextPathGroup[] {
    if (!groups || groups.length === 0) {
      return [...DEFAULT_CONTEXT_GROUPS];
    }

    const seen = new Set<string>();
    const normalized: ContextPathGroup[] = [];

    for (const group of groups) {
      const key = group.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(group);
      }
    }

    return normalized;
  }

  private getFallbackInstructions(): string {
    return `# Context Assistant Instructions

You produce context briefs for creative writing excerpts. If you need project files, use the shared resource-request protocol supplied beside the catalog. After receiving the files, craft a markdown briefing with sections for genre, tone-and-style, character details, excerpt context, freestyle comments, and recommendations.`;
  }
}
