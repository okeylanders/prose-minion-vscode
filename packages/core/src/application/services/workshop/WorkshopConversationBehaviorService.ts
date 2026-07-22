import { LogSink, SettingsStore } from '@/platform';
import { WorkshopSessionService } from './WorkshopSessionService';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  coerceWorkshopConversationBehavior,
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING,
  WorkshopConversationBehavior,
  WorkshopPersonaId
} from '@messages';

export interface WorkshopConversationBehaviorUpdate {
  changed: boolean;
  deferred: boolean;
  persistenceError?: string;
}

/**
 * Composition-root-owned coordinator for the room's durable behavior setting.
 *
 * Both webview surfaces own a MessageHandler and therefore observe the same VS
 * Code configuration event. Serializing here keeps those duplicate callbacks
 * idempotent, prevents rapid external edits from committing out of order, and
 * preserves the between-run system-message replacement invariant.
 */
export class WorkshopConversationBehaviorService {
  private queue: Promise<void> = Promise.resolve();
  private externalSyncPending = false;

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly assistantToolService: AssistantToolService,
    private readonly settings: SettingsStore,
    private readonly outputChannel: LogSink
  ) {}

  /** Apply a validated webview submission and persist the complete object. */
  applyFromWebview(raw: unknown): Promise<WorkshopConversationBehaviorUpdate> {
    const next = coerceWorkshopConversationBehavior(raw);
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const result = await this.apply(next);
      this.externalSyncPending = false;
      if (!result.changed) {
        return result;
      }
      try {
        await this.settings.update(
          WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section,
          WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key,
          next
        );
        return result;
      } catch (error) {
        return {
          ...result,
          persistenceError: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  /**
   * Pull an edit made through VS Code Settings/settings.json into the live room.
   * An active response keeps its captured behavior; the latest external value
   * is applied once the run settles.
   */
  syncFromSettings(): Promise<WorkshopConversationBehaviorUpdate> {
    return this.serialize(async () => {
      this.externalSyncPending = true;
      if (this.hasActiveRun()) {
        this.outputChannel.appendLine(
          '[WorkshopConversationBehaviorService] External behavior change deferred until the active run settles'
        );
        return { changed: false, deferred: true };
      }
      const result = await this.apply(this.readSetting());
      this.externalSyncPending = false;
      return result;
    });
  }

  /** Apply the latest deferred external value after a Workshop run settles. */
  flushDeferredSettingsSync(): Promise<WorkshopConversationBehaviorUpdate> {
    return this.serialize(async () => {
      if (!this.externalSyncPending) {
        return { changed: false, deferred: false };
      }
      if (this.hasActiveRun()) {
        return { changed: false, deferred: true };
      }
      const result = await this.apply(this.readSetting());
      this.externalSyncPending = false;
      return result;
    });
  }

  private async apply(
    next: WorkshopConversationBehavior
  ): Promise<WorkshopConversationBehaviorUpdate> {
    const previous = this.session.getConversationBehavior();
    if (this.equals(previous, next)) {
      return { changed: false, deferred: false };
    }

    if (
      previous.interactionMode !== next.interactionMode
      || previous.expressionLevel !== next.expressionLevel
    ) {
      await this.assistantToolService.replaceWorkshopConversationBehavior(
        this.replacementTargets(),
        next
      );
    }

    this.session.setConversationBehavior(next);
    this.outputChannel.appendLine(
      `[WorkshopConversationBehaviorService] Conversation behavior committed ` +
      `(mode=${next.interactionMode}, expression=${next.expressionLevel}, ` +
      `react=${next.reactToCurrentMessage}, carry=${next.carryCuesThroughSession})`
    );
    return { changed: true, deferred: false };
  }

  private replacementTargets(): Array<{
    conversationId: string;
    personaId: WorkshopPersonaId;
    role: 'host' | 'guest';
  }> {
    const targets: Array<{
      conversationId: string;
      personaId: WorkshopPersonaId;
      role: 'host' | 'guest';
    }> = [];
    const hostConversationId = this.session.getHostConversationId();
    if (hostConversationId) {
      targets.push({
        conversationId: hostConversationId,
        personaId: this.session.getSelectedPersonaId(),
        role: 'host'
      });
    }
    for (const guest of this.session.getSnapshot().participants.personaGuests) {
      const conversationId = this.session.getPersonaGuestConversationId(guest.personaId);
      if (guest.liveness === 'live' && conversationId) {
        targets.push({ conversationId, personaId: guest.personaId, role: 'guest' });
      }
    }
    return targets;
  }

  private readSetting(): WorkshopConversationBehavior {
    return coerceWorkshopConversationBehavior(
      this.settings.get<unknown>(
        WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section,
        WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key
      )
    );
  }

  private assertBetweenRuns(): void {
    if (this.hasActiveRun()) {
      throw new Error('A Workshop response is still running.');
    }
  }

  private hasActiveRun(): boolean {
    return this.session.getSnapshot().activeRequestId !== undefined;
  }

  private equals(
    left: WorkshopConversationBehavior,
    right: WorkshopConversationBehavior
  ): boolean {
    return left.interactionMode === right.interactionMode
      && left.expressionLevel === right.expressionLevel
      && left.reactToCurrentMessage === right.reactToCurrentMessage
      && left.carryCuesThroughSession === right.carryCuesThroughSession;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
