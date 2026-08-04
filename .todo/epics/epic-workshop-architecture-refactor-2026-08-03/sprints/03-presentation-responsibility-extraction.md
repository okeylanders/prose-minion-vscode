# Sprint 03: Presentation Responsibility Extraction

**Status:** Implementation complete — interactive visual pass pending

**Branch:** `sprint/workshop-architecture-refactor-03-presentation` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 02

**Evidence:** [Sprint 03 architecture change runway](../../../../docs/architecture/2026-08-04-workshop-sprint-03-presentation-runway.md) — gate cleared on 2026-08-04 by decisions D1–D4 and the ownership record below.

## Goal

Make each Workshop UI workflow traceable through a named hook/controller and
reduce `WorkshopApp` to shell, route, and layout composition.

## Scope

- Establish `useWorkshopRoom` and `useWorkshopSessions`; confirm the existing
  `useWorkshopWidgetHost` remains the generic widget-config transport owner.
- Move named-session, scope-transition, context-sheet, and widget open/reopen
  orchestration behind focused presentation owners.
- Preserve host-owned durable truth and keep hook persistence declarations
  honest.
- Split `workshop.css` by shell/session/context/feature responsibility without
  visual changes.
- Preserve stylesheet import order as a behavior invariant: shared tokens,
  then shell, context, session, and feature styles. Within the feature tier,
  retain the pre-split source order unless an intentional visual change is
  separately approved.
- Extract modal subcontrollers only where independent workflow state proves the
  seam.

## Accepted decisions

| ID | Outcome | Implementation consequence |
|---|---|---|
| D1 | **B** — controller characterization plus a `WorkshopApp` render/smoke witness | Land the shell witness before moving orchestration. |
| D2 | **A** — retire `useWorkshop` | Split production and test ownership between `useWorkshopRoom` and `useWorkshopSessions`; do not add a compatibility facade. |
| D3 | **A, for now** — three presentation controllers | Extract session surfaces, the context sheet, and widget opening. Keep scope transitions inline. Modal-local workflow extraction is deferred to [Workshop Modal Workflow Ownership](../../../tech-debt/2026-08-04-workshop-modal-workflow-ownership.md). |
| D4 | **A** — one stylesheet composition point | Feature surfaces own their stylesheet files and contents; `WorkshopApp` owns the import order because import order controls the assembled cascade. |

## Coordination

Sprint 03 is the sole owner of `WorkshopApp.tsx`, `useWorkshop.ts`, and
`workshop.css` for this work. No parallel presentation or stylesheet lane is
assigned. Controller slices and the stylesheet import-block edit land
sequentially on this branch.

## Traceability witnesses

The close-out filename audit will trace these representative actions:

- open, close, and settle Save Session;
- start a new session and restore the visible thread on host rejection;
- open a saved session through its confirmation;
- browse, rename, and delete named sessions;
- open, apply, and cancel the shared context text sheet;
- ignore a late attachment-body response for a closed or different sheet;
- launch Gesture Playground or Lexical Gravity from the widget catalog;
- reopen a committed widget configuration by its exact configuration id;
- re-pin a shelved passage without introducing a scope controller;
- remove a standing directive through the existing generic widget host seams.

## Implementation outcome

- `useWorkshopRoom` now owns room/thread/context/stream state and exposes the
  narrow `WorkshopRoomReplacementPort`; `useWorkshopSessions` owns named-session
  state and consumes that port for optimistic New Session rollback.
- `useWorkshop` is removed from production. The original combined behavior
  suite remains as `useWorkshopRoomAndSessions.test.ts`, with direct boundary
  tests beside both new hooks.
- `useWorkshopSessionSurfaces`, `useWorkshopContextSheet`, and
  `useWorkshopWidgetOpening` own the three independent presentation state
  machines accepted in D3. Scope transitions remain inline, and modal-local
  workflow extraction remains deferred.
- `workshop.css` is split into shared token/shell/context/session styles plus
  co-located Gesture, Lexical, and standing-rail styles. `WorkshopApp` is the
  single import composition point.
- W1 proved that the pre-split byte order is token -> shell -> context ->
  session -> feature. Reordering session ahead of context would have changed
  the cascade, so this sprint preserves the measured order and records the
  runway's anticipated deviation rather than shipping a visual change.

The filename-first action audit resolves as follows:

- named-session menus, confirmations, shortcuts, and browser settling:
  `useWorkshopSessionSurfaces.ts`;
- named-session host state/actions and New Session rollback:
  `useWorkshopSessions.ts` through `WorkshopRoomReplacementPort`;
- shared text-sheet attachment correlation and apply/cancel behavior:
  `useWorkshopContextSheet.ts`;
- Gesture/Lexical open, reopen, correlation, and cleanup:
  `useWorkshopWidgetOpening.ts`;
- shelved-passage re-pin: the explicit scope-transition callbacks in
  `WorkshopApp.tsx`;
- standing-directive removal: `useWorkshopStandingDirectives.ts` through the
  existing `useWorkshopWidgetHost.ts` seam.

## Verification

- `npm test -- --runInBand`: 175 suites, 1,836 tests, and 1 snapshot passed.
- `npm run typecheck`: all three TypeScript projects passed.
- focused ESLint over the touched production and test paths passed with zero
  errors.
- `npm run build`: production bundles and the bundle sentinel passed; webpack
  emitted only the existing size warnings.
- W1/W2/W3 architecture witnesses passed, including byte-identical stylesheet
  assembly and the single-import-site guard.
- Interactive VS Code visual inspection remains pending; it cannot be honestly
  performed in this headless implementation session.

## Completion criteria

- [x] `WorkshopApp` contains composition rather than independent workflow state
      machines.
- [x] `WorkshopApp` has a render/smoke witness plus direct tests for each
      extracted controller.
- [x] `useWorkshop` is retired or reduced to an intentionally named compatibility
      facade with a removal plan inside this sprint.
- [x] Feature styles live with feature surfaces; shared tokens remain shared.
- [x] The assembled stylesheet follows the measured token -> shell -> context
      -> session -> feature import order without changing a byte of cascade.
- [ ] A manual visual pass records no regression across the room shell,
      transcript/composer, named-session controls, context/resource surfaces,
      Gesture Playground, Lexical Gravity, and the standing-widget rail.
- [x] Representative UI actions are traceable by filename without broad search.
