/**
 * One folder of the names-only project scan (ADR 2026-11-19 D20): its path,
 * how many Markdown and plain-text files it holds directly, and a few of
 * their names. Never a file's contents.
 *
 * `path` is relative to its workspace root, `/`-separated; `.` is the root
 * itself. With several roots open, it starts with the root's name.
 *
 * Folder and file names are writer data: they reach the helper only on the
 * writer's press, and never a log.
 */
export interface ProjectFolderSummary {
  readonly path: string;
  readonly markdownFiles: number;
  readonly textFiles: number;
  readonly sampleNames: readonly string[];
}
