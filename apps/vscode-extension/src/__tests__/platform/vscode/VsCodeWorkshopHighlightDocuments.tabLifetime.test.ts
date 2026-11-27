import { host } from './mockIssueAnnotatorHost';

import * as vscode from 'vscode';
import { VsCodeWorkshopHighlightDocuments } from '@app/platform/vscode/VsCodeWorkshopHighlightDocuments';

const groups = vscode.window.tabGroups as unknown as { all: Array<{ tabs: Array<{ input: unknown }> }> };
const fileTab = (path: string) => ({ input: new vscode.TabInputText(vscode.Uri.file(path)) });

it('tracks the eventually authorized path across split groups, temporary closures and independent gestures', () => {
  const path = '/moved-project/chapter.md';
  const other = '/other-file.md';
  const tab = fileTab(path);
  groups.all = [{ tabs: [fileTab(other), tab] }, { tabs: [tab] }];
  const buffers = new VsCodeWorkshopHighlightDocuments();
  const gesture = buffers.captureTabClosures();
  try {
    groups.all.pop();
    host.groupsChanged.fire({});
    expect(gesture.current(path)).toBe(true);
    groups.all = [{ tabs: [fileTab(other)] }];
    host.tabsChanged.fire({});
    const newer = buffers.captureTabClosures();
    try {
      expect(newer.current(path)).toBe(true); // Show starts with the source closed.
      groups.all[0].tabs.push(tab);
      host.tabsChanged.fire({});
      expect(gesture.current(path)).toBe(false);
      expect(gesture.current(other)).toBe(true);
      expect(newer.current(path)).toBe(true);
      groups.all[0].tabs.pop();
      host.tabsChanged.fire({});
      expect(newer.current(path)).toBe(false);
    } finally {
      newer.dispose();
    }
  } finally {
    gesture.dispose();
  }
});
