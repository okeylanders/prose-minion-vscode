# Sprint 07: Persona-Callable Capabilities

> **Budget invariant (Sprint 06C):** add capability input ceilings to
> `packages/core/src/shared/constants/promptBudgets.ts`; do not introduce
> module-local prompt limit constants.

**Status**: Complete (2026-07-12)
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-07-persona-capabilities` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 06A, Sprint 06B, and Sprint 06C
**ADRs**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md), [2026-07-10 — Agent-Run Engine and Resource Catalog Policies](../../../../docs/adr/2026-07-10-agent-run-engine-and-resource-catalogs.md)

## Goal

Let the active persona autonomously invoke bounded Workshop capabilities on the
writer's behalf, inspect their structured results, and integrate them into the
same retained host conversation. Begin with both Writer's Dictionary modes and
then expose Sprint 06's analysis side-pass use case through the same typed
boundary.

A persona may formulate and call these capabilities without the user explicitly
asking. The extension—not the model—validates what exists, enforces budgets,
executes services, records provenance, and decides when the capability loop must
stop.

## Current Reality After Sprint 06

- A permanent persona host owns the main retained conversation.
- User-triggered analysis tools run as isolated retained sidecars; exact reports
  feed back into the host, and direct-tool follow-ups work.
- `DictionaryService.lookupWord` provides a focused single lookup.
- `DictionaryService.generateParallelDictionary` produces the full Writer's
  Dictionary entry with per-block timing, partial-failure, and aggregated usage
  metadata.
- Existing guide/context orchestrators already prove provider-neutral structured
  request detection, bounded multi-turn fulfillment, and final-output forcing,
  but retained persona follow-ups do not yet have a general capability loop.

## Engine Prerequisites (post-06A audit, 2026-07-11)

A code audit after the 06A hardening pass confirmed the Workshop tab needed no
adaptation to the consolidated engine (it is fully decoupled behind
`AssistantToolService`), but found three engine-level gaps this sprint must
close before the capability-loop tasks below are implementable:

1. **`AgentRunEngine.continueConversation()` is history-only by explicit
   design** — it never advertises catalogs, accepts a capability, or enters
   the bounded round loop. Every retained persona follow-up turn routes
   through it, so a persona cannot invoke anything on turn 2+. The loop that
   today lives only in `runInitial` must become a per-turn concern: one
   turn-execution path shared by start and continuation, with the policy
   deciding whether capability requests are honored and how many rounds each
   user turn gets. Prefer unifying the two methods over adding a third
   capability-aware variant.
2. **The `AgentCapability` contract is resource-read shaped** (`catalog`,
   `appendCatalog`, `fulfill(paths)`, `ResourceReadInspection`). The
   `WorkshopCapabilityRequest` union below is a discriminated operation set,
   not a path read — generalize the inspection contract (or introduce a
   sibling operation-capability abstraction) rather than forcing dictionary
   lookups through path semantics. The shared `ResourceRequestGate`
   (allowlist + correction wording) is the reusable piece; compose it where
   path allowlisting applies.
3. **`AGENT_RUN_POLICIES.workshopHost` has `maxCapabilityRounds: 0` and
   catalog `'none'`** — even the first persona turn has no capability budget.
   This sprint needs a persona policy with per-user-turn rounds (the locked
   three-calls-per-turn budget) and `onCapabilityLimit: 'forceFinalResponse'`;
   the forced-final + one-retry machinery in the engine already implements
   the budget-exhaustion behavior required here.

Post-06C verification: the stale "Integrated tool runs arrive in Sprint 06"
guard was already removed, and
`WorkshopToolSidePass.integration.test.ts` already spans the
WorkshopHandler↔engine assembly. Sprint 07 verified both and did not duplicate
the landed housekeeping.

## Locked Decisions

- Persona capabilities cross a typed application-layer boundary. Persona
  prompts never call handlers, construct message envelopes, or know service
  implementation classes.
- Use the provider-neutral, strictly parsed, well-formed XML request envelope
  introduced in Sprint 06A. Provider-native function calling may become an
  optional adapter later without changing application request/result types;
  XML remains the primary cross-model transport and routes do not split by
  provider tool-call support.
- The v1 wire is an entire assistant response with one
  `<prose-minion-tool-call>` root and a quoted operation name, for example:

  ```xml
  <prose-minion-tool-call name="dictionary.lookup">
    <word>liminal</word>
    <context>The word appears in a quiet threshold scene.</context>
    <purpose>Clarify its tone and connotations.</purpose>
  </prose-minion-tool-call>
  ```

  After trimming, prose before/after the root, multiple roots/calls, malformed
  XML, or a tag found inside quoted user/excerpt content is not executable.
- Initial allowlist:
  - `dictionary.lookup` -> `DictionaryService.lookupWord`
  - `dictionary.full-entry` -> `DictionaryService.generateParallelDictionary`
  - `analysis.run` -> Sprint 06's tool-side-pass use case
- Personas may invoke allowlisted capabilities without explicit confirmation.
  Calls remain visible, cancellable, cost-accounted, runtime-validated, and
  bounded.
- V1 input ceilings are: `word` 100 characters, `context` 4,000 characters,
  `purpose` 500 characters, and analysis `instructions` 1,000 characters.
  Reject rather than silently truncate a model request that exceeds them.
- Dictionary operations are single-shot capabilities, not retained participants.
  Their result becomes an artifact/evidence item in the host conversation.
- Analysis capability calls preserve the exact same isolated sidecar/provenance
  semantics as user-selected tools. The persona cannot impersonate the tool.
- A persona response containing a valid capability request is intermediate, not
  final user-facing prose. Fulfill it, append a structured result, and let the
  persona produce the final response within the turn budget.
- Invalid, excessive, cancelled, or failed calls return structured failure
  evidence. The persona must respond honestly from that failure and may not
  invent a result.

## Capability Contracts

```typescript
type WorkshopCapabilityRequest =
  | {
      capability: 'dictionary.lookup';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'dictionary.full-entry';
      word: string;
      context: string;
      purpose: string;
    }
  | {
      capability: 'analysis.run';
      toolId: WorkshopToolId;
      instructions?: string;
    };

interface WorkshopCapabilityResult {
  capability: WorkshopCapabilityRequest['capability'];
  status: 'success' | 'partial' | 'failed' | 'cancelled' | 'rejected';
  requestSummary: string;
  content?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}
```

Exact final types may narrow `metadata` by capability, but the discriminants and
plain application-owned boundary are required.

## Tasks

### Application boundary and parser

- [x] Define capability request/result types in an application/shared contract
      that imports no provider, React, or VS Code types.
- [x] Extend the shared XML codec/parser for the typed capability operations
      above. Reject malformed XML,
      unknown capability ids, unknown tool ids, extra dangerous fields,
      oversized strings, duplicate calls, and tags embedded in quoted excerpt
      content rather than an assistant response.
- [x] Add a focused capability orchestrator/use case injected with the existing
      `DictionaryService` and Sprint 06 tool-side-pass boundary. Do not route
      through `DictionaryHandler`, `WorkshopHandler`, or webview messages.
- [x] Keep capability dispatch closed/exhaustive so adding an enum/string alone
      cannot expose a new service accidentally.

### Turn loop and budgets

- [x] Extend persona start/continuation with a bounded capability loop:
      model response -> parse -> validate -> execute -> append structured result
      -> request final/next response.
- [x] Allow at most three capability calls per user turn, at most one
      `dictionary.full-entry`, and at most one analysis side pass unless a later
      measured policy justifies more.
- [x] Enforce the locked 100 / 4,000 / 500 / 1,000 character ceilings; use
      pinned excerpt provenance rather than letting the model pass filesystem
      paths/content.
- [x] Prevent recursive/unbounded calls and force a final response when the
      maximum turn/call budget is reached, mirroring existing orchestrator
      safety behavior.
- [x] Aggregate token/cost usage from persona, dictionary blocks, tool sidecar,
      and final persona response exactly once.
- [x] Cascade cancellation across the active persona request and nested
      capability; preserve already-completed artifacts honestly.

### Writer's Dictionary capabilities

- [x] `dictionary.lookup`: pass the persona-formulated word plus bounded excerpt/
      conversational context to `lookupWord`; preserve usage/truncation/error.
- [x] `dictionary.full-entry`: call `generateParallelDictionary`, preserve the
      combined entry and structured timing/success/partial-failure metadata, and
      enforce the one-per-turn budget.
- [x] Render a compact expandable artifact such as “Writer's Dictionary ·
      liminal · requested by Jill” before/alongside persona integration.
- [x] Feed the exact dictionary result to the persona as structured evidence;
      the persona may extract, compare, or recommend wording but not fabricate
      omitted sections.

### Persona-requested analysis

- [x] Expose `analysis.run` through the same deterministic `WorkshopToolId`
      allowlist and Sprint 06 side-pass use case.
- [x] Render the verbatim report and retain/replace the tool sidecar exactly as
      a user-triggered run would.
- [x] Return the report as capability evidence to the persona and continue to a
      separate synthesis response.
- [x] Keep user-selected and persona-requested tool provenance distinguishable
      in turns/status/logs without changing the tool's analysis contract.

### Prompts, presentation, and observability

- [x] Extend the shared persona base prompt with the exact XML capability
      operation schema,
      when each capability is appropriate, the autonomy granted, and the call
      budget. Persona-specific prompts must not redefine the allowlist.
- [x] Show deterministic progress (“Jill is checking the Writer's Dictionary
      for ‘liminal’…”) while hiding raw protocol tags/JSON from the thread.
- [x] Add accessible artifacts for dictionary lookup/full entry and reuse tool
      artifacts for analysis calls.
- [x] Log request id, persona id, capability, bounded input summary, outcome,
      duration, partial failures, and cancellation without logging API keys or
      entire private excerpts.
- [x] Surface nested usage through the existing token rail.

### Tests and documentation

- [x] Parser tests: every valid variant plus malformed, unknown, oversized,
      injected/quoted, duplicate, and mixed prose/request cases.
- [x] Capability-dispatch tests proving direct service/use-case invocation and
      exhaustive allowlist behavior.
- [x] Loop tests for no call, one call, multiple allowed calls, over-budget,
      forced final response, cancellation, failure, and partial dictionary
      result.
- [x] Writer's Dictionary tests for persona-formulated inputs, metadata/artifact
      fidelity, and exact evidence returned to the host.
- [x] Analysis tests proving persona requests reuse sidecar semantics and never
      replace/impersonate the host.
- [x] Token/status/logging tests across nested calls and reload snapshot tests
      for completed artifacts.
- [x] Update architecture, prompt-resource, and Workshop session documentation.

## Acceptance Criteria

- Jill or any selected persona can decide a word merits a Writer's Dictionary
  lookup, formulate the request from the excerpt/conversation, invoke it without
  explicit user prompting, and integrate the returned result into the thread.
- Both focused lookup and full parallel Writer's Dictionary entry are available;
  full-entry metadata and partial failures remain inspectable.
- The thread shows a compact attributed dictionary artifact plus the persona's
  separate synthesis; raw protocol markup never appears.
- A persona can request any allowlisted analysis tool; it runs as the same
  isolated retained sidecar used by a user click and produces a verbatim report
  before persona synthesis.
- Unknown/malformed/oversized/over-budget requests never execute a service and
  yield an honest bounded failure path.
- Cancellation, token accounting, status, and logs include nested capability
  work correctly.
- No capability path imports VS Code/React/provider types into the application
  contract or routes through another domain handler.
- Lint, typecheck, focused/full tests, build, bundle verification, and
  `git diff --check` pass. Record bundle deltas.

## Suggested Implementation Order

1. Capability contracts, parser, validation, and exhaustive dispatch tests.
2. Bounded persona capability loop with cancellation/usage accounting.
3. Focused and full Writer's Dictionary adapters/artifacts.
4. Persona-requested analysis through the Sprint 06 side-pass use case.
5. Prompt updates, observability, full tests, and F5 smoke.

## Guardrails

- The model proposes requests; the host validates and executes them.
- Do not grant filesystem, shell, settings, secrets, or arbitrary message
  capabilities through this broker.
- Do not let dictionary or analysis results disappear into persona paraphrase;
  preserve inspectable artifacts/provenance.
- Do not add a generic reflection-based service registry. The three allowed
  capabilities are an explicit closed dispatch table.
- Do not combine this sprint with retained workspace-context loading. That
  feature has different path-containment and privacy boundaries.

## Completion Record — 2026-07-12

- Engine prerequisites completed: typed capability requests generalized beyond
  path reads; initial and retained turns share one transactional per-turn loop;
  Workshop host policy is three calls, one correction, then forced final prose.
- Sprint 06C composition verified: pending host frames enter a capability turn
  once, commit only with successful final prose, and remain pending on failure
  or cancellation; all capability artifacts carry `excerptVersion`.
- Housekeeping verified as already landed: no stale Sprint 06 guard, and
  `WorkshopToolSidePass.integration.test.ts` covers handler↔engine assembly.
- Verification: 88 Jest suites / 689 tests passed; core, webview, and extension
  typechecks passed; ESLint passed with zero errors; production webpack build
  passed; explicit `verify:bundle` passed; `git diff --check` passed.
- Clean production bundle comparison against `origin/epic/workshop-editor-tab`
  (`a2568b6`): `extension.js` 2,324,924 → 2,342,869 bytes
  (+17,945 / +0.77%); `webview.js` 590,131 → 593,123 bytes
  (+2,992 / +0.51%). Webpack's existing asset-size recommendations remain
  warnings only.
