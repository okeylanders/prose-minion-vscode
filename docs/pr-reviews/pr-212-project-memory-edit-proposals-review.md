# PR #212 review: Project Memory edit proposals

## Verdict

**Changes requested.** Three P2 save-safety findings are open (F-01–F-03), plus two P3 UI findings (F-04–F-05). The ordinary same-file stale check works, and the independent parser/privacy, exact-once anchoring, persistence and UI control probes are otherwise clean. No formal GitHub review or merge was submitted.

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/212
- Implementation reviewed: `882321de6d670793dae1db4ce838c56c163b133c`
- Base: `2a014cbb60d1ce6f4e9440f99eeb37ed7ecd9067`
- Reviewed against the Project Memory epic, Slice 6c and the 2026-11-05 ADR addendum.
- Every tracked source blob in the local materialization was verified against the implementation's Git tree. Review-only probes were kept outside production source.

## F-01 — P2: a text-only edit silently removes unresolved supersession relationships

**Where:** [WorkshopReplyMemoryEdit.ts:74–83](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/application/services/workshop/memory/WorkshopReplyMemoryEdit.ts#L74-L83), consumed by [workshopProjectMemoryWrites.ts:140–147](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/shared/constants/workshopProjectMemoryWrites.ts#L140-L147).

The new edit target keeps `supersedes` only when the referenced note has a title in the current readable listing. The shared proposal-to-draft helper then treats that display subset as the complete replacement relationship list. A body-only suggestion can therefore remove a pre-existing relationship without suggesting or displaying that change.

**Reproduced through the actual settlement → shared draft helper → library update → real memory store:**

1. Target note contains `supersedes: ['mem-000001', 'mem-000002']`.
2. Only `mem-000001` is readable/listed. The other ID remains valid metadata in the target file.
3. Settle an edit whose sole operation appends one sentence to the body.
4. Save with the recorded expected version.
5. Save succeeds, but the rewritten file contains only `['mem-000001']`.

This is not a store restriction: the update code explicitly allows unresolved IDs already present in the original note when they are supplied. The new proposal mapping loses them first. The relationship can matter again when a missing or unreadable note returns.

**Requested change:** preserve the complete existing ID list independently of optional display titles, through persistence, direct card Save and sheet prefill. Add a regression with at least one unavailable existing relationship. No relationship should disappear unless the writer deliberately removes it.

## F-02 — P2: the reused D14 token does not detect a supersedes-only change

**Where:** [ProjectMemoryWrites.ts:214–228,239–247](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L214-L247), using [ProjectMemoryVersion.ts:12–22](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/application/services/workshop/memory/ProjectMemoryVersion.ts#L12-L22).

D14's delivery version hashes title, kind, summary, body, pinned and effective status, but not the target's own `supersedes` array. Reusing that token to guard a whole-draft update lets an old suggestion overwrite a newer relationship edit.

**Reproduced twice with the real library/store:**

1. Anchor an edit when the target has no supersedes IDs; retain its expected token.
2. Change only the target's `supersedes` to a valid existing note ID.
3. Save the original proposal draft.
4. The token remains identical and Save succeeds, replacing the newer relationship with the old empty array.

Both a change **before the queued write begins** and a change **after its listing but before the store replace** are accepted. This is independent of F-01: all referenced notes are readable. Four same-file controls (summary, body, pinned and archived status changed before the claim) correctly refuse and preserve the newer file bytes.

**Requested change:** use an edit-comparison token that covers every field the proposed whole-draft update can overwrite, including supersedes, or compare those fields explicitly at both checks. A delivery fingerprint need not also be the edit concurrency token. Add both pre-queue and pre-commit supersedes-only witnesses; both should refuse as changed and preserve exact bytes.

## F-03 — P2: the final version check reuses stale effective standing

**Where:** [ProjectMemoryWrites.ts:239–247](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L239-L247).

The store callback rechecks the target file but passes `current.superseded` from the earlier library listing. If another note supersedes the target during that gap, the check still hashes it as active. The target's own bytes need not change, so the file rewrite retry cannot detect the changed effective status.

**Deterministic real-library/store witness:** begin a version-checked edit of active note A, pause at `store.replace` after the library listing, add active note B with `supersedes: [A.id]`, then release the replace. The edit returns `written` and changes A's body instead of returning `changed`. A supersession already present before the initial listing is correctly refused by the shipped test; the later window is the missing case.

**Requested change:** do not reuse the earlier effective-standing Boolean as the final check. Validate current standing using the save/store protocol's fresh view before committing, and add a delayed supersession witness. The documented guarantee includes effective status, so any unavoidable cross-file concurrency limit must be handled explicitly rather than reported as a successful same-version edit.

## F-04 — P3: editing an edit proposal is described as creating a memory

**Where:** `useWorkshopProjectMemory.editCard` and `WorkshopMemorySheet`'s `sheet.mode === 'memory'` presentation decision.

The hook correctly keeps an edit proposal in card mode so submission goes through the checked proposal route, and it sets `memoryId`. The sheet recognizes only memory mode as editing, however. Opening **Edit…** on a suggested change renders:

- heading/dialog name: “Save to project memory”;
- submit button: “Save to memory”;
- receipt preview: “Saved to project memory”.

The action actually updates an existing note and emits an updated receipt. This was reproduced with the real hook and sheet in React/JSDOM.

**Requested change:** separate editing presentation from routing mode, for example using the existing target memory ID, without switching away from the checked card submission path. Cover the heading, action, receipt preview and pinned-budget wording.

## F-05 — P3: context clipping can split surrogate pairs

**Where:** [workshopMemoryEditView.ts:101–116](https://github.com/okeylanders/prose-minion-vscode/blob/882321de6d670793dae1db4ce838c56c163b133c/packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryEditView.ts#L101-L116).

The changed-region boundary is surrogate-safe, but the 80-code-unit context clipping uses raw `slice`. With no spaces near the cut, it can return an orphan half of an astral character and display a replacement glyph.

Exact failing inputs to the real `bodyChange` helper:

- Leading context: `shared = '😀'.repeat(41) + 'x'`; compare `shared + 'A'` with `shared + 'B'`. The returned lead contains an orphan low surrogate.
- Trailing context: `shared = 'x' + '😀'.repeat(41)`; compare `'A' + shared` with `'B' + shared`. The returned trail contains an orphan high surrogate.

**Requested change:** make the final context cuts code-point-safe too. Keep both regression cases; stored note bytes are unaffected.

## Checks and positive coverage

### Exact-head production checks

- Remote [CI 41972028297](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41972028297) passed: all three typechecks, **698 suites / 9,852 tests / 59 snapshots**, lint **0 errors / 1,165 warnings**, and both bundles.
- Local all-three-package typecheck passed on a clean rerun.
- Local focused production tests: **51 suites / 784 tests passed across the main run and the isolated rerun of the killed store-race suite**. Local lint was killed (exit 137), so the lint result above is from exact-head CI, not a completed local lint run.

The first local concurrent test/typecheck attempt and the lint process were killed by the execution environment (SIGKILL / exit 137). They did not report a failed product assertion; the successful reruns and remote full run are distinguished above.

### Independent behavior probes

- **Privacy:** 156 malformed/mixed edit-frame forms, 68,648 streaming prefixes and 936 completed-output assertions passed. Actual AgentRunEngine correction requests, retained history and logs exclude edit trailer bodies. Actual StreamingContent/MarkdownRenderer exposes public prose only.
- **Anchoring:** 31,682 cases checked against a brute-force exact-once oracle, plus overlapping quotes, operation ordering and attempted matches against newly introduced text. No anchoring defect found.
- **Persistence:** mixed edit/new and settled/stale states round-trip byte-exact; clone, Branch and Rewind retain edit identity; seven malformed edit shapes reject; the pre-memory fixture remains exact.
- **Writes:** real library/store probes reproduced F-01–F-03. Summary/body/pinned/status mutations at the late boundary refuse with unchanged newer bytes. Ordinary same-version updates and production route tests pass.
- **UI:** four production UI suites / 49 tests passed in a memory-light isolated-transpilation harness. Three independent control tests passed: original card indexes survive a hidden auto-saved neighbor; repeated submits and Close/New interruptions cannot replace an in-flight sheet; refusal preserves the draft; stale cards hide writes and hostile text remains text. Three expected-behavior assertions fail on the two UI findings above.
- Reviewed the same-card saved-draft replay branch as a possible hardening concern. Normal UI blocks repeat submission and removes the saved edit action, so no reachable UI defect is claimed for that synthetic replay.

## Limits and follow-up

No independent Extension Development Host, real browser screenshot run or live provider call was performed. React checks are JSDOM, not visual browser QA. The full aggregate result is the exact-head GitHub CI run, not an independently completed local full suite.

This report changes documentation only. Corrected heads will be re-reviewed, the concrete witnesses rerun, and CI checked again. No formal approval, merge, or product-code change is included.
