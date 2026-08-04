# Sprint 02: Shared Route and Contract Ownership

**Status:** Complete — implemented and verified on 2026-08-03

**Branch:** `sprint/workshop-architecture-refactor-02-shared-ownership` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 01

**Evidence:** [Sprint 02 architecture change runway](../../../../docs/architecture/2026-08-03-workshop-sprint-02-shared-ownership-runway.md)

## Goal

Make family-generic standing and widget-host contracts live under generic owners
while keeping all feature semantics in named slices.

## Scope

- Add `WorkshopStandingDirectiveHandler` as the sole generic apply/remove route
  owner, at `application/handlers/domain/workshop/`.
- Add `useWorkshopStandingDirectives` as the generic presentation owner of
  `remove`, action-result correlation, and the removal acknowledgement copy.
  Ownership applies to both sides of the message boundary (D1, mirroring
  Sprint 01's widget-host decision).
- Split feature preparation/rendering operations from the generic serialized
  standing transaction kernel via `WorkshopStandingDirectiveOperations`, a closed
  registry mirroring `WorkshopWidgetConfigOperations`. The kernel's serialization,
  between-run guard, frame-replacement ordering, and atomic commit do not change.
- Lift the generic standing directive service out of the Lexical arm of
  `WorkshopWidgetRuntime` (`MessageHandler.ts`, `WorkshopHandler.ts`).
- Add exact request/action correlation and feature identity: an echoed request
  token on commit, apply-standing, and remove-standing plus their shared action
  result (D3), consumed with an exact `token && widgetId` filter.
- Rename Gesture-specific generate/progress/menu messages honestly.
  `WORKSHOP_COMMIT_WIDGET` stays generic — it is the family's one-shot rail, not
  a Gesture concept (D2) — and is made exact by payload union instead.
- Retain exact discriminated unions at shared family boundaries. Convert the four
  payloads that pair `widgetId: WorkshopWidgetId` with a Gesture-only body into
  exact contracts keyed by the literal Gesture widget identity; keep generic
  family rails union-ready.
- Make every generic-to-feature dispatch in the standing slice a `never`-guarded
  switch or registry object, including the frames renderer and the standing rail
  formatter.
- Install fitness witnesses #2 (generic standing ownership), #4 (closed dispatch),
  #8 (exact draft/message pairings), and #9 (action-result correlation).
- Add a minimal test-only second standing family fixture (a `proseController`
  operations stub driven apply -> commit -> remove) proving the family adds no
  Lexical edits and no `MessageRouter` collision. This is a refactor fixture, not
  shipped feature behavior; the feature freeze still applies.

## Accepted decisions

| ID | Decision | Accepted |
|---|---|---|
| **D1** | The presentation side of the standing boundary gets a generic owner in this sprint: `useWorkshopStandingDirectives`. | Yes — Okey, 2026-08-03 |
| **D2** | `WORKSHOP_COMMIT_WIDGET` stays family-generic; only its payload is narrowed. Scope line reads "generate/progress/menu". | Yes — Okey, 2026-08-03 |
| **D3** | The correlation token spans all three action-bearing requests, not standing alone. | Option (a) — Okey, 2026-08-03 |
| **D4** | `WorkshopStandingDirectiveFrames.ts` is retained; its renderer entry moves into `WorkshopStandingDirectiveOperations` and `Frames` becomes a thin caller. Recorded as an ADR §7 documented deviation from the semantic-runway destination map, because `Frames` has five production call sites outside the directive slice. | Option (b) — Okey, 2026-08-03 |
| **D5** | Newly discovered pre-existing false generics may be added to the migration exception ledger when documented with an owning phase. The "may only shrink" rule is amended to "may only shrink for a phase once that phase's exceptions are recorded." | Option (a) — Okey, 2026-08-03 |

## Locked constraints

- The standing transaction kernel is not rewritten: serialization,
  `assertBetweenRuns`, prompt-frame replacement before session commit, and
  `commitStandingDirectiveMutation` atomicity are preserved exactly.
- No persisted shape changes. `WorkshopStandingDirectiveSnapshot` and the
  standing family union already carry `'prose-controller'`; the live
  `WorkshopWidgetConfigSnapshot` union deliberately does not. The second-family
  proof therefore uses a structural test fake instead of shipping a future
  Prose Controller config shape.
- `extension.ts` is not edited; the directive service is already constructed
  generically as a top-level `CoreServices` member.
- No feature default travels into generic code. A generic handler must not
  answer "which widget failed?" with `'lexical-gravity'`, and generic modules
  must not carry a feature's writer-facing copy.
- Route-owner ledger entries are updated in the same commit as the move they
  describe, and reviewed as a claim rather than a fixup.

## Implementation slices

| # | Purpose | Depends on |
|---|---|---|
| 0 | Record D4's deviation and the D5 exception entries; amend the ledger rule wording | — |
| 1 | `WorkshopStandingDirectiveOperations` closed registry; `Frames`, `Presentation`, and the rail formatter delegate to it; fitness #4 | 0 |
| 2 | `WorkshopStandingDirectiveHandler`; Lexical handler sheds both routes and both bodies; kernel request union de-narrowed; `WorkshopWidgetRuntime` reshaped; route + exception ledgers updated; fitness #2 | 1 |
| 3 | Message renames, four payload unions, correlation token, `useWorkshopStandingDirectives`, dispatcher loses Lexical copy; fitness #8 and #9 | 2 |
| 4 | Second standing family fixture | 1-3 |
| 5 | Close-out: P2 exceptions empty; deviations recorded | 1-4 |

## Implementation outcome

- `WorkshopStandingDirectiveHandler` is now the sole apply/remove route owner.
  `WorkshopLexicalGravityHandler` owns only its catalog, preview, build, and save
  workflow.
- `WorkshopStandingDirectiveOperations` is the closed family registry. Lexical
  semantics live in `LexicalGravityStandingDirectiveOperations`; the generic
  transaction kernel, frame helpers, presentation helpers, and rail delegate to
  the registry without carrying Lexical writer-facing copy.
- `WorkshopWidgetRuntime.standingDirectives` is a sibling of the Gesture and
  Lexical feature bundles. The extension composition root did not change.
- Gesture generate/progress/menu/cancel contracts now say Gesture Playground.
  `WORKSHOP_COMMIT_WIDGET` remains the generic one-shot rail and has an exact
  Gesture payload arm.
- Commit, apply, and remove mint and echo request tokens. The three presentation
  owners accept results only when action, widget identity, and token all match.
- The test-only Prose Controller operations seam completes apply → aggregate
  commit → remove without adding production persistence or routes.
- Fitness witnesses #2, #4, #8, and #9 now cover route/presentation ownership,
  closed registry exhaustiveness, invalid contract pairings, and stale result
  rejection. Phase-2 migration exceptions are empty; the two accepted Phase-6
  exceptions remain.

### Verification

- `npm run typecheck`
- `npm run lint` — zero errors; repository baseline warnings remain
- `npm run build` — production extension/webview bundles and bundle sentinel pass
- `npm test -- --runInBand` — 168 suites, 1,810 tests, 1 snapshot passed

## Deferred, with reasons

- Moving Lexical Gravity's weight/reach field grammar out of
  `shared/constants/workshopWidgets.ts` and its prompt copy/validation out of
  `utils/workshopWidgetRecommendation.ts`. Both are pre-existing false generics
  discovered during this sprint's runway; both are recorded as P6 exceptions
  under D5 rather than folded into a phase that already owns contract change.
- Folding `WorkshopStandingDirectiveFrames` away entirely (D4).
- Any further `WorkshopApp` decomposition, including where the removal toast
  finally lives if it should move to the shell (Sprint 03).

## Completion criteria

- [x] Generic standing routes are not registered by feature handlers.
- [x] The generic standing rail and its remove path do not depend on a feature
      hook, and no generic module carries a feature's writer-facing copy.
- [x] `WorkshopStandingDirectiveService` contains no Lexical-only request type or
      literals outside approved closed dispatch, including its error strings.
- [x] Invalid widget/draft pairings are hard to represent: the generate, progress,
      menu-result, and commit payloads carry exact `widgetId` discrimination,
      proven by a type-level fixture.
- [x] Cross-feature/stale acknowledgements cannot settle another feature: every
      action-result consumer filters on both the echoed request token and exact
      feature identity.
- [x] Every generic-to-feature dispatch in the standing slice fails to compile
      when a family is added without an entry.
- [x] A second standing family adds no `lexicalGravity/**` diff lines and no
      route collision.
- [x] Fitness witnesses #2, #4, #8, and #9 are installed and failing-on-drift.
- [x] The P2 migration exceptions are empty.
