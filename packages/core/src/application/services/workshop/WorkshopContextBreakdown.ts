/**
 * A participant's context, part by part (ADR 2026-11-18 D1–D8). Pure.
 *
 * From what the host measured (the held system prompt's sections and each
 * committed turn's tally) and the participant's read-in rows, it builds the
 * parts the panel shows. Conversation is never built here: the webview
 * adds it as the rest of the provider-measured total (D2).
 *
 * Display-safe by construction: names are the host's tables, never prompt
 * text; numbers are tokens and counts.
 */

import {
  CONTEXT_BREAKDOWN_PARTS,
  ContextBreakdown,
  ContextBreakdownMeasure,
  ContextBreakdownPart,
  ContextBreakdownPartId,
  ContextBreakdownPiece,
  ContextSourceEntry,
  ContextSourceKind
} from '@shared/types';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  isWorkshopContextTallyPiece,
  WORKSHOP_CONTEXT_TALLY_PIECES,
  WorkshopContextTallyPiece
} from '@services/analysis/WorkshopContextTally';
import type { WorkshopConversationMeasure } from '@services/analysis/WorkshopSystemPromptMeasures';

/** Parts measured only by the tally: "not measured" when messages predate it (D7). */
const TALLIED_PARTS: ReadonlySet<ContextBreakdownPartId> = new Set(['memory', 'todos', 'room-notes', 'excerpt-context']);

const READ_IN_NAMES: Readonly<Partial<Record<ContextSourceKind, string>>> = {
  resource: 'Files',
  transcript: 'Past sessions',
  dictionary: 'Dictionary entries',
  'tool-evidence': 'Tool reports',
  memory: 'Notes read'
};

interface Accumulated {
  tokens: number;
  provider: boolean;
  estimate: boolean;
  pieces: ContextBreakdownPiece[];
}

/** A row's cost: the provider's number where the engine attributed one, else its size estimated. */
const rowTokens = (row: ContextSourceEntry): number =>
  row.promptTokensDelta ?? Math.ceil(row.sizeChars / PROMPT_BUDGETS.inferenceContext.bytesPerToken);

const measureOf = ({ provider, estimate }: Accumulated): ContextBreakdownMeasure =>
  provider && !estimate ? 'provider' : provider ? 'mixed' : 'estimate';

/** True when the conversation has messages from before its tally began (D7). */
export function workshopContextUntallied(measure: Pick<WorkshopConversationMeasure, 'messageCount' | 'tally'>): boolean {
  return measure.messageCount > 0 && measure.tally[0]?.messageIndex !== 0;
}

export function buildWorkshopContextBreakdown(
  measure: WorkshopConversationMeasure,
  readIn: readonly ContextSourceEntry[]
): ContextBreakdown {
  const untallied = workshopContextUntallied(measure);
  const parts = new Map<ContextBreakdownPartId, Accumulated>(
    CONTEXT_BREAKDOWN_PARTS.map((part) => [part, { tokens: 0, provider: false, estimate: false, pieces: [] }])
  );
  const add = (part: ContextBreakdownPartId, piece: ContextBreakdownPiece, provider = false): void => {
    const into = parts.get(part)!;
    into.tokens += piece.tokens ?? 0;
    if (provider) into.provider = true; else into.estimate = true;
    into.pieces.push(piece);
  };

  if (measure.sections) {
    for (const section of measure.sections) add(section.part, { name: section.name, tokens: section.tokens });
  } else {
    add('persona', { name: 'System prompt, not split by section', tokens: measure.systemTokens });
  }

  for (const [piece, total] of tallyTotals(measure)) {
    const spec = WORKSHOP_CONTEXT_TALLY_PIECES[piece];
    add(spec.part, { name: spec.name, tokens: total.tokens, count: total.count });
  }
  if (untallied) {
    parts.get('tool-use')!.pieces.push({ name: WORKSHOP_CONTEXT_TALLY_PIECES['tool-use.contract'].name });
  }

  for (const [kind, rows] of groupedReadIn(readIn)) {
    const provider = rows.every((row) => row.promptTokensDelta !== undefined);
    const anyProvider = rows.some((row) => row.promptTokensDelta !== undefined);
    const part: ContextBreakdownPartId = kind === 'memory' ? 'memory' : 'requested';
    const into = parts.get(part)!;
    into.tokens += rows.reduce((sum, row) => sum + rowTokens(row), 0);
    if (anyProvider) into.provider = true;
    if (!provider) into.estimate = true;
    into.pieces.push({ name: `${READ_IN_NAMES[kind] ?? 'Other reads'} (${rows.length})`, tokens: rows.reduce((sum, row) => sum + rowTokens(row), 0) });
  }

  return {
    parts: CONTEXT_BREAKDOWN_PARTS.map((part): ContextBreakdownPart => {
      const accumulated = parts.get(part)!;
      if (untallied && TALLIED_PARTS.has(part)) {
        return { part, measure: 'estimate', pieces: [] };
      }
      return { part, tokens: accumulated.tokens, measure: measureOf(accumulated), pieces: accumulated.pieces };
    }),
    untalliedMessages: untallied
  };
}

/** Each piece's total over the conversation, and how many messages carried it; unknown ids are ignored. */
function tallyTotals(measure: WorkshopConversationMeasure): Map<WorkshopContextTallyPiece, { tokens: number; count: number }> {
  const totals = new Map<WorkshopContextTallyPiece, { tokens: number; count: number }>();
  for (const entry of measure.tally) {
    for (const [id, tokens] of Object.entries(entry.pieces)) {
      if (!isWorkshopContextTallyPiece(id) || tokens <= 0) continue;
      const total = totals.get(id) ?? { tokens: 0, count: 0 };
      totals.set(id, { tokens: total.tokens + tokens, count: total.count + 1 });
    }
  }
  // The table's order, so pieces read the same in every room.
  return new Map(
    (Object.keys(WORKSHOP_CONTEXT_TALLY_PIECES) as WorkshopContextTallyPiece[])
      .filter((id) => totals.has(id))
      .map((id) => [id, totals.get(id)!])
  );
}

/** Read-in rows by kind, every delivery counted: superseded rows are still in the history. */
function groupedReadIn(rows: readonly ContextSourceEntry[]): Map<ContextSourceKind, ContextSourceEntry[]> {
  const groups = new Map<ContextSourceKind, ContextSourceEntry[]>();
  for (const row of rows) {
    groups.set(row.kind, [...(groups.get(row.kind) ?? []), row]);
  }
  return groups;
}
