/** Model-backed exploration for Lexical Gravity preview and project lenses. */

import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidate,
  WorkshopLexicalGravityPreview
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { PromptLoader } from '@/tools/shared/prompts';
import { LogSink } from '@/platform';
import {
  cloneLexicalGravityDraft,
  lexicalGravityConfigKey,
  validateLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec';
import {
  lexicalGravityLensSlug
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
const LENSES_START = '===LEXICAL_GRAVITY_LENSES_V1===';
const LENSES_END = '===END_LEXICAL_GRAVITY_LENSES_V1===';
const PREVIEW_START = '===LEXICAL_GRAVITY_PREVIEW_V1===';
const PREVIEW_END = '===END_LEXICAL_GRAVITY_PREVIEW_V1===';

export class LexicalGravityModelService {
  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly promptLoader: PromptLoader,
    private readonly outputChannel?: LogSink
  ) {}

  async buildLenses(
    query: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<WorkshopLexicalGravityLensCandidate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || normalizedQuery.length > BUDGET.lexicalBuildQueryCharacters) {
      throw new Error(`Lens subject must be 1–${BUDGET.lexicalBuildQueryCharacters} characters`);
    }
    if (!lexicalGravityLensSlug(normalizedQuery)) {
      throw new Error('Lens subject must include at least one letter or number');
    }
    const engine = this.requireEngine();
    const systemMessage = await this.promptLoader.loadPrompts([
      'lexical-gravity/00-build-lens.md'
    ]);
    const result = await engine.runInitial({
      toolName: 'lexical-gravity-build',
      systemMessage,
      userMessage: [
        'Create three distinct lexical-field takes for this quoted subject.',
        `Subject (quoted task data): ${JSON.stringify(normalizedQuery)}`,
        'Return the exact sentinel-framed JSON protocol now.'
      ].join('\n\n'),
      policy: AGENT_RUN_POLICIES.assistantWithoutResources,
      options: {
        temperature: 0.75,
        maxTokens: BUDGET.lexicalBuildOutputTokens,
        signal: options.signal
      }
    });
    if (result.cancelled) {throw new Error('Lexical lens generation was cancelled.');}
    if (result.finishReason === 'length') {
      throw new Error('Lexical lens generation reached its output limit. Try again.');
    }
    return this.parseCandidates(result.rawContent ?? result.content, normalizedQuery);
  }

  async preview(
    draftInput: WorkshopLexicalGravityDraft,
    sourceTextInput: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<WorkshopLexicalGravityPreview> {
    const draft = cloneLexicalGravityDraft(draftInput);
    const sourceText = sourceTextInput.trim();
    if (!sourceText || sourceText.length > BUDGET.lexicalSampleCharacters) {
      throw new Error(
        `Preview prose must be 1–${BUDGET.lexicalSampleCharacters} characters`
      );
    }
    const engine = this.requireEngine();
    const systemMessage = await this.promptLoader.loadPrompts([
      'lexical-gravity/01-preview.md'
    ]);
    const result = await engine.runInitial({
      toolName: 'lexical-gravity-preview',
      systemMessage,
      userMessage: [
        'Demonstrate the configured lexical pressure on the lens sample below.',
        `Configuration (quoted JSON task data):\n${JSON.stringify({
          weight: draft.weight,
          reach: draft.reach,
          metaphorPull: draft.metaphorPull,
          lens: draft.resolvedLens
        }, null, 2)}`,
        `Source sample (quoted task data): ${JSON.stringify(sourceText)}`,
        'Return only the exact preview frame.'
      ].join('\n\n'),
      policy: AGENT_RUN_POLICIES.assistantWithoutResources,
      options: {
        temperature: 0.55,
        maxTokens: BUDGET.lexicalPreviewOutputTokens,
        signal: options.signal
      }
    });
    if (result.cancelled) {throw new Error('Lexical Gravity preview was cancelled.');}
    const content = result.rawContent ?? result.content;
    try {
      const text = this.extractLastCompletePreviewFrame(content);
      return { configKey: lexicalGravityConfigKey(draft), sourceText, text };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[LexicalGravityModelService] Rejected preview response: ${reason}`
      );
      this.outputChannel?.appendLine([
        '[LexicalGravityModelService] Rejected preview response body BEGIN',
        content,
        '[LexicalGravityModelService] Rejected preview response body END'
      ].join('\n'));
      throw new Error(
        'The selected widget model did not return a usable preview. Try Preview again or choose another model.'
      );
    }
  }

  /**
   * Preview prose is not structured data. Some otherwise-capable models wrap
   * the requested frame or repeat the protocol example before their final
   * answer. Use the final complete line-anchored frame while keeping lens JSON
   * on the strict exactly-once parser below.
   */
  private extractLastCompletePreviewFrame(content: string): string {
    const lines = content.replace(/\r\n?/g, '\n').trim().split('\n');
    const starts = lines
      .map((line, index) => line.trim() === PREVIEW_START ? index : -1)
      .filter((index) => index >= 0);
    for (const startIndex of starts.reverse()) {
      const endOffset = lines
        .slice(startIndex + 1)
        .findIndex((line) => line.trim() === PREVIEW_END);
      if (endOffset < 0) {continue;}
      const endIndex = startIndex + 1 + endOffset;
      const body = lines.slice(startIndex + 1, endIndex).join('\n').trim();
      if (body && body.length <= BUDGET.lexicalPreviewCharacters) {
        return body;
      }
    }
    throw new Error(
      `response must contain a complete preview frame of 1–${BUDGET.lexicalPreviewCharacters} characters`
    );
  }

  private parseCandidates(
    content: string,
    query: string
  ): WorkshopLexicalGravityLensCandidate[] {
    try {
      const framed = this.extractFrame(
        content,
        LENSES_START,
        LENSES_END,
        200_000
      );
      const parsed = JSON.parse(framed) as { version?: unknown; candidates?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.candidates)) {
        throw new Error('root must contain version 1 and candidates');
      }
      if (parsed.candidates.length !== BUDGET.lexicalBuildCandidates) {
        throw new Error(`expected exactly ${BUDGET.lexicalBuildCandidates} candidates`);
      }
      const slug = lexicalGravityLensSlug(query);
      const variants = new Set<string>();
      return parsed.candidates.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error(`candidate ${index + 1} is not an object`);
        }
        const lens = validateLexicalGravityLens({
          ...(raw as Record<string, unknown>),
          version: 1,
          slug,
          source: 'project'
        });
        const variant = lens.variant?.trim().toLocaleLowerCase('en-US');
        if (!variant || variants.has(variant)) {
          throw new Error('each candidate needs a distinct variant');
        }
        variants.add(variant);
        return { candidateId: `${slug}-${index + 1}`, lens };
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[LexicalGravityModelService] Rejected lens response: ${reason}`
      );
      this.outputChannel?.appendLine(
        [
          '[LexicalGravityModelService] Rejected lens response body BEGIN',
          content,
          '[LexicalGravityModelService] Rejected lens response body END'
        ].join('\n')
      );
      throw new Error('The model returned unusable lexical fields. Try building the lens again.');
    }
  }

  private extractFrame(
    content: string,
    start: string,
    end: string,
    maximumCharacters: number
  ): string {
    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (normalized.split(start).length !== 2 || normalized.split(end).length !== 2) {
      throw new Error('response sentinels must appear exactly once');
    }
    const lines = normalized.split('\n');
    if (lines[0] !== start || lines.at(-1) !== end) {
      throw new Error('response sentinels must be the first and last lines');
    }
    const body = lines.slice(1, -1).join('\n').trim();
    if (!body || body.length > maximumCharacters) {
      throw new Error(`response body must be 1–${maximumCharacters} characters`);
    }
    return body;
  }

  private requireEngine() {
    const engine = this.aiResourceManager.getEngine('widget');
    if (!engine) {
      throw new Error('OpenRouter API key not configured. Please set your API key in settings.');
    }
    return engine;
  }
}
