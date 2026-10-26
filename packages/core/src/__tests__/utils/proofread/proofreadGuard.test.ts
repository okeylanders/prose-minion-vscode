/**
 * The Proofread guard (ADR 2026-10-21 D6): host code decides fix vs. flag.
 * Judgment calls are always flagged; a "fix" larger than a mechanical edit is
 * downgraded; no fix changes line breaks.
 */
import { editDistance, judgeProofreadFinding } from '@/utils/proofread/proofreadGuard';
import { DRAFT_EDIT_PASS_POLICIES } from '@/domain/models/DraftEdit';
import {
  PROOFREAD_CATEGORIES,
  isProofreadCategory,
  proofreadCategoryDisposition
} from '@/domain/models/ProofreadIssue';

const proofread = DRAFT_EDIT_PASS_POLICIES.proofread;
const judge = (category: (typeof PROOFREAD_CATEGORIES)[number], original: string, replacement?: string) =>
  judgeProofreadFinding({ category, original, replacement }, proofread);

describe('Proofread categories', () => {
  it('fixes surface errors and only flags judgment calls', () => {
    expect(PROOFREAD_CATEGORIES.map((c) => [c, proofreadCategoryDisposition(c)])).toEqual([
      ['spelling', 'fix'],
      ['homophone', 'fix'],
      ['punctuation', 'fix'],
      ['capitalization', 'fix'],
      ['spacing', 'fix'],
      ['agreement', 'flag'],
      ['tense', 'flag'],
      ['wrong-word', 'flag'],
      ['missing-word', 'flag'],
      ['extra-word', 'flag'],
      ['person', 'flag']
    ]);
  });

  it.each([
    ['wrong-word', 'cold', 'could'],
    ['missing-word', 'for hot day', 'for the hot day'],
    ['extra-word', 'speak say', 'say'],
    ['person', 'I thought', 'she thought']
  ] as const)('flags a %s finding, however small, and keeps its suggestion (Slice 3b)', (category, original, replacement) => {
    expect(judge(category, original, replacement)).toEqual({ kind: 'keep', disposition: 'flag' });
  });

  it('recognizes only the closed set', () => {
    expect(['tense', 'style', 'Tense', 3, undefined].map(isProofreadCategory)).toEqual([true, false, false, false, false]);
  });

  it('never lets a Proofread fix change line breaks, or the Markdown structure (PR #172 F-03)', () => {
    expect(proofread).toEqual({ modelScope: 'proofread', allowsNewlineChanges: false, preservesMarkdownStructure: true });
  });
});

describe('judgeProofreadFinding', () => {
  it('keeps small spelling and homophone corrections as fixes', () => {
    expect(judge('spelling', 'teh', 'the')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('homophone', 'weather', 'whether')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('spelling', 'the the', 'the')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('spelling', 'out of the the way', 'out of the way')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('spelling', 'The the', 'The')).toEqual({ kind: 'keep', disposition: 'fix' });
  });

  it('does not treat removing a different word as collapsing a doubled one', () => {
    expect(judge('spelling', 'the other', 'the')).toMatchObject({ disposition: 'flag', downgradeReason: 'non-mechanical-edit' });
    expect(judge('spelling', 'then the', 'the')).toMatchObject({ disposition: 'flag' });
  });

  it('downgrades a spelling "fix" that rewrites the word', () => {
    expect(judge('spelling', 'sleepy', 'drowsy')).toEqual({
      kind: 'keep', disposition: 'flag', downgradeReason: 'non-mechanical-edit'
    });
  });

  it('keeps punctuation, spacing, and case edits that leave letters and digits alone', () => {
    expect(judge('punctuation', 'this but', 'this, but')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('spacing', 'Oh  dear', 'Oh dear')).toEqual({ kind: 'keep', disposition: 'fix' });
    expect(judge('capitalization', 'white rabbit', 'White Rabbit')).toEqual({ kind: 'keep', disposition: 'fix' });
  });

  it('downgrades a punctuation "fix" that changes words', () => {
    expect(judge('punctuation', 'this but', 'this; however,')).toMatchObject({
      disposition: 'flag', downgradeReason: 'non-mechanical-edit'
    });
  });

  it('downgrades any fix that adds or removes a line break', () => {
    expect(judge('punctuation', 'afterwards it', 'afterwards,\nit')).toMatchObject({
      disposition: 'flag', downgradeReason: 'non-mechanical-edit'
    });
  });

  it('downgrades a fix that moves a line break without changing how many there are (PR #171 hardening)', () => {
    // Letters unchanged, one line break each side: the count rule let this through as a spacing fix.
    expect(judge('spacing', 'the\nquick', 'th\nequick')).toMatchObject({
      disposition: 'flag', downgradeReason: 'non-mechanical-edit'
    });
  });

  it('keeps a fix that leaves every line break where it stands', () => {
    expect(judge('spacing', 'end of\n line', 'end of\nline')).toEqual({ kind: 'keep', disposition: 'fix' });
  });

  it.each([
    ['a backtick, which would make code', 'punctuation', 'the rabbit', 'the `rabbit'],
    ['a pipe, which would split a table cell', 'punctuation', 'Alice, Dinah', 'Alice | Dinah'],
    ['an angle bracket, which would open a tag', 'punctuation', 'a hint', 'a <hint'],
    ['an asterisk, which would open emphasis', 'punctuation', 'very tired', 'very* tired'],
    ['an escape the text had', 'punctuation', 'cost \\*3', 'cost *3']
  ])('downgrades a fix that adds or removes %s (Slice 2)', (_name, category, original, replacement) => {
    expect(judge(category as (typeof PROOFREAD_CATEGORIES)[number], original, replacement)).toEqual({
      kind: 'keep', disposition: 'flag', downgradeReason: 'markup-change'
    });
  });

  it('keeps a fix beside markup it leaves alone', () => {
    expect(judge('spelling', 'teh *White* Rabbit', 'the *White* Rabbit')).toEqual({ kind: 'keep', disposition: 'fix' });
  });

  it('allows line breaks only for a pass whose policy does', () => {
    expect(judgeProofreadFinding({ category: 'spacing', original: 'a b', replacement: 'a\nb' }, { allowsNewlineChanges: true }))
      .toEqual({ kind: 'keep', disposition: 'fix' });
  });

  it('always flags tense and agreement, with or without a suggestion', () => {
    expect(judge('tense', 'runs', 'ran')).toEqual({ kind: 'keep', disposition: 'flag' });
    expect(judge('agreement', 'nor did Alice think')).toEqual({ kind: 'keep', disposition: 'flag' });
  });

  it('flags a fixable finding that carries no replacement', () => {
    expect(judge('spelling', 'teh')).toEqual({ kind: 'keep', disposition: 'flag', downgradeReason: 'no-replacement' });
  });

  it('drops a finding whose replacement is the original', () => {
    expect(judge('spelling', 'Alice', 'Alice')).toEqual({ kind: 'drop' });
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions, and substitutions', () => {
    expect(editDistance('teh', 'the')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });
});
