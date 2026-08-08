/** Model-backed exploration for Lexical Gravity preview and project lenses. */

import {
  LEXICAL_GRAVITY_LENS_RESPONSE_ENVELOPE_VERSION,
  LEXICAL_GRAVITY_LENS_VERSION,
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityLensCandidate,
  WorkshopLexicalGravityPreview
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { boundedLogText } from '@/utils/boundedLogText';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { PromptLoader } from '@/tools/shared/prompts';
import { LogSink } from '@/platform';
import type { RejectedModelResponseRecovery } from '@/application/services/RejectedModelResponseRecoveryService';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import {
  cloneLexicalGravityDraft,
  lexicalGravityConfigKey,
  validateLexicalGravityDraft,
  validateLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import { exactObject } from '@/application/services/workshop/persistedValidation';
import {
  lexicalGravityLensSlug
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
const LENSES_START = '===LEXICAL_GRAVITY_LENSES_V2===';
const LENSES_END = '===END_LEXICAL_GRAVITY_LENSES_V2===';
const PREVIEW_START = '===LEXICAL_GRAVITY_PREVIEW_V2===';
const PREVIEW_END = '===END_LEXICAL_GRAVITY_PREVIEW_V2===';

export class LexicalGravityModelService {
  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly promptLoader: PromptLoader,
    private readonly rejectedResponseRecovery: RejectedModelResponseRecovery,
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
        'Create three distinct interpretive-grammar takes for this quoted subject.',
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
    return this.parseCandidates(
      result.rawContent ?? result.content,
      normalizedQuery,
      result
    );
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
    // Local configuration failures are not provider failures. Resolve this
    // before the model call and outside the response-validation boundary so
    // diagnostics attribute the fault to the correct side of the seam.
    const configKey = lexicalGravityConfigKey(draft);
    const engine = this.requireEngine();
    const systemMessage = await this.promptLoader.loadPrompts([
      'lexical-gravity/01-preview.md'
    ]);
    const result = await engine.runInitial({
      toolName: 'lexical-gravity-preview',
      systemMessage,
      userMessage: [
        'Rewrite the source sample using the configured Lexical Gravity controls.',
        `Configuration (quoted JSON task data):\n${JSON.stringify({
          weight: draft.weight,
          applicationMode: draft.applicationMode,
          evidenceMode: draft.evidenceMode,
          reach: draft.reach,
          metaphorPull: draft.metaphorPull,
          lens: draft.resolvedLens
        }, null, 2)}`,
        `Source sample (quoted task data): ${JSON.stringify(sourceText)}`,
        'Return the exact sentinel-framed Preview v2 JSON protocol now.'
      ].join('\n\n'),
      policy: AGENT_RUN_POLICIES.assistantWithoutResources,
      options: {
        temperature: 0.55,
        maxTokens: BUDGET.lexicalPreviewOutputTokens,
        reasoning: { effort: 'low' },
        signal: options.signal
      }
    });
    if (result.cancelled) {throw new Error('Lexical Gravity preview was cancelled.');}
    const content = result.rawContent ?? result.content;
    try {
      if (result.finishReason === 'length') {
        throw new Error('response reached its output limit');
      }
      const framed = this.extractFrame(
        typeof content === 'string' ? content : '',
        PREVIEW_START,
        PREVIEW_END,
        BUDGET.lexicalPreviewResponseCharacters
      );
      const parsed = exactObject(
        JSON.parse(framed),
        'Lexical Gravity preview response',
        [
          'version', 'semanticPositions', 'selectedDynamicId',
          'openEntailment', 'text'
        ]
      );
      const validated = validateLexicalGravityDraft({
        ...draft,
        preview: { ...parsed, configKey, sourceText }
      });
      return validated.preview!;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[LexicalGravityModelService] Rejected preview response: ${reason}; ` +
        `finishReason=${result.finishReason ?? 'unknown'}`
      );
      this.outputChannel?.appendLine([
        '[LexicalGravityModelService] Rejected preview response body BEGIN',
        boundedLogText(typeof content === 'string' ? content : String(content ?? '')),
        '[LexicalGravityModelService] Rejected preview response body END'
      ].join('\n'));
      const recovery = await this.captureRejectedResponse(
        'lexical-gravity-preview',
        `Preview for lens ${JSON.stringify(draft.resolvedLens?.name ?? draft.resolvedLens?.slug ?? 'custom')} using ${sourceText.length} source characters`,
        typeof content === 'string' ? content : String(content ?? ''),
        reason,
        result
      );
      throw new Error(
        `The selected widget model did not return a usable preview.${recovery} `
        + 'Try Preview again or choose another model.'
      );
    }
  }

  private async parseCandidates(
    content: string,
    query: string,
    result: ExecutionResult
  ): Promise<WorkshopLexicalGravityLensCandidate[]> {
    try {
      if (result.finishReason === 'length') {
        throw new Error('response reached its output limit');
      }
      const framed = this.extractFrame(
        content,
        LENSES_START,
        LENSES_END,
        BUDGET.lexicalBuildResponseCharacters
      );
      const parsed = exactObject(
        JSON.parse(framed),
        'Lexical Gravity lens response',
        ['version', 'candidates']
      );
      if (
        parsed.version !== LEXICAL_GRAVITY_LENS_RESPONSE_ENVELOPE_VERSION
        || !Array.isArray(parsed.candidates)
      ) {
        throw new Error(
          `root must contain version ${LEXICAL_GRAVITY_LENS_RESPONSE_ENVELOPE_VERSION} ` +
          'and candidates'
        );
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
          version: LEXICAL_GRAVITY_LENS_VERSION,
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
          boundedLogText(content),
          '[LexicalGravityModelService] Rejected lens response body END'
        ].join('\n')
      );
      const recovery = await this.captureRejectedResponse(
        'lexical-gravity-build',
        `Build three interpretive lenses for ${JSON.stringify(query)}`,
        content,
        reason,
        result
      );
      throw new Error(
        `The model returned unusable interpretive lenses (${reason}).${recovery} `
        + 'Try building the lens again.'
      );
    }
  }

  private async captureRejectedResponse(
    toolName: string,
    requestSummary: string,
    rawResponse: string,
    rejection: string,
    result: ExecutionResult
  ): Promise<string> {
    const receipt = await this.rejectedResponseRecovery.capture({
      toolName,
      requestSummary,
      rawResponse,
      rejection,
      modelId: result.modelId,
      providerResponseId: result.providerResponseId,
      finishReason: result.finishReason,
      usage: result.usage
    });
    return receipt
      ? ` The complete response was saved for recovery at ${receipt.filePath}.`
      : ' The complete response could not be saved; see the Prose Minion output for details.';
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
