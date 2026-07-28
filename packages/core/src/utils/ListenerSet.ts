/**
 * ListenerSet — the one shared multicast primitive (PR #67 review, Marcus +
 * Parker consensus).
 *
 * Two webview surfaces (sidebar + Workshop) share the composition root's
 * services, so service → webview signals fan out to per-webview listeners.
 * The dispatch contract is subtle enough that it must not be re-typed per
 * service (it used to exist five slightly-different times):
 *
 * - `add` returns an unsubscribe closure; each MessageHandler owns exactly
 *   its registrations and releases them on dispose — one surface's teardown
 *   can never blind the other.
 * - `emit` iterates a SNAPSHOT (listeners may unsubscribe mid-dispatch) and
 *   isolates each call in try/catch: one webview's throwing listener is
 *   logged and contained, the rest keep receiving.
 *
 * Deliberately vscode-free and dependency-free (LogSink is a structural
 * port), so infrastructure services and future app shells share one address
 * for this knowledge.
 */

import { LogSink } from '@/platform';

export type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

export class ListenerSet<TArgs extends unknown[]> {
  private readonly listeners = new Set<Listener<TArgs>>();

  /**
   * @param logLabel prefix for the contained-failure log line, e.g.
   *                 `[AIResourceManager] Token usage listener`
   * @param log      optional sink; without it failures are still contained,
   *                 just not recorded
   */
  constructor(
    private readonly logLabel: string,
    private readonly log?: LogSink
  ) {}

  /** Subscribe. Returns the unsubscribe closure the caller MUST own. */
  add(listener: Listener<TArgs>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Fan out to every listener; a throwing listener is logged and skipped. */
  emit(...args: TArgs): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(...args);
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        this.log?.appendLine(`${this.logLabel} threw: ${details}`);
      }
    }
  }

  /** Drop every registration (composition-root teardown only). */
  clear(): void {
    this.listeners.clear();
  }

  get size(): number {
    return this.listeners.size;
  }
}
