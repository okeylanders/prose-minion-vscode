/**
 * WorkshopTextSheet — the ONE Edit│Preview sheet for every piece of authored
 * text in the Workshop (Sprint 13A §5–§7; design source:
 * "Prose Minion - Assistant Tab.html", `openTextSheet`).
 *
 * Four cases, one component, because they are one interaction: pasting an
 * excerpt, adding a text note, editing an existing note, and editing a
 * wizard suggestion. A fifth, read-only case serves project files — the
 * prettified in-webview markdown read, with an explicit escape hatch to the
 * real document in an editor tab.
 *
 * Preview reuses the shared sanitized MarkdownRenderer rather than a local
 * regex renderer: the comp's preview promises "markdown rendered as the room
 * will read it", and attachment bodies are workspace-derived untrusted input.
 *
 * The draft is LOCAL state. Applying is the only thing that leaves this
 * component, and a refused apply (over budget, gone) keeps the draft on screen
 * so the writer never loses words to a validation message.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { WorkshopModalShell } from './WorkshopModalShell';
import { countWords } from '@/utils/textUtils';
import type {
  WorkshopTextSheetMode
} from '@hooks/domain/workshop/controllers/useWorkshopContextSheet';

export interface WorkshopTextSheetProps {
  open: boolean;
  mode: WorkshopTextSheetMode;
  /** Body to seed the editor with; undefined while the host round-trip is pending. */
  value?: string;
  /** True while the host is fetching an attachment body. */
  loading?: boolean;
  /** Display-safe reason the body could not be produced. */
  error?: string;
  /** True when this attachment has a file the host can open in an editor tab. */
  canOpenInEditor?: boolean;
  /** Disables Apply while a run/session operation holds the room. */
  applyDisabled?: boolean;
  onApply: (text: string) => void;
  onOpenInEditor?: () => void;
  /** Cross-link out of the excerpt sheet into the project picker. */
  onChooseFromProject?: () => void;
  /**
   * Raw pasted text, reported as it lands. The excerpt case uses this to run
   * the verify round-trip against the live editor selection — verified
   * provenance is earned by a paste, so the sheet has to say when one happens.
   */
  onPasteText?: (pasted: string) => void;
  /**
   * The host's verification claim. The sheet owns the draft, so the sheet is
   * the only place that can honestly decide whether the claim still applies:
   * editing one character forfeits it.
   */
  verified?: { text: string; note: string };
  onClose: () => void;
}

const TITLE_ID = 'workshop-text-sheet-title';

interface SheetCopy {
  kicker: string;
  title: string;
  sub: string;
  placeholder: string;
  editLabel: string;
  meta: React.ReactNode;
  foot: React.ReactNode;
  applyLabel: string;
  /** File attachments are a READ: the sheet opens on Preview and never edits. */
  readOnly: boolean;
}

const sheetCopy = (
  mode: WorkshopTextSheetMode,
  handlers: Pick<WorkshopTextSheetProps, 'onChooseFromProject'>
): SheetCopy => {
  switch (mode.kind) {
    case 'excerpt':
      return {
        kicker: mode.retainedConversation ? 'Add excerpt to this conversation' : 'Set excerpt',
        title: 'Paste or type the passage',
        sub: mode.retainedConversation
          ? 'This conversation stays exactly where it is — your host simply gains the pages, and the analysis tools unlock.'
          : 'This becomes the working excerpt for the session. Verified when it matches your editor selection.',
        placeholder: 'Paste or type the passage you want to workshop…',
        editLabel: 'Edit',
        // The comp offers a "paste sample passage" helper here. It is
        // deliberately omitted: its sample is the design's own demo novel, and
        // dropping invented prose into a writer's room would be worse than
        // having no shortcut at all.
        meta: 'Head-sliced past 10,000 words',
        foot: handlers.onChooseFromProject ? (
          <>
            Rather pick a file?{' '}
            <button
              className="pm-ws-text-sheet-link"
              type="button"
              onClick={handlers.onChooseFromProject}
            >
              Choose from project…
            </button>
          </>
        ) : null,
        applyLabel: 'Apply excerpt',
        readOnly: false
      };
    case 'context-new':
      return {
        kicker: 'Context · Text note',
        title: 'Add a text note',
        sub: 'Context rides along with every message, to every participant — in passage sessions and open conversations alike.',
        placeholder: 'Notes, a character sheet, continuity you want the room to hold…',
        editLabel: 'Edit',
        meta: 'Counts against the shared context budget',
        foot: null,
        applyLabel: 'Add to context',
        readOnly: false
      };
    case 'context-text':
      return {
        kicker: 'Context · Text note',
        title: mode.label,
        sub: 'Context rides along with every message, to every participant — in passage sessions and open conversations alike.',
        placeholder: 'Notes, a character sheet, continuity you want the room to hold…',
        editLabel: 'Edit',
        meta: 'Counts against the shared context budget',
        foot: 'The first line becomes this note’s name.',
        applyLabel: 'Save changes',
        readOnly: false
      };
    case 'context-wizard':
      return {
        kicker: 'Context · Wizard suggestion',
        title: mode.label,
        sub: 'Suggested by the context wizard — yours to edit, preview, or remove.',
        placeholder: 'Notes, a character sheet, continuity you want the room to hold…',
        editLabel: 'Edit',
        meta: 'Counts against the shared context budget',
        foot: 'Edits apply to this session only — the source file is untouched.',
        applyLabel: 'Save changes',
        readOnly: false
      };
    case 'context-file':
      return {
        kicker: 'Context · Project file',
        title: mode.label,
        sub: 'Read the attached file as the room reads it. Project files stay in sync with the file on disk, so this view is read-only.',
        placeholder: '',
        editLabel: 'Source',
        meta: mode.relativePath ?? 'Attached project file',
        foot: 'To change what the room sees, edit the file itself, then refresh changed files.',
        applyLabel: 'Save changes',
        readOnly: true
      };
  }
};

export const WorkshopTextSheet: React.FC<WorkshopTextSheetProps> = ({
  open,
  mode,
  value,
  loading = false,
  error,
  canOpenInEditor = false,
  applyDisabled = false,
  onApply,
  onOpenInEditor,
  onChooseFromProject,
  onPasteText,
  verified,
  onClose
}) => {
  const [draft, setDraft] = React.useState('');
  const [tab, setTab] = React.useState<'edit' | 'preview'>('edit');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

  const copy = sheetCopy(mode, { onChooseFromProject });

  // Seed from the incoming body exactly once per opening: re-seeding on every
  // `value` render would overwrite the writer mid-sentence when an unrelated
  // session snapshot arrives.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    if (seededRef.current || value === undefined) {
      return;
    }
    seededRef.current = true;
    setDraft(value);
  }, [open, value]);

  React.useEffect(() => {
    if (open) {
      // A read-only file opens on the rendered read; everything else opens
      // where the writer's hands are.
      setTab(copy.readOnly ? 'preview' : 'edit');
    }
  }, [copy.readOnly, open]);

  React.useEffect(() => {
    if (open && !copy.readOnly && !loading) {
      const timer = window.setTimeout(() => textareaRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [copy.readOnly, loading, open]);

  const words = React.useMemo(() => countWords(draft), [draft]);
  const wordLabel = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  const unchanged = value !== undefined && draft === value;
  const canApply = !copy.readOnly && !applyDisabled && !loading && words > 0 && !unchanged;

  const selectTab = (next: 'edit' | 'preview') => {
    setTab(next);
    // Match the comp: switching tabs moves focus to the pane you switched to,
    // so a keyboard reader is not left behind on the tab strip.
    window.setTimeout(() => {
      if (next === 'edit') {
        textareaRef.current?.focus();
      } else {
        previewRef.current?.focus();
      }
    }, 0);
  };

  return (
    <WorkshopModalShell
      open={open}
      titleId={TITLE_ID}
      closeLabel={`Close ${copy.title}`}
      className="pm-ws-text-sheet"
      onClose={onClose}
    >
      <div className="pm-ws-session-sheet-head">
        <div>
          <div className="pm-ws-eyebrow">{copy.kicker}</div>
          <h2 id={TITLE_ID}>{copy.title}</h2>
          <p>{copy.sub}</p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-text-sheet-tabs" role="tablist" aria-label={copy.title}>
        <button
          className={`pm-ws-text-sheet-tab${tab === 'edit' ? ' pm-ws-text-sheet-tab-on' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'edit'}
          aria-controls="workshop-text-sheet-edit"
          onClick={() => selectTab('edit')}
        >
          {copy.editLabel}
        </button>
        <button
          className={`pm-ws-text-sheet-tab${tab === 'preview' ? ' pm-ws-text-sheet-tab-on' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          aria-controls="workshop-text-sheet-preview"
          onClick={() => selectTab('preview')}
        >
          Preview
        </button>
        <span className="pm-ws-text-sheet-hint">
          Preview shows formatted output · read-only
        </span>
      </div>

      <div className="pm-ws-text-sheet-body">
        {error ? (
          <div className="pm-ws-text-sheet-notice" role="alert">
            <Icon name="x" size={14} /> {error}
          </div>
        ) : null}
        {loading ? (
          <div className="pm-ws-text-sheet-notice" role="status">
            <Icon name="refresh" size={14} /> Loading the attached text…
          </div>
        ) : null}

        {/* `hidden` as well as the class: the class hides the pane from the
            eye, but only `hidden` takes the inactive panel out of the
            accessibility tree — without it a screen reader is offered BOTH. */}
        <div
          className={`pm-ws-text-sheet-pane${tab === 'edit' ? ' pm-ws-text-sheet-pane-on' : ''}`}
          id="workshop-text-sheet-edit"
          role="tabpanel"
          hidden={tab !== 'edit'}
        >
          <textarea
            ref={textareaRef}
            className="pm-ws-text-sheet-input"
            value={draft}
            readOnly={copy.readOnly}
            placeholder={copy.placeholder}
            /* Named by its PURPOSE, not by the dialog's title: repeating the
               heading would give the sheet two controls with the same
               accessible name. */
            aria-label={`${copy.editLabel}: ${copy.title}`}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text');
              if (pasted.trim().length > 0) {
                onPasteText?.(pasted);
              }
            }}
          />
          {verified && draft === verified.text ? (
            <div className="pm-ws-verify" role="status">
              <Icon name="check" size={12} /> Matches your editor selection — {verified.note}
            </div>
          ) : null}
          <div className="pm-ws-text-sheet-meta">
            <span className="pm-ws-text-sheet-count">{wordLabel}</span>
            <span>{copy.meta}</span>
          </div>
        </div>

        <div
          className={`pm-ws-text-sheet-pane${tab === 'preview' ? ' pm-ws-text-sheet-pane-on' : ''}`}
          id="workshop-text-sheet-preview"
          role="tabpanel"
          hidden={tab !== 'preview'}
        >
          <div
            ref={previewRef}
            className="pm-ws-text-sheet-preview"
            tabIndex={0}
            aria-label="Formatted preview"
          >
            {/* Render the markdown ONLY while this pane is the one being read.
                `MarkdownRenderer` memoizes on `content`, but `draft` is the
                textarea's own controlled state — it changes on every
                keystroke, so a permanently-mounted preview would re-parse and
                re-sanitize the whole draft per character typed in the Edit
                tab. The textarea itself stays mounted, which costs nothing and
                keeps the writer's cursor and scroll position across a toggle. */}
            {tab !== 'preview' ? null : words > 0 ? (
              <MarkdownRenderer content={draft} />
            ) : (
              <div className="pm-ws-text-sheet-preview-empty">Nothing to preview yet.</div>
            )}
          </div>
          <div className="pm-ws-text-sheet-meta">
            <span className="pm-ws-text-sheet-count">{wordLabel}</span>
            <span>Markdown rendered as the room will read it</span>
          </div>
        </div>
      </div>

      <footer className="pm-ws-session-sheet-foot">
        <span>{copy.foot}</span>
        {canOpenInEditor && onOpenInEditor ? (
          <button className="pm-ws-session-secondary" type="button" onClick={onOpenInEditor}>
            <Icon name="doc" size={13} /> Open in editor tab
          </button>
        ) : null}
        <button className="pm-ws-session-secondary" type="button" onClick={onClose}>
          Close
        </button>
        {copy.readOnly ? null : (
          <button
            className="pm-ws-session-primary pm-ws-session-primary-large"
            type="button"
            disabled={!canApply}
            onClick={() => onApply(draft)}
          >
            <Icon name="check" size={14} /> {copy.applyLabel}
          </button>
        )}
      </footer>
    </WorkshopModalShell>
  );
};
