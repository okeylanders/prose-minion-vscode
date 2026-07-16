/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ContextBudget } from '@components/shared/ContextBudget';
import { ContextBudgetSnapshot } from '@shared/types';

const snapshot: ContextBudgetSnapshot = {
  modelId: 'model/a',
  contextTokens: 42_000,
  promptTokens: 38_000,
  completionTokens: 4_000,
  peakPromptTokensThisTurn: 41_000,
  requestedMaxOutputTokens: 10_000,
  callsThisTurn: 5,
  turnProcessedTokens: 172_000,
  contextCompression: 'not-applied',
  measuredAt: 1
};

describe('ContextBudget', () => {
  it('renders retained context separately from last-request, processed-turn, cumulative, and compression details', () => {
    render(<ContextBudget
      label="Jill context"
      snapshot={snapshot}
      modelOptions={[
        { id: 'model/b', label: 'Newly selected Model B', contextLength: 1_000_000, liveDataAvailable: true },
        { id: 'model/a', label: 'Measured Model A', contextLength: 200_000, liveDataAvailable: true }
      ]}
      cumulativeProcessedTokens={429_000}
    />);

    expect(screen.getByText('Context 42K / 190K · 22%')).toBeTruthy();
    expect(screen.getByLabelText(/Jill context.*5 calls this turn.*172,000 tokens processed/i)).toBeTruthy();
    expect(screen.getByText('5 calls · 172,000 processed')).toBeTruthy();
    expect(screen.getByText('429,000 processed')).toBeTruthy();
    expect(screen.getByText('42,000')).toBeTruthy();
    expect(screen.getByText('38,000')).toBeTruthy();
    expect(screen.getByText('4,000')).toBeTruthy();
    expect(screen.getByText('Not applied')).toBeTruthy();
    expect(screen.getByText('Measured Model A')).toBeTruthy();
    expect(screen.queryByText('Newly selected Model B')).toBeNull();
  });

  it('renders empty and unavailable states without a hardcoded context window', () => {
    const { rerender } = render(<ContextBudget
      label="Quinn context"
      modelOptions={[]}
      cumulativeProcessedTokens={0}
    />);
    expect(screen.getByText('Not measured yet')).toBeTruthy();

    rerender(<ContextBudget
      label="Quinn context"
      snapshot={snapshot}
      modelOptions={[{
        id: 'model/a', label: 'Offline Model A', contextLength: 200_000, liveDataAvailable: false
      }]}
      cumulativeProcessedTokens={0}
    />);
    expect(screen.getByText(/Window unavailable/)).toBeTruthy();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  });
});
