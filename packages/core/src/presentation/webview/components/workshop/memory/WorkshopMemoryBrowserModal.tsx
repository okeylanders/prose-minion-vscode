/**
 * WorkshopMemoryBrowserModal — the memory manager (Workshop Project Memory,
 * Slice 4b-ui; Slice 0d's "The memory manager"). It composes the full tabs'
 * `SavedItemBrowserModal` and `SavedItemRow`, so it speaks the session
 * browser's markup: search, Group by Kind | Date, inline rename, and
 * delete with a confirm.
 *
 * Presentational: rows and figures come from the host (through
 * `workshopMemoryManagerView`), and every action is a callback. Rows are
 * keyed by the host's opaque `entryKey`; a file opens by that key alone,
 * and every mutation names the memory's unique `mem-` id (ADR D10, PR #192
 * F-02). Conflicting and unreadable files offer Open file only.
 *
 * Edit and New memory only call back: Slice 3 owns the sheet.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { SavedItemBrowserModal, type SavedItemGrouping } from '@components/fulltab/SavedItemBrowserModal';
import {
  groupMemoriesByDate,
  groupMemoriesByKind,
  workshopMemoryManagerView,
  workshopMemoryTitleRule,
  type WorkshopMemoryManagerInput,
  type WorkshopMemoryRowView
} from '@hooks/domain/workshop/memory/workshopMemoryManagerView';
import {
  WORKSHOP_MEMORY_TITLE_CHARACTERS,
  type WorkshopMemoryWorkspace
} from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import { WorkshopMemoryAttentionRow, WorkshopMemoryRow, type WorkshopMemoryRowActions } from './WorkshopMemoryRow';

export interface WorkshopMemoryBrowserModalProps extends WorkshopMemoryManagerInput, WorkshopMemoryRowActions {
  open: boolean;
  workspace: WorkshopMemoryWorkspace;
  query: string;
  /** A manager action is in flight: rows' writes wait for it. */
  actionPending: boolean;
  /** The latest refused action, in the host's words. */
  actionError?: string;
  /** The clock the date groups read; now by default. */
  now?: Date;
  onQueryChange: (query: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenFolder: () => void;
  onNewMemory: () => void;
  onClose: () => void;
}

const UNAVAILABLE: Record<'no-workspace' | 'multi-root', string> = {
  'no-workspace': 'Project memory isn’t available here: no folder is open. Open a single folder to use project memory.',
  'multi-root': 'Project memory isn’t available here: this workspace has several folders. Open a single folder to use project memory.'
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryBrowserModal: React.FC<WorkshopMemoryBrowserModalProps> = ({
  open,
  workspace,
  query,
  actionPending,
  actionError,
  now,
  onQueryChange,
  onRename,
  onDelete,
  onOpenFolder,
  onNewMemory,
  onClose,
  onEdit,
  onRestore,
  onArchive,
  onToggleLoadInFull,
  onOpenFile,
  ...input
}) => {
  const view = workshopMemoryManagerView(input);
  const available = workspace.kind === 'available';
  const writesLocked = actionPending || !available;
  // Rows are keyed by entry handle; a mutation names the memory's id, and is sent only while
  // this render's row may be written: listed, not busy, nothing pending, the workspace there (PR #199 F-01).
  const writable = new Map([...view.active, ...view.past]
    .filter((row) => !writesLocked && !row.entry.busy)
    .map((row) => [row.entry.entryKey, row.entry.id]));
  const groupings = React.useMemo<ReadonlyArray<SavedItemGrouping<WorkshopMemoryRowView>>>(() => [
    { key: 'kind', label: 'Kind', group: (rows) => groupMemoriesByKind(rows) },
    { key: 'date', label: 'Date', group: (rows) => groupMemoriesByDate(rows, now) }
  ], [now]);
  const titleRule = React.useMemo(() => workshopMemoryTitleRule(WORKSHOP_MEMORY_TITLE_CHARACTERS), []);
  const actions: WorkshopMemoryRowActions = { onEdit, onRestore, onArchive, onToggleLoadInFull, onOpenFile };
  const byId = (send: (id: string) => void) => (entryKey: string) => {
    const id = writable.get(entryKey);
    if (id) {
      send(id);
    }
  };

  return (
    <SavedItemBrowserModal<WorkshopMemoryRowView>
      open={open}
      titleId="pm-ws-memory-browser-title"
      closeLabel="Close project memories"
      className="pm-ws-session-browser-modal pm-ws-memory-browser-modal"
      eyebrow="Workshop · Project memory"
      title="Project memories"
      description="What this project’s personas start each conversation knowing. Memories set to Always load in full arrive whole; the rest load as a title and summary, and a persona opens the full note when it needs it."
      search={{
        label: 'Search project memories',
        placeholder: 'Search titles, summaries and notes…',
        scope: 'searches notes',
        query,
        disabled: !available,
        onChange: onQueryChange
      }}
      groupLabel="Group memories by"
      groupings={groupings}
      status={
        <>
          {workspace.kind === 'unavailable' && (
            <div className="pm-ws-sessions-unavailable" role="status">
              <Icon name="doc" size={16} /> {UNAVAILABLE[workspace.reason]}
            </div>
          )}
          {workspace.kind === 'loading' && (
            <div className="pm-ws-sessions-pending" role="status">Reading this project’s memories…</div>
          )}
          {workspace.kind === 'unknown' && (
            <div className="pm-ws-sessions-unavailable" role="alert">
              <Icon name="x" size={14} /> The memory folder couldn’t be listed just now. Your memory files weren’t touched.
            </div>
          )}
          {actionError && (
            <div className="pm-ws-sessions-unavailable" role="alert">
              <Icon name="alert" size={14} /> {actionError}
            </div>
          )}
          {view.offNote && (
            <div className="pm-ws-memory-status-note" role="status">
              <Icon name="info" size={14} /> <span>{view.offNote}</span>
            </div>
          )}
          {view.overNote && (
            <div className="pm-ws-memory-status-note pm-ws-memory-status-warn" role="status">
              <Icon name="alert" size={14} /> <span>{view.overNote}</span>
            </div>
          )}
          <div className="pm-ws-memory-chips">
            {view.chips.map((chip) => (
              <span key={chip.text} className={`pm-ws-memory-chip${chip.warn ? ' pm-ws-memory-chip-warn' : ''}`}>{chip.text}</span>
            ))}
          </div>
        </>
      }
      leading={view.attention.length > 0 && (
        <section className="pm-ws-session-browser-section" aria-labelledby="pm-ws-memory-attention-heading">
          <div className="pm-ws-sessions-section-title" id="pm-ws-memory-attention-heading">
            {'Needs attention '}<span>Not loaded. Fix the file in the editor; Memory never rewrites it.</span>
          </div>
          {view.attention.map((row) => (
            <WorkshopMemoryAttentionRow key={row.entryKey} row={row} disabled={!available} onOpenFile={onOpenFile} />
          ))}
        </section>
      )}
      section={{ id: 'pm-ws-memory-active-heading', title: 'Active', note: 'Load at the start of each conversation.' }}
      afterSection={{
        id: 'pm-ws-memory-past-heading',
        title: 'Superseded and archived',
        note: 'Never loaded. Personas find them only by searching.',
        items: view.past
      }}
      emptyText={query.trim() ? 'No active memories match this search.' : 'No active memories yet.'}
      items={view.active}
      itemKey={(row) => row.entry.entryKey}
      itemTitle={(row) => row.entry.title}
      renderRow={(row, controls) => (
        <WorkshopMemoryRow
          row={row}
          controls={controls}
          disabled={writesLocked || row.entry.busy}
          openDisabled={!available}
          {...actions}
        />
      )}
      footer={
        <>
          <span>Changes save to the memory’s file right away. Archive keeps a memory searchable; Delete removes its file.</span>
          <button className="pm-ws-session-secondary" type="button" disabled={!available} onClick={onOpenFolder}>
            Open memory folder
          </button>
          <button className="pm-ws-session-primary" type="button" disabled={!available} onClick={onNewMemory}>
            <Icon name="plus" size={13} /> New memory
          </button>
        </>
      }
      onRename={(entryKey, title) => byId((id) => onRename(id, title))(entryKey)}
      onDelete={byId(onDelete)}
      onClose={onClose}
      renameRule={titleRule}
      sendOnlyEdits
      returnFocus
    />
  );
};
