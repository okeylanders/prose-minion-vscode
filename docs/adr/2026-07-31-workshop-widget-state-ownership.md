# ADR 2026-07-31: Workshop Widget State Ownership

**Status:** Accepted
**Date:** 2026-07-31
**Extends:** [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)
and [ADR 2026-07-30 — Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md)
**Scope:** Session-owned Conversation Widget configuration state and persisted
widget draft codecs

## Context

Gesture Playground proved the one-shot Conversation Widget lifecycle and added
the first session-owned widget authoring configuration. Its implementation put
two independently changing responsibilities directly into broad Workshop
modules:

- `WorkshopSessionService` stores configs, mints `wc-N` ids, clones drafts,
  records commit linkage, exports/hydrates the collection, and builds bounded
  webview summaries.
- `WorkshopSessionStateV1Shape` knows every bounded Gesture Playground draft
  field, menu rule, source-reference rule, and development-checkpoint default.

That was an appropriate first-widget implementation: the host contract was
extracted from a concrete feature rather than designed speculatively. The next
committed widget is Lexical Gravity, which introduces a different draft shape
and an edit-in-place standing lifecycle. Copying either responsibility into the
same files would turn the session aggregate and its top-level codec into
cross-widget dispatch and field-rule owners.

The session remains the aggregate root. Widget state must continue to share its
ordered checkpoint, reset boundary, turn/artifact integrity validation, and
public session schema version. The goal is delegated ownership, not a second
persistence system or a generic plugin framework.

## Decision

### A session-owned widget-config ledger owns lifecycle mechanics

Extract `WorkshopWidgetConfigLedger` as an application-layer collaborator
constructed by `WorkshopSessionService`. The ledger owns:

- the ordered config collection and monotonic `wc-N` counter;
- defensive creation, lookup, and export clones;
- landed commit linkage (`turnId` and `artifactId`);
- bounded summary projection for configs visible in the transcript window;
- atomic reset and non-throwing installation of pre-validated, prepared
  hydration state.

Widget-specific draft clone and summary operations are constructor-injected at
the session boundary. The ledger owns lifecycle mechanics without importing a
concrete widget codec; the current operations support Gesture Playground, and
the second widget extends that dispatch at the boundary rather than changing
ledger methods.

`WorkshopSessionService` remains the public aggregate boundary and delegates its
existing widget methods. It still owns room turns, shared `ta-N` artifact ids,
artifact delivery, reset orchestration, whole-session export/hydration, and
cross-record integrity. No handler receives the ledger directly.

### Widget-local codecs own widget field rules

Extract Gesture Playground's persisted draft grammar, defensive clone, summary
projection, and development-checkpoint defaults into a Gesture-local codec.
The top-level V1 session shape retains the generic config envelope and delegates
the draft body to that codec.

The session remains the only public schema-version clock. Widget codecs do not
receive independent `schemaVersion` fields while their records exist only
inside Workshop session JSON. Formal released migrations continue to follow
ADR 2026-07-30.

Sprint 02A preserves the current one-widget serialized contract. When Lexical
Gravity adds the second persisted config shape, the generic config envelope
becomes a discriminated union and dispatches by `widgetId` to the two local
codecs. It must not use `Record<string, unknown>` as a durable draft escape
hatch.

### Shared persistence grammar is codec infrastructure, not domain policy

Consolidate the top-level session codec's exact-object, bounded-string, and
JSON-shape primitives into the existing `persistedValidation` module beside
its timestamp, timezone, and exact-key rules. Both the aggregate codec and
widget-local codecs may depend on it. It contains no widget rules and is not a
general-purpose `utils` module.

### Standing-directive architecture arrives with Lexical Gravity

Sprint 02A does not create an empty standing-directive framework. Sprint 02
will add its coordinator and handler with Lexical Gravity as the first concrete
producer. New routes and directive state must enter through focused
collaborators; they must not be added directly to `WorkshopHandler` or
`WorkshopSessionService`.

## Consequences

- Lexical Gravity gains an explicit sibling location for its draft grammar and
  config lifecycle without enlarging the two Workshop god files.
- Existing handlers and callers retain the `WorkshopSessionService` API; the
  extraction is behavior-preserving and independently reversible.
- Hydration remains two-phase: widget state is cloned during preparation and
  installed by assignment only after all potentially throwing work succeeds.
- Widget configuration state cannot drift away from session persistence,
  autosave ordering, reset semantics, or integrity validation.
- The V1 codec becomes smaller and stops accumulating widget-specific field
  rules, at the cost of two focused application modules and a focused expansion
  of the existing persistence-validation module.
- The generic config type remains Gesture-shaped during the extraction. The
  discriminated multi-widget union is introduced only when the second concrete
  shape exists.

## Alternatives considered

### Keep widget mechanics in `WorkshopSessionService` until Sprint 02

Rejected. Lexical Gravity would force behavior work and extraction through the
same already-large aggregate, increasing review risk and making the eventual
move responsible for two lifecycles at once.

### Give each widget an independent repository or schema version

Rejected. Widget configs are records inside the Workshop aggregate and share
its durability and compatibility boundary. Independent storage would create
split-brain save ordering and migrations.

### Build a generic Conversation Widget plugin framework now

Rejected. One concrete widget does not justify generic generation, commit, or
rendering interfaces beyond the host contract already proved in Sprint 01.
This ADR extracts owned state and codec responsibilities only.

## Verification

- Existing `WorkshopWidgetConfigs`, Workshop persistence, handler, and webview
  suites remain behavior-level witnesses.
- Add focused ledger tests for both defensive-clone directions, monotonic
  identity, summary projection, reset, and two-phase hydration replacement.
- Add focused Gesture codec tests for menu bounds, option bounds, uniqueness,
  selection membership, and selection cardinality in addition to the V1
  decoder witnesses.
- Core/webview/extension typechecks, lint, build, full Jest, architecture
  witnesses, and `git diff --check` remain green.
