/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopPersonaBrowserModal } from '@components/workshop/WorkshopPersonaBrowserModal';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';

describe('WorkshopPersonaBrowserModal', () => {
  const testHarness = ({ disabled = false, onSelect = jest.fn() }: { disabled?: boolean; onSelect?: jest.Mock }) => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Choose writing partner</button>
        <WorkshopPersonaBrowserModal
          open={open}
          activePersonaId="jill"
          disabled={disabled}
          onClose={() => setOpen(false)}
          onSelect={(personaId) => {
            onSelect(personaId);
            setOpen(false);
          }}
        />
      </>
    );
  };

  it('renders each deterministic host with a name, specialty, and description', () => {
    render(React.createElement(testHarness));
    fireEvent.click(screen.getByRole('button', { name: 'Choose writing partner' }));

    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      expect(screen.getByRole('button', { name: new RegExp(persona.label) }).textContent).toContain(persona.specialty);
      expect(screen.getByText(persona.description)).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: /Jill/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('selects a persona and returns focus to the opening trigger', () => {
    const onSelect = jest.fn();
    render(React.createElement(testHarness, { onSelect }));
    const trigger = screen.getByRole('button', { name: 'Choose writing partner' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Wren/ }));

    expect(onSelect).toHaveBeenCalledWith('wren');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('dismisses on Escape and disables cards when selection is locked', () => {
    render(React.createElement(testHarness, { disabled: true }));
    const trigger = screen.getByRole('button', { name: 'Choose writing partner' });
    trigger.focus();
    fireEvent.click(trigger);
    expect((screen.getByRole('button', { name: /Quinn/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports an explicit guest invitation mode without changing the host', () => {
    const onInvite = jest.fn();
    render(
      <WorkshopPersonaBrowserModal
        open
        activePersonaId="jill"
        mode="guest"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        onInvite={onInvite}
      />
    );

    expect(screen.getByText('Invite another lens')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Margot/ }));
    expect(onInvite).toHaveBeenCalledWith('margot');
  });
});
