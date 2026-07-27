/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopToolsModal } from '@components/workshop/WorkshopToolsModal';

describe('WorkshopToolsModal (sheet browser)', () => {
  afterEach(cleanup);

  const renderModal = (
    overrides: Partial<React.ComponentProps<typeof WorkshopToolsModal>> = {}
  ) => {
    const props = {
      open: true,
      activeToolId: null,
      onClose: jest.fn(),
      onSelect: jest.fn(),
      ...overrides
    };
    render(<WorkshopToolsModal {...props} />);
    return props;
  };

  it('renders all 14 tools across the three groups', () => {
    renderModal();
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Craft & Voice')).toBeTruthy();
    expect(screen.getByText('Technical')).toBeTruthy();
    // 14 selectable cards + Cancel + launch + close = the card count is the contract.
    const cards = document.querySelectorAll('.pm-ws-sb-card');
    expect(cards).toHaveLength(14);
  });

  it('keeps launch disabled until a tool is selected, then launches exactly once', () => {
    const { onSelect } = renderModal();
    const launch = screen.getByRole('button', { name: 'Run a tool' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Dialogue & Beats/ }));
    const armed = screen.getByRole('button', { name: 'Run Dialogue & Beats' }) as HTMLButtonElement;
    expect(armed.disabled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(armed);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('dialogue');
  });

  it('deselects on a second click of the same card', () => {
    renderModal();
    const card = screen.getByRole('button', { name: /Dialogue & Beats/ });
    fireEvent.click(card);
    fireEvent.click(card);
    const launch = screen.getByRole('button', { name: 'Run a tool' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
  });

  it('seeds the selection from the active tool', () => {
    renderModal({ activeToolId: 'prose' });
    const launch = screen.getByRole('button', { name: 'Run Prose' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(false);
  });

  it('uses ask-flavored copy when routing via the persona', () => {
    renderModal({ requestViaPersona: true, personaLabel: 'Jill' });
    expect(screen.getByText('Ask Jill')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continuity/ }));
    expect(screen.getByRole('button', { name: 'Ask about Continuity' })).toBeTruthy();
  });

  it('hard-disables cards and launch when gated', () => {
    renderModal({ disabled: true });
    const card = screen.getByRole('button', { name: /Dialogue & Beats/ }) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    const launch = screen.getByRole('button', { name: 'Run a tool' }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
  });
});
