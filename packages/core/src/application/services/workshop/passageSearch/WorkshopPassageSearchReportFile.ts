/**
 * Open report (ADR 2026-11-20 D21): the shared Markdown report, saved under
 * `prose-minion/reports/` as the sidebar's reports are, then opened. Built
 * once, in `extension.ts`; a handler only calls it.
 *
 * It names the file by the time alone. The log line a caller writes carries
 * an outcome, never the path.
 */

import * as path from 'path';
import type { FileSystem, ShellService, Workspace } from '@/platform';

export type WorkshopPassageSearchReportOutcome = 'opened' | 'saved' | 'no-workspace' | 'failed';

export interface WorkshopPassageSearchReports {
  /** Save the report and open it. `saved`: written, and the editor could not show it. */
  saveAndOpen(markdown: string): Promise<WorkshopPassageSearchReportOutcome>;
}

export class WorkshopPassageSearchReportFile implements WorkshopPassageSearchReports {
  constructor(
    private readonly fileSystem: Pick<FileSystem, 'writeFile'>,
    private readonly workspace: Pick<Workspace, 'workspaceFolders'>,
    private readonly shell: Pick<ShellService, 'openFileInEditor'>,
    private readonly now: () => Date = () => new Date()
  ) {}

  async saveAndOpen(markdown: string): Promise<WorkshopPassageSearchReportOutcome> {
    const root = this.workspace.workspaceFolders()[0];
    if (!root) {
      return 'no-workspace';
    }
    const now = this.now();
    const pad = (value: number): string => value.toString().padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filePath = path.join(root.path, 'prose-minion', 'reports', `passage-search-${stamp}.md`);
    try {
      // The port's `writeFile` makes the folder.
      await this.fileSystem.writeFile(filePath, new TextEncoder().encode(markdown));
    } catch {
      return 'failed';
    }
    try {
      await this.shell.openFileInEditor(filePath);
      return 'opened';
    } catch {
      return 'saved';
    }
  }
}
