import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopContextIntakeService } from '../WorkshopContextIntakeService';

export const WORKSHOP_PROBLEMS_BOUNDS = PROMPT_BUDGETS.workshopProblems;

/** A UTF-16 prefix for publisher text and live-buffer quotes. A boundary never splits a surrogate pair. */
export function workshopProblemTextPrefix(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  const last = text.charCodeAt(limit - 1);
  const next = text.charCodeAt(limit);
  const splitsPair = last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
  return text.slice(0, splitsPair ? limit - 1 : limit);
}

/** Published position in the file. Lines and UTF-16 columns are 1-based; the end is exclusive. */
export interface WorkshopProblemRow {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly severity: 'error' | 'warning' | 'information' | 'hint';
  readonly source?: string;
  readonly message: string;
  /** The published range in the live buffer, when available. */
  readonly quote?: string;
  readonly sourceTruncated?: boolean;
  readonly messageTruncated?: boolean;
  readonly quoteTruncated?: boolean;
}

export interface WorkshopProblemsPage {
  readonly total: number;
  readonly problems: readonly WorkshopProblemRow[];
}

export interface WorkshopProblemsReader {
  /** A page at the 1-based start in this file's current snapshot. Undefined means the provider was unavailable. */
  read(fsPath: string, start: number): Promise<WorkshopProblemsPage | undefined>;
}

export interface WorkshopProblemsPorts {
  readonly intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>;
  readonly reader: WorkshopProblemsReader;
}
