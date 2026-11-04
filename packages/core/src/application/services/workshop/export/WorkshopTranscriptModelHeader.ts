/**
 * The model a Markdown or HTML export header names (ADR 2026-11-03 D10,
 * amended 2026-11-04), by the thread's own rule, `workshopTurnModelLabel`.
 *
 * The renderers add it, never `projectWorkshopTranscriptTurn`: session recall
 * reads turns through that entry, and recall never carries a model. It reads
 * only a reply entry's `model`, which `projectWorkshopTranscript` sets and the
 * per-turn entry never does. A capability card exports as a one-line event,
 * with no header, so it names no model here (JSON carries its `model`).
 */

import {
  workshopTurnModelLabel,
  type WorkshopModelLabelLookup
} from '@shared/workshop/workshopTurnModelLabel';
import type { WorkshopTranscriptReplyEntry } from '@/application/services/workshop/transcript/WorkshopTranscript';

/** What a renderer needs beyond the transcript. JSON reads none of it. */
export interface WorkshopTranscriptRenderOptions {
  /** A model's display name; the raw id when it names none. */
  modelLabel?: WorkshopModelLabelLookup;
}

export function workshopTranscriptReplyModel(
  entry: WorkshopTranscriptReplyEntry,
  options: WorkshopTranscriptRenderOptions
): string | undefined {
  return workshopTurnModelLabel(entry.model, options.modelLabel ?? (() => undefined));
}
