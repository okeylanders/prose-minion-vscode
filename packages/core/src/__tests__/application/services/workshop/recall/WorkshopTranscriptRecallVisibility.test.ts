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
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import {
  RECALL_SENTINELS,
  RECALL_VISIBLE_LABELS,
  saveSentinelCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  saveTodoCorpus,
  TODO_SENTINELS
} from '@/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');

async function recallEverything(): Promise<{ data: string; text: string; savedPreview: string }> {
  const first = await saveSentinelCorpus();
  // A second sentinel room in the same workspace, so one read can name both.
  const { store, coordinator, log, savedSessionId } = await saveSentinelCorpus({ fs: first.fs, idPrefix: 'second' });
  const service = new WorkshopTranscriptRecallService(store, coordinator, log);
  const catalog = await service.catalog({});
  const matched = await service.catalog({ match: 'lighthouse' });
  const searches = await Promise.all(
    ['lighthouse', 'letters keeper', 'keeper-notes', 'tide tables', 'chapter', 'sentinel']
      .map((query) => service.search({ query }))
  );
  const reads = await Promise.all([
    service.read({ sessions: [{ sessionId: savedSessionId }] }),
    service.read({ sessions: [{ sessionId: savedSessionId, turns: [{ from: 1, to: 3 }, { from: 5, to: 99 }] }] }),
    // Several sessions (discussion detail by default), and one session in each detail.
    service.read({ sessions: [{ sessionId: savedSessionId }, { sessionId: first.savedSessionId, turns: [{ from: 2, to: 9 }] }] }),
    service.read({ sessions: [{ sessionId: first.savedSessionId }, { sessionId: savedSessionId }], detail: 'full' }),
    service.read({ sessions: [{ sessionId: first.savedSessionId }], detail: 'discussion' })
  ]);
  const todos = await service.todos({ status: 'all', match: 'lighthouse' });
  const savedPreview = (await store.readNamed(savedSessionId))!.summary.preview ?? '';
  return {
    data: JSON.stringify([catalog, matched, searches, reads, todos]),
    text: [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      renderWorkshopRecallCatalog(matched, { now: NOW }),
      ...searches.map((search) => renderWorkshopRecallSearch(search, { now: NOW })),
      ...reads.map((read) => renderWorkshopRecallRead(read, { now: NOW }).content),
      renderWorkshopRecallTodos(todos, { now: NOW }).content
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

  it('reads several sessions, and collapses the tool report in discussion detail', () => {
    expect(recalled.text).toContain('Read of 2 saved sessions, in the order asked, in discussion detail');
    // In a read of several sessions, its hint names the session; alone, the session is implied.
    expect(recalled.text).toMatch(/· Cliché report · 8 words · read it in full with <session turns="\d+">second-[^<]+<\/session> <detail>full<\/detail>\]/);
    expect(recalled.text).toMatch(/· Cliché report · 8 words · read it in full with <turns>\d+<\/turns>\]/);
    expect(recalled.text).toContain(`[turn 3 · 2:01 PM · Cliché]\n${RECALL_VISIBLE_LABELS.toolReport}`);
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

describe('session recall to-do visibility (D5)', () => {
  let data: string;
  let text: string;

  beforeAll(async () => {
    const { store, coordinator, log } = await saveTodoCorpus();
    const service = new WorkshopTranscriptRecallService(store, coordinator, log);
    const results = await Promise.all((['open', 'completed', 'dismissed', 'all'] as const)
      .map((status) => service.todos({ status })));
    data = JSON.stringify(results);
    text = results.map((result) => renderWorkshopRecallTodos(result, { now: NOW }).content).join('\n');
  });

  it.each(Object.entries(TODO_SENTINELS))('never returns the %s, as data or as text', (_field, sentinel) => {
    expect(data).not.toContain(sentinel);
    expect(text).not.toContain(sentinel);
  });

  it('keeps no finding key, finding text, or original wording under any name', () => {
    expect(data).not.toMatch(/findingKey|findingText|originalText|writerEdit/);
  });

  it('shows each to-do’s current wording, status, source, turn, excerpt version, and creation date', () => {
    expect(text).toContain('- [open · medium · stale] Convert the "raucous laughter" reaction into a prop-based event.');
    expect(text).toContain('- [completed · high · stale] Cut the second "very".');
    expect(text).toMatch(/ {2}id todo-1-\d+ in session first-\d+ · from Stock & Signature \(tool stock-and-signature, tool report\) · turn 3 · excerpt v1 \(session ended on v2\) · created Saturday, October 3, 2026/);
  });
});
