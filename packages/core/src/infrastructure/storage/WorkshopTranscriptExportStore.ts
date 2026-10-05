/**
 * Project-owned storage for Workshop transcript exports under
 * prose-minion/exports. Exports are write-once documents for people and other
 * agents: an export never replaces an earlier one.
 */

import * as path from 'path';
import type { FileSystem, Workspace } from '@/platform';
import { WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY } from '@shared/constants/workshopTranscriptExport';
import { writeNumberedFile } from './writeNumberedFile';

export interface WorkshopTranscriptExportFile {
  absolutePath: string;
  /** Workspace-relative, for display. */
  relativePath: string;
}

export class WorkshopTranscriptExportStore {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace
  ) {}

  /** Write `stem.extension` (or the next free `stem-N.extension`) and report where. */
  async writeNew(stem: string, extension: string, content: string): Promise<WorkshopTranscriptExportFile> {
    const workspaceFolder = this.workspace.workspaceFolders()[0];
    if (!workspaceFolder) {
      throw new Error('Open a workspace folder before exporting a Workshop transcript.');
    }
    const directory = path.join(workspaceFolder.path, ...WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY.split('/'));
    await this.fileSystem.createDirectory(directory);
    const absolutePath = await writeNumberedFile(
      this.fileSystem,
      directory,
      stem,
      extension,
      new TextEncoder().encode(content)
    );
    return {
      absolutePath,
      relativePath: this.workspace.asRelativePath(absolutePath, false)
    };
  }
}
