/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopWidgetsModal } from '@components/workshop/WorkshopWidgetsModal';
import { WORKSHOP_WIDGET_GROUPS } from '@components/workshop/workshopWidgetIcons';

describe('WorkshopWidgetsModal (live registry, ADR 2026-07-22)', () => {
  afterEach(cleanup);

  const renderModal = () => {
    const props = { open: true, onClose: jest.fn(), onLaunchWidget: jest.fn() };
    render(<WorkshopWidgetsModal {...props} />);
    return props;
  };

  it('renders the full registry from the shared catalog', () => {
    renderModal();
    for (const group of WORKSHOP_WIDGET_GROUPS) {
      expect(screen.getByText(group.name)).toBeTruthy();
    }
    const cardCount = WORKSHOP_WIDGET_GROUPS.reduce((n, group) => n + group.items.length, 0);
    expect(document.querySelectorAll('.pm-ws-sb-card')).toHaveLength(cardCount);
    expect(document.querySelector('.pm-ws-browser-modal')?.className)
      .toContain('pm-ws-modal-sheet');
  });

  it('launches the live widget when selected', () => {
    const { onLaunchWidget } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Gesture Playground/ }));
    const launch = screen.getByRole('button', { name: 'Open Gesture Playground' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);
    expect(onLaunchWidget).toHaveBeenCalledWith('gesture-playground');
  });

  it('launches Lexical Gravity from the standing section', () => {
    const { onLaunchWidget } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Lexical Gravity/ }));
    const launch = screen.getByRole('button', { name: 'Open Lexical Gravity' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);
    expect(onLaunchWidget).toHaveBeenCalledWith('lexical-gravity');
  });

  it('closes via Cancel without launching anything', () => {
    const { onClose, onLaunchWidget } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLaunchWidget).not.toHaveBeenCalled();
  });
});
