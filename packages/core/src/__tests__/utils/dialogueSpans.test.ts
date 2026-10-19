import { countDialogueWords, findDialogueSpans } from '@/utils/dialogueSpans';

/** The text of each span, so expectations read as prose rather than offsets. */
const spanTexts = (text: string): string[] =>
  findDialogueSpans(text).map(span => text.slice(span.start, span.end));

/** The pre-fix `PassageProseStats` count, kept as an oracle for straight quotes. */
const legacyDialogueWords = (text: string): number => {
  const matches = text.match(/"[^"]*"/g);
  return matches ? matches.join(' ').split(/\s+/).filter(word => word.length > 0).length : 0;
};

const MULTI_PARAGRAPH_SPEECH = [
  '“The first thing you learn,” she said, “is patience.',
  '“The second is when to stop being patient.”',
  'He waited. She did not go on.'
].join('\n\n');

describe('findDialogueSpans', () => {
  it.each([
    ['empty text', ''],
    ['whitespace only', '  \n\n \t '],
    ['prose without quote marks', 'The rain kept falling on the roof.']
  ])('finds nothing in %s', (_label, text) => {
    expect(findDialogueSpans(text)).toEqual([]);
  });

  it('pairs straight double quotes in sequence and reports offsets', () => {
    const text = '"Hello," she said. "How are you?"';
    expect(findDialogueSpans(text)).toEqual([
      { start: 0, end: 8, closed: true },
      { start: 19, end: 33, closed: true }
    ]);
    expect(spanTexts(text)).toEqual(['"Hello,"', '"How are you?"']);
  });

  it('pairs curly double quotes by direction', () => {
    const text = '“Hello,” she said. “How are you?”';
    expect(spanTexts(text)).toEqual(['“Hello,”', '“How are you?”']);
    expect(findDialogueSpans(text).every(span => span.closed)).toBe(true);
  });

  it('handles straight and curly styles in one text', () => {
    const text = '"Straight," he said.\n\n“Curly,” she said. "Straight again."';
    expect(spanTexts(text)).toEqual(['"Straight,"', '“Curly,”', '"Straight again."']);
  });

  it('closes a quotation that mixes styles at its first closer', () => {
    // Text edited in two tools: a curly opener closed by a straight mark, and the reverse.
    const text = '“Hello," she said. "Fine.” He left.';
    expect(spanTexts(text)).toEqual(['“Hello,"', '"Fine.”']);
  });

  it('keeps a single-quoted quotation nested in dialogue inside the outer span', () => {
    expect(spanTexts('“She told me, ‘Never again,’ and left,” he said.')).toEqual([
      '“She told me, ‘Never again,’ and left,”'
    ]);
    expect(spanTexts('"She told me, \'Never again,\' and left," he said.')).toEqual([
      '"She told me, \'Never again,\' and left,"'
    ]);
  });

  it('closes curly quotes nested in curly quotes at the first closer', () => {
    // Typographically double-in-double should be double-in-single; the stray
    // outer closer is ignored rather than opening a span over the narration.
    expect(spanTexts('“He said, “Run!” and left,” she said. The door shut.')).toEqual(['“He said, “Run!”']);
  });

  it('ignores a closing curly quote with nothing open', () => {
    expect(findDialogueSpans('He stopped.” Then he left the room.')).toEqual([]);
  });

  it('runs a quote never closed to the end of the text', () => {
    const text = 'She said, “Wait for me';
    expect(findDialogueSpans(text)).toEqual([{ start: 10, end: text.length, closed: false }]);
  });

  it('stops a quote never closed at its paragraph break', () => {
    const text = '“Wait, she said.\n\nThe rain kept falling. Nobody spoke.\n\nNobody moved.';
    expect(findDialogueSpans(text)).toEqual([{ start: 0, end: 16, closed: false }]);
  });

  it('keeps a stray straight quote from shifting the pairing of later paragraphs', () => {
    // The inches mark opens a span it cannot close. The former regex paired it
    // with the next paragraph's opener and left "Bye," he said. unmatched.
    const text = 'He cut 12" of rope.\n\nShe left. "Bye," he said.';
    expect(spanTexts(text)).toEqual(['" of rope.', '"Bye,"']);
    expect(text.match(/"[^"]*"/g)).toEqual(['" of rope.\n\nShe left. "']);
  });

  it('does not treat apostrophes, possessives or elisions as quote marks', () => {
    const text = '“I don’t know,” she said. The boys’ bikes were gone, and it\'s late. ‘Twas ever thus. Tell ’em.';
    expect(spanTexts(text)).toEqual(['“I don’t know,”']);
    expect(spanTexts('"It\'s the twins\' dog," he said. Don’t.')).toEqual(['"It\'s the twins\' dog,"']);
  });

  it('does not match single-quoted dialogue', () => {
    // Deliberate: ‘ and ’ collide with apostrophes (see the module comment).
    expect(findDialogueSpans('‘Hello,’ she said. ‘Are you well?’')).toEqual([]);
  });

  it('reads multi-paragraph speech as open to each paragraph end', () => {
    expect(findDialogueSpans(MULTI_PARAGRAPH_SPEECH).map(span => span.closed)).toEqual([true, false, true]);
    expect(spanTexts(MULTI_PARAGRAPH_SPEECH)).toEqual([
      '“The first thing you learn,”',
      '“is patience.',
      '“The second is when to stop being patient.”'
    ]);
  });

  it('lets a quotation continue over a single line break', () => {
    expect(spanTexts('“Line one\nline two,” she said.')).toEqual(['“Line one\nline two,”']);
  });

  it('treats a blank line holding only whitespace as a paragraph break', () => {
    expect(spanTexts('“Open\n \t\nClosed.” he said')).toEqual(['“Open']);
  });

  it('never returns a span that crosses a paragraph break', () => {
    const texts = [
      MULTI_PARAGRAPH_SPEECH,
      '"One\n\ntwo" "three\n\n\nfour"',
      '“a\n\nb” “c\n  \nd”',
      'He cut 12" of rope.\n\nShe left. "Bye," he said.'
    ];
    for (const text of texts) {
      for (const span of spanTexts(text)) {
        expect(span).not.toMatch(/\n\s*\n/);
      }
    }
  });
});

describe('countDialogueWords', () => {
  it('returns 0 for empty text and for text without dialogue', () => {
    expect(countDialogueWords('')).toBe(0);
    expect(countDialogueWords('The rain kept falling on the roof.')).toBe(0);
  });

  it('counts whitespace-separated tokens inside spans, quote marks included', () => {
    expect(countDialogueWords('“Hello there,” she said. “Come in.”')).toBe(4);
  });

  it.each([
    '"Hello world" said John',
    '"All dialogue" "More dialogue"',
    '"He said, \\"hello\\"" said John',
    '"Line one\nline two," she said.',
    '"It\'s the twins\' dog," he said. Don\'t.',
    '"You came back," she said.\n\nHe set the lamp on the table. "I said I would."\n\n"You say a lot of things." She didn\'t look up. "Most of them true."'
  ])('matches the former regex count for straight quotes: %j', (text) => {
    expect(countDialogueWords(text)).toBe(legacyDialogueWords(text));
  });

  it('sums per paragraph to the same count as the whole text', () => {
    // Lightbox counts dialogue per paragraph; the totals must agree with Metrics.
    const text = [
      MULTI_PARAGRAPH_SPEECH,
      'He cut 12" of rope.',
      '"Bye," he said. “See you,” she said.'
    ].join('\n\n  \n');
    const perParagraph = text
      .split(/\n\s*\n/)
      .reduce((total, paragraph) => total + countDialogueWords(paragraph), 0);
    expect(perParagraph).toBe(countDialogueWords(text));
    expect(countDialogueWords(text)).toBeGreaterThan(0);
  });
});
