# ADR 2026-07-09: Workshop Persona Host, Tool Sidecars, and Capabilities

**Status:** Accepted
**Date:** 2026-07-09
**Extends:** [ADR 2026-07-03 — Assistant as a Full Editor Tab](2026-07-03-assistant-editor-tab.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)

## Context

Workshop Sprints 01–04 established a tool-first conversation: running one of
the 14 deterministic analysis tools creates and retains a conversation whose
system prompt belongs to that tool. Free-text messages then continue it.

The next product step makes the Workshop feel hosted. A writer should be able
to pin an excerpt, choose Jill or a Writers' Room specialist, and converse with
that persona before or after using tools. Jill is the default host. Tools remain
specialized analysis agents with their own prompts; the host can run them,
present their reports verbatim, and help the writer evaluate the result.

Two naive designs fail in opposite directions:

- swapping the system prompt inside one retained conversation contaminates
  histories and destroys direct tool follow-ups;
- exposing every persona/tool combination as a peer routing mode makes the UI
  ask the writer to manage an agent graph instead of workshop prose.

The desired shape is a simple persona-centered UX over a more capable host-side
session: one permanent persona host, isolated retained tool sidecars, and one
explicit temporary direct-tool target when the writer wants to question a tool
without persona mediation.

Personas should also be able to invoke bounded application capabilities on the
writer's behalf. The first is the existing Writer's Dictionary: a persona may
formulate a lookup from the excerpt and conversation, call it without waiting
for an explicit user request, inspect the result, and integrate the useful part
into the thread. Persona-generated capability calls introduce a distinct
validation/cost/cancellation boundary and therefore land after deterministic
tool sidecars.

The persona source material currently lives in Okey's prompt library and
contains authoring-only concerns: skill frontmatter, invocation rules,
cross-persona choreography, project-specific canon, and local paths. The
extension cannot depend on that filesystem or ship those prompts verbatim as a
general product feature.

## Decision

### 1. The Workshop always has a persona host

Jill is selected by default. Before conversation begins, the writer may choose
another Writers' Room specialist. The selected persona is the stable Workshop
host: normal composer messages go to that persona, and running a tool never
replaces the host's system prompt.

Persona switching is locked once a host conversation begins in v1. “New
session” is the explicit host-switch boundary: it preserves the pinned excerpt,
clears retained conversations and the thread, and restores Jill. This keeps
persona identity honest without adding cross-persona handoff semantics to the
initial release.

### 2. Persona selection uses a browser modal, not a native dropdown

The header trigger opens a persona browser visually parallel to the existing
tool browser. Each deterministic catalog entry contains:

- persona id, name, specialty, and concise description;
- a shared person-outline/avatar treatment;
- a presentation-only focus icon badge (voice, continuity, line craft, etc.);
- selected/disabled state suitable for keyboard and screen-reader use.

The tool and persona browsers may share a small modal-shell component for
backdrop, dialog framing, focus return, and keyboard behavior. Their cards and
selection policies remain separate.

### 3. Agent identity is immutable; session routing is not

Never change the system prompt of an existing conversation. The host-side
session owns a participant structure whose infrastructure ids remain private:

```typescript
interface WorkshopParticipants {
  host: {
    personaId: WorkshopPersonaId;
    conversationId?: string;
  };
  toolSidecars: Partial<Record<WorkshopToolId, WorkshopToolSidecar>>;
  directToolTarget?: WorkshopToolId;
}

interface WorkshopToolSidecar {
  conversationId: string;
  latestReportTurnId: string;
  deliveredToHostThroughTurnId?: string;
}
```

Sprint 05 establishes this participant shape and uses a minimal sidecar/direct
target to preserve the existing tool-first chat during migration: a tool run
before host chat remains directly followable, and “Back to Jill” starts/returns
to the host without discarding the tool. Sprint 06 turns every tool run into the
full persona-integrated report/synthesis/handoff flow. `WorkshopSessionSnapshot`
exposes only metadata needed for honest UI; conversation ids never cross into
the webview.

The latest retained conversation per tool is kept within the current Workshop
session. A fresh run of the same tool replaces and disposes that tool's prior
sidecar while its visible historical report remains. Reset, excerpt replacement,
panel/session disposal, and AI-resource generation loss dispose all applicable
retained conversations deterministically.

### 4. One send action routes to host or explicit direct-tool mode

`WORKSHOP_SEND_MESSAGE` remains the single composer action:

- normally it starts/continues the selected persona host;
- while `directToolTarget` is set, it continues that retained tool sidecar.

Direct-tool mode is never hidden. The composer shows “Talking directly to
Continuity” (or the selected tool) plus a deterministic “Back to Jill” action.
Addressing the host by name (for example, “Hey Jill”) may be a convenience
shortcut back, but visible host-side state—not free-text guessing—is the source
of truth.

Target changes use one typed `WORKSHOP_SET_CHAT_TARGET` message carrying
`{ kind: 'host' } | { kind: 'tool'; toolId: WorkshopToolId }`. The handler
validates that a requested tool sidecar is live before changing the target.

When direct mode ends, the next host turn receives any new tool exchanges that
host has not yet seen as a bounded, structured handoff. This avoids paying for a
persona relay call on every direct-tool message while keeping the host informed.

### 5. Tool runs are sidecars with verbatim provenance

When the writer starts with a tool or runs one later:

1. the UI immediately shows a deterministic status such as “Jill is having
   Continuity look at that now” (not a paid/model-generated acknowledgement);
2. the tool runs in an isolated conversation under its unchanged tool prompt;
3. its report is rendered verbatim as an attributed tool artifact;
4. the report and originating request are injected into the persona host as
   structured evidence;
5. the persona responds separately with interpretation, critique, or revision
   guidance;
6. the report offers “Talk directly to Continuity” when its sidecar remains
   available.

The tool report is always preserved independently of persona synthesis. The
persona may quote, summarize, or challenge it, but is never the only carrier of
what the tool said.

### 6. Package curated, product-safe persona prompts

The deterministic catalog lives in shared code. Runtime prompts live under:

`packages/core/resources/system-prompts/workshop-personas/`

This location reuses the path-contained `PromptLoader`, resource-staging
pipeline, and VSIX witness. Each system prompt is assembled from a shared
Workshop persona base prompt plus one curated persona prompt.

Curation preserves craft remit, voice, response behavior, and useful boundaries
while removing:

- YAML skill frontmatter and invocation instructions;
- Codex/Claude tool or subagent directions;
- absolute paths and runtime dependencies on `zsh-setup`;
- Okey- or manuscript-specific canon presented as universal context;
- Writers' Room coordination unavailable in the single-host runtime.

The base prompt establishes that the pinned excerpt is quoted user material,
not instructions; provenance is informational; missing project facts must not
be invented; and capability requests must use only the documented allowlist.

### 7. Retain plain persona conversations through the existing orchestrator

Extend `AIResourceOrchestrator.executeWithoutCapabilities` to honor its existing
`retainConversation` option with the same atomic success/cancel/error semantics
already proven by `executeWithAgentCapabilities`. Add a narrow
`AssistantToolService.startWorkshopPersonaConversation(...)` entry point that:

1. loads the shared base prompt and selected persona prompt;
2. builds the initial user message from pinned excerpt, compact provenance, and
   the writer's message or structured tool evidence;
3. starts a streaming retained conversation on the captured assistant
   orchestrator generation;
4. returns its conversation id for atomic adoption by the session.

Follow-ups continue through the existing `continueConversation` seam.

### 8. Persona capabilities use a typed application boundary

Persona-generated requests never fabricate webview messages or call domain
handlers. A focused application-layer capability orchestrator validates a
provider-neutral structured request, invokes injected services, records
provenance, and returns a structured result to the persona conversation.

The initial capability allowlist is:

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
```

`dictionary.lookup` delegates to `DictionaryService.lookupWord`.
`dictionary.full-entry` delegates to `generateParallelDictionary` and retains
its partial-failure metadata. `analysis.run` reuses Sprint 06's side-pass use
case; the persona never impersonates the tool.

Personas may call allowlisted capabilities without an explicit user request.
Every invocation is nevertheless bounded and observable:

- strict runtime validation and closed capability/tool ids;
- per-turn call budgets (including at most one full dictionary entry);
- bounded word, context, purpose, and instruction sizes;
- visible status and a compact, expandable capability artifact in the thread;
- cancellation propagated through nested work;
- nested token/cost usage included in session totals;
- failures returned to the persona as failures, never invented results;
- no recursive capability loop beyond the configured turn budget.

The persona receives the result as structured evidence and then produces the
user-facing response. Dictionary calls remain single-shot capabilities rather
than retained conversational participants.

### 9. Do not smuggle workspace-resource orchestration into these sprints

Initial persona context includes the pinned excerpt, provenance, the writer's
message, and an existing compact context brief if available. It does not
advertise `<context-request>` until retained follow-ups can fulfill it safely.

On-demand project-resource loading must reuse `ContextResourceResolver` and the
existing request parser/orchestration pattern. That work remains separately
tracked in the epic.

## Consequences

**Positive**

- The writer experiences one stable Workshop host rather than an agent-routing
  control panel.
- Persona and tool system prompts never contaminate one another.
- Direct tool chat remains available without sacrificing persona synthesis.
- Verbatim artifacts preserve provenance when a persona summarizes or revises.
- The participant shape supports Sprint 06 without replacing Sprint 05's
  session model immediately after it lands.
- Dictionary and future capabilities cross one typed, testable application
  boundary instead of leaking service calls into prompts or handlers.
- Persona prompts are portable and packageable for writers beyond the source
  project.

**Costs / risks**

- Twelve prompts require editorial curation, not mechanical copying.
- Multiple retained conversations require explicit replacement, reset, loss,
  and cancellation tests.
- Direct-tool delta handoff needs a bounded cursor/provenance policy.
- Autonomous capabilities can multiply latency and cost; hard per-turn budgets
  and visible status are required from the first release.
- Persona switching after conversation start remains deferred; reset is the v1
  boundary.
- Dynamic workspace context remains deferred until retained conversations can
  honor resource requests without crossing model roles.

## Alternatives considered

- **Swap system prompts in one conversation.** Rejected: prior turns become
  semantically contaminated, direct follow-ups disappear, and returning to the
  host requires reconstruction.
- **Expose every participant as a peer conversation target.** Rejected as the
  default UX: the architecture supports participants, but the product centers a
  stable persona host with only an explicit temporary direct-tool mode.
- **Make the persona relay every direct-tool message.** Rejected: it doubles
  latency/cost and introduces paraphrase risk. Host-side routing talks directly
  to the sidecar and performs one bounded handoff when returning.
- **Model personas as `WorkshopToolId`.** Rejected: personas own conversational
  judgment; tools own deterministic analysis contracts.
- **Add `WORKSHOP_START_CHAT` beside `WORKSHOP_SEND_MESSAGE`.** Rejected: the
  host-side session already knows whether it must start or continue.
- **Copy source skill files verbatim.** Rejected because they contain local,
  tooling, invocation, and multi-agent assumptions absent from the extension.
- **Let personas call `DictionaryHandler` or post webview messages.** Rejected:
  handlers are delivery adapters. Capability orchestration calls injected
  application/service boundaries directly and returns plain typed results.
