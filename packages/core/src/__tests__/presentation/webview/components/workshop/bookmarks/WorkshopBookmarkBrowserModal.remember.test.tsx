/**
 * @jest-environment jsdom
 */

/**
 * The Bookmarks screen's "Remember this" (Bookmark Recall Slice 3, ADR
 * 2026-11-05 D9): offered on this conversation's rows and saved sessions',
 * handed the row; disabled, like the row's Opens, on a session id two files
 * claim, and on a row the host sent no message for (the prefill is the
 * host's). Absent unless the mount asks for it. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkshopBookmarkBrowserRow } from '@messages';
import { WorkshopBookmarkBrowserModal } from '@components/workshop/bookmarks/WorkshopBookmarkBrowserModal';

const row = (turnId: string, label: string, withMessage = true, rememberable = true): WorkshopBookmarkBrowserRow => ({
  bookmarkId: `bookmark-${turnId}`,
  turnId,
  label,
  createdAt: Date.UTC(2026, 10, 4),
  speaker: 'Jill',
  identity: 'jill',
  ...(withMessage ? { message: { kind: 'reply', speaker: 'Jill', content: `${label}: the little door.`, timestamp: 1 } } : {}),
  ...(rememberable ? { rememberable: true as const } : {})
});

const renderModal = (onRemember?: jest.Mock) => {
  const actions = { onPreview: jest.fn(), onOpenSession: jest.fn(), onOpenAtBookmark: jest.fn(), onShowInThread: jest.fn() };
  render(
    <WorkshopBookmarkBrowserModal
      open
      live={{ status: 'ready', rows: [
        row('turn-2-assistant-1', 'Live door'),
        row('turn-4-assistant-1', 'Quiet notice', false),
        row('turn-5-system-1', 'Session marker', true, false)
      ] }}
      saved={{
        sessions: [
          { sessionId: 'tea', title: 'Tea party', savedAt: '2026-11-04T00:00:00Z', bookmarks: [row('turn-6-assistant-1', 'Tea door')] },
          { sessionId: 'twin', title: 'Twin', savedAt: '2026-11-03T00:00:00Z', bookmarks: [row('turn-8-assistant-1', 'Twin door')] }
        ],
        unreadableSessions: [],
        ambiguousSessionIds: new Set(['twin']),
        coverage: { read: 2, unreadable: 0, ambiguous: 1, remaining: 0, started: true },
        loading: false
      }}
      query=""
      openDisabled={false}
      now={new Date(Date.UTC(2026, 10, 5))}
      onQueryChange={jest.fn()}
      onLoadMore={jest.fn()}
      onClose={jest.fn()}
      {...actions}
      {...(onRemember ? { onRemember } : {})}
    />
  );
};

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('WorkshopBookmarkBrowserModal — Remember this', () => {
  it('is absent unless the mount asks for it', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /^Remember this/ })).toBeNull();
  });

  it('hands a live row and a saved row to the callback', () => {
    const onRemember = jest.fn();
    renderModal(onRemember);
    fireEvent.click(button('Remember this: Live door'));
    fireEvent.click(button('Remember this: Tea door'));
    expect(onRemember.mock.calls.map(([item]) => [item.source.kind, item.row.turnId])).toEqual([
      ['live', 'turn-2-assistant-1'],
      ['saved', 'turn-6-assistant-1']
    ]);
  });

  it('is disabled on a session id two files claim, as its Opens are, and on a row with no message', () => {
    const onRemember = jest.fn();
    renderModal(onRemember);
    expect(button('Remember this: Twin door').disabled).toBe(true);
    expect(button('Open at bookmark Twin door').disabled).toBe(true);
    expect(button('Remember this: Quiet notice').disabled).toBe(true);
    // A turn the host would refuse to save (PR #219 F-01) is not offered either.
    expect(button('Remember this: Session marker').disabled).toBe(true);
    fireEvent.click(button('Remember this: Twin door'));
    expect(onRemember).not.toHaveBeenCalled();
  });
});
