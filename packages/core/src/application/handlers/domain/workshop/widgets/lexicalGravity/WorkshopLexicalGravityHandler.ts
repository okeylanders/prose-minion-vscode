/** Focused IPC adapter for Lexical Gravity and the standing directive rail. */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
import { WorkshopMutationRouteRegistrar } from '@handlers/domain/WorkshopSessionMessageHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopStandingDirectiveService } from '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
import { LexicalGravityLensRepository } from '@/infrastructure/storage/LexicalGravityLensRepository';
import { LexicalGravityModelService } from '@services/widgets/LexicalGravityModelService';
import {
  builtInLexicalGravityLens,
  builtInLexicalGravityLenses,
  lexicalGravityLensSlug
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  validateLexicalGravityDraft
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopApplyStandingWidgetMessage,
  WorkshopBuildLexicalGravityLensMessage,
  WorkshopLexicalGravityLensCandidate,
  WorkshopLexicalGravityLensCandidatesMessage,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopLexicalGravityLensesSavedMessage,
  WorkshopLexicalGravityPreviewResultMessage,
  WorkshopPreviewLexicalGravityMessage,
  WorkshopRemoveStandingWidgetMessage,
  WorkshopRequestLexicalGravityLensesMessage,
  WorkshopSaveLexicalGravityLensesMessage,
  WorkshopWidgetActionResultMessage
} from '@messages';

export interface WorkshopLexicalGravityHandlerOptions {
  postSessionState: () => void;
  postTurn: (turn: ReturnType<WorkshopSessionService['commitStandingDirectiveMutation']>) => void;
  markDirty: (reason: string) => void;
}

export class WorkshopLexicalGravityHandler {
  private previewRun?: AbortController;
  private buildRun?: AbortController;
  private latestBuild?: {
    token: string;
    query: string;
    candidates: WorkshopLexicalGravityLensCandidate[];
    savedCandidateIds: Set<string>;
  };

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly model: LexicalGravityModelService,
    private readonly repository: LexicalGravityLensRepository,
    private readonly directives: WorkshopStandingDirectiveService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopLexicalGravityHandlerOptions
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    router.register(
      MessageType.WORKSHOP_REQUEST_LEXICAL_GRAVITY_LENSES,
      this.handleRequestLenses.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_PREVIEW_LEXICAL_GRAVITY,
      this.handlePreview.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS,
      this.handleBuild.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_SAVE_LEXICAL_GRAVITY_LENSES,
      this.handleSave.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_APPLY_STANDING_WIDGET,
      this.handleApply.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      this.handleRemove.bind(this)
    );
  }

  dispose(): void {
    this.previewRun?.abort();
    this.buildRun?.abort();
  }

  async handleRequestLenses(
    _message: WorkshopRequestLexicalGravityLensesMessage
  ): Promise<void> {
    const builtIns = builtInLexicalGravityLenses();
    try {
      const projects = await this.repository.list();
      const bySlug = new Map(builtIns.map((lens) => [lens.slug, lens]));
      projects.forEach((lens) => {
        if (!bySlug.has(lens.slug)) {bySlug.set(lens.slug, lens);}
      });
      const message: WorkshopLexicalGravityLensesDataMessage = {
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: {
          lenses: [...bySlug.values()],
          storagePath: this.repository.availability().displayPath
        }
      };
      await this.postMessage(message);
    } catch (error) {
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: { lenses: builtIns, error: this.errorMessage(error) }
      } satisfies WorkshopLexicalGravityLensesDataMessage);
    }
  }

  async handlePreview(message: WorkshopPreviewLexicalGravityMessage): Promise<void> {
    const token = message.payload.token;
    this.previewRun?.abort();
    const controller = new AbortController();
    this.previewRun = controller;
    try {
      const draft = validateLexicalGravityDraft(message.payload.draft);
      const preview = await this.model.preview(
        draft,
        message.payload.sourceText,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) {return;}
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: { token, ok: true, preview }
      } satisfies WorkshopLexicalGravityPreviewResultMessage);
    } catch (error) {
      if (controller.signal.aborted) {return;}
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_PREVIEW_RESULT,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: { token, ok: false, error: this.errorMessage(error) }
      } satisfies WorkshopLexicalGravityPreviewResultMessage);
    } finally {
      if (this.previewRun === controller) {this.previewRun = undefined;}
    }
  }

  async handleBuild(message: WorkshopBuildLexicalGravityLensMessage): Promise<void> {
    const token = message.payload.token;
    const query = message.payload.query.trim();
    this.buildRun?.abort();
    const controller = new AbortController();
    this.buildRun = controller;
    try {
      const slug = lexicalGravityLensSlug(query);
      const existingLens = builtInLexicalGravityLens(slug)
        ?? await this.repository.findForQuery(query);
      if (existingLens) {
        this.latestBuild = undefined;
        await this.postCandidates({ token, query, ok: true, existingLens });
        return;
      }
      const candidates = await this.model.buildLenses(query, { signal: controller.signal });
      if (controller.signal.aborted) {return;}
      this.latestBuild = { token, query, candidates, savedCandidateIds: new Set() };
      await this.postCandidates({ token, query, ok: true, candidates });
    } catch (error) {
      if (controller.signal.aborted) {return;}
      await this.postCandidates({ token, query, ok: false, error: this.errorMessage(error) });
    } finally {
      if (this.buildRun === controller) {this.buildRun = undefined;}
    }
  }

  async handleSave(message: WorkshopSaveLexicalGravityLensesMessage): Promise<void> {
    const { token, query, candidateIds } = message.payload;
    const generated = this.latestBuild;
    try {
      if (
        !generated
        || generated.token !== token
        || generated.query !== query.trim()
        || !Array.isArray(candidateIds)
        || candidateIds.length < 1
        || candidateIds.some((candidateId) => typeof candidateId !== 'string')
      ) {
        throw new Error('Those generated lens choices have expired. Build the lens again.');
      }
      const selectedIds = new Set(candidateIds);
      if (selectedIds.size !== candidateIds.length) {
        throw new Error('Each generated lens may be selected only once.');
      }
      if ([...selectedIds].some((candidateId) => generated.savedCandidateIds.has(candidateId))) {
        throw new Error('One of those generated lenses is already in the project.');
      }
      const trustedCandidates = generated.candidates.filter(
        ({ candidateId }) => selectedIds.has(candidateId)
      );
      if (trustedCandidates.length !== selectedIds.size) {
        throw new Error('Those generated lens choices have expired. Build the lens again.');
      }
      const lenses = await this.repository.saveManyForQuery(
        query,
        trustedCandidates.map(({ lens }) => lens),
        { useCanonicalSlug: generated.savedCandidateIds.size === 0 }
      );
      trustedCandidates.forEach(({ candidateId }) => generated.savedCandidateIds.add(candidateId));
      const remainingCandidateIds = generated.candidates
        .map(({ candidateId }) => candidateId)
        .filter((candidateId) => !generated.savedCandidateIds.has(candidateId));
      if (remainingCandidateIds.length === 0) {this.latestBuild = undefined;}
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: {
          token,
          ok: true,
          lenses,
          candidateIds: trustedCandidates.map(({ candidateId }) => candidateId),
          remainingCandidateIds,
          storagePath: this.repository.availability().displayPath
        }
      } satisfies WorkshopLexicalGravityLensesSavedMessage);
    } catch (error) {
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: { token, ok: false, candidateIds, error: this.errorMessage(error) }
      } satisfies WorkshopLexicalGravityLensesSavedMessage);
    }
  }

  async handleApply(message: WorkshopApplyStandingWidgetMessage): Promise<void> {
    try {
      if (message.payload.widgetId !== 'lexical-gravity') {
        throw new Error('That standing widget is not available yet.');
      }
      const draft = validateLexicalGravityDraft(message.payload.draft);
      const result = await this.directives.apply({
        family: 'lexical-gravity',
        draft,
        widgetConfigId: message.payload.widgetConfigId
      });
      if (result.config.widgetId !== 'lexical-gravity') {
        throw new Error('Lexical Gravity produced the wrong widget configuration');
      }
      this.options.postTurn(result.turn);
      this.options.postSessionState();
      this.options.markDirty(`Lexical Gravity ${result.action}`);
      const frameLength = buildLexicalGravityDirectiveFrame(
        { id: result.directiveId, revision: result.config.revision },
        result.config.draft
      ).length;
      this.outputChannel.appendLine(
        `[WorkshopStandingDirective] lexical-gravity ${result.action}: ${result.directiveId} -> ${result.config.id} (revision ${result.config.revision}, lens ${result.config.draft.lensSlug}, ${frameLength} chars)`
      );
      await this.postAction({
        action: 'apply-standing',
        widgetId: 'lexical-gravity',
        ok: true,
        widgetConfigId: result.config.id,
        directiveId: result.directiveId,
        turnId: result.turn.id
      });
    } catch (error) {
      await this.postAction({
        action: 'apply-standing',
        widgetId: 'lexical-gravity',
        ok: false,
        message: this.errorMessage(error)
      });
    }
  }

  async handleRemove(message: WorkshopRemoveStandingWidgetMessage): Promise<void> {
    try {
      const active = this.session.getStandingDirective(message.payload.family);
      const result = await this.directives.remove(message.payload.family);
      if (result.turn) {this.options.postTurn(result.turn);}
      if (result.removed) {
        this.options.postSessionState();
        this.options.markDirty(`${message.payload.family} removed`);
      }
      this.outputChannel.appendLine(
        `[WorkshopStandingDirective] ${message.payload.family} ${result.removed ? 'removed' : 'remove no-op'}${result.directiveId ? `: ${result.directiveId}` : ''}`
      );
      await this.postAction({
        action: 'remove-standing',
        widgetId: active?.widgetId ?? 'lexical-gravity',
        ok: true,
        removed: result.removed,
        directiveId: result.directiveId,
        turnId: result.turn?.id
      });
    } catch (error) {
      await this.postAction({
        action: 'remove-standing',
        widgetId: 'lexical-gravity',
        ok: false,
        message: this.errorMessage(error)
      });
    }
  }

  private async postCandidates(
    payload: WorkshopLexicalGravityLensCandidatesMessage['payload']
  ): Promise<void> {
    await this.postMessage({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENS_CANDIDATES,
      source: 'extension.workshop.lexical-gravity',
      timestamp: Date.now(),
      payload
    } satisfies WorkshopLexicalGravityLensCandidatesMessage);
  }

  private async postAction(
    payload: WorkshopWidgetActionResultMessage['payload']
  ): Promise<void> {
    await this.postMessage({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: Date.now(),
      payload
    } satisfies WorkshopWidgetActionResultMessage);
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[WorkshopLexicalGravityHandler] ${message}`);
    return message;
  }
}
