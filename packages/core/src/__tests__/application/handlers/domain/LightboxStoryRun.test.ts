/**
 * A press reads group E, the story lenses (Slice 4C), through the real
 * LightboxReadingHandler, LightboxService, runner, quote verifier and term
 * counter. Only the provider is played, with the prompt bundle's worked
 * examples; no provider is called. Group E is asked with its own prompt
 * files and a task naming the board's paragraph count, never another
 * group's numbers; its tiles land minted on the host; and a template or
 * summary re-read is one call for both, replacing both and keeping the
 * group's other lenses. The board reads ¶1–¶8 of "Alice's Adventures in
 * Wonderland" (1865, public domain).
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { InitialRunRequest } from '@orchestration/AgentRunContracts';
import type { LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { MessageType } from '@/shared/types/messages';
import { frame, framedJson } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { createLightboxReadingHost, examples, groupOf, ok, settle } from './lightboxReadingHarness';

const STORY_KEYS = 'exactly these lens keys: "template", "pressure", "artifacts", "summary".';
const REREAD_KEYS = 'exactly these lens keys: "template", "summary".';

/** The worked example's template and summary blocks, with the template renamed so a re-read is visible. */
function rereadResponse(): string {
  const body = framedJson(examples.E.response) as Record<string, Record<string, unknown>>;
  return frame('E', { version: 1, template: { ...body.template, name: 'Portal descent, read again' }, summary: body.summary });
}

async function pressStory() {
  const host = await createLightboxReadingHost({
    respond: (request) => (request.userMessage.includes(REREAD_KEYS) ? ok('E', rereadResponse()) : ok(groupOf(request)))
  });
  const tab = host.openTab();
  await tab.run();
  await settle();
  return { host, tab };
}

const storyRequests = (calls: Array<[InitialRunRequest]>) =>
  calls.map(([request]) => request).filter((request) => groupOf(request) === 'E');
const groupE = (host: Awaited<ReturnType<typeof pressStory>>['host']): LightboxReadingGroup => {
  const group = host.service.currentBoard()?.readings.find((candidate) => candidate.group === 'E');
  if (!group) {
    throw new Error('expected group E on the board');
  }
  return group;
};
const idsOf = (tiles: readonly LightboxReadingTile[], lens: LightboxReadingTile['lens']) =>
  tiles.filter((tile) => tile.lens === lens).map((tile) => tile.id);

describe('a press with the story lenses on (Slice 4C)', () => {
  it('asks group E with its own prompt files and the worked example\'s task, byte for byte', async () => {
    const { host } = await pressStory();
    const [request] = storyRequests(host.runInitial.mock.calls);
    expect(request.systemMessage).toBe(
      'SYSTEM lightbox/00-lightbox-shared.md + lightbox/53-template.md + lightbox/54-pressure.md + ' +
      'lightbox/55-artifacts.md + lightbox/56-summary-movements.md + lightbox/44-example-group-e.md'
    );
    // The board is the worked example's chapter with no context, so its request is the example's own.
    expect(request.userMessage).toBe(examples.E.request);
    expect(request.userMessage).toContain(STORY_KEYS);
    expect(request.userMessage).toContain('The movements cover all 8 paragraphs: the first starts at ¶1 and the last ends at ¶8.');
  });

  it('never sends a count from another group: no task names the freshness basis', async () => {
    const { host } = await pressStory();
    for (const [request] of host.runInitial.mock.calls) {
      expect(request.userMessage).not.toMatch(/classified beats|template beats subverted|signature \(/);
    }
  });

  it('lands group E on the board: every kind drawn, minted on the host, with engagement on its movements', async () => {
    const { host, tab } = await pressStory();
    const group = groupE(host);
    expect(group.status).toBe('ok');
    expect([...new Set(group.tiles.map((tile) => tile.kind))].sort())
      .toEqual(['artifact', 'movement', 'pressure-thread', 'synopsis', 'template', 'template-beat']);
    expect(group.tiles.every((tile) => tile.id.startsWith('lbt-run-1-'))).toBe(true);
    expect(group.withheldClaims).toEqual([]);
    const movements = group.tiles.filter((tile) => tile.kind === 'movement');
    const template = group.tiles.find((tile) => tile.kind === 'template');
    expect(template?.kind === 'template' && template.engagement.map((mark) => mark.movementId))
      .toEqual(movements.map((movement) => movement.id));
    // The Sections lane is measured from the board, never read.
    expect(host.service.currentBoard()?.measured.sections.signal).toBe('none');
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload).toMatchObject({ phase: 'finished', groupsBack: 6 });
  });

  it('re-reads the template with the summary in one call, replacing both and keeping pressure and artifacts', async () => {
    const { host, tab } = await pressStory();
    const before = groupE(host).tiles;
    const estimate = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    const priced = estimate?.rereads.find((call) => call.lenses.includes('template'));
    expect(priced?.lenses).toEqual(['template', 'summary']);

    host.runInitial.mockClear();
    await tab.run({ mode: 'lens', lens: 'template' });
    await settle();
    const calls = host.runInitial.mock.calls.map(([request]) => request);
    expect(calls).toHaveLength(1);
    expect(calls[0].userMessage).toContain(REREAD_KEYS);
    expect(calls[0].userMessage).toContain('The template block\'s engagement gives exactly one level for each movement');

    const after = groupE(host);
    expect(after.status).toBe('ok');
    expect(after.lenses).toEqual(['template', 'pressure', 'artifacts', 'summary']);
    expect(idsOf(after.tiles, 'pressure')).toEqual(idsOf(before, 'pressure'));
    expect(idsOf(after.tiles, 'artifacts')).toEqual(idsOf(before, 'artifacts'));
    for (const lens of ['template', 'summary'] as const) {
      expect(idsOf(after.tiles, lens).length).toBe(idsOf(before, lens).length);
      expect(idsOf(after.tiles, lens).every((id) => id.startsWith('lbt-run-2-'))).toBe(true);
    }
    expect(after.tiles.find((tile) => tile.kind === 'template')?.title).toBe('Portal descent, read again');
    // Engagement names the new movements, never the ones it replaced.
    const template = after.tiles.find((tile) => tile.kind === 'template');
    expect(template?.kind === 'template' && template.engagement.map((mark) => mark.movementId))
      .toEqual(after.tiles.filter((tile) => tile.kind === 'movement').map((movement) => movement.id));
  });

  it('re-reads a summary tile with the template too: one call for both lenses', async () => {
    const { host, tab } = await pressStory();
    host.runInitial.mockClear();
    await tab.run({ mode: 'lens', lens: 'summary' });
    await settle();
    expect(host.runInitial.mock.calls.map(([request]) => request.userMessage.includes(REREAD_KEYS))).toEqual([true]);
  });

  it('re-reads the template alone while the summary lens is off, asking for no engagement and drawing none', async () => {
    const templateOnly = (): string => {
      const body = framedJson(examples.E.response) as Record<string, Record<string, unknown>>;
      return frame('E', { version: 1, template: { ...body.template, engagement: [] } });
    };
    const host = await createLightboxReadingHost({
      respond: (request) => (request.userMessage.includes('exactly these lens keys: "template".') ? ok('E', templateOnly()) : ok(groupOf(request)))
    });
    const tab = host.openTab();
    await tab.run();
    await settle();
    const movements = idsOf(groupE(host).tiles, 'summary');
    host.runInitial.mockClear();
    await tab.setLenses(['summary']);
    await tab.run({ mode: 'lens', lens: 'template' });
    await settle();
    const [request] = host.runInitial.mock.calls.map(([call]) => call);
    expect(request.userMessage).toContain('The movements are not read in this call: give the template block\'s engagement as an empty list.');
    const after = groupE(host);
    expect(idsOf(after.tiles, 'summary')).toEqual(movements);
    const template = after.tiles.find((tile) => tile.kind === 'template');
    expect(template?.kind === 'template' && template.engagement).toEqual([]);
    expect(after.withheldClaims).toEqual([]);
  });

  it('logs counts and outcomes for group E, never the chapter\'s text or the reading\'s', async () => {
    const { tab } = await pressStory();
    const lines = tab.logged();
    expect(lines).toContain('Group E read');
    for (const paragraph of examples.E.paragraphs) {
      expect(lines).not.toContain(paragraph.slice(0, 40));
    }
    expect(lines).not.toContain('Portal descent');
    expect(lines).not.toContain('Down the Rabbit-Hole');
  });
});
