/** Serialized application use cases for standing prose directives. */

import {
  WorkshopLexicalGravityDraft,
  WorkshopStandingDirectiveFamily,
  WorkshopTurn,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  renderWorkshopStandingDirectiveFrames
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveFrames';

export interface WorkshopStandingDirectiveApplyResult {
  action: 'installed' | 'shifted';
  directiveId: string;
  config: WorkshopWidgetConfigSnapshot;
  turn: WorkshopTurn;
}

export interface WorkshopStandingDirectiveRemoveResult {
  removed: boolean;
  directiveId?: string;
  turn?: WorkshopTurn;
}

export class WorkshopStandingDirectiveService {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly conversationSettings: WorkshopConversationSettingsService
  ) {}

  async applyLexicalGravity(
    draft: WorkshopLexicalGravityDraft,
    widgetConfigId?: string
  ): Promise<WorkshopStandingDirectiveApplyResult> {
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const active = this.session.getStandingDirective('lexical-gravity');
      if (widgetConfigId && active?.widgetConfigId !== widgetConfigId) {
        throw new Error('Lexical Gravity can edit only its currently active configuration.');
      }
      if (!widgetConfigId && active) {
        throw new Error('Lexical Gravity is already active; reopen it to shift the directive.');
      }

      const preparedConfig = widgetConfigId
        ? this.session.prepareWidgetConfigRevision(widgetConfigId, {
            widgetId: 'lexical-gravity',
            draft
          })
        : this.session.prepareWidgetConfigCreation({
            widgetId: 'lexical-gravity',
            draft
          });
      const config = preparedConfig.config;
      const preparedDirective = this.session.prepareStandingDirectiveUpsert({
        family: 'lexical-gravity',
        widgetId: 'lexical-gravity',
        widgetConfigId: config.id,
        revision: config.revision
      });
      const frames = renderWorkshopStandingDirectiveFrames(this.session, {
        directive: preparedDirective.directive,
        config
      });
      await this.conversationSettings.replaceStandingDirectiveFrames(frames);
      const turn = this.session.commitStandingDirectiveMutation(
        preparedDirective,
        preparedConfig
      );
      return {
        action: preparedDirective.action,
        directiveId: preparedDirective.directive.id,
        config: this.session.getWidgetConfig(config.id)!,
        turn
      };
    });
  }

  async remove(
    family: WorkshopStandingDirectiveFamily
  ): Promise<WorkshopStandingDirectiveRemoveResult> {
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const prepared = this.session.prepareStandingDirectiveRemoval(family);
      if (!prepared) {return { removed: false };}
      const frames = renderWorkshopStandingDirectiveFrames(this.session, undefined, family);
      await this.conversationSettings.replaceStandingDirectiveFrames(frames);
      const turn = this.session.commitStandingDirectiveMutation(prepared);
      return { removed: true, directiveId: prepared.directive.id, turn };
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private assertBetweenRuns(): void {
    if (this.session.getSnapshot().activeRequestId !== undefined) {
      throw new Error('A Workshop response is still running.');
    }
  }
}
