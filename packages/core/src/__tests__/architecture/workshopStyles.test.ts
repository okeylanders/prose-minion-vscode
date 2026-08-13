/** Executable witnesses for the Sprint 03 Workshop stylesheet split. */

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
  './components/workshop/widgets/creativeVariations/creativeVariations.css',
  './components/workshop/standingDirectiveRail.css'
] as const;

// The Sprint 03 byte-preservation receipt test retired here at the first
// intentional Workshop stylesheet edit (Lexical Gravity v2 Lens Logic styles,
// 2026-08-06), per its own retirement instruction. The cascade-order and
// single-composition-point witnesses below remain live.

describe('Workshop stylesheet assembly', () => {
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
