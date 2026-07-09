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
  description: string;
}

export const WORKSHOP_TOOL_CATALOG: readonly WorkshopToolDescriptor[] = [
  { id: 'dialogue', label: 'Dialogue & Beats', group: 'Primary', description: 'Cadence, subtext, and the microbeats between lines.' },
  { id: 'prose', label: 'Prose', group: 'Primary', description: 'Line-level rewrite suggestions for flow and clarity.' },
  { id: 'gestures', label: 'Gestures', group: 'Primary', description: 'Body language — variety, repetition, and intent.' },
  { id: 'cliche', label: 'Cliché', group: 'Craft & Voice', description: 'Surface tired phrasings and stock images.' },
  { id: 'repetition', label: 'Repetition', group: 'Craft & Voice', description: 'Echoed words, structures, and tics across the passage.' },
  { id: 'decision-points', label: 'Decision Points', group: 'Craft & Voice', description: 'Moments where a character chooses — and the stakes.' },
  { id: 'show-and-tell', label: 'Show & Tell', group: 'Craft & Voice', description: 'Where you summarize vs. dramatize on the page.' },
  { id: 'choreography', label: 'Choreography', group: 'Craft & Voice', description: 'Spatial logic of movement through a scene.' },
  { id: 'stock-and-signature', label: 'Stock & Signature', group: 'Craft & Voice', description: 'Generic beats vs. your distinctive authorial moves.' },
  { id: 'placeholders', label: 'Placeholders', group: 'Craft & Voice', description: 'Find TODOs, [brackets], and unfinished seams.' },
  { id: 'style', label: 'Style', group: 'Technical', description: 'Weak verbs, adverbs, filler, and passive voice.' },
  { id: 'editor', label: 'Editor', group: 'Technical', description: 'A holistic developmental editor pass.' },
  { id: 'continuity', label: 'Continuity', group: 'Technical', description: 'Contradictions against characters and prior chapters.' },
  { id: 'fresh', label: 'Fresh', group: 'Technical', description: 'Fresh-eyes reactions, as a first-time reader.' },
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
