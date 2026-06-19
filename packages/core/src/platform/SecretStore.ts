/**
 * SecretStore - platform port for secure credential storage (ADR 2026-06-16).
 *
 * A `vscode`-free interface so the secrets layer can be reused across runtimes
 * (VS Code extension + future desktop app). It is structurally satisfied by
 * `vscode.SecretStorage`, so NO adapter class is needed:
 *   - VS Code adapter  = `context.secrets` passed directly (composition root).
 *   - Desktop adapter  = a `safeStorage`-backed wrapper conforming to this shape.
 */

export interface PlatformDisposable {
  dispose(): unknown;
}

export interface SecretStore {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
  onDidChange(listener: (e: unknown) => unknown): PlatformDisposable;
}
