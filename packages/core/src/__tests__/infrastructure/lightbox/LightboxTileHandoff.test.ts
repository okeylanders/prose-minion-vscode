/**
 * What a reading tile hands to the Workshop (Lightbox Slice 4), pure: the
 * tile is resolved on the board, refused when stale, re-reading or set
 * aside, and its quotes are checked again against the current paragraphs,
 * a said line first; only quotes found travel, as the chapter has them,
 * clipped with an ellipsis to the Workshop's own bounds (Slice 4H).
 * Worked example group B, verified against its own excerpt of "Alice's
 * Adventures in Wonderland" (1865, public domain); the long said line is a
 * sentence written for these tests.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxSubtextTile, LightboxVerifiedQuote } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import {
  LIGHTBOX_TILE_HANDOFF_REFUSALS,
  prepareLightboxTileHandoff
} from '@/infrastructure/lightbox/LightboxTileHandoff';
import { LIGHTBOX_ELLIPSIS, clipLightboxText } from '@shared/constants/lightboxClip';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import {
  renderWorkshopLightboxTile,
  validateWorkshopLightboxTile
} from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { frame, readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const PARAGRAPHS = readWorkedExample('B').paragraphs;

function boardWith(mutate: (group: LightboxReadingGroup) => LightboxReadingGroup = (group) => group): LightboxBoard {
  const board = makeReadBoard();
  return { ...board, readings: board.readings.map((group) => (group.group === 'B' ? mutate(group) : group)) };
}
const subtextOf = (board: LightboxBoard) =>
  board.readings.flatMap((group) => group.tiles).find((tile): tile is LightboxSubtextTile => tile.kind === 'subtext')!;
/** A quote as a board held it once; the handoff checks it again. */
const quoteAt = (paragraph: number, text: string): LightboxVerifiedQuote => ({ paragraph, text, match: 'exact' });
const request = (board: LightboxBoard, tileId: string) => ({ kind: 'tile' as const, boardId: board.boardId, tileId });

describe('prepareLightboxTileHandoff', () => {
  it('refuses a stale tile and one whose lens is being read again', () => {
    const stale = boardWith((group) => ({ ...group, staleLenses: [{ lens: 'subtext', since: 1 } as never] }));
    expect(prepareLightboxTileHandoff(request(stale, subtextOf(stale).id), stale, PARAGRAPHS))
      .toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.stale });
    const reading = boardWith((group) => ({ ...group, status: 'running', pending: ['subtext'] }));
    expect(prepareLightboxTileHandoff(request(reading, subtextOf(reading).id), reading, PARAGRAPHS))
      .toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.reading });
  });

  it('refuses a pair whose said line is no longer in the chapter, even when its evidence is', () => {
    const board = boardWith();
    const said = subtextOf(board).said.text;
    const changed = PARAGRAPHS.map((paragraph) => paragraph.replace(said, 'Oh my ears and whiskers'));
    expect(prepareLightboxTileHandoff(request(board, subtextOf(board).id), board, changed))
      .toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.saidGone });
  });

  it('refuses a tile none of whose quotes is still in the chapter', () => {
    const board = boardWith();
    const motif = board.readings.flatMap((group) => group.tiles).find((tile) => tile.kind !== 'subtext' && tile.evidence.length > 0)!;
    const blank = PARAGRAPHS.map(() => 'Nothing of the chapter is left here.');
    expect(prepareLightboxTileHandoff(request(board, motif.id), board, blank).ok).toBe(false);
  });

  it('carries only quotes found again, clips one over the Workshop\'s bound with an ellipsis (Slice 4H), and keeps at most four', () => {
    const long = 'x'.repeat(WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters + 1);
    const paragraphs = [...PARAGRAPHS, `${long}. And the rest.`];
    const extra = paragraphs.length;
    const board = boardWith((group) => ({
      ...group,
      tiles: group.tiles.map((tile) => tile.kind !== 'subtext' ? tile : {
        ...tile,
        evidence: [
          ...tile.evidence,
          quoteAt(extra, long),
          quoteAt(2, 'not a line in the chapter at all'),
          ...PARAGRAPHS.slice(0, 5).map((paragraph, index) => quoteAt(index + 1, paragraph.split(' ').slice(0, 4).join(' ')))
        ]
      })
    }));
    const tile = subtextOf(board);
    const prepared = prepareLightboxTileHandoff(request(board, tile.id), board, paragraphs);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    const quotes = prepared.handoff.tile.quotes;
    expect(quotes).toHaveLength(WORKSHOP_LIGHTBOX_TILE_LIMITS.quotes);
    expect(quotes[0]).toEqual({ paragraph: tile.said.paragraph, text: tile.said.text, said: true });
    // The long quote travels, clipped to the Workshop's quote with an ellipsis; it was never withheld for its length.
    const clipped = quotes.find((quote) => quote.paragraph === extra)!;
    expect(clipped.text).toBe(clipLightboxText(long, WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters));
    expect(clipped.text).toHaveLength(WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters);
    expect(clipped.text.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
    expect(quotes.some((quote) => quote.text.includes('not a line'))).toBe(false);
    // Every quote travels as the chapter has it, up to the ellipsis where one was clipped.
    expect(quotes.every((quote) => paragraphs[quote.paragraph - 1].includes(quote.text.replace(LIGHTBOX_ELLIPSIS, '')))).toBe(true);
    expect(validateWorkshopLightboxTile(prepared.handoff.tile).quotes).toEqual(quotes);
    expect(prepared.quotesChecked).toBe(tile.evidence.length);
  });

  it('clips a title, a claim and a point longer than the Workshop\'s own bounds with an ellipsis, never withholding them (Slice 4H)', () => {
    const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;
    const long = (start: string, bound: number) => `${start} ${'The line carries more than it says. '.repeat(Math.ceil(bound / 30))}`.trim();
    const board = boardWith((group) => ({
      ...group,
      tiles: group.tiles.map((tile) => tile.kind !== 'subtext' ? tile : {
        ...tile,
        title: long('White Rabbit', LIMITS.titleCharacters),
        claim: long('Being late is the whole of its worry.', LIMITS.claimCharacters),
        speaker: long('White Rabbit', LIMITS.pointCharacters)
      })
    }));
    const tile = subtextOf(board);
    const prepared = prepareLightboxTileHandoff(request(board, tile.id), board, PARAGRAPHS);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    const sent = validateWorkshopLightboxTile(prepared.handoff.tile);
    expect(sent.title).toBe(clipLightboxText(tile.title, LIMITS.titleCharacters));
    expect(sent.claim).toBe(clipLightboxText(tile.claim, LIMITS.claimCharacters));
    expect(sent.points).toEqual([{ label: 'Speaker', text: clipLightboxText(tile.speaker, LIMITS.pointCharacters) }]);
    expect([sent.title, sent.claim, sent.points[0].text].every((text) => text.endsWith(LIGHTBOX_ELLIPSIS))).toBe(true);
  });

  describe('a said line longer than a Workshop quote (PR #151 F-02; Slice 4H)', () => {
    const SAID = 'I have told you everything I remember about that night, from the sound of the rain against the windows ' +
      'to the empty chair beside the fire, and if there is anything else you want from me, you will have to ask ' +
      'someone who was actually there.';
    /** The same speech hard-wrapped after "of", "if" and "someone", indented: still one paragraph. */
    const WRAPPED = SAID.replace('sound of ', 'sound of\n    ').replace('and if ', 'and if\n    ').replace('someone ', 'someone\n    ');
    function pairOn(speech: string) {
      const paragraphs = [`“${speech}” Her hands shook.`];
      const decoded = decodeLightboxGroup(frame('B', { version: 1, subtext: {
        items: [{
          speaker: 'Mara',
          said: { para: 1, quote: SAID },
          meant: 'She is asking him to stop.',
          evidence: [{ para: 1, quote: 'Her hands shook.' }]
        }],
        friction: 'One line is thin ground for a reading.'
      } }), { group: 'B', lenses: ['subtext'], columnCount: paragraphs.length });
      const assembled = assembleLightboxGroup(decoded, {
        verifier: createLightboxQuoteVerifier(paragraphs),
        counter: createLightboxTermCounter(paragraphs),
        mintId: () => 'pair-1'
      });
      const board = boardWith((group) => ({ ...group, tiles: assembled.tiles }));
      return { board, paragraphs, tile: subtextOf(board) };
    }

    it('brings the pair led by its said line, clipped to a Workshop quote, when the chapter has it longer', () => {
      expect(SAID).toHaveLength(WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters - 1);
      const { board, paragraphs, tile } = pairOn(WRAPPED);
      // The board draws it: the verifier finds the wrapped speech, 251 characters as the chapter has them.
      expect(tile.said).toEqual({ paragraph: 1, text: WRAPPED, match: 'normalized' });
      expect(tile.said.text).toHaveLength(WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters + 11);
      const prepared = prepareLightboxTileHandoff(request(board, tile.id), board, paragraphs);
      if (!prepared.ok) {
        throw new Error(prepared.reason);
      }
      // Its meaning still arrives with its speech, first: the speech's start, and an ellipsis where it was cut.
      const staged = validateWorkshopLightboxTile(prepared.handoff.tile);
      expect(staged.quotes[0]).toEqual({
        paragraph: 1,
        text: clipLightboxText(WRAPPED, WORKSHOP_LIGHTBOX_TILE_LIMITS.quoteCharacters),
        said: true
      });
      expect(WRAPPED.startsWith(staged.quotes[0].text.replace(LIGHTBOX_ELLIPSIS, ''))).toBe(true);
      expect(staged.quotes[0].text.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
    });

    it('brings the same pair when its said line fits, leading with it verbatim at the Workshop boundary', () => {
      const { board, paragraphs, tile } = pairOn(SAID);
      const prepared = prepareLightboxTileHandoff(request(board, tile.id), board, paragraphs);
      if (!prepared.ok) {
        throw new Error(prepared.reason);
      }
      const staged = validateWorkshopLightboxTile(prepared.handoff.tile);
      expect(staged.quotes).toEqual([{ paragraph: 1, text: SAID, said: true }, { paragraph: 1, text: 'Her hands shook.' }]);
      const body = renderWorkshopLightboxTile(staged);
      expect(body).toContain('Claim: She is asking him to stop.');
      expect(body.split('\n').slice(-2)).toEqual([`- ¶1 (said): “${SAID}”`, '- ¶1: “Her hands shook.”']);
    });

    it('refuses at the Workshop a said/meant tile that does not lead with its said line', () => {
      const { board, paragraphs, tile } = pairOn(SAID);
      const prepared = prepareLightboxTileHandoff(request(board, tile.id), board, paragraphs);
      if (!prepared.ok) {
        throw new Error(prepared.reason);
      }
      const withoutSaid = { ...prepared.handoff.tile, quotes: [{ paragraph: 1, text: 'Her hands shook.' }] };
      expect(() => validateWorkshopLightboxTile(withoutSaid)).toThrow(/tile\.quotes\[0\]\.said/);
      const saidSecond = { ...prepared.handoff.tile, quotes: [...prepared.handoff.tile.quotes].reverse() };
      expect(() => validateWorkshopLightboxTile(saidSecond)).toThrow(/tile\.quotes\[0\]\.said/);
    });
  });
});
