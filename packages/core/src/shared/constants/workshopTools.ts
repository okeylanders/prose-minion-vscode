/**
 * The Workshop tool catalog — the design prototype's 14 tools, mapped 1:1 onto
 * the EXISTING analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes (ADR 2026-07-03). Labels and grouping come from the
 * reference comp's TOOLS table (docs/design/pm-frames-fulltab.js).
 *
 * This is the single deterministic source for tool ids ↔ labels: the webview
 * palette renders from it and WorkshopHandler labels turns with it, so the two
 * can't drift — and the LLM never names buttons (epic invariant). Icons are
 * presentation-only and stay in the webview layer.
 */

import { WorkshopToolId } from '../types/messages/workshop';

export type WorkshopToolGroup = 'Primary' | 'Craft & Voice' | 'Technical';

export interface WorkshopToolDescriptor {
  id: WorkshopToolId;
  label: string;
  group: WorkshopToolGroup;
}

export const WORKSHOP_TOOL_CATALOG: readonly WorkshopToolDescriptor[] = [
  { id: 'dialogue', label: 'Dialogue & Beats', group: 'Primary' },
  { id: 'prose', label: 'Prose', group: 'Primary' },
  { id: 'gestures', label: 'Gestures', group: 'Primary' },
  { id: 'cliche', label: 'Cliché', group: 'Craft & Voice' },
  { id: 'repetition', label: 'Repetition', group: 'Craft & Voice' },
  { id: 'decision-points', label: 'Decision Points', group: 'Craft & Voice' },
  { id: 'show-and-tell', label: 'Show & Tell', group: 'Craft & Voice' },
  { id: 'choreography', label: 'Choreography', group: 'Craft & Voice' },
  { id: 'stock-and-signature', label: 'Stock & Signature', group: 'Craft & Voice' },
  { id: 'placeholders', label: 'Placeholders', group: 'Craft & Voice' },
  { id: 'style', label: 'Style', group: 'Technical' },
  { id: 'editor', label: 'Editor', group: 'Technical' },
  { id: 'continuity', label: 'Continuity', group: 'Technical' },
  { id: 'fresh', label: 'Fresh', group: 'Technical' },
];

const LABELS_BY_ID: ReadonlyMap<WorkshopToolId, string> = new Map(
  WORKSHOP_TOOL_CATALOG.map((tool) => [tool.id, tool.label])
);

/** Display label for a tool id; falls back to the raw id for forward compat. */
export function workshopToolLabel(id: WorkshopToolId): string {
  return LABELS_BY_ID.get(id) ?? id;
}

/** True when the wire value names a tool this build knows how to route. */
export function isWorkshopToolId(value: unknown): value is WorkshopToolId {
  return typeof value === 'string' && LABELS_BY_ID.has(value as WorkshopToolId);
}
