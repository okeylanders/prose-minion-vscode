/**
 * The engine's side of the native tool-call seam. A reply's structured
 * function calls are offered to the capability the run's caller supplied;
 * what comes back is text in that capability's own protocol, or nothing.
 * This module names no capability and no operation, reads no argument, and
 * logs counts and fault kinds only: a call's name and arguments are model
 * text and may quote the writer.
 */

import type { LogSink } from '@/platform';
import type { AgentNativeToolCall, AnyAgentCapability } from '@orchestration/AgentRunContracts';

export interface NativeToolCallAdaptation {
  /** The reply's content with a translated request appended; the content as it was when nothing translated. */
  readonly content: string;
  /** What was appended, for a stream that has already shown the content before it. */
  readonly appended: string;
  /** The reply carried native calls and none became a request: the correction path's cue. */
  readonly untranslated: boolean;
}

/** A translated request stands after any prose the reply held, as a typed call after narration does. */
const joinReplyAndRequest = (content: string, request: string): string =>
  (content.trim() ? '\n\n' : '') + request;

export function adaptNativeToolCalls(
  capability: AnyAgentCapability | undefined,
  content: string,
  calls: readonly AgentNativeToolCall[] | undefined,
  log?: LogSink
): NativeToolCallAdaptation {
  if (!calls || calls.length === 0) {
    return { content, appended: '', untranslated: false };
  }
  const untranslated = (reason: string): NativeToolCallAdaptation => {
    log?.appendLine(`[AgentRunEngine] ${calls.length} native tool call(s) not translated: reason=${reason}.`);
    return { content, appended: '', untranslated: true };
  };
  if (!capability?.translateNativeToolCalls) {
    return untranslated(capability ? 'no-translator' : 'no-capability');
  }
  let translation: ReturnType<NonNullable<AnyAgentCapability['translateNativeToolCalls']>>;
  try {
    translation = capability.translateNativeToolCalls(calls);
  } catch {
    return untranslated('translator-failed');
  }
  if (translation.kind !== 'translated' || !translation.content.trim()) {
    return untranslated(translation.kind === 'translated' ? 'empty-translation' : translation.reason);
  }
  const appended = joinReplyAndRequest(content, translation.content);
  log?.appendLine(
    `[AgentRunEngine] Translated a native tool call into the ${capability.catalog} capability protocol ` +
    `(${calls.length} returned, ${translation.content.length} chars).`
  );
  return { content: content + appended, appended, untranslated: false };
}
