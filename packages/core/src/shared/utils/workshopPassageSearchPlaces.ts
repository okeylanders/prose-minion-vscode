/**
 * Where a persona's passage-search card would look, in words (ADR
 * 2026-11-20 S45): the card's "Where:" line and the results directive's
 * "Searched:" line say it the same way. Pure.
 *
 * - A group by its label; a narrowed group with its patterns ("Draft
 *   Chapters & Outlines, matching Drafts/chapter-4.*.md, Drafts/chapter-1*.md"),
 *   so the writer sees what will be read before paying.
 * - A configured file by its group's label and its catalog path.
 * - The excerpt as "the excerpt".
 *
 * The words hold paths and patterns: they are drawn on the card and written
 * into the persona's frame (which neutralizes them), never into a log, a
 * transcript or an export.
 */

import type { WorkshopPassageSearchScope } from '@shared/types/messages/workshop/passageSearch';
import { CONTEXT_PATH_GROUP_LABELS } from '@shared/constants/contextPathSuggestionWords';

function placeWords(scope: WorkshopPassageSearchScope): string {
  switch (scope.kind) {
    case 'excerpt':
      return 'the excerpt';
    case 'file':
      return `${CONTEXT_PATH_GROUP_LABELS[scope.group]}: ${scope.path}`;
    case 'group':
      return scope.match && scope.match.length > 0
        ? `${CONTEXT_PATH_GROUP_LABELS[scope.group]}, matching ${scope.match.join(', ')}`
        : CONTEXT_PATH_GROUP_LABELS[scope.group];
  }
}

/** "Chapters, matching Drafts/chapter-4.*.md; Characters: jasper.md; the excerpt". */
export function workshopPassageSearchPlaceWords(scopes: readonly WorkshopPassageSearchScope[]): string {
  return scopes.map(placeWords).join('; ');
}
