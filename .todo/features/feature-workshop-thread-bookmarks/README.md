# Feature: Workshop Thread Bookmarks (Pinned Bubbles)

**Date Identified**: 2026-10-27
**Source**: Brainstorm with Okey (Workshop sidebar batch). Okey's working name is "pins"
**Status**: Idea
**Priority**: Medium

> Lives in tab 2 of the [two-tab rail](../feature-workshop-rail-tabs/README.md),
> next to to-dos. Shares the reader from
> [Read-In Material](../feature-workshop-rail-read-in/README.md).

## Problem

A long Workshop session buries the replies that matter: the one rewrite that
landed, the diagnosis that reframed the chapter, the line you meant to steal.
Scrolling is the only way back. Copy and Save take a bubble *out* of the
thread, but nothing marks it *in* the thread.

## Naming: Avoid "Pin"

"Pin" already means the excerpt, in both the code and the UI. The excerpt
divider reads "Excerpt v6 pinned". There's re-pin, `pinnedAt`, the `pin`
context source kind, and the rail's "Pin from file…". Pinned bubbles in the
same rail as a pinned excerpt would give one word two meanings in one panel.

The nearby alternatives are also taken:

- "Marks" means Rewind's retained-history marks.
- "Flags" means Style Flags and Craft Flags.
- "Saved" means session save and response save.

**Recommendation: Bookmarks.** Use `WorkshopTurnBookmark` in code, and
"Bookmark" with a bookmark icon in the UI. Okey's call. Renaming this folder is
one `git mv`.

## Proposal

- **Toggle** in the bubble's action row (`pm-ws-turn-actions`), next to Copy,
  Save, Rewind, and Branch.
- **Eligible bubbles:** agent replies, writer messages, tool reports, and
  capability cards. Dividers and markers aren't eligible. Bookmarks don't need
  to match Rewind's narrower eligibility.
- **Owned by the host, like to-dos.** For example
  `bookmarks: { id, turnId, label?, createdAt }[]` in session state. It's
  persisted, validated by the codec, and copied defensively into the snapshot.
  It does **not** go in webview `vscode.setState`: bookmarks have to survive a
  reload, travel with Save As and Open, and carry into branches.
- **Label:** a deterministic default built from the bubble (participant label
  plus the first line, truncated). It's never model-generated, the same rule
  as `toolLabel` and `personaLabel`. The writer can rename it. If
  [response save names](../feature-workshop-response-save-names/README.md)
  lands first, the default can reuse the turn's save name.
- **Rail list in thread order**, not creation order, so it reads like a table
  of contents. Clicking a bookmark scrolls to the bubble and focuses it.
- **Personas never see bookmarks in v1.** They're presentation only, like the
  widget-commit chip ("the model never sees this chip").

## The Reload-Window Trap

The snapshot sends only the most recent turns. Older ones are counted in
`truncatedTurns`, and the thread says "Pagination is coming soon". To-do "show
source" already runs into this and shows a toast: "That source turn is
outside the current reload window."

For to-dos that's an edge case. For bookmarks, jumping to an old bubble is
*the whole point*. Pick one approach before building:

1. **Thread pagination, or loading the turns around a target.** This is the
   real fix, and nobody owns it yet.
2. **Open an out-of-window bookmark in the reader.** The host reads the full
   ledger the way transcript export does (`readRoomLedger()`): read-only,
   without joining the mutation gate. Then it renders that one bubble.

**Lean:** option 2 for v1, since the reader is needed anyway. Switch to option
1 when pagination lands.

Either way, the snapshot's bookmark summary has to carry a display-safe label
and the participant, because the bubble itself may not be in `turns`.

## Whole-Room Operations

| Operation | Bookmarks |
|---|---|
| New | Cleared |
| Open | Loaded from the session |
| Rewind | Bookmarks on cut turns are pruned inside the shared room-replacement transaction, as marks are |
| Branch | The branch keeps bookmarks up to the cut. The source file is untouched, because Branch never writes it |
| Export | The projection needs an explicit include/omit decision ([ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-transcript-export.md)). Lean: include a marker in Markdown and HTML and a field in JSON (JSON has its own `formatVersion`) |
| Recall | Omit in v1. Later, "the writer bookmarked this" is a strong hint for `transcript.*` reads ("where did we land?") |

## Persistence

Bookmarks add an optional collection to session state. Per
[ADR 2026-07-30](../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md)
that needs no `schemaVersion` bump. But the codec is strict, so **older builds
will refuse any session that has bookmarks**. It's the same decision as model
stamps; make it once, for both:
[Model Slices → forward compatibility](../feature-workshop-model-slices/README.md#forward-compatibility-the-hard-part).

## Open Questions

- A one-line note on each bookmark ("why I kept this"), or just the label?
- Bookmark a whole exchange (writer message plus reply) as one unit, or single
  bubbles only (lean: single bubbles)?
- Should the session browser show bookmark counts, or search bookmark labels?
- Keyboard: a shortcut to bookmark the focused bubble, and next/previous
  bookmark navigation in the thread?

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`:
  the action row
- `packages/core/src/presentation/webview/WorkshopApp.tsx`: `showTodoSource`,
  the scroll-to-turn path and its out-of-window toast
- `packages/core/src/shared/types/messages/workshop/session.ts`:
  `WorkshopSessionSnapshot`, `WorkshopTodoItem` (precedent for host-owned lists)
- `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts`:
  ledger precedent
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`:
  strict codec
- `packages/core/src/application/services/workshop/WorkshopSessionBranch.ts`
- `packages/core/src/application/services/workshop/export/`: transcript projection
- `docs/adr/2026-09-30-workshop-rewind-and-branch.md`

## Completion Criteria

- The writer can bookmark and un-bookmark an eligible bubble, and rename a
  bookmark.
- Tab 2 lists bookmarks in thread order. Clicking one focuses the bubble, or
  opens it in the reader when it's outside the reload window.
- Bookmarks persist with the session, are pruned by Rewind, are kept up to the
  cut by Branch, and are cleared by New. Each of these has a test.
- The transcript projection makes an explicit, tested bookmark decision.
- The persistence follows the shared codec decision, with fixture tests for
  sessions that have no bookmarks.
- No bookmark data reaches a persona's prompt.
