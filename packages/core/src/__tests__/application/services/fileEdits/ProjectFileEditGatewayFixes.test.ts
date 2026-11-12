/**
 * The fixes policy at Apply (ADR 2026-11-10 D6; epic Reply Edit Actions
 * Slice 2), with fake ports and the real applier. A proposal staged with
 * `intent: 'fixes'` is held to a fix's size by host code, whatever its
 * file's class would allow: find-and-replace only, at most
 * `fixChangedCharacters` changed on each side of a pair, never a line break,
 * and the `strict` structure mode. The same proposal with no intent takes
 * its class policy unchanged. No model is called. *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { changedCharacters, intentFaults } from '@/application/services/fileEdits/fileEditPolicyChecks';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import {
  FILE_EDIT_INTENT_POLICIES,
  FILE_EDIT_TARGET_POLICIES,
  type FileEditApplyOptions,
  type FileEditIntent,
  type StagedFileEdit
} from '@/domain/models/FileEdit';
import type { FileEditClass } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { applyAll, FakeDocuments, firstThen, writerTypes, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf } from './fileEditFixtures';

const NOTE = `${ROOT}/characters/alice.md`;
const CHAPTER = `${ROOT}/chapters/one.md`;
const CHAPTER_TEXT = 'Alice was begining to get very tired of sitting by her sister on the the bank.\n\nThe White Rabbit ran close by her.\n';
const NOTE_TEXT = 'Alice is seven and a half.\n\nShe follows the White Rabbit.\n';
const DIRECT: FileEditApplyOptions = { review: 'direct', stillCurrent: () => true };
const BOUND = PROMPT_BUDGETS.workshopEditOffers.fixChangedCharacters;
const FIXES = FILE_EDIT_INTENT_POLICIES.fixes;

function fixture(path: string, text: string, host: HostBehavior = applyAll) {
  const documents = new FakeDocuments(text, uriOf(path), 'markdown', 1, host);
  const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md'), candidate('chapters', 'chapters/one.md')] });
  const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
  const gateway = new ProjectFileEditGateway({
    candidates, excerpt, workspace, fileSystem, log, documents, applier: new DraftEditApplier(documents), epoch: { current: () => 0 }
  });
  return { gateway, documents, fakes };
}

function staged(path: string, text: string, kind: FileEditClass, intent: FileEditIntent | undefined, ...operations: TextEditOperation[]): StagedFileEdit {
  return {
    target: { kind: 'file', documentUri: uriOf(path), relativePath: path.slice(ROOT.length + 1) },
    class: kind,
    baseline: fileEditBaseline(text, path),
    operations,
    source: { kind: 'proposal', turnId: 'turn-9', index: 0 },
    ...(intent ? { intent } : {})
  };
}
const replace = (find: string, replacement: string): TextEditOperation => ({ op: 'replace', find, with: replacement });
const chapterFix = (...operations: TextEditOperation[]) => staged(CHAPTER, CHAPTER_TEXT, 'prose', 'fixes', ...operations);
const noteFix = (...operations: TextEditOperation[]) => staged(NOTE, NOTE_TEXT, 'notes', 'fixes', ...operations);

describe('the fixes policy is data beside the class policies (D6)', () => {
  it('holds exactly D6\'s row: replace only, the fix bound, no line break, strict', () => {
    const rows = FIXES.narrows!;
    expect([...rows.operations]).toEqual(['replace']);
    expect(rows.changedCharacters).toBe(BOUND);
    expect(BOUND).toBe(40);
    expect(rows.allowsNewlineChanges).toBe(false);
    expect(rows.structure).toBe('strict');
    // Fixes lift nothing.
    expect(FIXES.liftsRewriteCeiling).toBe(false);
    // It only narrows: no class is stricter on any row.
    for (const policy of Object.values(FILE_EDIT_TARGET_POLICIES)) {
      expect(policy.allowsNewlineChanges).toBe(true);
      expect(policy.structure).not.toBe('strict');
    }
  });

  it('measures a pair as the rewrite ceiling measures it: past the common start and end, the longer side', () => {
    expect(changedCharacters('begining', 'beginning')).toBe(1);
    expect(intentFaults([replace('begining', 'beginning'), replace('the the', 'the')], FIXES)).toEqual([]);
    // A long quote for context, a small change: still a fix.
    const context = 'Alice was begining to get very tired of sitting by her sister';
    expect(context.length).toBeGreaterThan(BOUND);
    expect(intentFaults([replace(context, context.replace('begining', 'beginning'))], FIXES)).toEqual([]);
  });

  it.each([
    ['exactly the bound on one side', 'x', `${'a'.repeat(BOUND)}`, []],
    ['one past the bound on the replacement\'s side', 'x', `${'a'.repeat(BOUND + 1)}`, ['more-than-a-fix']],
    ['one past the bound on the quote\'s side', `${'a'.repeat(BOUND + 1)}`, 'x', ['more-than-a-fix']]
  ])('%s', (_name, find, replacement, faults) => {
    expect(intentFaults([replace(find, replacement)], FIXES).map(({ fault }) => fault)).toEqual(faults);
  });

  it('refuses every operation that is not a replace, and any changed line break, each by its own index', () => {
    const faults = intentFaults([
      replace('begining', 'beginning'),
      { op: 'append', text: 'Alice followed.' },
      { op: 'prepend', text: 'Once.' },
      { op: 'rewrite', text: 'Alice.' },
      replace('bank.\n\nThe', 'bank. The'),
      replace('her sister', 'her\nsister')
    ], FIXES);
    expect(faults).toEqual([1, 2, 3, 4, 5].map((index) => ({ index, fault: 'more-than-a-fix' })));
    // A line break the pair keeps is no change.
    expect(intentFaults([replace('the bank.\n\nThe Wite', 'the bank.\n\nThe White')], FIXES)).toEqual([]);
  });

  it('refuses nothing without an intent', () => {
    expect(intentFaults([{ op: 'append', text: 'Alice followed.' }, replace('a', 'b'.repeat(500))], undefined)).toEqual([]);
  });
});

describe('ProjectFileEditGateway: a fixes proposal at Apply (D6)', () => {
  it('applies small fixes to prose, in one step', async () => {
    const { gateway, documents } = fixture(CHAPTER, CHAPTER_TEXT);
    const outcome = await gateway.apply(chapterFix(replace('begining', 'beginning'), replace('the the', 'the')), DIRECT);
    expect(outcome).toMatchObject({ state: 'applied' });
    expect(documents.text).toBe('Alice was beginning to get very tired of sitting by her sister on the bank.\n\nThe White Rabbit ran close by her.\n');
  });

  it('refuses a reworded clause, and writes nothing; the same edit with no intent is its class\'s to judge', async () => {
    const reworded = replace('to get very tired of sitting by her sister', 'to grow weary of the long afternoon beside her elder sister, who read');
    const held = fixture(CHAPTER, CHAPTER_TEXT);
    const refused = await held.gateway.apply(chapterFix(replace('begining', 'beginning'), reworded), DIRECT);
    expect(refused).toMatchObject({ state: 'refused', reason: 'more-than-a-fix', message: 'This is more than a small fix. Ask for it as a rewrite.' });
    expect(refused.operations.map(({ outcome }) => outcome)).toEqual(['not-applied', 'refused']);
    expect(held.documents.applyCalls).toEqual([]);
    expect(held.documents.text).toBe(CHAPTER_TEXT);

    const free = fixture(CHAPTER, CHAPTER_TEXT);
    const applied = await free.gateway.apply(staged(CHAPTER, CHAPTER_TEXT, 'prose', undefined, reworded), DIRECT);
    expect(applied.state).toBe('applied');
  });

  it.each([
    ['an append', { op: 'append', text: 'Alice followed.' } as TextEditOperation],
    ['a prepend', { op: 'prepend', text: 'Once.' } as TextEditOperation],
    ['a whole rewrite of a note', { op: 'rewrite', text: 'Alice is ten.' } as TextEditOperation]
  ])('refuses %s on a note, which its class alone would take', async (_name, operation) => {
    const held = fixture(NOTE, NOTE_TEXT);
    expect(await held.gateway.apply(noteFix(operation), DIRECT)).toMatchObject({ state: 'refused', reason: 'more-than-a-fix' });
    expect(held.documents.applyCalls).toEqual([]);
    const free = fixture(NOTE, NOTE_TEXT);
    expect((await free.gateway.apply(staged(NOTE, NOTE_TEXT, 'notes', undefined, operation), DIRECT)).state).toBe('applied');
  });

  it('never changes a line break, where prose alone may merge paragraphs', async () => {
    const merge = replace('bank.\n\nThe', 'bank. The');
    const held = fixture(CHAPTER, CHAPTER_TEXT);
    expect(await held.gateway.apply(chapterFix(merge), DIRECT)).toMatchObject({ state: 'refused', reason: 'more-than-a-fix' });
    expect(held.documents.text).toBe(CHAPTER_TEXT);
    const free = fixture(CHAPTER, CHAPTER_TEXT);
    expect((await free.gateway.apply(staged(CHAPTER, CHAPTER_TEXT, 'prose', undefined, merge), DIRECT)).state).toBe('applied');
  });

  it('holds the structure strict: a fix that adds emphasis is refused, where prose alone takes it', async () => {
    const emphasis = replace('very tired', '*very* tired');
    const held = fixture(CHAPTER, CHAPTER_TEXT);
    const refused = await held.gateway.apply(chapterFix(emphasis), DIRECT);
    expect(refused).toMatchObject({ state: 'refused', reason: 'markup' });
    expect(held.documents.text).toBe(CHAPTER_TEXT);
    const free = fixture(CHAPTER, CHAPTER_TEXT);
    expect((await free.gateway.apply(staged(CHAPTER, CHAPTER_TEXT, 'prose', undefined, emphasis), DIRECT)).state).toBe('applied');
  });

  it('is checked before every attempt: the retry after the writer typed still applies a fix', async () => {
    const typed = firstThen(writerTypes([{ offset: CHAPTER_TEXT.length - 1, length: 0, text: ' Late.' }]), applyAll);
    const { gateway, documents } = fixture(CHAPTER, CHAPTER_TEXT, typed);
    const outcome = await gateway.apply(chapterFix(replace('begining', 'beginning')), DIRECT);
    expect(outcome.state).toBe('applied');
    expect(documents.applyCalls.map((call) => call.expectedVersion)).toEqual([1, 2]);
    expect(documents.text).toContain('beginning');
  });

  it('logs the fault by name, and never the quote, the replacement or a path', async () => {
    const { gateway, fakes } = fixture(CHAPTER, CHAPTER_TEXT);
    await gateway.apply(chapterFix(replace('to get very tired of sitting by her sister', 'ZZQ-WITH to grow weary of the long afternoon beside her elder sister')), DIRECT);
    expect(fakes.log.join('\n')).toContain('state=refused reason=more-than-a-fix');
    expectNoLeaks(fakes.log, 'very tired', 'ZZQ-WITH', 'chapters/one');
  });
});
