/**
 * AccountBalanceWidget — OpenRouter balance in the sidebar header.
 *
 * Single-provider adaptation of Frame Minion's collapsed-pill ↔ expanded-strip
 * pattern (ADR-010). Collapsed, it shows the account balance with a status dot
 * and the last-request cost beneath; the chevron discloses a panel with the
 * full detail (account balance + enforced key spend-limit + headroom bar) and a
 * refresh control. Keys never reach the webview — every number here is sanitized.
 *
 * Styling uses VS Code theme variables for now; the Pass-2 Wave-3 reskin will
 * move it into the warm-brown Frame-Minion design language and final header slot.
 */
import * as React from 'react';
import { OpenRouterBalance, OpenRouterKeyLimit } from '@messages';
import { UseAccountBalanceReturn } from '@hooks/domain/useAccountBalance';
import { fmtUsd, openRouterHeadline } from './balanceFormat';

interface AccountBalanceWidgetProps {
  balance: UseAccountBalanceReturn;
  /** Cost of the most-recent AI request, shown beneath the balance. */
  lastRequestCostUsd?: number;
}

const RESET_LABELS: Record<OpenRouterKeyLimit['resetWindow'], string> = {
  daily: 'Daily remaining',
  weekly: 'Weekly remaining',
  monthly: 'Monthly remaining',
  unknown: 'Remaining'
};

const dotClassFor = (status: OpenRouterBalance['status'] | undefined): string => {
  if (status === 'ok') return 'ok';
  if (status === 'no_key') return 'muted';
  return 'warn';
};

export const AccountBalanceWidget: React.FC<AccountBalanceWidgetProps> = ({
  balance,
  lastRequestCostUsd
}) => {
  const { openrouter, isLoading, refresh } = balance;
  const [expanded, setExpanded] = React.useState(false);

  const headline = openRouterHeadline(openrouter, isLoading);
  const dotClass = dotClassFor(openrouter?.status);

  return (
    <div className="pm-balance-widget">
      <button
        type="button"
        className={`pm-balance-pill${expanded ? ' is-expanded' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={expanded ? 'Hide account balance' : 'Show account balance'}
      >
        <span className="pm-balance-rows">
          <span className="pm-balance-row">
            <span className={`pm-balance-dot ${dotClass}`} aria-hidden="true" />
            <span className="pm-balance-label">OpenRouter</span>
            <span
              className={`pm-balance-val${headline.tone === 'zero' ? ' zero' : ''}${headline.tone === 'muted' ? ' muted' : ''}`}
            >
              {headline.text}
            </span>
          </span>
          {typeof lastRequestCostUsd === 'number' && (
            <span className="pm-balance-sub">
              Last request <b>{`$${lastRequestCostUsd.toFixed(3)}`}</b>
            </span>
          )}
        </span>
        <span className="pm-balance-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {expanded && (
        <div className="pm-balance-panel" role="region" aria-label="Account balance detail">
          <div className="pm-balance-panel-head">
            <span className="pm-balance-panel-title">OpenRouter account</span>
            <button
              type="button"
              className={`pm-balance-refresh${isLoading ? ' spinning' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                refresh();
              }}
              disabled={isLoading}
              title="Refresh balance"
              aria-label="Refresh balance"
            >
              <RefreshIcon />
            </button>
          </div>
          <OpenRouterDetail balance={openrouter} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};

const OpenRouterDetail: React.FC<{ balance: OpenRouterBalance | null; isLoading: boolean }> = ({
  balance,
  isLoading
}) => {
  if (!balance) {
    return <div className="pm-balance-amount muted">{isLoading ? '…' : '—'}</div>;
  }
  if (balance.status === 'no_key') {
    return <div className="pm-balance-note">Add an OpenRouter key in Settings</div>;
  }
  if (balance.status === 'unavailable') {
    return <div className="pm-balance-note">{balance.reason ?? 'Unavailable'}</div>;
  }

  const { keyLimit, credits } = balance;
  const hasEnforcedLimit =
    keyLimit != null && keyLimit.limit != null && keyLimit.limitRemaining != null;

  // Account balance is the headline metric. An enforced key spend limit (if any)
  // is demoted to a sub-line below; absent, it's hidden.
  if (credits) {
    return (
      <>
        <div className={`pm-balance-amount${credits.remaining <= 0 ? ' zero' : ''}`}>
          {fmtUsd(credits.remaining)}
        </div>
        <div className="pm-balance-amount-label">Account balance</div>
        {hasEnforcedLimit && <KeyLimitDetail keyLimit={keyLimit!} />}
      </>
    );
  }

  // Account balance isn't readable — fall back to the enforced key spend limit
  // so a non-management key still shows the one number it has.
  if (hasEnforcedLimit) {
    return (
      <>
        <KeyLimitHeadline keyLimit={keyLimit!} />
        {balance.creditsStatus !== 'ok' && (
          <div className="pm-balance-note">Account balance unavailable</div>
        )}
      </>
    );
  }

  return <div className="pm-balance-note">Balance unavailable</div>;
};

const KeyLimitHeadline: React.FC<{ keyLimit: OpenRouterKeyLimit }> = ({ keyLimit }) => {
  const remaining = keyLimit.limitRemaining!;
  const limit = keyLimit.limit!;
  if (limit === 0) {
    return (
      <>
        <div className="pm-balance-amount">{fmtUsd(0)}</div>
        <div className="pm-balance-amount-label">Spend cap (no headroom)</div>
      </>
    );
  }
  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  return (
    <>
      <div className="pm-balance-amount">
        {fmtUsd(remaining)} <span className="pm-balance-of">/ {fmtUsd(limit)}</span>
      </div>
      <div className="pm-balance-amount-label">{RESET_LABELS[keyLimit.resetWindow]}</div>
      <div className="pm-balance-bar" aria-hidden="true">
        <div className="pm-balance-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
};

const KeyLimitDetail: React.FC<{ keyLimit: OpenRouterKeyLimit }> = ({ keyLimit }) => {
  const remaining = keyLimit.limitRemaining!;
  const limit = keyLimit.limit!;
  if (limit === 0) {
    return <div className="pm-balance-sub-line">Key spend cap: no headroom</div>;
  }
  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
  return (
    <>
      <div className="pm-balance-sub-line">
        Key spend limit: {fmtUsd(remaining)} / {fmtUsd(limit)}
      </div>
      <div className="pm-balance-bar" aria-hidden="true">
        <div className="pm-balance-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
};

const ChevronDownIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);
