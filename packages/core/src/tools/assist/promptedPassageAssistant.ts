import { LogSink } from '@/platform';
import { PromptLoader } from '../shared/prompts';
import { AgentCapabilityFactory, ExecutionResult, StreamingTokenCallback } from '@orchestration/AgentRunContracts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';

export interface PassageAssistantInput {
  readonly text: string;
  readonly contextText?: string;
  readonly sourceFileUri?: string;
}

export interface PassageAssistantOptions<Focus extends string> {
  readonly focus?: Focus;
  readonly includeCraftGuides?: boolean;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  readonly onToken?: StreamingTokenCallback;
  readonly retainConversation?: boolean;
}

/** Product-only prompt semantics; it never owns transport or lifecycle. */
export interface PromptedPassageProfile<Focus extends string> {
  readonly name: string;
  readonly defaultFocus: Focus;
  readonly toolName: (focus: Focus) => string;
  readonly promptPaths: (focus: Focus) => readonly string[];
  readonly roleDescription: (focus: Focus) => string;
  readonly taskInstruction: (focus: Focus) => string;
  readonly passageHeading: string;
  readonly contextHeading: string;
  readonly fallbackInstructions: (focus: Focus) => string;
  readonly closingInstruction?: (focus: Focus) => string;
}

export const resolvePassageRunPolicy = (
  includeCraftGuides: boolean | undefined,
  retainConversation: boolean | undefined
) => {
  if (includeCraftGuides !== false) {
    return retainConversation ? AGENT_RUN_POLICIES.workshopTool : AGENT_RUN_POLICIES.assistant;
  }
  return retainConversation
    ? AGENT_RUN_POLICIES.workshopToolWithoutResources
    : AGENT_RUN_POLICIES.assistantWithoutResources;
};

/**
 * Neutral prompt-to-run assembly for passage assistants. It deliberately has
 * no knowledge of dialogue, prose, or Writing Tools product language.
 */
export class PromptedPassageAssistant {
  constructor(
    private readonly agentRunEngine: AgentRunEngine,
    private readonly promptLoader: PromptLoader,
    private readonly createGuideCapability: AgentCapabilityFactory,
    private readonly outputChannel?: LogSink
  ) {}

  async analyze<Focus extends string>(
    profile: PromptedPassageProfile<Focus>,
    input: PassageAssistantInput,
    options: PassageAssistantOptions<Focus> = {}
  ): Promise<ExecutionResult> {
    const focus = options.focus ?? profile.defaultFocus;
    const sharedPrompts = await this.promptLoader.loadSharedPrompts();
    const toolPrompts = await this.loadToolPrompts(profile, focus);
    const usesGuides = options.includeCraftGuides !== false;

    return this.agentRunEngine.runInitial({
      toolName: profile.toolName(focus),
      systemMessage: this.buildSystemMessage(profile, focus, sharedPrompts, toolPrompts),
      userMessage: this.buildUserMessage(profile, focus, input),
      policy: resolvePassageRunPolicy(options.includeCraftGuides, options.retainConversation),
      // A fresh capability per run keeps the allowlist snapshot scoped to
      // this request; concurrent runs never see each other's catalog.
      capability: usesGuides ? this.createGuideCapability() : undefined,
      options: {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 10000,
        signal: options.signal,
        onToken: options.onToken
      }
    });
  }

  private async loadToolPrompts<Focus extends string>(
    profile: PromptedPassageProfile<Focus>,
    focus: Focus
  ): Promise<string> {
    const paths = profile.promptPaths(focus);
    try {
      this.outputChannel?.appendLine(`[${profile.name}] Loading prompts:`);
      paths.forEach((path, index) => this.outputChannel?.appendLine(`  ${index + 1}. ${path}`));
      return await this.promptLoader.loadPrompts([...paths]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[${profile.name}] Could not load prompts, using defaults: ${message}`);
      return profile.fallbackInstructions(focus);
    }
  }

  private buildSystemMessage<Focus extends string>(
    profile: PromptedPassageProfile<Focus>,
    focus: Focus,
    sharedPrompts: string,
    toolPrompts: string
  ): string {
    return [
      profile.roleDescription(focus),
      toolPrompts || profile.fallbackInstructions(focus),
      sharedPrompts
    ].filter(Boolean).join('\n\n---\n\n');
  }

  private buildUserMessage<Focus extends string>(
    profile: PromptedPassageProfile<Focus>,
    focus: Focus,
    input: PassageAssistantInput
  ): string {
    const lines = [
      profile.taskInstruction(focus),
      '',
      `### ${profile.passageHeading}`,
      '```markdown',
      input.text,
      '```',
      ''
    ];
    if (input.sourceFileUri) {
      lines.push(`Source File: ${input.sourceFileUri}`, '');
    }
    if (input.contextText?.trim()) {
      lines.push(`### ${profile.contextHeading}`, input.contextText.trim(), '');
    }
    const closingInstruction = profile.closingInstruction?.(focus);
    if (closingInstruction) {
      lines.push(closingInstruction);
    }
    return lines.join('\n');
  }
}
