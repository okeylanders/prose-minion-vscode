/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  CreativeVariationCard
} from '@components/workshop/widgets/creativeVariations/CreativeVariationCard';
import {
  ADVISORY_RISK_ID,
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
    acceptedAdvisoryRiskIds: [] as string[],
    comparing: false,
    interactionLocked: false,
    onToggleSelection: jest.fn(),
    onCarryModeChange: jest.fn(),
    onToggleAdvisoryRisk: jest.fn(),
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

  it('shows an advisory risk as a static labelled pill while unselected', () => {
    renderCard({ card: cardTwo });
    expect(
      screen.getByText(/Risk to Must survive: adds a fact — the chair/)
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Accept advisory risk/ })
    ).toBeNull();
  });

  it('reflects withdrawn and accepted advisory-risk states on a selected card', () => {
    const { props } = renderCard({
      card: cardTwo,
      selected: true,
      acceptedAdvisoryRiskIds: [ADVISORY_RISK_ID]
    });
    const accepted = screen.getByRole('button', {
      name: /Withdraw acceptance of advisory risk on Take 2/
    });
    expect(accepted.getAttribute('aria-pressed')).toBe('true');
    expect(accepted.textContent).toContain('Accepted — rides with this take');
    fireEvent.click(accepted);
    expect(props.onToggleAdvisoryRisk).toHaveBeenCalledWith(2, ADVISORY_RISK_ID);
  });

  it('disables selection on a hard-conflict card and names the flagged boundary', () => {
    const { props } = renderCard({ card: cardThree });
    const select = screen.getByRole('button', {
      name: 'Select Take 3 — Absence as furniture'
    });
    expect((select as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(select);
    expect(props.onToggleSelection).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Hard conflict with Must not change: moves her closing line/)
    ).toBeTruthy();
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
