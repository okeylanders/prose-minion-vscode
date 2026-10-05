/**
 * Export the room's transcript: pick a format, name the document, and see
 * exactly where it will land.
 *
 * The sheet promises only what the host does: the transcript is the thread's
 * visible conversation, written to a new file under prose-minion/exports that
 * never replaces an earlier export.
 */

import * as React from 'react';
import {
  WORKSHOP_TRANSCRIPT_EXPORT_FORMATS,
  WORKSHOP_TRANSCRIPT_EXPORT_TITLE_MAX_LENGTH,
  WorkshopTranscriptExportFormat
} from '@messages';
import { Icon, IconName } from '@components/shared/Icon';
import {
  WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY,
  workshopTranscriptExportFileName
} from '@shared/constants/workshopTranscriptExport';
import { WorkshopModalShell } from './WorkshopModalShell';

interface WorkshopExportSessionModalProps {
  open: boolean;
  /** False when there is no workspace folder to write into. */
  available: boolean;
  suggestedTitle: string;
  exporting: boolean;
  onClose: () => void;
  onExport: (format: WorkshopTranscriptExportFormat, title: string) => void;
}

interface FormatOption {
  label: string;
  icon: IconName;
  hint: string;
  opens: string;
}

const FORMAT_OPTIONS: Readonly<Record<WorkshopTranscriptExportFormat, FormatOption>> = {
  markdown: {
    label: 'Markdown',
    icon: 'doc',
    hint: 'Speaker headings and the replies as written. Best for pasting into another agent or your notes.',
    opens: 'Opens in the editor when it’s written.'
  },
  json: {
    label: 'JSON',
    icon: 'list',
    hint: 'Structured entries with speakers, roles, and timestamps. Best for scripts and agent pipelines.',
    opens: 'Opens in the editor when it’s written.'
  },
  html: {
    label: 'Styled HTML',
    icon: 'palette',
    hint: 'A standalone page styled like this thread. Best for sharing; print it to save a PDF.',
    opens: 'Opens in your browser when it’s written — print from there to save a PDF.'
  }
};

export const WorkshopExportSessionModal: React.FC<WorkshopExportSessionModalProps> = ({
  open,
  available,
  suggestedTitle,
  exporting,
  onClose,
  onExport
}) => {
  const [title, setTitle] = React.useState(suggestedTitle);
  // The format outlives a single opening: whoever exports for agents tends
  // to keep exporting for agents.
  const [format, setFormat] = React.useState<WorkshopTranscriptExportFormat>('markdown');
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
    if (!exporting) {
      onClose();
    }
  }, [exporting, onClose]);

  const normalizedTitle = title.trim();
  const canExport = available && !exporting && normalizedTitle.length > 0;
  const submit = React.useCallback(() => {
    if (canExport) {
      onExport(format, normalizedTitle);
    }
  }, [canExport, format, normalizedTitle, onExport]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="workshop-export-session-title"
      closeLabel="Close Export transcript"
      className="pm-ws-save-session-modal pm-ws-export-session-modal"
      onClose={closeIfIdle}
    >
      <div className="pm-ws-session-sheet-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Session</div>
          <h2 id="workshop-export-session-title">Export transcript</h2>
          <p id="workshop-export-session-description">
            Saves the conversation as it reads in the thread — your messages and every reply — to
            share or hand to another agent.
          </p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-save-session-body">
        {!available && (
          <div className="pm-ws-sessions-unavailable" role="status">
            <Icon name="doc" size={16} /> Open a workspace folder to export. Transcripts are saved
            under {WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY}.
          </div>
        )}
        <fieldset className="pm-ws-export-formats" disabled={!available || exporting}>
          <legend>Format</legend>
          {WORKSHOP_TRANSCRIPT_EXPORT_FORMATS.map((option) => {
            const descriptor = FORMAT_OPTIONS[option];
            return (
              <label
                key={option}
                className={`pm-ws-export-format${format === option ? ' pm-ws-export-format-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="workshop-export-format"
                  value={option}
                  checked={format === option}
                  onChange={() => setFormat(option)}
                />
                <Icon name={descriptor.icon} size={16} />
                <span className="pm-ws-export-format-text">
                  <strong>{descriptor.label}</strong>
                  <span>{descriptor.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <label className="pm-ws-save-session-field">
          <span>Export name</span>
          <input
            ref={inputRef}
            value={title}
            maxLength={WORKSHOP_TRANSCRIPT_EXPORT_TITLE_MAX_LENGTH}
            disabled={!available || exporting}
            aria-describedby="workshop-export-session-description workshop-export-session-path-note"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="pm-ws-save-session-path" id="workshop-export-session-path-note">
          <Icon name="doc" size={12} />
          <span>
            {WORKSHOP_TRANSCRIPT_EXPORT_DIRECTORY}/<strong>
              {workshopTranscriptExportFileName(title, format)}
            </strong>
          </span>
        </div>
        <p className="pm-ws-save-session-identity-note">
          The name titles the document. An earlier export is never replaced; a number is added
          instead.
        </p>

        <p className="pm-ws-export-left-out">
          <Icon name="info" size={13} />
          <span>
            Left out: excerpt text, context and attachment contents, widget payloads, tool
            evidence, and token usage. Attachments and widgets appear by name only.
          </span>
        </p>
      </div>

      <footer className="pm-ws-session-sheet-foot">
        <span>{FORMAT_OPTIONS[format].opens}</span>
        <button
          className="pm-ws-session-secondary"
          type="button"
          disabled={exporting}
          onClick={closeIfIdle}
        >
          Cancel
        </button>
        <button
          className="pm-ws-session-primary pm-ws-session-primary-large"
          type="button"
          disabled={!canExport}
          onClick={submit}
        >
          <Icon name="share" size={14} />
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </footer>
    </WorkshopModalShell>
  );
};
