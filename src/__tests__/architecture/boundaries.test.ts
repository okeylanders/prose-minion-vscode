/**
 * Architectural boundary guards.
 *
 * A living registry of invariants the type-checker can't express. Add new
 * architectural witnesses here (one `it` per invariant) rather than scattering
 * them — a future contributor should find every boundary in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Core is vscode-free (ADR 2026-06-16).
 *    The domain/application/infrastructure/presentation layers must not import
 *    `vscode`. Only two files are sanctioned shells (they assemble the VS Code
 *    host and keep `vscode`), plus the adapter folder whose job is wrapping it:
 *      - src/extension.ts                                    (composition root)
 *      - src/application/providers/ProseToolsViewProvider.ts (WebviewViewProvider)
 *      - src/platform/vscode/**                              (the port adapters)
 *
 *    RENDERER GLOBAL (Stage-2 Wave 1 — now sealed): the *webview* renderer's
 *    runtime touchpoint is the `acquireVsCodeApi()` global. It is NOT an
 *    `import 'vscode'`, so this import-scan guard never caught it. As of Wave 1
 *    it is wrapped behind `AppMessagePort` (presentation/webview/ports/) and the
 *    global is referenced in exactly ONE module — the VS Code adapter
 *    `src/presentation/webview/hooks/useVSCodeApi.ts`. The desktop renderer will
 *    swap in an IPC-backed `AppMessagePort` of the same shape. The import graph
 *    is vscode-free; the renderer coupling is now a single, named adapter seam.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..'); // -> src/

const ALLOWED = new Set<string>([
  path.join(SRC_ROOT, 'extension.ts'),
  path.join(SRC_ROOT, 'application', 'providers', 'ProseToolsViewProvider.ts'),
]);

const SKIP_DIRS = new Set<string>([
  path.join(SRC_ROOT, '__tests__'), // tests mock vscode by design
  path.join(SRC_ROOT, 'platform', 'vscode'), // the adapters
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

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(full)) continue;
      collectSourceFiles(full, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('architectural boundaries', () => {
  it('core imports no vscode outside the sanctioned shells (static OR dynamic import)', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => VSCODE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
