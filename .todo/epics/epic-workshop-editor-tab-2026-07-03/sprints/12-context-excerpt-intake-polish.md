# Sprint 12: Excerpt & Context Intake Rework + Interface Polish

> **Budget invariant (Sprint 06C):** attachment-size and aggregate context
> caps live in `packages/core/src/shared/constants/promptBudgets.ts`.

**Status**: Planned
**Priority**: High (final live-session-shape and interface sprint before persistence)
**Branch**: `sprint/workshop-editor-tab-12-context-excerpt-intake` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 11 for configured-resource/file-browsing concepts and
Sprint 11B for honest context-budget telemetry before attachments add prompt
material. Executes before the final Sprint 10 persistence pass.
**Feature**: [feature-workshop-context-selector](../../../features/feature-workshop-context-selector/README.md)
**Design source**: Okey's intake direction, 2026-07-14 (screenshot review of
the live left rail), sharpened 2026-07-16 with verified pasted-selection
provenance and source-aware context discovery, plus the Context Bar v2 comp
(Claude Design, 2026-07-16) whose "In context" sources panel this sprint
feeds, and the Intake Widgets comp (Claude Design, pulled 2026-07-17 into
`docs/design/`) — the interactive source of truth for the excerpt/context
cards, the Context Selector modal, and the Context wizard (added to scope
2026-07-17).

## Sprint status (updated 2026-07-18)

Implementation runs as eight phases on
`sprint/workshop-editor-tab-12-context-excerpt-intake`. Each phase lands
with its tests; full suite + typecheck + lint green at every commit.

| Phase | Scope | Status | Key commits |
|---|---|---|---|
| 1 | Foundations: `WorkshopExcerptSource` union (single source of truth, coerced at IPC), selection line-range transport (`EditorContext` + `SELECTION_DATA`), `workshop_excerpt_verify` target | **Done** | `70d83d2` |
| 2 | Excerpt panel rework: intent buttons, verified paste (exact-match gating), locked `Update text…`/`Re-read from file`, re-read no-op; + webview-panel verify fallback (adapter remembers last editor selection) and boxed action buttons | **Done** | `650a5e3`, `898e684` |
| 3 | Context attachments replace the brief: aggregate-owned list (budget, duplicate guard, head-slice), add/remove routes, pills + meter UI, ONE `<context-attachments>` frame builder for host/update/tool delivery, mid-session `context_change` event turns | **Done** | `99d2f41` |
| 4 | `WorkshopModalShell` (tech-debt 2026-07-10 resolved) + Context Selector modal: category browse, Names / Names+content search (client names, bounded host content search), filter pills, explore hatch; composer `+` + panel both open it; excerpt "Choose from project…" opens it in single-select mode with honest `sourceUri` (summaries carry host-only `absolutePath`) | **Done** | `9f3a06b`, `858bf46` |
| 5 | Context wizard (scope added 2026-07-17): reuses `ContextAssistantService` under its own `workshop-context` streaming domain, one-run guard, cancellable; brief attaches FIRST, results land as wizard-tagged attachments through the standard budget path; text pills expand to readable notes | **Done** | `c1f5973`, `5eb2183` |
| 6 | Source-aware prompt frames (host/guest/tool excerpt-source frame, provenance → canonical `{ group, path }`) + bounded composite tool catalog (source + neighbors + guides) | Pending | — |
| 7 | Context source manifest: engine per-round instrumentation, `ConversationManager` storage beside `contextBudget`, writer-entry stamping, `sources` on `LabeledContextBudgetSnapshot`, Context Bar v2 "In context" panel | Pending | — |
| 8 | Pin-language sweep (wire contracts included), compaction ADR draft, 06B manual UX pass, bundle verification + deltas | Pending | — |

Also landed: design comps pulled to `docs/design/` (`34cb79a`), wizard folded
into this doc (`f944646`), context budget interim bump 10k → 35k with the
setting tracked in
`.todo/tech-debt/2026-07-17-context-attachment-budget-setting.md` (`c0cfbe9`).
Manual EDH verification by Okey through Phase 5: verified paste, re-read,
attachments/meter, selector + search, wizard.

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
- **Excerpt source is recorded** as part of session state. Intake method and
  source provenance are not the same fact: pasted text may be a verified
  editor selection. Use a closed source shape along these lines:
  `{ kind: 'manual' } | { kind: 'editor-selection'; sourceUri; relativePath;
  startLine; endLine; configuredResource? } | { kind: 'file'; sourceUri;
  relativePath; configuredResource? }`. `configuredResource`, when present,
  is the resolver's canonical `{ group, path }` key; raw absolute paths never
  enter the webview or model-visible frame.
- **Paste verification reuses the proven selection seam.** On textarea paste,
  request the active editor selection and stamp `editor-selection` provenance
  only when its text exactly matches the pasted text. The sidebar already does
  this through `assistant_excerpt_verify`; Workshop gets its own typed target
  rather than sharing React state across webview roots. Clipboard/manual text
  that cannot be verified remains honestly `{ kind: 'manual' }`.
- **Selection provenance includes a 1-based inclusive line range.** Extend the
  host-agnostic `EditorContext` selection result and `SELECTION_DATA` payload;
  keep the range optional at transport boundaries for non-editor hosts, but
  stamp it whenever VS Code supplies one.
- **The source is visible under the excerpt**, for example
  `From chapters/chapter-5.md · lines 143–151` or `Pasted or typed · source
  unknown`. This is provenance, not a context attachment and not a claim that
  the full source file was loaded.
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
- **`[Context wizard]` (scope added 2026-07-17, per the Intake Widgets
  comp):** a third intake button that reuses the sidebar Context tool's
  generation lane (`ContextAssistantService`, `contextModel` scope, closed
  `projectContext` resource-read protocol) behind Workshop-scoped routes with
  a distinct streaming domain so the two lanes never cross-consume chunks or
  results. One run at a time (explicit guard, visible status row per the
  comp). A run's requested resources land as wizard-tagged *file attachments*
  and its generated brief as a wizard-tagged *text attachment* — all subject
  to the same aggregate budget, duplicate guard, remove controls, and
  mid-session event turns as writer-added attachments.
- **Prompt assembly**: attachments are delivered in labeled frames with
  provenance (reusing the delimiter-neutralization conventions), replacing the
  single-brief injection. Tool runs receive the same assembled context.
- **Mid-session additions are visible, never silent**: adding/removing an
  attachment after the conversation starts emits a visible session event turn
  ("Added context: character-sheet-raven.md · 412 words"), and the updated
  context reaches the host on its next turn — no invisible prompt mutation.

### Source-aware context discovery

- Deliver a structured, delimiter-neutralized excerpt-source frame alongside
  the excerpt on the host's opening turn, revision updates, guest join frames,
  and every initial tool-sidepass run. Use display-safe `relativePath`, line
  range, and canonical configured-resource key; do not put a raw `file:` URI or
  absolute filesystem path into model-visible prompt text.
- The host may use Sprint 11 access to read the full canonical source resource,
  search the `chapters` / `manuscript` groups for adjacent chapters, and consult
  project-bible resources when that context would materially improve its
  answer. Source metadata makes this discoverable; it does not silently load a
  whole chapter into every turn.
- **Current tool-agent gap must be closed, not hand-waved:** Workshop analysis
  sidepasses currently receive `sourceUri`, but their initial `resource.read`
  capability is the craft-guide catalog only. A URI in prompt text cannot read
  the project file. Add one bounded initial-read adapter that composes relevant
  configured project resources (source first, neighboring chapters next) with
  the existing craft-guide catalog under the proven closed resource-read
  protocol. Do not give tools arbitrary filesystem access or silently preload
  full chapters.
- Tool-requested source reads remain attributable and bounded. The tool report
  should state which source/neighbor resources it actually received; missing,
  unconfigured, or over-budget source context stays explicit.

### Context source manifest (the Context Bar's "In context" panel)

The Context Bar v2 comp reserves an "In context" section in the expanded
gauge (the 11B bar landed without it). This sprint supplies its data: one
manifest per retained conversation listing what that participant is actually
carrying — regardless of who put it there. A file the host fetched
autonomously is context the writer is paying for and must not be invisible.

- **Every entry origin is covered.** Writer-declared material (pinned excerpt
  with version, each context attachment) AND model-fetched material: host
  `resource.read` deliveries from the Sprint 11 persona lane, host-triggered
  `analysis.run` tool evidence and dictionary evidence frames, and a tool
  sidecar's own delivered source/neighbor/guide reads from this sprint's
  composite catalog.
- **Entry shape** (closed, display-safe): `{ kind: 'pin' | 'attachment' |
  'resource' | 'tool-evidence' | 'dictionary'; origin: 'writer' | 'host' |
  'tool'; label; configuredResource?: { group, path }; sizeChars;
  promptTokensDelta?; isEstimate; excerptVersion?; stale?; deliveredAt }`.
  Raw absolute paths and conversation ids never enter the manifest.
- **Cost is provider-measured where possible.** The engine already records
  one `InferenceRequestObservation` per capability round; the prompt-token
  delta between consecutive rounds is attributed to the evidence delivered
  between them. `sizeChars` remains the honest fallback with
  `isEstimate: true`. `ConversationManager` still never tokenizes (11B
  guardrail preserved).
- **Same ownership and lifecycle as the context snapshot.** The engine
  collects entries during the turn and commits them beside `contextBudget`
  only after the atomic history commit; cancellation and transport failure
  preserve the prior manifest; reset, deletion, idle expiry, tool
  replacement, and guest dismissal clear or replace it with its
  conversation. Writer-origin entries are stamped by the session service at
  attach/pin time.
- **Stale, not deleted.** An excerpt revision marks prior-version pin entries
  stale (the comp's dimmed rows with a STALE tag); re-reading the same
  canonical resource replaces its entry instead of duplicating it.
- **Projection.** `LabeledContextBudgetSnapshot` gains `sources`; the v2
  drawer renders them grouped with sizes and origin attribution. The manifest
  observes — it never gates, edits, or trims prompt content.

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
- [ ] Wire exact paste-to-active-selection verification into the Workshop
      textarea; extend selection transport with source line range; render the
      display-safe source tag and preserve honest unknown-source fallback.
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
- [ ] Context wizard: Workshop-scoped generate/cancel routes reusing
      `ContextAssistantService` (new streaming domain + one-run-at-a-time
      guard); wizard results land as wizard-tagged attachments through the
      standard add path (budget + duplicate guards); status row per the comp.

### Source-aware prompt and tool delivery

- [ ] Add one shared excerpt-source prompt frame used by initial host, host
      revision, guest join/catch-up where applicable, and initial tool runs;
      cover delimiter neutralization and display-safe provenance.
- [ ] Resolve verified selection/file provenance to a canonical configured
      `{ group, path }` when possible so Sprint 11 reads do not depend on the
      model reconstructing a path or guessing its case.
- [ ] Give Workshop tool initial runs a bounded composite resource catalog:
      relevant configured source/neighbor resources plus existing craft
      guides, one closed read protocol, source-first ordering, and explicit
      delivered-resource provenance. Preserve the sidebar tools' existing
      guide-only behavior.

### Context source manifest

- [ ] Add the manifest entry type to the semantic layer and store the
      committed manifest in `ConversationManager` beside `contextBudget`,
      inheriting the same commit/cancel/reset/delete/expiry semantics.
- [ ] Collect per-round delivered items in `AgentRunEngine` (resource reads,
      analysis and dictionary evidence) with provider-measured prompt-token
      deltas per capability round; fall back to char sizes marked as
      estimates.
- [ ] Stamp writer-origin entries (excerpt version, each attachment) from the
      session service; mark prior-version pins stale on revision; replace
      superseded same-resource reads instead of duplicating them.
- [ ] Give tool sidecars the same manifest for their own delivered
      source/neighbor/guide reads.
- [ ] Project `sources` through `LabeledContextBudgetSnapshot` and render the
      Context Bar's "In context" section: grouped rows, sizes, origin
      attribution, stale dimming; display-safe labels only.
- [ ] Draft the context compaction ADR during this sprint: decision
      framework, candidate mechanisms (compress vs. compact vs. stale-
      evidence eviction, informed by what the manifest shows dominates real
      sessions), and what retained-history surgery means for the atomic
      commit and snapshot semantics. The epic ships as one release, so the
      post-launch fast-follow must be implementation, not design.
      Implementation itself stays out of Sprint 12.

### Composer

- [ ] `+` opens the Context Selector modal; resulting attachments appear in
      the rail list and the event turn.
- [ ] Preserve Sprint 11B's active-participant context widget in the band below
      the participant rail and above the composer; attachment UX must not
      relabel processed traffic as context or duplicate telemetry state.

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
      exact verified-paste match/mismatch, line-range propagation, visible
      source tag, re-read replace + no-op, pin-button absence.
- [ ] Attachments: caps, duplicate guard, remove, ordering, prompt-frame
      assembly, mid-session event turns.
- [ ] Wizard: streaming-domain separation from the sidebar Context lane (no
      cross-consumed chunks/results), one-run guard, results-to-attachment
      mapping honors caps/duplicates, cancel mid-run leaves attachments
      unchanged.
- [ ] Modal: category grouping from configured paths, explore path, no raw
      path leakage.
- [ ] Live session snapshots include excerpt source, ordered attachments, and
      context event turns without exposing mutable aggregate internals.
- [ ] Prompt/capability: host, guest, and tool source frames agree; a tool can
      request the configured source/neighbor on its initial run; unconfigured
      or ambiguous sources fail safely; no absolute path reaches the prompt.
- [ ] Manifest: a host resource read, a host-triggered analysis side pass,
      and writer attachments appear with correct kind/origin and measured or
      honestly estimated sizes; cancelled turns preserve the prior manifest;
      reset, guest dismissal, and tool replacement clear it with the
      conversation; prompt-token deltas match the pinned multi-round
      observation fixtures; no absolute path or conversation id crosses the
      webview contract.

## Acceptance Criteria

- A first-time writer sets an excerpt and context without encountering the
  word "pin": two buttons each, obvious outcomes, live word counts.
- After the first message to the host, the excerpt is visibly locked; a
  file-backed excerpt offers `Re-read from file` and picks up on-disk edits as
  a v2 revision the host acknowledges; a pasted excerpt offers `Update text…`.
- Pasting the active editor selection from chapter 5 labels the excerpt with
  its display-safe file and line range. The host can autonomously read that
  configured chapter and discover adjacent chapters; an initial tool run can
  request the same bounded source context. Pasting unrelated clipboard text
  shows source unknown and never borrows the active editor's provenance.
- Context holds e.g. two free-text notes + three project files, each
  removable, with the aggregate budget visible; the persona demonstrably
  receives all of them with provenance.
- Adding a file from the composer `+` mid-conversation shows an event turn and
  reaches the host on the next turn.
- The Context wizard runs at most once at a time, streams a visible status
  row, and its picks arrive as removable wizard-tagged attachments that
  respect the aggregate budget; a concurrent sidebar Context run is
  unaffected by a Workshop wizard run and vice versa.
- After Jill autonomously reads two persona files and triggers a Dialogue
  side pass, expanding the context bar lists those three sources with origin
  attribution ("Requested by Jill") and measured or honestly estimated sizes,
  alongside the pinned excerpt and writer attachments. Dismissing a guest or
  replacing a tool removes its manifest with its conversation.
- 06B manual verification recorded; lint, typecheck, focused/full tests,
  build, bundle verification pass. Record bundle deltas.

## Guardrails

- Intake rework changes *intake*, not memory: `replaceExcerpt` revision
  semantics, room-memory rules, and tool statelessness are untouched.
- The modal is the writer-controlled attachment path. The Context wizard is
  the one model-assisted intake lane, and it is bounded: it reuses the
  sidebar Context lane's closed `projectContext` read protocol, runs one at a
  time, and its picks land as ordinary, visible, removable attachments —
  never silent context mutation.
- Verified excerpt provenance may guide a model-requested read, but it never
  bypasses configured-resource membership, workspace containment, or the
  capability's byte/round limits.
- No attachment content enters the prompt without a labeled frame and a rail
  artifact the writer can inspect; no silent context mutation mid-session.
- The source manifest observes; it never gates, edits, trims, or reorders
  prompt content, and it stores labels and sizes, never raw content.
- Webview never touches the filesystem: all browsing/enumeration host-side
  through `FileSystem`/`Workspace`/`ShellService` ports; display-safe paths in
  the UI.
- Don't gold-plate the modal (search-within-modal, previews, multi-root
  workspaces can wait); this sprint closes the live session shape, and Sprint
  10 closes the epic by persisting it.
