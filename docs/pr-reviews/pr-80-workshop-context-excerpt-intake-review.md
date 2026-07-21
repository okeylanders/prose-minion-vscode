# MR Review — feat(workshop): Sprint 12 context intake and compaction plan

**Author:** okeylanders · PR #80 · base `epic/workshop-editor-tab` ← `sprint/workshop-editor-tab-12-context-excerpt-intake`

Reviewed by a 10-persona panel + Sensei. Draft PR; Sprint 12 of the Workshop epic — excerpt intake grows explicit paste/type and file/project paths with verified provenance, the single "context brief" becomes a bounded, inspectable attachment list, and a Context wizard, one-shot message attachments, an agent-facing source/neighbor catalog, and the Phase-7 "In context" manifest all land. The retained-history compaction controls are accepted as an ADR and **deferred to a follow-on epic** — not in this diff.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= praise or out of scope.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | `WorkshopToolContextCapability.fulfill()` hand-rolls a backtick escape (`loaded.replace(/```/g, …)`) instead of the house `neutralizeReservedPersonaPromptDelimiters` every other new frame builder uses — and it's broken: **verified** that 4/5/6/9-backtick runs (and any normal nested-fence chapter) leave a bare ` ``` ` that escapes the ` ```markdown ` wrapper, so untrusted project content reads as live instructions. Guide content gets no escaping at all. | Patricia | — | **Open** |
| 2 | 🟠 High | "Re-read from file" compares only the head-sliced `.text` (cap 10k words), so edits **past** the truncation window report "unchanged on disk" — the documented "edits land as a revision" contract silently fails. Untested (fixtures sit under the cap). | Sam | — | **Open** |
| 3 | 🟠 High | `selectNeighbors` picks "neighboring chapters" by catalog index-distance, but the catalog sorts `a.path.localeCompare(b.path)` (**verified**, lexicographic) — so unpadded `chapter1…chapter12` misorder and the model is told the wrong files are its narrative neighbors. Untested (fixture zero-pads). | Bria | — | **Open** |
| 4 | 🟠 High | The four excerpt mutators guard `activeRun` but never `wizardRun` (and UI `isRunning` ≠ `wizardRunning`): swap the excerpt mid-wizard and stale picks land as undated pills; the wizard also isn't aborted on session reset. A new lifecycle state added beside `activeRun` without inheriting its guards. | Bria, Blake | 🎯 | **Open** |
| 5 | 🟠 High | Three configured-resource attach paths (`handleAddContextResources`, `handleAttachMessageResources`, `adoptWizardResult`) skip the `sizeBytes` gate the sibling `handleSetExcerptResource` enforces (**verified**: catalog admits by extension only) — a large file is fully buffered. The guard lives on one copy, not the three others. | Sam | — | **Open** |
| 6 | 🟠 High | Four new router-registered message types — `WorkshopAttachMessageResourcesMessage`, `WorkshopAttachMessageFileMessage`, `WorkshopRemoveMessageAttachmentMessage`, `WorkshopRereadExcerptMessage` — were never added to the `WebviewToExtensionMessage` union (**verified**: 0 occurrences; their 7 siblings appear twice each). Runtime routing works via `register(…: any)`, but exhaustive type-narrowing silently misses them. | Stan | — | **Open** |
| 7 | 🟠 High | `WorkshopHandler.ts` is **2097 lines** (**verified**; next-biggest sibling `ConfigurationHandler` is 557) — a God Component by the project's own anti-pattern checklist. The context/attachment surface never got the service extraction the tool-run path already has (`RunWorkshopToolSidePass`, `WorkshopPromptBuilder`). *(Marcus's nuance: "a dispatcher that's started doing the service layer's job — not yet a God Component, but the next feature landed on it makes that call harder to defend.")* | Stan, Marcus | 🎯 | **Open** |
| 8 | 🟡 Standard | `cloneExcerptSource` spreads `...source` unfiltered, so the excerpt's `file://` `sourceUri` (an absolute path) rides into the session snapshot to the webview — while every sibling attachment explicitly strips it as "host-private, never crosses." Dead exposure (webview never reads it); needs a compromised webview to matter. *(Patricia argued High.)* | Patricia | — | **Open** |
| 9 | 🟡 Standard | The wizard's resource-load failures are swallowed in bare `catch {}` blocks (no log at all), then the user is told "N didn't fit" — actively wrong when the catalog itself threw. Sibling handlers thread `error.message` through `sendError`. *(Oliver argued High.)* | Oliver | — | **Open** |
| 10 | 🟡 Standard | The wizard's cancel and failure branches (a brand-new `AbortController` flow) have zero tests; the "refuses a second run" test *resolves* the held promise instead of rejecting, so failure never executes. *(Cal argued High.)* | Cal | — | **Open** |
| 11 | 🟡 Standard | The fetch → validate → load → trim → attach loop (and its verbatim 5-line trim block) is written three times across the attach handlers; the file already demonstrates the fix (`boundThreadArtifact` extracts the message-attachment equivalent) but the context path never got it. **Root cause of #5.** | Parker, Marcus | 🎯 | **Open** |
| 12 | 🟡 Standard | `hostWriterSources` is a monotonic accumulator — grows on every pin/message-attachment, an O(size) stale-flip scan per revision, cloned on ~20 `postSessionState` broadcasts, cleared only on full reset — while the `tool`/`guest` manifest lanes *do* clean up. Trends O(R²) across a long single session. | Tim | — | **Open** |
| 13 | 🟡 Standard | The configured-resource catalog is fully re-globbed and stat-walked (`createProvider` → `collectResources`) on all 8 call sites with no shared instance or cache — noise at tens of chapters, linear in catalog size on every click. | Tim | — | **Open** |
| 14 | 🟡 Standard | A comment claims `art-N` is "the ONLY stable address for … the Phase 7 manifest," but `ContextSourceEntry` has no field to hold it and `toContextSourceEntries` never receives it (**verified**) — the manifest and the tombstone-surgery id are two unconnected systems. The deferred compaction epic will trust a join that doesn't exist. | Marcus | — | **Open** |
| 15 | 🟡 Standard | `useWorkshopExcerptVerify` returns only `State & Actions`, dropping the `Persistence` third of the Tripartite hook contract all 17 sibling hooks honor; `useAccountBalance` shows the documented no-op (`Record<string, never>`) pattern for ephemeral hooks. | Stan, Marcus | 🎯 | **Open** |
| 16 | 🟡 Standard | `EXCERPT_WORD_BUDGET = 10_000` is hardcoded in `ExcerptPanel.tsx` (**verified**), duplicating the enforced `PROMPT_BUDGETS.fileExcerpt.words`; the sibling `ContextPanel.tsx` in the same PR imports `PROMPT_BUDGETS`. Silent desync risk. | Bria | — | **Open** |
| 17 | 🟡 Standard | `handleSearchContextResources` reimplements the byte/file bounds algorithm `WorkshopResourceCapability` already has, and none of its three `bounded = true` branches are exercised (the 2-file fixture can't trip them). | Cal | — | **Open** |
| 18 | 🟡 Standard | One of three failure branches in `withConfiguredResource` — the `fileURLToPath` throw, reachable via an `untitled:` buffer URI — returns `unstamped` without logging, while its two sibling branches log. Correct behavior, silent trail. | Oliver | — | **Open** |
| 19 | 🟡 Standard | The "retains staged artifacts … so a retry ships the same ids" test never performs the retry — it asserts the pending list after a failed send and stops, never re-sending to confirm the same `ta-N` rides again. | Cal | — | **Open** |
| 20 | 🟢 Nit | `boundThreadArtifact` computes `countWords` on the same string up to 3× over a condition that can't branch (the `contextAttachments.words` 35k vs `workshopThreadArtifacts.words` 10k cap relationship makes the second clause dead — **verified**). | Parker, Tim | 🎯 | **Open** |
| 21 | 🟢 Nit | The ambiguity log says "matched N configured resources when letter case is ignored" even on the exact-path-collision branch (`exact.length > 1`), where the case-folding filter never ran — a diagnostic that sends the next debugger chasing the wrong theory. | Sam | — | **Open** |
| 22 | 🟢 Praise | The defensive spine holds: IPC claims coerce to `{ kind: 'manual' }`, webview `configuredResource` claims are re-derived host-side and never trusted, mid-run guards re-check `activeRun` after **every** await, message attachments commit only on success (a retry re-ships), and the aggregate deep-clones every boundary. Traced end-to-end, no blocker found. | Blake | — | **N/A** |
| 23 | 🟢 Praise | The manifest-lifecycle comment (`WorkshopSessionService` §Phase 7) explains *why* host sources are collected live while tool/guest sources are snapshotted at adoption — heading off the "why is this inconsistent?" review comment before it's written. | Parker | — | **N/A** |
| 24 | 🟢 Praise | `sendError` is a real dual-channel mechanism — posts the webview ERROR and appends a structured `outputChannel` line in one call — and the disk/catalog paths thread caught errors through it consistently. | Oliver | — | **N/A** |

---

## Blast Radius

- **98 files changed · +11,040 / −936 lines · 22 commits** (reviewed surface: 46 `.ts`/`.tsx` logic files, ~7k diff lines; tests, CSS, ADRs, persona markdown, and HTML mockups excluded from the panel bundle)
- New files: `WorkshopToolContextCapability.ts`, `ContextPanel.tsx`, `WorkshopContextSelectorModal.tsx`, `WorkshopModalShell.tsx`, `useWorkshopExcerptVerify.ts`, `messages/inferenceContext.ts` · Migrations: n/a (VS Code extension) · New services/capabilities: 1 agent capability, 4 webview components, 1 hook
- Large sprint-closer PR; the single hottest file is `WorkshopHandler.ts` (+1098). Extensive new tests accompany it (`WorkshopHandler.test.ts` +609, `WorkshopSessionService.test.ts` +348, and ~20 more).

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | C |
| 🧪 Tests | C+ |
| 📖 Quality | B− |
| ⚡ Performance | B− |
| 🎯 Domain | C |

*(Mechanical from severity distribution. No 🔴 Blocking — Blake traced the correctness spine and cleared it — so no F. The C-band grades trace to real single-domain Highs: a working prompt-injection gap (Security), two edge-case correctness bugs (Domain), and untested new control flow (Tests). The underlying design earned three praises and a clean blocking-review.)*

---

## Executive Briefing

🟠 **[Bria · Blake 🎯]** The Context wizard is a lifecycle orphan — every excerpt mutator guards `activeRun`, none guard `wizardRun`, and the UI's `isRunning` ≠ `wizardRunning`. Swap the excerpt while the wizard streams and its picks (generated against the *old* excerpt) land as undated pills beside the new one; a session reset doesn't abort it either.

🟠 **[Stan · Marcus 🎯]** `WorkshopHandler.ts` has reached 2097 lines — ~4× the next-biggest handler and past the project's own 500-line God-Component line. The tool-run path was split into services long ago; the context/attachment surface added here never got the same treatment, and it's doing disk I/O, catalog resolution, and budget math inline.

🟠 **[Patricia]** The one gate between untrusted project content and the model — a hand-rolled backtick escape in `WorkshopToolContextCapability.fulfill()` — is provably broken: any chapter with a nested code fence (4+ backticks) reforms a bare ` ``` `, breaks out of the quoting wrapper, and the text after it reads as instructions. The house `neutralizeReservedPersonaPromptDelimiters` — used by every *other* frame builder in this PR — would close it.

🟠 **[Sam]** "Re-read from file" only compares the head-sliced excerpt text, so rewriting anything past word 10,000 of a large file is reported "unchanged on disk" — the revision silently never happens and the stale word count sticks.

🟠 **[Bria]** "Neighboring chapters" in the tool catalog are chosen by catalog index-distance, but the catalog sorts lexicographically — so under the common unpadded `chapter9.md` / `chapter10.md` convention the model is confidently handed the wrong neighbors.

*(Also High, in the ledger: #5 the size-gate the three attach copies dropped, and #6 four message types missing from the `WebviewToExtensionMessage` union.)*

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — The Phase-7 manifest claims an `art-N` address its own type can't hold

`AgentRunEngine.ts` mints `art-N` via `nextArtifactId()` and stamps it into the model-visible evidence (`wrapAgentFetchedArtifactEvidence`), with a comment — echoed in `workshopPromptFrames.ts` — calling it "the ONLY stable address for tombstone surgery AND the Phase 7 manifest." But `toContextSourceEntries(fulfillment.deliveredSources, …)` never receives `artifactId`, and `ContextSourceEntry` (verified: `kind`/`origin`/`label`/`configuredResource`/`sizeChars`/…`deliveredAt`) has no field to hold it. Today the manifest and the tombstone-surgery id are two unconnected bookkeeping systems; the compaction epic that will actually consume `art-N` is deferred, so nothing breaks now — but whoever builds it will read this comment and assume a join that isn't wired. Thread `artifactId` into `ContextSourceEntry` now (even optional), or soften the comment.

### 🟡 Standard — The context-attachment trim block is duplicated verbatim; the file already knows the fix [🎯 Consensus — with Parker]

The same five-line trim (compute words → compare `PROMPT_BUDGETS.contextAttachments.words` → `trimToWordLimit` → rebuild `truncation`) appears byte-for-byte in `handleAddContextResources` and `adoptWizardResult`, and the broader fetch-validate-attach dance three times. `boundThreadArtifact` already extracts the message-attachment equivalent into one helper — the context path just never got the same pass. On its own a nit, but it's the symptom of #7: a 2097-line dispatcher doing the service layer's job inline.

### 🟢 Nit — `useWorkshopExcerptVerify` drops the third leg of the Tripartite shape [🎯 — with Stan]

Every other domain hook (17/17 checked) exports `State`, `Actions`, and a named `Persistence` folded into `persistedState` — even ephemeral `useSelection`. This one returns `State & Actions` only. The empty *value* is honest; the diverging *shape* isn't. A no-op `WorkshopExcerptVerifyPersistence` restores uniformity, or the convention doc should sanction ephemeral-only hooks explicitly.

> *"The boundaries hold and the dispatcher still earns its keep — but the Phase 7 manifest just wrote a check its own type can't cash."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

I walked every scary path and came back without a blocker.

### 🟢 Praise — The correctness spine is genuinely well-defended [ties to #4]

`coerceWorkshopExcerptSource` validates IPC as `unknown` and degrades any unprovable shape to `{ kind: 'manual' }`; the webview's `configuredResource` claim is *discarded* and re-derived host-side against `absolutePath` with a `caseFolded.length !== 1` bail — a malicious webview can't forge source-file read access. The mid-run excerpt guards re-check `activeRun` *after* every await, synchronous-to-`replaceExcerpt` — no TOCTOU window in the single-threaded loop. Message-attachment commit is gated on `assistantTurn`, which is `undefined` on cancel/refusal, so failure preserves the pending pills and a retry re-ships the same ids. Budgets and dup-guards are a pure aggregate with deep clones on every boundary.

### The one wrinkle I'll hand to the panel [folded into #4]

`handleResetSession`/`preemptActiveRun` abort `activeRun` but not an in-flight `wizardRun`, so a wizard can land attachments into a just-reset session. The outcome is benign — valid, visible, self-consistent pills; no throw, no NPE, no corruption — so it doesn't clear the blocking bar. Bria found the sharper edge of the same gap.

> *"I traced every await in the excerpt-guard and message-commit paths expecting to get paged, but the double-guards, host-side re-derivation, and the assistantTurn gate all hold — this one doesn't wake me up."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — "Re-read from file" can't see edits past the truncation window

`handleRereadExcerpt` decides "unchanged" purely on `loaded.text === excerpt.text`, and `loadExcerptFromDisk` head-slices any file over `PROMPT_BUDGETS.fileExcerpt.words` (10,000) *before* returning that text — `truncation.totalWords` is never in the comparison. Pin a 15,000-word file (truncation shows "10,000 of 15,000"), then edit only past word 10,000 — append a chapter, rewrite the ending. The head slice is byte-identical, `loaded.text === excerpt.text` is `true`, and the handler sends "Excerpt unchanged on disk" and returns before `replaceExcerpt`. The docstring's contract — "on-disk edits land as a normal revision" — silently doesn't hold for edits outside the visible slice. `tests.diff` (289–333): both re-read tests use short strings under the cap, so this path is untested.

### 🟠 High — Configured-resource attach paths skip the byte-size gate the excerpt path enforces

`handleSetExcerptResource` checks `summary.sizeBytes > PROMPT_BUDGETS.fileExcerpt.bytes` (5 MB) and rejects before reading. `handleAddContextResources`, `handleAttachMessageResources`, and `adoptWizardResult` never check `sizeBytes` at all — each calls `provider.loadResources` unconditionally, then applies only a word-count trim *after* the full file is decoded into a JS string. The catalog caps admission by extension only (`isSupportedFile` — verified), so a resource comfortably under 5 MB but far past 35,000 words gets fully buffered on three of four resource paths while the fourth rejects it. It's the same guard, present on one path and absent on its three copies — the duplication in #11, biting.

### 🟢 Nit — Ambiguity log blames "letter case" even on an exact-path collision

When `exact.length > 1`, `caseFolded` is assigned `exact` directly — the case-insensitive filter never runs — yet the log still says "matched N when letter case is ignored." Behavior fails safe to `unstamped` either way; it's the diagnostic that would mislead the next investigator.

> *"Found the trap door: re-read only compares the head-sliced text, so quietly rewrite chapter 40 of a 15,000-word file and the excerpt cheerfully reports 'unchanged on disk' — technically the words it shows you didn't move, structurally the file is lying next to a body it insists is asleep."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — The same fetch-validate-trim-attach loop, written three times [🎯 Consensus — with Marcus]

`handleAddContextResources`, `handleAttachMessageResources`, and the `requestedResources` loop in `adoptWizardResult` all do the identical dance — `createProvider([...DEFAULT_CONTEXT_GROUPS])` (7 separate calls in this file), find the summary, load, empty-check, trim to a cap, hand off — with copy-pasted error strings. The only real variation is which cap and which attach call ends the loop. Pull the shared part into one helper (e.g. `resolveConfiguredResourceContent`) so a change to the empty/error messaging doesn't need three synchronized edits.

### 🟡 Standard — `boundThreadArtifact` recomputes `countWords` over a condition that can't branch [🎯 — with Tim]

`countWords(content)` runs up to three times on the same string, and the second half of `if (totalWords <= cap && countWords(content) <= cap)` is dead: when `knownTotalWords` is omitted, `totalWords` *is* `countWords(content)`; when it's supplied, it comes from a 35k-word head-slice that already exceeds this method's 10k cap, short-circuiting first (verified constants). Compute once and return `totalWords`.

### 🟢 Praise — The manifest-lifecycle comment explains the *why*, not just the *what*

The `hostWriterSources`/`toolWriterSources`/`guestWriterSources` trio could have been three same-shaped fields; instead the header states the asymmetry up front — host is collected live because it gets update frames, tool/guest are snapshotted because retained sidecars never see later changes. That's the good kind of comment: it answers the reviewer's question before it's asked. More of this.

> *"I read handleAddContextResources, handleAttachMessageResources, and adoptWizardResult expecting three different methods and got the same one with a different coat of paint each time — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — The wizard's cancel and failure branches ship with zero coverage *(argued High)*

`describe('Context wizard')` has 5 tests: no-excerpt guard, happy path, already-running refusal, brief-wins-budget-race, nothing-fits. The "refuses a second run" test *resolves* the held promise with empty content — never exercising failure. No test rejects `generateContext`, and none calls `handleCancelRequest` with `domain: 'workshop-context'`. That leaves `cancelled = controller.signal.aborted` and `sendError('The Context wizard failed.')` dark — a brand-new `AbortController` flow where "worked when I tried it" and "proven" diverge.

### 🟡 Standard — "so a retry ships the same ids" — the test never retries

The body sends once, fails, asserts `pendingMessageAttachments` still holds `ta-1`, and stops. It never issues a second `handleSendMessage` to confirm the second run's `input.message` still contains `<thread-artifact id="ta-1">` — the actual claim in its title. The sibling success test *does* inspect `input.message`; this one should too, on a second call.

### 🟡 Standard — New search-bounds logic duplicates the capability's — and its truthy branches are untested

`handleSearchContextResources` has three independent ways to set `bounded = true`, a fresh reimplementation of caps `WorkshopResourceCapability` already enforces (and covers). The only test of the new method runs against the 2-file fixture and asserts `bounded === false` — structurally incapable of tripping any cap. A second copy of a bounds algorithm, none of its truthy branches ever executed.

> *"The wizard can cancel, the wizard can fail, and a 'retry' test that never retries — that's not confidence, that's a coverage number wearing a trench coat."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟠 High — Four new Workshop message types never made it into `WebviewToExtensionMessage`

Searched `index.ts` for `WorkshopAttachMessageResourcesMessage`, `WorkshopAttachMessageFileMessage`, `WorkshopRemoveMessageAttachmentMessage`, `WorkshopRereadExcerptMessage` — **0 occurrences** (verified), in neither the import block nor the union. All four are real, router-registered types added in this PR, and the other seven siblings from this exact diff were threaded through correctly right next to the gap. `MessageRouter.register`'s `(msg: any)` papers over it at the call site, but anything that narrows exhaustively over `WebviewToExtensionMessage` — tests included — silently won't see these four.

### 🟠 High — `WorkshopHandler` has grown into a God Component (2097 lines) [🎯 Consensus — with Marcus]

Every other domain handler stays under the checklist's 500-line line — `AnalysisHandler` 400, `ConfigurationHandler` 557. This diff piles ~900 lines on (context intake, the catalog trio, message-attachment stage/remove, excerpt-resource + re-read, the wizard) and lands at 2097 — ~4× the sibling top and 5× the median. Sprint 12 Phase 6/6B/7 each read like they could be their own collaborator, the way `WorkshopPromptBuilder` and `WorkshopSessionService` were already split out of this handler's neighborhood.

### 🟡 Standard — `useWorkshopExcerptVerify` skips the Persistence third of the Tripartite contract [🎯 — with Marcus]

`useAccountBalance.ts` hits this exact case — ephemeral, nothing to persist — and shows the house answer: it *still* declares `Persistence = Record<string, never>` and returns `persistedState`, with a comment on why ("so App's `usePersistence` spread stays uniform"). `WorkshopApp.tsx` spreads every other hook's `persistedState` but never `excerptVerify`'s, because there isn't one — this hook is quietly outside the contract every sibling honors.

> *"We've got a sibling hook that spells out, in a doc comment, exactly why useWorkshopExcerptVerify needed a persistedState too — useAccountBalance is right there in the same folder, practically waving."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — `hostWriterSources` is a monotonic accumulator, re-cloned on every broadcast

It grows on every shipped host message-attachment and every delivered excerpt revision — which also loops the whole array to flip `.stale = true` before pushing the new pin (O(current size) per revision). It's cleared only by a full reset, never by ordinary re-pinning. `collectWriterSources` clones the entire array on every `postSessionState()` — ~20 call sites. Contrast `toolWriterSources` (wiped on sidecar retire) and `guestWriterSources` (`.delete()` on disposal): the host lane is the default, longest-lived one and the only manifest with no cleanup. Summed over R revisions each growing the list *and* triggering broadcasts against the larger array, clone-work trends O(R²). Noise at forty chapters; a marathon session with hundreds of pin swaps is where it stops being free.

### 🟡 Standard — The catalog is fully re-globbed and stat-walked on all 8 call sites, uncached

`createProvider()` isn't a lookup — `collectResources` runs `workspace.findFiles` per group × folder × pattern, then walks each match segment-by-segment through `fileSystem.stat()` for symlink safety. `WorkshopHandler` calls it fresh from 7 sites (catalog, search, add, attach, set-excerpt, wizard, `withConfiguredResource`), plus an 8th in `WorkshopToolContextCapability`. Searched for cache/memoize — none. Debounced 350ms client-side so it's not literally per-keystroke, but nothing is shared, so cost scales linearly with catalog size on every click. Point a group at a broad glob over a large docs tree and this stops rounding to zero.

### 🟢 Nit — `boundThreadArtifact` computes `countWords` 3× [🎯 — with Parker]

`countWords` is a full O(n) scan with a fresh array each call; `boundThreadArtifact` runs it three times on an unchanged string. Bounded at 10,000 words, so a couple of avoidable milliseconds per attachment — three passes for the price of one.

> *"Eight call sites re-glob and re-stat-walk the same catalog without ever comparing notes, and the host's manifest only knows how to grow — linear and boring at forty chapters, and I'll let you do the arithmetic for four thousand."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟠 High — The only escaping on untrusted project/guide content is broken by any nested code fence

`fulfill()` is the sole boundary between raw project-file/guide content (untrusted per the threat model) and the model, and it never calls `neutralizeReservedPersonaPromptDelimiters` — the house mechanism every other new frame builder in this PR uses. Instead it hand-rolls `loaded.replace(/```/g, '`​``')`, which only neutralizes an isolated run of exactly 1–3 backticks. Verified empirically: 4-, 5-, 6-, 9-backtick runs — and a perfectly ordinary chapter with a 4-tick fence wrapping a 3-tick code block — all leave a literal ` ``` ` in the output. Once the fence breaks, everything after it (including fabricated `### `-style headers) reads as live markdown/instructions rather than the "quoted reference material, never instructions" the evidence string promises. `wrapAgentFetchedArtifactEvidence` downstream explicitly assumes the capability already neutralized — there's no second boundary. Guide content gets no escaping at all. Untested (no test content contains a backtick).

### 🟡 Standard — The excerpt's `file://` sourceUri ships to the webview unredacted *(argued High)*

`cloneExcerptSource` clones `configuredResource` carefully but spreads `...source` unfiltered, so `sourceUri` — a `file://` URI, effectively the writer's absolute path — rides through `cloneExcerpt` → `getSnapshot()` → `WorkshopSessionSnapshot.excerpt`, posted to the webview on every session broadcast with no projection between. Two functions below, `attachmentSnapshot`/`messageAttachmentSnapshot` explicitly destructure `sourceUri` out as "host-private… never crosses to the webview," and tests assert its absence — no such assertion exists for `excerpt.source`. The webview never reads it (grepped), so it's dead exposure, not a used tradeoff. It needs a compromised webview to exfiltrate — but it's exactly the field this PR taught itself to strip everywhere else, in a message that already crosses on every keystroke.

> *"Passes the scanner. Doesn't pass the attacker — or, in this case, doesn't even need one: a second code block in the same chapter breaks the fence for free."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Wizard resource-load failures vanish into a bare catch, then get relabeled "didn't fit" *(argued High)*

In `adoptWizardResult`, both `createProvider()` and `loadResources()` failures are caught with the error thrown away entirely — no `appendLine`, no `.message`. `handleAddContextResources` and `handleAttachMessageResources` hit the identical two points and both `sendError(…, details)`. The only downstream trace is the aggregate "Wizard finished (N attached, M skipped)" and a user status "N didn't fit" — actively wrong when the catalog *threw* (permissions, moved config): nothing "didn't fit" a budget, the read never happened. A writer reporting "the wizard keeps skipping things" leaves support guessing between five identical-looking failure modes.

### 🟡 Standard — One of three failure branches in `withConfiguredResource` logs nothing

Two branches log (catalog unreadable; ambiguous case-folded match). The third — `fileURLToPath(source.sourceUri)` throwing — returns `unstamped` silently. Not theoretical: an unsaved buffer's `untitled:Untitled-1` URI can ride into `source.sourceUri` (the selection path doesn't filter by scheme), and Node's `fileURLToPath` throws on a non-`file:` scheme. The `unstamped` fallback is correct; it's just the odd branch out in its own function — two siblings within ten lines leave a trail, this one doesn't.

### 🟢 Praise — `sendError` is a real dual-channel mechanism worth naming as the standard

It posts the webview ERROR and appends `[WorkshopHandler] ERROR [source]: message - details` in one call, and the disk/catalog paths thread caught errors through it consistently. That's the right shape for "what does on-call have to work with" — which is exactly why the two swallowed catches above stand out.

> *"'Wizard finished — 3 skipped,' and not one line about why. Fails silently; see you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — "Neighboring chapters" are only correct if filenames happen to sort numerically

`selectNeighbors` picks neighbors purely by array-index distance in the catalog, whose order comes from `a.path.localeCompare(b.path)` — lexicographic, not numeric (verified). Zero-padded `ch-01…ch-08` happen to equal numeric order; the extremely common unpadded `chapter1…chapter12` don't — `localeCompare` puts `chapter10` before `chapter2`, so with `ch-1..ch-12` the catalog reads `ch-1, ch-10, ch-11, ch-12, ch-2…`, and chapter 9's four nearest indices are all `ch-2..ch-8`, never `ch-10`. Meanwhile `formatCatalog()` and `fulfill()` tell the model, in words, that these *are* its "neighboring chapters." The only fixture zero-pads by construction (`padStart(2,'0')`), so this can never fire under test.

### 🟠 High — The excerpt guard checks `activeRun` everywhere but never `wizardRun` [🎯 Consensus — with Blake]

`handleRunContextWizard` captures the excerpt once, awaits a real LLM call, then `adoptWizardResult` attaches the brief/resources with no reference back to that excerpt. Nothing blocks the excerpt from changing underneath: `handleSetExcerpt`, `handlePickExcerptFile`, `handleRereadExcerpt`, `handleSetExcerptResource` all guard `this.activeRun` only — none check `wizardRun`. The UI doesn't block it either — `ExcerptPanel`'s `isRunning` is `currentRequestId || activeToolId`, distinct from `wizardRunning`, so "Update text…" / "Re-read" / "Choose from project…" stay live while the wizard streams. Net: swap the excerpt mid-run and the wizard's picks — generated against the *old* excerpt — land as ordinary, undated pills beside the new one, nothing marking them as describing a different excerpt. This undercuts `adoptWizardResult`'s own promise that "nothing the wizard does is silent or exempt." No test drives the interaction.

### 🟡 Standard — `EXCERPT_WORD_BUDGET` is a hardcoded duplicate, not an import

`ExcerptPanel.tsx` hardcodes `10_000` (verified) for the budget it displays, duplicating the enforced `PROMPT_BUDGETS.fileExcerpt.words` the handler applies. Both are 10,000 today, nothing keeps them synced. The sibling `ContextPanel.tsx` — added in this same PR — imports `PROMPT_BUDGETS` and reads `contextAttachments.words`. Same anti-pattern the checklist names; the fix is one import away.

> *"It calls them 'neighboring chapters' with a straight face — a promise that only holds until somebody writes chapter10.md before chapter9.md earns its zero back."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Every Copy Is a Place the Fix Can Miss

Illuminated by: Sam (#5) · Parker + Marcus (#11) · Tim (#12, #13) · Bria (#16) · Cal (#17) · Stan + Marcus (#7)

When the same knowledge lives in four places, correctness now depends on four future edits staying in lockstep — and they won't. Duplication rarely stays cosmetic: the size gate was added to the excerpt path and quietly skipped on its three siblings, so "this is duplicated" and "this buffers an unbounded file" turned out to be the same defect wearing two hats. Six reviewers reached this one surface through six different lenses — and that convergence is itself the tell: when a smell is visible from every angle, it has stopped being a nit and become structural.

→ Carry forward: Before pasting a block a second time, ask "what invariant will someone eventually need to change in *all* of these at once?" If the answer isn't "nothing," extract it now, while the copies still happen to agree.

### Lesson 2 — The Approximation Quietly Becomes the Truth

Illuminated by: Sam (#2) · Bria (#3) · Bria + Blake (#4)

Three unrelated-looking bugs shared one root: a value trusted to mean something it only approximated. Head-sliced text was trusted to mean "the file," so edits past the cap read as unchanged. Index-distance in a lexically-sorted catalog was trusted to mean "chapter order," so the model was handed the wrong neighbors. A captured excerpt was trusted to mean "the current excerpt," so a mid-wizard swap left stale picks. Each stand-in was honest the day it was written and became a quiet lie the moment reality drifted from it.

→ Carry forward: For any value doing double duty, say the gap out loud — "this is the first 10k words, not the file"; "this is lexical order, not narrative order" — then decide whether that gap can ever matter. If it can, close it or guard it before it gets promoted to ground truth.

### Lesson 3 — A Mechanism Only Protects Where You Reach for It

Illuminated by: Patricia (#1, #8)

This PR built the right tools — a delimiter-neutralizer for untrusted content, an invariant that host-private fields are stripped at the webview boundary — and then, in exactly one spot each, hand-rolled a broken escape and leaked an absolute path. A safeguard's worth isn't in existing; it's in being reached for at every site that needs it. One bypass is the whole exposure, because edge cases and attackers only ever need the single door left ajar.

→ Carry forward: When you catch yourself writing the safe behavior inline, pause and ask "is there already a house mechanism for this?" A hand-rolled version of an already-solved problem is a quiet flag that something canonical is being bypassed.

### Lesson 4 — New State Inherits None of the Old Scars

Illuminated by: Bria + Blake (#4) · Cal (#10) · Oliver (#9)

`activeRun` earned its protections the hard way — mid-run guards on every mutator, an `isRunning` mirror in the UI, an abort on session reset. Then `wizardRun` was added right beside it and inherited none of that: the guards still checked the old flag, the UI mirror was missing, the wizard outlived reset, its new branches went untested and its errors unlogged. When you introduce a concept that parallels a hardened one, the language copies the shape but not the lessons — every defense the original earned has to be re-applied on purpose.

→ Carry forward: When you add a sibling to a battle-tested concept, first enumerate what protects the original — guards, lifecycle hooks, logs, tests, UI mirrors — then walk that list item by item for the newcomer. Parallel state demands parallel defenses.

### Lesson 5 — A Test That Cannot Fail Is Only Decoration

Illuminated by: Cal (#10, #17, #19) · and the tidy fixtures behind Sam (#2) and Bria (#3)

Several tests here went through the motions and stopped a step short of the assertion that mattered — resolving where they should reject, halting before the retry, never tripping the bounded path. And the two approximation bugs slipped past precisely because the fixtures shared the code's own assumptions: zero-padded chapters, files under the cap. A net woven with the same blind spot it means to catch will always come up empty, and a green test that can't reach its own failure is more expensive than no test, because it sells confidence it doesn't own.

→ Carry forward: For every test, ask "what one line could I change in the code to turn this red?" If you can't name it — or the fixture is too well-behaved to ever trip the bug — you've documented a hope, not guarded a contract.

> *"Not one of these findings came from ignorance — each came from good code trusting that tomorrow would resemble today; mastery was never about never leaving a door ajar, but about learning to feel the draft before someone else walks through it."* — Sensei

---

## The Closer

### 🚪 Knock knock

"Knock knock."
"Who's there?"
"Nothing changed."
"Nothing changed who?"
"'Nothing changed on disk' — which is exactly what *Re-read from file* tells you after you've rewritten all of chapter 40, because the diff only ever looked at the first 10,000 words."

---

## Summary

**Nearly there — merge after the correctness and security Highs land; the spine is sound.** Blake traced the whole provenance/guard/commit spine and found no blocker, and the design earned genuine praise: untrusted IPC degrades to `manual`, webview claims are re-derived host-side, mid-run guards re-check after every await, and the aggregate deep-clones every boundary. What the panel *did* surface clusters into two stories. First, a handful of real edge-case bugs where **a value was trusted to stand for something it only approximates** — head-sliced text for "the file" (#2), lexical index-distance for "chapter order" (#3), a captured excerpt for "the current excerpt" (#4) — each invisible to tests whose fixtures dodge the boundary. Second, a **six-reviewer theme**: the context surface was built by copy-paste onto an already-oversized handler (#7), and the copies drifted until one dropped a size gate (#5) and another a prompt-injection escape (#1) that the rest of the PR already had the right mechanism for. Fix the two security Highs (#1, #8) and the three correctness Highs (#2, #3, #4), thread the missing message types (#6), and the duplication/extraction work (#7, #11) is the natural follow-up that makes the next Workshop sprint land on something smaller than 2097 lines.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
