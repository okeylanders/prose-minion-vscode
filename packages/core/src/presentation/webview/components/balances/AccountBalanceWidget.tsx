/**
 * Account-balance UI — OpenRouter (single provider).
 *
 * Pass-2 Wave-3 reskin of the Wave-2 widget into FrameMinion's pattern:
 * a compact PILL lives in the sidebar header; clicking it discloses a full
 * in-flow STRIP below the header (not a popup), so the detail pushes content
 * down rather than overlaying it. Expand state is owned by App.tsx so the
 * header pill and the disclosed strip stay in sync.
 *
 * Keys never reach the webview — every number here is sanitized.
 */
import * as React from 'react';
import { OpenRouterBalance, OpenRouterKeyLimit } from '@messages';
import { UseAccountBalanceReturn } from '@hooks/domain/useAccountBalance';
import { Icon } from '@components/shared/Icon';
import { fmtUsd, openRouterHeadline } from './balanceFormat';

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

/* ---------- Collapsed pill (sidebar header) ---------- */

interface AccountBalancePillProps {
  balance: UseAccountBalanceReturn;
  lastRequestCostUsd?: number;
  expanded: boolean;
  onToggle: () => void;
}

export const AccountBalancePill: React.FC<AccountBalancePillProps> = ({
  balance,
  lastRequestCostUsd,
  expanded,
  onToggle
}) => {
  const { openrouter, isLoading } = balance;
  const headline = openRouterHeadline(openrouter, isLoading);

  return (
    <button
      type="button"
      className={`pm-balance-pill${expanded ? ' is-expanded' : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? 'Hide account balance' : 'Show account balance'}
    >
      <span className="pm-balance-rows">
        <span className="pm-balance-row">
          <span className={`pm-balance-dot ${dotClassFor(openrouter?.status)}`} aria-hidden="true" />
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
        <Icon name="chevDown" size={14} />
      </span>
    </button>
  );
};

/* ---------- Disclosed strip (in-flow, below header) ---------- */

interface AccountBalanceStripProps {
  balance: UseAccountBalanceReturn;
}

export const AccountBalanceStrip: React.FC<AccountBalanceStripProps> = ({ balance }) => {
  const { openrouter, isLoading, refresh } = balance;
  return (
    <div className="pm-balance-strip" role="region" aria-label="Account balance detail">
      <div className="pm-balance-strip-head">
        <span className="pm-balance-strip-title">OpenRouter account</span>
        <button
          type="button"
          className={`pm-balance-refresh${isLoading ? ' spinning' : ''}`}
          onClick={refresh}
          disabled={isLoading}
          title="Refresh balance"
          aria-label="Refresh balance"
        >
          <Icon name="refresh" size={14} strokeWidth={1.8} />
        </button>
      </div>
      <OpenRouterDetail balance={openrouter} isLoading={isLoading} />
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
