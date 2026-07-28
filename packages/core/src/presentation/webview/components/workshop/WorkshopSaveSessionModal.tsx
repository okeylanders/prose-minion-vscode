/**
 * Focused named-checkpoint flow from the approved Workshop sessions design.
 *
 * Autosave and browsing are intentionally explained but not performed here:
 * this sheet answers one question—what should this durable checkpoint be
 * called?—and shows exactly what the writer is about to preserve.
 */

import * as React from 'react';
import {
  WORKSHOP_INTERACTION_MODE_LABELS,
  WORKSHOP_RELATIONAL_DEPTH_LABELS,
  WorkshopConversationBehavior,
  WorkshopSessionSummary
} from '@messages';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';

export interface WorkshopSaveSessionManifest {
  excerptVersion?: number;
  excerptWordCount: number;
  turnCount: number;
  hostLabel: string;
  guestCount: number;
  contextAttachmentCount: number;
  todoCount: number;
  behavior: WorkshopConversationBehavior;
}

interface WorkshopSaveSessionModalProps {
  open: boolean;
  available: boolean;
  unavailableReason?: 'no-workspace' | 'multi-root';
  suggestedTitle: string;
  activeNamedSession?: WorkshopSessionSummary;
  manifest: WorkshopSaveSessionManifest;
  saving: boolean;
  onClose: () => void;
  onSave: (title: string, sessionId?: string) => void;
}

const plural = (count: number, singular: string): string =>
  `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`;

const titleSlug = (title: string): string => {
  const slug = title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'untitled-session';
};

const expressionLabel = (level: WorkshopConversationBehavior['expressionLevel']): string =>
  `${level.charAt(0).toLocaleUpperCase()}${level.slice(1)}`;

const unavailableCopy = (
  reason: WorkshopSaveSessionModalProps['unavailableReason']
): string => reason === 'multi-root'
  ? 'Named sessions require a single-root workspace. Open this manuscript as one workspace folder before saving.'
  : 'Open a workspace folder before saving a named Workshop session.';

export const WorkshopSaveSessionModal: React.FC<WorkshopSaveSessionModalProps> = ({
  open,
  available,
  unavailableReason,
  suggestedTitle,
  activeNamedSession,
  manifest,
  saving,
  onClose,
  onSave
}) => {
  const [title, setTitle] = React.useState(suggestedTitle);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    setTitle(suggestedTitle);
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, suggestedTitle]);

  const closeIfIdle = React.useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [onClose, saving]);

  const submit = React.useCallback((sessionId?: string) => {
    const normalized = title.trim();
    if (available && !saving && normalized) {
      if (sessionId) {
        onSave(normalized, sessionId);
      } else {
        onSave(normalized);
      }
    }
  }, [available, onSave, saving, title]);
  const updating = activeNamedSession !== undefined;

  const participantDetail = manifest.guestCount > 0
    ? `${manifest.hostLabel} + ${plural(manifest.guestCount, 'guest')}`
    : `${manifest.hostLabel} (host, solo)`;
  const excerptDetail = manifest.excerptVersion === undefined
    ? 'none pinned yet'
    : `v${manifest.excerptVersion} · ${plural(manifest.excerptWordCount, 'word')}`;
  const roomSettings = [
    WORKSHOP_INTERACTION_MODE_LABELS[manifest.behavior.interactionMode],
    expressionLabel(manifest.behavior.expressionLevel),
    WORKSHOP_RELATIONAL_DEPTH_LABELS[manifest.behavior.relationalDepth]
  ].join(' · ');

  return (
    <WorkshopModalShell
      open={open}
      titleId="workshop-save-session-title"
      closeLabel="Close Save session"
      className="pm-ws-save-session-modal"
      onClose={closeIfIdle}
    >
      <div className="pm-ws-session-sheet-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Session</div>
          <h2 id="workshop-save-session-title">Save session</h2>
          <p id="workshop-save-session-description">
            {updating
              ? 'This named room already autosaves after each committed turn. Save now to update its title or force a checkpoint.'
              : 'Writes a complete snapshot you can reopen later. Once named, this room will keep that checkpoint updated automatically.'}
          </p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-save-session-body">
        {!available && (
          <div className="pm-ws-sessions-unavailable" role="status">
            <Icon name="doc" size={16} /> {unavailableCopy(unavailableReason)}
          </div>
        )}
        <label className="pm-ws-save-session-field">
          <span>Session name</span>
          <input
            ref={inputRef}
            value={title}
            disabled={!available || saving}
            aria-describedby="workshop-save-session-description workshop-save-session-path-note"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit(activeNamedSession?.sessionId);
              }
            }}
          />
        </label>
        <div className="pm-ws-save-session-path" id="workshop-save-session-path-note">
          <Icon name="doc" size={12} />
          <span>
            prose-minion/sessions/<strong>
              {activeNamedSession?.fileName ??
                `YYYYMMDD-HHMMSS-${titleSlug(title)}.json`}
            </strong>
          </span>
        </div>
        <p className="pm-ws-save-session-identity-note">
          {updating
            ? 'Updates this exact saved-session identity; another session with the same title is never selected by name.'
            : 'The timestamped filename is permanent. Renaming later changes the session title, not its storage identity.'}
        </p>

        <section className="pm-ws-save-session-manifest" aria-label="Included in this snapshot">
          <div className="pm-ws-save-session-manifest-title">Included in this snapshot</div>
          <ManifestRow label="Excerpt" detail={excerptDetail} />
          <ManifestRow label="Transcript" detail={`${plural(manifest.turnCount, 'turn')} · complete`} />
          <ManifestRow label="Participants" detail={participantDetail} />
          <ManifestRow
            label="Context"
            detail={plural(manifest.contextAttachmentCount, 'attachment')}
          />
          <ManifestRow label="To-do list" detail={plural(manifest.todoCount, 'item')} />
          <ManifestRow label="Room settings" detail={roomSettings} />
        </section>
      </div>

      <footer className="pm-ws-session-sheet-foot">
        <span>
          {updating ? (
            <>Autosaves to <strong>current.json</strong> and this named session.</>
          ) : (
            <>Autosaves to <strong>current.json</strong>; this creates a named session.</>
          )}
        </span>
        <button
          className="pm-ws-session-secondary"
          type="button"
          disabled={saving}
          onClick={closeIfIdle}
        >
          Cancel
        </button>
        {updating && (
          <button
            className="pm-ws-session-secondary"
            type="button"
            disabled={!available || saving || !title.trim()}
            onClick={() => submit()}
          >
            Save as new
          </button>
        )}
        <button
          className="pm-ws-session-primary pm-ws-session-primary-large"
          type="button"
          disabled={!available || saving || !title.trim()}
          onClick={() => submit(activeNamedSession?.sessionId)}
        >
          <Icon name="save" size={14} />
          {saving ? 'Saving…' : updating ? 'Update session' : 'Save session'}
        </button>
      </footer>
    </WorkshopModalShell>
  );
};

const ManifestRow: React.FC<{ label: string; detail: string }> = ({ label, detail }) => (
  <div className="pm-ws-save-session-manifest-row">
    <Icon name="check" size={14} />
    <span>{label}</span>
    <span>{detail}</span>
  </div>
);
