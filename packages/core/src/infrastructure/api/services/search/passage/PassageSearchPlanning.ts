/**
 * Building a Passage Search plan from files in hand (ADR 2026-11-20 D2, D2a,
 * D5a, D12a, D14): the call plan, the estimate, and the key that names both.
 * Pure: the model, the system prompt and the catalog's facts arrive as data.
 *
 * - **Every rendered request is measured** (`estimateRequestTokens` over the
 *   exact messages a read call sends), with its output ceiling. When the
 *   model's context length is known, every request fits half the window, or
 *   the word budget is lowered and every file chunked again; under
 *   `minChunkWords` the plan is `model-too-small`.
 * - **A file with a sentence over the budget in force is left out,** and
 *   counted, as is one with no words.
 * - **The estimate has two parts:** the reads, exact input at a typical
 *   reply each, and, when the plan organizes, the pass's allowance.
 * - **`calls` bounds the whole plan.** A planned organizing call takes one
 *   of its places, so such a plan reads at most one fewer chunk.
 * - **`planKey` covers what the writer is shown and what decides what is
 *   sent:** the model, the question, the organize option, the system prompt,
 *   each file's identity and hash, the files left out, the budget in force
 *   and every chunk's file and range, the output ceilings the calls are
 *   sent with, the token figures and the pricing basis. Two plans with one key show the same line and send the same
 *   requests.
 */

import { createHash } from 'crypto';
import { estimateRequestTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  PassageSearchEstimate,
  PassageSearchLeftOut,
  PassageSearchPlan,
  PassageSearchPlanChunk,
  PassageSearchPlanFile,
  PassageSearchSourceFile
} from '@services/search/passage/PassageSearchContracts';
import { passageSearchMessages } from '@services/search/passage/PassageSearchMessages';
import type { PassageSearchModelFacts } from '@services/search/passage/PassageSearchPrices';
import { passageChunks } from '@services/search/passage/passageChunks';

/** A file named by the scopes and not read, by identity: part of what a plan's key covers. */
export interface PassageSearchLeftOutFile {
  readonly identity: string;
  readonly reason: keyof PassageSearchLeftOut;
}

export interface PassageSearchPlanInput {
  readonly model: string;
  readonly question: string;
  readonly organize: boolean;
  readonly systemMessage: string;
  /** In reading order, each once. */
  readonly files: readonly PassageSearchSourceFile[];
  /** Files the caller already left out (unreadable as text). */
  readonly leftOut: readonly PassageSearchLeftOutFile[];
  readonly facts: PassageSearchModelFacts;
}

export type PassageSearchBounds = typeof PROMPT_BUDGETS.passageSearch;

export type PassageSearchPlanned =
  | { readonly kind: 'planned'; readonly plan: PassageSearchPlan }
  | { readonly kind: 'model-too-small' }
  /** Nothing is left to read. */
  | { readonly kind: 'no-files' }
  /** `calls` is the whole plan's: the reads, and the organizing call when one is planned. */
  | { readonly kind: 'too-many-calls'; readonly calls: number; readonly organizing: boolean };

interface CallPlan {
  readonly chunkWords: number;
  readonly files: readonly PassageSearchSourceFile[];
  readonly chunks: readonly PassageSearchPlanChunk[];
  readonly leftOut: readonly PassageSearchLeftOutFile[];
  readonly inputTokens: number;
  /** The largest single request, in tokens, before its output. */
  readonly largestRequest: number;
}

export function buildPassageSearchPlan(input: PassageSearchPlanInput, bounds: PassageSearchBounds = PROMPT_BUDGETS.passageSearch): PassageSearchPlanned {
  const calls = fittedCallPlan(input, bounds);
  if (!calls) {
    return { kind: 'model-too-small' };
  }
  if (calls.chunks.length === 0) {
    return { kind: 'no-files' };
  }
  // The bound is on the whole plan (D6): a planned organizing call takes one of its places.
  const planned = calls.chunks.length + (input.organize ? 1 : 0);
  if (planned > bounds.calls) {
    return { kind: 'too-many-calls', calls: planned, organizing: input.organize };
  }
  const ceilings = {
    readOutputTokens: bounds.outputTokens,
    ...(input.organize ? { organizeOutputTokens: bounds.organize.outputTokens } : {})
  };
  const files = calls.files.map((file, index): PassageSearchPlanFile => ({ ...file, key: `f${index + 1}`, sha256: sha256(file.text) }));
  const leftOut = [...input.leftOut, ...calls.leftOut];
  const estimate = estimateOf(input, calls, leftOut, bounds);
  return {
    kind: 'planned',
    plan: {
      planKey: planKeyOf(input, calls, files, leftOut, estimate, ceilings),
      model: input.model,
      question: input.question,
      organize: input.organize,
      systemMessage: input.systemMessage,
      chunkWords: calls.chunkWords,
      ceilings,
      files,
      chunks: calls.chunks,
      estimate
    }
  };
}

/** The call plan at the largest budget whose every request fits half the window; undefined when none at or over the minimum does. */
function fittedCallPlan(input: PassageSearchPlanInput, bounds: PassageSearchBounds): CallPlan | undefined {
  const half = input.facts.contextLength !== undefined ? Math.floor(input.facts.contextLength / 2) : undefined;
  let budget = bounds.chunkWords;
  for (;;) {
    const calls = callPlanAt(input, budget, bounds);
    const largest = calls.largestRequest + bounds.outputTokens;
    if (half === undefined || calls.chunks.length === 0 || largest <= half) {
      return calls;
    }
    if (budget <= bounds.minChunkWords) {
      return undefined;
    }
    // Scaled toward the fit with a margin, and always lower, so the loop ends.
    budget = Math.max(bounds.minChunkWords, Math.min(budget - 1, Math.floor((budget * half * 0.9) / largest)));
  }
}

function callPlanAt(input: PassageSearchPlanInput, budget: number, bounds: PassageSearchBounds): CallPlan {
  const files: PassageSearchSourceFile[] = [];
  const chunks: PassageSearchPlanChunk[] = [];
  const leftOut: PassageSearchLeftOutFile[] = [];
  let inputTokens = 0;
  let largestRequest = 0;
  for (const file of input.files) {
    const split = passageChunks(file.text, budget, bounds.overlapWords);
    if (split.kind === 'unsplittable' || split.chunks.length === 0) {
      leftOut.push({ identity: file.identity, reason: split.kind === 'unsplittable' ? 'unsplittable' : 'empty' });
      continue;
    }
    const index = files.push(file) - 1;
    for (const chunk of split.chunks) {
      const tokens = estimateRequestTokens(passageSearchMessages(input.systemMessage, input.question, file.text.slice(chunk.start, chunk.end)));
      inputTokens += tokens;
      largestRequest = Math.max(largestRequest, tokens);
      chunks.push({ file: index, start: chunk.start, bodyStart: chunk.bodyStart, end: chunk.end });
    }
  }
  return { chunkWords: budget, files, chunks, leftOut, inputTokens, largestRequest };
}

function estimateOf(
  input: PassageSearchPlanInput,
  calls: CallPlan,
  leftOut: readonly PassageSearchLeftOutFile[],
  bounds: PassageSearchBounds
): PassageSearchEstimate {
  const reads = { calls: calls.chunks.length, inputTokens: calls.inputTokens, outputTokens: calls.chunks.length * bounds.typicalOutputTokens };
  // An allowance, said to be one: what the pass will read does not exist yet (D12a).
  const organize = input.organize
    ? { inputTokens: bounds.organize.allowanceInputTokens, outputTokens: bounds.organize.typicalOutputTokens }
    : undefined;
  const inputTokens = reads.inputTokens + (organize?.inputTokens ?? 0);
  const outputTokens = reads.outputTokens + (organize?.outputTokens ?? 0);
  const pricing = input.facts.pricing;
  const count = (reason: keyof PassageSearchLeftOut): number => leftOut.filter((file) => file.reason === reason).length;
  return {
    model: input.model,
    files: calls.files.length,
    calls: reads.calls + (organize ? 1 : 0),
    inputTokens,
    outputTokens,
    ...(pricing ? { usd: inputTokens * pricing.promptUsdPerToken + outputTokens * pricing.completionUsdPerToken } : {}),
    reads,
    ...(organize ? { organize } : {}),
    leftOut: { unreadable: count('unreadable'), unsplittable: count('unsplittable'), empty: count('empty') }
  };
}

function planKeyOf(
  input: PassageSearchPlanInput,
  calls: CallPlan,
  files: readonly PassageSearchPlanFile[],
  leftOut: readonly PassageSearchLeftOutFile[],
  estimate: PassageSearchEstimate,
  ceilings: PassageSearchPlan['ceilings']
): string {
  const pricing = input.facts.pricing;
  return sha256(JSON.stringify({
    version: 1,
    model: input.model,
    question: input.question,
    organize: input.organize,
    system: sha256(input.systemMessage),
    files: files.map((file) => [file.identity, file.sha256, file.lineOffset, file.displayPath]),
    leftOut: leftOut.map((file) => [file.identity, file.reason]),
    chunkWords: calls.chunkWords,
    chunks: calls.chunks.map((chunk) => [chunk.file, chunk.start, chunk.bodyStart, chunk.end]),
    ceilings: [ceilings.readOutputTokens, ceilings.organizeOutputTokens ?? null],
    tokens: [estimate.reads.inputTokens, estimate.reads.outputTokens, estimate.organize?.inputTokens ?? null, estimate.organize?.outputTokens ?? null],
    // The basis, not the product: a price that moved, appeared or went away is a different plan.
    pricing: pricing ? [pricing.promptUsdPerToken, pricing.completionUsdPerToken] : null
  }));
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
