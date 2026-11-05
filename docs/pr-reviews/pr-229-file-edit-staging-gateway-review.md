# PR #229 review: File-edit staging and gateway

**Verdict: changes requested. Three blocking findings (F-01–F-03), plus the logging acceptance gap N-01.**

- PR: [#229](https://github.com/okeylanders/prose-minion-vscode/pull/229)
- Reviewed implementation: `778a09a6e8113475e8fa25a969b978d396727f67`
- Branch: `epic/workshop-persona-file-edits-slice-2-gateway`
- Base inspected: `b14c46b8ca1e3e37966c27eccd0eb916c590c316`
- Review date: 2026-11-05
- Initial and pre-publication checks found no existing #229 review or discussion comment.
- Scope: resolver candidates, staging identity/class/baseline, gateway authorization/freshness/policy, every-attempt applier callback, Markdown modes, insertion reconciliation, document adapters/epoch, composition and boundary tests. The branch includes #227's planner; its separate review remains a dependency. This is not an approval of the later claim/routes/persistence slice, and nothing was merged.

## F-01 (P1): An incomplete candidate walk can authorize a prose rewrite

**Anchor:** [ContextResourceResolver.ts:142–150](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L142-L150), reached by the new `listCandidates` at lines 99–113.

The every-candidate API reuses the catalog's best-effort walk. A rejected `findFiles` logs the error and continues, then returns the remaining candidates as a complete result. That is safe enough for a partial browsing list, but not for proving that a target is unique and has no prose membership. The callers only refuse `catalog-unreadable` if the promise rejects, which this failure never does.

Production staging + resolver + gateway + applier witness:

1. Configure `general = **/*.md` and `chapters = chapters/*.md` for `/workspace`.
2. `general` finds `/workspace/chapters/alice.md`; the `chapters` search rejects.
3. Stage the resource through `general`: it returns `class: notes`.
4. Apply a `rewrite` while the same search failure persists: the chapter is replaced, and the gateway reports `applied`.

A second witness makes the search of a second workspace root reject. Staging treats the first root's path as unique even though it never learned whether the second root contains the same relative path. The epoch does not help: neither failure requires any configuration change.

**Required correction:** distinguish a complete authoritative candidate read from an incomplete discovery result. Fail closed for write staging/authorization when any relevant root/group/pattern search fails; preserve the old catalog's tolerant behavior separately if desired. Review skipped metadata-read failures under the same completeness rule. A partial result must not prove uniqueness or downgrade prose to notes.

**Acceptance:** failed prose search, failed second-root search and incomplete metadata reads refuse before dispatch; a complete notes-only search still permits a rewrite, and complete overlapping memberships still select prose.

## F-02 (P2): Plain paragraphs cannot appear or disappear at structural boundaries

**Anchor:** [markdownStructure.ts:165–174](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/utils/draftEdit/markdownStructure.ts#L165-L174).

`joinParagraphRuns` coalesces existing paragraph runs but retains one paragraph token for each run. Adding the first paragraph to a span, or deleting its last paragraph, still changes the shape. This contradicts D5's allowance for plain paragraphs to appear or go. It also rejects routine chapter editing, not just unusual Markdown.

Four production-gateway witnesses all return `refused / markup`, with zero `applyEdits` calls:

- Append `Alice entered.` to an empty Markdown chapter.
- Append it to `# Chapter One\n`.
- Append it after `Alice.\n\n---\n`.
- Replace the entire plain paragraph `Alice entered.` with an empty string.

No heading, thematic break or protected inline construct is changed in these examples. Existing tests cover adding to an existing paragraph run, so they miss this boundary.

**Required correction:** in `prose-paragraphs` mode, permit insertion/removal of plain paragraph runs while retaining non-paragraph block order/kind/nesting and protected inline structure. Keep `strict` unchanged.

**Acceptance:** the four witnesses succeed in prose mode; add matching prepend cases and retained controls for inserting/deleting headings, lists, quotes, code, links and other protected structure. Proofread/Craft Flags expectations must stay unchanged.

## F-03 (P2): A refused retry overwrites earlier unknown outcomes

**Anchors:** [ProjectFileEditGateway.ts:303–308](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/application/services/fileEdits/ProjectFileEditGateway.ts#L303-L308) and [319–323](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/application/services/fileEdits/ProjectFileEditGateway.ts#L319-L323).

The applier can carry `unknown` ids from the first attempt while other edits still stand and qualify for its one direct retry. When `beforeAttempt` refuses that retry, `report` preserves only `landed`; it rewrites every other outcome, including an existing `unknown`, to refused/stale. The overall before-attempt branch also runs before the unknown-state check.

Witness: propose `curious → brave` and `late → early` in separate paragraphs. During the first dispatch, the writer changes `curious` to `odd` and the caller's authority becomes false. The first host attempt returns stale. The real applier classifies the first operation as unknown, retains the second, then correctly refuses the retry. The gateway reports **both operations refused / superseded**, losing the first operation's uncertainty.

**Required correction:** retain all outcomes established by earlier attempts, especially unknown ids. Apply the retry's refusal only to the edits still awaiting that attempt. Derive the overall card state from those preserved outcomes: unknown without known landings, or partial with known landings, as D7/D8 require.

**Acceptance:** unknown + standing followed by authority loss, epoch change and a text-policy refusal keeps the unknown operation; no second host call occurs. Include a known-landed + unknown + standing case and unchanged normal-refusal controls.

## N-01: The real resolver violates the no-path logging acceptance contract

**Anchor:** [ContextResourceResolver.ts:145–149](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L145-L149), and `safeWorkspaceResourceSize`'s symbolic-link/unreadable messages.

D13 says staging refusals/apply failures log only ids/counts/fault kinds, never paths or URIs. The new staging/gateway flows invoke the real resolver with the shared output channel. It logs configured patterns, raw search-error messages, and rejected resource paths. The FileEdit tests use a fake candidate reader, so their sentinels do not exercise this dependency.

A staging witness with pattern `PrivateSentinel/*.md` and search error `FAILED /private/AliceSentinel.md` logs both sentinels. Sanitize this authoritative discovery path and cover the real resolver in end-to-end log-sentinel tests before claiming D13 acceptance. This is an inherited diagnostic behavior exposed by the new write flow, rather than a reason to weaken or remove the write checks.

## What passed and what remains separate

- Live-buffer baseline precedence, BOM stripping, identity/class persistence, the baseline-hash rewrite guard, case/root ambiguity on successful discovery, excerpt containment and configured-resource membership have focused coverage.
- Authority is rechecked synchronously before the first host call and direct retry. The epoch covers workspace/context-path changes. Tests reject retry writes after authority changes and a shrinkage that exceeds the rewrite ceiling.
- Existing Proofread/Craft Flags strict expectations, protected regions, insertion read-back and current adapter behavior are covered by the focused tests.
- Review/close lifetime behavior remains the explicitly accepted VS Code limitation, not a new claim of cancellation.
- Slice 4's durable claim, terminal replay and route integration are not implemented in this slice and were not treated as verified here.
- The legal POSIX excerpt display path `draft:one.md` stages successfully in this implementation. Compatibility with #230's persisted-proposal validator is being reviewed in #230 rather than duplicated as a finding here.

## Verification

At implementation head `778a09a6`:

- Local `npm run typecheck`: passed (core, webview and extension).
- Local `npm run lint`: 0 errors, 1,165 warnings.
- Local focused Jest: **8 suites / 122 tests passed**.
- Local adversarial/integration witness suite: **9 tests passed**, asserting the observed failing behaviors above plus the valid colon-containing excerpt path. These are reproductions, not evidence that the bugs are fixed.
- GitHub [CI run 42127068907](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42127068907), with job `verify` explicitly reporting head SHA `778a09a6e8113475e8fa25a969b978d396727f67`: **success**, including typecheck, tests, lint and both webpack bundles.
- A separate local full-suite run was still running when this report was prepared. No Extension Development Host/live UI pass was performed.

This commit adds review documentation only. The reviewed implementation remains unchanged. CI for the resulting report commit will be checked and reported on the PR separately; the older successful run is not presented as CI for a newer head.

## Reproduction suite

Place the following temporary file at `packages/core/src/__tests__/application/services/fileEdits/reviewGatewaySafety.test.ts` and run `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/application/services/fileEdits/reviewGatewaySafety.test.ts`. It deliberately asserts the current incorrect outcomes so the observations can be reproduced. Convert these to the expected safe behavior for regression coverage when fixing the findings. Remove the temporary file afterward; it is not a product-test change in this review.

```typescript
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { FileType } from '@/platform';
import type { StagedFileEdit } from '@/domain/models/FileEdit';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { FakeDocuments, applyAll, firstThen, writerTypes } from '../draftEdit/fakeDocuments';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '../../../mocks/platform';
import { candidate, hostFakes, ports, uriOf } from './fileEditFixtures';
const path = '/workspace/chapters/alice.md';
const direct = { review: 'direct' as const, stillCurrent: () => true };
function staged(text: string, operations: TextEditOperation[], kind: 'notes' | 'prose' = 'prose'): StagedFileEdit {
  return { target: { kind: 'file', documentUri: uriOf(path), relativePath: 'chapters/alice.md' }, class: kind,
    baseline: fileEditBaseline(text, path), operations, source: { kind: 'proposal', turnId: 'test', index: 0 } };
}
function setup(text: string) {
  const documents = new FakeDocuments(text, uriOf(path));
  const fakes = hostFakes({candidates: [candidate('chapters', 'chapters/alice.md')]});
  const dependencies = { ...ports(fakes), documents, applier: new DraftEditApplier(documents), epoch: {current: () => 0}};
  return {documents, dependencies, gateway: new ProjectFileEditGateway(dependencies)};
}

test('REPRO: failed prose search downgrades a chapter to notes and permits a rewrite', async () => {
  const text = 'Alice walked home.\n';
  const documents = new FakeDocuments(text, uriOf(path));
  const log = {appendLine: jest.fn(), show: jest.fn(), clear: jest.fn()};
  const workspace = createFakeWorkspace({workspaceFolders: () => [{path: '/workspace', name: 'workspace'}],
    findFiles: async (_root, glob) => { if (glob === 'chapters/*.md') throw new Error('search unavailable'); return [path]; }});
  const fileSystem = createFakeFileSystem({stat: async () => ({type: FileType.File, size: 18, ctime: 0, mtime: 0})});
  const candidates = new ContextResourceResolver(createFakeSettings({'contextPaths.general': '**/*.md', 'contextPaths.chapters': 'chapters/*.md'}), fileSystem, workspace, log);
  const dependencies = {candidates, fileSystem, workspace, log, documents, excerpt: {currentDocument: async () => undefined}};
  const stage = await new FileEditStagingService(dependencies).stage({kind: 'resource', group: 'general', path: 'chapters/alice.md'});
  expect(stage).toMatchObject({kind: 'staged', class: 'notes'});
  if(stage.kind !== 'staged') throw new Error('not staged');
  const gateway = new ProjectFileEditGateway({...dependencies, applier: new DraftEditApplier(documents), epoch: {current: () => 0}});
  const outcome = await gateway.apply({...stage, operations: [{op: 'rewrite', text: 'Entire chapter replaced.'}], source: {kind: 'proposal', turnId: 't', index: 0}}, direct);
  expect(outcome.state).toBe('applied');
  expect(documents.text).toBe('Entire chapter replaced.\n');
});

test('REPRO: a failed second-root search is treated as a unique target', async () => {
  const documents = new FakeDocuments('Alice.', uriOf(path));
  const log = {appendLine: jest.fn(), show: jest.fn(), clear: jest.fn()};
  const workspace = createFakeWorkspace({workspaceFolders: () => [{path: '/workspace', name: 'one'}, {path: '/second', name: 'two'}],
    findFiles: async (root) => { if(root === '/second') throw new Error('search unavailable'); return [path]; }});
  const fileSystem = createFakeFileSystem({stat: async () => ({type: FileType.File, size: 6, ctime: 0, mtime: 0})});
  const candidates = new ContextResourceResolver(createFakeSettings({'contextPaths.general': '**/*.md'}), fileSystem, workspace, log);
  const result = await new FileEditStagingService({candidates, fileSystem, workspace, log, documents, excerpt: {currentDocument: async () => undefined}})
    .stage({kind: 'resource', group: 'general', path: 'chapters/alice.md'});
  expect(result.kind).toBe('staged');
});

test.each(['', '# Chapter One\n', 'Alice.\n\n---\n'])('REPRO: plain paragraph append refused at non-paragraph boundary: %j', async (text) => {
  const {gateway, documents} = setup(text);
  const result = await gateway.apply(staged(text, [{op: 'append', text: 'Alice entered.'}]), direct);
  expect(result).toMatchObject({state: 'refused', reason: 'markup'});
  expect(documents.applyCalls).toHaveLength(0);
});

test('REPRO: deletion of a whole plain paragraph is refused', async () => {
  const text = 'Alice entered.';
  const {gateway} = setup(text);
  expect(await gateway.apply(staged(text, [{op: 'replace', find: text, with: ''}]), direct))
    .toMatchObject({state: 'refused', reason: 'markup'});
});

test('REPRO: unknown first-attempt operation is downgraded to refused on retry', async () => {
  const text = 'Alice is curious.\n\nThe Rabbit is late.\n';
  const {gateway, documents} = setup(text);
  let current = true;
  documents.host = firstThen((edits, review, document) => {
    current = false;
    return writerTypes([{offset: text.indexOf('curious'), length: 7, text: 'odd'}])(edits, review, document);
  }, applyAll);
  const result = await gateway.apply(staged(text, [{op: 'replace', find: 'curious', with: 'brave'}, {op: 'replace', find: 'late', with: 'early'}]),
    {review: 'direct', stillCurrent: () => current});
  expect(documents.applyCalls).toHaveLength(1);
  expect(result).toMatchObject({state: 'refused', reason: 'superseded', operations: [{outcome: 'refused'}, {outcome: 'refused'}]});
  expect(documents.text).toContain('odd');
});

test('integration: real staging accepts the legal POSIX excerpt display path draft:one.md', async () => {
  const excerptPath = '/workspace/draft:one.md';
  const documents = new FakeDocuments('Alice entered.', uriOf(excerptPath));
  const fakes = hostFakes({excerpt: {fsPath: excerptPath, relativePath: 'draft:one.md'}});
  const result = await new FileEditStagingService({...ports(fakes), documents}).stage({kind: 'excerpt'});
  expect(result).toMatchObject({kind: 'staged', class: 'prose', target: {kind: 'excerpt', relativePath: 'draft:one.md'}});
});

test('REPRO: actual resolver used during staging logs paths and raw host error messages', async () => {
  const documents = new FakeDocuments('Alice.', uriOf(path));
  const log = {appendLine: jest.fn(), show: jest.fn(), clear: jest.fn()};
  const workspace = createFakeWorkspace({workspaceFolders: () => [{path: '/workspace', name: 'one'}],
    findFiles: async () => {throw new Error('FAILED /private/AliceSentinel.md');}});
  const fileSystem = createFakeFileSystem();
  const candidates = new ContextResourceResolver(createFakeSettings({'contextPaths.general': 'PrivateSentinel/*.md'}), fileSystem, workspace, log);
  await new FileEditStagingService({candidates, fileSystem, workspace, log, documents, excerpt: {currentDocument: async () => undefined}})
    .stage({kind: 'resource', group: 'general', path: 'chapters/alice.md'});
  expect(log.appendLine.mock.calls.flat().join('\n')).toContain('/private/AliceSentinel.md');
  expect(log.appendLine.mock.calls.flat().join('\n')).toContain('PrivateSentinel/*.md');
});

```
