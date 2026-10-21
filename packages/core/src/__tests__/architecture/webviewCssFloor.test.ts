/**
 * The webview's CSS against the declared host floor (PR #156 F-04).
 *
 * `apps/vscode-extension/package.json` declares `engines.vscode: ^1.75.0`.
 * VS Code 1.75 runs Electron 19.1.9, which is Chromium 102, so every webview
 * stylesheet must hold on Chromium 102. Raising that floor is the writer's
 * decision; this guard only keeps the CSS honest to it.
 *
 * Each feature below is listed with the first Chrome version that supports
 * it, from MDN browser-compat-data 6.1.5. Comments are stripped before
 * scanning. Cascade layers (`@layer`, Chrome 99) are at the floor and
 * allowed.
 *
 * The stylesheets already used some of these features before this guard
 * existed. They are counted per file in `KNOWN` and tracked as tech debt
 * (`.todo/tech-debt/2026-10-21-webview-css-above-chromium-102.md`). The guard
 * is a ratchet: a new use anywhere fails, and so does a removed one until
 * `KNOWN` is lowered to match. The Lightbox ribbon's grid uses none.
 */
import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable @typescript-eslint/naming-convention -- keys are stylesheet paths and CSS feature names. */

const FLOOR_CHROME = 102;
const WEBVIEW = path.resolve(__dirname, '../../presentation/webview');
const PACKAGE = path.resolve(__dirname, '../../../../../apps/vscode-extension/package.json');

interface Feature {
  name: string;
  /** First Chrome version with support (MDN browser-compat-data 6.1.5). */
  chrome: number;
  count: (css: string) => number;
}

const matches = (pattern: RegExp) => (css: string) => css.match(pattern)?.length ?? 0;

/** Style rules nested inside style rules (CSS nesting: `&` or a bare nested selector). */
function nestedRules(css: string): number {
  const stack: Array<'rule' | 'at'> = [];
  let prelude = '';
  let nested = 0;
  for (const char of css) {
    if (char === '{') {
      const kind = prelude.trim().startsWith('@') ? 'at' : 'rule';
      if (kind === 'rule' && stack[stack.length - 1] === 'rule') {
        nested += 1;
      }
      stack.push(kind);
      prelude = '';
    } else if (char === '}') {
      stack.pop();
      prelude = '';
    } else if (char === ';') {
      prelude = '';
    } else {
      prelude += char;
    }
  }
  return nested;
}

const FEATURES: Feature[] = [
  { name: 'subgrid', chrome: 117, count: matches(/\bsubgrid\b/g) },
  { name: ':has()', chrome: 105, count: matches(/:has\(/g) },
  { name: '@container', chrome: 105, count: matches(/@container\b/g) },
  { name: 'container query units', chrome: 105, count: matches(/\b\d*\.?\d+cq(?:w|h|i|b|min|max)\b/g) },
  { name: 'CSS nesting', chrome: 112, count: nestedRules },
  { name: 'color-mix()', chrome: 111, count: matches(/\bcolor-mix\(/g) },
  { name: 'lab()/lch()/oklab()/oklch()', chrome: 111, count: matches(/(?<![-\w])(?:ok)?l(?:ab|ch)\(/g) },
  { name: 'light-dark()', chrome: 123, count: matches(/\blight-dark\(/g) },
  { name: 'media range syntax', chrome: 104, count: matches(/\(\s*(?:[\d.]+[a-z]*\s*[<>]=?\s*)?(?:width|height|aspect-ratio|resolution)\s*[<>]/g) },
  { name: '@scope', chrome: 118, count: matches(/@scope\b/g) },
  { name: '@starting-style', chrome: 117, count: matches(/@starting-style\b/g) },
  { name: 'text-wrap', chrome: 114, count: matches(/(?<![-\w])text-wrap(?:-style|-mode)?\s*:/g) },
  { name: 'small/large/dynamic viewport units', chrome: 108, count: matches(/\b\d*\.?\d+[sld]v(?:h|w|i|b|min|max)\b/g) },
  { name: 'lh/rlh units', chrome: 109, count: matches(/\b\d*\.?\d+r?lh\b/g) },
  { name: 'scrollbar-width/scrollbar-color', chrome: 121, count: matches(/(?<![-\w])scrollbar-(?:width|color)\s*:/g) },
  { name: 'translate/scale/rotate properties', chrome: 104, count: matches(/(?<![-\w])(?:translate|scale|rotate)\s*:/g) },
  { name: 'anchor positioning', chrome: 125, count: matches(/(?<![-\w])(?:anchor-name|position-anchor)\s*:|(?<![-\w])anchor\(/g) },
  { name: 'field-sizing', chrome: 123, count: matches(/(?<![-\w])field-sizing\s*:/g) },
  { name: 'round()/mod()/rem()', chrome: 125, count: matches(/(?<![-\w])(?:round|mod|rem)\(/g) },
  { name: 'trigonometric functions', chrome: 111, count: matches(/(?<![-\w])(?:sin|cos|tan|asin|acos|atan|atan2)\(/g) },
  { name: 'animation-timeline', chrome: 115, count: matches(/(?<![-\w])animation-timeline\s*:/g) },
  { name: 'view-transition-name', chrome: 111, count: matches(/(?<![-\w])view-transition-name\s*:/g) },
  { name: 'initial-letter', chrome: 110, count: matches(/(?<![-\w])initial-letter\s*:/g) },
  { name: 'interpolate-size', chrome: 129, count: matches(/(?<![-\w])interpolate-size\s*:/g) }
];

/**
 * Uses that predate this guard, per file (relative to the webview folder) and feature. Lower a count, or
 * remove an entry, when a use goes; never raise one.
 */
const KNOWN: Record<string, Record<string, number>> = {
  'components/workshop/schematic/schematic.css': { 'translate/scale/rotate properties': 2 },
  'components/workshop/widgets/creativeVariations/creativeVariations.css': { 'color-mix()': 2 },
  'components/workshop/widgets/gesturePlayground/gesturePlayground.css': { 'color-mix()': 2 },
  'components/workshop/widgets/lexicalGravity/lexicalGravity.css': { 'scrollbar-width/scrollbar-color': 4 },
  'components/workshop/widgets/showVsTell/showVsTell.css': { 'color-mix()': 2 },
  'index.css': { '@container': 1, 'color-mix()': 18 },
  'styles/fulltab/modal.css': { 'color-mix()': 2 },
  'styles/fulltab/shell.css': { 'color-mix()': 5 },
  'styles/lightbox/board.css': { 'color-mix()': 2 },
  'styles/lightbox/readings.css': { 'color-mix()': 1 },
  'styles/lightbox/tiles.css': { 'color-mix()': 2 },
  'styles/workshop/context.css': { 'color-mix()': 25, 'text-wrap': 4 },
  'styles/workshop/session.css': { 'color-mix()': 5 },
  'styles/workshop/shell.css': { 'color-mix()': 33 }
};

function stylesheets(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? stylesheets(full) : entry.name.endsWith('.css') ? [full] : [];
  });
}

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function usesAboveFloor(css: string): Record<string, number> {
  const text = withoutComments(css);
  return Object.fromEntries(
    FEATURES.map((feature) => [feature.name, feature.count(text)] as const).filter(([, count]) => count > 0)
  );
}

describe('webview CSS against the Chromium 102 floor (VS Code 1.75; PR #156 F-04)', () => {
  it('lists only features above the floor', () => {
    expect(FEATURES.every((feature) => feature.chrome > FLOOR_CHROME)).toBe(true);
  });

  it('holds the floor the extension declares', () => {
    const manifest = JSON.parse(fs.readFileSync(PACKAGE, 'utf8')) as { engines: { vscode: string } };
    // VS Code 1.75 → Electron 19.1.9 → Chromium 102. A new floor changes FLOOR_CHROME, FEATURES and KNOWN with it.
    expect(manifest.engines.vscode).toBe('^1.75.0');
  });

  it('adds no use of a feature above the floor to any webview stylesheet', () => {
    const found = Object.fromEntries(
      stylesheets(WEBVIEW)
        .map((file) => [path.relative(WEBVIEW, file).split(path.sep).join('/'), usesAboveFloor(fs.readFileSync(file, 'utf8'))] as const)
        .filter(([, uses]) => Object.keys(uses).length > 0)
    );
    expect(found).toEqual(KNOWN);
  });

  it('keeps the Lightbox ribbon\'s grid to features the floor has', () => {
    for (const name of ['ribbon.css', 'plot.css']) {
      expect({ name, uses: usesAboveFloor(fs.readFileSync(path.join(WEBVIEW, 'styles/lightbox', name), 'utf8')) })
        .toEqual({ name, uses: {} });
    }
  });

  it('puts no such feature in an inline style either', () => {
    const sources = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
    });
    const inline = sources(WEBVIEW).filter((file) => /['"`][^'"`\n]*(?:\bsubgrid\b|:has\(|@container\b)/.test(fs.readFileSync(file, 'utf8')));
    expect(inline.map((file) => path.relative(WEBVIEW, file))).toEqual([]);
  });

  it('catches what it guards (controls)', () => {
    expect(usesAboveFloor('.a { display: grid; grid-template-columns: subgrid; }')).toEqual({ subgrid: 1 });
    expect(usesAboveFloor('.a:has(.b) { color: red; }')).toEqual({ ':has()': 1 });
    expect(usesAboveFloor('@container (max-width: 360px) { .a { width: 50cqw; } }')).toEqual({ '@container': 1, 'container query units': 1 });
    expect(usesAboveFloor('.a { color: red; & .b { color: blue; } .c { color: green; } }')).toEqual({ 'CSS nesting': 2 });
    expect(usesAboveFloor('@media (width <= 760px) { .a { scale: 1.1; } }')).toEqual({ 'media range syntax': 1, 'translate/scale/rotate properties': 1 });
    // At the floor: plain grid, @media max-width, @layer, transform functions, nesting inside at-rules only.
    expect(usesAboveFloor(
      '@layer base { .a { display: grid; grid-template-columns: minmax(74px, max-content) minmax(0, 1fr); } }\n' +
      '@media (max-width: 760px) { .a { transform: scale(1.1) translate(2px, 0); --pm-scale: 2; } }\n' +
      '/* subgrid in a comment is not CSS */ @keyframes x { 0% { opacity: 0; } 100% { opacity: 1; } }'
    )).toEqual({});
  });
});
