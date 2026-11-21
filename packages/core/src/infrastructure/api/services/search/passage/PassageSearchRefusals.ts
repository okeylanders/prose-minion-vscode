/**
 * Why a plan is refused, in host words (ADR 2026-11-20 D6). One table, so
 * the engine's scope checks and the service's call plan word a refusal the
 * same way. The words name the bound and the count; they never name a path,
 * a pattern or the question. Pure.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  PassageSearchEnded,
  PassageSearchLeftOut,
  PassageSearchPlanOutcome,
  PassageSearchRefusal,
  PassageSearchRefusalReason
} from '@services/search/passage/PassageSearchContracts';

const number = (value: number): string => value.toLocaleString('en-US');
const plural = (count: number, one: string, many = `${one}s`): string => `${number(count)} ${count === 1 ? one : many}`;

/** The refusal for `reason`; `count` is what was found past (or under) the bound it names. */
export function passageSearchRefusal(reason: PassageSearchRefusalReason, count = 0, organizing = false): PassageSearchRefusal {
  return { reason, message: wordsFor(reason, count, organizing) };
}

/** `organizing`: the count of a `too-many-calls` holds the organizing call. */
export function refusedPlan(reason: PassageSearchRefusalReason, count = 0, organizing = false): PassageSearchPlanOutcome {
  return { kind: 'refused', refusal: passageSearchRefusal(reason, count, organizing) };
}

function wordsFor(reason: PassageSearchRefusalReason, count: number, organizing: boolean): string {
  const bounds = PROMPT_BUDGETS.passageSearch;
  switch (reason) {
    case 'no-key':
      return 'Passage Search needs an OpenRouter API key. Add one in Settings.';
    case 'no-question':
      return 'Ask a question to search for.';
    case 'question-too-long':
      return `The question is ${plural(count, 'character')} long; Passage Search takes up to ${number(bounds.questionCharacters)}.`;
    case 'no-scope':
      return 'Choose something to search.';
    case 'too-many-scopes':
      return `${plural(count, 'place')} were named; Passage Search takes up to ${number(bounds.scopes)} at once.`;
    case 'no-files':
      return 'Nothing to search: nothing you chose holds text Passage Search can read.';
    case 'too-many-files':
      return `That is ${plural(count, 'file')}; Passage Search reads up to ${number(bounds.files)} at once. Narrow what it searches.`;
    case 'too-many-calls':
      return `That would take ${plural(count, 'call')}${organizing ? ', one of them to organize the results' : ''}; Passage Search makes up to ${number(bounds.calls)} in one search. Narrow what it searches.`;
    case 'file-too-large':
      return `${plural(count, 'file is', 'files are')} larger than ${number(bounds.fileBytes / (1024 * 1024))} MiB, the most Passage Search reads in one file.`;
    case 'unknown-group':
      return 'One of the places named is not a context group.';
    case 'unknown-file':
      return 'A file named for the search is not in its context group.';
    case 'ambiguous-file':
      return 'A file named for the search is in more than one workspace folder under the same path, so it is not clear which was meant.';
    case 'unsafe-pattern':
      return 'That path or pattern cannot be searched. Use a path inside the project, with no "..", drive or leading slash.';
    case 'no-selection':
      return 'No text is selected in the editor.';
    case 'no-active-file':
      return 'No saved file is open in the editor.';
    case 'model-too-small':
      return `The model's context window is too small for Passage Search, which reads at least ${number(bounds.minChunkWords)} words a call. Choose another model.`;
    case 'catalog-unreadable':
      return 'The project\'s files could not be listed completely, so nothing was searched. Try again.';
  }
}

/** What an estimate says of files left out, before anything is sent (D5a); undefined when none were. */
export function describePassageSearchLeftOut(leftOut: PassageSearchLeftOut): string | undefined {
  const parts = [
    leftOut.unsplittable > 0 ? `${plural(leftOut.unsplittable, 'file')} left out: ${leftOut.unsplittable === 1 ? 'it has' : 'they have'} no place to split` : undefined,
    leftOut.unreadable > 0 ? `${plural(leftOut.unreadable, 'file')} left out: not readable as text` : undefined,
    leftOut.empty > 0 ? `${plural(leftOut.empty, 'file')} left out: no text` : undefined
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? `${parts.join('. ')}.` : undefined;
}

/** How a run that did not read everything ended, in host words (D11); undefined for a complete one. */
export function describePassageSearchEnding(ended: PassageSearchEnded): string | undefined {
  switch (ended) {
    case 'complete':
      return undefined;
    case 'stopped':
      return 'Stopped before every call was answered.';
    case 'key-changed':
      return 'The API key changed during the search, so the remaining calls were not made.';
    case 'provider-failed':
      return `The provider refused ${number(PROMPT_BUDGETS.passageSearch.failureStreak)} calls in a row, so the remaining calls were not made. Check the account's credits and limits, then search again.`;
    case 'instance-limit':
      return `The search reached ${number(PROMPT_BUDGETS.passageSearch.instances)} instances, the most it keeps, and stopped there.`;
  }
}
