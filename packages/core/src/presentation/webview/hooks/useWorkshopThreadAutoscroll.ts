import * as React from 'react';

interface WorkshopThreadAutoscrollInput {
  threadRef: React.RefObject<HTMLDivElement>;
  latestTurnId?: string;
  streamingContent: string;
  isRunning: boolean;
  errorMessage: string;
}

/** Follow actual thread growth without reacting to unrelated session snapshots. */
export const useWorkshopThreadAutoscroll = ({
  threadRef,
  latestTurnId,
  streamingContent,
  isRunning,
  errorMessage
}: WorkshopThreadAutoscrollInput): void => {
  React.useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [threadRef, latestTurnId, streamingContent, isRunning, errorMessage]);
};
