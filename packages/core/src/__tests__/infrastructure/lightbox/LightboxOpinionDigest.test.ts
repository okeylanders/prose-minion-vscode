/**
 * Group F's digest (Slice 4D; ADR 2026-10-19 D7 addendum): what the Opinion
 * reads is the board as code checked it, never the chapter. Built on the
 * worked example's own board (the Alice excerpt, Lewis Carroll, 1865,
 * public domain, groups A–E read from their worked examples) by the
 * production builder. It holds no paragraph text but found quotes and
 * counted terms, leaves out what is not current, stays within its bound and
 * says what it left out, and its key changes with anything it read,
 * including the measurement it was read under.
 */
import type { LightboxBoard, LightboxLensId, LightboxReadingGroup } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { buildLightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import type { LightboxFigureCounts, LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { boardWithNumbers, WRITER_AVERAGES } from './lightboxCraftFixtures';
import {
  ALICE,
  OPINION_EXAMPLE_LENSES_OFF,
  aliceOpinionBoard,
  itemKey,
  readChapterGroups,
  readOpinion,
  withOpinion
} from './lightboxOpinionFixtures';

let board: LightboxBoard;
/** Every lens on: the spark lane too. */
let everyLens: LightboxBoard;
beforeAll(async () => {
  board = await aliceOpinionBoard();
  everyLens = await aliceOpinionBoard([]);
});

const tileIds = (of: LightboxBoard, where: (group: LightboxReadingGroup) => boolean = () => true) =>
  of.readings.filter(where).flatMap((group) => group.tiles.map((tile) => tile.id));
const lensTiles = (of: LightboxBoard, lens: LightboxLensId) =>
  of.readings.flatMap((group) => group.tiles).filter((tile) => tile.lens === lens).map((tile) => tile.id);
const withGroup = (of: LightboxBoard, group: LightboxReadingGroup['group'], edit: (group: LightboxReadingGroup) => LightboxReadingGroup) =>
  ({ ...of, readings: of.readings.map((candidate) => (candidate.group === group ? edit(candidate) : candidate)) });

/** The fixture's writer, with some of the other chapters' counts changed. */
function averagesWith(edit: (counts: LightboxFigureCounts) => LightboxFigureCounts): LightboxWriterAverages {
  if (!WRITER_AVERAGES.counts) {
    throw new Error('expected the fixture\'s counts');
  }
  return { ...WRITER_AVERAGES, counts: edit(WRITER_AVERAGES.counts) };
}

/** The same text measured again under `writer`, read again with the example's lenses and ids, on the same board. */
async function remeasured(writer: LightboxWriterAverages): Promise<LightboxBoard> {
  const measured = await boardWithNumbers(ALICE, writer);
  return { ...readChapterGroups(measured, ALICE, OPINION_EXAMPLE_LENSES_OFF), boardId: board.boardId };
}

/** Runs of `size` words, lower case, punctuation dropped. */
function shingles(text: string, size: number): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const runs = new Set<string>();
  for (let index = 0; index + size <= words.length; index++) {
    runs.add(words.slice(index, index + size).join(' '));
  }
  return runs;
}

describe('the board\'s digest, what group F reads (Slice 4D)', () => {
  it('holds every current reading and the measured figures, each under its host key, within its bound', () => {
    const digest = buildLightboxOpinionDigest(board);
    const readings = tileIds(board, (group) => group.group !== 'F');
    expect(digest.readings).toBe(readings.length);
    expect(digest.leftOut).toBe(0);
    for (const id of readings) {
      expect(digest.section).toContain(`[${id}] `);
      expect(digest.items.has(id)).toBe(true);
    }
    expect(digest.items.get('headline')?.kind).toBe('measured');
    expect([...digest.items.keys()].filter((key) => key.startsWith('standout:')).sort())
      .toEqual(board.measured.numbers.rows.filter((row) => row.standout).map((row) => `standout:${row.stat}`).sort());
    expect(digest.tokens).toBe(estimateTextTokens(digest.section));
    expect(digest.tokens).toBeLessThanOrEqual(PROMPT_BUDGETS.lightbox.opinionDigestTokens);
    expect(digest.section).not.toContain('## Not in this digest');
  });

  it('holds no paragraph text but the quotes code found and the terms it counted, no path and no context', () => {
    const digest = buildLightboxOpinionDigest(everyLens);
    // Take out what may hold the chapter's words: each item's quotes and counted terms.
    const quoted = [...digest.items.values()].flatMap((item) => item.quotes.map((quote) => quote.text));
    let rest = digest.section.split('\n').filter((line) => !/^\s+q\d+ ¶\d+: “/.test(line) && !/^\s+counted by code: /.test(line)).join('\n');
    expect(quoted.length).toBeGreaterThan(0);
    for (const quote of quoted) {
      rest = rest.split(quote).join(' ');
    }
    const chapter = shingles(ALICE.join(' '), 7);
    const leaked = [...shingles(rest, 7)].filter((run) => chapter.has(run));
    expect(leaked).toEqual([]);
    expect(digest.section).not.toContain('example.md');
    expect(digest.section).not.toContain(everyLens.source.displayPath);
    expect(digest.section).toContain('The chapter itself is not here.');
  });

  it('never holds a spark, the Opinion itself, or a withheld claim', () => {
    const sparks = lensTiles(everyLens, 'spark');
    expect(sparks.length).toBeGreaterThan(0);
    const opinion = readOpinion(board);
    const withF = withOpinion(everyLens, opinion);
    const digest = buildLightboxOpinionDigest(withF);
    for (const id of [...sparks, opinion.tile?.id ?? 'missing']) {
      expect(digest.items.has(id)).toBe(false);
      expect(digest.section).not.toContain(`[${id}]`);
    }
    expect(digest.readings).toBe(tileIds(everyLens, (group) => group.group !== 'F').length - sparks.length);
  });

  it('leaves out a lens that is stale or being read again, and names it', () => {
    const stock = lensTiles(board, 'stock');
    const characters = lensTiles(board, 'characters');
    expect([stock.length, characters.length].every((count) => count > 0)).toBe(true);
    const marked = withGroup(
      withGroup(board, 'D', (group) => ({ ...group, staleLenses: [{ lens: 'stock', readAgainst: 'an-earlier-text' }] })),
      'B',
      (group) => ({ ...group, status: 'running', pending: ['characters'] })
    );
    const digest = buildLightboxOpinionDigest(marked);
    for (const id of [...stock, ...characters]) {
      expect(digest.items.has(id)).toBe(false);
      expect(digest.section).not.toContain(`[${id}]`);
    }
    expect(digest.section).toContain(
      '## Not in this digest\n\n- Left out as not current (read against an earlier text, or being read again): Characters, Stock & signature.'
    );
    // Not left out for the bound: they are not current.
    expect(digest.leftOut).toBe(0);
  });

  it('stays within a smaller bound by leaving out the last readings in board order, and says how many from which lenses', () => {
    const all = buildLightboxOpinionDigest(everyLens);
    const readings = [...all.items.values()].filter((item) => item.kind === 'tile').map((item) => item.key);
    for (let bound = 1_500; bound <= all.tokens + 500; bound += 250) {
      const digest = buildLightboxOpinionDigest(everyLens, bound);
      expect(digest.tokens).toBeLessThanOrEqual(bound);
      const held = [...digest.items.values()].filter((item) => item.kind === 'tile').map((item) => item.key);
      // A prefix, in board order: never a reading skipped for a later one.
      expect(held).toEqual(readings.slice(0, held.length));
      expect(digest.readings + digest.leftOut).toBe(readings.length);
    }
    const tight = buildLightboxOpinionDigest(everyLens, 3_000);
    expect(tight.leftOut).toBeGreaterThan(0);
    expect(tight.section).toMatch(new RegExp(`- Left out to keep the digest within its bound: ${tight.leftOut} readings, from [A-Z][^\\n]+\\.$`));
    // Measured figures are never what goes.
    expect([...tight.items.keys()].filter((key) => !key.startsWith('lbt-'))).toEqual([...all.items.keys()].filter((key) => !key.startsWith('lbt-')));
  });

  it('names a section by its range and marker, never by its heading\'s words', async () => {
    // ¶1 is the excerpt's own heading, "Chapter I: Down the Rabbit-Hole"; a second opens ¶5.
    const headed = await boardWithNumbers([...ALICE.slice(0, 4), '# The Long Hall of Doors', ...ALICE.slice(4)]);
    expect(headed.measured.sections.signal).toBe('headings');
    const digest = buildLightboxOpinionDigest(headed);
    expect(digest.section).toContain('[section:1] Measured · Sections: section 1 of 2\n  ¶1–¶4, opened by a heading in ¶1');
    expect(digest.section).toContain('[section:2] Measured · Sections: section 2 of 2\n  ¶5–¶9, opened by a heading in ¶5');
    expect(digest.section).not.toMatch(/Chapter I|Rabbit-Hole|Long Hall|Doors/);
    // With no reading on the board, it has nothing to weigh.
    expect(digest.readings).toBe(0);
    expect(digest.section).toContain('No current reading is on the board.');
  });

  it('writes shares per 100 words and the writer\'s average as the other chapters\', never as a percentage or "your"', () => {
    const digest = buildLightboxOpinionDigest(everyLens);
    const measured = [...digest.items.values()].filter((item) => item.kind === 'measured').map((item) => item.lines.join('\n')).join('\n');
    expect(measured).toContain('per 100 words');
    expect(measured).toContain('the other chapters\' average of');
    expect(measured).not.toMatch(/%|percent|\byour?\b/i);
  });

  describe('its key', () => {
    it('is the same for the same board, and another for another board', () => {
      expect(buildLightboxOpinionDigest(board).key).toBe(buildLightboxOpinionDigest(board).key);
      expect(buildLightboxOpinionDigest({ ...board, boardId: 'another-board' }).key).not.toBe(buildLightboxOpinionDigest(board).key);
    });

    it('changes when a reading it holds says something else, and when one is read again under new ids', () => {
      const key = buildLightboxOpinionDigest(board).key;
      const signature = itemKey(board, 'Stock & signature · Signature:');
      const reworded = withGroup(board, 'D', (group) => ({
        ...group,
        tiles: group.tiles.map((tile) => (tile.id === signature ? { ...tile, claim: `${tile.claim} Read again.` } : tile))
      }));
      expect(buildLightboxOpinionDigest(reworded).key).not.toBe(key);
      // The same readings under the ids of another run.
      expect(buildLightboxOpinionDigest(readChapterGroups(board, ALICE, OPINION_EXAMPLE_LENSES_OFF, 'reread01')).key).not.toBe(key);
      expect(buildLightboxOpinionDigest(readChapterGroups(board, ALICE, OPINION_EXAMPLE_LENSES_OFF)).key).toBe(key);
    });

    it('changes when the same text is measured again under another average, even where nothing the digest shows changed', async () => {
      const digest = buildLightboxOpinionDigest(board);
      // One more being verb in the other chapters: a figure that stands out neither way, so no item says anything new.
      // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
      const moved = await remeasured(averagesWith((counts) => ({ ...counts, patterns: { ...counts.patterns, 'being-verbs': 501 } })));
      const rowOf = (of: LightboxBoard) => of.measured.numbers.rows.find((candidate) => candidate.stat === 'being-verbs');
      expect([rowOf(board)?.standout, rowOf(moved)?.standout]).toEqual([undefined, undefined]);
      expect(rowOf(moved)?.writer?.average).not.toBe(rowOf(board)?.writer?.average);
      const again = buildLightboxOpinionDigest(moved);
      expect(again.section).toBe(digest.section);
      expect([...again.items.values()].map((item) => item.basis)).toEqual([...digest.items.values()].map((item) => item.basis));
      expect(again.key).not.toBe(digest.key);
    });

    it('changes when a standout is measured again against another average, and the item that shows it says so', async () => {
      const digest = buildLightboxOpinionDigest(board);
      const again = buildLightboxOpinionDigest(await remeasured(averagesWith((counts) => ({ ...counts, sentences: 1_300 }))));
      expect(again.items.get('standout:sentence-length')?.basis).not.toBe(digest.items.get('standout:sentence-length')?.basis);
      expect(again.key).not.toBe(digest.key);
    });
  });
});
