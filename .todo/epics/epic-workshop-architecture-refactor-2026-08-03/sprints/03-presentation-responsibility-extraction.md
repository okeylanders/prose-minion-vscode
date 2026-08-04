# Sprint 03: Presentation Responsibility Extraction

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-03-presentation` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 02

## Goal

Make each Workshop UI workflow traceable through a named hook/controller and
reduce `WorkshopApp` to shell, route, and layout composition.

## Scope

- Establish `useWorkshopRoom`, `useWorkshopSessions`, and
  `useWorkshopWidgetHost`.
- Move named-session, scope-transition, context-sheet, and widget open/reopen
  orchestration behind focused presentation owners.
- Preserve host-owned durable truth and keep hook persistence declarations
  honest.
- Split `workshop.css` by shell/session/context/feature responsibility without
  visual changes.
- Preserve stylesheet import order as a behavior invariant: shared tokens,
  then shell, session, context, and feature styles. Within the feature tier,
  retain the pre-split source order unless an intentional visual change is
  separately approved.
- Extract modal subcontrollers only where independent workflow state proves the
  seam.

## Completion criteria

- [ ] `WorkshopApp` contains composition rather than independent workflow state
      machines.
- [ ] `useWorkshop` is retired or reduced to an intentionally named compatibility
      facade with a removal plan inside this sprint.
- [ ] Feature styles live with feature surfaces; shared tokens remain shared.
- [ ] The assembled stylesheet follows the documented token -> shell -> session
      -> context -> feature import order.
- [ ] A manual visual pass records no regression across the room shell,
      transcript/composer, named-session controls, context/resource surfaces,
      Gesture Playground, Lexical Gravity, and the standing-widget rail.
- [ ] Representative UI actions are traceable by filename without broad search.
