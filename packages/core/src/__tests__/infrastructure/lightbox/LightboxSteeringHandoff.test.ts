/**
 * Bring to Workshop for craft steering (ADR 2026-10-19 D11, D7 second
 * addendum; Slice 4F): a figure's reading travels with the host's counts as
 * points, and a note with its stance, its nudge and its one example,
 * labelled as one and never sent as a quote. Every quote is checked again
 * by the figure's own detector, and the example travels only while its first
 * part still stands in the note's quote. The items pass the Workshop's own
 * validator. The board reads ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain), measured against the fixture writer's synthetic
 * averages, with group G read from its worked example.
 */
import type { LightboxBoard, LightboxReadingTile, LightboxSteeringNoteTile } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { LIGHTBOX_TILE_HANDOFF_REFUSALS, prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { renderWorkshopLightboxTile, validateWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { ALICE, readChapterGroups } from './lightboxOpinionFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';

let board: LightboxBoard;
beforeAll(async () => {
  board = readChapterGroups(await boardWithNumbers(ALICE));
});

const steering = (): LightboxReadingTile[] => board.readings.find((group) => group.group === 'G')?.tiles ?? [];
const reading = (stat: string) => steering().find((tile) => tile.kind === 'steering-reading' && tile.stat === stat) as LightboxReadingTile;
const noteTitled = (title: string) => steering().find((tile) => tile.title === title) as LightboxSteeringNoteTile;
const bring = (tile: LightboxReadingTile, paragraphs: readonly string[] = ALICE, on: LightboxBoard = board) =>
  prepareLightboxTileHandoff({ kind: 'tile', boardId: on.boardId, tileId: tile.id }, on, paragraphs);
const sent = (tile: LightboxReadingTile, paragraphs?: readonly string[], on?: LightboxBoard) => {
  const prepared = bring(tile, paragraphs, on);
  if (!prepared.ok) {
    throw new Error(prepared.reason);
  }
  return prepared.handoff.tile;
};
/** `board` with one of its steering tiles replaced. */
const withTile = (tile: LightboxReadingTile): LightboxBoard => ({
  ...board,
  readings: board.readings.map((group) => (group.group === 'G'
    ? { ...group, tiles: group.tiles.map((candidate) => (candidate.id === tile.id ? tile : candidate)) }
    : group))
});

describe('bringing craft steering to the Workshop', () => {
  it('brings every reading and note by its id, bounded, as the Workshop accepts it', () => {
    expect(steering().map((tile) => tile.kind)).toEqual([
      'steering-reading', 'steering-note', 'steering-note', 'steering-reading', 'steering-note', 'steering-note',
      'steering-reading', 'steering-note', 'steering-note', 'steering-note'
    ]);
    for (const tile of steering()) {
      const item = sent(tile);
      expect(validateWorkshopLightboxTile(JSON.parse(JSON.stringify(item)))).toEqual(item);
      expect(item).toMatchObject({ origin: 'lightbox', boardId: board.boardId, tileId: tile.id, kindLabel: tile.kind === 'steering-note' ? 'Instance note' : 'How it works here', lensLabel: 'Craft steering' });
      expect(item.points.length).toBeLessThanOrEqual(WORKSHOP_LIGHTBOX_TILE_LIMITS.points);
      for (const quote of item.quotes) {
        expect(ALICE[quote.paragraph - 1]).toContain(quote.text);
      }
    }
  });

  it('carries a figure\'s reading with the host\'s counts and the short-run threshold as points', () => {
    expect(sent(reading('being-verbs')).points).toEqual([
      { label: 'Figure', text: '17 being verbs, 33.5 per 1,000 words: 15 in narration, 2 in dialogue' },
      { label: 'By construction', text: 'be + adjective 4 · be + -ing 5 · be + past participle 1 · there or it + be 4 · other 3' },
      { label: 'Short runs', text: '0 in runs of 3 or more sentences of 8 words or fewer' }
    ]);
    expect(sent(reading('adverbs')).points[1]).toEqual({
      label: 'By construction',
      text: 'with a verb 4 (weak verbs 1) · in a dialogue tag 0 · before an adjective 1 · before an adverb 0 · other 2'
    });
  });

  it('carries a note with its stance, its nudge and its one example, labelled as one and never as a quote', () => {
    const item = sent(noteTitled('Being verbs · note II'));
    expect(item.claim).toBe('A state stands where the fall could act: the darkness is reported rather than met.');
    expect(item.points).toEqual([
      { label: 'Stance', text: 'Leans · Being verbs' },
      { label: 'Nudge', text: 'An action that lets the dark do something may be worth a look, so the state becomes an event.' },
      { label: 'One way it could go', text: 'it was too dark → the dark swallowed everything' }
    ]);
    expect(item.quotes).toEqual([{ paragraph: 7, text: 'it was too dark to see anything' }]);
    const rendered = renderWorkshopLightboxTile(item);
    expect(rendered.indexOf('One way it could go: it was too dark → the dark swallowed everything'))
      .toBeLessThan(rendered.indexOf('Quotes, as the chapter has them:'));
    expect(rendered).not.toContain('“the dark swallowed everything”');
  });

  it('carries a note that earns with its stance alone', () => {
    expect(sent(noteTitled('Being verbs · note I')).points).toEqual([{ label: 'Stance', text: 'Earns · Being verbs' }]);
  });

  it('refuses a note whose quote, as the chapter has it now, holds no instance of its figure', () => {
    const changed = ALICE.map((text, index) => (index === 6 ? text.replace('it was too dark', 'it grew too dark') : text));
    expect(bring(noteTitled('Being verbs · note II'), changed)).toEqual({
      ok: false,
      reason: 'None of its quotes still holds an instance of the figure it reads, as the chapter has it, so it was not brought.'
    });
    expect(LIGHTBOX_TILE_HANDOFF_REFUSALS.steeringNoInstance)
      .toBe('None of its quotes still holds an instance of the figure it reads, as the chapter has it, so it was not brought.');
  });

  it('refuses a quote whose words stand but hold no instance, though a plain check would find it', () => {
    const note = noteTitled('Being verbs · note II');
    const words = { ...note, evidence: [{ ...note.evidence[0], text: 'too dark to see anything' }] };
    expect(bring(words, ALICE, withTile(words))).toEqual({ ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.steeringNoInstance });
  });

  it('drops the example, and keeps the note, when its first part no longer stands in the quote holding the instance', () => {
    const note = noteTitled('Being verbs · note II');
    const drifted = { ...note, example: { before: 'too dark to see', after: 'the dark swallowed everything' } };
    expect(sent(drifted, ALICE, withTile(drifted)).points.map((point) => point.label)).toEqual(['Stance', 'Nudge']);
  });
});
