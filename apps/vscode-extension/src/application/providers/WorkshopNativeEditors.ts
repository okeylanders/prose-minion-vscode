import * as vscode from 'vscode';

/** The shared type was used by every Workshop before primary and secondary tabs had separate native identities. */
export const WORKSHOP_EDITOR = {
  historical: 'prose-minion.workshop',
  primary: 'prose-minion.workshop.primary',
  secondary: 'prose-minion.workshop.tab'
} as const;

type WorkshopEditorType = typeof WORKSHOP_EDITOR[keyof typeof WORKSHOP_EDITOR];

export interface NativeWorkshopEditor {
  readonly tab: vscode.Tab;
  readonly type: WorkshopEditorType;
}

export function nativeWorkshopEditors(): NativeWorkshopEditor[] {
  const editors: NativeWorkshopEditor[] = [];
  for (const group of vscode.window.tabGroups?.all ?? []) {
    for (const tab of group.tabs) {
      if (!(tab.input instanceof vscode.TabInputWebview)) { continue; }
      // The tab API can return the workbench-prefixed type, while a WebviewPanel exposes its contributed type.
      const type = tab.input.viewType.replace(/^mainThreadWebview-/, '');
      if (type === WORKSHOP_EDITOR.primary || type === WORKSHOP_EDITOR.secondary || type === WORKSHOP_EDITOR.historical) {
        editors.push({ tab, type });
      }
    }
  }
  return editors;
}

/** Native focus and webview deserialization reach the extension host independently of command completion. */
export async function waitForWorkshopEditor(observed: () => boolean): Promise<boolean> {
  const deadline = Date.now() + 5000;
  while (!observed()) {
    if (Date.now() >= deadline) { return false; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return true;
}

/** TabGroups exposes no reveal method. Activate this exact editor in its existing group and current position. */
export async function revealNativeWorkshopEditor(tab: vscode.Tab, current: () => boolean): Promise<boolean> {
  const groups = vscode.window.tabGroups;
  const seen = new Set<vscode.TabGroup>();
  const groupOfTab = () => groups.all.find(group => group.tabs.includes(tab));
  let target = groupOfTab();
  while (current() && target && groups.activeTabGroup !== target) {
    const prior = groups.activeTabGroup;
    if (seen.has(prior)) { return false; }
    seen.add(prior);
    await vscode.commands.executeCommand('workbench.action.focusNextGroup');
    if (!await waitForWorkshopEditor(() => !current() || !groupOfTab() || groups.activeTabGroup !== prior)) { return false; }
    target = groupOfTab();
  }
  if (!current() || !target) { return false; }
  // The zero-based command also covers the tenth and later editors in a group.
  await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', target.tabs.indexOf(tab));
  return waitForWorkshopEditor(() => !current() || !groupOfTab() || groups.activeTabGroup.activeTab === tab);
}
