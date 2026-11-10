/**
 * Completing the run a press started (ADR 2026-11-10 D5, D6; epic Slice 2):
 * the answer's own decision tree, in place of `completeWorkshopRun`.
 *
 * - **The answer is read with every other trailer closed**
 *   (`readWorkshopEditOfferAnswer`). File-edit frames are staged as on any
 *   reply (`resolveWorkshopReplyEdits`, by the room), then each card is held
 *   to the press:
 *   - a card staged to a file other than the offer's is refused
 *     (`not-the-offered-file`);
 *   - a fixes answer's cards carry `intent: 'fixes'`, and one that breaks the
 *     fixes policy is refused at once (`more-than-a-fix`); the gateway holds
 *     the rest to it at every Apply.
 * - **`none`** is exactly the no-file-edit frame, with its one-line why.
 * - **Neither** (after the engine's correction turn) is a failure.
 * - **A cut-off answer** (the token ceiling, or an interrupted stream) is a
 *   failure too, never salvaged: the engine's check refused it by the same
 *   fact (`finishReason`) and retained nothing (PR #252 F-01).
 * - **The persona's prose is never shown or kept.** The bubble holds the
 *   host's line; stray prose is counted in the log, never logged. The
 *   actionable-findings reader and the widget-recommendation reader are not
 *   run, so an answer adds no next steps and no widget chip. The turn
 *   carries no model stamp: the host wrote what it shows.
 * - **A stopped or failed run leaves no turns:** the press's writer turn is
 *   rolled back, so the offer reads open again. Capability cards the run
 *   already published stay, as on any rollback.
 *
 * Logs carry ids, kinds, counts and fault names: never a path, a quote, the
 * why or any of the reply.
 */

import {
  isApiKeyNotConfiguredWarning,
  type WorkshopEditOffer,
  type WorkshopEditOfferAnswer,
  type WorkshopEditOfferRefusal,
  type WorkshopEditOfferRequest,
  type WorkshopFileEditProposal,
  type WorkshopTurn
} from '@messages';
import { FILE_EDIT_INTENT_POLICIES, FILE_EDIT_MORE_THAN_A_FIX } from '@/domain/models/FileEdit';
import { intentFaults } from '@/application/services/fileEdits/fileEditPolicyChecks';
import type { WorkshopRunCompletionInput } from '@/application/services/workshop/WorkshopRunCompletion';
import { recordWorkshopRetainedHistoryCommit } from '@/application/services/workshop/WorkshopRetainedHistoryCommit';
import { isAgentRunIncomplete } from '@orchestration/AgentRunContracts';
import {
  workshopEditOfferNoneLine,
  workshopEditOfferProposedLine,
  workshopEditOfferRetainedLine
} from '@shared/constants/workshopEditOfferWords';
import { readWorkshopEditOfferAnswer, type WorkshopEditOfferAnswerDropped } from '@/utils/workshopEditOfferAnswer';

/** The reason a card for another file than the offer's carries (D5). */
export const WORKSHOP_FILE_EDIT_NOT_THE_OFFERED_FILE = 'not-the-offered-file';

/** What a press's run came to, as its route answers it. */
export type WorkshopEditOfferRunOutcome =
  | { readonly kind: 'answered'; readonly turn: WorkshopTurn; readonly cards: number; readonly changes: number }
  | { readonly kind: 'failed'; readonly reason: Extract<WorkshopEditOfferRefusal, 'stopped' | 'no-answer' | 'cut-off' | 'file-edits-off' | 'failed'> };

/** The press a run answers: read from the ledger before the run began. */
export interface WorkshopEditOfferPress {
  readonly request: WorkshopEditOfferRequest;
  /** The source turn's own offer, with its host identity. */
  readonly offer: WorkshopEditOffer;
  /** The source reply's time as the room shows it. */
  readonly sourceAt: string;
  /** `proseMinion.workshop.fileEdits` is still `ask`, read at completion. */
  readonly fileEditsOpen: () => boolean;
  readonly settled: (outcome: WorkshopEditOfferRunOutcome) => void;
}

/** What retained history keeps in place of a press's answer (D5): the host's line. */
export function workshopEditOfferRetainedReply(kind: WorkshopEditOfferRequest['kind'], reply: string): string {
  const read = readWorkshopEditOfferAnswer(reply);
  return workshopEditOfferRetainedLine(kind, read.outcome === 'proposed'
    ? { outcome: 'proposed', changes: read.proposals.reduce((sum, proposal) => sum + proposal.operations.length, 0) }
    : read);
}

/** The cards an answer keeps, each held to the press (D5, D6). */
export function workshopEditOfferAnswerCards(
  staged: readonly WorkshopFileEditProposal[],
  offer: Pick<WorkshopEditOffer, 'kind' | 'target'>
): WorkshopFileEditProposal[] {
  return staged.map((card): WorkshopFileEditProposal => {
    const intent = offer.kind === 'fixes' ? { intent: 'fixes' as const } : {};
    if (!card.target) {
      // Refused at staging: it has no identity to compare, and keeps its own reason.
      return { ...card, ...intent };
    }
    if (card.target.documentUri !== offer.target.documentUri) {
      return { ...card, ...intent, state: 'refused', reason: WORKSHOP_FILE_EDIT_NOT_THE_OFFERED_FILE };
    }
    if (card.state === 'pending' && offer.kind === 'fixes' && intentFaults(card.operations, FILE_EDIT_INTENT_POLICIES.fixes).length > 0) {
      return { ...card, ...intent, state: 'refused', reason: FILE_EDIT_MORE_THAN_A_FIX };
    }
    return { ...card, ...intent };
  });
}

/**
 * Settle a press's provider result against the session. Returns the answer
 * turn, or undefined when the run was stopped, unusable, or no answer.
 */
export function completeWorkshopEditOfferRun(input: WorkshopRunCompletionInput, press: WorkshopEditOfferPress): WorkshopTurn | undefined {
  const { session, requestId, label, result, events } = input;
  const { kind, sourceTurnId } = press.request;
  const where = `source=${sourceTurnId} kind=${kind}`;
  const fail = (reason: Extract<WorkshopEditOfferRunOutcome, { kind: 'failed' }>['reason'], line: string): undefined => {
    input.log(`Edit offer run left no answer (${where}; reason=${reason}; ${line})`);
    // No turn is kept: the press's writer turn leaves with the run, so the offer reads open again.
    if (!session.rollbackMessageRun(requestId)) {
      session.abandonRun(requestId);
    }
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    press.settled({ kind: 'failed', reason });
    return undefined;
  };

  if (input.aborted) {
    events.status(input.copy.cancelledStatus);
    return fail('stopped', `${result.content.length} chars discarded`);
  }
  if (isApiKeyNotConfiguredWarning(result.content)) {
    events.error(input.copy.apiKeyMissingError, result.content);
    return fail('failed', 'api-key-missing');
  }
  if (input.createsRetainedConversation && !result.conversationId) {
    events.error(input.copy.retentionFailedError, 'The participant response did not return a retained conversation.');
    return fail('failed', 'no-retained-conversation');
  }

  // The engine's check refused a cut-off reply and retained nothing (PR #252 F-01); completion reads the same fact.
  if (isAgentRunIncomplete(result.finishReason)) {
    return fail('cut-off', `finish=${result.finishReason === 'length' ? 'length' : 'interrupted'}`);
  }
  const read = readWorkshopEditOfferAnswer(result.content);
  const dropped = droppedLine(read.dropped);
  if (read.outcome === 'neither') {
    return fail('no-answer', dropped);
  }
  if (!press.fileEditsOpen()) {
    return fail('file-edits-off', dropped);
  }
  let cards: WorkshopFileEditProposal[] = [];
  let answer: WorkshopEditOfferAnswer;
  let content: string;
  if (read.outcome === 'none') {
    answer = { sourceTurnId, kind, outcome: 'none', why: read.why };
    content = workshopEditOfferNoneLine(label, read.why);
  } else {
    // The room staged this reply's frames (`resolveWorkshopReplyEdits`); anything else was never staged.
    const staged = input.fileEdits?.reply === result.content ? input.fileEdits : undefined;
    for (const line of staged?.logs ?? []) {
      input.log(`${line} (${label})`);
    }
    cards = workshopEditOfferAnswerCards(staged?.proposals ?? [], press.offer);
    if (cards.length === 0) {
      return fail('no-answer', `${dropped}; staged=0`);
    }
    const changes = cards.reduce((sum, card) => sum + card.operations.length, 0);
    answer = { sourceTurnId, kind, outcome: 'proposed' };
    content = workshopEditOfferProposedLine(kind, changes, press.offer.target.relativePath, press.sourceAt);
  }

  const turn = session.completeRun(
    requestId,
    content,
    result.usage,
    false,
    result.conversationId,
    [],
    undefined,
    undefined,
    // The host wrote the line it shows, so the turn carries no model stamp.
    undefined,
    [],
    cards,
    [],
    answer
  );
  if (!turn) {
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    input.log(`Discarded zombie edit offer answer: ${requestId} (${where})`);
    press.settled({ kind: 'failed', reason: 'failed' });
    return undefined;
  }
  const changes = cards.reduce((sum, card) => sum + card.operations.length, 0);
  input.log(`Edit offer answered (${where}; outcome=${answer.outcome}; cards=${cards.length}; changes=${changes}; ` +
    `refused=${cards.filter((card) => card.state === 'refused').length}; ${dropped})`);
  try {
    events.streamCompleted(requestId, content, false, result.usage, turn.truncated === true);
    events.turnCompleted(turn);
    input.settleCommittedRun?.(turn);
  } finally {
    // The history is committed whether or not settlement finished, so the mark is always recorded.
    recordWorkshopRetainedHistoryCommit({
      session,
      turn,
      conversationId: result.conversationId,
      readRetainedHistory: input.readRetainedHistory,
      log: input.log
    });
  }
  press.settled({ kind: 'answered', turn, cards: cards.length, changes });
  return turn;
}

function droppedLine(dropped: WorkshopEditOfferAnswerDropped): string {
  return `dropped: fileEdits=${dropped.fileEdits} memory=${dropped.memory} editOffers=${dropped.editOffers} ` +
    `noFileEdit=${dropped.noFileEdit} strayCharacters=${dropped.strayCharacters}`;
}
