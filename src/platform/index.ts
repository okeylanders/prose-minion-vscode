/**
 * Platform ports barrel (ADR 2026-06-16).
 *
 * `vscode`-free interfaces that decouple core logic from the host runtime.
 * Their VS Code adapters live in `src/platform/vscode/` (which DO import vscode).
 * Structurally-satisfied ports (SecretStore, LogSink) need no adapter — the
 * native vscode object is passed directly at the composition root.
 */
export * from './EditorContext';
export * from './FileSystem';
export * from './LogSink';
export * from './SecretStore';
export * from './SettingsStore';
export * from './ShellService';
export * from './Workspace';
