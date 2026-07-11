# ADR 2026-07-10: Agent-Run Engine and Resource Catalog Policies

**Status:** Accepted (amended 2026-07-11)
**Date:** 2026-07-10
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md), [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)

## Context

`AIResourceOrchestrator` currently contains separate guide, context-resource,
plain/retained, and retained-continuation flows. Their lifecycle and streaming
mechanics overlap, while resource policy is distributed across individual
services. `AIResourceManager` can also rebuild every scope when a sibling
service initializes, making the active generation difficult to reason about.

The resulting behavior is valid in many individual paths but hard to audit:
reviewers cannot answer which flow a caller uses, which resources the model may
request, who owns cleanup, or whether a retained conversation survives an
unrelated initialization.

## Decision

### One lifecycle owner

`AIResourceManager` alone initializes and rebuilds resource bundles, at
activation and genuine configuration changes. Bundles expose an observable
generation identity. Services bind to the manager-owned generation; they do not
rebuild all scopes during their own initialization or request handling.

### One internal initial-run engine

Extract shared initial-run mechanics behind an explicit `RunPolicy`: streaming,
retention, cancellation, capability rounds, output visibility, and cleanup.
Keep direct retained continuation explicit because it has different history
semantics.

During branch-local migration, current public methods may delegate to the new
engine so callers can move in small reviewed steps. They are temporary adapters,
not compatibility API: migrate every Assistant, Dictionary, Category Search,
Context, and Workshop caller and delete the old duplicated methods before the
06A integration branch merges into `epic/workshop-editor-tab`.

### Capability adapters and resource catalogs

Each capability has a typed adapter that describes its catalog, validates a
request, fulfills only allow-listed content, formats model evidence, and
declares its limit behavior. Guide and project-context capability adapters are
the first implementations; Dictionary and persona file-read follow only after
the seam is proven.

Do not merge all available resources into one giant agent list. Callers choose
an explicit resource-catalog policy, for example `guides`, `projectContext`, or
`none`, with configured project groups and bounded item counts. Settings remain
the source of truth for project-context groups; the engine owns enumeration,
validation, provenance, and delivery mechanics.

### One uniform XML capability-request transport

The provider-neutral capability wire is one well-formed XML envelope. The
initial resource-read request is:

```xml
<prose-minion-tool-call name="resource.read">
  <paths>
    <path>scene-example-guides/campfire-stories.md</path>
  </paths>
</prose-minion-tool-call>
```

A capability request must be the entire assistant response (apart from
whitespace). The host parses it with a standards-compliant XML parser, validates
the typed operation and arguments, executes only the route's allow-listed
capability, and returns bounded evidence before asking the model to continue.
Malformed XML, multiple roots/calls, or prose before or after the root are not
executable and never stream as raw user-visible output.

`RunPolicy` continues to select the resource catalog. The model requests
`resource.read` paths from the one catalog it was explicitly shown; it does not
choose a catalog, cross a resource boundary, or receive every project resource.
No model-specific capability matching or provider-native function-calling
transport is required for this decision. A provider-native adapter may be added
later behind the same typed request/result boundary, but XML is the primary
cross-model wire.

### Visibility

Candidate tool requests are buffered until exact validation succeeds. Raw
requests and full loaded file contents become host/model evidence and
structured artifacts, not visible chat by default. The writer sees compact,
attributed artifacts (safe display path, category, bounded size, and reason)
and can explicitly inspect more content when product UI permits it.

## Consequences

- Every caller has a reviewable route: caller → policy → catalog → retention →
  visible artifact → cleanup owner.
- Sidebar and Workshop share the same lifecycle/capability mechanics while
  retaining intentional differences in resource scope.
- Persona file reading and dictionary capability work have a safe extension
  seam and one XML transport rather than becoming new special-case loops.
- The 06B branch has deliberate migration churn, but no legacy façade remains
  when it integrates.

## Amendment 2026-07-11: Tolerant Parsing, Shared Gate, Per-Turn Loop

Live-run hardening on the 06A branch (verified against Sonnet and Haiku)
refined three parts of this decision.

### Strict prompt, tolerant parse (Postel boundary)

The original rule — "a capability request must be the entire assistant
response (apart from whitespace)" — is retained as the *prompt-side*
contract but relaxed at the *parser*. Faster models (Haiku) emitted valid,
allow-listed calls garnished with a narrated preamble or a Markdown fence,
were rejected on the garnish alone, and exhausted their single correction
turn. The codec now discards everything before the first protocol marker
plus one trailing fence close, then strictly SAX-parses the remaining tail
as exactly one tool-call document. Any content after the closing tag still
rejects, so protocol markup quoted mid-prose remains non-executable, and
allow-list authorization is unchanged. Instructions keep demanding one bare
XML document; the correction turn is reserved for genuinely invalid requests.

### Shared request gate

Allow-list inspection and correction wording were extracted into a shared
`ResourceRequestGate` (codec + displayed-catalog allow-list + parameterized
correction instruction). Capability adapters compose a gate and keep only
catalog assembly, fulfillment, evidence, and provenance. New capabilities —
including Sprint 07 persona operations where path allow-listing applies —
compose a gate rather than re-implementing this arithmetic.

### The capability loop becomes a per-turn concern (Sprint 07 direction)

The original decision kept "direct retained continuation explicit because it
has different history semantics." That asymmetry is now the limiting shape:
the bounded capability loop lives only in the initial run, so a retained
persona cannot invoke anything on follow-up turns. The locked direction for
Sprint 07:

- `start()` establishes the conversation, the capability contract (protocol
  instruction and catalog enter history once, not per turn), and the policy.
- Every turn — initial or follow-up — runs the same bounded loop: parse →
  validate → fulfill → continue, with the capability budget **resetting per
  user turn**. There is no unbounded "open" mode; long conversations get
  renewable per-turn budgets with the existing forced-final backstop.
- A policy with `maxCapabilityRounds: 0` makes a follow-up turn degenerate to
  exactly the current history-only continuation, so the unification subsumes
  `continueConversation` rather than adding a third mode.
- Capability rounds (valid request → fulfill) and correction turns (invalid
  request → retry) remain separate bounded policy numbers: a model burning
  corrections is confused, a model burning rounds is thorough, and logs must
  distinguish the two.
