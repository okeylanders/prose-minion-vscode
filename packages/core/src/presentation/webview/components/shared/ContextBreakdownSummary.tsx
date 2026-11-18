import * as React from 'react';
import type { ContextBreakdown } from '@shared/types';
import {
  ContextBreakdownRow,
  contextBreakdownView
} from '@utils/workshop/contextBreakdownView';

/**
 * The Context panel's summary by part (ADR 2026-11-18 D1, D2): a bar split
 * into one labeled segment per part, and the table beside it with the same
 * numbers for screen readers. A part with sections or pieces opens to them.
 * The open rows are this component's own UI state; nothing is persisted.
 */
export const ContextBreakdownSummary: React.FC<{
  breakdown: ContextBreakdown;
  contextTokens: number;
}> = ({ breakdown, contextTokens }) => {
  const view = contextBreakdownView(breakdown, contextTokens);
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setOpen((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className="pm-context-breakdown">
      <div className="pm-context-breakdown-head">By part</div>
      <div className="pm-context-breakdown-bar" role="img" aria-label={view.accessibleSummary}>
        {view.rows.filter((row) => row.share > 0).map((row) => (
          <span
            key={row.id}
            className={`pm-context-breakdown-seg pm-context-breakdown-seg-${row.id}`}
            style={{ width: `${row.share}%` }}
            title={`${row.label}: ${row.tokensText} (${row.how})`}
          >
            {row.share >= 12 ? <span className="pm-context-breakdown-seg-label">{row.label}</span> : null}
          </span>
        ))}
      </div>
      {view.overflow ? (
        <p className="pm-context-breakdown-note" role="note">
          The estimates come to more than the measured total, so Conversation shows as 0.
        </p>
      ) : null}
      <table className="pm-context-breakdown-table">
        <caption className="pm-context-breakdown-caption">
          Context by part. Estimates are the host&rsquo;s; Conversation is the rest of the measured total.
        </caption>
        <thead>
          <tr><th scope="col">Part</th><th scope="col">Tokens</th><th scope="col">Share</th><th scope="col">How</th></tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <BreakdownRow key={row.id} row={row} open={open.has(row.id)} onToggle={() => toggle(row.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BreakdownRow: React.FC<{ row: ContextBreakdownRow; open: boolean; onToggle: () => void }> = ({ row, open, onToggle }) => {
  return (
    <>
      <tr className={row.tokens === undefined ? 'pm-context-breakdown-unmeasured' : undefined}>
        <th scope="row">
          <span className={`pm-context-breakdown-key pm-context-breakdown-seg-${row.id}`} aria-hidden="true" />
          {row.pieces.length > 0 ? (
            <button
              type="button"
              className="pm-context-breakdown-toggle"
              aria-expanded={open}
              onClick={onToggle}
            >
              {row.label}
            </button>
          ) : row.label}
        </th>
        <td>{row.tokensText}</td>
        <td>{row.tokens === undefined ? '' : `${row.share}%`}</td>
        <td>{row.how}</td>
      </tr>
      {open ? row.pieces.map((piece, index) => (
        <tr key={`${row.id}-${index}`} className="pm-context-breakdown-piece">
          <th scope="row">{piece.name}</th>
          <td colSpan={3}>{piece.detail}</td>
        </tr>
      )) : null}
    </>
  );
};
