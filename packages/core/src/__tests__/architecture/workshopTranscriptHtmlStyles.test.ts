/**
 * The styled-HTML transcript promises to look like the Workshop thread. This
 * witness keeps that promise honest: every mirrored rule must match a
 * top-level rule in its source stylesheet, selector for selector and
 * declaration for declaration. Restyle the thread and this fails until the
 * export's copy follows.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  WORKSHOP_TRANSCRIPT_HTML_CSS,
  WORKSHOP_TRANSCRIPT_MIRRORED_STYLES
} from '@/application/services/workshop/export/WorkshopTranscriptHtmlStyles';

const WEBVIEW_ROOT = path.resolve(__dirname, '..', '..', 'presentation', 'webview');

interface CssRule {
  selector: string;
  declarations: string[];
}

/** Top-level rules only; nested at-rule bodies are skipped, comments removed. */
function topLevelRules(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  let selector = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '{') {
      if (depth === 0) {
        selector = source.slice(selectorStart, index);
        bodyStart = index + 1;
      }
      depth++;
    } else if (character === '}') {
      depth--;
      if (depth === 0) {
        if (!selector.trim().startsWith('@')) {
          rules.push({
            selector: normalizeSelector(selector),
            declarations: source
              .slice(bodyStart, index)
              .split(';')
              .map((declaration) => declaration.trim().replace(/\s+/g, ' '))
              .filter(Boolean)
          });
        }
        selectorStart = index + 1;
      }
    }
  }
  return rules;
}

function normalizeSelector(selector: string): string {
  return selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .join(', ');
}

describe('styled-HTML transcript stylesheet', () => {
  it.each(WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.map((layer) => [layer.source, layer] as const))(
    'mirrors %s verbatim',
    (_source, layer) => {
      const sourceRules = topLevelRules(
        fs.readFileSync(path.join(WEBVIEW_ROOT, layer.source), 'utf8')
      );
      const mirroredRules = topLevelRules(layer.css);

      expect(mirroredRules.length).toBeGreaterThan(0);
      const drifted = mirroredRules
        .filter((mirrored) => !sourceRules.some((candidate) =>
          candidate.selector === mirrored.selector &&
          JSON.stringify(candidate.declarations) === JSON.stringify(mirrored.declarations)
        ))
        .map((rule) => rule.selector);
      expect(drifted).toEqual([]);
    }
  );

  it('mirrors the stylesheets in the webview cascade order', () => {
    expect(WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.map(({ source }) => source)).toEqual([
      'index.css',
      'styles/workshop/tokens.css',
      'styles/workshop/shell.css',
      'styles/workshop/session.css',
      'components/workshop/standingDirectiveRail.css'
    ]);
  });

  it('carries the Workshop palette tokens the mirrored rules resolve against', () => {
    const tokens = topLevelRules(
      WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.find(({ source }) => source.endsWith('tokens.css'))!.css
    );
    const used = new Set(
      [...WORKSHOP_TRANSCRIPT_HTML_CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1])
    );
    const defined = new Set([
      ...tokens.flatMap((rule) => rule.declarations.map((declaration) => declaration.split(':')[0])),
      '--spacing-xs', '--spacing-sm', '--spacing-md', '--spacing-lg', '--spacing-xl',
      // Optional status tokens: every use carries its literal fallback.
      '--pm-ok', '--pm-warn'
    ]);

    expect([...used].filter((token) => !defined.has(token))).toEqual([]);
  });

  it('loads nothing from the network', () => {
    expect(WORKSHOP_TRANSCRIPT_HTML_CSS).not.toMatch(/@import|url\(/i);
  });
});
