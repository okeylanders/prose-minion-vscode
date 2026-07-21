/**
 * @jest-environment jsdom
 */

/**
 * Render smoke test for the persona schematic (State B). Proves the modal
 * mounts a real persona's data end-to-end — the ported SVG/CSS-var JSX renders
 * without throwing, authored content reaches the DOM, and "Back to personas"
 * returns to State A.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopPersonaSchematicModal } from '@components/workshop/schematic/WorkshopPersonaSchematicModal';

describe('WorkshopPersonaSchematicModal', () => {
  it('renders a persona schematic with its authored content', () => {
    render(<WorkshopPersonaSchematicModal personaId="margot" onBack={jest.fn()} />);

    // Identity title + read-only tag (getBy* throws if absent).
    expect(screen.getByText('MARGOT')).toBeTruthy();
    expect(screen.getByText(/read-only/i)).toBeTruthy();

    // A trait-tension title (panel 02) and a signature-floor item (panel 09).
    expect(screen.getByText('Contract precision, overenforced')).toBeTruthy();
    expect(screen.getByText('play back the exact word where the speaker changes')).toBeTruthy();

    // Hub navigation nodes are wired to their category panels.
    expect(screen.getByLabelText('Open Trait tensions')).toBeTruthy();

    // The header edit affordance is present but disabled (config utility not yet built).
    const editButton = screen.getByRole('button', { name: /Edit persona/i }) as HTMLButtonElement;
    expect(editButton.disabled).toBe(true);
  });

  it('returns to the persona browser via "Back to personas"', () => {
    const onBack = jest.fn();
    render(<WorkshopPersonaSchematicModal personaId="penny" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to personas' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed (personaId null)', () => {
    render(<WorkshopPersonaSchematicModal personaId={null} onBack={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Back to personas' })).toBeNull();
  });
});
