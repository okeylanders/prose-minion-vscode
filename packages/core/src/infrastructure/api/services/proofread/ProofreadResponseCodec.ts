/**
 * A Proofread reply's issues (ADR 2026-10-21 D6): forgiving per chunk,
 * fail-closed per issue. Pure: no host, no I/O.
 *
 * - A field the format does not define, at the root or on an issue, is
 *   ignored and counted, never named: its name is the model's (the
 *   Lightbox's rule, Slice 4K). A model adding `confidence` must not cost a
 *   paid chunk.
 * - An issue missing a required field, with a `category` outside the closed
 *   set, or quoting more than a proofreading span, is dropped and counted.
 *   The category drives policy, so it is never guessed.
 * - Only a root of the wrong shape (no `issues` array, or a `version` other
 *   than 1) rejects the whole chunk.
 *
 * Context and explanations are clipped to their ceilings; a quote is never
 * clipped, because a clipped quote would place the issue somewhere else.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isProofreadCategory, type ProofreadFinding } from '@/domain/models/ProofreadIssue';
import { ProofreadFrameError } from '@services/proofread/ProofreadResponseFrame';

export interface ProofreadReply {
  readonly findings: readonly ProofreadFinding[];
  /** Issues dropped as malformed. */
  readonly malformed: number;
  /** Fields the format does not define, ignored. */
  readonly ignoredFields: number;
}

const ROOT_FIELDS: ReadonlySet<string> = new Set(['version', 'issues']);
const ISSUE_FIELDS: ReadonlySet<string> = new Set(['category', 'original', 'before', 'after', 'replacement', 'explanation']);

/** Decode a frame's root; throws `ProofreadFrameError` when the root has the wrong shape. */
export function decodeProofreadReply(root: Record<string, unknown>): ProofreadReply {
  if (root.version !== undefined && root.version !== 1) {
    throw new ProofreadFrameError('The response must be version 1');
  }
  if (!Array.isArray(root.issues)) {
    throw new ProofreadFrameError('The response must have an issues array');
  }
  let ignoredFields = Object.keys(root).filter((key) => !ROOT_FIELDS.has(key)).length;
  let malformed = 0;
  const findings: ProofreadFinding[] = [];
  for (const item of root.issues as unknown[]) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      malformed += 1;
      continue;
    }
    const issue = item as Record<string, unknown>;
    ignoredFields += Object.keys(issue).filter((key) => !ISSUE_FIELDS.has(key)).length;
    const finding = decodeIssue(issue);
    if (finding) {
      findings.push(finding);
    } else {
      malformed += 1;
    }
  }
  return { findings, malformed, ignoredFields };
}

function decodeIssue(issue: Record<string, unknown>): ProofreadFinding | undefined {
  const B = PROMPT_BUDGETS.proofread;
  const { category, original, before, after, replacement, explanation } = issue;
  if (!isProofreadCategory(category)) {
    return undefined;
  }
  if (typeof original !== 'string' || original.length === 0 || original.length > B.quoteCharacters) {
    return undefined;
  }
  if (typeof explanation !== 'string' || explanation.trim().length === 0) {
    return undefined;
  }
  if (!optionalString(before) || !optionalString(after)) {
    return undefined;
  }
  if (replacement !== undefined && replacement !== null
    && (typeof replacement !== 'string' || replacement.length > B.quoteCharacters * 2)) {
    return undefined;
  }
  return {
    anchor: {
      quote: original,
      ...(typeof before === 'string' && before.length > 0 ? { before: before.slice(-B.contextCharacters) } : {}),
      ...(typeof after === 'string' && after.length > 0 ? { after: after.slice(0, B.contextCharacters) } : {})
    },
    category,
    ...(typeof replacement === 'string' ? { replacement } : {}),
    explanation: clip(explanation.trim(), B.explanationCharacters)
  };
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function clip(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
