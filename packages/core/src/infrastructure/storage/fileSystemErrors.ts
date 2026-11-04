/** Temporary provider-message classifier until the FileSystem port exposes error codes. */
export function isMissingFileSystemPathError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:ENOENT|FileNotFound|not found|does not exist|unseeded path)/i.test(message);
}

/**
 * A file system error as a bounded category, never its message, which can
 * carry a path (PR #194 F-04): its `code` (`EACCES`, VS Code's
 * `NoPermissions`), else a POSIX code its message opens with (`ENOSPC: …`),
 * else `no error code`.
 */
export function fileSystemErrorCategory(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(code)) {
    return code;
  }
  const message = error instanceof Error ? error.message : '';
  return /^(E[A-Z0-9]{2,15})(?::|\s|$)/.exec(message)?.[1] ?? 'no error code';
}
