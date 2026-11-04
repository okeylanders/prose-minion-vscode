/**
 * The model in export headers (ADR 2026-11-03 D10, amended 2026-11-04).
 * Markdown and HTML reply headers name the model after the speaker, by the
 * thread's own rule, from each entry's `model` and the renderer's label
 * lookup. A stamped capability card (a dictionary lookup, a persona-run
 * analysis) stays a one-line event that ends with the same text. The per-turn
 * entry recall reads never carries it. An unstamped header is unchanged, and
 * JSON is byte-identical whatever the labels. Hostile ids render inert.
 */

import { MessageType, type ModelScope, type WorkshopTurn } from '@messages';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptJson } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { WORKSHOP_TRANSCRIPT_MIRRORED_STYLES } from '@/application/services/workshop/export/WorkshopTranscriptHtmlStyles';
import { WorkshopTranscriptExportService } from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import {
  FIXTURE_EPOCH,
  fixtureTurn,
  representativeRoom,
  writerTurn
} from '../transcript/workshopTranscriptFixtures';
import {
  createWorkshopRouteTestHarness,
  message
} from '../../../handlers/domain/workshop/WorkshopRouteTestHarness';

const AUTO = 'vendor/auto';
const A = 'vendor/model-a';
const B = 'vendor/model-b';
const UNLISTED = 'vendor/model-unlisted';
const NAMES: Record<string, string> = { [AUTO]: 'Auto router', [A]: 'Model A', [B]: 'Model B' };
const label = (id: string) => NAMES[id];

const stamp = (requestedModelId: string, servedModelIds = [requestedModelId], scope: ModelScope = 'assistant') =>
  ({ scope, requestedModelId, servedModelIds });

const room: WorkshopTurn[] = [
  writerTurn('u-1', { content: 'First.' }),
  fixtureTurn('a-1', { content: 'Exact.', model: stamp(A) }),
  fixtureTurn('a-2', { content: 'Named none.', model: stamp(A, []) }),
  fixtureTurn('a-3', { content: 'Routed.', model: stamp(AUTO, [B]) }),
  fixtureTurn('a-4', { content: 'Fell back.', model: stamp(A, [A, B]) }),
  fixtureTurn('a-5', { content: 'Unlisted.', model: stamp(AUTO, [UNLISTED]) }),
  fixtureTurn('a-6', { content: 'Unstamped.' }),
  fixtureTurn('g-7', {
    participant: 'guest', personaId: 'felix', personaLabel: 'Felix', content: 'Guest.', model: stamp(AUTO, [A, B])
  }),
  writerTurn('u-8', { artifact: 'direct_tool_message', toolLabel: 'Prose Assistant', content: 'Private.' }),
  fixtureTurn('a-8', {
    participant: 'tool',
    artifact: 'direct_tool_response',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined,
    content: 'Private answer.',
    model: stamp(B)
  }),
  fixtureTurn('d-9', {
    kind: 'tool_run',
    participant: 'tool',
    artifact: 'dictionary_lookup',
    personaId: undefined,
    personaLabel: undefined,
    toolLabel: 'Dictionary',
    capability: {
      operation: 'dictionary.lookup',
      status: 'success',
      requestSummary: 'liminal',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability'],
    content: 'Dictionary evidence body.',
    model: stamp(B, [B], 'dictionary')
  }),
  fixtureTurn('r-10', {
    kind: 'tool_run',
    participant: 'tool',
    artifact: 'tool_report',
    personaId: undefined,
    personaLabel: undefined,
    toolId: 'stock-and-signature',
    toolLabel: 'Stock & Signature',
    capability: {
      operation: 'analysis.run',
      status: 'success',
      requestSummary: 'excerpt replace',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability'],
    content: 'Analysis report body.',
    model: stamp(AUTO, [A])
  }),
  fixtureTurn('d-11', {
    kind: 'tool_run',
    participant: 'tool',
    artifact: 'dictionary_lookup',
    personaId: undefined,
    personaLabel: undefined,
    toolLabel: 'Dictionary',
    capability: {
      operation: 'dictionary.lookup',
      status: 'success',
      requestSummary: 'unstamped',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability'],
    content: 'Dictionary evidence body.'
  })
];

const transcript = (turns: WorkshopTurn[] = room) =>
  projectWorkshopTranscript(turns, {
    title: 'Dock scene',
    exportedAt: FIXTURE_EPOCH,
    bookmarkedTurnIds: new Set(['a-4']),
    modelLabel: label
  });

const markdownHeadings = (markdown: string) => markdown.split('\n').filter((line) => line.startsWith('### '));

describe('the model in Markdown headers', () => {
  it('follows each reply’s speaker, by the thread’s rule', () => {
    expect(markdownHeadings(renderWorkshopTranscriptMarkdown(transcript(), { modelLabel: label }))).toEqual([
      '### Writer',
      '### Jill · Model A',
      '### Jill · Model A',
      '### Jill · Model B via Auto router',
      '### Jill · Model A, Model B · Bookmarked',
      `### Jill · ${UNLISTED} via Auto router`,
      '### Jill',
      '### Felix · Model A, Model B via Auto router',
      '### Writer · private with Prose Assistant',
      '### Prose Assistant · Model B · private'
    ]);
  });

  it('ends a stamped capability card’s one-line event with its model, and nothing else’s', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript(), { modelLabel: label });
    expect(markdown).toContain("\n_Writer's Dictionary · liminal · requested by Jill · success · Model B_\n");
    expect(markdown).toContain('\n_Stock & Signature · excerpt replace · requested by Jill · success · Model A via Auto router_\n');
    expect(markdown).toContain("\n_Writer's Dictionary · unstamped · requested by Jill · success_\n");
    // The card's evidence never leaves the session.
    expect(markdown).not.toMatch(/evidence body|report body/);
  });

  it('names raw ids without a lookup', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript());
    expect(markdownHeadings(markdown)[3]).toBe(`### Jill · ${B} via ${AUTO}`);
    expect(markdown).toContain(`· success · ${A} via ${AUTO}_`);
  });

  it('keeps a header one line, and escapes what a model id could inject', () => {
    const hostile = 'vendor/x\n# Injected *bold* [link](javascript:alert(1))';
    const markdown = renderWorkshopTranscriptMarkdown(
      transcript([fixtureTurn('a-1', { content: 'Body.', model: stamp(AUTO, [hostile]) })]),
      { modelLabel: label }
    );
    expect(markdownHeadings(markdown)).toEqual([
      '### Jill · vendor/x \\# Injected \\*bold\\* \\[link\\](javascript:alert(1)) via Auto router'
    ]);
    expect(markdown).not.toMatch(/^# Injected/m);
  });
});

describe('the model in HTML headers', () => {
  const html = renderWorkshopTranscriptHtml(transcript(), { modelLabel: label });
  /** Each reply header's speaker and model span, read from the markup. */
  const heads = [...html.matchAll(
    /<div class="pm-ws-turn-head"><span class="pm-ws-eyebrow"><svg[^>]*>[\s\S]*?<\/svg> ([^<]*)(?: <span class="pm-ws-turn-model">([^<]*)<\/span>)?<\/span>/g
  )].map(([, speaker, model]) => ({ speaker, model }));
  const headText = ({ speaker, model }: { speaker: string; model?: string }) =>
    model === undefined ? speaker : `${speaker} ${model}`;

  it('follows each reply’s speaker in the thread’s span', () => {
    expect(heads.map(headText)).toEqual([
      'Jill · Model A',
      'Jill · Model A',
      'Jill · Model B via Auto router',
      'Jill · Model A, Model B',
      `Jill · ${UNLISTED} via Auto router`,
      'Jill',
      'Felix · Model A, Model B via Auto router',
      'Prose Assistant · Model B'
    ]);
    expect(html).toContain(
      '</svg> Jill <span class="pm-ws-turn-model">· Model B via Auto router</span></span>'
    );
  });

  it('ends a stamped capability card’s divider with the model’s span', () => {
    expect(html).toContain(
      '<div class="pm-ws-revision-divider" role="separator"><span>Stock &amp; Signature · excerpt replace · ' +
      'requested by Jill · success <span class="pm-ws-turn-model">· Model A via Auto router</span></span></div>'
    );
    expect(html).toContain(
      '<span>Writer&#39;s Dictionary · unstamped · requested by Jill · success</span></div>'
    );
  });

  it('leaves an unstamped reply’s header as it was', () => {
    expect(heads[5]).toEqual({ speaker: 'Jill', model: undefined });
    const unstamped = representativeRoom();
    const meta = { title: 'Dock scene', exportedAt: FIXTURE_EPOCH };
    expect(renderWorkshopTranscriptHtml(projectWorkshopTranscript(unstamped, meta), { modelLabel: label }))
      .toBe(renderWorkshopTranscriptHtml(projectWorkshopTranscript(unstamped, meta)));
    expect(renderWorkshopTranscriptMarkdown(projectWorkshopTranscript(unstamped, meta), { modelLabel: label }))
      .toBe(renderWorkshopTranscriptMarkdown(projectWorkshopTranscript(unstamped, meta)));
  });

  it('renders a hostile model id as inert text', () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const page = renderWorkshopTranscriptHtml(
      transcript([fixtureTurn('a-1', { content: 'Body.', model: stamp(AUTO, [hostile]) })]),
      { modelLabel: label }
    );
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    expect(main).not.toMatch(/<img|<script/);
    expect(main).toContain(
      '<span class="pm-ws-turn-model">· &lt;img src=x onerror=&quot;alert(1)&quot;&gt;' +
      '&lt;script&gt;alert(2)&lt;/script&gt; via Auto router</span>'
    );
  });

  it('styles the model’s span with rules mirrored verbatim from the thread', () => {
    for (const selector of [
      '[data-pm-surface="workshop"] .pm-ws-turn-head > .pm-ws-eyebrow {',
      '[data-pm-surface="workshop"] .pm-ws-turn-head > .pm-ws-eyebrow > svg {',
      '[data-pm-surface="workshop"] .pm-ws-turn-model {'
    ]) {
      expect(WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.some(({ css }) => css.includes(selector))).toBe(true);
    }
  });
});

describe('what the header label never reaches', () => {
  it('leaves JSON byte-identical whatever the labels', () => {
    const json = renderWorkshopTranscriptJson(transcript());
    const unlabeled = renderWorkshopTranscriptJson(
      projectWorkshopTranscript(room, { title: 'Dock scene', exportedAt: FIXTURE_EPOCH, bookmarkedTurnIds: new Set(['a-4']) })
    );
    expect(json).toBe(unlabeled);
    expect(json).not.toMatch(/Model A|Auto router| via /);
  });

  it('is never in the per-turn entry recall reads', () => {
    for (const turn of room) {
      const entry = JSON.stringify(projectWorkshopTranscriptTurn(turn) ?? {});
      expect(entry).not.toMatch(/vendor\/|Model [AB]|Auto router|"model"/);
    }
  });

  it('is written by the real export route, through the service’s port', async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    const { session } = harness;
    session.beginPersonaMessage('r-1', 'Why does the keeper climb?');
    session.completeRun('r-1', 'Because the lamp is out.', undefined, false, 'host-conversation',
      [], undefined, undefined, stamp(AUTO, [B]));
    for (const format of ['markdown', 'html'] as const) {
      await harness.router.route(message(MessageType.WORKSHOP_EXPORT_SESSION, { format, title: `Keeper ${format}` }) as never);
    }
    const [markdown, html] = harness.transcriptFiles.writeNew.mock.calls.map((call) => call[2]);
    expect(markdown).toMatch(new RegExp(`^### .+ · ${B} via ${AUTO}$`, 'm'));
    expect(html).toContain(`<span class="pm-ws-turn-model">· ${B} via ${AUTO}</span>`);

    const files = { writeNew: jest.fn(async () => ({ absolutePath: '/x/keeper.md', relativePath: 'keeper.md' })) };
    await new WorkshopTranscriptExportService(
      { readRoomLedger: () => room, readBookmarkedTurnIds: () => new Set<string>() },
      files,
      () => FIXTURE_EPOCH,
      label
    ).export({ format: 'markdown', title: 'Keeper' });
    const written = (files.writeNew.mock.calls[0] as unknown as [string, string, string])[2];
    expect(written).toContain('### Jill · Model B via Auto router');
  });
});
