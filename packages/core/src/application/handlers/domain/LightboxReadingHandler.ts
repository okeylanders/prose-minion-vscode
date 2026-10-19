/**
 * Lightbox readings: lenses, the estimate, runs and context files (ADR
 * 2026-10-19 D6–D10; Slice 2B). Composed beside `LightboxHandler` in every
 * MessageHandler, over the same shared services; nothing is constructed
 * here. `LightboxHandler` owns the board's source; this owns what a press
 * reads and sends.
 *
 * - **Sync.** The webview sends its lens toggles on mount, on a toggle, when
 *   the board, the assistant model, its catalog or the context list changes.
 *   Each `LIGHTBOX_SET_LENSES` is answered with the context list and a fresh
 *   estimate (fit and cost) echoing its `requestId`, plus the board's run
 *   while one is active. The estimate is only ever an answer (PR #149 F-03):
 *   the host never posts one unasked, and an answer overtaken by a newer
 *   request while its prompt files loaded is dropped, not posted late.
 * - **Validate before spend.** A press is refused, with nothing sent, when
 *   the board is not the one on screen, its estimate is no longer current,
 *   every lens is off, the board is already being read, a call is too large
 *   for the model's window, or there is no API key.
 * - **A press owns what it was priced (PR #149 F-02).** A press names the key
 *   of the estimate it was shown (`LightboxRunEstimate.key`: the board and
 *   its text, the lenses on, the context shelf's revision, the assistant
 *   model with its window and prices). Its snapshot is captured, and its
 *   board reserved under a minted token, before anything is awaited. After
 *   the prompt files load, it starts only if this tab is still open, its
 *   reservation still holds, and the live key is still the one it named:
 *   any change in between (a context file removed, a lens toggled, a model
 *   or price changed, another board adopted) refuses it with nothing sent,
 *   and the webview asks for a fresh estimate. What runs is exactly what was
 *   priced, and nothing runs after its tab closed. The press also names the
 *   model the writer selected; one naming any model but the one in use is
 *   refused (PR #149 F-03 re-review).
 * - **Runs belong to their board.** Group results are written onto the board
 *   by its id through `LightboxService.updateReadings`, so a hidden tab, a
 *   reveal or a switch back to the source finds them; a result for a board
 *   that no longer exists is dropped.
 * - **Outcomes are published, not posted by the run (PR #148).** The service
 *   publishes a `readings` change only for the current board, so a stale run
 *   never publishes over a newer one. This handler subscribes the first time
 *   its webview sends a reading message (the sidebar and the Workshop never
 *   do) and posts what it hears: a settled group as `LIGHTBOX_GROUP_RESULT`,
 *   a run starting or stopping as the board. Progress, refusals and the
 *   estimate are the run's and the request's own answers.
 *
 * Logs name groups, lenses, counts, paths and reasons, never text.
 */

import { LogSink, ShellService } from '@/platform';
import { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import type { LightboxOutcomeChange, LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxContextShelf } from '@/infrastructure/lightbox/LightboxContextShelf';
import type { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import type { LightboxRunReservation } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { estimateLightboxRun } from '@/infrastructure/lightbox/LightboxRunEstimate';
import { lightboxPressSnapshot, type LightboxPressSnapshot } from '@/infrastructure/lightbox/LightboxPressSnapshot';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  settleLightboxGroup,
  startLightboxGroups,
  stopLightboxGroups
} from '@/infrastructure/lightbox/LightboxReadingState';
import {
  isLightboxLensId,
  LIGHTBOX_LENSES,
  lightboxPlannedCalls
} from '@shared/constants/lightbox';
import {
  LightboxActiveRun,
  LightboxAddContextFilesMessage,
  LightboxCancelRunMessage,
  LightboxLensId,
  LightboxReadingGroupId,
  LightboxRemoveContextFileMessage,
  LightboxRunMessage,
  LightboxRunProgress,
  LightboxSetLensesMessage,
  MessageType
} from '@messages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';

const SOURCE = 'extension.lightbox';
const STOPPED = 'Stopped before this group came back.';
const BOARD_CHANGED = 'The board changed. Read the board on screen.';
const ESTIMATE_CHANGED = 'The estimate changed since it was shown (the model, its prices, the lenses or the context). ' +
  'Check the new estimate, then press again.';
const MODEL_NOT_IN_USE = 'The model this press names is not the assistant model in use yet. ' +
  'Wait for the model change to finish saving, then press again.';

type LightboxContextPicker = Pick<ShellService, 'pickFile'>;

export class LightboxReadingHandler {
  /** The webview's lens toggles; all on until it says otherwise. */
  private lensesOff: LightboxLensId[] = [];
  /** Runs this handler started, so closing the tab stops them. */
  private readonly ownRuns = new Map<string, LightboxActiveRun>();
  private unsubscribe?: () => void;
  private disposed = false;
  /** The latest estimate request; an older one finishing late is not posted. */
  private estimateSequence = 0;

  constructor(
    private readonly lightboxService: LightboxService,
    private readonly runner: LightboxReadingRunner,
    private readonly contextShelf: LightboxContextShelf,
    private readonly textSourceResolver: TextSourceResolver,
    private readonly shell: LightboxContextPicker,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LIGHTBOX_SET_LENSES, this.handleSetLenses.bind(this));
    router.register(MessageType.LIGHTBOX_RUN, this.handleRun.bind(this));
    router.register(MessageType.LIGHTBOX_CANCEL_RUN, this.handleCancelRun.bind(this));
    router.register(MessageType.LIGHTBOX_ADD_CONTEXT_FILES, this.handleAddContextFiles.bind(this));
    router.register(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, this.handleRemoveContextFile.bind(this));
  }

  /** Closing the tab stops the runs it started; finished groups stay on their boards. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const run of [...this.ownRuns.values()]) {
      this.stop(run, 'The Lightbox tab closed before this group came back.');
    }
  }

  async handleSetLenses(message: LightboxSetLensesMessage): Promise<void> {
    this.subscribe();
    const requested = Array.isArray(message.payload?.lensesOff) ? message.payload.lensesOff : [];
    this.lensesOff = [...new Set(requested.filter(isLightboxLensId))];
    this.postContextFiles();
    const requestId = typeof message.payload?.requestId === 'string' ? message.payload.requestId : undefined;
    await this.postEstimate(requestId);
  }

  async handleRun(message: LightboxRunMessage): Promise<void> {
    this.subscribe();
    const { boardId, scope, estimateKey, model } = message.payload ?? ({} as LightboxRunMessage['payload']);
    const lens = scope?.mode === 'lens' ? scope.lens : undefined;
    const refuse = (text: string, groups: LightboxReadingGroupId[] = [], reestimate = false): void => {
      this.outputChannel.appendLine(`[LightboxReadingHandler] Run refused: ${text}`);
      this.postProgress({
        boardId, phase: 'refused', groups, groupsBack: 0, outputCharacters: 0, message: text, ...(reestimate ? { reestimate: true } : {})
      });
    };
    if (!scope || !['all', 'rest', 'lens'].includes(scope.mode) || (scope.mode === 'lens' && !isLightboxLensId(lens))) {
      refuse('That is not a reading this board can run.');
      return;
    }
    // The press's snapshot, and its board's reservation, before the first await.
    const press = this.pressSnapshot(boardId);
    if (!press) {
      refuse(BOARD_CHANGED);
      return;
    }
    if (estimateKey !== press.key) {
      refuse(ESTIMATE_CHANGED, [], true);
      return;
    }
    // A run starts only on the model the writer selected, never on one a pending selection is replacing.
    if (model !== press.facts.model) {
      refuse(MODEL_NOT_IN_USE, [], true);
      return;
    }
    const calls = lightboxPlannedCalls(this.lensesOff, scope, press.board.readings);
    if (calls.length === 0) {
      refuse(scope.mode === 'rest' ? 'Every group is already read.' : 'Every lens is off, so there is nothing to read.');
      return;
    }
    const groups = calls.map((call) => call.group);
    const held = this.runner.reserve(boardId, groups, { lens });
    if (!held.reserved) {
      refuse(held.message, groups);
      return;
    }
    const { reservation } = held;
    this.ownRuns.set(reservation.run.token, reservation.run);

    let preparedCalls: Awaited<ReturnType<LightboxReadingRunner['prepare']>>;
    try {
      preparedCalls = await this.runner.prepare(press.source, calls);
    } catch {
      this.releasePress(reservation);
      refuse('The reading prompts could not be loaded, so nothing was sent.', groups);
      return;
    }
    // Ownership: the tab closed, or the press was stopped, while its prompts loaded.
    if (this.disposed || !this.runner.holds(reservation)) {
      this.releasePress(reservation);
      this.outputChannel.appendLine(`[LightboxReadingHandler] Press ${reservation.run.token} released before it started`);
      return;
    }
    // The snapshot must still be what is current, or the press would send what was not priced.
    const live = this.pressSnapshot(boardId);
    if (!live || live.key !== press.key) {
      this.releasePress(reservation);
      refuse(live ? ESTIMATE_CHANGED : BOARD_CHANGED, groups, true);
      return;
    }
    const fit = estimateLightboxRun({
      boardId,
      key: press.key,
      sourceWords: press.source.sourceWords,
      contextWords: press.source.contextWords,
      columnCount: press.source.material.columns.length,
      groups: preparedCalls,
      rereads: [],
      facts: press.facts
    });
    if (fit.fit === 'too-large') {
      this.releasePress(reservation);
      refuse(fit.reason ?? 'The chapter is too large for the model\'s window.', groups);
      return;
    }

    let groupsBack = 0;
    // The run's streamed characters so far, as the runner last reported them.
    let outputCharacters = 0;
    // Set once the runner accepts the press; its callbacks only ever fire after that.
    let started: LightboxActiveRun | undefined;
    const start = this.runner.startReserved(reservation, press.source, preparedCalls, {
      onGroup: (outcome) => {
        if (!started) {
          return;
        }
        // Published to the subscribed webviews when this is still the current board.
        const board = this.lightboxService.updateReadings(
          boardId,
          (readings) => readings.map((group) =>
            (group.group === outcome.group ? settleLightboxGroup(group, outcome, lens) : group)),
          { token: started.token, group: outcome.group }
        );
        if (!board) {
          this.outputChannel.appendLine(`[LightboxReadingHandler] Dropped group ${outcome.group}: its board is gone`);
          return;
        }
        groupsBack += 1;
        this.postProgress({ boardId, token: started.token, phase: 'streaming', groups, groupsBack, outputCharacters, ...lensField(lens) });
      },
      onProgress: (characters) => {
        outputCharacters = characters;
        if (started) {
          this.postProgress({ boardId, token: started.token, phase: 'streaming', groups, groupsBack, outputCharacters, ...lensField(lens) });
        }
      },
      onFinished: (summary) => {
        if (!started) {
          return;
        }
        this.ownRuns.delete(started.token);
        const cost = summary.usage?.costUsd;
        this.outputChannel.appendLine(
          `[LightboxReadingHandler] Run ${started.token} finished: ${summary.outcomes.length} groups, ` +
            `${summary.usage?.totalTokens ?? 0} tokens${cost !== undefined ? `, $${cost.toFixed(4)}` : ''}`
        );
        this.postProgress({ boardId, token: started.token, phase: 'finished', groups, groupsBack, outputCharacters, ...lensField(lens) });
      }
    });
    if (!start.started) {
      this.releasePress(reservation);
      refuse(start.message, groups);
      return;
    }
    started = start.run;
    this.ownRuns.set(started.token, started);
    this.lightboxService.updateReadings(boardId, (readings) => startLightboxGroups(readings, calls, lens));
    this.postProgress({ boardId, token: started.token, phase: 'started', groups, groupsBack: 0, outputCharacters: 0, ...lensField(lens) });
  }

  async handleCancelRun(message: LightboxCancelRunMessage): Promise<void> {
    this.subscribe();
    const { boardId, token } = message.payload ?? ({} as LightboxCancelRunMessage['payload']);
    const run = this.runner.activeRun(boardId);
    if (!run || run.token !== token) {
      return;
    }
    this.stop(run, STOPPED);
  }

  async handleAddContextFiles(_message: LightboxAddContextFilesMessage): Promise<void> {
    this.subscribe();
    const picked = await this.shell.pickFile({
      title: 'Add a context file to the Lightbox',
      openLabel: 'Add',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter keys are display names.
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    if (this.lightboxService.currentRereadTarget()?.rereadPath === picked.fsPath) {
      this.postContextFiles('That file is the board\'s own source. Context informs the chapter; it is not the chapter.');
      return;
    }
    let resolved: { text: string; displayPath: string };
    try {
      const source = await this.textSourceResolver.resolve({ mode: 'activeFile', pathText: picked.fsPath });
      resolved = { text: source.text, displayPath: source.displayPath ?? source.relativePaths[0] ?? picked.fsPath };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxReadingHandler] Could not read a context file: ${detail}`);
      this.postContextFiles('Could not read that file. Choose a text or Markdown file inside an open workspace folder.');
      return;
    }
    const result = this.contextShelf.add({ ...resolved, sourceKey: picked.fsPath });
    this.outputChannel.appendLine(
      result.added
        ? `[LightboxReadingHandler] Context added: ${result.file.displayPath} (${result.file.wordCount} words)`
        : `[LightboxReadingHandler] Context refused for ${resolved.displayPath}`
    );
    // The webview asks for a fresh estimate when it sees the list change.
    this.postContextFiles(result.added ? undefined : result.notice);
  }

  async handleRemoveContextFile(message: LightboxRemoveContextFileMessage): Promise<void> {
    this.subscribe();
    if (this.contextShelf.remove(message.payload?.id ?? '')) {
      this.outputChannel.appendLine('[LightboxReadingHandler] Context file removed');
    }
    this.postContextFiles();
  }

  /** What a press of the board named would own, read now (`LightboxPressSnapshot`). */
  private pressSnapshot(boardId?: string): LightboxPressSnapshot | undefined {
    return lightboxPressSnapshot({
      service: this.lightboxService,
      shelf: this.contextShelf,
      modelFacts: () => this.runner.modelFacts(),
      lensesOff: this.lensesOff
    }, boardId);
  }

  /** Forget a press that will not start, and give its board back. */
  private releasePress(reservation: LightboxRunReservation): void {
    this.ownRuns.delete(reservation.run.token);
    this.runner.release(reservation);
  }

  private stop(run: LightboxActiveRun, message: string): void {
    this.ownRuns.delete(run.token);
    // A press still preparing has sent nothing and shows nothing: releasing it is enough.
    const started = this.runner.activeRun(run.boardId)?.token === run.token;
    if (!this.runner.cancel(run.boardId, run.token) || !started) {
      return;
    }
    const board = this.lightboxService.updateReadings(run.boardId, (readings) => stopLightboxGroups(readings, run.groups, message));
    this.postProgress({
      boardId: run.boardId,
      token: run.token,
      phase: 'cancelled',
      groups: run.groups,
      groupsBack: board?.readings.filter((group) => run.groups.includes(group.group) && group.status !== 'cancelled').length ?? 0,
      outputCharacters: 0,
      message,
      ...lensField(run.lens)
    });
  }

  /** Answer an estimate request, unless a newer one arrives while this one is priced. */
  private async postEstimate(requestId?: string): Promise<void> {
    if (this.disposed) {
      return;
    }
    const sequence = ++this.estimateSequence;
    const answered = requestId ? { requestId } : {};
    const press = this.pressSnapshot();
    if (!press) {
      void this.postMessage({
        type: MessageType.LIGHTBOX_RUN_ESTIMATE,
        source: SOURCE,
        payload: { ...answered, estimate: null },
        timestamp: Date.now()
      });
      return;
    }
    const groups = lightboxPlannedCalls(this.lensesOff, { mode: 'all' });
    const rereads = LIGHTBOX_LENSES
      .filter((lens) => !this.lensesOff.includes(lens.id))
      .map((lens) => ({ group: lens.group, lenses: [lens.id] }));
    try {
      const estimate = await this.runner.estimate(press.source, groups, rereads, press);
      if (this.disposed || sequence !== this.estimateSequence) {
        return;
      }
      const activeRun = this.runner.activeRun(press.board.boardId);
      void this.postMessage({
        type: MessageType.LIGHTBOX_RUN_ESTIMATE,
        source: SOURCE,
        payload: { ...answered, estimate, ...(activeRun ? { activeRun } : {}) },
        timestamp: Date.now()
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxReadingHandler] Estimate failed: ${detail}`);
    }
  }

  private postContextFiles(notice?: string): void {
    if (this.disposed) {
      return;
    }
    void this.postMessage({
      type: MessageType.LIGHTBOX_CONTEXT_FILES,
      source: SOURCE,
      payload: {
        files: this.contextShelf.list(),
        totalWords: this.contextShelf.totalWords(),
        ceilingWords: PROMPT_BUDGETS.contextFiles.words,
        ...(notice ? { notice } : {})
      },
      timestamp: Date.now()
    });
  }

  /** Hear the service's reading outcomes, once, from the first reading message on. */
  private subscribe(): void {
    if (this.unsubscribe || this.disposed) {
      return;
    }
    this.unsubscribe = this.lightboxService.addOutcomeListener((change) => this.publish(change));
  }

  /** Board and refusal changes are LightboxHandler's to post; readings are this handler's. */
  private publish(change: LightboxOutcomeChange): void {
    if (change.kind !== 'readings') {
      return;
    }
    if (change.settled) {
      void this.postMessage({
        type: MessageType.LIGHTBOX_GROUP_RESULT,
        source: SOURCE,
        payload: { boardId: change.board.boardId, token: change.settled.token, group: change.settled.group },
        timestamp: Date.now()
      });
      return;
    }
    void this.postMessage({
      type: MessageType.LIGHTBOX_BOARD,
      source: SOURCE,
      payload: { board: change.board, refusal: change.refusal },
      timestamp: Date.now()
    });
  }

  private postProgress(progress: LightboxRunProgress): void {
    if (this.disposed) {
      return;
    }
    void this.postMessage({ type: MessageType.LIGHTBOX_RUN_PROGRESS, source: SOURCE, payload: progress, timestamp: Date.now() });
  }
}

function lensField(lens: LightboxLensId | undefined): { lens?: LightboxLensId } {
  return lens ? { lens } : {};
}
