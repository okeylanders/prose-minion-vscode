# Tech Debt: `WorkshopSessionService` and `WorkshopHandler` are load-bearing god files

- **Status**: Open
- **Priority**: Medium
- **Filed**: 2026-07-25
- **Source**: [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md),
  finding #7 (🎯🎯 strong consensus — Marcus, Parker, Stan), and
  [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md),
  finding #10

## Problem

Two files absorb every new Workshop feature instead of shedding any:

| File | Lines (post-13A) | Nearest sibling |
| --- | --- | --- |
| `packages/core/src/application/services/workshop/WorkshopSessionService.ts` | 2,894 (PR #98 review remediation, 2026-07-31) | `RunWorkshopToolSidePass.ts` (305) |
| `packages/core/src/application/handlers/domain/WorkshopHandler.ts` | 2,959 (PR #98, 2026-07-31) | `WorkshopSessionMessageHandler.ts` (303) |

`CLAUDE.md`'s anti-pattern checklist flags any file over 500 lines. Every other
file in both directories is comfortably under 1,000. Both files were already
past the threshold before Sprint 13A, so this is a worsening trend line rather
than a regression introduced by that sprint — which is why the review deferred
it rather than blocking on it.

## Why it matters

The codebase has already proved the fix on these exact files. `WorkshopHandler`
shed its session-lifecycle routes into `WorkshopSessionMessageHandler`, wired
through `registerRoutes(router, registerMutation)`; tool runs came out of the
aggregate as `RunWorkshopToolSidePass`. Both decompositions shipped without
incident. The pattern exists and works; new work simply isn't using it.

The cost is concentration risk: a single file is becoming the place every
Workshop change has to touch, which makes review harder, merge conflicts more
likely, and the blast radius of any edit larger than the edit deserves.

PR #88 also identified `WorkshopPersonaCapability` as a smaller instance of
the same pressure. That local seam was addressed immediately:
`WorkshopAnalysisInputs` now owns analysis-input resolution and shared
provenance descriptions, reducing the capability adapter from ~850 to ~740
lines. The two larger files below remain the tracked debt.

## Progress

- **2026-07-31 — widget-config ledger extracted.**
  `WorkshopWidgetConfigLedger` now owns `wc-N` identity, config state, commit
  linkage, display summaries, reset, export, and hydration replacement.
  `WorkshopSessionService` keeps the aggregate-facing methods but no longer
  stores that collection/counter or its Gesture clone/summary rules inline.
  This closes PR #96 finding 12 while leaving the broader god-file target open.
- **2026-07-31 — scope/context IPC extraction sequenced as optional Sprint
  02C.** After Lexical Gravity (02B), reassess whether the eight-route cluster
  remains a pure-move seam. If so, extract it before Prose Controller; if the
  move requires behavior or run/send-pipeline changes, skip it and leave this
  debt open. See the [Sprint 02C plan](../epics/epic-conversation-widgets-2026-07-22/sprints/02c-workshop-scope-context-ipc-extraction.md).
- **2026-07-31 — standing-directive presentation extracted during PR #98
  review.** Widget-local frame building, summaries, marker copy, and display
  formatting moved out of `WorkshopSessionService`; the aggregate now delegates
  through the standing presentation registry. This reduced the session file
  from the reviewed ~2,950 lines to 2,894 while leaving the broader target open.

## Candidate seams

Named by the reviewers, in rough order of cohesion:

1. **Scope/shelf state machine** (aggregate) — `setSessionScope`,
   `repinShelvedExcerpt`, `adoptShelvedExcerpt`, `scopeTransition`,
   `recordScopeChange`, `hostDeliveredExcerptVersion`, `excerptDeliveryReason`.
   Cohesive and independently testable; `WorkshopSessionScope.test.ts` already
   tests it as a unit.
2. **Session-scope IPC routes** (handler) — `WORKSHOP_SET_SESSION_SCOPE`,
   `WORKSHOP_REPIN_EXCERPT`, and the context-attachment trio. The PR's own doc
   comments already group these under a *"Session scope (Sprint 13A §2/§4)"*
   banner, which is the seam asking to be cut. Follows
   `WorkshopSessionMessageHandler` exactly. Sequenced as optional Sprint 02C;
   it remains non-blocking for Prose Controller.
3. **Webview scope-transition callbacks** (`WorkshopApp.tsx`) —
   `startOpenConversation`, `continueWithExcerpt`, `hasWorkingSet`, and the
   session-confirm branches would fit a `useWorkshopSessionBoundary` hook,
   following the Tripartite Hook pattern the sibling domain hooks use.

## Completion criteria

- [ ] Both files under ~1,200 lines, with a stated path to under 1,000.
- [ ] Each extraction is a pure move plus wiring — no behavior change in the
      same commit.
- [ ] Existing test suites pass unchanged (they are behavior-level, so a clean
      extraction should not need them rewritten).
- [ ] New sibling files carry the same header-comment convention as
      `WorkshopSessionMessageHandler.ts`.

## Related

- [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md)
- [PR #88 review](../../docs/pr-reviews/pr-88-persona-analysis-inputs-review.md)
- ADR 2026-06-18: MessageHandler Composition-Root Consolidation
- ADR 2026-07-31: Workshop Widget State Ownership
