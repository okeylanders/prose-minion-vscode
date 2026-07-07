/**
 * WorkshopTurnBubble — one completed entry in the Workshop thread
 * (PR #67 review #6: extracted from WorkshopApp's renderTurn).
 *
 * User turns render as a compact request chip; assistant turns as a card
 * with the tool eyebrow, usage footer, optional truncation notice, and the
 * markdown body. Memoized: turns are immutable once appended, so a bubble
 * never needs to re-render after it first paints — only the live streaming
 * bubble rides the token clock.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { WorkshopTurn } from '@messages';
import { workshopToolIcon } from './workshopToolIcons';

interface WorkshopTurnBubbleProps {
  turn: WorkshopTurn;
}

export const WorkshopTurnBubble: React.FC<WorkshopTurnBubbleProps> = React.memo(({ turn }) => {
  if (turn.role === 'user') {
    return (
      <div className="pm-ws-turn pm-ws-turn-user">
        <span className="pm-ws-turn-chip">
          <Icon name={workshopToolIcon(turn.toolId)} size={13} /> {turn.toolLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="pm-ws-turn pm-ws-turn-assistant">
      <div className="pm-ws-turn-head">
        <span className="pm-ws-eyebrow">
          <Icon name="sparkle" size={12} /> {turn.toolLabel}
        </span>
        {turn.usage && (
          <span className="pm-ws-turn-usage">{turn.usage.totalTokens.toLocaleString()} tokens</span>
        )}
      </div>
      {turn.truncated && (
        <p className="pm-ws-turn-truncated">Response hit the max-token limit and was truncated.</p>
      )}
      <MarkdownRenderer content={turn.content} className="pm-ws-turn-body" />
    </div>
  );
});

WorkshopTurnBubble.displayName = 'WorkshopTurnBubble';
