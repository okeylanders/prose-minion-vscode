/**
 * The Opinion's citation basis is the cited item's data, not the digest's
 * wording (epic decision 25; Slice 5A; ADR 2026-10-19 D12 addendum).
 *
 * - **Rewording keeps standing.** The digest's own labels are reloaded with
 *   new words (every tile kind's label, every lens's label, the numbers'
 *   usage labels, the steering stances and the steering count lines). Every
 *   cited item's digest text changes, and no basis moves, so an Opinion
 *   read under the old words stays current.
 * - **Every canonical field flips it.** Changing an item's key, kind, lens,
 *   title or claim, a quote's text, ¶ address or note, a counted term's count
 *   or paragraphs, a kind's own fields, or a measured figure makes the
 *   Opinions citing it stale, by observation id.
 * - **Nothing the digest never showed moves it**: friction, withheld quotes,
 *   a quote's match kind, quotes and terms past the digest's bounds, a
 *   tension arc's scores, a swatch's colour, a note's nudge and example.
 * - **A sweep over every leaf** of every item on a board holding every
 *   reading kind: whenever a change shows in the digest, the basis moves.
 *
 * The board is the worked examples' reading of ¶1–¶8 of "Alice's Adventures
 * in Wonderland" (1865, public domain), with every reading kind on it.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { lightboxOpinionItemMap, lightboxOpinionItemText, lightboxOpinionItems } from '@shared/constants/lightboxOpinionItems';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';

type ItemsModule = typeof import('@shared/constants/lightboxOpinionItems');
type OpinionModule = typeof import('@shared/constants/lightboxOpinion');
type LightboxConstants = typeof import('@shared/constants/lightbox');
type SteeringConstants = typeof import('@shared/constants/lightboxSteering');

const BOARD = makeReadBoard({ collision: true });

/** Every tile on the board, by id. */
function tiles(board: LightboxBoard): LightboxReadingTile[] {
  return board.readings.flatMap((group) => group.tiles);
}

/** `board` with the tile `id` replaced by `edit(tile)`. */
function editTile(board: LightboxBoard, id: string, edit: (tile: LightboxReadingTile) => LightboxReadingTile): LightboxBoard {
  return {
    ...board,
    readings: board.readings.map((group): LightboxReadingGroup => ({
      ...group,
      tiles: group.tiles.map((tile) => (tile.id === id ? edit(structuredClone(tile)) : tile))
    }))
  };
}

/** The id of the tile whose title starts with `title`, or a throw. */
function tileId(title: string, board: LightboxBoard = BOARD): string {
  const found = tiles(board).find((tile) => tile.title.startsWith(title));
  if (!found) {
    throw new Error(`no tile titled ${title}`);
  }
  return found.id;
}

/** Which observations the Opinion now finds changed, on `board` (empty: it stands). */
function changedOn(board: LightboxBoard, opinionModule: Pick<OpinionModule, 'lightboxOpinionStanding'> = { lightboxOpinionStanding }): string[] {
  const opinion = lightboxOpinionTile(BOARD);
  if (!opinion) {
    throw new Error('the board holds no Opinion');
  }
  return opinionModule.lightboxOpinionStanding(opinion, board).changed;
}

/** The digest's modules, loaded afresh with every label the digest prints reworded. */
function rewordedDigest(): { items: ItemsModule; opinion: OpinionModule } {
  let loaded: { items: ItemsModule; opinion: OpinionModule } | undefined;
  jest.isolateModules(() => {
    jest.doMock('@shared/constants/lightbox', () => {
      const actual = jest.requireActual<LightboxConstants>('@shared/constants/lightbox');
      const reword = <T extends Record<string, string>>(labels: T, how: (label: string) => string): T =>
        Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, how(label)])) as T;
      /* eslint-disable @typescript-eslint/naming-convention -- the module's own export names. */
      return {
        ...actual,
        LIGHTBOX_TILE_KIND_LABELS: reword(actual.LIGHTBOX_TILE_KIND_LABELS, (label) => `${label}, as drawn`),
        LIGHTBOX_NUMBER_USAGE_LABELS: reword(actual.LIGHTBOX_NUMBER_USAGE_LABELS, (label) => `used: ${label}`),
        LIGHTBOX_STOCK_TIER_LABELS: reword(actual.LIGHTBOX_STOCK_TIER_LABELS, (label) => `${label} beats`),
        LIGHTBOX_FAMILIAR_KIND_LABELS: reword(actual.LIGHTBOX_FAMILIAR_KIND_LABELS, (label) => `a ${label}`),
        lightboxLensLabel: (lens: Parameters<LightboxConstants['lightboxLensLabel']>[0]) => `The ${actual.lightboxLensLabel(lens)} lens`
      };
      /* eslint-enable @typescript-eslint/naming-convention */
    });
    jest.doMock('@shared/constants/lightboxSteering', () => {
      const actual = jest.requireActual<SteeringConstants>('@shared/constants/lightboxSteering');
      return {
        ...actual,
        lightboxSteeringCountLines: (figure: Parameters<SteeringConstants['lightboxSteeringCountLines']>[0]) =>
          actual.lightboxSteeringCountLines(figure).map((line) => `measured, ${line}`)
      };
    });
    // Loaded inside the isolated registry, after its mocks.
    const items = require('@shared/constants/lightboxOpinionItems') as ItemsModule;
    const opinion = require('@shared/constants/lightboxOpinion') as OpinionModule;
    loaded = { items, opinion };
  });
  if (!loaded) {
    throw new Error('the reworded digest did not load');
  }
  return loaded;
}

describe('The Opinion\'s basis is data (decision 25)', () => {
  it('has an id, recorded on boards as rules.opinionBasis', () => {
    expect(LIGHTBOX_OPINION_BASIS_RULE_ID).toBe('item-data-2026-10-22');
  });

  it('stands on the board it read, citing five observations', () => {
    const opinion = lightboxOpinionTile(BOARD);
    expect(opinion?.observations.map((observation) => observation.id)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5']);
    expect(lightboxOpinionStanding(opinion as NonNullable<typeof opinion>, BOARD)).toEqual({
      stale: false,
      readEarlier: false,
      reading: false,
      changed: []
    });
  });

  it('keeps every Opinion current when the digest is reworded: every cited item reads differently, and no basis moves', () => {
    const reworded = rewordedDigest();
    // A measured row carries its own host words beside its figures: reword those as well.
    const board: LightboxBoard = {
      ...BOARD,
      measured: {
        ...BOARD.measured,
        numbers: {
          ...BOARD.measured.numbers,
          rows: BOARD.measured.numbers.rows.map((row) => ({
            ...row, label: `${row.label} (figure)`, unit: `${row.unit}, measured`, instanceLabel: `instances: ${row.instanceLabel}`
          }))
        }
      }
    };
    const before = lightboxOpinionItemMap(BOARD);
    const after = reworded.items.lightboxOpinionItemMap(board);
    const opinion = lightboxOpinionTile(BOARD);
    const cited = [...new Set(opinion?.observations.flatMap((observation) => observation.cites.map((cite) => cite.item)))];
    expect(cited.length).toBe(10);

    // The words changed: one line, literally, and every cited item's block.
    expect(lightboxOpinionItemText(before.get(tileId('Cognitive economy')) as never).split('\n')[0])
      .toMatch(/^\[lbt-test-D-\d+\] Stock & signature · Cognitive economy: Cognitive economy$/);
    expect(reworded.items.lightboxOpinionItemText(after.get(tileId('Cognitive economy')) as never).split('\n')[0])
      .toMatch(/^\[lbt-test-D-\d+\] The Stock & signature lens · Cognitive economy, as drawn: Cognitive economy$/);
    for (const key of cited) {
      expect({ key, same: lightboxOpinionItemText(before.get(key) as never) === reworded.items.lightboxOpinionItemText(after.get(key) as never) })
        .toEqual({ key, same: false });
    }
    // Every item on the board, cited or not, keeps its basis.
    expect([...after.entries()].map(([key, item]) => [key, item.basis]))
      .toEqual([...before.entries()].map(([key, item]) => [key, item.basis]));
    // So the Opinion read under the old words stands under the new.
    expect(changedOn(board, reworded.opinion)).toEqual([]);
  });

  describe('flips the standing when any canonical field of a cited item changes', () => {
    const tier = () => tileId('Cognitive economy');
    const signature = () => tileId('The narrator');
    const thread = () => tileId('Where is');
    const watch = () => tileId('The watch');
    const phrase = () => tileId('burning');
    const chase = () => tileId('The chase');

    const cases: Array<[string, () => LightboxBoard, string[]]> = [
      // Identity: the key and the kind.
      ['its key (a tile read again gets a new id)', () => editTile(BOARD, watch(), (tile) => ({ ...tile, id: `${tile.id}-again` })), ['O4']],
      ['its kind', () => editTile(BOARD, signature(), (tile) => ({ ...tile, kind: 'air-lock' }) as LightboxReadingTile), ['O1']],
      // The reading's own words.
      ['its lens', () => editTile(BOARD, signature(), (tile) => ({ ...tile, lens: 'rhythm' })), ['O1']],
      ['its title', () => editTile(BOARD, chase(), (tile) => ({ ...tile, title: `${tile.title}, then the fall` })), ['O5']],
      ['its claim', () => editTile(BOARD, chase(), (tile) => ({ ...tile, claim: `${tile.claim} Again.` })), ['O5']],
      // Quotes, by text, ¶ address and note.
      ['a quote\'s text', () => editTile(BOARD, signature(), (tile) => {
        tile.evidence[0] = { ...tile.evidence[0], text: `${tile.evidence[0].text} too` };
        return tile;
      }), ['O1']],
      ['a quote\'s ¶ address', () => editTile(BOARD, signature(), (tile) => {
        tile.evidence[0] = { ...tile.evidence[0], paragraph: tile.evidence[0].paragraph + 1 };
        return tile;
      }), ['O1']],
      ['a quote\'s note', () => editTile(BOARD, phrase(), (tile) => {
        tile.evidence[0] = { ...tile.evidence[0], note: 'a peak' };
        return tile;
      }), ['O5']],
      // Counts.
      ['a counted term\'s count', () => editTile(BOARD, watch(), (tile) => {
        tile.support[0] = { ...tile.support[0], count: tile.support[0].count + 1 };
        return tile;
      }), ['O4']],
      ['a counted term\'s paragraphs', () => editTile(BOARD, watch(), (tile) => {
        tile.support[0] = { ...tile.support[0], paragraphs: [...tile.support[0].paragraphs, 8] };
        return tile;
      }), ['O4']],
      ['a tier\'s count', () => editTile(BOARD, tier(), (tile) => {
        if (tile.kind === 'stock-tiers') {
          tile.tiers.signature += 1;
        }
        return tile;
      }), ['O1']],
      ['an object\'s mentions', () => editTile(BOARD, watch(), (tile) => (tile.kind === 'artifact' ? { ...tile, mentions: tile.mentions + 1 } : tile)), ['O4']],
      // A kind's own fields.
      ['a thread\'s span', () => editTile(BOARD, thread(), (tile) =>
        (tile.kind === 'pressure-thread' ? { ...tile, span: { ...tile.span, to: tile.span.to - 1 } } : tile)), ['O3']],
      ['a familiar phrase\'s kind', () => editTile(BOARD, phrase(), (tile) =>
        (tile.kind === 'familiar-phrase' ? { ...tile, familiar: tile.familiar === 'idiom' ? 'stock' : 'idiom' } : tile)), ['O5']],
      ['a movement\'s range', () => editTile(BOARD, chase(), (tile) => (tile.kind === 'movement' ? { ...tile, to: tile.to + 1 } : tile)), ['O5']],
      // Figures: a measured standout, as measured again.
      ['a standout\'s value', () => ({
        ...BOARD,
        measured: {
          ...BOARD.measured,
          numbers: { ...BOARD.measured.numbers, rows: BOARD.measured.numbers.rows.map((row) => (row.stat === 'dialogue' ? { ...row, value: row.value + 0.5 } : row)) }
        }
      }), ['O2']],
      ['a standout\'s instances', () => ({
        ...BOARD,
        measured: {
          ...BOARD.measured,
          numbers: { ...BOARD.measured.numbers, rows: BOARD.measured.numbers.rows.map((row) => (row.stat === 'dialogue' ? { ...row, instances: row.instances + 1 } : row)) }
        }
      }), ['O2']]
    ];

    it.each(cases)('%s', (_name, change, expected) => {
      expect(changedOn(change())).toEqual(expected);
    });
  });

  describe('moves nothing for what the digest never showed', () => {
    const cases: Array<[string, () => LightboxBoard]> = [
      ['a tile\'s friction', () => editTile(BOARD, tileId('The watch'), (tile) => ({ ...tile, friction: 'Another strain.' }))],
      ['a tile\'s withheld quotes', () => editTile(BOARD, tileId('The watch'), (tile) => ({
        ...tile, withheldQuotes: [...tile.withheldQuotes, { paragraph: 2, reason: 'not-in-chapter' }]
      }))],
      ['a quote\'s match kind', () => editTile(BOARD, tileId('The narrator'), (tile) => {
        tile.evidence[0] = { ...tile.evidence[0], match: tile.evidence[0].match === 'exact' ? 'normalized' : 'exact' };
        return tile;
      })],
      ['the paragraphs a tile lights', () => editTile(BOARD, tileId('The watch'), (tile) => ({ ...tile, paragraphs: [...tile.paragraphs, 8] }))]
    ];

    it.each(cases)('%s', (_name, change) => {
      const board = change();
      expect(changedOn(board)).toEqual([]);
    });

    it('a steering note\'s nudge and example, and a tension arc\'s scores', () => {
      const note = tiles(BOARD).find((tile) => tile.kind === 'steering-note' && tile.nudge !== undefined);
      const arc = tiles(BOARD).find((tile) => tile.kind === 'tension-arc');
      if (!note || note.kind !== 'steering-note' || !arc || arc.kind !== 'tension-arc') {
        throw new Error('the board lacks a nudged note or an arc');
      }
      const board = editTile(editTile(BOARD, note.id, () => ({ ...note, nudge: 'Another move may be worth a look.', example: undefined })), arc.id,
        () => ({ ...arc, scores: arc.scores.map((score) => (score === null ? null : (score + 1) % 10)) }));
      const before = lightboxOpinionItemMap(BOARD);
      const after = lightboxOpinionItemMap(board);
      expect(after.get(note.id)?.basis).toBe(before.get(note.id)?.basis);
      expect(after.get(arc.id)?.basis).toBe(before.get(arc.id)?.basis);
    });
  });

  it('moves the basis of every item whose digest text a change moves (a sweep over every leaf of every item)', () => {
    let leaves = 0;
    let moved = 0;
    const missed: string[] = [];
    for (const item of lightboxOpinionItems(BOARD)) {
      if (item.kind !== 'tile') {
        continue;
      }
      // Its own group is all an item reads beside the measured set (a template's movements are in its group).
      const group = BOARD.readings.find((candidate) => candidate.tiles.some((tile) => tile.id === item.key)) as LightboxReadingGroup;
      const tile = group.tiles.find((candidate) => candidate.id === item.key) as LightboxReadingTile;
      for (const path of leafPaths(tile)) {
        if (path[0] === 'id' || path[0] === 'lens' || path[0] === 'kind') {
          continue; // identity: a new key is another item, and a lens or kind must stay a real one; each is a case above
        }
        const edited = { ...group, tiles: group.tiles.map((candidate) => (candidate.id === tile.id ? mutateAt(structuredClone(candidate), path) : candidate)) };
        const now = lightboxOpinionItemMap({ measured: BOARD.measured, readings: [edited] }).get(tile.id);
        if (!now) {
          continue;
        }
        leaves += 1;
        const textMoved = lightboxOpinionItemText(now) !== lightboxOpinionItemText(item);
        if (textMoved) {
          moved += 1;
          if (now.basis === item.basis) {
            missed.push(`${tile.kind} ${path.join('.')}`);
          }
        }
      }
    }
    // Literal counts, so the sweep cannot pass by walking nothing.
    expect({ leaves, moved, missed }).toEqual({ leaves: 1323, moved: 807, missed: [] });
  });

  it('moves the basis of every measured item whose digest text a change moves', () => {
    const missed: string[] = [];
    let moved = 0;
    const roots: Array<[string, (board: LightboxBoard) => unknown]> = [
      ['headline', (board) => board.measured.headline],
      ['numbers', (board) => board.measured.numbers.rows],
      ['steering', (board) => board.measured.steering.figures],
      ['sections', (board) => board.measured.sections.sections]
    ];
    const before = lightboxOpinionItemMap(BOARD);
    for (const [name, root] of roots) {
      // A row's label, unit and instance label are host words carried beside its figures: rewording them moves nothing.
      for (const path of leafPaths(root(BOARD)).filter((leaf) => !WORDING.has(String(leaf[leaf.length - 1])))) {
        const board = structuredClone(BOARD);
        mutateAt(root(board), path);
        for (const [key, now] of lightboxOpinionItemMap(board)) {
          const was = before.get(key);
          if (was && was.kind === 'measured' && lightboxOpinionItemText(now) !== lightboxOpinionItemText(was)) {
            moved += 1;
            if (now.basis === was.basis) {
              missed.push(`${name} ${path.join('.')} → ${key}`);
            }
          }
        }
      }
    }
    expect({ moved, missed }).toEqual({ moved: 57, missed: [] });
  });
});

/** A measured row's own words, carried beside its figures (`LightboxNumberRow`). */
const WORDING = new Set(['label', 'unit', 'instanceLabel']);

/** Every path to a string, number or boolean inside `value`. */
function leafPaths(value: unknown, path: Array<string | number> = []): Array<Array<string | number>> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => leafPaths(entry, [...path, index]));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => leafPaths(entry, [...path, key]));
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? [path] : [];
}

/**
 * The closed vocabularies a reading's fields take, by field name, so a sweep
 * changes such a field to another real value, never to one no label knows.
 */
const VOCABULARIES: Readonly<Record<string, ReadonlyArray<readonly string[]>>> = {
  level: [['low', 'medium', 'high'], ['familiar', 'mixed', 'fresh']],
  stance: [['aligns', 'subverts', 'departs'], ['matches', 'departs', 'subverts'], ['earns', 'leans', 'compensates']],
  effect: [['continues', 'pause', 'closure', 'loses']],
  usage: [['deliberate', 'mixed', 'habit']],
  familiar: [['idiom', 'cliche', 'stock', 'weighted']],
  tier: [['functional', 'decorated', 'weighted', 'signature']],
  endings: [['lands', 'holds', 'opens']],
  match: [['exact', 'normalized']],
  direction: [['above', 'below']],
  status: [['below', 'within', 'above']],
  stat: [['sentence-length', 'dialogue', 'passive-voice', 'being-verbs', 'adverbs', 'intensifiers']],
  reason: [['undeclared-paragraph', 'not-in-paragraph', 'not-in-chapter', 'too-short', 'no-longer-in-chapter', 'no-instance', 'out-of-order']],
  construction: [['expletive', 'progressive', 'passive', 'adjective', 'dialogue-tag', 'before-adjective', 'with-verb', 'before-adverb', 'generic', 'before-modifier', 'other']],
  against: [['standards', 'writer']],
  signal: [['headings', 'scene-breaks', 'chapter-lines']]
};

/** Change the leaf at `path` in place: a number up by one, a boolean flipped, a vocabulary word to its next, any other string longer. */
function mutateAt<T>(root: T, path: Array<string | number>): T {
  let parent = root as unknown as Record<string | number, unknown>;
  for (const step of path.slice(0, -1)) {
    parent = parent[step] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1];
  const leaf = parent[last];
  // A vocabulary is named by the field, or by the array the value sits in (`endings[3]`).
  const field = String(typeof last === 'number' ? path[path.length - 2] : last);
  const words = (VOCABULARIES[field] ?? []).find((vocabulary) => vocabulary.includes(String(leaf)));
  parent[last] = typeof leaf === 'number'
    ? leaf + 1
    : typeof leaf === 'boolean'
      ? !leaf
      : words
        ? words[(words.indexOf(String(leaf)) + 1) % words.length]
        : `${String(leaf)}x`;
  return root;
}
