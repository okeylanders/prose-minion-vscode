/**
 * Conversation settings · Pinned context (ADR 2026-11-04 D8; Pinned Context
 * Slice 3; Slice 0d's approved boards). Presentational: it takes the tab's
 * view (`workshopPinnedContextTabView`), the hook's last answer and
 * callbacks, and posts nothing.
 *
 * - The template well heads the tab in every state, below any notice. Its
 *   heading is a disclosure (`aria-expanded`, `aria-controls`); whether it
 *   is open is the hook's one persisted preference.
 * - The rows sit in a scrollable well about six rows tall, so the dialog
 *   doesn't grow with the list; the amber line above it counts every row
 *   that won't attach. A row moved past the fold is scrolled into view, and
 *   the focus stays on its Move button.
 * - Every change saves at once, through the host; nothing here is a draft.
 *
 * Its entry in `WORKSHOP_CONVERSATION_SETTINGS_TABS` sits between About you
 * and Memory; the modal draws its tabpanel wrapper as for every tab.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { PROJECT_RESOURCE_GROUP_LABELS } from '@components/fulltab/ProjectResourcePickerModal';
import type {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  WorkshopPinnedContextPayload
} from '@messages';
import type { WorkshopPinnedContextTabView } from '@hooks/domain/workshop/pinnedContext/workshopPinnedContextTabView';
import type { UseWorkshopPinnedContextReturn } from '@hooks/domain/workshop/useWorkshopPinnedContext';
import type { UseWorkshopRoomReturn } from '@hooks/domain/workshop/useWorkshopRoom';
import { SettingsRule } from './WorkshopConversationSettingsControls';
import { WorkshopPinnedContextPicker } from './WorkshopPinnedContextPicker';

export interface WorkshopPinnedContextSettingsPanelProps {
  view: WorkshopPinnedContextTabView;
  /** The host's last answer: its notice says what the latest change came to. */
  answer?: WorkshopPinnedContextPayload;
  pendingRequestIds?: readonly string[];
  noteOpen: boolean;
  /** The picker's catalog and search, as Choose from project has them. */
  catalog: ConfiguredResourceEntry[] | null;
  searchResults: ConfiguredResourceSearchResults | null;
  onRequestList: () => void;
  onRequestCatalog: () => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onToggleNote: () => void;
  onPinResources: (items: ConfiguredResourceRef[]) => string | undefined;
  onPinAttachments: (attachmentIds: readonly string[]) => string | undefined;
  onPinPickedFile: () => string | undefined;
  onUnpin: (entryPath: string) => string | undefined;
  onMove: (entryPath: string, direction: 'up' | 'down') => string | undefined;
  onAttachMissing: () => string;
  onOpenFile: (entryPath?: string) => string;
}

const NOTE_BODY_ID = 'pm-ws-pin-vs-body';
const ATTACH_WHY_ID = 'pm-ws-pin-attach-why';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopPinnedContextSettingsPanel: React.FC<WorkshopPinnedContextSettingsPanelProps> = ({
  view,
  answer,
  pendingRequestIds,
  noteOpen,
  catalog,
  searchResults,
  onRequestList,
  onRequestCatalog,
  onSearch,
  onClearSearch,
  onToggleNote,
  onPinResources,
  onPinAttachments,
  onPinPickedFile,
  onUnpin,
  onMove,
  onAttachMissing,
  onOpenFile
}) => {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const moved = React.useRef<{ path: string; direction: 'up' | 'down' } | undefined>(undefined);
  const wellRef = React.useRef<HTMLDivElement | null>(null);
  const noticeId = React.useId();

  // The tab reads the list as it is now each time it shows.
  React.useEffect(() => {
    onRequestList();
  }, [onRequestList]);

  // A moved row stays in view, with the focus on its Move button (or the other one, at an end).
  React.useLayoutEffect(() => {
    const last = moved.current;
    const well = wellRef.current;
    if (!last || !well) {
      return;
    }
    const row = [...well.querySelectorAll<HTMLElement>('[data-pin-path]')].find((element) => element.dataset.pinPath === last.path);
    const button = row?.querySelector<HTMLButtonElement>(`[data-pin-move="${last.direction}"]:not(:disabled)`)
      ?? row?.querySelector<HTMLButtonElement>('[data-pin-move]:not(:disabled)');
    if (!row || !button) {
      return;
    }
    moved.current = undefined;
    row.scrollIntoView?.({ block: 'nearest' });
    button.focus();
  }, [view.rows]);

  const move = (entryPath: string, direction: 'up' | 'down') => {
    moved.current = { path: entryPath, direction };
    onMove(entryPath, direction);
  };
  const outcome = answer?.action && answer.action !== 'pin-resources' && answer.notice?.kind !== 'changed' ? answer.notice : undefined;
  const lockedBy = view.locked && view.notice ? noticeId : undefined;

  return (
    <>
      {view.notice && (
        <div className="pm-ws-memory-notice" role="status">
          <Icon name="alert" size={14} />
          <span id={noticeId}><b>{view.notice.title}</b> {view.notice.text}</span>
        </div>
      )}

      <section className="pm-ws-memory-vs pm-ws-pin-vs" aria-labelledby="pm-ws-pin-vs-title">
        <button
          className="pm-ws-pin-vs-toggle"
          type="button"
          aria-expanded={noteOpen}
          aria-controls={NOTE_BODY_ID}
          onClick={onToggleNote}
        >
          <Icon name="info" size={14} />
          <b id="pm-ws-pin-vs-title">Pinned context is a starting template.</b>
          <span>Each new conversation copies it once, then keeps its own.</span>
          <span className={`pm-ws-pin-vs-chevron${noteOpen ? ' pm-ws-pin-vs-chevron-open' : ''}`} aria-hidden="true">
            <Icon name="chevDown" size={14} />
          </span>
        </button>
        <div id={NOTE_BODY_ID} hidden={!noteOpen}>
          <dl className="pm-ws-memory-vs-grid pm-ws-pin-vs-grid">
            <dt className="pm-ws-memory-vs-corner" aria-hidden="true" />
            <dd className="pm-ws-memory-vs-col">Pinned context</dd>
            <dd className="pm-ws-memory-vs-col">A conversation’s context</dd>
            <dt>Change it</dt>
            <dd>Here, in this tab</dd>
            <dd>In that conversation’s Context panel, any time</dd>
            <dt>Reaches</dt>
            <dd>Every new conversation in this project, as it starts</dd>
            <dd>That conversation only</dd>
            <dt>Holds</dt>
            <dd>Files most conversations need: characters, places, the project brief</dd>
            <dd>Whatever the conversation needs, starting with the pinned files</dd>
          </dl>
          <p className="pm-ws-pin-vs-foot">Removing a file from a conversation doesn’t unpin it. Unpinning a file doesn’t remove it from conversations that have already started.</p>
        </div>
      </section>

      {view.changed && (
        <div className="pm-ws-pin-info" role="status">
          <Icon name="info" size={14} />
          <span><b>Pinned context changed in another window.</b> This is the current list.</span>
        </div>
      )}

      <SettingsRule label="Pinned context" />
      <div className="pm-ws-behavior-row pm-ws-pin-summary" role="group" aria-label="Pinned context">
        <div className="pm-ws-behavior-row-text">
          <div className="pm-ws-behavior-row-name">{view.summary.name}</div>
          <div className="pm-ws-behavior-row-desc">{view.summary.description}</div>
          {view.summary.meter && (
            <>
              <div
                className="pm-ws-memory-meter"
                role="meter"
                aria-label="Pinned context"
                aria-valuemin={0}
                aria-valuemax={view.summary.meter.max}
                aria-valuenow={view.summary.meter.value}
                aria-valuetext={view.summary.meter.valueText}
              >
                <div
                  className={`pm-ws-memory-meter-fill${view.summary.meter.full ? ' pm-ws-memory-meter-full' : ''}`}
                  style={{ width: `${view.summary.meter.percent}%` }}
                />
              </div>
              <div className="pm-ws-memory-meter-cap" aria-hidden="true">
                <span>{view.summary.meter.left}</span>
                <span>{view.summary.meter.right}</span>
              </div>
            </>
          )}
        </div>
        <div className="pm-ws-memory-readout">
          {view.summary.chips.map((chip) => (
            <span key={chip.text} className={`pm-ws-memory-chip${chip.quiet ? ' pm-ws-memory-chip-quiet' : ''}`}>{chip.text}</span>
          ))}
        </div>
      </div>
      {view.more && (
        <div className="pm-ws-memory-more" role="status">
          <Icon name="alert" size={13} />
          <span>{view.more}</span>
        </div>
      )}
      {view.showStartNote && (
        <p className="pm-ws-behavior-note">New session and New session: full reset start with these files, in this order. New session: full reset, empty context starts with none. Opening, branching or rewinding a saved session leaves its context as it was.</p>
      )}

      {view.showList && (
        <>
          <SettingsRule label={`Files, in order · ${view.rows.length}`} />
          <div className="pm-ws-pin-well" ref={wellRef}>
            <ol className="pm-ws-pin-list" aria-label="Pinned files, in the order new conversations attach them">
              {view.rows.map((row) => (
                <li key={row.path} className={`pm-ws-pin-row${row.issue ? ' pm-ws-pin-row-warn' : ''}`} data-pin-path={row.path}>
                  <span className="pm-ws-pin-pos" aria-hidden="true">{row.position}</span>
                  <span className="pm-ws-pin-glyph" aria-hidden="true"><Icon name="doc" size={14} /></span>
                  <div className="pm-ws-pin-text">
                    <div className="pm-ws-pin-name">
                      <span>{row.name}</span>
                      {row.group && <span className="pm-ws-pin-tag">{PROJECT_RESOURCE_GROUP_LABELS[row.group]}</span>}
                      {row.here && <span className="pm-ws-pin-here"><Icon name="check" size={11} />In this conversation</span>}
                    </div>
                    <div className="pm-ws-pin-path">{row.path}</div>
                    {row.issue && <div className="pm-ws-pin-issue"><Icon name="alert" size={11} /><span>{row.issue}</span></div>}
                    {row.note && <div className="pm-ws-pin-note">{row.note}</div>}
                  </div>
                  <span className="pm-ws-pin-words">{row.wordsText}</span>
                  <div className="pm-ws-pin-utils">
                    <button className="pm-ws-pin-move" type="button" data-pin-move="up" aria-label={`Move ${row.name} up`} disabled={row.upDisabled} onClick={() => move(row.path, 'up')}>
                      <span className="pm-ws-pin-up" aria-hidden="true"><Icon name="chevDown" size={13} /></span>
                    </button>
                    <button className="pm-ws-pin-move" type="button" data-pin-move="down" aria-label={`Move ${row.name} down`} disabled={row.downDisabled} onClick={() => move(row.path, 'down')}>
                      <Icon name="chevDown" size={13} />
                    </button>
                    <button className="pm-ws-action-btn" type="button" aria-label={`Open ${row.name}`} disabled={row.openDisabled} onClick={() => onOpenFile(row.path)}>Open</button>
                    <button className="pm-ws-action-btn" type="button" aria-label={`Unpin ${row.name}`} disabled={row.unpinDisabled} onClick={() => onUnpin(row.path)}>Unpin</button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      <div className="pm-ws-pin-actions">
        <button
          className="pm-ws-primary-btn"
          type="button"
          disabled={view.locked}
          aria-describedby={lockedBy}
          onClick={() => {
            onRequestCatalog();
            setPickerOpen(true);
          }}
        >
          <Icon name="plus" size={13} /> Add from project…
        </button>
        <button
          className="pm-ws-action-btn"
          type="button"
          disabled={view.pinAttached.disabled}
          aria-describedby={lockedBy}
          onClick={() => onPinAttachments(view.pinAttached.ids)}
        >
          <Icon name="pin" size={13} /> Pin what’s attached now ({view.pinAttached.ids.length})
        </button>
        {view.attachMissing.show && (
          <button
            className="pm-ws-action-btn"
            type="button"
            disabled={view.attachMissing.disabled}
            aria-describedby={view.attachMissing.runningNote ? ATTACH_WHY_ID : undefined}
            onClick={onAttachMissing}
          >
            Attach missing to this conversation ({view.attachMissing.count})
          </button>
        )}
      </div>
      {view.attachMissing.runningNote && (
        <p className="pm-ws-behavior-note" id={ATTACH_WHY_ID}>Wait for the reply to finish to attach files to this conversation. Pinning and unpinning still work, and apply to new conversations.</p>
      )}
      {outcome && (
        <div className={outcome.kind === 'done' ? 'pm-ws-pin-info' : 'pm-ws-memory-more'} role={outcome.kind === 'done' ? 'status' : 'alert'}>
          <Icon name={outcome.kind === 'done' ? 'check' : 'alert'} size={13} />
          <span>{outcome.text}</span>
        </div>
      )}
      {view.showSourceNote && <p className="pm-ws-behavior-note">Pin files from this project only.</p>}

      <SettingsRule label="Saved in this project" />
      <div className={`pm-ws-behavior-row pm-ws-memory-folder${view.file.warn ? ' pm-ws-memory-attention' : ''}`}>
        <div className="pm-ws-behavior-row-text">
          <div className="pm-ws-behavior-row-name"><span className="pm-ws-memory-path">prose-minion/pinned-context.json</span></div>
          <div className="pm-ws-behavior-row-desc">{view.file.description}</div>
        </div>
        <div className="pm-ws-memory-buttons">
          <button className="pm-ws-action-btn" type="button" disabled={view.file.openDisabled} onClick={() => onOpenFile()}>Open file</button>
        </div>
      </div>

      <WorkshopPinnedContextPicker
        open={pickerOpen}
        catalog={catalog}
        searchResults={searchResults}
        pinnedPaths={view.pinnedPaths}
        remainingWords={view.remainingWords}
        {...(answer ? { answer } : {})}
        {...(pendingRequestIds ? { pendingRequestIds } : {})}
        onSearch={onSearch}
        onClearSearch={onClearSearch}
        onPin={onPinResources}
        onExplore={() => { onPinPickedFile(); }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
};

/** The panel's props from the hook and the room's catalog: WorkshopApp's one line for the tab. */
export function workshopPinnedContextPanelProps(
  pinned: UseWorkshopPinnedContextReturn,
  room: Pick<UseWorkshopRoomReturn, 'contextCatalog' | 'contextSearch' | 'requestContextCatalog' | 'searchContextResources' | 'clearContextSearch'>
): WorkshopPinnedContextSettingsPanelProps {
  return {
    view: pinned.view,
    ...(pinned.answer ? { answer: pinned.answer } : {}),
    pendingRequestIds: pinned.pendingRequestIds,
    noteOpen: pinned.noteOpen,
    catalog: room.contextCatalog,
    searchResults: room.contextSearch,
    onRequestList: pinned.requestList,
    onRequestCatalog: room.requestContextCatalog,
    onSearch: room.searchContextResources,
    onClearSearch: room.clearContextSearch,
    onToggleNote: pinned.toggleNote,
    onPinResources: pinned.pinResources,
    onPinAttachments: pinned.pinAttachments,
    onPinPickedFile: pinned.pinPickedFile,
    onUnpin: pinned.unpin,
    onMove: pinned.move,
    onAttachMissing: pinned.attachMissing,
    onOpenFile: pinned.openFile
  };
}
