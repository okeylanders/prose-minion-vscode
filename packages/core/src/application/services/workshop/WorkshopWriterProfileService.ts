import { SettingsStore } from '@/platform';
import {
  coerceWorkshopWriterProfile,
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

  constructor(private readonly settings: SettingsStore) {
    this.current = this.readSetting();
  }

  getProfile(): WorkshopWriterProfile {
    return { ...this.current };
  }

  readSetting(): WorkshopWriterProfile {
    return coerceWorkshopWriterProfile(
      this.settings.get<unknown>(
        WORKSHOP_WRITER_PROFILE_SETTING.section,
        WORKSHOP_WRITER_PROFILE_SETTING.key
      )
    );
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
