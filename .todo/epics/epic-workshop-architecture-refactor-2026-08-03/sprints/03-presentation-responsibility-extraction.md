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
- Extract modal subcontrollers only where independent workflow state proves the
  seam.

## Completion criteria

- [ ] `WorkshopApp` contains composition rather than independent workflow state
      machines.
- [ ] `useWorkshop` is retired or reduced to an intentionally named compatibility
      facade with a removal plan inside this sprint.
- [ ] Feature styles live with feature surfaces; shared tokens remain shared.
- [ ] Representative UI actions are traceable by filename without broad search.
