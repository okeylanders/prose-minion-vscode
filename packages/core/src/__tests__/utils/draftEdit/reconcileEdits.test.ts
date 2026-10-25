/**
 * Reading what landed (ADR 2026-10-21 D4 step 7): each edit followed by its
 * range through the document's changes, then read where it stands.
 */
import { reconcileEdits, type ReconcilableEdit } from '@/utils/draftEdit/reconcileEdits';

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
  return reconcileEdits(edits, events, text).map((landing) =>
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
      [{ offset: FIRST.start - 1, length: 4, text: ' teh' }],
      [{ offset: FIRST.start, length: 3, text: 'teh' }]
    ])).toEqual(['unknown']);
  });

  it('reads a deletion that landed, and one that did not', () => {
    const doubled = edit('teh word', 'teh');
    expect(landingsOf([doubled], [[{ offset: doubled.start + 3, length: 5, text: '' }]])).toEqual(['applied "teh"']);
    expect(landingsOf([doubled], [])).toEqual(['not-applied "teh word"']);
  });
});
