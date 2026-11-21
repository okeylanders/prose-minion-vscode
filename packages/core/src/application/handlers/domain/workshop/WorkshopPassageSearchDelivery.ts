/**
 * The results this window holds for its passage-search cards, and their
 * delivery to the persona who asked (ADR 2026-11-20 D19a, D21). The route
 * owner (`WorkshopPassageSearchHandler`) holds one.
 *
 * - **Held by the card's turn,** oldest first: the newest `heldResults`. A
 *   result is dropped only by eviction after an adopted delivery, by
 *   Discard, or when its room is replaced. One not yet delivered is never
 *   evicted, and a delivery that is not adopted never touches it.
 * - **Every send checks first,** and nothing is awaited between the last
 *   check and the dispatch: this room, the card still here and
 *   undelivered, its author still in the room, no run going, no other
 *   delivery in flight.
 * - **A delivery is a directed run** on the room's one message path. Its
 *   frame is fitted when the path asks for it, with the room the message
 *   has left; the receipt rides the adopted reply's own commit, and any
 *   other outcome rolls the request turn back where the run is given up.
 * - **Logs** carry turn ids, counts and closed reasons only.
 */

import type {
  WorkshopChatTarget,
  WorkshopPassageSearchCounts,
  WorkshopPassageSearchRefusal,
  WorkshopPersonaId,
  WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPassageSearchFinishedLine } from '@shared/constants/workshopPassageSearchWords';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import {
  fitWorkshopPassageSearchDirective,
  WORKSHOP_PASSAGE_SEARCH_RESULTS_MESSAGE
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchDirective';
import { workshopPassageSearchCounts, workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import { workshopPassageSearchStatus } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchStatus';
import { workshopEditOfferAuthorTarget } from '@handlers/domain/workshop/WorkshopEditOfferHandler';
import type { WorkshopDirectedRunResult, WorkshopResultsDeliveryRun } from '@handlers/domain/workshop/WorkshopRouteContracts';

export interface WorkshopPassageSearchDeliverySession {
  readRoomRevision(): number;
  readRoomLedger(): readonly WorkshopTurn[];
  getSelectedPersonaId(): WorkshopPersonaId;
  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean;
  markPassageSearchResultsTurn(turnId: string, cardTurnId: string): WorkshopTurn | undefined;
}

/** The room facts a send reads, and the one message path a delivery runs on. */
export interface WorkshopPassageSearchRoomGate {
  /** Any run going in the room: a reply, or the context wizard. */
  activeRunLabel(): string | undefined;
  runDirected(target: WorkshopChatTarget, run: WorkshopResultsDeliveryRun): Promise<WorkshopDirectedRunResult>;
}

export type WorkshopPassageSearchRefused = { readonly reason: WorkshopPassageSearchRefusal; readonly message?: string };

export class WorkshopPassageSearchResults {
  /** By the card's turn, oldest first. */
  private readonly held = new Map<string, { readonly result: PassageSearchResult; delivered: boolean }>();
  private revision: number | undefined;
  private sendingTurnId: string | undefined;

  constructor(
    private readonly session: WorkshopPassageSearchDeliverySession,
    private readonly room: WorkshopPassageSearchRoomGate,
    private readonly log: (line: string) => void
  ) {}

  /** A replaced room takes its held results with it. */
  sync(): void {
    const revision = this.session.readRoomRevision();
    if (this.revision !== undefined && this.revision !== revision) {
      this.held.clear();
    }
    this.revision = revision;
  }

  hold(turnId: string, result: PassageSearchResult): void {
    this.sync();
    this.held.delete(turnId);
    this.held.set(turnId, { result, delivered: false });
    this.evict();
  }

  resultOf(turnId: string): PassageSearchResult | undefined {
    this.sync();
    return this.held.get(turnId)?.result;
  }

  countsOf(turnId: string): WorkshopPassageSearchCounts | undefined {
    const result = this.resultOf(turnId);
    return result && workshopPassageSearchCounts(workshopPassageSearchView(result, turnId));
  }

  isSending(turnId: string): boolean {
    return this.sendingTurnId === turnId;
  }

  discard(turnId: string): void {
    this.held.delete(turnId);
  }

  clear(): void {
    this.held.clear();
  }

  /** Send a held result to its card's author: `true` once the persona's reply was adopted, else why not. */
  async deliver(turnId: string): Promise<true | WorkshopPassageSearchRefused> {
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
    const counts = workshopPassageSearchCounts(report);
    let shown = 0;
    this.sendingTurnId = turnId;
    this.log(`delivery started turn=${turnId} author=${target.kind} instances=${counts.instances}`);
    let ran: WorkshopDirectedRunResult;
    try {
      ran = await this.room.runDirected(target, {
        displayText: workshopPassageSearchFinishedLine(counts),
        message: WORKSHOP_PASSAGE_SEARCH_RESULTS_MESSAGE,
        resultsDelivery: {
          frame: (window) => {
            const directive = fitWorkshopPassageSearchDirective(report, window);
            shown = directive.shown;
            this.log(`delivery fitted turn=${turnId} shown=${directive.shown} of=${directive.of} window=${window ? 'known' : 'unknown'}`);
            return directive.frame;
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

  /** Past the bound, the oldest delivered result goes; one not yet delivered is never evicted. */
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
