/**
 * The Bookmarks screen's recall port for room-handler harnesses that never
 * open the screen: every read refuses, so a test that reaches one fails loudly.
 * The same for the helper's memory drafts (Helper Agent Slice 2), and for the
 * editor's selection snapshots (Selected Text): nothing is selected.
 */

import type { WorkshopBookmarkBrowserPort } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';
import type { WorkshopMemoryDraftPorts } from '@handlers/domain/workshop/WorkshopMemoryDraftHandler';
import type { WorkshopSelectedTextSnapshotsPort } from '@handlers/domain/workshop/WorkshopSelectedTextHandler';

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

/** The helper's memory drafts for harnesses that never ask for one: drafting is off, and the helper refuses if reached. */
export function unusedMemoryDrafts(): WorkshopMemoryDraftPorts {
  return {
    helper: {
      run: jest.fn(() => {
        throw new Error('the helper\'s memory draft was not expected in this test');
      })
    },
    settings: { get: jest.fn(() => false) as WorkshopMemoryDraftPorts['settings']['get'] }
  };
}

/** Selected Text's snapshots for harnesses that never select anything: no editor, no snapshot, a watch that never fires. */
export function unusedSelectedText(): WorkshopSelectedTextSnapshotsPort {
  return {
    capture: () => undefined,
    find: () => undefined,
    watch: () => ({ dispose: () => undefined })
  };
}
