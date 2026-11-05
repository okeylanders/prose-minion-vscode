/**
 * A persona's suggested change to a saved memory (epic Slice 6c), under its
 * reply: the memory it changes, and each changed field as before → after
 * (`workshopMemoryEditView`): title, kind and summary whole, the body's
 * changed region with a little context, collapsed when it is long.
 *
 * - Pending: Save · Edit… · Dismiss, like any card. Edit… opens the sheet
 *   filled with the result.
 * - Held under Save and tell me: amber, with why (an edit always waits).
 * - Stale (a Save found the note changed since): what happened, and Dismiss
 *   alone, so nothing offers the old text again.
 *
 * It shows what the host gave it, never memory text from anywhere else.
 */

import * as React from 'react';
import type { WorkshopMemoryEditProposal } from '@messages';
import { WORKSHOP_MEMORY_EDIT_CHANGED } from '@shared/constants/workshopProjectMemoryWrites';
import { workshopMemoryEditView } from '@hooks/domain/workshop/memory/workshopMemoryEditView';
import { Icon } from '@components/shared/Icon';
import { WORKSHOP_MEMORY_KIND_LABELS, type WorkshopMemoryCardActions } from './WorkshopMemoryCard';

export interface WorkshopMemoryEditCardProps {
  proposal: WorkshopMemoryEditProposal;
  actions: WorkshopMemoryCardActions;
  /** Why a held card waits. */
  held?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryEditCard: React.FC<WorkshopMemoryEditCardProps> = ({ proposal, actions, held, error }) => {
  const view = workshopMemoryEditView(proposal, (kind) => WORKSHOP_MEMORY_KIND_LABELS[kind]);
  const stale = proposal.stale === true;
  const body = view.body;
  const bodyChange = body && (
    <div className="pm-ws-memory-change">
      <span className="pm-ws-memory-change-label">Note</span>
      <p className="pm-ws-memory-change-body">
        {body.lead && <span className="pm-ws-memory-change-context">{body.lead}</span>}
        {body.removed && <del>{body.removed}</del>}
        {body.added && <ins>{body.added}</ins>}
        {body.trail && <span className="pm-ws-memory-change-context">{body.trail}</span>}
      </p>
    </div>
  );
  return (
    <div
      className={`pm-ws-memory-card pm-ws-memory-card-edit${held || stale ? ' pm-ws-memory-card-held' : ''}`}
      role="group"
      aria-label={stale ? 'Suggested change, out of date' : held ? 'Suggested change, held for you' : 'Suggested change'}
    >
      <div className="pm-ws-memory-card-head">
        <span className="pm-ws-memory-card-title">
          <Icon name={held || stale ? 'alert' : 'pen'} size={12} /> {held ? 'Held for you to decide' : 'Suggested change to project memory'}
        </span>
        <span className="pm-ws-memory-kind">{WORKSHOP_MEMORY_KIND_LABELS[proposal.kind]}</span>
      </div>
      <div className="pm-ws-memory-name">{proposal.before.title}</div>
      {view.fields.map((change) => (
        <div className="pm-ws-memory-change" key={change.field}>
          <span className="pm-ws-memory-change-label">{change.label}</span>
          <p className="pm-ws-memory-change-body">
            <del>{change.before}</del>
            <span aria-hidden="true"> → </span>
            <ins>{change.after}</ins>
          </p>
        </div>
      ))}
      {body && (body.long
        ? <details className="pm-ws-memory-note"><summary>Changes to the note</summary>{bodyChange}</details>
        : bodyChange)}
      {(error || stale) && <div className="pm-ws-memory-error" role="alert">{error ?? WORKSHOP_MEMORY_EDIT_CHANGED}</div>}
      <div className="pm-ws-memory-card-foot">
        {!stale && (
          <>
            <button type="button" className="pm-ws-memory-save" disabled={actions.busy} onClick={actions.onSave}>
              <Icon name="check" size={12} /> {actions.busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="pm-ws-memory-ghost" disabled={actions.busy} onClick={actions.onEdit}>
              Edit…
            </button>
          </>
        )}
        <button type="button" className="pm-ws-memory-ghost" disabled={actions.busy} onClick={actions.onDismiss}>
          Dismiss
        </button>
        <span className={`pm-ws-memory-why${held ? ' pm-ws-memory-why-held' : ''}`}>
          {stale ? 'The note was changed after this was suggested.' : held ?? 'Changes this saved memory. Later conversations see the change.'}
        </span>
      </div>
    </div>
  );
};
