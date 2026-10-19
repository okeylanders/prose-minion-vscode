/**
 * Executable witnesses for the webview stylesheet assembly: the Sprint 03
 * Workshop split, and the shared full-tab frame (Lightbox Slice 1, ADR
 * 2026-10-19 D2) that every full editor tab renders under.
 */

import * as fs from 'fs';
import * as path from 'path';

const WEBVIEW_ROOT = path.resolve(__dirname, '..', '..', 'presentation', 'webview');
const WORKSHOP_APP = path.join(WEBVIEW_ROOT, 'WorkshopApp.tsx');
const LIGHTBOX_APP = path.join(WEBVIEW_ROOT, 'LightboxApp.tsx');
const WEBVIEW_ENTRY = path.join(WEBVIEW_ROOT, 'index.tsx');

/** The composition points allowed to import CSS. */
const CSS_COMPOSITION_POINTS = [WORKSHOP_APP, LIGHTBOX_APP, WEBVIEW_ENTRY];

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
  './components/workshop/widgets/showVsTell/showVsTell.css',
  './components/workshop/standingDirectiveRail.css'
] as const;

/**
 * The shared frame, imported once from the entry point AHEAD of every root, so
 * each tab's own sheets follow it in the cascade. index.css stays last.
 */
const ENTRY_STYLE_IMPORTS = [
  './styles/fulltab/tokens.css',
  './styles/fulltab/shell.css',
  './index.css'
] as const;

/** Empty until Slice 2A brings `styles/lightbox/`; pinned so it lands on purpose. */
const LIGHTBOX_STYLE_IMPORTS: readonly string[] = [];

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
      .filter((file) => !CSS_COMPOSITION_POINTS.includes(file))
      .filter((file) => CSS_MODULE_REFERENCE.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(WEBVIEW_ROOT, file));
    expect(selfImportOffenders).toEqual([]);
  });

  it('loads the shared full-tab frame once, from the entry, before any root and its sheets', () => {
    const source = fs.readFileSync(WEBVIEW_ENTRY, 'utf8');
    expect(cssImports(source)).toEqual([...ENTRY_STYLE_IMPORTS]);

    const lastFrameImport = source.indexOf("import './styles/fulltab/shell.css'");
    for (const root of ['./App', './WorkshopApp', './LightboxApp']) {
      const rootImport = source.indexOf(`from '${root}'`);
      expect(rootImport).toBeGreaterThan(lastFrameImport);
    }
  });

  it('pins the Lightbox root\'s own stylesheet list', () => {
    expect(cssImports(fs.readFileSync(LIGHTBOX_APP, 'utf8'))).toEqual(LIGHTBOX_STYLE_IMPORTS);
  });

  it('scopes every full-tab frame rule to the frame, and no Workshop rule to it', () => {
    const rulesOf = (file: string) =>
      fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const fullTabDir = path.join(WEBVIEW_ROOT, 'styles', 'fulltab');
    for (const file of fs.readdirSync(fullTabDir)) {
      const css = rulesOf(path.join(fullTabDir, file));
      expect(css).not.toContain('data-pm-surface');
      expect(css).toContain('[data-pm-frame="fulltab"]');
    }
    const workshopDir = path.join(WEBVIEW_ROOT, 'styles', 'workshop');
    for (const file of fs.readdirSync(workshopDir)) {
      expect(rulesOf(path.join(workshopDir, file))).not.toContain('data-pm-frame');
    }
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

function cssImports(source: string): string[] {
  return [...source.matchAll(/import ['"](.*\.css)['"];?/g)].map((match) => match[1]);
}

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
