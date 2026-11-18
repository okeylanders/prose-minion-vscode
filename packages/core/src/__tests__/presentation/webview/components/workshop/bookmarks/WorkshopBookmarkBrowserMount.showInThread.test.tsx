/**
 * @jest-environment jsdom
 */

/**
 * The Bookmarks screen's Show in thread (ADR 2026-11-05 D8; ADR 2026-11-17
 * D6, amended 2026-11-18): a turn the thread has drawn is jumped to after
 * the screen closes; one it has not closes the screen and loads the earlier
 * turns back to it, with the row's label; with no loader, the preview opens
 * over the screen as before. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkshopBookmarkBrowserRow } from '@messages';
import { WorkshopBookmarkBrowserMount } from '@components/workshop/bookmarks/WorkshopBookmarkBrowserMount';
import type { UseWorkshopBookmarkBrowserReturn } from '@hooks/domain/workshop/useWorkshopBookmarkBrowser';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

const row = (turnId: string, label: string): WorkshopBookmarkBrowserRow => ({
  bookmarkId: `bookmark-${turnId}`,
  turnId,
  label,
  createdAt: Date.UTC(2026, 10, 4),
  speaker: 'Jill',
  identity: 'jill',
  message: { kind: 'reply', speaker: 'Jill', content: `${label}: the little door.`, timestamp: 1 }
});

const browser = (closeBrowser: jest.Mock): UseWorkshopBookmarkBrowserReturn => ({
  browserOpen: true,
  live: { status: 'ready', rows: [row('turn-2', 'Drawn door'), row('turn-0', 'Older door')] },
  saved: {
    sessions: [],
    unreadableSessions: [],
    ambiguousSessionIds: new Set(),
    coverage: { read: 0, unreadable: 0, ambiguous: 0, remaining: 0, started: true },
    loading: false
  },
  query: '',
  savedTurnPreview: null,
  roomRevision: 1,
  openBrowser: jest.fn(),
  closeBrowser,
  setQuery: jest.fn(),
  loadMore: jest.fn(),
  requestSavedTurnPreview: jest.fn(() => 'r-1'),
  clearSavedTurnPreview: jest.fn(),
  handleSessionState: jest.fn(),
  handleBookmarkPage: jest.fn(),
  handleLiveBookmarks: jest.fn(),
  handleSavedTurnPreview: jest.fn(),
  persistedState: {}
} as unknown as UseWorkshopBookmarkBrowserReturn);

const mount = (loadEarlierThrough?: jest.Mock, cancelEarlierJump?: jest.Mock) => {
  const closeBrowser = jest.fn();
  const openGivenTurnPreviewSheet = jest.fn();
  render(
    <>
      <div {...{ [WORKSHOP_TURN_ID_ATTRIBUTE]: 'turn-2' }} tabIndex={-1} />
      <WorkshopBookmarkBrowserMount
        browser={browser(closeBrowser)}
        openDisabled={false}
        openStoredSession={jest.fn()}
        openAtBookmark={jest.fn()}
        openSavedTurnPreviewSheet={jest.fn()}
        openGivenTurnPreviewSheet={openGivenTurnPreviewSheet}
        {...(loadEarlierThrough ? { loadEarlierThrough } : {})}
        {...(cancelEarlierJump ? { cancelEarlierJump } : {})}
        rememberRoomBookmark={jest.fn()}
        rememberSavedBookmark={jest.fn()}
      />
    </>
  );
  return { closeBrowser, openGivenTurnPreviewSheet };
};

const showInThread = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Show ${label} in the thread` }));

describe('WorkshopBookmarkBrowserMount — Show in thread', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('closes the screen and loads the earlier turns back to a turn the thread has not drawn', () => {
    const loadEarlierThrough = jest.fn();
    const { closeBrowser, openGivenTurnPreviewSheet } = mount(loadEarlierThrough);

    showInThread('Older door');

    expect(closeBrowser).toHaveBeenCalledTimes(1);
    expect(loadEarlierThrough).toHaveBeenCalledWith('turn-0', 'Older door');
    expect(openGivenTurnPreviewSheet).not.toHaveBeenCalled();
  });

  it('stops a jump still loading before it shows a drawn turn (PR #281 P2)', () => {
    const order: string[] = [];
    const cancelEarlierJump = jest.fn(() => order.push('cancel'));
    const { closeBrowser } = mount(jest.fn(), cancelEarlierJump);
    closeBrowser.mockImplementation(() => order.push('close'));

    showInThread('Drawn door');

    expect(order).toEqual(['cancel', 'close']);
  });

  it('closes the screen toward a drawn turn without loading anything', () => {
    const loadEarlierThrough = jest.fn();
    const { closeBrowser } = mount(loadEarlierThrough);

    showInThread('Drawn door');

    expect(closeBrowser).toHaveBeenCalledTimes(1);
    expect(loadEarlierThrough).not.toHaveBeenCalled();
  });

  it('opens the preview over the screen when no loader is given', () => {
    const { closeBrowser, openGivenTurnPreviewSheet } = mount();

    showInThread('Older door');

    expect(closeBrowser).not.toHaveBeenCalled();
    expect(openGivenTurnPreviewSheet).toHaveBeenCalledWith('turn-0', expect.objectContaining({ kind: 'reply' }), 'Older door');
  });
});
