/**
 * A numbers reading that lands after the board was measured again (PR #155
 * F-01): the press read the figures that stood out then; if the writer's
 * average changed what stands out while the call was out, its usages do not
 * land as current. Through the real LightboxReadingHandler, LightboxService
 * and runner; only the provider is played, with the worked example. The
 * board reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain); the writer's averages are synthetic counts.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import type { LightboxReadingGroup } from '@/shared/types/messages';
import type { LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { lightboxGroupLenses, LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { WRITER_AVERAGES } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { CHAPTER, createLightboxReadingHost, groupOf, ok, settle } from './lightboxReadingHarness';

const ABSENT: LightboxWriterAverages = { summary: { kind: 'absent', note: 'No chapter or manuscript files are configured.' } };
const ONLY_D_ON = LIGHTBOX_LENSES.map((lens) => lens.id).filter((lens) => !lightboxGroupLenses('D').includes(lens));

/** Press group D, hold its answer, run `meanwhile`, then let the answer land. */
async function landAfter(meanwhile: (writer: { current: LightboxWriterAverages }) => void) {
  const writer = { current: WRITER_AVERAGES };
  const held: Array<(result: ExecutionResult) => void> = [];
  const host = await createLightboxReadingHost({
    writerBaseline: { measure: async () => writer.current },
    respond: (request) => new Promise<ExecutionResult>((resolve) => { held.push(() => resolve(ok(groupOf(request)))); })
  });
  const tab = host.openTab();
  await tab.setLenses(ONLY_D_ON);
  await tab.run();
  await settle();
  expect(held).toHaveLength(1);
  meanwhile(writer);
  // The same file, read again: same text, same board, measured again.
  const rebuilt = await host.service.buildBoard({
    kind: 'file', text: CHAPTER, displayPath: 'Drafts/alice-1.md', rereadPath: '/workspace/Drafts/alice-1.md'
  });
  expect(rebuilt).toMatchObject({ kind: 'board', reused: true, board: { boardId: host.board.boardId } });
  held[0](undefined as never);
  await settle();
  return host.service.currentBoard()?.readings.find((group) => group.group === 'D') as LightboxReadingGroup;
}

const usages = (group: LightboxReadingGroup) => group.tiles.flatMap((tile) => (tile.kind === 'number-usage' ? [tile.stat] : []));

describe('a numbers reading that lands after the board was measured again (PR #155 F-01)', () => {
  it('does not land its usages as current once the writer\'s average is gone; the rest of the group lands', async () => {
    // Control: measured the same way again, the usages land as read.
    const unchanged = await landAfter(() => undefined);
    expect(unchanged.status).toBe('ok');
    expect(usages(unchanged)).toEqual(['intensifiers', 'sentence-length', 'dialogue']);

    const group = await landAfter((writer) => { writer.current = ABSENT; });
    expect(group.status).toBe('ok');
    expect(usages(group)).toEqual([]);
    expect(group.withheldClaims.filter((claim) => claim.kind === 'number-usage').map((claim) => claim.reason))
      .toEqual(Array(3).fill(LIGHTBOX_GATE_REASONS.numberNotStandout.carried));
    expect(group.tiles.filter((tile) => tile.kind === 'stock-tiers' || tile.kind === 'handoff')).toHaveLength(4);
  });
});
