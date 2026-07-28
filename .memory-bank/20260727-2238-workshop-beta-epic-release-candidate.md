# Workshop Beta Epic — Release Candidate

**Date:** 2026-07-27
**Branch:** `epic/workshop-editor-tab`
**Integration PR:** [#95](https://github.com/okeylanders/prose-minion-vscode/pull/95)
**Target:** `main`
**Status:** Feature-locked and ready for epic merge; Marketplace version/tag/publish remain a separate release workflow
**Epic:** `.todo/archive/epics/epic-workshop-editor-tab-2026-07-03/`

## Release boundary

PR #95 is the final integration boundary for the Workshop editor-tab epic.
The feature was implemented and reviewed incrementally through PRs #66–#94,
then received an epic-level architecture pass and Marketplace hardening on
`7208967`.

The changelogs use **Unreleased** rather than guessing a semantic version.
Merging PR #95 means the epic is deployed to `main` and its planning artifacts
are archived; it does not by itself claim that a VSIX, GitHub release, tag, or
Marketplace version has been published.

## Shipped feature inventory

### Full-tab Workshop foundation

- Single Workshop editor-tab panel with reveal/reuse behavior.
- Shared webview bundle with separate `App` and `WorkshopApp` roots.
- Independent panel restoration via `onWebviewPanel:prose-minion.workshop`.
- Host-side `WorkshopSessionService` aggregate and typed webview snapshots.
- Streaming multi-turn chat, cancellation, status narration, quick actions,
  editor-selection seeding, and model selection.

### Session scope, excerpt, and context

- Passage and open-room session scopes with honest prompt semantics.
- Scope immutability after the room acquires memory.
- Excerpt provenance for selection, manual paste, and project-file sources.
- Versioned excerpt revision loop that preserves host memory.
- Reread/verification and destructive full-reset paths.
- Multiple standing manual/file context attachments with aggregate budgets.
- Context Selector, configured project-resource catalog, bounded search, and
  Context wizard.
- One-shot message resources distinct from standing context.
- Source manifest and active-conversation retained-context gauge.

### Persona-hosted Writers' Room

- Jill plus eleven specialist hosts: Sister Agnes, Cliff, Dev, Edna, Felix,
  Harper, Margot, Penny, Quinn, Theo, and Wren.
- Packaged persona foundations, focus icons, expression profiles,
  calibrations, and read-only persona schematics.
- Host selection at session start and stable host identity thereafter.
- Bounded persona guests with invite/dismiss/re-invite lifecycle.
- Participant rail with explicit host, guest, and instrument targets.
- Shared ordered room ledger with per-reader delivery offsets.
- Speaker-labeled, bounded, retry-safe room catch-up.
- Open-room participants without fabricated excerpt knowledge.

### Conversation behavior

- Analyze, Balanced, and Converse interaction modes.
- Subtle, Full, and Amplified persona expression.
- Reserved, Attuned, and Reflective relational depth.
- Session cue carry-forward control.
- Optional global Writer Profile with bounded preferred-address and bio fields.
- Atomic between-run prompt rebuilds for behavior/profile changes.

### Instruments, capabilities, and tasks

- All 14 writing tools available from the Workshop.
- Isolated tool sidecars with verbatim visible reports.
- Persona synthesis receives tool reports as structured evidence.
- Private writer/instrument follow-ups with explicit audience labeling.
- Bounded direct-tool handoff to the host.
- Shared `AgentRunEngine` for cancellation, capability rounds, structured
  response parsing, usage aggregation, and completion.
- Persona-callable dictionary lookup/generation and analysis.
- Persona project-resource catalog, search, and read capabilities.
- Run-local analysis subjects and inherited/replacement context.
- Participant-owned capability artifacts published to the room only with a
  committed reply.
- Actionable tool findings and host-proposed persistent todos.
- Optional web research with persisted citation pills, explicit disclosure,
  and default-off configuration.

### Persistence and recovery

- Atomic rolling `current.json` checkpoint.
- Named save/update/save-as-new identities with editable titles.
- Session browser search, grouping, Open/New/Rename/Duplicate/Reveal/Delete.
- Compact bounded summary indexes separate from authoritative snapshots.
- Exact restoration of product state and provider-neutral conversation
  archives under fresh runtime IDs.
- Per-conversation degraded recovery for corrupt archives.
- Ordered autosave and session-operation queues.
- Workspace-root pinning, rollback, unreadable-current protection, and
  activation/deactivation barriers.
- Generated session directory ignored from source control by default.
- 25 MiB exact read/write ceiling and 100-level serialized-JSON depth ceiling.

### Release-candidate UX and catalog

- Carded Workshop intake rail and finalized composer/participant layout.
- Categorized Tools sheet and Conversation Widgets coming-soon preview.
- Wide Conversation Controller and persona selection/configuration sheets.
- Versioned six-part illustrated Workshop beta tour and configuration guide.
- Host-side machine-scoped notice suppression.
- Claude Opus 5, Claude Opus 5 Fast, Kimi K3, Gemini 3.6 Flash, and Fugu Ultra
  catalog entries with no default-model change.

## Architectural decisions

- `apps/vscode-extension` is the only composition root and the only layer that
  imports `vscode`.
- `packages/core` remains host-agnostic behind Platform ports.
- Workshop state and invariants live in the host aggregate, not React.
- Persona identity/system prompts remain immutable within retained provider
  conversations; tools are instruments, not substitute personas.
- Capabilities cross closed typed/validated boundaries with independent
  call/result/input/path/prompt budgets.
- Session persistence captures aggregate and conversation archives at one
  ordered transaction boundary.
- Room delivery is materialized at one site and advances offsets only after
  successful participant turns.

## Safety and privacy

- Model/workspace Markdown is sanitized; executable markup, images, and unsafe
  URI surfaces are removed.
- Resource enumeration and reads stay behind host ports and containment policy.
- Reserved prompt-frame delimiters are neutralized in writer/model content.
- Excerpts, attachments, searches, capabilities, room catch-up, prompt
  assembly, browser reads, and session JSON are bounded.
- Session data remains workspace-local and is gitignored by default.
- Writer Profile is global writer-owned settings data and is not copied into
  workspace session JSON.
- Web research is opt-in/default-off and discloses that active room context may
  reach OpenRouter and search providers.

## Verification

- GitHub Actions passed on release-candidate commit `7208967`.
- `npm test -- --runInBand`: 139 suites, 1,518 tests, 1 snapshot passed.
- `npm run typecheck`: core, webview, and extension passed.
- Repository lint: no errors; existing warning-only baseline remains.
- Changed-file lint after final storage review: passed.
- `npm run build`: both production bundles compiled; bundle sentinels passed.
- `git diff --check`: passed.
- The Workshop feature was reviewed incrementally through PRs #66–#94 before
  the final epic architecture and release-hardening pass.

## Accepted post-beta work

### Active product follow-ups

- Conversation Widgets implementation.
- Workshop context compaction controls and lifecycle.
- Apply-to-draft/write-back.
- Branch board and variation branching.
- Task sidecar conversations.
- Persona calibration and relational-depth provider evaluation.
- Participant identity-color expansion and other explicitly proposed UX work.

### Active architecture and operational debt

- Full-snapshot autosave has an O(n²) write-volume curve for very long rooms;
  define compaction/incremental persistence without weakening crash recovery.
- `WorkshopHandler`, `WorkshopSessionService`, `WorkshopApp`, and `useWorkshop`
  need named responsibility extraction before substantial feature growth.
- Remaining application-to-concrete-infrastructure dependencies should move
  behind application-owned ports.
- Surface-specific handler composition could avoid duplicated listeners and
  configuration synchronization across the sidebar and Workshop panel.
- Normalize missing-file errors through the `FileSystem` port instead of
  matching provider message strings.
- Keep prompt-side capability contracts synchronized with code validators.
- Reconcile resource-search semantics and bounds.
- Define durable web-research invocation budgets and canonical citation-link
  behavior before expanding the opt-in feature.

## Archive actions

- Moved the completed Workshop editor-tab epic, including all sprint records,
  to `.todo/archive/epics/`.
- Moved completed Workshop feature trackers to `.todo/archive/features/`.
- Moved resolved Workshop debt tripwires/extractions to
  `.todo/archive/tech-debt/`.
- Kept proposed, parked, deferred, evaluation, compaction, widget, and
  structural-debt artifacts active.

## Next release steps

1. Review and merge PR #95.
2. Choose the semantic version in the release workflow.
3. Convert the Unreleased changelog entries to that version/date.
4. Package and manually smoke the VSIX.
5. Create the tag/GitHub release and publish to Marketplace only with explicit
   approval.
