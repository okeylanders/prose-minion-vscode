/** Feature-neutral transaction for one-shot widget config, artifact, and turn. */

import type {
  WorkshopChatTarget
} from '@messages';
import type {
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopOneShotWidgetId,
  WorkshopOneShotWidgetCommitPlan
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';
import type { LogSink } from '@/platform';

export interface WorkshopOneShotWidgetRoomArtifact {
  id: string;
  widgetId: WorkshopOneShotWidgetId;
  widgetConfigId: string;
  label: string;
  content: string;
  selectionCount: number;
}

export type WorkshopOneShotWidgetRoomSend = (
  text: string,
  displayText: string,
  executeOptions: {
    /** The writer's staged composer attachments belong to their unfinished message. */
    includeMessageAttachments: false;
    /** Widget commit copy belongs to the widget sheet, never the room composer. */
    restoreDraftOnRollback: false;
    widgetArtifact: WorkshopOneShotWidgetRoomArtifact;
    /** Records provisional room acceptance; the coordinator reports final acceptance. */
    onRoomAccepted: (userTurnId: string) => void;
  }
) => Promise<{ committed: boolean; refusalReason?: string }>;

export interface WorkshopOneShotWidgetCommitCoordinatorOptions {
  sendRoomMessage: WorkshopOneShotWidgetRoomSend;
  postSessionState: () => void;
  markDirty: (reason: string) => void;
}

export type WorkshopOneShotWidgetCommitOutcome =
  | { status: 'accepted'; widgetConfigId: string; turnId: string }
  | { status: 'not-accepted'; widgetConfigId: string; reason?: string }
  | { status: 'failed'; widgetConfigId?: string };

export class WorkshopOneShotWidgetCommitCoordinator {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopOneShotWidgetCommitCoordinatorOptions
  ) {}

  async commit(
    prepared: WorkshopOneShotWidgetCommitPlan,
    target: WorkshopChatTarget,
    onAccepted: (result: { widgetConfigId: string; turnId: string }) => void
  ): Promise<WorkshopOneShotWidgetCommitOutcome> {
    let acceptedTurnId: string | undefined;
    let widgetConfigId: string | undefined;
    try {
      const config = this.session.createWidgetConfig({
        ...prepared.widgetConfigInput,
        clonedFromConfigId: prepared.clonedFromConfigId
      });
      widgetConfigId = config.id;
      const artifactId = this.session.mintWidgetArtifactId();
      this.outputChannel.appendLine(
        `[WorkshopOneShotWidgetCommitCoordinator] Commit staged ` +
        `(${prepared.widgetId}, ${config.id} → ${artifactId}, ` +
        `${prepared.artifact.selectionCount} selections` +
        `${prepared.clonedFromConfigId ? `, cloned from ${prepared.clonedFromConfigId}` : ''})`
      );
      this.options.markDirty('widget config created');

      const outcome = await this.options.sendRoomMessage(
        prepared.roomText,
        prepared.displayText,
        {
          includeMessageAttachments: false,
          restoreDraftOnRollback: false,
          widgetArtifact: {
            ...prepared.artifact,
            id: artifactId,
            widgetId: prepared.widgetId,
            widgetConfigId: config.id
          },
          onRoomAccepted: (turnId) => {
            this.session.recordWidgetCommit(config.id, { turnId, artifactId });
            this.session.recordWidgetArtifactDelivery(
              artifactId,
              prepared.artifact.label,
              prepared.artifact.content.length,
              target
            );
            acceptedTurnId = turnId;
            this.options.markDirty('widget commit accepted');
            this.options.postSessionState();
            this.outputChannel.appendLine(
              `[WorkshopOneShotWidgetCommitCoordinator] Commit provisionally accepted ` +
              `(${prepared.widgetId}, ${config.id} on turn ${turnId})`
            );
          }
        }
      );

      const acceptedConfig = this.session.getWidgetConfig(config.id);
      if (
        !acceptedTurnId
        || acceptedConfig?.committedTurnId !== acceptedTurnId
        || acceptedConfig.artifactId !== artifactId
      ) {
        return {
          status: 'not-accepted',
          widgetConfigId: config.id,
          ...(outcome.refusalReason ? { reason: outcome.refusalReason } : {})
        };
      }
      onAccepted({ widgetConfigId: config.id, turnId: acceptedTurnId });
      if (!outcome.committed) {
        this.outputChannel.appendLine(
          `[WorkshopOneShotWidgetCommitCoordinator] ${config.id} remained committed ` +
          'after the participant response failed'
        );
      }
      return {
        status: 'accepted',
        widgetConfigId: config.id,
        turnId: acceptedTurnId
      };
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopOneShotWidgetCommitCoordinator] Commit failed ` +
        `(${prepared.widgetId}, ${widgetConfigId ?? 'before-config'}): ${details}`
      );
      if (acceptedTurnId && widgetConfigId) {
        return {
          status: 'accepted',
          widgetConfigId,
          turnId: acceptedTurnId
        };
      }
      return { status: 'failed', widgetConfigId };
    }
  }
}
