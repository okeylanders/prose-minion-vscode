/**
 * The current system prompt, measured (ADR 2026-11-18 D4).
 *
 * A behavior change replaces a conversation's system message between runs,
 * so the panel measures the message the conversation holds now. Each
 * assembled persona prompt's sections are kept here by the SHA-256 of its
 * text; a held message is looked up by the same digest. One the cache has
 * not seen still shows its total, estimated from the held text, with no
 * sections. Bounded: the newest `capacity` prompts.
 */

import { createHash } from 'node:crypto';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { ConversationContextAccount, StoredContextTallyEntry } from '@orchestration/ContextTallyRecord';
import type {
  WorkshopPersonaSystemPrompt,
  WorkshopSystemPromptSection
} from '@services/analysis/WorkshopPersonaSystemPrompt';

/** What a conversation holds that the panel can account for. Host-side; no text. */
export interface WorkshopConversationMeasure {
  systemTokens: number;
  /** Absent when the held system message was not assembled through the measured chain. */
  sections?: WorkshopSystemPromptSection[];
  messageCount: number;
  tally: StoredContextTallyEntry[];
}

const digest = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

export class WorkshopSystemPromptMeasures {
  private readonly byDigest = new Map<string, WorkshopSystemPromptSection[]>();

  constructor(private readonly capacity = 32) {}

  record(prompt: WorkshopPersonaSystemPrompt): void {
    if (!prompt.sections) return;
    const key = digest(prompt.text);
    this.byDigest.delete(key);
    this.byDigest.set(key, prompt.sections.map((section) => ({ ...section })));
    while (this.byDigest.size > this.capacity) {
      this.byDigest.delete(this.byDigest.keys().next().value as string);
    }
  }

  measure(account: ConversationContextAccount | undefined): WorkshopConversationMeasure | undefined {
    if (!account) return undefined;
    const sections = this.byDigest.get(digest(account.systemMessage));
    return {
      systemTokens: estimateTextTokens(account.systemMessage),
      ...(sections ? { sections: sections.map((section) => ({ ...section })) } : {}),
      messageCount: account.messageCount,
      tally: account.tally
    };
  }
}
