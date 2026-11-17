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
 */

import type { OpenRouterToolCall } from '@providers/OpenRouterChatContracts';

/** Safety bounds on what one reply may carry; a well-formed reply is nowhere near them. */
export const OPENROUTER_TOOL_CALL_LIMITS = {
  calls: 16,
  nameCharacters: 200,
  argumentCharacters: 200_000
} as const;

const SERVER_TOOL_PREFIX = 'openrouter:';

const record = (value: unknown): Record<string, unknown> | undefined =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined);

const isFunctionCall = (type: unknown, name: string): boolean =>
  (type === undefined || type === null || type === 'function') && name.length > 0 && !name.startsWith(SERVER_TOOL_PREFIX);

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
      const fn = record(fragment.function);
      // The name arrives whole on the first fragment; some providers repeat it, and a repeat is never appended.
      if (!call.name && typeof fn?.name === 'string') {
        call.name = fn.name.slice(0, OPENROUTER_TOOL_CALL_LIMITS.nameCharacters);
      }
      if (typeof fn?.arguments === 'string') {
        // Past the bound the JSON is left cut, so its reader finds it unparseable and never half a call.
        const room = OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters - call.arguments.length;
        if (room > 0) {call.arguments += fn.arguments.slice(0, room);}
      }
    });
  }

  /** The function calls gathered, in index order; nothing when there were none. */
  finish(): OpenRouterToolCall[] | undefined {
    const calls = [...this.pending.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, call]) => call)
      .filter((call) => isFunctionCall(call.type, call.name))
      .map((call): OpenRouterToolCall => ({ ...(call.id ? { id: call.id } : {}), name: call.name, arguments: call.arguments }));
    return calls.length > 0 ? calls : undefined;
  }
}
