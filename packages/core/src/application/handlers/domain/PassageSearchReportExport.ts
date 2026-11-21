/**
 * Copy and Save for a Passage Search report (ADR 2026-11-20 D15, D22; PR
 * #294). The webview names the held result by id; the report is written
 * here, on the host, from the host's own snapshot of that result, with the
 * same pure formatter every surface uses. The report's text never crosses
 * from the webview.
 *
 * A report is saved as `prose-minion/reports/passage-search-YYYYMMDD-HHMMSS.md`
 * under the first workspace folder, then opened. A save that worked and an
 * open that did not are told apart: the file is there either way.
 *
 * Logs carry the status and a fault's kind only: never a path, never a
 * thrown message (which can hold the project's root), never report text.
 */

import * as path from 'path';
import type { PassageSearchResultView } from '@messages';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';

const LOG = '[PassageSearchReport]';
const REPORTS = ['prose-minion', 'reports'] as const;

export interface PassageSearchReportPorts {
  readonly shell: Pick<ShellService, 'copyToClipboard' | 'openFileInEditor'>;
  readonly fileSystem: Pick<FileSystem, 'createDirectory' | 'writeFile'>;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
  /** The clock, for the file's name; a test fixes it. */
  readonly now?: () => Date;
}

export type PassageSearchReportOutcome =
  | { readonly status: 'copied' }
  | { readonly status: 'saved'; /** Workspace-relative, `/`-separated. */ readonly filePath: string; readonly opened: boolean }
  | { readonly status: 'failed'; readonly reason: 'copy-failed' | 'no-workspace' | 'save-failed' };

/** A thrown value's kind, for a log: never its message. */
const faultKindOf = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

const pad = (value: number): string => value.toString().padStart(2, '0');

/** `passage-search-YYYYMMDD-HHMMSS.md`, in local time, as every saved report is named. */
export function passageSearchReportFileName(at: Date): string {
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `passage-search-${date}-${time}.md`;
}

export class PassageSearchReportExport {
  constructor(
    private readonly ports: PassageSearchReportPorts,
    private readonly log: LogSink
  ) {}

  async copy(result: PassageSearchResultView): Promise<PassageSearchReportOutcome> {
    try {
      await this.ports.shell.copyToClipboard(formatPassageSearchReport(result));
    } catch (error) {
      this.log.appendLine(`${LOG} Copy failed (${faultKindOf(error)}).`);
      return { status: 'failed', reason: 'copy-failed' };
    }
    this.log.appendLine(`${LOG} Copied: ${result.instances.length} instance(s).`);
    return { status: 'copied' };
  }

  async save(result: PassageSearchResultView): Promise<PassageSearchReportOutcome> {
    const root = this.ports.workspace.workspaceFolders()[0];
    if (!root) {
      this.log.appendLine(`${LOG} Save refused (no-workspace).`);
      return { status: 'failed', reason: 'no-workspace' };
    }
    const fileName = passageSearchReportFileName((this.ports.now ?? (() => new Date()))());
    const directory = path.join(root.path, ...REPORTS);
    const absolutePath = path.join(directory, fileName);
    try {
      await this.ports.fileSystem.createDirectory(directory);
      await this.ports.fileSystem.writeFile(absolutePath, new TextEncoder().encode(formatPassageSearchReport(result)));
    } catch (error) {
      this.log.appendLine(`${LOG} Save failed (${faultKindOf(error)}).`);
      return { status: 'failed', reason: 'save-failed' };
    }
    let opened = true;
    try {
      await this.ports.shell.openFileInEditor(absolutePath);
    } catch (error) {
      // The report is saved; only the open failed, and the writer is told which.
      opened = false;
      this.log.appendLine(`${LOG} Saved, but the report could not be opened (${faultKindOf(error)}).`);
    }
    this.log.appendLine(`${LOG} Saved: ${result.instances.length} instance(s), opened ${opened ? 'yes' : 'no'}.`);
    return { status: 'saved', filePath: [...REPORTS, fileName].join('/'), opened };
  }
}
