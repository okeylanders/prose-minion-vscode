/**
 * Quotation marks (Draft Edit Slice 3b, part 3): the double marks a
 * paragraph leaves unpaired or misshapes, read by host code. Text adapts
 * public-domain *Alice*.
 */
import { findQuotationSlips, type QuotationSlipKind } from '@/utils/proofread/quotationMarks';

const slips = (text: string, skipped: { start: number; end: number }[] = []) =>
  findQuotationSlips(text, skipped).map((slip) => ({ at: slip.start, mark: slip.mark, kind: slip.kind }));

/** The slip at the `nth` (from 0) occurrence of `mark` in `text`. */
const at = (text: string, mark: string, kind: QuotationSlipKind, nth = 0) => {
  let index = -1;
  for (let count = 0; count <= nth; count += 1) {
    index = text.indexOf(mark, index + 1);
  }
  return { at: index, mark, kind };
};

describe('findQuotationSlips', () => {
  it('reads balanced quotations, curly, straight and mixed, as balanced', () => {
    expect(slips('“I wonder if I’ve been changed in the night?” said Alice. “Let me think.”')).toEqual([]);
    expect(slips('"I wonder if I\'ve been changed in the night?" said Alice. "Let me think."')).toEqual([]);
    expect(slips('“Curiouser and curiouser!" cried Alice; "she was so much surprised.”')).toEqual([]);
    expect(slips('“I—” began Alice. “What?” said the Caterpillar. *“Explain yourself!”*')).toEqual([]);
  });

  it('closes an open quotation with a straight mark its place leaves undecided', () => {
    // A slash on one side and a letter on the other: the place says nothing of the second mark, or the third.
    expect(slips('Alice could answer "yes"/"no" and nothing else.')).toEqual([]);
  });

  it('reads a mark\'s place past the emphasis beside it, curly or straight (PR #182 F-03)', () => {
    const styles = [['“', '”'], ['"', '"']];
    const wrappers = ['*', '**', '_', '__'];
    const leads = ['...', '…', '—'];
    for (const [open, close] of styles) {
      for (const wrapper of wrappers) {
        for (const lead of leads) {
          const text = `She said, ${wrapper}${open}${lead}and then?${close}${wrapper}`;
          expect({ text, slips: slips(text) }).toEqual({ text, slips: [] });
        }
      }
    }
    expect(slips('*“...and then?”*')).toEqual([]);
    expect(slips('She whispered *"Hello"* and left the hall.')).toEqual([]);
  });

  it('still flags slips in emphasized text: the controls', () => {
    const unclosed = 'She said, *“...and then?* The Rabbit hurried away.';
    expect(slips(unclosed)).toEqual([at(unclosed, '“', 'unclosed')]);
    const misshapedOpener = 'She said, *”No!”*';
    expect(slips(misshapedOpener)).toEqual([at(misshapedOpener, '”', 'closing-mark-opens')]);
    const misshapedCloser = 'She said, _“Who are you?“_ and waited.';
    expect(slips(misshapedCloser)).toEqual([at(misshapedCloser, '“', 'opening-mark-closes', 1)]);
    const unopened = 'Alice said nothing.**”** She sat down again.';
    expect(slips(unopened)).toEqual([at(unopened, '”', 'unopened')]);
    const before = '*“...and then?* *“Who are you?”*';
    expect(slips(before)).toEqual([at(before, '“', 'unclosed-before-next')]);
  });

  it('reads a paragraph\'s first mark past emphasis when deciding whether speech goes on', () => {
    const text = '“You are old, Father William,” the young man said, “and your hair has become very white;\n\n*“...And yet you stand on your head.”*';
    expect(slips(text)).toEqual([]);
    // A ” its place leaves undecided closes, so it is no speech going on: the earlier paragraph's quotation is unclosed.
    const closing = '“You are old, said the young man.\n\n”*...* he trailed off.';
    expect(slips(closing)).toEqual([at(closing, '“', 'unclosed'), at(closing, '”', 'unopened')]);
  });

  it('flags a quotation still open where its paragraph ends, curly or straight', () => {
    const curly = '“I wonder if I’ve been changed in the night? said Alice.\n\nThe Rabbit hurried away.';
    expect(slips(curly)).toEqual([at(curly, '“', 'unclosed')]);
    const straight = '"I wonder if I\'ve been changed in the night? said Alice.';
    expect(slips(straight)).toEqual([at(straight, '"', 'unclosed')]);
  });

  it('reads speech running over paragraphs, each opening and only the last closing, as balanced', () => {
    const speech = [
      '“You are old, Father William,” the young man said, “and your hair has become very white;',
      '“And yet you incessantly stand on your head—',
      '> "Do you think, at your age, it is right?”',
      '*“In my youth,” Father William replied to his son.*'
    ].join('\n\n');
    expect(slips(speech)).toEqual([]);
  });

  it('flags an open quotation whose next paragraph does not open with one, or that ends the document', () => {
    const text = '“You are old, Father William, the young man said.\n\nFather William replied to his son.\n\n“I feared it might injure the brain.';
    expect(slips(text)).toEqual([at(text, '“', 'unclosed'), at(text, '“', 'unclosed', 1)]);
  });

  it('flags the earlier quotation when another opens before it closes', () => {
    const curly = '“Who are you? said the Caterpillar. “I hardly know, sir.”';
    expect(slips(curly)).toEqual([at(curly, '“', 'unclosed-before-next')]);
    const straight = '"Who are you? said the Caterpillar. "I hardly know, sir."';
    expect(slips(straight)).toEqual([at(straight, '"', 'unclosed-before-next')]);
  });

  it('flags a closing mark with nothing open', () => {
    const curly = 'Alice said nothing.” She sat down again.';
    expect(slips(curly)).toEqual([at(curly, '”', 'unopened')]);
    const straight = 'Alice said nothing." She sat down again.';
    expect(slips(straight)).toEqual([at(straight, '"', 'unopened')]);
    const doubled = '“Off with her head!”” the Queen shouted.';
    expect(slips(doubled)).toEqual([at(doubled, '”', 'unopened', 1)]);
  });

  it('flags a curly mark of the wrong shape once, and reads the rest of its paragraph true', () => {
    const opener = 'She waited—”Who are you?” said the Caterpillar. “I hardly know.”';
    expect(slips(opener)).toEqual([at(opener, '”', 'closing-mark-opens')]);
    const closer = '“Who are you?“ said the Caterpillar. “I hardly know.”';
    expect(slips(closer)).toEqual([at(closer, '“', 'opening-mark-closes', 1)]);
  });

  it('flags a mark once, however many rules it breaks', () => {
    const text = '”Who are you? said the Caterpillar.';
    expect(slips(text)).toEqual([at(text, '”', 'closing-mark-opens')]);
  });

  it('never reads a mark inside a skipped region, and the same text unskipped is flagged: the control', () => {
    const text = 'Alice typed `"` into the box, and “nothing” happened.';
    const code = { start: text.indexOf('`'), end: text.lastIndexOf('`') + 1 };
    expect(slips(text, [code])).toEqual([]);
    // Unskipped, the bare mark opens a quotation that "nothing" then opens over.
    expect(slips(text)).toEqual([at(text, '"', 'unclosed-before-next')]);
  });

  it('never reads a next paragraph\'s skipped first mark as speech going on', () => {
    const text = '“You are old, said the young man.\n\n"quoted" in a code block';
    const block = { start: text.indexOf('"quoted'), end: text.length };
    expect(slips(text, [block])).toEqual([at(text, '“', 'unclosed')]);
    expect(slips(text)).toEqual([]);
  });

  it('leaves single quotation marks and apostrophes alone', () => {
    expect(slips('‘I can’t explain myself, I’m afraid, sir,’ said Alice, ‘because I’m not myself.’')).toEqual([]);
    expect(slips('‘I can’t explain myself,” said Alice.')).toEqual([at('‘I can’t explain myself,” said Alice.', '”', 'unopened')]);
  });

  it('splits paragraphs at blank lines written with CRLF', () => {
    const text = '“You are old, said the young man.\r\n\r\nFather William replied.';
    expect(slips(text)).toEqual([at(text, '“', 'unclosed')]);
  });

  it('returns the slips in document order', () => {
    const text = '“First open. “Second open.\n\nA stray close.”';
    expect(slips(text).map((slip) => slip.at)).toEqual([text.indexOf('“'), text.indexOf('“', 1), text.lastIndexOf('”')]);
  });
});
