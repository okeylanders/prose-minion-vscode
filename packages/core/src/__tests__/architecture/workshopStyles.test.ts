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
 * each tab's own sheets follow it in the cascade. index.css stays last. The
 * modal chrome and project picker (modal.css) are the frame's too: the
 * Workshop and the Lightbox both render them (Lightbox source picker,
 * 2026-10-20).
 */
const ENTRY_STYLE_IMPORTS = [
  './styles/fulltab/tokens.css',
  './styles/fulltab/shell.css',
  './styles/fulltab/modal.css',
  './index.css'
] as const;

/** The Lightbox root's own sheets (Slices 2A and 2B), after the frame's, in cascade order. */
const LIGHTBOX_STYLE_IMPORTS = [
  './styles/lightbox/tokens.css',
  './styles/lightbox/board.css',
  './styles/lightbox/ribbon.css',
  './styles/lightbox/tiles.css',
  './styles/lightbox/rail.css',
  './styles/lightbox/inspector.css',
  './styles/lightbox/readings.css',
  './styles/lightbox/gravity.css',
  './styles/lightbox/story.css',
  './styles/lightbox/craft.css',
  './styles/lightbox/plot.css',
  './styles/lightbox/opinion.css'
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
      .filter((file) => !CSS_COMPOSITION_POINTS.includes(file))
      .filter((file) => CSS_MODULE_REFERENCE.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(WEBVIEW_ROOT, file));
    expect(selfImportOffenders).toEqual([]);
  });

  it('loads the shared full-tab frame once, from the entry, before any root and its sheets', () => {
    const source = fs.readFileSync(WEBVIEW_ENTRY, 'utf8');
    expect(cssImports(source)).toEqual([...ENTRY_STYLE_IMPORTS]);

    const lastFrameImport = source.indexOf("import './styles/fulltab/modal.css'");
    for (const root of ['./App', './WorkshopApp', './LightboxApp']) {
      const rootImport = source.indexOf(`from '${root}'`);
      expect(rootImport).toBeGreaterThan(lastFrameImport);
    }
  });

  it('pins the Lightbox root\'s own stylesheet list', () => {
    expect(cssImports(fs.readFileSync(LIGHTBOX_APP, 'utf8'))).toEqual([...LIGHTBOX_STYLE_IMPORTS]);
    const lightboxDir = path.join(WEBVIEW_ROOT, 'styles', 'lightbox');
    expect(fs.readdirSync(lightboxDir).sort())
      .toEqual(LIGHTBOX_STYLE_IMPORTS.map((file) => path.basename(file)).sort());
  });

  it('scopes every Lightbox rule to the Lightbox surface, never the Workshop', () => {
    const lightboxDir = path.join(WEBVIEW_ROOT, 'styles', 'lightbox');
    for (const file of fs.readdirSync(lightboxDir)) {
      const source = fs.readFileSync(path.join(lightboxDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Keyframes cannot be scoped to a surface; a Lightbox-prefixed name keeps them its own.
      const keyframes = [...source.matchAll(/@keyframes\s+([\w-]+)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g)];
      expect(keyframes.map((match) => match[1]).filter((name) => !name.startsWith('pm-lb-'))).toEqual([]);
      const css = keyframes
        .reduce((text, match) => text.replace(match[0], ''), source)
        .replace(/@media[^{]*\{/g, '{');
      const selectors = [...css.matchAll(/([^{}@;]+)\{/g)]
        .map((match) => match[1].trim())
        .filter((selector) => selector.length > 0);
      const unscoped = selectors
        .flatMap((selector) => selector.split(','))
        .map((part) => part.trim())
        .filter((part) => !part.startsWith('[data-pm-surface="lightbox"]'));
      expect({ file, unscoped }).toEqual({ file, unscoped: [] });
      expect(css).not.toContain('data-pm-surface="workshop"');
    }
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
