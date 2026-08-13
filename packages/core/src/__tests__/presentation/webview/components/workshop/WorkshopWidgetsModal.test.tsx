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
    const props = {
      open: true,
      onClose: jest.fn(),
      onLaunchWidget: jest.fn(),
      onAskAgentToConfigure: jest.fn()
    };
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
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sprint 02B').length).toBeGreaterThan(0);
    expect(document.querySelector('.pm-ws-browser-modal')?.className)
      .toContain('pm-ws-modal-sheet');
  });

  it('launches the live widget when selected', () => {
    const { onLaunchWidget } = renderModal();
    fireEvent.click(screen.getAllByRole('button', { name: /Gesture Playground/ })[0]);
    const launch = screen.getByRole('button', { name: 'Open widget' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);
    expect(onLaunchWidget).toHaveBeenCalledWith('gesture-playground');
  });

  it('launches Lexical Gravity from the standing section', () => {
    const { onLaunchWidget } = renderModal();
    fireEvent.click(screen.getAllByRole('button', { name: /Lexical Gravity/ })[0]);
    const launch = screen.getByRole('button', { name: 'Open widget' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);
    expect(onLaunchWidget).toHaveBeenCalledWith('lexical-gravity');
  });

  it('hands the selected live widget to the agent-configure boundary', () => {
    const { onAskAgentToConfigure } = renderModal();
    fireEvent.click(screen.getAllByRole('button', { name: /Lexical Gravity/ })[0]);
    const ask = screen.getByRole('button', {
      name: 'Ask agent to configure, then open'
    }) as HTMLButtonElement;
    expect(ask.disabled).toBe(false);
    fireEvent.click(ask);
    expect(onAskAgentToConfigure).toHaveBeenCalledWith('lexical-gravity');
  });

  it('opens Creative Variations while honestly withholding Host preparation', () => {
    const { onLaunchWidget, onAskAgentToConfigure } = renderModal();
    fireEvent.click(
      screen.getAllByRole('button', { name: /Creative Variations Explorer/ })[0]
    );

    const launch = screen.getByRole('button', { name: 'Open widget' }) as HTMLButtonElement;
    const ask = screen.getByRole('button', {
      name: 'Ask agent to configure, then open'
    }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
    expect(ask.disabled).toBe(true);
    expect(ask.title).toBe('This widget does not yet support Host preparation.');

    fireEvent.click(launch);
    fireEvent.click(ask);
    expect(onLaunchWidget).toHaveBeenCalledWith('creative-variations');
    expect(onAskAgentToConfigure).not.toHaveBeenCalled();
  });

  it('closes via Cancel without launching anything', () => {
    const { onClose, onLaunchWidget, onAskAgentToConfigure } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onLaunchWidget).not.toHaveBeenCalled();
    expect(onAskAgentToConfigure).not.toHaveBeenCalled();
  });
});
