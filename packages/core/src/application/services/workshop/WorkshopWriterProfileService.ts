import { LogSink, SettingsStore } from '@/platform';
import {
  coerceWorkshopWriterProfile,
  isValidWorkshopWriterProfile,
  WORKSHOP_WRITER_PROFILE_SETTING,
  WorkshopWriterProfile
} from '@messages';

/**
 * Owns the writer's global, explicit Workshop profile. It is intentionally
 * separate from WorkshopSessionService so raw biography never becomes session
 * state or future workspace-session serialization by accident.
 */
export class WorkshopWriterProfileService {
  private current: WorkshopWriterProfile;

  constructor(
    private readonly settings: SettingsStore,
    private readonly outputChannel: LogSink
  ) {
    this.current = this.readSetting();
  }

  getProfile(): WorkshopWriterProfile {
    return { ...this.current };
  }

  readSetting(): WorkshopWriterProfile {
    const raw = this.settings.get<unknown>(
      WORKSHOP_WRITER_PROFILE_SETTING.section,
      WORKSHOP_WRITER_PROFILE_SETTING.key
    );
    if (raw !== undefined && !isValidWorkshopWriterProfile(raw)) {
      this.outputChannel.appendLine(
        '[WorkshopWriterProfileService] Rejected invalid writer profile setting; using the disabled default'
      );
    }
    return coerceWorkshopWriterProfile(raw);
  }

  commit(profile: WorkshopWriterProfile): void {
    this.current = { ...profile };
  }

  persist(profile: WorkshopWriterProfile): PromiseLike<void> {
    return this.settings.update(
      WORKSHOP_WRITER_PROFILE_SETTING.section,
      WORKSHOP_WRITER_PROFILE_SETTING.key,
      profile
    );
  }
}
