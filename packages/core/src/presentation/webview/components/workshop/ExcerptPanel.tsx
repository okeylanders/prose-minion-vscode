/**
 * ExcerptPanel — the rail's excerpt block (Sprint 12 intake rework; design
 * source: "Prose Minion - Intake Widgets.html").
 *
 * Empty state is two intent buttons — setting an excerpt IS the commitment,
 * no "pin" vocabulary. Pasting text that exactly matches the active editor
 * selection earns verified provenance (via the workshop_excerpt_verify seam);
 * anything else stays honestly "source unknown". Once the host conversation
 * exists the card locks: the affordance becomes `Update text…` (typed origin)
 * or `Re-read from file` (file origin), both riding the existing
 * replaceExcerpt revision semantics host-side.
 *
 * Owns only the local draft; the excerpt itself is HOST state
 * (WorkshopSessionService) and arrives via props. This component never talks
 * to the wire directly.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopExcerpt, WorkshopExcerptSource, workshopExcerptSourcePath } from '@messages';
import { WorkshopVerifiedExcerpt } from '@hooks/domain/useWorkshopExcerptVerify';

export const EXCERPT_WORD_BUDGET = 10_000;

interface ExcerptPanelProps {
  excerpt: WorkshopExcerpt | null;
  /** Disables intake while a run is in flight (host guards too). */
  isRunning: boolean;
  /** True once the host conversation exists — switches to locked affordances. */
  locked: boolean;
  /** Live verification claim; applies only while the draft matches its text. */
  verified: WorkshopVerifiedExcerpt | null;
  onSet: (text: string, source?: WorkshopExcerptSource) => void;
  /** Ask the host to open its file picker and set the chosen file's content. */
  onChooseFile: () => void;
  /** Ask the host to re-read a file-backed excerpt from disk. */
  onRereadFile: () => void;
  /** Pasted text needs a verification round-trip against the editor selection. */
  onPasteVerify: (pastedText: string) => void;
}

const countWords = (text: string): number => text.trim().match(/\S+/g)?.length ?? 0;

const sourceLine = (source: WorkshopExcerptSource): React.ReactNode => {
  if (source.kind === 'manual') {
    return (
      <>
        <Icon name="pen" size={12} /> Pasted or typed · source unknown
      </>
    );
  }
  const lines =
    source.kind === 'editor-selection' && source.startLine !== undefined && source.endLine !== undefined
      ? source.startLine === source.endLine
        ? ` · line ${source.startLine}`
        : ` · lines ${source.startLine}–${source.endLine}`
      : '';
  return (
    <>
      <Icon name="doc" size={12} /> From {source.relativePath}
      {lines}
    </>
  );
};

export const ExcerptPanel: React.FC<ExcerptPanelProps> = ({
  excerpt,
  isRunning,
  locked,
  verified,
  onSet,
  onChooseFile,
  onRereadFile,
  onPasteVerify
}) => {
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  const draftWords = countWords(draft);
  const draftVerified = verified !== null && draft === verified.text;

  const confirmDraft = () => {
    if (draft.trim().length === 0) {
      return;
    }
    onSet(draft, draftVerified ? verified.source : undefined);
    setEditing(false);
  };

  const beginTyping = () => {
    setDraft(excerpt?.text ?? '');
    setEditing(true);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (pasted.trim().length > 0) {
      onPasteVerify(pasted);
    }
  };

  const fileBacked = excerpt?.source.kind === 'file';

  return (
    <div className="pm-ws-block">
      <div className="pm-ws-block-head">
        <div className="pm-ws-eyebrow">
          <Icon name="doc" size={12} /> Excerpt
        </div>
        {excerpt && !editing ? (
          <span className="pm-ws-pill">Excerpt · v{excerpt.version}</span>
        ) : null}
        {excerpt && !editing && locked ? (
          <span className="pm-ws-pill pm-ws-pill-lock">Session live</span>
        ) : null}
      </div>

      {editing ? (
        <>
          <textarea
            className="pm-ws-excerpt pm-ws-excerpt-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={handlePaste}
            placeholder="Paste or type the passage to workshop…"
            rows={7}
            aria-label="Excerpt text"
          />
          <div className="pm-ws-excerpt-count">
            <b>{draftWords.toLocaleString()}</b>&nbsp;words
            <span className="pm-ws-excerpt-count-cap">
              budget {EXCERPT_WORD_BUDGET.toLocaleString()} words
            </span>
          </div>
          {draftVerified && verified.source.kind === 'editor-selection' ? (
            <div className="pm-ws-verify" role="status">
              <Icon name="check" size={12} /> Matches your editor selection —{' '}
              {workshopExcerptSourcePath(verified.source)}
            </div>
          ) : null}
          <div className="pm-ws-excerpt-actions">
            <button
              className="pm-ws-primary-btn"
              type="button"
              onClick={confirmDraft}
              disabled={draft.trim().length === 0 || isRunning}
            >
              <Icon name="check" size={13} /> Confirm
            </button>
            <button
              className="pm-ws-action-btn"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </>
      ) : excerpt ? (
        <>
          <div className="pm-ws-provenance">{sourceLine(excerpt.source)}</div>
          <div className="pm-ws-excerpt">{excerpt.text}</div>
          {excerpt.truncation && (
            <p className="pm-ws-excerpt-truncated">
              Head slice: the first {excerpt.truncation.pinnedWords.toLocaleString()} of{' '}
              {excerpt.truncation.totalWords.toLocaleString()} words in this file. The rest is
              not in context.
            </p>
          )}
          <div className="pm-ws-excerpt-actions">
            {locked ? (
              fileBacked ? (
                <button
                  className="pm-ws-action-btn"
                  type="button"
                  onClick={onRereadFile}
                  disabled={isRunning}
                  title="Re-read this file from disk; on-disk edits land as a new excerpt version"
                >
                  <Icon name="refresh" size={12} /> Re-read from file
                </button>
              ) : (
                <button
                  className="pm-ws-action-btn"
                  type="button"
                  onClick={beginTyping}
                  disabled={isRunning}
                  title="Replace the excerpt text; the room keeps its memory and sees a new version"
                >
                  <Icon name="pen" size={12} /> Update text…
                </button>
              )
            ) : (
              <>
                <button
                  className="pm-ws-action-btn"
                  type="button"
                  onClick={beginTyping}
                  disabled={isRunning}
                >
                  <Icon name="pen" size={12} /> Paste or type
                </button>
                <button
                  className="pm-ws-action-btn"
                  type="button"
                  onClick={onChooseFile}
                  disabled={isRunning}
                  title="Pick a file and set its content as the working excerpt"
                >
                  <Icon name="doc" size={12} /> Choose from project…
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="pm-ws-intake-stack">
            <button
              className="pm-ws-intake-btn"
              type="button"
              onClick={beginTyping}
              disabled={isRunning}
            >
              <Icon name="pen" size={16} />
              Paste or type
              <span className="pm-ws-intake-sub">
                verified if it matches your editor selection
              </span>
            </button>
            <button
              className="pm-ws-intake-btn"
              type="button"
              onClick={onChooseFile}
              disabled={isRunning}
            >
              <Icon name="doc" size={16} />
              Choose from project…
              <span className="pm-ws-intake-sub">
                reads the file, head-slices past {EXCERPT_WORD_BUDGET.toLocaleString()} words
              </span>
            </button>
          </div>
          <p className="pm-ws-intake-caption">
            The excerpt is the text this room is workshopping.
          </p>
        </>
      )}
    </div>
  );
};
