/**
 * WorkshopContextSelectorModal — writer-controlled configured-resource
 * attachment (Sprint 12 Phase 4; design sources: the Intake Widgets comp's
 * Context Selector + the Model Browser comp's search-and-chips idiom).
 *
 * The picker itself (browse by category, name and content search, filter
 * pills, the "Explore project folders…" escape hatch, the overlay chrome) is
 * the shared full-tab `ProjectResourcePickerModal`, which the Lightbox's
 * source uses too (2026-10-20). This wrapper keeps what is the Workshop's
 * own: its three modes, their copy, which rows read as already attached, and
 * the message footer with its slot cap (the attach footer is the shared
 * ProjectResourceAttachFooter, which the Lightbox's context uses too).
 *
 * Word counts happen at attach time host-side; browse rows show byte sizes
 * and the running selection total is an honest ~estimate.
 *
 * Display-safe resolver paths only. The "Explore project folders…" escape
 * hatch routes through the host picker (WORKSHOP_ADD_CONTEXT_FILE).
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  ConfiguredResourceSearchResults,
  WorkshopContextAttachmentSnapshot,
  WorkshopMessageAttachmentSnapshot
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ProjectResourcePickerCopy,
  ProjectResourcePickerFooterState,
  ProjectResourcePickerModal,
  projectResourceKey
} from '@components/fulltab/ProjectResourcePickerModal';
import { ProjectResourceAttachFooter } from '@components/fulltab/ProjectResourceAttachFooter';

/** Every mode's escape hatch: the system picker, with the budget checked on add. */
const EXPLORE_NOTE = 'opens the system picker; budget checked on add';

const COPY: Record<'attach' | 'excerpt' | 'message', ProjectResourcePickerCopy> = {
  attach: {
    eyebrow: 'Add context',
    description: 'Your configured resource categories. Files chosen through Explore are picked with the system dialog instead.',
    exploreNote: EXPLORE_NOTE
  },
  excerpt: {
    eyebrow: 'Set excerpt',
    description: 'Pick one file to workshop — it becomes the working excerpt, head-sliced past the budget.',
    exploreNote: EXPLORE_NOTE
  },
  message: {
    eyebrow: 'Attach to message',
    description: 'These ride your next message only, then become ordinary history — no standing budget.',
    exploreNote: EXPLORE_NOTE
  }
};

interface WorkshopContextSelectorModalProps {
  open: boolean;
  /**
   * 'attach' = multi-select STANDING context attachments (default);
   * 'excerpt' = pick ONE resource as the working excerpt — clicking a row
   * confirms immediately, and attached context files stay selectable;
   * 'message' = multi-select one-shot attachments for the NEXT composer
   * message (Phase 6B thread-artifacts) — no standing budget, item-capped.
   */
  mode?: 'attach' | 'excerpt' | 'message';
  catalog: ConfiguredResourceEntry[] | null;
  attachments: WorkshopContextAttachmentSnapshot[];
  /** Message mode: attachments already staged for the next message. */
  pendingMessageAttachments?: WorkshopMessageAttachmentSnapshot[];
  searchResults: ConfiguredResourceSearchResults | null;
  remainingWords: number;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onConfirm: (items: ConfiguredResourceRef[]) => void;
  /** Excerpt mode only: the single picked resource. */
  onPickExcerpt?: (item: ConfiguredResourceRef) => void;
  onExplore: () => void;
  onClose: () => void;
}

/** The keys a staged or attached file answers to: its configured resource and its path. */
const attachmentKeys = (attachment: {
  configuredResource?: ConfiguredResourceRef;
  relativePath?: string;
}): string[] => {
  const keys: string[] = [];
  if (attachment.configuredResource) {
    keys.push(projectResourceKey(attachment.configuredResource));
  }
  if (attachment.relativePath) {
    keys.push(attachment.relativePath);
  }
  return keys;
};

export const WorkshopContextSelectorModal: React.FC<WorkshopContextSelectorModalProps> = ({
  open,
  mode = 'attach',
  catalog,
  attachments,
  pendingMessageAttachments = [],
  searchResults,
  remainingWords,
  onSearch,
  onClearSearch,
  onConfirm,
  onPickExcerpt,
  onExplore,
  onClose
}) => {
  const messageMode = mode === 'message';

  // Which rows read "already there": in message mode the staged next-message
  // attachments; otherwise the standing context list. The two lanes never
  // block each other — a standing file can still ride a single message.
  const attachedPaths = React.useMemo(
    () => new Set(
      messageMode
        ? pendingMessageAttachments.flatMap(attachmentKeys)
        : attachments
            .filter((attachment) => attachment.kind === 'file')
            .flatMap(attachmentKeys)
    ),
    [attachments, messageMode, pendingMessageAttachments]
  );

  const isAttached = (entry: ConfiguredResourceEntry): boolean =>
    attachedPaths.has(projectResourceKey(entry)) || attachedPaths.has(entry.path);

  const shared = {
    open,
    copy: COPY[mode],
    closeLabel: 'Close context selector',
    catalog,
    searchResults,
    onSearch,
    onClearSearch,
    onExplore,
    onClose
  };

  if (mode === 'excerpt') {
    return (
      <ProjectResourcePickerModal
        {...shared}
        selection="single"
        pickHint="Click a file to set it as the excerpt"
        onPick={(item) => onPickExcerpt?.(item)}
      />
    );
  }

  const messageFooter = ({ selected, confirm, close }: ProjectResourcePickerFooterState) => {
    const remainingMessageSlots = Math.max(
      0,
      PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage - pendingMessageAttachments.length
    );
    const overMessageCap = selected.length > remainingMessageSlots;
    return (
        <div className="pm-ws-ctxsel-foot">
          <span className={`pm-ws-ctxsel-total${overMessageCap ? ' pm-ws-ctxsel-total-over' : ''}`}>
            {selected.length === 0
              ? `Nothing selected · ${remainingMessageSlots} attachment slot${remainingMessageSlots === 1 ? '' : 's'} left on this message`
              : `${selected.length} of ${remainingMessageSlots} remaining slot${remainingMessageSlots === 1 ? '' : 's'}`}
          </span>
          <span className="pm-ws-ctxsel-spacer" />
          {overMessageCap ? (
            <span className="pm-ws-ctxsel-overmsg">
              A message carries at most {PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage} attachments
            </span>
          ) : null}
          <button className="pm-ws-action-btn" type="button" onClick={close}>
            Cancel
          </button>
          <button
            className="pm-ws-primary-btn"
            type="button"
            disabled={selected.length === 0 || overMessageCap}
            onClick={confirm}
          >
            <Icon name="check" size={13} /> Attach {selected.length}{' '}
            to message
          </button>
        </div>
    );
  };

  const attachFooter = (state: ProjectResourcePickerFooterState) => (
    <ProjectResourceAttachFooter {...state} remainingWords={remainingWords} />
  );

  return (
    <ProjectResourcePickerModal
      {...shared}
      selection="multiple"
      isAttached={isAttached}
      onConfirm={onConfirm}
      renderFooter={messageMode ? messageFooter : attachFooter}
    />
  );
};
