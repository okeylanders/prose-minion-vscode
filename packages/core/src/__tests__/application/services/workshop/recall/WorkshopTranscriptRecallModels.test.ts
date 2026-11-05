/**
 * Models never reach a persona through recall (ADR 2026-11-03 D10). A
 * session saved with model stamps that change mid-room, through the real
 * aggregate, coordinator and store, is recalled in every operation. Neither
 * the service's data nor the rendered text carries a model id, a slice, or a
 * served-by note. The turn preview, which reads turns through the same
 * projection, carries none either.
 */

import type { ModelScope } from '@messages';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');
const FIRST = 'vendor/model-sentinel-first';
const SECOND = 'vendor/model-sentinel-second';
const SERVED = 'vendor/model-sentinel-served';

const stamp = (requestedModelId: string, servedModelIds: string[], scope: ModelScope = 'assistant') =>
  ({ scope, requestedModelId, servedModelIds });

describe('models never reach a persona through recall', () => {
  it('shows no model, slice or served-by note, as data or as text', async () => {
    const saved = await saveRecallRoom('Lighthouse keeper', (session, advance) => {
      session.setExcerpt({ text: 'The keeper climbs the stair.', source: { kind: 'manual' } });
      session.beginPersonaMessage('r-1', 'Why does the keeper climb?');
      advance(1_000);
      session.completeRun('r-1', 'Because the lamp is out.', undefined, false, 'host-conversation',
        [], undefined, undefined, stamp(FIRST, [FIRST]));
      session.beginPersonaMessage('r-2', 'What does he find?');
      advance(1_000);
      // A switch, served by another model than requested: a slice and a served-by note in the thread.
      session.completeRun('r-2', 'A keeper never finds the lamp lit.', undefined, false, 'host-conversation',
        [], undefined, undefined, stamp(SECOND, [SERVED]));
    });
    const stored = (await saved.store.readNamed(saved.savedSessionId))!.workshop.turns;
    expect(stored.filter((turn) => turn.model).map((turn) => turn.model!.requestedModelId)).toEqual([FIRST, SECOND]);

    const service = new WorkshopTranscriptRecallService(saved.store, saved.coordinator, saved.log);
    const catalog = await service.catalog({});
    const search = await service.search({ query: 'keeper' });
    // Words of a model id, which is not in what recall reads, so nothing is found.
    const modelSearch = await service.search({ query: 'sentinel' });
    const read = await service.read({ sessions: [{ sessionId: saved.savedSessionId }] });
    const discussion = await service.read({ sessions: [{ sessionId: saved.savedSessionId }], detail: 'discussion' });
    const todos = await service.todos({ status: 'all' });

    const data = JSON.stringify([catalog, search, modelSearch, read, discussion, todos]);
    const text = [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      renderWorkshopRecallSearch(search, { now: NOW }),
      renderWorkshopRecallSearch(modelSearch, { now: NOW }),
      renderWorkshopRecallRead(read, { now: NOW }).content,
      renderWorkshopRecallRead(discussion, { now: NOW }).content,
      renderWorkshopRecallTodos(todos, { now: NOW }).content
    ].join('\n');
    // The read did reach the stamped replies.
    expect(text).toContain('A keeper never finds the lamp lit.');
    expect(modelSearch.available && modelSearch.outcome === 'searched'
      ? modelSearch.search.matchedHits
      : undefined).toBe(0);
    for (const witness of [FIRST, SECOND, SERVED, 'requestedModelId', 'servedModelIds']) {
      expect(data).not.toContain(witness);
      expect(text).not.toContain(witness);
    }
    expect(text).not.toMatch(/served by|Model ·/);

    const previews = JSON.stringify(stored.map(workshopTurnPreview));
    expect(previews).toContain('A keeper never finds the lamp lit.');
    for (const witness of [FIRST, SECOND, SERVED, '"model"']) {
      expect(previews).not.toContain(witness);
    }
  });
});
