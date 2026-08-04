# ADR 2026-08-03: Workshop Feature Family and Module Boundaries

**Status:** Accepted

**Date:** 2026-08-03

**Decision owner:** Okey

**Extends:**

- [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)
- [ADR 2026-07-31 — Workshop Widget State Ownership](2026-07-31-workshop-widget-state-ownership.md)

**Evidence:** [Workshop Module Semantic Runway and Architecture Horizon](../architecture/2026-08-03-workshop-module-semantic-runway.md)

**Delivery:** [Workshop Architecture Refactor epic](../../.todo/epics/epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md)

## Context

Workshop grew through real features and preserved important invariants: one
composition root, one host-owned session aggregate, exact persisted shapes,
ordered autosave, bounded prompt frames, and typed message routing. Its module
boundaries did not evolve at the same rate.

Gesture Playground was the first Conversation Widget and proved the complete
one-shot lifecycle. Its feature-specific workflow remained inside generic names
such as `WorkshopWidgetHandler`, `useWorkshop`, and generic widget messages.
Lexical Gravity arrived later and received a named handler, hook, model service,
repository, and feature folder. It also introduced the inverse mismatch: its
specific handler owns family-generic standing apply/remove routes, while the
generic standing service accepts only Lexical Gravity on apply.

The physical inconsistency makes the application difficult to review. A reader
cannot infer ownership from filenames or folders and must reconstruct hidden
responsibilities from several broad files. New features would copy whichever
precedent is nearest rather than one deliberate pattern.

This is not primarily a line-count problem. A large aggregate or codec can be
cohesive. The problem is independent reasons to change, deceptive generic
names, and feature behavior spread through broad owners.

## Decision

### 1. Workshop feature work is frozen through architecture closure

No new Workshop feature behavior, including Lexical Gravity v2 Lens Logic,
Prose Controller, or lens blending, begins until Phases 0-7 of the Workshop
Architecture Refactor epic complete and the feature-resume gate is explicitly
closed.

Behavior-preserving refactor work, tests, documentation, and design work that
supports the target architecture remain allowed.

### 2. Features are explicit vertical slices

Every independently interactive Workshop feature owns a named slice across the
layers it actually uses:

- a presentation hook/controller and feature surface;
- feature-specific messages and result handling;
- an application handler for its distinct workflow;
- feature application services, codecs, renderers, and formatters;
- optional infrastructure adapters when the feature requires them; and
- focused tests mirroring those owners.

Gesture Playground and Lexical Gravity must expose the same ownership pattern.
They do not need identical internal classes or storage. Symmetry applies to
responsibility placement, not ceremonial implementation.

### 3. Generic names own only proven family mechanics

A generic Workshop widget/directive module may own:

- canonical identity, catalog metadata, availability, and rail selection;
- session-owned config identity, revision, reset, export, and hydration;
- generic config lookup and display-safe identity envelopes;
- shared rail transaction mechanics;
- action correlation and family identity; and
- explicit closed dispatch among supported variants.

A generic module must not own:

- Gesture Dictionary fields, menu parsing, or gesture directive vocabulary;
- Lexical lens logic, preview/build protocols, or project lens behavior;
- feature modal state;
- feature model output grammars; or
- one feature's writer-facing copy unless supplied through an explicit feature
  contribution.

Closed registries are preferred over dynamic plugin discovery. They make the
supported variants explicit, preserve exact discriminated unions, and keep
variant dispatch reviewable.

### 4. The Workshop room and session remain coherent facades

`WorkshopHandler` remains the Workshop-internal composition owner and the owner
of cross-slice room/run orchestration. It delegates cohesive IPC clusters to
named sibling handlers.

`WorkshopSessionService` remains the aggregate facade and sole whole-session
mutation boundary. It delegates independently changing state machines and
ledgers while retaining:

- reset semantics;
- checkpoint ordering and hydration installation;
- autosave dirty ordering;
- cross-record integrity; and
- the stable aggregate API consumed by handlers.

No handler receives an internal session ledger directly.

### 5. Presentation state follows durability and workflow ownership

Host/session/project storage owns reload-relevant and durable state. Feature
hooks own transient feature workflow state. Room/session presentation state is
split into named hooks/controllers rather than accumulated in `useWorkshop` or
`WorkshopApp`.

`WorkshopApp` becomes shell composition, route composition, and layout—not the
controller for every Workshop modal and state transition.

### 6. Shared contracts are organized by Workshop subdomain

The monolithic Workshop message module is split behind its existing barrel into
session, context, participants, widgets, Gesture Playground, Lexical Gravity,
and standing-directive contracts. Feature-specific shapes receive specific
names. Generic unions exist only at intentional family boundaries and remain
exact discriminated unions.

### 7. The destination tree is a constraint with documented deviations

The semantic-runway report's proposed module layout is the default destination.
An implementation may deviate when current code proves a more cohesive owner,
but Phase 7 must record the reason. Accidental placement and empty symmetry are
not acceptable deviations.

Two Phase-2 clarifications are accepted:

- `WorkshopStandingDirectiveFrames` remains as a thin public caller over the
  closed standing-operations registry. It has five production call sites
  outside the directive mutation slice, so deleting it would widen a route and
  contract ownership phase without improving the variation boundary.
- The executable migration-exception inventory may add a newly discovered
  pre-existing violation only when the same change records its owning cleanup
  phase and evidence marker. Once a phase's inventory is recorded, that phase's
  entries may only shrink. This keeps the ledger honest without allowing new
  violations to masquerade as discovery.

### 8. Extraction follows responsibility, not a numeric line limit

No arbitrary maximum line count defines completion. A broad file is complete
when it has one legible primary responsibility or is a narrow facade over named
collaborators. Extracted modules must own a real concept with an independent
reason to change and focused tests.

### 9. Refactor delivery uses bounded branches and pure moves

The integration branch is `epic/workshop-architecture-refactor`. Each phase
lands through a focused sprint branch. Behavior-preserving moves and behavior
changes do not share a commit. If a supposedly pure extraction requires a
product decision, the extraction stops and the decision is recorded before
continuing.

## Architecture fitness functions

Executable witnesses will protect, at minimum:

1. a declared ownership location for every inbound Workshop widget and standing
   route (duplicate registration is already rejected by `MessageRouter`);
2. generic standing routes owned outside feature handlers after Phase 2;
3. no direct Gesture-to-Lexical or Lexical-to-Gesture imports;
4. approved closed registries as the only generic-to-feature dispatch points;
5. no feature-specific async workflow state in the room hook after Phase 3;
6. one composition direction from `extension.ts` through `CoreServices` and
   `MessageHandler` into Workshop;
7. session ledgers hidden behind the aggregate;
8. exact feature draft/message pairings;
9. action-result correlation and feature identity; and
10. final source, test, and documentation trees agreeing on ownership.

During migration, an executable legacy-exception list records the exact known
violations. New violations fail the suite. Each phase removes its exceptions;
Phase 7 requires the list to be empty.

## Consequences

- Workshop feature development pauses while the architecture is made legible.
- The refactor is larger than the previously optional scope/context extraction,
  but it is divided into independently reviewable responsibility slices.
- Gesture Playground receives named ownership rather than continuing to define
  the generic host implicitly.
- Lexical Gravity retains feature-specific build/preview/resource behavior but
  loses ownership of family-generic standing routes.
- Infrastructure remains intentionally asymmetric by capability.
- Large persistence and aggregate files may remain large where one coherent
  responsibility justifies it.
- Future widget work has one copyable pattern and executable guards against
  drift.

## Alternatives considered

### Continue feature work and refactor only touched areas

Rejected. The current structure makes feature PRs difficult for the decision
owner to review and repeatedly pushes architectural discovery into feature
deadlines.

### Split every file above a numeric threshold

Rejected. Size is evidence of pressure, not a responsibility boundary. Cosmetic
splitting would make navigation worse while preserving hidden coupling.

### Build a universal open widget plugin framework

Rejected. Gesture generation, Lexical preview/build, project resources, and
standing directives are distinct use cases. The family has earned closed shared
mechanics, not one optional-method interface for every workflow.

### Keep the refactor on the Lexical Gravity feature branch

Rejected for implementation. PR #100 records the accepted report while still a
documentation branch. The refactor uses a dedicated integration branch so its
phases can be reviewed and rolled back independently of Lens Logic behavior.

## Completion and feature-resume gate

Feature work resumes only after Phase 7 verifies that:

- the implemented tree matches the responsibility map or documents intentional
  differences;
- representative Workshop actions can be traced end to end by filename;
- broad facades delegate to named collaborators with focused tests;
- known migration exceptions are empty;
- full verification passes; and
- the decision owner explicitly lifts the freeze.
