/**
 * Path containment guard (string-in/string-out, no FS access).
 *
 * Guards path joins built from UNTRUSTED segments — webview payloads, and in
 * particular AI-model tool-use output that can carry a prompt-injected
 * `../../etc/passwd` — against directory traversal out of an intended root.
 *
 * Mirrors the FrameMinion `isPathWithinRoot` containment check; when that shared
 * helper lands with the Stage-2 monorepo move this can fold into it.
 */
import * as path from 'path';

/**
 * True iff `candidate` resolves to `root` itself or a descendant of it. A
 * candidate that escapes via `..`, or is an unrelated absolute path, returns
 * false.
 */
export function isPathWithinRoot(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate === resolvedRoot) return true;
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}
