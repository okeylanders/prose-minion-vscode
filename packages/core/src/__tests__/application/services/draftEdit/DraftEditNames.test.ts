/**
 * The word list and name consistency in a run (Draft Edit Slice 3b, part 2;
 * ADR 2026-10-21, Amendment 2026-10-26):
 * - the word list goes with the request, and a spelling or wrong-word
 *   finding on a listed word is dropped and counted, never shown;
 * - the host's name variants join the model's findings, flag-only, with a
 *   *Replace with* that is never preferred, and win where the two overlap;
 * - a selection run reads the whole document but shows only the variants
 *   inside its selection.
 * The document and annotator behave as VS Code's do (`fakeDocuments.ts`);
 * text is public-domain *Alice*, seeded with a misspelled name.
 */
import * as nameConsistency from '@/utils/proofread/nameConsistency';
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { ProofreadPass } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunRequest, ProofreadRunResult } from '@services/proofread/ProofreadService';
import { FakeAnnotations, FakeDocuments, proofreadNow } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const OPENING = 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.';
const DINAH = 'Then, thought Alice, Dinah will miss me very much to-night, and Alice hoped they would remember Dinah at tea-time.';
const FALLING = 'Down, down, down: so Alcie soon began talking again, and Dinah was the cat.';
const TEXT = `${OPENING}\n\n${DINAH}\n\n${FALLING}`;

const finding = (quote: string, category: ProofreadFinding['category'], replacement?: string): ProofreadFinding =>
  ({ anchor: { quote }, category, ...(replacement !== undefined ? { replacement } : {}), explanation: 'A seeded error.' });
const read = (...findings: ProofreadFinding[]): ProofreadRunResult => ({ kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] });
const FLAG: ProofreadPass = { kind: 'proofread', output: 'flag' };

function proofreader(text = TEXT) {
  const document = new FakeDocuments(text);
  const annotations = new FakeAnnotations(document);
  const replies: ProofreadRunResult[] = [];
  const requests: ProofreadRunRequest[] = [];
  const pass: ProofreadPassPort = {
    proofread: jest.fn(async (request: ProofreadRunRequest) => {
      requests.push(request);
      return replies.shift() ?? read();
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), log);
  const target = (selection?: string) => {
    const start = selection ? document.text.indexOf(selection) : -1;
    return { ...document.snapshot(), relativePath: 'chapter-01.md', ...(selection ? { range: { start, end: start + selection.length } } : {}) };
  };
  const flags = () => annotations.shown.map((annotation) => ({ text: document.text.slice(annotation.start, annotation.end), code: annotation.code }));
  return { document, annotations, useCase, replies, requests, target, flags, log };
}

afterEach(() => jest.restoreAllMocks());

describe('The word list in a run (Slice 3b, part 2)', () => {
  it('sends the list with the request, and drops a spelling or wrong-word finding on a listed word, counted', async () => {
    const { useCase, replies, requests, target, flags } = proofreader();
    replies.push(read(
      finding('Dinah', 'spelling', 'Diana'),
      finding('Dinah’s', 'wrong-word', 'Diana'),
      finding('Dinah', 'homophone', 'Diner'),
      finding('beginning', 'spelling', 'begining')
    ));

    const outcome = await proofreadNow(useCase, target(), { ...FLAG, wordList: ['Dinah', 'Alcie'] });

    expect(requests[0].wordList).toEqual(['Dinah', 'Alcie']);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { accepted: 2, unanchored: 1 } });
    expect(flags()).toEqual([{ text: 'beginning', code: 'proofread.spelling' }]);
  });

  it('sends no list when the pass names none', async () => {
    const { useCase, requests, target } = proofreader();
    await proofreadNow(useCase, target(), FLAG);

    expect(requests[0]).not.toHaveProperty('wordList');
  });
});

describe('Name consistency in a run (Slice 3b, part 2)', () => {
  it('flags each use of the variant, warning-level, with the common name as a Replace with that is never preferred', async () => {
    const { annotations, useCase, target, document } = proofreader();

    const outcome = await proofreadNow(useCase, target(), FLAG);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, judgmentCalls: 1 });
    expect(annotations.shown).toEqual([expect.objectContaining({
      start: document.text.indexOf('Alcie'),
      end: document.text.indexOf('Alcie') + 'Alcie'.length,
      severity: 'warning',
      code: 'proofread.name',
      message: '“Alcie” appears once in this document, and “Alice” 3 times. If “Alcie” is another name, add it to the Proofread word list. Suggested: “Alice”.',
      fix: { replacement: 'Alice', preferred: false }
    })]);
  });

  it('keeps the host\'s flag where a model finding overlaps it, counting the model\'s as overlapping', async () => {
    const { useCase, replies, target, flags } = proofreader();
    replies.push(read(finding('Alcie', 'spelling', 'Alice'), finding('so Alcie', 'missing-word', 'so Alice')));

    const outcome = await proofreadNow(useCase, target(), FLAG);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { overlapping: 2 } });
    expect(flags()).toEqual([{ text: 'Alcie', code: 'proofread.name' }]);
  });

  it('never flags a name the writer lists', async () => {
    const { useCase, target, flags } = proofreader();
    await proofreadNow(useCase, target(), { ...FLAG, wordList: ['Alcie'] });

    expect(flags()).toEqual([]);
  });

  it('reads the whole document in a selection run, and shows only the variants inside the selection', async () => {
    const inside = proofreader();
    await proofreadNow(inside.useCase, inside.target(FALLING), FLAG);
    expect(inside.flags()).toEqual([{ text: 'Alcie', code: 'proofread.name' }]);

    const outside = proofreader();
    await proofreadNow(outside.useCase, outside.target(DINAH), FLAG);
    expect(outside.flags()).toEqual([]);
  });

  it('is never made by Fix, or by Fix all: it stays a flag', async () => {
    const { useCase, target, flags, document } = proofreader();
    const outcome = await proofreadNow(useCase, target(), { kind: 'proofread', output: 'fix', review: 'direct' });

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, fix: { answer: 'none', applied: 0 } });
    await expect(useCase.applyShown(document.snapshot(), 'all-fixes', 'direct')).resolves.toEqual({ kind: 'nothing' });
    expect(document.text).toBe(TEXT);
    expect(flags()).toEqual([{ text: 'Alcie', code: 'proofread.name' }]);
  });

  it('shows no name flags when the check stopped at its budget, says so in the log only, and the run goes on', async () => {
    jest.spyOn(nameConsistency, 'findNameVariants').mockReturnValue({ kind: 'stopped', names: 4200, work: 250_000 });
    const { useCase, replies, target, flags, log } = proofreader();
    replies.push(read(finding('beginning', 'spelling', 'begining')));

    await expect(proofreadNow(useCase, target(), FLAG)).resolves.toMatchObject({ kind: 'completed', flagged: 1 });

    expect(flags()).toEqual([{ text: 'beginning', code: 'proofread.spelling' }]);
    expect(log.appendLine).toHaveBeenCalledWith('[DraftEdit] Proofread chapter-01.md: no name check (4200 capitalized words are too many to compare)');
  });

  describe('reads no heading as prose: ATX, setext, or inside a block quote or list (PR #176 F-02)', () => {
    const ROSE = 'Then, after a while, Rose looked about her. So, at last, Rose sat down. And then Rose slept.';

    it.each([
      ['ATX', '# The Rise'],
      ['setext', 'The Rise\n========'],
      ['in a block quote', '> # The Rise'],
      ['in a list item', '- # The Rise']
    ])('a heading\'s title case is no evidence of a name: %s', async (_kind, heading) => {
      const { useCase, target, flags } = proofreader(`${ROSE}\n\n${heading}\n\n${ROSE}`);
      await proofreadNow(useCase, target(), FLAG);

      expect(flags()).toEqual([]);
    });

    it('control: the same word mid-sentence in prose is read as a name', async () => {
      const { useCase, target, flags } = proofreader(`${ROSE}\n\nWe read, again, The Rise.`);
      await proofreadNow(useCase, target(), FLAG);

      expect(flags()).toEqual([{ text: 'Rise', code: 'proofread.name' }]);
    });

    it.each([
      ['setext', 'Then Alice\n=========='],
      ['in a block quote', '> ## Then Alice'],
      ['in a list item', '- ### Then Alice']
    ])('a heading\'s use of a name does not count toward how often it is used: %s', async (_kind, heading) => {
      const twice = 'Then, after a while, Alice looked about her. So, at last, Alice sat down.';
      const variant = 'And then Alcie slept.';
      const withHeading = proofreader(`${heading}\n\n${twice} ${variant}`);
      await proofreadNow(withHeading.useCase, withHeading.target(), FLAG);
      expect(withHeading.flags()).toEqual([]);

      const inProse = proofreader(`${twice} Later, Alice woke. ${variant}`);
      await proofreadNow(inProse.useCase, inProse.target(), FLAG);
      expect(inProse.flags()).toEqual([{ text: 'Alcie', code: 'proofread.name' }]);
    });
  });

  it('drops model issues the host\'s overlap before weighing model issues against each other (PR #176 N-02)', async () => {
    const { useCase, replies, target, flags } = proofreader('Alice sat. We saw Alice. We liked Alice. We told Alcie come after teh ceremony.');
    replies.push(read(finding('Alcie come after teh', 'missing-word', 'Alcie to come after teh'), finding('teh', 'spelling', 'the')));

    const outcome = await proofreadNow(useCase, target(), FLAG);

    expect(flags()).toEqual([{ text: 'Alcie', code: 'proofread.name' }, { text: 'teh', code: 'proofread.spelling' }]);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 2, dropped: { overlapping: 1 } });
  });

  it('lands through its own Replace with', async () => {
    const { annotations, useCase, target, document } = proofreader();
    await proofreadNow(useCase, target(), FLAG);

    const outcome = await useCase.applyShown(document.snapshot(), { issueIds: [annotations.shown[0].id] }, 'direct');

    expect(outcome).toMatchObject({ kind: 'done', applied: 1 });
    expect(document.text).toBe(TEXT.replace('Alcie', 'Alice'));
  });
});
