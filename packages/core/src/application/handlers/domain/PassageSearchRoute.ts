/**
 * Passage Search's sidebar routes (ADR 2026-11-20 D15). Owned by
 * `SearchHandler`, which registers it; split out so the handler holds only
 * the registration.
 *
 * - **Callers own consent, and this is the sidebar's.** A plan request is
 *   priced and held under a host-minted `planId`; nothing is sent to a model
 *   until Run names that id. One plan is held, the newest. Run with any
 *   other id is refused (`plan-expired`) and nothing is sent.
 * - **One run at a time.** Progress and the result are posted by the run's
 *   own `requestId`. Stop aborts; the engine returns what was found and
 *   starts no further call (D12a), and that result is posted.
 * - **The newest result is held** under a `resultId`, for open-instance and
 *   for organizing a result whose reads were cut short. The webview names an
 *   instance by number, never a path: the file and line are read here.
 * - **Organize these results** is its own two-step press: price the pass
 *   over the held result, then make exactly that pass.
 * - **Copy and Save name the held result by id** (PR #294). The report is
 *   written here from the host's own snapshot (`PassageSearchReportExport`);
 *   no report text comes from the webview.
 * - **A disposed webview's search is stopped,** and nothing more is posted.
 *
 * Logs carry ids, counts and fault kinds only (D22): never the question, a
 * quote, a note, a label, a path or a pattern. A thrown error's message is
 * not logged, since it could quote what it was reading.
 */

import {
  MessageType,
  PassageSearchExtensionToWebviewMessage,
  PassageSearchOpenInstanceMessage,
  PassageSearchOrganizePlanRequestMessage,
  PassageSearchOrganizeRunMessage,
  PassageSearchCopyReportMessage,
  PassageSearchSaveReportMessage,
  PassageSearchPlanRequestMessage,
  PassageSearchResultView,
  PassageSearchRunMessage,
  PassageSearchStopMessage
} from '@messages';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import type { PassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganizePlan } from '@services/search/passage/PassageSearchOrganizer';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';
import { PassageSearchReportExport, type PassageSearchReportOutcome } from './PassageSearchReportExport';
import {
  passageSearchEstimateView,
  passageSearchOrganizeEstimateView,
  passageSearchReadsCutShort,
  passageSearchRequestOf,
  passageSearchResultView
} from './PassageSearchViews';

const LOG = '[PassageSearchRoute]';
const SOURCE = 'extension.search.passage';
/** The longest id read from the webview; its own are far shorter. */
const ID_CHARACTERS = 200;

/** The route's own refusals, in host words. A plan the engine refuses carries the engine's words. */
export const PASSAGE_SEARCH_ROUTE_WORDS = {
  malformed: 'That search request could not be read. Try again.',
  superseded: 'A newer estimate replaced this one.',
  'plan-failed': 'The search could not be estimated. Try again.',
  'plan-expired': 'That estimate is no longer current, so nothing was sent. Estimate again, then run.',
  busy: 'A passage search is already running. Stop it, or wait for it to finish.',
  'run-failed': 'The search failed before it could finish, and nothing was kept. Try again.',
  'result-expired': 'These results are no longer held. Run the search again.',
  'cannot-organize': 'These results cannot be organized.',
  'organize-failed': 'The results could not be organized. They are as they were.',
  'no-instance': 'That instance is not in these results.',
  'nothing-to-open': 'This instance is in text that has no saved file to open.',
  'open-failed': 'The file could not be opened.',
  'copy-failed': 'The report could not be copied.',
  'no-workspace': 'Open a workspace folder before saving a report.',
  'save-failed': 'The report could not be saved.'
} as const;

type RouteRefusal = keyof typeof PASSAGE_SEARCH_ROUTE_WORDS;

export interface PassageSearchRouteDeps {
  readonly engine: PassageSearchEngine;
  readonly shell: Pick<ShellService, 'openFileInEditor' | 'copyToClipboard'>;
  readonly fileSystem: Pick<FileSystem, 'createDirectory' | 'writeFile'>;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
  /** The clock a saved report is named by; a test fixes it. */
  readonly now?: () => Date;
}

interface HeldResult {
  readonly resultId: string;
  readonly result: PassageSearchResult;
  /** The display-safe snapshot the webview was sent, and the one a report is written from. */
  readonly view: PassageSearchResultView;
  readonly canOrganize: boolean;
}

const idOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_CHARACTERS ? value : undefined;

const payloadOf = (message: { payload?: unknown }): Record<string, unknown> =>
  (typeof message.payload === 'object' && message.payload !== null ? message.payload : {}) as Record<string, unknown>;

/** A thrown value's kind, for a log: never its message. */
const faultKindOf = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

export class PassageSearchRoute {
  private readonly idPrefix = Math.random().toString(36).slice(2, 10);
  private minted = 0;
  /** Counts plan requests, so only the newest one's plan is held. */
  private planRequests = 0;
  private plan?: { readonly planId: string; readonly plan: PassageSearchPlan };
  private running?: { readonly requestId: string; readonly controller: AbortController };
  private held?: HeldResult;
  private organizePlan?: { readonly organizePlanId: string; readonly resultId: string; readonly plan: PassageSearchOrganizePlan };
  private disposed = false;
  private readonly reports: PassageSearchReportExport;

  constructor(
    private readonly deps: PassageSearchRouteDeps,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {
    this.reports = new PassageSearchReportExport(deps, outputChannel);
  }

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.PASSAGE_SEARCH_PLAN_REQUEST, this.handlePlanRequest.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_RUN, this.handleRun.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_STOP, this.handleStop.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_OPEN_INSTANCE, this.handleOpenInstance.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST, this.handleOrganizePlanRequest.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_ORGANIZE_RUN, this.handleOrganizeRun.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_COPY_REPORT, this.handleCopyReport.bind(this));
    router.register(MessageType.PASSAGE_SEARCH_SAVE_REPORT, this.handleSaveReport.bind(this));
  }

  /** The webview is gone: stop a running search, and hold nothing. */
  dispose(): void {
    this.disposed = true;
    if (this.running) {
      this.outputChannel.appendLine(`${LOG} Stopped a running search: the view closed.`);
      this.running.controller.abort();
    }
    this.plan = undefined;
    this.held = undefined;
    this.organizePlan = undefined;
  }

  async handlePlanRequest(message: PassageSearchPlanRequestMessage): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored a plan request with no request id.`);
      return;
    }
    if (this.running) {
      this.refusePlan(requestId, 'busy');
      return;
    }
    // A new plan request drops the old plan, before anything awaits.
    const order = ++this.planRequests;
    this.plan = undefined;
    const request = passageSearchRequestOf(payload);
    if (!request) {
      this.refusePlan(requestId, 'malformed');
      return;
    }
    let outcome;
    try {
      outcome = await this.deps.engine.plan(request);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Planning failed (${faultKindOf(error)}).`);
      this.refusePlan(requestId, 'plan-failed');
      return;
    }
    if (order !== this.planRequests) {
      this.refusePlan(requestId, 'superseded');
      return;
    }
    if (outcome.kind === 'refused') {
      this.outputChannel.appendLine(`${LOG} Plan refused (${outcome.refusal.reason}).`);
      this.send({
        type: MessageType.PASSAGE_SEARCH_PLAN,
        payload: { requestId, status: 'refused', reason: outcome.refusal.reason, message: outcome.refusal.message }
      });
      return;
    }
    if (this.disposed) {
      return;
    }
    const planId = this.mint('plan');
    this.plan = { planId, plan: outcome.plan };
    const { estimate } = outcome.plan;
    this.outputChannel.appendLine(`${LOG} Plan ${planId} held: ${estimate.files} file(s), ${estimate.calls} call(s).`);
    this.send({
      type: MessageType.PASSAGE_SEARCH_PLAN,
      payload: { requestId, status: 'planned', planId, estimate: passageSearchEstimateView(estimate) }
    });
  }

  async handleRun(message: PassageSearchRunMessage): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored a run with no request id.`);
      return;
    }
    if (this.running) {
      this.refuseRun(requestId, 'busy');
      return;
    }
    const held = this.plan;
    if (!held || held.planId !== payload.planId) {
      this.refuseRun(requestId, 'plan-expired');
      return;
    }
    // The plan is spent whether the run finishes or is stopped, and an estimate still being made is not this run's.
    this.plan = undefined;
    this.planRequests += 1;
    this.held = undefined;
    this.organizePlan = undefined;
    const controller = new AbortController();
    this.running = { requestId, controller };
    this.outputChannel.appendLine(`${LOG} Run of plan ${held.planId} started: ${held.plan.estimate.calls} call(s).`);
    try {
      const result = await this.deps.engine.run(held.plan, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (this.disposed) {
            return;
          }
          this.send({
            type: MessageType.PASSAGE_SEARCH_PROGRESS,
            payload: { requestId, calls: { planned: progress.calls.planned, done: progress.calls.done }, found: progress.found }
          });
        }
      });
      this.finish(requestId, result);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Run failed (${faultKindOf(error)}).`);
      this.refuseRun(requestId, 'run-failed');
    } finally {
      this.running = undefined;
    }
  }

  async handleStop(message: PassageSearchStopMessage): Promise<void> {
    const requestId = idOf(payloadOf(message).requestId);
    if (!requestId || this.running?.requestId !== requestId) {
      return;
    }
    this.outputChannel.appendLine(`${LOG} Stop asked.`);
    this.running.controller.abort();
  }

  async handleOpenInstance(message: PassageSearchOpenInstanceMessage): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored an open with no request id.`);
      return;
    }
    const held = this.held;
    if (!held || held.resultId !== payload.resultId) {
      this.refuseOpen(requestId, 'result-expired');
      return;
    }
    // The instance is named by its number alone; a path the webview sent would never be read.
    const instance = typeof payload.instance === 'number' ? held.result.instances.find((found) => found.number === payload.instance) : undefined;
    if (!instance) {
      this.refuseOpen(requestId, 'no-instance');
      return;
    }
    const file = held.result.files.planned.find((planned) => planned.key === instance.file);
    if (!file?.absolutePath) {
      this.refuseOpen(requestId, 'nothing-to-open');
      return;
    }
    try {
      // A line counted within a selection alone is not the document's, so the file opens without one.
      await this.deps.shell.openFileInEditor(file.absolutePath, file.lines === 'document' ? { line: instance.line } : {});
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Open failed (${faultKindOf(error)}).`);
      this.refuseOpen(requestId, 'open-failed');
      return;
    }
    this.send({ type: MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT, payload: { requestId, status: 'opened' } });
  }

  async handleOrganizePlanRequest(message: PassageSearchOrganizePlanRequestMessage): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored an organize plan request with no request id.`);
      return;
    }
    if (this.running) {
      this.refuseOrganizePlan(requestId, 'busy');
      return;
    }
    const held = this.held;
    if (!held || held.resultId !== payload.resultId) {
      this.refuseOrganizePlan(requestId, 'result-expired');
      return;
    }
    if (!held.canOrganize) {
      this.refuseOrganizePlan(requestId, 'cannot-organize');
      return;
    }
    this.organizePlan = undefined;
    let outcome;
    try {
      outcome = await this.deps.engine.planOrganize(held.result);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Organize planning failed (${faultKindOf(error)}).`);
      this.refuseOrganizePlan(requestId, 'plan-failed');
      return;
    }
    if (this.held !== held) {
      this.refuseOrganizePlan(requestId, 'result-expired');
      return;
    }
    if (outcome.kind === 'unavailable') {
      this.outputChannel.appendLine(`${LOG} Organize plan unavailable.`);
      this.send({
        type: MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN,
        payload: { requestId, status: 'refused', reason: 'unavailable', message: outcome.message }
      });
      return;
    }
    const organizePlanId = this.mint('organize');
    this.organizePlan = { organizePlanId, resultId: held.resultId, plan: outcome.plan };
    this.outputChannel.appendLine(`${LOG} Organize plan ${organizePlanId} held: ${outcome.plan.instances.read} of ${outcome.plan.instances.of} instance(s).`);
    this.send({
      type: MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN,
      payload: { requestId, status: 'planned', resultId: held.resultId, organizePlanId, estimate: passageSearchOrganizeEstimateView(outcome.plan) }
    });
  }

  async handleOrganizeRun(message: PassageSearchOrganizeRunMessage): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored an organize run with no request id.`);
      return;
    }
    if (this.running) {
      this.refuseRun(requestId, 'busy');
      return;
    }
    const held = this.held;
    const priced = this.organizePlan;
    if (!held || !priced || held.resultId !== payload.resultId || priced.resultId !== held.resultId || priced.organizePlanId !== payload.organizePlanId) {
      this.refuseRun(requestId, 'plan-expired');
      return;
    }
    this.organizePlan = undefined;
    const controller = new AbortController();
    this.running = { requestId, controller };
    this.outputChannel.appendLine(`${LOG} Organizing pass ${priced.organizePlanId} started.`);
    try {
      const organized = await this.deps.engine.organize(held.result, priced.plan, { signal: controller.signal });
      this.finish(requestId, organized);
    } catch (error) {
      this.outputChannel.appendLine(`${LOG} Organizing failed (${faultKindOf(error)}).`);
      this.refuseRun(requestId, 'organize-failed');
    } finally {
      this.running = undefined;
    }
  }

  async handleCopyReport(message: PassageSearchCopyReportMessage): Promise<void> {
    await this.exportReport(message, (view) => this.reports.copy(view));
  }

  async handleSaveReport(message: PassageSearchSaveReportMessage): Promise<void> {
    await this.exportReport(message, (view) => this.reports.save(view));
  }

  /** A report is written from the held snapshot the id names, or not at all: nothing the webview sends is its text. */
  private async exportReport(
    message: { payload?: unknown },
    write: (view: PassageSearchResultView) => Promise<PassageSearchReportOutcome>
  ): Promise<void> {
    const payload = payloadOf(message);
    const requestId = idOf(payload.requestId);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored a report request with no request id.`);
      return;
    }
    const held = this.held;
    if (!held || held.resultId !== payload.resultId) {
      this.refuseReport(requestId, 'result-expired');
      return;
    }
    const outcome = await write(held.view);
    if (outcome.status === 'failed') {
      this.refuseReport(requestId, outcome.reason);
      return;
    }
    this.send({ type: MessageType.PASSAGE_SEARCH_REPORT_RESULT, payload: { requestId, ...outcome } });
  }

  /** Hold the result as the newest, and post it. Nothing is held or posted for a view that is gone. */
  private finish(requestId: string, result: PassageSearchResult): void {
    if (this.disposed) {
      return;
    }
    const canOrganize = this.canOrganize(result);
    const resultId = this.mint('result');
    const view = passageSearchResultView(result, resultId, canOrganize);
    this.held = { resultId, result, view, canOrganize };
    this.outputChannel.appendLine(
      `${LOG} Result ${resultId} held (${result.ended}): ${result.instances.length} instance(s), ` +
      `${result.calls.answered} of ${result.calls.planned} call(s) answered, ${result.calls.unsent} unsent, ${result.calls.tooLarge} too large, ${result.requests} request(s), ` +
      `analysis ${result.analysis ? 'present' : 'absent'}.`
    );
    this.send({
      type: MessageType.PASSAGE_SEARCH_RESULT,
      payload: { requestId, status: 'finished', result: view }
    });
  }

  /**
   * Whether "Organize these results" may be offered (D12a, D15): the reads
   * were cut short, an instance was found, no analysis exists, and the
   * engine has an organizer. Nothing is priced or probed to decide it, so a
   * result whose key changed keeps the action.
   */
  private canOrganize(result: PassageSearchResult): boolean {
    return passageSearchReadsCutShort(result) && result.instances.length > 0 && !result.analysis && this.deps.engine.organizerAvailable();
  }

  private mint(kind: string): string {
    this.minted += 1;
    return `${kind}-${this.idPrefix}-${this.minted}`;
  }

  private refusePlan(requestId: string, reason: RouteRefusal): void {
    this.outputChannel.appendLine(`${LOG} Plan request refused (${reason}).`);
    this.send({ type: MessageType.PASSAGE_SEARCH_PLAN, payload: { requestId, status: 'refused', reason, message: PASSAGE_SEARCH_ROUTE_WORDS[reason] } });
  }

  private refuseRun(requestId: string, reason: RouteRefusal): void {
    this.outputChannel.appendLine(`${LOG} Run refused (${reason}).`);
    this.send({ type: MessageType.PASSAGE_SEARCH_RESULT, payload: { requestId, status: 'refused', reason, message: PASSAGE_SEARCH_ROUTE_WORDS[reason] } });
  }

  private refuseOrganizePlan(requestId: string, reason: RouteRefusal): void {
    this.outputChannel.appendLine(`${LOG} Organize plan refused (${reason}).`);
    this.send({ type: MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN, payload: { requestId, status: 'refused', reason, message: PASSAGE_SEARCH_ROUTE_WORDS[reason] } });
  }

  private refuseReport(requestId: string, reason: RouteRefusal): void {
    this.outputChannel.appendLine(`${LOG} Report refused (${reason}).`);
    this.send({ type: MessageType.PASSAGE_SEARCH_REPORT_RESULT, payload: { requestId, status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS[reason] } });
  }

  private refuseOpen(requestId: string, reason: RouteRefusal): void {
    this.outputChannel.appendLine(`${LOG} Open refused (${reason}).`);
    this.send({ type: MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT, payload: { requestId, status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS[reason] } });
  }

  private send(message: Pick<PassageSearchExtensionToWebviewMessage, 'type' | 'payload'>): void {
    if (this.disposed) {
      return;
    }
    void this.postMessage({ ...message, source: SOURCE, timestamp: Date.now() } as PassageSearchExtensionToWebviewMessage);
  }
}
