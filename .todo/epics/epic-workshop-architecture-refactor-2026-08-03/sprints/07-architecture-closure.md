# Sprint 07: Architecture Closure

**Status:** Complete — closure evidence accepted; Okey confirmed D7-B(b) and lifted the feature freeze on 2026-08-06

**Branch:** `sprint/workshop-architecture-refactor-07-closure` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 06

**Evidence:** [Sprint 07 architecture change runway](../../../../docs/architecture/2026-08-06-workshop-sprint-07-architecture-closure-runway.md)
— the pre-implementation runway left D7-A, D7-B, and D7-C open and measured five
of ten completion criteria as already satisfied at base `0a742ca`; their recorded
outcomes and review corrections appear below.

**Final map:** [Workshop responsibility and dependency map](../../../../docs/architecture/2026-08-06-workshop-responsibility-map.md)

## Decisions recorded

| Decision | Outcome |
|---|---|
| D7-A — handler disposition | **C.** Extract `WorkshopSliceComposition`, then rename the room/run owner to `WorkshopRoomHandler`. The room owner retains the nine room/run routes, single active-run slot, and sole session-state envelope. |
| D7-B — reproduction criterion | **B.** One explicit arm per applicable closed generic seam, with zero edits to existing feature slices. Okey explicitly confirmed this reading on 2026-08-06. The review-hardened fixture derives 20 generic seams, classifies every approved generic surface, and requires zero Gesture/Lexical edits. |
| D7-C — audit subjects | **B.** Audit all five freeze-gate facades: `WorkshopApp`, `useWorkshopRoom`, `useWorkshopSessions`, `WorkshopRoomHandler`, and `WorkshopSessionService`. |
| D7-D — feature freeze | **Lifted by Okey on 2026-08-06.** The implementation did not lift it implicitly; the decision follows the completed closure evidence. |

## Goal

Prove that the implemented Workshop architecture is coherent, protected, and
understandable enough for feature development to resume.

## Inherited decision

Sprint 06 accepted D3: contract normalization does not rename
`WorkshopHandler` and does not close the
[Workshop god-files debt](../../../tech-debt/2026-07-25-workshop-god-files.md).
Phase 7 owns both closure decisions:

1. Audit the remaining room/run orchestration boundary and record an explicit
   verdict: retain `WorkshopHandler` if the name is still honest, or perform a
   behavior-preserving rename to `WorkshopRoomHandler` if that makes the
   responsibility materially easier to find.
2. Keep the god-files debt open until representative traces and the final
   responsibility map prove that `WorkshopHandler` (or its renamed successor)
   and `WorkshopSessionService` are coherent narrow facades. If that proof
   fails, the debt and feature freeze remain open.

## Scope

- Walk representative session, context, participant, Gesture Playground,
  Lexical Gravity, persistence, and recovery flows end to end.
- Resolve the deferred `WorkshopHandler` naming verdict from the observed
  responsibility boundary; if renamed, update imports, tests, witnesses, and
  log-prefix expectations in one behavior-preserving change, then reconcile
  the ADR destination tree and architecture documentation.
- Reconcile the Workshop god-files debt against the post-extraction source
  tree and record its evidence-backed disposition.
- Publish the final responsibility and dependency maps.
- Reconcile the implemented tree with the ADR destination and explain every
  intentional deviation.
- Remove all migration exceptions from architecture witnesses.
- Run full validation and a fresh maintainability review.

## Completion criteria

- [x] Every generic owner contains only proven shared mechanics or explicit
      closed dispatch.
- [x] Every feature owns its semantics across presentation and application.
- [x] Broad facades have one primary responsibility and named collaborators.
- [x] The `WorkshopHandler` retain-or-rename verdict is recorded; if renamed,
      source, tests, witnesses, log-prefix expectations, and docs consistently
      use `WorkshopRoomHandler` in the implemented/live architecture.
- [x] The Workshop god-files record stayed open until its completion criteria
      were evidenced.

      > Measured against (`0a742cac`): “An unmet criterion blocks debt closure
      > and the feature freeze lift.” The final audit closes the code-level debt;
      > D7-D remains the independent freeze-lift decision.
- [x] A reviewer can trace representative actions by filename.
- [x] All migration exceptions are empty.
- [x] Full Jest, all TypeScript projects, lint, build/bundle, architecture
      witnesses, and `git diff --check` pass.
- [x] Final architecture map is published.
- [x] A Prose Controller reproduction fixture demonstrates zero edits to
      Gesture/Lexical feature files and exactly one entry per applicable
      generic closed registry.
- [x] Okey explicitly lifted the feature freeze on 2026-08-06.

## Validation evidence

Validated on the implemented Sprint 07 tree:

- `npm test -- --runInBand` — 189 suites, 1,939 tests, 1 snapshot passed;
- `npm run typecheck` — core, webview, and extension projects clean;
- `npm run lint -- --quiet` — zero errors;
- `npm run build` — extension and webview production bundles compiled; bundle
  verifier found all three sentinel utilities (existing webpack size warnings only);
- `packages/core/src/__tests__/architecture/boundaries.test.ts` — 23 closure
  witnesses pass, including composition ownership and Prose Controller reproduction; and
- `git diff --check` — clean.
