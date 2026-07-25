# Tech Debt: `WorkshopSessionService` and `WorkshopHandler` are load-bearing god files

- **Status**: Open
- **Priority**: Medium
- **Filed**: 2026-07-25
- **Source**: [PR #86 review](../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md),
  finding #7 (🎯🎯 strong consensus — Marcus, Parker, Stan)

## Problem

Two files absorb every new Workshop feature instead of shedding any:

| File | Lines (post-13A) | Nearest sibling |
| --- | --- | --- |
| `packages/core/src/application/services/workshop/WorkshopSessionService.ts` | ~2,500 | `RunWorkshopToolSidePass.ts` (305) |
| `packages/core/src/application/handlers/domain/WorkshopHandler.ts` | ~2,700 | `WorkshopSessionMessageHandler.ts` (303) |

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
   `WorkshopSessionMessageHandler` exactly.
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
- ADR 2026-06-18: MessageHandler Composition-Root Consolidation
