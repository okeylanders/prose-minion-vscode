/**
 * Models in transcript export (ADR 2026-11-03 D8, D10). The projection runs
 * the thread's own derivation over every turn and prints each slice before
 * the first entry at or after its turn, so a turn export omits never drops
 * one. JSON carries each stamped entry's `model`, with `formatVersion`
 * unchanged; Markdown and HTML draw the slices, the HTML with the thread's
 * divider markup and mirrored rules. The last case runs the real export route
 * over the live room.
 */

import { MessageType, type ModelScope, type WorkshopTurn } from '@messages';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { buildWorkshopTranscriptJsonDocument } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import {
  WORKSHOP_TRANSCRIPT_HTML_CSS,
  WORKSHOP_TRANSCRIPT_MIRRORED_STYLES
} from '@/application/services/workshop/export/WorkshopTranscriptHtmlStyles';
import {
  dividerTurn,
  FIXTURE_EPOCH,
  fixtureTurn,
  representativeRoom,
  writerTurn
} from '../transcript/workshopTranscriptFixtures';
import { WorkshopTranscriptExportService } from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import {
  createWorkshopRouteTestHarness,
  message
} from '../../../handlers/domain/workshop/WorkshopRouteTestHarness';

const A = 'vendor/model-a';
const B = 'vendor/model-b';
const C = 'vendor/model-c';
const NAMES: Record<string, string> = { [A]: 'Model A', [B]: 'Model B' };

const stamp = (requestedModelId: string, scope: ModelScope = 'assistant', servedModelIds = [requestedModelId]) =>
  ({ scope, requestedModelId, servedModelIds });

const dictionaryCard = (id: string, model: string): WorkshopTurn => fixtureTurn(id, {
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'dictionary_lookup',
  personaId: undefined,
  personaLabel: undefined,
  toolLabel: 'Dictionary',
  capability: {
    operation: 'dictionary.lookup',
    status: 'success',
    requestSummary: '“liminal”',
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  } as WorkshopTurn['capability'],
  content: 'Dictionary evidence body.',
  model: stamp(model, 'dictionary')
});

const room: WorkshopTurn[] = [
  dividerTurn('s-1', 'session_start', 'Session started'),
  writerTurn('u-1', { content: 'First question.' }),
  fixtureTurn('a-1', { content: 'First answer.', model: stamp(A) }),
  // Export omits a context change; the thread shows it.
  dividerTurn('c-1', 'context_change', 'Context updated'),
  writerTurn('u-2', { content: 'Second question.' }),
  dictionaryCard('d-2', C),
  fixtureTurn('a-2', { content: 'Second answer.', model: stamp(B, 'assistant', [A]) }),
  // A private exchange is placed by turn order, whoever heard it.
  writerTurn('u-3', { artifact: 'direct_tool_message', toolLabel: 'Prose Assistant', content: 'Private question.' }),
  fixtureTurn('a-3', {
    participant: 'tool',
    artifact: 'direct_tool_response',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined,
    content: 'Private answer.',
    model: stamp(A)
  }),
  // A blank writer turn prints nothing, so its slice goes before the reply.
  writerTurn('u-4', { content: '   ' }),
  fixtureTurn('a-4', { content: 'Fourth answer.', model: stamp(B) }),
  writerTurn('u-5', { content: 'Fifth question.' }),
  // A blank reply prints nothing either; its slice stands before its writer turn.
  fixtureTurn('a-5', { content: '', model: stamp(C) }),
  fixtureTurn('a-6', { content: '', model: stamp(A) })
];

const transcript = (turns = room, modelLabel?: (id: string) => string | undefined) =>
  projectWorkshopTranscript(turns, { title: 'Dock scene', exportedAt: FIXTURE_EPOCH, modelLabel });

const lines = (turns = room, modelLabel: (id: string) => string | undefined = (id) => NAMES[id]) =>
  transcript(turns, modelLabel).entries.map((entry) =>
    entry.kind === 'model-slice' ? entry.text : entry.turnId
  );

describe('model slices in the transcript projection', () => {
  it('prints each slice before the first entry at or after its turn, named by the host', () => {
    expect(lines()).toEqual([
      's-1', 'u-1', 'a-1',
      'Model · Model A → Model B', 'u-2', 'd-2', 'a-2',
      'Model · Model B → Model A', 'u-3', 'a-3',
      'Model · Model A → Model B', 'a-4',
      `Model · Model B → ${C}`, 'u-5',
      // The last reply prints nothing and no turn follows it: the slice still closes the transcript.
      `Model · ${C} → Model A`
    ]);
  });

  it('names every model by its raw id when the host names none', () => {
    expect(lines(room, () => undefined).filter((line) => line.startsWith('Model'))).toEqual([
      `Model · ${A} → ${B}`, `Model · ${B} → ${A}`, `Model · ${A} → ${B}`, `Model · ${B} → ${C}`, `Model · ${C} → ${A}`
    ]);
  });

  it('places the same slices whatever the names', () => {
    const placement = (label: (id: string) => string | undefined) =>
      transcript(room, label).entries.map((entry) =>
        entry.kind === 'model-slice' ? `${entry.scope}:${entry.fromModelId}>${entry.toModelId}` : entry.turnId
      );
    expect(placement(() => undefined)).toEqual(placement((id) => NAMES[id]));
    expect(placement((id) => `Other name for ${id}`)).toEqual(placement((id) => NAMES[id]));
  });

  it('carries each stamped reply’s and capability card’s model, and nothing on other entries', () => {
    const byTurn = new Map(transcript().entries.flatMap((entry) =>
      entry.kind === 'model-slice' ? [] : [[entry.turnId, entry] as const]
    ));
    expect(byTurn.get('a-2')).toMatchObject({ model: stamp(B, 'assistant', [A]) });
    expect(byTurn.get('d-2')).toMatchObject({ kind: 'event', model: stamp(C, 'dictionary') });
    for (const turnId of ['s-1', 'u-1', 'u-2', 'u-3', 'u-5']) {
      expect('model' in byTurn.get(turnId)!).toBe(false);
    }
  });

  it('leaves a transcript without stamps exactly as it was', () => {
    const unstamped = representativeRoom();
    const projected = transcript(unstamped);
    expect(projected.entries.some((entry) => entry.kind === 'model-slice')).toBe(false);
    expect(JSON.stringify(projected)).not.toMatch(/"model"|requestedModelId/);
  });

  it('never gives a turn’s own entry its model, so recall and the preview never see one', () => {
    for (const turn of room) {
      const entry = projectWorkshopTranscriptTurn(turn);
      expect(entry === undefined || !('model' in entry)).toBe(true);
    }
  });

  it('counts slices as neither messages nor participants', () => {
    const projected = transcript();
    expect(projected.participants).toEqual(['Jill', 'Prose Assistant']);
    expect(renderWorkshopTranscriptMarkdown(projected)).toContain('· 8 messages ·');
  });
});

describe('model slices in each export format', () => {
  it('carries `model` in JSON, prints no slice entry, and keeps the format version', () => {
    const document = buildWorkshopTranscriptJsonDocument(transcript());

    expect(document.formatVersion).toBe(1);
    expect(document.entries).toHaveLength(transcript().entries.filter((entry) => entry.kind !== 'model-slice').length);
    expect(document.entries.map((entry) => ('model' in entry ? entry.model?.requestedModelId : undefined)))
      .toEqual([undefined, undefined, A, undefined, C, B, undefined, A, B, undefined]);
    expect(document.entries.find((entry) => entry.kind === 'reply' && entry.content === 'Second answer.'))
      .toMatchObject({ model: { scope: 'assistant', requestedModelId: B, servedModelIds: [A] } });
    expect(JSON.stringify(buildWorkshopTranscriptJsonDocument(transcript(representativeRoom()))))
      .not.toMatch(/"model"/);
  });

  it('draws slices in Markdown as dividers', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript(room, (id) => NAMES[id]));
    expect(markdown).toContain('---\n\n_Model · Model A → Model B_\n\n---\n\n### Writer\n\nSecond question.');
    expect(markdown).toContain(`_Model · ${C} → Model A_\n`);
    expect(markdown).not.toContain(A);
  });

  it('draws slices in HTML with the thread’s divider markup and accessible name', () => {
    const html = renderWorkshopTranscriptHtml(transcript(room, (id) => NAMES[id]));
    const dividers = html.match(/<div class="pm-ws-revision-divider pm-ws-session-divider pm-ws-model-slice"[^>]*>/g)!;

    expect(dividers).toHaveLength(5);
    expect(dividers[0]).toBe(
      '<div class="pm-ws-revision-divider pm-ws-session-divider pm-ws-model-slice" role="separator" ' +
      `aria-label="Model · Model A → Model B" title="${A} → ${B}">`
    );
    expect(html).toMatch(/pm-ws-model-slice"[^>]*><span><svg[^>]*aria-hidden="true">.*?<\/svg>Model · Model A → Model B<\/span><\/div>/);
  });

  it('styles the divider with rules mirrored verbatim from the thread', () => {
    // The span's layout is the slice's one rule; the rest are the revision divider's.
    for (const selector of [
      '[data-pm-surface="workshop"] .pm-ws-model-slice span {',
      '[data-pm-surface="workshop"] .pm-ws-revision-divider {'
    ]) {
      expect(WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.some(({ css }) => css.includes(selector))).toBe(true);
    }
    expect(WORKSHOP_TRANSCRIPT_HTML_CSS).not.toContain('pm-ws-session-divider');
  });

  it('exports the live room’s slices and models through the real route', async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    const { session } = harness;
    session.beginPersonaMessage('r-1', 'Why does the keeper climb?');
    session.completeRun('r-1', 'Because the lamp is out.', undefined, false, 'host-conversation',
      [], undefined, undefined, stamp(A));
    session.beginPersonaMessage('r-2', 'And then?');
    session.completeRun('r-2', 'He waits.', undefined, false, 'host-conversation',
      [], undefined, undefined, stamp(B, 'assistant', [C]));

    for (const format of ['markdown', 'json', 'html'] as const) {
      await harness.router.route(message(MessageType.WORKSHOP_EXPORT_SESSION, { format, title: `Keeper ${format}` }) as never);
    }
    const [markdown, json, html] = harness.transcriptFiles.writeNew.mock.calls.map((call) => call[2]);
    expect(markdown).toContain(`_Model · ${A} → ${B}_\n\n---\n\n### Writer\n\nAnd then?`);
    expect(JSON.parse(json).entries.at(-1).model).toEqual({ scope: 'assistant', requestedModelId: B, servedModelIds: [C] });
    expect(html).toContain(`aria-label="Model · ${A} → ${B}"`);
  });

  it('names models through the service’s port, with the raw id as the fallback', async () => {
    const files = { writeNew: jest.fn(async () => ({ absolutePath: '/x/keeper.md', relativePath: 'keeper.md' })) };
    const service = new WorkshopTranscriptExportService(
      { readRoomLedger: () => room, readBookmarkedTurnIds: () => new Set<string>() },
      files,
      () => FIXTURE_EPOCH,
      (id) => NAMES[id]
    );
    await service.export({ format: 'markdown', title: 'Keeper' });
    const written = (files.writeNew.mock.calls[0] as unknown as [string, string, string])[2];
    expect(written).toContain('_Model · Model A → Model B_');
    expect(written).toContain(`_Model · Model B → ${C}_`);
  });
});

describe('the host’s model names', () => {
  it('are the curated names the webview’s options carry, and nothing for an id it does not know', () => {
    const [curated] = OpenRouterModels.getRecommendedModels();
    expect(OpenRouterModels.getDisplayName(curated.id)).toBe(curated.name);
    expect(OpenRouterModels.getDisplayName('vendor/not-in-any-catalog')).toBeUndefined();
  });
});
