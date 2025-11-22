/**
 * Tests for formatter helper functions
 */

import { formatGap, escapePipes, buildMetricsLegend } from '@formatters/helpers';

describe('formatGap', () => {
  it('formats finite numbers correctly', () => {
    expect(formatGap(5.2)).toBe('5.2 words');
    expect(formatGap(1.0)).toBe('1.0 word');
    expect(formatGap(0.5)).toBe('0.5 words');
  });

  it('handles singular "word" for 1.0', () => {
    expect(formatGap(1.0)).toBe('1.0 word');
  });

  it('handles edge cases', () => {
    expect(formatGap(null)).toBe('—');
    expect(formatGap(undefined)).toBe('—');
    expect(formatGap(NaN)).toBe('—');
    expect(formatGap(Infinity)).toBe('—');
    expect(formatGap(-Infinity)).toBe('—');
  });

  it('handles zero', () => {
    expect(formatGap(0)).toBe('0.0 words');
  });

  it('handles negative numbers', () => {
    expect(formatGap(-5.2)).toBe('-5.2 words');
  });
});

describe('escapePipes', () => {
  it('escapes pipe characters for markdown tables', () => {
    expect(escapePipes('foo|bar')).toBe('foo\\|bar');
    expect(escapePipes('a|b|c')).toBe('a\\|b\\|c');
  });

  it('handles text without pipes', () => {
    expect(escapePipes('no pipes here')).toBe('no pipes here');
  });

  it('handles empty string', () => {
    expect(escapePipes('')).toBe('');
  });

  it('handles null/undefined as empty string', () => {
    expect(escapePipes(null as any)).toBe('');
    expect(escapePipes(undefined as any)).toBe('');
  });

  it('handles multiple consecutive pipes', () => {
    expect(escapePipes('a||b')).toBe('a\\|\\|b');
  });
});

describe('buildMetricsLegend', () => {
  it('returns a non-empty string', () => {
    const legend = buildMetricsLegend();
    expect(legend).toBeTruthy();
    expect(typeof legend).toBe('string');
    expect(legend.length).toBeGreaterThan(100);
  });

  it('contains expected section headers', () => {
    const legend = buildMetricsLegend();
    expect(legend).toContain('## 📖 Metrics Guide');
    expect(legend).toContain('### Legend');
    expect(legend).toContain('### 🌈 Vocabulary Diversity');
    expect(legend).toContain('### 🎨 Lexical Density');
  });

  it('contains key metric explanations', () => {
    const legend = buildMetricsLegend();
    expect(legend).toContain('Word Count');
    expect(legend).toContain('Type-Token Ratio');
    expect(legend).toContain('Readability Score');
  });

  it('contains formulas', () => {
    const legend = buildMetricsLegend();
    expect(legend).toContain('(Unique Words / Total Words) × 100');
    expect(legend).toContain('(Content Words / Total Words) × 100');
  });
});
