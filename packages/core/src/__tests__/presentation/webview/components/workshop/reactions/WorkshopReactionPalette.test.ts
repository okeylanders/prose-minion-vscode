/**
 * The palette's grid moves (ADR 2026-11-07 D8; PR #245 L1), against the
 * real group sizes: warm 10, curious 3, negative 6, five columns each.
 */

import { WORKSHOP_REACTIONS, type WorkshopReactionId } from '@shared/constants/workshopReactions';
import { workshopReactionPaletteMove } from '@components/workshop/reactions/WorkshopReactionPalette';

const ORDER = ['warm', 'curious', 'negative'].flatMap((tone) =>
  WORKSHOP_REACTIONS.filter((reaction) => reaction.tone === tone).map((reaction) => reaction.id));
const move = (key: string, from: WorkshopReactionId): WorkshopReactionId | undefined => {
  const next = workshopReactionPaletteMove(key, ORDER.indexOf(from));
  return next === undefined ? undefined : ORDER[next];
};

describe('workshopReactionPaletteMove', () => {
  it('is laid out over the real groups', () => {
    expect(['warm', 'curious', 'negative'].map((tone) =>
      WORKSHOP_REACTIONS.filter((reaction) => reaction.tone === tone).length)).toEqual([10, 3, 6]);
  });

  it.each<[string, WorkshopReactionId, WorkshopReactionId]>([
    // Down within a group, then into the next group's same column, clamped to its row.
    ['ArrowDown', 'heart', 'mind-blown'],
    ['ArrowDown', 'mind-blown', 'thinking'],
    ['ArrowDown', 'hundred', 'surprised'],
    ['ArrowDown', 'thanks', 'surprised'],
    ['ArrowDown', 'thinking', 'thumbs-down'],
    ['ArrowDown', 'surprised', 'grimace'],
    ['ArrowDown', 'grimace', 'frustrated'],
    ['ArrowDown', 'confused', 'frustrated'],
    // The last row of the last group stays put.
    ['ArrowDown', 'frustrated', 'frustrated'],
    // Up within a group, then into the previous group's last row, same column.
    ['ArrowUp', 'frustrated', 'thumbs-down'],
    ['ArrowUp', 'thumbs-down', 'thinking'],
    ['ArrowUp', 'confused', 'surprised'],
    ['ArrowUp', 'thinking', 'mind-blown'],
    ['ArrowUp', 'surprised', 'sparkles'],
    ['ArrowUp', 'laughing', 'thumbs-up'],
    ['ArrowUp', 'heart', 'heart'],
    // Left and Right in reading order, across groups.
    ['ArrowRight', 'thanks', 'thinking'],
    ['ArrowLeft', 'thumbs-down', 'surprised'],
    ['Home', 'grimace', 'heart'],
    ['End', 'eyes', 'frustrated']
  ])('%s from %s goes to %s', (key, from, to) => {
    expect(move(key, from)).toBe(to);
  });

  it('leaves other keys alone', () => {
    expect(workshopReactionPaletteMove('Tab', 0)).toBeUndefined();
  });
});
