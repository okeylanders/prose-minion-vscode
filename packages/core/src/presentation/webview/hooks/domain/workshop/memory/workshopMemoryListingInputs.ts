/**
 * The host's listing as the Memory tab and the manager read it (epic Slice
 * 4b). Pure: before the first answer the workspace reads as loading; after
 * it, every figure is the listing's own.
 */

import type { WorkshopMemoryListingPayload } from '@messages';
import type { WorkshopMemoryTabInput } from './workshopMemoryTabView';
import { workshopMemoryBudgetsOf } from './workshopMemoryViewInputs';
import type { WorkshopMemoryBudgets, WorkshopMemoryLibrary, WorkshopMemoryWorkspace } from './workshopMemoryViewInputs';
import { coerceWorkshopProjectMemoryListSize } from '@shared/constants/workshopProjectMemoryListSizes';

export function workshopMemoryWorkspaceOf(listing: WorkshopMemoryListingPayload | undefined): WorkshopMemoryWorkspace {
  return listing ? listing.workspace : { kind: 'loading' };
}

/** What the tab draws, but its mode, which is the settings modal's draft. */
export function workshopMemoryTabInputOf(listing: WorkshopMemoryListingPayload | undefined): Omit<WorkshopMemoryTabInput, 'mode'> {
  return {
    workspace: workshopMemoryWorkspaceOf(listing),
    ...(listing?.estimate ? { estimate: listing.estimate } : {}),
    saved: listing?.saved ?? 0,
    unreadable: listing?.unreadable ?? [],
    conflicts: listing?.conflicts ?? [],
    // The size and the budgets are the host's, with the estimate they sized (ADR 2026-11-17 D12).
    listSize: coerceWorkshopProjectMemoryListSize(listing?.listSize),
    budgets: workshopMemoryBudgetsOf(listing?.budgets)
  };
}

/** The budgets the manager's chips state: the listing's own. */
export function workshopMemoryListingBudgets(listing: WorkshopMemoryListingPayload | undefined): WorkshopMemoryBudgets {
  return workshopMemoryBudgetsOf(listing?.budgets);
}

export function workshopMemoryLibraryOf(listing: WorkshopMemoryListingPayload | undefined): WorkshopMemoryLibrary {
  return {
    memories: listing?.memories ?? [],
    unreadable: listing?.unreadable ?? [],
    conflicts: listing?.conflicts ?? []
  };
}
