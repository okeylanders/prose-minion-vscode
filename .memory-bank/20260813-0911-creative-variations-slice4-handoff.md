# Creative Variations Slice 4 implementation handoff

**Recorded**: 2026-08-13 09:11 CDT
**Branch**: `sprint/conversation-widgets-03-creative-variations`
**Reviewed baseline**: `8bbb5aeb71338faef340a61599ebcd3b2e04b061`
**Current gate**: Slice 4 ready for review — not reviewed, not complete
**Publication**: uncommitted and unpushed

## Review boundary

This worktree implements the user-facing Creative Variations authoring flow:
selection/clipboard intake, a transient controlled state machine, correlated
generation progress/result transport, cancellation, variation selection and
comparison, accessible Workshop mounting, per-card clipboard copy, and the
existing widget-model selector quartet.

The behavior boundary remains deliberately closed:

- Creative Variations is live in the production catalog for integrated,
  hands-on testing, as authorized by Okey on 2026-08-13.
- Commit is honestly disabled with an associated unavailable explanation.
- There is no room commit, compact artifact, chip reopen, clone/recommit,
  recommendation, prefill, editor mutation, or partial regeneration.
- `ConversationManager`, `AIResourceManager`, `AgentRunEngine`, and the offline
  session architecture are untouched.

## Ownership and message flow

1. `useWorkshopWidgetOpening` may open only a fresh `{ kind: 'new' }` Creative
   Variations sheet. Recommendation/config reopen arms remain absent.
2. `useCreativeVariationsAuthoring` owns the transient draft and semantic UI
   actions. It exposes `{}` persistence and receives transport effects as
   callbacks; it does not import `useVSCodeApi`, `MessageType`, or `postMessage`.
3. Selection intake posts the existing `REQUEST_SELECTION` wire with the exact
   Creative Variations target. `UIHandler` returns editor origin fields only for
   a live editor selection; clipboard fallback carries no source claim.
   `dispatchWorkshopSelectionData` sends that payload to the authoring
   controller. The controller stores only display-safe relative path/range
   provenance, and any subsequent text edit changes it to `{ kind: 'pasted' }`.
4. Generate asks `creativeVariationsGenerationDraft` for the request projection,
   which keeps blank invariants empty and maps a blank custom aim to
   `Generate at random.` The subject passage is therefore the only required
   authoring input. The transport mints a fresh webview token and posts
   `WORKSHOP_CREATIVE_VARIATIONS_GENERATE`. The host mints the workup id; the
   transport latches it from the first correlated callback and rejects stale or
   mismatched progress/results.
5. Input changes cancel the active token and atomically clear the settled
   workup plus selections, carry modes, accepted risks, and previous workup id.
   A failed attempt preserves authoring input. Cancel and modal close emit the
   matching domain cancellation message; late callbacks cannot settle.
6. `WorkshopApp` routes progress/result envelopes, renders the controlled modal,
   passes the named overlap threshold (`80`), supplies per-card `COPY_RESULT`,
   and threads the widget model options/current selection/change/browser-open
   quartet. A model change updates host-owned configuration and asks the
   transient controller to invalidate its dependent settled work. Slice 4
   passes `commitAvailable={false}` and no commit callback.

## Changed files

Production:

- `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations.ts`
- `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec.ts`
- `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigIntegrity.ts`
- `packages/core/src/application/handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler.ts`
- `packages/core/src/infrastructure/api/services/widgets/creativeVariations/CreativeVariationsService.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/dispatchWorkshopSelectionData.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts`
- `packages/core/src/presentation/webview/hooks/useWorkshopAppMessageRouter.ts`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.tsx`
- `packages/core/src/shared/types/messages/ui.ts`
- `packages/core/src/shared/constants/workshopWidgets.ts`
- `apps/vscode-extension/webpack.config.js`

Tests and executable witnesses:

- `packages/core/src/__tests__/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec.test.ts`
- `packages/core/src/__tests__/application/handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler.test.ts`
- `packages/core/src/__tests__/infrastructure/api/services/widgets/creativeVariations/CreativeVariationsService.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.test.ts`
- `packages/core/src/__tests__/application/handlers/domain/UIHandler.test.ts`
- `packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx`
- `packages/core/src/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.test.tsx`
- `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.test.ts`
- `packages/core/src/__tests__/presentation/webview/hooks/useWorkshopAppMessageRouter.test.ts`
- `packages/core/src/__tests__/architecture/boundaries.test.ts`
- `packages/core/src/__tests__/architecture/workshopStyles.test.ts`
- `packages/core/src/__tests__/architecture/widgetModelsSync.test.ts`
- `packages/core/src/__tests__/shared/constants/workshopWidgets.test.ts`
- `packages/core/src/__tests__/presentation/webview/utils/workshopWidgetAskPrefill.test.ts`

Evidence:

- `.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-creative-variations.md`
- `.memory-bank/20260813-0911-creative-variations-slice4-handoff.md`

The protected untracked files `Prose Minion.zip` and
`workshop-ai-service-conversation-ownership.md` were not touched, stashed, or
deleted.

## Verification receipt

- Focused Slice 4 set: **15 suites, 158 tests passed**.
- Full Jest: **206 suites, 2,201 tests, 2 snapshots passed** in 17.054 seconds.
- `npm run typecheck`: core, webview, and extension configurations passed.
- ESLint: **0 errors, 955 warnings** (253 fixable warnings; no fixes applied).
- `npm run build`: resource staging passed; extension and webview webpack
  compilations passed; bundle sentinel reported all 3 required Tailwind
  utilities. Webpack emitted its 3 advisory webview-size warnings.
- The exact F5 prelaunch command (`npm run watch` from the extension app)
  compiled both development bundles without the prior macOS `EMFILE` watcher
  failure; development watch now uses bounded polling and ignores `node_modules`.
- `git diff --check`: passed.

No screenshots were captured because this CLI environment cannot launch the
integrated VS Code extension UI. The mounted Workshop integration test launches
through the real production catalog policy; no fixture-only image was
represented as an integrated screenshot.

## Remaining review risks

- Hands-on visual and real-provider behavior now need validation through an F5
  extension session; the deterministic integration suite covers the same live
  catalog launch path without making a paid provider call.
- Slice 5 must replace the explicit commit-unavailable boundary with the real
  compact commit lifecycle without turning the transient controller into the
  durable owner.
- Real-provider generation remains credential- and availability-dependent; the
  existing host parser/correlation tests and the Slice 4 transport tests cover
  the deterministic contract, not a paid live probe.

Stop here for review. Do not commit or push this handoff as part of Slice 4
without explicit publication authorization.
