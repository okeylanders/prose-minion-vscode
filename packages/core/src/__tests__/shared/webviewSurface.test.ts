/**
 * The webview surface contract (ADR 2026-07-03; Lightbox ADR 2026-10-19 D1).
 * The entry point reads the host's #root stamp back through
 * `resolveWebviewSurface`; the sidebar is unstamped, so anything that is not
 * a known full-tab surface keeps meaning the sidebar, as it always has.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PM_FRAME_ATTR,
  PM_FRAME_FULLTAB,
  PM_SURFACE_ATTR,
  SURFACE_LIGHTBOX,
  SURFACE_SIDEBAR,
  SURFACE_WORKSHOP,
  resolveWebviewSurface
} from '@shared/types';

describe('resolveWebviewSurface', () => {
  it('reads each stamped surface back as itself', () => {
    expect(resolveWebviewSurface('workshop')).toBe(SURFACE_WORKSHOP);
    expect(resolveWebviewSurface('lightbox')).toBe(SURFACE_LIGHTBOX);
    expect(resolveWebviewSurface('sidebar')).toBe(SURFACE_SIDEBAR);
  });

  it('treats an unstamped or unknown root as the sidebar', () => {
    expect(resolveWebviewSurface(null)).toBe(SURFACE_SIDEBAR);
    expect(resolveWebviewSurface('')).toBe(SURFACE_SIDEBAR);
    expect(resolveWebviewSurface('toString')).toBe(SURFACE_SIDEBAR);
    expect(resolveWebviewSurface('WORKSHOP')).toBe(SURFACE_SIDEBAR);
  });

  it('keeps the attribute names the stylesheets scope to', () => {
    expect(PM_SURFACE_ATTR).toBe('data-pm-surface');
    expect(PM_FRAME_ATTR).toBe('data-pm-frame');
    expect(PM_FRAME_FULLTAB).toBe('fulltab');
  });
});

describe('webview entry root map', () => {
  it('chooses the root from an exhaustive surface map, not a binary branch', () => {
    const entry = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'presentation', 'webview', 'index.tsx'),
      'utf8'
    );

    expect(entry).toMatch(
      /const SURFACE_ROOTS: Record<WebviewSurface, React\.ComponentType> = \{\s*sidebar: App,\s*workshop: WorkshopApp,\s*lightbox: LightboxApp\s*\};/
    );
    expect(entry).toContain('resolveWebviewSurface(root.getAttribute(PM_SURFACE_ATTR))');
    expect(entry).not.toMatch(/surface\s*===\s*SURFACE_/);
  });
});
