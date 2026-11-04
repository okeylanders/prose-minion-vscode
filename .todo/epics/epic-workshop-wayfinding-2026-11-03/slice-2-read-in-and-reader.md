# Slice 2: Read In and the Reader

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D1 (the Material badge), D2, D3, and D4 (surface and access)
**Design:** `Main.dc.html` (the Read in block) and `Reader.dc.html` in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** Built (`a88ef63`, `e1111b2`; review fixes `7a153fd`, `1687b0a`, `3c184c2`, `fe0d47d`), on `epic/workshop-wayfinding-slice-2-read-in`; PR #186 in review

## Outcome

The Material tab shows a **Read in** block under Context. It lists what the
current chat target fetched on its own, and names that participant. A
`resource` row opens a read-only reader sheet with the file's current content
and an **Open beside** button. Every other row kind shows but doesn't open yet.

The only contract change is two new message pairs. No persisted field changes.

## Since Slice 1

- `WorkshopRail` keeps both tab panels mounted and hides the inactive one
  (PR #184 F-01). The Read in block mounts inside the Material panel, and
  whatever local state it holds survives a tab switch.
- `useWorkshopRailTabs` badges only Notes today (`unseenNotesCount`). The
  Material badge below generalizes it per tab; keep the room re-baseline
  (`roomKey`) and the rule that nothing switches a tab.

## Build

### Webview

- **Partition (pure).** A module such as
  `presentation/webview/utils/workshop/contextSources.ts` exports
  `partitionContextSources(entries)` → `{ writerMaterial, readIn }`.
  - `readIn` holds rows whose `origin` is `host` or `tool` and whose `kind` is
    `resource`, `tool-evidence`, `dictionary`, or `transcript`, in delivery
    order.
  - `ContextBudget`'s "In context" popover uses the same module (for example,
    to group or order its rows), so the two can't disagree. Keep the popover's
    visible behavior unless a test proves the change.
- **Open action (pure).** `readInOpenAction(entry): { kind: 'reader' } |
  { kind: 'jump'; turnId } | { kind: 'none' }`, as a `switch` over
  `ContextSourceKind` with a `never` default.
  - This slice returns `reader` for `resource` rows with a `configuredResource`,
    and `none` for everything else, including a `resource` row without one.
  - Slice 3 adds `jump`.
- **`components/workshop/WorkshopReadInPanel.tsx`** (new).
  - The heading reads "Read in", plus "by {participant label}" with that
    participant's identity color.
  - Each row has a kind icon, a label (monospace for paths), and a meta line
    (kind, delivery time).
  - Stale rows get a dashed border and a "superseded" tag.
  - Rows with an action are buttons with an `aria-label` that names the
    action. Rows without one are plain list items.
  - With no rows, show one muted line: "When {persona} reads a file or runs a
    tool, it shows here."
  - Mount it in the Material panel of `WorkshopRail`, fed from
    `workshop.contextBudget?.sources` and the chat-target identity already
    passed to `ContextBudget`.
- **Material badge (D1, amended).** Read-in rows that arrive while Material is
  hidden badge the Material tab through `useWorkshopRailTabs`, by the same
  seen-set rule Slice 1 uses for to-dos.
  - A row's identity is what the manifest gives it (kind, label, origin,
    `deliveredAt`).
  - A change of chat target re-baselines, so switching participants never
    badges.
- **Reader sheet mode.** Add `{ kind: 'read-in'; label; group; path;
  participantLabel; deliveredAt }` to `WorkshopTextSheetMode`.
  - The sheet is read-only, so it has no Apply.
  - It shows "Read in by {participant}" with the delivery time and the content.
  - It has Close and **Open beside**.
  - Loading and error states follow the attachment-content sheet.

### Messages (in the Workshop context message family)

- **`WORKSHOP_REQUEST_READ_IN_RESOURCE`** `{ group, path }` →
  **`WORKSHOP_READ_IN_RESOURCE_CONTENT`**
  `{ group, path, content?, truncated?, error?, canOpenInEditor }`.
- **`WORKSHOP_OPEN_READ_IN_RESOURCE`** `{ group, path }`. Its failure reports
  through the existing error or status path its neighbors use.
- Add both pairs to `MessageType` (snake_case values) and to the message
  unions, and export them from the `@messages` barrel.

### Host

- The routes join the Workshop route owner that already serves context
  attachment content and open-file. Check `WorkshopContextHandler` first.
  Register them in `WorkshopRouteContracts` and the slice composition the way
  their siblings are, and update any architecture route lists the tests
  enforce.
- **Resolution:** resolve `{ group, path }` only through the same
  configured-resource resolution `WorkshopResourceCapability` uses for
  `resource.read`, including its path-containment checks. Refuse:
  - a group that isn't configured,
  - a path outside it,
  - an absolute path,
  - `..` traversal.

  A refusal never echoes file content and never logs the writer's text.
- **Content** is bounded by the same read cap as `resource.read`. Truncation is
  reported, not hidden.
- **Open beside** goes through `ShellService`, the same path the existing
  attachment open-file route uses.

## Tests

- **Partition:** rows split by origin and kind; order is kept; stale rows stay.
- **`readInOpenAction`:**
  - One case per kind.
  - A type-level test that the switch is exhaustive (a `never` assertion), the
    way existing capability-family switches test it.
- **`WorkshopReadInPanel`:**
  - Rows render with their labels; the participant is named; stale rows are
    tagged.
  - Action rows are buttons; no-action rows aren't.
  - The empty state shows.
- **Sheet:** the `read-in` mode renders content, loading, error, and
  truncation; it has no Apply; Open beside posts the right message.
- **Host route:**
  - A configured group and path return content.
  - An unconfigured group, a traversal, and an absolute path are each refused.
  - Truncation is flagged.
  - Open beside calls the shell port.

## Out of Scope

- `turnId`, `lineRange`, and `sourceFingerprint` on rows, jump-to-card, and
  "changed since" (Slice 3).
- Opening dictionary or transcript rows by any other route.

## Completion Criteria

- [x] The Read in block lists the chat target's fetched rows and names the
      participant. It changes when the chat target changes.
      (`WorkshopReadInPanel.test.tsx`, `WorkshopApp.readIn.test.tsx`)
- [x] Resource rows open in the read-only sheet, and Open beside opens the file
      beside the Workshop. (`WorkshopTextSheet.test.tsx`,
      `useWorkshopContextSheet.test.ts`, `useWorkshopReadIn.test.ts`,
      `WorkshopReadInRoutes.test.ts`, `WorkshopApp.readIn.test.tsx`; the
      editor column itself is the Slice 8 live pass)
- [x] The host serves only configured resources, and refusals are tested.
      (`WorkshopReadInRoutes.test.ts`)
- [x] The popover and the rail use one partition. (`contextSources.test.ts`,
      `ContextBudget.test.tsx`)
- [x] Read-in rows that arrive while Material is hidden badge it; a change of
      chat target doesn't. (`useWorkshopRailTabs.test.ts`,
      `WorkshopRail.test.tsx`, `WorkshopApp.readIn.test.tsx`)
- [x] The epic's per-slice verification passes. Counts are recorded (README
      progress notes).
