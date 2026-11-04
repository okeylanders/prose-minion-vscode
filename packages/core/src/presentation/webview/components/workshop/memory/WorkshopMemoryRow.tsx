/**
 * The memory manager's rows (Slice 4b-ui). A memory's row is the shared
 * `SavedItemRow` (its rename and delete-with-confirm included); its own
 * utilities are Always load in full (a toggle, the `eye` glyph: the UI
 * never says "pin"), Archive and Open file. A file that needs attention
 * is drawn with the same row classes but offers Open file only (a set-aside
 * copy, none: its row names the standing file beside it); no rename,
 * Always load in full, archive, edit or delete can reach it (ADR D10).
 */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import { SavedItemRow, type SavedItemRowControls } from '@components/fulltab/SavedItemRow';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import { WORKSHOP_MEMORY_TITLE_CHARACTERS } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import type {
  WorkshopMemoryAttentionRow as AttentionRowView,
  WorkshopMemoryRowView
} from '@hooks/domain/workshop/memory/workshopMemoryManagerView';

/** What a row can ask for: mutations by `mem-` id, a file by its `entryKey`. */
export interface WorkshopMemoryRowActions {
  onEdit: (id: string) => void;
  onRestore: (id: string) => void;
  onArchive: (id: string) => void;
  /** `loadInFull` is the state asked for: true to set Always load in full, false to turn it off. */
  onToggleLoadInFull: (id: string, loadInFull: boolean) => void;
  onOpenFile: (entryKey: string) => void;
}

const KIND_ICONS: Record<ProjectMemoryKind, IconName> = {
  decision: 'stamp',
  canon: 'book',
  preference: 'sliders',
  'open-thread': 'dialogue'
};

interface WorkshopMemoryRowProps extends WorkshopMemoryRowActions {
  row: WorkshopMemoryRowView;
  controls: SavedItemRowControls;
  /** Writes are off: an action in flight, no workspace, or another window holds the file. */
  disabled: boolean;
  /** Open file is off: no workspace. */
  openDisabled: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryRow: React.FC<WorkshopMemoryRowProps> = ({
  row,
  controls,
  disabled,
  openDisabled,
  onEdit,
  onRestore,
  onArchive,
  onToggleLoadInFull,
  onOpenFile
}) => {
  const { entry } = row;
  const past = !row.activeActions;
  // A rename open when the row locks is cancelled, so neither Enter nor the blur that follows sends it (PR #199 F-01).
  const { editing, cancelRename } = controls;
  React.useEffect(() => {
    if (editing && disabled) {
      cancelRename();
    }
  }, [cancelRename, disabled, editing]);
  return (
    <div className={`pm-ws-memory-row${past ? ' pm-ws-memory-row-past' : ''}`}>
      <SavedItemRow
        title={entry.title}
        disabled={disabled}
        glyph={
          <div className="pm-ws-memory-glyph" aria-hidden="true">
            <Icon name={KIND_ICONS[entry.kind]} size={17} />
          </div>
        }
        badges={row.badges.map((badge) => (
          <span key={badge.text} className={`pm-ws-session-badge pm-ws-memory-badge-${badge.tone}`}>{badge.text}</span>
        ))}
        metaTitle={[row.kindWords, row.origin, row.day, ...(past ? [] : [row.source])].join(' · ')}
        meta={
          <>
            <span>{row.kindWords}</span>
            <span>·</span>
            <span className="pm-ws-memory-who">{row.origin}</span>
            <span>·</span>
            <span>{row.day}</span>
            {!past && (
              <>
                <span>·</span>
                <span>{row.source}</span>
              </>
            )}
          </>
        }
        extra={
          <>
            <div className="pm-ws-session-row-preview" title={row.line}>{row.line}</div>
            {row.notes.map((note) => (
              <div key={note} className="pm-ws-memory-row-note" role="status">
                <Icon name="info" size={12} />
                <span>{note}</span>
              </div>
            ))}
          </>
        }
        renameLabel="Rename memory"
        renameMaxLength={WORKSHOP_MEMORY_TITLE_CHARACTERS}
        utilities={
          <>
            {row.activeActions && (
              <>
                <button
                  className={`pm-ws-session-icon${entry.pinned ? ' pm-ws-memory-toggle-on' : ''}`}
                  type="button"
                  disabled={disabled}
                  aria-pressed={entry.pinned}
                  aria-label={`Always load in full: ${entry.title}`}
                  onClick={() => onToggleLoadInFull(entry.id, !entry.pinned)}
                >
                  <Icon name="eye" size={13} />
                </button>
                <button
                  className="pm-ws-session-icon"
                  type="button"
                  disabled={disabled}
                  aria-label={`Archive ${entry.title}`}
                  onClick={() => onArchive(entry.id)}
                >
                  <Icon name="archive" size={13} />
                </button>
              </>
            )}
            <button
              className="pm-ws-session-icon"
              type="button"
              disabled={openDisabled}
              aria-label={`Open the file for ${entry.title}`}
              onClick={() => onOpenFile(entry.entryKey)}
            >
              <Icon name="doc" size={13} />
            </button>
          </>
        }
        primary={row.primary === 'restore' ? (
          <button className="pm-ws-session-secondary" type="button" disabled={disabled} onClick={() => onRestore(entry.id)}>
            Restore
          </button>
        ) : (
          <button className="pm-ws-session-secondary" type="button" disabled={disabled} onClick={() => onEdit(entry.id)}>
            Edit
          </button>
        )}
        controls={controls}
      />
    </div>
  );
};

/** A conflicting or unreadable file: the row classes, its reason, and Open file only (none for a set-aside copy). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryAttentionRow: React.FC<{
  row: AttentionRowView;
  disabled: boolean;
  onOpenFile: (entryKey: string) => void;
}> = ({ row, disabled, onOpenFile }) => (
  <div className="pm-ws-memory-row pm-ws-memory-row-attention">
    <article className="pm-ws-session-browser-row">
      <div className="pm-ws-memory-glyph" aria-hidden="true">
        <Icon name="alert" size={17} />
      </div>
      <div className="pm-ws-session-row-main">
        <div className="pm-ws-session-row-title">
          <strong className="pm-ws-memory-file" title={row.fileName}>{row.fileName}</strong>
          <span className="pm-ws-session-badge pm-ws-memory-badge-amber">{row.badge}</span>
        </div>
        <div className="pm-ws-session-row-meta" title={row.meta}><span>{row.meta}</span></div>
        <div className="pm-ws-session-row-preview" title={row.reason}>{row.reason}</div>
      </div>
      {row.canOpen && (
        <div className="pm-ws-session-row-actions">
          <button
            className="pm-ws-session-secondary"
            type="button"
            disabled={disabled}
            aria-label={`Open file ${row.fileName}`}
            onClick={() => onOpenFile(row.entryKey)}
          >
            Open file
          </button>
        </div>
      )}
    </article>
  </div>
);
