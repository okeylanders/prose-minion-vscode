/**
 * Witnesses for the shared webview HTML shell (PR #66 review, Cal).
 *
 * The PR that introduced getWebviewHtml claimed the sidebar's HTML stayed
 * byte-identical through the extraction — verified by hand at the time, but
 * a manual pass expires with the next commit. These tests make the claim
 * durable:
 *
 *   1. The sidebar surface's full output is PINNED by snapshot, so any
 *      Workshop-motivated edit that would silently reskin or break the
 *      sidebar fails CI. (The always-random nonce is made deterministic by
 *      pinning Math.random for the test.)
 *   2. The two surfaces differ ONLY by their documented deltas — <title> and
 *      the #root markup. Everything security-relevant (CSP, nonce wiring,
 *      scripts) is asserted identical.
 *   3. The workshop surface stamps the shared PM_SURFACE_ATTR flag the
 *      webview entry point branches on; the sidebar stays unstamped.
 */

// The public barrel transitively reaches DictionaryService → p-limit, which
// ships ESM that this CJS jest setup can't parse. Same stub the core-side
// DictionaryService.test.ts uses; the generator under test never touches it.
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type * as vscode from 'vscode';
import { MessageType, PM_SURFACE_ATTR, SURFACE_WORKSHOP } from '@prose-minion/core';
import { getWebviewHtml } from '../../../application/providers/webviewHtml';

const fakeWebview = {
  cspSource: 'https://test.csp-source',
  asWebviewUri: (uri: { path: string }) => `https://webview.test${uri.path}`,
} as unknown as vscode.Webview;

const extensionUri = { fsPath: '/ext', path: '/ext' } as unknown as vscode.Uri;

describe('getWebviewHtml', () => {
  let randomSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    // Deterministic nonce: floor(0.42 * 62) = 26 -> 'a' for all 32 chars.
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('pins the sidebar surface output — the extraction promised byte-identity, this keeps it', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');
    expect(sidebar).toMatchSnapshot();
  });

  it('stamps the workshop surface flag on #root; the sidebar stays unstamped', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');

    expect(workshop).toContain(`<div id="root" ${PM_SURFACE_ATTR}="${SURFACE_WORKSHOP}">`);
    expect(sidebar).not.toContain(PM_SURFACE_ATTR);
  });

  it('surfaces differ ONLY by title and #root markup — CSP, nonce, and script wiring are identical', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');

    // Erase the two documented per-surface deltas, then demand equality.
    const normalize = (html: string) =>
      html
        .replace(/<title>[^<]*<\/title>/, '<title/>')
        .replace(/<div id="root"[\s\S]*?<\/div>/, '<root/>');

    expect(normalize(workshop)).toBe(normalize(sidebar));
  });

  it('bootstrap error bridge posts the shared MessageType, not a hand-synced literal', () => {
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');
    expect(workshop).toContain(`postMessage({ type: '${MessageType.WEBVIEW_ERROR}'`);
  });
});
