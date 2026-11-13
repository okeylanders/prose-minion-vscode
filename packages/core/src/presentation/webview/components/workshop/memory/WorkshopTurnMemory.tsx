/**
 * Project memory in the thread (ADR 2026-11-04 D6, D7; Slice 0d, "In the
 * thread"), rendered by `WorkshopTurnBubble`:
 *
 * - a persona reply's cards (up to `proposalsPerReply`: Slice 6b), each
 *   acted on alone, under a small count when there are several; each in its
 *   states: the suggestion (pending), the
 *   held card under Save and tell me ("Held for you to decide", with the
 *   host's reason: Slice 5), "Saved to project memory: …", and "Dismissed.
 *   … wasn't saved. · Show it again". A card Save and tell me saved shows
 *   nothing here: its receipt carries it;
 * - a receipt divider: "Saved to project memory: …", "Forgotten from
 *   project memory: …. It's archived, not deleted. · Restore", and, for a
 *   save under Save and tell me (Slice 5), "Jill saved to project memory: …
 *   · Edit · Forget", whose chevron expands the saved card, read only and
 *   collapsed by default (Slice 0d decision 13);
 * - "Save to memory…" on a bubble bookmarks allow (ADR 2026-11-03 D5).
 *
 * Every action reaches the host through `WorkshopTurnMemoryControls`; the
 * host's snapshot is the truth.
 */

import * as React from 'react';
import type { WorkshopMemoryProposal, WorkshopTurn } from '@messages';
import { isWorkshopBookmarkableTurn } from '@shared/constants/workshopBookmarks';
import { isWorkshopPersonaId, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopMemoryCardKey, workshopMemoryHeldReason } from '@shared/constants/workshopProjectMemoryWrites';
import { Icon } from '@components/shared/Icon';
import type { WorkshopAutoSavedMemories } from '@hooks/domain/workshop/memory/workshopMemoryAutoReceipts';
import { WorkshopMemoryCard } from './WorkshopMemoryCard';
import { WorkshopMemoryEditCard } from './WorkshopMemoryEditCard';

/** What the thread can ask of project memory; WorkshopApp wires the memory hook in. */
export interface WorkshopTurnMemoryControls {
  /** True while the room's mutation lock is held. */
  disabled: boolean;
  /** Cards whose action waits for the host, by `workshopMemoryCardKey`. */
  busyCards: ReadonlySet<string>;
  /** A card's refusal, by `workshopMemoryCardKey`. */
  cardErrors: ReadonlyMap<string, string>;
  onSaveCard: (turnId: string, index: number) => void;
  onEditCard: (turn: WorkshopTurn, index: number) => void;
  onDismissCard: (turnId: string, index: number) => void;
  onReopenCard: (turnId: string, index: number) => void;
  onSaveTurn: (turn: WorkshopTurn) => void;
  onEditMemory: (memoryId: string) => void;
  /** Forget on a receipt, named by its memory and the receipt's turn id. */
  onForget: (memoryId: string, receiptTurnId: string) => void;
  /** Restore on a forgotten receipt, named the same way. */
  onRestore: (memoryId: string, receiptTurnId: string) => void;
  /** Receipts whose Forget or Restore waits for the host, by turn id; absent reads as none. */
  busyReceipts?: ReadonlySet<string>;
  /** A receipt's refused Forget or Restore, by turn id, shown beside it (PR #221 F-01); absent reads as none. */
  receiptErrors?: ReadonlyMap<string, { readonly action: 'forget' | 'restore'; readonly error: string }>;
  /** Save and tell me's saved cards, from the snapshot's turns (Slice 5); absent reads as none. */
  autoSaved?: WorkshopAutoSavedMemories;
  /** Slice 4b's manager; the settled card offers "Open in manager" only when it exists. */
  onOpenManager?: (memoryId: string) => void;
}

/**
 * A persona reply's cards: one, or several under a small count (Slice 6b).
 * A card Save and tell me saved shows on its receipt, not here, so the
 * visible cards are worked out first, each keeping its index on the turn
 * (PR #209 F-01): none renders nothing, one is a plain card, and the count
 * names only the cards shown.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTurnMemoryCards: React.FC<{ turn: WorkshopTurn; controls: WorkshopTurnMemoryControls }> = ({ turn, controls }) => {
  const visible = (turn.memoryProposals ?? [])
    .map((proposal, index) => ({ proposal, index }))
    .filter(({ proposal, index }) => !(proposal.state === 'saved' && controls.autoSaved?.cardKeys.has(workshopMemoryCardKey(turn.id, index))));
  if (visible.length === 0) {
    return null;
  }
  const cards = visible.map(({ proposal, index }) => (
    <WorkshopTurnMemoryItem key={index} turn={turn} index={index} proposal={proposal} controls={controls} />
  ));
  if (visible.length === 1) {
    return <>{cards}</>;
  }
  return (
    <div className="pm-ws-memory-stack" role="group" aria-label={`${visible.length} memory suggestions`}>
      <div className="pm-ws-memory-stack-head" aria-hidden="true">
        <Icon name="bookmark" size={12} /> {visible.length} suggestions
      </div>
      {cards}
    </div>
  );
};

/** One card, in whichever state the host holds it. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const WorkshopTurnMemoryItem: React.FC<{
  turn: WorkshopTurn;
  index: number;
  proposal: WorkshopMemoryProposal;
  controls: WorkshopTurnMemoryControls;
}> = ({ turn, index, proposal, controls }) => {
  const key = workshopMemoryCardKey(turn.id, index);
  const busy = controls.disabled || controls.busyCards.has(key);
  if (proposal.state === 'saved') {
    return (
      <div className="pm-ws-memory-settled">
        <Icon name="check" size={13} />
        <span>{proposal.proposes === 'edit' ? 'Updated in project memory' : 'Saved to project memory'}: <b>{proposal.title}</b></span>
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
        <span>
          {proposal.proposes === 'edit'
            ? <>Dismissed. The change to <b>{proposal.before.title}</b> wasn&apos;t saved.</>
            : <>Dismissed. <b>{proposal.title}</b> wasn&apos;t saved.</>}
        </span>
        <button type="button" className="pm-ws-memory-link" disabled={busy} onClick={() => controls.onReopenCard(turn.id, index)}>
          Show it again
        </button>
      </div>
    );
  }
  const actions = {
    busy,
    onSave: () => controls.onSaveCard(turn.id, index),
    onEdit: () => controls.onEditCard(turn, index),
    onDismiss: () => controls.onDismissCard(turn.id, index)
  };
  if (proposal.proposes === 'edit') {
    return (
      <WorkshopMemoryEditCard
        proposal={proposal}
        actions={actions}
        {...(proposal.held ? { held: workshopMemoryHeldReason(proposal.held, proposal.heldWord) } : {})}
        error={controls.cardErrors.get(key)}
      />
    );
  }
  return (
    <WorkshopMemoryCard
      heading={proposal.held ? 'Held for you to decide' : 'Suggested for project memory'}
      {...(proposal.held ? { held: workshopMemoryHeldReason(proposal.held, proposal.heldWord) } : {})}
      kind={proposal.kind}
      title={proposal.title}
      summary={proposal.summary}
      body={proposal.body}
      replaces={proposal.supersedes}
      droppedReplaces={proposal.droppedSupersedes}
      error={controls.cardErrors.get(key)}
      actions={actions}
    />
  );
};

/** A receipt divider (D7): every participant received it as room history. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopMemoryReceiptLine: React.FC<{ turn: WorkshopTurn; controls?: WorkshopTurnMemoryControls }> = ({ turn, controls }) => {
  // Collapsed by default (Slice 0d decision 13); kept per receipt while it is on screen.
  const [open, setOpen] = React.useState(false);
  const receipt = turn.projectMemoryReceipt;
  if (!receipt) {
    return null;
  }
  const busy = controls?.busyReceipts?.has(turn.id) ?? false;
  const disabled = (controls?.disabled ?? true) || busy;
  const refused = controls?.receiptErrors?.get(turn.id);
  const title = <b>{receipt.title}</b>;
  const saved = receipt.action === 'saved' && receipt.by === 'auto' ? controls?.autoSaved?.cards.get(turn.id) : undefined;
  const cardId = `pm-ws-memory-receipt-${turn.id}`;
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
            <button type="button" className="pm-ws-memory-link" disabled={disabled} aria-busy={busy || undefined} onClick={() => controls.onForget(receipt.memoryId, turn.id)}>Forget</button>
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
          <button type="button" className="pm-ws-memory-link" disabled={disabled} aria-busy={busy || undefined} onClick={() => controls.onRestore(receipt.memoryId, turn.id)}>
            Restore
          </button>
        );
      }
      break;
    case 'restored':
      line = <>Restored to project memory: {title}</>;
      break;
  }
  // A receipt with controls is a labelled group, its rules drawn by CSS and
  // decorative; one with none stays a separator (PR #201, accessibility).
  const interactive = actions !== null || saved !== undefined;
  const divider = (
    <div
      className={`pm-ws-memory-receipt${receipt.action === 'forgotten' ? ' pm-ws-memory-receipt-gone' : ''}`}
      role={interactive ? 'group' : 'separator'}
      aria-label={turn.content}
    >
      <span className="pm-ws-memory-receipt-in">
        {saved && (
          <button
            type="button"
            className={`pm-ws-memory-expand${open ? ' pm-ws-memory-expand-open' : ''}`}
            aria-expanded={open}
            aria-controls={cardId}
            aria-label={open ? 'Hide the saved memory' : 'Show the saved memory'}
            onClick={() => setOpen((current) => !current)}
          >
            <Icon name="chevRight" size={12} />
          </button>
        )}
        <Icon name={receipt.action === 'forgotten' ? 'trash' : 'bookmark'} size={12} />
        <span>{line}</span>
        {actions}
      </span>
    </div>
  );
  // A refused Forget or Restore is said under its own receipt, as an alert,
  // until the next try, a success, or a new room (PR #221 F-01).
  const refusal = refused && (
    <div className="pm-ws-memory-receipt-error" role="alert">
      <b>{refused.action === 'forget' ? 'Couldn\u2019t forget it.' : 'Couldn\u2019t restore it.'}</b> {refused.error}
    </div>
  );
  if (!saved) {
    return refusal ? <>{divider}{refusal}</> : divider;
  }
  return (
    <div className="pm-ws-memory-receipt-expandable">
      {divider}
      {refusal}
      <div id={cardId} hidden={!open}>
        {open && (
          <WorkshopMemoryCard
            heading="Saved to project memory"
            kind={saved.kind}
            title={saved.title}
            summary={saved.summary}
            body={saved.body}
            {...(saved.proposes === 'new' ? { replaces: saved.supersedes, droppedReplaces: saved.droppedSupersedes } : {})}
          />
        )}
      </div>
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
