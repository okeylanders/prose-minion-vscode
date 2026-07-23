import { LogSink, SettingsStore } from '@/platform';
import { WorkshopSessionService } from './WorkshopSessionService';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { WorkshopWriterProfileService } from './WorkshopWriterProfileService';
import {
  coerceWorkshopConversationBehavior,
  coerceWorkshopWriterProfile,
  workshopConversationBehaviorsEqual,
  workshopWriterProfilePromptsEqual,
  workshopWriterProfilesEqual,
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING,
  WorkshopConversationBehavior,
  WorkshopPersonaId,
  WorkshopWriterProfile
} from '@messages';

export interface WorkshopConversationSettingsPersistenceErrors {
  behavior?: string;
  writerProfile?: string;
}

export interface WorkshopConversationSettingsUpdate {
  changed: boolean;
  deferred: boolean;
  persistenceErrors?: WorkshopConversationSettingsPersistenceErrors;
}

interface WorkshopConversationSettingsApplyResult extends WorkshopConversationSettingsUpdate {
  behaviorChanged: boolean;
  profileChanged: boolean;
}

interface PendingPersistence<T> {
  storedValue: T;
  appliedValue: T;
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
export class WorkshopConversationSettingsService {
  private queue: Promise<void> = Promise.resolve();
  private externalSyncPending = false;
  private pendingBehaviorPersistence?: PendingPersistence<WorkshopConversationBehavior>;
  private pendingProfilePersistence?: PendingPersistence<WorkshopWriterProfile>;

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
  ): Promise<WorkshopConversationSettingsUpdate> {
    const nextBehavior = coerceWorkshopConversationBehavior(rawBehavior);
    const nextProfile = coerceWorkshopWriterProfile(rawWriterProfile);
    return this.serialize(async () => {
      this.assertBetweenRuns();
      const result = await this.apply(nextBehavior, nextProfile);
      this.externalSyncPending = false;
      const pendingBehavior = this.pendingBehaviorPersistence;
      const pendingProfile = this.pendingProfilePersistence;
      const persistBehavior = result.behaviorChanged
        || (pendingBehavior !== undefined
          && workshopConversationBehaviorsEqual(pendingBehavior.appliedValue, nextBehavior));
      const persistProfile = result.profileChanged
        || (pendingProfile !== undefined
          && workshopWriterProfilesEqual(pendingProfile.appliedValue, nextProfile));
      if (!persistBehavior && !persistProfile) {
        return this.publicResult(result);
      }

      const persistenceErrors: WorkshopConversationSettingsPersistenceErrors = {};
      if (persistBehavior) {
        try {
          await this.settings.update(
            WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section,
            WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key,
            nextBehavior
          );
          this.pendingBehaviorPersistence = undefined;
        } catch (error) {
          persistenceErrors.behavior = this.errorMessage(error);
          this.pendingBehaviorPersistence = {
            storedValue: this.readBehaviorSetting(),
            appliedValue: { ...nextBehavior }
          };
        }
      }
      if (persistProfile) {
        try {
          await this.writerProfileService.persist(nextProfile);
          this.pendingProfilePersistence = undefined;
        } catch (error) {
          persistenceErrors.writerProfile = this.errorMessage(error);
          this.pendingProfilePersistence = {
            storedValue: this.writerProfileService.readSetting(),
            appliedValue: { ...nextProfile }
          };
        }
      }
      return this.publicResult(
        Object.keys(persistenceErrors).length > 0
          ? { ...result, persistenceErrors }
          : result
      );
    });
  }

  /**
   * Pull an edit made through VS Code Settings/settings.json into the live room.
   * An active response keeps its captured behavior; the latest external value
   * is applied once the run settles.
   */
  syncFromSettings(): Promise<WorkshopConversationSettingsUpdate> {
    return this.serialize(async () => {
      this.externalSyncPending = true;
      if (this.hasActiveRun()) {
        this.outputChannel.appendLine(
          '[WorkshopConversationSettingsService] External settings change deferred until the active run settles'
        );
        return { changed: false, deferred: true };
      }
      const result = await this.apply(
        this.resolveBehaviorSetting(this.readBehaviorSetting()),
        this.resolveProfileSetting(this.writerProfileService.readSetting())
      );
      this.externalSyncPending = false;
      return this.publicResult(result);
    });
  }

  /** Apply the latest deferred external value after a Workshop run settles. */
  flushDeferredSettingsSync(): Promise<WorkshopConversationSettingsUpdate> {
    return this.serialize(async () => {
      if (!this.externalSyncPending) {
        return { changed: false, deferred: false };
      }
      if (this.hasActiveRun()) {
        return { changed: false, deferred: true };
      }
      const result = await this.apply(
        this.resolveBehaviorSetting(this.readBehaviorSetting()),
        this.resolveProfileSetting(this.writerProfileService.readSetting())
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
    const behaviorChanged = !workshopConversationBehaviorsEqual(previousBehavior, nextBehavior);
    const profileChanged = !workshopWriterProfilesEqual(previousProfile, nextProfile);
    if (!behaviorChanged && !profileChanged) {
      return {
        changed: false,
        deferred: false,
        behaviorChanged: false,
        profileChanged: false
      };
    }

    if (
      !workshopWriterProfilePromptsEqual(previousProfile, nextProfile)
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
      `[WorkshopConversationSettingsService] Conversation settings committed ` +
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

  private resolveBehaviorSetting(
    storedValue: WorkshopConversationBehavior
  ): WorkshopConversationBehavior {
    const pending = this.pendingBehaviorPersistence;
    if (!pending) {
      return storedValue;
    }
    if (workshopConversationBehaviorsEqual(storedValue, pending.storedValue)) {
      return { ...pending.appliedValue };
    }
    this.pendingBehaviorPersistence = undefined;
    return storedValue;
  }

  private resolveProfileSetting(storedValue: WorkshopWriterProfile): WorkshopWriterProfile {
    const pending = this.pendingProfilePersistence;
    if (!pending) {
      return storedValue;
    }
    if (workshopWriterProfilesEqual(storedValue, pending.storedValue)) {
      return { ...pending.appliedValue };
    }
    this.pendingProfilePersistence = undefined;
    return storedValue;
  }

  private assertBetweenRuns(): void {
    if (this.hasActiveRun()) {
      throw new Error('A Workshop response is still running.');
    }
  }

  private hasActiveRun(): boolean {
    return this.session.getSnapshot().activeRequestId !== undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private publicResult(
    result: WorkshopConversationSettingsApplyResult
  ): WorkshopConversationSettingsUpdate {
    return {
      changed: result.changed,
      deferred: result.deferred,
      ...(result.persistenceErrors ? { persistenceErrors: result.persistenceErrors } : {})
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
