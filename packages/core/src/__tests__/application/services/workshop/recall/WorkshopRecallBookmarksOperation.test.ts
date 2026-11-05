/**
 * The bookmarks adapter (ADR 2026-11-05 D2, D3, D7): who it asks for, the
 * context-window clamp a list and a message window share with reads, and
 * how each outcome is recorded.
 */

import { WorkshopTranscriptRecallCapability, WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import {
  WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkList';
import type {
  WorkshopRecallBookmarksRequest,
  WorkshopRecallBookmarksResult
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { decodeWorkshopPersistedSessionCheckpoint } from '@/application/services/workshop/WorkshopPersistedSession';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';

const windowOf = (freeInputTokens: number): CapabilityContextWindow => ({
  contextLength: freeInputTokens + 2_000,
  requestTokens: 1_000,
  outputTokens: 800,
  headroomTokens: 200,
  freeInputTokens
});

const document = buildWorkshopRecallDocument(
  decodeWorkshopPersistedSessionCheckpoint(require('../../../../fixtures/workshop-session-v2-wayfinding-bookmarks.json')).session
);
const long = `Alice ${'rows out at dawn. '.repeat(300)}`;
const LIST: WorkshopRecallBookmarksResult = {
  available: true,
  outcome: 'bookmarks',
  scope: 'saved',
  filters: {},
  groups: [{
    source: { kind: 'saved', header: document.header },
    bookmarks: Array.from({ length: 6 }, (_, index) => ({
      ...document.bookmarks[0],
      id: `bookmark-${index + 1}-5000`,
      entry: { kind: 'event' as const, turnId: 't', timestamp: 5000, text: long },
      ref: { source: 'saved' as const, sessionId: document.header.sessionId, bookmarkId: `bookmark-${index + 1}-5000` }
    }))
  }],
  bounds: {
    openRoom: 'not-asked', corpusSessions: 1, sessionLimit: 50, sessionsScanned: 1, notScannedBySessionLimit: 0,
    notScannedByByteBudget: 0, bookmarksSeen: 6, notShownByFilters: 0, omittedByItemLimit: 0, parsedBytes: 10,
    unreadableSessions: 0, unreadableBytesCharged: 0, cacheHits: 0, listingTruncated: false
  }
};

const capabilityOver = (answer: WorkshopRecallBookmarksResult, asked: WorkshopRecallBookmarksRequest[] = []) => {
  const recall = {
    bookmarks: async (request: WorkshopRecallBookmarksRequest) => {
      asked.push(request);
      return answer;
    }
  } as unknown as WorkshopTranscriptRecallPort;
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  return {
    capability: new WorkshopTranscriptRecallCapability(recall, log, {
      requestId: 'r-1',
      personaId: 'cliff',
      owner: { kind: 'personaGuest', personaId: 'cliff' },
      signal: new AbortController().signal
    }, () => Date.parse('2026-11-05T12:00:00.000Z')),
    log
  };
};

describe('the bookmarks adapter', () => {
  it('asks for the turn’s owner, and records the list with its rows, bounds and manifest row', async () => {
    const asked: WorkshopRecallBookmarksRequest[] = [];
    const { capability } = capabilityOver(LIST, asked);
    const result = await capability.fulfill({ capability: 'transcript.bookmarks', scope: 'saved' });
    expect(asked).toEqual([{ scope: 'saved', reader: { kind: 'personaGuest', personaId: 'cliff' } }]);
    expect(result).toMatchObject({
      status: 'success',
      metadata: { outcome: 'bookmarks', scope: 'saved', cutMessages: expect.any(Number), truncated: true }
    });
    expect(result.content!.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkCharacters);
    expect(result.metadata).not.toHaveProperty('publicationWithheld');
    expect(capability.deliveredSources(result)).toEqual([
      { kind: 'transcript', label: `Bookmarks · “${document.header.title}”`, sizeChars: result.content!.length }
    ]);
  });

  it('stamps a withheld result, with the ids, and logs the reason by id', async () => {
    const { capability, log } = capabilityOver({ ...LIST, withheld: { reason: 'open-room-private-turn', bookmarkIds: ['bookmark-1-5000'] } });
    const result = await capability.fulfill({ capability: 'transcript.bookmarks' });
    expect(result.metadata).toMatchObject({ publicationWithheld: 'open-room-private-turn', withheldBookmarks: ['bookmark-1-5000'] });
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('withheld=open-room-private-turn bookmarks=bookmark-1-5000'));
  });

  it('fits a list to half the room the window has left, by the preflight’s estimate', async () => {
    const { capability } = capabilityOver(LIST);
    const result = await capability.fulfill({ capability: 'transcript.bookmarks' }, windowOf(6_000));
    expect(result.status).toBe('success');
    expect(result.content!.length).toBeLessThan(PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkCharacters);
    expect(result.content!.length).toBeGreaterThan(0);
  });

  it('refuses a list the window cannot hold, before asking the service', async () => {
    const asked: WorkshopRecallBookmarksRequest[] = [];
    const { capability } = capabilityOver(LIST, asked);
    const tiny = Math.floor(WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS / PROMPT_BUDGETS.inferenceContext.bytesPerToken);
    const result = await capability.fulfill({ capability: 'transcript.bookmarks' }, windowOf(2 * tiny - 2));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'recall-context-window' } });
    expect(asked).toEqual([]);
  });

  it('records an unknown bookmark as a failure that says so, and recall unavailable plainly', async () => {
    const ref = { source: 'saved' as const, sessionId: 's', bookmarkId: 'bookmark-1-1' };
    const unknown = await capabilityOver({ available: true, outcome: 'unknown-bookmark', ref }).capability
      .fulfill({ capability: 'transcript.bookmarks', bookmark: ref });
    expect(unknown).toMatchObject({ status: 'failed', metadata: { outcome: 'unknown-bookmark' }, error: 'No bookmarked message was recalled.' });
    expect(unknown.content).toContain('or it stands on a turn you could not see');
    const unavailable = await capabilityOver({ available: false, reason: 'not-ready' }).capability
      .fulfill({ capability: 'transcript.bookmarks' });
    expect(unavailable).toMatchObject({ status: 'failed', metadata: { outcome: 'unavailable', unavailableReason: 'not-ready' } });
  });
});
