/**
 * One operation on a file-edit card (ADR 2026-11-05 D9; epic Slice 4b):
 *
 * - a replace as a word-level diff of its find and replace-with text;
 * - an append or prepend as the text it adds;
 * - a rewrite as before and after: on a pending card, read from the host's
 *   preview when its disclosure opens (or the host's stale notice); on a
 *   settled card, from its landed record when one kept the text, else the
 *   rewrite alone.
 *
 * It shows only what the host gave it.
 */

import * as React from 'react';
import type { WorkshopFileEditOperationView } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';
import { WORKSHOP_FILE_EDIT_OUTCOME_LABELS } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';
import type { WorkshopFileEditPreviewView } from '@hooks/domain/workshop/useWorkshopFileEdits';

export interface WorkshopFileEditOperationProps {
  view: WorkshopFileEditOperationView;
  /** Whether the card is pending: only then is a rewrite's before read from the file. */
  pending: boolean;
  preview?: WorkshopFileEditPreviewView;
  onOpenPreview: () => void;
}

const HEADINGS: Readonly<Record<WorkshopFileEditOperationView['kind'], string>> = Object.freeze({
  replace: 'Replace',
  append: 'Add at the end',
  prepend: 'Add at the start',
  rewrite: 'Rewrite the whole note'
});

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopFileEditOperation: React.FC<WorkshopFileEditOperationProps> = ({ view, pending, preview, onOpenPreview }) => (
  <li className="pm-ws-file-edit-op">
    <div className="pm-ws-file-edit-op-head">
      <span className="pm-ws-file-edit-op-label">{HEADINGS[view.kind]}</span>
      {view.outcome && (
        <span className={`pm-ws-file-edit-outcome pm-ws-file-edit-outcome-${view.outcome}`}>
          {WORKSHOP_FILE_EDIT_OUTCOME_LABELS[view.outcome]}
        </span>
      )}
    </div>
    <OperationBody view={view} pending={pending} preview={preview} onOpenPreview={onOpenPreview} />
  </li>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const OperationBody: React.FC<WorkshopFileEditOperationProps> = ({ view, pending, preview, onOpenPreview }) => {
  switch (view.kind) {
    case 'replace':
      return (
        <p className="pm-ws-file-edit-diff">
          {view.segments.map((segment, at) => {
            if (segment.kind === 'removed') {
              return <del key={at}><span className="pm-ws-visually-hidden">removed: </span>{segment.text}</del>;
            }
            if (segment.kind === 'added') {
              return <ins key={at}><span className="pm-ws-visually-hidden">added: </span>{segment.text}</ins>;
            }
            return <span key={at}>{segment.text}</span>;
          })}
        </p>
      );
    case 'append':
    case 'prepend':
      return <p className="pm-ws-file-edit-diff"><ins>{view.text}</ins></p>;
    case 'rewrite':
      return <RewriteBody view={view} pending={pending} preview={preview} onOpenPreview={onOpenPreview} />;
  }
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const RewriteBody: React.FC<WorkshopFileEditOperationProps & { view: Extract<WorkshopFileEditOperationView, { kind: 'rewrite' }> }> = ({
  view,
  pending,
  preview,
  onOpenPreview
}) => {
  if (!pending) {
    return view.landed
      ? <BeforeAfter summary="What it replaced" before={view.landed.before} after={view.landed.after} />
      : (
        <details className="pm-ws-file-edit-rewrite">
          <summary>The rewrite</summary>
          <pre className="pm-ws-file-edit-text">{view.text}</pre>
        </details>
      );
  }
  return <PendingRewrite preview={preview} onOpenPreview={onOpenPreview} />;
};

/**
 * A pending rewrite's before and after, read while its disclosure is open
 * (PR #234 F-01). The preview belongs to the room it was read in: a new room
 * (Open, Branch, Rewind keep turn ids, so this disclosure can stay mounted
 * and open) clears the hook's previews, and an open disclosure with none
 * asks again, for the room now on screen. The old room's late answer is
 * the hook's to drop. A refused read is retried only when the writer opens
 * the disclosure again (PR #234 F-02).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const PendingRewrite: React.FC<{ preview?: WorkshopFileEditPreviewView; onOpenPreview: () => void }> = ({ preview, onOpenPreview }) => {
  const [open, setOpen] = React.useState(false);
  const requestPreviewWhenOpenWithout = React.useCallback(() => {
    if (open && !preview) {
      onOpenPreview();
    }
  }, [open, preview, onOpenPreview]);
  React.useEffect(requestPreviewWhenOpenWithout, [requestPreviewWhenOpenWithout]);
  return (
    <details
      className="pm-ws-file-edit-rewrite"
      onToggle={(event) => {
        const opened = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(opened);
        // A writer's reopen retries a refused read (PR #234 F-02); a refused
        // preview left open is never retried on its own, and stale is final.
        if (opened && preview?.status === 'refused') {
          onOpenPreview();
        }
      }}
    >
      <summary>Before and after</summary>
      <RewritePreview preview={preview} />
    </details>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const RewritePreview: React.FC<{ preview?: WorkshopFileEditPreviewView }> = ({ preview }) => {
  if (!preview || preview.status === 'loading') {
    return <p className="pm-ws-file-edit-note">Reading the file…</p>;
  }
  if (preview.status === 'ready') {
    return <BeforeAfterBlocks before={preview.before} after={preview.after} />;
  }
  return <p className={`pm-ws-file-edit-note pm-ws-file-edit-note-${preview.status}`}>{preview.message}</p>;
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const BeforeAfter: React.FC<{ summary: string; before: string; after: string }> = ({ summary, before, after }) => (
  <details className="pm-ws-file-edit-rewrite">
    <summary>{summary}</summary>
    <BeforeAfterBlocks before={before} after={after} />
  </details>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const BeforeAfterBlocks: React.FC<{ before: string; after: string }> = ({ before, after }) => (
  <div className="pm-ws-file-edit-before-after">
    <div>
      <div className="pm-ws-file-edit-side-label">Before</div>
      <pre className="pm-ws-file-edit-text pm-ws-file-edit-before">{before}</pre>
    </div>
    <div>
      <div className="pm-ws-file-edit-side-label">After</div>
      <pre className="pm-ws-file-edit-text pm-ws-file-edit-after">{after}</pre>
    </div>
  </div>
);
