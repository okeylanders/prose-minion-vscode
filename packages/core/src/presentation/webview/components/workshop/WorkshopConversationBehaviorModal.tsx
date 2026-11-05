/**
 * Conversation Settings — Behavior and global writer-profile drafts.
 *
 * The modal owns the drafts, the pending apply and the tab strip; each tab's
 * panel draws its own controls (`settings/`). The strip, its ARIA wiring and
 * its keys come from `WORKSHOP_CONVERSATION_SETTINGS_TABS`.
 */

import * as React from 'react';
import { WorkshopModalShell } from './WorkshopModalShell';
import {
  workshopConversationBehaviorsEqual,
  workshopWriterProfilesEqual,
  WorkshopConversationBehavior,
  WorkshopWriterProfile,
  WorkshopWebResearchSettings,
  workshopWebResearchSettingsEqual,
  type WorkshopProjectMemoryMode
} from '@messages';
import {
  WORKSHOP_CONVERSATION_SETTINGS_TABS,
  WorkshopConversationSettingsTab,
  workshopConversationSettingsTabForKey
} from './settings/workshopConversationSettingsTabs';
import { WorkshopBehaviorSettingsPanel } from './settings/WorkshopBehaviorSettingsPanel';
import { WorkshopAboutYouSettingsPanel } from './settings/WorkshopAboutYouSettingsPanel';
import { WorkshopAdvancedSettingsPanel } from './settings/WorkshopAdvancedSettingsPanel';
import { WorkshopMemorySettingsPanel } from './settings/WorkshopMemorySettingsPanel';
import {
  WorkshopPinnedContextSettingsPanel,
  type WorkshopPinnedContextSettingsPanelProps
} from './settings/WorkshopPinnedContextSettingsPanel';
import type { WorkshopMemoryTabInput } from '@hooks/domain/workshop/memory/workshopMemoryTabView';
import type { WorkshopMemoryFolderStatus } from '@hooks/domain/workshop/useWorkshopMemoryManager';

interface PendingApply {
  submittedBehavior: WorkshopConversationBehavior;
  submittedProfile: WorkshopWriterProfile;
  baselineBehavior: WorkshopConversationBehavior;
  baselineProfile: WorkshopWriterProfile;
  submittedWebResearch: WorkshopWebResearchSettings;
  submittedMemoryMode: WorkshopProjectMemoryMode;
}

interface WorkshopConversationBehaviorModalProps {
  open: boolean;
  behavior: WorkshopConversationBehavior;
  writerProfile: WorkshopWriterProfile;
  webResearch: WorkshopWebResearchSettings;
  /** The global project-memory mode, as the host has it (ADR 2026-11-04 D8). */
  projectMemoryMode: WorkshopProjectMemoryMode;
  /** What the Memory tab draws from the host's listing; the mode is the modal's draft. */
  memory: Omit<WorkshopMemoryTabInput, 'mode'>;
  /** Open memory folder's status, shown in the Memory tab (PR #202 F04). */
  memoryFolder?: WorkshopMemoryFolderStatus;
  /** The Pinned context tab: the host's list and its actions, which save at once (not a draft). */
  pinnedContext: WorkshopPinnedContextSettingsPanelProps;
  /** Whether the Memory tab's "Memory isn't context" table shows: this viewer's choice. */
  memoryExplainerOpen: boolean;
  onToggleMemoryExplainer: () => void;
  isRunning: boolean;
  errorMessage?: string;
  onApply: (
    behavior: WorkshopConversationBehavior,
    writerProfile: WorkshopWriterProfile,
    webResearch: WorkshopWebResearchSettings,
    projectMemoryMode: WorkshopProjectMemoryMode
  ) => void;
  /** Manage memories… and Show in manager: the manager opens over these settings, which keep their drafts. */
  onOpenMemoryManager: () => void;
  onOpenMemoryFolder: () => void;
  onClose: () => void;
}

const FIRST_TAB = WORKSHOP_CONVERSATION_SETTINGS_TABS[0].id;

export const WorkshopConversationBehaviorModal: React.FC<WorkshopConversationBehaviorModalProps> = ({
  open,
  behavior,
  writerProfile,
  webResearch,
  projectMemoryMode,
  memory,
  memoryFolder,
  pinnedContext,
  memoryExplainerOpen,
  onToggleMemoryExplainer,
  isRunning,
  errorMessage,
  onApply,
  onOpenMemoryManager,
  onOpenMemoryFolder,
  onClose
}) => {
  const [tab, setTab] = React.useState<WorkshopConversationSettingsTab>(FIRST_TAB);
  const [behaviorDraft, setBehaviorDraft] = React.useState({ ...behavior });
  const [profileDraft, setProfileDraft] = React.useState({ ...writerProfile });
  const [webResearchDraft, setWebResearchDraft] = React.useState({ ...webResearch });
  const [memoryDraft, setMemoryDraft] = React.useState<WorkshopProjectMemoryMode>(projectMemoryMode);
  const [pending, setPending] = React.useState<PendingApply | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const tabRefs = React.useRef<Partial<Record<WorkshopConversationSettingsTab, HTMLButtonElement | null>>>({});

  React.useEffect(() => {
    if (open) {
      setTab(FIRST_TAB);
      setBehaviorDraft({ ...behavior });
      setProfileDraft({ ...writerProfile });
      setWebResearchDraft({ ...webResearch });
      setMemoryDraft(projectMemoryMode);
      setPending(null);
      setConfirmClear(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!pending) return;
    if (!open) {
      setPending(null);
      return;
    }
    if (
      workshopConversationBehaviorsEqual(behavior, pending.submittedBehavior)
      && workshopWriterProfilesEqual(writerProfile, pending.submittedProfile)
      && workshopWebResearchSettingsEqual(webResearch, pending.submittedWebResearch)
      && projectMemoryMode === pending.submittedMemoryMode
    ) {
      setPending(null);
      onClose();
    } else if (
      !workshopConversationBehaviorsEqual(behavior, pending.baselineBehavior)
      || !workshopWriterProfilesEqual(writerProfile, pending.baselineProfile)
    ) {
      setPending(null);
    }
  }, [behavior, onClose, open, pending, projectMemoryMode, webResearch, writerProfile]);

  React.useEffect(() => {
    if (pending && errorMessage) setPending(null);
  }, [errorMessage, pending]);

  const editingLocked = pending !== null;
  const applyLocked = isRunning || editingLocked;
  const switchTab = (next: WorkshopConversationSettingsTab) => {
    setTab(next);
    setConfirmClear(false);
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = workshopConversationSettingsTabForKey(WORKSHOP_CONVERSATION_SETTINGS_TABS, tab, event.key);
    if (!next) return;
    event.preventDefault();
    switchTab(next);
    tabRefs.current[next]?.focus();
  };
  const apply = () => {
    if (applyLocked) return;
    const submittedBehavior = { ...behaviorDraft };
    const submittedProfile = {
      ...profileDraft,
      preferredAddress: profileDraft.preferredAddress.trim(),
      bio: profileDraft.bio.trim()
    };
    onApply(submittedBehavior, submittedProfile, webResearchDraft, memoryDraft);
    setPending({
      submittedBehavior,
      submittedProfile,
      baselineBehavior: { ...behavior },
      baselineProfile: { ...writerProfile },
      submittedWebResearch: { ...webResearchDraft },
      submittedMemoryMode: memoryDraft
    });
  };

  /* Exhaustive by tab, so a new entry in the tab list does not compile
     without its panel. */
  const panels: Record<WorkshopConversationSettingsTab, () => React.ReactNode> = {
    behavior: () => (
      <WorkshopBehaviorSettingsPanel
        draft={behaviorDraft}
        disabled={editingLocked}
        onDraftChange={setBehaviorDraft}
      />
    ),
    profile: () => (
      <WorkshopAboutYouSettingsPanel
        draft={profileDraft}
        disabled={editingLocked}
        onDraftChange={setProfileDraft}
        confirmClear={confirmClear}
        onConfirmClearChange={setConfirmClear}
      />
    ),
    // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the tab's id, as the slice spec names it.
    'pinned-context': () => <WorkshopPinnedContextSettingsPanel {...pinnedContext} />,
    memory: () => (
      <WorkshopMemorySettingsPanel
        {...memory}
        mode={memoryDraft}
        disabled={editingLocked}
        {...(memoryFolder ? { folderStatus: memoryFolder } : {})}
        explainerOpen={memoryExplainerOpen}
        onToggleExplainer={onToggleMemoryExplainer}
        onSelectMode={setMemoryDraft}
        onOpenManager={onOpenMemoryManager}
        onOpenFolder={onOpenMemoryFolder}
      />
    ),
    advanced: () => (
      <WorkshopAdvancedSettingsPanel
        draft={webResearchDraft}
        disabled={editingLocked}
        onDraftChange={setWebResearchDraft}
      />
    )
  };
  const activeTab = WORKSHOP_CONVERSATION_SETTINGS_TABS.find((entry) => entry.id === tab)
    ?? WORKSHOP_CONVERSATION_SETTINGS_TABS[0];

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-settings-title"
      closeLabel="Close conversation settings"
      className="pm-ws-behavior-modal"
      onClose={onClose}
    >
      <div className="pm-ws-tools-modal-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Room settings</div>
          <h2 id="pm-ws-settings-title">Conversation settings</h2>
          <p>Choose how Workshop personas respond, what they may proactively offer, what you explicitly share and attach to every new conversation, what they remember about this project, and whether they may research the live web.</p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-settings-tabs" role="tablist" aria-label="Conversation settings sections">
        {WORKSHOP_CONVERSATION_SETTINGS_TABS.map((entry) => (
          <button
            key={entry.id}
            ref={(element) => { tabRefs.current[entry.id] = element; }}
            type="button"
            role="tab"
            id={entry.tabElementId}
            aria-selected={tab === entry.id}
            aria-controls={entry.panelElementId}
            tabIndex={tab === entry.id ? 0 : -1}
            onClick={() => switchTab(entry.id)}
            onKeyDown={handleTabKeyDown}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        className={activeTab.panelClassName}
        role="tabpanel"
        id={activeTab.panelElementId}
        aria-labelledby={activeTab.tabElementId}
      >
        {panels[activeTab.id]()}
      </div>

      <div className="pm-ws-behavior-foot">
        {pending ? (
          <span
            className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy"
            role="status"
          >
            Conversation settings are updating…
          </span>
        ) : isRunning ? (
          <span
            className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy"
            role="status"
          >
            A response is in progress — changes are available when it finishes.
          </span>
        ) : (
          <span className="pm-ws-behavior-foot-note">
            Applies the Behavior, About You, Memory, and Advanced drafts together. Pinned context saves as you change it and applies to new conversations. Memory and live web research take effect on your next message.
          </span>
        )}
        <button className="pm-ws-action-btn" type="button" onClick={onClose}>Cancel</button>
        <button className="pm-ws-primary-btn" type="button" disabled={applyLocked} onClick={apply}>Apply to next turn</button>
      </div>
    </WorkshopModalShell>
  );
};
