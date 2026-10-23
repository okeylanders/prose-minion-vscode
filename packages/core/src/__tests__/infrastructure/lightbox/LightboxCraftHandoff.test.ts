/**
 * Bring to Workshop for group D's readings (ADR 2026-10-19 D11; Slice 4B):
 * every new reading travels by its id with its own host counts as labeled
 * points, its quotes checked again against the chapter and bounded, and the
 * item passes the Workshop's own validator. A handoff travels with both its
 * sentences or not at all, and a numbers reading's quotes are checked again
 * with its figure's instance filter. The board reads ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), measured against the
 * fixture writer's synthetic averages.
 */
import type { LightboxBoard, LightboxHandoffTile, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { LIGHTBOX_ELLIPSIS, clipLightboxText } from '@shared/constants/lightboxClip';
import {
  LIGHTBOX_TILE_HANDOFF_REFUSALS,
  prepareLightboxTileHandoff
} from '@/infrastructure/lightbox/LightboxTileHandoff';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { validateWorkshopLightboxTile, renderWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { readWorkedExample } from './lightboxReadingFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;
const ALICE = readWorkedExample('D').paragraphs;

async function readBoard(): Promise<LightboxBoard> {
  const board = await boardWithNumbers(ALICE);
  const example = readWorkedExample('D');
  const decoded = decodeLightboxGroup(example.response, { group: 'D', lenses: example.lenses, columnCount: board.ribbon.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(ALICE),
    counter: createLightboxTermCounter(ALICE),
    mintId: () => `lbt-d-${++id}`,
    columnKeys: lightboxColumnKeys(ALICE, board.ribbon),
    standouts: lightboxStandoutRows(board.measured.numbers.rows)
  });
  const group: LightboxReadingGroup = {
    group: 'D', status: 'ok', lenses: example.lenses, tiles: assembled.tiles, withheldBlocks: [], withheldClaims: [],
    frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
  return { ...board, readings: board.readings.map((candidate) => (candidate.group === 'D' ? group : candidate)) };
}

const tilesOf = (board: LightboxBoard): LightboxReadingTile[] => board.readings.flatMap((group) => group.tiles);
const bring = (board: LightboxBoard, tile: LightboxReadingTile, paragraphs: readonly string[] = ALICE) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);

describe('bringing a group D reading to the Workshop', () => {
  let board: LightboxBoard;
  beforeAll(async () => {
    board = await readBoard();
  });

  it('brings every new kind by its id, bounded, with points the Workshop accepts', () => {
    const kinds = new Set<string>();
    for (const tile of tilesOf(board)) {
      const prepared = bring(board, tile);
      if (!prepared.ok) {
        throw new Error(`${tile.kind}: ${prepared.reason}`);
      }
      kinds.add(tile.kind);
      const sent = prepared.handoff.tile;
      expect(validateWorkshopLightboxTile(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
      expect(sent).toMatchObject({ origin: 'lightbox', boardId: board.boardId, tileId: tile.id });
      expect(sent.quotes.length).toBeGreaterThan(0);
      expect(sent.quotes.length).toBeLessThanOrEqual(LIMITS.quotes);
      expect(sent.points.length).toBeLessThanOrEqual(LIMITS.points);
      // Every quote travels as the chapter has it, from the paragraph it names.
      for (const quote of sent.quotes) {
        expect(ALICE[quote.paragraph - 1]).toContain(quote.text);
      }
    }
    expect([...kinds].sort()).toEqual([
      'air-lock', 'echo', 'familiar-phrase', 'handoff', 'number-usage', 'rhythm-endings', 'signature', 'stock-tiers'
    ]);
  });

  it('labels each craft reading\'s own host counts and fields as its points', () => {
    const pointsOf = (kind: LightboxReadingTile['kind']) => {
      const tile = tilesOf(board).find((candidate) => candidate.kind === kind) as LightboxReadingTile;
      const prepared = bring(board, tile);
      return prepared.ok ? prepared.handoff.tile.points : [];
    };
    expect(pointsOf('stock-tiers')).toEqual([
      { label: 'Tiers', text: 'Functional stock 6 · Decorated 1 · Stock carrying weight 1 · Signature 8' },
      { label: 'Classified', text: '16 beats the reading classified, counted by code' }
    ]);
    expect(pointsOf('familiar-phrase')).toEqual([{ label: 'Kind', text: 'Idiom' }, { label: 'Counted', text: '×1 · ¶5' }]);
    expect(pointsOf('echo')).toEqual([
      { label: 'Sounds like', text: 'a proverb’s “what is the use of” turn' },
      { label: 'Accuracy', text: 'The quote is checked against the chapter; the resemblance is not.' }
    ]);
    expect(pointsOf('rhythm-endings')).toEqual([{ label: 'Endings', text: 'Lands 2 · Holds 1 · Opens 5' }]);
    expect(pointsOf('handoff')).toEqual([
      { label: 'Carried', text: 'The Rabbit’s fretting.' },
      { label: 'Changes', text: 'The fret becomes a deadline.' },
      { label: 'Effect', text: 'Continues' }
    ]);
    expect(pointsOf('number-usage')).toEqual([
      // Rounded only as shown (PR #155 F-04). The sentence rule (ADR 2026-10-21)
      // moved it from 29.9: a closing quote and a lower-case speech tag stay in
      // their sentence, so the opening has 15 sentences, not 17.
      { label: 'Figure', text: 'Sentence length: 33.9 words per sentence; your average 14.3' },
      { label: 'Reads as', text: 'deliberate' }
    ]);
  });

  it('leads a tier mix with one beat of each tier, signature first', () => {
    const mix = tilesOf(board).find((tile) => tile.kind === 'stock-tiers') as LightboxReadingTile;
    const prepared = bring(board, mix);
    if (!prepared.ok || mix.kind !== 'stock-tiers') {
      throw new Error('expected the tier mix to travel');
    }
    const tierOf = (text: string) => mix.beats.find((beat) => beat.quote.text === text)?.tier;
    expect(prepared.handoff.tile.quotes.map((quote) => tierOf(quote.text))).toEqual(['signature', 'weighted', 'decorated', 'functional']);
  });

  describe('a handoff travels with both its sentences, or not at all', () => {
    const handoff = () => tilesOf(board).find((tile): tile is LightboxHandoffTile => tile.kind === 'handoff') as LightboxHandoffTile;

    it('sends its two sentences in order', () => {
      const prepared = bring(board, handoff());
      expect(prepared.ok && prepared.handoff.tile.quotes).toEqual([
        { paragraph: 4, text: 'Oh dear' },
        { paragraph: 4, text: 'I shall be late' }
      ]);
      expect(prepared.ok && renderWorkshopLightboxTile(prepared.handoff.tile)).toContain('Effect: Continues');
    });

    it('refuses, never sending half, when one sentence is gone', () => {
      const changed = ALICE.map((text, index) => (index === 3 ? text.replace('I shall be late', 'I am in good time') : text));
      expect(bring(board, handoff(), changed)).toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.handoffIncomplete });
    });

    it('brings both sentences, the longer clipped to a Workshop quote, when one as the chapter has it outgrows it (Slice 4H)', () => {
      // A hard-wrapped, indented line is found folded, and the chapter's span is longer than the quote.
      const words = 'and so the Rabbit went on muttering to himself about the time and the Duchess and the gloves';
      const longLine = `${words} ${words}`;
      const wrapped = longLine.split(' ').join('\n      ');
      expect(longLine.length).toBeLessThanOrEqual(LIMITS.quoteCharacters);
      expect(wrapped.length).toBeGreaterThan(LIMITS.quoteCharacters);
      const paragraphs = ['“Oh my ears and whiskers!” he said.', `He sighed. ${wrapped}.`];
      const found = createLightboxQuoteVerifier(paragraphs).verify(2, longLine);
      expect(found.found && found.text.length).toBeGreaterThan(LIMITS.quoteCharacters);
      const tile: LightboxHandoffTile = {
        ...handoff(),
        from: { paragraph: 2, text: 'He sighed', match: 'exact' },
        to: { paragraph: 2, text: longLine, match: 'normalized' },
        evidence: [{ paragraph: 2, text: 'He sighed', match: 'exact' }, { paragraph: 2, text: longLine, match: 'normalized' }]
      };
      const withTile: LightboxBoard = {
        ...board,
        readings: board.readings.map((group) => (group.group === 'D' ? { ...group, tiles: [tile] } : group))
      };
      const brought = bring(withTile, tile, paragraphs);
      if (!brought.ok) {
        throw new Error(brought.reason);
      }
      // Never halved: both roles travel, in order; the long one is the chapter's start of it and an ellipsis.
      const quotes = validateWorkshopLightboxTile(brought.handoff.tile).quotes;
      expect(quotes.map((quote) => quote.paragraph)).toEqual([2, 2]);
      expect(quotes[0].text).toBe('He sighed');
      expect(quotes[1].text).toBe(clipLightboxText(found.found ? found.text : '', LIMITS.quoteCharacters));
      expect(quotes[1].text.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
      expect(paragraphs[1].includes(quotes[1].text.replace(LIGHTBOX_ELLIPSIS, ''))).toBe(true);
    });
  });

  it('sends only the numbers reading\'s quotes that still hold an instance of its figure', () => {
    const reading = tilesOf(board).find((tile) => tile.kind === 'number-usage' && tile.stat === 'dialogue') as LightboxReadingTile;
    // ¶3 gains a line of speech: its quoted narration stands word for word, but its paragraph is no longer narration only.
    const changed = ALICE.map((text, index) => (index === 2 ? `${text} “Oh,” she said.` : text));
    const before = bring(board, reading);
    const after = bring(board, reading, changed);
    expect(before.ok && before.handoff.tile.quotes.map((quote) => quote.paragraph)).toEqual([6, 3]);
    expect(after.ok && after.handoff.tile.quotes.map((quote) => quote.paragraph)).toEqual([6]);
  });
});
