/**
 * LogSink - platform port for the logging output destination (ADR 2026-06-16).
 *
 * A `vscode`-free interface = the subset of `vscode.OutputChannel` the codebase
 * actually uses, so the logging layer can be reused across runtimes. It is
 * structurally satisfied by `vscode.OutputChannel`, so NO adapter is needed:
 *   - VS Code adapter  = `vscode.window.createOutputChannel(...)` passed directly
 *     (an OutputChannel structurally satisfies this shape).
 *   - Desktop adapter  = a rotating-log-file sink conforming to this shape.
 */

export interface LogSink {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  clear(): void;
}
