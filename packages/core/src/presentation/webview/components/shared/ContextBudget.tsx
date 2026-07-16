import * as React from 'react';
import { ContextBudgetSnapshot, ModelOption } from '@shared/types';
import {
  contextBudgetView,
  formatCompactTokens,
  participantDotIndex
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

/** Applied compression is worth an amber glance; its absence is calm green. */
const compressionValueClass = (value: ContextBudgetSnapshot['contextCompression']): string => ({
  applied: 'pm-ctx-warn',
  'not-applied': 'pm-ctx-ok',
  unknown: 'pm-ctx-dim'
})[value];

/** The gauge label is "<participant> context"; the footer wants the bare name. */
const participantName = (label: string): string => label.replace(/\s+context$/i, '');

const Chevron: React.FC = () => (
  <span className="pm-context-budget-chev" aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const IdentityDot: React.FC<{ label: string }> = ({ label }) => (
  <span
    className={`pm-context-budget-dot pm-context-budget-dot-${participantDotIndex(label)}`}
    aria-hidden="true"
  />
);

const ParticipantLabel: React.FC<{ label: string }> = ({ label }) => (
  <span className="pm-context-budget-name">
    <b>{participantName(label)}</b>&nbsp;context
  </span>
);

export const ContextBudget: React.FC<ContextBudgetProps> = ({
  label,
  snapshot,
  modelOptions,
  cumulativeProcessedTokens
}) => {
  if (!snapshot) {
    return (
      <div className="pm-context-budget pm-context-budget-empty" role="status" aria-label={`${label}: not measured yet`}>
        <div className="pm-context-budget-row">
          <IdentityDot label={label} />
          <ParticipantLabel label={label} />
          <span className="pm-context-budget-track" />
          <span className="pm-context-budget-nums">Not measured yet — updates after the first reply</span>
        </div>
      </div>
    );
  }

  const model = modelOptions.find(option => option.id === snapshot.modelId);
  const view = contextBudgetView(snapshot, model);
  const percent = view.utilizationPercent;
  const primary = view.usableInputTokens === undefined
    ? `Context ${formatCompactTokens(snapshot.contextTokens)} · Window unavailable`
    : `Context ${formatCompactTokens(snapshot.contextTokens)} / ${formatCompactTokens(view.usableInputTokens)} · ${percent}%`;
  const accessible = `${label}. ${primary}. ${snapshot.callsThisTurn} calls this turn, ` +
    `${snapshot.turnProcessedTokens.toLocaleString()} tokens processed. Compression ${compressionLabel(snapshot.contextCompression)}.`;

  return (
    <details className={`pm-context-budget pm-context-budget-${view.tone}`}>
      <summary
        className="pm-context-budget-row"
        aria-label={accessible}
        title="Retained context after the last committed reply — click for details"
      >
        <IdentityDot label={label} />
        <ParticipantLabel label={label} />
        <span className="pm-context-budget-track">
          {percent !== undefined && (
            <span
              className="pm-context-budget-fill"
              style={{ width: `${Math.min(100, Math.max(percent, 1.5))}%` }}
            />
          )}
        </span>
        {view.usableInputTokens === undefined ? (
          <span className="pm-context-budget-nums">
            <b>{formatCompactTokens(snapshot.contextTokens)}</b> · Window unavailable
          </span>
        ) : (
          <>
            <span className="pm-context-budget-nums">
              <b>{formatCompactTokens(snapshot.contextTokens)}</b> / {formatCompactTokens(view.usableInputTokens)}
            </span>
            <span className="pm-context-budget-pct">{percent}%</span>
          </>
        )}
        <Chevron />
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
        <div>
          <dt>Compression</dt>
          <dd className={compressionValueClass(snapshot.contextCompression)}>{compressionLabel(snapshot.contextCompression)}</dd>
        </div>
      </dl>
      <div className="pm-context-budget-foot">
        Context measured on <b>{participantName(label)}</b>&rsquo;s last committed reply. Each participant keeps
        its own conversation; switching targets never resets it.
      </div>
    </details>
  );
};
