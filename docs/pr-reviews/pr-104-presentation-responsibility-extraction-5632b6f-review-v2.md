# MR Review v2 — refactor(workshop): extract presentation responsibilities

**Author:** okeylanders · **PR:** [#104](https://github.com/okeylanders/prose-minion-vscode/pull/104) (Open)
**Branches:** `sprint/workshop-architecture-refactor-03-presentation` → `epic/workshop-architecture-refactor`
**Base:** `4d88d35` · **Head:** `5632b6f`
**Reviewed:** 2026-08-04 · **Mode:** Full (Semantic Runway + 4 scouts + 10 specialists + Sensei)

> Sprint 03 of the seven-sprint Workshop architecture epic (after #101 fitness witnesses,
> #102 feature slices, #103 shared ownership). Six architecture runway documents already
> existed for this change; this review **consumed** them as declared intent rather than
> re-deriving them, and then tested their claims against the code. Where the runway was
> wrong, the panel corrected it — see *What the Panel Changed About the Runway*.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | `workshopStyles.test.ts` fuses a spent migration receipt to a durable guard; the two assertions are mutually unsatisfiable | Marcus, Cal, Stan | 1 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — receipt split onto frozen `PRE_SPLIT_ASSEMBLY` + retirement header |
| F-02 | 🟡 Standard | The room/sessions seam is re-erased at the call site by a spread merge; the honest exit costs 33 reads, not 255 | Marcus, Parker | 0 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — 33 session reads re-pointed to `workshopSessions.`; merge deleted |
| F-03 | 🟡 Standard | `controllers/` is a new hook category with no written contract; 3 of 27 `hooks/domain/` hooks skip persistence and the transport-free property is unguarded | Marcus, Stan | 0 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — persistence declared on all three + transport guard + CLAUDE.md |
| F-04 | 🟡 Standard | A widget config with an unrecognized id settles silently — no surface, no toast, no log on either side | Oliver (Blake dissents on reachability) | 1 runway-prompted | — | **Addressed** — `else` arm toasts and warns; verified by new test |
| F-05 | 🟡 Standard | The D4 composition guard recognizes only one import syntax; four other CSS-injection forms pass it | Sam | 1 independent | — | **Addressed** — regex widened, exemption pinned by path, six-form table test |
| F-06 | 🟡 Standard | The session-settle effect has five `ok` guards and one fixture; four mutants survive (verified) | Cal | 1 independent | — | **Addressed** — `ok:false` fixtures added; mutant re-run now fails (verified) |
| F-07 | 🟡 Standard | The extraction's residual risk — ~40 rewired props — has no witness, automated or manual | Cal, Bria | 2 independent | 🎯 Consensus | **Addressed** — StrictMode wrapper + assertion crossing the session controller |
| F-08 | 🟡 Standard | The sprint record diverges from shipped code in two places (re-pin audit entry; unrecorded second cascade deviation) | Bria | 1 independent | — | **Addressed** — both deviations recorded; re-pin entry corrected; criterion 6 rewritten |
| F-09 | 🟡 Standard | `beginReplacement` mutates three fields and snapshots two; `errorMessage` never comes back | Blake (Oliver dissents on priority) | 1 runway-prompted | — | **Addressed** — `errorMessage` added to snapshot and restored |
| F-10 | 🟡 Standard | `acceptSessionConfirm(): 'paste'\|'choose'\|undefined` carries three meanings in one unnamed union | Parker | 1 runway-prompted | — | **Addressed** — `WorkshopSessionConfirmResumption` named |
| F-11 | 🔵 Nit | `onError` inline arrow re-runs the widget correlation effect per streaming chunk — newly introduced, not inherited | Sam, Tim | 2 independent | 🎯 Consensus | **Addressed** — `handleWidgetOpeningError` memoized |
| F-12 | 🔵 Nit | Type re-export shims kept alive by three test files; two doc comments stranded from their definitions | Parker, Bria | 0 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — re-exports deleted, doc comments moved to definitions |
| F-13 | 🔵 Nit | Newly-authored relative imports where all four same-subtree siblings use aliases | Stan | 1 independent | — | **Addressed** — converted to `@hooks/*` aliases |
| F-14 | 🔵 Nit | Two integrity guards moved without their why-comments | Patricia | 1 independent | — | **Addressed** — both why-comments restored at their new homes |
| F-15 | 🔵 Nit | `WorkshopThread`'s memo defeated per chunk by two inline arrows (inherited; ~71 µs/turn/chunk in jsdom) | Tim | 1 independent | — | **Deferred** — inherited, measured, not this PR's debt |
| P-01 | ⭐ Praise | Stylesheet split verified safe in ways the hash cannot prove | Blake | 1 independent | — | N/A — preserve |
| P-02 | ⭐ Praise | All eight failure paths kept their voices across the move; two became explicit injected ports | Oliver | 1 independent | — | N/A — preserve |
| P-03 | ⭐ Praise | The replacement port is tested from both ends against each other, not against itself | Cal | 1 independent | — | N/A — preserve |
| P-04 | ⭐ Praise | The merge costs 1.3 µs — 0.04% of the render it sits in | Tim | 1 independent | — | N/A — preserve |

### Post-review verification (2026-08-04, fixes staged on top of `5632b6f`)

All 14 actionable findings addressed; F-15 correctly left deferred. Re-verified independently:

- `npm test -- --runInBand` — 175 suites, **1,847** tests (+11), 1 snapshot, all pass.
- `npm run typecheck` — clean on all three projects. ESLint on touched paths — 0 errors.
- **F-06 mutant re-killed:** deleting `.ok &&` at `useWorkshopSessionSurfaces.ts:97` previously left all 519 presentation tests green; it now fails a test.
- **F-03 guard bites:** injecting `useVSCodeApi` into `useWorkshopContextSheet.ts` now fails the new `boundaries.test.ts` transport case.
- **F-05 guard bites:** the widened `CSS_MODULE_REFERENCE` is itself covered by a six-form table test.
- `CLAUDE.md` is a symlink to `.ai/central-agent-setup.md`, so the controller-category paragraph landed in the governing doc as intended.

Two residuals, neither reopening a finding:

1. The room hook is now assigned to a variable named `workshop` (not `workshopRoom`), which keeps the 222 room reads churn-free but leaves the variable name one step behind the hook name.
2. The three controllers now declare `persistedState` but are **not** composed into `usePersistence` (`WorkshopApp.tsx:313-324`), while all ten other persistence-declaring hooks are. Behaviorally identical today — all three are `{}` — but a future controller that gains a persisted field would be silently dropped. Either compose them or record that controllers declare-but-don't-compose.

## Review coverage

- **Read fully:** `WorkshopApp.tsx` (both revisions), `useWorkshopRoom.ts`, `useWorkshopSessions.ts`, all three controllers, `useWorkshopAppMessageRouter.ts`, `workshopStyles.test.ts`, `boundaries.test.ts`, `WorkshopApp.test.tsx`, all five new hook/controller tests, the sprint doc, the Sprint 03 runway (559 lines), the deferred tech-debt entry.
- **Diff reviewed:** all 33 files. CSS verified by hash rather than by reading 6,367 lines.
- **Independently executed:** full suite (175 suites / 1,836 tests / 1 snapshot — pass), `typecheck` (3 projects — clean), ESLint over touched paths (0 errors), CSS reassembly + SHA-256, a live mutation experiment on `useWorkshopSessionSurfaces.ts:97`, brace-balance and at-rule scans on all 8 stylesheets, hook-return key-collision analysis, and read-count attribution across the merged aggregate.
- **Not reviewed:** the 6,367 moved CSS lines individually (byte identity proven instead); host-side `WorkshopHandler.ts` beyond the two paths Blake and Oliver traced.
- **Unavailable:** the interactive visual pass — the one piece of evidence nothing here can substitute.


---

# Part I — Semantic Runway

## Semantic Runway — refactor(workshop): extract presentation responsibilities

**PR:** #104 · **Author:** Okey Landers · **Branches:** `sprint/workshop-architecture-refactor-03-presentation` → `epic/workshop-architecture-refactor`
**Merge base:** `4d88d35` · **Head:** `5632b6f` · **Evidence date:** 2026-08-04
**Blast radius:** 33 files, +5,525 / −3,457. Presentation layer only. Zero message types, payloads, routes, schemas, handlers, or `extension.ts` changes. `apps/vscode-extension` untouched.

**Runway thesis.** This is the third sprint of a seven-sprint architecture epic, and it is the one that touches what the writer actually sees. It splits the repository's two hottest files and its largest stylesheet along ownership lines, under a self-imposed constraint that not one rendered pixel may move. The interesting question is not whether the split is correct — it demonstrably preserves behavior — but whether the *witnesses* the sprint built to prove that preservation are the witnesses the codebase will still want in three months, and whether two seams the split newly made visible (a cross-hook rollback port, and a widget-opening if-chain) are named after stable concepts or after today's two cases.

---

### 1. Working Definition & Real Job

**Literal code change.** One 1,036-line React hook becomes two (`useWorkshopRoom` 830, `useWorkshopSessions` 262). One 1,767-line component sheds three state machines into a new `hooks/domain/workshop/controllers/` directory and lands at 1,479. One 6,367-line stylesheet becomes seven files imported in a pinned order from a single composition point. Seven test files are added or re-pointed, two of them architecture witnesses.

**Functional capability.** None. No new user-facing behavior, by design.

**Operational/maintenance problem.** `WorkshopApp.tsx` and `useWorkshop.ts` carried 77 and 41 commits since 2026-05-01 respectively (verified via `git log --since`). Every Workshop feature, every bug fix, and every review finding for three months landed in the same two files, plus one stylesheet that had accreted five chronological banner tiers. The declared success metric is a *reviewer* metric: "a reviewer names the owner of any Workshop UI action from the filename alone" (`docs/architecture/2026-08-04-workshop-sprint-03-presentation-runway.md:224`).

**What the structure emphasizes.** Ownership by workflow, not by layer. The three controllers are named for what the writer does (`SessionSurfaces`, `ContextSheet`, `WidgetOpening`), not for what React feature they use.

**What it suppresses.** Line count. `WorkshopApp.tsx` fell only 16% (1,767 → 1,479), against the runway's own stated ≈900–1,050 target (`runway:94`) and the repo's 500-line God Component threshold (`CLAUDE.md`, Anti-Pattern Checklist). The epic explicitly forbids "arbitrary line-count target or cosmetic file splitting" (`epic-workshop-architecture-refactor.md:49`), so this is a defensible suppression — but the sprint doc checks criterion 1 without stating the residual.

**What must survive any valid alternative.** Host-owned durable truth (the webview persists nothing); the empty-persistence contract; the assembled CSS cascade byte-for-byte; every existing behavior in the 1,115-line combined hook suite; and the writer's ability to recover a thread when the host rejects a room replacement.

**Competing interpretation.** A reader could see this as *preparation for Sprint 04's host-side decomposition* rather than as presentation cleanup in its own right — the room/sessions vocabulary is a naming bid on `WorkshopHandler.ts` (2,995 lines), which Sprint 04 must split next. Under that reading the merge at `WorkshopApp.tsx:205` is scaffolding, not a shape. The sprint documents don't say which reading is intended.

> This MR is not merely a file split. Its real job is **relocating ownership of Workshop's presentation workflows and stylesheet cascade so the next six sprints have named seams to work against**, while preserving **host-owned durable truth, the writer's visible room, and every assembled byte of CSS.**

---

### 2. Declared Intent, Observed Behavior & Open Meaning

The sprint doc's verification claims are unusually checkable, and I checked all of them:

| Claim (`sprint:99-110`) | Independent result |
|---|---|
| 175 suites / 1,836 tests / 1 snapshot pass | **[Observed] Exact match.** |
| `npm run typecheck` — three TS projects | **[Observed] Clean.** |
| Focused ESLint, zero errors | **[Observed] 0 errors.** 39 warnings, all pre-existing convention noise in untouched files. |
| Byte-identical stylesheet assembly | **[Observed] Independently confirmed.** Reassembling the seven files in declared order and hashing gives `64783db8…92db2d`, identical to `shasum` of `git show epic/…:workshop.css`. The pinned constant is not self-referential. |
| Interactive visual pass **not** performed | **[Declared, and left unchecked at `sprint:123-125`.]** |

**Alignment.** D1–D4 all landed as accepted. `useWorkshop` is genuinely gone — `git grep` finds it only in a non-existence assertion (`boundaries.test.ts:362`) and as a locally-defined test helper. The 1,115-line combined suite kept all 39 `it(` blocks across the rename.

**Gaps between declared and observed:**

1. **[Observed]** The filename-first audit at `sprint:94-95` says shelved-passage re-pin lives in "the explicit scope-transition callbacks in `WorkshopApp.tsx`." The scope-transition callbacks (`WorkshopApp.tsx:568-575`) are `setSessionScope` only; `repinExcerpt` comes from `useWorkshopRoom.ts:383` and is passed through unwrapped at `:931` and `:1050`. The audit entry points where the thing isn't.
2. **[Observed]** Three modal components now import and re-export their own prop-union types *from* the controllers that drive them (`WorkshopTextSheet.tsx:27-33`, `WorkshopGesturePlaygroundModal.tsx:38-41`, `WorkshopLexicalGravityModal.tsx:28-35`). Neither the sprint doc nor the runway mentions this transfer of prop-contract ownership.
3. **[Observed]** The runway's target diagram (`runway:162-168`) placed `standingDirectiveRail.css` before the two feature stylesheets; it ships after, matching measured byte order. Correct — but the sprint records the context/session swap as a deviation (`sprint:79-82`) and not this one.
4. **[Observed]** The runway's own cousin-feature reproduction test (`runway:397-407`) returns verdict **Passes** with a shared-file list omitting both `workshopStyles.test.ts` and `WorkshopApp.test.tsx`. §12 below shows that omission is material.

**[Unknown]** Whether `hooks/domain/workshop/controllers/` is a permanent third hook category. The distinction "presentation controller ≠ domain hook" appears exactly once, in the runway's Reader Terms appendix (`runway:537`), marked `proposed`. `CLAUDE.md` is not amended by this PR.

---

### 3. Business Story & Rulebook

**Actors.** The **writer** is the subject — a novelist talking to an AI collaborator about a passage, in a Marketplace-published extension where a lost thread is a lost draft. They gain nothing from this PR and must lose nothing. The **maintainer** is the beneficiary. **Okey** is the sole authority; he cleared the D1–D4 gate and owns the one unchecked box.

**Trigger and preconditions.** None user-facing. The change is triggered by maintenance cost, and its precondition is Sprint 02's merge (`4d88d35`) plus a declared feature freeze on Workshop until Sprint 07.

**Rules preserved (all verified as moved verbatim or provably equivalent):**

| Rule | New home |
|---|---|
| Session is host truth; webview persists nothing durable | `useWorkshopRoom.ts:239`, `useWorkshopSessions.ts:51` (`Record<string, never>`) |
| Only the newest session-browser response paints | `useWorkshopSessions.ts:166-169` |
| A filtered browser search must not erase the active room's name | `useWorkshopSessions.ts:176-187` |
| A late attachment reply never paints into a reopened sheet | `useWorkshopContextSheet.ts:170-173`, double-guarded by `useWorkshopRoom.ts:441-446` |
| A widget-config reply is matched on both `responseId` and `config.id` | `useWorkshopWidgetOpening.ts:133-153` |
| Only one of {menu, save modal, browser} is open | `useWorkshopSessionSurfaces.ts:135-150` |
| Verified excerpt provenance survives only while the applied text still equals what the host verified | `useWorkshopContextSheet.ts:137-143` |
| A hand-pasted shelved passage confirms before it is overwritten | `useWorkshopContextSheet.ts:92-106` → `useWorkshopSessionSurfaces.ts:180-182` |

**Rules newly implied, not declared.** That a "presentation controller" is exempt from the Tripartite Hook Interface. That a component's prop-union type may be owned by its driving hook. That the assembled Workshop cascade is frozen at its Sprint-03 bytes.

---

### 4. Narrative Flow — the rejected New Session

This is the one workflow whose contract crosses the new seam, so it is the runway's spine.

**Beginning.** The writer has a live room. They click New Session, or press Cmd/Ctrl-Shift-N (`useWorkshopSessionSurfaces.ts:222-227`). The shell's `hasReplaceableSessionState` (`WorkshopApp.tsx:429-433`) decides whether this is a question or an action.

**Development.** They accept. `acceptSessionConfirm` (`:184-199`) clears the dialog and calls `resetSession()`, crossing into `useWorkshopSessions.ts:101-107`: set `sessionActionPending = 'new'`, call `roomReplacement.beginReplacement()`, post `WORKSHOP_RESET_SESSION`. The port (`useWorkshopRoom.ts:542-548`) snapshots `{turns, totalTurns}`, clears `errorMessage`, and empties the visible thread. **The writer's screen goes blank optimistically.** The snapshot now lives in `pendingResetRollbackRef` inside a *different* hook than the state it protects.

**Turn.** The host says no. `useWorkshopSessions.handleSessionActionResult` (`:192-227`) sees `action === 'new' && !ok` and calls `restoreReplacement(snapshot)` back into the room. `activeNamedSessionSummary` is cleared only on `ok` (`:218-220`) — a rejected reset does not orphan the session name.

**Ending.** `sessionActionResult` lands in state; the surfaces controller's settle effect (`:92-126`) fires `onResult` → red toast; no modal closes; `consumeSessionActionResult()` clears the slot. The writer sees their thread back.

**Unresolved threads.**
- `beginReplacement` clears three things and snapshots two. `errorMessage` is blanked with no path back. **[Observed]** Parity with pre-split code.
- `restoreReplacement` can overwrite a fresher `WORKSHOP_SESSION_STATE` that landed mid-flight, contradicting the authority comment at `useWorkshopRoom.ts:611-613`. **[Observed]** Also parity — but the invariant and its only violator now live in different files, past a port signature that cannot express "only if nothing fresher landed."
- Double `resetSession`: **[Observed] UI-unreachable.** `roomMutationLocked` includes `sessionActionPending !== undefined` (`WorkshopApp.tsx:380-381`) → `sessionMutationsDisabled` → `newSessionDisabled` (`:831`), and the keyboard path re-checks the same gate (`useWorkshopSessionSurfaces.ts:224`). The ref-overwrite hazard exists in principle and is gated in practice.

---

### 5. Codebase Genealogy & Controlling Precedent

**Controlling precedent 1 — Tripartite Hook Interface, scoped by directory.** `CLAUDE.md` says "**Location:** All domain hooks in `packages/core/src/presentation/webview/hooks/domain/`." All 18 sidebar hooks and all 6 workshop-tree hooks return `persistedState`; three (`useWorkshopRoom.ts:239`, `useWorkshopSessions.ts:51`, `useWorkshopExcerptVerify.ts:43`) express "nothing to persist" as `Record<string, never>` + `{}`. The three new controllers sit inside that directory and return `State & Actions` only. **The repo already has an idiom for the empty case, used twice in this very PR.**

**Controlling precedent 2 — architecture witnesses.** `boundaries.test.ts` was created in Sprint 00 (`c6ab7e6`) and grew every sprint since. Its header declares: *"Add new architectural witnesses here (one `it` per invariant) rather than scattering them."* It maintains a phase-numbered exception ledger whose entries "may only shrink," with Phase 7 requiring an empty list.

**Controlling precedent 3 — pinned content hashes.** `noticeScreenshotRedaction.test.ts` (`0cd7db6`) pins a SHA-256 and carries a **19-line header** explaining exactly what to do when the artifact legitimately changes: *"If you legitimately re-shoot or re-redact this screenshot: re-apply the redaction, confirm the title is unreadable at full resolution, then update the digest below in the same commit."* The distinguishing fact: that witness pins a **permanently stable shipped artifact**. The new one pins a **transitional byte stream from a file that no longer exists**.

**Controlling precedent 4 — CSS composition.** `App.tsx` (sidebar root) imports no CSS at all; `index.tsx:18` loads `index.css`. The pre-existing rule is *"the entry module owns the cascade."* D4 establishes a second rule: *"the surface root owns the cascade."* `schematic.css` is real precedent but is ~2 weeks old and one file.

**Distinguishing facts.** `useWorkshopRoom.ts`'s `'../../useVSCodeApi'` is a rename artifact, not authored style. But `useWorkshopSessions.ts:4` and two controllers are newly written with relative imports while their Sprint 01/02 same-directory neighbors (`useWorkshopWidgetHost.ts:4`, `useWorkshopStandingDirectives.ts:5`, `widgets/*`) all use `@hooks/*` aliases.

**New precedent this PR creates.** A role-named subdirectory inside `hooks/domain/` exempt from that directory's documented contract; a per-render aggregate re-assembly at a call site (`WorkshopApp.tsx:205`, which `App.tsx` has no analogue for); a pinned hash of a non-existent file with no retirement condition; a three-place coupling for adding a stylesheet; and — the genuinely valuable one — a one-way collaboration port between two presentation hooks with a directional guard.

---

### 6. Structural & Causal Map

```
WorkshopApp.tsx  (1,479 — shell: 11 useState, ~40 useCallback, 4 useEffect, ~700 lines JSX)
  :203  useWorkshopRoom()            ── owns thread, streaming, scope, context, participants
  :204  useWorkshopSessions(port)    ── owns named-session commands + request correlation
  :205  const workshop = {...room, ...sessions}     ← the seam is re-erased here (237 reads)
  :229  useWorkshopWidgetOpening({host, standingDirectives, onError, onClose×2})
  :448  useWorkshopSessionSurfaces({12 options — incl. 3 policy booleans derived at :428-437})
  :524  useWorkshopContextSheet({13 options — 6 are straight room-action pass-throughs})
  :137  CSS: tokens → shell → context → session → gesture → lexical → standingRail → schematic
```

**Dependency direction.** Sessions → Room (types + runtime port). Room ↛ Sessions, guarded at `boundaries.test.ts:358`. Controllers → nothing transport-shaped: **zero** references to `useVSCodeApi`, `MessageType`, or `postMessage` across all three files. That purity is the category's best property and is guarded by nothing.

**Counter-direction.** Three components now depend on two controllers for their prop types — presentation → hook, the reverse of the layer rule.

**The identity cascade.** `handleSessionState` writes `setTurns(session.turns)` unconditionally (`useWorkshopRoom.ts:614`), so a new array identity lands on every host snapshot → `beginReplacement` (deps `[totalTurns, turns]`) → `replacementPort` useMemo → `resetSession` → `startNewSession` → the keydown effect re-subscribes. **[Observed]** Frequency is ~2–3× per exchange, not per streaming token (chunks route through separate `streaming` state). The pre-split code churned at the identical cadence. No window exists where a keypress lands on no listener — cleanup and setup run in the same synchronous flush and JS is single-threaded.

**Notable:** the room hook already contains the exact idiom that would make the port identity-stable — a state/ref pair behind one setter, with a written rationale, for `liveRun` at `useWorkshopRoom.ts:306-315`, including an explicit warning against the alternative fix (functional `setState`) because StrictMode double-invokes updaters.

---

### 7. Contracts, Invariants & Negative Space

**`WorkshopRoomReplacementPort` (`useWorkshopRoom.ts:246-250`).** Named from the pre-split code's own comment ("New Session is a room replacement, not a filesystem refresh") — named after a recorded domain concept, not the mechanism. One producer, one consumer, one call site. Four of five session actions do not use it.

| Operation | Implied precondition | Enforced |
|---|---|---|
| `beginReplacement()` | no replacement in flight | not in the port; only by shell-derived UI gating |
| `restoreReplacement(s)` | `s` matches the open begin; no newer host truth landed | nowhere |

**Negative space — what this PR deliberately does not do.** No message/route/schema/persistence change. No modal-local workflow extraction (deferred to `.todo/tech-debt/2026-08-04-workshop-modal-workflow-ownership.md`, well specified with 7 named hooks and its own runway). No scope-transition controller (D3: two one-line posts with no state of their own). No visual change of any kind. No `CLAUDE.md` amendment. No host-side work.

**Inert-but-silent.** The only colliding key in the `:205` merge is `persistedState` (both `Record<string, never>`; sessions wins). It's never read from the merged object — `usePersistence` spreads the originals separately at `:311-312`. If either hook ever gains a persisted field, the merged object diverges from the composed one with no type error.

---

### 8. Forces, Tensions & Design Tradeoffs

**Diff reviewability vs. seam legibility.** The merge at `:205` bought a −422-line shell diff and a reviewable PR. It cost the property the split exists to create: after `:205` no reader of the shell can tell which hook owns `resetSession` versus `sendMessage`. D2 rejected a compatibility facade under the alpha rules; this is a facade with a lowercase name. The force is real — re-pointing 237 references would have made the PR unreviewable — but nothing records the merge as temporary.

**Migration proof vs. durable guard.** `workshopStyles.test.ts` does two things with two different lifetimes in one file sharing one constant. The import-order + no-self-import guard is architecture and should outlive the epic. The SHA-256 is a migration receipt with a shelf life measured against a file that took ~70 commits since May.

**Specialization vs. family.** `useWorkshopWidgetOpening` forks per widget (separate state slots, separate `close*`, if-chains in three places) while the *backend* already registers standing-directive families in a map with a `prose-controller` placeholder already in it (`WorkshopStandingDirectiveOperations.ts:87-100, 138`). Two-is-not-a-pattern is a defensible call; the asymmetry with the backend is worth naming.

**Alternate constructions.**
- **A. Ref-mirror `turns`/`totalTurns`** the way `liveRun` already is → `replacementPort` becomes permanently stable, and five downstream callbacks stop churning. ~10–15 lines; new invariant "never call `setTurns` directly" across three call sites. Precedent lives in the same file.
- **B. Transaction-shaped port** — `begin()` stashes room-side, `rollback()`/`commit()` take no arguments. The snapshot stops crossing the seam; "no double begin" becomes enforceable in one file.
- **C. Don't clear optimistically at all.** Post, show pending, let the host snapshot paint the empty room. Deletes the port, the ref, the double-reset ambiguity, and the stale-restore hazard, at the cost of one latency beat on a rare action that already round-trips to the filesystem.
- **D. Split `workshopStyles.test.ts`** into a labelled migration receipt with a stated expiry and a permanent composition guard.
- **E. Context provider** — the runway rejected this for P3 (`runway:293`) on re-render-semantics grounds. The rejection is sound for this sprint.

---

### 9. Failure, Recovery & Operational Truth

Nothing durable is ever at risk: the host owns truth, and a rejected action means host state never changed. The optimistic clear and rollback are purely a webview *window* restore — which is precisely why `persistedState: {}` on both hooks is the right contract rather than an omission.

**What an operator sees.** Failures surface as toasts (`WorkshopApp.tsx:438-447`), persistent banners for degraded memory / protected checkpoint / save-status error (`:875-906`), and `WEBVIEW_ERROR` posts from three ErrorBoundaries. Unchanged by this PR.

**Silent-wrongness surface.** One path settles without any signal: in `useWorkshopWidgetOpening.ts:140-149`, if a config arrives whose `widgetId` is neither of the two live ones, no setter fires but `setPendingWidgetConfigId(null)` and `clearWidgetConfigData()` still run. The writer clicks reopen, the pending state clears, and no surface appears — no toast, no log. `WorkshopWidgetId` has 13 members; two are live. Parity with pre-split code.

**Coverage note.** `jest.config.js:48` excludes `packages/core/src/presentation/**` from `collectCoverageFrom`. The entire extraction contributes nothing to the coverage gate, so "1,836 tests pass" says less about *this* change than the number suggests.

---

### 10. Security, Trust & Misuse Surface

Little bearing. No new inputs, no trust boundary crossings, no auth, no tenancy, no secret handling. The webview↔host protocol is unchanged. The one adjacent fact worth recording: this repo has a real, PR-review-driven data-exposure history on the *content* side (`noticeScreenshotRedaction.test.ts` exists because a screenshot leaked an unpublished manuscript title), which is why content-hash witnesses are a familiar tool here — and why the new one being unlabelled matters more than it would elsewhere.

---

### 11. Data, Time, Scale & Concurrency Horizon

**Message ordering** is the only real concurrency axis. `WORKSHOP_SESSION_STATE` carries no sequence number, so `restoreReplacement` cannot know whether it is stale. At current scale (one writer, one webview, local host) the window is small.

**Turn volume.** The room deliberately renders a bounded window with `hiddenTurns` accounting. `beginReplacement` copies the visible array (`[...turns]`) — bounded by the render window, not the session ledger.

**Listener churn** at ~2–3 re-subscriptions per exchange is immaterial at this scale and unchanged from before.

**Widget family growth** is the axis that actually bites — see §12.

---

### 12. The Change Genome: Variation & Reproduction

**Cousin: the Prose Controller widget.** One axis: a third member of the widget family. This is not hypothetical — `'prose-controller'` is already in `WorkshopWidgetId`, in `WorkshopStandingDirectiveFamily`, in the browser catalog, has an icon, appears in six persisted-shape validators, and has a **placeholder registry entry with `unsupportedFamily` stubs** at `WorkshopStandingDirectiveOperations.ts:87-100`. Its sprint doc is paused at `.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-prose-controller.md`.

| Contact point | Class |
|---|---|
| Backend family registry (`WorkshopStandingDirectiveOperations.ts:138`) | **Reuse** — closed map, fill the stubs |
| `standingDirectiveRail.css` | **Reuse** — F6's correction pays off exactly here |
| `useWorkshopRoom`, `useWorkshopSessions`, `useWorkshopContextSheet`, `useWorkshopSessionSurfaces` | **Reuse (zero edits)** — Sprint 01/02 feature-freeing held |
| `WorkshopApp.tsx` compose + modal block + CSS import | **Extension** |
| `useWorkshopWidgetOpening.ts` | **Fork** — eight edits in one 180-line file: new type, third `useState`, arms in `launchWidget`/`openWidgetRecommendation`/the correlation effect, a `closeProseController`, a fifth option, two interface fields |
| `WorkshopApp.test.tsx:14-21` | **Extension** — a ninth `jest.mock` line; forgetting it fails with a module-resolution error, not a design message |
| `boundaries.test.ts:352` regex | **Weak guard** — substring allowlist over whole file text; a leak named `proseControllerDraft` passes, a prose comment containing "widget" fails |
| **`workshopStyles.test.ts`** | **Contradiction** |

**The contradiction, proven by construction.** The two assertions share `WORKSHOP_STYLE_IMPORTS`. Test 2 (`:48-51`) demands that array equal `WorkshopApp`'s CSS import list. Test 1 (`:34-41`) hashes the concatenation of that same array. So a new Workshop stylesheet must be in the array — and adding it changes the hash. I verified: current 7-file assembly hashes to `64783db8…92db2d` (passing); appending one 25-byte stylesheet gives `703bb8c4…` (failing). **No edit satisfies both.** The escape routes are: recompute the hash (which destroys its meaning as a *pre-split* witness), split the file, or delete Test 1 — and Test 1 shares a file with the durable guard.

This directly contradicts the runway's own cousin reproduction test (`runway:397-407`), which returns verdict **Passes** with a shared-file list that omits `workshopStyles.test.ts` entirely.

**Alternative cousin — a sixth `WorkshopTextSheetMode`.** Much cleaner: one union arm, one `openXSheet`, one branch in `applyTextSheet`, one modal prop. The sheet controller generalizes along its declared axis; the widget controller does not.

**Verdict.** This PR creates a **generative pattern for stylesheets and session workflows** and a **narrowing pattern for widgets**. The narrowness is defensible at two; it is cheapest to fix at three.

---

### 13. Comparative Models & Borrowed Vocabulary

**Internal parallel — the backend family registry.** `WorkshopStandingDirectiveOperations.ts:138` maps `family → entry` with a placeholder for the unbuilt third widget. The same codebase solved the same variation problem on the host side with a table and on the presentation side with an if-chain, in adjacent sprints. **Question it contributes:** is the presentation if-chain a deliberate "two is not a pattern" call, or an unnoticed asymmetry with a solved problem one directory over?

**[External] Evolutionary architecture / fitness functions.** The vocabulary that fits this PR best: *architectural characteristic*, *fitness function*, *guided evolution*. A fitness function is supposed to keep a quality true as similar changes land. The import-order guard does that. The SHA-256 measures a *one-time migration*, not a standing characteristic — a distinction the epic's own phase-numbered exception ledger (entries "may only shrink," Phase 7 requires empty) already knows how to express, and which this witness is not enrolled in. **Question:** should every content-pinning witness in this repo declare whether it is a characteristic or a receipt?

**[Analogy] Chain of custody.** The sprint's byte-identity proof is exactly an evidence-integrity argument: the CSS was moved between containers and the hash proves nothing was altered in transit. That framing is useful and it also names the expiry — once the evidence is legitimately amended, the original seal is no longer the thing you check. **Question:** what replaces the seal after the first amendment?

---

### 14. Creative Counterfactuals

**Inversion — sessions owns the thread.** Puts the rollback ref beside the state it protects, but inverts the real data flow (`handleSessionState` writes ~25 fields of which turns are two; `handleTurn` and streaming both append) and inverts the naming truth: *the thread is the room*. The current direction is right.

**Deletion — remove the port.** The irreducible need is one sentence: New Session clears optimistically and must un-clear on rejection. The boring alternative (don't clear optimistically) deletes the port, the ref, the double-reset ambiguity, and the stale-restore hazard, for one latency beat on a rare, already-filesystem-bound action. Was that considered?

**Time-lapse — six more widgets.** `useWorkshopWidgetOpening` becomes ~500 lines with eight state slots and three eight-arm branches: a God Component by the repo's own checklist, three years after the backend solved it with a registry. The relief valve — one `{widgetId, opening}` discriminated union plus a `Record<WorkshopWidgetId, OpeningStrategy>` — is a strictly smaller change at three widgets than at eight.

**Time-lapse — first intentional CSS edit.** Test 1 fails with `Expected "64783db8…" / Received "a91f…"`: no filename, no line, no diff. Prediction: the hex gets re-pasted once, then the test is deleted on the second edit — and the durable import-order guard goes with it, because they share a file and a constant.

**Constraint swap — if the visual pass were impossible forever.** Then the byte-identity witness is the *only* evidence, and its unlabelled fragility becomes a first-order risk rather than a maintenance nit.

---

### 15. Evidence Confidence & Unresolved Questions

**Repository-grounded (verified by the orchestrator, not taken from the sprint doc):** test/typecheck/lint results; CSS byte identity; the stylesheet-assertion contradiction; absence of key collisions in the `:205` merge; controllers' transport-freedom (0 references); `setTurns` unconditional at `:614`; the `liveRun` ref-mirror precedent; `roomMutationLocked` gating the double-reset; the re-pin audit misdirection; the three type re-exports and their only remaining consumers (three component test files); `jest.config.js:48` coverage exclusion; commit counts (77 / 41).

**Material inferences:** `style-loader` head order equals module execution order equals import-statement order *given* the self-import guard; listener churn ~2–3× per exchange; StrictMode does **not** double-fire the session toast (double-invoke is mount-only, and `sessionActionResult` is `undefined` at mount).

**Competing interpretations:** presentation cleanup in its own right vs. naming groundwork for Sprint 04's 2,995-line handler split.

**Missing artifacts:** the interactive visual pass. Nothing automated can substitute — `WorkshopApp.test.tsx` mocks all eight stylesheets (`:14-21`) and is structurally incapable of observing a visual regression; it asserts three landmarks and two modal opens.

**Needs the author:** whether `:205` is scaffolding; whether `controllers/` is a permanent category; whether the SHA-256 has a planned end-of-life; whether Sprints 04/05 will mirror room/sessions by name.

---

### 16. Past → Present → Horizon Synthesis

**Past.** Three months of Workshop features landed in two files and one stylesheet. Sprints 00–02 built a fitness gate, normalized feature slices, and centralized shared ownership — deliberately clearing the ground so that P3 could touch the writer-visible layer with witnesses already in place. The `useWorkshop` hook was never designed as an aggregate; it accreted one.

**Present.** The split is real and behavior-preserving to a degree I could verify rather than assume. Nine of ten traceability witnesses resolve to a named file. The stylesheet migration is proven byte-exact. The room/sessions seam is guarded in the right direction. And two things pull the other way: a call-site merge that immediately re-erases the seam for 237 reads, and a witness file whose two halves cannot both survive the next stylesheet.

**Horizon.** Sprint 04 faces `WorkshopHandler.ts` at 2,995 lines with the same brief, and will copy something from here — most likely the one-way port, possibly the role-named subdirectory, quite possibly the merged-aggregate shortcut. Sprint 05 splits the session aggregate; if its host-side names don't mirror room/sessions, `CLAUDE.md`'s Domain Mirroring table gains its first documented mismatch — a cheap alignment to make now while both sprints are four-line scopes. The deferred modal debt will add seven more controllers to a directory whose contract is recorded only in a `proposed` runway line.

---

### 17. Runway Synthesis Brief

**Invariants.** Host owns durable truth; webview persists nothing. The assembled cascade must equal the pre-split bytes *for this sprint*. Room ↛ sessions. `useWorkshop` stays retired. No message, route, schema, or handler change. No pixel moves.

**Anchors.** `WorkshopApp.tsx:205` (the merge), `:229-235`/`:448-462`/`:524-538` (controller wiring), `:380-381` + `:428-437` (derived policy). `useWorkshopRoom.ts:246-250` (port), `:306-315` (the ref-mirror precedent), `:542-553` (begin/restore), `:611-614` (host authority + unconditional `setTurns`). `useWorkshopSessions.ts:101-107`, `:192-227`. `useWorkshopWidgetOpening.ts:80-95`, `:133-168`. `useWorkshopSessionSurfaces.ts:92-126`, `:203-237`. `workshopStyles.test.ts:10-31`, `:43-58`. `boundaries.test.ts:352-366`. `noticeScreenshotRedaction.test.ts:1-37` (the labelling precedent). `WorkshopStandingDirectiveOperations.ts:87-100,138` (the registry road not taken). `jest.config.js:48`.

**Tensions (real tradeoffs, not defects).** Diff reviewability vs. seam legibility. Migration receipt vs. durable guard. Two-is-not-a-pattern vs. a backend that already has the table. Line count vs. an epic that forbids line-count targets.

**Unknowns.** Is `:205` temporary? Is `controllers/` a category? Does the hash witness have an expiry? Will 04/05 mirror the names? What does the visual pass show?

**Legitimate variation points.** A sixth text-sheet mode. A new Workshop stylesheet. A fourth presentation controller. A third widget family. Each should be traced against §12 before being called cheap.

**Predicted pressures.** *Near:* the first intentional Workshop CSS edit. *Middle:* Prose Controller resuming; seven deferred modal controllers landing in an uncontracted directory. *Far:* Sprint 07 closure inheriting an unenrolled content-hash witness and a shell still near 1,400 lines.

**Questions for the panel.**
1. Is `{ ...workshopRoom, ...workshopSessions }` scaffolding with an owner, or the permanent consumption shape? Should it be a named typed function so the collision surface is declared?
2. Should `beginReplacement` adopt the ref-mirror idiom the same file already uses for `liveRun`?
3. Should the port's preconditions be enforced in the port (transaction shape) rather than by shell-derived booleans 300 lines away?
4. Can a new Workshop stylesheet satisfy both assertions in `workshopStyles.test.ts`? If not, what should change, and which half must survive?
5. What is the definition of "controller" vs. "domain hook", where is it recorded, and why did the controllers not use the repo's existing `Record<string, never>` idiom?
6. Is components-importing-types-from-controllers the dependency direction the epic wants, and do the re-exports (only consumers: three test files) survive the alpha no-shim rule?
7. Is the widget if-chain a deliberate call, given the backend registry with a `prose-controller` placeholder already in it?
8. What is the minimum interactive evidence that lets the unchecked visual box be checked, and where is it recorded?

**Do not overread.**
- The identity cascade / listener churn is **not a regression** — the pre-split code churned identically, there is no missed-keypress window, and frequency is per-exchange, not per-token.
- The StrictMode double-toast hazard **does not exist** — double-invoke is mount-only and the result slot is empty at mount.
- The double-`resetSession` snapshot overwrite is **UI-unreachable** — `sessionActionPending` gates both the button and the shortcut.
- The stale-restore and silent-settle paths are **inherited**, not introduced. Flag them only as newly-legible seams or where this PR is the natural place to repair them.
- `WorkshopApp.tsx` at 1,479 lines is **not** evidence the sprint failed; the epic forbids line-count targets and the residual is ~700 lines of JSX. The gap is that nobody stated it.
- The sprint doc is **honest** — every verification claim it makes checks out, and it leaves its own box unchecked rather than claiming a pass.
---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — the refactor itself is sound and independently verified behavior-preserving; what needs attention before merge is the *witness system* this sprint built to prove it, one of which will contradict itself at the next stylesheet edit.

- 🟠 **F-01 · The stylesheet witness cannot survive its own success** `🧭 Corroborated Runway` — `workshopStyles.test.ts` holds a permanent architectural guard and a one-time migration receipt behind a single shared constant, and they are provably mutually unsatisfiable once any new Workshop stylesheet exists. The predictable repair on a red build is deleting the failing `it` — which takes the durable D4 guard with it. Split the constant and label the receipt with a retirement condition.
- 🟡 **F-07 · Nothing witnesses the thing most likely to break** `🎯 Consensus` — ~40 props were rewired through three new controllers. The shell render test clicks two modals whose state this sprint never extracted; the controller unit tests mock the very options a mis-wiring would corrupt. The unchecked manual criterion is aimed at pixel risk that W1/W2 already closed.
- 🟡 **F-05 · The D4 guard recognizes one import syntax** — `import s from './x.css'`, namespace, named, and `require()` all pass it. A component self-importing CSS would inject ahead of the shell tier with both witnesses green.

Nothing here is Blocking. No data-loss, correctness, or security path survived validation, and three hazards the runway raised were investigated and closed.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | **B+** | Seam drawn in the right places and guarded in the right direction; one line at the call site takes most of the legibility back, and the new category has no written contract. |
| Critical Correctness — Blake | **A−** | No blocking path survived tracing. Behavior preservation independently verified. One published port asserts a symmetry it doesn't keep. |
| Edge Cases — Sam | **B+** | Every correlation guard moved intact and is now directly tested; the real hole was in the guard the sprint wrote, not the code it guards. |
| Code Quality — Parker | **B** | Hooks and controllers are honestly named; the spread merge and an unnamed three-meaning return union cost the reader more than the domain does. |
| Tests — Cal | **B−** | Genuinely new and valuable witnesses, including one tested from both ends. But the flagship witness self-contradicts, four mutants survive behind one fixture, and the shell test exercises no extracted state. |
| Codebase Fit — Stan | **B** | Three deviations from live, same-subtree conventions — persistence declaration, witness labelling, import style — each cheap, none justified in writing. |
| Performance — Tim | **A** | Measured, not asserted. The merge is 0.04% of its render; the stylesheet split costs +1.66 KB. Nothing to fix. |
| Security — Patricia | **A** | No new surface. Escaping, CSP, error propagation, and `WEBVIEW_ERROR` all verified byte-equivalent. Only the guards' rationale comments went missing. |
| Observability — Oliver | **B+** | Nine of ten failure paths kept their voices across the move, and two became explicit ports. The tenth was mute before it moved and is now cheapest to fix. |
| Domain Logic — Bria | **A−** | D1–D4 honored, nine of ten traceability witnesses land, criteria honestly scoped. The written record lags the shipped code in two places. |

## Findings

### F-01 · 🟠 High — A migration receipt and a durable guard share one file, one constant, and one failure `🧭 Corroborated Runway`

**Raised by:** Marcus, Cal, Stan
**Discovery:** 1 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/workshopStyles.test.ts:31` — `const PRE_SPLIT_SHA256 = '64783db8fdfc6a0295fb94b5c7e345d79063890b334fb9f73ea88f597092db2d';`
**Affected contract:** D4 — one composition point owns the assembled Workshop cascade

Two assertions with two different lifespans hang off one array. Assertion 2 (`:43-58`) is a standing architectural characteristic: the import list equals the declared order, and no other file self-imports CSS. It will be true in 2027 and it fails with a readable message naming the offending file. Assertion 1 (`:34-41`) is a chain-of-custody receipt for a move that already happened.

**Proven mutually unsatisfiable, by construction rather than argument.** Reassembling the seven current files reproduces `64783db8…92db2d` exactly — the pin is not self-referential, which is to the sprint's credit. Appending a single 25-byte stylesheet yields a different digest. Assertion 2 *forces* any new Workshop stylesheet into `WORKSHOP_STYLE_IMPORTS`; entering the array is what breaks assertion 1. No edit satisfies both.

This is not speculative pressure: `prose-controller` is already in `WorkshopWidgetId`, already in the browser catalog, and already has a placeholder registry entry with `unsupportedFamily` stubs at `WorkshopStandingDirectiveOperations.ts:87-100`. Its sprint is paused, not cancelled.

The failure message will be two hex strings — no filename, no line, no diff. On a red build the cheap move is deleting the failing `it`, and the durable guard is in the same file behind the same constant.

The repo already knows the safe form. `noticeScreenshotRedaction.test.ts:1-37` pins a SHA-256 behind a nineteen-line header stating exactly what to do when the artifact legitimately changes — and it pins a *permanently stable shipped artifact*. This one pins a transitional byte stream from a file that no longer exists, with the shorter header. Searched `docs/`, `.todo/`, the sprint doc, and `boundaries.test.ts`'s phase-numbered exception ledger for `PRE_SPLIT_SHA256` / `64783db8` / a retirement condition — **not found**.

**Recommendation:** Two edits, no deletion. (1) Give assertion 1 its own frozen literal array (`PRE_SPLIT_ASSEMBLY`, the seven original paths) so a new stylesheet extends `WORKSHOP_STYLE_IMPORTS` alone and the assertions stop contradicting each other. (2) Add a `noticeScreenshotRedaction`-style header above `PRE_SPLIT_SHA256` stating what it proves and its retirement condition — *delete this `it` at the first intentional Workshop stylesheet edit; the migration is proven and the seal is spent* — so the receipt is discarded on purpose rather than as a red-build casualty.

---

### F-02 · 🟡 Standard — The seam is re-erased at the call site, and the exit costs 33 reads, not 255 `🧭 Corroborated Runway`

**Raised by:** Marcus, Parker
**Discovery:** 0 independent · 2 runway-prompted (Parker's sizing independent)
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:205` — `const workshop = { ...workshopRoom, ...workshopSessions };`
**Affected contract:** The sprint's own declared success metric — "name the owner of any Workshop UI action from the filename alone"

The split lands cleanly in two of three consumers: `useWorkshopAppMessageRouter` takes the hooks separately (`:292-293`), and `usePersistence` spreads their `persistedState` separately (`:311-312`). Only the shell body re-flattens them — and the shell body is where a reviewer actually reads Workshop UI code. After `:205`, `workshop.resetSession(...)` and `workshop.sendMessage(...)` read identically, though the first lives in `useWorkshopSessions`, crosses `WorkshopRoomReplacementPort`, and optimistically blanks the writer's thread.

The justification is diff size, and it is a real force. But it was sized against the wrong number. Measured: **255** `workshop.*` reads, of which **222 are room-owned and were never ambiguous** — only **33**, across 23 distinct members, resolve to `useWorkshopSessions` (largest: `sessionSaveStatus` ×4; most are 1–2). Re-pointing those 33 is mechanical, leaves the 222 untouched, and makes the new seam visible at exactly the call sites that are new.

One silent surface: `persistedState` is the only colliding key (both `Record<string, never>`; sessions wins), verified by extracting both return shapes — 92 room props, 27 session props, one collision. Nothing reads it off the merged object today. If either hook ever gains a persisted field, `workshop.persistedState` diverges from what `usePersistence` receives, with no type error.

Tim priced the merge at 1.3 µs, 0.04% of the render it sits in — **this is a legibility argument, not a performance one.**

**Recommendation:** Read the 33 session-owned references off `workshopSessions.` and drop `:205`. If the merge stays this sprint, give it a named typed function whose return type declares the collision surface, plus one line naming its owner and expiry — Sprint 04 faces `WorkshopHandler.ts` (2,995 lines) with the same brief and will copy whichever reading it finds.

---

### F-03 · 🟡 Standard — A new hook category exists with no written contract `🧭 Corroborated Runway`

**Raised by:** Marcus, Stan
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopContextSheet.ts:60-61` — `export type UseWorkshopContextSheetReturn = WorkshopContextSheetState &` / `  WorkshopContextSheetActions;`
**Affected contract:** Tripartite Hook Interface — `CLAUDE.md`: "**Location**: All domain hooks in `packages/core/src/presentation/webview/hooks/domain/`"

Census, run directly: **27** hooks under `hooks/domain/`; **24** declare a Persistence interface and return `persistedState`; the only three that don't are this PR's controllers. And the closest siblings aren't merely the three `Record<string, never>` users — they're the four Sprint 01/02 hooks one directory up in the same subtree, whose situation is identical. `useWorkshopWidgetHost.ts:23-25`:

```ts
export interface WorkshopWidgetHostPersistence {
  // Host/session storage owns every durable value in this domain.
}
```

Sprint 02's authors were in exactly the controllers' position — presentation-local state, nothing durable — and chose to say so in the type system. That comment *is* the convention: the empty interface is how this repo records "we considered persistence and the host owns it," which is precisely the invariant the sprint is protecting. Omitting the slot makes the same claim unfalsifiable.

Meanwhile the category's genuinely best property is unguarded. All three controllers have **zero** references to `useVSCodeApi`, `MessageType`, or `postMessage` — verified — which is what makes their tests plain state tests with no transport mock. Four of five sibling hooks one level up *do* call `useVSCodeApi`. That contrast is the category, and nothing holds it. The definition exists in exactly one place: `2026-08-04-workshop-sprint-03-presentation-runway.md:537`, marked `proposed`. `CLAUDE.md` is untouched by this PR.

The trigger is queued: `.todo/tech-debt/2026-08-04-workshop-modal-workflow-ownership.md:26-32` names seven more extractions — all `use*`-named, none saying which directory they land in. The first one that reaches for `useVSCodeApi` (the instinct four siblings model) dissolves the category, and no test fails.

**Recommendation:** Two cheap moves. (1) Add the three-line Persistence interface + `persistedState: {}` to each controller, matching `useWorkshopWidgetHost.ts:23-25` *including* the rationale comment. (2) Add one `it` to `boundaries.test.ts` asserting no file under `controllers/` references `useVSCodeApi`/`MessageType`/`postMessage`, plus a paragraph in `CLAUDE.md` beside the Tripartite section defining "presentation controller: UI state machine, host effects injected, no transport." If the exemption is deliberate, that is where it belongs.

---

### F-04 · 🟡 Standard — An unrecognized widget id settles silently, with no trail on either side of the wire

**Raised by:** Oliver · **Blake dissents on reachability**
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts:139-152` — `if (config.widgetId === 'gesture-playground') {…} else if (config.widgetId === 'lexical-gravity') {…}` / `setPendingWidgetConfigId(null); host.clearWidgetConfigData();`
**Affected contract:** Reopen-by-config-id correlation

The writer clicks Edit on a standing-directive pill (`WorkshopApp.tsx:1215`). The host finds the config and returns it. Both `if` arms miss. The two cleanup lines fire anyway: pending clears, no modal opens. Click again — same nothing. From the writer's seat, a dead button.

The maintainer gets "I clicked Edit and nothing happened," with no way to separate *message never sent*, *host didn't find it*, *correlation guard dropped it*, and *we ignored the widgetId* — and only the last is happening. Verified: `WorkshopWidgetHostHandler.handleRequestConfig` logs **only** when `!config`, so a found-and-returned-then-ignored config leaves no line anywhere.

The sibling idiom exists three files away: `useWorkshopStandingDirectives.ts:134-139` refuses a correlation mismatch by calling `reportWorkshopWidgetActionCorrelationIssue` *and* toasting the writer.

**Severity note.** Oliver rated this High. Reachability validation downgrades it: Blake traced the paths and could not prove a shipped path produces a third `widgetId` today — `WorkshopWidgetId` has 13 members and 2 live arms, and the third (`prose-controller`) is queued, not shipped. It is **Standard now and High the day Prose Controller lands**, and Oliver's point stands that the repair is cheapest today: `onError` is already injected, the path has a named owner, an exported interface, and its own test file (3 `it(` blocks, none covering an unrecognized id).

**Recommendation:** Add the `else` arm — `onError(\`${config.widgetId} can't be opened in this version.\`)` — before the two cleanup lines. Config ids and widget ids carry no manuscript text, so a paired `console.warn` is safe. One `it` in the existing test file pins it.

---

### F-05 · 🟡 Standard — The D4 composition guard recognizes exactly one import syntax

**Raised by:** Sam
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/workshopStyles.test.ts:55` — `.filter((file) => /import ['"].*\.css['"]/.test(fs.readFileSync(file, 'utf8')))`
**Affected contract:** D4 — one composition point owns import order

Run against the ways a bundler will happily inject a stylesheet:

| Form | Detected |
| --- | --- |
| `import './a.css';` | ✅ |
| `import styles from './a.css';` | ❌ |
| `import * as s from './a.css';` | ❌ |
| `import { x } from './a.css';` | ❌ |
| `const c = require('./a.css');` | ❌ |

The pattern requires a quote immediately after `import `, so only the bare side-effect form is seen. Under `style-loader` (confirmed in `webpack.config.js:82-84` — not `MiniCssExtractPlugin`), injection order is module evaluation order. `WorkshopApp.tsx` imports component modules at lines ~30-130 and stylesheets at `:135-144`, so a component self-importing CSS at line 52 injects **before** `tokens.css` — a changed cascade, with both witnesses green: assertion 1 hashes only the seven listed files and never walks the tree; assertion 2 checks only `WorkshopApp`'s own list.

Same class, second door: the `path.basename(file) !== 'index.tsx'` exemption (`:54`) is name-based, so any future barrel named `index.tsx` under `presentation/webview` inherits it. Only one exists today (`webview/index.tsx`), so that half is prospective.

**Recommendation:** Widen the predicate to any CSS reference — `/(?:from\s*|import\s*|require\(\s*)['"][^'"]*\.css['"]/` — and pin the one legitimate exemption by resolved path (`path.join(WEBVIEW_ROOT, 'index.tsx')`) rather than basename.

---

### F-06 · 🟡 Standard — Five `ok` guards, one fixture, four surviving mutants

**Raised by:** Cal
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopSessionSurfaces.ts:97` — `if (sessionActionResult.ok && sessionActionResult.action === 'save') {`
**Affected contract:** A rejected session action toasts but closes nothing and re-lists nothing

`useWorkshopSessionSurfaces.test.ts:97-101` supplies exactly one `sessionActionResult` in the entire suite: `{ action: 'save', ok: true }`. Searched the presentation tree for an `ok: false` fixture against this controller — not found. The only failure fixtures live one layer down (`useWorkshopSessions.test.ts:59`, `useWorkshopRoomAndSessions.test.ts:819`) and witness the *room rollback*, not the *surface settling*. Two different rules; one has a failure witness.

**Verified by live mutation:** deleting `.ok &&` from `:97` leaves all **519 presentation tests passing**. The writer's consequence: a save fails on a protected checkpoint, the modal closes anyway, and the title they typed is gone — red toast, empty form. The same single fixture leaves `:100-105` (browser closes on open/new) and both arms of `:113-117` unwitnessed; flipping the `else if` at `:115` from `requestSessions()` to `requestSessions('')` also survives, silently wiping the browser's active search filter after a delete.

This is the sprint's own declared spine — the rejected New Session — and the surfaces controller is the half that decides what the writer sees stay open.

**Recommendation:** ~6 lines in the existing settle `it`: re-render with `{ action: 'save', ok: false, message: 'Could not save.' }` and assert `saveSessionModalOpen` stays `true`, `onResult` still fired, and `requestSessions` was not called again with `''`. One fixture, four mutants dead.

---

### F-07 · 🟡 Standard — The extraction's residual risk has no witness, automated or manual `🎯 Consensus`

**Raised by:** Cal, Bria
**Discovery:** 2 independent
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx:83-84` — `fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));` and `.todo/…/03-presentation-responsibility-extraction.md:123` — `- [ ] A manual visual pass records no regression across the room shell, …`
**Affected contract:** Completion criteria 2 and 6

The D1 witness earns real credit first: it proves the whole Workshop module graph resolves, all eight CSS paths exist, both split hooks and all three controllers mount without throwing, and their mount effects survive a mock host. For a 33-file presentation refactor that catches the single most likely failure of the whole PR.

What it cannot establish: the two surfaces it clicks are `toolsModalOpen` and `widgetsModalOpen` — plain shell `useState` at `WorkshopApp.tsx:214-215`, explicitly **not** extracted by this sprint. So the one witness built to attest the extraction exercises zero controller-owned state. Hand `useWorkshopSessionSurfaces` the wrong `resetSession`, pass `hasWorkingSet` where `hasReplaceableSessionState` belongs, give `useWorkshopContextSheet` the wrong `pinExcerpt` — every one is a wiring mistake this refactor newly makes possible across 12, 13, and 5 injected options, and every one passes both the shell test *and* the controller unit tests, which mock the very options that would be mis-wired.

Bria reaches the same gap from the manual side: W1 and W2 already closed the pure-CSS risk this criterion was written for. What remains unproven is the ~40 rewired props plus derived values that moved with them (`sheetAttachment`, `verifiedDisplay` now compute inside `useWorkshopContextSheet.ts:170-181`). Criterion 6 is aimed slightly past the risk — and searched `.todo/`, `docs/`, `.memory-bank/` for any recorded visual-pass result anywhere in this repo: **not found**; the nearest sibling also ends at "Remaining: manual visual pass" with no outcome.

Separately: production wraps both roots in `StrictMode` (`index.tsx:28-32`) and `useWorkshopRoom.ts:306-309` carries a written rationale about StrictMode double-invoking updaters — the file defends against a mode the shell witness never runs. Searched the suite for `StrictMode`: not found anywhere, so this is repo convention, not a regression here.

**Recommendation:** Two additions to the existing `it`, no new file: render with `{ wrapper: React.StrictMode }`, and add one assertion that passes *through* a controller — click New Session on a room with turns and assert the confirm dialog appears, which proves the shell computed the policy boolean and handed it to the right controller. Then restate criterion 6 as "walk the ten Traceability witnesses (`:49-62`) in the Extension Development Host," and record the outcome — date, VS Code version, what was seen — in the sprint's Verification section.

---

### F-08 · 🟡 Standard — The sprint record diverges from the shipped code in two places

**Raised by:** Bria
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `.todo/…/03-presentation-responsibility-extraction.md:94-95` — `- shelved-passage re-pin: the explicit scope-transition callbacks in` / `  \`WorkshopApp.tsx\`;`
**Affected contract:** The filename-first audit and completion criterion 5 — the sprint's own deliverable

Two record errors, same root cause, same repair site.

**(a) The re-pin audit entry points where the thing isn't.** The scope-transition callbacks at `WorkshopApp.tsx:568-575` are `startOpenConversation` and `continueWithExcerpt`, both `setSessionScope` — a different action. `repinExcerpt` lives at `useWorkshopRoom.ts:383` and is passed through unwrapped at `:931` and `:1050`. In a sprint measured by "find the owner by filename," this is the one audit entry that misdirects.

**(b) Only one of two cascade deviations got written down.** `standingDirectiveRail.css` is *generic*, not feature — F6 is the sprint's own correction establishing exactly that, and the runway's target diagram places it at position **5, before both feature files**. It ships at position **7, after both**, because the pre-split bytes had it last. **The code is right** — W1's measurement beats the diagram, exactly as it did for context/session. But Implementation outcome (`:79-82`) documents the context/session swap in full and says "records the runway's anticipated deviation," singular. The result is that completion criterion 5's tier wording (`token -> shell -> context -> session -> feature`) no longer describes the shipped import block, and the runway's own cousin test says a third widget family edits `standingDirectiveRail.css`. A maintainer reading criterion 5 will reason about specificity backwards.

**Recommendation:** One sentence in Implementation outcome naming the second deviation, and reword criterion 5 to the measured order actually shipped — `token -> shell -> context -> session -> feature -> generic rail`. Fix the re-pin audit entry to name `useWorkshopRoom.ts`. Three lines of documentation, and they are the deliverable.

---

### F-09 · 🟡 Standard — `beginReplacement` mutates three fields and snapshots two

**Raised by:** Blake · **Oliver dissents on priority**
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts:542-548` — `const snapshot = { turns: [...turns], totalTurns };` / `setErrorMessage('');`
**Affected contract:** `WorkshopRoomReplacementPort` — the pair presents as symmetric begin/rollback

Trigger: the writer has a room error banner up, presses New Session, the host rejects. `restoreReplacement` executes only `setTurns` / `setTotalTurns` (`:550-553`). The thread comes back; the banner does not. They are left with a red action toast and no path back to the message that was on screen when they clicked.

The clearing is **inherited verbatim** — the old `resetSession` did `setErrorMessage('')` on the same path. What this PR introduces is the *contract*: an exported, named, two-operation port with a type called `ThreadSnapshot`, whose signature now asserts the pair is complete. An implementation detail in one hook became a published interface between two, and this PR authored it.

Oliver's dissent: the failing toast still names the host's reason, so the writer isn't left without information.

**Recommendation:** Add `errorMessage: string` to `WorkshopRoomThreadSnapshot`, capture it in `beginReplacement`, restore it in `restoreReplacement`. Three lines, all inside `useWorkshopRoom.ts`, no consumer change.

---

### F-10 · 🟡 Standard — `acceptSessionConfirm` carries three meanings in one unnamed union

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopSessionSurfaces.ts:48` — `acceptSessionConfirm: () => 'paste' | 'choose' | undefined;`
**Affected contract:** How a confirmed session dialog reports unfinished work back to the shell

Three situations, three truths, one undocumented return: no dialog open → `undefined` (`:185-187`); `new`/`new-full`/`open` → the controller acts, returns `undefined` (`:189-198`); `replace-shelf` → the controller **does not act** and returns the caller's own token for the shell to finish (`:196`). So `undefined` means both "nothing to do" and "done, handled here," while a value means "I declined — you finish it." Nothing at `:48` says any of that; the shell's consumption at `WorkshopApp.tsx:554-565` is the only place the contract is legible, and someone adding a sixth confirm kind reads the interface.

It is also the one place in this directory that reports back by return value — siblings use callbacks (`onResult` at `:28`; `onError`/`onCloseGesture`/`onCloseLexicalGravity` in `useWorkshopWidgetOpening.ts:37-39`), and the reverse leg of this very workflow is a callback (`useWorkshopContextSheet.ts:39`). A callback isn't right here — `contextSheet` is constructed after `sessionSurfaces` (`:448` vs `:524`), so the ordering force is genuine and a return value is the honest way out. The mechanism is fine; it's unnamed.

**Recommendation:** Name the return so `undefined` means one thing:

```ts
/** Work this controller cannot resolve alone; the shell must finish it. */
export type WorkshopSessionConfirmResumption = { resume: 'paste' | 'choose' };
```

`undefined` then uniformly reads "fully resolved here." Renaming to `resolveSessionConfirm` would make the shape self-describing, but the named type is the load-bearing half.

---

### F-11 · 🔵 Nit — The widget correlation effect newly re-runs per streaming chunk `🎯 Consensus`

**Raised by:** Sam, Tim
**Discovery:** 2 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:232` — `onError: (message) => showToast({ message, icon: 'x', tone: 'error' }),`
**Affected contract:** `useWorkshopWidgetOpening` correlation-effect dependency array

`onError` is allocated fresh every render and is a dependency of the correlation effect (`useWorkshopWidgetOpening.ts:161-168`), so the dep array can never compare equal. `useStreaming.appendToken` fires `setBuffer`/`setChunkCount` per chunk with no debounce, so the root re-renders per streamed token and the effect re-subscribes with it.

**Not inherited.** Pre-split, the same effect listed the stable `showToast` (`useCallback` with `[]`), so it ran only when its real inputs changed. This PR tightened the session-settle effect's deps — a real, stated win — and in the same move loosened this one. Cost today is nil (~200 ns/chunk behind an early return), and no double toast is reachable. It's worth a line because the guard is now carrying the load the dep array used to, and it is the one inline arrow among three controller option bags — `handleSessionResult` four hundred lines below is wrapped correctly.

**Recommendation:** `const handleWidgetOpeningError = React.useCallback((message: string) => showToast({ message, icon: 'x', tone: 'error' }), [showToast]);` — matching `handleSessionResult`.

---

### F-12 · 🔵 Nit — Type re-export shims kept alive by three test files, with two doc comments stranded `🧭 Corroborated Runway`

**Raised by:** Parker, Bria
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx:31-33` — `export type {` / `  WorkshopTextSheetMode` / `} from '@hooks/domain/workshop/controllers/useWorkshopContextSheet';`
**Affected contract:** `CLAUDE.md` alpha rule — "fully remove old implementations rather than … adding compatibility shims"

The move is right and effectively forced: the controller holds the state these unions type, and a `hooks/domain/` module importing from `components/` would be worse. Verified that the direction genuinely inverted — the pre-PR shell imported all three types *from* the component modules (`WorkshopApp.tsx:54-61`, `:85-88` at merge base). (The direction itself is well-precedented: eight sidebar components already import hook types from `@hooks/domain/`.)

What stayed behind is residue. Each component imports and re-exports the identical specifier on adjacent lines, and the **only** remaining consumers are three test files. No production module reads them.

The costlier half is the comment. `WorkshopTextSheet.tsx:30` still carries *"What the sheet is being used for; drives kicker, copy, and affordances."* — attached to the re-export, while the definition at `useWorkshopContextSheet.ts:13-18` is bare. Same for `WorkshopGesturePlaygroundModal.tsx:42`. Someone adding a sixth sheet mode opens the controller, finds an undocumented union, and never learns the arm they add has to earn kicker copy and affordances.

**Recommendation:** Delete the six `export type` lines, re-point the three test imports at the controllers, and move each stranded doc comment onto its definition. Add one line to Implementation outcome recording that opening/mode unions now live with their controllers.

---

### F-13 · 🔵 Nit — Newly-authored relative imports where every same-subtree sibling uses aliases

**Raised by:** Stan
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopSessions.ts:4` — `import { useVSCodeApi } from '../../useVSCodeApi';`
**Affected contract:** `CLAUDE.md` — "Zero relative imports policy: All imports use semantic aliases"

Two sibling sets compete. Set A: 17 sidebar hooks in `hooks/domain/`, all relative — legacy predating the alias push. Set B: everything Sprint 01/02 authored inside `hooks/domain/workshop/` — `useWorkshopWidgetHost.ts:4`, `useWorkshopStandingDirectives.ts`, `widgets/useGesturePlayground.ts`, `widgets/useLexicalGravity.ts` — **4 for 4 aliased**. Set B controls: same subtree, same epic, two sprints back, and the direction the documented policy points.

The cost isn't aesthetic — this PR demonstrated it. `useWorkshop.ts:25` was `'../useVSCodeApi'`; moving one directory deeper forced `'../../useVSCodeApi'`. `useWorkshopWidgetHost.ts` would have moved for free. Seven more controllers are queued for this exact subtree while Sprints 04–07 keep reshuffling. `.eslintrc.json`'s `no-restricted-imports` is scoped to `apps/vscode-extension/**`, so nothing enforces this inside core — the sibling set is the only thing carrying the convention.

`useWorkshopRoom.ts:4` is rename churn and doesn't count.

**Recommendation:** Convert the three newly-authored specifiers to `@hooks/*`: `useWorkshopSessions.ts:4`, `useWorkshopContextSheet.ts:10-11`.

---

### F-14 · 🔵 Nit — Two integrity guards moved without their reasons

**Raised by:** Patricia
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopContextSheet.ts:137-143` — `pinExcerpt(text, verifiedExcerpt !== null && text === verifiedExcerpt.text ? verifiedExcerpt.source : undefined);`
**Affected contract:** Verified-excerpt provenance; late-attachment sheet correlation

Both guards are integrity controls, not conveniences. The equality test at `:140` stops a *claim of verified editor provenance* from riding along on text the writer edited in the sheet — the host verified a specific string, and the attribution is valid only while that string survives. The correlation at `:170-173` stops a late reply from painting a different file's body into a reopened sheet.

Both moved verbatim and are correct. What didn't move is the why. Pre-split, each carried its own comment (`WorkshopApp.old.tsx:760-762`, `:826-828`); the new file has one line total, its header. `text === verifiedExcerpt.text` now reads like a redundant equality check beside a null test. A future simplification pass removes one and nothing fails — the 111-line suite covers sheet open/apply/close and attachment matching, not the mismatched-text provenance drop. The repo keeps exactly this kind of why-comment on exactly this kind of guard (`MarkdownRenderer.tsx:16-19`, `useWorkshopRoom.ts:441-446`).

**Recommendation:** Re-attach the two original comments at their new homes. No code change.

---

### F-15 · 🔵 Nit — `WorkshopThread`'s memo is defeated per streaming chunk (inherited)

**Raised by:** Tim
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:1101-1106` — `onTalkDirectly={(toolId) => workshop.setChatTarget({ kind: 'tool', toolId })}`
**Affected contract:** `WorkshopThread` (`React.memo`) re-render gating

Every other prop at that call site is stable; two inline arrows defeat the memo, so the whole thread re-renders per chunk though no turn changed. Measured, jsdom, varying only seeded turns: 0 turns → 3,258 µs/chunk; 20 → 4,779; 60 → 7,549. **~71 µs per turn per chunk** — and the linearity is the proof the memo isn't holding.

jsdom overstates DOM work substantially; the real Electron slope is plausibly 5–15 µs/turn, so at 60 turns × 60 chunks/s this is single-digit-percent CPU and **no user sees it today**. It is the only O(N) term on the token clock in this file, and N is host-controlled — no webview-side cap on the visible window was found.

**Explicitly inherited** — identical arrows at `WorkshopApp.old.tsx:1389-1394`; this PR only re-pointed the two `onOpenWidget*` props beside them.

**Recommendation:** Two `useCallback`s beside `copyTurn`/`saveTurn`, or defer to tech debt with the numbers attached. Not this PR's obligation.

---

### ⭐ Praise

**P-01 · The stylesheet split is safe in ways the SHA-256 cannot prove** — Blake.
The hash proves source bytes concatenate back to the monolith: necessary, not sufficient. Seven `<style>` elements are not one stylesheet if any file is independently invalid, relocates a relative asset, or re-triggers a per-file PostCSS pass. All three checked against raw files and independently re-verified: every one of the eight stylesheets closes at **depth 0 with no negative excursion** (no rule or `@media` block severed at a file boundary — a mid-block split would hash correctly and still drop rules in both halves); **zero** `url(`, `@import`, or `composes:` anywhere, though three files moved several directories; **zero** `@tailwind`/`@layer`/`@apply`, so the per-file PostCSS pass is a true passthrough. This is the strongest available substitute for the visual pass that couldn't be run.

**P-02 · Every failure path kept its voice across the move** — Oliver.
`showToast(` call sites: 8 before, 8 after, every message string identical. The two that left the shell became explicit injected ports rather than quietly vanishing — the widget-config error toast became `onError`, the session-action toast became `handleSessionResult`/`onResult`. That is precisely the thing these reviews usually exist to catch missing. The rollback trail also checks end to end: `postActionFailure` writes a named Output Channel line *and* posts the same host-authored text as the toast the writer reads.

**P-03 · The replacement port is tested from both ends against each other** — Cal.
`useWorkshopSessions.test.ts:43-65` and `useWorkshopRoom.test.ts:84-91` test the two halves of `WorkshopRoomReplacementPort` against each other rather than against themselves — the right shape for a cross-hook port, and genuinely rare.

**P-04 · The cost argument is closed with numbers** — Tim.
92 + 27 props, both object literals so V8 keeps them on the fast path: **1,273 ns per merge**, against a 3,258 µs streaming-chunk render — **0.039%**. `React.memo` appears twice under `presentation/webview` and neither consumer receives the merged object. The stylesheet split costs **+1.66 KB** (277 bytes/module × 6). If `:205` is re-litigated, litigate it on legibility.

## What the Panel Changed About the Runway

**Affirmed.** The stylesheet-witness contradiction reproduced exactly by construction. The `controllers/` category gap held under a full 27-hook census. The byte-identity proof is honest and not self-referential. The sprint document is honest — every verification claim in it was independently confirmed, and it leaves its own box unchecked rather than claiming a pass.

**Refined.** Four places where the territory sharpened the map:
- **The `:205` exit is 8× cheaper than the runway implied.** Parker measured 33 session-owned reads out of 255; the "unreviewable diff" force was sized against the wrong number.
- **The persistence precedent is 24 of 24, not three.** Stan's census found the four Sprint 01/02 siblings carry an explicit rationale comment for an identical situation — much stronger than "an idiom exists."
- **`onError` churn is newly introduced, not inherited.** Sam checked the pre-split deps: the old effect used the stable `showToast`. The runway's blanket "churn is inherited" was too broad.
- **The D4 guard has a second, distinct hole.** The runway named the `index.tsx` basename exemption; Sam found the import-syntax narrowness, which is the more reachable of the two.

**Rejected.** Two runway suspicions died on evidence, which is the process working:
- **The "reversed dependency" is not a violation.** Marcus found eight pre-existing components already importing hook types from `@hooks/domain/`. Only the re-export shims survive, as a Nit.
- **The shell computing controller preconditions is correct, not misplaced.** `hasReplaceableSessionState` reads five room fields to make a session decision; the shell is the only place that composition can live, and injecting the boolean is what keeps the controller transport-free. That is the boundary working.

Also closed before the panel ran, and confirmed by it: StrictMode double-toast does not exist (double-invoke is mount-only; the result slot is empty at mount); double-`resetSession` is UI-gated through `sessionActionPending`; listener churn is identical pre-split with no missed-keypress window. Sam additionally cleared the 220 ms debounce (one timer cancelled, one set, one request), `acceptSessionConfirm`'s misfire risk (closed union), and the excerpt-provenance symmetry (`WorkshopTextSheet.tsx:321` re-compares live).

**Still unknown.** Whether `:205` is scaffolding or the intended shape. Whether `controllers/` is permanent. Whether the hash witness has a planned end-of-life. Whether Sprints 04/05 will mirror room/sessions by name. And what the visual pass shows.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A receipt and a guard should never share a fixture

**Illuminated by:** F-01 (Marcus, Cal, Stan)

Assertions have lifespans, and the two ends of that range don't mix: a chain-of-custody hash proves one migration happened once, while an import-order rule must hold forever. When both hang off the same constant, the permanent assertion becomes the mechanism that breaks the temporary one — the next stylesheet must enter the array, and entering the array is what invalidates the hash. The repo already knew the safe form: `noticeScreenshotRedaction.test.ts` pins a *stable* artifact and spends nineteen lines telling the future what to do when it legitimately changes, so the failure arrives as instructions rather than as a bare hex diff.

**Carry forward:** For every assertion you write, answer out loud "what legitimately changes this?" — and if the answer is "a migration that already finished," give it its own file and its own expiry note.

### Lesson — Naming a thing makes it start keeping promises

**Illuminated by:** F-09 (Blake), F-10 (Parker), F-03 (Marcus, Stan)

A behavior-preserving refactor is not meaning-preserving, because extraction promotes tacit internal behavior into public shape, and shape asserts things behavior never did. `beginReplacement`/`restoreReplacement` reads as a symmetric pair the moment it's exported as one, so the third mutated field that was never snapshotted stops being an implementation quirk and becomes a broken contract in the signature. The same move happens one level up: a directory named `controllers/` announces a category, and a category with no written defining property gets its real definition from whatever the next seven instances happen to do.

**Carry forward:** After extracting, read only the new names and types and write down what they promise — then check each promise against the body. Where the promise is wider than the behavior, either narrow the name or widen the behavior; do not leave the gap for a reader to discover.

### Lesson — A guard proves what it can see, not what it says

**Illuminated by:** F-05 (Sam), F-06 (Cal)

Both witnesses here were shaped by the single example standing in front of them when they were written: one import syntax, one `{ok:true}` fixture. That's the natural failure mode of guards authored alongside the code they guard — they encode the instance, not the class, and they stay green through exactly the variant that would hurt. The tell is cheap to check: delete the clause you believe is load-bearing, or write the bypass you'd use if you were trying to sneak past, and see whether anything goes red.

**Carry forward:** When you add a guard, spend two minutes as its adversary — name one input it must reject and one it currently lets through — and put that input in the test.

### Lesson — Verify what survives the proof, not what worried you at the start

**Illuminated by:** F-07 (Cal, Bria), F-08 (Bria), and the runway's own closed hazards (Blake, Marcus)

A plan's hazard list is a hypothesis with a half-life, and this one aged well: StrictMode double-toast, double-`resetSession`, and listener churn were all investigated and closed, and a suspected reversed dependency turned out to have eight pre-existing precedents. That is the map being corrected by the territory, which is the map doing its job — but the checklist and the sprint record didn't move with it, so the remaining manual criterion still aims at pixel risk that W1/W2 had already retired while ~40 rewired props stayed unwitnessed. Evidence should do two things when it lands: retire the items it closes, *and* re-aim what's left at the residual.

**Carry forward:** Before signing off, re-derive the manual checklist from what the automated evidence did *not* cover, rather than ticking the list you wrote before the evidence existed.

### Lesson — Today's reachability is dated by tomorrow's schedule

**Illuminated by:** F-04 (Oliver, Blake), F-02 (Marcus, Parker), and the queued work behind F-01 and F-03

"No shipped path produces a third widget id" is a true statement with a delivery date on it — `prose-controller` is already on the calendar, as are seven more controllers and the next Workshop stylesheet. When the follow-on work is written down, a reachability argument is a scheduling fact, not a risk assessment, and the review should price the compromise against the roadmap it's standing on. The sizing matters too: the spread-merge was justified against 255 identical-looking reads, but the honest exit is the 33 that actually diverge — the cost of undoing is the divergence, not the surface.

**Carry forward:** For any "acceptable for now," name the sprint that ends the "now" and write the exit price in the code, not in the plan.

*The sprint already contains its own best counterexample — a port tested from both ends against each other rather than against itself — which is a good sign that the instinct is present and just wants to be aimed at the seams the refactor newly created.*

## Horizon Watchlist

Not merge blockers. Real pressures the panel supported but which do not belong in a finding today.

- **The third widget forks rather than extends.** `useWorkshopWidgetOpening` needs eight edits for Prose Controller — new type, third state slot, arms in `launchWidget`/`openWidgetRecommendation`/the correlation effect, a `closeProseController`, a fifth option, two interface fields. The backend already solved the same variation with a family registry (`WorkshopStandingDirectiveOperations.ts:138`) that has a `prose-controller` placeholder in it. Two-is-not-a-pattern is defensible; the relief valve (one `{widgetId, opening}` union + a `Record<WorkshopWidgetId, OpeningStrategy>`) is strictly smaller at three widgets than at eight.
- **Sprint 04's naming bid.** `WorkshopHandler.ts` is 2,995 lines and faces the same brief. `application/handlers/domain/workshop/` already exists. If 04/05 don't mirror room/sessions by name, `CLAUDE.md`'s Domain Mirroring table gains its first documented mismatch — a cheap alignment now, expensive to retrofit.
- **Which template Sprint 04 copies.** Four candidates from this PR: the one-way port (best), the role-named subdirectory, the merged aggregate shortcut, and the retirement-assertion trio. The epic hasn't said which it wants.
- **`WorkshopApp.tsx` finishes the epic near 1,400 lines.** ~700 of the remainder is JSX; the deferred modal debt removes logic, not markup. That may be entirely fine — "700 lines of layout with no state machines" is a different animal from "1,767 lines with eight." The gap is that nobody has said so, leaving the checklist to argue with the anti-pattern list.
- **`jest.config.js:48` excludes `presentation/**` from coverage.** The 1,836-test headline is a pass signal, not a coverage signal for this change.

## The Closer

🚪 **Knock, knock.**
*Who's there?*
**`64783db8fdfc6a0295fb94b5c7e345d79063890b334fb9f73ea88f597092db2d`.**
*`64783db8fdfc6a0295fb94b5c7e345d79063890b334fb9f73ea88f597092db2d` who?*
**Exactly — and that's the problem. Nobody's going to recognize me either, the day I stop matching.**

## Final Assessment

**Nearly there.** The refactor itself is in good shape and unusually well evidenced: the CSS is provably byte-identical, behavior preservation held under adversarial tracing by two specialists, the room/sessions port is guarded in the right direction and tested from both ends, and every verification claim the sprint made was independently confirmed. No Blocking issue survived validation, and three hazards the runway raised were investigated and closed rather than shipped as findings.

What wants attention before this merges is the witness system rather than the code. **F-01** is the one to fix first — not because it fails today, but because it is guaranteed to fail in a way that invites deleting the durable guard alongside the spent receipt. **F-07**, **F-05**, and **F-06** are the same shape: guards and tests aimed at the risk that was feared rather than the risk that remains after the proofs landed. All four are small, and none requires re-opening the extraction.

The unchecked visual pass remains the honest gap. Blake's structural verification (P-01) materially de-risks the CSS half of it; the prop-rewiring half is what a human still needs to walk, and the sprint's own ten traceability witnesses are a better script for that than the criterion as written.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
