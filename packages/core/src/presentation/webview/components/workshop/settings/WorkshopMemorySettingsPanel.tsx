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
 *
 * "Suggest notes" (how readily personas suggest, Round Two item B) is not a
 * draft: a choice is saved at once through `onSelectSuggestions`, and
 * the selected card is the level the host holds. Its words come from
 * `workshopMemorySuggestionsView`.
 *
 * "List at the start of each conversation" (the list size, Round Two item
 * C) saves at once the same way, through `onSelectListSize`. The selected
 * card is the size the host's listing carries, and its words come from
 * `workshopMemoryListSizeView`: it applies from the next conversation.
 */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import {
  workshopMemoryTabView,
  type WorkshopMemoryMeterView,
  type WorkshopMemoryTabInput
} from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import type { WorkshopProjectMemoryMode } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';
import { workshopMemorySuggestionsView } from '@hooks/domain/workshop/memory/workshopMemorySuggestionsView';
import type { WorkshopMemorySuggestionLevel } from '@shared/constants/workshopMemorySuggestions';
import { workshopMemoryListSizeView } from '@hooks/domain/workshop/memory/workshopMemoryListSizeView';
import {
  DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE,
  type WorkshopProjectMemoryListSize
} from '@shared/constants/workshopProjectMemoryListSizes';
import type { WorkshopMemoryFolderStatus } from '@hooks/domain/workshop/useWorkshopMemoryManager';
import { OptionCard, SettingsRule } from './WorkshopConversationSettingsControls';

const MODE_ICONS: Record<WorkshopProjectMemoryMode, IconName> = {
  off: 'circleSlash',
  ask: 'hand',
  auto: 'stamp'
};

const SUGGESTION_ICONS: Record<WorkshopMemorySuggestionLevel, IconName> = {
  sparingly: 'bookmark',
  readily: 'plus',
  aggressively: 'bolt'
};

const LIST_SIZE_ICONS: Record<WorkshopProjectMemoryListSize, IconName> = {
  standard: 'doc',
  larger: 'plus',
  largest: 'bolt'
};

export interface WorkshopMemorySettingsPanelProps extends WorkshopMemoryTabInput {
  /** The modal's apply is pending: the draft can't change. */
  disabled: boolean;
  /** Open memory folder, pressed here or in the manager: waiting, or why it didn't open (PR #202 F04). */
  folderStatus?: WorkshopMemoryFolderStatus;
  /** Whether "Memory isn't context" shows its table; the writer folds it away (`useWorkshopMemoryExplainer`). */
  explainerOpen: boolean;
  onToggleExplainer: () => void;
  onSelectMode: (mode: WorkshopProjectMemoryMode) => void;
  /** How readily personas suggest notes, as the host holds it. */
  suggestions: WorkshopMemorySuggestionLevel;
  /** A response is running or an apply is pending: the level can't change now. */
  suggestionsDisabled: boolean;
  /** Saves the level at once; the selected card moves when the host answers. */
  onSelectSuggestions: (level: WorkshopMemorySuggestionLevel) => void;
  /** Saves the list size at once; the selected card moves when the host's listing says so. Absent draws the row read-only. */
  onSelectListSize?: (size: WorkshopProjectMemoryListSize) => void;
  onOpenManager: () => void;
  onOpenFolder: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemorySettingsPanel: React.FC<WorkshopMemorySettingsPanelProps> = ({
  disabled,
  folderStatus,
  explainerOpen,
  onToggleExplainer,
  onSelectMode,
  suggestions,
  suggestionsDisabled,
  onSelectSuggestions,
  onSelectListSize,
  onOpenManager,
  onOpenFolder,
  ...input
}) => {
  const view = workshopMemoryTabView(input);
  const suggest = workshopMemorySuggestionsView({ level: suggestions, mode: input.mode });
  const listSize = workshopMemoryListSizeView(input.listSize ?? DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE);
  const noticeId = React.useId();
  const folderErrorId = React.useId();
  const explainerId = React.useId();
  return (
    <>
      {view.notice && (
        <div className="pm-ws-memory-notice" role="status">
          <Icon name="alert" size={14} />
          <span id={noticeId}><b>{view.notice.title}</b> {view.notice.text}</span>
        </div>
      )}

      <section className="pm-ws-memory-vs" aria-labelledby="pm-ws-memory-vs-title">
        <button
          type="button"
          className="pm-ws-memory-vs-head"
          aria-expanded={explainerOpen}
          aria-controls={explainerId}
          onClick={onToggleExplainer}
        >
          <Icon name="info" size={14} />
          <b id="pm-ws-memory-vs-title">Memory isn’t context.</b>
          <span>They reach personas differently.</span>
          <span className="pm-ws-memory-vs-chev" aria-hidden="true">
            <Icon name="chevRight" size={12} />
          </span>
        </button>
        <dl id={explainerId} className="pm-ws-memory-vs-grid" hidden={!explainerOpen}>
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

      <SettingsRule label="Suggest notes" />
      <div className="pm-ws-behavior-cards" role="group" aria-label="Suggest notes">
        {suggest.cards.map((card) => (
          <OptionCard
            key={card.level}
            selected={card.selected}
            disabled={suggestionsDisabled}
            icon={<Icon name={SUGGESTION_ICONS[card.level]} size={14} />}
            name={card.name}
            description={card.description}
            onClick={() => {
              if (!card.selected) {
                onSelectSuggestions(card.level);
              }
            }}
          />
        ))}
      </div>
      {suggest.notes.map((note) => <p key={note} className="pm-ws-behavior-note">{note}</p>)}

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

      <SettingsRule label={listSize.label} />
      <div className="pm-ws-behavior-cards" role="group" aria-label={listSize.label}>
        {listSize.cards.map((card) => (
          <OptionCard
            key={card.size}
            selected={card.selected}
            disabled={suggestionsDisabled || !onSelectListSize}
            icon={<Icon name={LIST_SIZE_ICONS[card.size]} size={14} />}
            name={card.name}
            description={card.description}
            onClick={() => {
              if (!card.selected) {
                onSelectListSize?.(card.size);
              }
            }}
          />
        ))}
      </div>
      {listSize.notes.map((note) => <p key={note} className="pm-ws-behavior-note">{note}</p>)}

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
      aria-label={meter.label}
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
