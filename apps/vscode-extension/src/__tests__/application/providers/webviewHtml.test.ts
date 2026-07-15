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
 *      pinning crypto.randomBytes for the test.)
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

// Deterministic nonce: node's crypto exports are non-configurable (spyOn
// cannot redefine them), so substitute randomBytes at the module boundary.
// Fixed bytes -> a stable base64 token; the snapshot pins everything EXCEPT
// the entropy source itself.
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn((size: number) => Buffer.alloc(size, 0x42))
  };
});

import type * as vscode from 'vscode';
import { MessageType, PM_SURFACE_ATTR, SURFACE_WORKSHOP } from '@prose-minion/core';
import { getWebviewHtml } from '../../../application/providers/webviewHtml';

const fakeWebview = {
  cspSource: 'https://test.csp-source',
  asWebviewUri: (uri: { path: string }) => `https://webview.test${uri.path}`,
} as unknown as vscode.Webview;

const extensionUri = { fsPath: '/ext', path: '/ext' } as unknown as vscode.Uri;

describe('getWebviewHtml', () => {

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

  it('blocks remote image beacons on both shared webview surfaces', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');

    for (const html of [sidebar, workshop]) {
      const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
      expect(csp).toContain('img-src https://test.csp-source data:;');
      expect(csp).not.toContain('img-src https://test.csp-source https:');
    }
  });

  it('bootstrap error bridge posts the shared MessageType, not a hand-synced literal', () => {
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');
    expect(workshop).toContain(`postMessage({ type: '${MessageType.WEBVIEW_ERROR}'`);
  });
});
