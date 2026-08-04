# Sprint 07: Architecture Closure

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-07-closure` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 06

## Goal

Prove that the implemented Workshop architecture is coherent, protected, and
understandable enough for feature development to resume.

## Scope

- Walk representative session, context, participant, Gesture Playground,
  Lexical Gravity, persistence, and recovery flows end to end.
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
- [ ] A reviewer can trace representative actions by filename.
- [ ] All migration exceptions are empty.
- [ ] Full Jest, all TypeScript projects, lint, build/bundle, architecture
      witnesses, and `git diff --check` pass.
- [ ] Final architecture map is published.
- [ ] A Prose Controller reproduction fixture demonstrates zero edits to
      Gesture/Lexical feature files and exactly one generic closed-registry
      entry.
- [ ] Okey explicitly decides whether to lift the feature freeze.
