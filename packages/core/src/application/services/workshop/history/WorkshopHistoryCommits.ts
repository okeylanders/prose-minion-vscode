/**
 * Commit ids a persona wrote, checked against the file's own log (ADR
 * 2026-11-19 D14). Pure.
 *
 * The codec has already checked the form (7 to 40 hex, lower case). Here
 * the id must be the prefix of exactly one commit in this file's history as
 * the host listed it. An ambiguous prefix and an id not in this file's
 * history are refused, so the host is only ever handed a full hash its own
 * log returned, never a model's text.
 */

import type { FileHistoryCommit } from '@/platform';

export type WorkshopHistoryCommitLookup =
  | { readonly kind: 'found'; readonly commit: FileHistoryCommit; /** Its place in the log, newest first. */ readonly index: number }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'not-in-history' };

export function findWorkshopHistoryCommit(
  commits: readonly FileHistoryCommit[],
  prefix: string
): WorkshopHistoryCommitLookup {
  let found: { commit: FileHistoryCommit; index: number } | undefined;
  for (let index = 0; index < commits.length; index += 1) {
    if (!commits[index].id.startsWith(prefix)) {
      continue;
    }
    if (found) {
      return { kind: 'ambiguous' };
    }
    found = { commit: commits[index], index };
  }
  return found ? { kind: 'found', ...found } : { kind: 'not-in-history' };
}
