/**
 * Which source a board belongs to (ADR 2026-10-19 D12; PR #148, 2026-10-20).
 * Pure: no host, no I/O. Moved out of `LightboxService` (Slice 5A) so the
 * service has room for saved boards.
 */

import type { LightboxSource } from '@messages';

/**
 * Which source a board belongs to: its kind, its document and, for a
 * selection, its lines. The document is its URI, VS Code's canonical
 * `Uri.toString()` from both the editor command and the picker (a re-read
 * reuses the board's), so two workspace roots that each hold `chapter.md`
 * never share a board. The display path, which is workspace-relative and can
 * repeat across roots, is only the fallback for a source with no URI.
 * Computable from a resolved input and from a board's own `source` alike.
 *
 * A project-picker source's URI is Node's `pathToFileURL`, which escapes
 * fewer characters than VS Code and keeps a Windows drive letter's case
 * (2026-10-20). So a `file:` URI is compared by its decoded path, with the
 * drive letter folded: one file is one board, whichever way it was chosen.
 */
export function lightboxSourceKey(
  source: Pick<LightboxSource, 'kind' | 'displayPath' | 'sourceUri' | 'startLine' | 'endLine'>
): string {
  const document = source.sourceUri ? lightboxDocumentKey(source.sourceUri) : source.displayPath;
  return source.kind === 'selection'
    ? `selection:${document}:${source.startLine ?? ''}-${source.endLine ?? ''}`
    : `file:${document}`;
}

/** A `file:` URI by its decoded path (drive letter folded); any other URI as it is. */
function lightboxDocumentKey(sourceUri: string): string {
  if (!sourceUri.startsWith('file:')) {
    return sourceUri;
  }
  try {
    const url = new URL(sourceUri);
    const decoded = decodeURIComponent(url.pathname)
      .replace(/^\/([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}:`);
    return `file://${url.host}${decoded}`;
  } catch {
    return sourceUri;
  }
}
