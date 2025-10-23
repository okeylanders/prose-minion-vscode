/**
 * Context Assistant Tool (scaffolding)
 * Generates contextual briefings to accompany prose excerpts
 */

import { AIResourceOrchestrator } from '../../application/services/AIResourceOrchestrator';
import { PromptLoader } from '../shared/prompts';
import { ContextPathGroup } from '../../shared/types';
import {
  ContextResourceProvider,
  ContextResourceSummary,
  DEFAULT_CONTEXT_GROUPS
} from '../../domain/models/ContextGeneration';

export interface ContextAssistantInput {
  excerpt: string;
  existingContext?: string;
  sourceFileUri?: string;
  sourceContent?: string;
  requestedGroups?: ContextPathGroup[];
}

export interface ContextAssistantOptions {
  resourceProvider: ContextResourceProvider;
  temperature?: number;
  maxTokens?: number;
}

export interface ContextAssistantExecutionResult {
  content: string;
  requestedResources?: string[];
}

export class ContextAssistant {
  private readonly MAX_RESOURCE_LIST = 100;

  constructor(
    private readonly aiResourceOrchestrator: AIResourceOrchestrator,
    private readonly promptLoader: PromptLoader
  ) {}

  async generate(
    input: ContextAssistantInput,
    options: ContextAssistantOptions
  ): Promise<ContextAssistantExecutionResult> {
    if (!options?.resourceProvider) {
      throw new Error('ContextAssistant requires a resource provider to resolve project resources.');
    }

    const groups = this.normalizeGroups(input.requestedGroups);
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts();
    const systemMessage = this.buildSystemMessage(toolPrompts, sharedPrompts);

    const resourceSummaries = options.resourceProvider.listResources();
    const userMessage = this.buildUserMessage({
      excerpt: input.excerpt,
      existingContext: input.existingContext,
      sourceFileUri: input.sourceFileUri,
      resourceSummaries,
      groups
    });

    const executionResult = await this.aiResourceOrchestrator.executeWithContextResources(
      'context-assistant',
      systemMessage,
      userMessage,
      options.resourceProvider,
      resourceSummaries,
      {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2000
      }
    );

    return {
      content: executionResult.content,
      requestedResources: executionResult.requestedResources
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
    resourceSummaries: ContextResourceSummary[];
    groups: ContextPathGroup[];
  }): string {
    const { excerpt, existingContext, sourceFileUri, sourceContent, resourceSummaries, groups } = args;
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

    if (sourceContent && sourceContent.trim().length > 0) {
      lines.push('## Source Document (full text)');
      lines.push('```markdown');
      lines.push(sourceContent.trim());
      lines.push('```', '');
    }

    lines.push('## Context Groups Considered');
    lines.push(groups.map(group => `- ${group}`).join('\n') || '- (none)', '');

    lines.push(this.formatResourceCatalog(resourceSummaries));
    lines.push('Remember to use `<context-request path=["..."] />` if you need any of these files before drafting the final context.');

    return lines.join('\n');
  }

  private formatResourceCatalog(resourceSummaries: ContextResourceSummary[]): string {
    if (!resourceSummaries || resourceSummaries.length === 0) {
      return '## Available Project Resources\nNo project references matched the configured path patterns. Continue using the excerpt and your knowledge of genre conventions.';
    }

    const lines: string[] = ['## Available Project Resources', '', 'Use the exact path values when requesting files.', ''];

    const limitedResources = resourceSummaries.slice(0, this.MAX_RESOURCE_LIST);

    for (const summary of limitedResources) {
      const workspacePrefix = summary.workspaceFolder ? ` (workspace: ${summary.workspaceFolder})` : '';
      const labelSuffix = summary.label && summary.label.toLowerCase() !== summary.path.toLowerCase()
        ? ` — ${summary.label}`
        : '';
      lines.push(`- [${summary.group}] \`${summary.path}\`${labelSuffix}${workspacePrefix}`);
    }

    if (resourceSummaries.length > this.MAX_RESOURCE_LIST) {
      const remaining = resourceSummaries.length - this.MAX_RESOURCE_LIST;
      lines.push('', `...and ${remaining} additional resource(s) not listed to save tokens.`);
    }

    lines.push('');
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

You produce context briefs for creative writing excerpts. If you need project files, reply first with a <context-request /> tag that lists the paths you require. After receiving the files, craft a markdown briefing with sections for genre, tone-and-style, character details, excerpt context, freestyle comments, and recommendations.`;
  }
}
