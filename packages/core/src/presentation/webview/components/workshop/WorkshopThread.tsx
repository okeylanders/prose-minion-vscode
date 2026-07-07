/**
 * WorkshopThread — the accumulated turn history, memoized as a render
 * boundary (PR #67 review #6/#11 consensus, Tim + Parker).
 *
 * WorkshopApp re-renders on every STREAM_CHUNK; without this seam each token
 * re-walked the full `turns.map(...)`. The `turns` array's identity only
 * changes when a turn lands or a snapshot reconciles, so React.memo makes
 * the whole history skip token-clock renders — only the live bubble (kept in
 * the parent) subscribes to per-chunk state.
 */

import * as React from 'react';
import { WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from './WorkshopTurnBubble';

interface WorkshopThreadProps {
  turns: readonly WorkshopTurn[];
}

export const WorkshopThread: React.FC<WorkshopThreadProps> = React.memo(({ turns }) => (
  <>
    {turns.map((turn) => (
      <WorkshopTurnBubble key={turn.id} turn={turn} />
    ))}
  </>
));

WorkshopThread.displayName = 'WorkshopThread';
