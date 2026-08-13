# Creative Variations Slice 5 implementation handoff

**Recorded**: 2026-08-13 15:04 CDT
**Branch**: `sprint/conversation-widgets-03-creative-variations`
**Required ancestor**: `b6fa5b07bc35ae4b574de649092c9e795852b3c1`
**Starting HEAD**: `47d3281f6513a5ba349814d0f6accd0967fc41eb`
**Current gate**: Slice 5 ready for review — not reviewed, not complete
**Publication**: uncommitted and unpushed
**Abstraction register**: `imagine`

## Result

Slice 5 mounts the real Creative Variations one-shot lifecycle on the accepted
Slice 4 surface. A commit now compiles one compact, deterministic artifact,
crosses an exact correlated message arm, passes independent host eligibility and
budget validation, and enters the existing feature-neutral one-shot coordinator.
Accepted turns render the existing generic artifact chip; reopening retrieves
the exact durable draft and clone-recommit creates fresh config, artifact, and
turn identities without editing history.

Creative Variations remains `live: true`. Commit does not call a model and an
already-settled workup remains committable when AI is unavailable. Slice 6
recommendation/prefill and every other deferred behavior remain absent.

The `imagine` register shaped the code around the recognized one-shot feature
family: one named Creative compiler and artifact projection behind the existing
closed operation registry. It did not produce a generic variation framework or
teach the coordinator Creative vocabulary.

## Ownership and message flow

1. `useCreativeVariationsAuthoring` owns the transport-free transient authoring
   state. It derives the first accessible commit blocker and artifact usage from
   the feature compiler output, locks close/destructive changes while pending,
   and preserves the exact draft after a host refusal.
2. `useCreativeVariations` mints a fresh webview token for every attempt, blocks
   duplicate submissions locally, posts the exact Creative commit payload, and
   accepts only the matching Creative action result. Closing clears settled
   local result state; it does not claim to cancel an accepted host transaction.
3. `WorkshopWidgetHostHandler` applies feature-neutral availability, target,
   active-room-run, active-generation, and duplicate-commit gates before any
   mutation. The closed `WorkshopOneShotWidgetCommitOperations` registry routes
   the exact Creative arm to `CreativeVariationsOneShotCommit`.
4. `CreativeVariationsOneShotCommit` validates the exact durable draft,
   settled workup, selections, hard-conflict exclusion, per-risk acceptance, and
   final artifact budget. `CreativeVariationsArtifact` is the only projection
   formula used by both the host path and webview meter.
5. The existing `WorkshopOneShotWidgetCommitCoordinator` creates the durable
   `wc-N` retry config, mints `ta-N`, sends the writer turn and artifact, records
   acceptance linkage, and publishes session state. A pre-acceptance send
   failure may retain the retry config; participant failure after acceptance
   leaves the accepted commit intact.
6. Host acceptance returns through the correlated action result. Only then does
   the modal close. The existing generic thread artifact chip requests the full
   config by `widgetConfigId`.
7. `useWorkshopWidgetOpening` distinguishes a fresh Creative opening from a
   clone opening. Clone restores exact authored fields with idle transient state
   and recommit carries `clonedFromConfigId`; the coordinator mints new config,
   artifact, and turn ids while the source records remain unchanged.

## Durable and transient truth

The committed config preserves the exact authored passage, display-safe
provenance, blank or nonblank aim, invariant fields, generated workup,
selections, carry modes, accepted risk ids, and note. A blank aim therefore
stays blank in persistence; `Generate at random.` exists only at the generation
boundary.

Generation progress, commit progress, host failure copy, focus, comparison
expansion, and other modal chrome are not persisted or restored. Reopened sheets
start idle. The artifact contains only selected carry content, nonblank declared
invariants, accepted selected advisory risks, and the optional note. It excludes
unselected cards, discarded alternatives, overlap data, rankings, paths/URIs,
and invented constraints.

## Changed files

Production:

- `packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts`
- `packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts`
- `packages/core/src/application/handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler.ts`
- `packages/core/src/application/handlers/domain/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundHandler.ts`
- `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts`
- `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact.ts`
- `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsOneShotCommit.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx`
- `packages/core/src/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.tsx`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/widgets/useGesturePlayground.ts`
- `packages/core/src/presentation/webview/hooks/useWorkshopAppMessageRouter.ts`
- `packages/core/src/shared/constants/workshopWidgets.ts`
- `packages/core/src/shared/types/messages/workshop/creativeVariations.ts`
- `packages/core/src/shared/types/messages/workshop/widgets.ts`

Tests and executable witnesses:

- `packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoomHandler.seams.test.ts`
- `packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness.ts`
- `packages/core/src/__tests__/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.test.ts`
- `packages/core/src/__tests__/application/services/workshop/widgets/creativeVariations/CreativeVariationsOneShotCommit.test.ts`
- `packages/core/src/__tests__/application/services/workshop/widgets/creativeVariations/CreativeVariationsPersistence.test.ts`
- `packages/core/src/__tests__/architecture/boundaries.test.ts`
- `packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx`
- `packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopTurnBubble.test.tsx`
- `packages/core/src/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.test.tsx`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/useWorkshopAppMessageRouter.test.ts`
- `packages/core/src/__tests__/shared/constants/workshopWidgets.test.ts`
- `packages/core/src/__tests__/shared/workshopWidgetContracts.test.ts`

Evidence:

- `.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-creative-variations.md`
- `.memory-bank/20260813-1504-creative-variations-slice5-handoff.md`

The protected untracked files `Prose Minion.zip` and
`workshop-ai-service-conversation-ownership.md` were not touched, stashed,
staged, or deleted.

## Verification receipt

- Focused Slice 5 set: **15 suites, 177 tests passed**.
- Full Jest: **207 suites, 2,242 tests, 2 snapshots passed** in 15.342 seconds.
- `npm run typecheck`: core, webview, and extension configurations passed.
- ESLint: **0 errors, 960 warnings** (repository warnings; no fixes applied).
- `npm run build`: resource staging passed; production extension and webview
  bundles passed; the bundle sentinel found all 3 required Tailwind utilities.
  Webpack retained its 3 advisory webview-size warnings.
- The exact root F5 prelaunch command (`npm run watch`) staged resources and
  compiled both development bundles successfully. The watcher was then stopped
  intentionally after the successful compilation.
- `git diff --check`: passed.

## Integrated UI evidence

The VS Code Extension Development Host launch command was accepted, but the
current execution environment could neither capture the display nor reliably
drive the launched window. No fixture-only image is represented as an integrated
screenshot.

The mounted `WorkshopApp` integration exercises the real live catalog route,
fixture-backed workup settlement, direction selection, pending commit, accepted
session/action envelopes, visible thread chip, full-config fetch, exact clone
opening, and recommit with a fresh token and source config id. Host/coordinator
tests separately prove fresh config/artifact/turn ids and immutable source
records. A paid live-provider call was not made.

## Remaining review risks

- A human F5 pass should still confirm the eligible posture, pending lock,
  thread chip, exact clone reopening, normal-width layout, and narrow layout;
  screenshots remain outstanding because display capture was unavailable.
- Real-provider generation remains credential- and availability-dependent. The
  commit path itself performs no model call and is covered with a settled
  fixture-backed workup.
- Slice 6 still owns Host recommendation and prefill. Report prefill, partial or
  card-level regeneration, cross-workup history, and editor apply remain
  intentionally absent.

Stop here for review. Do not commit or push without explicit publication
authorization.
