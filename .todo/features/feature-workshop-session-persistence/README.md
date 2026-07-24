# Feature: Workshop Session Persistence (Survive VS Code Restart)

**Status**: Implemented in
[draft PR #85](https://github.com/okeylanders/prose-minion-vscode/pull/85) on
2026-07-23; automated verification and CI complete, with manual Extension
Development Host restart/corrupt archive verification and PR review remaining. See
[Sprint 10](../../epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md)
and [ADR 2026-07-14](../../../docs/adr/2026-07-14-workshop-session-persistence.md).
The ADR supersedes this README's storage direction: **JSON files under
`prose-minion/sessions/` via the existing `FileSystem` port** (plus a small
`delete()` port extension), not a `workspaceState` Memento/`KeyValueStore`
port — the session-browser requirement made file storage the better fit.
Ship shape = **T3 seamless conversation restore + explicit save + the approved
browser**, with T2 retained only as a visible per-conversation recovery
fallback. The first persisted snapshot is
defined only after the Workshop session shape stabilizes and includes the
**todo list**, **guest participant identities/turns**, Sprint 11 capability
artifacts, and Sprint 12's `excerptSource` + typed context attachments. The
dated investigation below is retained as history; the ADR and sprint doc are
the implementation sources of truth wherever it differs.
**Priority**: High (promoted 2026-07-14 — restart data loss is a live pain point)
**Date**: 2026-07-13
**Origin**: "Is the Workshop editor supposed to remember anything between VS
Code restarts?" — investigation on `sprint/workshop-editor-tab-07-persona-capabilities`
**Related ADRs**: [2026-07-03 Workshop Editor Tab](../../../docs/adr/) ·
[2026-07-09 Workshop Persona Host, Tool Sidecars, Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md) ·
[2026-07-11 Workshop Excerpt Revision & Room Memory](../../../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Related features**: [feature-workshop-excerpt-revision-loop](../feature-workshop-excerpt-revision-loop/README.md)
(the "UI shows continuity the model no longer has" hazard is the *same* seam,
here across a restart instead of an excerpt swap)

The accepted implementation treats `current.json` as the rolling working
session: reopening Workshop restores it without requiring an explicit Save.
It coordinates a complete product snapshot with typed retained
`ConversationManager` histories keyed by logical participant, then mints fresh
runtime conversation ids on hydrate. Leading system messages are rebuilt from
current persona resources, current global behavior/profile settings, and
session-owned standing directives. Future Conversation Widgets extend the
complete snapshot through typed aggregate fields and the shared ordered
autosave seam; no untyped extension bag is reserved.

## Investigation Findings (2026-07-13)

Today the Workshop remembers **nothing** across a real VS Code restart, by
design — and the reason matters for what we *can* honestly restore.

1. **The whole session is one in-memory aggregate.**
   [`WorkshopSessionService`](../../../packages/core/src/application/services/workshop/WorkshopSessionService.ts)
   is "a pure aggregate: no I/O, no vscode, and only an injectable clock." Every
   piece of state lives in private instance fields: `excerpt`, `contextBrief`,
   `turns`, `participants` (host persona + conversation id + tool sidecars),
   `excerptVersion`/`replacementCount`/`turnCounter` counters, delivery cursors,
   pending host updates. It is `new`-ed once at the composition root
   ([extension.ts:159](../../../apps/vscode-extension/src/extension.ts)) with no
   backing store.
2. **The webview persists nothing either — on purpose.**
   [`useWorkshop`](../../../packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts)
   types `WorkshopPersistence = Record<string, never>` because "the session IS
   host state; persisting turns webview-side would only shadow the aggregate
   with a stale copy." Reload-safety is host-side rehydration via
   `WORKSHOP_REQUEST_SESSION` → snapshot.
3. **No Memento, no serializer anywhere.** Zero `workspaceState` / `globalState`
   / `Memento` usage in the codebase. No `WebviewPanelSerializer` is registered
   ([WorkshopPanelProvider.ts:8](../../../apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts):
   "explicitly out of scope"), so after a restart the panel doesn't even
   reappear until `prose-minion.openWorkshop` runs again.
4. **The lifecycle boundary that already works vs. the one that doesn't.**
   Panel close/reopen, tab switch, and webview reload all **survive** because
   the extension-host process stays alive and the session rehydrates from a
   snapshot. A **process restart** (Reload Window / quit / ext-host crash) kills
   that process and the aggregate with it.
5. **⚠️ The retained conversations die too — and this is the crux.** The
   persona host and every tool sidecar reference provider histories *by id*, but
   those histories live in
   [`ConversationManager.conversations`](../../../packages/core/src/infrastructure/api/orchestration/ConversationManager.ts),
   an in-memory `Map`. `continueConversation` **throws `ConversationNotFoundError`
   on an unknown id** (lines 62–65). So even if we serialized the session
   verbatim, rehydrating it with live `conversationId`s would produce a thread
   that **throws on the next host turn**. Conversational *memory* cannot be
   restored from the session alone; it lives in a sibling in-memory Map that is
   equally gone.

**Consequence:** persistence is not one switch. There are three separable things
to save, with sharply different value/cost/risk, so this is staged.

## Problem

A writer pastes a 2,000-word excerpt, types a context brief, and runs a
feedback conversation. VS Code restarts (update, crash, or just quitting for the
day) — and all of it is gone: the excerpt they have to re-paste, the context
brief they have to re-type, and the transcript they can no longer refer back to.
The excerpt and brief are pure writer inputs; losing them is the sharpest papercut.

## Historical Design Directions (superseded by the ADR)

### T1 — Persist writer inputs only (lean, recommended first slice)
Save **excerpt + context brief** (+ `selectedPersonaId` *if* still unlocked).
On restart, `openWorkshop` rehydrates those into a session with an **empty
thread and no conversation ids**. Deliberately restore *nothing* that references
a dead conversation, so there is zero `ConversationNotFoundError` hazard and
persona selection is naturally unlocked again (`hasHostConversation()` is false).
Highest value / lowest risk: "don't make me re-paste my manuscript and re-type
my brief." Workspace-scoped (the excerpt belongs to a manuscript in the workspace).

### T2 — Also restore the transcript as read-only history
Persist `turns` and replay them as a visible, **non-continuable** record,
capped with a divider turn: *"Previous session — transcript restored, room
memory not retained."* This reuses the exact honesty pattern from the
excerpt-revision loop (a `divider`/`excerpt_revision` turn already exists in the
model). The writer keeps the record; the persona still starts fresh. Requires a
**complete** serialization (see "Windowed-snapshot trap" below), not the webview
projection.

### T3 — True cross-restart conversational continuity (selected 2026-07-23)
Persist and rehydrate typed `ConversationManager` histories so the persona
actually remembers. Runtime conversation ids remain ephemeral: histories are
stored under logical participant keys, imported into fresh manager entries, and
remapped into the product aggregate. The leading system message is reconstructed
from current prompt/settings policy rather than replayed. T2 remains the honest
fallback when an individual archived history cannot be validated.

## Historical Architecture Sketch (superseded by the ADR)

**New Platform port — core must never import `vscode`.** Mirror
[`SettingsStore`](../../../packages/core/src/platform/SettingsStore.ts) /
`SecretStore`:

- Port `WorkshopStateStore` (or generic `KeyValueStore`) in
  `packages/core/src/platform/` — e.g. `read<T>(key): T | undefined`,
  `write(key, value): PromiseLike<void>`, `clear(key)`.
- Adapter `VsCodeWorkspaceStateStore` in
  `apps/vscode-extension/src/platform/vscode/`, wrapping
  `context.workspaceState` (`ExtensionContext` is already in scope at
  `activate`, [extension.ts:53](../../../apps/vscode-extension/src/extension.ts)).
- Add to the `Platform` bundle ([Platform.ts](../../../packages/core/src/platform/Platform.ts),
  assembled at [extension.ts:69](../../../apps/vscode-extension/src/extension.ts)).

**Serialize/hydrate on the aggregate.** Give `WorkshopSessionService` a
`serialize(): WorkshopPersistedSnapshot` / `static hydrate(snapshot, now)` pair,
injected the store (or write-through via WorkshopHandler). Persistence must hook
**every mutation seam** — `setExcerpt`/`replaceExcerpt`, `setContextBrief`,
`completeRun`/`completeToolReport`, `reset`, `clearAllConversations` — so a
`reset()` also clears the blob (no stale disk state resurrecting on next launch).

**Panel reopen (optional, pairs with T2/T3).** Register a `WebviewPanelSerializer`
so VS Code reopens the Workshop panel after restart and it rehydrates. T1 works
without it (rehydrate on the next manual open); it's a UX nicety, not a blocker.

## Costs / Constraints

- **Windowed-snapshot trap.** `getSnapshot()` is a *lossy webview projection*
  (last `WORKSHOP_SNAPSHOT_TURN_WINDOW = 100` turns, cloned, **no** conversation
  ids, cursors, counters, or pending updates). Persistence needs a **separate,
  complete** serializer — reusing `getSnapshot()` would silently reset
  `turnCounter` (→ id collisions), `excerptVersion`, and delivery cursors on
  hydrate.
- **Never persist a dangling conversation id.** Durable archives use logical
  participant keys. Hydrate imports validated histories, receives fresh runtime
  ids, and reconnects the product aggregate atomically. An invalid archive
  degrades that participant to T2 rather than retaining an unresolvable id.
- **Scope = workspace, not global.** Excerpt is tied to a manuscript in the open
  workspace; `workspaceState` keys the blob per-workspace automatically.
- **Schema-versioned + discard-on-mismatch.** Stamp a `schemaVersion`; on shape
  mismatch, drop the blob silently and start clean (alpha: no migrations, per
  CLAUDE.md — mirrors the SecretStorage legacy handling, minus the migrate).
- **Excerpt size.** Up to ~10k words on disk in `workspaceState` — fine for a
  Memento; if it ever grows, revisit (Memento isn't meant for megabytes).
- **Privacy note.** The excerpt is manuscript text at rest in VS Code's
  workspace storage. Acceptable (it already sits in the workspace files) but
  worth stating; do **not** put it in `globalState` (leaks across workspaces).

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
  — add `serialize()` / `hydrate()`; hook mutation seams
- `packages/core/src/platform/{Platform,WorkshopStateStore}.ts` — new port
- `apps/vscode-extension/src/platform/vscode/VsCodeWorkspaceStateStore.ts` — adapter
- `apps/vscode-extension/src/extension.ts` — wire port into `Platform` (~L69),
  construct/inject at session construction (~L159)
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts` — trigger
  write-through on mutations; hydrate on first `WORKSHOP_REQUEST_SESSION`
- `apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts`
  — optional `WebviewPanelSerializer` registration (T2/T3)

## Historical Completion Criteria (superseded by the ADR)

- [ ] ADR picks the starting tier (recommend T1) and settles the T3 question
      (does the Workshop want cross-restart *memory*, or transcript-only?).
- [ ] New `WorkshopStateStore` port + VS Code adapter; core still imports no
      `vscode` (architecture boundary test stays green).
- [ ] `WorkshopSessionService.serialize()`/`hydrate()` round-trip preserves
      counters + cursors (a *complete* snapshot, not the webview projection).
- [ ] After a real restart + `openWorkshop`, the excerpt and context brief are
      restored (T1); the transcript restores as read-only with an honest
      "memory not retained" divider (T2).
- [ ] `reset()` / `replaceExcerpt()` clear or update the persisted blob — no
      stale state resurrects on next launch.
- [ ] No rehydrated session ever holds a conversation id that
      `ConversationManager` can't resolve (no `ConversationNotFoundError` on the
      first post-restart turn).
- [ ] Tests: serialize→hydrate fidelity; schema-mismatch discard; hydrated
      session reports `hasHostConversation() === false` in T1/T2 (persona
      selection re-unlocks).

## Resolved Questions

- **T3 desirability:** yes. The Workshop restores the conversation and
  workspace, not merely a readable transcript. Time-awareness frames make
  multi-day continuity explicit without inviting the persona to invent what
  happened during the gap.
- **Panel auto-reopen:** register `WebviewPanelSerializer`; it owns no state and
  reuses `current.json`.
- **Multiple manuscripts / branch-board interplay.** If
  [feature-workshop-branch-board](../feature-workshop-branch-board/README.md)
  lands, "one session per workspace" may need to become "one per branch/excerpt
  lineage" — keep the store key shape flexible (namespaced key, not a fixed one).

## Implementation correction to the historical investigation

The investigation's “discard-on-mismatch” line above is superseded. Named
browser entries with malformed/unknown full envelopes are skipped with
diagnostics, and a single malformed conversation degrades only that participant.
A present but unreadable `current.json` is protected from automatic overwrite
instead of being silently treated as absent. This preserves the writer's best
chance of manual recovery while keeping a fresh in-memory Workshop usable.
