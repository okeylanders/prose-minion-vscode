/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  CreativeVariationsComparison
} from '@components/workshop/widgets/creativeVariations/CreativeVariationsComparison';
import { baseDraft, cardOne, cardThree, cardTwo } from './creativeVariationsFixtures';

const renderComparison = (
  overrides: Partial<React.ComponentProps<typeof CreativeVariationsComparison>> = {}
) => {
  const props = {
    cards: [cardOne, cardTwo],
    invariants: baseDraft.invariants,
    selectedPositions: [] as number[],
    onDismiss: jest.fn(),
    ...overrides
  };
  const view = render(<CreativeVariationsComparison {...props} />);
  return { props, view };
};

describe('CreativeVariationsComparison', () => {
  afterEach(cleanup);

  it('pins both declared invariant fields above the columns', () => {
    renderComparison();
    const region = screen.getByRole('region', { name: 'Side-by-side comparison' });
    expect(region.textContent).toContain('Must survive:');
    expect(region.textContent).toContain(baseDraft.invariants.mustSurvive);
    expect(region.textContent).toContain('Must not change:');
  });

  it('omits the must-not-change line when the writer left it blank', () => {
    renderComparison({
      invariants: { mustSurvive: baseDraft.invariants.mustSurvive, mustNotChange: '  ' }
    });
    const region = screen.getByRole('region', { name: 'Side-by-side comparison' });
    expect(region.textContent).not.toContain('Must not change:');
  });

  it('renders one labelled column per compared take with prose and tradeoff', () => {
    renderComparison();
    const first = screen.getByRole('article', {
      name: 'Take 1 — Baseline — the competent fix'
    });
    expect(first.textContent).toContain('not quite a smile');
    expect(first.textContent).toContain('Gains');
    expect(first.textContent).toContain('Costs');
    expect(
      screen.getByRole('article', { name: 'Take 2 — Her refusal, timed' })
    ).toBeTruthy();
  });

  it('badges selection state and commit-ineligibility without ranking', () => {
    renderComparison({ cards: [cardTwo, cardThree], selectedPositions: [2] });
    const selectedColumn = screen.getByRole('article', {
      name: 'Take 2 — Her refusal, timed'
    });
    expect(selectedColumn.textContent).toContain('selected');
    const conflictColumn = screen.getByRole('article', {
      name: 'Take 3 — Absence as furniture'
    });
    expect(conflictColumn.textContent).toContain('cannot commit');
  });

  it('dismisses through the callback', () => {
    const { props } = renderComparison();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss comparison' }));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });
});
