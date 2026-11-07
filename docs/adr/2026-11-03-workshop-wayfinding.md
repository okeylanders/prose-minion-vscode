# ADR 2026-11-03: Workshop Wayfinding

**Status:** Accepted (2026-11-05), when Okey approved merging the epic to `main`. It was proposed on 2026-11-03. The writer amended D1 and confirmed D9 on 2026-11-03 ([amendment](#amendment-2026-11-03-one-badge-rule-and-d9-confirmed)), and amended D8 and D10 on 2026-11-04 ([amendment](#amendment-2026-11-04-the-model-in-the-bubble-header)).
**Date:** 2026-11-03
**Epic:** [Workshop Wayfinding](../../.todo/archive/epics/epic-workshop-wayfinding-2026-11-03/README.md)
**Design:** [`docs/design/workshop-wayfinding/`](../design/workshop-wayfinding/README.md), a snapshot of the planning canvas
**Extends:** [ADR 2026-07-30: Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md); [ADR 2026-09-30: Workshop Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md); [ADR 2026-10-05: Workshop Transcript Export](2026-10-05-workshop-transcript-export.md); [ADR 2026-10-19: Lightbox](2026-10-19-lightbox-inspiration-board.md) (D2, the shared full-tab shell)
**Realizes:** [Two-Tab Rail](../../.todo/archive/features/feature-workshop-rail-tabs/README.md), [Read-In Material](../../.todo/archive/features/feature-workshop-rail-read-in/README.md), [Thread Bookmarks](../../.todo/archive/features/feature-workshop-thread-bookmarks/README.md), [Model Slices](../../.todo/archive/features/feature-workshop-model-slices/README.md)

## Context

A long Workshop session is hard to find your way around. Four gaps:

1. **The rail is one tall column** of four blocks: Excerpt, Context, Tools, To-dos.
   It has no room for the two lists below without turning into a scroll.
2. **What a persona read on its own is nearly invisible.** The per-participant
   "In context" manifest (`ContextSourceEntry`) records every file, report,
   dictionary entry, and saved session a persona fetched. Today it shows only in
   the context gauge's popover, and nothing in it can be opened.
3. **Replies that matter get buried.** Copy and Save take a bubble out of the
   thread, but nothing marks one in place.
4. **Nothing records which model wrote which reply.** The writer can switch the
   assistant model mid-session. The time of day gets a divider; a model change
   gets nothing.

These facts in the current code shape the design:

- **The rail is a shared shell region.** `FullTabShell` renders the leading
  `FullTabRail` for both the Workshop and the Lightbox. What fills it belongs
  to the tab (ADR 2026-10-19 D2). The shell also offers an optional trailing
  `aside`.
- **The composer already covers the rail's Tools block.** Its tool button opens
  the full tools modal and works with or without an excerpt. The rail block is
  gated behind one.
- **The manifest is persisted and strictly validated.** `assertContextSource`
  rejects unknown keys. Its `artifactId` names message attachments (`ta-N`), not
  the capability card that fetched a row, so no row can find its card today.
- **The webview can read only attached files.** `WORKSHOP_CONTEXT_ATTACHMENT_CONTENT`
  and `WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE` take an attachment id. A file a
  persona read with `resource.read` has none.
- **The snapshot is a window.** It carries only the most recent turns
  (`truncatedTurns` counts the rest). To-do "show source" already shows a toast
  for a source outside it.
- **The served model is already measured.** `OpenRouterClient` reports
  `InferenceRequestObservation.modelId` per request, and `AgentRunEngine` sees
  every observation in a run. Dictionary history already records the
  provider-reported models as `modelIds` (PR #144 F-03).
- **The session codec is strict.** `exactKeys` throws on any unknown field, so a
  build that predates a field refuses a session that has it (ADR 2026-07-30).

## Decision

### D1. The rail has two tabs, Material and Notes, and Tools leave it

The Workshop's rail content becomes a `WorkshopRail` component with file-style
tabs at the top:

| Tab | Holds |
|---|---|
| **Material** | Excerpt, Context, Read in (D2) |
| **Notes** | To-dos, Bookmarks (D5) |

- The rail's Tools block and its rail-only gating are deleted. The composer's
  tool button and the empty-state quick starts stay. This supersedes the
  Direction B prototype's rail tools (`pm-direction-b.js` `railTools`).
- The tabs live inside the Workshop's rail content. `FullTabRail` and
  `FullTabShell` don't change, and the Lightbox rail is unaffected.
- The last-selected tab is a per-viewer preference kept in webview persisted
  state through `usePersistence`. It never enters the session file.
- An inactive tab shows a count badge for items that land in it while it is
  hidden: a to-do, a bookmark, a read-in row. Whoever added the item, selecting
  the tab clears the badge. No tab ever switches itself, and nothing toasts.
  (Amended 2026-11-03; see the amendment below.)
- Any entry point that targets a rail panel selects that panel's tab first.
- Tab state lives in a presentation controller (`useWorkshopRailTabs`) under
  `hooks/domain/workshop/controllers/`, with the tripartite interface.

### D2. Read in lists what the chat target fetched; it records and never controls

The Material tab gains a **Read in** block. It shows the chat target's manifest
rows that a writer didn't attach: origin `host` or `tool`, kind `resource`,
`tool-evidence`, `dictionary`, or `transcript`. It names the participant ("Read
in by Jill"), the same way the context gauge does. Superseded (`stale`) rows stay
visible, dashed and labeled.

- One pure partition function splits manifest rows into writer material and
  read-in material. The rail block and the gauge's popover both use it.
- There is no remove action. A persona can't un-read a file, so removing a row
  would misreport what it has seen.

### D3. Each row kind has exactly one open action, chosen in an exhaustive switch

`readInOpenAction(entry)` returns `reader`, `jump`, or `none`, from a `switch`
over `ContextSourceKind` with a `never` default. A new kind won't compile until
someone decides what opening it means.

| Kind | Action |
|---|---|
| `resource` | `reader`: the file, through D4 |
| `tool-evidence`, `dictionary`, `transcript` | `jump` to the capability card that fetched it, once the row records its card (D4); until then, `none` |

### D4. The reader shows the file as it is now, and says so

- **Surface:** the existing `WorkshopTextSheet`, in a new read-only `read-in`
  mode, plus an **Open beside** button that opens the file in the editor column
  beside the Workshop through `ShellService`. A reader docked in the shell's
  trailing `aside` is out of scope.
- **Access:** two new messages carry `{ group, path }` from a manifest row. One
  reads the content and one opens the file beside the Workshop. The host
  resolves the pair only through the configured project-resource resolver that
  `resource.read` uses, refuses anything outside it, and never accepts an
  absolute path from the webview.
- **Provenance on the row:** a manifest row gains three optional fields:
  - `turnId`: the capability card turn that delivered it.
  - `lineRange`: `{ start, end }` when `resource.read` read a range.
  - `sourceFingerprint`: SHA-256 of the file's bytes when it was read.

  The fingerprint stays host-private, as the excerpt's does: the webview
  projection omits it, and the host answers a content request with
  `changedSinceRead: boolean`.
- **Honesty:** the reader marks the lines the persona read, and says when the
  file has changed since. It never claims to show the persona's copy. The body
  the persona received is never stored again, because storing it would grow
  session files and recovering it would mean parsing provider history, which
  ADR 2026-09-30 forbids.

### D5. Bookmarks are host-owned session state the writer controls

> **Superseded in part by [ADR 2026-11-05](2026-11-05-workshop-bookmark-recall.md)** (D1, D8): bookmarks stay host-owned and the writer's, but they are no longer presentation only for saved sessions. Personas read them on request, and the Bookmarks screen lists them.

The writer can bookmark a bubble and come back to it. "Pin" already means the
excerpt in code and UI, so these are **bookmarks** (`WorkshopTurnBookmark`).

- **Eligible:** agent replies, writer messages, tool reports, and capability
  cards. Dividers and markers are not eligible. The host checks eligibility.
- **Shape:** the session holds
  `bookmarks: { id, turnId, label?, createdAt }[]`. The ledger follows
  `WorkshopTodoLedger`: host-generated ids, defensive copies, one toggle per
  turn, and a validated rename (trimmed, one line, bounded length). Clearing a
  label restores the default.
- **Labels:** the default label is deterministic: the participant's label plus
  the bubble's first line, truncated. It's never model-generated.
- **Snapshot:** the snapshot carries display-safe bookmark summaries in thread
  order, with their resolved label and participant, including bookmarks whose
  bubble is outside the window.
- **Presentation only:** bookmarks never enter a persona's prompt, a room frame,
  or provider history.

### D6. Bookmarks follow whole-room operations, and old ones open in the reader

| Operation | Bookmarks |
|---|---|
| New | Cleared |
| Open | Loaded with the session |
| Rewind | Pruned for cut turns inside `rewindWorkshopSession`, the one transform that cuts a room |
| Branch | Kept up to the cut; the source file is never written |

A bookmark whose bubble is outside the snapshot window opens in the reader. The
host reads that one turn from the full ledger the way export does
(`readRoomLedger()`): read-only, outside the mutation gate, waiting out room
replacement. It renders the turn only through `projectWorkshopTranscriptTurn`,
so no host-private body leaks. To-do "show source" uses the same path in place
of its toast.

### D7. Every reply records the model that answered it

Assistant turns produced by a provider call gain:

```ts
interface WorkshopTurnModel {
  /** The model scope that served the turn; 'assistant' for room replies today. */
  scope: ModelScope;
  /** The scope's selection, captured when the request started. */
  requestedModelId: string;
  /** Distinct provider-reported models across the turn's requests, in order. */
  servedModelIds: string[];
}
// WorkshopTurn.model?: WorkshopTurnModel
```

- It's stamped on host and guest replies, tool-sidecar replies, tool reports,
  and syntheses.
  - Dictionary lookups a persona runs, with scope `dictionary`.
- `requestedModelId` is captured at request start, never read from settings
  later. `servedModelIds` collects `InferenceRequestObservation.modelId` across
  the run, matching Dictionary history's `modelIds`, and is empty when the
  provider reported none.
- A failed or cancelled run commits no reply, so it records no stamp.
- Stamps never enter prompts or room frames.

### D8. Model slices are derived from stamps, never stored

One pure function in `packages/core/src/shared/`,
`deriveWorkshopModelSlices(turns, options)`, decides where slices go. Both the
thread and `projectWorkshopTranscript` use it.

- A slice appears where a reply's `requestedModelId` differs from the previous
  stamped reply's **in the same scope**. It sits before the writer turn that
  prompted that reply, or before the reply itself when no writer turn did.
- A turn without a stamp is unknown, not a switch, so old sessions show no
  slices.
- The snapshot carries the last stamped model per scope from before the window,
  so the window's first reply can still show a slice.
- Copy: "Model · Claude Sonnet 5 → GPT-5", using display names from the model
  options at render time, with the raw id as the fallback. It uses the session
  divider treatment.
- When served and requested differ, the bubble shows a meta note ("Auto router ·
  served by Claude Sonnet 5"), not a slice. The bubble's participant label
  carries the model ids in its title.

### D9. Compatibility: additive fields, forward-only

New fields: the row fields from D4, the session's `bookmarks` from D5, and the
turn's `model` from D7.

- **Additive, no schema bump.** Every one is optional on read, so older sessions
  load unchanged. Per ADR 2026-07-30, that means no `schemaVersion` bump.
- **Writes add nothing they don't need.** The session writes `bookmarks` only
  when it holds at least one, and a row writes provenance only when it has some.
- **Older builds won't open new sessions.** Builds up to v2.12 will refuse a
  session that holds any of these fields. Model stamps land on every new reply,
  so in practice that means every session a newer build saves. We accept this
  forward-only compatibility, as ADR 2026-07-30 did for provider cache counts.
- **Why not a tolerant extension slot.** A reserved slot that later releases
  write into and older ones keep through a save can only help readers that ship
  it, and v2.12 readers don't have it. It is recorded as
  [tech debt](../../.todo/tech-debt/2026-11-03-workshop-session-codec-downgrade-tolerance.md)
  for releases after this one.

**Writer confirmation:** confirmed by the writer on 2026-11-03, before Slice 3
(the first slice that writes a new persisted field).

### D10. Export carries bookmarks and models; recall and prompts don't

> **Superseded in part by [ADR 2026-11-05](2026-11-05-workshop-bookmark-recall.md)** (D1, D2, D5): the recall bullet. Recall carries bookmarks on request through `transcript.bookmarks`, and `transcript.read` marks bookmarked turns. Nothing about bookmarks enters a prompt unasked.

- **JSON export:** turns gain `bookmarked` and `model`. The fields are
  additive, so `formatVersion` stays 1, per ADR 2026-10-05's rule (bump only when
  a field changes meaning or disappears).
- **Markdown and HTML export:** both render model slices as dividers and mark
  bookmarked turns. The HTML export's mirrored thread CSS and its mirror test
  cover the new divider and marker.
- **Recall:** `projectWorkshopTranscriptTurn` may carry the fields, but recall's
  renderers don't show them to a persona. A test pins that.
- **Prompts:** no bookmark or stamp ever enters a prompt.

## Consequences

- The rail stops growing taller: new lists go in a tab.
- A writer can see, open, and trace what a persona read, without the product
  claiming more than it knows.
- Long sessions get a table of contents the writer controls.
- The thread shows where a model change happened, and export keeps it.
- Sessions saved after this ships can't be opened by v2.12 or earlier.
- `WorkshopApp.tsx` sheds the rail, and the rail gains a component of its own.

## Amendment 2026-11-03: one badge rule, and D9 confirmed

- **D1's badge.** As first written, D1 badged only items the host added, and
  toasted items the writer made. Building Slice 1 showed that every to-do comes
  from the writer adding a finding (`WorkshopSessionService.addTodoFromFinding`
  is the only producer), so the host-only rule would badge nothing. The canvas
  the writer approved badges whatever lands in a hidden tab, bookmarks included.
  D1 now says that, and nothing toasts. Read-in rows (Slice 2) badge the
  Material tab by the same rule.
- **D9.** The writer accepted forward-only compatibility before Slice 3.

## Amendment 2026-11-04: the model in the bubble header

The writer decided this on 2026-11-04, at the Slice 8 decision review. It is
built in [Slice 7b](../../.todo/archive/epics/epic-workshop-wayfinding-2026-11-03/slice-7b-model-in-header.md).

**D8: every stamped reply names its model in its header.** The bubble's
participant label is followed by the model that served the reply.

- **The form.** "Jill · Opus 5.5", with the thread's middle dot.
- **When a different model served it.** If the provider named models and
  none of them is the one requested, the label names them and adds
  "via {requested}", as in "Jill · Claude Sonnet 5 via Auto router". If the
  requested model served among others, the label names them all, in order,
  without "via": "Jill · Opus 5.5, Sonnet 5". This replaces the under-body
  served-by note, which is retired, so there is one place to look. The
  [slice doc](../../.todo/archive/epics/epic-workshop-wayfinding-2026-11-03/slice-7b-model-in-header.md#the-rule)
  holds the full table.
- **Capability cards.** A stamped dictionary or analysis card names its model
  in its thread header by the same rule; in Markdown and HTML export, where it
  is a one-line event, the line ends with the same text.
- **When the provider named no model.** The label names the requested model.
- **When there's no stamp.** An unstamped turn names no model: a writer
  turn, a host-written fallback, or a turn saved before this epic.
- **Look.** The model is muted and smaller than the participant's name. In
  a narrow column it is cut short first, never the name. The label's
  tooltip keeps the raw ids.
- **Slices stay.** The header says who wrote this reply. The slice says
  when the requested model changed.

**D10: export headers follow the same rule.** Markdown and HTML export turn
headers name the model in the same form, built by the same shared function
as the thread. JSON is unchanged: it already carries each turn's `model`.
Recall and prompts still never carry a model.

## Out of Scope (follow-ups)

- A reader docked in the shell's trailing `aside` (option C in the feature note).
- Showing the persona's exact delivered copy of a file.
- Closing recalled to-dos, and showing personas the writer's bookmarks.
- A codec slot that tolerates downgrades (tech debt above).
- A frame telling a persona that earlier replies came from another model.
- Thread pagination. Out-of-window bookmarks and to-do sources use the reader
  until pagination exists.
