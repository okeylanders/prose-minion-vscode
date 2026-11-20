/**
 * What a caller asks Passage Search (ADR 2026-11-20 D2, D3): a question, 1
 * to `scopes` places to read, and whether to organize what is found. Types
 * and the request's own form checks. Pure.
 *
 * Who may send which scope is the caller's rule, not the engine's (D3):
 * `active-file`, `selection` and `pattern` are for a caller the writer is
 * typing into; any caller sends `group`, `file` and `text`. A `pattern` is
 * marked `writerTyped`, so a caller whose scopes come from a model cannot
 * build one by accident.
 */

import type { ConfiguredResourceRef } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup, type ContextPathGroup } from '@shared/types/context';
import { contextPathPatternRefusal } from '@/application/services/contextPaths/ContextPathPatternSafety';
import { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';
import type { PassageSearchRefusal } from '@services/search/passage/PassageSearchContracts';
import { passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';

export type PassageSearchScope =
  /** The active editor's document. */
  | { readonly kind: 'active-file' }
  /** The editor's selection. */
  | { readonly kind: 'selection' }
  /** Every file in a context group. */
  | { readonly kind: 'group'; readonly group: ContextPathGroup }
  /** One configured file, by catalog key. */
  | { readonly kind: 'file'; readonly file: ConfiguredResourceRef }
  /** A path or glob the writer typed. Never built from a model's words. */
  | { readonly kind: 'pattern'; readonly pattern: string; readonly writerTyped: true }
  /** A text by value, with the label a result shows for it. Its instances have a line within it and nothing to open. */
  | { readonly kind: 'text'; readonly label: string; readonly text: string };

export interface PassageSearchRequest {
  readonly question: string;
  readonly scopes: readonly PassageSearchScope[];
  /** Ask for the organizing pass over what is found (D12). */
  readonly organize: boolean;
}

/** The request's form, checked before anything is read or awaited; undefined when it may be planned. */
export function passageSearchRequestRefusal(request: PassageSearchRequest): PassageSearchRefusal | undefined {
  const bounds = PROMPT_BUDGETS.passageSearch;
  const question = request.question.trim();
  if (question.length === 0) {
    return passageSearchRefusal('no-question');
  }
  if (question.length > bounds.questionCharacters) {
    return passageSearchRefusal('question-too-long', question.length);
  }
  if (request.scopes.length === 0) {
    return passageSearchRefusal('no-scope');
  }
  if (request.scopes.length > bounds.scopes) {
    return passageSearchRefusal('too-many-scopes', request.scopes.length);
  }
  for (const scope of request.scopes) {
    switch (scope.kind) {
      case 'group':
        if (!isContextPathGroup(scope.group)) {
          return passageSearchRefusal('unknown-group');
        }
        break;
      case 'file':
        if (!isContextPathGroup(scope.file.group)) {
          return passageSearchRefusal('unknown-group');
        }
        // A path the catalog could never hold names no file in it.
        if (!isSafeConfiguredResourcePath(scope.file.path)) {
          return passageSearchRefusal('unknown-file');
        }
        break;
      case 'pattern':
        // Refused before anything normalizes it, as a context path is (ADR 2026-11-19 D22).
        if (scope.writerTyped !== true || contextPathPatternRefusal(scope.pattern) !== undefined) {
          return passageSearchRefusal('unsafe-pattern');
        }
        break;
      default:
        break;
    }
  }
  return undefined;
}
