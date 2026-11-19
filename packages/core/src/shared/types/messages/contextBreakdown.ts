/**
 * A participant's context, part by part (ADR 2026-11-18 D1–D3, D8).
 *
 * The host sends the parts it measured; the webview adds Conversation as
 * the rest of the provider-measured total. Display-safe: part ids, the
 * host's section and piece names, counts and token numbers only. No prompt
 * text, path or frame body ever enters this contract.
 */

/** The measured parts, in the panel's order. Conversation is the remainder, never sent. */
export const CONTEXT_BREAKDOWN_PARTS = [
  'persona',
  'tool-use',
  'memory',
  'todos',
  'room-notes',
  'excerpt-context',
  'requested'
] as const;

export type ContextBreakdownPartId = typeof CONTEXT_BREAKDOWN_PARTS[number];

/** How a number was got: estimated by the host, measured by the provider, or both. */
export type ContextBreakdownMeasure = 'estimate' | 'provider' | 'mixed';

/** One section or piece a part opens to. */
export interface ContextBreakdownPiece {
  /** The host's name for it ("Interaction mode: Balanced"). */
  name: string;
  /** Absent: not measured (D7). */
  tokens?: number;
  /** How many messages carried it, for a piece that can ride several. */
  count?: number;
}

export interface ContextBreakdownPart {
  part: ContextBreakdownPartId;
  /** Absent: not measured, and the panel says so (D7). */
  tokens?: number;
  measure: ContextBreakdownMeasure;
  pieces: ContextBreakdownPiece[];
}

export interface ContextBreakdown {
  /** Exactly one per `CONTEXT_BREAKDOWN_PARTS`, in that order. */
  parts: ContextBreakdownPart[];
  /** The conversation holds messages from before the tally began (D7). */
  untalliedMessages: boolean;
}
