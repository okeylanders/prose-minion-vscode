/**
 * Architectural boundary guards.
 *
 * A living registry of invariants the type-checker can't express. Add new
 * architectural witnesses here (one `it` per invariant) rather than scattering
 * them — a future contributor should find every boundary in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. @prose-minion/core is vscode-free — PERIOD (ADR 2026-06-16, monorepo split).
 *    After the Stage-2 move, the VS Code shell (extension.ts, the
 *    WebviewViewProvider, and the platform/vscode adapters) lives in
 *    `apps/vscode-extension`, NOT here. So core has NO sanctioned-shell
 *    exceptions: nothing under `packages/core/src` may import `vscode`. This is
 *    what lets core compile against an absent `vscode` module and unblocks the
 *    future desktop (Electron) app. Tests are skipped (they mock vscode by design).
 *
 *    RENDERER GLOBAL (sealed in Stage-2 Wave 1): the webview's runtime touchpoint
 *    is the `acquireVsCodeApi()` global, wrapped behind `AppMessagePort`
 *    (presentation/webview/ports/) and referenced in exactly ONE module — the
 *    VS Code adapter `presentation/webview/hooks/useVSCodeApi.ts`. It is NOT an
 *    `import 'vscode'`, so this import-scan guard does not (and need not) catch it.
 *
 * 2. Webview providers assemble nothing (ADR 2026-06-18 composition root;
 *    re-affirmed by ADR 2026-07-03 for the Workshop panel). Every service a
 *    provider touches arrives through the `CoreServices` bundle built in
 *    `extension.ts`. The ONLY sanctioned `new` inside
 *    `apps/vscode-extension/src/application/providers/` is `new MessageHandler`
 *    — the per-webview message seam. These witnesses read the app-shell source
 *    with fs (no vscode import, no app-side vscode mock needed).
 */

import * as fs from 'fs';
import * as path from 'path';

// __dirname = packages/core/src/__tests__/architecture -> core's src root.
const SRC_ROOT = path.resolve(__dirname, '..', '..');

const SKIP_DIRS = new Set<string>([
  path.join(SRC_ROOT, '__tests__'), // tests mock vscode by design
]);

// Catches static `import … from 'vscode'`, `import * as vscode from 'vscode'`,
// `require('vscode')`, AND dynamic `import('vscode')` / `await import('vscode')`
// (a prior TextSourceResolver used exactly that idiom — see decision tracker D15).
const VSCODE_IMPORT = new RegExp(
  [
    /from\s+['"]vscode['"]/.source,
    /import\s+\*\s+as\s+vscode\s+from\s+['"]vscode['"]/.source,
    /require\(\s*['"]vscode['"]\s*\)/.source,
    /import\(\s*['"]vscode['"]\s*\)/.source,
  ].join('|')
);

const HANDLERS_ROOT = path.join(
  SRC_ROOT,
  'application',
  'handlers'
);

const FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION = new RegExp(
  String.raw`\bnew\s+(TextSourceResolver|CategorySearchService|AccountBalanceService|OpenRouterAccountClient|PublishingStandardsRepository)\b`
);

// App-shell roots (witness 2). The repo root is three levels above core's src.
const APP_SRC_ROOT = path.resolve(SRC_ROOT, '..', '..', '..', 'apps', 'vscode-extension', 'src');
const APP_PROVIDERS_ROOT = path.join(APP_SRC_ROOT, 'application', 'providers');

// Any service-shaped construction is forbidden inside webview providers;
// `new MessageHandler` is the one sanctioned composition seam per webview.
const FORBIDDEN_SERVICE_CONSTRUCTION_IN_PROVIDERS = new RegExp(
  String.raw`\bnew\s+(?!MessageHandler\b)[A-Z]\w*(?:Service|Manager|Client|Resolver|Repository|Provider|Orchestrator)\b`
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(full)) {
        continue;
      }
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('architectural boundaries', () => {
  it('core imports no vscode anywhere (static OR dynamic import)', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => VSCODE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('application handlers do not construct infrastructure services', () => {
    const offenders = collectSourceFiles(HANDLERS_ROOT)
      .filter((file) => FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('webview providers construct no services — CoreServices is injected, MessageHandler is the only sanctioned new', () => {
    const offenders = collectSourceFiles(APP_PROVIDERS_ROOT)
      .filter((file) => FORBIDDEN_SERVICE_CONSTRUCTION_IN_PROVIDERS.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('WorkshopPanelProvider is wired from the composition root with the CoreServices bundle (ADR 2026-07-03)', () => {
    const providerSource = fs.readFileSync(
      path.join(APP_PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    // The provider receives the bundle; it does not build its own services.
    expect(providerSource).toMatch(/coreServices:\s*CoreServices/);

    const extensionSource = fs.readFileSync(path.join(APP_SRC_ROOT, 'extension.ts'), 'utf8');
    const constructionIdx = extensionSource.indexOf('new WorkshopPanelProvider(');
    expect(constructionIdx).toBeGreaterThan(-1);
    // The construction call site passes the same `coreServices` bundle the
    // sidebar provider gets (argument list scanned as a source window so the
    // witness survives reformatting).
    const constructionWindow = extensionSource.slice(constructionIdx, constructionIdx + 300);
    expect(constructionWindow).toContain('coreServices');
  });
});
