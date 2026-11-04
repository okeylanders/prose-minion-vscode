/**
 * The memory manager as WorkshopApp mounts it (epic Slice 4b): the
 * transport hook's state and actions handed to the presentational
 * `WorkshopMemoryBrowserModal`. Edit and New open Slice 3's sheet, which
 * WorkshopApp renders after this, so it stacks above the manager.
 */

import * as React from 'react';
import { WorkshopMemoryBrowserModal } from './WorkshopMemoryBrowserModal';
import type { UseWorkshopMemoryManagerReturn } from '@hooks/domain/workshop/useWorkshopMemoryManager';
import { workshopMemoryLibraryOf, workshopMemoryWorkspaceOf } from '@hooks/domain/workshop/memory/workshopMemoryListingInputs';
import type { WorkshopProjectMemoryMode } from '@messages';

interface WorkshopMemoryManagerMountProps {
  manager: UseWorkshopMemoryManagerReturn;
  mode: WorkshopProjectMemoryMode;
  onEdit: (memoryId: string) => void;
  onNewMemory: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryManagerMount: React.FC<WorkshopMemoryManagerMountProps> = ({ manager, mode, onEdit, onNewMemory }) => (
  <WorkshopMemoryBrowserModal
    open={manager.managerOpen}
    mode={mode}
    workspace={workshopMemoryWorkspaceOf(manager.listing)}
    library={workshopMemoryLibraryOf(manager.listing)}
    {...(manager.listing?.estimate ? { estimate: manager.listing.estimate } : {})}
    {...(manager.refusal ? { refusal: manager.refusal } : {})}
    query={manager.query}
    actionPending={manager.actionPending}
    {...(manager.actionError ? { actionError: manager.actionError } : {})}
    {...(manager.focusMemoryId ? { focusMemoryId: manager.focusMemoryId } : {})}
    onQueryChange={manager.setQuery}
    onRename={manager.rename}
    onDelete={manager.remove}
    onOpenFolder={manager.openFolder}
    onNewMemory={onNewMemory}
    onClose={manager.closeManager}
    onEdit={onEdit}
    onRestore={manager.restore}
    onArchive={manager.archive}
    onToggleLoadInFull={manager.toggleLoadInFull}
    onOpenFile={manager.openFile}
  />
);
