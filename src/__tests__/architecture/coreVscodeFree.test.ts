/**
 * Core vscode-free boundary guard (ADR 2026-06-16).
 *
 * Stage 1's deliverable: the domain/application/infrastructure/presentation
 * layers do NOT import `vscode`. Only two files are sanctioned shells (they
 * assemble the VS Code host and keep `vscode`), plus the adapter folder whose
 * whole job is wrapping `vscode`:
 *   - src/extension.ts                                  (activation / composition root)
 *   - src/application/providers/ProseToolsViewProvider.ts (WebviewViewProvider shell)
 *   - src/platform/vscode/**                             (the port adapters)
 *
 * Any new `import 'vscode'` outside that allow-list is a regression of the
 * ports-and-adapters boundary — fail loud here so the Electron/desktop port
 * stays a fill-in-the-adapters job.
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

const VSCODE_IMPORT = /(?:from\s+['"]vscode['"]|import\s+\*\s+as\s+vscode\s+from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\))/;

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

describe('core is vscode-free (ports boundary)', () => {
  it('no production source outside the sanctioned shells imports vscode', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => VSCODE_IMPORT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
