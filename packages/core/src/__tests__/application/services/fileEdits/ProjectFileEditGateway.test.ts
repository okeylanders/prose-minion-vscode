/**
 * The file-edit gateway's Apply (ADR 2026-11-05 D5–D7, D13; PR #226 F-02,
 * F-03, F-05, F-06), with fake ports and the real applier: the identity
 * re-authorized, the class recomputed, freshness against the baseline, each
 * policy row, the structure modes, the ceiling on every attempt, the last
 * dispatch boundary, the read-back, the reveal, and no leak in the logs.
 * *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { ProjectFileEditGateway, type FileEditApplyOutcome } from '@/application/services/fileEdits/ProjectFileEditGateway';
import type { FileEditApplyOptions, StagedFileEdit } from '@/domain/models/FileEdit';
import type { FileEditClass } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { applyAll, applyTicked, decline, FakeDocuments, firstThen, writerTypes, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf, type HostFakes } from './fileEditFixtures';

const NOTE = `${ROOT}/characters/alice.md`;
const CHAPTER = `${ROOT}/chapters/one.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is curious.\n\nShe follows the White Rabbit.\n';
const CHAPTER_TEXT = 'Alice sat by her sister on the bank.\n\nThe White Rabbit ran close by her, and checked its `watch` twice.\n';
const DIRECT: FileEditApplyOptions = { review: 'direct', stillCurrent: () => true };
const PREVIEW: FileEditApplyOptions = { review: 'preview', stillCurrent: () => true };

interface Fixture {
  readonly gateway: ProjectFileEditGateway;
  readonly documents: FakeDocuments;
  readonly fakes: HostFakes;
  /** The host's authority epoch: move it to change a root or a context-path setting. */
  readonly epoch: { value: number };
}

function fixture(options: { path?: string; text?: string; host?: HostBehavior; fakes?: Partial<HostFakes> } = {}): Fixture {
  const filePath = options.path ?? NOTE;
  const documents = new FakeDocuments(options.text ?? NOTE_TEXT, uriOf(filePath), 'markdown', 1, options.host ?? applyAll);
  const fakes = hostFakes({
    candidates: [candidate('characters', 'characters/alice.md'), candidate('chapters', 'chapters/one.md')],
    ...options.fakes
  });
  const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
  const epoch = { value: 0 };
  const gateway = new ProjectFileEditGateway({
    candidates, excerpt, workspace, fileSystem, log, documents, applier: new DraftEditApplier(documents), epoch: { current: () => epoch.value }
  });
  return { gateway, documents, fakes, epoch };
}

function staged(path: string, text: string, staging: FileEditClass, ...operations: TextEditOperation[]): StagedFileEdit {
  return {
    target: { kind: 'file', documentUri: uriOf(path), relativePath: path.slice(ROOT.length + 1) },
    class: staging,
    baseline: fileEditBaseline(text, path),
    operations,
    source: { kind: 'proposal', turnId: 'turn-7', index: 0 }
  };
}
const note = (...operations: TextEditOperation[]) => staged(NOTE, NOTE_TEXT, 'notes', ...operations);
const chapter = (...operations: TextEditOperation[]) => staged(CHAPTER, CHAPTER_TEXT, 'prose', ...operations);
const replace = (find: string, replacement: string): TextEditOperation => ({ op: 'replace', find, with: replacement });
const outcomes = (outcome: FileEditApplyOutcome) => outcome.operations.map((each) => each.outcome);
const prose = (host?: HostBehavior) => fixture({ path: CHAPTER, text: CHAPTER_TEXT, host });

describe('ProjectFileEditGateway: notes', () => {
  it('rewrites a note after its front matter, and shows it when no editor did', async () => {
    const { gateway, documents } = fixture();
    const outcome = await gateway.apply(note({ op: 'rewrite', text: 'Alice is brave.' }), DIRECT);
    expect(outcome).toMatchObject({ state: 'applied', revealed: true, document: { version: 2 } });
    expect(documents.text).toBe('---\ntitle: Alice\n---\n\nAlice is brave.\n');
    expect(documents.revealed).toHaveLength(1);
  });

  it('makes a rewrite stale once the note changed since staging', async () => {
    const { gateway, documents } = fixture({ text: NOTE_TEXT.replace('curious', 'bold') });
    const outcome = await gateway.apply(note({ op: 'rewrite', text: 'Alice is brave.' }), DIRECT);
    expect(outcome).toMatchObject({ state: 'stale', reason: 'baseline-changed', operations: [{ outcome: 'stale' }] });
    expect(documents.applyCalls).toEqual([]);
  });

  it('refuses a rewrite of a note holding protected syntax, or past the rewrite bound', async () => {
    const linked = '# Alice\n\nSee [the Rabbit](rabbit.md).\n';
    const withLink = await fixture({ text: linked }).gateway.apply(staged(NOTE, linked, 'notes', { op: 'rewrite', text: 'Alice.' }), DIRECT);
    expect(withLink).toMatchObject({ state: 'refused', reason: 'rewrite-protected', message: expect.stringContaining('replace edits') });
    const long = `${'Alice ran. '.repeat(PROMPT_BUDGETS.workshopFileEdits.rewriteFileBytes / 10)}\n`;
    const tooLong = await fixture({ text: long }).gateway.apply(staged(NOTE, long, 'notes', { op: 'rewrite', text: 'Alice.' }), DIRECT);
    expect(tooLong).toMatchObject({ state: 'refused', reason: 'rewrite-too-large' });
  });

  it('takes replace, append and prepend together, its structure free', async () => {
    const { gateway, documents } = fixture();
    documents.visible = true;
    const outcome = await gateway.apply(note(replace('Alice is curious.', '## Temper\n\nAlice is curious.'), { op: 'append', text: '- She grows.' }), DIRECT);
    expect(outcome).toMatchObject({ state: 'applied', revealed: false });
    expect(documents.text).toBe('---\ntitle: Alice\n---\n\n## Temper\n\nAlice is curious.\n\nShe follows the White Rabbit.\n\n- She grows.\n');
  });

  it('never touches front matter', async () => {
    const outcome = await fixture().gateway.apply(note(replace('title: Alice', 'title: Mabel')), DIRECT);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'protected', operations: [{ outcome: 'refused', reason: 'protected' }] });
  });
});

describe('ProjectFileEditGateway: prose', () => {
  it('refuses a whole rewrite', async () => {
    const { gateway, documents } = prose();
    expect(await gateway.apply(chapter({ op: 'rewrite', text: 'Alice woke.' }), DIRECT)).toMatchObject({ state: 'refused', reason: 'not-allowed' });
    expect(documents.applyCalls).toEqual([]);
  });

  it('lets paragraphs split, merge and be added (prose-paragraphs), line breaks included', async () => {
    const { gateway, documents } = prose();
    const outcome = await gateway.apply(chapter(
      replace('bank.\n\nThe White', 'bank. The White'),
      replace('ran close by her,', 'ran close by her.\n\nIt'),
      { op: 'append', text: 'Alice followed.' }
    ), DIRECT);
    expect(outcomes(outcome)).toEqual(['landed', 'landed', 'landed']);
    expect(documents.text).toBe('Alice sat by her sister on the bank. The White Rabbit ran close by her.\n\nIt and checked its `watch` twice.\n\nAlice followed.\n');
  });

  it('lets prose take italics, in an edit or an appended paragraph', async () => {
    const { gateway, documents } = prose();
    const outcome = await gateway.apply(chapter(replace('sat by her sister', 'sat by her *sister*'), { op: 'append', text: 'She was **very** late.' }), DIRECT);
    expect(outcome.state).toBe('applied');
    expect(documents.text).toContain('She was **very** late.');
  });

  it('keeps every other structure, and protected regions', async () => {
    const heading = await prose().gateway.apply(chapter({ op: 'append', text: '# Chapter two' }), DIRECT);
    expect(heading).toMatchObject({ state: 'refused', reason: 'markup' });
    const code = await prose().gateway.apply(chapter(replace('`watch`', '`clock`')), DIRECT);
    expect(code).toMatchObject({ state: 'refused', reason: 'protected' });
  });

  it('bounds each insertion by words and by characters', async () => {
    const { insertWords, insertCharacters } = PROMPT_BUDGETS.workshopFileEdits;
    const words = (count: number) => Array.from({ length: count }, () => 'Alice').join(' ');
    expect(await prose().gateway.apply(chapter({ op: 'append', text: words(insertWords + 1) }), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'insertion-too-long' });
    expect(await prose().gateway.apply(chapter({ op: 'prepend', text: 'A'.repeat(insertCharacters + 1) }), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'insertion-too-long' });
    expect((await prose().gateway.apply(chapter({ op: 'prepend', text: words(insertWords) }), DIRECT)).state).toBe('applied');
  });

  it('refuses replaces past the ceiling, and lets any replace under the floor through', async () => {
    const long = 'Alice '.repeat(80).trim();
    const text = `${long}.\n\nThe Rabbit ran.\n`;
    const path = CHAPTER;
    const over = await fixture({ path, text }).gateway.apply(staged(path, text, 'prose', replace(long, 'She sat.')), DIRECT);
    expect(over).toMatchObject({ state: 'refused', reason: 'rewrite-ceiling' });
    const under = await prose().gateway.apply(chapter(replace('sat by her sister on the bank', 'dreamed of a garden behind a door')), DIRECT);
    expect(under.state).toBe('applied');
  });

  it('lets Astra\'s 18-character quote through on the retry: under the floor, the ceiling never applies', async () => {
    const quote = 'Alice walked away.';
    const tail = ' The Hatter quietly remained at the table and waited for the next guest to arrive.';
    const text = `${quote}${tail}\n`;
    const { gateway, documents } = fixture({
      path: CHAPTER,
      text,
      host: firstThen(writerTypes([{ offset: quote.length, length: tail.length, text: '' }]), applyAll)
    });
    const outcome = await gateway.apply(staged(CHAPTER, text, 'prose', replace(quote, 'Nobody came home.')), DIRECT);
    expect(outcome.state).toBe('applied');
    expect(documents.applyCalls.map((call) => call.expectedVersion)).toEqual([1, 2]);
    expect(documents.text).toBe('Nobody came home.\n');
  });

  it('checks the ceiling again on the retry: a paragraph that shrank under a quote over the floor writes nothing (F-06)', async () => {
    const quote = `${'Alice walked slowly away from the bank. '.repeat(9).trim()}`;
    const tail = ` ${'The Hatter quietly remained at the table and waited for the next guest. '.repeat(10).trim()}`;
    const text = `${quote}${tail}\n`;
    const { gateway, documents } = fixture({
      path: CHAPTER,
      text,
      host: firstThen(writerTypes([{ offset: quote.length, length: tail.length, text: '' }]), applyAll)
    });
    const outcome = await gateway.apply(staged(CHAPTER, text, 'prose', replace(quote, 'Nobody came home.')), DIRECT);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'rewrite-ceiling' });
    expect(documents.applyCalls.map((call) => call.expectedVersion)).toEqual([1]);
    expect(documents.text).toBe(`${quote}\n`);
  });
});

describe('ProjectFileEditGateway: identity and class at Apply', () => {
  it('gives prose rules to a note that turned prose since staging (an overlapping chapters glob)', async () => {
    const { gateway } = fixture({ fakes: { candidates: [candidate('characters', 'characters/alice.md'), candidate('chapters', 'characters/alice.md')] } });
    expect(await gateway.apply(note({ op: 'rewrite', text: 'Alice is brave.' }), DIRECT)).toMatchObject({ state: 'refused', reason: 'not-allowed' });
  });

  it('gives prose rules to a note that became the excerpt\'s document', async () => {
    const { gateway } = fixture({ fakes: { excerpt: { fsPath: NOTE, relativePath: 'characters/alice.md' } } });
    expect(await gateway.apply(note({ op: 'rewrite', text: 'Alice is brave.' }), DIRECT)).toMatchObject({ state: 'refused', reason: 'not-allowed' });
  });

  it('refuses a file no longer configured, or whose root was removed', async () => {
    expect(await fixture({ fakes: { candidates: [] } }).gateway.apply(note(replace('curious', 'brave')), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'no-longer-configured' });
    expect(await fixture({ fakes: { roots: ['/second'] } }).gateway.apply(note(replace('curious', 'brave')), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'outside-workspace' });
    expect(await fixture({ fakes: { linked: new Set([`${ROOT}/characters`]) } }).gateway.apply(note(replace('curious', 'brave')), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'outside-workspace' });
  });

  it('keeps working when roots are reordered: the identity is the file, not a root\'s position', async () => {
    const { gateway } = fixture({ fakes: { roots: ['/second', ROOT] } });
    expect((await gateway.apply(note(replace('curious', 'brave')), DIRECT)).state).toBe('applied');
  });

  it('applies to an excerpt identity inside the workspace, catalog or not', async () => {
    const { gateway } = fixture({ path: `${ROOT}/drafts/one.md`, text: CHAPTER_TEXT, fakes: { candidates: [] } });
    const excerpt: StagedFileEdit = { ...staged(`${ROOT}/drafts/one.md`, CHAPTER_TEXT, 'prose', replace('ran close', 'hurried close')) };
    const outcome = await gateway.apply({ ...excerpt, target: { ...excerpt.target, kind: 'excerpt' } }, DIRECT);
    expect(outcome.state).toBe('applied');
  });

  it('refuses a document that cannot be opened as the identity', async () => {
    const closed = fixture();
    closed.documents.close();
    expect(await closed.gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ state: 'refused', reason: 'unreadable' });
    const other = fixture();
    (other.documents as unknown as { open: (uri: string) => Promise<unknown> }).open = async () => ({ ...other.documents.snapshot(), uri: uriOf(CHAPTER) });
    expect(await other.gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ state: 'refused', reason: 'identity-changed' });
  });

  it('makes no second applyEdits when authority moves between attempts (D7.6)', async () => {
    const elsewhere = { offset: NOTE_TEXT.length, length: 0, text: 'x' };
    const run = async (move: (fixture: Fixture, current: { value: boolean }) => void) => {
      const current = { value: true };
      const holder: { fixture?: Fixture } = {};
      const host: HostBehavior = firstThen((edits, review, document) => {
        move(holder.fixture as Fixture, current);
        return writerTypes([elsewhere])(edits, review, document);
      }, applyAll);
      holder.fixture = fixture({ host });
      const outcome = await holder.fixture.gateway.apply(note(replace('curious', 'brave')), { review: 'direct', stillCurrent: () => current.value });
      return { outcome, calls: holder.fixture.documents.applyCalls.length, text: holder.fixture.documents.text };
    };
    // The setting turned off, or the room generation moved: the caller's predicate.
    const predicate = await run((_fixture, current) => { current.value = false; });
    expect(predicate).toMatchObject({ outcome: { state: 'refused', reason: 'superseded' }, calls: 1 });
    expect(predicate.text).toContain('curious');
    // A root or a context-path setting changed: the epoch.
    const epoch = await run((moved) => { moved.epoch.value += 1; });
    expect(epoch).toMatchObject({ outcome: { state: 'refused', reason: 'authority-changed' }, calls: 1 });
    // Control: nothing moves, so the retry lands.
    const control = await run(() => undefined);
    expect(control).toMatchObject({ outcome: { state: 'applied' }, calls: 2 });
    expect(control.text).toContain('brave');
  });

  it('writes nothing when the epoch moved after re-authorization', async () => {
    const moving = fixture();
    const open = moving.documents.open.bind(moving.documents);
    (moving.documents as unknown as { open: typeof open }).open = async (uri: string) => {
      moving.epoch.value += 1;
      return open(uri);
    };
    expect(await moving.gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ state: 'refused', reason: 'authority-changed' });
    expect(moving.documents.applyCalls).toEqual([]);
  });

  it('writes nothing when the handler\'s last boundary fails', async () => {
    const { gateway, documents } = fixture();
    const outcome = await gateway.apply(note(replace('curious', 'brave')), { review: 'direct', stillCurrent: () => false });
    expect(outcome).toMatchObject({ state: 'refused', reason: 'superseded' });
    expect(documents.applyCalls).toEqual([]);
  });
});

describe('ProjectFileEditGateway: the read-back', () => {
  it('makes a missing quote stale, with nothing applied', async () => {
    const { gateway, documents } = fixture();
    expect(await gateway.apply(note(replace('Alice is bold.', 'x')), DIRECT)).toMatchObject({ state: 'stale', reason: 'not-found' });
    expect(documents.applyCalls).toEqual([]);
  });

  it('reads a stale version: the writer typed during review', async () => {
    const { gateway, documents } = fixture({ host: writerTypes([{ offset: 0, length: 0, text: 'x' }]) });
    const outcome = await gateway.apply(note(replace('curious', 'brave')), PREVIEW);
    expect(outcome).toMatchObject({ state: 'stale', revealed: false, operations: [{ outcome: 'not-applied' }] });
    expect(documents.text).toContain('curious');
  });

  it('reads a partial apply, a discarded preview and a document closed during the apply', async () => {
    const ticked = fixture({ host: applyTicked((edit) => edit.newText === 'brave') });
    const partial = await ticked.gateway.apply(note(replace('curious', 'brave'), replace('White Rabbit', 'Hatter')), PREVIEW);
    expect(partial).toMatchObject({ state: 'partial' });
    expect(outcomes(partial)).toEqual(['landed', 'not-applied']);

    expect(await fixture({ host: decline }).gateway.apply(note(replace('curious', 'brave')), PREVIEW)).toMatchObject({ state: 'declined', revealed: false });

    const closing = fixture({ host: (_edits, _review, document) => { document.close(); return { kind: 'closed' }; } });
    expect(await closing.gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ state: 'unknown' });
  });

  it('writes a model\'s line breaks in the document\'s own', async () => {
    const text = 'Alice is curious.\r\n';
    const { gateway, documents } = fixture({ text });
    await gateway.apply(staged(NOTE, text, 'notes', { op: 'append', text: 'She grows.\nShe shrinks.' }), DIRECT);
    expect(documents.text).toBe('Alice is curious.\r\n\r\nShe grows.\r\nShe shrinks.\r\n');
  });

  it('leaves every change unsaved, and logs no text, quote, path or URI', async () => {
    const { gateway, documents, fakes } = fixture();
    expect(await gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ message: 'Applied. The file is not saved yet.' });
    expect(documents.version).toBe(2);
    await gateway.apply(note(replace('Mabel', 'x')), DIRECT);
    await gateway.apply(note({ op: 'rewrite', text: 'Secret garden.' }), DIRECT);
    await fixture({ fakes: { candidates: [] } }).gateway.apply(note(replace('curious', 'brave')), DIRECT);
    expect(fakes.log[0]).toBe('[FileEdit] apply turn=turn-7 index=0 target=file class=notes operations=1 state=applied landed=1 revealed=true');
    expectNoLeaks(fakes.log, 'curious', 'brave', 'Mabel', 'Secret garden', 'Alice');
  });
});

describe('ProjectFileEditGateway: host-failed means nothing was written (D8, amended 2026-11-06)', () => {
  const editsThenThrows: HostBehavior = (edits, _review, document) => {
    document.edit(edits.map((edit) => ({ offset: edit.start, length: edit.end - edit.start, text: edit.newText })));
    throw new Error('the editor fell over after writing');
  };

  it('a throw before the applier is let through to applyEdits is nothing written: refused host-failed', async () => {
    const opening = fixture();
    (opening.documents as unknown as { open: () => Promise<never> }).open = async () => { throw new Error('open failed'); };
    expect(await opening.gateway.apply(note(replace('curious', 'brave')), DIRECT))
      .toMatchObject({ state: 'refused', reason: 'host-failed', operations: [{ outcome: 'refused', reason: 'host-failed' }] });
    expect(opening.documents.applyCalls).toEqual([]);

    const watching = fixture();
    (watching.documents as unknown as { watch: () => never }).watch = () => { throw new Error('watch failed'); };
    expect(await watching.gateway.apply(note(replace('curious', 'brave')), DIRECT)).toMatchObject({ state: 'refused', reason: 'host-failed' });
    expect(watching.documents.applyCalls).toEqual([]);
    expect(watching.fakes.log).toContain('[FileEdit] apply threw turn=turn-7 index=0 dispatched=false');
  });

  it('a throw after applyEdits was called may follow a landing: unknown by operation, never host-failed', async () => {
    const { gateway, documents, fakes } = fixture({ host: editsThenThrows });
    const outcome = await gateway.apply(note(replace('curious', 'brave'), replace('White Rabbit', 'Hatter')), DIRECT);
    expect(outcome).toMatchObject({ state: 'unknown', revealed: false });
    expect(outcome.reason).toBeUndefined();
    expect(outcomes(outcome)).toEqual(['unknown', 'unknown']);
    expect(documents.applyCalls).toHaveLength(1);
    expect(documents.text).toContain('brave');
    expect(fakes.log).toContain('[FileEdit] apply threw turn=turn-7 index=0 dispatched=true');
    expectNoLeaks(fakes.log, 'curious', 'brave', 'Hatter', 'Alice');
  });

  it('a throw on the retry, after a first attempt went out, is unknown too', async () => {
    const { gateway, documents } = fixture({ host: firstThen(writerTypes([{ offset: NOTE_TEXT.length, length: 0, text: 'x' }]), () => {
      throw new Error('the retry fell over');
    }) });
    const outcome = await gateway.apply(note(replace('curious', 'brave')), DIRECT);
    expect(outcome).toMatchObject({ state: 'unknown', operations: [{ outcome: 'unknown' }] });
    expect(documents.applyCalls).toHaveLength(2);
  });

  it('a host that answers failed, and whose read-back finds nothing landed, wrote nothing: refused host-failed', async () => {
    const { gateway, documents } = fixture({ host: () => ({ kind: 'failed', message: 'no' }) });
    const outcome = await gateway.apply(note(replace('curious', 'brave')), DIRECT);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'host-failed', operations: [{ outcome: 'not-applied' }] });
    expect(documents.text).toBe(NOTE_TEXT);
  });

  it('control: a host that answers failed after writing is read back as landed, never host-failed', async () => {
    const { gateway, documents } = fixture({ host: (edits, review, document) => {
      applyAll(edits, review, document);
      return { kind: 'failed', message: 'no' };
    } });
    const outcome = await gateway.apply(note(replace('curious', 'brave')), DIRECT);
    expect(outcome.state).toBe('applied');
    expect(documents.text).toContain('brave');
  });
});
