# ADR 2026-06-18: MessageHandler Composition-Root Consolidation

**Status:** Accepted and implemented (2026-06-24)
**Date:** 2026-06-18
**Supersedes / extends:** [ADR 2026-06-16 — Monorepo Ports & Adapters](2026-06-16-monorepo-ports-and-adapters.md)
**Epic:** Pre-feature foundation consolidation (Step 1 of 4 — see Sequencing)

## Context

ADR 2026-06-16 split the codebase into a host-agnostic `packages/core` and a thin
`apps/vscode-extension` adapter, and named **`apps/vscode-extension/src/extension.ts`
the single composition root** — the one place that constructs concrete services and
threads them inward.

A post-#60 audit (2026-06-18) found that reality has drifted: **`MessageHandler`
(`packages/core/src/application/handlers/MessageHandler.ts`) has become a de-facto
second composition root.** Three symptoms, one root cause — it is doing assembly that
belongs one layer up:

1. **It `new`s infrastructure internally** rather than receiving it injected:
   - `TextSourceResolver` (~line 219) — stateless, shared across metrics + search.
   - `CategorySearchService` (~line 237) — stateful (holds an `AbortController`, a
     `WordFrequency`, a `PromptLoader`).
   - `AccountBalanceService` + `OpenRouterAccountClient` (~lines 309–310) — stateful
     (TTL cache, debounce timer, listener set), and `MessageHandler` owns their disposal.

   The cost is concrete, not cosmetic: **no test anywhere constructs `MessageHandler`.**
   It can't be — constructing it reaches out and instantiates a live
   `OpenRouterAccountClient` that reads SecretStorage and fires a debounced network
   refresh, plus a `CategorySearchService` doing filesystem reads. There is no seam to
   inject a fake. Every domain handler is unit-tested in isolation; the *assembly* has
   zero coverage, structurally.

2. **`sharedResultCache` is a module-level mutable singleton**
   (`MessageHandler.ts:72`, `const sharedResultCache: ResultCache = {}`), mutated by both
   `MessageHandler` and `ConfigurationHandler` (passed by reference). Because it is
   module-scoped rather than instance-scoped, a webview reload constructs a fresh
   `MessageHandler` against the **same** cache — stale results from a prior session can
   flush into the new webview. A latent reload-bug class.

3. **`any` where the type exists.** `secretsService: any` (`MessageHandler.ts:175`) and
   `postMessage: (message: any)` across **10 of 11** domain handlers. The 11th —
   `AccountBalanceHandler`, the newest — is correctly typed (`AccountBalanceDataMessage`),
   so the right pattern already lives in the tree; the older handlers predate the
   discipline.

A related instance of the same principle: `PublishingHandler` re-`new`s a
`PublishingStandardsRepository` per request (`PublishingHandler.ts:~57`) — the same repo
`StandardsService` already owns — duplicating "how to assemble infra" in the application
layer.

**Why now:** the account-balance slice (the most recent feature) was added by `new`-ing
its service *inside* `MessageHandler`. The path of least resistance for the next slice is
to do the same, and the second composition root grows. With a round of new functionality
about to land, this is the moment to reverse the drift — before more code copies it.

## Decision

Restore a **single composition root** and type the seams, using a `CoreServices` bundle
as the *mechanism* (not decoration).

1. **Introduce a `CoreServices` bundle**, built once at the true root
   (`apps/vscode-extension/src/extension.ts`), mirroring the existing `Platform` ports
   bundle that already reads cleanly there. It holds the existing services **plus** the
   three currently-leaked infra instances (`TextSourceResolver`, `CategorySearchService`,
   `AccountBalanceService`/`OpenRouterAccountClient`). Building the bundle is *impossible*
   without hoisting those three constructions up to the root — that is the point.

2. **Collapse `MessageHandler`'s ~13-positional-param constructor** to roughly
   `(coreServices, transport, platform, outputChannel)`. The constructor's job becomes
   purely *wiring injected services to domain handlers* — no `new`-ing of infrastructure,
   no `@/infrastructure/*` or `@services/*` construction imports.

3. **Wire instance-bound callbacks post-construction.** `CategorySearchService`'s
   `sendSearchStatus` and `AccountBalanceService`'s refresh listener are bound to
   `MessageHandler` methods, so the *instances* are built at the root but the *callbacks*
   are attached in `MessageHandler`'s constructor via the existing post-construction
   setter pattern (`dictionaryService.setStatusEmitter(...)` at `MessageHandler.ts:209`
   is the template). Construction at the root; behavior-wiring at the handler — a clean
   seam, and the thing that finally makes `MessageHandler` constructible in a test.

4. **`sharedResultCache` → instance field** (`private readonly resultCache: ResultCache`).
   It is already threaded into `ConfigurationHandler` as a param; the only change is the
   module global becomes `this.resultCache`.

5. **Type the seams:**
   - `postMessage: (message: any)` → `postMessage: (message: ExtensionToWebviewMessage)`
     across all domain handlers and the `transport` param (the `AccountBalanceHandler`
     pattern, propagated).
   - `secretsService: any` → a narrow `SecretsPort` interface (the
     `getApiKey()`/`setApiKey()` surface) so core stays decoupled from the VS Code-flavored
     `SecretStorageService` while regaining the type.
   - `sharedResultCache: any` (in `ConfigurationHandler`) → `ResultCache` (export the
     interface).

6. **`PublishingHandler`** receives `StandardsService` (already built at the root) instead
   of re-`new`-ing the repository — closing the last application-layer infra construction.

## Consequences

**Positive**
- `MessageHandler` becomes constructible with fakes → the assembly is testable for the
  first time; the composition-root contract can be pinned by a test.
- The composition root is singular again, matching ADR 2026-06-16's stated model.
- The reload-cache bug class is removed.
- New feature slices get an obvious, single registration point — the bundle at the root —
  instead of a `new` buried in `MessageHandler`. This is the durable fix: it changes the
  path of least resistance.
- Type safety is restored on the message boundary and the secrets seam; a mistyped
  payload field now fails at compile time.

**Costs / risks**
- Threads one new param (`coreServices`) through `ProseToolsViewProvider` into
  `MessageHandler`. Behavior-preserving; mechanical.
- The `SecretsPort` interface is new surface, but small and well-bounded.
- Estimated ~1 day. Not a rewrite — a consolidation.

**Migration path (incremental, each step independently shippable):**
1. Extract `ResultCache` + `SecretsPort` interfaces; flip the `any`s to them and
   `sharedResultCache` to an instance field. (Pure type/scope change, no behavior.)
2. Type `postMessage`/`transport` as `ExtensionToWebviewMessage`; fix any fallout.
3. Define `CoreServices`; hoist the three constructions to `extension.ts`; inject the
   bundle; wire callbacks post-construction. Delete the construction imports from
   `MessageHandler`.
4. Inject `StandardsService` into `PublishingHandler`.
5. Add the first `MessageHandler` assembly test (proves the seam).

## Alternatives considered

- **Leave it as-is.** Rejected: the drift compounds with each new slice, the assembly
  stays untestable, and the reload-cache bug remains latent. The audit shows the most
  recent feature already copied the pattern.
- **A full DI container (e.g. tsyringe/InversifyJS).** Rejected: over-engineering for a
  single-webview app with ~14 services. The `Platform` bundle idiom already in
  `extension.ts` is the right weight.
- **`CoreServices` as a rename-only param object** (bundle the 13 args without hoisting
  the `new`s). Rejected: lipstick. It hides the dependency list without reducing it and
  leaves the leak — and the untestability — in place. The bundle only earns its keep if it
  is the vehicle that forces construction up to the root.

## Sequencing (the consolidation epic)

This ADR is the keystone (Step 1). Siblings, tracked separately:
- **Step 0 — Docs:** refresh `.ai/central-agent-setup.md` (AGENTS.md / CLAUDE.md) to the
  monorepo layout. *(Done alongside this ADR.)*
- **Step 2 — Logging sweep:** route the ~10 core `console.*` calls through the injected
  `LogSink` (thread it into `PromptLoader`, `GuideLoader`, `SecretStorageService`,
  `ConversationManager`, `ResourceRequestParser`); optionally introduce a leveled
  `LogSink` (`debug/info/warn/error`) for the future console-app host.
- **Step 3 — Contract tightening:** close the open string unions (`reason` in
  `accountBalance.ts`, `preset` in `publishing.ts`, and the envelope `source`).

Then build new functionality on a consolidated foundation rather than a drifting one.

## Implementation outcome

Implemented on `sprint/messagehandler-composition-root-consolidation`:

- Added typed `CoreServices`, `MessageTransport`, `SecretsPort`, and
  instance-bound `ResultCache` contracts.
- Hoisted `TextSourceResolver`, `CategorySearchService`,
  `OpenRouterAccountClient`, and `AccountBalanceService` construction into
  `apps/vscode-extension/src/extension.ts`.
- Reduced `ProseToolsViewProvider` and `MessageHandler` to bundle-based
  injection.
- Typed every domain handler's outgoing message seam.
- Added lifecycle-safe callback attach/detach for category search, token usage,
  assistant/dictionary status, and account-balance refresh.
- Reused `StandardsService` from `PublishingHandler` instead of constructing a
  repository per request.
- Added the first `MessageHandler` assembly suite, including cache isolation and
  the zero-token refresh guard.
- Added an architecture witness that fails if infrastructure construction
  returns to `MessageHandler`.

Verification: **49 suites / 373 tests**, all three TypeScript projects clean,
lint with zero errors, production bundles green, and the Tailwind bundle witness
passing.
