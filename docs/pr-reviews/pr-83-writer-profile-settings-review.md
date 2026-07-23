# MR Review — feat(workshop): add writer profile settings

**Author:** okeylanders · PR #83 · base `epic/workshop-editor-tab` ← `feat/workshop-writer-profile`

Reviewed by a 10-persona panel + Sensei. Draft PR; adds a global, opt-in **Workshop Writer Profile** (`preferredAddress`, `bio`) shared only with Workshop personas (never with deterministic tools), deliberately kept **outside** the session aggregate, and injected into persona system prompts through a neutralized, code-authored trust frame. The Conversation-behavior modal becomes a tabbed **Conversation Settings** (Behavior · About You) with roving-tabindex a11y, a clear-with-confirm flow, and a compact composer indicator. The panel confirmed **two blockers that share one root** — the settings-store boundary validates the profile's *shape* but never its *scope or provenance* — alongside genuinely strong privacy-boundary and injection-hygiene work.

**Remediation update (2026-07-23):** all 16 actionable findings are
addressed. The resolution ledger and notes below are the current merge-readiness
record; the reviewer sections preserve the original findings and reasoning.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= praise or out of scope.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | **Writer Profile is workspace-overridable.** `proseMinion.workshop.writerProfile` declares no `"scope"` (**verified**: 0 hits for `scope`/`untrustedWorkspaces`/`restricted` in `package.json`), so it defaults to `window` scope, and `VsCodeSettingsStore.get()` reads the **merged** (workspace-wins) value. A repo's own `.vscode/settings.json` can silently inject ≤1000 chars into every persona's live system prompt — framed to the model as trusted "writer-supplied evidence," content hidden behind a green dot — at activation, zero interaction, in an ordinary trusted repo. `coerce` validates shape, not source. The codebase already moved the API key to SecretStorage for exactly this caution; it wasn't extended here. | Patricia | — (shared root w/ #2) | **Addressed** |
| 2 | 🔴 Blocking | **Partial persistence failure silently reverts the applied value.** The app writes settings to `Global` but reads the **merged** value, with no echo-guard. On a one-key write failure, the *successful* key's `onDidChangeConfiguration` fires `syncFromSettings()`, which re-reads the key that **just failed to save** and `commit`s the stale value back over the live one (**verified** end-to-end). Privacy variant: a **cleared bio crawls back** into live persona prompts. The one persistence-failure test asserts the immediate return but never fires the watcher, so the revert is invisible to the suite. | Blake | — (shared root w/ #1) | **Addressed** |
| 3 | 🟠 High | **Fail-closed default masks an end-to-end wiring break.** No test threads a *real, non-default* profile through the `WORKSHOP_SET_CONVERSATION_SETTINGS` message boundary; every test omits the field, and because `coerce` fails closed, a broken handoff and a correct one both land on the same `DEFAULT` — so a wiring regression at the one seam the whole feature depends on passes CI green. | Cal | — | **Addressed** |
| 4 | 🟠 High | **The partial-persistence-failure branch has zero coverage** — the literal implementation of the "partial failure keeps the live commit active" acceptance criterion, and the exact branch #2's blocker lives in. Behavior-only failure is tested; profile-only and both-keys are not. | Cal | — (pairs w/ #2) | **Addressed** |
| 5 | 🟠 High | **ADR-mandated rows silently deleted, not hidden.** The "Remember stable preferences (Future)" toggle and "Room memory (Coming later)" section were dropped in the modal refactor; **verified** — zero `.tsx` references remain, `workshop.css` still defines all six orphaned classes, the matching test was deleted, and ADR §11 (which still mandates them) was never amended. Live ADR and live code now disagree. **Confirm intent** — restore, or amend §11 + remove orphaned CSS. | Sam | — | **Addressed** |
| 6 | 🟡 Standard | **Behavior→Settings rename is unfinished.** Applied to the message type, payload, hook action, and modal copy — but not the coordinating class `WorkshopConversationBehaviorService`, its `CoreServices` property, or the sync/flush **error strings** (`WorkshopHandler.ts:398/402/2011/2015`). Net user-facing effect: a writer who edits only their Writer Profile and hits a failure is told their "conversation behavior" broke — a setting they never touched. | Marcus, Parker, Stan | 🎯🎯 | **Addressed** |
| 7 | 🟡 Standard | **`behaviorEquals`/`profileEquals` duplicated in modal *and* service.** The service copy **gates the prompt-rebuild** (`profileChanged` → `replaceWorkshopConversationSettings`); add a field and miss one copy and the service silently concludes "nothing changed," skips the rebuild, yet still persists — the exact drift the guarded commit exists to prevent. `@messages/workshop.ts` already hosts the shared predicates both files import. | Parker | — (relates #8) | **Addressed** |
| 8 | 🟡 Standard | **Change-detection compares raw fields, not effective active-state.** Toggling "share" on with empty fields makes `profileChanged=true` and triggers a full *uncached* persona-prompt rebuild (up to ~24 file reads across ≤3 targets) that reproduces a **byte-identical** prompt, since `buildWorkshopWriterProfileFrame` is `undefined` both before and after. Bounded by the guest cap — doesn't matter at current scale — but it checks whether the fields moved instead of whether the prompt did. | Tim | — (relates #7) | **Addressed** |
| 9 | 🟡 Standard | **Coercion fails closed with no trail.** `WorkshopWriterProfileService` isn't given a `LogSink`, so a hand-edited over-limit bio / stray key silently resets the whole profile to disabled/empty on relaunch — nothing logged, ever. The one log that *can* fire (via the running watcher) is byte-identical to a legitimate "Clear Profile" click, so on-call can't tell a silent rejection from user intent. | Oliver | — | **Addressed** |
| 10 | 🟡 Standard | **Profile-shared dot references a non-existent CSS token.** `var(--pm-success, #5fb878)` — `--pm-success` is defined nowhere in the repo (**verified**), so it permanently renders the hardcoded fallback and never themes. The house token for this exact meaning is `--pm-green` (sibling `.pm-ws-balance-dot-ok`); the PR's own `.pm-ws-danger-btn` uses a real token (`--pm-red`) correctly, making this look like a typo. | Stan | — | **Addressed** |
| 11 | 🟡 Standard | **Modal JSX collapsed into 450–564-char single-line elements**, well past this directory's ~140-char sibling convention (`WorkshopContextSelectorModal.tsx`) — props, handlers, and nested ternaries no longer scannable without horizontal scroll. No `max-len` rule catches it. | Parker | — | **Addressed** |
| 12 | 🟡 Standard | **Pending-Apply release-path tests deleted in the refactor** (host-rejection release, Cancel-then-reopen reseed) with no replacement — right as the modal's state surface doubled from one object to two. The modal does *not* hang today (traced), but the regression coverage on the resolving effect is gone. | Sam | — (test-gap theme) | **Addressed** |
| 13 | 🟡 Standard | **Proof (3) "removal takes effect" is only tested in the activation direction** (default→active). Removal works by symmetry (`profileChanged` alone forces the replacement; the frame omits when inactive) — but no test drives active→cleared and asserts the reverted commit. | Bria | — (test-gap theme) | **Addressed** |
| 14 | 🟢 Nit | **Char counters show untrimmed length** — a padded field can read "80 / 80" while the value that actually gets stored (trimmed on submit) is shorter. Harmless, but the one element whose job is the boundary can lie at the boundary. | Sam | — | **Addressed** |
| 15 | 🟢 Nit | **Two independently-failable persistence errors collapse into one stringly-typed `persistenceError`** shaped for a log line. `{ behaviorError?; profileError? }` keeps the door open for a future per-key UI without string-parsing. *(Counterpoint to #9's praise-side: Oliver rates the key-prefixed string genuinely diagnosable for logs today.)* | Marcus | — | **Addressed** |
| 16 | 🟢 Nit | **One test hand-writes the profile default** instead of importing `DEFAULT_WORKSHOP_WRITER_PROFILE` like every sibling test file — silently stops matching if the profile grows a field. | Stan | — | **Addressed** |
| 17 | 🟢 Praise | **The profile is *structurally* excluded from the session aggregate and deterministic tools** — never wired into the object graph, carried as a sibling of `session`, **zero** references in the analysis side-pass / persona-capability / session service (grep-verified, not convention). "Make illegal states hard to represent," aimed at a privacy boundary. | Marcus, Bria, Patricia | 🎯🎯 | **N/A** |
| 18 | 🟢 Praise | **Frame-forging is correctly closed on *both* fields independently** (not the assembled frame escaped once); the reserved regex now reserves `workshop-writer-profile`; the own-key allowlist forecloses `__proto__`-as-own-key and never spreads raw input. | Patricia | — | **N/A** |
| 19 | 🟢 Praise | **Copy cost, bio neutralization, and guest fan-out are all correctly bounded** — every `getProfile()` call site traced (none in a loop), neutralizer is single-pass over a ≤1000-char string with no ReDoS shape, fan-out hard-capped at 3. Checked, not assumed. | Tim | — | **N/A** |
| 20 | 🟢 Praise | **The partial-persistence error *message* is genuinely diagnosable** — key-specific prefix, joined on dual failure, and explicit that the live room stayed active and only restart-durability is at risk. The exact shape a 2am diagnosis needs. | Oliver | — | **N/A** |

Resolution notes (2026-07-23):

- The Writer Profile manifest contribution is now application-scoped. Failed
  per-key writes retain a typed live override until that stored key genuinely
  changes, so a successful sibling-key configuration echo cannot revert the
  applied room state.
- Conversation Settings naming, shared equality predicates, prompt-effective
  profile comparison, rejection logging, CSS token use, modal readability, and
  trimmed counters are reconciled.
- The older ADR text now keeps future memory controls unrendered until their
  contracts are implementable; the orphaned placeholder CSS is removed.
- Regression coverage now includes a non-default profile through the handler
  boundary, profile-only and dual persistence failure, watcher-echo retention,
  exact limits, inactive-profile no-op rebuilds, removal, modal rejection
  release, and cancel/reopen reseeding.

---

## Blast Radius

- **34 files changed · +1,271 / −746 lines · 1 commit** (reviewed surface: ~20 `.ts`/`.tsx` logic + test files; the 488-line HTML design-doc churn excluded from the panel bundle, CSS included)
- New source: `WorkshopWriterProfileService.ts`, `utils/workshopWriterProfile.ts`, and the `WorkshopWriterProfile` type family in `messages/workshop.ts` · New tests: shared coercion, frame-builder, and a `package.json`↔contract drift guard · New settings key: `proseMinion.workshop.writerProfile`
- Migrations: n/a (VS Code extension) · New services: 1 (`WorkshopWriterProfileService`) · New controllers/beans: n/a
- Hottest files: the modal rewrite (`WorkshopConversationBehaviorModal.tsx`, +150/−310) and the coordinator (`WorkshopConversationBehaviorService.ts`, +113/−42). Renames the `WORKSHOP_SET_CONVERSATION_BEHAVIOR` message family to `..._SETTINGS` across 14 call sites (sanctioned by the repo's alpha no-backcompat rule).

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B+ |
| 🛡️ Security | F |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | B+ |
| 🎯 Domain | B+ |

*Security is an F on the mechanical rule (any confirmed blocker = F) — but it's a **one-line-of-manifest** F sitting on top of genuinely strong injection hygiene (#18). Fix the `scope` and it's an A-. Architecture, Performance, and Domain all carry consensus **praise** that the letter grade doesn't fully show.*

---

## Executive Briefing

Top blockers and high-severity findings. Both blockers were **confirmed by the orchestrator against live code**, and both trace to one seam: `VsCodeSettingsStore` writes `Global`, reads *merged*, declares no scope, and validates shape but never provenance.

🔴 **[Patricia]** Workspace-overridable profile — a repo's `.vscode/settings.json` injects text into every persona's system prompt as trusted "writer evidence," zero interaction, because the setting declares no `scope`.

🔴 **[Blake]** Partial-persistence revert — a failed write to one settings key lets the other key's config echo silently roll back the applied value; a *cleared* bio crawls back into live prompts.

🟠 **[Cal]** Fail-closed default masks a wiring break — because "broken" and "correct" both resolve to `DEFAULT`, an end-to-end handoff regression at the critical seam passes CI green.

🟠 **[Sam]** ADR-mandated "Future"/"Room memory" rows were silently deleted (orphaned CSS + deleted test left behind); the live ADR §11 and the live code now disagree — confirm this was intentional.

🟠 **[Cal]** The partial-persistence-failure branch where the #2 blocker lives has zero test coverage, so the revert had nothing to catch it.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟡 Standard — Coordinator keeps the "Behavior" name after everything it touches became "Settings" [🎯🎯 Strong Consensus]

`WorkshopConversationBehaviorService.ts:26` — The coordination itself is honest: behavior and profile now compose into the same system message, so they genuinely need one serialized commit boundary (two independently-queued coordinators would race on `replaceSystemMessagesBetweenRuns`). What gives me pause is that the diff renamed every other artifact on this seam and stopped at the class that does the coordinating — whose own docstring now reads "coordinator for the Conversation Settings surface." Finish the rename before a third setting lands here and "Behavior" becomes load-bearing folklore.

### 🟢 Nit — Two independently-failable persistence errors collapse into one opaque string

`WorkshopConversationBehaviorService.ts:72` — The two keys can fail independently (correct, matches the ADR's non-atomic stance), but the failures are string-concatenated into the single `persistenceError?: string`. A stringly-typed protocol standing in for a richer one that's cheap now: `{ behaviorError?; profileError? }` keeps the door open for a per-key UI without anyone parsing a string shaped for a log line.

### 🟢 Praise — The profile is structurally excluded from the session aggregate, not just conventionally [🎯🎯 Strong Consensus]

`messages/workshop.ts:1008` — `WorkshopWriterProfile` was never wired into `WorkshopSessionSnapshot`; it's carried as a *sibling* of `session`, and I checked `WorkshopAnalysisSidePass` directly — zero references. A future engineer adding session export can't reach the bio by accident. That's a stronger guarantee than the sanitizer alone.

> *"The territory here is honestly surveyed — profile and session genuinely don't touch — but the map still labels this coordinator 'Behavior' when it's been drawing Settings borders for a while now."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🔴 Blocking — Partial persistence failure makes the config watcher silently revert the applied value

`WorkshopConversationBehaviorService.ts:104` — Traced against the live wiring. `apply()` commits **both** live states (`setConversationBehavior` + `writerProfileService.commit`, 161–162), then persists the two keys in independent try/catch blocks (64–81). On a partial failure the store and live state legitimately diverge — and the *successful* key's write fires `onDidChangeConfiguration` → `handleConfigurationChange` (`affects(behaviorKey) || affects(profileKey)`) → `syncFromSettings()`, which re-reads **both** keys including the one that just failed to save, sees `profileChanged=true`, rebuilds the persona prompts with the **old** profile and `commit`s it back. The applied value is reverted immediately, and `postSessionState` then broadcasts the reverted state. Privacy variant: clear your bio + tweak behavior, the profile-clear write fails, and the behavior echo re-commits the old bio into live persona prompts — the thing you were told was cleared. The existing persistence-failure test asserts the immediate return and never fires the watcher, so the suite never sees the revert. *(Orchestrator note: gated on a settings-write failure — an uncommon error path — but it is exactly the case this error-handling code exists for, and it does the wrong thing.)*

> *"Don't ship this until the watcher stops re-reading a key that just failed to save — right now a hiccup writing one settings key silently rolls back the other one the UI already swore was live, and a 'cleared' bio crawls back into the persona prompts."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — ADR-mandated "Future" toggle and "Room memory" section silently deleted, not hidden

`WorkshopConversationBehaviorModal.tsx` — Went hunting for a hang and found a tombstone. The "Remember stable preferences across sessions (Future)" toggle and the "Room memory / Coming later" section that ADR §11 items 4–5 still mandate verbatim are gone. `grep` across the whole repo: the only surviving hits are in the ADR doc itself — zero in any `.tsx`/`.ts`/test. And `workshop.css` still defines `.pm-ws-behavior-row-future`, `-toggle-locked`, `-room-row/-name/-desc`, `-ftag` — orphaned exactly the way you'd expect if the JSX got dropped while collapsing the modal. The matching test was deleted with no replacement, and §11 was never amended. Live ADR and live code disagree; confirm this was intentional.

### 🟡 Standard — Pending-Apply release-path tests lost in the tab refactor

`WorkshopConversationBehaviorModal.test.tsx` — I traced both `pending`-release paths by hand: the modal does **not** hang today (host rejection → `sendError` + `postSessionState` with unchanged values → the `errorMessage` effect fires and releases). But the two tests that specifically exercised this — host-rejection release and Cancel-then-reopen reseed — were deleted with no equivalent, right as the state surface doubled to behavior + profile. That's the coverage you miss the day someone refactors `PendingApply`.

### 🟢 Nit — Char counters show raw (untrimmed) length, not the length that gets submitted

`WorkshopConversationBehaviorModal.tsx` — `.trim()` only runs on submit, so a field padded with spaces can read "80 / 80" while the stored value is shorter. Harmless (the modal's trim and the host's coerce agree on the final value), but the one UI element whose whole job is the boundary can lie right at it.

> *"Went in looking for a hang in the pending-resolution effect and instead found a tombstone — the 'Coming later' toggle's CSS is still standing guard in workshop.css over a section that no longer exists anywhere in the JSX."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — Modal JSX collapsed into unreadable single-line elements

`WorkshopConversationBehaviorModal.tsx` — The `OptionCard` helper is 564 characters on one line; the clear-profile control (a nested ternary with two buttons) is 548; the footer ternary is 452. That's not tighter whitespace — props, conditionals, and handlers are no longer visually separable without horizontal scrolling. It's a real deviation from this directory's own baseline: every sibling stays under ~140 chars, and this PR's own `WorkshopComposer` helper stayed properly multi-line. No `max-len` rule catches it, so it's on review to push back.

### 🟡 Standard — `behaviorEquals`/`profileEquals` duplicated in modal *and* service — same knowledge, no shared source

`WorkshopConversationBehaviorModal.tsx:65` — Field-for-field duplicates of the service's private copies (grep-confirmed, nothing shared). The service copy **gates real behavior**: `profileChanged` decides whether the guarded prompt-replacement reruns. Add a field to `WorkshopWriterProfile`, update `coerce`, miss one `equals` copy, and the service silently concludes "nothing changed," skips the rebuild, and still persists — exactly the drift the guarded commit exists to prevent. `@messages/workshop.ts` already hosts the shared predicates both files import; hoist these next to them.

### 🟡 Standard — Coordinator's doc comment now contradicts its name

`WorkshopConversationBehaviorService.ts:26` — Every other symbol on this seam was renamed Behavior→Settings; this class and its `CoreServices` property weren't, even though the docstring the author wrote in this same diff calls it the "Conversation Settings surface" coordinator. The prose no longer agrees with the identifier. *(Same root as Marcus and Stan — 🎯🎯.)*

> *"I had to scroll sideways through a 564-character line just to find OptionCard's onClick — that's not tight code, that's code hiding from review."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — Handler's `writerProfile` extraction is only ever tested with the value that would exist even if it were broken

`WorkshopHandler.test.ts:217` — `grep` confirms zero `writerProfile` payload values across all six handler-test call sites. The handler passes `message.payload?.writerProfile` straight through — but every test omits the field, and since `coerce` fails closed identically for `undefined` and for any wrong-shaped object, a swapped argument or typo'd property produces the exact same `DEFAULT` these tests already assert. The fail-closed design that makes the feature safe is the same property masking a wiring break at the one seam the whole feature routes through. No test threads a real, non-default profile end-to-end.

### 🟠 High — Profile-only persistence-failure branch has zero coverage

`WorkshopConversationBehaviorService.ts:75` — The sibling behavior-only failure is tested (`'keeps an applied modal choice live while reporting a persistence failure'`), but no test rejects `settings.update` while only the profile changes, or while both change. This branch is the literal implementation of the "partial-persistence failure keeps the validated live commit active" criterion — and it's the exact branch Blake's blocker lives in. Nothing exercises the one path this code exists to handle.

### 🟡 Standard — Coercion boundary is tested past the limit, never at the limit

`workshopWriterProfile.test.ts:27` — Only LIMIT+1 (81/1001) is exercised, which proves the reject side only. `coerce` rejects with strict `>`, so exactly 80 / exactly 1000 must round-trip valid — and the modal's counters actively invite writers to fill to exactly that number. If `>` ever slips to `>=`, an at-limit profile silently fails closed and the bio disappears with no error. *(Downgraded from High: latent-regression gap, not active breakage.)*

> *"Fail-closed is a fine safety net for writers, but when 'broken' and 'correct' both land on the same default, your test suite needs to work harder than this one does to tell the two apart."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — Rename stops at the happy path — external/deferred sync **error strings** still say "conversation behavior" [🎯🎯 Strong Consensus]

`WorkshopHandler.ts:398/402/2011/2015` — The watcher now fires `syncConversationBehaviorFromSettings()` for *either* key, but that method and `flushDeferredConversationBehavior()` still log and surface pure "conversation behavior" text, while the sibling `handleSetConversationSettings` in the same class was correctly renamed. Net effect: a writer who edits only their global Writer Profile and hits a replacement failure is told their "conversation behavior" broke — a setting they never touched. This is the user-facing edge of the rename the class-name finding (#6) is the structural edge of.

### 🟡 Standard — Profile-shared dot references a CSS variable that exists nowhere

`workshop.css:2205` — `var(--pm-success, #5fb878)` — `--pm-success` is defined nowhere in the repo (grepped the whole tree; these two new lines are the only hits), so it permanently renders the fallback and never themes. The established token for this on/positive meaning is `--pm-green` (sibling `.pm-ws-balance-dot-ok`, thirty lines up). The `.pm-ws-danger-btn` this same PR added uses a real token (`--pm-red`) correctly, which makes this look like a typo, not a choice.

### 🟢 Nit — One test hand-writes the profile default instead of reusing the shared constant

`MessageHandler.test.ts:162` — Every other test file this PR touches imports `DEFAULT_WORKSHOP_WRITER_PROFILE` for this mock value; this one hand-writes the shape and doesn't import the constant at all, so it'll quietly stop matching if the profile grows a field.

> *"Every rename has a corner it forgets — this time it's the two error paths nobody hits in the demo, plus a CSS variable that's been quietly not existing since the first commit."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — A profile no-op still triggers the full uncached persona-prompt rebuild

`WorkshopConversationBehaviorService.ts:148` — `apply()` gates the expensive replacement on raw field equality, not on whether the *effective* profile changed. Flip "Share this profile" on without typing anything → `profileChanged=true` → `replaceWorkshopConversationSettings` fires, even though `buildWorkshopWriterProfileFrame` returns `undefined` for both the old and new profile (enabled-but-empty is still inactive). That's up to ~24 sequential *uncached* markdown reads across ≤3 targets to reproduce a byte-identical prompt. At current scale it doesn't matter — the guest cap fixes the fan-out at 3 and it can't grow with usage — but it's checking whether the fields moved instead of whether the prompt did. Compare `isWorkshopWriterProfileActive(prev/next)` instead.

### 🟢 Praise — Copy cost, neutralization, and fan-out are all correctly bounded — checked, not assumed

`WorkshopWriterProfileService.ts:20` — Traced all four `getProfile()` call sites (none in a loop; a shallow 3-field copy, no bio traversal). `neutralize` is a single-pass global regex over a ≤1000-char string — no nested-quantifier ReDoS shape — and only runs at conversation start or an explicit settings replacement, never on continuing turns. Fan-out is hard-capped at 3. A good bound to have in place before the one real gap above gets a chance to compound.

> *"Checking whether the fields moved instead of whether the prompt did buys you three sequential uncached file reloads to confirm what a boolean already knew — nothing changed."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🔴 Blocking — Writer Profile is workspace-overridable — a repo's `.vscode/settings.json` injects attacker text into every persona's live system prompt

`apps/vscode-extension/package.json:378` — The privacy story rests on this being "writer-authored," "explicit," "global" data the person at the keyboard opts into — but nothing checks *who* supplied it, only that it's *shaped* correctly. The property declares no `"scope"` (confirmed: 0 hits for `scope`/`untrustedWorkspaces`/`restricted` in `package.json`), so it defaults to `window` scope, which a workspace's own `.vscode/settings.json` freely overrides; `VsCodeSettingsStore.get()` is a bare `getConfiguration(section).get(key, default)` that reads the merged, workspace-wins value. This isn't a Workspace Trust bypass — it fires in an ordinary, already-trusted repo the writer opens every day (a shared writing project, a cloned template, one collaborator commit). Two paths pick the poisoned value up with zero interaction: the service constructor's `readSetting()` at activation, and the config watcher's live re-sync. A well-formed payload sails through `coerce` and lands at the very end of the host's and every guest's system prompt — the highest-leverage position — framed to the model as trusted "writer-supplied evidence." Frame-forging is blocked (below), but content-level steering is exactly what "evidence not instruction" tries to blunt; it just never considered that "evidence" could arrive from the repo instead of the writer. This codebase already migrates the API key out of settings into SecretStorage for this exact class of caution — the pattern exists and wasn't extended. *Fix: declare `"scope": "application"` (or read the profile from the global-scope `inspect()` value, not the merged `get()`).*

### 🟢 Praise — Frame-forging is correctly closed on both fields, and tools are genuinely isolated

`utils/workshopWriterProfile.ts:21` — Both `preferredAddress` and `bio` are neutralized *independently* (not the assembled frame escaped once) — which matters because either field alone is attacker-shaped — and the reserved regex now reserves `workshop-writer-profile`; the forgery test proves exactly one open/close pair survives a `</workshop-writer-profile><workshop-interaction …>` payload, delimiters HTML-entity-encoded. Tool isolation is real, not asserted: `RunWorkshopToolSidePass` passes the profile only into persona synthesis, never into `analysisSidePass.run()`, and the analysis path has zero references (grep-confirmed). The own-key allowlist also forecloses the classic `__proto__`-as-own-key trick, and `coerce` never spreads `raw`.

> *"I've seen this exact shape of bug in enough incident reports to recognize it on sight — a validator that checks whether the data is well-formed, and never once asks whether it was actually invited."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟡 Standard — Coercion fails closed with zero log at activation; the one later log reads as a normal commit

`WorkshopWriterProfileService.ts:16` — Searched the diff and live tree for a log tied to coercion rejection — not found. The service is handed only a `SettingsStore`, no `LogSink`, so it's structurally incapable of logging. A writer hand-edits `settings.json` (stray key, or the bio drifts over 1000 chars), relaunches, and the whole profile silently resets to disabled/empty — nothing in the output channel, ever. The one place a signal *can* appear (a bad edit while running) logs `…profileEnabled=false, profileHasContent=false` — the identical text a legitimate "Clear Profile" click produces. An on-call dev grepping for "profile vanished" sees "committed" and reasonably concludes it was user-driven.

### 🟢 Praise — The partial-persistence-failure message is genuinely diagnosable

`WorkshopConversationBehaviorService.ts:72/79` — Each failure is labeled with its own key prefix and joined on dual failure, so a two-key failure reads `"behavior: …; writer profile: …"` rather than one opaque string, and the handler's `sendError` is explicit that the live room committed and only restart-durability is at risk. That's exactly the shape a 2am diagnosis needs: which key, what error, and confirmation the room didn't silently die.

> *"An empty field and a rejected field look identical in this output channel, and identical-looking is the one thing a stack trace should never be at 3am."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — Proof (3) "removal" is only tested in the activation direction

`WorkshopConversationBehaviorService.test.ts:179` — The ADR requires implementation to prove "profile removal takes effect on the next eligible turn via the same guarded path." Tracing `apply()`, `profileChanged` alone forces the replacement even when behavior is untouched, and `withWriterProfile` omits the frame once the profile is inactive — so removal genuinely propagates *by symmetry* with the tested activation path. But no test starts from an already-active profile, calls `applyFromWebview(behavior, DEFAULT)`, and asserts the cleared object reached `replaceWorkshopConversationSettings` and `getWriterProfile()` reverted. Proven by symmetry, or was a mirror-image test intended?

### 🟢 Praise — The four stated proofs actually trace end-to-end, including the persona/tool split

`WorkshopConversationBehaviorService.ts:149` — Personas get the profile, deterministic tools never do, and it never touches session data. Traced every persona-prompt start/replace site — all three and *only* these three receive `writerProfile`; `WorkshopAnalysisSidePass`, `WorkshopPersonaCapability`, and `WorkshopSessionService` have zero references (grep, not inference). The code does what the ticket asked.

> *"Funny thing about 'removal' — every test in this PR proves the profile can show up, but not one proves it actually leaves."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — Know Your Jurisdiction

Illuminated by: Blake + Patricia (both blockers, one shared root)

When a boundary both writes and reads through the same store, it is implicitly making a claim about jurisdiction — which scope it trusts, and where the data it hands back actually came from. When that claim goes unexamined, the write path commits to one authority (Global) while the read path quietly consults a wider one (the merged view), and validation checks only that the incoming *shape* is well-formed, never who was entitled to send it. Two reviewers found this from opposite directions — one asking "does the app agree with its own last write," one asking "can something outside this machine hand it data it will trust" — because it's the same unexamined boundary, asked two different questions.

→ Carry forward: For any store you both write to and read from, write the two answers side by side — "writes commit to: ___", "reads resolve from: ___" — before trusting a value came from where you think it did. Then, for anything validated there, ask a second question beyond "is this shaped correctly": *"who, or where, was allowed to hand this to me?"*

### Lesson 2 — Every Fallback Needs a Witness

Illuminated by: Cal + Oliver (tests and observability, same blind spot)

A fail-closed default is a quiet promise worth keeping — but notice what that promise costs for free: the fallback and the correctly-working path now produce the exact same observable result, so nothing on the outside — not a log line, not a test, not a user squinting at the screen — can tell a silently-disconnected path from one working exactly as designed. That isn't a flaw in fail-closed design; it's the one thing the design doesn't give you automatically, and has to be added on purpose.

→ Carry forward: Whenever you add a fallback, ask it directly — "if you fire, does anything change that a person or a test would notice?" If the honest answer is "no, I resolve to the same default a correct run produces," add a log line at the moment it fires and a test that pushes a real, non-default value all the way through.

### Lesson 3 — The Old Name Hides in the Error Message

Illuminated by: Marcus + Parker + Stan (🎯🎯 strong consensus)

A rename gets finished in the places everyone looks at during review — the message type, the payload, the UI copy — because those are the surfaces the happy path exercises and the diff makes visible. What's easy to leave behind is the coordinating class nobody opens unless something's failing, and the error strings that only run when things go sideways. That's precisely backwards from where a name matters most: a person reads your internal vocabulary closely at exactly the moment they're anxious about it — right after their action just failed.

→ Carry forward: When you rename a concept, grep the old name across the whole tree — log lines, error strings, the classes that "just orchestrate" — and read each hit as a live decision. Ask: *"if this exact path fails, what name does the person on the other end see?"*

### Lesson 4 — Equality Is a Design Decision, Not a Utility Function

Illuminated by: Parker + Tim (two equality checks, two ways of drifting)

Writing a function that answers "did this change?" feels like plumbing, but it quietly makes two decisions at once. One is which layer you compare — the raw inputs, or the thing they're supposed to produce; compare the inputs when you meant the output and you'll rebuild something byte-identical forever. The other is how many places get to define "the same" — let that live in two files, and the day someone adds a field to only one, the system won't error, it will confidently decide nothing changed, skip the one action that mattered, and persist as though the skip were correct.

→ Carry forward: Before finishing any change-detection check, ask both questions aloud — "am I comparing what changed, or what I actually care about downstream?" and "if a field is added next month, how many copies must update in sync — can I make that number one?"

### Lesson 5 — Trust Doesn't Scale — Mechanism Does

Illuminated by: Marcus + Bria + Patricia (praise), echoed in Tim's bounds and Oliver's message

The strongest parts of this PR earn their confidence by mechanism, not by promise: the profile stays out of session data not because a comment says so, but because it was never wired into that object graph — a claim reviewers confirmed by grepping for a reference and finding none. The same instinct shows in the allowlist that forges the trust frame (no path an attacker's extra keys could ride) and in bounds that are checked rather than assumed. This is the identical discipline Lesson 1 was missing, aimed correctly: a boundary where misbehavior has nowhere to attach, instead of one that hopes callers behave.

→ Carry forward: When you build something meant to keep a category of data or caller out, ask "could I prove this by searching for a reference and finding none — or does it only hold because everyone remembers not to wire it in?" Favor the first shape on purpose — and name it in the PR description, so it's easier to reach for at the boundary that needed it most.

> *"Every boundary in this codebase was drawn by the same hand; the ones that hold and the one that gave way aren't different skills — only different moments of attention."* — Sensei

---

## The Closer

### ⭐ Yelp Review

**★★★☆☆ (3/5)** — Came for the writer-profile tasting menu and the kitchen clearly has a real chef: the plating keeps the raw ingredients (your bio) walled off from the house data in a way most places only claim to, and the trust frame is neutralized on both fields like a proper allergen protocol. I ordered the "global settings," and technically got them — but the back door was propped open, so anyone in the building's `.vscode` can slip a note onto my plate and the server presents it as *chef's recommendation*, and one dropped ticket in the kitchen silently swaps my cleared order back onto the pass. I'd absolutely return once they lock the pantry (`scope`) and stop letting a failed write reach back over a plated dish — the flavors are all here; it's the food-safety inspection that isn't.

---

## Summary

This is careful, trust-conscious work: the privacy boundary is **structural**
rather than conventional, the injection frame is neutralized on both fields,
prototype pollution is foreclosed, and tests prove the bio never lands in the
session aggregate. The initial review found two confirmed blockers with one
root: the settings boundary validated shape without enforcing scope or
protecting a live value after partial persistence failure. Remediation now
application-scopes the setting, guards failed per-key writes from sibling-key
echoes, exercises a non-default profile through the message seam, and
reconciles the ADR/UI contract. The actionable ledger is closed and the branch
is merge-ready by automated gates.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
