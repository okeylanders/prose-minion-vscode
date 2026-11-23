/**
 * The results this window holds for its passage-search cards, and their
 * delivery to the persona who asked (ADR 2026-11-20 D19a, D21). The route
 * owner (`WorkshopPassageSearchHandler`) holds one.
 *
 * - **Held by the card's turn,** oldest first: at most `heldResults` (D21;
 *   PR #296 F5). Past it, the oldest delivered result is evicted. One not
 *   yet delivered is never evicted, and a delivery that is not adopted never
 *   touches it, so Send can always try again; instead, a new search is
 *   refused before anything is planned or sent while every place holds a
 *   result not yet delivered (`full`), until Send or Discard frees one. A
 *   result is otherwise dropped only by Discard, or when its room is
 *   replaced.
 * - **A result belongs to one open room** (D19; PR #296 F3). The
 *   coordinator tells each replacement as it lands
 *   (`WorkshopOpenRoomInstance`). Every one but a Rewind opens another room
 *   (New, Open, Branch, a reload of the same named session, a rollback) and
 *   drops every result. A Rewind of the same open room keeps each result
 *   whose card turn the ledger still holds exactly as it was searched,
 *   question and scopes, unanswered: a Rewind that cut only the delivery's
 *   reply leaves the card `ready`, and Send needs no second search. Turn ids
 *   are never reused in a room, so a kept id is the same card. A session id
 *   cannot do this: reopening a named session keeps it.
 * - **A replacement nobody told** (the revision or the instance moved with
 *   no word) drops every result: a result survives only a Rewind the
 *   coordinator announced.
 * - **Every send checks first,** and nothing is awaited between the last
 *   check and the dispatch: no session save or room replacement pending
 *   (the guard an explicit Send passes at its route, applied to the host's
 *   own send too: PR #296), this room, the card still here and undelivered,
 *   its author still in the room, no run going, no other delivery in
 *   flight.
 * - **A delivery is a directed run** on the room's one message path. Its
 *   frame is fitted when the path asks for it, with the room the message
 *   has left; the receipt rides the adopted reply's own commit, and any
 *   other outcome rolls the request turn back where the run is given up.
 * - **Logs** carry turn ids, counts and closed reasons only.
 */

import type {
  WorkshopChatTarget,
  WorkshopPassageSearchRefusal,
  WorkshopPersonaId,
  WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPassageSearchFinishedLine } from '@shared/constants/workshopPassageSearchWords';
import { workshopPassageSearchPlaceWords } from '@shared/utils/workshopPassageSearchPlaces';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import {
  fitWorkshopPassageSearchDirective,
  WORKSHOP_PASSAGE_SEARCH_RESULTS_MESSAGE
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { workshopPassageSearchCounts, workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { workshopPassageSearchStatus, type WorkshopPassageSearchWindowCard } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchStatus';
import { isWorkshopPassageSearchFullyRead, workshopPassageSearchCoverage } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchCoverage';
import { workshopEditOfferAuthorTarget } from '@handlers/domain/workshop/WorkshopEditOfferHandler';
import type { WorkshopDirectedRunResult, WorkshopResultsDeliveryRun } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopOpenRoomInstancePort, WorkshopRoomReplacement } from '@/application/services/workshop/WorkshopOpenRoomInstance';

export interface WorkshopPassageSearchDeliverySession {
  readRoomRevision(): number;
  readRoomLedger(): readonly WorkshopTurn[];
  getSelectedPersonaId(): WorkshopPersonaId;
  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean;
  markPassageSearchResultsTurn(turnId: string, cardTurnId: string): WorkshopTurn | undefined;
}

/** The room facts a send reads, which open room this is and each replacement as it lands, and the one message path a delivery runs on. */
export interface WorkshopPassageSearchRoomGate extends WorkshopOpenRoomInstancePort {
  /** Any run going in the room: a reply, or the context wizard. */
  activeRunLabel(): string | undefined;
  /** A session save or room replacement is pending: the mutation routes' own guard. */
  sessionOperationPending(): boolean;
  runDirected(target: WorkshopChatTarget, run: WorkshopResultsDeliveryRun): Promise<WorkshopDirectedRunResult>;
}

/** A card as it was searched: what a Rewind must leave unchanged for its result to stay. */
const cardKey = (card: { readonly question: string; readonly scopes: readonly object[] }): string =>
  JSON.stringify({ question: card.question, scopes: card.scopes });

export type WorkshopPassageSearchRefused = { readonly reason: WorkshopPassageSearchRefusal; readonly message?: string };

export class WorkshopPassageSearchResults {
  /** By the card's turn, oldest first. */
  private readonly held = new Map<string, { readonly result: PassageSearchResult; readonly card: string; delivered: boolean }>();
  /** The open room the held results belong to, and its revision as last told or seen. */
  private heldIn: { readonly instance: number; readonly revision: number } | undefined;
  private sendingTurnId: string | undefined;
  /** The window closed: nothing is held or sent again. */
  private closed = false;

  constructor(
    private readonly session: WorkshopPassageSearchDeliverySession,
    private readonly room: WorkshopPassageSearchRoomGate,
    private readonly log: (line: string) => void
  ) {}

  /** The coordinator's word that the room was replaced: another room takes every result; a Rewind of this one keeps the cards it left unchanged. */
  roomReplaced(replacement: WorkshopRoomReplacement): void {
    if (replacement.rewound && this.heldIn?.instance === replacement.instance) {
      this.keepCardsStillHeld();
    } else {
      this.dropAll('room replaced');
    }
    this.heldIn = { instance: replacement.instance, revision: this.session.readRoomRevision() };
  }

  /** Before any read: a revision or an instance that moved with no word from the coordinator drops everything. */
  sync(): void {
    const now = { instance: this.room.openRoomInstance(), revision: this.session.readRoomRevision() };
    if (this.heldIn && (this.heldIn.instance !== now.instance || this.heldIn.revision !== now.revision)) {
      this.dropAll('room replaced unannounced');
    }
    this.heldIn = now;
  }

  hold(turnId: string, result: PassageSearchResult): void {
    if (this.closed) {
      return;
    }
    this.sync();
    const card = this.session.readRoomLedger().find((turn) => turn.id === turnId)?.passageSearchRequest;
    this.held.delete(turnId);
    if (card === undefined) {
      return;
    }
    this.held.set(turnId, { result, card: cardKey(card), delivered: false });
    this.evict();
  }

  /** After a Rewind of this room: a result stays with its card, unchanged and unanswered, and reads delivered only while the ledger still holds its receipt. */
  private keepCardsStillHeld(): void {
    const ledger = this.session.readRoomLedger();
    let dropped = 0;
    for (const [turnId, entry] of this.held) {
      const request = ledger.find((turn) => turn.id === turnId)?.passageSearchRequest;
      if (!request || request.answer !== undefined || cardKey(request) !== entry.card) {
        this.held.delete(turnId);
        dropped += 1;
        continue;
      }
      entry.delivered = ledger.some((turn) => turn.passageSearchDelivery?.cardTurnId === turnId);
    }
    this.log(`room rewound kept=${this.held.size} dropped=${dropped}`);
  }

  private dropAll(why: 'room replaced' | 'room replaced unannounced'): void {
    if (this.held.size > 0) {
      this.log(`${why} dropped=${this.held.size}`);
      this.held.clear();
    }
  }

  resultOf(turnId: string): PassageSearchResult | undefined {
    this.sync();
    return this.held.get(turnId)?.result;
  }

  /** What a card shows of the result held for it: its counts, and whether it read less than it planned. */
  heldOf(turnId: string): WorkshopPassageSearchWindowCard['held'] {
    const result = this.resultOf(turnId);
    if (!result) {
      return undefined;
    }
    const view = workshopPassageSearchView(result, turnId);
    return { counts: workshopPassageSearchCounts(view, result.requests), partial: !isWorkshopPassageSearchFullyRead(workshopPassageSearchCoverage(view)) };
  }

  /** Every place holds a result not yet delivered: a new search would have nowhere to go. */
  full(): boolean {
    this.sync();
    let undelivered = 0;
    for (const entry of this.held.values()) {
      undelivered += entry.delivered ? 0 : 1;
    }
    return undelivered >= PROMPT_BUDGETS.workshopPassageSearch.heldResults;
  }

  isSending(turnId: string): boolean {
    return this.sendingTurnId === turnId;
  }

  discard(turnId: string): void {
    this.held.delete(turnId);
  }

  /** The window is closing: every result goes, and none is held or sent again. */
  close(): void {
    this.closed = true;
    this.held.clear();
  }

  /** Send a held result to its card's author: `true` once the persona's reply was adopted, else why not. */
  async deliver(turnId: string): Promise<true | WorkshopPassageSearchRefused> {
    if (this.closed) {
      // The panel closed: the directed-run port is never reached.
      return { reason: 'unavailable' };
    }
    if (this.room.sessionOperationPending()) {
      // The room may be about to be replaced: nothing is recorded in it until the operation settles.
      return { reason: 'session-operation' };
    }
    this.sync();
    const ledger = this.session.readRoomLedger();
    const turn = ledger.find((candidate) => candidate.id === turnId);
    const held = this.held.get(turnId);
    if (!turn?.passageSearchRequest) {
      return { reason: 'no-card' };
    }
    if (!held || this.sendingTurnId !== undefined || workshopPassageSearchStatus(ledger, turnId, { running: false, held: true }) !== 'ready') {
      return { reason: 'not-ready' };
    }
    const target = workshopEditOfferAuthorTarget(this.session, turn);
    if (!target) {
      return { reason: 'author-left' };
    }
    if (this.room.activeRunLabel() !== undefined) {
      return { reason: 'run-active' };
    }
    const report = workshopPassageSearchView(held.result, turnId);
    const counts = workshopPassageSearchCounts(report, held.result.requests);
    // Where the card looked, a narrowed group with its patterns, as the card says it (S45).
    const place = workshopPassageSearchPlaceWords(turn.passageSearchRequest.scopes);
    let shown = 0;
    let fits = true;
    this.sendingTurnId = turnId;
    this.log(`delivery started turn=${turnId} author=${target.kind} instances=${counts.instances}`);
    let ran: WorkshopDirectedRunResult;
    try {
      ran = await this.room.runDirected(target, {
        displayText: workshopPassageSearchFinishedLine(counts),
        message: WORKSHOP_PASSAGE_SEARCH_RESULTS_MESSAGE,
        resultsDelivery: {
          frame: (window) => {
            const directive = fitWorkshopPassageSearchDirective(report, window, place);
            fits = directive !== undefined;
            shown = directive?.shown ?? 0;
            this.log(`delivery fitted turn=${turnId} shown=${directive ? directive.shown : 'none'} of=${counts.instances} `
              + `summary=${directive?.summary === true} window=${window ? 'known' : 'unknown'}`);
            return directive?.frame;
          },
          markRequestTurn: (requestTurnId) => this.session.markPassageSearchResultsTurn(requestTurnId, turnId),
          // The receipt rides the adopted reply's own commit; any other outcome rolls the request turn back (D19a).
          completion: () => ({ notAdopted: 'rollback', passageSearchDelivery: { ...counts, calls: { ...counts.calls }, cardTurnId: turnId, shown } })
        }
      });
    } catch {
      ran = { committed: false };
    } finally {
      this.sendingTurnId = undefined;
    }
    if (!fits) {
      // Nothing was recorded or sent; the result stays with its card, and its report can still be opened (D21; PR #296 F4).
      this.log(`delivery refused turn=${turnId} reason=results-too-large`);
      return { reason: 'results-too-large' };
    }
    if (!ran.committed) {
      this.log(`delivery not adopted turn=${turnId} reason=${ran.cancelled ? 'stopped' : ran.refusalReason !== undefined ? 'not-sent' : 'failed'}`);
      return { reason: 'delivery-failed' };
    }
    // Still this room's result: marked delivered, so it may be evicted when a newer one needs its place.
    const kept = this.held.get(turnId);
    if (kept && kept === held) {
      kept.delivered = true;
    }
    this.evict();
    this.log(`delivery adopted turn=${turnId} shown=${shown} of=${counts.instances}`);
    return true;
  }

  /** Past the bound, the oldest delivered result goes; one not yet delivered is never evicted (a Run is refused first: `full`). */
  private evict(): void {
    for (const [turnId, entry] of this.held) {
      if (this.held.size <= PROMPT_BUDGETS.workshopPassageSearch.heldResults) {
        return;
      }
      if (entry.delivered) {
        this.held.delete(turnId);
      }
    }
  }
}
