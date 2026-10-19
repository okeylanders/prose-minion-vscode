/**
 * Lightbox readings: lenses, the estimate, runs and context files (ADR
 * 2026-10-19 D6–D10; Slice 2B). Composed beside `LightboxHandler` in every
 * MessageHandler, over the same shared services; nothing is constructed
 * here. `LightboxHandler` owns the board's source; this owns what a press
 * reads and sends.
 *
 * - **Sync.** The webview sends its lens toggles on mount, on a toggle, when
 *   the board changes and when the assistant model or catalog changes. Each
 *   `LIGHTBOX_SET_LENSES` is answered with the context list and a fresh
 *   estimate (fit and cost), plus the board's run while one is active.
 * - **Validate before spend.** A press is refused, with nothing sent, when
 *   the board is not the one on screen, every lens is off, the board is
 *   already being read, a call is too large for the model's window, or there
 *   is no API key.
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
import type { LightboxRunSource } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { estimateLightboxRun } from '@/infrastructure/lightbox/LightboxRunEstimate';
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
  LightboxBoard,
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

type LightboxContextPicker = Pick<ShellService, 'pickFile'>;

export class LightboxReadingHandler {
  /** The webview's lens toggles; all on until it says otherwise. */
  private lensesOff: LightboxLensId[] = [];
  /** Runs this handler started, so closing the tab stops them. */
  private readonly ownRuns = new Map<string, LightboxActiveRun>();
  private unsubscribe?: () => void;
  private disposed = false;

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
    await this.postEstimate();
  }

  async handleRun(message: LightboxRunMessage): Promise<void> {
    this.subscribe();
    const { boardId, scope } = message.payload ?? ({} as LightboxRunMessage['payload']);
    const lens = scope?.mode === 'lens' ? scope.lens : undefined;
    const refuse = (text: string, groups: LightboxReadingGroupId[] = []): void => {
      this.outputChannel.appendLine(`[LightboxReadingHandler] Run refused: ${text}`);
      this.postProgress({ boardId, phase: 'refused', groups, groupsBack: 0, outputCharacters: 0, message: text });
    };
    if (!scope || !['all', 'rest', 'lens'].includes(scope.mode) || (scope.mode === 'lens' && !isLightboxLensId(lens))) {
      refuse('That is not a reading this board can run.');
      return;
    }
    const prepared = this.runSource(boardId);
    if (!prepared) {
      refuse('The board changed. Read the board on screen.');
      return;
    }
    const calls = lightboxPlannedCalls(this.lensesOff, scope, prepared.board.readings);
    if (calls.length === 0) {
      refuse(scope.mode === 'rest' ? 'Every group is already read.' : 'Every lens is off, so there is nothing to read.');
      return;
    }
    const groups = calls.map((call) => call.group);
    if (this.runner.activeRun(boardId)) {
      refuse('This board is already being read. Stop that run first.', groups);
      return;
    }

    const preparedCalls = await this.runner.prepare(prepared.source, calls);
    const fit = estimateLightboxRun({
      boardId,
      sourceWords: prepared.source.sourceWords,
      contextWords: prepared.source.contextWords,
      columnCount: prepared.source.material.columns.length,
      groups: preparedCalls,
      rereads: [],
      facts: this.runner.modelFacts()
    });
    if (fit.fit === 'too-large') {
      refuse(fit.reason ?? 'The chapter is too large for the model\'s window.', groups);
      return;
    }
    // Preparing awaited the prompt files: check again that nothing moved.
    if (this.lightboxService.currentBoard()?.boardId !== boardId || this.runner.activeRun(boardId)) {
      refuse('The board changed. Read the board on screen.', groups);
      return;
    }

    let groupsBack = 0;
    // Set once the runner accepts the press; its callbacks only ever fire after that.
    let started: LightboxActiveRun | undefined;
    const start = this.runner.start(prepared.source, preparedCalls, {
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
        this.postProgress({ boardId, token: started.token, phase: 'streaming', groups, groupsBack, outputCharacters: 0, ...lensField(lens) });
      },
      onProgress: (outputCharacters) => {
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
        this.postProgress({ boardId, token: started.token, phase: 'finished', groups, groupsBack, outputCharacters: 0, ...lensField(lens) });
        void this.postEstimate();
      }
    }, { lens });
    if (!start.started) {
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
    this.postContextFiles(result.added ? undefined : result.notice);
    await this.postEstimate();
  }

  async handleRemoveContextFile(message: LightboxRemoveContextFileMessage): Promise<void> {
    this.subscribe();
    if (this.contextShelf.remove(message.payload?.id ?? '')) {
      this.outputChannel.appendLine('[LightboxReadingHandler] Context file removed');
    }
    this.postContextFiles();
    await this.postEstimate();
  }

  /** The current board and what a run of it reads, when it is the board named. */
  private runSource(boardId?: string): { board: LightboxBoard; source: LightboxRunSource } | undefined {
    const current = this.lightboxService.currentBoard();
    if (!current || (boardId !== undefined && current.boardId !== boardId)) {
      return undefined;
    }
    const text = this.lightboxService.readingSource(current.boardId);
    if (!text) {
      return undefined;
    }
    const board = text.board;
    return {
      board,
      source: {
        boardId: board.boardId,
        material: {
          paragraphs: text.paragraphTexts,
          columns: board.ribbon.map(({ from, to }) => ({ from, to })),
          context: this.contextShelf.materials()
        },
        sourceWords: board.source.wordCount,
        contextWords: this.contextShelf.totalWords(),
        averageWordsPerSentence: board.measured.headline.averageWordsPerSentence
      }
    };
  }

  private stop(run: LightboxActiveRun, message: string): void {
    this.ownRuns.delete(run.token);
    if (!this.runner.cancel(run.boardId, run.token)) {
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
    void this.postEstimate();
  }

  private async postEstimate(): Promise<void> {
    const prepared = this.runSource();
    if (!prepared) {
      void this.postMessage({
        type: MessageType.LIGHTBOX_RUN_ESTIMATE,
        source: SOURCE,
        payload: { estimate: null },
        timestamp: Date.now()
      });
      return;
    }
    const groups = lightboxPlannedCalls(this.lensesOff, { mode: 'all' });
    const rereads = LIGHTBOX_LENSES
      .filter((lens) => !this.lensesOff.includes(lens.id))
      .map((lens) => ({ group: lens.group, lenses: [lens.id] }));
    try {
      const estimate = await this.runner.estimate(prepared.source, groups, rereads);
      const activeRun = this.runner.activeRun(prepared.board.boardId);
      void this.postMessage({
        type: MessageType.LIGHTBOX_RUN_ESTIMATE,
        source: SOURCE,
        payload: { estimate, ...(activeRun ? { activeRun } : {}) },
        timestamp: Date.now()
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[LightboxReadingHandler] Estimate failed: ${detail}`);
    }
  }

  private postContextFiles(notice?: string): void {
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
    void this.postMessage({ type: MessageType.LIGHTBOX_RUN_PROGRESS, source: SOURCE, payload: progress, timestamp: Date.now() });
  }
}

function lensField(lens: LightboxLensId | undefined): { lens?: LightboxLensId } {
  return lens ? { lens } : {};
}
