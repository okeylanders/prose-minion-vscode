/**
 * Bring to Workshop for group E's readings (ADR 2026-10-19 D11; Slice 4C):
 * every new reading travels by its id alone, the host resolving it on its
 * own board, with its host counts and joins as labeled points, its quotes
 * checked again against the chapter and bounded, and the item passes the
 * Workshop's own validator. A thread travels with its plant and resolution,
 * a synopsis with two quotes, a movement with its boundary, or not at all;
 * the freshness basis travels only when both of its halves are current, and
 * a movement's engagement only while the template that reads it is. The
 * board reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain).
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { LIGHTBOX_TILE_HANDOFF_REFUSALS, prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { LIGHTBOX_PLOT_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxPlotHandoff';
import { renderWorkshopLightboxTile, validateWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { LIGHTBOX_BASIS_LINES, lightboxFreshnessBasis } from '@shared/constants/lightboxPlot';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { ALICE, storyBody, storyGroup } from './lightboxPlotFixtures';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;
const BASIS = '8 of 16 classified beats signature (50%) · 2 of 5 template beats subverted';

/** The board with groups D and E read, or with `replacing` in place of either. */
async function storyBoard(...replacing: LightboxReadingGroup[]): Promise<LightboxBoard> {
  const board = await boardWithNumbers(ALICE);
  const read = [...replacing, readGroup('D'), storyGroup()];
  return { ...board, readings: board.readings.map((group) => read.find((candidate) => candidate.group === group.group) ?? group) };
}

const staleOn = (group: LightboxReadingGroup, lens: LightboxReadingGroup['lenses'][number]): LightboxReadingGroup =>
  ({ ...group, staleLenses: [{ lens, readAgainst: 'old' }] });
const storyTiles = (board: LightboxBoard): LightboxReadingTile[] =>
  board.readings.filter((group) => group.group === 'E').flatMap((group) => group.tiles);
const tileTitled = (board: LightboxBoard, title: string): LightboxReadingTile => {
  const tile = storyTiles(board).find((candidate) => candidate.title === title);
  if (!tile) {
    throw new Error(`no tile titled ${title}`);
  }
  return tile;
};
const ofKind = (board: LightboxBoard, kind: LightboxReadingTile['kind']): LightboxReadingTile =>
  storyTiles(board).find((tile) => tile.kind === kind) as LightboxReadingTile;
const bring = (board: LightboxBoard, tile: LightboxReadingTile, paragraphs: readonly string[] = ALICE) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);
const brought = (board: LightboxBoard, tile: LightboxReadingTile, paragraphs: readonly string[] = ALICE) => {
  const prepared = bring(board, tile, paragraphs);
  if (!prepared.ok) {
    throw new Error(`${tile.kind} ${tile.title}: ${prepared.reason}`);
  }
  return prepared.handoff.tile;
};
const edit = (index: number, from: string, to: string): string[] =>
  ALICE.map((text, at) => (at === index - 1 ? text.replace(from, to) : text));

describe('bringing a group E reading to the Workshop', () => {
  let board: LightboxBoard;
  beforeAll(async () => {
    board = await storyBoard();
  });

  it('brings every new kind by its id, bounded, with points the Workshop accepts', () => {
    const kinds = new Set<string>();
    for (const tile of storyTiles(board)) {
      const sent = brought(board, tile);
      kinds.add(tile.kind);
      expect(validateWorkshopLightboxTile(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
      expect(sent).toMatchObject({ origin: 'lightbox', boardId: board.boardId, tileId: tile.id });
      expect(sent.quotes.length).toBeGreaterThan(0);
      expect(sent.quotes.length).toBeLessThanOrEqual(LIMITS.quotes);
      expect(sent.points.length).toBeLessThanOrEqual(LIMITS.points);
      for (const quote of sent.quotes) {
        expect(ALICE[quote.paragraph - 1]).toContain(quote.text);
      }
    }
    expect([...kinds].sort()).toEqual(['artifact', 'movement', 'pressure-thread', 'synopsis', 'template', 'template-beat']);
  });

  it('labels each story reading\'s host counts, joins and fields as its points', () => {
    const template = brought(board, ofKind(board, 'template'));
    expect(template.points).toEqual([
      { label: 'Freshness', text: 'Fresh · a reading, not a grade' },
      { label: 'Basis', text: BASIS },
      { label: 'Engagement', text: 'I low · II high · III medium' }
    ]);
    expect(renderWorkshopLightboxTile(template)).toContain('Freshness: Fresh · a reading, not a grade');
    expect(brought(board, ofKind(board, 'template-beat')).points).toEqual([{ label: 'Stance', text: 'Departs' }]);
    expect(brought(board, tileTitled(board, 'Where is the Rabbit hurrying, and why is it late?')).points).toEqual([
      { label: 'Planted', text: '¶4' },
      { label: 'Builds', text: '¶4' },
      { label: 'Ends', text: 'Still open, carried out of the chapter' }
    ]);
    expect(brought(board, tileTitled(board, 'How will she get out again?')).points).toEqual([
      { label: 'Planted', text: '¶5' },
      { label: 'Ends', text: 'Still open, carried out of the chapter · dormant since ¶5' }
    ]);
    expect(brought(board, tileTitled(board, 'What is in the jar she takes down?')).points).toEqual([
      { label: 'Planted', text: '¶7' },
      { label: 'Ends', text: 'Resolved in ¶7' }
    ]);
    expect(brought(board, tileTitled(board, "Her sister's book")).points).toEqual([
      { label: 'Counted', text: '×2 · first ¶2, counted by code' },
      { label: 'Arc', text: 'peeped into → found wanting' },
      { label: 'Unused', text: 'Planted, unused: every mention within 2 ¶ of its first' }
    ]);
    expect(brought(board, tileTitled(board, 'The watch')).points.map((point) => point.label)).toEqual(['Counted', 'Arc']);
    expect(brought(board, ofKind(board, 'synopsis')).points).toEqual([]);
    expect(brought(board, tileTitled(board, 'The chase')).points).toEqual([
      { label: 'Range', text: '¶4–¶5 · movement II of 3' },
      { label: 'Engagement', text: 'High · a reading of pull, not tension' }
    ]);
  });

  it('sends a thread\'s plant first and its resolution second, then what builds', () => {
    expect(brought(board, tileTitled(board, 'What is in the jar she takes down?')).quotes).toEqual([
      { paragraph: 7, text: 'She took down a jar from one of the shelves as she passed' },
      { paragraph: 7, text: 'to her great disappointment it was empty' }
    ]);
    expect(brought(board, tileTitled(board, 'Will the fall ever end?')).quotes.map((quote) => quote.paragraph)).toEqual([6, 7]);
  });

  it('keeps plant and resolution when bounding a thread to the Workshop\'s quotes drops what builds', async () => {
    const body = storyBody();
    body.pressure.threads[2].escalations.push(
      { para: 7, quote: 'she had plenty of time as she went down to look about her' },
      { para: 8, quote: 'I shall think nothing of tumbling down stairs!' }
    );
    body.pressure.threads[2].resolution = { para: 8, quote: 'even if I fell off the top of the house' };
    const long = await storyBoard(storyGroup(body));
    const fall = tileTitled(long, 'Will the fall ever end?');
    expect(fall.evidence).toHaveLength(LIMITS.quotes + 1);
    const sent = brought(long, fall);
    expect(sent.quotes.map((quote) => quote.text)).toEqual([
      'she found herself falling down a very deep well',
      'even if I fell off the top of the house',
      'Either the well was very deep, or she fell very slowly',
      'she had plenty of time as she went down to look about her'
    ]);
    expect(sent.points).toEqual([
      { label: 'Planted', text: '¶6' },
      { label: 'Builds', text: '¶7, ¶7, ¶8' },
      { label: 'Ends', text: 'Resolved in ¶8' }
    ]);
  });

  it('refuses a thread whose plant or resolution can no longer travel, and sends one without a lost escalation', () => {
    const fall = tileTitled(board, 'Will the fall ever end?');
    expect(bring(board, fall, edit(6, 'she found herself falling down a very deep well', 'she found herself in a well')))
      .toEqual({ ok: false, reason: LIGHTBOX_PLOT_HANDOFF_REFUSALS.threadAnchors });
    const jar = tileTitled(board, 'What is in the jar she takes down?');
    expect(bring(board, jar, edit(7, 'to her great disappointment it was empty', 'it was full')))
      .toEqual({ ok: false, reason: LIGHTBOX_PLOT_HANDOFF_REFUSALS.threadAnchors });
    const rabbit = tileTitled(board, 'Where is the Rabbit hurrying, and why is it late?');
    const withoutWatch = brought(board, rabbit, edit(4, 'TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET', 'took out a watch'));
    expect(withoutWatch.quotes).toEqual([{ paragraph: 4, text: 'Oh dear! Oh dear! I shall be late!' }]);
  });

  it('sends a synopsis with two of its quotes, and refuses it with fewer', () => {
    const synopsis = ofKind(board, 'synopsis');
    expect(brought(board, synopsis).quotes.map((quote) => quote.paragraph)).toEqual([3, 5, 7]);
    const oneGone = edit(3, 'a White Rabbit with pink eyes ran close by her', 'a rabbit ran by');
    expect(brought(board, synopsis, oneGone).quotes.map((quote) => quote.paragraph)).toEqual([5, 7]);
    const twoGone = oneGone.map((text, at) => (at === 4 ? text.replace('In another moment down went Alice after it', 'She followed') : text));
    expect(bring(board, synopsis, twoGone)).toEqual({ ok: false, reason: LIGHTBOX_PLOT_HANDOFF_REFUSALS.synopsisQuotes });
  });

  it('sends one movement at a time with its boundary, and refuses one whose boundary is gone', () => {
    const chase = tileTitled(board, 'The chase');
    expect(brought(board, chase).quotes).toEqual([{ paragraph: 4, text: 'There was nothing so VERY remarkable in that' }]);
    const well = tileTitled(board, 'The well');
    expect(bring(board, well, edit(6, 'The rabbit-hole went straight on like a tunnel for some way', 'The hole went on')))
      .toEqual({ ok: false, reason: LIGHTBOX_PLOT_HANDOFF_REFUSALS.boundary });
  });

  describe('a join travels only while both its halves are current', () => {
    it('leaves the basis out when group D is stale, missing or being read again, and keeps the rest', async () => {
      const cases: Array<[LightboxReadingGroup, string]> = [
        [staleOn(readGroup('D'), 'stock'), LIGHTBOX_BASIS_LINES.staleStock],
        [{ ...readGroup('D'), status: 'running', pending: ['stock'] }, LIGHTBOX_BASIS_LINES.reading],
        [{ group: 'D', status: 'not-run', lenses: [], tiles: [], withheldBlocks: [], withheldClaims: [], frictions: [], quoteChecks: [] }, LIGHTBOX_BASIS_LINES.missingStock]
      ];
      for (const [D, line] of cases) {
        const without = await storyBoard(D);
        expect(lightboxFreshnessBasis(without.readings).line).toBe(line);
        expect(brought(without, ofKind(without, 'template')).points).toEqual([
          { label: 'Freshness', text: 'Fresh · a reading, not a grade' },
          { label: 'Engagement', text: 'I low · II high · III medium' }
        ]);
      }
    });

    it('leaves a movement\'s engagement out while the template that reads it is stale, and refuses the stale template', async () => {
      const staleTemplate = await storyBoard(staleOn(storyGroup(), 'template'));
      expect(brought(staleTemplate, tileTitled(staleTemplate, 'The chase')).points).toEqual([
        { label: 'Range', text: '¶4–¶5 · movement II of 3' }
      ]);
      expect(bring(staleTemplate, ofKind(staleTemplate, 'template')))
        .toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.stale });
    });
  });
});
