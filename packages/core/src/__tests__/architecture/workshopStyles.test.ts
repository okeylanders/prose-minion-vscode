/** Executable witnesses for the Sprint 03 Workshop stylesheet split. */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const WEBVIEW_ROOT = path.resolve(__dirname, '..', '..', 'presentation', 'webview');
const WORKSHOP_APP = path.join(WEBVIEW_ROOT, 'WorkshopApp.tsx');
const WEBVIEW_ENTRY = path.join(WEBVIEW_ROOT, 'index.tsx');

const CSS_MODULE_REFERENCE =
  /(?:from\s*|import\s*|import\(\s*|require\(\s*)['"][^'"]*\.css['"]/;

const WORKSHOP_STYLE_IMPORTS = [
  './styles/workshop/tokens.css',
  './styles/workshop/shell.css',
  './styles/workshop/context.css',
  './styles/workshop/session.css',
  './components/workshop/widgets/gesturePlayground/gesturePlayground.css',
  './components/workshop/widgets/lexicalGravity/lexicalGravity.css',
  './components/workshop/standingDirectiveRail.css'
] as const;

// The monolith kept one blank separator after these responsibility blocks.
// The split files use clean single-newline EOFs; the witness restores those
// separators only while reconstructing the pre-split byte stream.
const PRE_SPLIT_SEPARATOR_AFTER = new Set<string>([
  './styles/workshop/shell.css',
  './styles/workshop/context.css',
  './styles/workshop/session.css',
  './components/workshop/widgets/gesturePlayground/gesturePlayground.css',
  './components/workshop/widgets/lexicalGravity/lexicalGravity.css'
]);

// Migration receipt, not a permanent content freeze. These paths and this
// digest prove the Sprint 03 split preserved the retired monolith byte-for-byte.
// At the first intentional Workshop stylesheet edit, delete this receipt test
// and its PRE_SPLIT_* constants; the move is proven and this seal is spent.
const PRE_SPLIT_ASSEMBLY = [
  './styles/workshop/tokens.css',
  './styles/workshop/shell.css',
  './styles/workshop/context.css',
  './styles/workshop/session.css',
  './components/workshop/widgets/gesturePlayground/gesturePlayground.css',
  './components/workshop/widgets/lexicalGravity/lexicalGravity.css',
  './components/workshop/standingDirectiveRail.css'
] as const;
const PRE_SPLIT_SHA256 = '64783db8fdfc6a0295fb94b5c7e345d79063890b334fb9f73ea88f597092db2d';

describe('Workshop stylesheet assembly', () => {
  it('preserves every pre-split byte in the declared cascade order', () => {
    const assembled = PRE_SPLIT_ASSEMBLY.map((importPath) =>
      fs.readFileSync(path.resolve(WEBVIEW_ROOT, importPath), 'utf8')
      + (PRE_SPLIT_SEPARATOR_AFTER.has(importPath) ? '\n' : '')
    ).join('');

    expect(createHash('sha256').update(assembled).digest('hex')).toBe(PRE_SPLIT_SHA256);
  });

  it('keeps the whole Workshop cascade at its single composition point', () => {
    const source = fs.readFileSync(WORKSHOP_APP, 'utf8');
    const actualOrder = [...source.matchAll(/import ['"](.*\.css)['"];?/g)]
      .map((match) => match[1]);

    expect(actualOrder).toEqual([
      ...WORKSHOP_STYLE_IMPORTS,
      './components/workshop/schematic/schematic.css'
    ]);

    const selfImportOffenders = collectTypeScriptFiles(WEBVIEW_ROOT)
      .filter((file) => file !== WORKSHOP_APP && file !== WEBVIEW_ENTRY)
      .filter((file) => CSS_MODULE_REFERENCE.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(WEBVIEW_ROOT, file));
    expect(selfImportOffenders).toEqual([]);
  });

  it.each([
    "import './a.css';",
    "import styles from './a.css';",
    "import * as styles from './a.css';",
    "import { className } from './a.css';",
    "const styles = require('./a.css');",
    "const styles = import('./a.css');"
  ])('recognizes CSS module references in %s', (source) => {
    expect(CSS_MODULE_REFERENCE.test(source)).toBe(true);
  });
});

function collectTypeScriptFiles(directory: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}
