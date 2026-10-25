/**
 * Lightbox refusal replay (PR #148 F-02). An editor command opens the tab and
 * sends its source at once, so a refusal can be posted before the webview is
 * listening. The host keeps the current outcome (the latest board and any
 * refusal the writer has not dismissed) and answers every mount or reveal
 * with it; `LIGHTBOX_DISMISS_REFUSAL` is what stops a refusal returning.
 *
 * "Dropped" below means the test discards what was posted before the
 * webview's request, as a booting or hidden webview would.
 */

import { LightboxSourceRefusal, MessageType } from '@/shared/types/messages';
import { ALICE_OPENING_CURLY, aliceWords } from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { createLightboxHost, LightboxPanel } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

/** Discard what was posted so far: the webview was not listening yet. */
const drop = (panel: LightboxPanel) => panel.posted.splice(0);

/** The one `LIGHTBOX_BOARD` answer to a mount request. */
async function mount(panel: LightboxPanel) {
  drop(panel);
  await panel.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  expect(panel.posted).toHaveLength(1);
  expect(panel.posted[0].type).toBe(MessageType.LIGHTBOX_BOARD);
  return panel.posted[0].payload as { board: { source: { displayPath: string } } | null; refusal: LightboxSourceRefusal | null };
}

describe('Lightbox refusal replay (PR #148 F-02)', () => {
  it.each([
    [
      'over the ceiling',
      { text: aliceWords(50_001), relativePath: 'Drafts/whole-book.md' },
      {
        reason: 'over-ceiling',
        wordCount: 50_001,
        ceilingWords: 50_000,
        displayPath: 'Drafts/whole-book.md',
        message: expect.stringContaining('50,001 words'),
        suggestion: expect.stringContaining('chapter')
      }
    ],
    [
      'empty',
      { text: ' \n\n ', relativePath: 'Drafts/blank.md' },
      { reason: 'empty', displayPath: 'Drafts/blank.md' }
    ],
    [
      'unsaved',
      { sourceUri: 'untitled:Untitled-1', relativePath: 'Untitled-1' },
      { reason: 'unreadable', displayPath: 'Untitled-1', suggestion: expect.stringContaining('Save the file') }
    ]
  ])('shows a first-open %s refusal that was posted before the webview listened', async (_label, payload, expected) => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, payload);
    const [dropped] = panel.refusals();

    const answer = await mount(panel);
    expect(answer.board).toBeNull();
    expect(answer.refusal).toEqual(expect.objectContaining({ ...expected, id: dropped.id }));
  });

  it('keeps the previous board behind a refusal of a new source, naming the refused one', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ALICE_OPENING_CURLY, relativePath: 'Drafts/alice-1.md' });
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: aliceWords(50_001), relativePath: 'Drafts/whole-book.md' });

    const answer = await mount(panel);
    expect(answer.board?.source.displayPath).toBe('Drafts/alice-1.md');
    expect(answer.refusal).toEqual(expect.objectContaining({ reason: 'over-ceiling', displayPath: 'Drafts/whole-book.md' }));
  });

  it('brings back a refusal dropped while hidden, and stops once it is dismissed', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ALICE_OPENING_CURLY, relativePath: 'Drafts/alice-1.md' });
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { sourceUri: 'untitled:Untitled-2', relativePath: 'Untitled-2' });

    const revealed = await mount(panel);
    expect(revealed.refusal?.displayPath).toBe('Untitled-2');
    // A reload asks again and still gets it: nothing has dismissed it.
    expect((await mount(panel)).refusal?.id).toBe(revealed.refusal?.id);

    await panel.route(MessageType.LIGHTBOX_DISMISS_REFUSAL, { refusalId: revealed.refusal?.id });
    const afterDismissal = await mount(panel);
    expect(afterDismissal.refusal).toBeNull();
    expect(afterDismissal.board?.source.displayPath).toBe('Drafts/alice-1.md');
    expect(panel.logged()).toContain('Refusal dismissed');
  });

  it('ignores a dismissal of an older refusal, and clears the standing one when a board lands', async () => {
    const host = createLightboxHost();
    const panel = host.openPanel();
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ' ', relativePath: 'first.md' });
    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ' ', relativePath: 'second.md' });
    const [first, second] = panel.refusals();
    expect(first.id).not.toBe(second.id);

    await panel.route(MessageType.LIGHTBOX_DISMISS_REFUSAL, { refusalId: first.id });
    expect((await mount(panel)).refusal?.displayPath).toBe('second.md');

    await panel.route(MessageType.LIGHTBOX_SET_SOURCE, { text: ALICE_OPENING_CURLY, relativePath: 'Drafts/alice-1.md' });
    expect(panel.posted.at(-1)).toEqual(expect.objectContaining({
      type: MessageType.LIGHTBOX_BOARD,
      payload: expect.objectContaining({ refusal: null })
    }));
    expect((await mount(panel)).refusal).toBeNull();
  });

  it('serves a replacement panel the refusal the closed one never showed', async () => {
    const host = createLightboxHost();
    const closed = host.openPanel();
    await closed.route(MessageType.LIGHTBOX_SET_SOURCE, { text: aliceWords(50_001), relativePath: 'Drafts/whole-book.md' });
    closed.dispose();

    const reopened = host.openPanel();
    expect((await mount(reopened)).refusal).toEqual(expect.objectContaining({ reason: 'over-ceiling' }));
  });
});
