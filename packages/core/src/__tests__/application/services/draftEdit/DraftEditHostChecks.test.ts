/**
 * Quotation marks and consistency in a run (Draft Edit Slice 3b, part 3;
 * ADR 2026-10-21, Amendment 2026-10-26):
 * - the host's quotation and consistency issues join the model's findings,
 *   flag-only, warning-level, and win where the two overlap;
 * - a quotation slip carries no *Replace with*; a consistency flag offers
 *   the other spelling, never preferred;
 * - the run's spelling convention decides a word the convention spells one
 *   way;
 * - a selection run reads the whole document, and shows only what lies
 *   inside its selection;
 * - Fix never makes either;
 * - a consistency flag's own *Replace with* writes the word it names, and
 *   nothing of a listed compound (PR #182 F-01, F-02);
 * - emphasis around balanced speech is no slip (F-03).
 * The document and annotator behave as VS Code's do (`fakeDocuments.ts`);
 * text adapts public-domain *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import { describeDraftEditOutcome } from '@/application/services/draftEdit/draftEditSummary';
import type { ProofreadPass } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const GREY = 'The grey cat sat on the grey wall, and the grey dawn came up over the hill.';
const SPEECH = '“Who are you? said the Caterpillar, and Alice answered in a gray voice.';
// Opens with narration: a paragraph opening with a quotation mark would read as the speech going on.
const REPLY = 'Alice replied, “I hardly know, sir.”';
const TEXT = `${GREY}\n\n${SPEECH}\n\n${REPLY}`;

const finding = (quote: string, category: ProofreadFinding['category'], replacement?: string): ProofreadFinding =>
  ({ anchor: { quote }, category, ...(replacement !== undefined ? { replacement } : {}), explanation: 'A seeded error.' });
const read = (...findings: ProofreadFinding[]): ProofreadRunResult => ({ kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] });
const FLAG: ProofreadPass = { kind: 'proofread', output: 'flag' };

function proofreader(text = TEXT) {
  const document = new FakeDocuments(text);
  const annotations = new FakeAnnotations(document);
  const replies: ProofreadRunResult[] = [];
  const pass: ProofreadPassPort = { proofread: jest.fn(async () => replies.shift() ?? read()) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), log);
  const target = (selection?: string) => {
    const start = selection ? document.text.indexOf(selection) : -1;
    return { ...document.snapshot(), relativePath: 'chapter-01.md', ...(selection ? { range: { start, end: start + selection.length } } : {}) };
  };
  const flags = () => annotations.shown.map((annotation) => ({ text: document.text.slice(annotation.start, annotation.end), code: annotation.code }));
  return { document, annotations, useCase, replies, target, flags };
}

describe('Quotation marks and consistency in a run (Slice 3b, part 3)', () => {
  it('flags an unclosed quotation with no Replace with, and a less used spelling with the other, both warnings', async () => {
    const { annotations, useCase, target, document } = proofreader();

    const outcome = await useCase.run(target(), FLAG);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 2, judgmentCalls: 2 });
    expect(annotations.shown).toEqual([
      {
        id: expect.any(String),
        start: document.text.indexOf('“Who'),
        end: document.text.indexOf('“Who') + 1,
        severity: 'warning',
        code: 'proofread.quotation',
        message: 'This quotation mark opens a quotation that is still open where its paragraph ends.'
          + ' If the speech goes on, the next paragraph opens with a quotation mark; otherwise a closing mark is missing.'
      },
      expect.objectContaining({
        start: document.text.indexOf('gray'),
        end: document.text.indexOf('gray') + 'gray'.length,
        severity: 'warning',
        code: 'proofread.consistency',
        message: 'This document spells this word “gray” once and “grey” 3 times. Suggested: “grey”.',
        fix: { replacement: 'grey', preferred: false }
      })
    ]);
    expect(describeDraftEditOutcome(outcome, 'chapter-01.md').message).toBe('Proofread chapter-01.md: 2 issues flagged (2 need your judgment)');
  });

  it('keeps the host\'s flags where model findings overlap them, counting the model\'s as overlapping', async () => {
    const { useCase, replies, target, flags } = proofreader();
    replies.push(read(finding('gray', 'spelling', 'grey'), finding('“Who are', 'punctuation', 'Who are')));

    const outcome = await useCase.run(target(), FLAG);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 2, dropped: { overlapping: 2 } });
    expect(flags()).toEqual([{ text: '“', code: 'proofread.quotation' }, { text: 'gray', code: 'proofread.consistency' }]);
  });

  it('lets the run\'s spelling convention decide, naming it', async () => {
    const { annotations, useCase, target, flags } = proofreader();
    await useCase.run(target(), { ...FLAG, spelling: 'american' });

    expect(flags()).toEqual([
      { text: 'grey', code: 'proofread.consistency' },
      { text: 'grey', code: 'proofread.consistency' },
      { text: 'grey', code: 'proofread.consistency' },
      { text: '“', code: 'proofread.quotation' }
    ]);
    expect(annotations.shown[0].message).toBe('This document spells this word “grey” 3 times and “gray” once. American spelling uses “gray”. Suggested: “gray”.');
  });

  it('reads the whole document in a selection run, and shows only what lies inside the selection', async () => {
    const speech = proofreader();
    await speech.useCase.run(speech.target(SPEECH), FLAG);
    expect(speech.flags()).toEqual([{ text: '“', code: 'proofread.quotation' }, { text: 'gray', code: 'proofread.consistency' }]);

    const reply = proofreader();
    await reply.useCase.run(reply.target(REPLY), FLAG);
    expect(reply.flags()).toEqual([]);
  });

  it('is never made by Fix, or by Fix all: both stay flags', async () => {
    const { useCase, target, flags, document } = proofreader();
    const outcome = await useCase.run(target(), { kind: 'proofread', output: 'fix', review: 'direct' });

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 2, fix: { answer: 'none', applied: 0 } });
    await expect(useCase.applyShown(document.snapshot(), 'all-fixes', 'direct')).resolves.toEqual({ kind: 'nothing' });
    expect(document.text).toBe(TEXT);
    expect(flags()).toEqual([{ text: '“', code: 'proofread.quotation' }, { text: 'gray', code: 'proofread.consistency' }]);
  });

  it('never flags a spelling the writer lists', async () => {
    const { useCase, target, flags } = proofreader();
    await useCase.run(target(), { ...FLAG, wordList: ['gray'] });

    expect(flags()).toEqual([{ text: '“', code: 'proofread.quotation' }]);
  });

  it('writes a hyphenated word\'s part where it stands, when its Replace with is chosen (PR #182 F-01)', async () => {
    const text = 'Aİ-gray paint. The grey sky. The grey sea.';
    const { document, useCase, target, flags, annotations } = proofreader(text);
    await useCase.run(target(), FLAG);
    expect(flags()).toEqual([{ text: 'gray', code: 'proofread.consistency' }]);

    const outcome = await useCase.applyShown(document.snapshot(), { issueIds: [annotations.shown[0].id] }, 'direct');

    expect(outcome).toMatchObject({ kind: 'done', applied: 1, refused: 0 });
    expect(document.text).toBe('Aİ-grey paint. The grey sky. The grey sea.');
  });

  it('never offers to change a listed compound, and its Replace with on the part standing alone leaves the compound (PR #182 F-02)', async () => {
    const text = 'Alice wore a grey-green cloak, and the grey dawn came. A gray sky, a gray sea, a gray hill.';
    const { document, useCase, target, flags, annotations } = proofreader(text);
    await useCase.run(target(), { ...FLAG, wordList: ['grey-green'] });
    expect(annotations.shown.map((annotation) => annotation.start)).toEqual([text.indexOf('grey dawn')]);
    expect(flags()).toEqual([{ text: 'grey', code: 'proofread.consistency' }]);

    await useCase.applyShown(document.snapshot(), { issueIds: [annotations.shown[0].id] }, 'direct');

    expect(document.text).toBe('Alice wore a grey-green cloak, and the gray dawn came. A gray sky, a gray sea, a gray hill.');
  });

  it('reads emphasized speech that opens with an ellipsis or a dash as balanced, and still flags one left open (PR #182 F-03)', async () => {
    const balanced = 'Alice said, *“...and then?”* The Hatter said, **"—No!"** The Dormouse said, _“…Treacle.”_';
    const clean = proofreader(balanced);
    await clean.useCase.run(clean.target(), FLAG);
    expect(clean.flags()).toEqual([]);

    const open = proofreader('Alice said, *“...and then?* The Hatter said nothing.');
    await open.useCase.run(open.target(), FLAG);
    expect(open.flags()).toEqual([{ text: '“', code: 'proofread.quotation' }]);
  });
});
