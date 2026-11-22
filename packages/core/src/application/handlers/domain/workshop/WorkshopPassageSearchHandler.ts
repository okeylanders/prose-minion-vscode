/**
 * Owns a persona's passage-search card (ADR 2026-11-20 D19–D21): the 26th
 * composed route owner.
 *
 * - **Ids in, an answer by `requestId` out.** Every route names the room
 *   revision and the reply that holds the card; a Run adds the `planKey`
 *   the writer saw. The host finds the card on its own ledger, and builds
 *   the engine's request from it: groups, files by catalog key, and the
 *   excerpt by value. Nothing from the webview becomes a scope.
 * - **The price is never skipped.** `ESTIMATE` plans and answers the price
 *   and its key. `RUN` plans again and runs only when the key is the one
 *   sent; otherwise it answers the new estimate (`price-changed`) and sends
 *   nothing.
 * - **One search at a time** in this window's Workshop; a second Run is
 *   refused in the room's busy words. The search runs on the engine's own
 *   model: the persona's model never reads the files.
 * - **A search belongs to the room it began in.** The coordinator tells
 *   each replacement as it lands, a Rewind's too, and the running search's
 *   calls are aborted then, whether or not anything is drawn or a call
 *   answers (PR #296 F3); what it found goes nowhere. A card in another room
 *   never reads as running, even under the same turn id. Disposal aborts it
 *   too.
 * - **Held results are this window's:** at most `heldResults`, by the
 *   card's turn. A Run is refused before anything is planned or sent while
 *   every place holds a result not yet delivered (`results-full`): Send or
 *   Discard frees one. One is dropped only by eviction after an adopted
 *   delivery, by Discard, or when its room is replaced: a Rewind of the same
 *   open room alone keeps the cards it left unchanged (the holder's rule).
 *   A failed delivery never touches it.
 * - **Delivery** (D19a, D21) is a results-delivery directed run to the
 *   card's author. The host starts it only for a search that ended
 *   `complete` or `instance-limit`, with the room idle and no session save
 *   or replacement pending; any other waits for the writer's Send. Every
 *   send checks first, with nothing awaited before the dispatch: no session
 *   operation pending, this room, the card still here and undelivered, its
 *   author still in the room, no run going, and a frame that fits.
 * - **Logs** carry turn ids, counts, closed outcomes and reason kinds:
 *   never the question, a quote, a note, a label or a path (D22).
 */

import type { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { LogSink } from '@/platform';
import {
  MessageType,
  type WorkshopExcerpt,
  type WorkshopPassageSearchAction,
  type WorkshopPassageSearchActionPayload,
  type WorkshopPassageSearchEstimateView,
  type WorkshopPassageSearchProgress,
  type WorkshopPassageSearchProgressMessage,
  type WorkshopPassageSearchRefusal,
  type WorkshopPassageSearchRequest,
  type WorkshopPassageSearchResultMessage,
  type WorkshopPassageSearchResultOutcome,
  type WorkshopPassageSearchRunPayload,
  type WorkshopPersonaId,
  type WorkshopTurn
} from '@messages';
import {
  WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS,
  workshopPassageSearchCountsWords
} from '@shared/constants/workshopPassageSearchWords';
import type { PassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import {
  workshopPassageSearchEngineRequest,
  workshopPassageSearchEstimateView
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchEngineRequest';
import type { PassageSearchReportExport } from '@handlers/domain/PassageSearchReportExport';
import { workshopPassageSearchCounts, workshopPassageSearchView } from '@handlers/domain/workshop/WorkshopPassageSearchResultView';
import {
  isWorkshopPassageSearchPartial,
  workshopPassageSearchStatus,
  type WorkshopPassageSearchWindowCard
} from '@/application/services/workshop/passageSearch/WorkshopPassageSearchStatus';
import type { WorkshopPassageSearchListing } from '@/application/services/workshop/passageSearch/WorkshopReplyPassageSearch';
import { workshopEditOfferAuthorTarget } from '@handlers/domain/workshop/WorkshopEditOfferHandler';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopRoomReplacement } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import {
  WorkshopPassageSearchResults,
  type WorkshopPassageSearchRefused as Refused,
  type WorkshopPassageSearchRoomGate
} from '@handlers/domain/workshop/WorkshopPassageSearchDelivery';

/** The one engine, the authoritative listing a request is settled against, and the shared report export: built in `extension.ts`. */
export interface WorkshopPassageSearchPorts {
  readonly engine: Pick<PassageSearchEngine, 'plan' | 'run'>;
  readonly listing: WorkshopPassageSearchListing;
  readonly reports: Pick<PassageSearchReportExport, 'save'>;
}

export interface WorkshopPassageSearchSession {
  readRoomRevision(): number;
  readRoomLedger(): readonly WorkshopTurn[];
  getExcerpt(): Pick<WorkshopExcerpt, 'text'> | undefined;
  getSelectedPersonaId(): WorkshopPersonaId;
  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean;
  cancelPassageSearch(turnId: string): WorkshopTurn | undefined;
  markPassageSearchResultsTurn(turnId: string, cardTurnId: string): WorkshopTurn | undefined;
}

export interface WorkshopPassageSearchEffects {
  postSessionState(): void;
  markDirty(reason: string): void;
}

interface RunningSearch {
  readonly turnId: string;
  readonly requestId: string;
  readonly roomRevision: number;
  readonly controller: AbortController;
  progress?: WorkshopPassageSearchProgress;
}

type Card = { readonly turn: WorkshopTurn; readonly card: WorkshopPassageSearchRequest };

const LOG = '[WorkshopPassageSearchHandler]';
const ID_CHARACTERS = 256;

export class WorkshopPassageSearchHandler {
  private search: RunningSearch | undefined;
  /** What this window holds for its cards, and their delivery. */
  private readonly results: WorkshopPassageSearchResults;
  private readonly stopListening: () => void;

  constructor(
    private readonly session: WorkshopPassageSearchSession,
    private readonly ports: WorkshopPassageSearchPorts | undefined,
    private readonly room: WorkshopPassageSearchRoomGate,
    private readonly effects: WorkshopPassageSearchEffects,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {
    this.results = new WorkshopPassageSearchResults(session, room, (line) => this.log(line));
    this.stopListening = room.onRoomReplaced((replacement) => this.roomReplaced(replacement));
  }

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    type Handle = (payload: WorkshopPassageSearchActionPayload) => Promise<void> | void;
    const taking = (action: WorkshopPassageSearchAction, handle: Handle) => async (message: { payload?: unknown }): Promise<void> =>
      this.take(action, message.payload, handle);
    const blocked = (action: WorkshopPassageSearchAction) => (_reason: string, message: { payload?: unknown }): void => {
      const payload = payloadOf(message.payload);
      if (payload) {
        this.refuse(action, payload, { reason: 'session-operation' });
      }
    };
    // The price is a read, never behind the mutation gate (D20); Stop, Discard and Open report touch only this window.
    router.register(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE, taking('estimate', (payload) => this.handleEstimate(payload)));
    router.register(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP, taking('stop', (payload) => this.handleStop(payload)));
    router.register(MessageType.WORKSHOP_PASSAGE_SEARCH_DISCARD, taking('discard', (payload) => this.handleDiscard(payload)));
    router.register(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT, taking('open-report', (payload) => this.handleOpenReport(payload)));
    registerMutation(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, taking('run', (payload) => this.handleRun(payload)), undefined, blocked('run'));
    registerMutation(MessageType.WORKSHOP_PASSAGE_SEARCH_CANCEL, taking('cancel', (payload) => this.handleCancel(payload)), undefined, blocked('cancel'));
    registerMutation(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND, taking('send', (payload) => this.handleSend(payload)), undefined, blocked('send'));
  }

  /** What this window is doing for a card, read each time a turn is sent to the webview (D19). */
  windowCard(turnId: string): WorkshopPassageSearchWindowCard | undefined {
    this.syncRoom();
    const search = this.runningOn(turnId);
    const running = search ? { ...(search.progress ? { progress: search.progress } : {}) } : undefined;
    const held = this.results.countsOf(turnId);
    return running || held
      ? { ...(running ? { running } : {}), ...(held ? { held } : {}), ...(this.results.isSending(turnId) ? { sending: true } : {}) }
      : undefined;
  }

  /** The listing a reply's request is settled against (D17). */
  listing(): WorkshopPassageSearchListing | undefined {
    return this.ports?.listing;
  }

  /** The panel is closing: a running search stops, and its results go nowhere. */
  dispose(): void {
    this.stopListening();
    this.search?.controller.abort();
    this.search = undefined;
    this.results.clear();
  }

  async handleEstimate(payload: WorkshopPassageSearchActionPayload): Promise<void> {
    // A price is a read: another card's search does not hold it up.
    const found = this.pendingCard(payload, true);
    if ('reason' in found) {
      return this.refuse('estimate', payload, found);
    }
    const planned = await this.plan(found.card);
    if (payload.roomRevision !== this.session.readRoomRevision()) {
      return this.refuse('estimate', payload, { reason: 'room-changed' });
    }
    if ('reason' in planned) {
      return this.refuse('estimate', payload, planned);
    }
    this.answer('estimate', payload, 'done', { estimate: workshopPassageSearchEstimateView(planned) });
  }

  async handleRun(payload: WorkshopPassageSearchActionPayload): Promise<void> {
    const planKey = (payload as Partial<WorkshopPassageSearchRunPayload>).planKey;
    if (typeof planKey !== 'string' || planKey.length === 0 || planKey.length > ID_CHARACTERS) {
      return this.refuse('run', payload, { reason: 'invalid-request' });
    }
    const found = this.pendingCard(payload);
    if ('reason' in found) {
      return this.refuse('run', payload, found);
    }
    if (!workshopEditOfferAuthorTarget(this.session, found.turn)) {
      return this.refuse('run', payload, { reason: 'author-left' });
    }
    if (this.results.full()) {
      // A new result would have nowhere to go: nothing is planned or sent until Send or Discard frees a place (D21; PR #296 F5).
      return this.refuse('run', payload, { reason: 'results-full' });
    }
    // The slot is taken before anything awaits, so a second Run during the plan is refused too.
    const search: RunningSearch = { turnId: payload.turnId, requestId: payload.requestId, roomRevision: payload.roomRevision, controller: new AbortController() };
    this.search = search;
    let result: PassageSearchResult;
    try {
      const planned = await this.plan(found.card);
      if ('reason' in planned) {
        this.search = undefined;
        return this.refuse('run', payload, planned);
      }
      if (planned.planKey !== planKey) {
        // The price the writer saw no longer holds: the new one is shown, and nothing is sent (D20).
        this.search = undefined;
        this.log(`run price-changed turn=${payload.turnId}`);
        return this.answer('run', payload, 'price-changed', { estimate: workshopPassageSearchEstimateView(planned) });
      }
      if (!this.stillOwns(search) || search.controller.signal.aborted) {
        this.search = undefined;
        return this.refuse('run', payload, { reason: this.stillOwns(search) ? 'not-running' : 'room-changed' });
      }
      this.log(`run started turn=${payload.turnId} calls=${planned.estimate.calls} files=${planned.estimate.files}`);
      this.answer('run', payload, 'started');
      this.effects.postSessionState();
      result = await this.ports!.engine.run(planned, {
        signal: search.controller.signal,
        onProgress: (progress) => this.reportProgress(search, { done: progress.calls.done, planned: progress.calls.planned, found: progress.found })
      });
    } catch (error) {
      this.search = this.search === search ? undefined : this.search;
      this.log(`run failed turn=${payload.turnId} error=${error instanceof Error ? error.name : 'unknown'}`);
      this.refuse('run', payload, { reason: 'search-failed' });
      this.effects.postSessionState();
      return;
    }
    if (this.search === search) {
      this.search = undefined;
    }
    if (!this.stillOwns(search)) {
      // Another room now: what was found goes nowhere (D20).
      this.log(`run dropped turn=${payload.turnId} reason=room-changed`);
      return this.refuse('run', payload, { reason: 'room-changed' });
    }
    this.results.hold(payload.turnId, result);
    const counts = workshopPassageSearchCounts(workshopPassageSearchView(result, payload.turnId));
    this.log(`run finished turn=${payload.turnId} ended=${counts.ended} instances=${counts.instances} files=${counts.files} searched=${counts.searched ?? 0} `
      + `answered=${counts.calls.answered} failed=${counts.calls.failed} cut=${counts.calls.cut} unsent=${counts.calls.unsent} cancelled=${counts.calls.cancelled ?? 0} dropped=${counts.dropped}`);
    // Only a search that read everything is delivered by the host, and only into an idle room (D21).
    const auto = !isWorkshopPassageSearchPartial(counts.ended) && this.room.activeRunLabel() === undefined;
    const sent = auto ? await this.results.deliver(payload.turnId) : undefined;
    this.effects.postSessionState();
    const words = workshopPassageSearchCountsWords(counts);
    this.answer('run', payload, 'finished', {
      message: sent === undefined ? words
        : sent === true ? `${words} The results were sent.`
          : `${words} ${sent.message ?? WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS[sent.reason]}`
    });
  }

  handleStop(payload: WorkshopPassageSearchActionPayload): void {
    if (this.search?.turnId !== payload.turnId || payload.roomRevision !== this.search.roomRevision) {
      return this.refuse('stop', payload, { reason: 'not-running' });
    }
    this.log(`stop turn=${payload.turnId}`);
    this.search.controller.abort();
    this.answer('stop', payload, 'done');
  }

  handleCancel(payload: WorkshopPassageSearchActionPayload): void {
    const found = this.pendingCard(payload);
    if ('reason' in found) {
      return this.refuse('cancel', payload, found);
    }
    if (this.session.cancelPassageSearch(payload.turnId)) {
      this.effects.markDirty('passage search cancelled');
      this.effects.postSessionState();
    }
    this.log(`cancel turn=${payload.turnId}`);
    this.answer('cancel', payload, 'done');
  }

  async handleSend(payload: WorkshopPassageSearchActionPayload): Promise<void> {
    if (payload.roomRevision !== this.session.readRoomRevision()) {
      return this.refuse('send', payload, { reason: 'room-changed' });
    }
    const sent = await this.results.deliver(payload.turnId);
    this.effects.postSessionState();
    if (sent !== true) {
      return this.refuse('send', payload, sent);
    }
    this.answer('send', payload, 'done');
  }

  handleDiscard(payload: WorkshopPassageSearchActionPayload): void {
    const status = this.statusOf(payload);
    if (status !== 'ready' || this.results.isSending(payload.turnId)) {
      return this.refuse('discard', payload, { reason: status === undefined ? 'no-card' : 'not-ready' });
    }
    this.results.discard(payload.turnId);
    this.log(`discard turn=${payload.turnId}`);
    this.effects.postSessionState();
    this.answer('discard', payload, 'done');
  }

  async handleOpenReport(payload: WorkshopPassageSearchActionPayload): Promise<void> {
    if (this.statusOf(payload) === undefined) {
      return this.refuse('open-report', payload, { reason: 'no-card' });
    }
    const held = this.results.resultOf(payload.turnId);
    if (!held || !this.ports) {
      return this.refuse('open-report', payload, { reason: 'not-held' });
    }
    // One writer for every surface: the report is written from the shared view, which shows no exterior path.
    const outcome = await this.ports.reports.save(workshopPassageSearchView(held, payload.turnId));
    this.log(`open-report turn=${payload.turnId} outcome=${outcome.status}`);
    if (outcome.status !== 'saved') {
      return this.refuse('open-report', payload, { reason: 'report-failed' });
    }
    this.answer('open-report', payload, 'done');
  }

  /** A card that may still be priced, run or cancelled: in this room, with no answer, no search and no result. */
  private pendingCard(payload: WorkshopPassageSearchActionPayload, besideASearch = false): Card | Refused {
    if (!this.ports) {
      return { reason: 'unavailable' };
    }
    if (payload.roomRevision !== this.session.readRoomRevision()) {
      return { reason: 'room-changed' };
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === payload.turnId);
    if (!turn?.passageSearchRequest) {
      return { reason: 'no-card' };
    }
    if (this.search && !(besideASearch && this.search.turnId !== payload.turnId)) {
      return { reason: 'search-running' };
    }
    return this.statusOf(payload) === 'pending' ? { turn, card: turn.passageSearchRequest } : { reason: 'not-pending' };
  }

  private statusOf(payload: WorkshopPassageSearchActionPayload) {
    this.syncRoom();
    if (payload.roomRevision !== this.session.readRoomRevision()) {
      return undefined;
    }
    return workshopPassageSearchStatus(this.session.readRoomLedger(), payload.turnId, {
      running: this.runningOn(payload.turnId) !== undefined,
      held: this.results.resultOf(payload.turnId) !== undefined
    });
  }

  private async plan(card: WorkshopPassageSearchRequest): Promise<PassageSearchPlan | Refused> {
    const request = workshopPassageSearchEngineRequest(card, this.session.getExcerpt()?.text);
    if (request === 'no-excerpt') {
      return { reason: 'plan-refused', message: 'This room no longer has an excerpt to search.' };
    }
    try {
      const outcome = await this.ports!.engine.plan(request);
      return outcome.kind === 'planned' ? outcome.plan : { reason: 'plan-refused', message: outcome.refusal.message };
    } catch {
      return { reason: 'search-failed' };
    }
  }

  private reportProgress(search: RunningSearch, progress: WorkshopPassageSearchProgress): void {
    if (this.search !== search) {
      return;
    }
    if (!this.stillOwns(search)) {
      search.controller.abort();
      return;
    }
    search.progress = progress;
    const message: WorkshopPassageSearchProgressMessage = {
      type: MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS,
      source: 'extension.workshop.passageSearch',
      payload: { requestId: search.requestId, turnId: search.turnId, ...progress },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /** Whether the search's room is still the room, and still holds its card. */
  private stillOwns(search: RunningSearch): boolean {
    return search.roomRevision === this.session.readRoomRevision()
      && this.session.readRoomLedger().some((turn) => turn.id === search.turnId && turn.passageSearchRequest !== undefined);
  }

  /** The search on this card in this room: one begun in a room since replaced is another room's, whatever its turn id. */
  private runningOn(turnId: string): RunningSearch | undefined {
    return this.search?.turnId === turnId && this.search.roomRevision === this.session.readRoomRevision() ? this.search : undefined;
  }

  /** The coordinator's word, as the replacement lands: the running search stops now, and the holder applies its rule. */
  private roomReplaced(replacement: WorkshopRoomReplacement): void {
    if (this.search && !this.search.controller.signal.aborted) {
      this.log(`room replaced turn=${this.search.turnId} search=stopped rewound=${replacement.rewound}`);
      this.search.controller.abort();
    }
    this.results.roomReplaced(replacement);
  }

  /** A fallback for a replacement nobody told: a room whose revision moved takes its running search with it. */
  private syncRoom(): void {
    this.results.sync();
    if (this.search && this.search.roomRevision !== this.session.readRoomRevision()) {
      this.search.controller.abort();
    }
  }

  private async take(action: WorkshopPassageSearchAction, value: unknown, handle: (payload: WorkshopPassageSearchActionPayload) => Promise<void> | void): Promise<void> {
    const payload = payloadOf(value);
    if (!payload) {
      this.log(`${action} refused reason=invalid-request`);
      return;
    }
    await handle(payload);
  }

  private refuse(action: WorkshopPassageSearchAction, payload: WorkshopPassageSearchActionPayload, refused: Refused): void {
    this.log(`${action} refused turn=${payload.turnId} reason=${refused.reason}`);
    this.answer(action, payload, 'refused', { reason: refused.reason, message: refused.message ?? WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS[refused.reason] });
  }

  private answer(
    action: WorkshopPassageSearchAction,
    payload: WorkshopPassageSearchActionPayload,
    outcome: WorkshopPassageSearchResultOutcome,
    extra: { reason?: WorkshopPassageSearchRefusal; message?: string; estimate?: WorkshopPassageSearchEstimateView } = {}
  ): void {
    const message: WorkshopPassageSearchResultMessage = {
      type: MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT,
      source: 'extension.workshop.passageSearch',
      payload: { requestId: payload.requestId, turnId: payload.turnId, action, outcome, ...extra },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}

const idAt = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= ID_CHARACTERS;

function payloadOf(value: unknown): WorkshopPassageSearchActionPayload | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const payload = value as Partial<WorkshopPassageSearchRunPayload>;
  if (!idAt(payload.requestId) || !idAt(payload.turnId) || !Number.isSafeInteger(payload.roomRevision)) {
    return undefined;
  }
  return {
    requestId: payload.requestId,
    roomRevision: payload.roomRevision as number,
    turnId: payload.turnId,
    ...(typeof payload.planKey === 'string' ? { planKey: payload.planKey } : {})
  };
}
