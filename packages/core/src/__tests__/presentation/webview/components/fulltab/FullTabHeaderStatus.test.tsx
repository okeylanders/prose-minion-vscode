/**
 * @jest-environment jsdom
 */

/**
 * FullTabHeaderStatus + ProviderPausedBanner — the generic header cluster and
 * the no-key notice every full editor tab shows (Lightbox Slice 1).
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    followingModelScopes: [],
    setModelSelection: jest.fn(),
    followModelSelection: jest.fn(),
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

/**
 * The Lightbox's chip picks its own scope (Slice 4L): placeholder model ids,
 * the Workshop's and the one picked for the Lightbox.
 */
describe('FullTabHeaderStatus, the Lightbox model chip (Slice 4L)', () => {
  const WORKSHOP = 'placeholder/workshop-model';
  const LIGHTBOX = 'placeholder/lightbox-model';
  const lightboxProps = (
    models: Partial<FullTabHeaderStatusProps['models']>
  ): FullTabHeaderStatusProps => {
    const base = makeProps();
    return {
      ...base,
      modelScope: 'lightbox',
      models: {
        ...base.models,
        modelOptions: [
          { id: WORKSHOP, label: 'Workshop placeholder' },
          { id: LIGHTBOX, label: 'Lightbox placeholder' }
        ],
        ...models
      }
    };
  };
  const openBrowser = () => fireEvent.click(screen.getByRole('button', { name: /^Browse lightbox model options/ }));

  it('names the Workshop’s model while the Lightbox has none of its own, and checks that choice in the browser', () => {
    render(<FullTabHeaderStatus {...lightboxProps({
      modelSelections: { assistant: WORKSHOP, lightbox: WORKSHOP },
      followingModelScopes: ['lightbox']
    })} />);

    expect(screen.getByRole('button', {
      name: 'Browse lightbox model options. Current model: Same as Workshop (Workshop placeholder)'
    })).not.toBeNull();
    openBrowser();
    const browser = screen.getByRole('dialog', { name: 'Lightbox Model browser' });
    const follow = within(browser).getByRole('button', { name: /^Same as Workshop \(Workshop placeholder\)/ });
    expect(follow.className).toContain('selected');
    // Following, the model it resolves to is not itself the choice.
    expect(within(browser).getByRole('button', { name: /^Workshop placeholder/ }).className).not.toContain('selected');
  });

  it('picks a model of its own on the lightbox scope, never the assistant scope', () => {
    const props = lightboxProps({
      modelSelections: { assistant: WORKSHOP, lightbox: WORKSHOP },
      followingModelScopes: ['lightbox']
    });
    render(<FullTabHeaderStatus {...props} />);

    openBrowser();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Lightbox placeholder/ }));

    expect(props.models.setModelSelection).toHaveBeenCalledWith('lightbox', LIGHTBOX);
    expect(props.models.setModelSelection).not.toHaveBeenCalledWith('assistant', expect.anything());
    expect(props.models.followModelSelection).not.toHaveBeenCalled();
  });

  it('shows the Lightbox’s own model once picked, and offers the way back to the Workshop’s', () => {
    const props = lightboxProps({
      modelSelections: { assistant: WORKSHOP, lightbox: LIGHTBOX },
      followingModelScopes: []
    });
    render(<FullTabHeaderStatus {...props} />);

    expect(screen.getByRole('button', {
      name: 'Browse lightbox model options. Current model: Lightbox placeholder'
    })).not.toBeNull();
    openBrowser();
    const browser = screen.getByRole('dialog');
    expect(within(browser).getByRole('button', { name: /^Lightbox placeholder/ }).className).toContain('selected');
    const follow = within(browser).getByRole('button', { name: /^Same as Workshop \(Workshop placeholder\)/ });
    expect(follow.className).not.toContain('selected');

    fireEvent.click(follow);
    expect(props.models.followModelSelection).toHaveBeenCalledWith('lightbox');
    expect(props.models.setModelSelection).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the Workshop’s chip on the assistant scope, with no follow choice', () => {
    const props = makeProps();
    render(<FullTabHeaderStatus {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /^Browse assistant model options/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /^Same as Workshop/ })).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Claude Sonnet 5/ }));
    expect(props.models.setModelSelection).toHaveBeenCalledWith('assistant', 'anthropic/claude-sonnet-5');
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
