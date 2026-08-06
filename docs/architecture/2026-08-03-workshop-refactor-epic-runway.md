# Architecture Change Runway — Workshop Architecture Refactor (epic-level)

**Subject:** [epic-workshop-architecture-refactor-2026-08-03](../../.todo/epics/epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md), as landed so far in **PR #101** (`sprint/workshop-architecture-refactor-00-fitness-witnesses` → `epic/workshop-architecture-refactor`)

**Altitude:** Epic top view. Per-sprint runways follow; this one deliberately stops at the seams between phases and does not re-derive each sprint's internal moves.

**Audience / task:** Decision owner (Okey) approving the epic's architecture shape and the Phase 0 gate.

**Date:** 2026-08-03

---

## Band 0 — Change Card (30 seconds)

**Thesis.** Because Workshop's responsibilities cannot be inferred from its filenames — Gesture Playground's workflow hides inside generic names (`WorkshopWidgetHandler`, `useWorkshop`, `WORKSHOP_WIDGET_*`) while Lexical Gravity's *specific* handler owns the *family-generic* standing routes — change ownership placement across presentation, handlers, services, and message contracts, while preserving one composition root, one session aggregate, exact wire and persistence shapes, so that the next widget (Prose Controller) can be added by copying one pattern instead of choosing between two contradictory precedents.

**The five architecture moves:**

| # | Move | Phase |
|---|---|---|
| 1 | Two symmetric named feature slices (Gesture ‖ Lexical) across hook → handler → service → component → tests | P1 |
| 2 | Family-generic standing routes leave the Lexical handler for a `WorkshopStandingDirectiveHandler`; closed-registry dispatch replaces feature narrowing in generic services | P2 |
| 3 | `WorkshopApp` / `useWorkshop` decompose into named room / session / widget-host owners; `workshop.css` splits by surface | P3 |
| 4 | `WorkshopHandler` (2,976 lines) becomes a room/run orchestrator + slice composer; cohesive IPC clusters move to sibling handlers | P4 |
| 5 | `WorkshopSessionService` (2,894 lines) stays the aggregate **facade** while ledgers/state machines get named internal owners; `workshop.ts` (1,982 lines) splits by subdomain behind its barrel | P5–P6 |

**Affected layers:** presentation (hooks, components, styles), application (handlers, services), shared contracts (message tree), tests, docs. **Untouched by design:** `packages/core` ↛ `vscode`, `extension.ts` as sole composition root, persistence shapes, wire behavior, infrastructure adapters (intentionally asymmetric).

**Highest-risk failure modes:**
1. A "pure move" phase silently changes behavior (CSS cascade order in P3 is the sharpest case — it has no witness).
2. Witness coverage arrives *after* the phase it was meant to protect (see F1 — this is live today).
3. Contract split (P6) drifts from the frontend mid-epic while paused feature branches rebase onto it.

**Decisions required from you:** (a) accept or waive **F1** before P1 opens; (b) assign a phase to the five ADR fitness functions that currently have no owning sprint (**F3**); (c) confirm P3's "no visual changes" is verified by eye or by a witness (**F6**).

**Implementation gate:** P0 (PR #101) — **PASS**. P1 — **CONDITIONAL** on F1.

**Plan status:** `READY FOR REVIEW` (epic architecture), with a `REFINED` verdict on Phase 0's guard scope.

---

## Band 1 — Architecture Delta Map (~2 minutes)

### Before — Workshop today

*Verified against the working tree at PR #101. Line counts are `wc -l`. Only Workshop-relevant paths shown.*

```text
packages/core/src/
├── application/
│   ├── handlers/domain/                          [=] flat, alongside 11 non-Workshop handlers
│   │   ├── WorkshopHandler.ts                    2,976  run lifecycle + settings + personas
│   │   │                                                + scope/context + files + resources + todos
│   │   ├── WorkshopSessionMessageHandler.ts        309  ← precedent: a sibling already exists
│   │   ├── WorkshopWidgetHandler.ts                739  ⚠ FALSE GENERIC: this IS Gesture Playground
│   │   └── WorkshopLexicalGravityHandler.ts        347  ⚠ owns 2 family-generic standing routes
│   └── services/workshop/                        [=] 25 files flat + 3 subfolders
│       ├── WorkshopSessionService.ts             2,894  aggregate facade (legitimately large)
│       ├── WorkshopSessionPersistenceCoordinator.ts 1,022
│       ├── WorkshopSessionStateV1Shape.ts          936
│       ├── …21 more flat files
│       ├── directives/                            390  ⚠ StandingDirectiveService narrows to
│       │                                                 family: 'lexical-gravity'
│       ├── widgets/
│       │   ├── WorkshopWidgetConfigLedger.ts             ✅ generic, exemplary
│       │   ├── WorkshopWidgetConfigOperations.ts         ✅ closed dispatch, exemplary
│       │   └── GesturePlaygroundConfigCodec.ts     ⚠ feature codec loose in the generic folder
│       └── lexicalGravity/                        ⚠ …while Lexical's codec has a package
├── presentation/webview/
│   ├── WorkshopApp.tsx                           1,795  shell + modals + feature branching
│   ├── hooks/domain/
│   │   ├── useWorkshop.ts                        1,176  ⚠ room + sessions + context + GP workflow
│   │   └── useLexicalGravity.ts                          ✅ named feature hook (no GP sibling)
│   ├── components/workshop/                      [=] 30 files flat, no widgets/ subtree
│   │   ├── WorkshopGesturePlaygroundModal.tsx      873
│   │   └── WorkshopLexicalGravityModal.tsx         722
│   └── workshop.css                              6,367  ⚠ shell + sessions + context + GP + LG
├── shared/types/messages/
│   └── workshop.ts                               1,982  ⚠ 7 protocol families in one file
└── __tests__/                                    77 Workshop files, mirroring the scars above
```

### After — the ADR destination

```text
packages/core/src/
├── application/
│   ├── handlers/domain/workshop/                 [>] new package (was flat in domain/)
│   │   ├── WorkshopHandler.ts                    [~] room/run orchestrator + slice composer
│   │   ├── WorkshopSessionMessageHandler.ts      [>] moved
│   │   ├── WorkshopScopeContextHandler.ts        [+] P4
│   │   ├── WorkshopStandingDirectiveHandler.ts   [+] P2 — sole generic apply/remove owner
│   │   └── widgets/
│   │       ├── gesturePlayground/
│   │       │   └── WorkshopGesturePlaygroundHandler.ts  [>] renamed from WorkshopWidgetHandler
│   │       └── lexicalGravity/
│   │           └── WorkshopLexicalGravityHandler.ts     [>] loses standing routes
│   └── services/workshop/
│       ├── session/                              [>] aggregate + extracted ledgers
│       │   └── WorkshopSessionService.ts         [~] facade preserved (ADR §4)
│       ├── widgets/
│       │   ├── WorkshopWidgetConfigLedger.ts     [=] already correct
│       │   ├── WorkshopWidgetConfigOperations.ts [=] already correct
│       │   ├── gesturePlayground/                [>] Codec + Directive
│       │   └── lexicalGravity/                   [=] Codec + Directive + Lenses
│       └── directives/
│           ├── WorkshopStandingDirectiveService.ts   [~] loses 'lexical-gravity' narrowing
│           ├── WorkshopStandingDirectiveLedger.ts    [=]
│           ├── WorkshopStandingDirectiveOperations.ts [+] closed dispatch (mirrors widgets/)
│           └── WorkshopStandingDirectivePresentation.ts [=]
├── presentation/webview/
│   ├── WorkshopApp.tsx                           [~] shell + route + layout only
│   ├── hooks/domain/workshop/                    [>] new package
│   │   ├── useWorkshopRoom.ts                    [+] P3
│   │   ├── useWorkshopSessions.ts                [+] P3
│   │   ├── useWorkshopWidgetHost.ts              [+] P3
│   │   └── widgets/
│   │       ├── useGesturePlayground.ts           [+] extracted from useWorkshop
│   │       └── useLexicalGravity.ts              [>] moved
│   └── components/workshop/widgets/
│       ├── gesturePlayground/{Modal.tsx, gesturePlayground.css}  [>]
│       └── lexicalGravity/{Modal.tsx, lexicalGravity.css}        [>]
└── shared/types/messages/workshop/               [>] file → package behind the same barrel
    ├── index.ts  session.ts  context.ts  participants.ts
    └── widgets.ts  gesturePlayground.ts  lexicalGravity.ts  standingDirectives.ts
```

**The shape of the change in one line:** every axis in the tree above moves from *layer-then-alphabet* to *layer-then-feature*, with generic names retained only where a proven family mechanic already lives there (`WorkshopWidgetConfigLedger`, `WorkshopWidgetConfigOperations` — the two modules the ADR holds up as exemplary and does not touch).

### Responsibility ledger — what actually changes hands

| Owner | Gains | Loses |
|---|---|---|
| `WorkshopGesturePlaygroundHandler` (was `WorkshopWidgetHandler`) | An honest name; GP menu/generate/commit semantics become *declared* rather than incidental | Its claim to being the generic widget host |
| `WorkshopLexicalGravityHandler` | Nothing | Generic `APPLY`/`REMOVE_STANDING_WIDGET` route ownership |
| `WorkshopStandingDirectiveHandler` (new) | Sole generic standing IPC ownership, correlation, closed-family dispatch | — |
| `WorkshopStandingDirectiveService` | Family-agnostic transaction kernel | `family: 'lexical-gravity'` request narrowing |
| `useWorkshop` | — (retired or reduced to a named compatibility facade) | GP async workflow state; named-session, context, attachment orchestration |
| `WorkshopHandler` | A defensible primary responsibility | Scope/context, file/resource, participant, settings, todo clusters |
| `WorkshopSessionService` | Focused internal collaborators | Nothing structural — the facade, reset semantics, checkpoint ordering, autosave ordering, and cross-record integrity **stay** (ADR §4) |

### Two flows, before and after

**Standing directive apply — the epic's central correction.**

```
BEFORE   Lexical modal → useLexicalGravity → WorkshopLexicalGravityHandler
                                              ├─ owns LG preview/build/save   ✅ correct
                                              └─ owns APPLY_STANDING_WIDGET   ⚠ family route
                                                   → StandingDirectiveService (narrows to LG)
                                                        → WorkshopSessionService

AFTER    Lexical modal → useLexicalGravity → WorkshopLexicalGravityHandler (LG-only)
                                           ↘
                     APPLY_STANDING_WIDGET → WorkshopStandingDirectiveHandler
                                              → StandingDirectiveOperations (closed dispatch by widgetId)
                                              → StandingDirectiveService (family-agnostic kernel)
                                                   → WorkshopSessionService (atomic mutation)
```

*Why it matters:* today, adding Prose Controller as a second standing family means editing Lexical Gravity's handler. After P2, it means adding one operations entry and one feature handler. That is the epic's whole thesis in one diff.

**Gesture Playground generate/commit** changes ownership *labels*, not topology — the flow is already correct, it is simply narrated by the wrong filenames. This is why P1 is a pure-rename phase and why it must precede P2.

### Blast radius — top view

| Dimension | Level | Note |
|---|---|---|
| Structural | **HIGH** | ~90 production files change path or name across 7 phases; `MessageHandler` wiring churns in P1, P2, P4 |
| Behavioral / runtime | **LOW** | Constraint 1 (moves ≠ behavior in one commit) plus 77 existing Workshop test files. Exception: P3's CSS split, where load order *is* behavior |
| Contract (wire) | **LOW–MODERATE** | P2 renames Gesture-specific message types; P6 splits the module behind the existing barrel. Alpha rules make this free, but paused feature branches will conflict |
| Data / persistence | **LOW** | Explicit non-goal; aggregate boundary and hydration ordering are locked constraints, and one witness already guards ledger bypass |
| Verification | **HIGH** | 77 test files move with their owners; witnesses must be edited in the same commit as each exception removal |
| Coordination | **MODERATE** | Three paused Conversation Widgets sprints (02B-B, 03, 04) rebase across the whole tree afterwards |
| Evolution | **HIGH — the point** | This is the dimension the epic exists to improve; measured by the Prose Controller reproduction test |

---

## Band 2 — Reviewer Packet (~10 minutes)

### What survived attack

I tried to break these and could not:

- **The hotspot evidence is accurate.** Every line count in the semantic-runway report matches the working tree exactly (`WorkshopHandler` 2,976; `WorkshopSessionService` 2,894; `workshop.css` 6,367; `workshop.ts` 1,982; `WorkshopApp` 1,795; `useWorkshop` 1,176; `WorkshopWidgetHandler` 739). The analysis was measured, not estimated.
- **Route-witness coverage is complete for inbound routes.** All nine request-bearing widget/standing message types in `base.ts:159-175` appear in `WORKSHOP_WIDGET_ROUTE_OWNERS`; the remaining eight are outbound results with no route to own.
- **Two witnesses will survive the moves without edits.** Both the route-owner and ledger-bypass guards scan `application/handlers/domain` *recursively*, so the P1/P4 relocation into `domain/workshop/**` needs no guard rewrite — only owner-path updates. That is a deliberate design, not luck.
- **Phase ordering is correct.** P1 (rename) genuinely must precede P2 (route ownership): moving standing routes off the Lexical handler while the Gesture handler is still called `WorkshopWidgetHandler` would leave *two* files with generic names and no way to say which owns the family.
- **ADR §8's "no line limit" is not an escape hatch.** I read it as one; it isn't. Each sprint pairs it with a responsibility criterion, and the hotspot table already pre-classifies which large files are cohesive (`WorkshopSessionPersistenceCoordinator`, `WorkshopSessionStateV1Shape`) versus which are collections.
- **The aggregate constraint is real and already enforced.** `boundaries.test.ts:249-256` fails if any handler names `WorkshopWidgetConfigLedger` or `WorkshopStandingDirectiveLedger`, and `FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION` already includes `WorkshopSessionService`. Constraints 4 and 5 are witnessed, not aspirational.
- **All 8 architecture boundary tests pass** on the branch (`npx jest packages/core/src/__tests__/architecture/boundaries.test.ts` — 8/8, 2.4s).

Those parts of the design do not need re-litigating.

### Ranked findings

**F1 — HIGH — The feature-isolation witness protects almost nothing on the Gesture side, and only grows teeth *after* the phase it exists to protect.**

*Evidence:* `boundaries.test.ts:230-247` selects candidate files by **path** — `/GesturePlayground/i` and `/LexicalGravity/i`. Today only three production files match on the Gesture side: `GesturePlaygroundConfigCodec.ts`, `GesturePlaygroundService.ts`, `WorkshopGesturePlaygroundModal.tsx`. Gesture Playground's *actual* owners — `WorkshopWidgetHandler.ts`, `useWorkshop.ts`, and the GP sections of `workshop.css` — match neither pattern, so the guard cannot see them.

*Failure scenario:* P1 is the phase that renames those files. During P1, a maintainer resolving a rename conflict introduces a Lexical reference into the newly-named Gesture handler; the guard only begins covering that file at the end of the same commit that could have broken it. The witness is a lagging indicator of exactly the migration it was written for.

*Smallest fix:* add the pre-rename paths to the Gesture arm explicitly, and assert the scanned set is non-empty:
```ts
const GESTURE_OWNERS_UNDER_MIGRATION = [
  'application/handlers/domain/WorkshopWidgetHandler.ts',   // P1 rename target
  'presentation/webview/hooks/domain/useWorkshop.ts'        // P1 extraction target
];
expect(gestureFiles.length).toBeGreaterThanOrEqual(5);       // fails if the selector goes blind
```
Note also that the guard matches *any substring mention*, not imports — after P2 a Gesture handler that references a family union containing `'lexical-gravity'` would trip it. Decide now whether that strictness is intended.

**F2 — MEDIUM — The exception witness crashes rather than fails when a file moves.**

*Evidence:* `boundaries.test.ts:258-269` calls `fs.readFileSync(path.join(SRC_ROOT, file), ...)` on four hardcoded paths, two of which P1 will move.

*Failure scenario:* the first P1 commit that relocates `WorkshopWidgetHandler.ts` produces `ENOENT: no such file or directory` instead of "exception P1 has moved — update the witness." A stack trace at a boundary the plan explicitly anticipated is a bad first impression for the phase.

*Smallest fix:* read defensively; treat a missing path as a distinct, named assertion failure.

**F3 — MEDIUM — Five of the ADR's ten fitness functions have no owning phase.**

*Evidence:* ADR §"Architecture fitness functions" lists 10. PR #101 installs witnesses for #1, #2 (as an exception), #3, #6 (via the pre-existing construction guard), and #7. Unassigned: #4 (closed registries as the only generic→feature dispatch), #5 (no feature async state in the room hook), #8 (exact draft/message pairings), #9 (action-result correlation), #10 (source/test/doc tree agreement). The epic's phase table has no witness column.

*Failure scenario:* Phase 7 discovers it owns five unbuilt witnesses at the moment it is supposed to be *removing* exceptions, and the freeze-lift slips.

*Smallest fix:* one column in the epic phase table mapping each of the ten to its installing sprint. #4→P2, #5→P3, #8→P2, #9→P2, #10→P6 read as the natural homes.

**F4 — MEDIUM — The route-owner witness is documented as the wrong thing.**

*Evidence:* `MessageRouter.register` (`MessageRouter.ts:31-35`) already **throws** on duplicate registration at runtime. The ADR states fitness function #1 as "one route owner per Workshop message type" — which was already guaranteed before this PR.

*Why it matters:* the witness's real and considerable value is different and stronger — it is a **declared ownership ledger** that fails when a route silently migrates between files. Stated as a duplicate check, a future maintainer may reasonably delete it as redundant with the router. Also worth noting: it covers inbound routes only, so ADR invariant #9 (action-result correlation, which lives on the *outbound* `WORKSHOP_WIDGET_ACTION_RESULT`) has no coverage here.

*Smallest fix:* reword the doc comment at `boundaries.test.ts:58-63` and the ADR bullet to say "declared route ownership location," not "one owner."

**F5 — LOW — The destination tree contradicts two documents the epic does not name.**

*Evidence:* the target moves Workshop handlers into `handlers/domain/workshop/`. `CLAUDE.md` enumerates a flat "domain handlers (11)" list, and `docs/ARCHITECTURE.md` carries the same shape. P6's scope names `docs/ARCHITECTURE.md`, ADR references, epics, and debt records — not `CLAUDE.md`.

*Fix:* add `CLAUDE.md` to P6 scope. It is the file every future agent session reads first, so stale structure there costs more than stale prose elsewhere.

**F6 — LOW–MEDIUM — P3's CSS split is the one "behavior-preserving move" with no witness.**

*Evidence:* Sprint 03 says "split `workshop.css` by shell/session/context/feature responsibility without visual changes." Splitting a 6,367-line stylesheet changes cascade and specificity resolution order whenever two rules of equal specificity target the same element. Constraint 1 (moves ≠ behavior changes) assumes a test can tell the difference; here nothing can.

*Fix:* state the load-order invariant in the P3 sprint doc (shared tokens → shell → session → context → feature, in that import order) and name a manual visual check across the Workshop surfaces as an explicit exit criterion. This is the one place I would accept "verified by eye" as long as it is *written down* as such.

### Quality scenarios

| Stimulus | Artifact | Expected response | Measure |
|---|---|---|---|
| Prose Controller is added as a third standing family | Standing slice | New feature handler + one operations entry only | Zero diff lines in any `lexicalGravity/**` or `gesturePlayground/**` file |
| A route is moved between handlers without a plan update | Any handler | Build fails | Route-owner witness |
| A handler tries to mutate session state directly | Any handler | Build fails | Ledger-bypass witness (already live) |
| P1 rename lands with a cross-feature reference | Gesture slice | Build fails | **Currently: silent** — see F1 |
| A phase removes an exception without updating the witness | Exception list | Build fails | Exception witness (already live) |
| P3 reorders CSS load | Workshop UI | No visual change | **Currently: none** — see F6 |

### Alternative triad

| Option | Verdict |
|---|---|
| **Minimal patch** — rename `WorkshopWidgetHandler`, move standing routes, stop | Rejected, correctly. Fixes the two sharpest name lies but leaves `WorkshopApp`, `useWorkshop`, `WorkshopHandler`, and `workshop.ts` as the places every future feature accretes into — reproducing the problem within two features. |
| **The epic as planned** (7 phases, behind a feature freeze) | **Retained.** Phase boundaries are review boundaries; each phase is independently revertable on its own branch; the freeze is the honest price of not merging refactor and feature pressure. |
| **Generalize now** — open widget plugin framework | Rejected, correctly, and the ADR's reasoning holds up: Gesture generation, Lexical preview/build, project resources, and standing directives are four genuinely different workflows. A common interface would be four optional methods and a lie. Closed registries with exact discriminated unions are the right call for a family of this size. |

### Negative-space and reproduction tests

**Negative space (post-refactor):** generic Workshop modules may know widget identity, catalog metadata, config revision/reset/export/hydration, rail transaction mechanics, and action correlation. They may not know a Gesture Dictionary field, a lens, a modal's state, or a feature's writer-facing copy. The generic name `WorkshopWidgetConfigLedger` tells the truth today and will still tell it after P5 — it is the epic's proof that the pattern works.

**Reproduction (Prose Controller, post-P7):** adds `useProseController`, `WorkshopProseControllerHandler`, a config codec + directive package, a modal + stylesheet, `proseController.ts` messages, one closed-registry entry, and its own tests. Edits to existing feature code: zero. Edits to generic code: one registry line. **That single number is the epic's success metric** — more useful than any of the completion checkboxes, and worth stating in Sprint 07's exit criteria.

### Re-plan verdict: **REFINED**

*Initial read:* Phase 0 pins current truth with executable witnesses; the epic architecture is sound; approve and proceed.

*Final read:* The epic architecture **is** sound and survives adversarial reading — phase ordering, the aggregate constraint, the closed-registry choice, and the evidence base all hold. What changed is Phase 0's claimed completeness: two of its guards (feature isolation, exception list) have scope or failure-mode gaps that surface precisely during Phase 1, and half the ADR's declared fitness functions have no installing phase.

*What caused the change:* reading `boundaries.test.ts` against the actual file tree rather than against its own doc comments — the path-selector in the isolation guard matches three files, not the Gesture slice.

*Remaining uncertainty:* whether P3's CSS split can be made witness-backed at reasonable cost, or should be explicitly accepted as eyeball-verified.

### Implementation gate

| Phase | Gate |
|---|---|
| **P0 (PR #101)** | **PASS** — no source moves, suite green, exceptions exact and phase-assigned. F2–F5 are cheap enough to fold into this PR but do not block it. |
| **P1** | **CONDITIONAL** — resolve **F1** first. Its whole purpose is to protect the moves P1 makes. |
| **P3** | **CONDITIONAL** — record the CSS load-order invariant and the visual-check exit criterion (**F6**) before the split. |
| **P7** | Unchanged: exceptions empty, full verification, freeze lifted explicitly by you. |

---

## Band 3 — Evidence Appendix

| Claim | Anchor |
|---|---|
| PR #101 scope | 20 files: ADR (222 lines), epic + 8 sprints (405), `boundaries.test.ts` (138), 4 plan/debt updates |
| Witness suite green | `npx jest packages/core/src/__tests__/architecture/boundaries.test.ts` → 8/8 pass, 2.4s |
| Route witness recursion | `boundaries.test.ts:56` → `WORKSHOP_HANDLER_ROOT = handlers/domain`, walked by `collectSourceFiles` |
| Standing routes on the LG handler | `WorkshopLexicalGravityHandler.ts:85,89` |
| LG narrowing in the generic service | `boundaries.test.ts:121-124` marker `/family: 'lexical-gravity'/` |
| GP semantics in the generic handler | `WorkshopWidgetHandler.ts` — 75 `gesture` hits; registers `WORKSHOP_WIDGET_GENERATE`, `_REQUEST_WIDGET_CONFIG`, `_COMMIT_WIDGET` at lines 102-112 |
| Duplicate registration already fatal | `MessageRouter.ts:31-35` |
| Isolation guard selector | `boundaries.test.ts:233,239` — path-based `/GesturePlayground/i`, `/LexicalGravity/i` |
| Sibling-handler precedent | `WorkshopSessionMessageHandler.ts` (309 lines) already exists — P4's pattern is proven, not speculative |
| Workshop test surface | 77 files under `packages/core/src/__tests__/**` matching workshop/gesture/lexical |

**Not inspected at this altitude** (deferred to per-sprint runways): `WorkshopHandler`'s internal route clusters and helper graph (P4), `WorkshopSessionService`'s state-cluster inventory (P5), the `workshop.ts` protocol-family boundaries (P6), and `WorkshopApp`'s modal-state inventory (P3).

---

## Reader Terms Appendix

### Technical

| Term | Local meaning in this change |
|---|---|
| **Aggregate facade** | `WorkshopSessionService` — the sole entry point for whole-session mutation. P5 extracts *inside* it; the boundary itself is a locked constraint. |
| **Ledger** | An internal, session-owned record collection (`WorkshopWidgetConfigLedger`, `WorkshopStandingDirectiveLedger`). Handlers must never touch one directly — witnessed today. |
| **Closed registry** | Explicit dispatch among a known set of feature variants (`WorkshopWidgetConfigOperations`). *Divergent from the conventional "registry":* nothing registers dynamically at runtime; the set is a compile-time union. Chosen over a plugin API to keep discriminated unions exact. |
| **False generic** | A module whose generic name implies family-wide behavior while its body encodes one feature's rules. The epic's central defect; `WorkshopWidgetHandler` is the specimen. |
| **Feature slice** | A named vertical: hook → messages → handler → services/codecs → components/styles → tests. Symmetry applies to *responsibility placement*, not to file count — Lexical has a repository, Gesture does not, and that is correct. |
| **Fitness function / witness** | An executable architecture assertion in `boundaries.test.ts`. "Witness" is used here for the concrete test; "fitness function" for the invariant it encodes. |
| **Migration exception** | A recorded, phase-assigned known violation. The list may only shrink; P7 requires it empty. |
| **Pure move** | A commit containing only relocation and rewiring, never behavior. ADR §9; the CSS split (F6) is where the definition strains. |
| **Room / run** | Room = the Workshop conversation surface and its participants; run = one orchestrated model turn. What `WorkshopHandler` keeps after P4. |

### Domain

| Term | Local meaning |
|---|---|
| **Workshop** | The multi-participant conversational writing surface — the subsystem this entire epic concerns. |
| **Conversation Widget** | A structured, model-assisted contribution inserted into a Workshop conversation. The "family" whose shared mechanics generic modules may own. |
| **Gesture Playground** | The first widget: generates a bounded gesture/expression dictionary via a menu protocol, committed as a **one-shot** artifact. Currently *unnamed* in its own handler and hook. |
| **Lexical Gravity** | The second widget: builds and previews project **lenses** that bias word choice, applied as a **standing** directive. Currently named — and over-scoped, owning the family's standing routes. |
| **Prose Controller** | A planned third widget, paused behind the freeze. Serves as the epic's reproduction test rather than as scope. |
| **One-shot vs. standing** | The family's key behavioral axis. One-shot contributes a single artifact to one turn; standing installs a persistent prompt frame that survives across runs. Different lifecycles, different rails — this distinction is why the ADR rejects a single plugin interface. |
| **Prompt frame** | The bounded text block a standing directive injects into subsequent runs. Replacement and between-run guarding are the standing service's core mechanics. |
| **Feature freeze** | ADR §1 — all new Workshop feature behavior stops until P7 closes and you explicitly lift it. Refactor, tests, docs, and design work remain allowed. |
