/**
 * `transcript.read` marks bookmarked turns (ADR 2026-11-05 D5; PR #214
 * F-04): a full entry's header and a collapsed tool report alike, in a read
 * of one session and the default read of several. The mark is the read
 * window's, never the shared projection's, so export and the turn preview
 * are unchanged; it counts toward a read's packing bounds, and the
 * full-read hint beside it still decodes as written.
 *
 * The session is the Wayfinding-era fixture: a writer message (bookmarked,
 * unnamed), a persona-run analysis card, the host's reply (bookmarked,
 * named), a direct run and its tool report, and the host's synthesis. The
 * tool report is bookmarked here too.
 */

import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallRead } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopTurn } from '@messages';
import { setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const codec = new WorkshopCapabilityXmlCodec();
const NOW = Date.parse('2026-11-05T12:00:00.000Z');
const REPORT_LABEL = 'Alice\'s continuity report';

/** The fixture, with its tool report bookmarked too, saved as `sessionId`. */
const sessionNamed = (sessionId: string): WorkshopPersistedSessionV2 => {
  const session = JSON.parse(JSON.stringify(require('../../../../fixtures/workshop-session-v2-wayfinding-bookmarks.json')));
  session.sessionId = sessionId;
  session.workshop.bookmarks.push({ id: 'bookmark-3-4000', turnId: 'turn-6-assistant-1012', label: REPORT_LABEL, createdAt: 4000 });
  return session as WorkshopPersistedSessionV2;
};

async function recall() {
  const harness = setupCoordinator();
  await harness.store.saveNamed(sessionNamed('marked-a'));
  await harness.store.saveNamed(sessionNamed('marked-b'));
  await harness.coordinator.initialize();
  return new WorkshopTranscriptRecallService(harness.store, harness.coordinator, harness.log);
}

const read = async (sessionIds: string[], detail?: 'full' | 'discussion', readCharacters?: number) =>
  renderWorkshopRecallRead(
    await (await recall()).read({ sessions: sessionIds.map((sessionId) => ({ sessionId })), ...(detail ? { detail } : {}) }),
    { now: NOW, ...(readCharacters ? { readCharacters } : {}) }
  ).content;

describe('a read marks bookmarked turns', () => {
  it('marks each bookmarked entry’s header in a full read, with the writer’s label or the default', async () => {
    const text = await read(['marked-a']);
    expect(text).toMatch(/\[turn 2 · [^\]]+ · Writer · bookmarked: "You · Why does the jar matter\?"\]/);
    expect(text).toMatch(/\[turn 4 · [^\]]+ · bookmarked: "Alice's reply"\]/);
    expect(text).toMatch(new RegExp(`\\[turn 6 · [^\\]]+ · bookmarked: "${REPORT_LABEL}"\\]`));
    // Unmarked turns carry nothing.
    expect(text).not.toMatch(/\[turn [357] [^\]]*bookmarked/);
    expect(text.match(/bookmarked: "/g)).toHaveLength(3);
  });

  it('marks a bookmarked tool report collapsed in a one-session discussion read, its hint still exact', async () => {
    const text = await read(['marked-a'], 'discussion');
    const line = new RegExp(`\\[turn 6 · [^\\]]* report · bookmarked: "${REPORT_LABEL}" · \\d+ words? · read it in full with (<turns>6</turns> <detail>full</detail>)\\]`)
      .exec(text);
    expect(line).not.toBeNull();
    expect(codec.inspect(`<prose-minion-tool-call name="transcript.read"><session>marked-a</session>${line![1]}</prose-minion-tool-call>`))
      .toEqual({ kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: 'marked-a', turns: [{ from: 6, to: 6 }] }], detail: 'full' } });
  });

  it('marks it in the default read of several sessions, whose hint names its session', async () => {
    const text = await read(['marked-a', 'marked-b']);
    const hints = [...text.matchAll(new RegExp(`report · bookmarked: "${REPORT_LABEL}" · \\d+ words? · read it in full with ` +
      '(<session turns="6">marked-[ab]</session> <detail>full</detail>)\\]', 'g'))].map(([, hint]) => hint);
    expect(hints).toEqual([
      '<session turns="6">marked-a</session> <detail>full</detail>',
      '<session turns="6">marked-b</session> <detail>full</detail>'
    ]);
    expect(codec.inspect(`<prose-minion-tool-call name="transcript.read">${hints.join(' ')}</prose-minion-tool-call>`))
      .toMatchObject({ kind: 'request', request: { sessions: [{ sessionId: 'marked-a' }, { sessionId: 'marked-b' }], detail: 'full' } });
  });

  it('counts the marks toward the read’s bounds', async () => {
    const plain = await (async () => {
      const harness = setupCoordinator();
      const unmarked = sessionNamed('plain');
      delete (unmarked.workshop as { bookmarks?: unknown }).bookmarks;
      await harness.store.saveNamed(unmarked);
      await harness.coordinator.initialize();
      const service = new WorkshopTranscriptRecallService(harness.store, harness.coordinator, harness.log);
      return renderWorkshopRecallRead(await service.read({ sessions: [{ sessionId: 'plain' }] }), { now: NOW }).content;
    })();
    const marked = await read(['marked-a']);
    expect(marked.length - plain.length).toBe([
      ' · bookmarked: "You · Why does the jar matter?"',
      ` · bookmarked: "${REPORT_LABEL}"`,
      ' · bookmarked: "Alice\'s reply"'
    ].join('').length + ('marked-a'.length - 'plain'.length));
    for (const limit of [6_000, 8_000]) {
      expect((await read(['marked-a'], 'full', limit)).length).toBeLessThanOrEqual(limit);
    }
  });
});

describe('the mark never enters the shared projection', () => {
  it('leaves the turn projection, the turn preview and export as they were', () => {
    const session = sessionNamed('marked-a');
    const turns = session.workshop.turns as WorkshopTurn[];
    const labels = session.workshop.bookmarks!.map((bookmark) => bookmark.label).filter(Boolean) as string[];
    for (const turn of turns) {
      const projected = JSON.stringify([projectWorkshopTranscriptTurn(turn), workshopTurnPreview(turn)]);
      expect(projected).not.toMatch(/bookmark/i);
      for (const label of labels) {
        expect(projected).not.toContain(label);
      }
    }
    // Export names bookmarked turns only when asked, and only as `bookmarked: true`, never a label.
    const exported = projectWorkshopTranscript(turns, {
      title: session.title,
      exportedAt: NOW,
      bookmarkedTurnIds: new Set(session.workshop.bookmarks!.map((bookmark) => bookmark.turnId))
    });
    const marked = exported.entries.flatMap((entry) =>
      'turnId' in entry && 'bookmarked' in entry ? [[entry.turnId, entry.bookmarked]] : []);
    expect(marked)
      .toEqual([['turn-2-user-1004', true], ['turn-4-assistant-1008', true], ['turn-6-assistant-1012', true]]);
    for (const label of labels) {
      expect(JSON.stringify(exported)).not.toContain(label);
    }
  });
});
