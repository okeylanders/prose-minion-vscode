# docs/design/

Committed copy of the Claude Design (claude.ai/design) source for the Prose
Minion design refresh. This folder mirrors the design project's file tree
one-to-one, so every `.html` here opens directly in a browser with working
styles, scripts, and assets — no build step.

## Source

- **Project:** "Prose Minion" — claude.ai/design project
  `1219f905-e11d-4b1a-9fc9-f72634b10f4c` (owner: Okey Landers).
- **Pulled via:** the `claude_design` MCP (`DesignSync` tool) + `/design-login`,
  2026-07-03; Workshop intake + context-bar comps re-pulled 2026-07-17; Persona
  Schematic pulled 2026-07-21.
- **Sync policy:** this folder is a snapshot, kept in sync by re-pulling from
  the design project (never hand-edit these files to change the design — edit
  in Claude Design, then re-pull). Local hand-edits are allowed only for
  repo-housekeeping (this README).

## The designs

| File | What it is | Status |
|------|------------|--------|
| `Prose Minion - Assistant Tab.html` | **Interactive prototype** of the full-tab Assistant, Direction B ("Split & pinned"): pinned excerpt + context rail on the left, chat thread with contextual quick-actions on the right, model dropdown, tools modal, toasts, localStorage-persisted thread. | **Approved direction — to implement** |
| `Prose Minion - Design Refresh.html` | The presentation canvas: Frame Minion design language applied to the sidebar chrome + all four tabs, the Writing Tools picker modal, and static comps of all three full-tab Assistant directions (A thread / B split / C branch board). | Reference / catalog |
| `Prose Minion - Model Browser.html` | Sidebar-width model picker that replaces the model dropdown: search, By Provider / By Family pivots, filter chips, price + ctx badges, selected/offline states. | Designed, not implemented |
| `Prose Minion - Intake Widgets.html` | **Interactive prototype** of the Sprint 12 excerpt & context intake: excerpt card (two-button empty state, verified paste provenance, locked-state `Update text…` / `Re-read from file`), context attachment pills + aggregate budget meter, and the category-grouped Context Selector modal with explore escape hatch. Self-contained (no `pm-*` support files). | **Approved — Sprint 12 source of truth** |
| `Prose Minion - Context Bar v2.html` | Context Bar with the "In context" sources panel (per-participant manifest rows with stale dimming) and a Memory row (Compress / Compact strategy menus). Sprint 12 supplies the sources data; Compress/Compact is the post-launch compaction ADR's scope. Self-contained. | **Approved — Sprint 12 renders `sources`** |
| `Prose Minion - Context Bar.html` | Context Bar v1 — the per-participant context gauge as shipped by Sprint 11B (expandable details grid, unmeasured state, amber/red thresholds). Kept for reference; superseded by v2. | Implemented (11B) / superseded |
| `Prose Minion - Persona Schematic.html` | **Interactive prototype** of the Workshop persona browser → persona configuration schematic: a persona grid ("More info" opens a read-only schematic in the same modal shell) and a nine-panel schematic (Identity hub, Trait tensions, Turn-taking signature, Personal aperture, Verbal palette, Lexical gravity, Communication gradients, Trait pressure, Signature floor) with clickable hub navigation. Demoed with Margot (maximal spec) and Penny (near-empty spec, reads as tuned not broken); Jill/Quinn shown as spec-pending stub cards. Every field is laid out as a dashed, not-yet-wired `edit` affordance for a future persona config utility. Self-contained (no `pm-*` support files). | Designed, not implemented |

## Support files

- `pm-mock.css` — **the design language.** Tokens (warm-brown palette, coral
  accent, radii, type stacks) + shared components (header, balance widget, tab
  cards, buttons, segmented controls, chips, pills, result panel, tables) +
  presentation-canvas styles. Start here when porting styles into the webview.
- `pm-fulltab.css` — full-tab Assistant styles: chat thread, variation cards,
  quick-action bar, composer, split layout, branch board, tools modal.
- `pm-direction-b.css` — Direction B standalone layout (full-viewport editor
  tab) + interaction styles (model menu, typing indicator, reveal animation,
  toast, reset button).
- `pm-model-browser.css` — Model Browser panel styles.
- `icons.js` — Lucide-style inline SVG icon factory (`ICONS.*`).
- `pm-frames-sidebar.js` — shared chrome (`BAL` balance widget, `sidebarChrome`)
  + the four reskinned sidebar tab bodies. **Load-bearing for the other two
  frames files** (defines `BAL`).
- `pm-frames-fulltab.js` — `TOOLS` catalog (the 14 writing tools), tools modal,
  and the three static full-tab directions.
- `pm-direction-b.js` — the interactive prototype logic for the Assistant Tab:
  per-tool analysis/action/variation content (`ASSIST`), streaming simulation,
  quick-action routing, tools modal, model menu, toasts, localStorage session.
- `assets/` — logo images. **Copied from
  [`apps/vscode-extension/assets/`](../../apps/vscode-extension/assets/)**
  (same files the extension ships) rather than pulled from the design project,
  to avoid duplicating binaries through the API.

## Not pulled

The design project also contains reference-image folders that are inputs to the
design, not outputs of it — they are not needed to render any `.html` here:

- `uploads/` — screenshots of the current extension (2026-06-16 set + frame
  minion references) the design was drawn from. The repo's own
  [`screenshots/`](../../screenshots/) folder is the canonical home for app
  screenshots.
- `screenshots/mb-panel.png`, `screenshots/mb-bottom.png` — renders of the
  Model Browser design.
- `.thumbnail`, `assets/pixel-minion-icon.png` duplicates of shipped assets.

Re-pull them with `DesignSync get_file` if ever needed.

## Viewing

```bash
open "docs/design/Prose Minion - Assistant Tab.html"      # interactive prototype
open "docs/design/Prose Minion - Design Refresh.html"     # full design catalog
open "docs/design/Prose Minion - Model Browser.html"      # model picker
```

## Implementation notes (Assistant Tab)

The Assistant Tab prototype implies real product surface beyond a reskin:

1. **A full editor-tab webview** (`vscode.window.createWebviewPanel`) — today
   the extension only registers the sidebar webview view. New host surface,
   new composition-root wiring.
2. **A conversational session model** — thread of user/assistant turns with
   per-tool context, session reset, persistence. Today's Assistant is
   one-shot request → result.
3. **Contextual quick actions** — per-tool follow-up chips (`ASSIST[*].actions`)
   that feed back into the conversation.
4. **Reusable pieces already in the repo:** the 14 tools map to existing
   system-prompt dirs; the balance widget maps to `useAccountBalance` /
   `AccountBalanceHandler`; model select maps to `useModelsSettings`.

Per repo convention this is ADR-first work — see `docs/adr/` before building.
