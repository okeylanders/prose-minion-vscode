/**
 * Quotation grounding is closed by construction (ADR 2026-11-20 D13; PR
 * #295 re-reviews): a claim, title or headline passes only when every word
 * inside any outermost quotation stands in one checked span, found in a
 * source quote; where the marks allow more than one reading, or none, it
 * fails closed. The reports' reproductions (single marks, then double marks
 * nested in double marks), the mirror cases on the opening side, the
 * positive controls, and a property over generated texts, raw single and
 * double marks among them, with an oracle of its own. Texts adapt *Alice*
 * and made-up sailors' and midnight chapters.
 */
import type { PassageSearchAnalysis } from '@services/search/passage/PassageSearchContracts';
import {
  checkPassageSearchOrganizeReply,
  passageSearchComparableText,
  passageSearchQuotedSpans
} from '@services/search/passage/PassageSearchOrganizeChecks';
import type { PassageSearchOrganizeReply } from '@services/search/passage/PassageSearchOrganizeReplyCodec';
import { instanceOf } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const SAILORS = 'The sailors watched the water.';

/** What the host keeps of one text written as a claim (beside one that always stands), a title and the headline. */
function judged(text: string, source: string = SAILORS): { claim: boolean; title: boolean; headline: boolean; analysis: PassageSearchAnalysis } {
  const reply: PassageSearchOrganizeReply = {
    headline: text,
    sections: [{ title: text, claims: [{ text, cites: [1], badCites: 0 }, { text: 'They watch.', cites: [1], badCites: 0 }] }],
    malformedClaims: 0,
    malformedSections: 0,
    ignoredFields: 0,
    repairs: []
  };
  const analysis = checkPassageSearchOrganizeReply(reply, [instanceOf(1, { quote: source })], [1]);
  return {
    claim: analysis.sections[0].claims.some((claim) => claim.text === text),
    title: analysis.sections[0].title === text,
    headline: !analysis.replaced.headline,
    analysis
  };
}

const failsEverywhere = (text: string, source?: string): void => {
  const outcome = judged(text, source);
  expect([text, outcome.claim, outcome.title, outcome.headline]).toEqual([text, false, false, false]);
};
const standsEverywhere = (text: string, source?: string): void => {
  const outcome = judged(text, source);
  expect([text, outcome.claim, outcome.title, outcome.headline]).toEqual([text, true, true, true]);
};

describe('The report\'s reproductions (PR #295 re-review)', () => {
  it('fails a claim, title and headline whose final closing mark has a space before it', () => {
    // "The sailors" stands in the source; the invented words after it once rode along unchecked.
    failsEverywhere('It says ‘The sailors’ invented a map of the sea ’ outright.');
    failsEverywhere('It says ‘The sailors invented a map ’ outright.');
    expect(passageSearchQuotedSpans('It says ‘The sailors’ invented a map ’ outright.')).toBeUndefined();
  });

  it('fails a quotation with a straight-apostrophe elision inside it, after a possessive or alone', () => {
    failsEverywhere('It says \'The sailors\' map, then \'tis all invented\' outright.');
    failsEverywhere('It says \'The sailors watched \'tis invented\' outright.');
    expect(passageSearchQuotedSpans('It says \'The sailors\' map, then \'tis all invented\' outright.')).toBeUndefined();
  });

  it('fails the mirror cases on the opening side: a space after it, a closing shape, a letter before it, no close', () => {
    failsEverywhere('It says ‘ the sailors invented a map’ outright.');
    failsEverywhere('It says ’the sailors invented a map’ outright.');
    failsEverywhere('It says the‘sailors invented a map’ outright.');
    failsEverywhere('It says ‘the sailors invented a map, and runs.');
  });

  it('reads every whitespace as one space before it reads a mark', () => {
    for (const space of [' ', ' ', ' ', '　', '\t', '\n', '\u0085', ' ']) {
      failsEverywhere(`It says ‘The sailors’${space}invented a map${space}’ outright.`);
      failsEverywhere(`It says ‘The sailors invented${space}’ outright.`);
      standsEverywhere(`It says ‘The sailors${space}watched${space}the water.’ plainly.`);
    }
  });

  it('fails a text quoting with marks the check does not read', () => {
    for (const text of ['It says «invented words».', 'It says „invented words“.', 'It says ‹invented›.', 'It says ‛invented’.', 'It says `invented\'.', 'It says ＂invented＂.']) {
      expect([text, passageSearchQuotedSpans(text)]).toEqual([text, undefined]);
      failsEverywhere(text);
    }
    // Inside double marks too: no reading of them can be checked (re-review of ceb26a9a).
    for (const text of ['It reads "the «late» speech" in full.', 'It reads "She said «meet me" before leaving».']) {
      expect([text, passageSearchQuotedSpans(text)]).toEqual([text, undefined]);
    }
  });
});

describe('Double marks nested inside double marks (PR #295 re-review of ceb26a9a)', () => {
  const GOODBYE = 'She said goodbye before leaving.';
  const MIDNIGHT = 'She said "meet me at midnight" before leaving.';

  it('checks the outermost quotation whole, nested marks and all: invented dialogue fails in a claim, title and headline', () => {
    failsEverywhere('It reads "She said "meet me at midnight" before leaving".', GOODBYE);
    expect(passageSearchQuotedSpans('It reads "She said "meet me at midnight" before leaving".')).toEqual(['She said "meet me at midnight" before leaving']);
    failsEverywhere('It reads “She said "meet me at midnight" before leaving”.', GOODBYE);
    failsEverywhere('It reads "She said “meet me at midnight” before leaving".', GOODBYE);
  });

  it('passes the same nesting when the source holds the whole outer quotation', () => {
    standsEverywhere('It reads "She said "meet me at midnight" before leaving".', MIDNIGHT);
    standsEverywhere('It reads “She said "meet me at midnight" before leaving”.', MIDNIGHT);
  });

  it('checks separate quotations each on its own', () => {
    expect(passageSearchQuotedSpans('It reads "She said" and "before leaving".')).toEqual(['She said', 'before leaving']);
    standsEverywhere('It reads "She said" and "before leaving".', GOODBYE);
    failsEverywhere('It reads "She said" and "after leaving".', GOODBYE);
  });

  it('fails a double mark that fits both roles or neither, a closer with no opener, an opener left open, or crossed kinds', () => {
    for (const text of [
      'It reads She"said goodbye.',
      'It reads " She said goodbye.',
      'It reads She said goodbye" before leaving.',
      'It reads "She said goodbye before leaving.',
      'It reads "She said "goodbye" before leaving.',
      'It reads "She said “goodbye" before leaving”.',
      'It reads “She said goodbye.',
      'It reads She said goodbye”.'
    ]) {
      expect([text, passageSearchQuotedSpans(text)]).toEqual([text, undefined]);
      failsEverywhere(text, GOODBYE);
    }
  });

  it('fails corner quotation marks, which the check does not read', () => {
    for (const text of ['It reads 「invented words」.', 'It reads 『invented words』.']) {
      expect([text, passageSearchQuotedSpans(text)]).toEqual([text, undefined]);
    }
  });
});

describe('Positive controls', () => {
  it('passes contractions and bare possessives outside any single-quoted quotation', () => {
    expect(passageSearchQuotedSpans('It isn’t the Queen’s map, nor the sailors’, and it\'s not the hedgehogs\'.')).toEqual([]);
    standsEverywhere('It isn’t the Queen’s map, nor the sailors’, and it\'s not the hedgehogs\'.');
  });

  it('passes a single-quoted quotation with a contraction or possessive before or after it, inside a word', () => {
    expect(passageSearchQuotedSpans('The Rabbit’s cry ‘The sailors watched’ and it’s true.')).toEqual(['The sailors watched']);
    standsEverywhere('The Rabbit’s cry ‘The sailors watched’ and it’s true.');
    standsEverywhere('It says \'the water.\' plainly.');
  });

  it('passes double-quoted quotations whole, apostrophes and single marks inside included', () => {
    const source = 'The sailors’ map was blue, and the ‘late’ Rabbit’s watch was not.';
    expect(passageSearchQuotedSpans('It says "The sailors’ map was blue" twice.')).toEqual(['The sailors’ map was blue']);
    standsEverywhere('It says "The sailors’ map was blue" and “the ‘late’ Rabbit’s watch”.', source);
    failsEverywhere('It says "The sailors’ map was red" twice.', source);
  });

  it('passes supported nested punctuation: curly doubles nesting, the other kind inside, closing punctuation inside', () => {
    expect(passageSearchQuotedSpans('It reads “the “late” speech” twice.')).toEqual(['the “late” speech']);
    expect(passageSearchQuotedSpans('It reads "“Oh dear!” it said" in full.')).toEqual(['“Oh dear!” it said']);
    const rabbit = '“Oh dear! Oh dear! I shall be late!” it said to itself.';
    standsEverywhere('It reads "“Oh dear! Oh dear! I shall be late!” it said" in full.', rabbit);
    standsEverywhere('It cries ‘I shall be late!’ and runs.', rabbit);
    standsEverywhere('It cries ‘Oh dear,’ then more.', rabbit);
  });
});

/** A small deterministic generator (mulberry32), so a failure names a text that can be run again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCE = 'She said "meet me at midnight" before leaving. Oh dear! I shall be late! The sailors watched the water, and the map was blue; the Queen kept the watch.';
const TOKENS = [
  'the', 'sailors', 'map', 'was', 'blue', 'late', 'watch', 'water', 'invented', 'Queen', 'Rabbit',
  'She', 'said', 'meet', 'me', 'at', 'midnight', 'before', 'leaving', 'goodbye',
  'Rabbit’s', 'Rabbit\'s', 'sailors’', 'sailors\'', 'it’s', 'isn\'t', '’tis', '\'tis', '‘tis', '’em', '\'90s',
  '‘', '’', '\'', '‘', '’', '\'',
  '"', '"', '"', '“', '”', '“', '”',
  '‘late’', '\'late\'', '‘the sailors’', '‘map was blue’', '‘invented words’', '\'invented\'', '‘late ’', '‘ late’', '‘late!’',
  '"late"', '“the sailors”', '"meet me at midnight"', '"She said "meet me at midnight" before leaving"', '"She said "meet me" before leaving"',
  '!', ',', '.', ';', '(', ')', '—'
];
const SPACES = [' ', ' ', ' ', ' ', '\u00a0', '\t', '\n', '\u2009', '\u3000', '\u0085', '\u2028', '  '];

function generated(next: () => number): string {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const count = 1 + Math.floor(next() * 9);
  let text = '';
  for (let token = 0; token < count; token += 1) {
    text += pick(TOKENS) + (next() < 0.7 ? pick(SPACES) : '');
  }
  return text;
}

/**
 * The oracle, written apart from the parser, of where quotations stand.
 * Double marks: a curly mark's shape is its role; a straight mark opens
 * after the start, a space, opening punctuation, a dash or an opening mark
 * when something not a space follows, and closes after something not a
 * space when the end, a space or punctuation follows. One that fits both
 * or neither, a closer that matches no opener of its kind, or an opener
 * left open, and the text must fail; otherwise every outermost double
 * quotation is a stretch. Single marks: from the first opening mark (‘
 * anywhere, or ' or ’ with no letter or digit before it) a reader could
 * take everything up to the last single mark that is not an apostrophe
 * inside a word as quoted, or on to the end when that mark could not close.
 * Inside an outermost double quotation that stretch is that quotation's,
 * unless it reaches outside it, when the text must fail; outside, it is a
 * stretch of its own, and must hold no double mark. Every stretch must be
 * one of the parser's checked spans, whole, and stand in the source.
 */
function unchecked(text: string): string[] {
  const letter = (character: string | undefined): boolean => character !== undefined && /[\p{L}\p{N}]/u.test(character);
  const spaced = Array.from(text.normalize('NFC')).map((character) => (/\s/u.test(character) || character === '\u0085' ? ' ' : character)).join('');
  const characters = Array.from(spaced.replace(/ {2,}/g, ' '));
  const mustFail = ['the marks cannot be read one way'];
  const singleOpening = (index: number): boolean => characters[index] === '‘' || ('\'’'.includes(characters[index]) && !letter(characters[index - 1]));

  const regions: Array<[number, number]> = [];
  const open: Array<{ kind: string; at: number }> = [];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (!'"“”'.includes(character)) {
      continue;
    }
    const before = characters[index - 1];
    const after = characters[index + 1];
    let role: 'open' | 'close';
    if (character === '"') {
      const afterOpening = (before === '"' && open.length > 0 && open[open.length - 1].at === index - 1) || (before !== undefined && singleOpening(index - 1));
      const opens = (before === undefined || before === ' ' || afterOpening || /[\p{Ps}\p{Pi}\p{Pd}]/u.test(before)) && after !== undefined && after !== ' ';
      const closes = before !== undefined && before !== ' ' && (after === undefined || after === ' ' || /\p{P}/u.test(after));
      if (opens === closes) {
        return mustFail;
      }
      role = opens ? 'open' : 'close';
    } else {
      role = character === '“' ? 'open' : 'close';
    }
    if (role === 'open') {
      open.push({ kind: character === '“' ? '”' : '"', at: index });
    } else {
      const top = open.pop();
      if (!top || top.kind !== character) {
        return mustFail;
      }
      if (open.length === 0) {
        regions.push([top.at + 1, index]);
      }
    }
  }
  if (open.length > 0) {
    return mustFail;
  }
  const stretches = regions.map(([start, end]) => characters.slice(start, end).join(''));

  const singles = characters.flatMap((character, index) =>
    (character === '‘' || ('\'’'.includes(character) && !(letter(characters[index - 1]) && letter(characters[index + 1]))) ? [index] : []));
  const first = singles.find(singleOpening);
  if (first !== undefined) {
    const ends = singles.filter((index) => index > first);
    const enclosing = regions.find(([start, end]) => start <= first && first < end);
    if (enclosing) {
      if (ends.some((index) => index >= enclosing[1])) {
        return mustFail;
      }
    } else {
      const last = ends[ends.length - 1];
      const closes = last !== undefined && characters[last] !== '‘' && characters[last - 1] !== ' ' && !letter(characters[last + 1]);
      const end = closes ? last : characters.length;
      if (characters.slice(first + 1, end).some((character) => '"“”'.includes(character))) {
        return mustFail;
      }
      stretches.push(characters.slice(first + 1, end).join(''));
    }
  }

  const checked = (passageSearchQuotedSpans(text) ?? []).map(passageSearchComparableText);
  const source = passageSearchComparableText(SOURCE);
  const bare = (span: string): string => span.replace(/[,.;:!?… ]+$/u, '');
  return stretches.filter((stretch) => {
    const whole = passageSearchComparableText(stretch);
    const found = bare(whole).length > 0 && (source.includes(whole) || source.includes(bare(whole)));
    return !checked.includes(whole) || !found;
  });
}

describe('The invariant, over generated texts', () => {
  it('either fails a text, or every word inside any outermost quotation is in one checked span, found in the source', () => {
    const next = random(0x295);
    const violations: Array<{ text: string; unchecked: string[] }> = [];
    let passedQuoting = 0;
    let passedNesting = 0;
    let failedQuoting = 0;
    for (let round = 0; round < 8_000; round += 1) {
      const text = generated(next);
      const outcome = judged(text, SOURCE);
      // One rule for all three.
      expect([text, outcome.title, outcome.headline]).toEqual([text, outcome.claim, outcome.claim]);
      const quotes = /[‘’'"“”]/u.test(text);
      if (!outcome.claim) {
        failedQuoting += quotes ? 1 : 0;
        continue;
      }
      const left = unchecked(text);
      if (left.length > 0) {
        violations.push({ text, unchecked: left });
      }
      const spans = passageSearchQuotedSpans(text) ?? [];
      passedQuoting += spans.length > 0 ? 1 : 0;
      passedNesting += spans.some((span) => span.includes('"')) ? 1 : 0;
    }
    expect(violations.slice(0, 5)).toEqual([]);
    // Not vacuous: texts with quotations, nested ones among them, both pass and fail.
    expect(passedQuoting).toBeGreaterThan(200);
    expect(passedNesting).toBeGreaterThan(20);
    expect(failedQuoting).toBeGreaterThan(200);
  });
});
