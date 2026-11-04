/**
 * The model a Markdown or HTML export header names (ADR 2026-11-03 D10,
 * amended 2026-11-04), by the thread's own rule, `workshopTurnModelLabel`.
 *
 * - A reply names it after its speaker.
 * - A capability card (a dictionary lookup, a persona-run analysis) exports
 *   as a one-line event; its header in the thread names its model, so its
 *   line ends with the same text.
 *
 * The renderers add it, never `projectWorkshopTranscriptTurn`: session recall
 * reads turns through that entry, and recall never carries a model. It reads
 * only an entry's `model`, which `projectWorkshopTranscript` sets and the
 * per-turn entry never does.
 */

import {
  workshopTurnModelLabel,
  type WorkshopModelLabelLookup
} from '@shared/workshop/workshopTurnModelLabel';
import type {
  WorkshopTranscriptEventEntry,
  WorkshopTranscriptReplyEntry
} from '@/application/services/workshop/transcript/WorkshopTranscript';

/** What a renderer needs beyond the transcript. JSON reads none of it. */
export interface WorkshopTranscriptRenderOptions {
  /** A model's display name; the raw id when it names none. */
  modelLabel?: WorkshopModelLabelLookup;
}

export function workshopTranscriptEntryModel(
  entry: WorkshopTranscriptReplyEntry | WorkshopTranscriptEventEntry,
  options: WorkshopTranscriptRenderOptions
): string | undefined {
  return workshopTurnModelLabel(entry.model, options.modelLabel ?? (() => undefined));
}
