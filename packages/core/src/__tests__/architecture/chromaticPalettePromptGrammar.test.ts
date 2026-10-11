/**
 * Guard the Chromatic Palettes prompts against teaching malformed fences.
 *
 * Models copy examples more faithfully than they follow prose, so every
 * `pm-palette` fence a dictionary prompt shows must follow the palette grammar
 * exactly and stay inside the renderer's bounds: ordered `title:`, `kind:`,
 * and one-sentence `note:` headers, then 3–6 named, defined swatches with an
 * uppercase `#RRGGBB` value. The grammar is specified in
 * .todo/features/feature-dictionary-chromatic-palettes/README.md.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CHROMATIC_PALETTE_FENCE_LANGUAGE,
  CHROMATIC_PALETTE_LIMITS
} from '@shared/constants/chromaticPalettes';

const PROMPT_ROOT = path.resolve(__dirname, '../../../resources/system-prompts');
const PALETTE_PROMPTS = [
  'dictionary-utility/03-chromatic-palettes.md'
];

const SWATCH_LINE = /^([^|]+) \| (#[0-9A-F]{6}) \| (.+)$/;
/** "About 12 words" — the spec's own reference definitions run to 13. */
const MAX_DEFINITION_WORDS = 13;

/** Bodies of the top-level fences whose info string is exactly the palette language. */
function paletteFences(markdown: string): string[][] {
  const fences: string[][] = [];
  let body: string[] | undefined;
  for (const line of markdown.split('\n')) {
    if (body) {
      if (line === '```') {
        fences.push(body);
        body = undefined;
      } else {
        body.push(line);
      }
    } else if (line === '```' + CHROMATIC_PALETTE_FENCE_LANGUAGE) {
      body = [];
    }
  }
  expect(body).toBeUndefined();
  return fences;
}

describe.each(PALETTE_PROMPTS)('Chromatic Palettes prompt %s', (promptPath) => {
  const fences = paletteFences(fs.readFileSync(path.join(PROMPT_ROOT, promptPath), 'utf8'));

  it('teaches both palette kinds', () => {
    const kinds = fences.map((fence) => fence[1]);
    expect(kinds).toContain('kind: literal');
    expect(kinds).toContain('kind: evocative');
  });

  it.each(fences.map((fence) => [fence[0], fence] as const))('example "%s" follows the fence grammar exactly', (_title, fence) => {
    const [title, kind, note, ...swatches] = fence;
    expect(title).toMatch(/^title: \S.*$/);
    expect(kind).toMatch(/^kind: (literal|evocative)$/);
    expect(note).toMatch(/^note: [^.!?]+[.!?]$/);
    expect(swatches.length).toBeGreaterThanOrEqual(3);
    expect(swatches.length).toBeLessThanOrEqual(6);
    expect(swatches.length).toBeLessThanOrEqual(CHROMATIC_PALETTE_LIMITS.maxSwatchesPerPalette);

    const names = swatches.map((line) => {
      const match = SWATCH_LINE.exec(line);
      expect(match).not.toBeNull();
      const [, name, , definition] = match!;
      expect(name).toBe(name.trim());
      expect(name.length).toBeLessThanOrEqual(CHROMATIC_PALETTE_LIMITS.maxNameLength);
      expect(name).not.toMatch(/^(#|rgb\()/i);
      expect(definition).toBe(definition.trim());
      expect(definition.length).toBeLessThanOrEqual(CHROMATIC_PALETTE_LIMITS.maxDefinitionLength);
      expect(definition.split(/\s+/).length).toBeLessThanOrEqual(MAX_DEFINITION_WORDS);
      expect(definition).not.toMatch(/^a colou?r that/i);
      expect(definition).not.toMatch(/#[0-9A-Fa-f]{3,6}|rgb\(/i);
      return name.toLowerCase();
    });
    expect(new Set(names).size).toBe(names.length);
  });
});
