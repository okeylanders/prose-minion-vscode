# ADR 2026-07-11: Workshop Excerpt Revision and Room Memory

**Status:** Proposed
**Date:** 2026-07-11
**Extends:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Feature investigation:** [.todo/features/feature-workshop-excerpt-revision-loop](../../.todo/features/feature-workshop-excerpt-revision-loop/README.md)

## Context

The pinned excerpt is not part of any system prompt. It is framed into the
**first user message** of each retained conversation — provenance lines plus a
`<pinned-excerpt>` block, capped at 10,000 words
(`AssistantToolService.buildWorkshopPersonaUserMessage`). "Pinned" means the
excerpt rides retained conversation history: follow-up turns see it without
resending, and agent identity (the system prompt) stays immutable.

That mechanism has a sharp consequence for the Workshop's core loop —
*get feedback → revise the manuscript → ask for another look*:

- `WorkshopSessionService.replaceExcerpt()` calls `clearAllConversations()`,
  discarding the host conversation and every tool sidecar, because the old
  excerpt is baked into turn 1 of each immutable history.
- The visible thread (`turns`) survives. The writer sees a full transcript;
  the persona's next reply comes from a brand-new conversation that remembers
  none of it. The UI displays continuity the model no longer has.
- "Did my revision fix what Cliché flagged?" is unanswerable — the host has
  forgotten Cliché, the flags, and the conversation.

A second fork rides the same decision: what should a **same-tool re-run** see?
Today a re-run atomically replaces/disposes the tool's sidecar (locked in
Sprint 06B) — a fresh conversation on the current excerpt. The alternative
(continuing the sidecar thread with the new excerpt) would give tools memory
at the cost of anchoring: a run that can see its previous findings tends to
grade the revision against its old answers instead of reading clean, and the
thread would carry both excerpt versions into every re-run.

Constraints that stand throughout:

- Agent identity and retained histories are immutable (ADR 2026-07-09 §3).
- No paid model calls for bookkeeping (deterministic status, not model
  acknowledgements — ADR 2026-07-09 §5).
- Sprint 06B's excerpt-frame delimiter neutralization is a trust boundary
  requirement, not a formatting nicety.

## Decision

### 1. Host memory survives excerpt replacement (versioned revision frames)

Replacing the excerpt no longer discards the host conversation. Instead the
session records a **pending revision notice**. The next host turn delivers it
ahead of the writer's message as a structured frame:

```text
The writer has revised the pinned excerpt. Earlier versions in this
conversation are superseded.
Source: <relativePath>
<pinned-excerpt version="2">
…full revised excerpt…
</pinned-excerpt>
```

- Delivery mirrors the Sprint 06B handoff pattern: **no API call happens at
  replacement time**; the frame rides the next host turn, and the pending
  notice is cleared only after that turn succeeds.
- Multiple replacements before the next host turn collapse to one notice
  carrying only the newest version — intermediate drafts the host never saw
  are not billed into history.
- The session tracks a monotonic `excerptVersion`; turns and tool artifacts
  record the version they saw.

### 2. Tools remain stateless instruments; the host is the room's memory

- Excerpt replacement still disposes every tool sidecar — their pinned input
  is stale, and direct-mode follow-ups against it would be dishonest.
- A same-tool re-run remains a **fresh conversation** on the current excerpt
  (Sprint 06B replace/dispose semantics unchanged). Reports stay full,
  clean, reproducible passes.
- Comparison questions ("did I fix what Cliché flagged?") are the host's
  job: it holds prior reports via evidence/handoff and receives fresh
  reports the same way. Seeding re-runs with prior-findings summaries (R2 in
  the feature investigation) is explicitly deferred until direct-tool
  comparison proves wanted.

### 3. Honest UI at the replacement boundary

- A deterministic thread divider renders at replacement: excerpt version,
  source path, and which tool sidecars were retired
  (e.g. "Excerpt v2 pinned · ch-03.md · retired: Cliché, Continuity").
- The excerpt panel/status shows the current version.
- No confirmation dialog is required: under this model replacement destroys
  no persona memory, and retired sidecars are cheap to re-run. The divider
  is disclosure, not ceremony.

### 4. Bounds and cost honesty

- Every version frame is independently capped by the existing
  `WORKSHOP_PERSONA_EXCERPT_MAX_WORDS` (10,000 words) with head-slice
  provenance on trim.
- Retained history grows monotonically with each revision (immutability
  forbids pruning). After **three** replacements in one session, a
  deterministic advisory suggests starting a new session (which preserves
  the excerpt and resets cost); it never blocks.
- The token rail continues to report real usage; nothing hides the growth.

### 5. Trust boundary per frame

Sprint 06B's delimiter neutralization (including `</pinned-excerpt>`) applies
to **every** version frame and to the revision-notice wrapper, not only the
first pinned excerpt. The mid-run replacement guard
(`MID_RUN_EXCERPT_GUARD_MESSAGE`) is unchanged.

### 6. Deferred

- Diff-based revision frames and model-generated "what changed" summaries.
- R2 (fresh tool runs seeded with bounded prior findings).
- Guest persona participants — a separate ADR that inherits this memory
  model ([2026-07-11 — Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md)).

## Consequences

**Gains**

- The revision loop — the Workshop's core use case — works: revise, replace,
  ask the host to compare, without amnesia.
- One memory locus for the room: the host remembers; instruments stay cheap,
  clean, and reproducible.
- Replacement costs nothing at click time; the writer pays only when they
  next speak to the host.

**Costs / risks**

- Host history carries up to 10k words per revision, forever (immutable).
  Mitigated by the collapse-to-newest rule, the three-replacement advisory,
  and the new-session boundary — not eliminated.
- The pending-notice path adds a small state machine (pending → delivered →
  cleared on success) that must survive webview reloads and cancellation.
- `WorkshopHandler.handleSetExcerpt` and `replaceExcerpt()` change observable
  behavior (host conversation id survives); tests asserting invalidation
  must be rewritten, not deleted.

**Explicitly unchanged**

- Agent identity immutability, verbatim tool reports, sidecar
  replace-on-re-run, mid-run guard, `reset()` semantics (full clear including
  thread), and Sprint 06B handoff bounds.

## Implementation

Sprint [06C — Excerpt Revision Loop](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06c-excerpt-revision-loop.md).
