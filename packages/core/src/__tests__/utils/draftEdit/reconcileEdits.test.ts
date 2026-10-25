/**
 * Reading what landed (ADR 2026-10-21 D4 step 7): each edit followed by its
 * range through the document's changes, then read where it stands.
 */
import { reconcileEdits, type ReconcilableEdit } from '@/utils/draftEdit/reconcileEdits';
import { shiftRanges } from '@/utils/draftEdit/shiftRanges';

const TEXT = 'Alice said teh word, and teh rabbit ran.';

function edit(original: string, replacement: string, from = 0): ReconcilableEdit {
  const start = TEXT.indexOf(original, from);
  return { start, end: start + original.length, original, replacement };
}

function landingsOf(edits: ReconcilableEdit[], events: Array<Array<{ offset: number; length: number; text: string }>>) {
  let text = TEXT;
  for (const changes of events) {
    for (const change of [...changes].sort((a, b) => b.offset - a.offset)) {
      text = text.slice(0, change.offset) + change.text + text.slice(change.offset + change.length);
    }
  }
  return reconcileEdits(edits, TEXT, events).landings.map((landing) =>
    landing.landing === 'unknown' ? 'unknown' : `${landing.landing} ${JSON.stringify(text.slice(landing.range.start, landing.range.end))}`);
}

const FIRST = edit('teh', 'the');
const SECOND = edit('teh', 'the', 15);

describe('reconcileEdits', () => {
  it('reads edits nothing touched as not applied, where they stand', () => {
    expect(landingsOf([FIRST, SECOND], [])).toEqual(['not-applied "teh"', 'not-applied "teh"']);
  });

  it('reads edits applied as written, in one event whose changes come in any order', () => {
    expect(landingsOf([FIRST, SECOND], [[
      { offset: FIRST.start, length: 3, text: 'the' },
      { offset: SECOND.start, length: 3, text: 'the' }
    ].reverse()])).toEqual(['applied "the"', 'applied "the"']);
  });

  it('reads an edit applied as smaller changes inside it, an insertion at either edge included', () => {
    const comma = edit('word', 'word,');
    expect(landingsOf([FIRST, comma], [[
      { offset: FIRST.start + 1, length: 1, text: '' },
      { offset: FIRST.start + 3, length: 0, text: 'e' },
      { offset: comma.end, length: 0, text: ',' }
    ]])).toEqual(['applied "the"', 'applied "word,"']);
  });

  it('moves an edit through changes before it, across separate events', () => {
    expect(landingsOf([SECOND], [
      [{ offset: 0, length: 0, text: 'Then ' }],
      [{ offset: 5 + SECOND.start, length: 3, text: 'the' }]
    ])).toEqual(['applied "the"']);
  });

  it('leaves an edit alone for a change after it, even one that starts at its end', () => {
    expect(landingsOf([FIRST], [[{ offset: FIRST.end, length: 5, text: ' gentle word' }]])).toEqual(['not-applied "teh"']);
  });

  it('knows nothing of an edit a change crossed an edge of', () => {
    expect(landingsOf([FIRST], [[{ offset: FIRST.start - 1, length: 2, text: 'XX' }]])).toEqual(['unknown']);
    expect(landingsOf([FIRST], [[{ offset: FIRST.start + 2, length: 3, text: '' }]])).toEqual(['unknown']);
  });

  it('knows nothing of an edit whose text is now neither its original nor its replacement', () => {
    expect(landingsOf([FIRST], [[{ offset: FIRST.start + 1, length: 2, text: 'ox' }]])).toEqual(['unknown']);
  });

  it('stays unknown once broken, whatever comes after', () => {
    expect(landingsOf([FIRST], [
      [{ offset: FIRST.start - 1, length: 4, text: ' tex' }],
      [{ offset: FIRST.start, length: 3, text: 'teh' }]
    ])).toEqual(['unknown']);
  });

  it('reads a deletion that landed, and one that did not', () => {
    const doubled = edit('teh word', 'teh');
    expect(landingsOf([doubled], [[{ offset: doubled.start + 3, length: 5, text: '' }]])).toEqual(['applied "teh"']);
    expect(landingsOf([doubled], [])).toEqual(['not-applied "teh word"']);
  });
});

/**
 * VS Code merges 1,000 operations or more into one change spanning them all,
 * the text between them included (`PieceTreeTextBuffer._reduceOperations`;
 * PR #172 F-04). Such a change still reads as the edits it is made of.
 */
describe('reconcileEdits: one change spanning many edits', () => {
  const words = Array.from({ length: 12 }, (_, index) => `w${index}x`);
  const text = `${words.join(' ')} and Alice is reading.`;
  const edits = words.map((word) => {
    const start = text.indexOf(`${word} `);
    return { start, end: start + word.length, original: word, replacement: word.replace(/x$/u, 'y') };
  });
  const spanning = (applied: (index: number) => boolean) => {
    // As VS Code builds it: from the first operation's start to the last's end, the text between kept.
    const first = edits[0].start;
    const last = edits[edits.length - 1].end;
    let replacement = '';
    edits.forEach((edit, index) => {
      replacement += text.slice(index === 0 ? first : edits[index - 1].end, edit.start);
      replacement += applied(index) ? edit.replacement : edit.original;
    });
    return [{ offset: first, length: last - first, text: replacement }];
  };

  it('reads every edit it made as applied, and gives the history back as those edits', () => {
    const read = reconcileEdits(edits, text, [spanning(() => true)]);

    expect(read.landings.every((landing) => landing.landing === 'applied')).toBe(true);
    expect(read.events).toEqual([edits.map((edit) => ({ offset: edit.start, length: edit.end - edit.start, text: edit.replacement }))]);
  });

  it('reads the ones the writer left unticked as not applied, where they stand after', () => {
    const read = reconcileEdits(edits, text, [spanning((index) => index % 3 !== 0)]);
    const after = spanning((index) => index % 3 !== 0)[0];
    const live = text.slice(0, after.offset) + after.text + text.slice(after.offset + after.length);

    expect(read.landings.map((landing) => landing.landing)).toEqual(edits.map((_, index) => (index % 3 !== 0 ? 'applied' : 'not-applied')));
    for (const landing of read.landings) {
      if (landing.landing !== 'unknown') {
        expect(live.slice(landing.range.start, landing.range.end)).toBe(landing.landing === 'applied' ? landing.edit.replacement : landing.edit.original);
      }
    }
  });

  it('keeps a flag between the edits on its text, through the history it gives back', () => {
    const flag = { start: text.indexOf('w4x') + 3, end: text.indexOf('w5x') };
    const read = reconcileEdits(edits, text, [spanning(() => true)]);
    const moved = read.events.reduce((ranges, changes) => shiftRanges(ranges, changes), [flag]);
    const live = text.replace(/x\b/gu, 'y');

    expect(moved).toHaveLength(1);
    expect(live.slice(moved[0].start, moved[0].end)).toBe(text.slice(flag.start, flag.end));
  });

  it('reads a spanning change that starts and ends inside its first and last edits', () => {
    // The first and last operations were cut down to the "x" alone.
    const first = edits[0].end - 1;
    const last = edits[edits.length - 1].end;
    const after = text.slice(0, last).replace(/x\b/gu, 'y').slice(first);
    const read = reconcileEdits(edits, text, [[{ offset: first, length: last - first, text: after }]]);

    expect(read.landings.every((landing) => landing.landing === 'applied')).toBe(true);
  });

  it('still knows nothing of edits a spanning change reached into when it also changed the text between them', () => {
    const [change] = spanning(() => true);
    const tampered = { ...change, text: change.text.replace(' w6y', ' Rabbit w6y') };
    const read = reconcileEdits(edits, text, [[tampered]]);

    expect(read.landings.every((landing) => landing.landing === 'unknown')).toBe(true);
    expect(read.events).toEqual([[tampered]]);
  });
});
