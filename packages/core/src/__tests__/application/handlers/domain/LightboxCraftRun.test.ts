/**
 * A press reads all four groups, the craft lenses among them (Slice 4B),
 * through the real LightboxReadingHandler, LightboxService, runner, quote
 * verifier and the real LightboxWriterBaseline over the project catalog.
 * Only the provider is played, with the prompt bundle's worked examples; no
 * provider is called. The board reads ¶1–¶8 of "Alice's Adventures in
 * Wonderland" (1865, public domain); the writer's other chapters are
 * synthetic sentences written for this test.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { InitialRunRequest } from '@orchestration/AgentRunContracts';
import { MessageType } from '@/shared/types/messages';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { CHAPTER, createLightboxReadingHost, examples, groupOf, settle } from './lightboxReadingHarness';

/** 14 words, three sentences, a third of them speech. */
const LINE = '“We are close now,” Tom said. The cart rolled on. He held the reins.';
const OTHER_CHAPTER = Array.from({ length: 80 }, () => LINE).join('\n\n');

async function pressAll() {
  const host = await createLightboxReadingHost({
    /* eslint-disable @typescript-eslint/naming-convention -- keyed by file path. */
    writerChapters: {
      'Chapters/02-the-road.md': OTHER_CHAPTER,
      'Chapters/03-the-mill.md': OTHER_CHAPTER,
      // The board's own file, listed with the chapters: left out of its own average.
      'Drafts/alice-1.md': CHAPTER
    }
    /* eslint-enable @typescript-eslint/naming-convention */
  });
  const tab = host.openTab();
  await tab.run();
  await settle();
  return { host, tab };
}

const requestFor = (calls: Array<[InitialRunRequest]>, group: string) =>
  calls.map(([request]) => request).find((request) => groupOf(request) === group) as InitialRunRequest;

describe('a press with the craft lenses on (Slice 4B)', () => {
  it('measures the writer\'s average from the other chapters, leaving out the board\'s own file', async () => {
    const { host } = await pressAll();
    expect(host.board.measured.numbers.baseline).toEqual({
      kind: 'measured', group: 'chapters', files: 2, words: 2 * 80 * 14, capped: false
    });
    const sentenceLength = host.board.measured.numbers.rows.find((row) => row.stat === 'sentence-length');
    // 2,240 words over 480 sentences, unrounded (PR #155 F-04).
    expect(sentenceLength?.writer?.average).toBe(2_240 / 480);
  });

  it('reads four groups, group D with its own prompt files and a task naming only what stands out', async () => {
    const { host, tab } = await pressAll();
    expect(host.runInitial.mock.calls.map(([request]) => groupOf(request)).sort()).toEqual(['A', 'B', 'C', 'D']);
    const groupD = requestFor(host.runInitial.mock.calls, 'D');
    expect(groupD.systemMessage).toBe(
      'SYSTEM lightbox/00-lightbox-shared.md + lightbox/50-stock-signature.md + lightbox/51-rhythm-handoffs.md + ' +
      'lightbox/52-numbers.md + lightbox/43-example-group-d.md'
    );
    const standouts = host.board.measured.numbers.rows.filter((row) => row.standout).map((row) => row.stat);
    expect(standouts.length).toBeGreaterThan(0);
    const named = [...groupD.userMessage.matchAll(/^- `([a-z-]+)`:/gm)].map((match) => match[1]);
    expect(named).toEqual(standouts);
    expect(groupD.userMessage).toContain(`The rhythm block gives one ending for each of ${host.board.ribbon.length} ribbon columns`);
    // Only group D's task names the figures.
    for (const group of ['A', 'B', 'C']) {
      expect(requestFor(host.runInitial.mock.calls, group).userMessage).not.toContain('stand out');
    }
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload).toMatchObject({ phase: 'finished', groupsBack: 4 });
  });

  it('lands group D on the board: its tiles drawn, and a numbers reading only of a figure that stands out', async () => {
    const { host } = await pressAll();
    const board = host.service.currentBoard();
    const group = board?.readings.find((candidate) => candidate.group === 'D');
    expect(group?.status).toBe('ok');
    const kinds = new Set(group?.tiles.map((tile) => tile.kind));
    expect([...kinds].sort()).toEqual([
      'air-lock', 'echo', 'familiar-phrase', 'handoff', 'number-usage', 'rhythm-endings', 'signature', 'stock-tiers'
    ]);
    const standouts = new Set(board?.measured.numbers.rows.filter((row) => row.standout).map((row) => row.stat));
    const read = (examples.D.response.match(/"stat":"([a-z-]+)"/g) ?? []).map((entry) => entry.slice(8, -1));
    const drawnStats = group?.tiles.flatMap((tile) => (tile.kind === 'number-usage' ? [tile.stat] : []));
    expect(drawnStats).toEqual(read.filter((stat) => standouts.has(stat as never)));
    expect(drawnStats?.length).toBeGreaterThan(0);
    const withheld = group?.withheldClaims.filter((claim) => claim.kind === 'number-usage') ?? [];
    expect(withheld.map((claim) => claim.reason))
      .toEqual(read.filter((stat) => !standouts.has(stat as never)).map(() => LIGHTBOX_GATE_REASONS.numberNotStandout.fresh));
    // Every drawn tile is the run's, minted on the host.
    expect(group?.tiles.every((tile) => tile.id.startsWith('lbt-run-1-'))).toBe(true);
  });

  it('logs counts and outcomes, never the chapter\'s or the other chapters\' text', async () => {
    const { tab } = await pressAll();
    const lines = tab.logged();
    expect(lines).toContain('Group D read');
    expect(lines).toContain('[LightboxWriterBaseline] chapters: 2 file(s), 2240 words');
    expect(lines).not.toContain('Tom said');
    for (const paragraph of examples.A.paragraphs) {
      expect(lines).not.toContain(paragraph.slice(0, 40));
    }
  });
});
