import { LogSink, SettingsStore } from '@/platform';
import {
  coerceWorkshopWriterProfile,
  isValidWorkshopWriterProfile,
  workshopWriterProfilesEqual,
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
  /** A live preference whose disk write is pending or failed, shared by every room. */
  private pending?: { stored: WorkshopWriterProfile; applied: WorkshopWriterProfile };

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
    const stored = this.readSetting();
    if (!workshopWriterProfilesEqual(stored, profile)) {
      this.pending = { stored, applied: this.current };
    } else {
      this.pending = undefined;
    }
  }

  needsPersistence(profile: WorkshopWriterProfile): boolean {
    return this.pending !== undefined && workshopWriterProfilesEqual(this.pending.applied, profile);
  }

  effectiveSetting(): WorkshopWriterProfile {
    const stored = this.readSetting();
    if (this.pending && workshopWriterProfilesEqual(this.pending.stored, stored)) {
      return { ...this.pending.applied };
    }
    this.pending = undefined;
    return stored;
  }

  async persist(profile: WorkshopWriterProfile): Promise<void> {
    const write = { stored: this.readSetting(), applied: { ...profile } };
    this.pending = write;
    await this.settings.update(
      WORKSHOP_WRITER_PROFILE_SETTING.section,
      WORKSHOP_WRITER_PROFILE_SETTING.key,
      profile
    );
    if (this.pending === write) {
      this.pending = undefined;
    }
  }
}
