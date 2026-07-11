# Sprint 06A: Agent-Run Engine and Resource Catalogs

**Status**: Implementation complete — automated verification passed; manual F5 route confirmation pending in a GUI-capable environment
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06a-agent-run-engine` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 5–8 days
**Depends on**: Sprint 05 persona host and browser
**ADR**: [2026-07-10 — Agent-Run Engine and Resource Catalog Policies](../../../../docs/adr/2026-07-10-agent-run-engine-and-resource-catalogs.md)

## Goal

Replace the orchestrator's overlapping execution loops with one reviewable
agent-run engine and explicit resource-catalog policies, without changing user
visible behavior across the sidebar or Workshop.

## Locked Decisions

- `AIResourceManager` is the only initialization/rebuild owner and exposes
  generation identity.
- A caller explicitly chooses `guides`, `projectContext`, or `none`; do not
  advertise every project file to every agent.
- Configured project-context groups remain Settings-owned. The shared engine
  validates requests, reads allow-listed resources, records provenance, and
  delivers evidence.
- Existing public orchestrator methods are branch-local migration adapters only.
  Every caller migrates and duplicated legacy methods are deleted before merge.
- Raw directives and full file content do not stream into visible chat by
  default. Compact attributed artifacts make loaded evidence inspectable.
- No persona file-read or dictionary capability behavior lands in this sprint;
  06A builds the seam Sprint 07 consumes.
- Dialogue, Prose, and Writing Tools are distinct **prompt/product profiles**,
  not distinct execution engines. Their public message routes, tool/result
  names, prompt assets, and Workshop ids stay stable while their duplicated
  internal runner is consolidated.
- A capability owns its complete protocol surface: catalog enumeration and
  ordering, exact XML tool-call instructions and validation, allow-listed reads,
  evidence formatting/trimming, provenance, status, and limit behavior. A
  tool builds only its semantic task input; it must not also append a catalog.
- The cross-model capability wire is one well-formed XML envelope:
  `<prose-minion-tool-call name="resource.read"><paths><path>…</path></paths></prose-minion-tool-call>`.
  It must be the entire assistant response. `RunPolicy` selects the catalog;
  the model requests paths only from its shown allow-list and never selects a
  catalog or provider-specific protocol.
- XML is the primary transport for every configured model. Do not split routes
  by provider tool-call support in 06A; a future provider-native adapter must
  sit behind the same typed request/result boundary rather than alter policy,
  authorization, evidence, or visibility semantics.

## Tasks

### Lifecycle and route inventory

- [x] Characterize each existing caller and publish a route matrix: caller,
      policy, resource catalog, retention, visible artifact, cleanup owner.
- [x] Move all bundle initialization/rebuild ownership into `AIResourceManager`;
      expose/test generation identity and config-change behavior.
- [x] Prove an unrelated service initialization cannot strand a retained
      Workshop or sidebar conversation.

#### Caller-to-policy route matrix (implemented)

| Caller | Policy | Catalog | Retention | Visible artifact | Cleanup owner |
| --- | --- | --- | --- | --- | --- |
| Sidebar dialogue, prose, and writing tools | `assistant` (`assistantWithoutResources` when guides are disabled) | `guides` or explicit `none` | Discard | Final analysis; guide loads stay in status/evidence | Engine |
| Workshop tool run | `workshopTool` (`workshopToolWithoutResources` when guides are disabled) | `guides` or explicit `none` | Retain | Final tool report; guide loads stay in status/evidence | Workshop session |
| Workshop persona-host start | `workshopHost` | `none` | Retain | Final host turn | Workshop session |
| Dictionary lookup and parallel blocks | `dictionary` | `none` | Discard | Final dictionary result | Engine |
| Category-search batches | `categorySearch` | `none` | Discard | Final matching result | Engine |
| Context assistant | `context` | `projectContext` | Discard | Final context brief; configured-file loads stay in status/evidence | Engine |

The executable source of truth is
`infrastructure/api/orchestration/AgentRunPolicies.ts`; its matrix regression
test prevents a caller from silently inheriting another route's catalog.

### Engine and catalog extraction

- [x] Define typed `RunPolicy`, `AgentCapability`, and resource-catalog policy
      contracts in core without VS Code imports.
- [x] Extract one initial-run engine for request assembly, streaming,
      cancellation, retention, token accounting, cleanup, and bounded rounds.
- [x] Implement Guide and Context-file capability adapters with explicit parse,
      fulfill, delivery, and limit policy differences.
- [x] Buffer candidate directives until validation and keep raw protocol/file
      contents out of visible streamed output.

### Uniform XML resource-request transport — required before Sprint 06B

- [x] Characterize the current guide and project-context request behavior,
      including whole-response enforcement, streaming invisibility, bounded
      rounds, allow-listed fulfillment, artifacts, and final-output forcing.
- [x] Replace `<guide-request path=["…"] />` and
      `<context-request path=["…"] />` with one standards-compliant XML
      envelope: `<prose-minion-tool-call name="resource.read"><paths><path>…</path></paths></prose-minion-tool-call>`.
      Use a direct XML parser dependency rather than a hand-rolled regular
      expression.
- [x] Add one shared typed XML codec. It returns a `resource.read` request with
      paths; the selected `RunPolicy` and capability retain catalog ownership,
      path authorization, fulfillment, evidence, provenance, and limits.
      `AgentRunEngine` must not hard-code catalog-specific tag names.
- [x] Append the exact shared resource-read instruction beside every catalog,
      so Dialogue, Prose, Writing Tools, and Context receive the same protocol
      without duplicate prompt-specific variants. This explicitly enables WTA
      guide requests, which are currently fulfillable but not taught.
- [x] Reject malformed XML, multiple roots/calls, unknown operation names,
      duplicate or empty paths, mixed prose/call responses, and path values not
      in the selected catalog. Keep raw XML and loaded content out of visible
      output by default.
      - Refined 2026-07-11: the prompt still demands one bare XML document,
        but the codec now tolerates garnish around an otherwise exact call —
        a narrated preamble, XML declaration, or Markdown fence before/around
        the tool call is discarded and the tail is parsed strictly. Faster
        models (Haiku) were emitting valid, allowlisted calls that failed on
        `mixed-content`/`markdown-fence` alone and exhausting the correction
        turn. Any content *after* the closing tag still rejects, so protocol
        markup quoted mid-prose remains non-executable.
- [x] Delete the unreferenced legacy `ResourceRequestParser` and
      `ContextResourceRequestParser` once their coverage is represented by the
      shared codec and capabilities.
- [x] Do not add dictionary, persona, analysis, edit, or to-do execution in
      this commit. Sprint 07+ adds those as closed typed operations using this
      same transport.

### Migration and deletion

- [x] Migrate Assistant, Dictionary, Category Search, Context, and Workshop
      callers onto the engine and declare their catalog policies explicitly.
- [x] Preserve direct retained continuation as an explicit history operation.
- [x] Delete temporary adapters, duplicate loops, and obsolete tests before the
      branch merges into `epic/workshop-editor-tab`.

### Remaining load-bearing completion work — required before Sprint 06B

The engine is in place, but three load-bearing shapes remain: the three passage
assistants independently assemble the same kind of run, the Context assistant
and `ContextFileCapability` both advertise project resources, and resource
reads use two invalid-XML, catalog-specific directives. Finish these as small,
test-first steps. Do not bundle unrelated prompt behavior changes into the
structural refactors.

#### 1. Characterize the passage-assistant contract first

- [x] Add direct characterization coverage for every currently supported
      passage profile before changing implementation:
  - Dialogue focus: `dialogue`, `microbeats`, and `both`.
  - Prose's single broad-revision profile.
  - Every `WritingToolsFocus`: `cliche`, `continuity`, `style`, `editor`,
    `fresh`, `repetition`, `decision-points`, `show-and-tell`, `gestures`,
    `choreography`, `stock-and-signature`, and `placeholders`.
- [x] For each profile, use a fake `PromptLoader` and `AgentRunEngine` to
      assert the exact ordered prompt paths, system-message ordering, stable
      engine `toolName`, role/task framing, passage/context/source headings,
      default temperature/max-token values, and streaming/abort forwarding.
- [x] Characterize both policy dimensions independently: craft guides select
      `guides` plus `GuideCapability`; disabled guides select explicit `none`;
      retained Workshop runs select the corresponding retained policy. Assert
      that the resource capability never changes the tool's prompt profile.
- [x] Add service-boundary tests showing that `analyzeDialogue`,
      `analyzeProse`, and `analyzeWritingTools` keep their current
      `AnalysisResult` tool names, usage/cancellation/conversation-id mapping,
      and public message/UI routes. The refactor is internal; callers must not
      have to migrate.

**Why first:** current direct coverage is WTA-only and covers only half its
focuses. These tests make prompt bytes and execution policy observable before
we remove the historical classes; they are the safety rail for tools writers
already trust.

#### 2. Consolidate passage execution as typed profiles, not as “WTA owns all”

- [x] Introduce a neutral internal runner — suggested name
      `PromptedPassageAssistant` or `PassageAssistantRunner` — that owns only
      the repeated mechanics: shared/tool prompt loading, system and user
      message composition, common option forwarding, policy resolution, and
      `AgentRunEngine.runInitial()`.
- [x] Drive that runner from a typed profile registry. Each profile declares
      only creative/product semantics: stable engine `toolName`, legal focus
      values/default, ordered prompt paths, fallback instructions, role/task
      framing, and user-message headings. The profile must not know how to
      stream, retain, fulfill a guide, or clean up a conversation.
- [x] Keep lifecycle policy separate from profile semantics through one tested
      resolver for `includeCraftGuides` × `retainConversation`. That resolver
      maps to the existing `AGENT_RUN_POLICIES`; retention remains explicit at
      the `AssistantToolService` public boundary rather than becoming a prompt
      profile decision.
- [x] Preserve the existing public seams during this change:
      `ANALYZE_DIALOGUE`, `ANALYZE_PROSE`, `ANALYZE_WRITING_TOOLS`,
      `AssistantToolService.analyzeDialogue/analyzeProse/analyzeWritingTools`,
      current result ids, engine tool names, prompt resource paths, and the
      Workshop catalog (`dialogue | prose | WritingToolsFocus`). Do **not**
      rename or flatten those contracts merely because their implementation
      shares a runner.
- [x] Make `DialogueMicrobeatAssistant` accept `DialogueFocus`, rather than
      the broader `AssistantFocus`, so an unrelated WTA focus cannot silently
      select a nonexistent dialogue prompt and fall back. Remove the unused
      `DialogueMicrobeatOutput` only after the characterization tests confirm
      it has no consumer.
- [x] Delete the now-redundant per-assistant run/prompt assembly once wrappers
      or direct callers are fully migrated. A thin named profile wrapper is
      acceptable for readable service construction; duplicated execution logic
      is not.

**Boundary after completion:** one engine owns run mechanics; one shared
passage runner owns common prompt-to-run assembly; each typed profile owns
creative intent; `AssistantToolService` owns public result mapping and the
caller lifecycle. “Writing Tools” remains a useful product collection, not the
framework name for every kind of passage analysis.

#### 3. Audit prompt behavior explicitly after the structural refactor

- [x] Keep all prompt assets and generated messages byte-for-byte equivalent
      through the runner extraction. No guide, formatting, weighting, or
      response-shape change may hide in that commit.
- [x] Characterize and test the shared catalog-level `resource.read` protocol
      for WTA alongside Dialogue and Prose. WTA currently receives the guide
      catalog but no request instruction; the uniform XML transport makes that
      instruction explicit and may change guide-loading behavior/cost.
- [x] Audit WTA prompt references to shared “Diversity & Creative Sampling”
      instructions. Several focus prompts refer to them while the WTA base
      prompt does not provide them. Either restore a deliberate shared section
      with focused tests/manual comparison, or remove the stale references.
- [ ] Run representative manual A/B comparisons for dialogue, prose, one
      diagnostic WTA focus, and one generative WTA focus after any intentional
      prompt behavior change. Record the chosen behavior and sample rationale
      in this sprint document or a follow-up ADR; do not call a behavior change
      a refactor.

#### 4. Make `ContextFileCapability` the sole project-catalog owner

**Current overlap:** `ContextAssistant` calls `resourceProvider.listResources()`
and formats a capped, `projectBrief`-first catalog plus resource-request instruction;
then `AgentRunEngine` calls `ContextFileCapability.appendCatalog()` and adds a
second, differently formatted catalog. The duplicated model input wastes
context and means policy/authorization presentation lives in two places.

- [x] First add characterization tests for the intended catalog contract:
      empty state; stable `projectBrief`-first ordering; exact path/label/group
      formatting; 100-item cap and overflow message; one XML tool-call instruction;
      allowed-path-only fulfillment; provenance; trimming; missing paths; and
      raw XML request/file invisibility in streamed output.
- [x] Move **all** project-resource catalog construction into
      `ContextFileCapability.appendCatalog()`: enumeration, ordering, cap,
      empty state, labels/workspace provenance, and the exact
      `<prose-minion-tool-call name="resource.read">…</prose-minion-tool-call>`
      instruction. Keep its existing
      parse/fulfill/evidence/limit behavior together with that catalog.
- [x] Reduce `ContextAssistant` to the semantic context-generation request:
      excerpt, user-provided context, source provenance, and considered group
      names. Remove its resource enumeration/catalog formatter and the
      `resourceProvider` option that exists only to support that duplicate
      work. `ContextAssistantService` constructs the provider and capability;
      the assistant receives only the typed capability.
- [x] Audit the source-document input at the same boundary. It is currently
      read by `ContextAssistantService` and carried on the assistant input, but
      is not forwarded into `buildUserMessage`. Decide explicitly whether it
      belongs in the semantic request (with a bounded, tested contract) or
      should be removed; do not silently begin sending an unbounded full source
      document while fixing catalog duplication.
- [x] Verify the final context initial request contains exactly one project
      catalog and one XML tool-call instruction, and that the engine/capability
      remains the sole allow-list and evidence/provenance boundary.

**Boundary after completion:** Settings and `ContextResourceResolver` choose
configured groups; `ContextAssistantService` assembles the provider and calls
the tool; `ContextAssistant` describes the writing task; `ContextFileCapability`
owns the entire project-resource protocol; `AgentRunEngine` runs bounded turns
without understanding a workspace path.

#### 5. Final 06A verification and handoff

- [x] Run the focused new profile, policy, capability, service-boundary, and
      context-catalog suites; then run the full Jest suite, `npm run typecheck`,
      `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Manually confirm F5 routes for sidebar dialogue/prose/WTA/context and
      Workshop retained tool continuation. For context, confirm catalog text is
      not duplicated and that a requested configured file yields only compact
      visible provenance/status rather than raw XML request or file content.
- [x] Re-read the caller-to-policy matrix above against the final code. Any new
      route or policy must be added there and in the policy-matrix regression
      test before Sprint 06B begins.

### Verification

- [x] Add a caller-to-policy regression matrix plus focused capability,
      lifecycle, streaming, cancellation, retention, and visibility tests.
- [x] Run full tests, typecheck, lint, build, resource staging, and bundle
      verification.
- [ ] Manually confirm the F5 routes: sidebar analysis/context/dictionary/category
      and Workshop host/tool continuation paths.

#### Verification notes (2026-07-10)

- Focused engine/capability/service/Workshop matrix: 9 suites / 38 tests passed.
- Full Jest: 71 suites / 521 tests passed.
- `npm run typecheck`: core, webview, and VS Code adapter passed.
- `npm run lint`: 0 errors; 606 repository warnings remain (none introduced by
  the implementation after correcting the new test warning).
- `npm run build`: resource staging and `verify:bundle` passed. Produced
  `extension.js` at 2.16 MiB and `webview.js` at 566 KiB (the latter retains
  the existing webpack size warning).
- `git diff --check`: passed.
- VS Code was launched with the Extension Development Host arguments, but this
  environment has no GUI inspection or input channel for the required manual
  sidebar and Workshop click-through. Treat the F5 route checklist above as a
  manual confirmation, not an implementation failure.

#### Completion verification (2026-07-11)

- Characterization, XML codec/capability, context-catalog, and service-boundary
  suites passed; full Jest passed: 74 suites / 563 tests.
- `npm run typecheck` passed for core, webview, and VS Code adapter.
- `npm run lint` passed with 0 errors and 604 existing repository warnings.
- `npm run build` passed resource staging and `verify:bundle`; produced
  `extension.js` at 2.19 MiB and `webview.js` at 566 KiB (existing webpack
  performance warnings remain).
- `git diff --check` passed. The manual F5 checklist remains pending because
  this environment has no GUI inspection or input channel.

## Acceptance Criteria

- A reviewer can identify every agent route from one route matrix and one
  policy declaration.
- Context agents retain their configured project-resource scope; analysis agents
  retain their craft-guide scope; no caller sees an accidental union.
- One lifecycle owner rebuilds resources, and retained conversations survive
  unrelated service activity.
- Passage analysis has one internal prompt-to-run path with typed profiles;
  every public route, tool/result name, focus, and prompt behavior remains
  stable unless a separately tested behavior decision says otherwise.
- The profile characterization matrix covers every supported Dialogue and WTA
  focus plus Prose, both guide/retention policy axes, and service result mapping.
- `ContextFileCapability` is the only project-resource catalog/protocol owner;
  the initial context request contains one bounded catalog and one uniform XML
  tool-call instruction.
- One typed, well-formed XML capability envelope handles every current resource
  read. Its validation/visibility tests prove malformed calls and raw protocol
  content do not leak, while RunPolicy continues to constrain each route to its
  chosen catalog.
- No temporary public façade or duplicated execution/catalog loop remains at
  merge.
- Visible chat never leaks raw XML tool requests or full loaded files by default.
