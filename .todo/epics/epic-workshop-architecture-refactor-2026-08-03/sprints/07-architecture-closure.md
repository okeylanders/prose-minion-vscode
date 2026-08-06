# Sprint 07: Architecture Closure

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-07-closure` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 06

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

- [ ] Every generic owner contains only proven shared mechanics or explicit
      closed dispatch.
- [ ] Every feature owns its semantics across presentation and application.
- [ ] Broad facades have one primary responsibility and named collaborators.
- [ ] The `WorkshopHandler` retain-or-rename verdict is recorded; if renamed,
      source, tests, witnesses, log-prefix expectations, and docs consistently
      use `WorkshopRoomHandler`.
- [ ] The Workshop god-files record stays open until its completion criteria
      are evidenced; an unmet criterion blocks debt closure and the feature
      freeze lift.
- [ ] A reviewer can trace representative actions by filename.
- [ ] All migration exceptions are empty.
- [ ] Full Jest, all TypeScript projects, lint, build/bundle, architecture
      witnesses, and `git diff --check` pass.
- [ ] Final architecture map is published.
- [ ] A Prose Controller reproduction fixture demonstrates zero edits to
      Gesture/Lexical feature files and exactly one generic closed-registry
      entry.
- [ ] Okey explicitly decides whether to lift the feature freeze.
