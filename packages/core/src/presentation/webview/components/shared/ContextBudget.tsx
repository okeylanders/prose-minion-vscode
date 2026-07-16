import * as React from 'react';
import { ContextBudgetSnapshot, ModelOption } from '@shared/types';
import {
  contextBudgetView,
  formatCompactTokens
} from '@utils/contextBudget';

interface ContextBudgetProps {
  label: string;
  snapshot?: ContextBudgetSnapshot;
  modelOptions: readonly ModelOption[];
  cumulativeProcessedTokens: number;
}

const compressionLabel = (value: ContextBudgetSnapshot['contextCompression']): string => ({
  applied: 'Applied',
  'not-applied': 'Not applied',
  unknown: 'Unknown'
})[value];

export const ContextBudget: React.FC<ContextBudgetProps> = ({
  label,
  snapshot,
  modelOptions,
  cumulativeProcessedTokens
}) => {
  if (!snapshot) {
    return (
      <div className="pm-context-budget pm-context-budget-empty" role="status" aria-label={`${label}: not measured yet`}>
        <span className="pm-context-budget-label">{label}</span>
        <span className="pm-context-budget-primary">Not measured yet</span>
      </div>
    );
  }

  const model = modelOptions.find(option => option.id === snapshot.modelId);
  const view = contextBudgetView(snapshot, model);
  const percent = view.utilizationPercent === undefined
    ? undefined
    : Math.round(view.utilizationPercent);
  const primary = view.usableInputTokens === undefined
    ? `Context ${formatCompactTokens(snapshot.contextTokens)} · Window unavailable`
    : `Context ${formatCompactTokens(snapshot.contextTokens)} / ${formatCompactTokens(view.usableInputTokens)} · ${percent}%`;
  const accessible = `${label}. ${primary}. ${snapshot.callsThisTurn} calls this turn, ` +
    `${snapshot.turnProcessedTokens.toLocaleString()} tokens processed. Compression ${compressionLabel(snapshot.contextCompression)}.`;

  return (
    <details className={`pm-context-budget pm-context-budget-${view.tone}`}>
      <summary aria-label={accessible}>
        <span className="pm-context-budget-label">{label}</span>
        <span className="pm-context-budget-primary">{primary}</span>
      </summary>
      <dl className="pm-context-budget-details">
        <div><dt>Measured model</dt><dd>{model?.label ?? snapshot.modelId}</dd></div>
        <div>
          <dt>Model window</dt>
          <dd>{view.usableInputTokens === undefined ? 'Unavailable' : model?.contextLength?.toLocaleString()}</dd>
        </div>
        <div><dt>Usable input</dt><dd>{view.usableInputTokens?.toLocaleString() ?? 'Unavailable'}</dd></div>
        <div><dt>Output reserved</dt><dd>{snapshot.requestedMaxOutputTokens.toLocaleString()}</dd></div>
        <div><dt>Current context</dt><dd>{snapshot.contextTokens.toLocaleString()}</dd></div>
        <div><dt>Last request prompt</dt><dd>{snapshot.promptTokens.toLocaleString()}</dd></div>
        <div><dt>Last response</dt><dd>{snapshot.completionTokens.toLocaleString()}</dd></div>
        <div><dt>Peak this turn</dt><dd>{snapshot.peakPromptTokensThisTurn.toLocaleString()}</dd></div>
        <div>
          <dt>This turn</dt>
          <dd>{snapshot.callsThisTurn} {snapshot.callsThisTurn === 1 ? 'call' : 'calls'} · {snapshot.turnProcessedTokens.toLocaleString()} processed</dd>
        </div>
        <div><dt>Cumulative</dt><dd>{cumulativeProcessedTokens.toLocaleString()} processed</dd></div>
        <div><dt>Compression</dt><dd>{compressionLabel(snapshot.contextCompression)}</dd></div>
      </dl>
    </details>
  );
};
