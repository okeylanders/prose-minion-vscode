/**
 * @jest-environment jsdom
 */

/**
 * FullTabHeaderStatus + ProviderPausedBanner — the generic header cluster and
 * the no-key notice every full editor tab shows (Lightbox Slice 1).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OpenRouterBalance } from '@messages';
import {
  FullTabHeaderStatus,
  FullTabHeaderStatusProps,
  fullTabBalanceTitle
} from '@components/fulltab/FullTabHeaderStatus';
import { ProviderPausedBanner } from '@components/fulltab/ProviderPausedBanner';

const okBalance: OpenRouterBalance = {
  status: 'ok',
  creditsStatus: 'ok',
  credits: { totalCredits: 20, totalUsage: 8, remaining: 12 }
};

const makeProps = (
  overrides: Partial<FullTabHeaderStatusProps> = {}
): FullTabHeaderStatusProps => ({
  models: {
    modelOptions: [
      { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', description: '' }
    ],
    modelSelections: { assistant: 'anthropic/claude-sonnet-5' },
    setModelSelection: jest.fn(),
    requestModelData: jest.fn()
  },
  tokens: {
    usage: { promptTokens: 1200, completionTokens: 345, totalTokens: 1545 },
    lastRequestCostUsd: 0.0123
  },
  balance: { openrouter: okBalance },
  ...overrides
});

describe('FullTabHeaderStatus', () => {
  it('renders the assistant model chip, then processed traffic, then the balance', () => {
    const { container } = render(
      <div className="pm-ws-header-actions">
        <FullTabHeaderStatus {...makeProps()} />
      </div>
    );

    const row = container.querySelector('.pm-ws-header-actions');
    expect(Array.from(row?.children ?? []).map((child) => child.className))
      .toEqual(['model-selector', 'pm-ws-balance', 'pm-ws-balance']);
    expect(screen.getByText('Claude Sonnet 5')).not.toBeNull();
    expect(screen.getByText('1,545')).not.toBeNull();
    expect(screen.getByText('$ 12.00')).not.toBeNull();
    expect(container.querySelector('.pm-ws-balance-dot-ok')).not.toBeNull();
  });

  it('shows processed traffic as cost and activity, not context size', () => {
    render(<FullTabHeaderStatus {...makeProps()} />);

    expect(screen.getByText('Processed').parentElement?.getAttribute('title')).toBe(
      'Cumulative processed traffic — prompt 1,200 · completion 345. ' +
      'Retained history may be processed again across calls.'
    );
  });

  it('dims the balance and shows a dash when there is no figure', () => {
    const { container } = render(
      <FullTabHeaderStatus {...makeProps({ balance: { openrouter: null } })} />
    );

    expect(screen.getByText('$ —')).not.toBeNull();
    expect(container.querySelector('.pm-ws-balance-dot-off')).not.toBeNull();
  });

  it('refreshes model data when the model browser opens', () => {
    const props = makeProps();
    render(<FullTabHeaderStatus {...props} />);

    fireEvent.click(screen.getByText('Claude Sonnet 5').closest('button') as HTMLButtonElement);

    expect(props.models.requestModelData).toHaveBeenCalledWith(true);
  });
});

describe('fullTabBalanceTitle', () => {
  it('says when no key is configured', () => {
    expect(fullTabBalanceTitle(null, undefined))
      .toBe('OpenRouter balance — no API key configured');
    expect(fullTabBalanceTitle({ ...okBalance, status: 'no_key' }, 0.5))
      .toBe('OpenRouter balance — no API key configured');
  });

  it('lists the credits left and the last request cost', () => {
    expect(fullTabBalanceTitle(okBalance, 0.0123))
      .toBe('Credits remaining: $12.00 · Last request: $0.0123');
  });

  it('admits an unavailable account balance', () => {
    expect(fullTabBalanceTitle(
      { status: 'ok', creditsStatus: 'unavailable' },
      undefined
    )).toBe('Account balance unavailable');
  });

  it('falls back to a plain name when nothing is known yet', () => {
    expect(fullTabBalanceTitle({ status: 'ok', creditsStatus: 'ok' }, undefined))
      .toBe('OpenRouter balance');
  });
});

describe('ProviderPausedBanner', () => {
  it('states the pause, the tab’s own availability note, and opens settings', () => {
    const onAddApiKey = jest.fn();
    render(
      <ProviderPausedBanner
        availabilityNote="Your measured board still works."
        onAddApiKey={onAddApiKey}
      />
    );

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('AI replies are paused.');
    expect(banner.textContent).toContain(
      'Add an OpenRouter API key to continue. Your measured board still works.'
    );

    fireEvent.click(screen.getByRole('button', { name: /Add API key/i }));
    expect(onAddApiKey).toHaveBeenCalledTimes(1);
  });
});
