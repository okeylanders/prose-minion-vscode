/**
 * The file-edit gateway (ADR 2026-11-05 D4–D6, D11), with fake ports and the
 * real applier: targets resolved fresh from a catalog or the excerpt, each
 * policy row, the live text checked again, the applier's guards and
 * read-back, the document shown when it was hidden, and nothing saved or
 * logged of the writer's text. *Alice*.
 */

import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { ProjectFileEditGateway, type FileEditOutcome } from '@/application/services/fileEdits/ProjectFileEditGateway';
import type { FileEditExcerptState } from '@/application/services/fileEdits/fileEditTargets';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { FileEditRequest, FileEditTarget } from '@/domain/models/FileEdit';
import type { ContextPathGroup } from '@shared/types/context';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { applyTicked, FakeDocuments, writerTypes } from '../draftEdit/fakeDocuments';

const ROOT = '/workspace';
const NOTE_PATH = 'characters/alice.md';
const CHAPTER_PATH = 'chapters/chapter-01.md';
const NOTE = '---\ntitle: Alice\n---\n\nAlice is curious.\n\nShe follows the White Rabbit.\n';
const CHAPTER = 'Alice sat by her sister on the bank.\n\nThe White Rabbit ran close by her, and checked its `watch` twice.\n';

interface Fixture {
  readonly gateway: ProjectFileEditGateway;
  readonly documents: FakeDocuments;
  readonly log: string[];
  readonly catalogCalls: () => number;
}

function entry(group: ContextPathGroup, relative: string, overrides: Partial<ContextResourceSummary> = {}): ContextResourceSummary {
  return { group, path: relative, label: relative, sizeBytes: 100, absolutePath: `${ROOT}/${relative}`, ...overrides };
}

function fixture(options: {
  text?: string;
  uriPath?: string;
  entries?: ContextResourceSummary[];
  excerpt?: FileEditExcerptState;
  host?: ConstructorParameters<typeof FakeDocuments>[4];
} = {}): Fixture {
  const documents = new FakeDocuments(options.text ?? NOTE, `file://${ROOT}/${options.uriPath ?? NOTE_PATH}`, 'markdown', 1, options.host);
  const log: string[] = [];
  let catalogs = 0;
  const entries = options.entries ?? [entry('characters', NOTE_PATH), entry('chapters', CHAPTER_PATH)];
  const gateway = new ProjectFileEditGateway({
    catalog: {
      createProvider: async () => {
        catalogs += 1;
        return { listResources: () => entries, loadResources: async () => [] };
      }
    },
    excerpt: { current: async () => options.excerpt ?? { kind: 'none' } },
    workspace: { workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] },
    documents,
    applier: new DraftEditApplier(documents),
    log: { appendLine: (line) => log.push(line), show: () => undefined, clear: () => undefined }
  });
  return { gateway, documents, log, catalogCalls: () => catalogs };
}

const note: FileEditTarget = { kind: 'resource', group: 'characters', path: NOTE_PATH };
const chapter: FileEditTarget = { kind: 'resource', group: 'chapters', path: CHAPTER_PATH };
const request = (target: FileEditTarget, ...operations: TextEditOperation[]): FileEditRequest =>
  ({ target, operations, source: { kind: 'proposal', turnId: 'turn-7', index: 0 } });
const replace = (find: string, replacement: string): TextEditOperation => ({ op: 'replace', find, with: replacement });
const DIRECT = { review: 'direct' } as const;

function landed(outcome: FileEditOutcome): string[] {
  return outcome.kind === 'settled' ? outcome.operations.map(({ landing }) => landing) : [];
}

describe('ProjectFileEditGateway: notes', () => {
  it('rewrites a note whole after its front matter, and shows it when no editor did', async () => {
    const { gateway, documents, catalogCalls } = fixture();
    const outcome = await gateway.apply(request(note, { op: 'rewrite', text: 'Alice is brave.' }), DIRECT);
    expect(outcome).toMatchObject({ kind: 'settled', host: 'submitted', revealed: true, document: { version: 2 } });
    expect(documents.text).toBe('---\ntitle: Alice\n---\n\nAlice is brave.\n');
    expect(documents.opened).toEqual([`file://${ROOT}/${NOTE_PATH}`]);
    expect(documents.revealed).toHaveLength(1);
    expect(catalogCalls()).toBe(1);
  });

  it('takes replace, append and prepend together, and may change Markdown structure', async () => {
    const { gateway, documents } = fixture();
    documents.visible = true;
    const outcome = await gateway.apply(request(note,
      replace('Alice is curious.', '## Temper\n\nAlice is curious.'),
      { op: 'append', text: 'She grows and shrinks.' }
    ), DIRECT);
    expect(landed(outcome)).toEqual(['applied', 'applied']);
    expect(outcome).toMatchObject({ revealed: false });
    expect(documents.text).toBe('---\ntitle: Alice\n---\n\n## Temper\n\nAlice is curious.\n\nShe follows the White Rabbit.\n\nShe grows and shrinks.\n');
  });

  it('never touches front matter', async () => {
    const { gateway, documents } = fixture();
    const outcome = await gateway.apply(request(note, replace('title: Alice', 'title: Mabel')), DIRECT);
    expect(outcome).toMatchObject({ kind: 'settled', host: 'nothing', operations: [{ landing: 'refused', reason: 'protected' }] });
    expect(documents.text).toBe(NOTE);
  });
});

describe('ProjectFileEditGateway: prose', () => {
  it('replaces a passage in a chapter, line breaks allowed', async () => {
    const { gateway, documents } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const outcome = await gateway.apply(request(chapter, replace('ran close by her', 'ran close by her,\nlate')), DIRECT);
    expect(landed(outcome)).toEqual(['applied']);
    expect(documents.text).toContain('ran close by her,\nlate, and checked');
  });

  it('lets prose paragraphs split or merge, and new paragraphs be added, keeping its other structure', async () => {
    const { gateway, documents } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const outcome = await gateway.apply(request(chapter,
      replace('bank.\n\nThe White', 'bank. The White'),
      replace('ran close by her,', 'ran close by her.\n\nIt'),
      { op: 'append', text: 'Alice followed.' }
    ), DIRECT);
    expect(landed(outcome)).toEqual(['applied', 'applied', 'applied']);
    expect(documents.text).toBe('Alice sat by her sister on the bank. The White Rabbit ran close by her.\n\nIt and checked its `watch` twice.\n\nAlice followed.\n');
    const heading = await gateway.apply(request(chapter, { op: 'append', text: '# Chapter two' }), DIRECT);
    expect(heading).toMatchObject({ kind: 'settled', operations: [{ landing: 'refused', reason: 'markup' }] });
  });

  it('refuses a whole rewrite of prose', async () => {
    const { gateway, documents } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const outcome = await gateway.apply(request(chapter, { op: 'rewrite', text: 'Alice woke.' }), DIRECT);
    expect(outcome).toEqual({ kind: 'not-planned', faults: [{ index: 0, fault: 'not-allowed' }], message: 'Prose is never rewritten whole.' });
    expect(documents.applyCalls).toEqual([]);
  });

  it('bounds an appended passage at the budget\'s words', async () => {
    const { gateway } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const words = (count: number) => Array.from({ length: count }, () => 'Alice').join(' ');
    const over = await gateway.apply(request(chapter, { op: 'append', text: words(PROMPT_BUDGETS.workshopFileEdits.appendWords + 1) }), DIRECT);
    expect(over).toMatchObject({ kind: 'not-planned', faults: [{ index: 0, fault: 'passage-too-long' }] });
    const at = await gateway.apply(request(chapter, { op: 'prepend', text: words(PROMPT_BUDGETS.workshopFileEdits.appendWords) }), DIRECT);
    expect(landed(at)).toEqual(['applied']);
  });

  it('refuses replaces past the rewrite ceiling of the paragraphs they touch', async () => {
    const { gateway, documents } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const outcome = await gateway.apply(request(chapter, replace('sat by her sister on the bank', 'dreamed of a garden behind a tiny door')), DIRECT);
    expect(outcome).toMatchObject({ kind: 'not-planned', faults: [{ index: 0, fault: 'over-rewrite-ceiling' }] });
    expect(documents.text).toBe(CHAPTER);
  });

  it('keeps prose\'s Markdown structure and its protected regions', async () => {
    const { gateway, documents } = fixture({ text: CHAPTER, uriPath: CHAPTER_PATH });
    const heading = await gateway.apply(request(chapter, replace('Alice sat', '# Alice sat')), DIRECT);
    expect(heading).toMatchObject({ kind: 'settled', operations: [{ landing: 'refused', reason: 'markup' }] });
    const code = await gateway.apply(request(chapter, replace('`watch`', '`clock`')), DIRECT);
    expect(code).toMatchObject({ kind: 'settled', operations: [{ landing: 'refused', reason: 'protected' }] });
    expect(documents.text).toBe(CHAPTER);
  });
});

describe('ProjectFileEditGateway: the live text', () => {
  it('makes a quote that is no longer there exactly once a stale card, with nothing applied', async () => {
    const { gateway, documents } = fixture();
    const outcome = await gateway.apply(request(note, replace('Alice is bold.', 'x')), DIRECT);
    expect(outcome).toMatchObject({ kind: 'not-planned', message: 'The file changed since this was suggested.' });
    expect(documents.applyCalls).toEqual([]);
  });

  it('reads back a stale version: the writer typed during review, so nothing landed', async () => {
    const { gateway, documents } = fixture({ host: writerTypes([{ offset: 0, length: 0, text: 'x' }]) });
    const outcome = await gateway.apply(request(note, replace('curious', 'brave')), { review: 'preview' });
    expect(outcome).toMatchObject({ kind: 'settled', host: 'stale', revealed: false });
    expect(landed(outcome)).toEqual(['not-applied']);
    expect(documents.text).toContain('curious');
  });

  it('refuses a document that cannot be opened, and one that closes during the apply', async () => {
    const closed = fixture();
    closed.documents.close();
    expect(await closed.gateway.apply(request(note, replace('curious', 'brave')), DIRECT)).toMatchObject({ kind: 'refused', reason: 'unreadable' });

    const closing = fixture({ host: (_edits, _review, document) => { document.close(); return { kind: 'closed' }; } });
    const outcome = await closing.gateway.apply(request(note, replace('curious', 'brave')), DIRECT);
    expect(outcome).toMatchObject({ kind: 'settled', host: 'closed', revealed: false });
    expect(landed(outcome)).toEqual(['unknown']);
  });

  it('reads back a partial apply: the writer ticked one entry of two in review', async () => {
    const { gateway, documents } = fixture({ host: applyTicked((edit) => edit.newText === 'brave') });
    const outcome = await gateway.apply(request(note, replace('curious', 'brave'), replace('White Rabbit', 'Hatter')), { review: 'preview' });
    expect(landed(outcome)).toEqual(['applied', 'not-applied']);
    expect(outcome).toMatchObject({ message: 'Applied 1 of 2 changes. The file is not saved yet.' });
    expect(documents.text).toContain('brave');
    expect(documents.text).toContain('White Rabbit');
  });

  it('refuses a file whose live text is not text', async () => {
    const { gateway } = fixture({ text: 'Alice\u0000' });
    expect(await gateway.apply(request(note, replace('Alice', 'x')), DIRECT)).toMatchObject({ kind: 'refused', reason: 'not-text' });
  });

  it('writes a model\'s line breaks in the document\'s own', async () => {
    const { gateway, documents } = fixture({ text: 'Alice is curious.\r\n' });
    await gateway.apply(request(note, { op: 'append', text: 'She grows.\nShe shrinks.' }), DIRECT);
    expect(documents.text).toBe('Alice is curious.\r\n\r\nShe grows.\r\nShe shrinks.\r\n');
  });
});

describe('ProjectFileEditGateway: targets', () => {
  const refusal = async (target: FileEditTarget, entries?: ContextResourceSummary[]) =>
    (await fixture({ entries }).gateway.apply(request(target, replace('curious', 'brave')), DIRECT));

  it('looks a target up in a fresh catalog, never trusting its path', async () => {
    expect(await refusal({ kind: 'resource', group: 'characters', path: 'characters/hatter.md' })).toMatchObject({ reason: 'not-configured' });
    expect(await refusal({ kind: 'resource', group: 'characters', path: '../secrets.md' })).toMatchObject({ reason: 'unsafe-path' });
    expect(await refusal({ kind: 'resource', group: 'characters', path: `file://${ROOT}/${NOTE_PATH}` })).toMatchObject({ reason: 'unsafe-path' });
    expect(await refusal({ kind: 'resource', group: 'diaries' as ContextPathGroup, path: NOTE_PATH })).toMatchObject({ reason: 'unknown-group' });
  });

  it('refuses a target outside the workspace, binary, or over the size bound', async () => {
    expect(await refusal(note, [entry('characters', NOTE_PATH, { absolutePath: '/elsewhere/alice.md' })])).toMatchObject({ reason: 'outside-workspace' });
    expect(await refusal({ kind: 'resource', group: 'characters', path: 'characters/alice.png' }, [entry('characters', 'characters/alice.png')]))
      .toMatchObject({ reason: 'not-text' });
    expect(await refusal(note, [entry('characters', NOTE_PATH, { sizeBytes: PROMPT_BUDGETS.workshopFileEdits.fileBytes + 1 })]))
      .toMatchObject({ reason: 'too-large', message: expect.stringContaining('MiB') });
  });

  it('edits the excerpt\'s document as prose, only at its version and while it holds the excerpt', async () => {
    const excerpt: FileEditExcerptState = { kind: 'file', version: 3, text: 'The White Rabbit ran close by her', fsPath: `${ROOT}/${CHAPTER_PATH}` };
    const target: FileEditTarget = { kind: 'excerpt', excerptVersion: 3 };
    const run = (state: FileEditExcerptState, text = CHAPTER, to = target) =>
      fixture({ text, uriPath: CHAPTER_PATH, excerpt: state }).gateway.apply(request(to, replace('ran close', 'hurried close')), DIRECT);

    expect(landed(await run(excerpt))).toEqual(['applied']);
    expect(await run(excerpt, CHAPTER, { kind: 'excerpt', excerptVersion: 2 })).toMatchObject({ reason: 'excerpt-stale' });
    expect(await run(excerpt, CHAPTER.replace('ran close', 'ran near'))).toMatchObject({ reason: 'excerpt-stale' });
    expect(await run({ kind: 'manual', version: 3 })).toMatchObject({ reason: 'excerpt-manual' });
    expect(await run({ kind: 'unauthorized', version: 3 })).toMatchObject({ reason: 'outside-workspace' });
    expect(await run({ kind: 'none' })).toMatchObject({ reason: 'no-excerpt' });
    expect(await run({ ...excerpt, fsPath: '/elsewhere/chapter.md' })).toMatchObject({ reason: 'outside-workspace' });
  });
});

describe('ProjectFileEditGateway: what it leaves behind', () => {
  it('never logs the writer\'s text, a quote or a path', async () => {
    const { gateway, log } = fixture();
    await gateway.apply(request(note, replace('curious', 'brave')), DIRECT);
    await gateway.apply(request(note, replace('Mabel', 'x')), DIRECT);
    expect(log).toEqual([
      '[FileEdit] turn=turn-7 index=0 group=characters operations=1 host=submitted applied=1 revealed=true',
      '[FileEdit] turn=turn-7 index=0 group=characters operations=1 not-planned=not-found'
    ]);
  });

  it('leaves the change unsaved: the buffer moves, the port has no save', async () => {
    const { gateway, documents } = fixture();
    const outcome = await gateway.apply(request(note, replace('curious', 'brave')), DIRECT);
    expect(outcome).toMatchObject({ message: 'Applied. The file is not saved yet.' });
    expect(Object.keys(documents)).not.toContain('save');
    expect(documents.version).toBe(2);
  });
});
