/**
 * The authority epoch in VS Code (ADR 2026-11-05 D7.6): it moves on a
 * workspace-folder change and on a context-path setting change, and on
 * nothing else.
 */
jest.mock('vscode', () => {
  const folders = new Set<() => void>();
  const configuration = new Set<(event: unknown) => void>();
  return {
    workspace: {
      onDidChangeWorkspaceFolders: (listener: () => void) => {
        folders.add(listener);
        return { dispose: () => folders.delete(listener) };
      },
      onDidChangeConfiguration: (listener: (event: unknown) => void) => {
        configuration.add(listener);
        return { dispose: () => configuration.delete(listener) };
      }
    },
    mockFolders: () => folders.forEach((listener) => listener()),
    mockConfiguration: (section: string) => configuration.forEach((listener) => listener({
      affectsConfiguration: (asked: string) => section === asked || section.startsWith(`${asked}.`)
    }))
  };
}, { virtual: true });

import * as vscode from 'vscode';
import { VsCodeFileEditAuthorityEpoch } from '@app/platform/vscode/VsCodeFileEditAuthorityEpoch';

const host = vscode as unknown as { mockFolders(): void; mockConfiguration(section: string): void };

describe('VsCodeFileEditAuthorityEpoch', () => {
  it('moves on a workspace-folder change and a context-path setting, never on another setting', () => {
    const epoch = new VsCodeFileEditAuthorityEpoch();
    expect(epoch.current()).toBe(0);
    host.mockFolders();
    expect(epoch.current()).toBe(1);
    host.mockConfiguration('proseMinion.contextPaths.chapters');
    expect(epoch.current()).toBe(2);
    host.mockConfiguration('proseMinion.assistantModel');
    expect(epoch.current()).toBe(2);
    epoch.dispose();
    host.mockFolders();
    expect(epoch.current()).toBe(2);
  });
});
