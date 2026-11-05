/**
 * What the project-memory write routes say when they do nothing (ADR
 * 2026-11-04 D6, D7; moved out of `WorkshopProjectMemoryHandler` in Slice 6c
 * so it stays small). Every line names a fact about the folder, the room or
 * the card, never a memory's text.
 */

import type { ProjectMemoryWriteRefusalReason } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import { WORKSHOP_MEMORY_EDIT_CHANGED } from '@shared/constants/workshopProjectMemoryWrites';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the library's kebab-case reasons. */
export const WORKSHOP_PROJECT_MEMORY_REFUSALS: Readonly<Record<Exclude<ProjectMemoryWriteRefusalReason, 'pinned-budget'>, string>> = {
  off: 'Project memory is off.',
  'no-workspace': 'Project memory isn\'t available here: no folder is open.',
  'multi-root': 'Project memory isn\'t available here: this workspace has several folders.',
  'workspace-changed': 'The workspace changed since this room opened, so its memory can\'t be saved here.',
  'not-ready': 'Wait for the room to finish loading, then try again.',
  unknown: 'The memory folder couldn\'t be read. Try again.',
  missing: 'That memory is no longer in the folder.',
  busy: 'Another window is editing that memory. Try again in a moment.',
  conflict: 'Two files hold that memory\'s id. Fix one in the editor first.',
  invalid: 'That memory can\'t be saved as written. Check its title, summary and note.',
  failed: 'The memory couldn\'t be saved. Try again.',
  withdrawn: 'The memory wasn\'t saved: the setting changed before it could be. It waits for you.',
  changed: WORKSHOP_MEMORY_EDIT_CHANGED
};
/* eslint-enable @typescript-eslint/naming-convention */

export const WORKSHOP_MEMORY_RUN_ACTIVE = 'Wait for the reply to finish, then save to memory.';
export const WORKSHOP_MEMORY_NO_CARD = 'That message no longer holds a memory suggestion.';
export const WORKSHOP_MEMORY_NOT_ELIGIBLE = 'That message can\'t be saved to memory.';
export const WORKSHOP_MEMORY_ROOM_CHANGED = 'The room changed before this could be recorded here.';

