/**
 * The memory sheet's six kind cards (epic Slice 6a): six across when they
 * fit, otherwise three by two, and nothing in between. `auto-fit` and
 * `auto-fill` would give 5+1 and 4+2 rows, so the grid never uses them; six
 * columns come only from the kind field's own container query.
 */
import * as fs from 'fs';
import * as path from 'path';

const STYLES = path.resolve(__dirname, '../../presentation/webview/styles/workshop/memory.css');
const SHEET = path.resolve(__dirname, '../../presentation/webview/components/workshop/memory/WorkshopMemorySheet.tsx');
const css = fs.readFileSync(STYLES, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Each rule whose selector names the kind grid, with the at-rule it sits in (or none). */
function kindGridRules(): Array<{ within: string | null; body: string }> {
  const rules: Array<{ within: string | null; body: string }> = [];
  const at = /@(container|media)([^{]*)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
  const outside = css.replace(at, (_whole, kind: string, prelude: string, inner: string) => {
    for (const rule of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/\.pm-ws-memory-kinds\b/.test(rule[1])) {
        rules.push({ within: `@${kind}${prelude}`.trim(), body: rule[2] });
      }
    }
    return '';
  });
  for (const rule of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.pm-ws-memory-kinds\b/.test(rule[1])) {
      rules.push({ within: null, body: rule[2] });
    }
  }
  return rules;
}

const columns = (body: string): string | undefined => /grid-template-columns:\s*([^;]+);/.exec(body)?.[1].trim();

describe('the memory sheet\'s kind grid: six across or three by two', () => {
  const rules = kindGridRules();

  it('is three columns by default', () => {
    const plain = rules.filter((rule) => rule.within === null && columns(rule.body));
    expect(plain.map((rule) => columns(rule.body))).toEqual(['repeat(3, minmax(0, 1fr))']);
  });

  it('is six columns only under the kind field\'s container query, at six 150px cards and their gaps', () => {
    const six = rules.filter((rule) => columns(rule.body) === 'repeat(6, minmax(0, 1fr))');
    expect(six.map((rule) => rule.within)).toEqual([`@container pm-ws-memory-kinds (min-width: ${6 * 150 + 5 * 8}px)`]);
    expect(css).toMatch(/\.pm-ws-memory-kind-field\s*\{\s*container:\s*pm-ws-memory-kinds\s*\/\s*inline-size;\s*\}/);
  });

  it('is two columns only under the 760px stack rule, and never anything else', () => {
    expect(rules.filter((rule) => columns(rule.body)).map((rule) => [rule.within, columns(rule.body)])).toEqual([
      ['@container pm-ws-memory-kinds (min-width: 940px)', 'repeat(6, minmax(0, 1fr))'],
      ['@media (max-width: 760px)', 'repeat(2, minmax(0, 1fr))'],
      [null, 'repeat(3, minmax(0, 1fr))']
    ]);
  });

  it('never uses auto-fit or auto-fill, which would leave 5+1 or 4+2 rows', () => {
    for (const rule of rules) {
      expect(rule.body).not.toMatch(/auto-(fit|fill)/);
    }
  });

  it('is the container the sheet\'s kind radio group sits in', () => {
    const sheet = fs.readFileSync(SHEET, 'utf8');
    expect(sheet).toMatch(/className="pm-ws-memory-field pm-ws-memory-kind-field">\s*<span id="pm-ws-memory-kind-label">Kind<\/span>\s*<div className="pm-ws-memory-kinds" role="radiogroup"/);
  });
});
