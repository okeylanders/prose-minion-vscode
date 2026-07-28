# Sprint 13B: Persona-Chosen Analysis Inputs

**Status**: Completed (2026-07-25)
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13b-run-local-analysis` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 13A  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md)\
**Design load**: **Low.** The composer tool picker already exists in the comp
(`data-act="tools-all"` / `tools-locked`). New visual surface is limited to the
two transcript divider variants and the run's provenance block. No writer-facing
picker, policy control, or free-text field is added.

## Goal

Let the host persona run the existing analysis tools as bounded instruments in a
session with no pinned excerpt, choosing their inputs itself. The writer's only
new affordance is a prefilled ask.

The analysis tools were built to run in isolation — excerpt plus context in,
report out. Nothing about that engine changes. This sprint widens what may be
placed in those two input slots and who decides.

## The two doors

| | Excerpt session | Non-excerpt session |
|---|---|---|
| **Rail tools** | Direct run against pinned excerpt + context. **Unchanged.** | Stay gated (`NEEDS EXCERPT`) |
| **Composer picker** | Direct run. **Unchanged.** | Prefills an ask; the persona runs the tool and chooses its inputs |

The rail and the composer must say *why* they differ, or a gray rail beside a
live Tools button reads as a bug. The rail is "run this yourself against the
passage" — it needs an excerpt. The composer is "ask your host to run this" —
the persona supplies the material.

## Scope

### 1. Per-input modes on `analysis.run`

Two independent inputs, each with a closed mode:

```text
excerpt: inherit | prepend(text) | replace(text) | omit
context: inherit | prepend(text) | replace(text) | omit
```

`prepend` is how the persona places framing or instructions above existing
material — it is not a separate field. `omit`/`omit` is a legal vacuum run.
There is no separate "Subject" concept: the excerpt slot in `replace` mode *is*
the local passage.

Host-side validation before the tool executes:

- `prepend` requires the underlying material to exist — you cannot prepend to
  nothing.
- `prepend` and `replace` both require non-empty text within existing bounds.
- Sizes, source identities, and mode values are validated; an invalid request is
  rejected with an intelligible reason rather than silently degraded.

### 2. Where the contract lives

- **The grammar goes in the system prompt, stated mode-neutrally** — all four
  modes for both inputs, the validation rules, and the honesty rules. It must
  not reference the current session's scope. Input facts may differ between
  rooms and turns, and a scope-dependent system prompt would invalidate the
  persona's prompt cache merely to report those facts.
- **A per-turn frame carries only what varies** — the facts, not the rules:

  ```text
  <workshop-analysis-scope>
  Pinned excerpt: none.
  Context attachments: 3 (story bible, ch02 notes, character sheet).
  </workshop-analysis-scope>
  ```

  This mirrors the existing split where `buildWorkshopInteractionFrame` rides
  each persona turn while behavior definitions live in the system prompt.

- **The frame is host-composed, uses a reserved tag, and rides *beside* the
  writer's turn — never inside the prefilled composer text.** The prefill is
  writer-editable prose; instructions embedded there could be trimmed, or
  forged by pasted prose. Anything the persona treats as authoritative must be
  a reserved tag the delimiter neutralizer protects.

### 3. The prefilled ask

- Clicking a tool in the composer picker (non-excerpt session only) writes a
  persona-addressed, tool-named message into the composer. It does **not** send.
- The text is derived from the tail of the thread: point at a persona turn when
  there is one to point at (`Hey Jill! Run Stock & Signature on your last
  suggestion and let's see what it finds.`), and stay target-neutral otherwise
  (`Hey Jill! Run Stock & Signature and tell me what it finds.`). A prefill that
  misdescribes the thread is worse than a generic one.
- It is fully editable and non-binding. The writer's rewrite is always the real
  request; the persona's chosen inputs are reported in the provenance block.

### 4. Divider and provenance

The transcript divider names which door the run came through:

```text
── Stock & Signature · direct run · excerpt v3 ──
── Stock & Signature · via Jill · persona-supplied passage, 240 words ──
```

The run's visible request and report state each input's mode, the material
actually used, who chose it, and any truncation. `Subject: pinned excerpt v3`
and `Subject: persona-supplied (240 words)` are different facts — without the
distinction a writer can neither trust nor reproduce the run.

### 5. The room is never mutated

A run affects exactly one tool execution. The pinned excerpt, context-attachment
list, source provenance, retained persona history, and later runs are unchanged.
`replace` removes host-delivered material for one run; it does not remove the
project-resource safety gate. A configured-resource read remains a separate,
bounded, attributable capability.

## Explicit non-goals

- No writer-facing subject picker, policy control, or free-text field.
- No change to excerpt-mode behavior in the rail or the composer.
- No lifting of the rail gate.
- No arbitrary filesystem access.
- No Conversation Widgets — those are a later epic. A tool may be *asked* for
  Creative Variations and return them in its report body; the writer copies
  manually. No widget, no apply-to-draft, no special variations implementation.

## Exit criteria

- In a non-excerpt session, the persona can run an analysis tool with each
  combination of excerpt and context modes, including the vacuum run.
- `prepend` against absent material and `prepend`/`replace` with empty text are
  both rejected with a visible reason.
- Excerpt-mode rail and composer runs behave exactly as before.
- The grammar sits in the system prompt and is identical for open and passage
  rooms; the per-turn frame reports current state without a system-prompt
  variant.
- The scope frame is a reserved tag and cannot be forged by writer prose.
- The prefill never claims a thread target that is not there, and never sends
  on its own.
- Both divider variants render, and the report states each input's mode,
  material, chooser, and truncation.
- The room's excerpt, attachments, and provenance are unchanged after a run.
- Contract, validation, prompt-assembly, provenance, and direct/persona
  execution tests pass with normal repository validation.

## Completion notes

- Added the closed `analysis.run` input grammar to the stable Workshop host
  system prompt. The user-turn capability contract now carries only dynamic
  capability availability plus a reserved `<workshop-analysis-scope>` facts
  frame.
- Added strict host validation and one-run resolution for all 16 independent
  excerpt/context mode pairings. Invalid modes, mismatched text fields,
  oversized resolved inputs, and prepend-without-material requests reject
  visibly; `omit`/`omit` runs legally.
- Kept direct rail/composer runs unchanged in passage rooms. In open rooms the
  rail stays gated while the composer palette seeds an editable, unsent ask for
  the host.
- Added host-owned divider and per-input provenance rendering. Tool report
  bodies remain verbatim; provenance persists beside them as structured turn
  metadata.
- Confirmed local runs do not modify the pinned excerpt, standing context,
  configured-resource boundary, or later-run inputs.
- Reconciled the prompt language with ADR 2026-07-25: after a room has memory,
  scope is immutable. The relevant cache invariant is therefore one stable
  host prompt across open/passage creation and changing per-turn input facts,
  not a mid-memory scope flip.

### Verification

- `npm run typecheck`
- `npm run lint` (0 errors; repository baseline warnings remain)
- `npm test -- --runInBand`
