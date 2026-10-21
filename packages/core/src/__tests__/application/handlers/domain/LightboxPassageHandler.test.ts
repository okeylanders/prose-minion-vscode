/**
 * LightboxPassageHandler (Slice 4E): `LIGHTBOX_REQUEST_PASSAGE` answered from
 * the text the named board was measured from, by board id and content hash,
 * echoing the request's id; refused as `changed` when that board is gone or
 * holds other text, and as `not-on-board` when it does not list the item;
 * ignored without a request id. Its logs carry counts and kinds, never the
 * chapter's words. A real LightboxService with the real measurement
 * services, over public-domain text (Lewis Carroll, "Alice's Adventures in
 * Wonderland", 1865).
 */

import { LightboxPassageHandler } from '@/application/handlers/domain/LightboxPassageHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import {
  LightboxPassageMessage,
  LightboxRequestPassagePayload,
  MessageType
} from '@messages';
import { ALICE_OPENING_CURLY, ALICE_PARAGRAPHS } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { boardWithPassages, createPassageService } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';

async function setup() {
  const service = createPassageService();
  const { board } = await boardWithPassages(ALICE_OPENING_CURLY, service);
  const posted: LightboxPassageMessage[] = [];
  const logs: string[] = [];
  const handler = new LightboxPassageHandler(
    service,
    async (message) => {
      posted.push(message as LightboxPassageMessage);
    },
    { appendLine: (line: string) => logs.push(line) } as never
  );
  const router = new MessageRouter();
  handler.registerRoutes(router);
  const ask = async (payload: Partial<LightboxRequestPassagePayload> | Record<string, unknown>) => {
    await router.route({ type: MessageType.LIGHTBOX_REQUEST_PASSAGE, source: 'webview.lightbox', payload, timestamp: 1 } as never);
    return posted[posted.length - 1]?.payload;
  };
  const current = { boardId: board.boardId, contentHash: board.source.contentHash };
  return { service, board, posted, logs, router, ask, current };
}

describe('LightboxPassageHandler', () => {
  it('registers its one route', async () => {
    const { router } = await setup();
    expect(router.hasHandler(MessageType.LIGHTBOX_REQUEST_PASSAGE)).toBe(true);
    expect(router.handlerCount).toBe(1);
  });

  it('answers a paragraph with its text, echoing the request id, board id and hash', async () => {
    const { ask, current } = await setup();
    const reply = await ask({ requestId: 'lbx-1', ...current, item: { kind: 'paragraphs', from: 3, to: 3 } });
    expect(reply).toEqual({
      requestId: 'lbx-1',
      ...current,
      passage: { kind: 'paragraphs', paragraphs: [{ index: 3, segments: [{ text: ALICE_PARAGRAPHS[1] }] }], moreParagraphs: 0 }
    });
  });

  it('answers a counted term with its sentences', async () => {
    const { ask, current } = await setup();
    const reply = await ask({ requestId: 'lbx-2', ...current, item: { kind: 'instances', term: { kind: 'word', word: 'alice' } } });
    expect(reply?.passage).toEqual(expect.objectContaining({ kind: 'instances', instances: 5 }));
  });

  it('refuses a board held over other text, and one no longer held, as changed', async () => {
    const { ask, current, service } = await setup();
    const item = { kind: 'paragraphs', from: 2, to: 2 };
    expect((await ask({ requestId: 'lbx-3', boardId: current.boardId, contentHash: 'f'.repeat(64), item }))?.passage)
      .toEqual({ kind: 'refused', reason: 'changed' });
    // The writer edits the file and re-reads it: one source, a new board, and the old id is gone.
    await boardWithPassages(ALICE_OPENING_CURLY.replace('very deep well', 'very deep shaft'), service);
    const reply = await ask({ requestId: 'lbx-4', ...current, item });
    expect(reply).toEqual({ requestId: 'lbx-4', ...current, passage: { kind: 'refused', reason: 'changed' } });
  });

  it('refuses an item the board does not list, or that is not shaped as one, as not on the board', async () => {
    const { ask, current } = await setup();
    for (const item of [
      { kind: 'instances', term: { kind: 'word', word: 'jabberwock' } },
      { kind: 'instances', term: { kind: 'flag', flag: 'clichés' } },
      { kind: 'instances', term: { kind: 'pos', pos: 'pronouns', word: 'she' } },
      { kind: 'paragraphs', from: 2, to: 99 },
      { kind: 'paragraphs', from: 1.5, to: 2 },
      { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word' } },
      { kind: 'sentence', index: 2 },
      undefined
    ]) {
      expect({ item, passage: (await ask({ requestId: 'lbx-5', ...current, item }))?.passage })
        .toEqual({ item, passage: { kind: 'refused', reason: 'not-on-board' } });
    }
  });

  it('ignores a request with no id, an empty one or an overlong one, and posts nothing', async () => {
    const { ask, current, posted } = await setup();
    const item = { kind: 'paragraphs', from: 2, to: 2 };
    await ask({ ...current, item });
    await ask({ requestId: '', ...current, item });
    await ask({ requestId: 'x'.repeat(201), ...current, item });
    await ask({ requestId: 'lbx-6', contentHash: current.contentHash, item });
    expect(posted).toEqual([]);
  });

  it('logs kinds and counts, never the chapter\'s words', async () => {
    const { ask, current, logs } = await setup();
    await ask({ requestId: 'a', ...current, item: { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word', word: 'alice' } } });
    await ask({ requestId: 'b', ...current, item: { kind: 'instances', term: { kind: 'phrase', phrase: 'thought alice' } } });
    await ask({ requestId: 'c', ...current, item: { kind: 'instances', term: { kind: 'hapax', word: 'daisychain' } } });
    expect(logs).toEqual([
      `[LightboxPassageHandler] ¶2–¶2, lit by a top word: 1 paragraph sent, 0 past the bound, 2 lit (board ${current.boardId}).`,
      `[LightboxPassageHandler] The instances of a repeated phrase: 2 in 2 sentences, 2 rows sent, 0 past the bound (board ${current.boardId}).`,
      `[LightboxPassageHandler] The instances of a hapax word: 1 in 1 sentence, 1 row sent, 0 past the bound (board ${current.boardId}).`
    ]);
    const words = new Set(ALICE_OPENING_CURLY.toLowerCase().match(/[a-z]{5,}/g));
    const leaked = logs.flatMap((line) => line.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((word) => words.has(word));
    expect(leaked).toEqual([]);
  });

  it('says so in the log when a passage disagrees with the board\'s count', async () => {
    const { ask, current, service, logs } = await setup();
    // Tamper with the retained board's figure; the text, and so the passage, is unchanged.
    const alice = service.passageSource(current.boardId)?.board.measured.topWords.find((entry) => entry.term === 'alice');
    alice!.count = 6;
    await ask({ requestId: 'd', ...current, item: { kind: 'instances', term: { kind: 'word', word: 'alice' } } });
    expect(logs).toContain('[LightboxPassageHandler] ✗ a top word: 5 instances found, but the board counts 6.');
  });
});
