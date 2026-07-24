/**
 * App-shell architecture witnesses (ADR 2026-06-18 composition root, ADR
 * 2026-07-03 Workshop panel).
 *
 * These live app-side — next to the adapter source they verify — so core's
 * boundary suite never reads across the monorepo split (PR #66 review,
 * Marcus). Same scan idiom as core's boundaries.test.ts: fs + regex +
 * empty-offenders-list. Pure file-content witnesses; no vscode API touched.
 */

import * as fs from 'fs';
import * as path from 'path';

// __dirname = apps/vscode-extension/src/__tests__/architecture -> app src root.
const APP_SRC_ROOT = path.resolve(__dirname, '..', '..');
const PROVIDERS_ROOT = path.join(APP_SRC_ROOT, 'application', 'providers');
const EXTENSION_ENTRY = path.join(APP_SRC_ROOT, 'extension.ts');

/**
 * Providers assemble nothing: every service arrives via the CoreServices
 * bundle built in extension.ts. `new MessageHandler` is the ONE sanctioned
 * construction — the per-webview message seam. This is a suffix-convention
 * net (it catches service-shaped class names, not arbitrary classes): Handler
 * IS in the net, so a Sprint-2 `new WorkshopHandler(...)` inside a provider
 * fails here rather than slipping through (PR #66 review, Cal).
 */
const FORBIDDEN_SERVICE_CONSTRUCTION = new RegExp(
  String.raw`\bnew\s+(?!MessageHandler\b)[A-Z]\w*(?:Service|Manager|Client|Resolver|Repository|Provider|Orchestrator|Handler|Adapter|Cache|Gateway|Factory)\b`
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip ANY __tests__ dir in the walk so a future colocated fixture
      // (e.g. a FakeSomethingService test double) can't trip the witness.
      if (entry.name === '__tests__') {
        continue;
      }
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('app-shell provider assembly', () => {
  it('webview providers construct no services — CoreServices is injected, MessageHandler is the only sanctioned new', () => {
    const offenders = collectSourceFiles(PROVIDERS_ROOT)
      .filter((file) => FORBIDDEN_SERVICE_CONSTRUCTION.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('WorkshopPanelProvider is wired from the composition root with the CoreServices bundle (ADR 2026-07-03)', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    // The provider receives the bundle; it does not build its own services.
    expect(providerSource).toMatch(/coreServices:\s*CoreServices/);

    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');
    const start = extensionSource.indexOf('new WorkshopPanelProvider(');
    expect(start).toBeGreaterThan(-1);
    // Scan exactly the constructor call — bounded at its closing `);` — so
    // the witness can't be satisfied by a `coreServices` mention in unrelated
    // trailing code (PR #66 review, Cal).
    const end = extensionSource.indexOf(');', start);
    expect(end).toBeGreaterThan(start);
    const constructionArgs = extensionSource.slice(start, end);
    expect(constructionArgs).toContain('coreServices');
  });

  it('WorkshopPanelProvider seeds excerpts through the webview workshop source convention', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );

    expect(providerSource).toContain("source: 'webview.workshop'");
    expect(providerSource).not.toContain('extension.command.workshop_selection');
  });

  it('registers one Workshop panel serializer that reuses the normal attachment path', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    expect(providerSource).toContain('implements vscode.Disposable, vscode.WebviewPanelSerializer');
    expect(providerSource).toMatch(/deserializeWebviewPanel\([\s\S]*?this\.attachPanel\(panel,\s*'restored'\)/);
    expect(providerSource).toMatch(/openOrReveal\(\)[\s\S]*?this\.attachPanel\(panel,\s*'opened'\)/);
    // Serializer state is intentionally not a second Workshop session store.
    expect(providerSource).toContain('_state: unknown');
    expect(providerSource).not.toMatch(/_state\.\w+/);

    const registrations = extensionSource.match(/registerWebviewPanelSerializer\(/g) ?? [];
    expect(registrations).toHaveLength(1);
    expect(extensionSource).toMatch(
      /registerWebviewPanelSerializer\(\s*WorkshopPanelProvider\.viewType,\s*workshopPanelProvider\s*\)/
    );
  });

  it('quiesces the Workshop handler before the final deactivation flush', () => {
    const providerSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    const extensionSource = fs.readFileSync(EXTENSION_ENTRY, 'utf8');

    const providerDispose = providerSource.slice(
      providerSource.indexOf('public dispose(): void'),
      providerSource.indexOf('\n  }\n}', providerSource.indexOf('public dispose(): void'))
    );
    expect(providerDispose.indexOf('this.messageHandler?.dispose()'))
      .toBeLessThan(providerDispose.indexOf('panel?.dispose()'));

    const deactivate = extensionSource.slice(
      extensionSource.indexOf('export async function deactivate()'),
      extensionSource.indexOf('\n}', extensionSource.indexOf('export async function deactivate()'))
    );
    expect(deactivate.indexOf('workshopPanelProvider?.dispose()'))
      .toBeLessThan(deactivate.indexOf('await workshopSessionPersistenceCoordinator?.flush()'));
  });

  it('every MessageHandler in a provider is built over the ONE injected coreServices bundle (PR #66 review #12)', () => {
    // The risk is not two panels — it is two independently-assembled service
    // bundles (e.g. a second polling AccountBalanceService) hiding behind
    // retainContextWhenHidden. Every `new MessageHandler(` in every provider
    // must take `this.coreServices` as its first argument, verbatim.
    const offenders: string[] = [];
    for (const file of collectSourceFiles(PROVIDERS_ROOT)) {
      const source = fs.readFileSync(file, 'utf8');
      let cursor = 0;
      for (;;) {
        const start = source.indexOf('new MessageHandler(', cursor);
        if (start === -1) {
          break;
        }
        const end = source.indexOf(');', start);
        const constructionArgs = source.slice(start, end === -1 ? source.length : end);
        if (!/new MessageHandler\(\s*this\.coreServices\b/.test(constructionArgs)) {
          offenders.push(path.relative(APP_SRC_ROOT, file));
        }
        cursor = start + 'new MessageHandler('.length;
      }
    }
    expect(offenders).toEqual([]);

    // And the Workshop provider actually HAS its per-webview seam now
    // (Sprint 2) — the witness above must be guarding something real.
    const workshopSource = fs.readFileSync(
      path.join(PROVIDERS_ROOT, 'WorkshopPanelProvider.ts'),
      'utf8'
    );
    expect(workshopSource).toContain('new MessageHandler(');
  });
});
