/**
 * A placed issue's related places (Draft Edit Slice 3c part 4): a
 * continuity pair's earlier side follows the writer's edits as the issue
 * does, is held to its own text, and is read against the live text's
 * protected regions. Text adapts public-domain *Alice*.
 */
import { moveIssues, outsideProtected, placesOf } from '@/application/services/draftEdit/draftEditIssues';

const TEXT = 'The Rabbit had pink eyes. It ran past her. The Rabbit had blue eyes.';
const at = (quote: string, from = 0) => {
  const start = TEXT.indexOf(quote, from);
  return { start, end: start + quote.length, original: quote };
};
const pair = () => ({ ...at('blue eyes'), related: [at('pink eyes')] });

describe('a placed issue\'s related places', () => {
  it('lists the issue\'s own place, then its related ones', () => {
    const issue = pair();
    expect(placesOf(issue)).toEqual([issue, ...issue.related]);
    expect(placesOf(at('ran past'))).toEqual([at('ran past')]);
  });

  it('moves a pair through the writer\'s edits, both sides, and keeps it while both still read as placed', () => {
    const edited = `Oh! ${TEXT}`;
    const [moved] = moveIssues([pair()], [[{ offset: 0, length: 0, text: 'Oh! ' }]], edited);
    expect(edited.slice(moved.start, moved.end)).toBe('blue eyes');
    expect(edited.slice(moved.related[0].start, moved.related[0].end)).toBe('pink eyes');
  });

  it('drops a pair whose earlier side an edit touched, or whose earlier side no longer reads as placed', () => {
    const pink = TEXT.indexOf('pink');
    const touched = TEXT.slice(0, pink) + 'red' + TEXT.slice(pink + 4);
    expect(moveIssues([pair()], [[{ offset: pink, length: 4, text: 'red' }]], touched)).toEqual([]);
    // No edit reported, but the live text says something else there: the side is held to its own text.
    expect(moveIssues([pair()], [], touched)).toEqual([]);
  });

  it('drops a pair either side of which stands in a protected region, and counts it', () => {
    const dropped = { protected: 0 };
    const pink = at('pink eyes');
    expect(outsideProtected([pair()], TEXT, 'markdown', dropped, [{ start: pink.start, end: pink.end }])).toEqual([]);
    expect(dropped.protected).toBe(1);
    expect(outsideProtected([pair()], TEXT, 'markdown', dropped, [])).toHaveLength(1);
  });
});
