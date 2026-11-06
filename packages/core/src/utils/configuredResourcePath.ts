/**
 * The one rule for a configured resource's path as a persona writes it
 * (`resource.read`'s `<path>`, a file edit's `<path>`; ADR 2026-11-05 D2).
 * Pure, with no Node import, so a trailer codec under `utils/` and the
 * capability codec read a path by the same rule.
 *
 * A workspace-relative configured path: no absolute path (POSIX or Windows),
 * no URI scheme or drive (`C:`), no backslash or NUL, and no empty, `.` or
 * `..` segment. With backslashes refused, a Windows absolute path starts
 * with `/` or a drive, so the scheme test covers what `path.win32` would.
 */
export function isSafeConfiguredResourcePath(value: string): boolean {
  if (!value || value.includes('\\') || value.includes('\0')) {
    return false;
  }
  if (value.startsWith('/')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}
