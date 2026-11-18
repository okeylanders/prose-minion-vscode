/**
 * The Context panel's summary by part, as drawn (ADR 2026-11-18 D1, D2, D7).
 * Pure: no React, no transport.
 *
 * The host sends the parts it measured; this adds Conversation as the rest
 * of the provider-measured total. The rest is never negative: when the
 * estimates come to more than the total, the summary says so and the rest
 * is 0. A part the host could not measure is "not measured", never a zero.
 */

import type {
  ContextBreakdown,
  ContextBreakdownMeasure,
  ContextBreakdownPartId,
  ContextBreakdownPiece
} from '@shared/types';
import { formatCompactTokens } from '@utils/contextBudget';

export type ContextBreakdownRowId = ContextBreakdownPartId | 'conversation';

export const CONTEXT_BREAKDOWN_LABELS: Readonly<Record<ContextBreakdownRowId, string>> = Object.freeze({
  persona: 'Persona and behavior',
  'tool-use': 'Tool-use instructions',
  memory: 'Project memory',
  todos: 'To-dos',
  'room-notes': 'Room notes',
  'excerpt-context': 'Excerpt and context',
  requested: 'Requested by the persona',
  conversation: 'Conversation'
});

const MEASURE_LABELS: Readonly<Record<ContextBreakdownMeasure, string>> = Object.freeze({
  estimate: 'estimate',
  provider: 'measured',
  mixed: 'partly estimated'
});

export interface ContextBreakdownPieceRow {
  name: string;
  /** "about 900 tokens", "in 3 messages", or "not measured". */
  detail: string;
}

export interface ContextBreakdownRow {
  id: ContextBreakdownRowId;
  label: string;
  /** Absent: not measured. */
  tokens?: number;
  /** "12.3K", or "not measured". */
  tokensText: string;
  /** Of the bar, 0–100; 0 for a part not measured. */
  share: number;
  /** "estimate", "measured", "partly estimated", or Conversation's "the rest". */
  how: string;
  pieces: ContextBreakdownPieceRow[];
}

export interface ContextBreakdownView {
  rows: ContextBreakdownRow[];
  /** The estimates come to more than the measured total (D2). */
  overflow: boolean;
  /** One sentence for a screen reader's summary of the bar. */
  accessibleSummary: string;
}

const pieceDetail = (piece: ContextBreakdownPiece): string => {
  if (piece.tokens === undefined) return 'not measured';
  const about = `about ${piece.tokens.toLocaleString('en-US')} tokens`;
  return piece.count !== undefined && piece.count > 1 ? `${about}, in ${piece.count} messages` : about;
};

const percent = (tokens: number, whole: number): number =>
  whole > 0 ? Math.round((tokens / whole) * 1000) / 10 : 0;

export function contextBreakdownView(breakdown: ContextBreakdown, contextTokens: number): ContextBreakdownView {
  const measured = breakdown.parts.reduce((sum, part) => sum + (part.tokens ?? 0), 0);
  const overflow = measured > contextTokens;
  const rest = Math.max(0, contextTokens - measured);
  const unmeasured = breakdown.untalliedMessages || breakdown.parts.some((part) => part.tokens === undefined);
  // The bar is always whole: shares of the total, or of the estimates when they overrun it.
  const whole = overflow ? measured : contextTokens;
  const rows: ContextBreakdownRow[] = [
    ...breakdown.parts.map((part): ContextBreakdownRow => ({
      id: part.part,
      label: CONTEXT_BREAKDOWN_LABELS[part.part],
      ...(part.tokens !== undefined ? { tokens: part.tokens } : {}),
      tokensText: part.tokens === undefined ? 'not measured' : formatCompactTokens(part.tokens),
      share: part.tokens === undefined ? 0 : percent(part.tokens, whole),
      how: part.tokens === undefined ? 'not measured' : MEASURE_LABELS[part.measure],
      pieces: part.pieces.map((piece) => ({ name: piece.name, detail: pieceDetail(piece) }))
    })),
    {
      id: 'conversation',
      label: CONTEXT_BREAKDOWN_LABELS.conversation,
      tokens: rest,
      tokensText: formatCompactTokens(rest),
      share: percent(rest, whole),
      how: unmeasured ? 'the rest, with what was not measured' : 'the rest',
      pieces: []
    }
  ];
  const spoken = rows
    .filter((row) => row.tokens !== undefined && row.tokens > 0)
    .map((row) => `${row.label} ${row.tokensText}`)
    .join(', ');
  return {
    rows,
    overflow,
    accessibleSummary: `Context by part: ${spoken || 'nothing measured yet'}.${overflow ? ' The estimates come to more than the measured total.' : ''}`
  };
}
