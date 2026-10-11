/**
 * @jest-environment jsdom
 *
 * The opt-in `fencedBlocks` path of MarkdownRenderer, against the REAL marked
 * (jest maps `marked` to its UMD build). The sibling MarkdownRenderer.test.tsx
 * mocks marked and covers the sanitizer; it must keep passing unmodified.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { marked } from 'marked';
import { CHROMATIC_PALETTE_FENCE_LANGUAGE } from '@shared/constants/chromaticPalettes';
import {
  MarkdownFencedBlocks,
  MarkdownRenderer,
  sanitizeMarkdownHtml
} from '@components/shared/MarkdownRenderer';
import { DICTIONARY_FENCED_BLOCKS } from '@components/dictionary/ChromaticPaletteBlock';

const fence = (language: string, body: string): string => ['```' + language, body, '```'].join('\n');

const WARM_COPPER_FENCE = fence('pm-palette', [
  'title: Warm Copper',
  'kind: literal',
  'note: Polished, metallic warmth.',
  'Copper | #B87333 | the reddish-orange of the bare metal, freshly polished',
  'Bronze | #CD7F32 | the warmer, yellower brown of copper alloyed with tin'
].join('\n'));

const ENTRY = [
  '# 🧠 AI Advisory Notes',
  '',
  'Copper reads **warm**.',
  '',
  '# 🎨 Chromatic Palettes',
  '',
  WARM_COPPER_FENCE,
  '',
  'Use these for *lamp-lit* scenes.'
].join('\n');

/** Today's single-pass output for `content`, normalized through the DOM serializer. */
const singlePassHtml = (content: string): string => {
  marked.setOptions({ breaks: true, gfm: true });
  const scratch = document.createElement('div');
  scratch.innerHTML = sanitizeMarkdownHtml(marked(content) as string);
  return scratch.innerHTML;
};

const markdownRoots = (container: HTMLElement): NodeListOf<Element> =>
  container.querySelectorAll('.markdown-content');

describe('MarkdownRenderer fenced blocks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('without a registered fence, rendering is unchanged', () => {
    it('matches the single-pass output when the prop is absent', () => {
      const { container } = render(<MarkdownRenderer content={ENTRY} />);

      expect(container.innerHTML).toBe(`<div class="markdown-content ">${singlePassHtml(ENTRY)}</div>`);
      expect(container.querySelector('.pm-palette')).toBeNull();
      expect(container.querySelector('pre code.language-pm-palette')).not.toBeNull();
    });

    it('matches the single-pass output byte for byte when no registered fence is present', () => {
      const content = ['# Title', '', fence('js', 'const copper = "#B87333";'), '', 'Prose.'].join('\n');
      const without = render(<MarkdownRenderer content={content} className="x" />).container.innerHTML;
      const withProp = render(
        <MarkdownRenderer content={content} className="x" fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      ).container.innerHTML;

      expect(withProp).toBe(without);
      expect(withProp).not.toContain('markdown-content-run');
    });

    it('does not parse runs separately until a registered fence actually renders', () => {
      const parserSpy = jest.spyOn(marked, 'parser');
      const prose = ['# Title', '', fence('js', 'const copper = 1;'), '', fence('pm-palette', 'title: Not yet')].join('\n');

      render(<MarkdownRenderer content={prose} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      expect(parserSpy).not.toHaveBeenCalled();

      render(<MarkdownRenderer content={ENTRY} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      expect(parserSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('with the Dictionary registry', () => {
    it('renders a palette fence as the palette component between sanitized Markdown runs', () => {
      const { container } = render(
        <MarkdownRenderer content={ENTRY} className="dictionary" fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );

      expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
      expect(screen.getAllByRole('listitem').map(item => item.querySelector('.pm-palette-swatch-name')?.textContent))
        .toEqual(['Copper', 'Bronze']);
      expect(container.querySelector('pre')).toBeNull();

      const runs = container.querySelectorAll('.markdown-content-run');
      expect(runs).toHaveLength(2);
      expect(runs[0].querySelector('h1')?.textContent).toBe('🧠 AI Advisory Notes');
      expect(runs[0].querySelector('strong')?.textContent).toBe('warm');
      expect(runs[1].querySelector('em')?.textContent).toBe('lamp-lit');
    });

    it('keeps a single .markdown-content root with the caller className', () => {
      const { container } = render(
        <MarkdownRenderer content={ENTRY} className="dictionary" fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );

      expect(markdownRoots(container)).toHaveLength(1);
      expect(container.firstElementChild?.className).toBe('markdown-content dictionary');
      expect(container.firstElementChild?.querySelector('.pm-palette')).not.toBeNull();
    });

    it('preserves document order across runs and fenced blocks', () => {
      const { container } = render(<MarkdownRenderer content={ENTRY} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      const order = Array.from(container.firstElementChild?.children ?? []).map(child => child.className);

      expect(order).toEqual(['markdown-content-run', 'pm-palette', 'markdown-content-run']);
    });

    it('leaves other fences as ordinary code blocks', () => {
      const content = [fence('js', 'const copper = 1;'), '', WARM_COPPER_FENCE].join('\n');
      const { container } = render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(container.querySelector('pre code.language-js')?.textContent?.trim()).toBe('const copper = 1;');
      expect(container.querySelectorAll('.pm-palette')).toHaveLength(1);
    });

    it('falls back to a code block when a palette fence has no valid swatch', () => {
      const content = [
        WARM_COPPER_FENCE,
        '',
        fence('pm-palette', 'title: Unnamed\n#B87333 | #B87333\nRust | rgb(183, 65, 14)')
      ].join('\n');
      const { container } = render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(container.querySelectorAll('.pm-palette')).toHaveLength(1);
      const fallback = container.querySelector('pre code.language-pm-palette');
      expect(fallback?.textContent).toContain('title: Unnamed');
    });

    it('renders every palette when a lookup returns several', () => {
      const evocative = fence('pm-palette', 'title: Hearth\nkind: evocative\nEmber | #E25822 | a coal at its brightest');
      const { container } = render(
        <MarkdownRenderer content={[WARM_COPPER_FENCE, '', evocative].join('\n')} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );

      expect(screen.getAllByRole('figure')).toHaveLength(2);
      expect(screen.getByRole('figure', { name: 'Hearth' })).toBeTruthy();
      expect(container.querySelectorAll('.markdown-content-run')).toHaveLength(0);
    });

    it('matches the fence language on the first word of the info string', () => {
      const content = fence('pm-palette wide', 'Copper | #B87333 | bare metal');
      render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getByRole('figure', { name: 'Palette' })).toBeTruthy();
    });

    it('leaves fences nested in blockquotes and lists as code blocks', () => {
      const content = [
        '> ' + fence('pm-palette', 'Copper | #B87333').split('\n').join('\n> '),
        '',
        '- item',
        '',
        '  ' + fence('pm-palette', 'Bronze | #CD7F32').split('\n').join('\n  ')
      ].join('\n');
      const { container } = render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(container.querySelector('.pm-palette')).toBeNull();
      expect(container.querySelector('blockquote pre code.language-pm-palette')).not.toBeNull();
      expect(container.querySelector('li pre code.language-pm-palette')).not.toBeNull();
    });

    it('resolves reference-style links in every run', () => {
      const content = [
        'See [the copper entry][copper] first.',
        '',
        WARM_COPPER_FENCE,
        '',
        'Then [the copper entry again][copper].',
        '',
        '[copper]: https://example.com/copper'
      ].join('\n');
      const { container } = render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      const links = Array.from(container.querySelectorAll('a'));

      expect(container.querySelector('.pm-palette')).not.toBeNull();
      expect(links.map(link => link.getAttribute('href'))).toEqual([
        'https://example.com/copper',
        'https://example.com/copper'
      ]);
    });
  });

  describe('safety', () => {
    const INJECTION_ATTEMPT = [
      '<p style="background:url(https://attacker.example/html)">Inline HTML</p>',
      '',
      fence('pm-palette', [
        'title: Injection Attempt',
        'Copper | #B87333; background:url(https://attacker.example/a) | injected declaration',
        'Beacon | url(https://attacker.example/b) | bare url value',
        'Old IE | expression(alert(1)) | expression value',
        'Keyword | red | keyword value',
        '<img src=x onerror=alert(1)> | #123456 | <script>window.__pwned = true</script>',
        'Rust | #B7410E | the orange-brown of oxidized iron'
      ].join('\n'))
    ].join('\n');

    it('writes nothing but a validated background-color into any style attribute', () => {
      const { container } = render(
        <MarkdownRenderer content={INJECTION_ATTEMPT} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );
      const styled = Array.from(container.querySelectorAll<HTMLElement>('[style]'));

      expect(screen.getByRole('figure', { name: 'Injection Attempt' })).toBeTruthy();
      expect(styled.length).toBeGreaterThan(0);
      for (const element of styled) {
        expect(Array.from(element.style)).toEqual(['background-color']);
        expect(element.getAttribute('style')).toMatch(/^background-color: rgb\(\d{1,3}, \d{1,3}, \d{1,3}\);?$/);
      }
    });

    it('produces no url( anywhere in the DOM and no executable markup', () => {
      const { container } = render(
        <MarkdownRenderer content={INJECTION_ATTEMPT} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );

      expect(container.innerHTML).not.toContain('url(');
      expect(container.innerHTML).not.toContain('attacker.example');
      expect(container.querySelector('script, img')).toBeNull();
      expect(screen.getAllByRole('listitem').map(item => item.querySelector('.pm-palette-swatch-name')?.textContent))
        .toEqual(['<img src=x onerror=alert(1)>', 'Rust']);
    });

    it('never reaches Object.prototype for an unregistered fence language', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { container } = render(
        <MarkdownRenderer content={fence('constructor', 'Copper | #B87333')} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );

      expect(container.querySelector('pre code.language-constructor')).not.toBeNull();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('falls back to the single-pass path when a fenced-block renderer throws', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const throwing: MarkdownFencedBlocks = {
        [CHROMATIC_PALETTE_FENCE_LANGUAGE]: {
          render: () => {
            throw new Error('renderer exploded');
          }
        }
      };
      const { container } = render(<MarkdownRenderer content={ENTRY} fencedBlocks={throwing} />);

      expect(container.innerHTML).toBe(`<div class="markdown-content ">${singlePassHtml(ENTRY)}</div>`);
      expect(errorSpy).toHaveBeenCalledWith('Error rendering fenced Markdown blocks:', expect.any(Error));
    });
  });

  describe('streaming', () => {
    it('renders the valid lines of an unterminated fence without throwing', () => {
      const partial = [
        '# 🎨 Chromatic Palettes',
        '',
        '```pm-palette',
        'title: Warm Copper',
        'Copper | #B87333 | the reddish-orange of the bare metal',
        'Bronze | #CD7'
      ].join('\n');

      expect(() => render(<MarkdownRenderer content={partial} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />)).not.toThrow();
      expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.queryByText('Bronze')).toBeNull();
    });

    it('grows from code block to palette and back as content changes, leaving no stale markup', () => {
      const heading = '# 🎨 Chromatic Palettes\n\n';
      const { container, rerender } = render(
        <MarkdownRenderer content={`${heading}\`\`\`pm`} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />
      );
      expect(container.querySelector('pre')).not.toBeNull();

      rerender(<MarkdownRenderer content={`${heading}\`\`\`pm-palette\ntitle: Warm`} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      expect(container.querySelector('pre code.language-pm-palette')).not.toBeNull();
      expect(container.querySelector('.pm-palette')).toBeNull();

      rerender(
        <MarkdownRenderer
          content={`${heading}\`\`\`pm-palette\ntitle: Warm Copper\nCopper | #B87333 | the reddi`}
          fencedBlocks={DICTIONARY_FENCED_BLOCKS}
        />
      );
      expect(container.querySelector('pre')).toBeNull();
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      expect(markdownRoots(container)).toHaveLength(1);
      expect(container.querySelector('.pm-palette-swatch-definition')?.textContent).toBe('the reddi');

      rerender(<MarkdownRenderer content={`${heading}Plain prose now.`} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);
      expect(container.querySelector('.pm-palette')).toBeNull();
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      expect(container.innerHTML).toBe(
        `<div class="markdown-content ">${singlePassHtml(`${heading}Plain prose now.`)}</div>`
      );
    });
  });

  // PR #142 review F-01: an unclosed registered fence must not hide the
  // section after it (the Standard lookup writes every section in one reply).
  describe('unclosed fences', () => {
    const unclosedPalette = [
      '# 🎨 Chromatic Palettes',
      '',
      '```pm-palette',
      'title: Warm Copper',
      'kind: literal',
      'Copper | #B87333 | the reddish-orange of the bare metal'
    ].join('\n');

    it('ends the palette at the next heading and renders that section as Markdown', () => {
      const content = `${unclosedPalette}\n\n# 📂 Topic & Related Lexicon\n\nThe whole appendix stays visible.`;

      render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '📂 Topic & Related Lexicon' })).toBeTruthy();
      expect(screen.getByText('The whole appendix stays visible.')).toBeTruthy();
      expect(document.querySelector('pre')).toBeNull();
    });

    it('renders a second palette whose opener appears inside an unclosed first one (its closer ends the first fence)', () => {
      const content = `${unclosedPalette}\n\`\`\`pm-palette\ntitle: Aged Copper\nVerdigris | #43B3AE | the blue-green crust on weathered copper\n\`\`\``;

      render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
      expect(screen.getByRole('figure', { name: 'Aged Copper' })).toBeTruthy();
    });

    it('keeps a half-arrived swatch name in the palette instead of flashing it as prose', () => {
      render(<MarkdownRenderer content={`${unclosedPalette}\nBronz`} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.queryByText('Bronz')).toBeNull();
    });

    it('keeps an unclosed fence that opens with a heading as readable code', () => {
      const content = '```pm-palette\n# Not a palette\nCopper | #B87333 | polished';

      render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(document.querySelector('.pm-palette')).toBeNull();
      expect(document.querySelector('pre code')?.textContent).toContain('# Not a palette');
    });

    it('splits a closed fence at a stray heading too, keeping what follows visible', () => {
      const content = fence('pm-palette', 'title: Warm Copper\nCopper | #B87333 | polished\n# Stray heading\nTrailing prose.');

      render(<MarkdownRenderer content={content} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Stray heading' })).toBeTruthy();
      expect(screen.getByText('Trailing prose.')).toBeTruthy();
    });
  });
});
