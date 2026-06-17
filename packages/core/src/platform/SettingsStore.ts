/**
 * SettingsStore - platform port for configuration read/write (ADR 2026-06-16).
 *
 * A `vscode`-free interface so the settings layer can be reused across runtimes:
 *   - VS Code adapter  = `VsCodeSettingsStore`, wrapping
 *     `vscode.workspace.getConfiguration` (see `src/platform/vscode/`).
 *   - Desktop adapter  = an app-owned settings store (JSON under Application
 *     Support) conforming to this shape.
 *
 * `section` is a method parameter (Prose Minion reads 'proseMinion'); each `get`
 * reads a FRESH snapshot (the adapter calls `getConfiguration(section)` per
 * call), matching the prior inline semantics. All writes target the
 * global/user level — the only target this app uses — so the adapter hides
 * vscode's `ConfigurationTarget` enum.
 */

export interface SettingsStore {
  get<T>(section: string, key: string): T | undefined;
  get<T>(section: string, key: string, defaultValue: T): T;
  /** Persists at the global/user level (the only target this app writes). */
  update(section: string, key: string, value: unknown): PromiseLike<void>;
}
