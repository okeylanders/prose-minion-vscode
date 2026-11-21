/**
 * Anchoring and the merge (ADR 2026-11-20 D9, D9a, D10, D11a): host code
 * places every quote, shows the source's own text, and makes overlapping
 * ranges one moment. The text adapts *Alice's Adventures in Wonderland*.
 */
import type { PassageSearchPlanChunk, PassageSearchPlanFile } from '@services/search/passage/PassageSearchContracts';
import {
  anchorPassageSearchInstances,
  countPassageSearchMoments,
  mergePassageSearchInstances,
  passageSearchLabelKey,
  type PassageSearchFound
} from '@services/search/passage/PassageSearchInstances';

const RABBIT_HOLE = [
  'Suddenly a White Rabbit with pink eyes ran close by her. “Oh dear! Oh dear! I shall be late!” it said to itself.',
  '',
  'It looked at its watch, and hurried on. Alice ran across the field after it.',
  '',
  'The Rabbit looked at its watch, and was gone round the corner.'
].join('\n');

function fileOf(text: string, overrides: Partial<PassageSearchPlanFile> = {}): PassageSearchPlanFile {
  return { key: 'f1', identity: '/book/chapters/1.md', displayPath: 'chapters/1.md', absolutePath: '/book/chapters/1.md', text, sha256: 'x', lineOffset: 0, lines: 'document', ...overrides };
}

const whole = (text: string, file = 0): PassageSearchPlanChunk => ({ file, start: 0, bodyStart: 0, end: text.length });
const instance = (quote: string, extra: { before?: string; after?: string; label?: string; note?: string } = {}) =>
  ({ quote, note: extra.note ?? '', label: extra.label ?? 'label', ...(extra.before ? { before: extra.before } : {}), ...(extra.after ? { after: extra.after } : {}) });

describe('anchorPassageSearchInstances', () => {
  const file = fileOf(RABBIT_HOLE);

  it('places a quote as a range in its file', () => {
    const anchored = anchorPassageSearchInstances(file, whole(RABBIT_HOLE), [instance('ran close by her')]);
    expect(anchored).toMatchObject({ notFound: 0, ambiguous: 0 });
    const [found] = anchored.found;
    expect(RABBIT_HOLE.slice(found.start, found.end)).toBe('ran close by her');
  });

  it('drops a quote the chunk does not hold as not found', () => {
    expect(anchorPassageSearchInstances(file, whole(RABBIT_HOLE), [instance('took out a pocket-knife')]))
      .toEqual({ found: [], notFound: 1, ambiguous: 0 });
  });

  it('drops a quote the chunk holds twice as ambiguous, unless its context places it', () => {
    expect(anchorPassageSearchInstances(file, whole(RABBIT_HOLE), [instance('looked at its watch')]))
      .toEqual({ found: [], notFound: 0, ambiguous: 1 });
    const placed = anchorPassageSearchInstances(file, whole(RABBIT_HOLE), [
      instance('looked at its watch', { after: ', and hurried on' }),
      instance('looked at its watch', { before: 'The Rabbit' })
    ]);
    expect(placed.ambiguous).toBe(0);
    expect(placed.found.map((found) => found.start)).toEqual([RABBIT_HOLE.indexOf('looked'), RABBIT_HOLE.lastIndexOf('looked')]);
  });

  it('anchors in the call\'s own chunk, offset into the file', () => {
    const start = RABBIT_HOLE.indexOf('The Rabbit looked');
    const chunk: PassageSearchPlanChunk = { file: 0, start, bodyStart: start, end: RABBIT_HOLE.length };
    // Only one "looked at its watch" is in this chunk, so the bare quote places it.
    const anchored = anchorPassageSearchInstances(file, chunk, [instance('looked at its watch')]);
    expect(anchored.found.map((found) => found.start)).toEqual([RABBIT_HOLE.lastIndexOf('looked')]);
  });
});

describe('mergePassageSearchInstances', () => {
  const file = fileOf(RABBIT_HOLE);
  const merge = (found: readonly PassageSearchFound[], files = [file], limit = 100, context = 12) =>
    mergePassageSearchInstances(files, found, limit, context);
  const foundAt = (quote: string, extra: Partial<PassageSearchFound> = {}, text = RABBIT_HOLE): PassageSearchFound => {
    const start = text.indexOf(quote);
    return { file: 0, start, end: start + quote.length, note: 'note', label: 'label', chunk: 0, item: 0, ...extra };
  };

  it('shows the source\'s text, never the model\'s spelling (D9a): straight marks anchor on curly ones and the curly source is shown, exactly', () => {
    const straight = '"Oh dear! Oh dear! I shall be late!" it said';
    const anchored = anchorPassageSearchInstances(file, whole(RABBIT_HOLE), [instance(straight, { before: 'WRONG CONTEXT', after: 'ALSO WRONG' })]);
    expect(anchored.found).toHaveLength(1);
    const [shown] = merge(anchored.found).instances;
    expect(shown.quote).toBe('“Oh dear! Oh dear! I shall be late!” it said');
    expect(shown.quote).not.toBe(straight);
    expect(RABBIT_HOLE.slice(shown.start, shown.end)).toBe(shown.quote);
    // The context either side is the file's too, never the model's `before` and `after`.
    expect(shown.before).toBe('ose by her. ');
    expect(shown.after).toBe(' to itself.\n');
    expect(RABBIT_HOLE).toContain(`${shown.before}${shown.quote}${shown.after}`);
  });

  it('computes the line from the range, and adds a selection\'s offset', () => {
    const found = [foundAt('ran close by her'), foundAt('hurried on'), foundAt('gone round the corner')];
    expect(merge(found).instances.map((shown) => shown.line)).toEqual([1, 3, 5]);
    expect(merge(found, [fileOf(RABBIT_HOLE, { lineOffset: 40 })]).instances.map((shown) => shown.line)).toEqual([41, 43, 45]);
  });

  it('numbers from 1 in reading order: file by file, then by position, whatever order the calls came back in', () => {
    const second = fileOf('The Queen of Hearts, she made some tarts.', { key: 'f2', displayPath: 'chapters/2.md' });
    const merged = merge([
      { file: 1, start: 4, end: 9, note: '', label: 'queen', chunk: 1, item: 0 },
      foundAt('hurried on'),
      foundAt('ran close by her')
    ], [file, second]);
    expect(merged.instances.map((shown) => [shown.number, shown.file, shown.quote])).toEqual([
      [1, 'f1', 'ran close by her'],
      [2, 'f1', 'hurried on'],
      [3, 'f2', 'Queen']
    ]);
    expect(merged.files.map((entry) => [entry.key, entry.instances])).toEqual([['f1', 2], ['f2', 1]]);
  });

  it('makes overlapping ranges in one file one moment: the earliest-starting stands, the rest are duplicates', () => {
    const merged = merge([
      foundAt('looked at its watch, and hurried on'),
      foundAt('It looked at its watch'),
      foundAt('its watch'),
      foundAt('Alice ran across the field')
    ]);
    expect(merged.instances.map((shown) => shown.quote)).toEqual(['It looked at its watch', 'Alice ran across the field']);
    expect(merged.duplicates).toBe(2);
    // Overlap is with what stands: a range clear of the kept one is its own moment.
    expect(merge([foundAt('It looked at its watch'), foundAt('looked at its watch, and hurried on'), foundAt('hurried on')]).instances.map((shown) => shown.quote))
      .toEqual(['It looked at its watch', 'hurried on']);
    expect(countPassageSearchMoments([foundAt('hurried on'), foundAt('hurried on'), foundAt('ran close by her')])).toBe(2);
  });

  it('settles a tie by the plan, never by the order replies came back in (PR #293 F6)', () => {
    // Two chunks' calls anchor one range, as an overlap paragraph allows, with different notes and labels.
    const early = foundAt('hurried on', { chunk: 0, item: 3, note: 'from the first chunk', label: 'first' });
    const late = foundAt('hurried on', { chunk: 1, item: 0, note: 'from the second chunk', label: 'second' });
    const sameReply = foundAt('hurried on', { chunk: 0, item: 5, note: 'listed again', label: 'again' });
    for (const arrived of [[early, late, sameReply], [late, sameReply, early], [sameReply, late, early]]) {
      const merged = merge(arrived);
      expect(merged.instances.map((shown) => [shown.note, shown.label])).toEqual([['from the first chunk', 'first']]);
      expect(merged.duplicates).toBe(2);
      expect(merged.labels).toEqual([{ key: 'first', label: 'first', count: 1, files: 1 }]);
    }
    // The same start with a different end is settled the same way.
    const longer = foundAt('hurried on. Alice', { chunk: 1, item: 0 });
    expect(merge([longer, early]).instances.map((shown) => shown.quote)).toEqual(['hurried on']);
    expect(merge([early, longer]).instances.map((shown) => shown.quote)).toEqual(['hurried on']);
  });

  it('records the chunk and the reply item each quote came from', () => {
    const chunk: PassageSearchPlanChunk = { file: 0, start: 0, bodyStart: 0, end: RABBIT_HOLE.length };
    const anchored = anchorPassageSearchInstances(file, chunk, [instance('nowhere at all'), instance('ran close by her'), instance('gone round the corner')], 7);
    expect(anchored.found.map((found) => [found.chunk, found.item])).toEqual([[7, 1], [7, 2]]);
  });

  it('never merges the same range in two files', () => {
    const twin = fileOf(RABBIT_HOLE, { key: 'f2' });
    const merged = merge([foundAt('hurried on'), foundAt('hurried on', { file: 1 })], [file, twin]);
    expect(merged.instances).toHaveLength(2);
    expect(merged.duplicates).toBe(0);
  });

  it('merges labels by a folded key, showing the first spelling in reading order, with the host\'s counts', () => {
    const second = fileOf('The Queen looked at her watch.', { key: 'f2' });
    const merged = merge([
      { file: 1, start: 4, end: 9, note: '', label: 'CHECKS   the Wátch', chunk: 1, item: 0 },
      foundAt('hurried on', { label: 'Checks the watch' }),
      foundAt('ran close by her', { label: 'runs' }),
      foundAt('gone round the corner', { label: 'checks the watch' })
    ], [file, second]);
    expect(merged.labels).toEqual([
      { key: 'checks the watch', label: 'Checks the watch', count: 3, files: 2 },
      { key: 'runs', label: 'runs', count: 1, files: 1 }
    ]);
    expect(merged.instances.map((shown) => shown.label)).toEqual(['runs', 'checks the watch', 'checks the watch', 'checks the watch']);
    expect(passageSearchLabelKey('  Checks\tthe  WATCH ')).toBe('checks the watch');
  });

  it('keeps at most the limit, in reading order, and counts the rest', () => {
    const merged = merge([foundAt('gone round the corner'), foundAt('hurried on'), foundAt('ran close by her')], [file], 2);
    expect(merged.instances.map((shown) => shown.quote)).toEqual(['ran close by her', 'hurried on']);
    expect(merged.overLimit).toBe(1);
    expect(merged.labels).toEqual([{ key: 'label', label: 'label', count: 2, files: 1 }]);
  });

  it('never cuts a context through half a character', () => {
    const text = 'x😀 the Cat grinned 😀y';
    const quote = 'the Cat grinned';
    const [shown] = merge([foundAt(quote, {}, text)], [fileOf(text)], 10, 2).instances;
    expect(shown.before).toBe(' ');
    expect(shown.after).toBe(' 😀');
  });
});
