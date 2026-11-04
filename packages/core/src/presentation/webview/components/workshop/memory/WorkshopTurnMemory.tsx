/**
 * Project memory in the thread (ADR 2026-11-04 D6, D7; Slice 0d, "In the
 * thread"), rendered by `WorkshopTurnBubble`:
 *
 * - a persona reply's card, in its three states: the suggestion (pending),
 *   "Saved to project memory: …", and "Dismissed. … wasn't saved. · Show it
 *   again";
 * - a receipt divider: "Saved to project memory: …", "Forgotten from
 *   project memory: …. It's archived, not deleted. · Restore", and, for a
 *   save under Save and tell me (Slice 5), "… · Edit · Forget";
 * - "Save to memory…" on a bubble bookmarks allow (ADR 2026-11-03 D5).
 *
 * Every action reaches the host through `WorkshopTurnMemoryControls`; the
 * host's snapshot is the truth.
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { isWorkshopBookmarkableTurn } from '@shared/constants/workshopBookmarks';
import { isWorkshopPersonaId, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { Icon } from '@components/shared/Icon';
import { WorkshopMemoryCard } from './WorkshopMemoryCard';

/** What the thread can ask of project memory; WorkshopApp wires the memory hook in. */
export interface WorkshopTurnMemoryControls {
  /** True while the room's mutation lock is held. */
  disabled: boolean;
  busyTurnIds: ReadonlySet<string>;
  cardErrors: ReadonlyMap<string, string>;
  onSaveCard: (turnId: string) => void;
  onEditCard: (turn: WorkshopTurn) => void;
  onDismissCard: (turnId: string) => void;
  onReopenCard: (turnId: string) => void;
  onSaveTurn: (turn: WorkshopTurn) => void;
  onEditMemory: (memoryId: string) => void;
  onForget: (memoryId: string) => void;
  onRestore: (memoryId: string) => void;
  /** Slice 4b's manager; the settled card offers "Open in manager" only when it exists. */
  onOpenManager?: (memoryId: string) => void;
}

/** A persona reply's card, in whichever state the host holds it. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTurnMemoryCard: React.FC<{ turn: WorkshopTurn; controls: WorkshopTurnMemoryControls }> = ({ turn, controls }) => {
  const proposal = turn.memoryProposal;
  if (!proposal) {
    return null;
  }
  const busy = controls.disabled || controls.busyTurnIds.has(turn.id);
  if (proposal.state === 'saved') {
    return (
      <div className="pm-ws-memory-settled">
        <Icon name="check" size={13} />
        <span>Saved to project memory: <b>{proposal.title}</b></span>
        {controls.onOpenManager && proposal.memoryId && (
          <button type="button" className="pm-ws-memory-link" onClick={() => controls.onOpenManager!(proposal.memoryId!)}>
            Open in manager
          </button>
        )}
      </div>
    );
  }
  if (proposal.state === 'dismissed') {
    return (
      <div className="pm-ws-memory-settled pm-ws-memory-settled-off">
        <Icon name="x" size={13} />
        <span>Dismissed. <b>{proposal.title}</b> wasn&apos;t saved.</span>
        <button type="button" className="pm-ws-memory-link" disabled={busy} onClick={() => controls.onReopenCard(turn.id)}>
          Show it again
        </button>
      </div>
    );
  }
  return (
    <WorkshopMemoryCard
      heading="Suggested for project memory"
      kind={proposal.kind}
      title={proposal.title}
      summary={proposal.summary}
      body={proposal.body}
      replaces={proposal.supersedes}
      droppedReplaces={proposal.droppedSupersedes}
      error={controls.cardErrors.get(turn.id)}
      actions={{
        busy,
        onSave: () => controls.onSaveCard(turn.id),
        onEdit: () => controls.onEditCard(turn),
        onDismiss: () => controls.onDismissCard(turn.id)
      }}
    />
  );
};

/** A receipt divider (D7): every participant received it as room history. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryReceiptLine: React.FC<{ turn: WorkshopTurn; controls?: WorkshopTurnMemoryControls }> = ({ turn, controls }) => {
  const receipt = turn.projectMemoryReceipt;
  if (!receipt) {
    return null;
  }
  const disabled = controls?.disabled ?? true;
  const title = <b>{receipt.title}</b>;
  let line: React.ReactNode;
  let actions: React.ReactNode = null;
  switch (receipt.action) {
    case 'saved':
      line = receipt.by === 'auto' && receipt.proposedBy && isWorkshopPersonaId(receipt.proposedBy)
        ? <>{workshopPersonaLabel(receipt.proposedBy)} saved to project memory: {title}</>
        : <>Saved to project memory: {title}</>;
      if (receipt.by === 'auto' && controls) {
        actions = (
          <>
            <button type="button" className="pm-ws-memory-link" disabled={disabled} onClick={() => controls.onEditMemory(receipt.memoryId)}>Edit</button>
            <span aria-hidden="true">·</span>
            <button type="button" className="pm-ws-memory-link" disabled={disabled} onClick={() => controls.onForget(receipt.memoryId)}>Forget</button>
          </>
        );
      }
      break;
    case 'updated':
      line = <>Updated in project memory: {title}</>;
      break;
    case 'forgotten':
      line = <>Forgotten from project memory: {title}. It&apos;s archived, not deleted.</>;
      if (controls) {
        actions = (
          <button type="button" className="pm-ws-memory-link" disabled={disabled} onClick={() => controls.onRestore(receipt.memoryId)}>
            Restore
          </button>
        );
      }
      break;
    case 'restored':
      line = <>Restored to project memory: {title}</>;
      break;
  }
  return (
    <div
      className={`pm-ws-memory-receipt${receipt.action === 'forgotten' ? ' pm-ws-memory-receipt-gone' : ''}`}
      role="separator"
      aria-label={turn.content}
    >
      <span className="pm-ws-memory-receipt-in">
        <Icon name={receipt.action === 'forgotten' ? 'trash' : 'bookmark'} size={12} />
        <span>{line}</span>
        {actions}
      </span>
    </div>
  );
};

/** "Save to memory…" on a bubble bookmarks allow (ADR 2026-11-03 D5's eligibility). */
export function workshopSaveToMemoryAction(turn: WorkshopTurn, controls: WorkshopTurnMemoryControls | undefined): React.ReactNode {
  if (!controls || !isWorkshopBookmarkableTurn(turn)) {
    return null;
  }
  return (
    <button
      type="button"
      className="pm-ws-save-to-memory"
      disabled={controls.disabled}
      title="Save this as a project memory: later conversations start knowing it"
      onClick={() => controls.onSaveTurn(turn)}
    >
      <Icon name="bookmark" size={13} /> Save to memory…
    </button>
  );
}
