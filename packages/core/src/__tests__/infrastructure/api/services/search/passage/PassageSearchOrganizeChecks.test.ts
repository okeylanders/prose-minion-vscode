/**
 * The organizing pass's reply and what the host keeps of it (ADR 2026-11-20
 * D12, D13): the codec reads asks, not gates; a cite stands only for an
 * instance the pass was shown; words in quotation marks stand only inside a
 * source quote (for a claim, one it cites); and what fails is dropped or
 * replaced, and counted. Texts adapt *Alice's Adventures in Wonderland*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PassageSearchAnalysis } from '@services/search/passage/PassageSearchContracts';
import {
  checkPassageSearchOrganizeReply,
  passageSearchComparableText,
  passageSearchHostHeadline,
  passageSearchQuotedSpans
} from '@services/search/passage/PassageSearchOrganizeChecks';
import {
  PassageSearchOrganizeReplyError,
  readPassageSearchOrganizeReply
} from '@services/search/passage/PassageSearchOrganizeReplyCodec';
import { instanceOf } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const bounds = PROMPT_BUDGETS.passageSearch;

const INSTANCES = [
  instanceOf(1, { quote: '“Oh dear! Oh dear! I shall be late!” it said to itself.', label: 'says it aloud' }),
  instanceOf(2, { quote: 'took a watch out of its\n  waistcoat-pocket' }),
  instanceOf(3, { quote: '“Oh my ears and whiskers, how late it’s getting!” it muttered.', label: 'says it aloud', file: 'f2' }),
  instanceOf(4, { quote: 'glanced at its watch again', file: 'f2' }),
  instanceOf(5, { quote: 'the Queen’s croquet-ground was a café of hedgehogs', file: 'f3' })
];
/** The pass was shown every instance but the last. */
const SHOWN = [1, 2, 3, 4];

type Claim = { text?: unknown; cites?: unknown; [extra: string]: unknown };
const replyOf = (sections: Array<{ title?: unknown; claims: Claim[] | unknown }>, headline: unknown = 'The Rabbit worries about the hour.'): string =>
  JSON.stringify({ headline, sections });
const check = (content: string, shown: readonly number[] = SHOWN): PassageSearchAnalysis =>
  checkPassageSearchOrganizeReply(readPassageSearchOrganizeReply(content, false), INSTANCES, shown);
const kept = (analysis: PassageSearchAnalysis): string[] => analysis.sections.flatMap((section) => section.claims.map((claim) => claim.text));
const faultOf = (content: string, cutOff = false): string => {
  try {
    readPassageSearchOrganizeReply(content, cutOff);
  } catch (error) {
    if (error instanceof PassageSearchOrganizeReplyError) {
      return error.fault;
    }
    throw error;
  }
  return 'read';
};

describe('The organizing pass\'s reply codec', () => {
  it('reads the format whole: headline, sections, claims and their cites', () => {
    const reply = readPassageSearchOrganizeReply(replyOf([{ title: 'Aloud', claims: [{ text: 'It says so twice.', cites: [1, 3] }] }]), false);
    expect(reply).toEqual({
      headline: 'The Rabbit worries about the hour.',
      sections: [{ title: 'Aloud', claims: [{ text: 'It says so twice.', cites: [1, 3], badCites: 0 }] }],
      malformedClaims: 0,
      malformedSections: 0,
      ignoredFields: 0,
      repairs: []
    });
  });

  it('reads through the shared parser, reporting a repair by kind', () => {
    const fenced = `\`\`\`json\n${replyOf([{ title: 'Aloud', claims: [{ text: 'It says so.', cites: [1] }] }])}\n\`\`\``;
    expect(readPassageSearchOrganizeReply(fenced, false).repairs).toEqual(['code-fence']);
  });

  it('ignores and counts fields the format does not define, at every level', () => {
    const content = JSON.stringify({
      headline: 'x',
      confidence: 0.9,
      sections: [{ title: 'Aloud', kind: 'speech', claims: [{ text: 'It says so.', cites: [1], weight: 2, source: 'a' }] }]
    });
    const reply = readPassageSearchOrganizeReply(content, false);
    expect(reply.ignoredFields).toBe(4);
    expect(reply.sections[0].claims).toHaveLength(1);
  });

  it('keeps whole-number cites once each, numbers written as digits included, and counts the rest', () => {
    const reply = readPassageSearchOrganizeReply(replyOf([{ title: 'T', claims: [{ text: 'A claim.', cites: [1, '3', 1, 2.5, 'four', null, [2]] }, { text: 'No list.', cites: 4 }] }]), false);
    expect(reply.sections[0].claims[0]).toMatchObject({ cites: [1, 3], badCites: 4 });
    expect(reply.sections[0].claims[1]).toMatchObject({ cites: [], badCites: 0 });
  });

  it('counts a claim with no text and a section with no claims list as malformed, and reads the rest', () => {
    const reply = readPassageSearchOrganizeReply(replyOf([
      { title: 'Kept', claims: [{ text: '  ', cites: [1] }, 'a string', { cites: [1] }, { text: 7, cites: [1] }, { text: 'It says\n  so.', cites: [1] }] },
      { title: 'No list', claims: 'none' },
      'not a section' as never
    ], 12), false);
    expect(reply).toMatchObject({ malformedClaims: 4, malformedSections: 2 });
    expect(reply).not.toHaveProperty('headline');
    expect(reply.sections).toEqual([{ title: 'Kept', claims: [{ text: 'It says so.', cites: [1], badCites: 0 }] }]);
  });

  it('reads every section and claim written: the counts the prompt states are asks', () => {
    const sections = Array.from({ length: bounds.organize.sections + 3 }, (_unused, index) => ({
      title: `Group ${index}`,
      claims: Array.from({ length: bounds.organize.claims + 2 }, () => ({ text: 'A claim.', cites: [1] }))
    }));
    const reply = readPassageSearchOrganizeReply(replyOf(sections), false);
    expect(reply.sections).toHaveLength(bounds.organize.sections + 3);
    expect(reply.sections[0].claims).toHaveLength(bounds.organize.claims + 2);
  });

  it('fails closed, by kind, on a reply cut off, too long, unparseable or with no sections list', () => {
    const whole = replyOf([{ title: 'T', claims: [{ text: 'A claim.', cites: [1] }] }]);
    expect(faultOf(whole, true)).toBe('cut');
    expect(faultOf(whole.slice(0, whole.length - 9), true)).toBe('cut');
    expect(faultOf(' '.repeat(bounds.responseCharacters + 1))).toBe('too-long');
    expect(faultOf('The Rabbit is late, mostly.')).toBe('unparseable');
    expect(faultOf('{"headline":"x"}')).toBe('no-sections');
    expect(faultOf('{"headline":"x","sections":{"title":"T"}}')).toBe('no-sections');
    expect(faultOf('[1, 2]')).toBe('no-sections');
    expect(new PassageSearchOrganizeReplyError('cut').message).not.toContain('Rabbit');
  });
});

describe('Quoted spans', () => {
  it('finds each span in straight or curly double marks, without its marks', () => {
    expect(passageSearchQuotedSpans('First "I shall be late!", then “how late it’s getting!”.')).toEqual(['I shall be late!', 'how late it’s getting!']);
    expect(passageSearchQuotedSpans('Nothing is quoted here; it’s the Rabbit’s watch.')).toEqual([]);
  });

  it('keeps the marks of the other kind, and nested curly marks, as the span\'s own text', () => {
    expect(passageSearchQuotedSpans('It reads "“Oh dear!” it said" in full.')).toEqual(['“Oh dear!” it said']);
    expect(passageSearchQuotedSpans('It reads “the “late” speech” twice.')).toEqual(['the “late” speech']);
  });

  it('reads a paired single-quoted span, curly or straight, as a quotation', () => {
    expect(passageSearchQuotedSpans('The Rabbit says ‘I shall be late!’ and runs.')).toEqual(['I shall be late!']);
    expect(passageSearchQuotedSpans('Its \'late\' speech and its ‘watch’.')).toEqual(['late', 'watch']);
    expect(passageSearchQuotedSpans('‘Oh dear!’')).toEqual(['Oh dear!']);
    // An apostrophe inside the span does not close it.
    expect(passageSearchQuotedSpans('It mutters ‘how late it’s getting!’ twice.')).toEqual(['how late it’s getting!']);
  });

  it('does not read an apostrophe as a quotation mark: contractions, possessives and an opener never closed', () => {
    expect(passageSearchQuotedSpans('It’s the Rabbit’s watch, and it isn\'t the Queen\'s.')).toEqual([]);
    expect(passageSearchQuotedSpans('The Rabbits’ watches and the hedgehogs\' ground.')).toEqual([]);
    expect(passageSearchQuotedSpans('’Tis late, and ‘tis later still')).toEqual([]);
  });

  it('leaves single marks inside a double-quoted span as that span\'s own text', () => {
    expect(passageSearchQuotedSpans('It reads "the Rabbits’ ‘late’ speech" in full.')).toEqual(['the Rabbits’ ‘late’ speech']);
  });

  it('reports a mark left unpaired', () => {
    expect(passageSearchQuotedSpans('It said "I shall be late! and ran.')).toBeUndefined();
    expect(passageSearchQuotedSpans('It said I shall be late!” and ran.')).toBeUndefined();
    expect(passageSearchQuotedSpans('It said “I shall be late!" and ran.')).toBeUndefined();
  });

  it('compares text folded, marks straightened and spaces collapsed', () => {
    expect(passageSearchComparableText('  The Queen’s  “CAFÉ”\n of hedgehogs ')).toBe('the queen\'s "cafe" of hedgehogs');
  });
});

describe('Citation checks', () => {
  it('keeps a cite only when it names an instance the pass was shown, and counts the others', () => {
    const analysis = check(replyOf([{ title: 'Watch', claims: [{ text: 'It keeps checking the time.', cites: [2, 5, 99, 4, 'x'] }] }]));
    expect(analysis.sections).toEqual([{ title: 'Watch', claims: [{ text: 'It keeps checking the time.', cites: [2, 4] }] }]);
    // 5 exists and was not shown; 99 names no instance; 'x' is no number.
    expect(analysis.dropped).toMatchObject({ cites: 3, claims: 0, sections: 0 });
    expect(analysis.read).toEqual({ instances: 4, of: 5 });
  });

  it('drops and counts a claim left with no cite: a missing instance, one not shown, or none written', () => {
    const analysis = check(replyOf([{
      title: 'Watch',
      claims: [
        { text: 'It names an instance that does not exist.', cites: [99] },
        { text: 'It names one the pass was not shown.', cites: [5] },
        { text: 'It cites nothing.', cites: [] },
        { text: 'It has no cites field.' },
        { text: 'It stands.', cites: [4] }
      ]
    }]));
    expect(kept(analysis)).toEqual(['It stands.']);
    expect(analysis.dropped).toMatchObject({ claims: 4, uncited: 4, misquoted: 0, malformed: 0, cites: 2, sections: 0 });
  });

  it('drops and counts a section left with no claim, and numbers the host\'s titles by what is kept', () => {
    const analysis = check(replyOf([
      { title: 'Emptied', claims: [{ text: 'Uncited.', cites: [] }] },
      { title: 'Never had one', claims: [] },
      { claims: [{ text: 'It stands.', cites: [1] }] },
      { title: '', claims: [{ text: 'So does this.', cites: [3] }] }
    ]));
    expect(analysis.sections.map((section) => section.title)).toEqual(['Group 1', 'Group 2']);
    expect(analysis.dropped).toMatchObject({ sections: 2, claims: 1 });
    expect(analysis.replaced).toEqual({ headline: false, titles: 2 });
  });

  it('keeps nothing when every claim fails, and still says what it read', () => {
    const analysis = check(replyOf([{ title: 'T', claims: [{ text: 'Uncited.', cites: [42] }] }]));
    expect(analysis.sections).toEqual([]);
    expect(analysis.read).toEqual({ instances: 4, of: 5 });
    expect(analysis.dropped).toMatchObject({ claims: 1, sections: 1 });
  });
});

describe('Quotation checks', () => {
  it('passes a quotation that stands in the source quote of an instance the claim cites', () => {
    const analysis = check(replyOf([{
      title: 'Aloud',
      claims: [
        { text: 'First "I shall be late!", then “how late it’s getting!”.', cites: [1, 3] },
        { text: 'The gesture is "glanced at its watch again".', cites: [4] }
      ]
    }]));
    expect(kept(analysis)).toHaveLength(2);
    expect(analysis.dropped).toMatchObject({ claims: 0, misquoted: 0 });
  });

  it('folds case, accents, mark shapes and line breaks, and lets closing punctuation sit inside the marks', () => {
    const analysis = check(replyOf([{
      title: 'Folded',
      claims: [
        { text: 'It says "HOW LATE IT\'S GETTING" under its breath.', cites: [3] },
        { text: 'It "took a watch out of its waistcoat-pocket," and ran.', cites: [2] },
        { text: 'The ground was "a cafe of hedgehogs."', cites: [5] },
        { text: 'It quotes the speech whole: "“Oh dear! Oh dear! I shall be late!” it said to itself."', cites: [1] }
      ]
    }]), [1, 2, 3, 4, 5]);
    expect(kept(analysis)).toHaveLength(4);
  });

  it('fails a claim that quotes an instance it does not cite, even one the pass was shown', () => {
    const analysis = check(replyOf([{
      title: 'Watch',
      claims: [
        { text: 'It "glanced at its watch again" as it spoke.', cites: [1] },
        { text: 'It "glanced at its watch again" at the corner.', cites: [4] }
      ]
    }]));
    expect(kept(analysis)).toEqual(['It "glanced at its watch again" at the corner.']);
    expect(analysis.dropped).toMatchObject({ claims: 1, misquoted: 1, uncited: 0 });
  });

  it('fails a claim whose kept cites do not hold the quotation, though a dropped cite would', () => {
    const analysis = check(replyOf([{ title: 'T', claims: [{ text: 'There was "a café of hedgehogs".', cites: [1, 5] }] }]));
    expect(kept(analysis)).toEqual([]);
    expect(analysis.dropped).toMatchObject({ misquoted: 1, cites: 1 });
  });

  it('fails an invented quotation, words joined from two places, an empty one and an unpaired mark', () => {
    const analysis = check(replyOf([{
      title: 'T',
      claims: [
        { text: 'It cries "I am terribly late!" twice.', cites: [1, 3] },
        { text: 'It says "Oh dear! it said to itself".', cites: [1] },
        { text: 'It says "" and nothing more.', cites: [1] },
        { text: 'It says "." and nothing more.', cites: [1] },
        { text: 'It says "I shall be late! and runs.', cites: [1] },
        { text: 'It worries about the hour.', cites: [1] }
      ]
    }]));
    expect(kept(analysis)).toEqual(['It worries about the hour.']);
    expect(analysis.dropped).toMatchObject({ claims: 5, misquoted: 5 });
  });

  it('replaces a headline that quotes words no instance shown holds with the host\'s, and keeps one that stands', () => {
    const sections = [{ title: 'T', claims: [{ text: 'It worries.', cites: [1] }] }];
    const failing = check(replyOf(sections, 'The Rabbit is "frightfully behind" all chapter.'));
    expect(failing.headline).toBe('5 instances in 3 files');
    expect(failing.replaced.headline).toBe(true);
    // Instance 5 holds these words, and the pass was not shown it.
    expect(check(replyOf(sections, 'It ends at "a café of hedgehogs".')).replaced.headline).toBe(true);
    const standing = check(replyOf(sections, 'Twice it says "I shall be late!" or near it.'));
    expect(standing.headline).toBe('Twice it says "I shall be late!" or near it.');
    expect(standing.replaced.headline).toBe(false);
    expect(check(replyOf(sections, undefined)).headline).toBe('The Rabbit worries about the hour.');
    expect(check(JSON.stringify({ sections })).headline).toBe('5 instances in 3 files');
    expect(passageSearchHostHeadline([instanceOf(1)])).toBe('1 instance in 1 file');
  });

  it('checks curly single-quoted words in a claim, a title and the headline as it checks double-quoted ones (PR #295)', () => {
    const analysis = check(replyOf([
      {
        title: 'The ‘frightfully behind’ speeches',
        claims: [
          { text: 'It cries ‘I am terribly late!’ twice.', cites: [1] },
          { text: 'It cries ‘I shall be late!’ once.', cites: [1] },
          { text: 'It’s the Rabbit’s worry, and the hedgehogs’ too.', cites: [1] }
        ]
      },
      { title: 'The ‘I shall be late!’ speeches', claims: [{ text: 'It worries again.', cites: [3] }] }
    ], 'The Rabbit is ‘frightfully behind’ all chapter.'));
    expect(kept(analysis)).toEqual(['It cries ‘I shall be late!’ once.', 'It’s the Rabbit’s worry, and the hedgehogs’ too.', 'It worries again.']);
    expect(analysis.dropped).toMatchObject({ misquoted: 1, claims: 1 });
    expect(analysis.sections.map((section) => section.title)).toEqual(['Group 1', 'The ‘I shall be late!’ speeches']);
    expect(analysis.replaced).toEqual({ headline: true, titles: 1 });
    expect(analysis.headline).toBe('5 instances in 3 files');
    // The same words in a headline that stands are kept.
    const standing = check(replyOf([{ title: 'T', claims: [{ text: 'It worries.', cites: [1] }] }], 'Twice it says ‘I shall be late!’ or near it.'));
    expect(standing.replaced.headline).toBe(false);
  });

  it('replaces a title that quotes words no instance shown holds, and keeps its claims', () => {
    const analysis = check(replyOf([
      { title: 'The "frightfully behind" speeches', claims: [{ text: 'It worries.', cites: [1] }] },
      { title: 'The "I shall be late!" speeches', claims: [{ text: 'It worries again.', cites: [3] }] }
    ]));
    expect(analysis.sections.map((section) => section.title)).toEqual(['Group 1', 'The "I shall be late!" speeches']);
    expect(kept(analysis)).toHaveLength(2);
    expect(analysis.replaced.titles).toBe(1);
  });

  it('fails closed once the search work is spent, rather than search without bound', () => {
    const reply = readPassageSearchOrganizeReply(replyOf([{
      title: 'T',
      claims: [
        { text: 'It "glanced at its watch again".', cites: [4] },
        { text: 'It "glanced at its watch" a second time.', cites: [4] },
        { text: 'It quotes nothing.', cites: [4] }
      ]
    }]), false);
    const spent = { ...bounds, organize: { ...bounds.organize, quotationWork: 'glanced at its watch again'.length } };
    const analysis = checkPassageSearchOrganizeReply(reply, INSTANCES, SHOWN, spent);
    expect(kept(analysis)).toEqual(['It "glanced at its watch again".', 'It quotes nothing.']);
    expect(analysis.dropped.misquoted).toBe(1);
  });

  it('checks a long reply in time that grows with its length', () => {
    const quote = 'glanced at its watch again';
    const text = Array.from({ length: 3_000 }, () => `"${quote}"`).join(' and ');
    const analysis = check(replyOf([{ title: 'T', claims: [{ text, cites: [4] }] }]));
    expect(kept(analysis)).toHaveLength(1);
  });
});

describe('Lengths are asks', () => {
  it('keeps prose over its ask whole, and clips only past the safety ceiling, with an ellipsis, counted', () => {
    const over = (ask: number): string => 'a'.repeat(ask + 1);
    const past = (ask: number): string => `${'word '.repeat(ask)}end`;
    const within = check(replyOf([{ title: over(bounds.organize.titleCharacters), claims: [{ text: over(bounds.organize.claimCharacters), cites: [1] }] }], over(bounds.organize.headlineCharacters)));
    expect(within.clipped).toBe(0);
    expect(within.headline).toHaveLength(bounds.organize.headlineCharacters + 1);
    expect(kept(within)[0]).toHaveLength(bounds.organize.claimCharacters + 1);

    const clipped = check(replyOf([{ title: past(bounds.organize.titleCharacters), claims: [{ text: past(bounds.organize.claimCharacters), cites: [1] }] }], past(bounds.organize.headlineCharacters)));
    expect(clipped.clipped).toBe(3);
    for (const [text, ask] of [
      [clipped.headline, bounds.organize.headlineCharacters],
      [clipped.sections[0].title, bounds.organize.titleCharacters],
      [kept(clipped)[0], bounds.organize.claimCharacters]
    ] as const) {
      expect(text.endsWith('…')).toBe(true);
      expect(text.length).toBeLessThanOrEqual(ask * bounds.safetyMultiple + 1);
    }
  });

  it('reads a claim\'s quotations whole before it clips, so a quotation past the ceiling is still checked', () => {
    const filler = 'word '.repeat(bounds.organize.claimCharacters);
    const analysis = check(replyOf([{
      title: 'T',
      claims: [
        { text: `${filler}and at the very end it cries "I am terribly late!"`, cites: [1] },
        { text: `${filler}and at the very end it cries "I shall be late!"`, cites: [1] }
      ]
    }]));
    expect(analysis.dropped.misquoted).toBe(1);
    expect(kept(analysis)).toHaveLength(1);
    expect(analysis.clipped).toBe(1);
  });
});
