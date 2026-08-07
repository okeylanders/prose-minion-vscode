/** Focused IPC adapter for Lexical Gravity's catalog, preview, build, and save workflow. */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
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
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopBuildLexicalGravityLensMessage,
  WorkshopLexicalGravityLensCandidate,
  WorkshopLexicalGravityLensCandidatesMessage,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopLexicalGravityLensesSavedMessage,
  WorkshopLexicalGravityPreviewResultMessage,
  WorkshopPreviewLexicalGravityMessage,
  WorkshopRequestLexicalGravityLensesMessage,
  WorkshopSaveLexicalGravityLensesMessage
} from '@messages';

export type WorkshopLexicalGravityModelPort = Pick<
  LexicalGravityModelService,
  'buildLenses' | 'preview'
>;

export type WorkshopLexicalGravityRepositoryPort = Pick<
  LexicalGravityLensRepository,
  | 'availability'
  | 'list'
  | 'findForQuery'
  | 'assertIncompatibleResource'
  | 'saveManyForQuery'
  | 'replaceIncompatibleForQuery'
>;

export class WorkshopLexicalGravityHandler {
  private previewRun?: AbortController;
  private buildRun?: AbortController;
  private latestBuild?: {
    token: string;
    query: string;
    candidates: WorkshopLexicalGravityLensCandidate[];
    savedCandidateIds: Set<string>;
    rebuildResourceName?: string;
  };

  constructor(
    private readonly model: WorkshopLexicalGravityModelPort,
    private readonly repository: WorkshopLexicalGravityRepositoryPort,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
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
      projects.lenses.forEach((lens) => {
        if (!bySlug.has(lens.slug)) {bySlug.set(lens.slug, lens);}
      });
      const message: WorkshopLexicalGravityLensesDataMessage = {
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: {
          lenses: [...bySlug.values()],
          incompatibleResources: projects.incompatibleResources,
          storagePath: this.repository.availability().displayPath
        }
      };
      await this.postMessage(message);
    } catch (error) {
      await this.postMessage({
        type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
        source: 'extension.workshop.lexical-gravity',
        timestamp: Date.now(),
        payload: {
          lenses: builtIns,
          incompatibleResources: [],
          error: this.errorMessage(error)
        }
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
    const rebuildResourceName = message.payload.rebuildResourceName?.trim();
    this.buildRun?.abort();
    const controller = new AbortController();
    this.buildRun = controller;
    try {
      if (rebuildResourceName) {
        await this.repository.assertIncompatibleResource(rebuildResourceName);
        const candidates = await this.model.buildLenses(query, { signal: controller.signal });
        if (controller.signal.aborted) {return;}
        this.latestBuild = {
          token,
          query,
          candidates,
          savedCandidateIds: new Set(),
          rebuildResourceName
        };
        await this.postCandidates({ token, query, ok: true, candidates });
        return;
      }
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
      if (generated.rebuildResourceName && trustedCandidates.length !== 1) {
        throw new Error('Choose exactly one generated take to replace the version 1 lens.');
      }
      if (generated.rebuildResourceName) {
        const lens = await this.repository.replaceIncompatibleForQuery(
          generated.rebuildResourceName,
          query,
          trustedCandidates[0].lens
        );
        const replacedResourceName = generated.rebuildResourceName;
        this.latestBuild = undefined;
        await this.postMessage({
          type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_SAVED,
          source: 'extension.workshop.lexical-gravity',
          timestamp: Date.now(),
          payload: {
            token,
            ok: true,
            lenses: [lens],
            candidateIds: [trustedCandidates[0].candidateId],
            remainingCandidateIds: [],
            replacedResourceName,
            storagePath: this.repository.availability().displayPath
          }
        } satisfies WorkshopLexicalGravityLensesSavedMessage);
        return;
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

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[WorkshopLexicalGravityHandler] ${message}`);
    return message;
  }
}
