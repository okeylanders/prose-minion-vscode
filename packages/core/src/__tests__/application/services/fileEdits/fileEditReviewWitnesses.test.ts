/**
 * PR #229 review witnesses (F-01, F-02, F-03, N-01), ported from Astra's
 * reproduction suite and turned to the safe behavior, through the real
 * resolver, staging, gateway and applier where the finding needs them.
 * *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import type { StagedFileEdit } from '@/domain/models/FileEdit';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { FileType, type FileStat } from '@/platform';
import type { DocumentTextChange } from '@/platform/DocumentEditor';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '../../../mocks/platform';
import { applyAll, FakeDocuments, firstThen, writerTypes, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, hostFakes, ports, uriOf } from './fileEditFixtures';

const CHAPTER = '/workspace/chapters/alice.md';
const DIRECT = { review: 'direct' as const, stillCurrent: () => true };
const file = (size = 18): FileStat => ({ type: FileType.File, size, ctime: 0, mtime: 0 });
const settings = (entries: Array<[string, string]>) => createFakeSettings(Object.fromEntries(entries));
const logSink = () => {
  const lines: string[] = [];
  return { lines, sink: { appendLine: (line: string) => lines.push(line), show: () => undefined, clear: () => undefined } };
};

/** The real resolver over a fake host: `findFiles` answers by root and glob, or throws. */
function realHost(options: {
  patterns: Array<[string, string]>;
  roots?: string[];
  findFiles: (root: string, glob: string) => Promise<string[]>;
  stat?: (filePath: string) => Promise<FileStat>;
  text?: string;
}) {
  const log = logSink();
  const workspace = createFakeWorkspace({
    workspaceFolders: () => (options.roots ?? ['/workspace']).map((root) => ({ path: root, name: root })),
    findFiles: options.findFiles
  });
  const fileSystem = createFakeFileSystem({ stat: options.stat ?? (async () => file()) });
  const resolver = new ContextResourceResolver(settings(options.patterns), fileSystem, workspace, log.sink);
  const documents = new FakeDocuments(options.text ?? 'Alice walked home.\n', uriOf(CHAPTER));
  const shared = { candidates: resolver, fileSystem, workspace, log: log.sink, documents, excerpt: { currentDocument: async () => undefined } };
  return {
    log: log.lines,
    documents,
    staging: new FileEditStagingService(shared),
    gateway: new ProjectFileEditGateway({ ...shared, applier: new DraftEditApplier(documents), epoch: { current: () => 0 } })
  };
}

function staged(text: string, operations: TextEditOperation[], kind: 'notes' | 'prose' = 'prose'): StagedFileEdit {
  return {
    target: { kind: 'file', documentUri: uriOf(CHAPTER), relativePath: 'chapters/alice.md' },
    class: kind,
    baseline: fileEditBaseline(text, CHAPTER),
    operations,
    source: { kind: 'proposal', turnId: 'turn-7', index: 0 }
  };
}

describe('F-01: an incomplete candidate read fails closed', () => {
  const overlapping: Array<[string, string]> = [['contextPaths.general', '**/*.md'], ['contextPaths.chapters', 'chapters/*.md']];

  it('refuses staging and Apply when the prose search fails, never downgrading a chapter to notes', async () => {
    const failing = realHost({
      patterns: overlapping,
      findFiles: async (_root, glob) => {
        if (glob === 'chapters/*.md') {
          throw new Error('search unavailable');
        }
        return [CHAPTER];
      }
    });
    await expect(failing.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' }))
      .resolves.toEqual({ kind: 'refused', reason: 'catalog-unreadable' });
    // A proposal staged as notes earlier still cannot rewrite while the search fails.
    const outcome = await failing.gateway.apply(staged('Alice walked home.\n', [{ op: 'rewrite', text: 'Entire chapter replaced.' }], 'notes'), DIRECT);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'catalog-unreadable' });
    expect(failing.documents.applyCalls).toEqual([]);
    expect(failing.documents.text).toBe('Alice walked home.\n');
  });

  it('refuses when a second root\'s search fails: uniqueness is never proved from part of the roots', async () => {
    const host = realHost({
      patterns: [['contextPaths.general', '**/*.md']],
      roots: ['/workspace', '/second'],
      findFiles: async (root) => {
        if (root === '/second') {
          throw new Error('search unavailable');
        }
        return [CHAPTER];
      }
    });
    await expect(host.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' }))
      .resolves.toEqual({ kind: 'refused', reason: 'catalog-unreadable' });
  });

  it('refuses when a match\'s metadata cannot be read', async () => {
    const host = realHost({
      patterns: [['contextPaths.chapters', 'chapters/*.md']],
      findFiles: async () => [CHAPTER],
      stat: async (filePath) => {
        if (filePath === CHAPTER) {
          throw new Error('unreadable');
        }
        return { type: FileType.Directory, size: 0, ctime: 0, mtime: 0 };
      }
    });
    await expect(host.staging.stage({ kind: 'resource', group: 'chapters', path: 'chapters/alice.md' }))
      .resolves.toEqual({ kind: 'refused', reason: 'catalog-unreadable' });
    const outcome = await host.gateway.apply(staged('Alice walked home.\n', [{ op: 'replace', find: 'walked', with: 'ran' }]), DIRECT);
    expect(outcome).toMatchObject({ state: 'refused', reason: 'catalog-unreadable' });
    expect(host.documents.applyCalls).toEqual([]);
  });

  it('controls: a complete notes-only read permits a rewrite, and complete overlapping memberships select prose', async () => {
    const notes = realHost({ patterns: [['contextPaths.general', '**/*.md']], findFiles: async () => [CHAPTER] });
    const stage = await notes.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' });
    expect(stage).toMatchObject({ kind: 'staged', class: 'notes' });
    if (stage.kind !== 'staged') {
      throw new Error('not staged');
    }
    const outcome = await notes.gateway.apply({ ...stage, operations: [{ op: 'rewrite', text: 'Alice ran home.' }], source: { kind: 'proposal', turnId: 't', index: 0 } }, DIRECT);
    expect(outcome.state).toBe('applied');
    expect(notes.documents.text).toBe('Alice ran home.\n');

    const both = realHost({ patterns: overlapping, findFiles: async () => [CHAPTER] });
    await expect(both.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' })).resolves.toMatchObject({ class: 'prose' });
  });
});

describe('F-02: plain paragraphs appear and go at structural boundaries (prose-paragraphs)', () => {
  function prose(text: string) {
    const documents = new FakeDocuments(text, uriOf(CHAPTER));
    const fakes = hostFakes({ candidates: [candidate('chapters', 'chapters/alice.md')] });
    const gateway = new ProjectFileEditGateway({ ...ports(fakes), documents, applier: new DraftEditApplier(documents), epoch: { current: () => 0 } });
    return { documents, apply: (operations: TextEditOperation[]) => gateway.apply(staged(text, operations), DIRECT) };
  }

  it.each([
    ['an empty chapter', '', 'Alice entered.'],
    ['after a heading', '# Chapter One\n', '# Chapter One\n\nAlice entered.\n'],
    ['after a thematic break', 'Alice.\n\n---\n', 'Alice.\n\n---\n\nAlice entered.\n']
  ])('appends a paragraph to %s', async (_name, text, expected) => {
    const { documents, apply } = prose(text);
    expect((await apply([{ op: 'append', text: 'Alice entered.' }])).state).toBe('applied');
    expect(documents.text).toBe(expected);
  });

  it.each([
    ['an empty chapter', '', 'Alice entered.'],
    ['before a heading', '# Chapter One\n', 'Alice entered.\n\n# Chapter One\n'],
    ['before a thematic break', '---\n\nAlice.\n', 'Alice entered.\n\n---\n\nAlice.\n']
  ])('prepends a paragraph to %s', async (_name, text, expected) => {
    const { documents, apply } = prose(text);
    expect((await apply([{ op: 'prepend', text: 'Alice entered.' }])).state).toBe('applied');
    expect(documents.text).toBe(expected);
  });

  it('deletes the only plain paragraph', async () => {
    const { documents, apply } = prose('Alice entered.');
    expect((await apply([{ op: 'replace', find: 'Alice entered.', with: '' }])).state).toBe('applied');
    expect(documents.text).toBe('');
  });

  it.each([
    ['inserting a heading', 'Alice.\n', [{ op: 'append', text: '## Two' }]],
    ['inserting a list', 'Alice.\n', [{ op: 'append', text: '- Alice' }]],
    ['inserting a quote', 'Alice.\n', [{ op: 'append', text: '> Alice' }]],
    ['inserting code', 'Alice.\n', [{ op: 'append', text: '```\nAlice\n```' }]],
    ['inserting a link', 'Alice.\n', [{ op: 'append', text: 'See [Alice](alice.md).' }]],
    ['deleting a heading', '# One\n\nAlice.\n', [{ op: 'replace', find: '# One\n\n', with: '' }]],
    ['deleting a link\'s paragraph', 'Alice.\n\nSee [Alice](alice.md).\n', [{ op: 'replace', find: '\n\nSee [Alice](alice.md).', with: '' }]]
  ] as Array<[string, string, TextEditOperation[]]>)('still refuses %s', async (_name, text, operations) => {
    const { documents, apply } = prose(text);
    const outcome = await apply(operations);
    expect(outcome.state).toBe('refused');
    expect(['markup', 'protected']).toContain(outcome.reason);
    expect(documents.applyCalls).toEqual([]);
  });
});

describe('F-03: a refused retry keeps what earlier attempts established', () => {
  const TEXT = 'Alice is curious.\n\nThe Rabbit is late.\n';
  const curious = TEXT.indexOf('curious');
  const two: TextEditOperation[] = [{ op: 'replace', find: 'curious', with: 'brave' }, { op: 'replace', find: 'late', with: 'early' }];

  function setup(host: HostBehavior) {
    const documents = new FakeDocuments(TEXT, uriOf(CHAPTER), 'markdown', 1, host);
    const fakes = hostFakes({ candidates: [candidate('chapters', 'chapters/alice.md')] });
    const epoch = { value: 0 };
    const gateway = new ProjectFileEditGateway({ ...ports(fakes), documents, applier: new DraftEditApplier(documents), epoch: { current: () => epoch.value } });
    return { documents, gateway, epoch };
  }

  /** The writer changes the first quote as the edit goes out; the host refuses; then `move` happens before the retry. */
  const writerOverFirst = (move: () => void, extra: DocumentTextChange[] = []): HostBehavior =>
    firstThen((edits, review, document) => {
      move();
      return writerTypes([{ offset: curious, length: 7, text: 'odd' }, ...extra])(edits, review, document);
    }, applyAll);

  it('keeps an unknown operation when authority is lost before the retry, with no second host call', async () => {
    let current = true;
    const { documents, gateway } = setup(writerOverFirst(() => { current = false; }));
    const outcome = await gateway.apply(staged(TEXT, two), { review: 'direct', stillCurrent: () => current });
    expect(documents.applyCalls).toHaveLength(1);
    expect(outcome).toMatchObject({
      state: 'unknown',
      operations: [{ index: 0, outcome: 'unknown' }, { index: 1, outcome: 'refused', reason: 'superseded' }]
    });
    expect(documents.text).toContain('odd');
  });

  it('keeps it when the epoch moves before the retry', async () => {
    const holder: { epoch?: { value: number } } = {};
    const fixture = setup(writerOverFirst(() => { (holder.epoch as { value: number }).value += 1; }));
    holder.epoch = fixture.epoch;
    const outcome = await fixture.gateway.apply(staged(TEXT, two), DIRECT);
    expect(fixture.documents.applyCalls).toHaveLength(1);
    expect(outcome).toMatchObject({ state: 'unknown', operations: [{ outcome: 'unknown' }, { outcome: 'refused', reason: 'authority-changed' }] });
  });

  it('keeps it when a text rule refuses the retry', async () => {
    // The writer also writes a second "late", so the second quote is no longer there exactly once.
    const { documents, gateway } = setup(writerOverFirst(() => undefined, [{ offset: 0, length: 0, text: 'late ' }]));
    const outcome = await gateway.apply(staged(TEXT, two), DIRECT);
    expect(documents.applyCalls).toHaveLength(1);
    expect(outcome.state).toBe('unknown');
    expect(outcome.operations[0]).toMatchObject({ outcome: 'unknown' });
    expect(outcome.operations[1]).toMatchObject({ outcome: 'stale' });
  });

  it('reads a known landing, an unknown and a refused retry as partial', async () => {
    const text = 'Alice is curious.\n\nThe Rabbit is late.\n\nThe Queen is cross.\n';
    const three: TextEditOperation[] = [...two, { op: 'replace', find: 'cross', with: 'calm' }];
    let current = true;
    const host: HostBehavior = firstThen((edits, _review, document) => {
      // The host makes the first edit, and the writer changes the second quote in the same event; the host reports stale.
      const first = edits.find((edit) => edit.newText === 'brave');
      const late = document.text.indexOf('late');
      document.edit([
        ...(first ? [{ offset: first.start, length: first.end - first.start, text: first.newText }] : []),
        { offset: late, length: 4, text: 'slow' }
      ]);
      current = false;
      return { kind: 'stale' };
    }, applyAll);
    const documents = new FakeDocuments(text, uriOf(CHAPTER), 'markdown', 1, host);
    const fakes = hostFakes({ candidates: [candidate('chapters', 'chapters/alice.md')] });
    const gateway = new ProjectFileEditGateway({ ...ports(fakes), documents, applier: new DraftEditApplier(documents), epoch: { current: () => 0 } });
    const outcome = await gateway.apply(staged(text, three), { review: 'direct', stillCurrent: () => current });
    expect(documents.applyCalls).toHaveLength(1);
    expect(outcome).toMatchObject({
      state: 'partial',
      operations: [{ outcome: 'landed' }, { outcome: 'unknown' }, { outcome: 'refused', reason: 'superseded' }]
    });
  });
});

describe('N-01: the real resolver logs no pattern, path or host message on the write path', () => {
  it('stages through a failing search and a private pattern, logging only kinds and counts', async () => {
    const host = realHost({
      patterns: [['contextPaths.general', 'PrivateSentinel/*.md']],
      findFiles: async () => {
        throw new Error('FAILED /private/AliceSentinel.md');
      }
    });
    await expect(host.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' }))
      .resolves.toMatchObject({ reason: 'catalog-unreadable' });
    await host.gateway.apply(staged('Alice walked home.\n', [{ op: 'replace', find: 'walked', with: 'ran' }]), DIRECT);
    const all = host.log.join('\n');
    expect(all).not.toContain('PrivateSentinel');
    expect(all).not.toContain('AliceSentinel');
    expect(all).not.toMatch(/\/private|\/workspace|file:/);
  });

  it('logs no path for a linked or outside match on a complete read', async () => {
    const host = realHost({
      patterns: [['contextPaths.general', '**/*.md']],
      findFiles: async () => [CHAPTER, '/workspace/LinkedSentinel/x.md', '/elsewhere/OutsideSentinel.md'],
      stat: async (filePath) => filePath.includes('LinkedSentinel') ? { type: FileType.SymbolicLink, size: 0, ctime: 0, mtime: 0 } : file()
    });
    await expect(host.staging.stage({ kind: 'resource', group: 'general', path: 'chapters/alice.md' })).resolves.toMatchObject({ kind: 'staged' });
    expect(host.log.join('\n')).not.toMatch(/Sentinel|\/workspace|\/elsewhere/);
    expect(host.log).toContain('[ContextResourceResolver] Candidate read: 1 candidate(s), 2 excluded match(es).');
  });
});
