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
 *   2. Every surface differs from the sidebar ONLY by the documented deltas —
 *      <title> and the #root markup. Everything security-relevant (CSP, nonce
 *      wiring, scripts) is asserted identical.
 *   3. The full-tab surfaces (Workshop, Lightbox) stamp the shared
 *      PM_SURFACE_ATTR flag the webview entry point branches on, plus the
 *      PM_FRAME_ATTR full-tab frame the shared styles scope to; the sidebar
 *      stays unstamped.
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

import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import {
  MessageType,
  PM_FRAME_ATTR,
  PM_FRAME_FULLTAB,
  PM_SURFACE_ATTR,
  SURFACE_LIGHTBOX,
  SURFACE_WORKSHOP,
  WORKSHOP_NOTICE_SHOTS,
  WebviewSurface
} from '@prose-minion/core';
import { getWebviewHtml } from '../../../application/providers/webviewHtml';

const fakeWebview = {
  cspSource: 'https://test.csp-source',
  asWebviewUri: (uri: { path: string }) => `https://webview.test${uri.path}`,
} as unknown as vscode.Webview;

const extensionUri = { fsPath: '/ext', path: '/ext' } as unknown as vscode.Uri;

const ALL_SURFACES: readonly WebviewSurface[] = ['sidebar', 'workshop', 'lightbox'];
const FULL_TAB_SURFACES: readonly WebviewSurface[] = [SURFACE_WORKSHOP, SURFACE_LIGHTBOX];

describe('getWebviewHtml', () => {

  it('pins the sidebar surface output — the extraction promised byte-identity, this keeps it', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');
    expect(sidebar).toMatchSnapshot();
  });

  it('stamps each full-tab surface and the full-tab frame on #root; the sidebar stays unstamped', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');

    for (const surface of FULL_TAB_SURFACES) {
      expect(getWebviewHtml(fakeWebview, extensionUri, surface)).toContain(
        `<div id="root" ${PM_SURFACE_ATTR}="${surface}" ${PM_FRAME_ATTR}="${PM_FRAME_FULLTAB}">`
      );
    }
    expect(sidebar).not.toContain(PM_SURFACE_ATTR);
    expect(sidebar).not.toContain(PM_FRAME_ATTR);
  });

  it('titles each surface for its tab', () => {
    const titleOf = (surface: WebviewSurface) =>
      getWebviewHtml(fakeWebview, extensionUri, surface).match(/<title>([^<]*)<\/title>/)?.[1];

    expect(ALL_SURFACES.map(titleOf)).toEqual([
      'Prose Minion Tools',
      'Prose Minion Workshop',
      'Prose Minion Lightbox'
    ]);
  });

  it('surfaces differ ONLY by title and #root markup — CSP, nonce, and script wiring are identical', () => {
    const sidebar = getWebviewHtml(fakeWebview, extensionUri, 'sidebar');

    // Erase the two documented per-surface deltas, then demand equality.
    const normalize = (html: string) =>
      html
        .replace(/<title>[^<]*<\/title>/, '<title/>')
        .replace(/<div id="root"[\s\S]*?<\/div>/, '<root/>');

    for (const surface of FULL_TAB_SURFACES) {
      expect(normalize(getWebviewHtml(fakeWebview, extensionUri, surface))).toBe(normalize(sidebar));
    }
  });

  it('blocks remote image beacons on every shared webview surface', () => {
    for (const html of ALL_SURFACES.map((surface) => getWebviewHtml(fakeWebview, extensionUri, surface))) {
      const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
      expect(csp).toContain('img-src https://test.csp-source data:;');
      expect(csp).not.toContain('img-src https://test.csp-source https:');
    }
  });

  it('bootstrap error bridge posts the shared MessageType, not a hand-synced literal', () => {
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');
    expect(workshop).toContain(`postMessage({ type: '${MessageType.WEBVIEW_ERROR}'`);
  });

  /**
   * Resource-load failures fire at the element and do NOT bubble, so a
   * bubble-phase listener cannot see a broken `<img>` (PR #94 review, Oliver).
   * The capture flag is the whole fix — drop it and the handler compiles, runs,
   * and silently never fires.
   */
  it('listens for asset load failures in the capture phase, on every surface', () => {
    for (const surface of ALL_SURFACES) {
      const html = getWebviewHtml(fakeWebview, extensionUri, surface);
      expect(html).toContain("pmPostWebviewError('asset failed to load: ' + src)");
      expect(html).toMatch(/window\.addEventListener\('error',[\s\S]*?\}, true\);/);
    }
  });

  /**
   * `acquireVsCodeApi()` throws on a second call and the bundle caches its own
   * handle, so the shell must acquire once and share — otherwise every handler
   * here stops forwarding the moment React boots.
   */
  it('acquires the VS Code API once in the shell and shares it with the bundle', () => {
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');

    expect(workshop).toContain('window.__pmVsCodeApi = (function ()');
    expect(workshop).toContain('const api = window.__pmVsCodeApi;');

    /* Exactly one CALL site — count code lines only, since the surrounding
       comment names the function too. A second call throws and would take the
       error bridge down with it. */
    const callSites = workshop
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
      .match(/acquireVsCodeApi\(\)/g);
    expect(callSites).toHaveLength(1);
  });

  /**
   * The notice modal looks its screenshots up by name; a name the host forgets
   * to resolve renders a broken picture in the first-run tour, which is the one
   * surface a new writer sees. Drive the map off the shared list so adding a
   * screenshot cannot half-land.
   */
  it('resolves a webview URI for every notice screenshot in the shared list', () => {
    const workshop = getWebviewHtml(fakeWebview, extensionUri, 'workshop');

    for (const name of WORKSHOP_NOTICE_SHOTS) {
      expect(workshop).toContain(
        `"${name}": "https://webview.test/ext/assets/workshop-notices/${name}.png"`
      );
    }
  });

  /**
   * The assertion above only proves the host FORMATS a URI — `asWebviewUri`
   * mints one for any path, existing or not, and the fake here is string
   * concatenation (PR #94 review: Cal, Oliver, Blake). So it would pass just as
   * happily with the PNG deleted, which is the exact half-landing it was cited
   * as preventing. This is the half that touches the disk.
   *
   * Both directions matter: a name without a file ships a broken picture, and a
   * file without a name is dead weight in the .vsix. `.vscodeignore` currently
   * protects this folder with a comment; the set equality below is the part a
   * packaging change cannot quietly break.
   */
  it('ships exactly the notice screenshots the shared list names — no more, no fewer', () => {
    const shotDir = path.resolve(__dirname, '../../../../assets/workshop-notices');

    const onDisk = fs
      .readdirSync(shotDir)
      .filter((entry) => entry.endsWith('.png'))
      .map((entry) => entry.replace(/\.png$/, ''))
      .sort();

    expect(onDisk).toEqual([...WORKSHOP_NOTICE_SHOTS].sort());

    for (const name of WORKSHOP_NOTICE_SHOTS) {
      const file = path.join(shotDir, `${name}.png`);
      expect(fs.existsSync(file)).toBe(true);
      /* A zero-byte or truncated PNG resolves and 404s just as silently. */
      expect(fs.statSync(file).size).toBeGreaterThan(1024);
    }
  });
});
