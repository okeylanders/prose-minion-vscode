/** Serialized application use cases for standing prose directives. */

import {
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSnapshot,
  WorkshopTurn,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  renderWorkshopStandingDirectiveFramesForSnapshots
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveFrames';
import {
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  WorkshopStandingDirectiveApplyRequest,
  WorkshopStandingDirectiveOperations
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';

export type { WorkshopStandingDirectiveApplyRequest } from
  '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';

export interface WorkshopStandingDirectiveApplyResult {
  action: 'installed' | 'shifted';
  directiveId: string;
  directive: WorkshopStandingDirectiveSnapshot;
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
    private readonly conversationSettings: WorkshopConversationSettingsService,
    private readonly operations: WorkshopStandingDirectiveOperations =
      WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
  ) {}

  async apply(
    request: WorkshopStandingDirectiveApplyRequest
  ): Promise<WorkshopStandingDirectiveApplyResult> {
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const {
        family,
        widgetId,
        widgetConfigInput,
        widgetConfigId,
        editConflictMessage,
        alreadyActiveMessage
      } = request;
      if (this.operations.widgetIdForFamily(family) !== widgetId) {
        throw new Error(`Standing directive family ${family} does not own ${widgetId}`);
      }
      if (widgetConfigInput.widgetId !== widgetId) {
        throw new Error(`Standing directive ${family} received config for ${widgetConfigInput.widgetId}`);
      }
      const active = this.session.getStandingDirective(family);
      if (widgetConfigId && active?.widgetConfigId !== widgetConfigId) {
        throw new Error(editConflictMessage);
      }
      if (!widgetConfigId && active) {
        throw new Error(alreadyActiveMessage);
      }

      const preparedConfig = widgetConfigId
        ? this.session.prepareWidgetConfigRevision(widgetConfigId, widgetConfigInput)
        : this.session.prepareWidgetConfigCreation(widgetConfigInput);
      const config = preparedConfig.config;
      const preparedDirective = this.session.prepareStandingDirectiveUpsert({
        family,
        widgetId,
        widgetConfigId: config.id,
        revision: config.revision
      });
      const frames = renderWorkshopStandingDirectiveFramesForSnapshots(
        preparedDirective.state.directives,
        (configId) => configId === config.id
          ? config
          : this.session.getWidgetConfig(configId),
        this.operations
      );
      await this.conversationSettings.replaceStandingDirectiveFrames(frames);
      const turn = this.session.commitStandingDirectiveMutation(
        preparedDirective,
        preparedConfig
      );
      return {
        action: preparedDirective.action,
        directiveId: preparedDirective.directive.id,
        directive: preparedDirective.directive,
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
      const frames = renderWorkshopStandingDirectiveFramesForSnapshots(
        prepared.state.directives,
        (configId) => this.session.getWidgetConfig(configId),
        this.operations
      );
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
