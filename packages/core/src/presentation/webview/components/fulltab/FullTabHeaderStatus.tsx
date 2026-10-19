/**
 * FullTabHeaderStatus — the generic right end of a full-tab header
 * (ADR 2026-10-19 D2): the assistant-model chip, the processed-traffic chip
 * and the OpenRouter balance chip, in that order.
 *
 * Renders a fragment so the three chips stay direct children of the
 * header's actions row, after whatever tab-specific actions precede them.
 * It reads the shared chrome's state (see `useFullTabChrome`) but owns none.
 */
import * as React from 'react';
import type { OpenRouterBalance } from '@messages';
import { ModelSelector } from '@components/shared/ModelSelector';
import type { UseAccountBalanceReturn } from '@hooks/domain/useAccountBalance';
import type { UseModelsSettingsReturn } from '@hooks/domain/useModelsSettings';
import type { UseTokenTrackingReturn } from '@hooks/domain/useTokenTracking';

export interface FullTabHeaderStatusProps {
  models: Pick<
    UseModelsSettingsReturn,
    'modelOptions' | 'modelSelections' | 'setModelSelection' | 'requestModelData'
  >;
  tokens: Pick<UseTokenTrackingReturn, 'usage' | 'lastRequestCostUsd'>;
  balance: Pick<UseAccountBalanceReturn, 'openrouter'>;
}

/** The balance chip's tooltip: what is known about the account, or why not. */
export function fullTabBalanceTitle(
  openrouter: OpenRouterBalance | null,
  lastRequestCostUsd: number | undefined
): string {
  if (!openrouter || openrouter.status === 'no_key') {
    return 'OpenRouter balance — no API key configured';
  }
  const remaining = openrouter.credits?.remaining;
  const parts: string[] = [];
  if (typeof remaining === 'number') {
    parts.push(`Credits remaining: $${remaining.toFixed(2)}`);
  }
  if (typeof lastRequestCostUsd === 'number') {
    parts.push(`Last request: $${lastRequestCostUsd.toFixed(4)}`);
  }
  if (openrouter.creditsStatus !== 'ok') {
    parts.push('Account balance unavailable');
  }
  return parts.join(' · ') || 'OpenRouter balance';
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const FullTabHeaderStatus: React.FC<FullTabHeaderStatusProps> = ({
  models,
  tokens,
  balance
}) => {
  const openrouter = balance.openrouter;
  const remaining = openrouter?.credits?.remaining;

  return (
    <>
      {/* Model browser — the SAME ModelSelector + ModelBrowserModal the
          sidebar uses (assistant scope, same MODEL_DATA rails); only the
          trigger is reskinned to the header chip via the full-tab styles. */}
      <ModelSelector
        scope="assistant"
        options={models.modelOptions}
        value={models.modelSelections.assistant}
        onChange={models.setModelSelection}
        onOpenBrowser={() => models.requestModelData(true)}
        label="Assistant Model"
      />
      {/* Cumulative processed traffic is cost/activity, not context size. */}
      <div
        className="pm-ws-balance"
        title={`Cumulative processed traffic — prompt ${tokens.usage.promptTokens.toLocaleString()} · completion ${tokens.usage.completionTokens.toLocaleString()}. Retained history may be processed again across calls.`}
      >
        <span className="pm-ws-balance-label">Processed</span>
        <span className="pm-ws-balance-val">
          {tokens.usage.totalTokens.toLocaleString()}
        </span>
      </div>
      <div className="pm-ws-balance" title={fullTabBalanceTitle(openrouter, tokens.lastRequestCostUsd)}>
        <span
          className={`pm-ws-balance-dot ${
            openrouter?.status === 'ok' ? 'pm-ws-balance-dot-ok' : 'pm-ws-balance-dot-off'
          }`}
        />
        <span className="pm-ws-balance-label">OpenRouter</span>
        <span className="pm-ws-balance-val">
          {typeof remaining === 'number' ? `$ ${remaining.toFixed(2)}` : '$ —'}
        </span>
      </div>
    </>
  );
};
