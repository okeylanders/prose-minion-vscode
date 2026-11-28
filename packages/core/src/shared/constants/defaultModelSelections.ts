import type { OwnModelScope } from '@messages';

/** Defaults for scopes with their own models. Following scopes resolve through MODEL_SCOPE_FOLLOWS. */
export const DEFAULT_MODEL_SELECTIONS: Readonly<Record<OwnModelScope, string>> = {
  assistant: 'anthropic/claude-sonnet-5.5',
  dictionary: 'anthropic/claude-haiku-5.5',
  context: 'openai/gpt-6.2-sol',
  category: 'openai/gpt-oss-120b:nitro',
  widget: 'anthropic/claude-sonnet-5.5',
  proofread: 'anthropic/claude-haiku-5.5'
};
