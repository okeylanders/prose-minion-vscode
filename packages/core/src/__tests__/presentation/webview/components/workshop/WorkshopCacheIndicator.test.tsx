/** @jest-environment jsdom */
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { WorkshopCacheIndicator } from '@components/workshop/WorkshopCacheIndicator';

describe('Workshop cache estimate', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); });
  afterEach(() => { cleanup(); jest.useRealTimers(); });

  it('counts down by wall-clock time and marks the estimated window elapsed', () => {
    render(<WorkshopCacheIndicator recipientLabel="Jill" estimatedExpiresAt={300_000} />);
    expect(screen.getByText('Est. Cache Time Remaining: 5 min')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(240_000); });
    expect(screen.getByText('Est. Cache Time Remaining: 1 min')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('Est. Cache Time Remaining: <1 min')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(59_000); });
    const elapsed = screen.getByText('Est. Cache Time Remaining: window elapsed');
    expect(elapsed.title).toContain('OpenRouter does not report an expiry');
  });

  it('uses the newly selected participant window and removes unknown estimates', () => {
    const { rerender } = render(<WorkshopCacheIndicator recipientLabel="Jill" estimatedExpiresAt={300_000} />);
    rerender(<WorkshopCacheIndicator recipientLabel="Marcus" estimatedExpiresAt={3_600_000} />);
    expect(screen.getByText('Est. Cache Time Remaining: 60 min').title).toContain('Marcus');
    rerender(<WorkshopCacheIndicator recipientLabel="Muse" />);
    expect(screen.queryByText(/Est. Cache Time Remaining/)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    'meta/muse-spark-1.1', 'meta/muse-spark-1.2', 'meta/muse-spark-1.3',
    'meta/muse-wonder', '~meta/muse-wonder:nitro'
  ])('shows the Meta disclaimer below the estimated countdown for %s', cacheRequestModelId => {
    render(<WorkshopCacheIndicator recipientLabel="Jill" cacheRequestModelId={cacheRequestModelId}
      estimatedExpiresAt={300_000} />);
    const countdown = screen.getByText('Est. Cache Time Remaining: 5 min');
    const disclaimer = screen.getByText('Meta does not guarantee the cache window.');
    expect(countdown.nextElementSibling).toBe(disclaimer);
    expect(countdown.title).toContain('Meta may evict cached content earlier');
    expect(countdown.title).toContain('assumes the prompt was cached');
    expect(countdown.title).not.toContain('confirmed cache activity');
    act(() => { jest.advanceTimersByTime(300_000); });
    expect(screen.getByText('Est. Cache Time Remaining: window elapsed')).toBeTruthy();
    expect(disclaimer.textContent).toBe('Meta does not guarantee the cache window.');
  });

  it('removes the Meta note when estimates disappear or the model changes', () => {
    const { rerender } = render(<WorkshopCacheIndicator recipientLabel="Jill"
      cacheRequestModelId="meta/muse-wonder" estimatedExpiresAt={300_000} />);
    rerender(<WorkshopCacheIndicator recipientLabel="Jill" cacheRequestModelId="meta/muse-wonder" />);
    expect(screen.queryByText(/Meta does not guarantee/)).toBeNull();
    expect(screen.queryByText(/Est. Cache Time Remaining/)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    rerender(<WorkshopCacheIndicator recipientLabel="Jill" cacheRequestModelId="anthropic/claude-sonnet-5"
      estimatedExpiresAt={300_000} />);
    expect(screen.getByText('Est. Cache Time Remaining: 5 min')).toBeTruthy();
    expect(screen.queryByText(/Meta does not guarantee/)).toBeNull();
  });
});
