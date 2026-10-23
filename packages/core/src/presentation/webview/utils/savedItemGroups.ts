/**
 * Groups for the shared saved-item browser (Lightbox Slice 5A.2): the
 * Workshop's sessions and the Lightbox's boards are grouped by date the same
 * way. Moved verbatim from `WorkshopSessionBrowserModal` (its `dateBucket`),
 * so the Workshop's buckets are unchanged: Today, This week (within seven
 * days), Earlier, and Unknown date for a timestamp that is not a number.
 * Pure; the clock is the caller's, `new Date()` by default.
 */

/** One group of a browser's items, in the order the browser shows them. */
export interface SavedItemGroup<T> {
  key: string;
  label: string;
  items: T[];
}

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** The date bucket a timestamp falls in, and where the bucket stands among the others. */
export function savedItemDateBucket(timestamp: number, now: Date = new Date()): { key: string; label: string; order: number } {
  if (!Number.isFinite(timestamp)) {
    return { key: 'unknown', label: 'Unknown date', order: 3 };
  }
  const ageDays = Math.floor(
    (startOfDay(now) - startOfDay(new Date(timestamp))) / 86_400_000
  );
  if (ageDays <= 0) {
    return { key: 'today', label: 'Today', order: 0 };
  }
  if (ageDays <= 7) {
    return { key: 'week', label: 'This week', order: 1 };
  }
  return { key: 'earlier', label: 'Earlier', order: 2 };
}

/**
 * Items grouped by a key each names, the groups ordered by `order` (and,
 * among equals, by first appearance); items keep their order within a group.
 */
export function groupSavedItems<T>(
  items: readonly T[],
  groupOf: (item: T, index: number) => { key: string; label: string; order: number }
): Array<SavedItemGroup<T>> {
  const groups = new Map<string, SavedItemGroup<T> & { order: number }>();
  items.forEach((item, index) => {
    const grouping = groupOf(item, index);
    const group = groups.get(grouping.key) ?? { key: grouping.key, label: grouping.label, order: grouping.order, items: [] };
    group.items.push(item);
    groups.set(grouping.key, group);
  });
  return [...groups.values()]
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, items: grouped }) => ({ key, label, items: grouped }));
}

/** Items by the date bucket of each one's timestamp: Today, This week, Earlier. */
export function groupSavedItemsByDate<T>(items: readonly T[], timestampOf: (item: T) => number, now: Date = new Date()): Array<SavedItemGroup<T>> {
  return groupSavedItems(items, (item) => savedItemDateBucket(timestampOf(item), now));
}
