/** Workshop context attachments, configured resources, and wizard IPC slice. */

import {
  WorkshopContextAttachmentInput,
  WorkshopMessageAttachmentInput,
  WorkshopSessionService,
  workshopTextNoteLabel
} from '@/application/services/workshop/WorkshopSessionService';
import {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopHandlerContracts';
import { LogSink, ShellService } from '@/platform';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types/context';
import { countWords } from '@/utils/textUtils';
import {
  API_KEY_NOT_CONFIGURED_HEADING,
  MessageType,
  StreamCompleteMessage,
  StreamStartedMessage,
  WorkshopAddContextFileMessage,
  WorkshopAddContextResourcesMessage,
  WorkshopAddContextTextMessage,
  WorkshopAttachMessageFileMessage,
  WorkshopAttachMessageResourcesMessage,
  WorkshopConfiguredResourceRef,
  WorkshopContextCatalogEntry,
  WorkshopContextCatalogMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopOpenContextAttachmentFileMessage,
  WorkshopRemoveContextAttachmentMessage,
  WorkshopRemoveMessageAttachmentMessage,
  WorkshopRequestContextAttachmentMessage,
  WorkshopRequestContextCatalogMessage,
  WorkshopRunContextWizardMessage,
  WorkshopSearchContextResourcesMessage,
  WorkshopUpdateContextTextMessage,
  workshopExcerptSourceUri
} from '@messages';
import { fileURLToPath, pathToFileURL } from 'url';

let requestIdCounter = 0;
const generateRequestId = (): string =>
  `workshop-wizard-${Date.now()}-${++requestIdCounter}`;

const baseName = (filePath: string): string =>
  filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;

/**
 * Why a context edit was refused (Sprint 13A §6). Every branch names a
 * reason the writer can act on because the sheet retains the writer's draft.
 */
const WORKSHOP_CONTEXT_EDIT_REFUSALS: Readonly<
  Record<'unknown' | 'not-editable' | 'over-budget', (remainingWords: number) => string>
> = Object.freeze({
  unknown: () => 'That context attachment is no longer attached to this session.',
  'not-editable': () =>
    'Project files stay in sync with the file on disk. Edit the file itself, or add a text note instead.',
  'over-budget': (remainingWords) =>
    `That edit exceeds the shared context budget — ${remainingWords.toLocaleString('en-US')} words are available. Trim it, or remove another attachment first.`
});

type WorkshopContextEffects = Pick<
  WorkshopRoomEffects,
  'postSessionState' | 'postTurn' | 'markDirty' | 'reportError' | 'sendStatus'
>;

/**
 * Owns Workshop's context/resource routes and the independent Context wizard
 * lifecycle. The room orchestrator retains the global router, session-state
 * envelope, session-operation gate, and central cancel route.
 */
export class WorkshopContextHandler {
  private wizardRun?: {
    requestId: string;
    excerptVersion: number;
    controller: AbortController;
  };

  constructor(
    private readonly contextAssistantService: ContextAssistantService,
    private readonly session: WorkshopSessionService,
    private readonly shell: ShellService,
    private readonly contextIntakeService: WorkshopContextIntakeService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopContextEffects
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(MessageType.WORKSHOP_ADD_CONTEXT_TEXT, this.handleAddContextText.bind(this));
    registerMutation(MessageType.WORKSHOP_ADD_CONTEXT_FILE, this.handleAddContextFile.bind(this));
    registerMutation(
      MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT,
      this.handleRemoveContextAttachment.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT,
      this.handleUpdateContextText.bind(this)
    );

    // These are reads: opening the sheet, file, or selector remains available
    // while a session save/replacement operation is in flight.
    router.register(
      MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
      this.handleRequestContextAttachment.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE,
      this.handleOpenContextAttachmentFile.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG,
      this.handleRequestContextCatalog.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES,
      this.handleSearchContextResources.bind(this)
    );

    registerMutation(
      MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
      this.handleAddContextResources.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
      this.handleAttachMessageResources.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_ATTACH_MESSAGE_FILE,
      this.handleAttachMessageFile.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT,
      this.handleRemoveMessageAttachment.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_RUN_CONTEXT_WIZARD,
      this.handleRunContextWizard.bind(this)
    );
  }

  isRunning(): boolean {
    return this.wizardRun !== undefined;
  }

  /**
   * Abort a matching writer-requested run without releasing its slot. The
   * run's guarded finally owns slot release and the streaming completion.
   */
  cancelRun(requestId: string): boolean {
    if (this.wizardRun?.requestId !== requestId) {
      return false;
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Wizard cancel requested: ${requestId}`
    );
    this.wizardRun.controller.abort();
    return true;
  }

  /** Webview teardown may release the slot immediately after aborting it. */
  dispose(): void {
    if (!this.wizardRun) {
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Aborting Context wizard ${this.wizardRun.requestId} on dispose`
    );
    this.wizardRun.controller.abort();
    this.wizardRun = undefined;
  }

  async handleAddContextText(message: WorkshopAddContextTextMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.effects.reportError('Cannot attach empty context text.');
      return;
    }
    this.applyContextAttachment({
      kind: 'text',
      origin: 'writer',
      // Sprint 13A §6: the note's own first line is its name.
      label: workshopTextNoteLabel(text),
      content: text,
      words: countWords(text)
    });
  }

  async handleAddContextFile(_message: WorkshopAddContextFileMessage): Promise<void> {
    const picked = await this.shell.pickFile({
      title: 'Add context from file',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    const displayPath = this.contextIntakeService.toDisplayPath(picked.fsPath);
    const loaded = await this.loadContextFileFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }
    this.applyContextAttachment({
      kind: 'file',
      origin: 'writer',
      label: baseName(picked.fsPath),
      content: loaded.text,
      words: loaded.words,
      sourceUri: picked.uri,
      relativePath: displayPath,
      truncation: loaded.truncation
    });
  }

  async handleRemoveContextAttachment(
    message: WorkshopRemoveContextAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.effects.reportError('Context removal must identify an attachment.');
      return;
    }
    const { removed, eventTurn } = this.session.removeContextAttachment(id);
    if (!removed) {
      this.effects.reportError('That context attachment no longer exists.');
      return;
    }
    if (eventTurn) {
      this.effects.postTurn(eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Context attachment removed (${removed.label}, ${removed.words} words)`
    );
    this.effects.markDirty('context attachment removed');
    this.effects.postSessionState();
  }

  async handleUpdateContextText(message: WorkshopUpdateContextTextMessage): Promise<void> {
    const id = message.payload?.id;
    const text = typeof message.payload?.text === 'string' ? message.payload.text : '';
    if (typeof id !== 'string' || id.length === 0) {
      this.effects.reportError('A context edit must identify an attachment.');
      return;
    }
    if (text.trim().length === 0) {
      this.effects.reportError('Cannot save empty context text. Remove the attachment instead.');
      return;
    }
    const result = this.session.updateContextAttachmentText(id, text, countWords(text));
    if (!result.ok) {
      this.effects.reportError(
        WORKSHOP_CONTEXT_EDIT_REFUSALS[result.reason](result.remainingWords)
      );
      this.effects.postSessionState();
      return;
    }
    if (result.eventTurn) {
      this.effects.postTurn(result.eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Context attachment edited (${result.attachment.label}, ` +
      `${result.attachment.words} words, origin=${result.attachment.origin})`
    );
    this.effects.markDirty('context attachment edited');
    this.effects.postSessionState();
  }

  async handleRequestContextAttachment(
    message: WorkshopRequestContextAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.effects.reportError('A context request must identify an attachment.');
      return;
    }
    const attachment = this.session.getContextAttachment(id);
    if (!attachment) {
      const detail = `Workshop context attachment ${id} was requested after it left the session`;
      this.outputChannel.appendLine(`[WorkshopContextHandler] ${detail}`);
      this.effects.reportError(
        'That context attachment is no longer attached to this session.',
        detail
      );
      void this.postMessage({
        type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT,
        source: 'extension.workshop',
        payload: {
          id,
          error: 'That context attachment is no longer attached to this session.',
          canOpenInEditor: false
        },
        timestamp: Date.now()
      });
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Context attachment served to the sheet (${attachment.label}, ` +
      `${attachment.content.length} chars, origin=${attachment.origin})`
    );
    void this.postMessage({
      type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT,
      source: 'extension.workshop',
      payload: {
        id,
        content: attachment.content,
        canOpenInEditor: attachment.sourceUri !== undefined
      },
      timestamp: Date.now()
    });
  }

  async handleOpenContextAttachmentFile(
    message: WorkshopOpenContextAttachmentFileMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.effects.reportError('An open request must identify an attachment.');
      return;
    }
    const attachment = this.session.getContextAttachment(id);
    if (!attachment?.sourceUri) {
      this.effects.reportError(
        attachment
          ? `${attachment.label} is a typed note, so it has no file to open.`
          : 'That context attachment is no longer attached to this session.'
      );
      return;
    }
    try {
      await this.shell.openFileInEditor(fileURLToPath(attachment.sourceUri), { beside: true });
      this.outputChannel.appendLine(
        `[WorkshopContextHandler] Context attachment opened in an editor tab (${attachment.label})`
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopContextHandler] Could not open ${attachment.label} in an editor tab: ${details}`
      );
      this.effects.reportError(`Could not open ${attachment.label} in an editor tab.`, details);
    }
  }

  async handleRequestContextCatalog(
    _message: WorkshopRequestContextCatalogMessage
  ): Promise<void> {
    try {
      const catalog = await this.contextIntakeService.openCatalog();
      const entries: WorkshopContextCatalogEntry[] = catalog.entries().map((resource) => ({
        group: resource.group,
        path: resource.path,
        label: resource.label,
        sizeBytes: resource.sizeBytes
      }));
      const response: WorkshopContextCatalogMessage = {
        type: MessageType.WORKSHOP_CONTEXT_CATALOG,
        source: 'extension.workshop',
        payload: { entries },
        timestamp: Date.now()
      };
      void this.postMessage(response);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.effects.reportError('Could not read the configured resource catalog.', details);
    }
  }

  async handleSearchContextResources(
    message: WorkshopSearchContextResourcesMessage
  ): Promise<void> {
    const rawQuery = typeof message.payload?.query === 'string' ? message.payload.query.trim() : '';
    if (rawQuery.length === 0) {
      return;
    }
    const query = rawQuery
      .slice(0, PROMPT_BUDGETS.workshopResource.queryCharacters)
      .toLowerCase();
    const budgets = PROMPT_BUDGETS.workshopResource;
    try {
      const catalog = await this.contextIntakeService.openCatalog();
      const candidates = catalog.entries();
      const scannable = candidates.slice(0, budgets.searchFiles);
      let bounded = candidates.length > scannable.length;
      let bytesScanned = 0;
      const matches: WorkshopConfiguredResourceRef[] = [];
      for (const candidate of scannable) {
        if (bytesScanned >= budgets.searchTotalBytes) {
          bounded = true;
          break;
        }
        if (
          candidate.sizeBytes >
          Math.min(budgets.searchFileBytes, budgets.searchTotalBytes - bytesScanned)
        ) {
          bounded = true;
          continue;
        }
        const loaded = await catalog.load(
          { group: candidate.group, path: candidate.path },
          {
            maxBytes: Math.min(
              budgets.searchFileBytes,
              budgets.searchTotalBytes - bytesScanned
            ),
            maxWords: Number.MAX_SAFE_INTEGER
          }
        );
        if (loaded.kind !== 'loaded') {
          continue;
        }
        bytesScanned += candidate.sizeBytes;
        if (loaded.resource.text.toLowerCase().includes(query)) {
          matches.push({ group: candidate.group, path: candidate.path });
        }
      }
      const results: WorkshopContextSearchResultsMessage = {
        type: MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS,
        source: 'extension.workshop',
        payload: { query: rawQuery, matches, bounded },
        timestamp: Date.now()
      };
      void this.postMessage(results);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.effects.reportError('Context search failed.', details);
    }
  }

  async handleAddContextResources(message: WorkshopAddContextResourcesMessage): Promise<void> {
    const validated = this.validConfiguredResources(message.payload?.items);
    if (validated.length === 0) {
      this.effects.reportError('No valid configured resources to attach.');
      return;
    }

    let catalog;
    try {
      catalog = await this.contextIntakeService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.effects.reportError('Could not read the configured resource catalog.', details);
      return;
    }
    for (const item of validated) {
      const loaded = await catalog.load(item, {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.contextAttachments.words
      });
      if (!this.contextIntakeService.reportConfiguredResourceLoadFailure(
        loaded,
        'attach',
        PROMPT_BUDGETS.contextAttachments.fileBytes,
        this.effects.reportError
      )) {
        continue;
      }
      const { resource } = loaded;
      this.applyContextAttachment({
        kind: 'file',
        origin: 'writer',
        label: baseName(item.path),
        content: resource.text,
        words: resource.words,
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: { group: item.group, path: item.path },
        truncation: resource.truncation
      });
    }
  }

  async handleAttachMessageResources(
    message: WorkshopAttachMessageResourcesMessage
  ): Promise<void> {
    const validated = this.validConfiguredResources(message.payload?.items);
    if (validated.length === 0) {
      this.effects.reportError('No valid configured resources to attach to the message.');
      return;
    }

    let catalog;
    try {
      catalog = await this.contextIntakeService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.effects.reportError('Could not read the configured resource catalog.', details);
      return;
    }
    for (const item of validated) {
      const loaded = await catalog.load(item, {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.workshopThreadArtifacts.words
      });
      if (!this.contextIntakeService.reportConfiguredResourceLoadFailure(
        loaded,
        'attach',
        PROMPT_BUDGETS.contextAttachments.fileBytes,
        this.effects.reportError
      )) {
        continue;
      }
      const { resource } = loaded;
      this.stageMessageAttachment({
        label: baseName(item.path),
        content: resource.text,
        words: resource.words,
        relativePath: item.path,
        configuredResource: { group: item.group, path: item.path },
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        truncation: resource.truncation
      });
    }
  }

  async handleAttachMessageFile(_message: WorkshopAttachMessageFileMessage): Promise<void> {
    const picked = await this.shell.pickFile({
      title: 'Attach file to this message',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    const displayPath = this.contextIntakeService.toDisplayPath(picked.fsPath);
    const loaded = await this.loadContextFileFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }
    const totalWords = loaded.truncation?.totalWords ?? loaded.words;
    const bounded = this.boundThreadArtifact(loaded.text, totalWords);
    this.stageMessageAttachment({
      label: baseName(picked.fsPath),
      content: bounded.text,
      words: bounded.words,
      relativePath: displayPath,
      sourceUri: picked.uri,
      truncation: bounded.truncation
    });
  }

  async handleRemoveMessageAttachment(
    message: WorkshopRemoveMessageAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.effects.reportError('Message-attachment removal must identify an attachment.');
      return;
    }
    const removed = this.session.removeMessageAttachment(id);
    if (!removed) {
      this.effects.reportError('That message attachment no longer exists.');
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Message attachment removed (${removed.id}, ${removed.label})`
    );
    this.effects.markDirty('message attachment removed');
    this.effects.postSessionState();
  }

  async handleRunContextWizard(_message: WorkshopRunContextWizardMessage): Promise<void> {
    if (this.wizardRun) {
      this.effects.reportError('The Context wizard is already running — one run at a time.');
      return;
    }
    const excerpt = this.session.getExcerpt();
    if (!excerpt) {
      this.effects.reportError(
        'Set an excerpt first — the wizard reads your project around it.'
      );
      return;
    }

    const requestId = generateRequestId();
    const controller = new AbortController();
    this.wizardRun = { requestId, excerptVersion: excerpt.version, controller };
    const started: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.workshop',
      payload: { requestId, domain: 'workshop-context' },
      timestamp: Date.now()
    };
    void this.postMessage(started);

    let cancelled = false;
    try {
      const attachments = this.session.getContextAttachments();
      const existingContext = attachments.length > 0
        ? `Context already attached (do not re-request these): ${attachments
            .map((entry) => entry.label)
            .join(', ')}`
        : undefined;
      const result = await this.contextAssistantService.generateContext(
        {
          excerpt: excerpt.text,
          existingContext,
          sourceFileUri: workshopExcerptSourceUri(excerpt.source)
        },
        { signal: controller.signal }
      );
      cancelled = controller.signal.aborted;
      if (
        !cancelled &&
        this.wizardRun?.requestId === requestId &&
        this.wizardRun.excerptVersion === this.session.getExcerpt()?.version
      ) {
        await this.adoptWizardResult(result.content, result.requestedResources ?? []);
      } else if (!cancelled) {
        this.outputChannel.appendLine(
          `[WorkshopContextHandler] Context wizard ${requestId} discarded because excerpt v${excerpt.version} is no longer current`
        );
        this.effects.sendStatus(
          'Context wizard result was discarded because the excerpt changed.'
        );
      }
    } catch (error) {
      cancelled = controller.signal.aborted;
      if (!cancelled) {
        const details = error instanceof Error ? error.message : String(error);
        this.effects.reportError('The Context wizard failed.', details);
      }
    } finally {
      if (this.wizardRun?.requestId === requestId) {
        this.wizardRun = undefined;
      }
      const complete: StreamCompleteMessage = {
        type: MessageType.STREAM_COMPLETE,
        source: 'extension.workshop',
        payload: { requestId, domain: 'workshop-context', content: '', cancelled },
        timestamp: Date.now()
      };
      void this.postMessage(complete);
    }
  }

  private async adoptWizardResult(brief: string, requestedResources: string[]): Promise<void> {
    let attached = 0;
    let skipped = 0;
    let failed = 0;

    const briefText = brief.trim();
    if (briefText.length > 0 && !briefText.startsWith(API_KEY_NOT_CONFIGURED_HEADING)) {
      const words = countWords(briefText);
      const result = this.session.addContextAttachment({
        kind: 'text',
        origin: 'wizard',
        label: 'Wizard brief…',
        content: briefText,
        words
      });
      if (result.ok) {
        attached += 1;
        if (result.eventTurn) {
          this.effects.postTurn(result.eventTurn);
        }
      } else {
        skipped += 1;
      }
    }

    if (requestedResources.length > 0) {
      let catalog;
      try {
        catalog = await this.contextIntakeService.openCatalog();
      } catch (error) {
        this.outputChannel.appendLine(
          `[WorkshopContextHandler] Context wizard could not read the configured resource catalog: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        failed += requestedResources.length;
      }
      if (catalog) {
        for (const resourcePath of requestedResources) {
          const summary = catalog
            .entries()
            .find((resource) => resource.path === resourcePath);
          if (!summary) {
            skipped += 1;
            continue;
          }
          const loaded = await catalog.load(
            { group: summary.group, path: summary.path },
            {
              maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
              maxWords: PROMPT_BUDGETS.contextAttachments.words
            }
          );
          if (loaded.kind === 'unreadable') {
            this.outputChannel.appendLine(
              `[WorkshopContextHandler] Context wizard could not read ${summary.path}: ${loaded.details}`
            );
            failed += 1;
            continue;
          }
          if (!this.contextIntakeService.reportConfiguredResourceLoadFailure(
            loaded,
            'attach',
            PROMPT_BUDGETS.contextAttachments.fileBytes,
            this.effects.reportError
          )) {
            skipped += 1;
            continue;
          }
          const { resource } = loaded;
          const result = this.session.addContextAttachment({
            kind: 'file',
            origin: 'wizard',
            label: baseName(summary.path),
            content: resource.text,
            words: resource.words,
            sourceUri: pathToFileURL(summary.absolutePath).toString(),
            relativePath: summary.path,
            configuredResource: { group: summary.group, path: summary.path },
            truncation: resource.truncation
          });
          if (result.ok) {
            attached += 1;
            if (result.eventTurn) {
              this.effects.postTurn(result.eventTurn);
            }
          } else {
            skipped += 1;
          }
        }
      }
    }

    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Wizard finished (${attached} attached, ${skipped} skipped, ${failed} failed)`
    );
    this.effects.sendStatus(
      attached > 0
        ? `Wizard attached ${attached} item${attached === 1 ? '' : 's'}${
            skipped > 0 ? ` · ${skipped} didn’t fit` : ''
          }${failed > 0 ? ` · ${failed} couldn’t be loaded` : ''} — yours to keep or remove.`
        : failed > 0
          ? `Wizard finished — ${failed} requested item${failed === 1 ? '' : 's'} couldn’t be loaded.`
          : 'Wizard finished — nothing new fit the budget.'
    );
    if (attached > 0) {
      this.effects.markDirty('context wizard attachments committed');
    }
    this.effects.postSessionState();
  }

  private applyContextAttachment(input: WorkshopContextAttachmentInput): void {
    const result = this.session.addContextAttachment(input);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        this.effects.reportError(`Already attached: ${input.label}`);
      } else {
        this.effects.reportError(
          `Won’t fit: ${input.label} (${input.words.toLocaleString('en-US')} words) would pass the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context budget.`,
          `${result.remainingWords.toLocaleString('en-US')} words remain — remove an attachment to make room.`
        );
      }
      return;
    }
    if (result.eventTurn) {
      this.effects.postTurn(result.eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Context attached (${result.attachment.kind}, ${result.attachment.label}, ${result.attachment.words} words)`
    );
    this.effects.markDirty('context attachment added');
    this.effects.postSessionState();
  }

  private stageMessageAttachment(input: WorkshopMessageAttachmentInput): void {
    const result = this.session.addMessageAttachment(input);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        this.effects.reportError(`${input.label} is already attached to this message.`);
      } else {
        this.effects.reportError(
          `A message carries at most ${PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage} attachments.`,
          'Send the message, or remove a staged attachment to make room.'
        );
      }
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopContextHandler] Message attachment staged (${result.attachment.id}, ${result.attachment.label}, ${result.attachment.words} words)`
    );
    this.effects.markDirty('message attachment staged');
    this.effects.postSessionState();
  }

  private boundThreadArtifact(
    content: string,
    knownTotalWords?: number
  ): { text: string; words: number; truncation?: { keptWords: number; totalWords: number } } {
    return this.contextIntakeService.boundText(
      content,
      PROMPT_BUDGETS.workshopThreadArtifacts.words,
      knownTotalWords
    );
  }

  private async loadContextFileFromDisk(
    fsPath: string,
    displayPath: string
  ): Promise<
    | {
        text: string;
        words: number;
        truncation?: { keptWords: number; totalWords: number };
      }
    | undefined
  > {
    const result = await this.contextIntakeService.loadFile(
      fsPath,
      displayPath,
      {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.contextAttachments.words
      },
      'attach'
    );
    if (result.kind === 'refused') {
      this.effects.reportError(result.refusal.message, result.refusal.details);
      return undefined;
    }
    if (result.file.truncation) {
      this.outputChannel.appendLine(
        `[WorkshopContextHandler] Context file head-sliced: ${result.file.truncation.keptWords} of ${result.file.truncation.totalWords} words (${displayPath})`
      );
    }
    return {
      text: result.file.text,
      words: result.file.words,
      truncation: result.file.truncation
    };
  }

  private validConfiguredResources(items: unknown): WorkshopConfiguredResourceRef[] {
    return Array.isArray(items)
      ? items.flatMap((item) => {
          const candidate = item as { group?: unknown; path?: unknown };
          return typeof candidate.group === 'string' &&
            isContextPathGroup(candidate.group) &&
            typeof candidate.path === 'string' &&
            candidate.path.trim().length > 0
            ? [{ group: candidate.group, path: candidate.path }]
            : [];
        })
      : [];
  }

}
