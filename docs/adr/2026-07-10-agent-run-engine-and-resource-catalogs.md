# ADR 2026-07-10: Agent-Run Engine and Resource Catalog Policies

**Status:** Accepted
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

### Visibility

Candidate directives are buffered until exact validation succeeds. Raw
directives and full loaded file contents become host/model evidence and
structured artifacts, not visible chat by default. The writer sees compact,
attributed artifacts (safe display path, category, bounded size, and reason)
and can explicitly inspect more content when product UI permits it.

## Consequences

- Every caller has a reviewable route: caller → policy → catalog → retention →
  visible artifact → cleanup owner.
- Sidebar and Workshop share the same lifecycle/capability mechanics while
  retaining intentional differences in resource scope.
- Persona file reading and dictionary capability work have a safe extension
  seam rather than becoming new special-case loops.
- The 06B branch has deliberate migration churn, but no legacy façade remains
  when it integrates.
