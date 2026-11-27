import * as vscode from 'vscode';

/** Every text-backed tab, including background tabs and copies in other editor groups. */
export function openTextTabUris(): Set<string> {
  const uris = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const { input } of group.tabs) {
      if (input instanceof vscode.TabInputText) {
        uris.add(input.uri.toString());
      } else if (input instanceof vscode.TabInputTextDiff) {
        uris.add(input.original.toString());
        uris.add(input.modified.toString());
      }
    }
  }
  return uris;
}
