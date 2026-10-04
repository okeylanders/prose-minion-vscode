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
});
