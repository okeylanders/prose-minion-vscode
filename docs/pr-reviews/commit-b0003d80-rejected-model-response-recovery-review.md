# Commit Review — Recover rejected model responses

**Author:** Okey Landers · **Commit:** `b0003d80` on `sprint/conversation-widgets-02d-widget-persistence-grammar`
**Reviewed:** 2026-08-08 (America/Chicago) · **Mode:** Full panel (10 reviewers + Sensei) · **Parent:** `1094b1bb` (single parent)
**Scope:** Two untracked review markdown files in `docs/pr-reviews/` are excluded from review. No merge commit, no dirty tracked files; all files read at `HEAD`.
**Additional brief:** the author asked the panel to assess whether the design is sound and extensible for a future "attempt auto recovery" button that hands the rejected/malformed JSON to a cheap model (Luna/Haiku) to repair with no surrounding context.

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= praise, out of scope, or superseded.

| ID | Sev | Finding | Reviewers | Consensus | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | `generateMore` discards a truncated-but-valid menu behind a new `finishReason === 'length'` guard | Blake | — (orchestrator-verified) | **Addressed** — parse/validate first; valid truncated menus remain usable. |
| F-02 | 🟠 High | Orphaned `.tmp` holding the full paid body when `rename` fails; no cleanup, unlike both siblings | Blake, Stan, Cal | 🎯🎯 Strong | **Addressed** — every atomic write deletes its temp on failure before fallback. |
| F-03 | 🟠 High | `providerResponseId` never reaches a log line — survives only in the metadata sidecar | Oliver | — | **Addressed** — all recovery/fallback logs carry the provider id. |
| F-04 | 🟠 High | Truncation branch in `generateMenu` overwrites the `menuError` carrying the recovery file path | Sam | — (orchestrator-verified) | **Addressed** — ceiling guidance appends rather than replaces the recovery notice. |
| F-05 | 🟠 High | `captureRejectedResponse()` copy-pasted verbatim into both widget services | Parker | — | **Addressed** — shared persistence/presentation helper owns receipt mapping. |
| F-06 | 🟠 High | Total-failure path (`capture()` → `undefined`) has zero coverage at either layer | Cal | — | **Addressed** — store and widget degradation paths are covered. |
| F-07 | 🟠 High | Service lives in `application/services/` but has the shape/deps of an `infrastructure/storage` adapter | Marcus | — | **Addressed** — moved to `infrastructure/storage` and split from presentation. |
| F-08 | 🟡 Standard | Blind `workspaceFolders()[0]`; siblings model `no-workspace`/`multi-root` explicitly | Blake, Stan, Sam | 🎯🎯 Strong | **Addressed** — multi-root explicitly uses extension storage. |
| F-09 | 🟡 Standard | Bare `catch {}` around `stat` reinvents the shared `isMissingFileSystemPathError` helper | Stan, Oliver | 🎯 | **Addressed** — uses the shared error classifier. |
| F-10 | 🟡 Standard | No cap, rotation, or pruning on the recovery directory | Tim, Patricia | 🎯 | **Deferred** — tracked in `.todo/tech-debt/2026-08-08-recovery-artifact-retention-and-auto-repair-guardrails.md`. |
| F-11 | 🟡 Standard | Helper returns a pre-punctuated sentence fragment; one call site must `.trim()` it | Parker, Bria | 🎯 | **Addressed** — notice is an independently punctuated sentence. |
| F-12 | 🟡 Standard | `present()` fused into `capture()` — no persist-only seam for a webview repair button | Marcus | — | **Addressed** — store and presenter are separate public seams. |
| F-13 | 🟡 Standard | `.response.txt` names a body that is almost always JSON; envelope has no content-type signal | Parker | — | **Addressed** — sidecar carries raw and intended content types; text extension is documented. |
| F-14 | 🟡 Standard | `toolName` is a bare `string` across four literals; no registry for validator lookup | Bria | — | **Addressed** — a typed four-tool contract registry is persisted. |
| F-15 | 🟡 Standard | Envelope persists no original prompt and no validator/schema identity | Bria | — | **Addressed** — static protocol/schema identity is persisted without duplicating manuscript prompts. |
| F-16 | 🟡 Standard | No content hash — a future repair flow can't verify the body it re-transmits | Patricia | — | **Deferred** — tracked with automatic-repair guardrails. |
| F-17 | 🟡 Standard | Test filesystem fake doesn't enforce `rename(..., {overwrite:false})` | Cal | — | **Addressed** — fake and collision test now refuse replacement. |
| F-18 | 🟡 Standard | No size bound on the captured body before it becomes a second call's token payload | Tim | — | **Deferred** — tracked with automatic-repair guardrails. |
| F-19 | 🔵 Nit | One call site produces a run-on sentence (missing terminal punctuation) | Bria | — | **Addressed** — each caller builds complete sentences. |
| F-20 | 🔵 Nit | `flushPresentation()`'s single `setImmediate` is an undocumented contract with `present()` | Cal | — | **Addressed** — the test documents the host-fake scheduling contract. |
| F-21 | 🔵 Nit | Disk write awaited on the failure path while `present()` is fire-and-forget | Tim | — | **Deferred** — correct at current failure-path volume; revisit with auto-repair. |
| P-01 | 💚 Praise | `toolName` → filename path-traversal vector correctly closed by the sanitizer | Patricia | — | N/A — preserve |
| P-02 | 💚 Praise | Per-branch fallback logging; body committed before sidecar so diagnostics never cost the artifact | Oliver | — | N/A — preserve |

---

## Blast Radius

- 17 files changed · +713 / −39 lines
- New files: 3 (service, its test, the ADR) · Migrations: no · New services: 1
- One new Platform port method (`ShellService.showWarningMessage`), one new field pair on `ExecutionResult` (`providerResponseId`, `modelId`), and a new provider-generation-id capture path in `OpenRouterClient`

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | B− |
| 🧪 Tests | C |
| 📖 Quality | C |
| ⚡ Performance | B− |
| 🎯 Domain | B− |

---

## Executive Briefing

🟠 **[Blake]** `generateMore` now discards truncated-but-valid additions — a new `finishReason === 'length'` guard throws before parsing, so a length-truncated menu that parses cleanly and has new options is binned. The sibling `generateMenu` path does the opposite and has a test proving it. A commit meant to stop discarding paid output now discards paid *usable* output.

🟠 **[Blake · Stan · Cal]** 🎯🎯 **Strong Consensus** — Orphaned `.tmp` on rename failure. No try/catch around the temp write+rename, so a failed `rename` leaves the full paid body as an orphaned `.tmp` in the user's project *and* writes a second complete copy to fallback storage. Both `WorkshopSessionStore` and `LexicalGravityLensRepository` clean up.

🟠 **[Oliver]** `providerResponseId` never reaches a log line — it survives only in the metadata sidecar. If both writes fail, the Output channel a user pastes into a bug report has no trace of which generation was lost. That is the exact failure the ADR was written to prevent recurring.

🟠 **[Sam]** The truncation branch in `generateMenu` overwrites the `menuError` that contains the recovery file path with a generic ceiling message. The artifact is saved; the in-widget pointer to it is thrown away. The existing test only asserts the ceiling wording, so it regressed silently.

🟠 **[Parker]** `captureRejectedResponse()` is copy-pasted character-for-character into both widget services, including the exact English of two user-facing sentences. Duplicated knowledge, not duplicated text.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — Recovery service has the shape of an `infrastructure/storage` adapter but lives in `application/services/` [F-07]

`packages/core/src/application/services/RejectedModelResponseRecoveryService.ts:53` — The only other top-level file in `application/services/` is `StandardsComparisonService.ts`, pure orchestration with no platform ports. This one takes `FileSystem`, `Workspace`, and `ShellService` and does exactly what the `infrastructure/storage` siblings do: temp-then-rename writes, project-vs-fallback directory policy, `.gitignore`-on-first-write. Its two consumers already live in `infrastructure/api/services/widgets/`. A peer-to-peer infrastructure dependency — `infrastructure/storage/RejectedModelResponseRecoveryStore.ts` — is the natural shape, matching how `LexicalGravityLensRepository` is consumed today.

### 🟡 Standard — `present()` is fused into `capture()`, foreclosing a webview repair path [F-12]

`RejectedModelResponseRecoveryService.ts:148` — `capture()` is the port's only public method and it unconditionally fires a VS Code notification and opens an editor tab. The stated next step is a repair button *in the Workshop webview*. As written, any future caller — including an automated repair attempt re-reading the artifact — gets the same notification and forced editor-open, with no persist-only seam. Splitting persistence from presentation, or injecting presentation as a strategy, is the small change that unblocks it.

> *"This class writes temp files, renames them, and manages a `.gitignore` — that's `infrastructure/storage` cosplaying as `application/services`."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟠 High — `generateMore` discards a truncated-but-valid menu [F-01]

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:185` — This guard did not exist before this commit. Trace it: the model returns a length-truncated response whose menu JSON still parses, headings match, and it contains new options. Pre-commit that returned `{ cancelled: false, additions }`. Post-commit it throws before `extractStandaloneMenu` ever runs. The sibling path in the same class does the opposite and has an explicit test — `GesturePlaygroundService.test.ts:516`, *"marks a complete framed response truncated without discarding its valid menu."* No test covers `generateMore` with `finishReason: 'length'`. Parse first, then let truncation degrade the result the way `generateMenu` does.

*Orchestrator note: confirmed independently — the guard is new in the diff, and the sibling test asserts the opposite contract.*

### 🟠 High — `.tmp` leaks the full paid body when `rename` fails [F-02] 🎯🎯 Strong Consensus

`RejectedModelResponseRecoveryService.ts:132` — Searched the diff for cleanup around the temp write — not found; there is no try/catch here at all. `writeFile` succeeds (the port auto-creates parents), `rename` throws (locked target on Windows, permission change between calls, adapter EPERM). `captureInDirectory` rejects, `capture` logs "Project recovery failed; trying extension storage", and writes a **second** complete copy of the same prose elsewhere. The orphan is never deleted, never surfaced in the receipt, and if `ensureProjectRecoveryIgnored` also failed — which is deliberately swallowed — it isn't gitignored either. Same exposure on the metadata temp at line 137.

### 🟡 Standard — Blind `workspaceFolders()[0]` in a multi-root workspace [F-08] 🎯🎯 Strong Consensus

`RejectedModelResponseRecoveryService.ts:68` — The two other things that write under `prose-minion/` refuse this outright: `LexicalGravityLensRepository.availability()` throws on `folders.length !== 1`, and `WorkshopSessionStore` has the identical guard. Here a writer with two roots open gets the full body of a failed generation deposited into whichever folder VS Code orders first — possibly a different git repo. Not corruption, and `[0]` has precedent in `UIHandler`, so not blocking; but for a durable write of sensitive prose the established convention is to detect multi-root and fall through to extension storage.

> *"You built a vault for paid responses and then left a copy of the body outside the door — twice."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — The truncation branch throws away the recovery pointer it was just handed [F-04]

`GesturePlaygroundService.ts:132` — Walked end to end: when `finishReason === 'length'` and the dictionary parses but the menu doesn't, `parseCompositeResponse`'s second catch runs, calls `captureRejectedResponse`, and builds a `menuError` containing the exact saved `filePath`. Back in `generateMenu`, because `truncated && !parsed.menu` is true, that carefully-built message is discarded and replaced with a generic ceiling string that never mentions the file. The disk write and the toast still happen — but the in-widget error text, the one the writer actually reads next to the failed generation, loses the pointer to the artifact the whole feature exists to produce. The existing test at `GesturePlaygroundService.test.ts:483` asserts only `'50,000-token output ceiling'`, so this regressed with a green suite.

*Orchestrator note: verified — the overwrite at line 132 is pre-existing code, but its interaction with the new capture is introduced by this commit.*

### 🟡 Standard — Multi-root silently resolves to folder zero [F-08]

Same root as Blake F-08 and Stan F-08. Searched the diff for "multi-root" — not found; the tests only ever construct single-folder workspaces.

> *"What if the workspace has two folders, though? This one just grabs the first one and hopes you were writing in that project."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟠 High — `captureRejectedResponse()` is copy-pasted verbatim between two services [F-05]

`GesturePlaygroundService.ts:368` and `LexicalGravityModelService.ts:253` are character-for-character identical: same parameters, same `capture(...)` call, same two-branch sentence-fragment return. That's duplicated *knowledge* — the exact English of a user-facing recovery message and the receipt-to-message mapping. Nothing in it is widget-specific. It belongs on the recovery service itself (a `captureAndDescribe()` returning receipt plus formatted sentence) or as a shared free function.

### 🟡 Standard — A helper returning a pre-punctuated fragment forces `.trim()` gymnastics [F-11]

`GesturePlaygroundService.ts:362` — The helper always returns a string with a leading space and trailing period, glued onto a preceding sentence at three call sites. The fourth needs it to *lead* a sentence, so it calls `.trim()` to undo the formatting the method itself added. Return the receipt and let each call site build its own sentence.

### 🟡 Standard — `.response.txt` names a body that is usually JSON [F-13]

`RejectedModelResponseRecoveryService.ts:114` — Both callers reject structured JSON; the ADR's motivating incident is one malformed JSON token. The envelope carries no content-type signal, so the future repair action must re-derive "this is JSON" from `toolName` conventions. A `.txt` extension is defensible if the intent is "may not be valid anything, don't overclaim" — but then say so in a comment next to the constant.

> *"I found the same fourteen lines twice, word for word — next time this message needs a tweak, someone's going to fix one copy and ship the other stale."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The total-failure path has zero coverage at either layer [F-06]

`RejectedModelResponseRecoveryService.ts:93` — Searched all three test files for a `capture` that resolves `undefined` — not found. The four service tests cover project-success, extension-only, project-fails-fallback-succeeds, and sidecar-fails. None fails *both* locations, so `return undefined` is never exercised. And real user-facing behavior is gated on it: both consumers branch to `' The complete response could not be saved; see the Prose Minion output for details.'`. Both consumer suites stub `capture` with an unconditional `mockResolvedValue`, so a paid response that saves nowhere degrades to that string with nothing proving it.

### 🟡 Standard — The filesystem fake doesn't enforce `{overwrite:false}` [F-17]

`RejectedModelResponseRecoveryService.test.ts:18` — The sibling fake in `WorkshopSessionStore.test.ts` throws `EEXIST` on a collision with `overwrite:false` and exposes an injectable `failRenameToPath`. This one unconditionally overwrites regardless of the flag, so a real collision can't be simulated — which is precisely why the orphaned-temp bug above has no failing test.

### 🔵 Nit — `flushPresentation()` is an undocumented contract with `present()` [F-20]

`RejectedModelResponseRecoveryService.test.ts:50` — One `setImmediate` reliably flushes both awaits today because Node drains microtasks first. Correct, but implicit: add a third await to `present()`, or a mock backed by real async I/O, and this stops working with no signal beyond a flaky-looking miss. A one-line comment on *why* one tick suffices saves the next person an evening.

> *"Four tests, four names, and not one of them asks 'what if it fails everywhere?' — that's the test I'd actually want at 2am."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟠 High — Orphaned temp file, unlike both siblings [F-02] 🎯🎯 Strong Consensus

`WorkshopSessionStore.writeJsonAtomically` and `LexicalGravityLensRepository.saveForQuery` both wrap write+rename in `try { … } catch { await delete(temp); throw; }`. `captureInDirectory` (`RejectedModelResponseRecoveryService.ts:132`) has no such wrapper. Given this ADR's whole premise is "the paid artifact must not be lost," an orphaned partial `.tmp` sitting next to the real recovery attempts is exactly the failure mode the sibling pattern exists to prevent.

### 🟡 Standard — Takes folder `[0]` instead of modeling multi-root [F-08]

`WorkshopSessionStore` has `resolveAvailability()` returning `{ available: false, reason: 'multi-root' }` and a dedicated `WorkshopSessionStoreUnavailableError`. This is the one place the established sibling explicitly refuses to guess.

### 🟡 Standard — Bare `catch {}` reinvents a helper both siblings import [F-09] 🎯 Consensus

`RejectedModelResponseRecoveryService.ts:152` — `WorkshopSessionStore.fileExists` and `LexicalGravityLensRepository` route existence checks through `isMissingFileSystemPathError` in `infrastructure/storage/fileSystemErrors.ts`. The bare catch treats every `stat` failure as "doesn't exist yet." Low blast radius since the caller tolerates this method failing, but it's the one spot in the diff that reinvents a check the codebase already centralized.

> *"We have two sibling classes that delete the temp file on failure before rethrowing — this one just walks away and leaves the `.tmp` on the floor."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — No cap, rotation, or pruning on the recovery directory [F-10] 🎯 Consensus

`RejectedModelResponseRecoveryService.ts:132` — Searched for any size or count limit — not found. Every rejection writes two files; nothing ever deletes one. The sibling one directory over enforces `maximumFiles: 200` / `maximumFileBytes: 5MB` via a frozen limits object. At today's volume — desktop extension, failure-only path — growth is glacial; the 18KB motivating case would need thousands of failures to matter. Not an incident. It *is* an inconsistency with the one convention this repo already established for this exact problem, cheap to close now and mildly annoying to retrofit once support workflows depend on "the recovery folder has everything."

### 🟡 Standard — No size bound on the captured body [F-18]

`RejectedModelResponseRecoveryService.ts:130` — The envelope records `responseCharacters` but nothing caps `rawResponse`; `WorkshopSessionStore` throws before writing past its limit. Irrelevant for this commit — 18,348 chars ≈ 4.6K tokens, trivial to write and trivial to resend. It matters for the next step: at that point this file's contents become the literal token payload of a second billed call, and nothing today stops a runaway generation producing a body an order of magnitude larger, silently, before that button exists to notice it.

### 🔵 Nit — The disk write is awaited on the failure path [F-21]

`GesturePlaygroundService.ts:333` — Four awaited FS calls before the error is thrown. Low single-digit milliseconds on an already-failed request — not a latency problem. Worth noting only because the service models the asymmetry correctly elsewhere: `present()` (the genuinely slow part, user I/O) is fire-and-forget, the write isn't. Right call today; revisit if two capture sites ever fire in one request path.

> *"Four filesystem writes and no eviction policy — fine as a trickle, but 'fine as a trickle' is exactly what every unbounded directory says right up until support asks why the recovery folder is 4GB."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟡 Standard — No retention policy on artifacts containing unpublished prose [F-10] 🎯 Consensus

`RejectedModelResponseRecoveryService.ts:107` — Searched for pruning/expiry/limits — not found. The threat isn't multi-tenant leakage, it's retention hygiene: this directory is exactly what ends up in a laptop backup, a cloud-synced project folder, or a zipped project export. There is an untracked `Prose Minion.zip` in this repo's root right now — a plausible real path for these files to leave the machine unnoticed. Fast follow-up, not a blocker; worth a `.todo/tech-debt/` entry since the sibling convention already models the fix.

### 🟡 Standard — No integrity binding for a future re-transmit-to-a-second-model flow [F-16]

`RejectedModelResponseRecoveryService.ts:26` — Forward-looking, not a bug in shipped code. Nothing in `RejectedModelResponseEnvelopeV1` lets a future repair action verify the body it's about to re-transmit is the one that was quarantined — no content hash — and the ADR deliberately makes the file "immediately editable," so a user or another local process can change it between quarantine and repair with no detection. Low stakes for a local single-writer tool. Worth closing before "repair" becomes an automatic send-to-provider action rather than a human-reviewed paste.

### 💚 Praise — The `toolName` → filename traversal vector is correctly closed [P-01]

`RejectedModelResponseRecoveryService.ts:194` — Traced `toolName` from both live call sites: hardcoded literals, never user- or model-derived. Even if that changed, `fileSegment()` strips everything outside `[a-z0-9]` before `path.join`, so `../`, `/`, and null bytes can't survive. `storageDirectory` is host-constructed. The containment check the brief asked about turns out not to be missing anything real.

> *"The traversal door is welded shut — it's the retention shelf that's overflowing."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — `providerResponseId` never reaches a log line, only the JSON sidecar [F-03]

`RejectedModelResponseRecoveryService.ts:145` — Searched the diff for `providerResponseId` inside any `appendLine` — not found. Every log line here carries `filePath`/`toolName`/error text; none carries the generation id. That id survives only if the sidecar write succeeds. If both storage attempts fail, the Output channel — the one artifact a user pastes into a bug report — records "Failed to save X response: `<error>`" with zero trace of which OpenRouter generation this was. The ADR's own motivating incident was *"the provider generation id had already been discarded."* One interpolation on the success and failure lines closes it.

### 🟡 Standard — Bare catch makes permission-denied indistinguishable from file-absent [F-09] 🎯 Consensus

`RejectedModelResponseRecoveryService.ts:152` — Not a total blackout: a subsequent permission-denied `writeFile` bubbles to the outer catch and gets logged. But the log will say "Could not create the project recovery .gitignore: EACCES" with no indication it started from an ambiguous `stat`, which is one extra inferential hop at 2am.

### 💚 Praise — The failure-path logging is genuinely load-bearing [P-02]

Every fallback branch in `capture()` — gitignore failure, project-write failure, extension-write failure, sidecar failure — gets its own distinct, correctly-worded line before falling through, and the body is committed via temp+rename *before* the sidecar is attempted. The thing that cost money survives even when the diagnostics around it don't, and each swallow is visible rather than silent. Real progress over "the only durable diagnostic retained the first and last 4,000 characters."

> *"The file survives the crash. The provider ID that would prove which crash it was does not — check the sidecar, hope it wrote."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — `toolName` is a free-floating string, not a registry [F-14]

`RejectedModelResponseRecoveryService.ts:16` — The ADR scopes this to "the two structured Conversation Widget generators," but the diff ships four `toolName` values as bare literals across two files: `gesture-playground`, `gesture-playground-more`, `lexical-gravity-build`, `lexical-gravity-preview`. Typed as plain `string`, no union, no constant registry. Fine for two generators calling `capture()` directly — but the auto-recovery button needs to map a saved artifact's `toolName` back to *which validator do I re-run this against*, and there's nothing to walk. Is the loose string intentional groundwork, or worth a `RecoverableWidgetToolName` union now while there are only four values?

### 🟡 Standard — The envelope has no path back to the original request [F-15]

`RejectedModelResponseRecoveryService.ts:17` — The envelope persists `requestSummary` — a hand-written one-liner — plus the raw body, but not the actual system/user prompt, and no reference to the validator or schema that would have accepted the shape. A repair model needs to be told *what protocol to restore*, and that context lives only in the calling service's closure. Given this ADR already went to the trouble of making the artifact durable and self-describing, is skipping the prompt intentional scope discipline, or a follow-up worth filing before the button gets built on top?

### 🔵 Nit — One call site produces a run-on sentence [F-19]

`GesturePlaygroundService.ts:213` — Every other call site supplies the terminal punctuation the appended fragment assumes. This one concatenates directly, and both errors it can catch lack trailing periods, so the writer reads *"…menu headings and order The complete response was saved for recovery at …"*.

> *"The ticket said 'the two generators.' The code quietly shipped four toolNames and no registry to keep them honest — probably fine, but is that the plan or the drift?"* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Recovery Path Needs Recovery

Illuminated by: Blake F-02, Stan F-02, Cal F-06, Oliver F-03

The instinct that says *"this is the safety net, so it doesn't need its own safety net"* is exactly backwards. A system built to catch failure inherits every ordinary way code can fail, plus the obligation to still say something useful when it does. Here the write-that-saves-the-paid-artifact has no cleanup on rename failure, and the total-failure branch has no test and no log line carrying the one identifier that would let a human reconstruct what was lost.

→ Carry forward: When you build a "this saves us when X breaks," ask immediately *"and what saves us when this breaks?"* — then write the test for that branch before the happy path.

### Lesson 2 — The Neighbor Already Answered This

Illuminated by: Marcus F-07, Blake F-08, Sam F-08, Stan F-08/F-09

Three reviewers independently found the same shape of gap — multi-root handling, temp cleanup, a shared error-classification helper — each already solved correctly in a sibling file one directory over. When a pattern is reinvented slightly worse three times in one commit, that's rarely three unrelated oversights. It's a sign the new code was written by analogy to the *problem* rather than by consultation of the *precedent*.

→ Carry forward: Before writing a new storage adapter, open the nearest-neighbor sibling and diff your design against it line by line. Treat divergence as something to justify, not something to discover in review.

### Lesson 3 — Saved Is Not the Same as Findable

Illuminated by: Sam F-04, Marcus F-12

The artifact survived on disk — the goal was met at the storage layer — but the pointer to it was overwritten before it reached the user, and the notification behavior was fused into the same method that does the saving. Durability and discoverability are different guarantees that happen to ship in the same commit; testing that the file exists proves the first, never the second.

→ Carry forward: For any "we saved it somewhere" feature, write the assertion from the user's vantage point — not *does the file exist*, but *does the string the user actually sees contain the path to it*.

### Lesson 4 — Build for the Reader You Have, Not the One You'll Want

Illuminated by: Parker F-13, Patricia F-16, Bria F-14/F-15

The format shipped — a `.txt` sidecar with a hand-written English sentence — was designed for a human pasting into a bug report, which was right for *this* commit. But the author's own next question describes a machine as the next reader, and a machine needs a content-type signal, a hash to verify what it re-transmits, and the protocol it's meant to restore. Not a defect in what shipped; a reminder that naming the next consumer is cheap now and expensive to retrofit.

→ Carry forward: When you catch yourself asking "would this also serve a future automated caller," write down what that caller would need to read — even if you don't build it — so the current format doesn't quietly foreclose it.

> *"A safety net that has never been tested for its own failure is still, in the way that matters, just a rumor of safety."* — Sensei

---

## Extensibility assessment: the "attempt auto recovery" button

**Directionally yes, structurally not yet.** The hard part — the complete body survives, with provenance — is done and done well. Four seams stand between here and that button:

| What the button needs | What exists today | Gap |
| --- | --- | --- |
| Find and re-read the artifact | `filePath` on the receipt, in-memory only | Nothing enumerates or re-reads the recovery directory; the receipt is discarded after the error string is built |
| Know what to repair *into* | `toolName` as a bare string | No registry mapping `toolName` → validator/schema (F-14) |
| Tell the cheap model the protocol | `requestSummary`, a hand-written sentence | The actual prompt and the sentinel/schema contract aren't persisted (F-15) |
| Save without shouting at the user | `capture()` always calls `present()` | No persist-only path; a repair attempt would re-notify (F-12) |

None of those is expensive right now, and all four get more expensive after a second widget joins. The single highest-leverage change is **F-15 + F-14 together: persist the *contract* alongside the *body***. A repair model given 18K characters of broken JSON and no schema is being asked to guess; given the sentinels and the shape, it's a mechanical fix well within Haiku's range. Patricia's content hash (F-16) is the cheap insurance that becomes load-bearing the moment repair is automatic rather than human-reviewed.

---

## The Closer

### 🎬 Movie Tagline

> In a world where every generation costs real money… one service stood between the writer and the void. **It saved everything. Except the receipt.** *RECOVERY — this fall, the file is out there. Somewhere in folder zero.*

---

## Summary

Strong commit with a clear thesis and an ADR that earns it — the temp-then-rename ordering, the body-before-sidecar priority, and the per-branch fallback logging are all genuinely well-reasoned. Nothing here is blocking. Two things worth fixing before merge: the `generateMore` truncation guard (F-01), which regresses paid usable output in exactly the way this commit set out to prevent, and the missing temp cleanup (F-02), which both siblings already model. The rest — the multi-root guess, the duplicated helper, the unlogged generation id, the discarded recovery pointer in the truncation branch — are a tidy afternoon. The extensibility question has an honest answer: the storage half is ready, the contract half isn't yet.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
