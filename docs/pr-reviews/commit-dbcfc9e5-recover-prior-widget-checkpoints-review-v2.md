# Commit Review v2 — feat(workshop): recover prior widget checkpoints

**Author:** Okey Landers · **Commit:** `dbcfc9e5` on `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar`
**Reviewed:** 2026-08-07 (America/Chicago) · **Mode:** Full · **Parent:** `d964b021` (single parent)
**Scope:** One untracked working-tree file (`Prose Minion.zip`) is excluded from review. No merge commit, no dirty tracked files; all files read at `HEAD`.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise,
superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Hoisted shared block rewrote the semantic gears' standing instruction | Bria, Parker | 1 independent · 1 runway-prompted | — | **Open** |
| F-02 | 🟠 High | `renameNamed`/`duplicateNamed` irreversibly convert a checkpoint with no notice | Marcus, Blake, Oliver, Patricia | 4 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-03 | 🟠 High | The v1 frame equivalence test is a tautology | Cal | 1 independent | — | **Open** |
| F-04 | 🟠 High | Library tile marked selected is a different lens than the one in force | Sam | 1 runway-prompted | — | **Open** |
| F-05 | 🟡 Standard | Recovery notice asserts a preview was preserved when it was discarded | Parker, Bria, Cal, Oliver, Blake, Sam | 6 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-06 | 🟡 Standard | Preview caches preserved by relabeling the key, not by proving equivalence | Tim, Blake, Patricia, Sam | 1 independent · 3 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-07 | 🟡 Standard | No durable record that a repair occurred once files converge | Oliver | 1 runway-prompted | — | **Open** |
| F-08 | 🟡 Standard | Architecture guard reason string contradicts the dispatcher's actual role | Marcus, Stan | 1 independent · 1 runway-prompted | — | **Open** |
| F-09 | 🟡 Standard | Named-twin probe pays a full decode to compute a boolean | Tim | 1 runway-prompted | — | **Deferred** — inherited probe; cost is panel-open latency at N=1 |
| F-10 | 🟡 Standard | Derived normalization union removes the ADR's forcing function | Stan | 1 runway-prompted | — | **Open** |
| F-11 | 🟡 Standard | Fitness witness 1 unmet — no config/directive/turn linkage fixture | Cal, Bria | 2 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-12 | 🟡 Standard | One gear-gating rule spelled five ways in the modal | Parker | 1 runway-prompted | — | **Deferred** — readability; pairs naturally with Sprint 02D |
| F-13 | 🔵 Nit | Redundant deep clones on the common path | Tim | 1 runway-prompted | — | **Open** |
| F-14 | 🔵 Nit | Notice code drops the `-widget-` infix its sibling codes carry | Stan | 1 independent | — | **Open** |
| P-1 | 💚 Praise | Splitting the strictness axis instead of weakening it | Marcus | 1 independent | — | N/A — preserve |
| P-2 | 💚 Praise | Validate → transform → re-validate on every recovery arm | Patricia | 1 independent | — | N/A — preserve |

## Review coverage

- **Read fully:** the complete unified diff (47 files, +1636/−233); `LexicalGravityConfigCodec.ts`, `LexicalGravityDirective.ts`, `WorkshopWidgetCheckpointRecovery.ts`, `WorkshopWidgetCheckpointRecoveryContracts.ts`, `GesturePlaygroundConfigCodec.ts`, `WorkshopPersistedSession.ts`, `WorkshopSessionStateV1.ts`, `WorkshopSessionStateV1Shape.ts`, `WorkshopSessionCheckpointNormalization.ts`, `WorkshopSessionPersistenceCoordinator.ts`, `WorkshopSessionStore.ts`, `WorkshopSessionMessageHandler.ts`, `useWorkshopSessions.ts`, `WorkshopApp.tsx`, `WorkshopLexicalGravityModal.tsx`, `boundaries.test.ts`, `persistedValidation.ts`, `promptBudgets.ts`
- **Declared-intent artifacts:** `02b-b-widget-codec-recovery-mode.md` (the approved plan), `02b-b-lexical-gravity-interpretive-grammar.md`, `02d-widget-persistence-grammar-and-integrity.md`, `03-prose-controller.md`, ADR 2026-07-30, ADR 2026-08-01, the PR #110 review ledger, `CLAUDE.md`
- **History:** `HEAD^` state of every materially changed file; `bd441611` (original Lexical Gravity v1 release), `eeded7da`, `cd7abe45`, `37c9ed18`, `d964b021`
- **Verification run at this commit:** `npx jest` → 189 suites / 1973 tests / 1 snapshot, all passing · `npm run typecheck` (core, webview, extension) → clean · `npm run lint` → 0 errors, 931 warnings (repo-wide `curly`/naming baseline; 6 in new code following the established degree-bucket pattern) · `git diff --check` → clean
- **Not available:** the ~527 KB writer checkpoint that motivated the change — the plan forbids committing it, so the decisive round-trip witness is manual and unrecorded. No wall-clock measurement exists in the diff.
- **Empirically probed by reviewers:** worst-case rendered directive length against the 16,000-character budget (measured independently by Sam and Patricia; both well under, see F-retired notes)

---

# Semantic Runway — feat(workshop): recover prior widget checkpoints

**Author:** Okey Landers · **Commit:** `dbcfc9e5` on `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar`
**Parent:** `d964b021` (single parent) · **Evidence date:** 2026-08-07
**Blast radius:** 47 files, +1636 / −233. 2 new modules. 1 new `MessageType`. 1 persisted-draft type union. 1 new required writer control. 1 system-prompt rewrite. No dependency, migration, or `package.json` change.
**Scope caveat:** one untracked file (`Prose Minion.zip`) in the working tree is excluded from review.

**Runway thesis.** A writer's saved Workshop room currently dies if it contains one obsolete widget draft. This commit moves prior-shape recognition into each widget's own codec so the room is salvaged rather than rejected — and, in the same breath, promotes the obsolete shape's capability into a first-class control (`lexical`) and adds a second, orthogonal one (`evidenceMode`). The recovery machinery is the smaller half of the diff; the larger half is authored feature work that happens to share the persisted-shape bump.

---

## 1. Working Definition & Real Job

**Literal code change.** `WorkshopSessionStateV1Shape` gains a lenient *checkpoint* twin beside its strict *current* assertion, threaded by a `checkpoint: boolean`. A new closed dispatcher (`widgets/WorkshopWidgetCheckpointRecovery.ts`, 112 lines) routes per-`widgetId` shape and repair to feature codecs. Gesture's ad-hoc `{draft, defaultedDictionarySharing, defaultedSourceReferences}` becomes the shared `WorkshopWidgetDraftRecoveryResult<TDraft, TNormalization>`. Lexical Gravity gains exact v1 recognition, a `lexical` application gear, a required `evidenceMode`, a frozen copy of the v1 directive renderer, and a discriminated draft union. A consume-once `WORKSHOP_SESSION_RECOVERY_NOTICE` carries a writer-facing sentence from codec to toast.

**Functional capability.** A Workshop checkpoint containing a recognized prior widget draft now opens, with its transcript, conversation archive, config/directive linkage, and word field intact — and the model in that restored room receives byte-identical standing instructions to what it received before.

**Business/operational problem.** [Declared] A valid rolling `current.json` *and* its named twin were observed carrying a Lexical Gravity v1 config. The strict shape pass rejected the whole aggregate: `openNamed` rethrows so the named checkpoint can never be reopened; the autosave path catches, sets `currentCheckpointError`, pauses rolling autosave, and starts an empty room, with the only explanation in the VS Code Output channel. One stale widget, and a long working conversation is unreachable.

**What the wording and structure emphasize.** The commit subject says "recover prior widget checkpoints" — plural, widget-generic. The code emphasizes *feature ownership*: the central normalizer ends this commit containing zero Gesture or Lexical tokens. The naming consistently distinguishes machine evidence (`normalizations`, stable codes) from writer evidence (`notices`, display-safe English).

**What it suppresses.** The subject says nothing about `evidenceMode` — a new required persisted control that enters the config key, the summary string, the model payload, the standing frame, and the shared preview system prompt for **every** existing configuration, recovered or not.

**What must survive any valid alternative.** (1) A recognized prior draft must not brick the room. (2) An unrecognized or partially-corrupt draft must still fail closed and protect the file. (3) Recovery must not invent semantics the writer never selected. (4) The restored room's model instructions must match what the retained conversation was actually built on.

**Competing interpretation.** A reviewer could read this as primarily a *feature* commit — shipping the `lexical` gear and Tell/Blend/Show — that carries recovery as the enabling change. [Observed] Sam's deletion experiment supports this: strip `evidenceMode` and the recovery arm still works unchanged, because it hardcodes `'blend'`. The two changes are coupled only by sharing one persisted-shape bump. The evidence favors the plan's framing (recovery is the gate), but the feature half is larger and independently reviewable.

> This MR is not merely a compatibility shim for one broken file. Its real job is to establish *where compatibility knowledge lives* — inside each feature's own codec, behind a closed dispatcher — while preserving, byte-for-byte, what a saved conversation was told.

## 2. Declared Intent, Observed Behavior & Open Meaning

The git commit body is empty; the subject is the only intent in the repository's history. The real ticket is `.todo/.../02b-b-widget-codec-recovery-mode.md`, locked one commit earlier in `d964b021` together with amendments to two ADRs.

**Alignment.** [Observed] The implementation tracks the plan closely and unusually literally. The §3 `WorkshopWidgetRecoveryNotice` interface ships verbatim. The §1 ownership ledger matches the shipped module boundaries. R-01 through R-05 each have identifiable code and tests. The §4 invariant table's "only exact known prior drafts recover" has its near-miss witness (`inventedLogic` → throw). R-04's dual-write convergence has its integration test.

**Gaps between declared and observed.**

- [Observed] The plan's target-path diagram marks `WorkshopSessionService` as `[=] unchanged`. In fact `parseWorkshopPersistedSession` — the **write** path — newly runs `assertCurrentWorkshopSessionStateV1` *and* `validateWorkshopSessionStateV1`, neither of which it ran before.
- [Observed] Fitness witness 1 requires a fixture with the v1 config **and a standing directive** proving "config id, directive id, and conversation archive intact," and the invariant table demands "a realistic `wc-N` / `pd-N` / turn linkage fixture." Every recovery fixture in the diff carries `widgetConfigs` only.
- [Observed] Fitness witness 8 ("Hydration never reads, writes, rebuilds, or deletes a project lens resource") requires "a negative call/byte-identity test." Searched the diff and evidence pack for such a test — not found.
- [Observed] The plan's §7 note forbids copying the discovered 527 KB checkpoint into the repo. Every fixture is therefore synthetic and minimal. The witness that matters most to the writer is the one that cannot be committed.

**Unknown.** The parent sprint doc still reads *"F5 acceptance and widget codec recovery exit plan pending"* and is not updated by this commit. Whether Extension Development Host acceptance ran against the real checkpoint is not recorded anywhere in the diff.

## 3. Business Story & Rulebook

**Actors.** The **writer** owns the checkpoints and the manuscript inside them; they are the subject and the beneficiary. The **model** is a non-consenting executor that receives the standing directive — the entire byte-exactness apparatus exists to protect what it is told. **Feature codecs** are the accountable parties for their own compatibility knowledge. The **decision owner** is named in the plan; the implementation gate reads `OPEN`. Explicitly **excluded**: `prose-minion/lenses/*.json`, the writer's own lens files, which locked decision 1 and ADR 2026-08-01 §6 keep out of automatic recovery entirely.

**Trigger and preconditions.** Extension activation, or Open on a named session. Precondition: a session file within size and nesting bounds whose envelope keys are exact.

**The rulebook as implemented.**

| Input on disk | Output | Codes | Writer notice? |
|---|---|---|---|
| v1 lens, no gears | `lexical` + `blend`, v1 lens verbatim | `recovered-widget-lexical-gravity-v1`, `defaulted-…-evidence-mode` | **Yes** |
| v2 lens, no `evidenceMode` | `evidenceMode: 'blend'`, preview `configKey` rewritten | `defaulted-…-evidence-mode` | No |
| Current draft | unchanged | none | No |
| Gesture missing two fields | `false` / `[]` | two `defaulted-widget-…` codes | No (silent by locked decision 5) |
| Anything else | **throw**; whole checkpoint rejected, file protected | — | — |

**Recognition is fail-closed and total.** `version: 1` alone is never sufficient: the v1 arm requires the exact key set, bucket/gradient/cliché/substitution shape, slug matching `lensSlug`, and a renderability check that the v1 frame fits the prompt budget. One unknown field rejects the entire room. An unknown `widgetId` throws.

**Preserve / discard.** Preserved verbatim: the whole v1 word field, `weight`, `reach`, `metaphorPull`, transcript, config id, directive id, conversation archive, and a cached preview's `sourceText` + `text`. Discarded: a v1 preview lacking `sourceText`, dropped entirely as derived cache. Never invented: Lens Logic.

**A policy asymmetry worth naming.** [Observed] Within one recovered draft, two cache-quality defects are treated oppositely: a preview missing `sourceText` is *silently discarded*; a preview whose `configKey` fails to match is *fatal to the entire room*. Defensible — a wrong key suggests hand-editing — but the boundary is unstated.

**Gear gating.** A v1-lens draft must carry `applicationMode: 'lexical'` or the shape assertion throws. The same rule is expressed at the type level: `WorkshopLexicalGravitySemanticDraft` requires a v2 lens. Hydration never performs the semantic upgrade; the modal disables Interpret/Recompose while the lens is v1 and shows an honest unavailable state. The writer's escape hatch works — selecting a current v2 lens clears the v1 pin and re-enables the semantic gears.

**A new cost rule.** Because `evidenceMode` joins `lexicalGravityConfigKey`, toggling Tell/Blend/Show invalidates a cached Preview and requires a fresh billable model call. Recovered pre-evidence v2 previews are exempt: their key is *rewritten* to the six-value form so the cache survives.

## 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** Activation. `initialize()` reads `current.json` through `readCurrentWithRecovery()`.

**Development.** The decode pipeline is now: envelope assert → **lenient** checkpoint shape → deep clone → integrity (legacy-tolerant) → **normalize** → **strict** current shape → **strict** integrity → envelope rebuild. Three of those steps are new at this layer. Widget grammar is dispatched per `widgetId`; Lexical Gravity's recognizer branches on `resolvedLens.version` and on whether the two new fields are present.

**Turn.** Two commitment points, and they are not the same moment.

The *semantic* turn is `buildLexicalGravityDirectiveFrame` dispatching to `buildLegacyLexicalGravityDirectiveFrame` when — and only when — `applicationMode === 'lexical' && lens.version === 1 && evidenceMode === 'blend'`. That is where the system decides what the restored conversation's model will be told. It is pinned by a string-equality test.

The *durable* turn is the first `markDirty` after successful hydration: `writeCurrent` + `updateNamed` write the normalized shape to both files in one ordered block. **After that, the v1 bytes are gone.** No backup copy is written. [Declared] The plan accepts this — notices describe in-memory restoration, and ordered autosave is the authority for committing.

**Ending.** The room opens. The coordinator holds the notice until a `WORKSHOP_REQUEST_SESSION` or `openNamed` drains it once, after session state has posted. The webview dedupes by `code:configId`, caps the queue at 8, and shows one at a time in the shared 2200 ms toast slot.

**Unresolved threads.**
- [Observed] Notices are drained at exactly two of roughly thirty `postSessionState()` call sites. If the writer never opens the Workshop panel this host session, the files converge and the notice dies with the extension host. The log line is the only surviving evidence.
- [Observed] `renameNamed` and `duplicateNamed` read through the recovery decode and write the normalized result, converting the file with no notice, no hydration, and no coordinator involvement.
- [Observed] `list()` normalizes every index-less file to build browser summaries and discards the notices, so a legacy checkpoint appears healthy before it is opened.

## 5. Codebase Genealogy & Controlling Precedent

**Controlling precedent, and a documented reversal.** ADR 2026-07-30 ("development checkpoints normalize; released codecs migrate") governs, and it was *pre-amended for this commit* in `d964b021` — the paragraphs delegating feature compatibility to "a closed registry of feature-owned codecs" did not exist before. ADR 2026-08-01 §6 flipped in the same parent commit. Two commits back, `37c9ed18` implemented the **opposite** answer to PR #110's F-03, complete with an in-file comment asserting that a v1 word field "cannot be defaulted into the required interpretive grammar honestly" and a test named `rejects pre-v2 Lexical Gravity drafts…`. This commit deletes that comment and rewrites that test in place. [Declared] The distinguishing fact is live evidence: a real checkpoint reached the predicted failure, and the decision owner chose salvage.

**Closest ancestors.** `GesturePlaygroundConfigCodec` is a true sibling — same directory shape, same two call sites, same five responsibilities. Notably this commit brings the *sibling up to the new pattern* rather than copying it: Gesture's two named booleans, previously translated into tokens by the central normalizer, become codec-owned codes behind the shared result contract. That is what makes the seam copyable.

**The permissive-read / strict-write asymmetry** existed as prose before this commit (a comment in `WorkshopSessionStateV1` and the ADR both assert it). This is the first time it is expressed as matched pairs of named functions at three altitudes: shape, state, and envelope. That is the most consequential structural precedent here.

**Consume-once ancestry.** Webview-side consume-once already exists three times, all single-slot clears. Host-side has no prior instance. The nearest host sibling is degraded conversations — idempotent getters replayed into every session-state payload. So this commit deliberately splits a previously unified answer to "hydration produced writer-relevant degradation": degraded conversations are *replayed state*, recovery notices are a *drained side channel*. Both now live in the same handler.

**The architecture guard did real work.** `boundaries.test.ts` holds two coupled invariants — every approved feature-naming surface must still exist and still use an allowed token, and the Prose Controller reproduction entries must *partition* the approved list. Moving the entry from the normalizer to the new dispatcher was therefore mandatory, not cosmetic, and the second edit is a forced consequence of the first.

**New precedent, ranked by copy-probability for Prose Controller.** (1) `WorkshopWidgetDraftRecoveryResult`. (2) The four-function codec surface — but shipped in **two incompatible realizations**: Gesture flips required/optional key lists inside one internal function behind a boolean; Lexical writes four separate shape functions and dispatches on version. A third widget has no tiebreaker. (3) The dispatcher switch arms. (4) `liftWorkshopWidgetRecovery`. (5) The end-to-end notice pipeline. (6) The discriminated draft union as the idiom for "the recovered shape is a first-class variant, not a nullable field." (7) An exported frozen copy of a prior renderer plus an equivalence test. (8) Writer-facing English frozen as a module constant inside an application-layer codec — no precedent in this repo for presentation copy at that altitude, though the plan's ownership ledger explicitly assigns it there.

**Conflicting authority.** Sprint 02D's "Closed dispatch" section says to extend this dispatcher "into the complete persisted-widget lifecycle registry," which implies Prose Controller adds arms here. This commit's own architecture-guard reason string says the file "grows only when a feature has a recognized prior draft," which implies the opposite. Two committed documents disagree; the diff does not resolve it.

## 6. Structural & Causal Map

```
activation ──► Coordinator.initialize()
                 │
                 ├─► store.readCurrentWithRecovery()  ─┐
                 │     readSessionFileExact             │  DOOR 1
                 │       decodeWorkshopPersistedSessionCheckpoint
                 │         envelope → lenient shape → clone → integrity
                 │         → normalizeWorkshopSessionCheckpointForHydration
                 │              └─► recoverWorkshopWidgetConfigCheckpoint  (closed switch)
                 │                     ├─ GesturePlaygroundConfigCodec
                 │                     └─ LexicalGravityConfigCodec  ──► notice
                 │         → STRICT current shape → STRICT integrity
                 │
                 ├─► store.readNamed(sessionId)   ← full decode, used only as a boolean probe
                 │
                 └─► hydrate(session, …, checkpointRecovery)
                       parseWorkshopSessionStateV1(persisted.workshop)   ← lenient shape again
                       renderStandingDirectiveFrames(workshop)  ★ model instructions decided
                       session.hydrateCommittedState(...)                 DOOR 2
                         normalize again (must be a no-op) → strict shape → strict integrity
                         → prepare → install                ★ live room replaced
                       pendingRecoveryNotices = [...checkpoint, ...hydration]
                       markDirty → writeCurrent + updateNamed             ★ v1 bytes gone

WORKSHOP_REQUEST_SESSION / openNamed
   → postSessionState() → postRecoveryNotices() → consumeRecoveryNotices()  (drain once)
      → WORKSHOP_SESSION_RECOVERY_NOTICE → useWorkshopSessions queue (dedupe code:configId, cap 8)
         → WorkshopApp effect → shared 2200 ms toast slot
```

**Dependency direction.** Infrastructure→application is *not* new — `WorkshopSessionStore` already imported `parseWorkshopPersistedSession`. What is new is the *character* of the work at that boundary: the store now runs domain normalization and strict current-shape assertion. Its own class comment still says it "does not hydrate a Workshop aggregate" — approximately but no longer literally true, since it does not *install* an aggregate but does *repair* one.

**Three normalization sites, not two.** Door 1 (store decode), Door 2 (`hydrateCommittedState`), and `restoreRollback`, which re-hydrates the exported prior aggregate, logs its codes, and discards its notices in favour of the captured ones. Because Door 1 already normalized, Door 2 must be a no-op. That invariant is real and tested for one codec on one arm — and is unstated at the type level.

## 7. Contracts, Invariants & Negative Space

**Preconditions.** Bytes within 25 MB exact / 5 MB browser bounds; bounded JSON nesting; exact envelope keys.

**Postcondition (strengthened).** The `workshop` state returned from any read door satisfies the strict *current* shape and strict integrity — stronger than before this commit.

**Invariants.**
- Only an exact, nameable prior shape recovers; unknown fields, malformed values, and unrecognized versions fail closed.
- A v1 lens can never appear under `interpret`/`recompose` — enforced both structurally (discriminated union) and dynamically (`shapeError('lexical for a recovered v1 lens')`).
- Widget dispatch is closed: `WorkshopWidgetId` has 13 members, 2 have codecs, the rest throw.
- Notices exist only after successful hydration; rollback captures and restores them.
- Normalization must be idempotent across doors.

**Negative space — what this commit deliberately does not do.** It does not touch writer-owned `prose-minion/lenses/*.json` bytes. It does not bump `schemaVersion` — the top-level session codec remains the public compatibility clock. It does not introduce a generic migration DSL or schema language (explicitly rejected in the plan's alternatives table as "a premature framework that would absorb feature meaning"). It does not implement Sprint 02D's four-operation lifecycle, promote the shared array/nullable-string primitives, or split structural from semantic validation. It does not add a backup copy before the one-way autosave.

## 8. Forces, Tensions & Design Tradeoffs

**Strictness vs. compatibility.** The core move is to *split the strictness axis in two* rather than weaken it: a lenient checkpoint shape, a strict current shape, and a deterministic function between them. That is the right shape for the force. The cost is that every shape assertion now exists in two flavours threaded by a boolean, and the "compatibility exception terminates at the migration boundary" rule is now true in two places, one of which is in infrastructure.

**Feature ownership vs. shared machinery.** Shared machinery is deliberately thin — a dispatcher and a 26-line result contract. The cost: the type naming all widget normalization codes is *derived structurally* via `ReturnType<typeof …>['normalizations'][number]` rather than declared. This widens automatically when a codec adds a code — convenient, and also removes the moment where a developer adding a code has to think about the logging and regression test that ADR 2026-07-30 requires of every normalization. [Inferred] Stan traces the derived form to the architecture guard's anchored token regex, which would reject an imported `GesturePlaygroundCheckpointNormalization`. Legible scar tissue, but it leaves two exported-but-unreferenced type names and a fork the next author must rediscover.

**Preserve verbatim vs. converge.** The design chose "preserve, conditionally," and three consequences fall out. (1) A v2 lens in `lexical + blend` gets the *new* lexical frame, so one gear renders two different texts depending on lens version. (2) A recovered config converges to the new frame the moment the writer touches evidence mode — the preservation guarantee is a *starting condition*, not a durable property, and this is stated nowhere in code. (3) The legacy renderer doubles as a *validator* inside the v1 shape check.

**Blast radius vs. the actual bug.** The commit ships a new required control that enters the config key, summary string, marker text, model payload, and shared system prompt for every configuration — plus a rewrite of the preview prompt's opening imperative and the model service user message. [Declared] R-05 justifies this as deliberate scope. A reviewer should nonetheless know the "recovery" commit also ships an authored feature and a prompt change affecting all users.

**Type-level honesty vs. branch complexity.** The illegal v1+semantic state is genuinely unrepresentable in the type. The cost is that "which lens is selected" is now a three-level `??`/ternary chain in the modal, and the disabled-gear rule lives in JSX rather than a named predicate.

**Alternate constructions.**

| Alternative | Buys | Costs |
|---|---|---|
| **Normalize in the coordinator, not the store** | One door instead of three; infrastructure stops repairing domain state; `list()`/`rename`/`duplicate` stop paying for and silently applying normalization; the store's class comment stays true | `list()` and `findNamedSession` must tolerate un-normalized state — probably fine, since they read only identity and summary fields |
| **Single door at `hydrateCommittedState`** | Removes the idempotency requirement entirely | Store loses the strict-current postcondition; `WorkshopPersistedSessionV1.workshop` becomes "possibly legacy," weakening every downstream type |
| **Explicit `draftVersion` on the widget draft** | Future recognition becomes a lookup, not structural archaeology | Does not help existing files, which is the whole problem; adds a second version clock the ADR warns against |
| **Do 02D now** | Third widget cannot half-implement; the boolean flag and derived union are replaced by a declared registry | Larger diff on an already-large commit; 02D is scheduled and blocking Sprint 03 anyway |
| **Ship `evidenceMode` separately** | Recovery commit reviewable on its own; the two-field v1 tolerance check gets simpler | Two persisted-shape bumps instead of one, and two rounds of fixture churn |

## 9. Failure, Recovery & Operational Truth

**Fail-closed behaviour is preserved and slightly widened.** Any throw inside `readSessionFileExact` becomes a `WorkshopSessionFileReadError`; `initializeOnce` catches, sets `currentCheckpointError`, and pauses rolling autosave so the file is not overwritten. The *set* of things that can throw at that boundary grew, because strict current-shape and strict integrity now run there too.

**The one-way door is the success case, not the failure case.** A successful recovery followed by the first `markDirty` converges both files to the recovered shape with no backup. Failure is safe; success is irreversible.

**Diagnostics.** Normalization codes are logged by name through the coordinator's existing `logCheckpointNormalizations`, merged and deduped across checkpoint and hydration. That is the durable operational evidence. The writer-facing evidence is a single 232-character message in a 2200 ms auto-dismissing shared toast slot, consumed at the moment the toast is *set*, not when it is seen, and never recorded anywhere the writer can consult later. The modal's inline `role="note"` — "Lens Logic is unavailable for this recovered word field" — is the only persistent trace, and requires reopening the widget.

**Silent-wrongness surfaces.** Three paths apply recovery without any notice channel: `renameNamed` (reads normalized, writes back), `duplicateNamed` (same), and `list()` (read-only, but presents a legacy checkpoint as healthy). The first two are writes to writer data.

## 10. Security, Trust & Misuse Surface

Low and mostly unchanged. The trust boundary is the workspace filesystem; there is no network, auth, or tenancy surface. Attacker-controlled input is a session JSON file the writer could equally hand-edit.

Two observations. First, the change *strengthens* the parse boundary: reads now enforce strict current shape and integrity that they previously did not, and every recovery arm uses `exactObject`, so unknown fields are rejected rather than carried. Second, `|` cannot be injected into `configKey`: `resolvedLens.slug` is constrained to kebab-case and must equal `lensSlug`. Directive text passes through `neutralizeReservedPersonaPromptDelimiters`, so a hostile lens cannot break out of the `<prose-directive>` frame.

The residual question is a data-integrity one rather than an attack one: recovery rewrites writer data on disk irreversibly, and two of the paths that do so have no notice.

## 11. Data, Time, Scale & Concurrency Horizon

**Per-activation cost.** [Observed] The real case was a 527 KB session. Following `initialize()`: `readCurrentWithRecovery` performs lenient shape, a full deep clone, integrity, normalize, strict shape, and strict integrity. Then `store.readNamed(current.session.sessionId)` runs the *entire pipeline again* on a second file of similar size — and uses only the resulting boolean. Then `hydrate` calls `parseWorkshopSessionStateV1` again, and `hydrateCommittedState` runs integrity, normalize, strict shape, and strict integrity once more. On the order of a dozen full-aggregate traversals and several deep clones before the room appears. Most of that predates this commit; this commit adds the normalize + strict-shape + strict-integrity triple at the store, and adds it twice because of the named-twin probe.

**Per-widget cost inside each pass.** `assertLexicalGravityLensShape` builds and measures a full reach-3 directive purely as a bounds check; the v1 arm does the same. On the already-current path, `normalizeLexicalGravityDraftForHydration` returns `cloneLexicalGravityDraft(value)` — and `liftWorkshopWidgetRecovery` then discards that clone because `normalizations.length === 0`. `cloneLexicalGravityDraft` itself clones `resolvedLens` twice for semantic gears.

**Browser listing.** `list()` is bounded to 200 files at 5 MB each. Modern files short-circuit on a bounded search index; index-less files — precisely the legacy ones — take the full recovery path with a directive render per widget config on every listing.

**Concurrency.** `consumeRecoveryNotices` is first-come and not idempotent across surfaces. No second consumer was found, but two live webviews (sidebar plus Workshop panel) would race.

**Unknown.** No wall-clock measurement exists in the diff for any of this.

## 12. The Change Genome: Variation & Reproduction

**Cousin: Prose Controller recovery.** The varied axis is *the shape of the recovered thing*. Lexical Gravity's draft is a fixed-arity record of scalars plus one embedded, version-stamped resource. [Declared] Prose Controller's is an open-ended, sparsely-populated map of craft chapters — diction, syntax, rhythm, density, figurative texture, narrative handling, punctuation — each independently resettable. It is the first case where "recognize only your own exact prior shapes" has no single `version` field to dispatch on.

| Contact point | Class | What varies |
|---|---|---|
| `WorkshopWidgetId`, dispatcher arms, `checkpoint: boolean` plumbing, `pendingRecoveryNotices`, drain sites, rollback, store | **reuse / extension** | Additive; the seam holds |
| Discriminated draft union | **fork** | Two arms on one discriminant does not model a product of N optional chapters |
| Per-widget checkpoint tolerance | **premature-generalization risk** | Two incompatible realizations ship together; no canonical model |
| `WorkshopWidgetRecoveryNotice` | **contradiction** | `configId` is stamped per config; two chapters recovering under one config with the same `code` collapse to one notice under the `code:configId` dedupe |
| Queue cap 8 / 2200 ms serial toast | **contradiction** | Sized for one notice per widget; per-chapter notices exhaust it inside a single config, and four notices is a nine-second sequence |
| `configKey` | **fork** | Pipe-joined fixed arity does not extend to a sparse map; a third and fourth legacy-key function would follow the existing precedent of one per historical arity |
| Frozen directive renderer + equivalence test | **extension** | Prose Controller has no shipped prior frame to compare against on day one |
| Renderability worst-case guard | **reuse with the same gap** | Prose Controller's worst case is combinatorial across chapters |

**Verdict.** The commit creates a genuinely generative pattern at the dispatcher and result-contract level, and a deliberately narrow special case at the Lexical Gravity codec level — which is appropriate. The premature-generalization risk is not that too much was abstracted; it is that *two* templates for the same job shipped in one commit with no tiebreaker.

**Copy pressure.** The four-function shape ladder, where each arm re-lists its own `exactObject` key set; the unnamed "validate as if migrated, then confirm the old identity" idiom in the pre-evidence arm; per-arity legacy key functions; frozen renderers that duplicate line-builders deliberately, with no marker distinguishing "shared because same computation" from "duplicated because must not drift."

## 13. Comparative Models & Borrowed Vocabulary

**Internal parallel — degraded conversations.** The nearest thing in this repo to "hydration produced writer-relevant degradation" is `getDegradedConversationKeys`/`getDegradedConversations`: idempotent getters replayed into every session-state payload. Recovery notices took the opposite design — a drained side channel. *Question it contributes:* what property of recovery makes it consume-once where degradation is replayed, and would a writer reading both surfaces understand why one persists and one vanishes?

**[Analogy] Chain of custody.** The vocabulary — provenance, custody, tamper evidence, reconstruction — fits a system that rewrites a writer's saved file. It asks: can a later investigator distinguish "this file was always in current form" from "this file was repaired on 2026-08-07"? Today, after the first converged autosave, they cannot: the normalization codes are in a host-session log that does not survive, the notice is consumed, and the file carries no marker of its own recovery. *Question it contributes:* should a recovered config carry a durable `recoveredFrom` provenance field, which would also let the modal explain itself without a message type, a queue, or toast timing?

**[Analogy] Aviation — the one-way door and the go/no-go criterion.** The failure envelope here is well designed: unavailable workspace, oversized file, and any decode throw all land in a protection that pauses autosave and leaves bytes untouched. What has no checklist is the *success* path, where the first autosave irreversibly discards the prior bytes. *Question it contributes:* recovery is a go/no-go decision made by code with no operator confirmation — is that right for a repair the writer cannot undo?

## 14. Creative Counterfactuals

**Inversion — pull instead of push.** Give the recovered draft a durable `recoveredFrom` marker and let the *modal* explain itself whenever the config is opened. No message type, no queue, no consume-once, no toast timing. The modal already renders almost exactly this text as an inline note. What does the push channel buy that the marker does not? Precisely one thing: it reaches a writer who never reopens the widget. What does the marker buy that the push does not? It survives past 2200 ms, survives a rename, and survives the writer being away from the panel.

**Deletion — remove `evidenceMode`.** The recovery arm hardcodes `'blend'` and would be unchanged. Dispatch collapses from four shape functions to two; the pre-evidence arm, the second key function, and one normalization code all disappear; the config key stays five-valued; ~20 fixture edits across 12 files vanish. What remains that recovery *needs*? Nothing. The two changes share a shape bump, not a dependency.

**Time-lapse — three lens versions, two persisted widgets, eighteen months.** The version × field-presence matrix becomes six routable arms, each with its own shape function and its own historical key function. `buildLexicalGravityDirectiveFrame` carries two frozen prior renderers, each frozen because the point is fidelity to what a chat was told. Meanwhile `LexicalGravityConfigCodec.ts` is already 1052 lines (from 659), and CLAUDE.md's rule — extract a widget-local codec "when a second widget makes the widget-config codec genuinely plural" — has just come true.

**Constraint swap — what if the release gate arrived tomorrow?** ADR 2026-07-30 says a Marketplace release migrates from *actual shipped* data and must not copy development normalizations into the formal migration. That schedules `assertLexicalGravityLegacyDraftV1Shape`, `WorkshopLexicalGravityLegacyLensV1`, `buildLegacyLexicalGravityDirectiveFrame`, `lexicalGravityLegacyV1ConfigKey`, and the recovery code for deletion — roughly 200 lines serving a handful of local checkpoints. Nothing in the code marks them as release-gate-scoped, and `WorkshopLexicalGravityResolvedLens` leaks into presentation, so the deletion will not be local.

**Boring alternative.** Hand-edit the one file. [Declared] Rejected in the plan's alternatives table: it loses a valid room or requires private JSON surgery, and does nothing for the next widget.

## 15. Evidence Confidence & Unresolved Questions

**Repository-grounded.** Everything in §§3–6 and §11 is read directly from the diff and the files at `HEAD`. Verification gates were run at this commit: `npx jest` 189 suites / 1973 tests passing; `npm run typecheck` clean across all three projects; `npm run lint` 0 errors, 931 warnings (repo-wide `curly`/naming baseline, 6 in new code following an existing pattern); `git diff --check` clean.

**Material inferences.** That Door 2 is empirically a no-op for every arm rests on one round-trip assertion on one codec. That `blend` reproduces the prior unconstrained renderer's behaviour is a reasonable prior that cannot be tested. That the derived `ReturnType<>` union exists because of the guard's anchored regex is inferred from the regex, not from a comment.

**Competing interpretations.** Whether this is a recovery commit carrying a feature, or a feature commit carrying recovery. Whether `WorkshopWidgetCheckpointRecovery.ts` is meant to stay recovery-only or absorb the full lifecycle — two committed documents disagree.

**Missing artifacts.** No fixture carries a standing directive or turn linkage alongside a recovered config. No negative test proves the lens repository is never touched during hydration. No wall-clock measurement. The 527 KB checkpoint cannot be committed, so the decisive witness is manual.

**Needs author or product confirmation.** Whether recovery-on-rename is intended. Whether the semantic-frame wording change (see §17 anchors) was intentional or collateral. Whether the parent sprint's F5 acceptance ran.

## 16. Past → Present → Horizon Synthesis

**Past.** Workshop sessions became a schema-versioned writer-data contract, then Conversation Widgets began evolving persisted draft shapes faster than a public version clock could track. ADR 2026-07-30 answered with a development-checkpoint normalizer, seeded by Gesture Playground's two late-added fields. Lexical Gravity then replaced its word-field lens with an interpretive grammar, and PR #110's review predicted — as F-03 — that a pre-v2 draft would reject a whole checkpoint. The first remediation kept strict rejection. Then the predicted file turned up on the author's own disk, and the decision reversed.

**Present.** Compatibility knowledge moves inside each feature, behind a closed dispatcher, with a shared result contract that separates machine codes from writer-facing English. The central normalizer ends this commit knowing nothing about lenses or gestures. The prior renderer is frozen and byte-compared, so a restored conversation's model is told exactly what it was told before. Alongside that, the obsolete shape's capability is promoted to a first-class `lexical` gear rather than disguised as a compatibility flag, and a genuinely orthogonal `evidenceMode` axis is added — a larger and independently reviewable change that shares the same shape bump. The forces this leaves tense: normalization now runs in infrastructure at three sites with an untyped idempotency contract; two incompatible checkpoint-tolerance templates ship together; and the debt Sprint 02D exists to pay grew in the sprint immediately before 02D runs.

**Horizon.** Near: the broken room opens and both files converge; every existing v2 config gains `evidenceMode` and a rewritten preview key; the shared preview prompt changes for everyone. Middle: Sprint 02D re-cuts the boolean mode flag, the derived union, and renderability-as-shape-check into a declared four-operation lifecycle — the seams are already visible. Then Prose Controller becomes the real test of whether the reproduction promise holds for a widget whose draft is a sparse map rather than a versioned record. Far: the first Marketplace release deletes the entire v1 recovery arm under the release gate, and nothing in the code currently marks which ~200 lines that is.

## 17. Runway Synthesis Brief

**Invariants the implementation must preserve.**
1. A recognized prior draft never bricks a room; an unrecognized one always fails closed and protects the file.
2. Recovery never invents semantics the writer did not select.
3. A restored room's standing directive matches what the retained conversation was built on.
4. Notices exist only after successful hydration and are delivered at most once.
5. Normalization is idempotent across all three doors.
6. Writer-owned `prose-minion/lenses/*.json` bytes are never touched by hydration.

**Anchors — concrete places worth revisiting.**
- `LexicalGravityDirective.ts:46-54` — the hoisted shared `lexicalField` block, and its wording against the same lines at `HEAD^`. Note the metaphor quote budget is 160 here while `promptBudgets.ts:239` admits 240 and `quote()` truncates silently.
- `LexicalGravityDirective.ts:61-64` — the three-condition gate onto the frozen legacy renderer.
- `LexicalGravityConfigCodec.ts:246-265` — the four-way checkpoint dispatch and its version × field-presence matrix.
- `LexicalGravityConfigCodec.ts:555-601` — the v1 recovery arm, including `preview?.sourceText ? … : undefined`.
- `LexicalGravityConfigCodec.ts:62-65` — the frozen writer-facing notice, and what it asserts about the preview.
- `assertLexicalGravityLensRenderable` (`LexicalGravityDirective.ts`) — pins `evidenceMode: 'blend'`; `assertLexicalGravityLegacyLensV1Shape` validates a frame with no evidence line at all.
- `WorkshopWidgetCheckpointRecovery.ts:28-34` (derived union), `:91-112` (`liftWorkshopWidgetRecovery`, and the discarded clone).
- `WorkshopSessionStore.ts:307-328` (`renameNamed`) and `WorkshopSessionPersistenceCoordinator.ts:470` (`duplicateNamed`).
- `WorkshopSessionPersistenceCoordinator.ts:236-241` — the named-twin existence probe.
- `WorkshopPersistedSession.ts:144-178` — the `as string` casts reintroduced by splitting the envelope assertion.
- `WorkshopApp.tsx:240-256` — toast timer and recovery effect.
- `useWorkshopSessions.ts:240-258` — dedupe key and the cap-8 newest-drop.
- `WorkshopLexicalGravityModal.tsx:233-272` — lens resolution, the v1 pin, and where `draft` becomes `undefined`.
- `boundaries.test.ts` — the two coupled guard invariants and the changed reason string.

**Tensions (real tradeoffs, not defects).** Feature ownership vs. a forcing function for logging and tests. Preserving the prior frame vs. one gear rendering two texts. Thin shared machinery vs. two templates with no tiebreaker. Recovery scope vs. the authored feature riding along.

**Unknowns.** Whether the real 527 KB checkpoint round-trips. Whether Door 2 is empirically silent for every arm. Whether any pre-evidence v2 `interpret`/`recompose` checkpoint exists in the wild. Wall-clock activation cost. Whether recovery-on-rename is intended.

**Legitimate variation points.** Per-widget recognition strategy; notice copy; whether a codec emits a notice at all; the dispatcher's arm count.

**Predicted pressures.** Near: preview-cache churn and prompt-behaviour change across all existing configs. Middle: Sprint 02D re-cutting these seams; Prose Controller's sparse-map draft stressing the union, the key, and the notice granularity. Far: release-gate deletion of the v1 arm, which is not marked as such and leaks into presentation.

**Questions for the panel.**
1. The shared `lexicalField` block hoisted v1's phrasing into the v2 semantic frame. Compare `LexicalGravityDirective.ts:46-49` against the same lines at `HEAD^`. What changed for an existing `interpret`/`recompose` config, and is the metaphor budget change from 240 to 160 reachable given validation still admits 240?
2. `renameNamed` and `duplicateNamed` read normalized state and write it back. Trace whether a notice can ever fire for a config recovered on those paths.
3. Door 2's no-op requirement is tested for one codec on one arm. What would a non-idempotent codec produce, and would any test catch it?
4. `assertLexicalGravityLensRenderable` pins `evidenceMode: 'blend'`; the v1 lens validator renders a frame with no evidence line. Is a lens admitted at the budget boundary provably renderable at every setting a writer can select?
5. The recovery notice is a frozen constant asserting the saved preview "were preserved," while the v1 arm drops a preview lacking `sourceText`. Trace when the message is false.
6. Two checkpoint-tolerance templates ship together (Gesture's boolean-flagged key sets; Lexical's version-branching ladder). Which should Prose Controller copy, and does anything in the code say?
7. Sprint 02D's "Closed dispatch" and this commit's architecture-guard reason string make opposite claims about whether the dispatcher grows for Prose Controller. Which is authoritative?
8. On the already-current path, `liftWorkshopWidgetRecovery` discards a deep clone that `normalizeLexicalGravityDraftForHydration` just built. Quantify per activation and per `list()`.
9. The named-twin probe at `Coordinator.ts:239` runs a full decode for a boolean. What is the cost on a ~527 KB file?
10. For a recovered v1 config whose slug matches a built-in v2 lens, what does the Library tab show, and does the highlighted tile correspond to the active lens?
11. Fitness witnesses 1 and 8 (directive/turn-linkage fixture; lens-repository non-invocation) appear unmet. Search the evidence pack before concluding either way.
12. `evidenceMode` enters `lexicalGravityConfigKey`, invalidating preview caches for every existing config. Is the pre-evidence arm's key *rewrite* (rather than invalidation) safe, given the directive text gains a `BLEND` line the cached preview was never generated under?

**Do not overread.**
- Infrastructure→application is **not** a new dependency arrow; the store already imported from that layer. The change is in the *character* of the work, not the direction.
- The recovery toast does **not** starve behind ordinary toasts: the existing timer clears any toast after 2200 ms, which re-fires the effect. The concern there is dwell time and durability, not liveness.
- The cap-8 queue drops the **newest** notice, which satisfies the plan's stated requirement that the *first* of several must not be discarded.
- Several oversized files (`LexicalGravityConfigCodec.ts`, `WorkshopLexicalGravityModal.tsx`, `WorkshopSessionPersistenceCoordinator.ts`) were already over the 500-line guideline before this commit. Growth is in scope; existence is inherited.
- F-07 and F-09 from the PR #110 ledger are explicitly **Planned — Sprint 02D**, not silently ignored. Whether this commit *enlarged* them is a fair question; whether they should have been fixed here is not.
---

# Part II — The Review

## Executive Briefing

**Verdict:** Needs rework — the recovery core is sound and well-guarded, but this commit changed what the model is told in more places than it accounted for, and the tests assigned to catch exactly that cannot fail.

- 🟠 **F-01 · Hoisted shared block rewrote the semantic gears' standing instruction** — every existing `interpret`/`recompose` room now receives lexical-register wording and loses the "interpretive grammar remains active" clause, against a plan line stating those gears retain their frame. The commit's own edited system prompt still states the old rule. Restore the semantic arm's two lines or declare the convergence intentional, and pin the frame text with a test.
- 🟠 **F-02 · Rename and duplicate irreversibly convert a checkpoint with no notice** `🧭 Corroborated Runway` — a metadata operation now rewrites writer bytes and guarantees the recovery notice can never fire afterward. At `HEAD^` this path threw and the file was protected. Decide whether recovery may commit outside hydration; at minimum surface the decode's notices.
- 🟠 **F-03 · The v1 frame equivalence test is a tautology** — it asserts `g(x) === g(x)` for the one draft shape where the dispatcher returns the legacy builder. It guards the plan's R-02 High risk and cannot fail for that purpose. Pin one side to a frozen expected string.
- 🟠 **F-04 · The Library tile marked selected is a different lens than the one in force** — all six v1 built-in slugs are byte-identical to the v2 ones, so this is the default case. The writer is told to choose a current lens, clicks the tile that already looks chosen, and their preserved vocabulary is replaced with no confirmation. Compare identity, not slug.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | **B+** | The strictness split is genuinely well-drawn and worth copying; the guard entry describing it is wrong, and the repairing-read boundary needs an owner. |
| Critical Correctness — Blake | **B−** | No non-idempotent path across all four dispatch branches; one newly-reachable irreversible write that previously threw. |
| Edge Cases — Sam | **B−** | Dispatch matrix and idempotency hold under pressure; the modal's lens-identity break is the default case, not a corner. |
| Code Quality — Parker | **B−** | Working and legible in the large, but a hoist merged two decisions into one array and one rule is spelled five ways. |
| Tests — Cal | **C+** | Real contract tests for Gesture parity, notice ordering, and dual-write convergence; the single test guarding the commit's own top risk is a tautology, and witness 1 is unbuilt. |
| Codebase Fit — Stan | **B** | The seam is genuinely copyable and the central normalizer is now feature-free; two templates ship without a tiebreak and one guard string is stale. |
| Performance — Tim | **A−** | Costed honestly: two suspected hot spots dismissed on the arithmetic, one real redundancy named at the right severity. |
| Security — Patricia | **A** | Parse boundary measurably tightened; no reachable injection, frame escape, or path to writer lens files. |
| Observability — Oliver | **C+** | Codes are logged by name on the intended path; three paths repair with no signal at all, and nothing durable survives the host session. |
| Domain Logic — Bria | **B−** | Locked decisions faithfully implemented; one plan clause contradicted and the writer-facing notice can be false. |

## Findings

### F-01 · 🟠 High — The hoisted `lexicalField` block rewrote the semantic gears' own instructions

**Raised by:** Bria, Parker
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective.ts:47` — `` `Weight: ${draft.weight}/100. Let this field influence diction and imagery at that intensity without making every sentence announce the lens.` ``
**Affected contract:** Business / model-instruction — the standing directive every `interpret` and `recompose` configuration sends

The v1 lexical frame and the v2 semantic frame ended their weight/reach/metaphor blocks with lines that *looked* alike, so this commit hoisted them into one shared `lexicalField` array spread into both arms. Two of those lines were deliberately different.

At `HEAD^` the semantic frame said `Let the interpretive grammar influence prose at that strength or frequency` and, for `metaphorPull: false`, `off — avoid explicit cross-domain comparison; the interpretive grammar remains active`, quoting the metaphor at 240 characters. After the hoist, every existing `interpret` and `recompose` configuration sends the lexical phrasing instead — "this field," "prefer lexical influence over explicit comparison" — inside a gear whose declared purpose (`:96`) is using the semantic map as a composition plan. The assurance that the interpretive grammar survives metaphor-off is simply gone.

The plan is explicit at `.todo/epics/epic-conversation-widgets-2026-07-22/sprints/02b-b-widget-codec-recovery-mode.md:169`: *"`interpret` and `recompose` retain the strict v2 semantic-first frame,"* sanctioning exactly one addition — the evidence instruction. This is broader than that.

Two corroborating artifacts. First, this commit's own edited system prompt still states the abandoned rule: `packages/core/resources/system-prompts/lexical-gravity/01-preview.md:31` — *"When metaphor pull is off, avoid explicit cross-domain comparison while retaining the interpretive grammar."* Two model-facing surfaces now instruct differently on the same control. Second, `quote(lens.metaphor, …)` dropped 240 → 160 in the semantic frame while `packages/core/src/shared/constants/promptBudgets.ts:239` still admits `lexicalPhraseCharacters: 240`, and `quote()` truncates silently — built-in lenses all sit under 160, so this bites model-generated project lenses only.

Searched the diff and the full `__tests__` tree for an assertion pinning the semantic frame's `Weight:` or `Metaphor pull:` text — not found. The only frame assertions are `toContain('Application gear: LEXICAL.')` and `toContain('Evidence mode: BLEND.')`. That is why 1973 green tests coexist with a changed prompt for every existing semantic configuration.

**Recommendation:** Confirm whether the convergence was intended. If not, keep `lexicalField` as the lexical gear's block and restore the semantic arm's two lines verbatim from `HEAD^`, including the 240 metaphor budget. If it was intended, say so in the commit and update `01-preview.md:31` to match. Either way add a wording assertion for the semantic frame, and reconcile `quote(lens.metaphor, 160)` with `lexicalPhraseCharacters: 240`.

---

### F-02 · 🟠 High — `renameNamed` and `duplicateNamed` irreversibly convert a checkpoint with no notice, no log, and no hydration `🧭 Corroborated Runway`

**Raised by:** Marcus, Blake, Oliver, Patricia
**Discovery:** 0 independent · 4 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts:309` — `const found = await this.requireNamedSession(sessionId, paths);` feeding `:319-326` — `const decoded = this.validateSessionForWrite(updated);` → `writeSnapshotWithSearchIndex(..., true)`
**Affected contract:** Data / ownership — which component may durably transform a writer's saved session

This commit repointed `readSessionFileExact` from `parseWorkshopPersistedSession` to `decodeWorkshopPersistedSessionCheckpoint` (`WorkshopSessionStore.ts:695`), so every exact read now returns the *recovered* aggregate. `renameNamed` — a pure metadata operation the writer initiates from the browser — reads through that path and writes `found.session` straight back over the same file. `requireNamedSession` returns `{session, normalizations, recoveryNotices}`; `renameNamed` reads only the first. `duplicateNamed` has the same shape one layer up: `WorkshopSessionPersistenceCoordinator.ts:470` calls `store.readNamed`, which is literally `(await this.readNamedWithRecovery(sessionId))?.session`.

No notice can fire on these paths. `pendingRecoveryNotices` is assigned in exactly two places, both inside `hydrate`/`restoreRollback` (`:725`, `:935`), and drained at exactly two call sites (`WorkshopSessionMessageHandler.ts:125`, `:214`). Per Rule C, the logging owner was checked: `logCheckpointNormalizations` (`:942`) is reached only from `hydrate` and `restoreRollback`; the store's own `LogSink` is used solely by the `skip()` helper. So there is no toast, no notice, no Output line, and nothing in the file.

Then the second-order effect: once the file is converted, the next open normalizes to a no-op, so the writer can never learn about it afterward. The repair erases its own evidence.

This is newly reachable. At `HEAD^`, `parseWorkshopSessionStateV1` called the strict `assertWorkshopSessionStateShape`, whose `assertWidgetConfig` dispatched to a strict `assertLexicalGravityDraftShape` requiring `applicationMode` and a v2 lens — carrying the comment *"ADR 2026-08-01 section 6 deliberately rejects pre-v2 development checkpoints."* A v1-lens draft threw, rename failed, and the bytes were protected. This commit converts a loud failure into a silent one-way rewrite.

The concrete loss goes beyond shape: the v1 arm drops a preview lacking `sourceText` (`LexicalGravityConfigCodec.ts:573`), so rename also deletes billable, non-reproducible model output. Searched `WorkshopSessionStore.test.ts` and `WorkshopSessionPersistenceCoordinator.test.ts` for a rename or duplicate case carrying a legacy draft — not found; the existing rename tests all use current-shape sessions.

**Recommendation:** Decide first whether recovery may commit outside hydration. Smallest coherent repairs, in preference order: (a) have `renameNamed` write only title/`updatedAt` onto the un-normalized decoded envelope; (b) refuse to write when `found.normalizations.length > 0` and direct the writer to open the session first; (c) return `found.recoveryNotices` so the coordinator can log and notify before the file converges. Whichever is chosen, update the class comment at `WorkshopSessionStore.ts:4-9`, which still states a contract the class no longer honors.

---

### F-03 · 🟠 High — The v1 frame equivalence test is a tautology

**Raised by:** Cal
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.test.ts:271-277` — `expect(buildLexicalGravityDirectiveFrame({ id: 'pd-legacy', revision: 1 }, result.draft)).toBe(buildLegacyLexicalGravityDirectiveFrame({ id: 'pd-legacy', revision: 1 }, result.draft));`
**Affected contract:** Test contract guarding the plan's R-02 High risk — *"recovery silently changes the instructions used in the original chat"*

`result.draft` is `applicationMode: 'lexical'` with a v1 lens and `evidenceMode: 'blend'` — exactly the three-condition gate at `LexicalGravityDirective.ts:61-63` that makes `buildLexicalGravityDirectiveFrame` **return** `buildLegacyLexicalGravityDirectiveFrame(directive, draft)`. The assertion is `g(x) === g(x)`.

It is worth having as a dispatch witness, and it does prove the routing arm. But it cannot fail for the job the plan's fitness witness 2 assigned it: comparison "to the implementation at the Sprint 02B-B base." The frozen renderer was verified faithful *today* by diffing it against the real v1 renderer at `eeded7da` — same lines, same order, same 160-character metaphor budget. Nothing keeps it that way. `buildLegacyLexicalGravityDirectiveFrame` shares `quote`, `terms`, `SUBSTITUTION_KEYS`, and `assertDirectiveBudget` with the live v2 renderer in the same file. Change `terms` from `slice(0, 5)` to `slice(0, 6)` to widen the v2 vocabulary lines and every restored conversation's standing frame changes with it — both sides of the `.toBe` move together and the suite stays green.

Searched the whole `__tests__` tree for any literal assertion on frame text (`prose-directive`, `Metaphor pull:`, `Gradient:`, `Useful substitutions:`, `toMatchSnapshot`) — not found.

The missing confidence is the one invariant the entire 200-line legacy arm exists to hold: *the restored room's model instructions still match what the retained conversation was built on.*

**Recommendation:** Replace the self-comparison with an anchor the code cannot move — one `toMatchInlineSnapshot` or a literal template on `buildLegacyLexicalGravityDirectiveFrame({ id: 'pd-legacy', revision: 1 }, v1MusicDraft)`. Keep the existing `.toBe` as the dispatch witness and relabel it as such.

---

### F-04 · 🟠 High — The Library tile marked "selected" is a different lens than the one in force

**Raised by:** Sam
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx:237` — `if (extraLens?.version === 2) {bySlug.set(extraLens.slug, extraLens);}` with `:650` — `` className={`pm-ws-lg-lens…${candidate.slug === lens?.slug ? ' is-selected' : ''}`} ``
**Affected contract:** Writer-data — the recovery notice's promise that the writer's vocabulary was preserved

This is the default case, not a corner. The v1 built-in slugs at `bd441611` are `photography, music, mathematics, weather, botany, architecture` — byte-identical to today's v2 built-in slugs. Every recovered v1 config that used a built-in lens has a `lensSlug` that also names a live v2 lens.

Trace: the modal opens on a recovered config and `setExtraLens(draft.resolvedLens)` (`:216`) holds the v1 lens. Line 237 refuses to admit it to `bySlug`, so `availableLenses` contains the v2 built-in of the same name. Line 240 then pins `lens = extraLens` — the v1 one. Line 650 highlights by *slug*, so the v2 tile renders `.is-selected` while the lens actually in force, the one feeding `directivePreview` at `:274`, is the v1 word field. Directly beneath, `:711-713` instructs the writer: *"Lens Logic is unavailable for this recovered word field… Choose or rebuild a current lens."*

The writer follows that instruction and clicks the tile that already looks chosen. `selectLens` (`:374-381`) runs `setExtraLens(undefined)` for a built-in, and the preserved v1 vocabulary is gone from the draft — replaced by the v2 rewrite of the same slug, preview invalidated, no confirmation, and the tile's appearance does not change because it was already highlighted. Apply writes it; the next autosave converges both files with no backup.

This commit introduced the break. Before it, `extraLens` was always v2 and always entered `bySlug`, so `candidate.slug === lens.slug` implied `candidate === lens`. Lines 237 and 240 are both new and they sever that implication while leaving the slug-equality highlight in place.

**Recommendation:** Compare identity rather than slug — `candidate === lens` — or guard the highlight with `lens?.version === 2` so no tile is marked selected while a recovered word field is pinned. Optionally label the colliding tile as a replacement so the click reads as the destructive act it is.

---

### F-05 · 🟡 Standard — The recovery notice asserts the saved preview was preserved when it was discarded `🧭 Corroborated Runway`

**Raised by:** Parker, Bria, Cal, Oliver, Blake, Sam
**Discovery:** 0 independent · 6 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:64` — `message: '… Its vocabulary, weight, reach, metaphor behavior, and saved preview were preserved. …'` against `:573` — `preview: preview?.sourceText ? { … } : undefined`
**Affected contract:** Writer-facing communication — the only push-channel evidence recovery produces

`LEXICAL_GRAVITY_RECOVERY_NOTICE` is a frozen constant emitted unconditionally by the v1 arm (`:596`), while the arm immediately below drops the preview whenever `sourceText` is falsy.

The severity of that pairing is higher than "optional field absent" suggests. At `bd441611` — the genuine v1 release — the preview shape was `exactObject(draft.preview, path, ['configKey', 'text'])`. `sourceText` is not present at all, not even as an optional key. So for the *oldest* checkpoints, precisely the ones most likely to need recovery, the discard is the common case and the message is reliably false. The notice also fires unchanged when the v1 draft carried no preview at all.

The machine channel is no better: both branches emit the same two normalization codes (`:594-597`), so the Output line reads identically whether the preview survived or not. A writer who reopens the widget finds an empty preview pane (`WorkshopLexicalGravityModal.tsx:210`) after being told, in the only message they will ever see, that it was kept — and regenerating costs a billable model call.

Searched the diff and the whole `__tests__` tree for a v1 preview fixture without `sourceText` — not found. All four preview fixtures in the codec test supply it, so the falsy arm has zero coverage.

Note the plan authored both halves of this contradiction — §2 says "an old Preview without enough source identity is discarded as derived cache" and also supplies this exact notice text — so the copy decision belongs to the decision owner, not to a unilateral edit.

**Recommendation:** Make the sentence honest by construction. Cheapest: drop the preview clause from the shared message. Better: emit two notice variants from the `preview?.sourceText` ternary that already decides, and a distinct normalization code for the discard so the log can tell the branches apart. Add a regression test on the `{configKey, text}` shape to pin both.

---

### F-06 · 🟡 Standard — Preview caches are preserved by relabeling their key, not by proving equivalence `🧭 Corroborated Runway`

**Raised by:** Tim, Blake, Patricia, Sam
**Discovery:** 1 independent · 3 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:613` — `configKey: lexicalGravityConfigKey({ … evidenceMode: 'blend', … })`
**Affected contract:** Data — cache validity; `configKey` is the only thing binding a cached preview to the configuration that produced it

`assertCurrentLexicalGravityPreview` (`:396-406`) treats `configKey` equality as proof that a stored preview belongs to the current configuration, and a mismatch is fatal to the whole room. The pre-evidence arm does not invalidate a stale preview — it *mints* the six-value key for it, making that assertion vacuously true while `preview.text` is untouched. The v1 arm does the same one degree harder, stamping `version: LEXICAL_GRAVITY_PREVIEW_VERSION` onto a preview whose original shape had no version field at all (`:575`).

The generating conditions changed in this same commit on both sides. `LexicalGravityModelService.ts:104` now sends `evidenceMode` in the model payload, and `01-preview.md` gained an entire evidence-mode section plus a rewritten opening imperative. A preview generated under the old prompt is now stamped as the current preview for `…|blend|…`, and the modal will not regenerate it because the key matches — `invalidatePreview()` only fires on a control *change*, and hydration is not one.

The cost motive is sound and worth crediting: dropping every preview would cost one billable call per config per writer, and the strict shape check would otherwise reject the room. The objection is narrower — everywhere else in this codec a mismatched key is fatal *precisely because* it suggests the artifact does not describe the configuration; here a known mismatch is papered over. This applies to every existing v2 config on disk, not only recovered ones.

**Recommendation:** Pick one and state it. Either drop the preview in both arms — consistent with how the v1 no-`sourceText` path already behaves — or keep the rewrite and carry a staleness marker so the modal can offer "generated before evidence mode — regenerate to see the current setting." At minimum, record the decision in a comment at `:610` so a future reader does not mistake the rewrite for an invariant.

---

### F-07 · 🟡 Standard — Nothing durable records that a repair occurred

**Raised by:** Oliver
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/workshop/WorkshopSessionMessageHandler.ts:231` — `for (const notice of this.persistence.consumeRecoveryNotices()) {`
**Affected contract:** Operational — the writer-visibility requirement the notice channel exists to satisfy (plan R-03)

`extension.ts:262` awaits `initialize()` at activation, which decodes, recovers, hydrates, and calls `markDirty('resume marker')`. Both files converge to the recovered shape with no backup, before any webview exists. The notices then wait for a drain that only happens if the writer opens the Workshop panel. If they never do, the queue dies with the extension host. If they do, `useWorkshopSessions.ts:289` returns `persistedState: {}` — notices are explicitly not persisted — and `WorkshopApp.tsx:249-254` consumes the notice at `setToast` time rather than when it is read, clearing it 2200 ms later.

So the durable evidence is one Output-channel line that vanishes on host restart, and the file carries no marker. A month later neither the writer nor a debugger reading `current.json` can tell whether that config was authored in its current shape or reconstructed by code. The one persistent trace is the modal's inline note — which requires reopening the widget and disappears the moment the writer updates the lens, which is exactly what the notice tells them to do.

Severity note: the plan's locked decision 6 explicitly accepts that notices describe in-memory restoration and that ordered autosave is the authority for committing, so the absence of a backup is a decision, not an oversight. What the plan does not address is the absence of any durable marker. Graded Standard on that basis; it compounds F-02, where no notice fires at all.

**Recommendation:** Stamp the recovered draft with a provenance field (`recoveredFrom: 'lexical-gravity-v1'` plus an ISO date) inside the recovery arm. It survives the host session, survives rename and duplicate — closing F-02's writer-facing half for free — lets the modal explain itself without depending on toast timing, and gives a future debugger a byte-level answer.

---

### F-08 · 🟡 Standard — The architecture guard's reason string contradicts what the dispatcher actually does

**Raised by:** Marcus, Stan
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:534` — `reason: 'checkpoint recovery dispatch grows only when a feature has a recognized prior draft'`
**Affected contract:** Test / architecture documentation — the guard ledger is the repo's executable change-cost fixture for the next standing feature

`WorkshopWidgetCheckpointRecovery.ts` holds three switches, not one. `assertWorkshopWidgetDraftShape` (`:36`) is the always-on **current** shape dispatch, reached on every strict read, and `recoverWorkshopWidgetConfigCheckpoint` (`:70`) runs unconditionally for every config during normalization. Both `default:` arms throw. Only `assertWorkshopWidgetDraftCheckpointShape` is recovery-specific. Prose Controller must therefore add three arms here even if it ships with zero prior drafts — the opposite of what the entry authored in this commit asserts.

Stan settled what the runway had left open as a document conflict: ADR 2026-07-30, amended in the parent commit, describes a closed registry owning "exact prior-shape recognition, deterministic repair, **current-shape validation**, and semantic integrity," and `02d-widget-persistence-grammar-and-integrity.md:89-94` says to extend it into the complete lifecycle registry. The code agrees with the ADR. The guard's reason string is the lone outlier — and it is the artifact someone will read when sizing Sprint 03. The partition test passes either way, so nothing catches it.

The root is a naming mismatch: the module is named for recovery but owns the mandatory current-shape dispatch too.

**Recommendation:** Move the entry from `PROSE_CONTROLLER_INAPPLICABLE_SURFACES` to `PROSE_CONTROLLER_GENERIC_SEAM_ENTRIES` — one arm per generic seam is exactly what this file now is. Alternatively split the module so the recovery-only switch is genuinely recovery-only.

---

### F-09 · 🟡 Standard — The named-twin probe pays a full decode to compute a boolean

**Raised by:** Tim
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:239` — `if (await this.store.readNamed(current.session.sessionId)) {`
**Affected contract:** Operational — Workshop-panel-open latency

The probe is inherited; `HEAD^` calls `readNamed` at the same spot and discards everything but truthiness. What this commit changed is the cost. `readNamed` funnels through `readSessionFileExact`, now repointed to `decodeWorkshopPersistedSessionCheckpoint`, which adds normalization, strict current-shape assertion, and a second integrity pass. Counted on the observed ~527 KB lineage, the commit adds roughly three full shape traversals, two integrity passes, and two normalization rebuilds per activation — two of each landing on a file the coordinator never reads a field from. That call also runs full widget recovery and discards the notices.

Honest calibration: at N = 1 file this is tens of milliseconds, not seconds, and it does not block activation. It is named because the multiplier is now attached to a call whose entire output is `!== undefined`, and because the cheap primitive already exists next door — `requireNamedSessionPath` (`:384-405`) confirms named identity from the bounded search index under a comment saying exactly that. Searched the diff and evidence pack for a wall-clock or benchmark measurement — not found.

**Recommendation:** Add a `namedSessionExists(sessionId)` that resolves identity through the search index and falls back to a full read only for index-less files, and point `:239` at it. Deferred is defensible; the probe stops scaling with transcript size for one method.

---

### F-10 · 🟡 Standard — The derived normalization union removes the forcing function the ADR requires

**Raised by:** Stan
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetCheckpointRecovery.ts:28-34` — `export type WorkshopWidgetCheckpointNormalization = | ReturnType<typeof normalizeGesturePlaygroundDraftForHydration>['normalizations'][number]`
**Affected contract:** Maintenance — ADR 2026-07-30's requirement that each normalization be "logged by name, and covered by a regression test"

`GesturePlaygroundCheckpointNormalization` and `LexicalGravityCheckpointNormalization` are declared, exported, and — verified by grep across `packages` and `apps` — referenced only inside their own modules. The obvious composition is blocked by this file's own guard entry: `collectWorkshopFeatureSemanticOccurrences` (`boundaries.test.ts:293-306`) extracts those identifiers as whole tokens and `matchesApprovedFeatureToken` anchors the allowed-token regex, which admits `…ConfigCodec`, `assert…Draft(Checkpoint)?Shape`, and `normalize…DraftForHydration` but not `…CheckpointNormalization`.

The tell is that the author *edited that very regex in this commit* to admit two new function-name families, but routed around it for the type. The result is a member of `WorkshopSessionCheckpointNormalization` that widens silently while every sibling arm is a hand-written string literal. Adding a normalization code inside a codec now touches no central file at all — removing precisely the moment the ADR wants a developer to stop and add the log line and regression test. Whichever way Prose Controller goes, this is the copy target.

**Recommendation:** Add `(?:GesturePlayground|LexicalGravity)CheckpointNormalization` to the allowed token at `boundaries.test.ts:350` and declare the union from the two named types. Same coupling, visible to the guard, with a declaration point. Otherwise remove the two orphaned exports so the next author is not offered a path that fails the build.

---

### F-11 · 🟡 Standard — Fitness witness 1 is unmet: no fixture links a recovered config to a standing directive `🧭 Corroborated Runway`

**Raised by:** Cal, Bria
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistenceCoordinator.test.ts:361-372` — `checkpoint.workshop.widgetConfigs = [{ id: 'wc-1', widgetId: 'lexical-gravity', revision: 1, createdAt: now.getTime(), draft: {...} }]` with no `directiveId` and no `standingDirectives`
**Affected contract:** Acceptance criteria — plan witness 1 and the "config/directive/turn linkage remains coherent" invariant row

Witness 1 requires a session carrying the v1 config **and a standing directive** that hydrates with "transcript, config id, **directive id**, and conversation archive intact," and the §4 invariant table demands "a realistic `wc-N` / `pd-N` / turn linkage fixture." All three recovery fixtures added by this commit carry a bare `widgetConfigs` entry with no `directiveId`, no `standingDirectives` array, and an empty conversation archive. Searched every test file containing a legacy v1 lens fixture against every file containing `standingDirectives` — the two sets do not intersect.

The consequence is specific. `renderWorkshopStandingDirectiveFramesFromState` is called during hydration at `WorkshopSessionPersistenceCoordinator.ts:659`; with an empty `standingDirectives` array it maps over nothing. So the frozen v1 renderer is reached only by direct unit call — never once through the hydration path that actually produces what the model is told, and never with the linkage the strict integrity pass validates. A v1 config that never had an installed directive also never influenced a chat; the shape the plan set out to salvage has no automated witness at all.

Witness 8 (lens repository never invoked during hydration) is **not** raised. Patricia verified `LexicalGravityLensRepository` is imported only by the handler, the contracts file, the barrel, and `extension.ts`, with no reference anywhere in the decode/normalize/hydrate chain — the invariant holds structurally, which is stronger than a negative-call test would be. Cal independently declined it as coverage theater.

**Recommendation:** Extend the existing coordinator fixture rather than adding a suite: set `directiveId: 'pd-1'` on `wc-1`, add a matching `standingDirectives` entry and one archived conversation, then assert both survive hydration and that the hydrated frame starts with the legacy opening. That single fixture edit converts witnesses 1 and 2 from unproven to proven, and pairs naturally with F-03's fix.

---

### F-12 · 🟡 Standard — One domain rule spelled five ways in the modal

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx:742` and `:751` — `disabled={previewControlsLocked || lens?.version !== 2}`
**Affected contract:** Maintenance — the gear-gating rule's single source of truth

"A v1 lens cannot use the semantic gears" now appears five times in three spellings: `lens.version === 2` in the draft ternary at `:260`, `lens?.version === 2` at `:708`, `lens?.version !== 2` at `:742` and `:751`, and `lens.version === 2 && applicationMode !== 'lexical'` at `:885`. None names the rule, so a reader reconstructs it from a version literal in JSX five separate times, and a sixth author adding a semantic-only control has nothing to grep for.

The draft construction at `:248-270` compounds it: the `lexical` and `version === 2` arms build character-identical seven-field object literals. Those eight duplicated lines exist purely to give TypeScript two narrowing sites for the discriminated union, but nothing says so, so they read as two configurations that merely happen to agree. The type-level honesty of the union is genuinely good — this is the accidental complexity it charged for, and it can be paid down without giving it up.

Inherited context per Rule G: this file was already 927 lines and over the guideline before the commit; it grew by 138 here. The finding is the new expression of the rule, not the file's size.

**Recommendation:** Introduce one named predicate near the lens resolution — `const semanticGearsAvailable = lens?.version === 2;` — and use it at all five sites. Then lift the draft construction into a small named function with early returns so the narrowing survives and the field list is written once.

---

### F-13 · 🔵 Nit — Redundant deep clones on the common path

**Raised by:** Tim
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:730` then `:742` — `resolvedLens: cloneLexicalGravityResolvedLens(draft.resolvedLens)` … `resolvedLens: cloneLexicalGravityLens(draft.resolvedLens)`
**Affected contract:** Maintenance

`common` computes `cloneLexicalGravityResolvedLens`, which for `version === 2` delegates straight to `cloneLexicalGravityLens`. The semantic branch then overwrites that property with a second call to the same function on the same input; the first clone is garbage. This is new — `HEAD^`'s `cloneLexicalGravityDraft` cloned once. It is a type-narrowing artifact, not a deliberate copy.

Magnitude is honestly negligible: roughly 150 small allocations, a few times per activation. It is worth naming because it sits beside a second discarded clone — `WorkshopWidgetCheckpointRecovery.ts:100-102` returns the original `config` when `normalizations.length === 0`, throwing away the clone `normalizeLexicalGravityDraftForHydration` just built. On the overwhelmingly common already-current path, the codec's contract says "here is a defensive copy" and the dispatcher's says "I didn't need one." Both are precedent Prose Controller will copy verbatim.

**Recommendation:** Lift `resolvedLens` out of `common` and set it once per branch. Separately, either have the normalizer return `value` unchanged on the no-normalization arm or have `liftWorkshopWidgetRecovery` always use `result.draft` — pick one and let the contract say which.

---

### F-14 · 🔵 Nit — The notice code drops the `-widget-` infix its sibling codes carry

**Raised by:** Stan
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:63` — `code: 'recovered-lexical-gravity-v1',` versus `:69` — `| 'recovered-widget-lexical-gravity-v1';`
**Affected contract:** Operational / diagnostic vocabulary

Six lines apart, two strings for the same event, differing by one token. Every other widget-origin code carries `-widget-`: `defaulted-widget-dictionary-sharing`, `defaulted-widget-source-references`, `defaulted-widget-lexical-gravity-evidence-mode`. The infix is what distinguishes them from session-level codes like `restored-undelivered-withdrawal`. The notice code is the one exception, and it is load-bearing — it is half the webview dedupe key `${code}:${configId}` (`useWorkshopSessions.ts:241`). An operator correlating an Output line against a toast reads two codes and reasonably wonders whether they are two events.

**Recommendation:** Rename the notice code to `recovered-widget-lexical-gravity-v1` so notice and normalization share one identifier, and update the four test assertions. Alpha rules apply — no shim needed.

---

### P-1 · 💚 Praise — Splitting the strictness axis instead of weakening it

**Raised by:** Marcus
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts:53-73` — `assertWorkshopSessionStateShape` / `assertWorkshopSessionCheckpointShape` both delegating to one `assertWorkshopSessionShape(value, checkpoint)`

The obvious move under this pressure is to loosen the existing assertion until the broken file passes. Instead the commit keeps the strict assertion intact, adds a *named* lenient twin beside it, defines a deterministic function between them, and re-asserts the strict form after normalizing. The property this protects is that tolerance never leaks past the migration boundary: there is exactly one place where a legacy shape is legal, and it has a name. That pairing now exists at three altitudes — shape, state, envelope — which is what makes the ADR 2026-07-30 rule mechanically checkable rather than aspirational. Copy it verbatim for Prose Controller.

---

### P-2 · 💚 Praise — Validate → transform → re-validate on every recovery arm

**Raised by:** Patricia
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:552` / `:592` — `assertLexicalGravityDraftCheckpointShape(value, …)` … `assertLexicalGravityDraftShape(draft, 'Recovered Lexical Gravity draft')`

Every recovery arm proves the shape before reading fields and proves the *output* shape before returning it. `decodeWorkshopPersistedSessionCheckpoint` then re-asserts strict current shape and strict integrity on top — a genuine strengthening of the read boundary, since `readSessionFileExact` previously ran neither. Unknown widget ids throw rather than pass through, and `exactObject` on every arm means a crafted file cannot smuggle an unknown field into the aggregate. Three specific attack shapes were checked and found unreachable: `|` injection into `lexicalGravityConfigKey` (slug is pinned to kebab-case and forced equal to `lensSlug`), `<prose-directive>` frame escape (every lens-derived value passes through `neutralizeReservedPersonaPromptDelimiters`, and the one raw interpolation `directive.id` is constrained to `/^pd-(\d+)$/` by an integrity check this commit newly runs at the store boundary), and any path from hydration to `prose-minion/lenses/*.json`. Keep the output re-assertion when Prose Controller copies this seam; it is what makes an under-specified recovery arm fail closed instead of minting an illegal draft.

## What the Panel Changed About the Runway

**Affirmed.** The structural map, the three-door normalization account, the ownership ledger, and the identification of `renameNamed`/`duplicateNamed` as un-notified conversion paths all held under independent tracing. Marcus and Oliver each confirmed the store's class comment is now false for repair and that `logCheckpointNormalizations` is unreachable from those paths.

**Refined.** Three runway framings were sharpened by evidence the runway did not have. The `lexicalField` hoist is not a wording question — it deleted a semantic-gear clause and contradicts a plan line and the commit's own edited system prompt. The Library slug collision is not a corner case — all six v1 built-in slugs are byte-identical to the v2 ones, making it the default. The preview `sourceText` gap is not an optional-field edge — the original v1 release never wrote the field at all, so the discard is the common case for the oldest checkpoints. Oliver added one the runway missed entirely: `hydrate` merges checkpoint and hydration codes through `unique([...])` before logging, erasing door attribution, so a future non-idempotent codec would have no observable violation mode.

**Rejected.** Several runway suspicions did not survive contact. The prompt-budget renderability guard is safe — Sam and Patricia independently *measured* the worst rendered frame (13.5k and 15.2k respectively against a 16,000 budget, with the `blend`→`show` delta a flat 85 characters), so a lens admitted at the boundary is provably renderable at every setting a writer can select. Blake traced all four dispatch branches and found no non-idempotent path. The `as string` casts the runway flagged are validated upstream by `assertWorkshopPersistedSessionEnvelope`. Tim costed the `list()` path and the per-shape directive renders and found both microseconds against the `JSON.parse` that already dominates. Stan rejected the claim that writer-facing copy in an application-layer codec lacks precedent — `WorkshopGesturePlaygroundHandler` and `WorkshopContextIntakeService` are established siblings. And the runway's open question about which checkpoint-tolerance template Prose Controller should copy was declared not material: `03-prose-controller.md:41` already defers the copyable lifecycle to Sprint 02D.

**Still unknown.** Whether the real ~527 KB checkpoint round-trips — the decisive witness cannot be committed and is unrecorded. Whether the parent sprint's F5 acceptance ran; its status line still reads "pending" and this commit does not update it.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A read that repairs is a write with better manners

**Illuminated by:** F-02 (Marcus, Blake, Oliver, Patricia), F-07 (Oliver), F-06 (Tim, Blake, Patricia, Sam)

The moment a decode path is allowed to fix what it finds, every caller of that path becomes a mutation site — including the ones whose names promise otherwise. `renameNamed` is a metadata operation; nobody auditing this change would have listed it as a place where a writer's file gets converted. The tell is structural: the repair lives in the read, the *notice* lives in one specific caller, so any other caller performs the repair silently by construction. Worth noticing too that a repair which is idempotent is also a repair that erases its own evidence on the second pass — the property that makes it safe to re-run is the property that makes it impossible to detect later.

**Carry forward:** When a repair moves onto a read path, enumerate every caller of that read and ask which of them a user would describe as *"I didn't change anything."* Those callers either need the repair suppressed, or need to carry the same disclosure the intentional path carries.

### Lesson — Similar text is not shared knowledge

**Illuminated by:** F-01 (Bria, Parker), F-04 (Sam), F-06 (Tim)

Three findings, three altitudes, one habit: something looked the same, so it was treated as the same. Two directive frames ended with lines of near-identical wording — but two of those lines were decisions, and hoisting them into one `lexicalField` array quietly overwrote the semantic gears' own instructions. Six lens slugs were byte-identical across v1 and v2 — but slug was never the identity; *version* was, and the Library now highlights a tile that isn't the lens in force. A cache key was rewritten so it would match — but the key was standing in for "this preview was generated under this config," and relabeling it asserted an equivalence nobody checked. Deduplication is only safe when the duplicates represent one piece of knowledge; when they represent two decisions that currently agree, merging them deletes the ability to ever disagree again.

**Carry forward:** Before hoisting two similar blocks, diff them and ask of each difference: *is this drafting drift, or is this a decision someone made?* If any difference is a decision, name the axis that separates them instead of merging on the overlap.

### Lesson — A frozen copy needs a witness that isn't a copy

**Illuminated by:** F-03 (Cal), F-11 (Cal, Bria)

Freezing the v1 renderer so a restored conversation hears what it heard before is exactly right. But the test guarding that freeze compares the dispatcher's output to the legacy builder for a draft whose gear makes the dispatcher *call* the legacy builder — `g(x) === g(x)`. It cannot fail, and the two sides will move together forever if a shared helper is retuned. This is the general shape: an equivalence test between two expressions that share an implementation proves routing, never fidelity. Fidelity needs an anchor outside both — a literal expected string, a committed golden fixture, bytes captured from the released version. And the second half of the same job, witness 1, asks for that renderer exercised through hydration with a standing directive attached, because the frame alone isn't what the model hears.

**Carry forward:** For any equivalence assertion, ask *what single edit would make this test go red?* If the honest answer is "an edit to both sides at once," one side must be pinned to something the code cannot move.

### Lesson — Prose about behavior has no compiler

**Illuminated by:** F-01 (Bria, Parker), F-05 (Parker, Bria, Cal, Oliver, Blake, Sam), F-12 (Parker), F-06 (Tim)

A single behavior here is described in at least five places that no tool cross-checks: the directive frame, the preview system prompt at `01-preview.md:31`, the metaphor quote budget in validation, the writer-facing recovery notice, and the cache key that claims a preview is still current. This change edited some and not others, so `01-preview.md` now states the rule the frame abandoned; the notice promises a preserved preview that the arm below it discards; validation admits 240 quote-characters the prompt now caps at 160. None of that can produce a type error or a failing test — the drift is invisible to every mechanical check in the repo. And F-12's five bare `version === 2` literals are the same phenomenon in code: an unnamed rule can't be searched for, so the sixth site will be written without the check.

**Carry forward:** When you change a rule that models or users are *told* about, grep for the rule's other spellings before you commit — and prefer one source with the rest derived, so the next edit can only be made in one place.

### Lesson — A guard that grows by itself has stopped guarding

**Illuminated by:** F-10 (Stan), F-08 (Marcus, Stan), and the counter-example in P-1 (Marcus)

The normalization union derives itself via `ReturnType<typeof …>` while every sibling arm is a declared literal. That difference isn't cosmetic: the declaration was a tripwire. ADR 2026-07-30 wants a developer adding a normalization code to stop at a central file and be reminded to add the log line and the regression test. Auto-widening removes the stop. Worse, the derived form exists specifically to satisfy the architecture guard's token regex — the friction was routed around rather than answered, and the guard's own new reason string now describes a role the dispatcher no longer plays. This same commit shows the better instinct in P-1: under pressure to weaken a strict assertion, it kept the strict form and added a *named* lenient twin with a deterministic function between them. That's what answering friction looks like instead of dissolving it.

**Carry forward:** When a type, a lint, or a guard resists your change, treat the resistance as the feature and ask what ritual it was protecting — and if a guard's justification string no longer matches what the module does, fix the string in the same commit that changes the role.

*The most instructive thing about this change is that its gaps sit precisely where its own unusually good plan stopped being executable: the locked decisions became code, and the eleven fitness witnesses stayed prose — which is worth sitting with, because a witness you write down but don't build reads, on the second pass, exactly like a witness you satisfied.*

## Horizon Watchlist

These are future pressures, not merge blockers.

- **Release-gate deletion scope.** ADR 2026-07-30 schedules `assertLexicalGravityLegacyDraftV1Shape`, `WorkshopLexicalGravityLegacyLensV1`, `buildLegacyLexicalGravityDirectiveFrame`, `lexicalGravityLegacyV1ConfigKey`, and the recovery arm for deletion at the first Marketplace release — roughly 200 lines serving a handful of local checkpoints. Nothing marks which lines those are, and `WorkshopLexicalGravityResolvedLens` leaks into presentation, so the deletion will not be local to the codec.
- **Prose Controller's draft is a sparse map, not a versioned record.** The discriminated union, the pipe-joined `configKey`, and the per-config notice granularity (`code:configId` dedupe, queue capped at 8) all assume a fixed-arity draft with one notice per config. A widget recovering per *chapter* would exhaust the queue inside a single config and collapse distinct notices under one key.
- **Two checkpoint-tolerance templates now exist** — Gesture's boolean-flagged key sets and Lexical's version-branching ladder. Sprint 02D is chartered to pick one; until it does, the third widget copies whichever file it opens first.
- **F-07/F-09 debt grew in the sprint immediately before the sprint that pays it.** Three config-key builders and the correlation rules now inside `assertCurrentLexicalGravityPreview` are both in Sprint 02D's declared scope; worth confirming that scope still covers the enlarged surface.
- **Door attribution in logging.** `unique([...])` merges checkpoint and hydration codes before logging, so Door 2 ceasing to be a no-op would produce no distinguishable signal. Worth a `door=` qualifier when a third codec lands.
- **`LexicalGravityConfigCodec.ts` is now 1052 lines**, up from 659. CLAUDE.md's rule about extracting a widget-local codec "when a second widget makes the widget-config codec genuinely plural" has arguably just come true.

## The Closer

🔮 **Fortune cookie**

*You built a vault so the conversation would hear the same words twice — then changed the words on the other side of the room, and asked a mirror to check.*

## Final Assessment

**Needs rework**, with a short and well-defined list. The recovery machinery itself is sound: the strictness split is the right shape and worth copying, every arm validates in and out, no dispatch branch is non-idempotent, the security boundary measurably tightened, Gesture parity is clean, and the dual-write convergence has a real integration witness.

The rework is concentrated in one theme rather than scattered: this commit changed what the model is told in more places than it accounted for. F-01 rewrote the semantic gears' standing instruction against an explicit plan clause and left the commit's own system prompt contradicting it; F-06 relabeled preview caches as current under a prompt that changed in the same breath; F-03 means the test assigned to catch exactly this class of drift cannot fail; and F-11 means the frozen renderer is never exercised through the path that produces what the model actually hears. Those four are one repair, and fixing F-03 and F-11 together makes F-01 regression-proof.

F-02 is independent and should be decided before merge: a rename is not consent to rewrite a file, and this one now does — silently, irreversibly, on a path that threw at `HEAD^`. F-04 is a small diff (compare identity, not slug) guarding against a writer being walked into deleting the vocabulary the feature just preserved.

Everything else is legitimately deferrable, and two items — the guard reason string (F-08) and the derived union (F-10) — are worth fixing now only because they are one-line changes that will otherwise be copied verbatim by the next persisted widget.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
