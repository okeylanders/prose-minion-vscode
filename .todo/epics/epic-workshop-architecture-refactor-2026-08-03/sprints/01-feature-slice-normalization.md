# Sprint 01: Feature-Slice Normalization

**Status:** Implementation complete — awaiting review

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
- Extract `buildGestureDirective` from `WorkshopPromptBuilder` into
  `widgets/gesturePlayground/GesturePlaygroundDirective.ts` while preserving
  the public barrel export name.
- Extract `useGesturePlayground` from `useWorkshop`; move `useLexicalGravity`
  into the sibling feature-hook package; give family-generic config lookup a
  matching `useWorkshopWidgetHost` presentation owner.
- Move modal components into symmetric feature component packages.
- Move and rename tests with their owners.

## Constraints

- Pure moves, renames, and wiring only.
- Message names, route owners, runtime behavior, persistence, and rendered UX
  remain unchanged.
- Generic registries may import both feature operation packages; feature
  packages may not import one another.

## Accepted implementation decisions

Okey accepted the Sprint 01 runway recommendations on 2026-08-03:

1. `WORKSHOP_REQUEST_WIDGET_CONFIG` moves to the family-generic
   `WorkshopWidgetHostHandler`, and its presentation request/response state
   moves to `useWorkshopWidgetHost`, rather than either side acquiring a
   Gesture-specific owner.
2. The unused `useWorkshop.widgetConfigs` mirror is deleted under the alpha
   compatibility policy instead of being mislabeled as Gesture state.
3. Extracted hook members retain their existing `widget*` vocabulary in this
   phase; Phase 2 owns contract and vocabulary normalization.

The modal components move with their tests in this phase, while their CSS
remains in `workshop.css` for the presentation extraction in Phase 3.

## Completion criteria

- [x] Both features have named handler, hook, service, component, and test homes.
- [x] Family-generic widget config lookup has generic handler and presentation homes.
- [x] `useWorkshop` no longer owns Gesture async workflow state/actions.
- [x] The P1 legacy ownership exceptions are empty.
- [x] Existing behavior tests pass without rewritten expectations.

## Verification

- Focused review-fix regression suites: 6 suites, 22 tests passed.
- Full Jest: 164 suites, 1,802 tests, and 1 snapshot passed.
- Core, webview, and extension TypeScript projects passed.
- ESLint completed with zero errors (existing warning baseline remains).
- Production extension/webview bundle and bundle sentinel verification passed.
- `git diff --check` passed.
