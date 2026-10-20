/**
 * A Lightbox tile as a Workshop message attachment (Lightbox Slice 4): the
 * Workshop checks the tile again on arrival, and its largest allowed shape
 * still fits one message attachment's budget without a cut.
 */

import { WORKSHOP_LIGHTBOX_TILE_LIMITS, type WorkshopLightboxTile } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  renderWorkshopLightboxTile,
  validateWorkshopLightboxTile,
  workshopLightboxTileAttachmentInput,
  workshopLightboxTileLabel
} from '@/application/services/workshop/WorkshopLightboxTileAttachment';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;

const subtext: WorkshopLightboxTile = {
  origin: 'lightbox',
  boardId: 'board-1',
  tileId: 'tile-b-subtext-1',
  kindLabel: 'Said / meant',
  lensLabel: 'Subtext',
  title: 'Late',
  claim: 'The Rabbit says he is late; what he means is that someone will punish him for it.',
  points: [{ label: 'Speaker', text: 'The White Rabbit' }],
  quotes: [
    { paragraph: 4, text: '“Oh dear! Oh dear! I shall be late!”', said: true },
    { paragraph: 4, text: 'the Rabbit actually took a watch out of its waistcoat-pocket' }
  ],
  sourceLabel: 'Drafts/alice-chapter-1.md'
};

describe('WorkshopLightboxTileAttachment', () => {
  it('accepts a tile exactly as the contract allows it, and keeps quotes verbatim', () => {
    const padded = { ...subtext, title: '  Late  ', quotes: [{ paragraph: 4, text: ' “Oh dear!” ', said: true }] };
    const checked = validateWorkshopLightboxTile(padded);
    expect(checked.title).toBe('Late');
    expect(checked.quotes).toEqual([{ paragraph: 4, text: ' “Oh dear!” ', said: true }]);
    expect(validateWorkshopLightboxTile(subtext)).toEqual(subtext);
  });

  it.each([
    ['an unknown field', { ...subtext, board: {} }, /unknown field board/],
    ['another origin', { ...subtext, origin: 'workshop' }, /tile\.origin/],
    ['no quote', { ...subtext, quotes: [] }, /tile\.quotes/],
    ['too many quotes', { ...subtext, quotes: Array(LIMITS.quotes + 1).fill(subtext.quotes[1]) }, /tile\.quotes/],
    ['a long quote', { ...subtext, quotes: [{ paragraph: 1, text: 'a'.repeat(LIMITS.quoteCharacters + 1) }] }, /tile\.quotes\[0\]\.text/],
    ['a paragraph of zero', { ...subtext, quotes: [{ paragraph: 0, text: 'down' }] }, /tile\.quotes\[0\]\.paragraph/],
    ['a said flag of false', { ...subtext, quotes: [{ paragraph: 1, text: 'down', said: false }] }, /tile\.quotes\[0\]\.said/],
    ['a long claim', { ...subtext, claim: 'a'.repeat(LIMITS.claimCharacters + 1) }, /tile\.claim/],
    ['a blank title', { ...subtext, title: '  ' }, /tile\.title/],
    ['too many points', { ...subtext, points: Array(LIMITS.points + 1).fill(subtext.points[0]) }, /tile\.points/],
    ['a point with a stray field', { ...subtext, points: [{ label: 'a', text: 'b', note: 'c' }] }, /unknown field note/]
  ])('refuses %s, naming the field', (_case, value, pattern) => {
    expect(() => validateWorkshopLightboxTile(value)).toThrow(pattern);
  });

  it('renders the claim, its points and its quotes, said lines marked', () => {
    expect(renderWorkshopLightboxTile(subtext)).toBe([
      'Reading: Said / meant, from the Subtext lens',
      'Title: Late',
      'Claim: The Rabbit says he is late; what he means is that someone will punish him for it.',
      'Speaker: The White Rabbit',
      'Quotes, as the chapter has them:',
      '- ¶4 (said): ““Oh dear! Oh dear! I shall be late!””',
      '- ¶4: “the Rabbit actually took a watch out of its waistcoat-pocket”'
    ].join('\n'));
  });

  it('keeps the largest allowed tile inside one attachment\'s word budget, uncut', () => {
    const word = 'a ';
    const largest: WorkshopLightboxTile = {
      ...subtext,
      kindLabel: word.repeat(LIMITS.labelCharacters / 2).trim(),
      lensLabel: word.repeat(LIMITS.labelCharacters / 2).trim(),
      title: word.repeat(LIMITS.titleCharacters / 2).trim(),
      claim: word.repeat(LIMITS.claimCharacters / 2).trim(),
      points: Array.from({ length: LIMITS.points }, () => ({
        label: word.repeat(LIMITS.pointLabelCharacters / 2).trim(),
        text: word.repeat(LIMITS.pointCharacters / 2).trim()
      })),
      quotes: Array.from({ length: LIMITS.quotes }, (_, index) => ({
        paragraph: index + 1,
        text: word.repeat(LIMITS.quoteCharacters / 2).trim()
      }))
    };
    const input = workshopLightboxTileAttachmentInput(validateWorkshopLightboxTile(largest));
    expect(input.words).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopThreadArtifacts.words);
    expect(input.truncation).toBeUndefined();
    expect(input.label.length).toBeLessThanOrEqual(LIMITS.attachmentLabelCharacters);
  });

  it('labels the pill by kind and title, and keys duplicates by board and tile', () => {
    expect(workshopLightboxTileLabel(subtext)).toBe('Lightbox Said / meant: Late');
    expect(workshopLightboxTileAttachmentInput(subtext)).toMatchObject({
      sourceUri: 'lightbox-tile:board-1:tile-b-subtext-1',
      lightboxTile: { boardId: 'board-1', tileId: 'tile-b-subtext-1', kindLabel: 'Said / meant', quotes: 2 }
    });
  });
});
