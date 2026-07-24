# MR Review — feat(workshop): persist and restore sessions

**Author:** okeylanders · PR #85 · base `epic/workshop-editor-tab` ← `sprint/workshop-editor-tab-10-session-persistence`

Reviewed by a 10-persona panel + Sensei. Draft PR; persists the complete committed Workshop aggregate plus continuable host, guest, and live tool-sidecar histories under workspace-owned JSON (`prose-minion/sessions/*.json`), rebuilding current system prompts under fresh runtime conversation ids with visible degradation for malformed participant archives. Adds trusted start/resume/hourly time frames, ordered autosave, strict Open/New promotion rollback, root pinning, unreadable-current protection, named Save, and a session browser (bounded search, date/excerpt grouping, open, rename, duplicate, reveal, delete). The panel confirmed **one blocker** — the write-path validator rejects the very archives real sessions produce, and a silent failure sink lets it eat the writer's work unseen — alongside genuinely strong path-containment, prototype-pollution, and transactional-time-notice work. The recurring thread is not carelessness; it is **asymmetry**: read grammar vs. write grammar, a rule remembered on Save but forgotten on New, a claim in the docs the code stopped honoring.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= praise or out of scope.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | **The write-path validator throws on every context-bearing session.** `cloneConversationJson` (`WorkshopPersistedSession.ts:145`) treats an explicit `configuredResource: undefined` own-property as a fatal "non-JSON value" — but `cloneContextSources` (`ConversationManager.ts:610`) emits exactly that for any non-resource source. `JSON.stringify` silently drops the key (so **reads** pass), while the validator uses `Object.entries` and **throws** (**empirically reproduced**: `conversations[0].contextSources[0].configuredResource contains a non-JSON value`). It fires the instant a writer pins an excerpt. Rolling autosave swallows the throw in `markDirty`'s catch (`WorkshopSessionPersistenceCoordinator.ts:285`) and never advances `writtenRevision`, so `current.json` freezes at the last context-free state and **every turn after the first pin is silently lost on reload**; named Save throws straight to the user. Coverage gap: the persistence tests mock the archive to `[]` and use only empty `contextSources` fixtures. | Blake | — (root of the silent-sink cluster) | **Open** |
| 2 | 🟠 High | **"New session" is enabled but always fails in a multi-root / no-workspace window.** Reset now routes through `sessionPersistence.resetSession()` → `store.writeCurrent()` → `requireAvailability()` throws; `restoreRollback` undoes the reset and the writer gets an error toast. Every New entry point (`WorkshopApp.tsx:673`, the ⌘⇧N shortcut at `:226`, the menu, the browser footer) gates only on `!sessionReady \|\| sessionMutationsDisabled` — none checks `persistenceAvailable`, though **Save correctly does** (`:671`/`:218`). A functional regression from the old pure in-memory reset. | Sam | — | **Open** |
| 3 | 🟠 High | **Opening an uncached session parses every file on disk, sequentially, with no early exit.** `findNamedSession` only short-circuits on a process-lifetime cache hit; `readNamedBrowserSessions` (the list path) never warms that cache, so "cold" is the normal case after any window reload/extension update. On a miss it reads + fully `parseWorkshopPersistedSession`-validates **every** named file (`WorkshopSessionStore.ts:446`) — no `maximumFiles` bound, no byte cap, no return on match — before filtering. At n=150 that's ~150 sequential read+parse round trips (~1.5–3s) to open even the newest session. The sidecar/bounded framing holds for **listing**, not **opening** — the commoner click. | Tim | — (perf-cost twin of #18) | **Open** |
| 4 | 🟠 High | **Unnamed-session autosave failures are log-only — the writer gets no signal.** An ordinary autosave failure (disk full, revoked permission, sync lock) lands in `markDirty`'s catch (`coordinator.ts:292`) and is only `appendLine`'d; `currentCheckpointError` is untouched, and `emitNamedSaveStatus(..., 'error')` fires **only if `namedSessionId`** — i.e. only after an explicit Save As. The webview save-status pixel is gated identically (`WorkshopApp.tsx:565-568`). A writer who never hits Save As — the common path — works against a stale checkpoint with zero live signal. **This is the sink that makes #1 invisible.** | Oliver | — (silent-sink cluster) | **Open** |
| 5 | 🟠 High | **The computed degradation reason is discarded before it reaches a log or the UI.** `AssistantToolService.importWorkshopConversationArchive` (`:776-793`) builds a specific per-participant reason ("Current system prompt could not be rebuilt: …", "Archived tool name X does not match Y"); `hydrate()` keeps only `outcome.key` (`coordinator.ts:604`) and drops `outcome.reason`. Both the log (`:626`) and the webview payload (`WorkshopHandler.ts:1043`) carry keys only, so "restored without retained memory" can never say **why** — corrupt archive, unresolved persona, or prompt-rebuild throw. Advertised "visible degradation" isn't visible. | Oliver | — | **Open** |
| 6 | 🟠 High | **The one shutdown-flush test reads source as a string.** `providerAssembly.test.ts:126` does `fs.readFileSync` and asserts that `dispose()` and `await …flush()` appear in the right left-to-right **text** order; it never instantiates a handler/coordinator or calls either method. It stays green if `flush()` becomes a no-op or `abandonRun()` is deleted. The abort-then-abandon-then-flush handshake that stands between a writer and a lost final turn is exercised by nothing at runtime. | Cal | — (test-can't-fail cluster) | **Open** |
| 7 | 🟠 High | **`writeCurrent`'s snapshot-then-sidecar pair is two atomic writes, not one transaction.** If the sidecar's `rename` throws after the primary `rename` already landed (`WorkshopSessionStore.ts:211-212`), `current.json` reflects the new state while `current.summary.json` reflects the old — and no test drives the second write to fail after the first succeeds, though the fake FS makes it trivial. Bounded (the sidecar is index-only and `list()` flushes first), but a sidecar-specific failure leaves the browser showing a stale title/preview with no regression to catch it. | Cal | — | **Open** |
| 8 | 🟠 High | **A 1,152-line stateless validator is welded onto `WorkshopSessionService` instead of its own module.** The class closes at line 1905; everything from 1907 to 3059 (60 free functions — `cloneWorkshopSessionState`, `assertWorkshopSessionStateShape`, `validatePersistedState`, ~30 `assert*` helpers) is stateless `WorkshopSessionStateV1` validation that never touches `this` — **verified** (file is 3,059 lines). The sibling `WorkshopPersistedSession.ts` already proves the one-module-per-parser pattern and imports the parser **from** the service. This is the direct, mechanical, zero-behavior-change cause of the god-object risk; extract to `WorkshopSessionStateV1.ts`. | Marcus | — | **Open** |
| 9 | 🟡 Standard | **Five validation helpers duplicated byte-for-byte between modules that already import from each other.** `isRecord`, `exactKeys`, `isTimestamp`, `normalizeTimestamp`, `isNonNegativeInteger` are re-declared at `WorkshopSessionStore.ts:971-1005`, character-identical (including error strings) to `WorkshopPersistedSession.ts:46-80` — from which the store **already imports** (`:14-18`). `assertTimezone` similarly duplicates `WorkshopSessionTimeService.ts:83`. Tighten one copy and the sidecar's rules silently drift from the envelope's. Extract a shared `persistedValidation.ts`. | Parker, Stan | 🎯 | **Open** |
| 10 | 🟡 Standard | **Dead `toMessageSummary` overload.** Every call site (`coordinator.ts:363/365`) uses the 2-arg `(WorkshopStoredSessionSummary, 'current' \| 'named')` shape; the 3-arg `WorkshopPersistedSessionV1` overload has zero callers (**verified**), yet forces the implementation to carry five `'x' in value` runtime narrowings for a shape nothing passes. Drop it and the signature says what the method actually does. | Parker, Marcus | 🎯 | **Open** |
| 11 | 🟡 Standard | **Session JSON is written under the workspace root with no safe-by-default `.gitignore`.** Envelopes hold the writer's **unpublished manuscript** (excerpt text) + full host/guest/tool transcripts at `prose-minion/sessions/*.json`; no repo `.gitignore` covers it (**verified** via `git ls-files`). Background autosave creates tracked files the writer never chose to create, so one `git add -A && push` silently publishes unpublished prose + AI transcripts. The ADR (`:64`) makes it a deliberate "committable or `.gitignore`-able" stance — but the cheap, philosophy-preserving fix is opt-out: write `prose-minion/sessions/.gitignore` containing `*` on first directory creation. | Patricia | — | **Open** |
| 12 | 🟡 Standard | **Autosave rewrites — and pretty-prints — the entire unbounded turn history on every committed mutation.** `markDirty` fires at ~19 `WorkshopHandler` call sites; each `capture()` exports the **complete** `turns` array (not the `WORKSHOP_SNAPSHOT_TURN_WINDOW = 100` bound used for the webview), and `writeCurrent` does a full `JSON.stringify(value, undefined, 2)` (`WorkshopSessionStore.ts:709`) of that plus the provider archive, whole, every time. Write cost at turn *k* is O(*k*) → O(*n²*) cumulative; ~135 MB written over a 300-turn session that ends ~900 KB. Serialized (no corruption) and ADR-accepted "unbounded in v1." | Tim | — (relates #3, #18) | **Deferred** — ADR-accepted for v1; track compaction |
| 13 | 🟡 Standard | **"Ordered autosave" reinvents the sibling `serialize()` queue idiom twice under new names.** `WorkshopConversationSettingsService.ts:50/295` established `private queue: Promise<void>` + `serialize<T>()`; the coordinator's `runSessionOperation` (`:762-776`) is a beat-for-beat copy renamed, and `writeQueue` (`:105`) adds a genuine `dirtyRevision`/`writtenRevision` skip but under a name a reviewer who knows the idiom won't recognize. | Stan | — | **Open** |
| 14 | 🟡 Standard | **"Sidecar" now names two unrelated things in one feature.** The pre-existing `WorkshopToolSidecar` is a live AI tool **conversation participant**; the new `WorkshopSessionSummarySidecarV1` (`WorkshopSessionStore.ts:133`) is a **filesystem index file**. A maintainer greps "sidecar" and has to context-switch. Rename the store's concept to `…SearchIndex`/`summaryIndex`. | Parker | — | **Open** |
| 15 | 🟡 Standard | **Content search never inspects the retained conversation archive, and the banner under-discloses it.** `fullSessionMatches` serializes only `session.workshop` (`WorkshopSessionStore.ts:835`); `session.conversations` is never searched and never contributes to `searchTruncated`. A query hitting archive-unique text (composed frames, embedded guest-join transcripts) returns a definitive "no match" with no banner, though the modal promises the full room + conversation memory. Softened where archive content is redundant with `turns`. | Sam | — (locus-twin of #16) | **Open** |
| 16 | 🟡 Standard | **Content search pays a full `JSON.stringify` of the whole session before applying its own character bound.** `fullSessionMatches` (`:835-838`) stringifies the entire `session.workshop` and *then* slices to `maximumSearchCharacters` (250 K) — the bound protects the substring scan, not the serialization. Runs per non-metadata-match file, sequentially, for up to `maximumFiles` (200); the host-side scan isn't cancelled when a newer query supersedes it (client is debounced 220 ms), cutting against the ADR's "cancellable" goal. | Tim | — (locus-twin of #15) | **Open** |
| 17 | 🟡 Standard | **Autosave log lines never carry the session identity.** Both the success (`coordinator.ts:280`) and failure (`:293`) lines interpolate a lifetime-monotonic `revision` and a static per-call-site `reason`, but never `this.identity.sessionId` (in scope at `:268`), title, or path — and OutputChannel entries aren't timestamped. After a couple of opens/renames a failure can't be attributed to a session. One interpolation fixes it. | Oliver | — | **Open** |
| 18 | 🟡 Standard | **The docs claim per-turn autosave "does not parse every saved transcript" — the code parses the file it's about to overwrite.** The ADR, sprint doc, and memory-bank all repeat that claim, but on a cache **hit** `updateNamed` → `findNamedSession` still does a full `readFile` + `parseWorkshopPersistedSession` of the existing file (`WorkshopSessionStore.ts:366`) purely to string-compare `sessionId`, then discards it before overwriting. The cache avoids the *directory* scan, not the per-turn full-file re-parse — and the claim shipped untested. | Bria | — (relates #3, #12) | **Open** |
| 19 | 🟢 Nit | **Unbounded exact read + uncapped clone depth → OOM on a hostile file from a shared workspace.** `readSessionFileExact` is deliberately unbounded and `cloneConversationJson` recurses with no depth guard; activation reads `current.json` before providers are exposed. A workspace can be git-cloned / Live-Shared / dev-container-mounted, so a crafted multi-GB or pathologically deep file OOMs/stack-overflows the host on activation. Parse errors already degrade to "autosave paused," so only an allocation-blowing flat file escapes. Cap the exact read at a generous ceiling (64–128 MB, well above the 5 MB browser bound). | Patricia | — | **Deferred** — shared-workspace only; low practical risk |
| 20 | 🟢 Nit | **The architecture tripwire wasn't extended to the two new infrastructure classes.** `boundaries.test.ts`'s `FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION` allowlist blocks handlers from `new`-ing infra services but doesn't name `WorkshopSessionPersistenceCoordinator` or `WorkshopSessionStore`. No live violation today (both constructed only in `extension.ts`), but the guard that exists to catch this regression won't catch it for the PR's two biggest new pieces. One-line addition. | Marcus | — | **Open** |
| 21 | 🟢 Nit | **Builtin-import style disagrees with its own sibling in the same PR.** `WorkshopSessionPersistenceCoordinator.ts:9-10` uses `node:crypto`/`node:path`; all 13 other core imports — including this PR's own `WorkshopSessionStore.ts:11` — use the bare specifier. No `import/order` rule catches it, so "lint 0 errors" won't. | Stan | — | **Open** |
| 22 | 🟢 Nit | **New/Open confirm unconditionally though the ADR implies a conditional gate.** ADR §7 promises confirmation "when unsaved committed changes would be displaced," but `startNewSession`/`openStoredSession` (`WorkshopApp.tsx:406`) set the confirm with no turn-count/dirty check, so a zero-turn room still prompts. Given continuous autosave there may be no truly "unsaved" work — so this may be the deliberate simpler choice. **Confirm intent.** | Bria | — | **Open** |
| 23 | 🟢 Praise | **Root pinning is real and consistent.** Every variable path op — save, open, rename, duplicate, delete, sidecar, reveal — funnels through `namedPath()` → `isPathWithinRoot` (`WorkshopSessionStore.ts:726`); filenames come from `titleSlug()` (`[a-z0-9-]` only) + UTC timestamp, never raw `sessionId`/`title`; reveal goes out as a structured `vscode.Uri.file()`. Prototype pollution is foreclosed by `exactKeys` + `Object.fromEntries` define-semantics. It passes the attacker, not just the scanner. | Patricia | — | **N/A** |
| 24 | 🟢 Praise | **The two-phase time notice survives the failed-turn edge cleanly.** `prepareNotice` is read-only; `commitNotice` runs only after `if (assistantTurn)` — so a rejected provider call leaves `pendingResumeKeys`/`personaNotices` untouched and the next attempt re-sends the same frame (test at `WorkshopHandler.test.ts:285`). Hourly boundary inclusive, clock-skew floored to zero. The right shape for a probabilistic step guarded by deterministic bookkeeping. | Sam | — | **N/A** |

---

## Blast Radius

- **62 files changed · +11,380 / −198 lines · 5 commits** · draft PR. Diff exceeds the panel's ~800-line bundle threshold, so reviewer context was sliced into focus payloads (core persistence, integration, UI, tests, docs) plus whole-file reads from the working tree; CSS (+735) reviewed only for cross-references.
- **20 new files · 0 deletions · no migrations** (workspace-owned JSON persistence).
- New source (the crown jewels): `WorkshopSessionStore.ts` (+1,024), `WorkshopSessionPersistenceCoordinator.ts` (+932), `WorkshopSessionTimeService.ts` (+335), `WorkshopPersistedSession.ts` (+207); deep changes to `WorkshopSessionService.ts` (+1,340 → 3,059 total), `WorkshopHandler.ts` (+424), `ConversationManager.ts` (+280), `AssistantToolService.ts` (+217).
- New UI: `WorkshopSessionBrowserModal.tsx` (+609), `WorkshopSaveSessionModal.tsx` (+237), `WorkshopSessionsMenu.tsx` (+191), `WorkshopConfirmDialog.tsx`, `WorkshopApp.tsx` (+287), `workshop.css` (+735).
- New tests: ~3,700 lines across store, coordinator, time, persistence, handler, conversation, tool, UI-component, and hook suites. New services: 2 (`WorkshopSessionStore`, `WorkshopSessionPersistenceCoordinator`) + 1 (`WorkshopSessionTimeService`).
- **Hottest risk surface:** the write-path validator (`WorkshopPersistedSession.cloneConversationJson`) and the autosave failure path in the coordinator — one blocker and three high-severity findings converge there.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | B+ |
| 🧪 Tests | D |
| 📖 Quality | B− |
| ⚡ Performance | C |
| 🎯 Domain | C+ |

*Architecture: seams (composition root, ports, contracts) held under pressure — one structural High drags it. Security: strong containment + pollution posture; one accidental-leak Standard. Tests: 1,170 green tests, yet the central use case broke and the shutdown guard is a string-check — the suite counts lines, not behaviors. Performance: correct-but-unbounded at scale, one High on the common Open path. Domain: the operations exist and mostly match the ADR, but the blocker defeats the feature's primary promise for any real session.*

---

## Executive Briefing

🔴 **[Blake]** The write validator rejects every context-bearing session — `configuredResource: undefined` throws on write; autosave eats the throw and freezes `current.json`, so a writer silently loses every turn after pinning an excerpt. **Empirically reproduced. Hold the merge.**

🟠 **[Sam]** "New session" is enabled but errors every time in a multi-root or no-workspace window — the UI gate forgot the `persistenceAvailable` check that Save remembered.

🟠 **[Tim]** Opening an uncached session reads + parses **every** file on disk sequentially (~1.5–3s at 150 sessions); the browser list never warms the cache, so this is the normal post-reload case.

🟠 **[Oliver]** The persistence path fails silently — an unnamed-session autosave failure has no UI signal, and the computed degradation reason is discarded before it reaches a log or the writer. This is *why* the blocker is invisible.

🟠 **[Cal]** The tests guarding shutdown-flush and the two-phase write inspect source **text** / mock the archive to empty — they never run the behavior, which is exactly how the blocker reached a green CI.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — A thousand-line validator boarding a house that already exists next door

`WorkshopSessionService.ts` — the class closes at line 1905, but lines 1907–3059 (1,152 lines, ~⅓ of the file, essentially all new) are free-standing, stateless `WorkshopSessionStateV1` validation/clone logic — `cloneWorkshopSessionState`, `assertWorkshopSessionStateShape`, `validatePersistedState`, and ~30 `assert*`/`exactKeys` helpers — none of which touch `this`. The codebase already has the right pattern: `WorkshopPersistedSession.ts` (207 lines) is a dedicated module that decodes the *outer* envelope and imports `parseWorkshopSessionStateV1` *from* this service. The smaller concern earned its own file; the larger, more complex inner one got bolted onto the "pure aggregate, no I/O" class. Extracting to a sibling `WorkshopSessionStateV1.ts` is mechanical and low-risk — the functions have zero dependency on class state.

### 🟢 Nit — Dead `toMessageSummary` overload *(consensus with Parker — see ledger #10)*

A `private` method with four overloads whose 3-arg form has no callers; the implementation carries unreachable `'x' in value` branches to serve a shape nothing passes.

### 🟢 Nit — The composition-root tripwire wasn't extended to the new infrastructure

`boundaries.test.ts`'s `FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION` allowlist doesn't name `WorkshopSessionPersistenceCoordinator` or `WorkshopSessionStore`. No live violation today, but the guard specifically built to catch a handler forking composition-root-owned state won't catch it for the two biggest new infra pieces this PR adds.

> *"Every seam I pressure-tested here held — composition root, ports, message contracts — except one: the aggregate is boarding a thousand-line validator that already has a house of its own right next door."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🔴 Blocking — `configuredResource: undefined` makes the write validator reject every real session

`packages/core/src/application/services/workshop/WorkshopPersistedSession.ts:145` — `cloneConversationJson` runs on the **write** path (in-memory object, no JSON round-trip first) and treats an own property whose value is `undefined` as a hard error. But the conversation archive legitimately carries `configuredResource: undefined`: a writer pins an excerpt → `ConversationManager.appendContextSources`/`cloneContextSources` store `configuredResource: entry.configuredResource ? {…} : undefined` (`ConversationManager.ts:393/610`) → turn commits → `markDirty` → `capture()` → `store.writeCurrent(snapshot)` → `validateSessionForWrite` → `parseWorkshopPersistedSession` → `cloneConversationJson` → `Object.entries` yields `['configuredResource', undefined]` → falls through every branch → **throw**.

The trap is an asymmetry: `JSON.stringify` **drops** undefined keys, so a file that was written before context was pinned reads back fine — but the write-path validator uses `Object.entries`, which surfaces the key, so it throws. **Empirically reproduced**: `Workshop session conversations[0].contextSources[0].configuredResource contains a non-JSON value.`

**Consequence.** For rolling autosave the throw is swallowed in `markDirty`'s catch (`WorkshopSessionPersistenceCoordinator.ts:285-298`) and `writtenRevision` is never advanced, so `current.json` freezes at the last context-free state and **every turn after the first pinned excerpt is silently lost on the next activation**. For named Save, `saveNamed → validateSessionForWrite` throws straight back to the user, who is told the save failed while believing the room was captured. This fires the moment the Workshop is used for its purpose.

**Coverage gap confirmed:** `WorkshopSessionPersistenceCoordinator.test.ts:121` mocks `exportWorkshopConversationArchive` to `[]` and mocks the store; every `contextSources` fixture in the suite is empty; the store test never references `contextSources`; the round-trip test only exercises `parseWorkshopSessionStateV1` (whose field-by-field clone tolerates `undefined`), never the envelope's `cloneConversationJson`.

**Fix:** make `cloneConversationJson` mirror `JSON.stringify` and drop `undefined` object members (or stop emitting explicit `configuredResource: undefined` in `cloneContextSources`), and add a coordinator/store test that captures → writes a conversation whose `contextSources` contains a non-resource source.

> *"This one doesn't page me at 3am — it just quietly eats the writer's session and lets them find out at reload; hold the merge until a context-bearing archive actually survives a real write."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — "New session" is offered but always fails when there's nowhere to write

`WorkshopApp.tsx:673` (+ the ⌘⇧N shortcut at `:226`, the menu prop, the browser-modal footer). "New" used to be a pure in-memory `this.session.reset()`; it now routes through `sessionPersistence.resetSession()` (`WorkshopSessionPersistenceCoordinator.ts:451`), which does `session.reset()` then `store.writeCurrent(promoted)` (`:467`) → `requireAvailability()` throws `WorkshopSessionStoreUnavailableError`; `restoreRollback` undoes the reset and rethrows, so the handler emits `postSessionActionResult('new', false, …)` and the room does not reset. Every New gate checks `!sessionReady || sessionMutationsDisabled` but **not** `persistenceAvailable` — whereas Save correctly adds `!persistenceAvailable` (`:671`) and guards ⌘S (`:218`). Net: a writer in a multi-root workspace (common) or with no folder open sees an enabled New button/shortcut that errors every time — a UI/coordinator contract mismatch and a regression from the old in-memory reset. Fix: gate New on `persistenceAvailable`, or let reset degrade to an in-memory reset when the store is unavailable.

### 🟡 Standard — Content search silently skips the retained conversation archive

`WorkshopSessionStore.ts:835` — `readSessionFileExact` parses the whole envelope including `session.conversations`, but `fullSessionMatches` serializes only `session.workshop`, and `searchTruncated` is measured only against `workshop`. So `session.conversations` is never searched at any size and never sets the truncation signal — yet the modal promises reopening "restores the complete room and continuable conversation memory," and the banner implies deep-transcript is the *sole* omission. MEDIUM because much archive content is redundant with `workshop.turns` (fully searched); the gap bites archive-unique material.

### 🟢 Praise — The two-phase time notice survives the failed-turn edge

`WorkshopSessionTimeService.ts:274` — I went looking for the boundary bug (a resume/hourly notice consumed by a turn that then fails) and it isn't there. `prepareNotice` is read-only; `commitNotice` is called only after `if (assistantTurn)` (`WorkshopHandler` at `diff-integration:595/674`), so a rejected call leaves state untouched and re-sends the same frame (test at `WorkshopHandler.test.ts:285-307`). Hourly boundary inclusive `>=`, skew floored to zero.

> *"I kept poking the empty-workspace corner expecting nothing, and the New-session button lit up like it would work — then quietly refused every single time; that's the trap, hiding behind a gate that forgot to ask whether there's anywhere to write."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — Six validators cloned across three files *(consensus with Stan — see ledger #9)*

`WorkshopSessionStore.ts:971-1012` re-implements `isRecord`, `exactKeys`, `isTimestamp`, `normalizeTimestamp`, `isNonNegativeInteger` — byte-for-byte identical to `WorkshopPersistedSession.ts:46-74` — plus `assertTimezone` duplicating `WorkshopSessionTimeService.ts:83-92`. The sidecar's notion of a valid timestamp/timezone/record can silently drift from the envelope's it's meant to mirror. Pull into a shared `persistedValidation.ts` alongside `pathContainment.ts`.

### 🟡 Standard — Dead `toMessageSummary` overload forces five runtime narrowings

`WorkshopSessionPersistenceCoordinator.ts:712` — three declared overloads, but every call site uses the 2-arg `WorkshopStoredSessionSummary` shape; the first overload has zero callers. Its only effect is that the implementation must name its param `fileNameOrKind` and carry five `'x' in value` narrowings for a shape nothing passes. Delete it and the signature says `(value: WorkshopStoredSessionSummary, kind: 'current' | 'named')`.

### 🟡 Standard — "Sidecar" now names two unrelated things

`WorkshopSessionStore.ts:24` — the pre-existing `WorkshopToolSidecar` is a live AI tool conversation participant (read here as `workshop.participants.toolSidecars`); the new `WorkshopSessionSummarySidecarV1` (`:133`) is a bounded filesystem index. One is a participant, one is a cache. Rename the store's concept to something that says "index file" (`WorkshopSessionSearchIndexV1`/`summaryIndex`).

> *"Nothing here is actually broken, but I read the same six validators three times, chased a dead overload to prove it was dead, and had to double-check which 'sidecar' you meant twice — that's a toll every future reader is going to keep paying."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The sole shutdown-flush test reads source as a string

`apps/vscode-extension/src/__tests__/architecture/providerAssembly.test.ts:126` — the test `fs.readFileSync`s `WorkshopPanelProvider.ts`/`extension.ts` and asserts method-call substrings appear in the right left-to-right order in the raw text. It never instantiates anything or calls `dispose()`/`flush()`. The real handshake — `WorkshopHandler.dispose()` calls `session.abandonRun(...)` before a fire-and-forget `flush()`, backstopped by `deactivate()`'s awaited `flush()` — is exercised by nothing at runtime. The test would stay green if `flush()` were stubbed to a no-op or `abandonRun()` were deleted. It's the only test touching this path in +3,700 lines.

### 🟠 High — The non-transactional snapshot/sidecar pair has no torn-write test

`WorkshopSessionStore.ts:211-212` — `writeCurrent`/`saveNamed`/`updateNamed`/`renameNamed` each do two independent write-temp-then-rename cycles. Each is atomic; the pair is not. If the sidecar rename throws after the primary landed, `current.json` is new while `current.summary.json` is old — and no test drives the `MemoryFileSystem` to fail the second rename (trivial: `.mockResolvedValueOnce(undefined).mockRejectedValueOnce(...)`). Bounded (sidecar is index-only, `list()` flushes first), but a sidecar-path failure leaves a stale browser preview with nothing to catch a regression that makes recovery worse.

### 🟡 Standard — The truncation bounds are never struck exactly

`WorkshopSessionStore.test.ts:349,427` — both source bounds use strict `>` (`names.length > boundedNames.length` at `:511`; `serialized.length > maximumCharacters` at `:838`), so "truncated" is deliberately `false` at the limit. Every test uses values either enormous (200/250,000, never approached) or absurdly tiny (1 vs 2 files; 10 chars vs a multi-KB transcript) — never equal to the bound. Flipping `>` to `>=` wouldn't fail the suite, so the exact off-by-one everyone eventually trips over is unpinned.

> *"Nearly 3,700 lines of new tests, and the one standing between a writer and a lost session on shutdown just checks that two strings appear in the right order in a source file — that's not confidence, that's cosplay."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — Validators duplicated instead of imported from the sibling already open *(consensus with Parker — ledger #9)*

`WorkshopSessionStore.ts:971-1005` redeclares five helpers character-for-character (error strings included) from `WorkshopPersistedSession.ts:46-80` — the exact file the store **already imports** from at `:14-18`. One PR shipping a validation module twice instead of adding five names to an import it already has open.

### 🟡 Standard — "Ordered autosave" reinvents the sibling `serialize()` queue, twice

`WorkshopConversationSettingsService.ts:50/295` is the established idiom: one `private queue: Promise<void>` field + one `serialize<T>()` helper (`queue = result.then(ok, ok); return result`). The coordinator reinvents that tail-chaining shape twice under different names — `runSessionOperation()` (`:762-776`) is a beat-for-beat copy with two extra `Promise.all` barriers, and `writeQueue` (`:105`) adds a genuinely new `dirtyRevision`/`writtenRevision` staleness-skip but under a name a reviewer who knows `serialize()` won't recognize.

### 🟢 Nit — `node:`-prefixed imports disagree with the same PR's other new file

`WorkshopSessionPersistenceCoordinator.ts:9-10` uses `node:crypto`/`node:path`; all 13 existing core imports — including this feature's `pathContainment.ts:11` and the PR's own `WorkshopSessionStore.ts:11` — use the bare specifier. No `import/order` rule is configured, so "lint 0 errors" won't catch two files from one PR disagreeing.

> *"WorkshopSessionStore.ts imports from WorkshopPersistedSession.ts on line 14 and then, fifty lines later, reinvents five of that file's private functions from memory — we don't even have to leave the PR to find the sibling doing it right this time."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟠 High — Opening an uncached session scans and fully parses every file on disk

`WorkshopSessionStore.ts:446` — `findNamedSession` (used by `openNamed`, `renameNamed`, `duplicateNamed`, `deleteNamed`, `resolveRevealPath`) only skips the scan on a `namedSessionPaths` cache hit, and that cache is populated **only** by prior CRUD ops this host lifetime — `readNamedBrowserSessions` (the browse path) never calls `rememberNamedSessionPath`, so browsing doesn't warm it. On a cold cache (any window reload, extension update, fresh start), `readNamedSessions` loops every named file sequentially with `await` inside the loop, parses each fully via `readSessionFileExact` (no `maximumFiles`, no byte cap), and never returns early even when the match is found first. At n=150 that's ~150 sequential read+parse round trips (~1.5–3s) to open even the newest session. The sidecar framing bounds **listing**, not **opening** — the commoner click.

### 🟡 Standard — Autosave rewrites (and pretty-prints) the entire unbounded history every commit

`WorkshopSessionService.ts:1493` / `WorkshopSessionStore.ts:709` — `markDirty` fires at ~19 handler sites; `capture()` exports the **complete** unwindowed `turns` array (not the `WORKSHOP_SNAPSHOT_TURN_WINDOW = 100` the webview uses), and `writeCurrent` full-`JSON.stringify(value, undefined, 2)`s it + the provider archive, whole, every time. O(*k*) at turn *k* → O(*n²*) cumulative; ~135 MB written over a 300-turn session that ends ~900 KB. Properly serialized (no corruption) and ADR-accepted for v1 — invisible at dozens of turns, real at hundreds.

### 🟡 Standard — Content search stringifies the whole session before its own bound

`WorkshopSessionStore.ts:835` — `fullSessionMatches` serializes the entire `session.workshop` and *then* slices to `maximumSearchCharacters` (250 K); the bound protects the scan, not the stringify. Per non-metadata-match file, sequential, up to 200 candidates. Client search is debounced 220 ms and stale responses discarded by `requestId` (Rule-A checked) — but nothing cancels the in-flight **host-side** scan when a newer query supersedes it, against the ADR's stated "cancellable" goal.

> *"Sidecars bound what you can list, not what it costs to open something you haven't touched yet or to search for a word nobody's title contains — and current.json still eats a full unbounded rewrite on every single turn; none of it hurts at ten sessions, all of it will at three hundred."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Praise — Root pinning is real — every path op funnels through one guarded chokepoint

`WorkshopSessionStore.ts:726` — I went looking for the escape hatch and couldn't find one. Every filesystem path built from a variable segment — save, `updateNamed`, `readNamed`, rename, duplicate, delete, sidecar write/delete, reveal — routes through `namedPath()` (`:721-730`), which applies `isPathWithinRoot` before the path touches the FileSystem port. Filenames are minted from `titleSlug()` (`:843`, collapses to `[a-z0-9-]`, so `../../.ssh/authorized_keys` becomes `ssh-authorized-keys`) + a UTC timestamp — never raw `sessionId`/`title`. The webview `sessionId` is only ever a lookup key. `resolveRevealPath` returns a store-resolved contained path handed to VS Code as `vscode.Uri.file()` — structured, not a shell string. Prototype pollution is foreclosed by `exactKeys` + `Object.fromEntries` define-semantics. This is the boundary discipline PR-59/61 asked for, applied consistently.

### 🟡 Standard — Unpublished prose + full transcripts land in a workspace path with no default git-ignore

`docs/adr/2026-07-14-workshop-session-persistence.md:64` — session envelopes hold the full excerpt (the writer's unpublished manuscript) and complete host/guest/tool archives at `prose-minion/sessions/*.json` under the workspace root (`WorkshopSessionStore.ts:194`); no repo `.gitignore` covers it (searched `git ls-files` + the whole diff — not found). The ADR makes it a deliberate "committable or `.gitignore`-able" stance, so it's a judgment call — but the attack vector is mundane and real: a background autosave creates tracked files the writer never chose to create, and one `git add -A && commit && push` silently publishes unpublished work + AI transcripts. Cheap, philosophy-preserving mitigation: write `prose-minion/sessions/.gitignore` containing `*` on first directory creation (opt-out, not opt-in).

### 🟢 Nit — Unbounded exact read + uncapped clone depth → OOM on a hostile file from a shared workspace

`WorkshopSessionStore.ts:587` — `readSessionFileExact` is deliberately unbounded and `cloneConversationJson` recurses with no depth guard; activation `readCurrent()`s `current.json` before providers are exposed. A workspace can be git-cloned, Live-Shared, dev-container-mounted, or settings-synced — a crafted multi-GB or pathologically deep file OOMs/stack-overflows the host on activation. Parse errors are already caught and degrade to "autosave paused," so only an allocation-blowing flat file escapes. Cap the exact read at a generous ceiling (64–128 MB, well above the 5 MB browser bound) to close the door without breaking large legit saves.

> *"The traversal doors are bolted and the parser frisks every field — so the breach here won't be an exploit, it'll be a writer's `git push` quietly carrying a folder of unpublished prose the tool never offered to ignore."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — The degradation reason is computed, then discarded before it reaches a human

`WorkshopSessionPersistenceCoordinator.ts:604` — `AssistantToolService.importWorkshopConversationArchive` (`:776-793`) builds a genuinely specific `reason` per degraded participant ("Current system prompt could not be rebuilt: <error>", "Archived tool name X does not match Y", "Conversation X was not imported"). `hydrate()` pulls only `outcome.key`; `outcome.reason` never leaves the function. The log line (`:626`) and the webview payload (`WorkshopHandler.ts:1043`) both carry keys only. So when a guest comes back "restored without retained memory" (`WorkshopHandler.ts:2150`), neither the Output Channel nor the UI can say whether the archive was corrupt, a persona id no longer resolves, or prompt rebuild threw — despite that exact sentence existing one function call away.

### 🟠 High — Rolling autosave failures for the default (unnamed) session are logged once and then invisible

`WorkshopHandler.ts:2510-2511` — an ordinary autosave failure (disk full, revoked permission, sync lock) lands in `markDirty`'s catch (`coordinator.ts:292-294`) and is only `appendLine`'d; `currentCheckpointError` is untouched, so `isCurrentCheckpointProtected()` stays false, and `emitNamedSaveStatus(..., 'error')` fires only `if (namedSessionId)` — i.e. only after an explicit Save As. The webview's save-status pixel is gated identically (`WorkshopApp.tsx:565-568`). A writer who never hits Save As — the common path — gets zero live signal that `current.json` stopped updating and keeps working against a stale checkpoint until `deactivate()`'s `flush()` succeeds or fails into the same log-only sink. **This is the silent sink that hides Blake's blocker.**

### 🟡 Standard — Autosave log lines never carry the session identity

`WorkshopSessionPersistenceCoordinator.ts:293` — both the success (`:280`) and failure lines interpolate a lifetime-monotonic `revision` (never reset on New, though `resetSession` mints a fresh `sessionId`) and a static per-call-site `reason`, but never `this.identity.sessionId` (in scope at `:268`), title, or path. OutputChannel entries aren't timestamped either, so after a couple of opens/renames a given failure can't be attributed to a session without guesswork. One interpolation fixes it.

> *"The reason string gets computed, handed to the coordinator, and buried before it reaches a human — that's not local visible degradation, that's a séance."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — "Does not parse every saved transcript" is contradicted by the cache-hit autosave path

The ADR's Implementation-outcome section states: *"…ordinary per-turn autosave therefore does not rescan and parse every saved transcript."* The sprint doc (Task 5) and memory-bank note repeat it. Traced: every committed turn in a named room → `markDirty` → `store.updateNamed(namedSessionId, snapshot)` (`coordinator.ts:609-613`) → `requireNamedSession` → `findNamedSession`. On a cache **hit** — the exact case the caching was built for — `findNamedSession` still does a full `readFile` + `JSON.parse` + complete `parseWorkshopPersistedSession` validation of the *existing* file (`WorkshopSessionStore.ts:366`) purely to string-compare `session.sessionId`, then `updateNamed` discards that parsed session entirely before overwriting. The cache avoids the O(n) *directory* scan, not the per-turn full-file re-parse — and no read-count assertion pins the claim, so it shipped untested.

### 🟢 Nit — New/Open confirm unconditionally though the ADR implies a condition

ADR §7: *"Opening or deleting/replacing the current session confirms when unsaved committed changes would be displaced."* `startNewSession`/`openStoredSession` (`WorkshopApp.tsx:406-408`) set `sessionConfirm` with no check against turn count or a dirty flag, so a brand-new zero-turn Workshop still pops "Start a new session?" Given continuous autosave there may never be truly "unsaved" committed work — so always-confirm could be the deliberate simpler choice. Confirm intent: was the conditional gate dropped, or was "always confirm" the real intent?

> *"The docs swear the cache means per-turn autosave never re-reads your transcript — the code reads the whole thing anyway, one line before it overwrites it. Probably fine. Probably."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Silent Sink: A Caught Error Still Has to Go Somewhere

Illuminated by: Blake, Oliver #1 & #2

A failure that is caught but never surfaced has not been handled — it has been hidden. The blocking freeze was dangerous not because a write threw, but because something downstream quietly ate the throw, so the writer kept typing over a checkpoint that had stopped moving. Across three findings it's one gesture repeated — the write swallows its exception, the autosave swallows its failure, the hydration swallows the very reason it degraded — each converting something the system *knew* into something only the logs remember.

→ Carry forward: For every `catch`, ask one question before you move on — *who finds out?* Trace the error to a signal a human will actually meet, or make the silence deliberate and documented. A smoke detector that logs the fire to a file no one opens is just expensive wallpaper.

### Lesson 2 — The Round Trip Must Close: What You Write Is Not What You Validate

Illuminated by: Blake, Cal #2

Persistence is not a mirror; it is a transform, and the transform has opinions. `JSON.stringify` silently drops `undefined`, so the shape you hand to disk was never the shape your write-path validator inspected — it rejected a value the reader would never even see. When the write grammar and the read grammar disagree, one of them is lying, and you learn which only when a real user — the writer pinning her first excerpt — steps into the gap.

→ Carry forward: For every serialize/deserialize pair, write one property test that sends an awkward value round-trip — `undefined`, null, empty, a nested optional that resolves to nothing — and asserts what comes back is what you meant. If a validator guards the write, run it on the bytes that will actually be read: measure the board after the saw, because the blade has a width.

### Lesson 3 — A Test Must Be Able to Fail: Green Means Nothing If Red Was Impossible

Illuminated by: Cal #1 & #3, Blake (empty-archive fixtures)

A test earns its green only if some believable break would have turned it red. The flush test that checks for substrings in source order never built the object and never called `dispose` — it would pass unchanged if `flush` became a no-op, which means it was never watching `flush` at all. The same absence wears other costumes: a boundary never struck exactly, so `>` and `>=` look identical to the suite; a fixture so tidy the dangerous value literally cannot occur. A thousand green tests, and the central use case still broke — because coverage counts lines visited, not behaviors held down.

→ Carry forward: For each test, name the single bug it would catch — the exact mutation that flips it red. If you can't, or the honest answer is "a typo in a string literal," you've written a comment wearing a green checkmark.

### Lesson 4 — One Fact, One Home: Knowledge Copied Is Knowledge That Drifts

Illuminated by: Parker + Stan, Stan (queue idiom), Marcus, Bria

DRY was never about text; it's about knowledge — the same fact should have one home. When a truth lives in two places — a helper, a queuing idiom, a line in an ADR, an id you already hold in memory — the copies don't stay faithful; they drift, invisibly, until the day they contradict each other. The sharpest instance: a store that imports from the very file it also copies five helpers out of, so tightening one copy quietly abandons its twin.

→ Carry forward: When you're about to write what already exists, stop and import it instead of retyping it. And when a document claims what the running code does — "does not parse every transcript" — pin the sentence with a test, or admit you've written fiction with good intentions.

### Lesson 5 — Put the Rule at the Gate Everyone Walks Through

Illuminated by: Sam, Patricia (both sides)

A precondition enforced by hand on every path is one that will be forgotten on a path — and the sibling that remembered makes the omission look deliberate, which is exactly how it slips through review. The panel handed you the wound and the cure in one breath: the New/Save asymmetry is a rule scattered and dropped, while the lone `isPathWithinRoot` every path funnels through is that rule given one home — and the reason prototype pollution never got to be a story.

→ Carry forward: When you add a guard, don't ask "does this path check the rule?" — ask "what is the one place every path needing this rule passes through, and can the rule live only there?" A precondition that has to be remembered is already half-forgotten.

> *"A codebase never lies on purpose — it drifts into untruth one swallowed error, one test that cannot fail, one sentence the code stopped honoring at a time; keeping it honest is not a talent you have, it is a practice you keep."* — Sensei

---

## The Closer

### 🎋 Haiku

*The feature is a spring; the bug, the weather that spring didn't plan for; the author, a monk who'll walk this trail again.*

> Excerpt pinned at dawn —
> the autosave well swallows;
> reload finds bare snow.

---

## Summary

This is strong, careful engineering with **one blocker that must be fixed before merge**: the write-path validator (`cloneConversationJson`) throws on the `configuredResource: undefined` that every context-bearing session legitimately produces, and the autosave failure path swallows it silently — so a writer loses every turn after pinning an excerpt, which is the feature's entire reason to exist. It's empirically reproduced, one-line-fixable, and slipped through 1,170 tests only because the suite mocked the conversation archive to empty. Fix the validator (mirror `JSON.stringify`'s drop-undefined), then add a context-bearing capture→write test.

Beyond the blocker, the high-severity work clusters cleanly: **surface the silent failures** (Oliver — unnamed autosave errors and degradation reasons need to reach the writer, not just the log), **fix the New-session gate** (Sam — check `persistenceAvailable` like Save does), **bound the cold Open path** (Tim — don't parse every file to open one), and **make the shutdown/write-integrity tests actually run the behavior** (Cal). The structural High (Marcus — extract the 1,152-line validator to its own module) and the consensus Standards (duplicated validators, dead overload) are low-risk cleanups that will pay compounding interest. Security posture is genuinely good — root pinning and pollution defense are real — with one worth-doing privacy default (a safe-by-default `.gitignore` for the manuscript folder).

**Verdict: not merge-ready — hold for the blocker.** Once the validator round-trips a real context-bearing archive and the silent sinks grow a voice, this is a well-built persistence layer that will serve long, resumable sessions well. The bones are right; one load-bearing wall needs the guard moved closer to where the writing actually happens.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
