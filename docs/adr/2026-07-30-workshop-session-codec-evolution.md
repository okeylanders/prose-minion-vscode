# ADR 2026-07-30: Workshop Session Codec Evolution

**Status:** Accepted
**Date:** 2026-07-30
**Extends:** [ADR 2026-07-14 — Workshop Session Persistence and the Session Browser](2026-07-14-workshop-session-persistence.md)
**Scope:** Workshop session checkpoint codec

## Context

Workshop session JSON is already a Marketplace-published, schema-versioned
writer-data contract. Conversation Widgets are currently under active local
development and introduce intermediate checkpoint shapes before their first
Marketplace release. Treating every such developer-only field addition as a
new public schema version would produce noisy, misleading versions. Treating
all future public changes as ad-hoc normalizations would turn the V1 codec into
a compatibility junk drawer.

## Decision

### Development checkpoints normalize; released codecs migrate

`WorkshopSessionCheckpointNormalization` is the single hydration-time owner
for narrowly named, pre-release checkpoint repairs. It has no version in its
name because it serves the currently evolving development checkpoint, not a
released wire format. Each normalization must be deterministic, safe by
default, logged by name, and covered by a regression test.

The normalizer is allowed to repair development-only shapes such as a Gesture
Playground draft written before `sourceReferences` existed. It must not become
a home for a Marketplace-to-Marketplace contract transition.

When a Marketplace release changes persisted Workshop session semantics or a
previously valid required shape, that release increments `schemaVersion` and
adds an explicit adjacent version migration (for example `V1ToV2`). The codec
dispatcher will read the saved version, run the required sequence of formal
migrations, validate the current shape, and write only the current version.

### Release gate

Before a Marketplace release that changes session persistence:

1. Freeze the released session shape and decide whether its durable contract
   changed.
2. If it changed, bump `schemaVersion` and implement/test the prior released
   version to the new released version migration.
3. Cover an authentic prior-Marketplace fixture. For the first widget release,
   that fixture has no widget collections and must initialize them safely.
4. Do not copy intermediate development normalizations into the formal
   migration unless the prior released format actually needs that repair.

No version bump occurs for a release that leaves the persisted contract intact.

## Consequences

- Local epic checkpoints remain usable while the widget contract settles.
- The first widget Marketplace release starts from the actual shipped V1 data,
  rather than preserving accidental development history forever.
- Versioned migrations remain small, ordered, and auditable.
- A future codec dispatcher is intentionally deferred until the first formal
  schema bump; an empty abstraction would only do theater.
