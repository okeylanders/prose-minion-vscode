/**
 * The host's listing as the Memory tab and the manager read it (epic Slice
 * 4b). Pure: before the first answer the workspace reads as loading; after
 * it, every figure is the listing's own.
 */

import type { WorkshopMemoryListingPayload } from '@messages';
import type { WorkshopMemoryTabInput } from './workshopMemoryTabView';
import type { WorkshopMemoryLibrary, WorkshopMemoryWorkspace } from './workshopMemoryViewInputs';

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
    conflicts: listing?.conflicts ?? []
  };
}

export function workshopMemoryLibraryOf(listing: WorkshopMemoryListingPayload | undefined): WorkshopMemoryLibrary {
  return {
    memories: listing?.memories ?? [],
    unreadable: listing?.unreadable ?? [],
    conflicts: listing?.conflicts ?? []
  };
}
