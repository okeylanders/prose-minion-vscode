/**
 * Visibility witness for session recall (ADR 2026-10-05 I1). A real room is
 * saved through the real aggregate, coordinator, and store with a marker in
 * every body the thread hides: an attachment's text, persisted capability
 * evidence, the evidence the real summary copied into `preview`, the
 * conversation archive, context bodies, the excerpt, and its identity.
 * Neither the service's data nor the rendered catalog, search, and read text
 * may contain one; the labels a reader does see must survive.
 */

import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import {
  RECALL_SENTINELS,
  RECALL_VISIBLE_LABELS,
  saveSentinelCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');

async function recallEverything(): Promise<{ data: string; text: string; savedPreview: string }> {
  const { store, coordinator, log, savedSessionId } = await saveSentinelCorpus();
  const service = new WorkshopTranscriptRecallService(store, coordinator, log);
  const catalog = await service.catalog({});
  const searches = await Promise.all(
    ['lighthouse', 'letters keeper', 'keeper-notes', 'tide tables', 'chapter', 'sentinel']
      .map((query) => service.search({ query }))
  );
  const read = await service.read({ sessionId: savedSessionId });
  const ranged = await service.read({ sessionId: savedSessionId, turns: [{ from: 1, to: 3 }, { from: 5, to: 99 }] });
  const savedPreview = (await store.readNamed(savedSessionId))!.summary.preview ?? '';
  return {
    data: JSON.stringify([catalog, searches, read, ranged]),
    text: [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      ...searches.map((search) => renderWorkshopRecallSearch(search, { now: NOW })),
      renderWorkshopRecallRead(read, { now: NOW }).content,
      renderWorkshopRecallRead(ranged, { now: NOW }).content
    ].join('\n'),
    savedPreview
  };
}

describe('session recall visibility', () => {
  let recalled: Awaited<ReturnType<typeof recallEverything>>;

  beforeAll(async () => {
    recalled = await recallEverything();
  });

  it('starts from a real session whose summary preview holds evidence', () => {
    expect(recalled.savedPreview).toContain(RECALL_SENTINELS.previewEvidence);
  });

  it.each(Object.entries(RECALL_SENTINELS))('never returns the %s, as data or as text', (_field, sentinel) => {
    expect(recalled.data).not.toContain(sentinel);
    expect(recalled.text).not.toContain(sentinel);
  });

  it('finds nothing when searching for a hidden body’s words', () => {
    expect(recalled.text).toContain('Search: “sentinel”');
    expect(recalled.text).toMatch(/Search: “sentinel”[^\n]*\n[^\n]*\n\nNo visible turn or session label matched\./);
  });

  it('still returns the labels and lines a reader sees', () => {
    for (const label of Object.values(RECALL_VISIBLE_LABELS)) {
      expect(recalled.text).toContain(label);
    }
    expect(recalled.text).toContain(`Attached: ${RECALL_VISIBLE_LABELS.attachment}`);
    expect(recalled.text).toContain(
      `Context attachments (labels only): ${RECALL_VISIBLE_LABELS.contextFile}, ${RECALL_VISIBLE_LABELS.contextNote}`
    );
    // Capability artifacts appear as the thread's one-line event, never their evidence.
    expect(recalled.text).toMatch(/· event\] [^\n]*characters\/keeper\.md[^\n]*· success/);
  });
});
