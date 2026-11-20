/**
 * Passage Search's types (ADR 2026-11-20 D2, D11): what a plan holds, what a
 * run returns, and the closed words between them. Types and constants only.
 *
 * Everything here is host-side. A file's `identity` and `absolutePath` never
 * cross to a view, a prompt or a log; a caller projects display-safe
 * fields outward itself.
 */

import type { TokenUsage } from '@messages';

/** A text to search, already in hand: a file as read, a selection, or a text given by value. */
export interface PassageSearchSourceFile {
  /** The host's identity for de-duplication (D3a): an absolute path, or a scope's own identity. */
  readonly identity: string;
  /** What a result shows for it: a workspace-relative path, or a text scope's label. */
  readonly displayPath: string;
  /** Where to open it; absent for a text with nothing to open. */
  readonly absolutePath?: string;
  readonly text: string;
  /** Lines of the document before the text's first line: a selection's start, else 0. */
  readonly lineOffset: number;
  /** Whether an instance's line is the document's, or counted within the text alone (D3). */
  readonly lines: 'document' | 'text';
}

/** A file in a plan: frozen as read, with the key a result names it by. */
export interface PassageSearchPlanFile extends PassageSearchSourceFile {
  /** The file's key in this plan and its result: `f1`, `f2`, in reading order. */
  readonly key: string;
  /** SHA-256 of `text`. */
  readonly sha256: string;
}

/** One read call's text: `files[file].text.slice(start, end)`, its overlap first (D5a). */
export interface PassageSearchPlanChunk {
  /** Index into the plan's files. */
  readonly file: number;
  readonly start: number;
  /** Where the chunk's own text starts, after the overlap; equal to `start` when it has none. */
  readonly bodyStart: number;
  readonly end: number;
}

/** Files a plan names but does not read, by why. Counted, never a refusal (D5a, D6). */
export interface PassageSearchLeftOut {
  /** Not readable as UTF-8 text. */
  readonly unreadable: number;
  /** Holds a sentence longer than a call's budget, so it has no place to split. */
  readonly unsplittable: number;
  /** Holds no words. */
  readonly empty: number;
}

/** What a model costs per token, in US dollars. */
export interface PassageSearchPricing {
  readonly promptUsdPerToken: number;
  readonly completionUsdPerToken: number;
}

/**
 * The price of a plan (D2, D12a, D14): approximate, never a cap. The reads
 * are exact input at a typical reply each; the organizing pass, when asked
 * for, is an allowance, since what it will read does not exist yet.
 */
export interface PassageSearchEstimate {
  readonly model: string;
  readonly files: number;
  /** Every call: the reads, plus one when the plan organizes. */
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Absent when the catalog has no live price for the model. */
  readonly usd?: number;
  readonly reads: { readonly calls: number; readonly inputTokens: number; readonly outputTokens: number };
  /** The organizing pass's allowance; absent when the plan does not organize. */
  readonly organize?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly leftOut: PassageSearchLeftOut;
}

/** What was priced, and exactly what a run searches and sends (D2). */
export interface PassageSearchPlan {
  /** A digest of everything shown and everything that decides what is sent (D2a). */
  readonly planKey: string;
  readonly model: string;
  readonly question: string;
  readonly organize: boolean;
  /** The system prompt as loaded for the estimate; every read call sends it. */
  readonly systemMessage: string;
  /** The word budget in force, after any lowering to fit the model's window (D5a). */
  readonly chunkWords: number;
  readonly files: readonly PassageSearchPlanFile[];
  /** In reading order: file by file, then by position. */
  readonly chunks: readonly PassageSearchPlanChunk[];
  readonly estimate: PassageSearchEstimate;
}

/** Every reason a plan is refused (D6), closed. The last two name bounds D6 states without a reason of their own. */
export const PASSAGE_SEARCH_REFUSALS = [
  'no-key',
  'no-question',
  'no-scope',
  'no-files',
  'too-many-files',
  'too-many-calls',
  'file-too-large',
  'unknown-group',
  'unknown-file',
  'ambiguous-file',
  'unsafe-pattern',
  'no-selection',
  'no-active-file',
  'model-too-small',
  'catalog-unreadable',
  'question-too-long',
  'too-many-scopes'
] as const;

export type PassageSearchRefusalReason = (typeof PASSAGE_SEARCH_REFUSALS)[number];

export interface PassageSearchRefusal {
  readonly reason: PassageSearchRefusalReason;
  /** Host words for the writer: they name the bound and the count, never a path. */
  readonly message: string;
}

export type PassageSearchPlanOutcome =
  | { readonly kind: 'planned'; readonly plan: PassageSearchPlan }
  | { readonly kind: 'refused'; readonly refusal: PassageSearchRefusal };

/** Why an instance a model listed is not in the result (D11), closed. */
export const PASSAGE_SEARCH_DROP_REASONS = ['quote-not-found', 'quote-ambiguous', 'malformed', 'duplicate'] as const;

export type PassageSearchDropReason = (typeof PASSAGE_SEARCH_DROP_REASONS)[number];

/** How a run's reads ended (D11). */
export const PASSAGE_SEARCH_ENDINGS = ['complete', 'stopped', 'key-changed', 'provider-failed', 'instance-limit'] as const;

export type PassageSearchEnded = (typeof PASSAGE_SEARCH_ENDINGS)[number];

/** One checked moment. Its quote and context are slices of the plan's frozen text, never a model's spelling (D9a, D11a). */
export interface PassageSearchInstance {
  /** From 1, in reading order: the instance's id for the rest of the result (D10). */
  readonly number: number;
  /** The plan file's key. */
  readonly file: string;
  readonly displayPath: string;
  /** 1-based; the document's, or within the text alone when the file says so. */
  readonly line: number;
  /** The range in the file's text. */
  readonly start: number;
  readonly end: number;
  readonly quote: string;
  /** Source text just before and just after the quote. */
  readonly before: string;
  readonly after: string;
  /** The model's words about the moment, clipped at the safety ceiling. */
  readonly note: string;
  /** The key of its label in `labels`. */
  readonly label: string;
}

/** One row of the host's label table (D10): the first spelling in reading order, with the host's counts. */
export interface PassageSearchLabel {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly files: number;
}

/** A result's file, as the host holds it. */
export interface PassageSearchResultFile {
  readonly key: string;
  readonly displayPath: string;
  readonly absolutePath?: string;
  readonly lines: 'document' | 'text';
  readonly instances: number;
}

/** The organizing pass's checked output (D12, D13). Slice 3 fills it. */
export interface PassageSearchAnalysis {
  readonly headline: string;
  readonly sections: ReadonlyArray<{
    readonly title: string;
    readonly claims: ReadonlyArray<{ readonly text: string; /** Instance numbers. */ readonly cites: readonly number[] }>;
  }>;
  /** How many instances the pass was shown, of how many the result holds. */
  readonly read: { readonly instances: number; readonly of: number };
  /** What the host's checks dropped. */
  readonly dropped: { readonly claims: number; readonly sections: number };
}

/** Why a pass that was started left no analysis (D13); the list is whole either way. */
export type PassageSearchAnalysisMissing = 'failed' | 'malformed' | 'cut' | 'no-room';

/** Typed, and honest about what is missing (D11). Nothing here is a model's count. */
export interface PassageSearchResult {
  readonly question: string;
  readonly model: string;
  readonly instances: readonly PassageSearchInstance[];
  readonly labels: readonly PassageSearchLabel[];
  readonly analysis?: PassageSearchAnalysis;
  /** Present when the pass was started and left no analysis. */
  readonly analysisMissing?: PassageSearchAnalysisMissing;
  readonly dropped: Readonly<Record<PassageSearchDropReason, number>>;
  /** Checked instances past the `instances` bound, not kept. */
  readonly overLimit: number;
  /** Read calls: `answered` holds the cut ones; `failed` and `unsent` do not. */
  readonly calls: { readonly planned: number; readonly answered: number; readonly failed: number; readonly cut: number; readonly unsent: number };
  readonly files: { readonly read: readonly PassageSearchResultFile[]; readonly leftOut: PassageSearchLeftOut };
  readonly ended: PassageSearchEnded;
  readonly usage?: TokenUsage;
}

export interface PassageSearchProgress {
  readonly calls: { readonly planned: number; readonly done: number };
  /** Checked instances so far, moments merged. */
  readonly found: number;
}

export interface PassageSearchRunOptions {
  /** Stop: no further call starts, and what was found is returned (D7, D12a). */
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: PassageSearchProgress) => void;
}
