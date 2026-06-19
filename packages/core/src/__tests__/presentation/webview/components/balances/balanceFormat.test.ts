/**
 * balanceFormat tests — the pill/strip headline derivation + USD formatting.
 *
 * `openRouterHeadline` is the single source of truth for the prominent number
 * and its tone; it has six decision points (null/loading, no_key, unavailable,
 * credits, the key-limit fallback, and the all-absent floor). This pins each so
 * a future edit that collapses a branch (or drops the `limit === 0` / negative
 * guards) fails loudly. Pure functions — no React render needed.
 */

import { fmtUsd, fmtUsdPrecise, openRouterHeadline } from '@components/balances/balanceFormat';
import type { OpenRouterBalance } from '@messages';

const balance = (over: Partial<OpenRouterBalance>): OpenRouterBalance => ({
  status: 'ok',
  creditsStatus: 'ok',
  ...over
});

describe('fmtUsd / fmtUsdPrecise', () => {
  it('formats positive dollars at 2dp', () => {
    expect(fmtUsd(12.4)).toBe('$12.40');
    expect(fmtUsd(0)).toBe('$0.00');
  });

  it('puts the sign OUTSIDE the dollar mark for a negative (overdrawn) balance', () => {
    expect(fmtUsd(-0.5)).toBe('-$0.50');
    expect(fmtUsd(-5)).toBe('-$5.00');
  });

  it('fmtUsdPrecise keeps sub-cent precision for tiny per-request costs', () => {
    expect(fmtUsdPrecise(0.014)).toBe('$0.014');
    expect(fmtUsdPrecise(0)).toBe('$0.000');
  });
});

describe('openRouterHeadline', () => {
  it('shows a loading ellipsis vs an em dash when there is no balance yet', () => {
    expect(openRouterHeadline(null, true)).toEqual({ text: '…', tone: 'muted' });
    expect(openRouterHeadline(null, false)).toEqual({ text: '—', tone: 'muted' });
  });

  it('reports no_key and unavailable as muted', () => {
    expect(openRouterHeadline(balance({ status: 'no_key', creditsStatus: 'no_key' }), false))
      .toEqual({ text: 'no key', tone: 'muted' });
    expect(openRouterHeadline(balance({ status: 'unavailable', creditsStatus: 'unavailable' }), false))
      .toEqual({ text: '—', tone: 'muted' });
  });

  it('favors the account balance (credits.remaining) as the headline', () => {
    const b = balance({ credits: { totalCredits: 20, totalUsage: 7.6, remaining: 12.4 } });
    expect(openRouterHeadline(b, false)).toEqual({ text: '$12.40', tone: 'normal' });
  });

  it('marks a zero credits balance with the zero tone', () => {
    const b = balance({ credits: { totalCredits: 10, totalUsage: 10, remaining: 0 } });
    expect(openRouterHeadline(b, false)).toEqual({ text: '$0.00', tone: 'zero' });
  });

  it('marks an overdrawn (negative) credits balance with the zero tone and signed format', () => {
    const b = balance({ credits: { totalCredits: 5, totalUsage: 5.5, remaining: -0.5 } });
    expect(openRouterHeadline(b, false)).toEqual({ text: '-$0.50', tone: 'zero' });
  });

  it('falls back to the enforced key-limit remaining when /credits is unreadable', () => {
    const b = balance({
      creditsStatus: 'unavailable',
      keyLimit: { limit: 100, limitRemaining: 40, resetWindow: 'weekly' }
    });
    expect(openRouterHeadline(b, false)).toEqual({ text: '$40.00', tone: 'normal' });
  });

  it('shows $0.00 / zero tone for a key with a zero spend limit (no headroom)', () => {
    const b = balance({
      creditsStatus: 'unavailable',
      keyLimit: { limit: 0, limitRemaining: 0, resetWindow: 'unknown' }
    });
    expect(openRouterHeadline(b, false)).toEqual({ text: '$0.00', tone: 'zero' });
  });

  it('falls through to a muted em dash when neither credits nor an enforced limit is present', () => {
    const b = balance({
      creditsStatus: 'unavailable',
      keyLimit: { limit: null, limitRemaining: null, resetWindow: 'unknown' }
    });
    expect(openRouterHeadline(b, false)).toEqual({ text: '—', tone: 'muted' });
  });
});
