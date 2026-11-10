/**
 * A requested rewrite at Apply (ADR 2026-11-10, second addendum; epic Reply
 * Edit Actions Slice 3b), with fake ports and the real applier. A proposal
 * staged with `intent: 'rewrites'` (the answer to a press on a rewrites
 * chip) is not held to the prose rewrite ceiling: the writer asked for it,
 * and reviews its diff on the card. That is the only thing lifted: every
 * other rule of the file's class still refuses it, exactly as it refuses
 * the same proposal with no intent. No model is called. *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { changedCharacters, intentFaults } from '@/application/services/fileEdits/fileEditPolicyChecks';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import {
  FILE_EDIT_INTENT_POLICIES,
  FILE_EDIT_TARGET_POLICIES,
  fileEditPolicyWithIntent,
  type FileEditApplyOptions,
  type FileEditIntent,
  type StagedFileEdit
} from '@/domain/models/FileEdit';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { applyAll, FakeDocuments, firstThen, writerTypes, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf } from './fileEditFixtures';

const CHAPTER = `${ROOT}/chapters/one.md`;
const PLACEHOLDER = '[Alice falls down the rabbit-hole. Describe the fall here: slow, strange, with time to look about her.]';
const WRITTEN = 'Down, down, down. Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down '
  + 'to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, '
  + 'but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards '
  + 'and book-shelves; here and there she saw maps and pictures hung upon pegs.';
const CHAPTER_TEXT = `Alice was beginning to get very tired of sitting by her sister on the bank.\n\n${PLACEHOLDER}\n\nSee the [map](maps/well.md) and \`the key\`.\n`;
const DIRECT: FileEditApplyOptions = { review: 'direct', stillCurrent: () => true };
const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

function fixture(text = CHAPTER_TEXT, host: HostBehavior = applyAll) {
  const documents = new FakeDocuments(text, uriOf(CHAPTER), 'markdown', 1, host);
  const fakes = hostFakes({ candidates: [candidate('chapters', 'chapters/one.md')] });
  const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
  const gateway = new ProjectFileEditGateway({
    candidates, excerpt, workspace, fileSystem, log, documents, applier: new DraftEditApplier(documents), epoch: { current: () => 0 }
  });
  return { gateway, documents, fakes };
}

function staged(intent: FileEditIntent | undefined, ...operations: TextEditOperation[]): StagedFileEdit {
  return {
    target: { kind: 'file', documentUri: uriOf(CHAPTER), relativePath: 'chapters/one.md' },
    class: 'prose',
    baseline: fileEditBaseline(CHAPTER_TEXT, CHAPTER),
    operations,
    source: { kind: 'proposal', turnId: 'turn-9', index: 0 },
    ...(intent ? { intent } : {})
  };
}
const replace = (find: string, replacement: string): TextEditOperation => ({ op: 'replace', find, with: replacement });
const WHOLE = replace(PLACEHOLDER, WRITTEN);
const apply = async (intent: FileEditIntent | undefined, operation: TextEditOperation, host?: HostBehavior) => {
  const held = fixture(CHAPTER_TEXT, host);
  const outcome = await held.gateway.apply(staged(intent, operation), DIRECT);
  return { ...held, outcome };
};

describe('the rewrites policy is data: it lifts the ceiling and nothing else', () => {
  it('narrows nothing, lifts the ceiling, and leaves every other row of each class as it was', () => {
    expect(FILE_EDIT_INTENT_POLICIES.rewrites).toEqual({ liftsRewriteCeiling: true });
    expect(intentFaults([WHOLE, { op: 'append', text: 'Alice followed.' }], FILE_EDIT_INTENT_POLICIES.rewrites)).toEqual([]);
    const prose = FILE_EDIT_TARGET_POLICIES.prose;
    const { ceiling, ...rest } = prose;
    expect(ceiling).toEqual({ share: BOUNDS.rewriteCeilingShare, floorCharacters: BOUNDS.rewriteFloorCharacters });
    expect(fileEditPolicyWithIntent(prose, FILE_EDIT_INTENT_POLICIES.rewrites)).toEqual(rest);
    expect(fileEditPolicyWithIntent(FILE_EDIT_TARGET_POLICIES.notes, FILE_EDIT_INTENT_POLICIES.rewrites)).toEqual(FILE_EDIT_TARGET_POLICIES.notes);
    // No intent, and fixes, keep the ceiling.
    expect(fileEditPolicyWithIntent(prose, undefined)).toBe(prose);
    expect(fileEditPolicyWithIntent(prose, FILE_EDIT_INTENT_POLICIES.fixes).ceiling).toEqual(ceiling);
  });

  it('the witness really is past the ceiling: well over the floor, and the whole of its paragraph', () => {
    const changed = changedCharacters(PLACEHOLDER, WRITTEN);
    expect(changed).toBeGreaterThan(BOUNDS.rewriteFloorCharacters);
    expect(changed).toBeGreaterThan(BOUNDS.rewriteCeilingShare * PLACEHOLDER.length * 2);
    expect(WRITTEN.length).toBeLessThan(BOUNDS.replaceWithCharacters);
  });
});

describe('ProjectFileEditGateway: a requested rewrite at Apply', () => {
  it('writes a placeholder paragraph out as prose, in one step', async () => {
    const { outcome, documents } = await apply('rewrites', WHOLE);
    expect(outcome).toMatchObject({ state: 'applied' });
    expect(documents.text).toBe(CHAPTER_TEXT.replace(PLACEHOLDER, WRITTEN));
    expect(documents.applyCalls).toHaveLength(1);
  });

  it('the identical operations as an ordinary proposal are still refused by the ceiling, and write nothing', async () => {
    const { outcome, documents } = await apply(undefined, WHOLE);
    expect(outcome).toMatchObject({
      state: 'refused', reason: 'rewrite-ceiling', message: 'This rewrites too much of the passage: prose takes edits, not rewrites.'
    });
    expect(documents.applyCalls).toEqual([]);
    expect(documents.text).toBe(CHAPTER_TEXT);
  });

  it('a fixes proposal is not helped by it', async () => {
    const { outcome, documents } = await apply('fixes', WHOLE);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'more-than-a-fix' });
    expect(documents.text).toBe(CHAPTER_TEXT);
  });

  it('is lifted on every attempt: the retry after the writer typed applies it; the same retry with no intent is refused', async () => {
    const typed = () => firstThen(writerTypes([{ offset: CHAPTER_TEXT.length - 1, length: 0, text: ' Late.' }]), applyAll);
    const asked = await apply('rewrites', WHOLE, typed());
    expect(asked.outcome.state).toBe('applied');
    expect(asked.documents.applyCalls.map((call) => call.expectedVersion)).toEqual([1, 2]);
    expect(asked.documents.text).toContain(WRITTEN);
    expect(asked.documents.text).toContain(' Late.');

    const unasked = await apply(undefined, WHOLE, typed());
    expect(unasked.outcome).toMatchObject({ state: 'refused', reason: 'rewrite-ceiling' });
    expect(unasked.documents.applyCalls).toEqual([]);
  });

  describe('everything that was not lifted still refuses it, exactly as with no intent', () => {
    const cases: ReadonlyArray<readonly [string, TextEditOperation]> = [
      ['a whole-file rewrite of prose', { op: 'rewrite', text: WRITTEN }],
      ['a replace that reaches into a link target', replace('[map](maps/well.md)', '[map](maps/other-well.md)')],
      ['a replace that reaches into inline code', replace('`the key`', '`the little golden key`')],
      ['a small replace that adds a heading', replace('[Alice falls', '## The fall\n\n[Alice falls')],
      ['a small replace that adds a list', replace('[Alice falls', '- Down.\n- Down.\n\n[Alice falls')],
      ['an append past the insertion bound', { op: 'append', text: Array.from({ length: BOUNDS.insertWords + 1 }, () => 'down').join(' ') }],
      ['a quote the file does not hold', replace('[Alice climbs out of the rabbit-hole.]', WRITTEN)],
      ['a quote the file holds twice', replace('the', 'that')]
    ];

    it.each(cases)('%s', async (_name, operation) => {
      const asked = await apply('rewrites', operation);
      const unasked = await apply(undefined, operation);
      expect(['refused', 'stale']).toContain(asked.outcome.state);
      expect(asked.outcome.reason).toBeDefined();
      expect(asked.outcome.reason).not.toBe('rewrite-ceiling');
      // The same verdict, for the same reason, as a proposal nobody asked for.
      expect([asked.outcome.state, asked.outcome.reason]).toEqual([unasked.outcome.state, unasked.outcome.reason]);
      expect(asked.documents.applyCalls).toEqual([]);
      expect(asked.documents.text).toBe(CHAPTER_TEXT);
    });
  });

  it.each([
    ['a heading', `## The fall\n\n${WRITTEN}`],
    ['a list', `- Down.\n- Down.\n- Down.\n\n${WRITTEN}`]
  ])('a whole-passage rewrite that adds %s is past the ceiling and still refused, by the structure rule', async (_name, replacement) => {
    const asked = await apply('rewrites', replace(PLACEHOLDER, replacement));
    expect(asked.outcome).toMatchObject({ state: 'refused', reason: 'markup' });
    expect(asked.documents.applyCalls).toEqual([]);
    expect(asked.documents.text).toBe(CHAPTER_TEXT);
    // With no intent the ceiling refuses it first.
    expect((await apply(undefined, replace(PLACEHOLDER, replacement))).outcome.reason).toBe('rewrite-ceiling');
  });

  it('logs ids and the state, never the quote, the replacement or a path', async () => {
    const { fakes } = await apply('rewrites', WHOLE);
    expectNoLeaks(fakes.log, 'rabbit-hole', 'Down, down', 'chapters/one');
  });
});
