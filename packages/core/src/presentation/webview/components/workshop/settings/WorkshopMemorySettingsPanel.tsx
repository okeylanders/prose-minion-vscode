/**
 * Conversation settings · Memory (Workshop Project Memory, Slice 4b-ui;
 * Slice 0d's "The Memory tab"). Presentational: it takes the mode draft,
 * the host's estimate and listing, and callbacks, and posts nothing. The
 * words come from `workshopMemoryTabView`.
 *
 * Its entry in `WORKSHOP_CONVERSATION_SETTINGS_TABS` sits between About
 * you and Advanced; the modal draws its tabpanel wrapper as for every tab.
 *
 * The mode cards are a draft, applied with the other tabs' drafts; the
 * folder and manager buttons act at once. Unavailable never disables the
 * mode cards (ADR D8): the mode is global.
 */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import {
  workshopMemoryTabView,
  type WorkshopMemoryMeterView,
  type WorkshopMemoryTabInput
} from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import type { WorkshopProjectMemoryMode } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import type { WorkshopMemoryFolderStatus } from '@hooks/domain/workshop/useWorkshopMemoryManager';
import { OptionCard, SettingsRule } from './WorkshopConversationSettingsControls';

const MODE_ICONS: Record<WorkshopProjectMemoryMode, IconName> = {
  off: 'circleSlash',
  ask: 'hand',
  auto: 'stamp'
};

export interface WorkshopMemorySettingsPanelProps extends WorkshopMemoryTabInput {
  /** The modal's apply is pending: the draft can't change. */
  disabled: boolean;
  /** Open memory folder, pressed here or in the manager: waiting, or why it didn't open (PR #202 F04). */
  folderStatus?: WorkshopMemoryFolderStatus;
  onSelectMode: (mode: WorkshopProjectMemoryMode) => void;
  onOpenManager: () => void;
  onOpenFolder: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemorySettingsPanel: React.FC<WorkshopMemorySettingsPanelProps> = ({
  disabled,
  folderStatus,
  onSelectMode,
  onOpenManager,
  onOpenFolder,
  ...input
}) => {
  const view = workshopMemoryTabView(input);
  const noticeId = React.useId();
  const folderErrorId = React.useId();
  return (
    <>
      {view.notice && (
        <div className="pm-ws-memory-notice" role="status">
          <Icon name="alert" size={14} />
          <span id={noticeId}><b>{view.notice.title}</b> {view.notice.text}</span>
        </div>
      )}

      <section className="pm-ws-memory-vs" aria-labelledby="pm-ws-memory-vs-title">
        <div className="pm-ws-memory-vs-head">
          <Icon name="info" size={14} />
          <b id="pm-ws-memory-vs-title">Memory isn’t context.</b>
          <span>They reach personas differently.</span>
        </div>
        <dl className="pm-ws-memory-vs-grid">
          <dt className="pm-ws-memory-vs-corner" aria-hidden="true" />
          <dd className="pm-ws-memory-vs-col">Project memory</dd>
          <dd className="pm-ws-memory-vs-col">Context</dd>
          <dt>Reaches</dt>
          <dd>Every conversation in this project</dd>
          <dd>The conversation it’s attached to</dd>
          <dt>Holds</dt>
          <dd>A one-line summary of each memory, plus the few set to load in full. Personas open a full note only when they need it</dd>
          <dd>Whole files and passages, sent in full</dd>
          <dt>Size</dt>
          <dd>{view.well.memorySize}</dd>
          <dd>{view.well.contextSize}</dd>
        </dl>
      </section>

      <SettingsRule label="Project memory" />
      <div className="pm-ws-behavior-cards">
        {view.cards.map((card) => (
          <OptionCard
            key={card.mode}
            selected={card.selected}
            disabled={disabled}
            icon={<Icon name={MODE_ICONS[card.mode]} size={14} />}
            name={card.name}
            description={card.description}
            {...(card.recommended ? { tag: 'Recommended' } : {})}
            onClick={() => onSelectMode(card.mode)}
          />
        ))}
      </div>
      <p className="pm-ws-behavior-note">This setting applies to all your projects. Each project keeps its own memories, in its own folder.</p>

      <SettingsRule label="At the start of each conversation" />
      <div className="pm-ws-behavior-row pm-ws-memory-load" role="group" aria-label="At the start of each conversation">
        <div className="pm-ws-behavior-row-text">
          <div className="pm-ws-behavior-row-name">{view.load.name}</div>
          {view.load.description && (
            <div className="pm-ws-behavior-row-desc">{view.load.description}</div>
          )}
          {view.load.meters.map((meter) => <MemoryMeter key={meter.key} meter={meter} />)}
        </div>
        {view.load.chips.length > 0 && (
          <div className="pm-ws-memory-readout">
            {view.load.chips.map((chip) => (
              <span key={chip.text} className={`pm-ws-memory-chip${chip.quiet ? ' pm-ws-memory-chip-quiet' : ''}`}>{chip.text}</span>
            ))}
          </div>
        )}
      </div>
      {view.load.more.map((line) => (
        <div key={line} className="pm-ws-memory-more" role="status">
          <Icon name="search" size={13} />
          <span>{line}</span>
        </div>
      ))}

      <SettingsRule label="Your memories" />
      <div className="pm-ws-behavior-row pm-ws-memory-folder">
        <div className="pm-ws-behavior-row-text">
          <div className="pm-ws-behavior-row-name"><span className="pm-ws-memory-path">prose-minion/memory/</span></div>
          <div className="pm-ws-behavior-row-desc">{view.folder.description}</div>
        </div>
        <div className="pm-ws-memory-buttons">
          <button
            className="pm-ws-action-btn"
            type="button"
            disabled={view.folder.locked}
            aria-describedby={view.folder.locked && view.notice ? noticeId : folderStatus?.error ? folderErrorId : undefined}
            aria-busy={folderStatus?.pending || undefined}
            onClick={() => {
              if (!folderStatus?.pending) {
                onOpenFolder();
              }
            }}
          >
            Open memory folder
          </button>
          <button
            className="pm-ws-action-btn"
            type="button"
            disabled={view.folder.locked}
            aria-describedby={view.folder.locked && view.notice ? noticeId : undefined}
            onClick={onOpenManager}
          >
            Manage memories…
          </button>
        </div>
      </div>
      {folderStatus?.error && (
        <div className="pm-ws-memory-notice" role="alert">
          <Icon name="alert" size={14} />
          <span id={folderErrorId}><b>The memory folder didn’t open.</b> {folderStatus.error}</span>
        </div>
      )}
      {view.attention && (
        <div className="pm-ws-behavior-row pm-ws-memory-attention">
          <Icon name="doc" size={14} />
          <div className="pm-ws-behavior-row-text">
            <div className="pm-ws-behavior-row-name">{view.attention.title}</div>
            <div className="pm-ws-behavior-row-desc">{view.attention.description}</div>
            <ul className="pm-ws-memory-files">
              {view.attention.files.map((file) => (
                <li key={file.entryKey}>{file.fileName} <span>· {file.reason}</span></li>
              ))}
            </ul>
          </div>
          <div className="pm-ws-memory-buttons">
            <button className="pm-ws-action-btn" type="button" onClick={onOpenManager}>Show in manager</button>
          </div>
        </div>
      )}
    </>
  );
};

/** A budget meter: a `meter` role with the budget's figures, and its caption. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const MemoryMeter: React.FC<{ meter: WorkshopMemoryMeterView }> = ({ meter }) => (
  <>
    <div
      className="pm-ws-memory-meter"
      role="meter"
      aria-label={meter.key === 'full' ? 'Loaded in full' : 'Titles and summaries'}
      aria-valuemin={0}
      aria-valuemax={meter.max}
      aria-valuenow={meter.value}
      aria-valuetext={meter.valueText}
    >
      <div
        className={`pm-ws-memory-meter-fill${meter.full ? ' pm-ws-memory-meter-full' : ''}`}
        style={{ width: `${meter.percent}%` }}
      />
    </div>
    <div className="pm-ws-memory-meter-cap" aria-hidden="true">
      <span>{meter.left}</span>
      <span>{meter.right}</span>
    </div>
  </>
);
