# Feature: Read-In Material in the Workshop Rail

**Date Identified**: 2026-10-27
**Source**: Brainstorm with Okey (Workshop sidebar batch)
**Status**: Idea
**Priority**: Medium

> Lives in tab 1 of the [two-tab rail](../feature-workshop-rail-tabs/README.md).
> Its reader is shared with [Thread Bookmarks](../feature-workshop-thread-bookmarks/README.md).

## Problem

The rail's Context block lists what the **writer** attached. It doesn't show
what a persona fetched on its own: files read with `resource.read`, analysis
reports it ran, dictionary entries it looked up, and saved sessions it read
through recall.

That material is visible today only in the "In context" popover on the context
gauge above the composer (`ContextBudget` → `InContextSources`). The popover
is fine for a quick look, but it's not a place to work. You can't open a row
and read what the persona read.

## What Already Exists

- **The manifest.** `ContextSourceEntry` (`shared/types/messages/inferenceContext.ts`)
  is a per-participant record of what each participant carries. Each row has
  `kind` (`pin`, `attachment`, `message-attachment`, `resource`,
  `tool-evidence`, `dictionary`, `transcript`), `origin` (`writer` / `host` /
  `tool`), `label`, size, `stale`, `deliveredAt`, an optional
  `configuredResource { group, path }`, and an optional `artifactId`.
- **Where rows come from.** `WorkshopPersonaCapability.toDeliveredSources`
  decides which capability results become rows. Catalog and search listings
  deliberately produce none.
- **Scope of the snapshot.** The snapshot carries the manifest for the
  *active chat target* only (`contextBudget.sources`).
- **Persistence.** Rows are saved with the session and validated by the strict
  codec (`assertContextSource` in `WorkshopSessionStateV1Shape.ts`).
- **The manifest is a record, not a control.** Its contract comment says:
  "The manifest observes — it never gates, edits, or trims prompt content."
- **Reading surfaces.** `WorkshopTextSheet` already has a read mode for
  project files (`context-file`), with on-demand body loading and an "Open in
  editor" button. `ShellService` already opens a document in the column beside
  the Workshop (`VsCodeShellService.besideColumn()`).

## Proposal

### The list

Add a "Read in" block under Context in tab 1. It shows the manifest rows that
are **not** writer attachments: origin `host` or `tool`, with kind `resource`,
`tool-evidence`, `dictionary`, or `transcript`. It shows the current chat
target's rows and names that participant ("Read in by Ada"), the same way the
gauge names whose context it measures. Stale rows stay visible but dimmed, as
they are in the popover.

The rail and the popover should share one pure, tested selector, so the two
lists can't disagree.

There's no remove button. A persona can't un-read something, so removing the
row would misreport what that persona has seen.

### Opening a row: one closed switch

| Row kind | Open action |
|---|---|
| `resource` | Reader shows the file, through its `configuredResource` |
| `tool-evidence` | Scroll to the analysis card in the thread, using the to-do "show source" path |
| `dictionary` | Reader shows the entry from Dictionary lookup history (v2.11) when it's there. If it isn't, offer a lookup but never run one automatically, because lookups cost money |
| `transcript` | Read-only preview of the saved session. Never replace the room |

Write this as a `switch` with a `never` default, so a new `ContextSourceKind`
won't compile until someone decides what opening it means.

### The reader: three options

| Option | Pros | Cons |
|---|---|---|
| **A.** `WorkshopTextSheet` read mode (modal) | Already built; cheapest | Covers the thread while you read |
| **B.** "Open beside": the real editor in the next column, via `ShellService` | Real reading tools (search, scroll); the port exists | Leaves the Workshop surface |
| **C.** A reader pane docked inside the Workshop (thread beside reader) | Closest to "a side view" | Most layout work; the Workshop tab is often narrow |

**Lean:** ship A with an "Open beside" button (B). Build C only if writers
keep the sheet open while they chat. C would also be the natural place to show
bookmarked bubbles that fall outside the reload window.

## What the Reader Shows vs. What the Persona Saw

Be honest about the difference:

- **Time.** The reader shows the file as it is now. The persona saw it at
  `deliveredAt`. If the file has changed since then, say so, for example "Read
  in at 3:12 PM · this file has changed since". Rows don't record a
  fingerprint today. Excerpts already carry `sourceFingerprint` (SHA-256), so
  copy that pattern.
- **Range.** `resource.read` accepts a line range (`WorkshopCapabilityXmlCodec`
  parses it), but the row doesn't record the range. Opening a partial read as
  the whole file overstates what the persona saw. Record the range on the row,
  and scroll to it or highlight it.
- **The exact body** isn't available. Getting it would mean keeping a
  host-private copy, which grows session files (see
  `.todo/tech-debt/2026-07-24-workshop-session-storage-bounds.md`), or parsing
  retained provider history, which the Rewind ADR forbids. Defer it.

The fingerprint and range fields go on a persisted, strictly validated shape,
so they need the same compatibility decision as model stamps. See
[Model Slices → forward compatibility](../feature-workshop-model-slices/README.md#forward-compatibility-the-hard-part).
The v1 list doesn't need those fields. Only the honest reader does.

## Open Questions

- **Whose context:** the chat target only (lean), or the whole room with
  participant badges? A room-wide list suggests every participant has the
  material, and they don't.
- **Promote to context:** should the writer be able to turn a read-in file into
  a writer attachment ("keep this in context")? It's a context change, so it
  goes through the normal attachment path and bumps `contextRevision`.
- **Catalog and search results:** they produce no rows today, by design. Should
  the list mention them ("searched project resources for 'lantern'") as
  non-openable history, or leave them out?
- **Grouping:** chronological, or grouped by kind? With fewer than about ten
  rows, chronological reads better.

## Related Files

- `packages/core/src/shared/types/messages/inferenceContext.ts`: `ContextSourceEntry`
- `packages/core/src/presentation/webview/components/shared/ContextBudget.tsx`:
  `InContextSources`, the current popover
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`:
  `toDeliveredSources`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`:
  `resource.read` line ranges
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`:
  `assertContextSource`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopContextSheet.ts`:
  `WorkshopTextSheetMode`
- `apps/vscode-extension/src/platform/vscode/VsCodeShellService.ts`: `besideColumn()`
- `packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts`

## Completion Criteria

- Tab 1 lists the chat target's read-in rows, names that participant, and
  matches the popover through a shared selector.
- Every row kind has an explicit open action, enforced by an exhaustive switch.
- A read-in file opens in the reader with "Open beside", and the reader says
  so when it shows the file as it is now rather than as it was read.
- If range and fingerprint fields land, they follow the codec decision, and
  fixture tests cover old rows that don't have them.
- No `vscode` imports in core. The reader reaches files only through ports.
