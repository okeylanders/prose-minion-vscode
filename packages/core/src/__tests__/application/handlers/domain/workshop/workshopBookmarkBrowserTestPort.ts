/**
 * The Bookmarks screen's recall port for room-handler harnesses that never
 * open the screen: every read refuses, so a test that reaches one fails loudly.
 */

import type { WorkshopBookmarkBrowserPort } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';

export function unusedBookmarkBrowser(): WorkshopBookmarkBrowserPort {
  const unused = (name: string) => jest.fn(() => {
    throw new Error(`the Bookmarks screen's ${name} was not expected in this test`);
  });
  return {
    bookmarkPage: unused('bookmarkPage'),
    liveRoomBookmarks: unused('liveRoomBookmarks'),
    savedTurn: unused('savedTurn')
  } as unknown as WorkshopBookmarkBrowserPort;
}
