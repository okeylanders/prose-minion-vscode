import { LogSink, SettingsStore } from '@/platform';
import { WorkshopSessionService } from './WorkshopSessionService';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { WorkshopWriterProfileService } from './WorkshopWriterProfileService';
import {
  coerceWorkshopConversationBehavior,
  coerceWorkshopWriterProfile,
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING,
  WorkshopConversationBehavior,
  WorkshopPersonaId,
  WorkshopWriterProfile
} from '@messages';

export interface WorkshopConversationBehaviorUpdate {
  changed: boolean;
  deferred: boolean;
  persistenceError?: string;
}

interface WorkshopConversationSettingsApplyResult extends WorkshopConversationBehaviorUpdate {
  behaviorChanged: boolean;
  profileChanged: boolean;
}

/**
 * Composition-root-owned coordinator for the Conversation Settings surface.
 * Behavior remains session-owned while the injected profile service owns the
 * separate global Writer Profile; this class gives their live prompt effects
 * one serialized, guarded commit boundary.
 *
 * Both webview surfaces own a MessageHandler and therefore observe the same VS
 * Code configuration events. Serializing here keeps those duplicate callbacks
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
    private readonly outputChannel: LogSink,
    private readonly writerProfileService: WorkshopWriterProfileService
  ) {}

  /** Apply and persist the modal's complete Behavior + About You submission. */
  applyFromWebview(
    rawBehavior: unknown,
    rawWriterProfile: unknown
  ): Promise<WorkshopConversationBehaviorUpdate> {
    const nextBehavior = coerceWorkshopConversationBehavior(rawBehavior);
    const nextProfile = coerceWorkshopWriterProfile(rawWriterProfile);
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const result = await this.apply(nextBehavior, nextProfile);
      this.externalSyncPending = false;
      if (!result.changed) {
        return this.publicResult(result);
      }

      const persistenceErrors: string[] = [];
      if (result.behaviorChanged) {
        try {
          await this.settings.update(
            WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section,
            WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key,
            nextBehavior
          );
        } catch (error) {
          persistenceErrors.push(`behavior: ${this.errorMessage(error)}`);
        }
      }
      if (result.profileChanged) {
        try {
          await this.writerProfileService.persist(nextProfile);
        } catch (error) {
          persistenceErrors.push(`writer profile: ${this.errorMessage(error)}`);
        }
      }
      return this.publicResult(
        persistenceErrors.length > 0
          ? { ...result, persistenceError: persistenceErrors.join('; ') }
          : result
      );
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
      const result = await this.apply(
        this.readBehaviorSetting(),
        this.writerProfileService.readSetting()
      );
      this.externalSyncPending = false;
      return this.publicResult(result);
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
      const result = await this.apply(
        this.readBehaviorSetting(),
        this.writerProfileService.readSetting()
      );
      this.externalSyncPending = false;
      return this.publicResult(result);
    });
  }

  private async apply(
    nextBehavior: WorkshopConversationBehavior,
    nextProfile: WorkshopWriterProfile
  ): Promise<WorkshopConversationSettingsApplyResult> {
    const previousBehavior = this.session.getConversationBehavior();
    const previousProfile = this.writerProfileService.getProfile();
    const behaviorChanged = !this.behaviorEquals(previousBehavior, nextBehavior);
    const profileChanged = !this.profileEquals(previousProfile, nextProfile);
    if (!behaviorChanged && !profileChanged) {
      return {
        changed: false,
        deferred: false,
        behaviorChanged: false,
        profileChanged: false
      };
    }

    if (
      profileChanged
      || previousBehavior.interactionMode !== nextBehavior.interactionMode
      || previousBehavior.expressionLevel !== nextBehavior.expressionLevel
      || previousBehavior.relationalDepth !== nextBehavior.relationalDepth
    ) {
      await this.assistantToolService.replaceWorkshopConversationSettings(
        this.replacementTargets(),
        nextBehavior,
        nextProfile
      );
    }

    this.session.setConversationBehavior(nextBehavior);
    this.writerProfileService.commit(nextProfile);
    this.outputChannel.appendLine(
      `[WorkshopConversationBehaviorService] Conversation settings committed ` +
      `(mode=${nextBehavior.interactionMode}, expression=${nextBehavior.expressionLevel}, ` +
      `relationalDepth=${nextBehavior.relationalDepth}, carry=${nextBehavior.carryCuesThroughSession}, ` +
      `profileEnabled=${nextProfile.enabled}, profileHasContent=${nextProfile.preferredAddress.length > 0 || nextProfile.bio.length > 0})`
    );
    return { changed: true, deferred: false, behaviorChanged, profileChanged };
  }

  getWriterProfile(): WorkshopWriterProfile {
    return this.writerProfileService.getProfile();
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

  private readBehaviorSetting(): WorkshopConversationBehavior {
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

  private behaviorEquals(
    left: WorkshopConversationBehavior,
    right: WorkshopConversationBehavior
  ): boolean {
    return left.interactionMode === right.interactionMode
      && left.expressionLevel === right.expressionLevel
      && left.relationalDepth === right.relationalDepth
      && left.carryCuesThroughSession === right.carryCuesThroughSession;
  }

  private profileEquals(left: WorkshopWriterProfile, right: WorkshopWriterProfile): boolean {
    return left.enabled === right.enabled
      && left.preferredAddress === right.preferredAddress
      && left.bio === right.bio;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private publicResult(
    result: WorkshopConversationSettingsApplyResult
  ): WorkshopConversationBehaviorUpdate {
    return {
      changed: result.changed,
      deferred: result.deferred,
      ...(result.persistenceError ? { persistenceError: result.persistenceError } : {})
    };
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
