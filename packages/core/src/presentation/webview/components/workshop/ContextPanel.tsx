/**
 * ContextPanel — the rail's context block (Sprint 12 intake rework; design
 * source: "Prose Minion - Intake Widgets.html").
 *
 * Context is an ordered, removable list of typed attachments, not a single
 * paste-only brief. Text notes and files each mint a pill (icon = kind;
 * wizard-origin picks get the wand); one aggregate word budget spans all
 * attachments. Add/remove routes go host-side — validation (caps, duplicate
 * guard) lives in the aggregate, and mid-session changes surface as visible
 * event turns in the thread, never silent prompt mutation.
 *
 * "Add from project…" opens the Context Selector modal (which keeps the OS
 * picker as its explore escape hatch). The Context wizard reuses the sidebar
 * Context lane host-side; its picks land as ordinary wizard-tagged pills.
 *
 * Sprint 13A §6/§7: every pill is CLICKABLE and opens the shared Edit/Preview
 * sheet — text notes (including wizard-generated briefs) for edit, project files as a
 * prettified read with an "open in editor tab" escape hatch. "Add text" opens
 * that same sheet instead of an inline textarea, so a note is composed and
 * previewed in one place rather than typed blind into a rail box.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import { WorkshopContextAttachmentSnapshot } from '@messages';

export const WORKSHOP_CONTEXT_PANEL_ID = 'pm-ws-context-panel';

interface ContextPanelProps {
  attachments: WorkshopContextAttachmentSnapshot[];
  /** True when the attachment list changed since the host last saw it. */
  pendingDelivery: boolean;
  isRunning: boolean;
  /** Open the shared Edit/Preview sheet to compose a new text note. */
  onAddText: () => void;
  /** Open the Context Selector modal. */
  onAddFile: () => void;
  /** Re-read every file-backed attachment and adopt changed snapshots. */
  onRefreshFiles: () => void;
  /** Open one attachment in the shared Edit/Preview sheet. */
  onOpenAttachment: (attachment: WorkshopContextAttachmentSnapshot) => void;
  onRemove: (id: string) => void;
  /** Context wizard lane (Sprint 12): one run at a time, results are pills. */
  wizardRunning: boolean;
  onRunWizard: () => void;
  onCancelWizard: () => void;
}

const meterTone = (used: number, budget: number): string => {
  const ratio = used / budget;
  if (ratio >= 1) {
    return ' pm-ws-meter-hot';
  }
  return ratio >= 0.7 ? ' pm-ws-meter-warn' : '';
};

/** What clicking this pill will do, said in its tooltip before the click. */
const openHint = (attachment: WorkshopContextAttachmentSnapshot): string => {
  if (attachment.kind === 'file') {
    return `${attachment.label} — open to read; opens in an editor tab from there`;
  }
  return `${attachment.label} — open to read or edit`;
};

export const ContextPanel: React.FC<ContextPanelProps> = ({
  attachments,
  pendingDelivery,
  isRunning,
  onAddText,
  onAddFile,
  onRefreshFiles,
  onOpenAttachment,
  onRemove,
  wizardRunning,
  onRunWizard,
  onCancelWizard
}) => {
  const budget = PROMPT_BUDGETS.contextAttachments.words;
  const used = attachments.reduce((total, attachment) => total + attachment.words, 0);
  const hasAttachments = attachments.length > 0;

  return (
    <div className="pm-ws-block" id={WORKSHOP_CONTEXT_PANEL_ID}>
      <div className="pm-ws-block-head">
        <div className="pm-ws-eyebrow">
          <Icon name="cards" size={12} /> Context
        </div>
        {hasAttachments ? (
          <span className="pm-ws-ctx-count">
            {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
          </span>
        ) : null}
        {attachments.some((attachment) => attachment.kind === 'file') ? (
          <button
            className="pm-ws-ctx-refresh"
            type="button"
            title="Re-read changed file attachments from disk"
            onClick={onRefreshFiles}
            disabled={isRunning}
          >
            <Icon name="refresh" size={11} /> Refresh changed files
          </button>
        ) : null}
      </div>

      {hasAttachments ? (
        <div className="pm-ws-ctx-pills">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className={`pm-ws-ctx-pill${attachment.origin === 'wizard' ? ' pm-ws-ctx-pill-wizard' : ''}${attachment.kind === 'file' && attachment.origin !== 'wizard' ? ' pm-ws-ctx-pill-file' : ''}`}
              title={
                attachment.truncation
                  ? `${attachment.label} — head slice: ${attachment.truncation.keptWords.toLocaleString()} of ${attachment.truncation.totalWords.toLocaleString()} words`
                  : attachment.relativePath ?? attachment.label
              }
            >
              <Icon
                name={attachment.origin === 'wizard' ? 'sparkle' : attachment.kind === 'file' ? 'doc' : 'pen'}
                size={12}
              />
              <button
                className="pm-ws-ctx-pill-label pm-ws-ctx-pill-open"
                type="button"
                title={openHint(attachment)}
                onClick={() => onOpenAttachment(attachment)}
              >
                {attachment.label}
              </button>
              <span className="pm-ws-ctx-pill-size">
                {attachment.words.toLocaleString()} words
              </span>
              <button
                className="pm-ws-ctx-pill-remove"
                type="button"
                aria-label={`Remove ${attachment.label}`}
                onClick={() => onRemove(attachment.id)}
                disabled={isRunning}
              >
                <Icon name="x" size={9} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {hasAttachments ? (

        <div className="pm-ws-excerpt-actions">
          <button
            className="pm-ws-action-btn"
            type="button"
            onClick={onAddText}
            disabled={isRunning}
          >
            <Icon name="pen" size={12} /> Add text
          </button>
          <button
            className="pm-ws-action-btn"
            type="button"
            onClick={onAddFile}
            disabled={isRunning}
          >
            <Icon name="doc" size={12} /> Add from project…
          </button>
          {wizardRunning ? null : (
            <button
              className="pm-ws-action-btn"
              type="button"
              onClick={onRunWizard}
              disabled={isRunning}
            >
              <Icon name="sparkle" size={12} /> Context wizard
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="pm-ws-intake-stack">
            <button
              className="pm-ws-intake-btn"
              type="button"
              onClick={onAddText}
              disabled={isRunning}
            >
              <Icon name="pen" size={16} />
              Add text
              <span className="pm-ws-intake-sub">notes, character sheets, anything typed</span>
            </button>
            <button
              className="pm-ws-intake-btn"
              type="button"
              onClick={onAddFile}
              disabled={isRunning}
            >
              <Icon name="doc" size={16} />
              Add from project…
              <span className="pm-ws-intake-sub">attach project files to every message</span>
            </button>
            <button
              className="pm-ws-intake-btn"
              type="button"
              onClick={onRunWizard}
              disabled={isRunning || wizardRunning}
            >
              <Icon name="sparkle" size={16} />
              Context wizard
              <span className="pm-ws-intake-sub">
                suggests project context — results are yours to keep or remove
              </span>
            </button>
          </div>
          <p className="pm-ws-intake-caption">
            Context rides along with every message, to every participant — in passage sessions and
            open conversations alike.
          </p>
        </>
      )}

      {wizardRunning ? (
        <div className="pm-ws-wizard-row" role="status">
          <span className="pm-ws-wizard-spin" aria-hidden="true" />
          <span>
            <b>Wizard</b> is reading your project… one run at a time
          </span>
          <button
            className="pm-ws-ctx-pill-remove"
            type="button"
            aria-label="Cancel the Context wizard"
            onClick={onCancelWizard}
          >
            <Icon name="x" size={9} />
          </button>
        </div>
      ) : null}
      <div className={`pm-ws-meter${meterTone(used, budget)}`}>
        <div className="pm-ws-meter-row">
          <div className="pm-ws-meter-track">
            <div
              className="pm-ws-meter-fill"
              style={{ width: `${Math.min(100, Math.max(used > 0 ? 2 : 0, Math.round((100 * used) / budget)))}%` }}
            />
          </div>
          <span className="pm-ws-meter-nums">
            <b>{used.toLocaleString()}</b> / {budget.toLocaleString()} words
          </span>
        </div>
        <div className="pm-ws-meter-cap">
          One budget across all attachments
          {used >= budget
            ? ' · at cap — remove something to add more'
            : used / budget >= 0.7
              ? ' · getting close to the cap'
              : ''}
        </div>
      </div>
      {hasAttachments ? (
        <p className="pm-ws-intake-caption">
          Files open for reading · text notes and wizard briefs open for edit or preview.
        </p>
      ) : null}
      {pendingDelivery ? (
        <p className="pm-ws-brief-note">Shared with your next host message.</p>
      ) : null}
    </div>
  );
};
