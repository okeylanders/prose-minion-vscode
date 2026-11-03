# Slice 1: Rail Tabs

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D1
**Design:** `Main.dc.html` and `Today.dc.html` in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** Built (`94d6b86`, `e188ea9`, cherry-picked from `da7f28f`, `4a25d5c`); the review fix makes the badge follow amended D1. In review as a PR into the epic.

## Outcome

The Workshop's rail has two file-style tabs:

- **Material:** Excerpt, then Context.
- **Notes:** To-dos.

The Tools block is gone. When a to-do lands while Notes is hidden, whoever
added it, the Notes tab shows a "N new" badge (D1, amended 2026-11-03). Selecting Notes clears it, and no tab ever
switches itself. The last-selected tab survives a webview reload.

This slice changes no contract: no message, no session field, no host code.

## Today

- `WorkshopApp.tsx` builds `railContent` inline (`ExcerptPanel`,
  `ContextPanel`, the Tools block, `WorkshopTodoList`) and hands it to
  `FullTabShell`'s `rail` region (`FullTabRail`, shared with the Lightbox).
- The Tools block uses `RAIL_TOOL_IDS` / `RAIL_TOOLS`, `toolsGatedByExcerpt`,
  `announceToolGate`, `toolsEnabled`, and `openToolsModal` for its last row.
- `WORKSHOP_TOOLS_GATED_REASON` is exported from `WorkshopComposer.tsx` and used
  elsewhere. Keep it.
- `EMPTY_STATE_TOOL_IDS` / `EMPTY_STATE_TOOLS` drive the empty-thread quick
  starts. Keep them, and move the comment that ties them to the Direction B
  prototype so it no longer mentions rail tools.

## Build

### Components

- **`components/workshop/WorkshopRail.tsx`** (new). Presentational: props in,
  callbacks out.
  - Renders the tab strip, then the active panel's blocks.
  - Takes the existing panel props, grouped so the prop list stays readable
    (for example `excerpt`, `context`, and `todos` prop objects), plus the
    controller's state and actions.
  - The tab strip is a `role="tablist"` labeled "Rail sections", with two
    `role="tab"` buttons. Each tab has `aria-selected` and `aria-controls`, and
    each panel is a `role="tabpanel"` with `aria-labelledby`.
  - Keyboard: roving tabindex. Left and Right arrows move between tabs, and Home
    and End jump to the ends. Follow the WAI-ARIA tabs pattern with automatic
    activation.
  - Tab labels:
    - Material, with a count of the excerpt plus attachments.
    - Notes, with a count of open to-dos, plus the badge "N new" when the
      controller reports unseen items.
  - The badge's count goes in the tab's accessible name ("Notes, 2 new").
  - Keep the inactive panel unmounted, but keep the controller state (and any
    hook state) above it in `WorkshopApp`, so switching tabs loses nothing.
- **`WorkshopApp.tsx`.** `railContent` becomes `<WorkshopRail … />`. Delete the
  Tools block, `RAIL_TOOL_IDS`, `RAIL_TOOLS`, `announceToolGate`, and any
  variable left unused, such as `toolsGatedByExcerpt` if only the rail used it.
  Run lint to find the leftovers.

### Controller

**`hooks/domain/workshop/controllers/useWorkshopRailTabs.ts`** (new). This is a
presentation controller per `AGENTS.md`: no `useVSCodeApi`, `MessageType`, or
`postMessage`.

- **State:** `activeTab: 'material' | 'notes'`, `unseenNotesCount: number`.
- **Actions:** `selectTab(tab)`.
- **Persistence:** `{ workshopRailTab: 'material' | 'notes' }`. Compose it into
  the existing `usePersistence` call in `WorkshopApp`. Restore it from the
  initial persisted state the way sibling Workshop hooks do. An unknown stored
  value falls back to `material`.
- **Input:** the current to-do list.
  - Unseen means open, current to-dos whose id was not present when Notes
    was last visible, and that arrived while Notes was hidden, whoever added
    them (D1, amended).
  - On mount, every current id counts as seen, so a reload never badges old
    items.
  - The writer's own edits never badge.
  - Keep the seen-id set in a ref or state; don't persist it.
- Extract effect logic into named callbacks (`syncSeenTodosWhenNotesVisible`
  and similar), per the useEffect extraction pattern in `AGENTS.md`.

### Styles

- Put tab styles in the Workshop stylesheet that holds the rail blocks. Scope
  them under `[data-pm-surface="workshop"]` like their neighbors.
- Follow the canvas: a darker strip, with the active tab in the rail's color,
  a 2px accent top border, and joined to the panel below.
- For small label text, use `--pm-muted`, not `--pm-dim`. `--pm-dim` on the
  inset background is about 3.6:1 and fails 4.5:1.
- Delete the rail Tools block's styles **only** where nothing else uses them.
  `pm-ws-tool…` prefixes also appear in `WorkshopToolsModal`,
  `WorkshopTurnBubble` (`pm-ws-tool-run-divider`), the persona sheet, and the
  shared modal CSS. Check each selector before removing it.

## Tests

- **`WorkshopRail` component:**
  - The roles and the ARIA wiring.
  - Arrow, Home, and End keys move focus and selection.
  - The Material panel shows the excerpt and context; the Notes panel shows the
    to-dos.
  - The badge text and the tab's accessible name.
- **`useWorkshopRailTabs`:**
  - Restores and persists the tab, and falls back on a bad stored value.
  - A host to-do added while Notes is hidden makes the count 1. Selecting Notes
    makes it 0.
  - A to-do added while Notes is visible never badges, and neither do writer
    edits.
  - A reload with existing to-dos doesn't badge.
- **`WorkshopApp`:**
  - The rail Tools block is gone, and the composer's tool button still opens
    the tools modal.
  - Existing rail behavior still works through the tabs: excerpt actions,
    context pills, and to-do actions (including "show source").
  - Update tests that looked up rail tools.

## Out of Scope

- The Read in block (Slice 2) and the Bookmarks block (Slice 5).
- Any change to `FullTabShell`, `FullTabRail`, or the Lightbox rail.

## Completion Criteria

- [x] The rail renders Material and Notes tabs with correct roles and keyboard
      behavior. (`WorkshopRail.test.tsx`)
- [x] The Tools block and its rail-only code and styles are deleted. Every tool
      is still reachable from the composer and the empty states.
      (`WorkshopApp.railTabs.test.tsx`; the deleted selectors had no other user)
- [x] Notes badges to-dos that land while it's hidden. Selecting Notes
      clears the badge, and nothing switches tabs on its own.
      (`useWorkshopRailTabs.test.ts`, `WorkshopApp.railTabs.test.tsx`)
- [x] The last tab survives a reload, and no session field changed.
      (`useWorkshopRailTabs.test.ts`, `WorkshopApp.railTabs.test.tsx`; the diff
      touches no message, codec, or host file)
- [x] `WorkshopApp.tsx` is shorter by roughly the rail's size, and
      `WorkshopRail.tsx` and the controller are each under 500 lines.
      (1,743 → 1,671; 158 and 159 lines. The panel props moved with the rail
      but are still passed from `WorkshopApp`, so the cut is the Tools block plus
      the JSX nesting.)
- [x] The epic's per-slice verification passes. Counts are recorded in the
      epic's progress notes.
