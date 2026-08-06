/** Workshop excerpt intake and pre-memory session-scope IPC slice. */

import {
  WorkshopScopeLockedError,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopExcerptReplacement,
  WorkshopScopeTransition
} from '@/application/services/workshop/WorkshopSessionRecords';
import {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import {
  describeWorkshopPendingHostUpdates
} from '@/application/services/workshop/WorkshopPromptBuilder';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects,
  WorkshopRunGate
} from '@handlers/domain/workshop/WorkshopHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import { LogSink, ShellService } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE } from '@shared/constants/workshopScope';
import { isContextPathGroup } from '@shared/types/context';
import {
  MessageType,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  WorkshopPickExcerptFileMessage,
  WorkshopRepinExcerptMessage,
  WorkshopRereadExcerptMessage,
  WorkshopSetExcerptMessage,
  WorkshopSetExcerptResourceMessage,
  WorkshopSetSessionScopeMessage,
  coerceWorkshopExcerptSource,
  isWorkshopSelectableSessionScope,
  workshopExcerptSourcePath
} from '@messages';
import { fileURLToPath, pathToFileURL } from 'url';

type WorkshopExcerptScopeEffects = Pick<
  WorkshopRoomEffects,
  | 'postSessionState'
  | 'postTurn'
  | 'markDirty'
  | 'reportError'
  | 'sendStatus'
  | 'discardConversations'
>;

const workshopScopeMutationError = (error: unknown, fallback: string): string =>
  error instanceof WorkshopScopeLockedError
    ? WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE
    : error instanceof Error
      ? error.message
      : fallback;

/**
 * Owns the six routes that can replace, re-read, shelve, or restore the
 * Workshop excerpt. Live tool/wizard state remains room-owned and is exposed
 * only as a refusal-producing gate.
 */
export class WorkshopExcerptScopeHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly shell: ShellService,
    private readonly contextIntakeService: WorkshopContextIntakeService,
    private readonly outputChannel: LogSink,
    private readonly runGate: WorkshopRunGate,
    private readonly effects: WorkshopExcerptScopeEffects
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(MessageType.WORKSHOP_SET_EXCERPT, this.handleSetExcerpt.bind(this));
    registerMutation(
      MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
      this.handleSetExcerptResource.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_PICK_EXCERPT_FILE,
      this.handlePickExcerptFile.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_REREAD_EXCERPT, this.handleRereadExcerpt.bind(this));
    registerMutation(
      MessageType.WORKSHOP_SET_SESSION_SCOPE,
      this.handleSetSessionScope.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_REPIN_EXCERPT, this.handleRepinExcerpt.bind(this));
  }

  async handleSetExcerpt(message: WorkshopSetExcerptMessage): Promise<void> {
    const { text } = message.payload;

    if (typeof text !== 'string' || text.trim().length === 0) {
      this.effects.reportError('Cannot pin an empty excerpt.');
      return;
    }

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const source = await this.withConfiguredResource(
      coerceWorkshopExcerptSource(message.payload.source)
    );
    // Resolution awaited on catalog I/O; re-check the guard it may have raced.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    if (!this.tryReplaceExcerpt({ text, source })) {
      return;
    }
    this.effects.markDirty('excerpt replaced');
    this.effects.postSessionState();
  }

  async handleSetExcerptResource(message: WorkshopSetExcerptResourceMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    const candidate = message.payload as { group?: unknown; path?: unknown };
    if (
      typeof candidate?.group !== 'string' ||
      !isContextPathGroup(candidate.group) ||
      typeof candidate.path !== 'string' ||
      candidate.path.trim().length === 0
    ) {
      this.effects.reportError('Excerpt selection must name a configured resource.');
      return;
    }
    const item = { group: candidate.group, path: candidate.path };

    let catalog;
    try {
      catalog = await this.contextIntakeService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.effects.reportError('Could not read the configured resource catalog.', details);
      return;
    }
    const loaded = await catalog.load(item, {
      maxBytes: PROMPT_BUDGETS.fileExcerpt.bytes,
      maxWords: PROMPT_BUDGETS.fileExcerpt.words
    });
    if (!this.contextIntakeService.reportConfiguredResourceLoadFailure(
      loaded,
      'pin',
      PROMPT_BUDGETS.fileExcerpt.bytes,
      this.effects.reportError
    )) {
      return;
    }
    const { resource } = loaded;

    // Catalog creation and resource loading are both asynchronous. The room
    // may have started a tool or wizard while either one was in flight.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    if (!this.tryReplaceExcerpt({
      text: resource.text,
      source: {
        kind: 'file',
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: item
      },
      truncation: resource.truncation
        ? { pinnedWords: resource.truncation.keptWords, totalWords: resource.truncation.totalWords }
        : undefined,
      sourceFingerprint: resource.sourceFingerprint
    })) {
      return;
    }
    this.effects.markDirty('configured excerpt replaced');
    this.effects.postSessionState();
  }

  async handlePickExcerptFile(_message: WorkshopPickExcerptFileMessage): Promise<void> {
    // A picker can stay open long enough for the room's run state to change,
    // so every awaited boundary has a source-of-truth guard around it.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const picked = await this.shell.pickFile({
      title: 'Pin excerpt from file',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const displayPath = this.contextIntakeService.toDisplayPath(picked.fsPath);
    const loaded = await this.loadExcerptFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }

    const source = await this.withConfiguredResource({
      kind: 'file',
      sourceUri: picked.uri,
      relativePath: displayPath
    });

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    if (!this.tryReplaceExcerpt({
      text: loaded.text,
      source,
      truncation: loaded.truncation,
      sourceFingerprint: loaded.sourceFingerprint
    })) {
      return;
    }
    this.effects.markDirty('file excerpt replaced');
    this.effects.postSessionState();
  }

  async handleRereadExcerpt(_message: WorkshopRereadExcerptMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.source.kind !== 'file') {
      this.effects.reportError('Only a file-backed excerpt can be re-read from disk.');
      return;
    }
    const source = excerpt.source;

    let fsPath: string;
    try {
      fsPath = fileURLToPath(source.sourceUri);
    } catch (error) {
      this.outputChannel.appendLine(
        `[WorkshopExcerptScopeHandler] Excerpt source URI could not be converted to a file path: ${error instanceof Error ? error.message : String(error)}`
      );
      this.effects.reportError(
        'The excerpt’s source location is no longer readable.',
        source.relativePath
      );
      return;
    }

    const loaded = await this.loadExcerptFromDisk(fsPath, source.relativePath);
    if (!loaded) {
      return;
    }

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const unchanged = excerpt.sourceFingerprint !== undefined
      ? loaded.sourceFingerprint === excerpt.sourceFingerprint
      : loaded.text === excerpt.text &&
        loaded.truncation?.totalWords === excerpt.truncation?.totalWords;
    if (unchanged) {
      this.outputChannel.appendLine(
        `[WorkshopExcerptScopeHandler] Excerpt re-read: unchanged on disk (${source.relativePath})`
      );
      this.effects.sendStatus(`Excerpt unchanged on disk · ${source.relativePath}`);
      return;
    }

    const resolvedSource = await this.withConfiguredResource(source);
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    if (!this.tryReplaceExcerpt({
      text: loaded.text,
      source: resolvedSource,
      truncation: loaded.truncation,
      sourceFingerprint: loaded.sourceFingerprint
    })) {
      return;
    }
    this.effects.markDirty('file excerpt reread');
    this.effects.postSessionState();
  }

  async handleSetSessionScope(message: WorkshopSetSessionScopeMessage): Promise<void> {
    const scope = message.payload?.scope;
    if (!isWorkshopSelectableSessionScope(scope)) {
      this.effects.reportError(`Unknown Workshop session scope: ${String(scope)}`);
      return;
    }
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    try {
      const transition = this.session.setSessionScope(scope);
      this.applyScopeTransition(
        transition,
        scope === 'open'
          ? 'session scope set to open conversation'
          : 'session scope set to passage session'
      );
    } catch (error) {
      this.effects.reportError(
        workshopScopeMutationError(error, 'That session scope is unavailable.')
      );
    }
  }

  async handleRepinExcerpt(_message: WorkshopRepinExcerptMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    try {
      this.applyScopeTransition(
        this.session.repinShelvedExcerpt(),
        'shelved excerpt re-pinned'
      );
    } catch (error) {
      this.effects.reportError(
        workshopScopeMutationError(error, 'There is no excerpt on the shelf.')
      );
    }
  }

  private applyScopeTransition(transition: WorkshopScopeTransition, reason: string): void {
    if (!transition.changed) {
      // Idempotent: still broadcast so a stale webview reconciles.
      this.effects.postSessionState();
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopExcerptScopeHandler] ${reason} (scope=${transition.scope ?? 'unchosen'}, ` +
      `excerpt=${transition.excerpt ? `v${transition.excerpt.version}` : 'none'}, ` +
      `shelved=${transition.shelvedExcerpt ? `v${transition.shelvedExcerpt.version}` : 'none'})`
    );
    this.effects.markDirty(reason);
    this.effects.postSessionState();
  }

  private async loadExcerptFromDisk(
    fsPath: string,
    displayPath: string
  ): Promise<{
    text: string;
    truncation?: WorkshopExcerptTruncation;
    sourceFingerprint: string;
  } | undefined> {
    const result = await this.contextIntakeService.loadFile(
      fsPath,
      displayPath,
      {
        maxBytes: PROMPT_BUDGETS.fileExcerpt.bytes,
        maxWords: PROMPT_BUDGETS.fileExcerpt.words
      },
      'pin'
    );
    if (result.kind === 'refused') {
      this.effects.reportError(result.refusal.message, result.refusal.details);
      return undefined;
    }
    if (result.file.truncation) {
      this.outputChannel.appendLine(
        `[WorkshopExcerptScopeHandler] File excerpt head-sliced: ${result.file.truncation.keptWords} of ${result.file.truncation.totalWords} words (${displayPath})`
      );
    }
    return {
      text: result.file.text,
      truncation: result.file.truncation
        ? {
            pinnedWords: result.file.truncation.keptWords,
            totalWords: result.file.truncation.totalWords
          }
        : undefined,
      sourceFingerprint: result.file.sourceFingerprint
    };
  }

  private async withConfiguredResource(
    source: WorkshopExcerptSource
  ): Promise<WorkshopExcerptSource> {
    const match = await this.contextIntakeService.matchConfiguredSource(source);
    switch (match.kind) {
      case 'uri-unreadable':
        this.outputChannel.appendLine(
          `[WorkshopExcerptScopeHandler] Excerpt-source resolution skipped — URI unreadable: ${match.details}`
        );
        break;
      case 'catalog-unreadable':
        this.outputChannel.appendLine(
          `[WorkshopExcerptScopeHandler] Excerpt-source resolution skipped — catalog unreadable: ${match.details}`
        );
        break;
      case 'ambiguous':
        this.outputChannel.appendLine(
          `[WorkshopExcerptScopeHandler] Excerpt source matched ${match.matchCount} configured resources when letter case is ignored; leaving it unstamped.`
        );
        break;
      case 'matched':
        this.outputChannel.appendLine(
          `[WorkshopExcerptScopeHandler] Excerpt source resolved to configured resource [${match.configuredResource.group}] ${match.configuredResource.path}`
        );
        break;
      case 'manual':
      case 'unmatched':
        break;
    }
    return match.source;
  }

  private tryReplaceExcerpt(input: {
    text: string;
    source: WorkshopExcerptSource;
    truncation?: WorkshopExcerptTruncation;
    sourceFingerprint?: string;
  }): boolean {
    let replacement: WorkshopExcerptReplacement;
    try {
      replacement = this.session.replaceExcerpt(input);
    } catch (error) {
      this.effects.reportError(
        workshopScopeMutationError(error, 'That excerpt cannot be pinned in this session.')
      );
      return false;
    }
    this.effects.discardConversations(replacement.disposedConversationIds);
    if (replacement.dividerTurn) {
      this.effects.postTurn(replacement.dividerTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopExcerptScopeHandler] Excerpt v${replacement.excerpt.version} pinned (${workshopExcerptSourcePath(replacement.excerpt.source) ?? 'pasted'}, ${replacement.excerpt.text.length} chars, ${replacement.retiredSidecarCount} sidecars retired)`
    );
    if (replacement.discardedShelvedExcerpt) {
      const discarded = replacement.discardedShelvedExcerpt;
      this.outputChannel.appendLine(
        `[WorkshopExcerptScopeHandler] Set-aside excerpt discarded by that pin (` +
        `${workshopExcerptSourcePath(discarded.source) ?? 'pasted'}, ` +
        `v${discarded.version}, ${discarded.text.length} chars)`
      );
    }
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    if (pendingHostUpdates?.excerpt) {
      this.outputChannel.appendLine(
        `[WorkshopExcerptScopeHandler] Pending host update queued (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
      );
    }
    if (replacement.replacementCount === 3) {
      this.effects.sendStatus(
        'This session now carries three excerpt revisions. Consider a new session soon to keep context cost down.'
      );
    }
    return true;
  }

  private rejectExcerptMutationWhileRunning(): boolean {
    const refusal = this.runGate.excerptMutationBlockedReason();
    if (!refusal) {
      return false;
    }
    this.effects.reportError(refusal);
    return true;
  }
}
