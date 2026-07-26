/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopChooseHostModal } from '@components/workshop/WorkshopChooseHostModal';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';

describe('WorkshopChooseHostModal', () => {
  const renderModal = (overrides: Partial<React.ComponentProps<typeof WorkshopChooseHostModal>> = {}) => {
    const onChooseHost = jest.fn();
    const onClose = jest.fn();
    render(
      <WorkshopChooseHostModal
        open
        activePersonaId="jill"
        onClose={onClose}
        onChooseHost={onChooseHost}
        {...overrides}
      />
    );
    return { onChooseHost, onClose };
  };

  it('renders every persona and pre-selects the current host tagged Current', () => {
    renderModal();

    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      expect(screen.getByText(persona.description)).not.toBeNull();
    }
    const current = screen.getByRole('button', { name: /^Jill/ });
    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(current.textContent).toContain('Current');
    expect(screen.getByRole('button', { name: /Keep Jill/ })).not.toBeNull();
  });

  it('selects locally and commits only from the footer action', () => {
    const { onChooseHost } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Wren/ }));
    // Card click is selection, not commitment.
    expect(onChooseHost).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Wren/ }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /Choose Wren/ }));
    expect(onChooseHost).toHaveBeenCalledWith('wren');
  });

  it('Keep <Current> closes without posting a selection', () => {
    const { onChooseHost, onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Keep Jill/ }));
    expect(onChooseHost).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape reverts to the current host by closing without a commit', () => {
    const { onChooseHost, onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Wren/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onChooseHost).not.toHaveBeenCalled();
  });

  it('points at More info in the header and opens the schematic without selecting', () => {
    const onMoreInfo = jest.fn();
    const { onChooseHost } = renderModal({ onMoreInfo });

    expect(screen.getByText(/opens their full persona/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More info about Wren' }));
    expect(onMoreInfo).toHaveBeenCalledWith('wren');
    expect(onChooseHost).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Jill/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('disables commitment while the room is locked', () => {
    const { onChooseHost } = renderModal({ disabled: true });

    fireEvent.click(screen.getByRole('button', { name: /Keep Jill/ }));
    expect(onChooseHost).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Keep Jill/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
