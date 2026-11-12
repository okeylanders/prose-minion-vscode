/**
 * Staging a file edit (ADR 2026-11-05 D4–D6; PR #226 F-01, F-02, F-03):
 * one physical file or a refusal, a host-written identity, the class by
 * every membership, and the baseline from the live buffer or the file.
 * *Alice*.
 */
import { createHash } from 'crypto';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import type { FileEditStagingTarget } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { FakeDocuments } from '../draftEdit/fakeDocuments';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf, type HostFakes } from './fileEditFixtures';

const NOTE = `${ROOT}/characters/alice.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is curious.\n';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

function staging(fakes: HostFakes, open?: FakeDocuments) {
  const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
  return new FileEditStagingService({
    candidates,
    excerpt,
    workspace,
    fileSystem,
    documents: { peek: (uri: string) => open?.peek(uri) },
    log
  });
}

const resource = (group: 'characters' | 'chapters', path: string): FileEditStagingTarget => ({ kind: 'resource', group, path });

describe('FileEditStagingService', () => {
  it('stages a note: its file URL, display path, class and the baseline of its content after front matter', async () => {
    const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], files: { [NOTE]: NOTE_TEXT } });
    await expect(staging(fakes).stage(resource('characters', 'characters/alice.md'))).resolves.toEqual({
      kind: 'staged',
      target: { kind: 'file', documentUri: uriOf(NOTE), relativePath: 'characters/alice.md' },
      class: 'notes',
      baseline: { sha256: sha('Alice is curious.'), length: 'Alice is curious.'.length }
    });
  });

  it('reads the baseline from the live buffer when the document is open, and strips a byte-order mark from the file', async () => {
    const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], files: { [NOTE]: '﻿Alice is curious.' } });
    const fromFile = await staging(fakes).stage(resource('characters', 'characters/alice.md'));
    expect(fromFile).toMatchObject({ baseline: { sha256: sha('Alice is curious.') } });
    const open = new FakeDocuments('Alice is bold.', uriOf(NOTE));
    const fromBuffer = await staging(fakes, open).stage(resource('characters', 'characters/alice.md'));
    expect(fromBuffer).toMatchObject({ baseline: { sha256: sha('Alice is bold.') } });
  });

  it('matches without letter case, as resource.read does', async () => {
    const fakes = hostFakes({ candidates: [candidate('characters', 'characters/Alice.md')], files: { [`${ROOT}/characters/Alice.md`]: 'Alice.' } });
    await expect(staging(fakes).stage(resource('characters', 'characters/alice.md')))
      .resolves.toMatchObject({ kind: 'staged', target: { relativePath: 'characters/Alice.md' } });
  });

  it('refuses equal paths in two roots, and two spellings on a case-sensitive disk, never taking the first', async () => {
    const twoRoots = hostFakes({
      roots: [ROOT, '/second'],
      candidates: [candidate('chapters', 'chapters/one.md'), candidate('chapters', 'chapters/one.md', '/second')]
    });
    await expect(staging(twoRoots).stage(resource('chapters', 'chapters/one.md'))).resolves.toEqual({ kind: 'refused', reason: 'ambiguous-target' });
    const spellings = hostFakes({ candidates: [candidate('chapters', 'chapters/One.md'), candidate('chapters', 'chapters/one.md')] });
    await expect(staging(spellings).stage(resource('chapters', 'chapters/one.md'))).resolves.toEqual({ kind: 'refused', reason: 'ambiguous-target' });
  });

  it('counts one file reached through nested roots as one file', async () => {
    const chapter = `${ROOT}/book/chapters/one.md`;
    const fakes = hostFakes({
      roots: [ROOT, `${ROOT}/book`],
      candidates: [
        candidate('chapters', 'chapters/one.md', `${ROOT}/book`),
        candidate('chapters', 'chapters/one.md', ROOT, { absolutePath: chapter, relativePath: 'chapters/one.md' })
      ],
      files: { [chapter]: 'Alice ran.' }
    });
    await expect(staging(fakes).stage(resource('chapters', 'chapters/one.md')))
      .resolves.toMatchObject({ kind: 'staged', class: 'prose', target: { documentUri: uriOf(chapter) } });
  });

  it('decides the class by every membership: a note an overlapping chapters glob matches is prose', async () => {
    const fakes = hostFakes({
      candidates: [candidate('characters', 'characters/alice.md'), candidate('chapters', 'characters/alice.md')],
      files: { [NOTE]: NOTE_TEXT }
    });
    await expect(staging(fakes).stage(resource('characters', 'characters/alice.md'))).resolves.toMatchObject({ class: 'prose' });
  });

  it('makes the excerpt\'s document prose, staged from the excerpt or by its catalog key', async () => {
    const chapter = `${ROOT}/drafts/one.md`;
    const fakes = hostFakes({
      candidates: [candidate('general', 'drafts/one.md')],
      files: { [chapter]: 'Alice ran.' },
      excerpt: { fsPath: chapter, relativePath: 'drafts/one.md' }
    });
    await expect(staging(fakes).stage({ kind: 'excerpt' })).resolves.toMatchObject({
      kind: 'staged', class: 'prose', target: { kind: 'excerpt', documentUri: uriOf(chapter), relativePath: 'drafts/one.md' }
    });
    await expect(staging(fakes).stage({ kind: 'resource', group: 'general', path: 'drafts/one.md' })).resolves.toMatchObject({ class: 'prose' });
  });

  it('refuses an excerpt with no file, outside the workspace, or behind a link', async () => {
    await expect(staging(hostFakes()).stage({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'excerpt-not-a-file' });
    const outside = hostFakes({ excerpt: { fsPath: '/elsewhere/one.md', relativePath: 'one.md' } });
    await expect(staging(outside).stage({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'outside-workspace' });
    const linked = hostFakes({ excerpt: { fsPath: `${ROOT}/drafts/one.md`, relativePath: 'drafts/one.md' }, linked: new Set([`${ROOT}/drafts`]) });
    await expect(staging(linked).stage({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'outside-workspace' });
  });

  it('refuses by reason: group, path, catalog, size, text and reading', async () => {
    const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], files: { [NOTE]: 'Alice\u0000' } });
    const stage = (target: FileEditStagingTarget) => staging(fakes).stage(target);
    await expect(stage({ kind: 'resource', group: 'diaries' as never, path: 'x.md' })).resolves.toMatchObject({ reason: 'unknown-group' });
    await expect(stage(resource('characters', '../secret.md'))).resolves.toMatchObject({ reason: 'unsafe-path' });
    await expect(stage(resource('characters', `file://${NOTE}`))).resolves.toMatchObject({ reason: 'unsafe-path' });
    await expect(stage(resource('characters', 'characters/hatter.md'))).resolves.toMatchObject({ reason: 'not-configured' });
    await expect(stage(resource('characters', 'characters/alice.md'))).resolves.toMatchObject({ reason: 'not-text' });
    fakes.candidates = [candidate('characters', 'characters/alice.md', ROOT, { sizeBytes: PROMPT_BUDGETS.workshopFileEdits.fileBytes + 1 })];
    await expect(stage(resource('characters', 'characters/alice.md'))).resolves.toMatchObject({ reason: 'too-large' });
    fakes.candidates = [candidate('characters', 'characters/alice.md')];
    fakes.files = {};
    await expect(stage(resource('characters', 'characters/alice.md'))).resolves.toMatchObject({ reason: 'unreadable' });
    const unreadable = staging(fakes);
    (unreadable as unknown as { dependencies: { candidates: unknown } }).dependencies.candidates = { listCandidates: async () => { throw new Error('x'); } };
    await expect(unreadable.stage(resource('characters', 'characters/alice.md'))).resolves.toMatchObject({ reason: 'catalog-unreadable' });
  });

  describe('resolve (ADR 2026-11-10 D2): the same identity, with no baseline', () => {
    /** A staging service whose file reads and open-buffer peeks are counted. */
    function counted(fakes: HostFakes) {
      const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
      const reads: string[] = [];
      const service = new FileEditStagingService({
        candidates,
        excerpt,
        workspace,
        fileSystem: { stat: fileSystem.stat, readFile: async (filePath: string) => { reads.push(filePath); return fileSystem.readFile(filePath); } },
        documents: { peek: (uri: string) => { reads.push(uri); return undefined; } },
        log
      });
      return { service, reads };
    }

    it('gives exactly the identity staging gives, for a file and for the excerpt, and reads no text', async () => {
      const chapter = `${ROOT}/drafts/one.md`;
      const fakes = hostFakes({
        candidates: [candidate('characters', 'characters/Alice.md'), candidate('general', 'drafts/one.md')],
        files: { [`${ROOT}/characters/Alice.md`]: NOTE_TEXT, [chapter]: 'Alice ran.' },
        excerpt: { fsPath: chapter, relativePath: 'drafts/one.md' }
      });
      for (const target of [resource('characters', 'characters/alice.md'), { kind: 'excerpt' } as const]) {
        const { service, reads } = counted(fakes);
        const resolved = await service.resolve(target);
        expect(reads).toEqual([]);
        const staged = await service.stage(target);
        expect(staged.kind).toBe('staged');
        expect(resolved).toEqual({ kind: 'resolved', target: (staged as { target: unknown }).target });
        expect(resolved).not.toHaveProperty('baseline');
        expect(resolved).not.toHaveProperty('class');
      }
    });

    it('resolves a file whose text could not be read or edited: freshness belongs to the cards', async () => {
      const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], files: {} });
      await expect(staging(fakes).resolve(resource('characters', 'characters/alice.md')))
        .resolves.toEqual({ kind: 'resolved', target: { kind: 'file', documentUri: uriOf(NOTE), relativePath: 'characters/alice.md' } });
      await expect(staging(fakes).stage(resource('characters', 'characters/alice.md'))).resolves.toEqual({ kind: 'refused', reason: 'unreadable' });
    });

    it('refuses by staging\'s own identity rules: one physical file, a file excerpt inside the workspace, the catalog', async () => {
      const twoRoots = hostFakes({
        roots: [ROOT, '/second'],
        candidates: [candidate('chapters', 'chapters/one.md'), candidate('chapters', 'chapters/one.md', '/second')]
      });
      await expect(staging(twoRoots).resolve(resource('chapters', 'chapters/one.md'))).resolves.toEqual({ kind: 'refused', reason: 'ambiguous-target' });
      const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md'), candidate('characters', 'characters/map.png')] });
      const resolve = (target: FileEditStagingTarget) => staging(fakes).resolve(target);
      await expect(resolve(resource('characters', 'characters/hatter.md'))).resolves.toEqual({ kind: 'refused', reason: 'not-configured' });
      await expect(resolve(resource('characters', '../secret.md'))).resolves.toEqual({ kind: 'refused', reason: 'unsafe-path' });
      await expect(resolve({ kind: 'resource', group: 'diaries' as never, path: 'x.md' })).resolves.toEqual({ kind: 'refused', reason: 'unknown-group' });
      await expect(resolve(resource('characters', 'characters/map.png'))).resolves.toEqual({ kind: 'refused', reason: 'not-text' });
      // A manual (pasted) excerpt, or none, has no document.
      await expect(resolve({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'excerpt-not-a-file' });
      const outside = hostFakes({ excerpt: { fsPath: '/elsewhere/one.md', relativePath: 'one.md' } });
      await expect(staging(outside).resolve({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'outside-workspace' });
      const unreadable = staging(fakes);
      (unreadable as unknown as { dependencies: { candidates: unknown } }).dependencies.candidates = { listCandidates: async () => { throw new Error('x'); } };
      await expect(unreadable.resolve(resource('characters', 'characters/alice.md'))).resolves.toEqual({ kind: 'refused', reason: 'catalog-unreadable' });
      (unreadable as unknown as { dependencies: { excerpt: unknown } }).dependencies.excerpt = { currentDocument: async () => { throw new Error('x'); } };
      await expect(unreadable.resolve({ kind: 'excerpt' })).resolves.toEqual({ kind: 'refused', reason: 'unreadable' });
    });

    it('logs the target kind and the outcome, never a path or URI', async () => {
      const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')] });
      await staging(fakes).resolve(resource('characters', 'characters/alice.md'));
      await staging(fakes).resolve(resource('characters', 'characters/hatter.md'));
      await staging(fakes).resolve({ kind: 'excerpt' });
      expect(fakes.log).toEqual([
        '[FileEdit] resolved target=group=characters identity=file',
        '[FileEdit] resolved target=group=characters refused=not-configured',
        '[FileEdit] resolved target=excerpt refused=excerpt-not-a-file'
      ]);
      expectNoLeaks(fakes.log, 'alice', 'hatter');
    });
  });

  it('logs the target kind and the outcome, never a path, URI or the text', async () => {
    const fakes = hostFakes({ candidates: [candidate('characters', 'characters/alice.md')], files: { [NOTE]: NOTE_TEXT } });
    await staging(fakes).stage(resource('characters', 'characters/alice.md'));
    await staging(fakes).stage(resource('characters', 'characters/hatter.md'));
    await staging(fakes).stage({ kind: 'excerpt' });
    expect(fakes.log).toEqual([
      '[FileEdit] staged target=group=characters class=notes',
      '[FileEdit] staged target=group=characters refused=not-configured',
      '[FileEdit] staged target=excerpt refused=excerpt-not-a-file'
    ]);
    expectNoLeaks(fakes.log, 'curious', 'Alice');
  });
});
