/**
 * GlobalStateStore — per-machine key/value persistence for host-owned UI
 * state (ADR 2026-06-16).
 *
 * Used for state such as the Workshop startup-notice dismissal. Deliberately NOT the
 * SettingsStore: values here are not user configuration, must not appear in
 * the Settings UI, and must not ride Settings Sync.
 *
 * Structurally satisfied by `vscode.Memento` (`context.globalState`), so no
 * adapter class exists — the native object is passed directly at the
 * composition root, exactly like `SecretStore`/`context.secrets`.
 */
export interface GlobalStateStore {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): PromiseLike<void>;
}
