/**
 * The memory hook's keyed feedback, as pure updates: which cards and
 * receipts wait for the host (a set of keys), and what each one's refusal
 * says (a map by key). `useWorkshopProjectMemory` applies them in its state
 * updaters; nothing here posts or holds state.
 *
 * An update that changes nothing returns the collection it was given, so
 * React keeps the same state and renders nothing new.
 */

/** `keys` with `key` present or absent. */
export function withWorkshopMemoryKey(keys: ReadonlySet<string>, key: string, present: boolean): ReadonlySet<string> {
  if (keys.has(key) === present) {
    return keys;
  }
  const next = new Set(keys);
  if (present) {
    next.add(key);
  } else {
    next.delete(key);
  }
  return next;
}

/** `entries` with `key` set to `value`, or removed when `value` is undefined. */
export function withWorkshopMemoryEntry<V>(
  entries: ReadonlyMap<string, V>,
  key: string,
  value: V | undefined
): ReadonlyMap<string, V> {
  if (value === undefined ? !entries.has(key) : entries.get(key) === value) {
    return entries;
  }
  const next = new Map(entries);
  if (value === undefined) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}
