/**
 * Many fixes at once (PR #172 F-04). VS Code merges 1,000 operations or
 * more into one change spanning them all, the text between them included.
 * Fix and Fix all must still count what landed, and keep every untouched
 * flag on its text, on either side of that threshold. The host double merges
 * as VS Code's buffer does; text is synthetic.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { DraftEditOutcome } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import {
  FakeAnnotations,
  FakeDocuments,
  VS_CODE_MERGE_THRESHOLD,
  applyLikeVsCode
} from '@/__tests__/application/services/draftEdit/fakeDocuments';

/** `count` misspelled tokens (`w7x` for `w7y`), with a tense issue in their middle. */
function manuscript(count: number): { text: string; findings: ProofreadFinding[] } {
  const words = Array.from({ length: count }, (_, index) => `w${index}x`);
  const middle = Math.floor(count / 2);
  const text = `${words.slice(0, middle).join(' ')} and Alice is reading ${words.slice(middle).join(' ')}.`;
  const findings: ProofreadFinding[] = words.map((word) => ({ anchor: { quote: word }, category: 'spelling', replacement: word.replace(/x$/u, 'y'), explanation: 'A typo.' }));
  findings.push({ anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was reading', explanation: 'Past tense.' });
  return { text, findings };
}

function setup(count: number, ticked?: (newText: string) => boolean) {
  const { text, findings } = manuscript(count);
  const document = new FakeDocuments(text, undefined, 'markdown', 1, applyLikeVsCode(ticked ? (edit) => ticked(edit.newText) : undefined));
  const annotations = new FakeAnnotations(document);
  const result: ProofreadRunResult = { kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] };
  const pass: ProofreadPassPort = { proofread: jest.fn(async () => result) };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const target = () => ({ uri: document.uri, version: document.version, text: document.text, languageId: 'markdown', relativePath: 'chapter-01.md' });
  return { document, annotations, useCase, target };
}

function completed(outcome: DraftEditOutcome): Extract<DraftEditOutcome, { kind: 'completed' }> {
  if (outcome.kind !== 'completed') {
    throw new Error(`expected a completed run, got ${outcome.kind}`);
  }
  return outcome;
}

describe('Proofread and Fix with many fixes, either side of VS Code\'s merge threshold', () => {
  it.each([VS_CODE_MERGE_THRESHOLD - 1, VS_CODE_MERGE_THRESHOLD, VS_CODE_MERGE_THRESHOLD + 1])(
    'counts all %i fixes applied, and keeps the untouched tense flag on its text',
    async (count) => {
      const { document, annotations, useCase, target } = setup(count);
      const outcome = completed(await useCase.run(target(), { kind: 'proofread', output: 'fix', review: 'preview' }));

      expect(outcome.fix).toMatchObject({ answer: 'submitted', applied: count, notApplied: 0, unknown: 0 });
      expect(outcome).toMatchObject({ flagged: 1, judgmentCalls: 1, dropped: expect.objectContaining({ stale: 0 }) });
      expect(annotations.flaggedText()).toEqual(['is reading']);
      expect(document.text).not.toMatch(/w\d+x/u);
    }
  );

  it('counts a ticked subset of a merged change, and flags the rest on their text', async () => {
    const count = VS_CODE_MERGE_THRESHOLD + 300;
    const unticked = count / 5;
    // Untick every fifth fix; still more than the threshold ticked, so VS Code merges them.
    expect(count - unticked).toBeGreaterThanOrEqual(VS_CODE_MERGE_THRESHOLD);
    const { annotations, useCase, target } = setup(count, (newText) => Number(/\d+/u.exec(newText)![0]) % 5 !== 0);
    const outcome = completed(await useCase.run(target(), { kind: 'proofread', output: 'fix', review: 'preview' }));

    expect(outcome.fix).toMatchObject({ applied: count - unticked, notApplied: unticked, unknown: 0 });
    expect(annotations.flaggedText().filter((text) => /^w\d+x$/u.test(text))).toHaveLength(unticked);
    expect(annotations.flaggedText()).toContain('is reading');
  });
});

describe('Fix all with many shown fixes (the quick fix)', () => {
  it('applies them all through a merged change and shows the untouched flag again where it stands', async () => {
    const count = VS_CODE_MERGE_THRESHOLD + 1;
    const { document, annotations, useCase, target } = setup(count);
    await useCase.run(target(), { kind: 'proofread', output: 'flag' });
    expect(annotations.shown).toHaveLength(count + 1);

    const outcome = await useCase.applyShown(document.snapshot(), 'all-fixes', 'direct');

    expect(outcome).toMatchObject({ kind: 'done', answer: 'submitted', applied: count, unknown: 0 });
    // The annotator dropped every flag inside the merged change; the use case shows the untouched one again.
    expect(annotations.flaggedText()).toEqual(['is reading']);
  });
});
