/** Prose product profile over the neutral prompted-passage runner. */

import { PromptLoader } from '../shared/prompts';
import { AgentCapabilityFactory, ExecutionResult } from '@orchestration/AgentRunContracts';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import {
  PassageAssistantInput,
  PassageAssistantOptions,
  PromptedPassageAssistant,
  PromptedPassageProfile
} from './promptedPassageAssistant';

type ProseFocus = 'prose';

export interface ProseAssistantInput extends PassageAssistantInput {}
export interface ProseAssistantOptions extends Omit<PassageAssistantOptions<ProseFocus>, 'focus'> {}

const PROSE_PROFILE: PromptedPassageProfile<ProseFocus> = {
  name: 'ProseAssistant',
  defaultFocus: 'prose',
  toolName: () => 'prose-assistant',
  promptPaths: () => ['prose-assistant/00-prose-assistant.md'],
  roleDescription: () => 'You are a creative writing assistant specializing in prose analysis and improvement.',
  taskInstruction: () => 'Please analyze this prose passage and provide suggestions for improvement.',
  passageHeading: 'Prose Passage',
  contextHeading: 'Supplemental Context',
  closingInstruction: () => 'Focus on voice, clarity, pacing, sensory detail, and opportunities to reinforce character or theme.',
  fallbackInstructions: () => `# Prose Assistant

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
4. Overall recommendations`
};

export class ProseAssistant {
  private readonly runner: PromptedPassageAssistant;

  constructor(agentRunEngine: AgentRunEngine, promptLoader: PromptLoader, createGuideCapability: AgentCapabilityFactory) {
    this.runner = new PromptedPassageAssistant(agentRunEngine, promptLoader, createGuideCapability);
  }

  analyze(input: ProseAssistantInput, options?: ProseAssistantOptions): Promise<ExecutionResult> {
    return this.runner.analyze(PROSE_PROFILE, input, options);
  }
}
