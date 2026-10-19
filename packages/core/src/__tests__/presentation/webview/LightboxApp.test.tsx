/** @jest-environment jsdom */

/**
 * The `lightbox` surface's placeholder root (Lightbox Slice 1): it renders on
 * the shared full-tab frame and says plainly that the board is not here yet.
 * Slice 2A replaces the body with the board.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

describe('LightboxApp (placeholder)', () => {
  it('renders the Lightbox brand on the shared full-tab frame', () => {
    const { container } = render(<LightboxApp />);

    expect(screen.getByRole('heading', { name: 'Lightbox' })).not.toBeNull();
    expect(screen.getByText('Prose Minion · Inspiration & Mood Board')).not.toBeNull();
    expect(screen.getByLabelText('Board rail').className).toBe('pm-ws-rail');
    expect(screen.getByLabelText('Board').textContent)
      .toBe('The Lightbox board arrives in a later update.');
    expect(container.firstElementChild?.className).toBe('pm-ws');
  });
});
