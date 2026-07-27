/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopWidgetsModal } from '@components/workshop/WorkshopWidgetsModal';
import { WORKSHOP_WIDGET_GROUPS } from '@components/workshop/workshopWidgets';

describe('WorkshopWidgetsModal (coming-soon preview)', () => {
  afterEach(cleanup);

  const renderModal = () => {
    const props = { open: true, onClose: jest.fn() };
    render(<WorkshopWidgetsModal {...props} />);
    return props;
  };

  it('renders the full preview registry', () => {
    renderModal();
    for (const group of WORKSHOP_WIDGET_GROUPS) {
      expect(screen.getByText(group.name)).toBeTruthy();
    }
    const cardCount = WORKSHOP_WIDGET_GROUPS.reduce((n, group) => n + group.items.length, 0);
    expect(document.querySelectorAll('.pm-ws-sb-card')).toHaveLength(cardCount);
    expect(screen.getByText(/A preview of what’s coming soon/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-browser-modal')?.className)
      .toContain('pm-ws-modal-sheet');
  });

  it('keeps the primary action "Coming soon" and disabled even with a selection', () => {
    renderModal();
    const launch = screen.getByRole('button', { name: 'Coming soon' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Gesture Playground/ }));
    // Selection surfaces in the footer summary, but nothing becomes launchable.
    expect(launch.disabled).toBe(true);
    expect(launch.textContent).toBe('Coming soon');
  });

  it('closes via Cancel without launching anything', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
