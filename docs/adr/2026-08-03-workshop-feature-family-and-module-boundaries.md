# ADR 2026-08-03: Workshop Feature Family and Module Boundaries

**Status:** Accepted

**Date:** 2026-08-03

**Decision owner:** Okey

**Extends:**

- [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)
- [ADR 2026-07-31 — Workshop Widget State Ownership](2026-07-31-workshop-widget-state-ownership.md)

**Evidence:** [Workshop Module Semantic Runway and Architecture Horizon](../architecture/2026-08-03-workshop-module-semantic-runway.md)

**Phase 4 refinement evidence:** [Application Handler Extraction Runway](../architecture/2026-08-04-workshop-sprint-04-handler-runway.md)

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

`WorkshopRoomHandler` owns cross-slice room/run orchestration and the sole
Workshop session-state transport envelope. `WorkshopSliceComposition` is the
Workshop-internal composition seam: it constructs the named sibling handlers,
owns the shared session-operation mutation gate, and fans route registration
and disposal across them. Neither owner absorbs feature semantics.

`WorkshopSessionService` remains the aggregate facade and sole whole-session
mutation boundary. It delegates independently changing state machines and
ledgers while retaining:

- reset semantics;
- checkpoint ordering and hydration installation;
- autosave dirty ordering;
- cross-record integrity; and
- the stable aggregate API consumed by handlers.

No handler receives an internal session ledger directly.

#### Phase 4 refinement: application handler ownership (2026-08-04)

The global `MessageHandler` and its `MessageRouter` remain the single ingress
and dispatch mechanism for extension-to-webview IPC. Inside the Workshop
domain, `WorkshopHandler` is the slice composer and retains only the nine
room/run responsibilities: tool runs, quick actions, composer sends,
participant/target changes, conversation settings, and the single cross-domain
cancel route.

The remaining Workshop routes have explicit application owners:

- `WorkshopExcerptScopeHandler` owns the six excerpt replacement, file intake,
  re-read, scope, and re-pin mutations;
- `WorkshopContextHandler` owns the thirteen context, configured-resource,
  message-attachment, and Context-wizard routes;
- `WorkshopTodoHandler` owns the task-action grammar;
- `WorkshopSessionMessageHandler` continues to own the nine session IPC
  routes; and
- standing-directive and widget handlers retain their existing route families.

`WorkshopContextIntakeService` is the one composition-root-owned, route-free
intake policy shared by the excerpt and context slices. It owns fresh catalog
and disk reads, byte/word bounds, fingerprints, truncation, canonical
provenance matching, and structured refusal descriptions. It has no router,
transport, session, or logging authority. `WorkshopHandler` remains the only
Workshop owner that constructs the `WORKSHOP_SESSION_STATE` envelope.

The central cancel route delegates `workshop-context` requests to the context
slice. A writer cancellation aborts the matching wizard but leaves its run slot
occupied until that run's guarded `finally` publishes completion; disposal is
terminal and clears the slot immediately. Excerpt mutations consume this state
through a refusal-producing run gate rather than reaching across slice state.

This intentionally refines the semantic-runway destination's single
`WorkshopScopeContextHandler` into two handlers plus one data-only intake
service. The current helper graph proved excerpt/scope transitions and context
attachment/wizard workflows have separate reasons to change, while their
shared disk/catalog mechanics belong to neither route owner. A complete
48-route witness pins both the exact owner and whether each route uses the
shared session-operation mutation gate or registers directly. Behavior tests
dispatch through the real `MessageRouter`; test-only handler passthroughs are
not part of the architecture.

#### Phase 7 amendment: honest room and composition ownership (2026-08-06)

The Phase 4 statement above records the boundary at that phase. Phase 7
supersedes its dual-role naming: the former `WorkshopHandler` was predominantly
room/run orchestration but also physically constructed eight sibling route
owners. A rename alone would have left `WorkshopRoomHandler` composing handlers
unrelated to room execution.

Phase 7 therefore selected the third disposition:

- `WorkshopRoomHandler` retains the nine room/run routes, the single
  `activeRun` slot, targeting/execution, streaming/status/error messages, and
  the sole `WORKSHOP_SESSION_STATE` constructor;
- `WorkshopSliceComposition` constructs the eight sibling handlers, owns the
  shared session-operation mutation gate, and coordinates route registration
  and slice disposal; and
- `WorkshopRouteContracts` names the effects and guarded registrar shared
  across that seam.

This is a responsibility split, not a size split. The run engine remains intact
because targeting, execution, preemption, completion, and transport envelopes
share one lifecycle invariant. All 48 routes retain their semantic owners and
gate classifications. Persisted shapes and wire behavior are unchanged; the
handler log prefix now follows the live owner name.

Phase 7 also records that the next-feature reproduction criterion means one
explicit entry per applicable closed registry plus zero edits to existing
feature slices. It does not mean one generic file total, which would require
the dynamic plugin architecture rejected above. The final audit covers all five
feature-freeze facades and is published in the
[Workshop responsibility map](../architecture/2026-08-06-workshop-responsibility-map.md).

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
standing-directive, and settings contracts. Feature-specific shapes receive
specific names. Generic unions exist only at intentional family boundaries and
remain exact discriminated unions.

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

One Phase-6 deviation is accepted:

- `shared/types/messages/workshop/settings.ts` is the ninth Workshop contract
  module. The original destination tree named message subdomains but no owner
  for the runtime defaults, setting descriptors, validators, coercers, and
  equality functions already exported by the Workshop barrel. Keeping those
  codecs together preserves their single trust-boundary parser responsibility;
  scattering them into session or participant contracts by association would
  make the implemented ownership less cohesive than the proposed tree.

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
