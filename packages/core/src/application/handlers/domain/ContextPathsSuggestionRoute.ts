/**
 * The Settings overlay's context-path suggestion (ADR 2026-11-19 D21, D24,
 * D25). Owned by `ConfigurationHandler`, which registers it beside its own
 * routes; split out so that handler gains only the registration.
 *
 * - `CONTEXT_PATHS_SUGGEST { requestId }` → `CONTEXT_PATHS_SUGGESTION`: a
 *   paid helper call, only on the writer's press.
 * - `CONTEXT_PATHS_APPLY { requestId, proposalId, groups }` →
 *   `CONTEXT_PATHS_APPLIED`: ids and ticked groups only, never a pattern.
 * - `CONTEXT_PATHS_STATUS_REQUEST { requestId }` → `CONTEXT_PATHS_STATUS`:
 *   whether every group matches nothing, for the section's one line.
 *
 * Every request names a webview-minted id and every answer echoes it; a
 * request without one is ignored. The service is `CoreServices`'; this route
 * constructs nothing. Logs carry outcomes and counts only.
 */

import {
  CONTEXT_PATH_GROUPS,
  MessageType,
  type ContextPathGroup,
  type ContextPathsAppliedPayload,
  type ContextPathsStatusPayload,
  type ContextPathsSuggestionPayload
} from '@shared/types';
import type { LogSink } from '@/platform';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { ContextPathSuggestions } from '@/application/services/contextPaths/ContextPathSuggestionService';
import type { MessageRouter } from '../MessageRouter';

const LOG = '[ContextPathsSuggestion]';
const SOURCE = 'extension.configuration.contextPaths';
/** The longest request or proposal id read; the webview's and the host's are far shorter. */
const ID_CHARS = 200;

function idOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_CHARS ? value : undefined;
}

function requestIdOf(payload: unknown): string | undefined {
  return idOf((payload as { requestId?: unknown } | undefined)?.requestId);
}

export class ContextPathsSuggestionRoute {
  constructor(
    private readonly suggestions: ContextPathSuggestions,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.CONTEXT_PATHS_SUGGEST, this.handleSuggest.bind(this));
    router.register(MessageType.CONTEXT_PATHS_APPLY, this.handleApply.bind(this));
    router.register(MessageType.CONTEXT_PATHS_STATUS_REQUEST, this.handleStatus.bind(this));
  }

  async handleSuggest(message: { payload?: unknown }): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored a suggestion request with no request id`);
      return;
    }
    let payload: ContextPathsSuggestionPayload;
    try {
      const answer = await this.suggestions.suggest();
      payload = {
        requestId,
        outcome: answer.outcome,
        ...(answer.proposalId ? { proposalId: answer.proposalId } : {}),
        ...(answer.view ? { view: answer.view } : {})
      };
    } catch {
      // The error is not logged: a thrown message could quote a name or a pattern.
      this.outputChannel.appendLine(`${LOG} Suggestion failed`);
      payload = { requestId, outcome: 'failed' };
    }
    void this.postMessage({ type: MessageType.CONTEXT_PATHS_SUGGESTION, source: SOURCE, payload, timestamp: Date.now() });
  }

  async handleApply(message: { payload?: unknown }): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      this.outputChannel.appendLine(`${LOG} Ignored an apply request with no request id`);
      return;
    }
    const request = message.payload as { proposalId?: unknown; groups?: unknown };
    const named = Array.isArray(request.groups) ? (request.groups as unknown[]) : [];
    const groups: ContextPathGroup[] = CONTEXT_PATH_GROUPS.filter((group) => named.includes(group));
    const proposalId = idOf(request.proposalId);
    let payload: ContextPathsAppliedPayload;
    if (!proposalId) {
      this.outputChannel.appendLine(`${LOG} Refused an apply request with no proposal id`);
      payload = { requestId, outcome: 'unknown-proposal', groups: [] };
    } else {
      try {
        const answer = await this.suggestions.apply(proposalId, groups);
        payload = { requestId, outcome: answer.outcome, groups: answer.groups };
      } catch {
        this.outputChannel.appendLine(`${LOG} Apply failed`);
        payload = { requestId, outcome: 'done', groups: groups.map((group) => ({ group, outcome: 'left', reason: 'write-failed' })) };
      }
    }
    void this.postMessage({ type: MessageType.CONTEXT_PATHS_APPLIED, source: SOURCE, payload, timestamp: Date.now() });
  }

  async handleStatus(message: { payload?: unknown }): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (!requestId) {
      return;
    }
    const payload: ContextPathsStatusPayload = { requestId, everyGroupEmpty: await this.suggestions.everyGroupEmpty() };
    void this.postMessage({ type: MessageType.CONTEXT_PATHS_STATUS, source: SOURCE, payload, timestamp: Date.now() });
  }
}
