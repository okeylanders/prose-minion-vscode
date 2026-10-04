import * as React from 'react';
import { Icon } from '@components/shared/Icon';

interface WorkshopCacheIndicatorProps {
  estimatedExpiresAt?: number;
  recipientLabel: string;
}

/** Quiet wall-clock estimate, scoped by the host to the current recipient. */
export const WorkshopCacheIndicator: React.FC<WorkshopCacheIndicatorProps> = ({
  estimatedExpiresAt,
  recipientLabel
}) => {
  const [now, setNow] = React.useState(Date.now);
  const syncCacheClock = React.useCallback(() => {
    setNow(Date.now());
    if (estimatedExpiresAt === undefined || !Number.isFinite(estimatedExpiresAt)) {
      return undefined;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= estimatedExpiresAt) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [estimatedExpiresAt]);
  React.useEffect(syncCacheClock, [syncCacheClock]);

  if (estimatedExpiresAt === undefined || !Number.isFinite(estimatedExpiresAt)) {
    return null;
  }
  const remainingMs = Math.max(0, estimatedExpiresAt - now);
  const remaining = remainingMs === 0 ? 'window elapsed'
    : remainingMs < 60_000 ? '<1 min' : `${Math.ceil(remainingMs / 60_000)} min`;
  return (
    <span
      className={`pm-ws-comp-cache${remainingMs === 0 ? ' pm-ws-comp-cache-expired' : ''}`}
      title={`${recipientLabel}'s estimated cache window, based on the latest confirmed cache activity. Timed conservatively from request start. OpenRouter does not report an expiry; matching content, model, and provider are still required for a hit.`}
    >
      <Icon name="clock" size={12} />
      Est. Cache Time Remaining: {remaining}
    </span>
  );
};
