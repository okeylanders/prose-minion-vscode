/**
 * Function calls as OpenRouter's OpenAI-compatible wire carries them: whole
 * on `message.tool_calls`, or in a stream as `delta.tool_calls` fragments
 * that name a call index, with the id and name on the first fragment and
 * the argument JSON arriving in pieces.
 *
 * Only function calls are read. OpenRouter runs its own server tools (web
 * search) itself and reports them as annotations, so anything it names
 * (`openrouter:…`) or types as something other than a function is left
 * out. Nothing here parses arguments or decides what a call means.
 *
 * A call is kept whole or marked, never mended (PR #267 F-01). A name or
 * arguments that are present but not text, or that pass the bounds below,
 * mark the call with a `fault` and empty its arguments: a cut or ignored
 * payload could otherwise read as a different, valid request. A fault holds
 * for the whole call, whatever fragments came before or come after.
 */

import type { OpenRouterToolCall, OpenRouterToolCallFault } from '@providers/OpenRouterChatContracts';

/** Safety bounds on what one reply may carry; a well-formed reply is nowhere near them. */
export const OPENROUTER_TOOL_CALL_LIMITS = {
  calls: 16,
  nameCharacters: 200,
  argumentCharacters: 200_000
} as const;

const SERVER_TOOL_PREFIX = 'openrouter:';

const record = (value: unknown): Record<string, unknown> | undefined =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);

/** Absent on the wire: a later fragment, or a call with no arguments, carries none. */
const absent = (value: unknown): boolean => value === undefined || value === null;

const isFunctionCall = (call: PendingCall): boolean =>
  (absent(call.type) || call.type === 'function') &&
  (call.name.length > 0 || call.fault !== undefined) &&
  !call.name.startsWith(SERVER_TOOL_PREFIX);

/** `message.tool_calls` of a whole reply: its function calls in order, or nothing. */
export function readOpenRouterToolCalls(raw: unknown): OpenRouterToolCall[] | undefined {
  if (!Array.isArray(raw)) {return undefined;}
  const assembler = new OpenRouterToolCallAssembler();
  assembler.add(raw.map((entry, index) => ({ ...(record(entry) ?? {}), index })));
  return assembler.finish();
}

interface PendingCall {
  id?: string;
  type?: unknown;
  name: string;
  arguments: string;
  fault?: OpenRouterToolCallFault;
}

/** Stitches a stream's `delta.tool_calls` fragments together, per call index. */
export class OpenRouterToolCallAssembler {
  private readonly pending = new Map<number, PendingCall>();

  add(rawFragments: unknown): void {
    if (!Array.isArray(rawFragments)) {return;}
    rawFragments.forEach((rawFragment, position) => {
      const fragment = record(rawFragment);
      if (!fragment) {return;}
      const index = typeof fragment.index === 'number' && Number.isSafeInteger(fragment.index) && fragment.index >= 0
        ? fragment.index
        : position;
      let call = this.pending.get(index);
      if (!call) {
        if (this.pending.size >= OPENROUTER_TOOL_CALL_LIMITS.calls) {return;}
        call = { name: '', arguments: '' };
        this.pending.set(index, call);
      }
      if (!call.id && typeof fragment.id === 'string' && fragment.id) {call.id = fragment.id;}
      if (call.type === undefined && fragment.type !== undefined) {call.type = fragment.type;}
      // The first fault stands: a later sound fragment never clears it.
      const mark = (fault: OpenRouterToolCallFault): void => {
        call.fault ??= fault;
      };
      const fn = record(fragment.function);
      if (!fn) {
        if (!absent(fragment.function)) {
          mark('malformed');
        }
        return;
      }
      if (typeof fn.name === 'string') {
        // The name arrives whole on the first fragment; some providers repeat it, and a repeat is never appended.
        if (!call.name) {
          if (fn.name.length > OPENROUTER_TOOL_CALL_LIMITS.nameCharacters) {
            mark('oversized');
          } else {
            call.name = fn.name;
          }
        }
      } else if (!absent(fn.name)) {
        mark('malformed');
      }
      if (typeof fn.arguments === 'string') {
        if (call.arguments.length + fn.arguments.length > OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters) {
          mark('oversized');
        } else {
          call.arguments += fn.arguments;
        }
      } else if (!absent(fn.arguments)) {
        // Arguments sent as an object, a number or a list are not the wire's JSON text.
        mark('malformed');
      }
    });
  }

  /** The function calls gathered, in index order; nothing when there were none. */
  finish(): OpenRouterToolCall[] | undefined {
    const calls = [...this.pending.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, call]) => call)
      .filter(isFunctionCall)
      .map((call): OpenRouterToolCall => ({
        ...(call.id ? { id: call.id } : {}),
        name: call.name,
        // A faulted call carries no arguments at all, never the part that arrived.
        arguments: call.fault ? '' : call.arguments,
        ...(call.fault ? { fault: call.fault } : {})
      }));
    return calls.length > 0 ? calls : undefined;
  }
}
