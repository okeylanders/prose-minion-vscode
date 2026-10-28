/**
 * Deactivation: what the extension quiesces, then waits for, before VS Code
 * may end the extension host. `deactivate` hands its parts here, so the
 * order is tested over real handlers and a real store (PR #183 F-03).
 *
 * 1. Each tab's producers stop first. Disposing the Workshop's panel aborts
 *    or abandons its in-flight run, so the session coordinator's active-run
 *    guard cannot defer an earlier committed dirty revision past shutdown.
 *    Disposing the Lightbox's panel stops the runs its tab started, and each
 *    that landed readings queues its board's save then (ADR 2026-10-19 D12
 *    addendum).
 * 2. Then what both owe is awaited, in the promise `deactivate` returns:
 *    VS Code awaits it, but disposes the context's subscriptions without
 *    awaiting them, so an async dispose would not hold the host. The
 *    Lightbox's drain is awaited even when the Workshop's flush fails.
 *
 * This module never imports `vscode`.
 */

export interface ExtensionShutdownParts {
  readonly workshopPanel: { dispose(): void } | undefined;
  readonly lightboxPanel: { dispose(): void } | undefined;
  readonly workshopSessions: { flush(): Promise<void> } | undefined;
  readonly lightboxBoards: { drain(): Promise<void> } | undefined;
}

export async function shutDownExtension(parts: ExtensionShutdownParts): Promise<void> {
  parts.workshopPanel?.dispose();
  // Also a context subscription; disposing twice is a no-op.
  parts.lightboxPanel?.dispose();
  const lightboxDrained = parts.lightboxBoards?.drain();
  try {
    await parts.workshopSessions?.flush();
  } finally {
    await lightboxDrained;
  }
}
