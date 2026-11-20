/**
 * What crosses between the sidebar and the Passage Search engine (ADR
 * 2026-11-20 D15), both ways. Pure.
 *
 * - **In:** the webview's scope choices become the engine's request. Only
 *   the question, the path or pattern field and the choices are read; a
 *   selection and every file are read on the host, by the engine.
 * - **Out:** a plan's estimate and a run's result become display-safe
 *   views: display paths, lines, quotes, notes, labels and counts. An
 *   absolute path, a file's identity and the plan's file keys stay here.
 */

import type {
  PassageSearchCoverageView,
  PassageSearchEstimateView,
  PassageSearchOrganizeEstimateView,
  PassageSearchResultView
} from '@messages';
import { CONTEXT_PATH_GROUPS, type ContextPathGroup } from '@shared/types/context';
import type { PassageSearchRequest, PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';
import type { PassageSearchEstimate, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganizePlan } from '@services/search/passage/PassageSearchOrganizer';
import { describePassageSearchEnding, describePassageSearchLeftOut } from '@services/search/passage/PassageSearchRefusals';

/** The most the path or pattern field is read; the engine bounds how many scopes it may name. */
const PATTERN_FIELD_CHARACTERS = 4000;
/** The most a question is read before the engine's own bound refuses it in words. */
const QUESTION_FIELD_CHARACTERS = 20000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The patterns a path or pattern field names: one a line, or comma-separated. */
export function passageSearchPatternsOf(field: string): string[] {
  return field.split(/[\n,]/).map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);
}

/**
 * The engine's request for a plan request's payload; undefined when the
 * payload is not the shape the panel sends. Scopes come out in a fixed
 * order: the active file, the selection, the groups in the catalog's order,
 * then each typed pattern.
 */
export function passageSearchRequestOf(payload: unknown): PassageSearchRequest | undefined {
  if (!isRecord(payload) || typeof payload.question !== 'string' || typeof payload.organize !== 'boolean' || !isRecord(payload.scopes)) {
    return undefined;
  }
  const { activeFile, selection, groups, pattern } = payload.scopes;
  if (
    typeof activeFile !== 'boolean' ||
    typeof selection !== 'boolean' ||
    !Array.isArray(groups) ||
    groups.length > CONTEXT_PATH_GROUPS.length ||
    !groups.every((group): group is string => typeof group === 'string') ||
    typeof pattern !== 'string' ||
    pattern.length > PATTERN_FIELD_CHARACTERS ||
    payload.question.length > QUESTION_FIELD_CHARACTERS
  ) {
    return undefined;
  }
  const scopes: PassageSearchScope[] = [];
  if (activeFile) {
    scopes.push({ kind: 'active-file' });
  }
  if (selection) {
    scopes.push({ kind: 'selection' });
  }
  const chosen = new Set(groups);
  for (const group of CONTEXT_PATH_GROUPS) {
    if (chosen.delete(group)) {
      scopes.push({ kind: 'group', group });
    }
  }
  // A name that is no context group is kept, so the engine refuses it in its own words.
  for (const unknown of chosen) {
    scopes.push({ kind: 'group', group: unknown as ContextPathGroup });
  }
  for (const typed of passageSearchPatternsOf(pattern)) {
    scopes.push({ kind: 'pattern', pattern: typed, writerTyped: true });
  }
  return { question: payload.question, scopes, organize: payload.organize };
}

export function passageSearchEstimateView(estimate: PassageSearchEstimate): PassageSearchEstimateView {
  const leftOutMessage = describePassageSearchLeftOut(estimate.leftOut);
  return {
    model: estimate.model,
    files: estimate.files,
    calls: estimate.calls,
    inputTokens: estimate.inputTokens,
    outputTokens: estimate.outputTokens,
    ...(estimate.usd !== undefined ? { usd: estimate.usd } : {}),
    organizeAllowance: estimate.organize !== undefined,
    leftOut: { ...estimate.leftOut },
    ...(leftOutMessage ? { leftOutMessage } : {})
  };
}

export function passageSearchOrganizeEstimateView(plan: PassageSearchOrganizePlan): PassageSearchOrganizeEstimateView {
  return {
    model: plan.estimate.model,
    calls: plan.estimate.calls,
    inputTokens: plan.estimate.inputTokens,
    outputTokens: plan.estimate.outputTokens,
    ...(plan.estimate.usd !== undefined ? { usd: plan.estimate.usd } : {}),
    instances: { read: plan.instances.read, of: plan.instances.of }
  };
}

/**
 * Two things the engine is gaining in review (PR #293) and may not carry
 * yet: a `cancelled` call count, apart from `unsent`, and each read file's
 * `coverage`. They are read here, and only here, so the views follow the
 * engine the day it has them; until then neither is sent.
 */
type FileCoverage = 'full' | 'partial' | 'none';
const isCoverage = (value: unknown): value is FileCoverage => value === 'full' || value === 'partial' || value === 'none';

function cancelledCallsOf(result: PassageSearchResult): number | undefined {
  const cancelled = (result.calls as { cancelled?: unknown }).cancelled;
  return typeof cancelled === 'number' ? cancelled : undefined;
}

function coverageOf(result: PassageSearchResult): PassageSearchCoverageView | undefined {
  const marks = result.files.read.map((file) => (file as { coverage?: unknown }).coverage);
  if (marks.length === 0 || !marks.every(isCoverage)) {
    return undefined;
  }
  const count = (mark: FileCoverage): number => marks.filter((found) => found === mark).length;
  return { full: count('full'), partial: count('partial'), none: count('none') };
}

/** Whether a result's reads were cut short, so its organizing pass never started (D12a). */
export function passageSearchReadsCutShort(result: PassageSearchResult): boolean {
  return result.ended === 'stopped' || result.ended === 'key-changed' || result.ended === 'provider-failed';
}

export function passageSearchResultView(result: PassageSearchResult, resultId: string, canOrganize: boolean): PassageSearchResultView {
  const labels = new Map(result.labels.map((label) => [label.key, label.label]));
  const files = new Map(result.files.read.map((file) => [file.key, file]));
  const endedMessage = describePassageSearchEnding(result.ended);
  const leftOutMessage = describePassageSearchLeftOut(result.files.leftOut);
  const cancelled = cancelledCallsOf(result);
  const coverage = coverageOf(result);
  const { planned, answered, failed, cut, unsent } = result.calls;
  return {
    resultId,
    question: result.question,
    model: result.model,
    instances: result.instances.map((instance) => {
      const file = files.get(instance.file);
      return {
        number: instance.number,
        file: instance.displayPath,
        line: instance.line,
        lines: file?.lines ?? 'text',
        canOpen: file?.absolutePath !== undefined,
        quote: instance.quote,
        before: instance.before,
        after: instance.after,
        note: instance.note,
        label: labels.get(instance.label) ?? instance.label
      };
    }),
    labels: result.labels.map((label) => ({ label: label.label, count: label.count, files: label.files })),
    ...(result.analysis
      ? {
          analysis: {
            headline: result.analysis.headline,
            sections: result.analysis.sections.map((section) => ({
              title: section.title,
              claims: section.claims.map((claim) => ({ text: claim.text, cites: [...claim.cites] }))
            })),
            read: { ...result.analysis.read },
            dropped: { ...result.analysis.dropped }
          }
        }
      : {}),
    ...(result.analysisMissing ? { analysisMissing: result.analysisMissing } : {}),
    dropped: { ...result.dropped },
    overLimit: result.overLimit,
    calls: { planned, answered, failed, cut, unsent, ...(cancelled !== undefined ? { cancelled } : {}) },
    files: {
      read: result.files.read.length,
      withInstances: result.files.read.filter((file) => file.instances > 0).length,
      leftOut: { ...result.files.leftOut },
      ...(coverage ? { coverage } : {})
    },
    ended: result.ended,
    ...(endedMessage ? { endedMessage } : {}),
    ...(leftOutMessage ? { leftOutMessage } : {}),
    canOrganize,
    ...(result.usage ? { usage: result.usage } : {})
  };
}
