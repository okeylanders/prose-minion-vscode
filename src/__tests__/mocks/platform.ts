/**
 * In-memory test doubles for the platform ports (ADR 2026-06-16).
 *
 * Used where a unit under test takes an injected port but the test does not
 * exercise the host integration. Grows as later waves add FileSystem/Workspace/
 * ShellService/EditorContext fakes.
 */
import { SettingsStore } from '@/platform';

/**
 * A SettingsStore that serves `values` (keyed by "key" or "section.key") and
 * returns the caller's default for anything unseeded — mirroring an unset config.
 */
export function createFakeSettings(values: Record<string, unknown> = {}): SettingsStore {
  const get = (<T>(section: string, key: string, defaultValue?: T): T | undefined => {
    if (key in values) {
      return values[key] as T;
    }
    const full = `${section}.${key}`;
    if (full in values) {
      return values[full] as T;
    }
    return defaultValue;
  });
  return {
    get: get as SettingsStore['get'],
    update: async () => undefined,
  };
}
