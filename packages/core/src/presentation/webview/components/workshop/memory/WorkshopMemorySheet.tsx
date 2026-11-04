/**
 * The one memory sheet (Slice 0d, "The sheet"; ADR 2026-11-04 D4, D5, D8;
 * PR #192 F-03), in three modes: Edit (a card, or a saved memory), Save to
 * memory… (a bubble as source), and New (no source). Slice 4b's manager
 * opens the same sheet for New and Edit.
 *
 * - **Bounded by the codec's rules** (`checkWorkshopMemoryDraft`): the
 *   counters show them, and Save waits until the draft would be accepted.
 * - **The host's numbers.** "Always load in full" reads the host's estimate;
 *   an edit that would pass the budget shows the refusal under the note and
 *   disables Save. The host refuses it again at Save.
 * - **The source line** says where the memory comes from, without claiming a
 *   recallable source the host hasn't confirmed (PR #196 watchpoint 5).
 * - The UI never says "pin" (Slice 0d decision 16).
 */

import * as React from 'react';
import type { WorkshopMemoryDraft } from '@messages';
import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS, type ProjectMemoryKind } from '@shared/types/projectMemory';
import {
  checkWorkshopMemoryDraft,
  WORKSHOP_MEMORY_DRAFT_FAULTS,
  workshopMemoryPinnedHelp,
  workshopMemoryPinnedRefusal
} from '@shared/constants/workshopProjectMemoryWrites';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from '../WorkshopModalShell';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';

const KIND_CARDS: Readonly<Record<ProjectMemoryKind, { label: string; help: string }>> = Object.freeze({
  decision: { label: 'Decision', help: 'A choice the project made.' },
  canon: { label: 'Canon', help: 'A fact of the story.' },
  preference: { label: 'Preference', help: 'How you like to work.' },
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ProjectMemoryKind ids are kebab-case format literals.
  'open-thread': { label: 'Open thread', help: 'A question to come back to.' }
});

interface WorkshopMemorySheetProps {
  sheet: WorkshopMemorySheetState | null;
  onChange: (change: Partial<WorkshopMemoryDraft>) => void;
  onDropReplaced: (memoryId: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const count = (value: string, limit: number): string =>
  `${value.length.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')}`;

function sourceLine(sheet: WorkshopMemorySheetState): string | undefined {
  switch (sheet.mode) {
    case 'card':
      return `From ${sheet.sourceLabel ?? 'a persona'}'s reply in this conversation. Saved as a Markdown file in prose-minion/memory/.`;
    case 'turn':
      return `From ${sheet.sourceLabel === 'your message' ? 'your message' : `${sheet.sourceLabel ?? 'a'} reply`} in this conversation. Saved as a Markdown file in prose-minion/memory/.`;
    case 'new':
      return 'Saved as a Markdown file in prose-minion/memory/.';
    default:
      return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemorySheet: React.FC<WorkshopMemorySheetProps> = ({ sheet, onChange, onDropReplaced, onSubmit, onClose }) => {
  const titleRef = React.useRef<HTMLInputElement>(null);
  const open = sheet !== null;
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const timer = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!sheet) {
    return null;
  }
  const { draft } = sheet;
  const editing = sheet.mode === 'memory';
  const fault = checkWorkshopMemoryDraft(draft);
  // Show a field fault only once the writer has typed something there.
  const visibleFault = fault && fault !== 'title-empty' && fault !== 'summary-empty' ? WORKSHOP_MEMORY_DRAFT_FAULTS[fault] : undefined;
  const refusedByBudget = sheet.estimate?.refused === true && draft.pinned;
  const saveDisabled = sheet.loading || sheet.saving || fault !== undefined || refusedByBudget;
  const titleText = draft.title.trim() || '…';
  const source = sourceLine(sheet);

  return (
    <WorkshopModalShell
      open
      titleId="pm-ws-memory-sheet-title"
      closeLabel="Close the memory sheet"
      className="pm-ws-memory-sheet"
      variant="sheet"
      onClose={onClose}
    >
      <div className="pm-ws-session-sheet-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Project memory</div>
          <h2 id="pm-ws-memory-sheet-title">{editing ? 'Edit memory' : 'Save to project memory'}</h2>
          <p>
            Personas in later conversations start with the title and summary, and read the note when they need it.
            You can change any of it later.
          </p>
        </div>
        <WorkshopModalShell.CloseButton disabled={sheet.saving} />
      </div>

      <div className="pm-ws-sheet-body pm-ws-memory-sheet-body" aria-busy={sheet.loading}>
        {sheet.loading ? (
          <p className="pm-ws-memory-sheet-loading" role="status">Reading the memory…</p>
        ) : (
          <>
            <label className="pm-ws-memory-field">
              <span>Title</span>
              <input
                ref={titleRef}
                type="text"
                value={draft.title}
                maxLength={PROJECT_MEMORY_FIELD_CHARACTERS.title}
                disabled={sheet.saving}
                onChange={(event) => onChange({ title: event.target.value })}
              />
              <small>{count(draft.title, PROJECT_MEMORY_FIELD_CHARACTERS.title)}</small>
            </label>

            <div className="pm-ws-memory-field">
              <span id="pm-ws-memory-kind-label">Kind</span>
              <div className="pm-ws-memory-kinds" role="radiogroup" aria-labelledby="pm-ws-memory-kind-label">
                {PROJECT_MEMORY_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={draft.kind === kind}
                    className={`pm-ws-memory-kind-card${draft.kind === kind ? ' pm-ws-memory-kind-card-on' : ''}`}
                    disabled={sheet.saving}
                    onClick={() => onChange({ kind })}
                  >
                    <b>{KIND_CARDS[kind].label}</b>
                    <span>{KIND_CARDS[kind].help}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="pm-ws-memory-field">
              <span>Summary <span className="pm-ws-memory-hint">· what every conversation sees</span></span>
              <input
                type="text"
                value={draft.summary}
                maxLength={PROJECT_MEMORY_FIELD_CHARACTERS.summary}
                disabled={sheet.saving}
                onChange={(event) => onChange({ summary: event.target.value })}
              />
              <small>{count(draft.summary, PROJECT_MEMORY_FIELD_CHARACTERS.summary)}</small>
            </label>

            <label className="pm-ws-memory-field">
              <span>Note <span className="pm-ws-memory-hint">· read in full only when a persona needs it</span></span>
              <textarea
                rows={6}
                value={draft.body}
                maxLength={PROJECT_MEMORY_FIELD_CHARACTERS.body}
                disabled={sheet.saving}
                onChange={(event) => onChange({ body: event.target.value })}
              />
              <small>{count(draft.body, PROJECT_MEMORY_FIELD_CHARACTERS.body)}</small>
            </label>

            {refusedByBudget && sheet.estimate && (
              <div className="pm-ws-memory-refusal" role="alert">
                <Icon name="info" size={13} />
                <span>{workshopMemoryPinnedRefusal(sheet.estimate, editing)}</span>
              </div>
            )}
            {visibleFault && <div className="pm-ws-memory-error" role="alert">{visibleFault}</div>}

            {sheet.replaces.length > 0 && (
              <div className="pm-ws-memory-field">
                <span>Replaces</span>
                {sheet.replaces.map((replaced) => (
                  <div className="pm-ws-memory-replaced" key={replaced.id}>
                    {replaced.title} <span className="pm-ws-memory-hint">· stays searchable</span>
                    <button
                      type="button"
                      disabled={sheet.saving}
                      aria-label={`Don't replace ${replaced.title}`}
                      onClick={() => onDropReplaced(replaced.id)}
                    >
                      Don&apos;t replace
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pm-ws-memory-switch-row">
              <div>
                <div className="pm-ws-memory-switch-name">Always load in full</div>
                <div className="pm-ws-memory-switch-help">{workshopMemoryPinnedHelp(sheet.estimate)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.pinned}
                aria-label="Always load in full"
                className={`pm-ws-memory-switch${draft.pinned ? ' pm-ws-memory-switch-on' : ''}`}
                disabled={sheet.saving}
                onClick={() => onChange({ pinned: !draft.pinned })}
              >
                <span />
              </button>
            </div>

            {source && (
              <div className="pm-ws-memory-source">
                <Icon name="link" size={14} />
                <span>{source}</span>
              </div>
            )}
          </>
        )}
        {sheet.error && <div className="pm-ws-memory-error" role="alert">{sheet.error}</div>}
      </div>

      <footer className="pm-ws-session-sheet-foot">
        <span>
          {editing
            ? 'Saving tells the room the memory changed when what it says changes.'
            : `Saving tells the room: "Saved to project memory: ${titleText}".`}
        </span>
        <button className="pm-ws-session-secondary" type="button" disabled={sheet.saving} onClick={onClose}>
          Cancel
        </button>
        <button className="pm-ws-session-primary" type="button" disabled={saveDisabled} onClick={onSubmit}>
          {sheet.saving ? 'Saving…' : editing ? 'Save changes' : 'Save to memory'}
        </button>
      </footer>
    </WorkshopModalShell>
  );
};
