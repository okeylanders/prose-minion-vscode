/** Dialogue product profile over the neutral prompted-passage runner. */

import { LogSink } from '@/platform';
import { PromptLoader } from '../shared/prompts';
import { AgentCapability, ExecutionResult, StreamingTokenCallback } from '@orchestration/AgentRunContracts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { DialogueFocus } from '@messages';
import {
  PassageAssistantInput,
  PassageAssistantOptions,
  PromptedPassageAssistant,
  PromptedPassageProfile
} from './PromptedPassageAssistant';

export interface DialogueMicrobeatInput extends PassageAssistantInput {}

export interface DialogueMicrobeatOptions extends PassageAssistantOptions<DialogueFocus> {
  readonly focus?: DialogueFocus;
  readonly onToken?: StreamingTokenCallback;
}

const DIALOGUE_PROFILE: PromptedPassageProfile<DialogueFocus> = {
  name: 'DialogueMicrobeatAssistant',
  defaultFocus: 'both',
  toolName: () => 'dialogue-microbeat-assistant',
  promptPaths: focus => [
    'dialog-microbeat-assistant/00-dialog-microbeat-assistant.md',
    'dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md',
    `dialog-microbeat-assistant/focus/${focus}.md`
  ],
  roleDescription: () => 'You are a creative writing assistant specializing in dialogue analysis.',
  taskInstruction: () => 'Please analyze this dialogue passage and provide suggestions for dialogue tags and action beats.',
  passageHeading: 'Dialogue Passage',
  contextHeading: 'Additional Context',
  closingInstruction: () => 'Focus on the emotional beats, speaker intentions, and body language cues that will make the dialogue feel grounded.',
  fallbackInstructions: () => `# Dialogue Microbeat Assistant

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
4. Overall recommendations`
};

export class DialogueMicrobeatAssistant {
  private readonly runner: PromptedPassageAssistant;

  constructor(
    agentRunEngine: AgentRunEngine,
    promptLoader: PromptLoader,
    guideCapability: AgentCapability,
    outputChannel?: LogSink
  ) {
    this.runner = new PromptedPassageAssistant(agentRunEngine, promptLoader, guideCapability, outputChannel);
  }

  analyze(input: DialogueMicrobeatInput, options?: DialogueMicrobeatOptions): Promise<ExecutionResult> {
    return this.runner.analyze(DIALOGUE_PROFILE, input, options);
  }
}
