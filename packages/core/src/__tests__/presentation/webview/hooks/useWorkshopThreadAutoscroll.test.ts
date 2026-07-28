/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { useWorkshopThreadAutoscroll } from '@hooks/useWorkshopThreadAutoscroll';

describe('useWorkshopThreadAutoscroll', () => {
  it('does not jump on a session-only rerender with the same latest turn', () => {
    const thread = document.createElement('div');
    Object.defineProperty(thread, 'scrollHeight', { value: 900 });
    const threadRef = { current: thread };
    const { rerender } = renderHook(
      (props: { latestTurnId?: string; todoRevision: number }) => {
        useWorkshopThreadAutoscroll({
          threadRef,
          latestTurnId: props.latestTurnId,
          streamingContent: '',
          isRunning: false,
          errorMessage: ''
        });
      },
      { initialProps: { latestTurnId: 'turn-7', todoRevision: 0 } }
    );
    expect(thread.scrollTop).toBe(900);

    thread.scrollTop = 240;
    rerender({ latestTurnId: 'turn-7', todoRevision: 1 });
    expect(thread.scrollTop).toBe(240);

    rerender({ latestTurnId: 'turn-8', todoRevision: 1 });
    expect(thread.scrollTop).toBe(900);
  });
});
