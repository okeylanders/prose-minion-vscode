/**
 * Gesture Playground menu generation (ADR 2026-07-22, Sprint 01).
 *
 * One model call on the fast `widget` scope returns a grouped menu of gesture
 * directions for a phrase. Everything around the call is deterministic
 * scaffold: input caps are enforced fail-closed, the response must be strict
 * JSON, and a menu that violates ANY bound rejects wholesale — partial model
 * output must not quietly become writer state (the WorkshopActionableFindings
 * posture). Regenerate re-rolls the cloud; commit never re-runs it.
 */

import { WorkshopGestureMenuGroup, TokenUsage } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { PromptLoader } from '@/tools/shared/prompts';
import { LogSink } from '@/platform';

export interface GestureMenuRequest {
  targetPhrase: string;
  contextText: string;
  characterNotes: string;
  signal?: AbortSignal;
}

export interface GestureMenuResult {
  menu: WorkshopGestureMenuGroup[];
  usage?: TokenUsage;
}

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export class GesturePlaygroundService {
  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly promptLoader: PromptLoader,
    private readonly outputChannel?: LogSink
  ) {}

  async generateMenu(request: GestureMenuRequest): Promise<GestureMenuResult> {
    const targetPhrase = request.targetPhrase.trim();
    if (targetPhrase.length === 0) {
      throw new Error('Gesture Playground needs a target phrase');
    }
    if (targetPhrase.length > BUDGET.gestureTargetPhraseCharacters) {
      throw new Error(
        `Target phrase exceeds ${BUDGET.gestureTargetPhraseCharacters} characters`
      );
    }
    if (request.contextText.length > BUDGET.gestureContextCharacters) {
      throw new Error(
        `Surrounding context exceeds ${BUDGET.gestureContextCharacters} characters`
      );
    }
    if (request.characterNotes.length > BUDGET.gestureCharacterNotesCharacters) {
      throw new Error(
        `Character notes exceed ${BUDGET.gestureCharacterNotesCharacters} characters`
      );
    }

    const engine = this.aiResourceManager.getEngine('widget');
    if (!engine) {
      throw new Error('OpenRouter API key not configured. Please set your API key in settings.');
    }

    const systemMessage = await this.promptLoader.loadPrompts([
      'gesture-playground/00-gesture-playground.md'
    ]);

    const userMessage = [
      `Target phrase: ${targetPhrase}`,
      request.contextText.trim().length > 0
        ? `Surrounding context:\n${request.contextText.trim()}`
        : undefined,
      request.characterNotes.trim().length > 0
        ? `Character notes:\n${request.characterNotes.trim()}`
        : undefined,
      'Build a deliberately varied menu. Treat the target as a dramatic function you may rephrase, relocate, or replace—not a motion you must preserve.'
    ].filter((part): part is string => part !== undefined).join('\n\n');

    const result = await engine.runInitial({
      toolName: 'gesture-playground',
      systemMessage,
      userMessage,
      policy: AGENT_RUN_POLICIES.assistantWithoutResources,
      options: {
        temperature: 0.9,
        maxTokens: 10_000,
        signal: request.signal
      }
    });

    return { menu: this.parseMenu(result.content), usage: result.usage };
  }

  /**
   * Strict fail-closed parse: fences stripped, one JSON array extracted, and
   * every group/option bound enforced. Any violation rejects the whole menu.
   */
  private parseMenu(content: string): WorkshopGestureMenuGroup[] {
    try {
      let clean = content;
      clean = clean.replace(/^```(?:json)?\s*\n?/i, '');
      clean = clean.replace(/\n?```\s*$/i, '');
      clean = clean.replace(/\n*---\n*⚠️ Response truncated[\s\S]*$/i, '');

      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('no JSON array found');
      }
      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('menu is not a non-empty array');
      }
      if (parsed.length > BUDGET.gestureMenuGroups) {
        throw new Error(`menu carries more than ${BUDGET.gestureMenuGroups} groups`);
      }

      const seenOptions = new Set<string>();
      return parsed.map((groupValue, groupIndex): WorkshopGestureMenuGroup => {
        if (typeof groupValue !== 'object' || groupValue === null || Array.isArray(groupValue)) {
          throw new Error(`group ${groupIndex} is not an object`);
        }
        const group = groupValue as Record<string, unknown>;
        const keys = Object.keys(group).sort();
        if (keys.length !== 2 || keys[0] !== 'heading' || keys[1] !== 'options') {
          throw new Error(`group ${groupIndex} must carry exactly heading and options`);
        }
        const heading = group.heading;
        if (
          typeof heading !== 'string'
          || heading.trim().length === 0
          || heading.length > BUDGET.gestureOptionCharacters
        ) {
          throw new Error(`group ${groupIndex} heading is invalid`);
        }
        const options = group.options;
        if (!Array.isArray(options) || options.length === 0) {
          throw new Error(`group ${groupIndex} options must be a non-empty array`);
        }
        if (options.length > BUDGET.gestureOptionsPerGroup) {
          throw new Error(
            `group ${groupIndex} carries more than ${BUDGET.gestureOptionsPerGroup} options`
          );
        }
        const parsedOptions = options.map((option, optionIndex): string => {
          if (
            typeof option !== 'string'
            || option.trim().length === 0
            || option.length > BUDGET.gestureOptionCharacters
          ) {
            throw new Error(`group ${groupIndex} option ${optionIndex} is invalid`);
          }
          const trimmed = option.trim();
          if (seenOptions.has(trimmed)) {
            throw new Error(`duplicate option ${JSON.stringify(trimmed)}`);
          }
          seenOptions.add(trimmed);
          return trimmed;
        });
        return { heading: heading.trim(), options: parsedOptions };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[GesturePlaygroundService] Rejected menu wholesale: ${message}`
      );
      this.outputChannel?.appendLine(
        `[GesturePlaygroundService] Rejected response follows (${content.length} characters):`
      );
      this.outputChannel?.appendLine(
        '[GesturePlaygroundService] --- BEGIN REJECTED MODEL RESPONSE ---'
      );
      this.outputChannel?.appendLine(content);
      this.outputChannel?.appendLine(
        '[GesturePlaygroundService] --- END REJECTED MODEL RESPONSE ---'
      );
      throw new Error(`The model returned an unusable menu (${message}). Try Generate again.`);
    }
  }
}

/**
 * The compact, instruction-shaped directive a Gesture Playground commit ships
 * (design Spread 01 §3). Deterministic: only the kept selections and the note
 * ride the rail — the exploration cloud never enters the prompt.
 */
export function buildGestureDirective(input: {
  targetPhrase: string;
  selections: readonly string[];
  note: string;
}): string {
  return [
    `Gesture directions I want for "${input.targetPhrase.trim()}":`,
    ...input.selections.map((selection) => `· ${selection}`),
    input.note.trim().length > 0 ? `note: ${input.note.trim()}` : undefined
  ].filter((line): line is string => line !== undefined).join('\n');
}
