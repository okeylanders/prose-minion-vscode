# PR #197 review: Project Memory Slice 2a read path

**Verdict: changes requested before merge into `epic/workshop-project-memory`. One P2 finding remains: F-02's successor traversal stops at an archived intermediate note. The other findings and notes are independently verified fixed.**

**PR:** [#197](https://github.com/okeylanders/prose-minion-vscode/pull/197)  
**Reviewed:** 2026-11-04  
**Current reviewed head:** `b609285d3298b95f0df294ffbb39b18a84dfe8d9`  
**Initial reviewed head:** `27da6fee5d7ca97119b563f1b6d121eef524bf9f`  
**Target branch:** `epic/workshop-project-memory`  
**Base:** `067c804fd92edb4663a7058687d8ec3bc83ca252`  
**Initial passing CI merge:** `09ea083a2a3809abc3d090fb0d43596295ab042d`

This report covers Slice 2a against the parent epic, ADR D1–D5/D8/D10–D13, repository architecture rules, and its explicit split from Slice 2b. D14 update notes are intentionally deferred to #198 and are not reported here as missing implementation. This is a branch report, not a formal GitHub approval or authorization to merge.

## Independent re-review at b609285d

**Current status:** F-01 and F-03 are closed; N-01 and N-02 are closed. F-02's original archived-terminal and active-chain examples are fixed, but the combination below remains incorrect.

### F-02 remains open, P2: traverse archived intermediate successors

**Location:** [ProjectMemoryLibraryContracts.ts:119–120](https://github.com/okeylanders/prose-minion-vscode/blob/b609285d3298b95f0df294ffbb39b18a84dfe8d9/packages/core/src/application/services/workshop/memory/ProjectMemoryLibraryContracts.ts#L119-L120).

The new `projectMemoryInEffectSuccessors` helper follows a successor's own `supersededBy` only when its stored status is active. Archiving an intermediate note therefore cuts off the rest of its accepted supersession chain.

**Exact-head real-store/library/read-renderer reproduction:**

1. Create A (`mem-000001`).
2. Create B (`mem-000002`) superseding A.
3. Create C (`mem-000003`) superseding B; C is active and unsuperseded.
4. Archive B and read A.
5. The library returns `inEffectSuccessors: []`, and the host says `superseded by: mem-000002; nothing that replaces it is in effect now.`

The same chain with B active correctly names C. D4 preserves supersession relations when a note is archived: B should not be returned as effective, but its accepted link to C must still be followed. With a second direct branch A←D, the helper reports only D and wrongly omits C through the archived branch.

**Required correction:** continue through accepted successor links when an intermediate note is archived as well as when it is superseded. Return only active, unsuperseded endpoints. Alternatively, keep the original review's simpler neutral attribution without an exhaustive effectiveness claim. Add an archived-intermediate chain and a branching control; the new tests cover an archived terminal and active chain separately, but not their combination.

### Fix verification

- **F-01:** replayed the production settings-adapter→library→frame witness with the corrected manifest. Global Off defeats workspace Ask and Auto without a store listing. Global Ask remains on despite workspace Off. `scope: application` verified.
- **F-03:** replayed the successful memory-read path through the actual engine/capability/library/store **without supplying a debug setting**. No title sentinel enters the log; the engine writes `memory:(a project note)`. The added Jest cases also verify debug off/on and preservation of the user-facing title.
- **N-01:** the source line now names the extra provenance ranges while keeping its executable hint within ten ranges.
- **N-02:** accepted links now drive both standing and `supersededBy`. The A↔B plus C→A witness attributes A only to C.
- Graph controls pass for active chains, archived terminals, cyclic-edge exclusion and diamond deduplication. Archived-intermediate and branching witnesses reproduce the remaining F-02 issue.
- **18 local Jest suites / 344 tests passed**, including the three new regression suites. Core and webview typechecks passed.
- The initial-frame/continuation/tool-separation probe still passes through the real engine.
- [CI run 41893325994](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41893325994) for `b609285d` was running at publication. Earlier green runs are not a substitute for this head's checks.

## Initial review and author correction history

The ledger and detailed original findings below are retained as history, including the author's fix notes. The independent current status above supersedes their open/closed wording.

## Author resolution ledger

| ID | Priority | Finding | Status |
|---|---|---|---|
| F-01 | P2 | Workspace configuration can override the intended global memory Off switch | Fixed in `b285942b`: `"scope": "application"`, as the writer profile is, so VS Code reads the switch from user settings alone and ignores a workspace value. `projectMemorySetting.test.ts` pins the scope, the modes and the default to the code's; it failed before the fix. No port change. The same gap on `workshop.webResearch` is filed outside this epic. |
| F-02 | P2 | Read output endorses archived or already-superseded replacements as in effect | Fixed in `f6d5823c`: the library resolves a superseded note's chain to the notes in effect at its end (`projectMemoryInEffectSuccessors`), and the read names its direct superseders, then those notes, or says nothing that replaces it is in effect. An archived superseder still keeps the old note superseded (D4). `ProjectMemorySupersession.test.ts` covers an active successor, an archived one and a chain; they failed before the fix. |
| F-03 | P2 | Successful memory reads leak their titles through the engine's context-source log | Fixed in `98a177a6`: the engine's "Context sources committed" line names a memory row by its kind alone (`memory:(a project note)`), and the manifest the writer sees keeps the title. `ProjectMemoryEngineLogs.test.ts` runs the real engine, persona capability, library and store with debug logging off and on; title, summary and body sentinels never reach any log. It failed before the fix. |
| N-01 | P3 | Provenance silently truncates more than ten nonconsecutive source ranges | Fixed in `843040c5`: the hint keeps its ten ranges, and the line names the rest (", and N more ranges (…)"). The sync test's 32-turn case asserts it; it failed before the fix. |
| N-02 | P3 | `supersededBy` can include an edge excluded by cycle-aware standing | Fixed in `5db426ad`: standing and attribution both read `acceptedProjectMemorySupersessions`, and `supersededProjectMemoryIds` derives from it. The A ↔ B, C → A case is a regression; it failed before the fix. |

## F-01: P2: make the global memory switch user-only

**Location:** [apps/vscode-extension/package.json:669–682](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/apps/vscode-extension/package.json#L669-L682).

The setting is described as one switch for every project, and ADR D8 explicitly requires a global opt-in. The new configuration property omits `scope`. In VS Code, an omitted scope is `window`, which permits workspace overrides; `application` is user-only. See the [official configuration-scope reference](https://code.visualstudio.com/api/references/contribution-points#scope).

The unchanged `VsCodeSettingsStore.get` reads the effective configuration value. Consequently, a project's `.vscode/settings.json` containing `"proseMinion.workshop.projectMemory": "ask"` overrides the user's global `off`. The library then enables access and builds a frame containing project-memory bodies. Global writes alone do not make reads global-only.

**Reproduction through the exact production settings adapter, library and renderer:**

1. Set the user/global value to `off`.
2. Set the workspace value to `ask`, using the documented VS Code precedence for this manifest's window-scoped setting.
3. Put a readable pinned memory containing a private sentinel body in the store.
4. The production adapter returns `ask`; the library reports `{ open: true, mode: 'ask' }`, lists the store, and includes the sentinel body in its first-message frame.
5. Remove the workspace override: the same library returns `{ kind: 'closed', reason: 'off' }` without another listing.

This probe mocked the VS Code configuration host boundary according to its documented precedence, not the adapter/library logic. It was not a native VS Code run. The actual engine integration was independently exercised and confirms that this frame goes into the initial user message.

**Required correction:** declare the setting `scope: "application"`, or otherwise enforce an explicit global-only read. Add an adapter/manifest regression for global Off plus workspace Ask/Auto, as well as the inverse override, so a project cannot silently change the user's single global mode.

## F-02: P2: do not claim an inactive successor is the note in effect

**Location:** [WorkshopProjectMemoryRenderer.ts:135](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryRenderer.ts#L135).

When a read memory has `supersededBy`, the host unconditionally appends:

`superseded by: <ids>; that note is the one in effect.`

The list contains direct superseders, not necessarily active, unsuperseded successors. Two ordinary supported states make this assertion false:

- B supersedes A; B is then archived. D4 deliberately keeps A superseded when B is archived. Neither is in effect, yet reading A tells the persona that B is.
- B supersedes A, then C supersedes B. Reading A still says B is the note in effect, although the library correctly classifies B as superseded and C as the effective note.

Both cases were reproduced through the exact `listProjectMemories` and read renderer. This is incorrect host guidance, rather than merely ambiguous writer-authored memory text, and can send the persona back to a retired decision.

**Required correction:** retain a neutral statement of direct supersession without asserting current effectiveness, or resolve successors and verify their standing before making that assertion. Add archived-successor and multi-hop-chain regressions. Do not reactivate the old note when its superseder is archived; the existing D4 standing rule is intentional.

## F-03: P2: keep memory titles out of the engine's manifest log

**New caller:** [WorkshopProjectMemoryCapability.ts:174–178](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryCapability.ts#L174-L178).  
**Logging sink:** [AgentRunEngine.ts:574–578](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L574-L578).

The new capability correctly keeps its own logs to IDs/counts, but supplies the memory's title as the display label of its delivered-source row. On a successful committed turn, the existing engine logs every row as `kind:label`. Consequently, a routine successful `memory.read` writes the memory title to the output log, contrary to ADR D9's explicit no-title/summary/body logging rule. This logging is not guarded by the debug setting.

**Exact-head real-engine reproduction:**

1. Store a readable memory `mem-abcdef` with title `PRIVATE_MEMORY_TITLE_SENTINEL`.
2. Run the actual `AgentRunEngine`, persona capability, library and store. The fake provider first requests `memory.read` for that ID, then returns a clean final reply.
3. Supply an output sink but no debug settings at all.
4. The successful turn logs:
   `[AgentRunEngine] Context sources committed for <conversation>: memory:PRIVATE_MEMORY_TITLE_SENTINEL (size estimate)`.

The capability-only sentinel tests pass because they do not exercise this shared engine sink. The new memory integration makes the existing generic label logging violate memory's stricter data contract.

**Required correction:** preserve the title in the user-facing manifest, but redact or omit memory labels in diagnostic logs (or provide a separate safe logging identity). Add a full engine-to-capability regression that commits a memory read and asserts that title, summary and body sentinels never reach any sink under default or debug logging.

## Nonblocking notes

### N-01: disclose truncated provenance ranges

**Location:** [WorkshopProjectMemoryCopy.ts:96–106](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryCopy.ts#L96-L106), used by [lines 73–75](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryCopy.ts#L73-L75).

A memory may cite 32 source turns. With resolved positions `1, 3, 5, …, 63`, `positionRanges` silently retains only the first ten ranges. The resulting host line presents turns through 19 as the source and emits one valid lookup hint, with no indication that 22 resolved citations were omitted. `missingTurns` remains zero because those turns exist.

Keep each hint within recall's ten-range bound, but disclose the omitted count or emit multiple bounded hints. The current hint is valid; its incompleteness is the issue.

### N-02: keep supersession attribution consistent with ignored cycles

**Location:** [ProjectMemoryLibraryContracts.ts:89–90](https://github.com/okeylanders/prose-minion-vscode/blob/27da6fee5d7ca97119b563f1b6d121eef524bf9f/packages/core/src/application/services/workshop/memory/ProjectMemoryLibraryContracts.ts#L89-L90).

The boolean standing uses the cycle-aware helper, but `supersededBy` independently collects every incoming raw edge. With A↔B and C→A, A is correctly superseded by C's noncyclic edge, yet its attribution lists B and C. B→A was excluded by the cycle rule. Derive attribution from the same accepted edges as standing so the metadata and renderer do not reintroduce ignored relations.

## Integration and architecture assessment

- **The `appendContract` deviation is sound for this slice.** The actual `AgentRunEngine.runInitial` calls the persona capability before creating the initial user message. `continueConversation` calls `appendTurnContract` instead. A separate executable probe used the real engine, conversation manager, persona capability and memory library with a fake provider: the initial frame appears in the first user message, not the system message; changing the memory file does not rebuild it on continuation; and a capability-free tool request receives no frame.
- Existing tests exercise guest joining, retained-frame stability through system-prompt replacement and archive import, and tool-sidepass separation. No native provider call was used.
- The composition root constructs one store/library and injects it inward. The new memory modules respect the host-agnostic core boundary.
- The operation/family/artifact/context-source changes and published `memory.read` path were inspected with the corresponding persistence, prompt and wiring tests.
- The accepted-workspace check refuses a persistent root change, and off/unavailable/unknown results fail closed. No additional demonstrated leakage was found there.
- The frame's deterministic ordering, pinned-prefix overflow, token/count bounds, escaping, busy continuity and unreadable/conflicting-file exclusion match the reviewed contracts. An archived-only frame with a `more` line and pinned loading stopping at the first non-fitting body are intentional, tested behavior.
- No first-message rewriting is requested for mode changes or reopen in this PR. That behavior belongs to the declared Slice 2b scope.

## Verification

### Local execution

Dependencies were installed from the exact head's lockfile in an isolated review workspace. All core source files used by the runtime were checked against the head's Git blob hashes.

- **15 focused Jest suites / 336 tests passed**, using the repository's actual Jest/ts-jest configuration. Coverage includes memory frame/library/capability, frame stability, mode changes, source positions, persisted turn guards, tool-sidepass integration, AgentRunEngine, persona capability, XML codec, recall wiring, conversation archive, prompt synchronization and context-source utilities.
- `npm run typecheck:core`: passed.
- `npm run typecheck:webview`: passed.
- Independent production-code probes reproduced F-01/F-02/F-03 and N-01/N-02, with controls for the global-mode case.
- Additional direct validator/capability probes covered malformed IDs, traversal/Unicode/NUL input, per-read bounds, per-turn reads, mixed read outcomes, log sentinels and delivered-source rows.
- The real-engine placement probe described above passed. An additional real-engine successful-read probe reproduced F-03 without debug logging.
- The full local suite, local extension typecheck, local lint/build, native VS Code and live-provider testing were not run. Their CI results are separate below.

### GitHub CI

[CI run 41885939074, verify job](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41885939074/job/126770288798) passed on merge `09ea083a2a3809abc3d090fb0d43596295ab042d`:

- **652 suites / 9,239 tests / 59 snapshots**
- Core, webview and extension typechecks
- Lint: **0 errors / 1,158 warnings**
- Both builds and bundle verification

[The first report-head CI run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41887939967) also passed at `2b4aaba90013a88f3f183214b244021c7661abb6` before the F-03 report addition.

This publication changes only the report. Its later branch head needs its own required CI. Re-review fixes on their exact heads before closing findings.
