# Epic: Workshop Context Compaction

**Status**: Planned
**Priority**: High
**Created**: 2026-07-21
**Depends on**: Completion of the Workshop Editor Tab epic, including Sprint 10
session persistence.
**Decision**: [ADR 2026-07-18 — Workshop Thread Artifacts & Context Compaction](../../../docs/adr/2026-07-18-workshop-thread-artifacts-and-context-compaction.md)

## Goal

Give writers understandable, deliberate control over retained Workshop context
without deleting history or silently changing what a persona sees. The Context
Bar exposes Release, Compress, and Compact as real actions; all outcomes remain
attributable and persist across session restore.

## Scope

1. **Addressable retained history** — move standing context to its own canonical
   entry, coalesce only at send time for alternation-strict providers, and
   preserve stable ids for context and agent-fetched artifacts.
2. **Release** — writer release controls for removable context/artifacts and an
   allowlisted persona release capability for agent-fetched evidence only. Every
   release is visible and becomes a tombstone rather than an unexplained gap.
3. **Compress** — a writer-selected, deterministic head/tail reduction for a
   retained span, with omitted content and source span named in the tombstone.
4. **Compact** — a writer-selected, bounded assistant summary that replaces a
   retained span while preserving source-span and summary provenance.
5. **Persistence and projection** — serialize and restore tombstones,
   compression, and compaction as inert, display-safe transcript provenance;
   show the manifest data that supports a writer's choice without automatic
   retention mutation.

## Guardrails

- No action runs because a threshold, provider metadata, or a persona silently
  decides that it should. Writer intent is required for every mutation.
- Personas cannot release writer-owned excerpts or standing attachments; their
  scoped capability applies only to agent-fetched evidence and produces a
  visible event turn.
- Stable ids, never list indexes, address surgery targets.
- Mutation is between turns and atomically updates history plus source manifest.
  Cancellation, validation failure, and transport failure preserve prior state.
- `Compress` is product-owned and distinct from provider context-compression
  telemetry. The UI says which is which.
- No raw path, conversation id, or hidden retained content crosses the webview
  boundary.

## Completion Criteria

- [ ] Context Bar exposes Release, Compress, and Compact as actionable controls
      when a safe target exists, with an honest disabled explanation otherwise.
- [ ] Writer and scoped persona release paths enforce ownership and create
      attributable visible turns.
- [ ] Compression and compaction are bounded, cancellable where model work is
      involved, and retain clear tombstone/source provenance.
- [ ] Prompt projection, source manifest, persistence, restore, reset, delete,
      expiry, and provider alternation behavior remain coherent.
- [ ] Focused/full tests, typecheck, lint, build, bundle verification, and an
      Extension Development Host accessibility/UX pass are recorded.
