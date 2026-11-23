/**
 * The configured-resource catalog's path rules, moved out of
 * `ContextResourceResolver` unchanged so every walk it makes (the browse
 * catalog, the authoritative candidate read and the pattern check) keeps
 * reading paths one way. Pure.
 *
 * - **A pattern** is trimmed; a leading `./`, any leading `/` and a
 *   `workspace:` prefix are set aside; a bare name with no wildcard or `/`
 *   matches that file name anywhere (`**\/name`).
 * - **A key** names a relative path across separators and letter case.
 * - **A supported file** is `.md` or `.txt`.
 * - **A label** is the file name without its extension, hyphens and
 *   underscores read as spaces, each word capitalized.
 */

import * as path from 'path';

/** A configured pattern as the catalog's searches read it; empty when nothing is left. */
export function normalizeContextPattern(pattern: string): string {
  let normalized = pattern.trim();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/^workspace:/i, '');

  // If the pattern doesn't contain a wildcard or directory separator, treat it as a filename
  if (!/[\*\?\[]/.test(normalized) && !normalized.includes('/')) {
    return `**/${normalized}`;
  }

  return normalized;
}

/** A relative path's key: `/`-separated, no leading slash, case-folded. */
export function contextResourceKey(pathValue: string): string {
  return pathValue.trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/** Whether the catalog lists a file of this kind: `.md` or `.txt`. */
export function isContextResourceFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.md' || extension === '.txt';
}

/** A file's display label: its name without the extension, words capitalized. */
export function contextResourceLabel(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
