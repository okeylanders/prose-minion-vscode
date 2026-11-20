/**
 * Passage Search in words (ADR 2026-11-20 D11, D12a, D14, D15): the lines a
 * view writes from an estimate or a display-safe result. One table, so the
 * sidebar panel and the Markdown report say the same thing. Pure; shared by
 * the host and the webview.
 *
 * A price is approximate, never a cap: "≈ $0.42", never "up to". Every
 * count here is the host's.
 */

import type {
  PassageSearchEstimateView,
  PassageSearchInstanceView,
  PassageSearchOrganizeEstimateView,
  PassageSearchResultView
} from '@messages';
import { formatApproximateUsd } from '@shared/utils/approximateUsd';

const number = (value: number): string => value.toLocaleString('en-US');
const plural = (count: number, one: string, many = `${one}s`): string => `${number(count)} ${count === 1 ? one : many}`;

const priceOf = (usd: number | undefined): string => (usd === undefined ? 'price unavailable' : formatApproximateUsd(usd));

/** "23 calls · ≈ $0.42 · <model>"; with no live price, "23 calls · price unavailable · <model>". */
export function passageSearchEstimateLine(estimate: Pick<PassageSearchEstimateView, 'calls' | 'usd' | 'model'>): string {
  return `${plural(estimate.calls, 'call')} · ${priceOf(estimate.usd)} · ${estimate.model}`;
}

/** What stands under the estimate line: what will be read, the allowance when there is one, and files left out. */
export function passageSearchEstimateDetails(estimate: PassageSearchEstimateView): string[] {
  return [
    `${plural(estimate.files, 'file')} to read. The price is an estimate, not a limit.`,
    ...(estimate.organizeAllowance ? ['It includes an allowance for organizing the results.'] : []),
    ...(estimate.leftOutMessage ? [estimate.leftOutMessage] : [])
  ];
}

/** "1 call · ≈ $0.03 · <model>" for organizing a result that exists. */
export function passageSearchOrganizeEstimateLine(estimate: PassageSearchOrganizeEstimateView): string {
  return passageSearchEstimateLine(estimate);
}

/** Said beside an organizing estimate when the pass would not read every instance. */
export function passageSearchOrganizeSample(instances: { read: number; of: number }): string | undefined {
  return instances.read < instances.of ? `It would read ${number(instances.read)} of ${plural(instances.of, 'instance')}.` : undefined;
}

/** "Reading 7 of 23 · 5 found". */
export function passageSearchProgressLine(progress: { calls: { planned: number; done: number }; found: number }): string {
  return `Reading ${number(progress.calls.done)} of ${number(progress.calls.planned)} · ${number(progress.found)} found`;
}

/** The host's own headline: "14 instances in 6 files", or that nothing was found. */
export function passageSearchSummary(result: Pick<PassageSearchResultView, 'instances' | 'files'>): string {
  return result.instances.length === 0
    ? `No instances found in ${plural(result.files.read, 'file')}.`
    : `${plural(result.instances.length, 'instance')} in ${plural(result.files.withInstances, 'file')}`;
}

/** "alice-ch1.md · line 12"; a line counted within the searched text alone says so. */
export function passageSearchLocation(instance: Pick<PassageSearchInstanceView, 'file' | 'line' | 'lines'>): string {
  return `${instance.file} · line ${number(instance.line)}${instance.lines === 'text' ? ' of the searched text' : ''}`;
}

/** "[#4, #12]". */
export function passageSearchCites(cites: readonly number[]): string {
  return `[${cites.map((cite) => `#${cite}`).join(', ')}]`;
}

/** What the reads covered: "Read 23 files in 23 calls." or how many of the planned calls were answered. */
export function passageSearchReadLine(result: Pick<PassageSearchResultView, 'calls' | 'files'>): string {
  const { calls } = result;
  return calls.answered === calls.planned
    ? `Read ${plural(result.files.read, 'file')} in ${plural(calls.planned, 'call')}.`
    : `${number(calls.answered)} of ${plural(calls.planned, 'call')} answered, over ${plural(result.files.read, 'file')}.`;
}

/** Why a started organizing pass left no analysis, or how much of the list an analysis read; undefined when neither applies. */
export function passageSearchAnalysisNote(result: Pick<PassageSearchResultView, 'analysis' | 'analysisMissing'>): string | undefined {
  if (result.analysis) {
    const { read } = result.analysis;
    return read.instances < read.of ? `The analysis read ${number(read.instances)} of ${plural(read.of, 'instance')}.` : undefined;
  }
  switch (result.analysisMissing) {
    case 'failed':
      return 'The results were not organized: the organizing call failed. The list below is whole.';
    case 'malformed':
      return 'The results were not organized: the organizing reply could not be read. The list below is whole.';
    case 'cut':
      return 'The results were not organized: the organizing reply was cut off. The list below is whole.';
    case 'no-room':
      return 'The results were not organized: the model has no room to read them. The list below is whole.';
    default:
      return undefined;
  }
}

/** What is missing from the result and why, one line each; empty when nothing is. */
export function passageSearchMissingLines(result: PassageSearchResultView): string[] {
  const { calls, dropped } = result;
  const lines: string[] = [];
  const add = (count: number, line: string) => {
    if (count > 0) {
      lines.push(line);
    }
  };
  const coverage = result.files.coverage;
  if (coverage) {
    add(coverage.none, `${number(coverage.none)} of ${plural(result.files.read, 'file')} ${coverage.none === 1 ? 'was' : 'were'} not searched.`);
    add(coverage.partial, `${number(coverage.partial)} of ${plural(result.files.read, 'file')} ${coverage.partial === 1 ? 'was' : 'were'} searched only in part.`);
  }
  const cancelled = calls.cancelled ?? 0;
  add(cancelled, `${plural(cancelled, 'call was', 'calls were')} cancelled when the search stopped, so the text they cover was not searched.`);
  add(calls.unsent, `${plural(calls.unsent, 'call was', 'calls were')} not made, so the text they cover was not searched.`);
  add(calls.failed, `${plural(calls.failed, 'call')} failed, so the text ${calls.failed === 1 ? 'it covers' : 'they cover'} was not searched.`);
  add(calls.cut, `${plural(calls.cut, 'reply was', 'replies were')} cut off at the length limit; the instances finished before the cut are kept.`);
  add(result.overLimit, `${plural(result.overLimit, 'instance')} past the most a search keeps ${result.overLimit === 1 ? 'was' : 'were'} not kept.`);
  add(dropped['quote-not-found'], `${plural(dropped['quote-not-found'], 'quote')} could not be found in the text as quoted, so ${dropped['quote-not-found'] === 1 ? 'it is' : 'they are'} not listed.`);
  add(dropped['quote-ambiguous'], `${plural(dropped['quote-ambiguous'], 'quote')} matched more than one place, so ${dropped['quote-ambiguous'] === 1 ? 'it is' : 'they are'} not listed.`);
  add(dropped.malformed, `${plural(dropped.malformed, 'instance')} in a reply could not be read.`);
  add(dropped.duplicate, `${plural(dropped.duplicate, 'repeat')} of a moment already listed ${dropped.duplicate === 1 ? 'was' : 'were'} merged into it.`);
  if (result.analysis) {
    add(result.analysis.dropped.claims, `${plural(result.analysis.dropped.claims, 'claim')} in the analysis ${result.analysis.dropped.claims === 1 ? 'was' : 'were'} left out: ${result.analysis.dropped.claims === 1 ? 'it' : 'they'} cited no instance here, or quoted one wrongly.`);
    add(result.analysis.dropped.sections, `${plural(result.analysis.dropped.sections, 'section')} of the analysis ${result.analysis.dropped.sections === 1 ? 'was' : 'were'} left with no claim, and left out.`);
  }
  if (result.leftOutMessage) {
    lines.push(result.leftOutMessage);
  }
  return lines;
}
