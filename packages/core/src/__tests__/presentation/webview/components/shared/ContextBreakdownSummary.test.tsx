/** @jest-environment jsdom */
/**
 * The panel's summary by part (ADR 2026-11-18 D1): a labeled bar, a table
 * with the same numbers, rows that open to their pieces, and the overflow
 * note. Rendered inside the panel only when the host sent a breakdown.
 */
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ContextBudget } from '@components/shared/ContextBudget';
import { CONTEXT_BREAKDOWN_PARTS, ContextBreakdown, ContextBudgetSnapshot } from '@shared/types';

const snapshot: ContextBudgetSnapshot = {
  modelId: 'model/a', contextTokens: 40_000, promptTokens: 38_000, completionTokens: 2_000,
  peakPromptTokensThisTurn: 38_000, requestedMaxOutputTokens: 10_000, callsThisTurn: 1,
  turnProcessedTokens: 40_000, contextCompression: 'not-applied', measuredAt: 1
};

const breakdown = (persona: number): ContextBreakdown => ({
  parts: CONTEXT_BREAKDOWN_PARTS.map((part) => ({
    part,
    tokens: part === 'persona' ? persona : part === 'tool-use' ? 8_000 : 1_000,
    measure: 'estimate' as const,
    pieces: part === 'persona' ? [{ name: 'Interaction mode: Balanced', tokens: 900 }] : []
  })),
  untalliedMessages: false
});

const panel = (value?: ContextBreakdown) => render(<ContextBudget
  participantIdentity="jill" participantLabel="Jill" snapshot={snapshot}
  modelOptions={[{ id: 'model/a', label: 'Model A', contextLength: 200_000, liveDataAvailable: true }]}
  cumulativeProcessedTokens={40_000} breakdown={value}
/>);

describe('ContextBreakdownSummary (ADR 2026-11-18 D1)', () => {
  it('draws a labeled bar and a table that add up to the measured total', () => {
    panel(breakdown(10_000));
    const table = screen.getByRole('table');
    expect(within(table).getByText('Persona and behavior')).toBeTruthy();
    expect(within(table).getByText('Conversation')).toBeTruthy();
    expect(within(table).getByText('the rest')).toBeTruthy();
    // 40,000 − (10,000 + 8,000 + 5 × 1,000) = 17,000
    expect(within(table).getByText('17K')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Context by part: Persona and behavior 10K/ })).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('opens a part to its sections', () => {
    panel(breakdown(10_000));
    const toggle = screen.getByRole('button', { name: 'Persona and behavior' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Interaction mode: Balanced')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Interaction mode: Balanced')).toBeTruthy();
    expect(screen.getByText('about 900 tokens')).toBeTruthy();
  });

  it('says so when the estimates exceed the total, and never shows a negative', () => {
    panel(breakdown(60_000));
    expect(screen.getByRole('note').textContent).toMatch(/more than the measured total/);
    expect(screen.queryByText(/^-/)).toBeNull();
  });

  it('shows nothing new without a breakdown', () => {
    panel();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
