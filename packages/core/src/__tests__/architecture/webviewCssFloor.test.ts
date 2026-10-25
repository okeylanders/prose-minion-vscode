/**
 * The webview's CSS against the declared host floor (PR #156 F-04; ADR 2026-10-21).
 *
 * `apps/vscode-extension/package.json` declares `engines.vscode: ^1.82.0`.
 * VS Code 1.82 is the first stable release on Electron 25, which ships
 * Chromium 114 (https://code.visualstudio.com/updates/v1_82, "Electron 25
 * update"; https://releases.electronjs.org/release/v25.8.0), so every webview
 * stylesheet must hold on Chromium 114. The floor is the writer's decision
 * (`docs/adr/2026-10-21-vscode-engine-floor.md`); this guard only keeps the
 * CSS honest to it.
 *
 * Each feature below is listed with the first Chrome version that fully
 * supports it, from MDN browser-compat-data 6.1.5 (the `css.*` key beside
 * it). Comments are stripped before scanning. Features at or below the floor
 * are allowed and not listed, among them `@layer` (99), `:has()`,
 * `@container` and its units (105), `color-mix()` (111), and the `text-wrap`
 * property with one of `wrap`, `nowrap` and `balance` (114). Chromium 114
 * parses `text-wrap` as that single keyword only; the two-value shorthand
 * and `auto` are Chrome 130's grammar (PR #158 N-01).
 *
 * `KNOWN` counts the uses above the floor that remain, per file. The guard is
 * a ratchet: a new use anywhere fails, and so does a removed one until
 * `KNOWN` is lowered to match. Only a feature in `GRACEFUL`, one that
 * Chromium 114 drops without breaking the page, may appear there. The
 * Lightbox ribbon's grid uses none.
 */
import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable @typescript-eslint/naming-convention -- keys are stylesheet paths and CSS feature names. */

const FLOOR_CHROME = 114;
const WEBVIEW = path.resolve(__dirname, '../../presentation/webview');
const PACKAGE = path.resolve(__dirname, '../../../../../apps/vscode-extension/package.json');

interface Feature {
  name: string;
  /** First Chrome version with full support (MDN browser-compat-data 6.1.5). */
  chrome: number;
  count: (css: string) => number;
}

const matches = (pattern: RegExp) => (css: string) => css.match(pattern)?.length ?? 0;

/**
 * The values a `text-wrap` declaration may take on Chromium 114: one keyword of its single-keyword
 * grammar (https://github.com/chromium/chromium/blob/114.0.5735.289/third_party/blink/renderer/core/css/css_properties.json5),
 * or a CSS-wide keyword. Anything else, a `var()` included, is not known to hold on the floor.
 */
const TEXT_WRAP_AT_FLOOR = new Set(['wrap', 'nowrap', 'balance', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/** Each `text-wrap` declaration's value, lower-cased, without `!important`. */
const textWrapValues = (css: string): string[] =>
  [...css.matchAll(/(?<![-\w])text-wrap\s*:\s*([^;}]*)/gi)].map((match) =>
    match[1].replace(/!\s*important/i, '').trim().toLowerCase());

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
  // css.properties.grid-template-columns.subgrid
  { name: 'subgrid', chrome: 117, count: matches(/\bsubgrid\b/g) },
  // css.selectors.nesting: full in 120. Chrome 112 to 119 do not parse a nested rule that starts with a type selector.
  { name: 'CSS nesting', chrome: 120, count: nestedRules },
  // css.types.color.light-dark
  { name: 'light-dark()', chrome: 123, count: matches(/\blight-dark\(/g) },
  // css.at-rules.scope
  { name: '@scope', chrome: 118, count: matches(/@scope\b/g) },
  // css.at-rules.starting-style
  { name: '@starting-style', chrome: 117, count: matches(/@starting-style\b/g) },
  // css.properties.text-wrap.pretty: the single keyword `pretty` (the property and its wrap, nowrap and balance values are 114)
  { name: 'text-wrap: pretty', chrome: 117, count: (css) => textWrapValues(css).filter((value) => value === 'pretty').length },
  // css.properties.text-wrap.stable, css.properties.text-wrap-mode, css.properties.text-wrap-style; the two-value
  // shorthand and `auto` ship with them (https://groups.google.com/a/chromium.org/g/blink-dev/c/x4x_38sJhbk)
  {
    name: 'text-wrap beyond one 114 keyword, text-wrap-mode, text-wrap-style',
    chrome: 130,
    count: (css) =>
      textWrapValues(css).filter((value) => value !== 'pretty' && !TEXT_WRAP_AT_FLOOR.has(value)).length +
      matches(/(?<![-\w])text-wrap-(?:mode|style)\s*:/g)(css)
  },
  // css.properties.scrollbar-width, css.properties.scrollbar-color
  { name: 'scrollbar-width/scrollbar-color', chrome: 121, count: matches(/(?<![-\w])scrollbar-(?:width|color)\s*:/g) },
  // css.properties.anchor-name, css.properties.position-anchor, css.types.anchor
  { name: 'anchor positioning', chrome: 125, count: matches(/(?<![-\w])(?:anchor-name|position-anchor)\s*:|(?<![-\w])anchor\(/g) },
  // css.properties.field-sizing
  { name: 'field-sizing', chrome: 123, count: matches(/(?<![-\w])field-sizing\s*:/g) },
  // css.types.round, css.types.mod, css.types.rem
  { name: 'round()/mod()/rem()', chrome: 125, count: matches(/(?<![-\w])(?:round|mod|rem)\(/g) },
  // css.properties.animation-timeline
  { name: 'animation-timeline', chrome: 115, count: matches(/(?<![-\w])animation-timeline\s*:/g) },
  // css.properties.interpolate-size
  { name: 'interpolate-size', chrome: 129, count: matches(/(?<![-\w])interpolate-size\s*:/g) }
];

/**
 * Features above the floor that a stylesheet may keep, because Chromium 114 drops the declaration and the
 * page still works (ADR 2026-10-21). They were not worth a higher floor.
 */
const GRACEFUL: Record<string, string> = {
  'scrollbar-width/scrollbar-color': 'Chromium 114 to 120 ignore both properties; the sheet\'s own ::-webkit-scrollbar rules still style the scrollbars.',
  'text-wrap: pretty': 'Chromium 114 to 116 ignore the value and wrap lines as usual.'
};

/**
 * Uses above the floor, per file (relative to the webview folder) and feature. Lower a count, or remove an
 * entry, when a use goes; never raise one.
 */
const KNOWN: Record<string, Record<string, number>> = {
  'components/workshop/widgets/lexicalGravity/lexicalGravity.css': { 'scrollbar-width/scrollbar-color': 4 },
  'styles/workshop/context.css': { 'text-wrap: pretty': 4 }
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

describe('webview CSS against the Chromium 114 floor (VS Code 1.82; ADR 2026-10-21)', () => {
  it('lists only features above the floor', () => {
    expect(FEATURES.every((feature) => feature.chrome > FLOOR_CHROME)).toBe(true);
  });

  it('holds the floor the extension declares', () => {
    const manifest = JSON.parse(fs.readFileSync(PACKAGE, 'utf8')) as { engines: { vscode: string } };
    // VS Code 1.82 → Electron 25 → Chromium 114. A new floor changes FLOOR_CHROME, FEATURES and KNOWN with it.
    expect(manifest.engines.vscode).toBe('^1.82.0');
  });

  it('keeps above the floor only features that degrade gracefully', () => {
    const listed = new Set(FEATURES.map((feature) => feature.name));
    expect(Object.keys(GRACEFUL).filter((name) => !listed.has(name))).toEqual([]);
    const kept = new Set(Object.values(KNOWN).flatMap((uses) => Object.keys(uses)));
    expect([...kept].filter((name) => !(name in GRACEFUL))).toEqual([]);
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

  it('puts no subgrid in an inline style either', () => {
    const sources = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
    });
    const inline = sources(WEBVIEW).filter((file) => /['"`][^'"`\n]*\bsubgrid\b/.test(fs.readFileSync(file, 'utf8')));
    expect(inline.map((file) => path.relative(WEBVIEW, file))).toEqual([]);
  });

  it('catches what it guards (controls)', () => {
    expect(usesAboveFloor('.a { display: grid; grid-template-columns: subgrid; }')).toEqual({ subgrid: 1 });
    expect(usesAboveFloor('.a { color: red; & .b { color: blue; } .c { color: green; } }')).toEqual({ 'CSS nesting': 2 });
    expect(usesAboveFloor('.a { text-wrap: pretty; scrollbar-width: thin; scrollbar-color: red transparent; }'))
      .toEqual({ 'text-wrap: pretty': 1, 'scrollbar-width/scrollbar-color': 2 });
    expect(usesAboveFloor('.a { text-wrap: wrap stable; } .b { text-wrap-style: balance; }'))
      .toEqual({ 'text-wrap beyond one 114 keyword, text-wrap-mode, text-wrap-style': 2 });
    // Chrome 130's grammar, which Chromium 114 drops (PR #158 N-01), and a value the guard cannot check.
    expect(usesAboveFloor(
      '.a { text-wrap: wrap balance; } .b { text-wrap: nowrap balance; } .c { text-wrap: auto; }\n' +
      '.d { text-wrap: wrap pretty; } .e { text-wrap: var(--pm-wrap); }'
    )).toEqual({ 'text-wrap beyond one 114 keyword, text-wrap-mode, text-wrap-style': 5 });
    expect(usesAboveFloor('.a { text-wrap: pretty !important; } .b { TEXT-WRAP: Pretty; }')).toEqual({ 'text-wrap: pretty': 2 });
    // One keyword of the 114 grammar, or a CSS-wide keyword, holds on the floor.
    expect(usesAboveFloor(
      '.a { text-wrap: wrap; } .b { text-wrap: nowrap !important; } .c { text-wrap: balance; }\n' +
      '.d { text-wrap: inherit; } .e { text-wrap: initial; } .f { text-wrap: unset; } .g { text-wrap: revert; } .h { text-wrap: revert-layer; }'
    )).toEqual({});
    // At the floor: plain grid, @layer, :has(), @container and its units, media range syntax, color-mix(),
    // text-wrap: balance, the translate/scale/rotate properties, transform functions, nesting inside at-rules only.
    expect(usesAboveFloor(
      '@layer base { .a { display: grid; grid-template-columns: minmax(74px, max-content) minmax(0, 1fr); } }\n' +
      '.a:has(.b) { color: color-mix(in srgb, red 40%, transparent); text-wrap: balance; }\n' +
      '@container (max-width: 360px) { .a { width: 50cqw; } }\n' +
      '@media (width <= 760px) { .a { transform: scale(1.1) translate(2px, 0); scale: 1.1; --pm-scale: 2; } }\n' +
      '/* subgrid in a comment is not CSS */ @keyframes x { 0% { opacity: 0; } 100% { opacity: 1; } }'
    )).toEqual({});
  });
});
