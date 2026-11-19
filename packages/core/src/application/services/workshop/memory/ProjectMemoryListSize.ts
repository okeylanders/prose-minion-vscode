/**
 * The one reader of `proseMinion.workshop.memory.listSize` (ADR 2026-11-17
 * D9): the library's frame, the manager's estimate and the tab's row all
 * read the size here, so the meters and the frame cannot disagree.
 *
 * Read where a frame is built, never held: a frame is built once per
 * conversation, so a change applies from the next conversation and nothing
 * is rebuilt mid-room.
 */

import type { SettingsStore } from '@/platform';
import {
  coerceWorkshopProjectMemoryListSize,
  WORKSHOP_MEMORY_LIST_SIZE_SETTING,
  WORKSHOP_PROJECT_MEMORY_LIST_SIZES,
  type ProjectMemoryFrameBudgets,
  type WorkshopProjectMemoryListSize
} from '@shared/constants/workshopProjectMemoryListSizes';

/** The size the writer chose, read now; unset or unknown reads as Standard. */
export function readProjectMemoryListSize(settings: Pick<SettingsStore, 'get'>): WorkshopProjectMemoryListSize {
  return coerceWorkshopProjectMemoryListSize(
    settings.get<unknown>(WORKSHOP_MEMORY_LIST_SIZE_SETTING.section, WORKSHOP_MEMORY_LIST_SIZE_SETTING.key)
  );
}

/** A size and its row of the closed table: what a frame built now is held to. */
export interface ProjectMemoryListSizeChoice {
  readonly size: WorkshopProjectMemoryListSize;
  readonly budgets: ProjectMemoryFrameBudgets;
}

export function projectMemoryListSizeChoice(settings: Pick<SettingsStore, 'get'>): ProjectMemoryListSizeChoice {
  const size = readProjectMemoryListSize(settings);
  return { size, budgets: WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size] };
}
