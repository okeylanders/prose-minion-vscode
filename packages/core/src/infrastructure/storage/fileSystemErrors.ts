/** Temporary provider-message classifier until the FileSystem port exposes error codes. */
export function isMissingFileSystemPathError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:ENOENT|FileNotFound|not found|does not exist|unseeded path)/i.test(message);
}
