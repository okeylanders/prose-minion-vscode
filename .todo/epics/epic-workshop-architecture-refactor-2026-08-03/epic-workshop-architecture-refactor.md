# Epic: Workshop Architecture Refactor

**Created:** 2026-08-03

**Status:** Phase 3 implementation complete — interactive visual pass pending

**Priority:** Critical — blocks all new Workshop feature development

**Integration branch:** `epic/workshop-architecture-refactor`

**Decision:** [ADR 2026-08-03 — Workshop Feature Family and Module Boundaries](../../../docs/adr/2026-08-03-workshop-feature-family-and-module-boundaries.md)

**Evidence:** [Workshop Module Semantic Runway and Architecture Horizon](../../../docs/architecture/2026-08-03-workshop-module-semantic-runway.md)

## Problem

Workshop's important behavioral and persistence invariants are sound, but its
responsibilities are difficult to infer from the source tree. Gesture
Playground-specific behavior occupies generic handler, hook, and message names;
Lexical Gravity uses a different feature-slice structure while owning some
family-generic standing behavior. Broad presentation, handler, session, message,
and stylesheet files collect independently changing workflows.

The result is review friction: a maintainer must search several large files to
trace one action and cannot safely infer where a new feature belongs.

## Goal

Make Workshop understandable by responsibility and copyable by feature before
any new feature behavior resumes.

The refactor will:

- establish symmetric named feature slices for Gesture Playground and Lexical
  Gravity;
- reserve generic names for proven family mechanics;
- split presentation, handler, session, and protocol responsibilities into
  cohesive owners;
- preserve one composition direction and one session aggregate boundary;
- mirror tests and docs to the implemented module tree; and
- install architecture fitness functions that prevent regression.

## Non-goals

- No Lexical Gravity v2 implementation.
- No Prose Controller, lens blending, or new widget behavior.
- No visual redesign disguised as component movement.
- No dynamic/open plugin system.
- No arbitrary line-count target or cosmetic file splitting.
- No persistence migration or compatibility policy change.

## Locked constraints

1. Behavior-preserving moves and behavior changes use separate commits.
2. `packages/core` remains free of `vscode` imports.
3. `extension.ts` remains the only application composition root.
4. `WorkshopSessionService` remains the aggregate facade and whole-session
   mutation boundary throughout extraction.
5. No handler receives an internal session ledger directly.
6. Existing wire behavior and persistence shapes remain stable unless a phase
   explicitly owns a contract correction and its tests.
7. The unrelated `prose-minion/sessions/.gitignore` remains outside every
   refactor commit unless separately requested.

## Phase sequence

| Phase | Sprint | Purpose | Fitness witnesses installed or closed | Exit |
|---:|---|---|---|---|
| 0 | [Architecture fitness witnesses](sprints/00-architecture-fitness-witnesses.md) | Accept the decision, pin behavior, and make migration debt executable | #1 declared route locations; #3 feature isolation; #6 composition direction (retain existing guard); #7 aggregate encapsulation | Target seams and current exceptions are explicit and tested |
| 1 | [Feature-slice normalization](sprints/01-feature-slice-normalization.md) | Make Gesture and Lexical package ownership symmetric without behavior changes | Migrate #1 and #3 owner paths with the pure moves | Both features have named vertical slices |
| 2 | [Shared route and contract ownership](sprints/02-shared-route-contract-ownership.md) | Move family-generic standing behavior out of Lexical and correct false-generic messages | #2 generic standing ownership; #4 closed dispatch; #8 exact draft/message pairings; #9 action-result correlation | A third standing family adds no Lexical edits or route collision |
| 3 | [Presentation responsibility extraction](sprints/03-presentation-responsibility-extraction.md) | Split room, sessions, widget host, feature hooks, modal controllers, and styles | #5 no feature async state in the room hook | UI workflows trace through named owners |
| 4 | [Application handler extraction](sprints/04-application-handler-extraction.md) | Move cohesive IPC clusters out of `WorkshopHandler` | Update #1, #6, and #7 for extracted owners | Handler is a room/run orchestrator and slice composer |
| 5 | [Session aggregate extraction](sprints/05-session-aggregate-extraction.md) | Extract proven state machines/ledgers behind the aggregate facade | Update #7 for internal moves without widening access | Session concepts have named homes and focused tests |
| 6 | [Contract, test, and documentation normalization](sprints/06-contract-test-doc-normalization.md) | Finish protocol split and align tests/docs with source ownership | #10 source/test/documentation ownership agreement; strengthen #1-#9 against final paths | Source, tests, and docs tell one story |
| 7 | [Architecture closure](sprints/07-architecture-closure.md) | Audit every flow, remove migration exceptions, run full validation | Audit #1-#10; remove all migration exceptions | Decision owner may lift the feature freeze |

Phases are ordered. A later phase may prepare a strictly mechanical move early
only when doing so avoids duplicate churn and does not weaken the current
phase's review boundary.

## Target module shape

The normative destination is section D of the semantic-runway report. In short:

- `application/handlers/domain/workshop/` contains the room coordinator,
  cohesive sibling handlers, and named feature handler packages;
- `application/services/workshop/widgets/` contains generic config mechanics
  plus `gesturePlayground/` and `lexicalGravity/` feature packages;
- `application/services/workshop/directives/` contains generic standing
  lifecycle and closed operations dispatch;
- presentation has named room/session/widget-host hooks and symmetric feature
  component/style packages; and
- Workshop messages are split by subdomain behind a barrel.

## Verification baseline

Every sprint runs its focused tests plus proportionate architecture and type
checks. Phase 7 runs:

- all focused Workshop suites;
- full Jest;
- all TypeScript projects;
- ESLint with zero errors;
- production build and bundle verification;
- architecture witnesses;
- `git diff --check`; and
- a filename-first responsibility and traceability audit.

## Feature-resume criteria

- [ ] P0-P7 are complete.
- [ ] Known architecture migration exceptions are empty.
- [ ] Gesture Playground and Lexical Gravity share one ownership pattern.
- [ ] Generic modules contain only proven shared behavior or explicit closed
      dispatch.
- [ ] `WorkshopApp`, `useWorkshop`, `WorkshopHandler`, and
      `WorkshopSessionService` have one clear primary responsibility or are
      narrow facades over named collaborators.
- [ ] Representative UI-to-persistence traces are documented and match code.
- [ ] Full verification passes.
- [ ] Okey explicitly lifts the Workshop feature freeze.

## Paused feature work

- Conversation Widgets Sprint 02B-B — Lexical Gravity interpretive grammar.
- Conversation Widgets Sprint 03 — Prose Controller.
- Conversation Widgets Sprint 04 — lens blending.
- Any new Workshop concept spring promoted to implementation.
