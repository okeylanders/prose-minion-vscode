import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import type { LogSink, SettingsStore } from '@/platform';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';

describe('WorkshopWriterProfileService', () => {
  it('logs a distinct rejection when persisted profile data is invalid', () => {
    const settings = {
      get: jest.fn(() => ({
        enabled: true,
        preferredAddress: 'Okey',
        bio: 'x'.repeat(1_001)
      })),
      update: jest.fn()
    } as unknown as SettingsStore;
    const log = {
      appendLine: jest.fn()
    } as unknown as jest.Mocked<LogSink>;

    const service = new WorkshopWriterProfileService(settings, log);

    expect(service.getProfile()).toEqual(DEFAULT_WORKSHOP_WRITER_PROFILE);
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Rejected invalid writer profile setting')
    );
  });

  it('does not log a rejection when the setting is simply absent', () => {
    const settings = {
      get: jest.fn(() => undefined),
      update: jest.fn()
    } as unknown as SettingsStore;
    const log = {
      appendLine: jest.fn()
    } as unknown as jest.Mocked<LogSink>;

    const service = new WorkshopWriterProfileService(settings, log);

    expect(service.getProfile()).toEqual(DEFAULT_WORKSHOP_WRITER_PROFILE);
    expect(log.appendLine).not.toHaveBeenCalled();
  });
});
