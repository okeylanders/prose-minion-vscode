/**
 * Temporal indicator for Workshop session surfaces (header menu recents and
 * the session browser), matching the approved design's label ladder:
 * "just now" → "Nm ago" → "Nh ago" → "Yesterday · 9:14 PM" → "Mon · Jul 20"
 * (within the last week) → "Jul 9".
 */
export const relativeSessionTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) {
    return 'Unknown time';
  }
  const elapsed = Date.now() - timestamp;
  if (elapsed >= 0 && elapsed < 60_000) {
    return 'just now';
  }
  if (elapsed >= 0 && elapsed < 3_600_000) {
    return `${Math.max(1, Math.floor(elapsed / 60_000))}m ago`;
  }
  if (elapsed >= 0 && elapsed < 86_400_000) {
    return `${Math.max(1, Math.floor(elapsed / 3_600_000))}h ago`;
  }
  const value = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${value.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })}`;
  }
  const monthDay = value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
  if (elapsed >= 0 && elapsed < 7 * 86_400_000) {
    return `${value.toLocaleDateString(undefined, { weekday: 'short' })} · ${monthDay}`;
  }
  return monthDay;
};
