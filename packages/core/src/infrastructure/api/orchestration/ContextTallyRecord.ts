/**
 * What a conversation's owner measured of each committed turn's opening
 * message (ADR 2026-11-18 D6): one entry per message, never one per frame.
 *
 * An entry names its message by index in the archived history (the
 * replaceable system prompt excluded), so a cut to a mark's `messageCount`
 * keeps exactly the entries of the messages it keeps. Piece ids are the
 * owner's vocabulary (the Workshop's `WORKSHOP_CONTEXT_TALLY_PIECES`); here
 * they are opaque, bounded keys, so the engine names no feature.
 * Display-safe: ids and token numbers only, never text.
 */

export interface StoredContextTallyEntry {
  /** The opening user message's index in the archived history. */
  messageIndex: number;
  /** Piece id → estimated tokens. */
  pieces: Record<string, number>;
}

export const CONTEXT_TALLY_LIMITS = Object.freeze({
  piecesPerEntry: 32,
  pieceIdCharacters: 64
});

const PIECE_ID = /^[a-z][a-z0-9.-]*$/;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** True for a bounded record of well-formed piece ids and token counts. */
export function isContextTallyPieces(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return entries.length <= CONTEXT_TALLY_LIMITS.piecesPerEntry
    && entries.every(([id, tokens]) =>
      id.length <= CONTEXT_TALLY_LIMITS.pieceIdCharacters && PIECE_ID.test(id) && isCount(tokens));
}

/**
 * Names what is wrong with a stored tally, or returns undefined. Entries
 * must have exactly their two keys, name a message the history holds, and
 * come in strictly increasing message order.
 */
export function contextTallyFault(value: unknown, messageCount: number): string | undefined {
  if (!Array.isArray(value)) {
    return 'not a list';
  }
  let previous = -1;
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index] as Record<string, unknown> | null;
    if (
      typeof entry !== 'object' || entry === null || Array.isArray(entry)
      || Object.keys(entry).length !== 2
      || !isCount(entry.messageIndex)
      || !isContextTallyPieces(entry.pieces)
    ) {
      return `entry ${index} is malformed`;
    }
    if (entry.messageIndex <= previous || entry.messageIndex >= messageCount) {
      return `entry ${index} names message ${entry.messageIndex}`;
    }
    previous = entry.messageIndex;
  }
  return undefined;
}

export function cloneContextTally(entries: readonly StoredContextTallyEntry[]): StoredContextTallyEntry[] {
  return entries.map((entry) => ({ messageIndex: entry.messageIndex, pieces: { ...entry.pieces } }));
}

/** The entries of the messages a cut to `messageCount` keeps (ADR 2026-11-18 D6). */
export function contextTallyWithin(
  entries: readonly StoredContextTallyEntry[],
  messageCount: number
): StoredContextTallyEntry[] {
  return cloneContextTally(entries.filter((entry) => entry.messageIndex < messageCount));
}

/**
 * The tally field of an archive entry cut to `messageCount`, for a spread:
 * absent stays absent, so an entry from before the tally writes as it was.
 * Each entry names its message, so the mark's own count cuts it (D6).
 */
export function archivedContextTallyWithin(
  entry: { readonly contextTally?: readonly StoredContextTallyEntry[] },
  messageCount: number
): { contextTally?: StoredContextTallyEntry[] } {
  return entry.contextTally ? { contextTally: contextTallyWithin(entry.contextTally, messageCount) } : {};
}

/**
 * An archived tally as import keeps it. A display field never degrades its
 * conversation: a bad tally is dropped and logged by its fault (D7).
 */
export function importableContextTally(
  entry: { readonly key: string; readonly messages: readonly unknown[]; readonly contextTally?: unknown },
  log?: { appendLine(line: string): void }
): StoredContextTallyEntry[] | undefined {
  if (entry.contextTally === undefined) return undefined;
  const fault = contextTallyFault(entry.contextTally, entry.messages.length);
  if (fault) {
    log?.appendLine(`[ConversationManager] Context tally of ${entry.key} dropped on import: ${fault}`);
    return undefined;
  }
  return cloneContextTally(entry.contextTally as StoredContextTallyEntry[]);
}

/**
 * What a conversation holds that its owner can account for: the system
 * message it holds now, how many archived messages follow it, and the tally.
 * Host-side only: the system message never leaves the host.
 */
export interface ConversationContextAccount {
  systemMessage: string;
  messageCount: number;
  tally: StoredContextTallyEntry[];
}
