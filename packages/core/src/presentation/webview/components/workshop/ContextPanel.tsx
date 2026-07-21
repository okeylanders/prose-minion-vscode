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
  onAddText: (text: string) => void;
  /** Open the Context Selector modal. */
  onAddFile: () => void;
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

export const ContextPanel: React.FC<ContextPanelProps> = ({
  attachments,
  pendingDelivery,
  isRunning,
  onAddText,
  onAddFile,
  onRemove,
  wizardRunning,
  onRunWizard,
  onCancelWizard
}) => {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const budget = PROMPT_BUDGETS.contextAttachments.words;
  const used = attachments.reduce((total, attachment) => total + attachment.words, 0);
  const draftWords = countWords(draft);
  const hasAttachments = attachments.length > 0;

  const confirmText = () => {
    if (draft.trim().length === 0) {
      return;
    }
    onAddText(draft.trim());
    setDraft('');
    setAdding(false);
  };

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
      </div>

      {hasAttachments ? (
        <div className="pm-ws-ctx-pills">
          {attachments.map((attachment) => {
            const inspectable = attachment.kind === 'text' && attachment.content !== undefined;
            const expanded = inspectable && expandedId === attachment.id;
            return (
              <React.Fragment key={attachment.id}>
                <span
                  className={`pm-ws-ctx-pill${attachment.origin === 'wizard' ? ' pm-ws-ctx-pill-wizard' : ''}`}
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
                  {inspectable ? (
                    <button
                      className="pm-ws-ctx-pill-label pm-ws-ctx-pill-expand"
                      type="button"
                      aria-expanded={expanded}
                      title={`${attachment.label} — click to ${expanded ? 'hide' : 'read'}`}
                      onClick={() => setExpandedId(expanded ? null : attachment.id)}
                    >
                      {attachment.label}
                    </button>
                  ) : (
                    <span className="pm-ws-ctx-pill-label">{attachment.label}</span>
                  )}
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
                {expanded ? (
                  <div className="pm-ws-ctx-note" role="note" aria-label={`${attachment.label} content`}>
                    {attachment.content}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      ) : null}

      {adding ? (
        <div className="pm-ws-ctx-add">
          <textarea
            className="pm-ws-excerpt pm-ws-excerpt-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste or type a context note…"
            rows={4}
            aria-label="Context text"
          />
          <div className="pm-ws-excerpt-count">
            <b>{draftWords.toLocaleString()}</b>&nbsp;words
          </div>
          <div className="pm-ws-excerpt-actions">
            <button
              className="pm-ws-primary-btn"
              type="button"
              onClick={confirmText}
              disabled={draft.trim().length === 0 || isRunning}
            >
              <Icon name="check" size={13} /> Add
            </button>
            <button className="pm-ws-action-btn" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : hasAttachments ? (
        <div className="pm-ws-excerpt-actions">
          <button
            className="pm-ws-action-btn"
            type="button"
            onClick={() => setAdding(true)}
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
              onClick={() => setAdding(true)}
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
            Context rides along with every message, to every participant.
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
      {pendingDelivery ? (
        <p className="pm-ws-brief-note">Shared with your next host message.</p>
      ) : null}
    </div>
  );
};
