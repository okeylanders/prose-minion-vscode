# Sprint 01: Feature-Slice Normalization

**Status:** Planned

**Branch:** `sprint/workshop-architecture-refactor-01-feature-slices` -> `epic/workshop-architecture-refactor`

**Depends on:** Sprint 00

## Goal

Make Gesture Playground and Lexical Gravity physically and semantically
recognizable as sibling feature slices without changing behavior.

## Scope

- Rename `WorkshopWidgetHandler` to `WorkshopGesturePlaygroundHandler` and move
  it beneath the Workshop widget-handler package.
- Move `WorkshopLexicalGravityHandler` into the sibling Lexical package.
- Move Gesture and Lexical codecs/directives/lens modules into symmetric
  `services/workshop/widgets/<feature>/` packages.
- Extract `useGesturePlayground` from `useWorkshop`; move `useLexicalGravity`
  into the sibling feature-hook package.
- Move modal components into symmetric feature component packages.
- Move and rename tests with their owners.

## Constraints

- Pure moves, renames, and wiring only.
- Message names, route owners, runtime behavior, persistence, and rendered UX
  remain unchanged.
- Generic registries may import both feature operation packages; feature
  packages may not import one another.

## Completion criteria

- [ ] Both features have named handler, hook, service, component, and test homes.
- [ ] `useWorkshop` no longer owns Gesture async workflow state/actions.
- [ ] The P1 legacy ownership exceptions are empty.
- [ ] Existing behavior tests pass without rewritten expectations.
