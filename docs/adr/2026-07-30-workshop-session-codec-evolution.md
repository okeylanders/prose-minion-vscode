# ADR 2026-07-30: Workshop Session Codec Evolution

**Status:** Accepted; implemented for schema V2 on 2026-08-24
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

`WorkshopSessionCheckpointNormalization` owns orchestration, not every
feature's compatibility knowledge. For persisted widget drafts, it delegates
exact prior-shape recognition, deterministic repair, current-shape validation,
and semantic integrity to a closed registry of feature-owned codecs, then
collects their named outcomes. The central normalizer must not learn lens,
gesture, chapter, or other widget semantics.

That closed widget-lifecycle registry is an internal current-checkpoint
dispatcher. It does not choose or sequence released session schema migrations;
the top-level `schemaVersion` remains the public compatibility clock.

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

### V2 implementation (v2.2.0)

The first Conversation Widgets release advances the full Workshop session
envelope from V1 to V2. `WorkshopPersistedSessionV1ToV2Migration` is the one
adjacent public migration: it initializes the absent widget-config counter,
standing-directive counter, widget config collection, standing directive
collection, and thread-artifact collection from released pre-widget V1 files.
It preserves already-present fields and does not repair feature-specific beta
widget semantics.

The codec accepts V1 and V2 for checkpoint reads, reports formal migrations
separately from development normalizations, validates the resulting current
shape, and returns V2. The strict write boundary accepts and emits V2 only.
The compact `WorkshopSessionSearchIndexV1` remains version 1 because that
regenerable browser index has not changed its own contract.

Compatibility is witnessed by
`packages/core/src/__tests__/fixtures/workshop-session-v1-released.json`, a
frozen pre-widget released-shape fixture. Local beta checkpoints with invalid
feature linkage remain fail-closed and require a separate, explicit repair;
they are not part of the public V1-to-V2 migration.

## Consequences

- Local epic checkpoints remain usable while the widget contract settles.
- The first widget Marketplace release starts from the actual shipped V1 data,
  rather than preserving accidental development history forever.
- Versioned migrations remain small, ordered, and auditable.
- A formal released-session migration dispatcher remains deferred until the
  first schema bump. The closed current-checkpoint widget dispatcher may arrive
  earlier once multiple persisted widgets make the lifecycle concrete.
