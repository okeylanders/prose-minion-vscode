/**
 * The one memory card (Slice 0d, "One component, two modes"; ADR 2026-11-04
 * D6, D7). Ask first's suggestion card under a persona's reply, the held
 * card of Save and tell me (Slice 5), and the expanded receipt (Slice 5)
 * are this component:
 *
 * - with `actions`, a suggestion: Save · Edit… · Dismiss and the hint;
 * - with `held`, the same, under an amber border with the reason;
 * - with neither, read-only: the saved memory, no buttons.
 *
 * It shows what the host gave it, never memory text from anywhere else.
 * The UI never says "pin" (Slice 0d decision 16).
 */

import * as React from 'react';
import type { WorkshopMemoryProposalReplaces } from '@messages';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import { Icon } from '@components/shared/Icon';

export const WORKSHOP_MEMORY_KIND_LABELS: Readonly<Record<ProjectMemoryKind, string>> = Object.freeze({
  decision: 'decision',
  canon: 'canon',
  theme: 'theme',
  preference: 'preference',
  idea: 'idea',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ProjectMemoryKind ids are kebab-case format literals.
  'open-thread': 'open thread'
});

export interface WorkshopMemoryCardActions {
  busy: boolean;
  onSave: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

export interface WorkshopMemoryCardProps {
  /** "Suggested for project memory", "Held for you to decide", "Saved to project memory". */
  heading: string;
  kind: ProjectMemoryKind;
  title: string;
  summary: string;
  body: string;
  replaces?: readonly WorkshopMemoryProposalReplaces[];
  /** Replaced memories the persona named that no saved memory holds. */
  droppedReplaces?: number;
  actions?: WorkshopMemoryCardActions;
  /** Why a held card waits (Slice 5). */
  held?: string;
  error?: string;
  id?: string;
  className?: string;
}

const HINT = 'Saved to this project only. Later conversations start knowing it.';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryCard: React.FC<WorkshopMemoryCardProps> = ({
  heading,
  kind,
  title,
  summary,
  body,
  replaces = [],
  droppedReplaces = 0,
  actions,
  held,
  error,
  id,
  className
}) => (
  <div
    id={id}
    className={`pm-ws-memory-card${held ? ' pm-ws-memory-card-held' : ''}${actions || held ? '' : ' pm-ws-memory-card-saved'}${className ? ` ${className}` : ''}`}
    role="group"
    aria-label={held ? 'Suggested memory, held for you' : actions ? 'Suggested memory' : 'Saved memory'}
  >
    <div className="pm-ws-memory-card-head">
      <span className="pm-ws-memory-card-title">
        <Icon name={held ? 'alert' : 'bookmark'} size={12} /> {heading}
      </span>
      <span className="pm-ws-memory-kind">{WORKSHOP_MEMORY_KIND_LABELS[kind]}</span>
    </div>
    <div className="pm-ws-memory-name">{title}</div>
    <div className="pm-ws-memory-summary">{summary}</div>
    {replaces.map((replaced) => (
      <div className="pm-ws-memory-replaces" key={replaced.id}>
        Replaces <b>{replaced.title}</b>, which stays searchable.
      </div>
    ))}
    {droppedReplaces > 0 && (
      <div className="pm-ws-memory-replaces">
        {droppedReplaces === 1
          ? 'It named one memory to replace that isn\'t saved here, so that one was left out.'
          : `It named ${droppedReplaces} memories to replace that aren't saved here, so those were left out.`}
      </div>
    )}
    {body.trim() && (
      <details className="pm-ws-memory-note">
        <summary>Full note</summary>
        <p>{body}</p>
      </details>
    )}
    {error && <div className="pm-ws-memory-error" role="alert">{error}</div>}
    {actions && (
      <div className="pm-ws-memory-card-foot">
        <button type="button" className="pm-ws-memory-save" disabled={actions.busy} onClick={actions.onSave}>
          <Icon name="check" size={12} /> {actions.busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="pm-ws-memory-ghost" disabled={actions.busy} onClick={actions.onEdit}>
          Edit…
        </button>
        <button type="button" className="pm-ws-memory-ghost" disabled={actions.busy} onClick={actions.onDismiss}>
          Dismiss
        </button>
        <span className={`pm-ws-memory-why${held ? ' pm-ws-memory-why-held' : ''}`}>{held ?? HINT}</span>
      </div>
    )}
  </div>
);
