/**
 * The "In context" manifest, split two ways (ADR 2026-11-03 D2 and D3).
 *
 * Writer material is what the writer put in a participant's context. Read-in
 * material is what the participant fetched on its own. The rail's Read in
 * block and the context gauge's popover both read the manifest through
 * `partitionContextSources`, so the two can never disagree about a row.
 * Pure: no React, no transport.
 */

import type { ContextSourceEntry, ContextSourceKind } from '@shared/types';

/** Kinds a participant can fetch on its own. */
const READ_IN_KINDS: ReadonlySet<ContextSourceKind> = new Set<ContextSourceKind>([
  'resource',
  'tool-evidence',
  'dictionary',
  'transcript'
]);

/** A row the writer didn't attach: fetched by the host or a tool, of a fetchable kind. */
export const isReadInSource = (entry: ContextSourceEntry): boolean =>
  entry.origin !== 'writer' && READ_IN_KINDS.has(entry.kind);

export interface PartitionedContextSources<T extends ContextSourceEntry = ContextSourceEntry> {
  writerMaterial: T[];
  /** In delivery order; superseded (`stale`) rows stay. */
  readIn: T[];
}

/** Splits the manifest, keeping each side in the manifest's own order. */
export function partitionContextSources<T extends ContextSourceEntry>(
  entries: readonly T[]
): PartitionedContextSources<T> {
  const writerMaterial: T[] = [];
  const readIn: T[] = [];
  for (const entry of entries) {
    (isReadInSource(entry) ? readIn : writerMaterial).push(entry);
  }
  return { writerMaterial, readIn };
}

/** What opening a read-in row means. Exactly one action per row (ADR D3). */
export type ReadInOpenAction =
  | { kind: 'reader' }
  | { kind: 'jump'; turnId: string }
  | { kind: 'none' };

const unhandledKind = (kind: never): never => {
  throw new Error(`Unhandled context source kind: ${String(kind)}`);
};

/**
 * One case per `ContextSourceKind`, so a new kind does not compile until
 * someone decides what opening it means. A resource opens in the reader (and
 * the reader offers its card); a card-backed row jumps to the card that
 * fetched it. A row stored before cards were recorded has no `turnId`, and
 * opens nothing.
 */
export function readInOpenAction(entry: ContextSourceEntry): ReadInOpenAction {
  switch (entry.kind) {
    case 'resource':
      return entry.configuredResource ? { kind: 'reader' } : { kind: 'none' };
    case 'tool-evidence':
    case 'dictionary':
    case 'transcript':
      return entry.turnId ? { kind: 'jump', turnId: entry.turnId } : { kind: 'none' };
    case 'pin':
    case 'attachment':
    case 'message-attachment':
      // Writer material: it opens from the Context block, not from Read in.
      return { kind: 'none' };
    default:
      return unhandledKind(entry.kind);
  }
}

/**
 * A row's identity for the Material badge's seen-set: what the manifest gives
 * it. `stale` is deliberately not part of it, so a row being superseded is
 * never "new".
 */
export const readInRowIdentity = (entry: ContextSourceEntry): string =>
  [entry.kind, entry.origin, entry.label, String(entry.deliveredAt)].join('\u0000');

/** "3:14 PM": the delivery time a row and the reader show. */
export const formatReadInTime = (deliveredAt: number): string =>
  new Date(deliveredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
