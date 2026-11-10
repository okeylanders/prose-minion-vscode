/**
 * VsCodeFileEditAuthorityEpoch: the `FileEditAuthorityEpoch` port in VS
 * Code (ADR 2026-11-05 D7.6). It moves on every workspace-folder change and
 * on every configuration change that affects `proseMinion.contextPaths`, the
 * settings that decide which files are configured project resources.
 */
import * as vscode from 'vscode';
import type { FileEditAuthorityEpoch } from '@prose-minion/core';

export const FILE_EDIT_AUTHORITY_SETTING = 'proseMinion.contextPaths';

export class VsCodeFileEditAuthorityEpoch implements FileEditAuthorityEpoch, vscode.Disposable {
  private epoch = 0;
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.epoch += 1;
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(FILE_EDIT_AUTHORITY_SETTING)) {
          this.epoch += 1;
        }
      })
    ];
  }

  current(): number {
    return this.epoch;
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }
}
