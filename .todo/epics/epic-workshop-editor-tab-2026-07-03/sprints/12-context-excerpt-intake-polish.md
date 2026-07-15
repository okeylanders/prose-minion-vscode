# Sprint 12: Excerpt & Context Intake Rework + Interface Polish

> **Budget invariant (Sprint 06C):** attachment-size and aggregate context
> caps live in `packages/core/src/shared/constants/promptBudgets.ts`.

**Status**: Planned
**Priority**: High (final live-session-shape and interface sprint before persistence)
**Branch**: `sprint/workshop-editor-tab-12-context-excerpt-intake` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 11 in execution order so its configured-resource and
file-browsing concepts can be reused. Executes before the final Sprint 10
persistence pass.
**Feature**: [feature-workshop-context-selector](../../../features/feature-workshop-context-selector/README.md)
**Design source**: Okey's intake direction, 2026-07-14 (screenshot review of the live left rail)

## Goal

The left rail stops asking writers to understand "pinning." The excerpt and
context panels open with plain intent buttons, the excerpt locks honestly once
the room is talking, context becomes a list of visible attachments (free text
and files, multiple of each), and the composer's `+` adds context mid-
conversation without leaving the thread. Plus the deferred manual UX
verification passes from 06B.

## Locked Decisions (design direction, 2026-07-14)

### Excerpt intake

- **Empty state = two buttons**: `[Paste or type]` reveals the textarea +
  confirm; `[Choose file…]` launches the existing host picker
  (`WORKSHOP_PICK_EXCERPT_FILE` → `ShellService.pickFile`, head-slice +
  provenance — this seam already exists and is reused, not rebuilt).
- **The "Pin" button is removed.** Setting an excerpt *is* pinning; the
  PINNED · V1 status chip remains the state indicator.
- **Excerpt source is recorded** as part of session state:
  `{ kind: 'pasted' } | { kind: 'file'; sourceUri }` — the session already
  tracks `sourceUri` for file pins; this makes the pasted/file distinction
  first-class in the live aggregate and in Sprint 10's eventual persisted
  schema.
- **Locked once the session starts** (`hasHostConversation()`): the editing
  affordance becomes **`[Update text…]`** (pasted) or **`[Re-read from file]`**
  (file-backed). Both route through the existing `replaceExcerpt` revision-
  frame semantics (ADR 2026-07-11) — version bump, revision frame to the host,
  no memory reset. Re-read re-runs the original read + head-slice against
  `sourceUri` and no-ops with a status line if content is unchanged.

### Context attachments

- **`[Add free text]` and `[Add file]`**, each addable **multiple times**. The
  single paste-only brief becomes an ordered list of typed attachments:
  `{ id, kind: 'text' | 'file', label, content | sourceUri, size, addedAt }`.
- Each attachment renders as an inspectable card/chip: label, kind, word/byte
  size, remove control. Aggregate budget (existing 10k-word ceiling) enforced
  across all attachments; per-file head-slice with truncation notice.
- **`[Add file]` opens the Context Selector modal** (the remaining scope of
  feature-workshop-context-selector): default browsing rooted in the
  configured context-resource paths grouped by category; an explicit
  "Explore project folders…" escape hatch through the host picker; configured
  vs. explored files visibly distinguished.
- **Prompt assembly**: attachments are delivered in labeled frames with
  provenance (reusing the delimiter-neutralization conventions), replacing the
  single-brief injection. Tool runs receive the same assembled context.
- **Mid-session additions are visible, never silent**: adding/removing an
  attachment after the conversation starts emits a visible session event turn
  ("Added context: character-sheet-raven.md · 412 words"), and the updated
  context reaches the host on its next turn — no invisible prompt mutation.

### Composer

- The composer's **`+` button opens the same Context Selector modal** — adding
  a file mid-conversation without scrolling back to the rail. Same attachment
  list, same budgets, same visibility rules.

### Message, session-shape, and persistence handoff

- `WORKSHOP_SET_CONTEXT_BRIEF` is replaced by add/remove/update-attachment
  messages (alpha: remove the old route in the same PR).
- This sprint establishes `excerptSource` and `contextAttachments` as the final
  live aggregate shape. Sprint 10 then includes them in the first persisted
  `WorkshopSessionSnapshotV1`; no pre-attachment persisted schema ships, so no
  v1 → v2 migration is required.

## Tasks

### Excerpt panel

- [ ] Two-button empty state; remove the pin action; textarea path keeps
      word-count + confirm; file path reuses the existing picker route.
- [ ] First-class `excerptSource` in session state + live session snapshot;
      stamped on set/replace from either path.
- [ ] Locked-state affordances: `Update text…` / `Re-read from file` per
      source kind, both driving `replaceExcerpt`; re-read no-op detection with
      status line; unchanged revision-frame semantics (no new memory model).

### Context attachments

- [ ] Attachment model + add/remove routes + validation (caps, duplicate
      file guard); session aggregate stores the ordered list.
- [ ] `ContextBriefPanel` → attachment list UI: two add buttons, cards with
      size + remove, aggregate budget meter (replaces the single counter).
- [ ] Extract the shared browser-modal shell from the persona/tools modals
      (resolves tech-debt 2026-07-10-workshop-browser-modal-shell), then build
      the Context Selector on it: category-grouped configured paths, explore
      escape hatch, selection state, display-safe paths only. Sprint 10's
      session browser reuses this shell.
- [ ] Prompt assembly: labeled per-attachment frames with provenance for host
      turns and tool runs; delimiter neutralization; truncation notices.
- [ ] Mid-session visibility: session event turn on add/remove after the
      conversation starts.

### Composer

- [ ] `+` opens the Context Selector modal; resulting attachments appear in
      the rail list and the event turn.

### Persistence handoff

- [ ] Keep `excerptSource`, `contextAttachments`, and context event turns as
      plain aggregate-owned data with explicit types; update Sprint 10's final
      serializer inventory if implementation details sharpen during this
      sprint. Do not introduce persistence or a transitional schema here.

### Polish and verification

- [ ] Manual UX pass owed from 06B: participant rail (visual treatment, focus
      behavior, reduced-motion) and composer messaging zones in the Extension
      Development Host — record results in the feature READMEs.
- [ ] Sweep stale "pin" language from UI copy, tooltips, and docs.

### Tests

- [ ] Excerpt: source stamping both paths; locked-state affordance switching;
      re-read replace + no-op; pin-button absence.
- [ ] Attachments: caps, duplicate guard, remove, ordering, prompt-frame
      assembly, mid-session event turns.
- [ ] Modal: category grouping from configured paths, explore path, no raw
      path leakage.
- [ ] Live session snapshots include excerpt source, ordered attachments, and
      context event turns without exposing mutable aggregate internals.

## Acceptance Criteria

- A first-time writer sets an excerpt and context without encountering the
  word "pin": two buttons each, obvious outcomes, live word counts.
- After the first message to the host, the excerpt is visibly locked; a
  file-backed excerpt offers `Re-read from file` and picks up on-disk edits as
  a v2 revision the host acknowledges; a pasted excerpt offers `Update text…`.
- Context holds e.g. two free-text notes + three project files, each
  removable, with the aggregate budget visible; the persona demonstrably
  receives all of them with provenance.
- Adding a file from the composer `+` mid-conversation shows an event turn and
  reaches the host on the next turn.
- 06B manual verification recorded; lint, typecheck, focused/full tests,
  build, bundle verification pass. Record bundle deltas.

## Guardrails

- Intake rework changes *intake*, not memory: `replaceExcerpt` revision
  semantics, room-memory rules, and tool statelessness are untouched.
- The modal is the writer-controlled attachment path — no model-assisted file
  selection here (that is Sprint 11's separate, capability-bounded lane).
- No attachment content enters the prompt without a labeled frame and a rail
  artifact the writer can inspect; no silent context mutation mid-session.
- Webview never touches the filesystem: all browsing/enumeration host-side
  through `FileSystem`/`Workspace`/`ShellService` ports; display-safe paths in
  the UI.
- Don't gold-plate the modal (search-within-modal, previews, multi-root
  workspaces can wait); this sprint closes the live session shape, and Sprint
  10 closes the epic by persisting it.
