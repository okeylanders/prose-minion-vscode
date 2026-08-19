/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  CreativeVariationCard
} from '@components/workshop/widgets/creativeVariations/CreativeVariationCard';
import {
  cardOne,
  cardThree,
  cardTwo
} from './creativeVariationsFixtures';

const renderCard = (
  overrides: Partial<React.ComponentProps<typeof CreativeVariationCard>> = {}
) => {
  const props = {
    card: cardOne,
    selected: false,
    carryMode: 'direction' as const,
    comparing: false,
    interactionLocked: false,
    onToggleSelection: jest.fn(),
    onCarryModeChange: jest.fn(),
    onToggleCompare: jest.fn(),
    onCopyProse: jest.fn(),
    ...overrides
  };
  const view = render(<CreativeVariationCard {...props} />);
  return { props, view };
};

describe('CreativeVariationCard', () => {
  afterEach(cleanup);

  it('renders approach, prose, portable direction, and the gain/cost tradeoff', () => {
    renderCard();
    expect(screen.getByText('Baseline — the competent fix')).toBeTruthy();
    expect(screen.getByText(/not quite a smile/)).toBeTruthy();
    expect(screen.getByText('cut the told line, downgrade the smile — baseline')).toBeTruthy();
    expect(screen.getByText(/the obvious win — nothing else is risked/)).toBeTruthy();
    expect(screen.getByText(/nothing, which is the problem/)).toBeTruthy();
  });

  it('hides carry controls until the card is selected', () => {
    renderCard();
    expect(screen.queryByRole('group', { name: 'Carry mode for Take 1' })).toBeNull();
  });

  it('defaults carry to direction and promotes full prose per explicit press', () => {
    const { props } = renderCard({ selected: true });
    const group = screen.getByRole('group', { name: 'Carry mode for Take 1' });
    const pressed = group.querySelector('button[aria-pressed="true"]');
    expect(pressed?.textContent).toContain('direction · default');
    fireEvent.click(screen.getByRole('button', { name: 'full prose' }));
    expect(props.onCarryModeChange).toHaveBeenCalledWith(1, 'full-prose');
  });

  it('shows an advisory as passive evidence whether or not the card is selected', () => {
    renderCard({ card: cardTwo });
    expect(
      screen.getByText(/Advisory for Must survive: adds a fact — the chair/)
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Accept advisory risk/ })
    ).toBeNull();
    cleanup();
    renderCard({ card: cardTwo, selected: true });
    expect(screen.getByText(/Advisory for Must survive/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /advisory risk/i })).toBeNull();
  });

  it('keeps a model-declared hard-conflict card selectable and names writer authority', () => {
    const { props } = renderCard({ card: cardThree });
    const select = screen.getByRole('button', {
      name: 'Select Take 3 — Absence as furniture'
    });
    expect((select as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(select);
    expect(props.onToggleSelection).toHaveBeenCalledWith(3);
    expect(
      screen.getByText(/Hard conflict with Must not change: moves her closing line/)
    ).toBeTruthy();
    expect(screen.getByText(/You remain the authority/)).toBeTruthy();
  });

  it('keeps copy and compare available on a hard-conflict card', () => {
    const { props } = renderCard({ card: cardThree });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Take 3 prose' }));
    expect(props.onCopyProse).toHaveBeenCalledWith(cardThree.prose);
    const compare = screen.getByRole('button', { name: 'Compare Take 3 side by side' });
    expect(compare.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(compare);
    expect(props.onToggleCompare).toHaveBeenCalledWith(3);
  });
});
