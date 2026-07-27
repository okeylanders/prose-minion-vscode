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
  Schematic pulled 2026-07-21; **Workshop editor tab + session persistence
  pulled 2026-07-23** (Sprint 10 interaction source of truth); **Workshop tab
  re-pulled 2026-07-26** (Sprint 14 source: carded intake rail, sheet-pattern
  tools/widgets browsers, startup beta notices, standing-pins scaffold —
  new files `pm-wk-notify.js`, `pm-wk-pins.css`, `pm-wk-pins.js`);
  **notice modal re-pulled 2026-07-27** (new file
  `Prose Minion - Notice Modal.html`; `pm-wk-notify.js` + the notice block of
  `pm-wk-pins.css` rewritten for the wide screenshot format, and the
  `uploads/` screenshots it renders now committed — see below).
- **Sync policy:** this folder is a snapshot, kept in sync by re-pulling from
  the design project (never hand-edit these files to change the design — edit
  in Claude Design, then re-pull). Local hand-edits are allowed only for
  repo-housekeeping (this README).

## The designs

| File | What it is | Status |
|------|------------|--------|
| `Prose Minion - Assistant Tab.html` | **Interactive prototype** of the **Workshop editor tab** (Sprint 10 shape): full-viewport tab with the host/persona cluster, **Sessions menu** (New / Save / Open prior / Recent), model picker, pinned excerpt + context-budget rail, tools + widgets composer, and a restored-session state. Loads `pm-workshop.*` + `pm-sessions.*` + `pm-wk-modals.css` + `pm-widgets.*` + `pm-wk-pins.*` + `pm-wk-notify.js` (the 2026-07-26 drop adds the carded intake rail, the `cwx-*` sheet-pattern tools/widgets browsers, the six-page startup beta notice, and a not-yet-wired standing-pins rail). **Note:** this filename was repurposed from the old split-pane Assistant (now in `… (Direction B).html`). | **Approved interaction design** — persistence semantics are governed by the amended [ADR](../adr/2026-07-14-workshop-session-persistence.md) |
| `Prose Minion - Assistant Tab (Direction B).html` | The earlier full-tab Assistant prototype, Direction B ("Split & pinned"): pinned excerpt + context rail, chat thread with contextual quick-actions, model dropdown, tools modal, localStorage-persisted thread. Superseded by the Workshop tab above; kept for reference (loads `pm-fulltab.css` + `pm-direction-b.*` + `pm-frames-fulltab.js`). | Reference / superseded |
| `Prose Minion - Design Refresh.html` | The presentation canvas: Frame Minion design language applied to the sidebar chrome + all four tabs, the Writing Tools picker modal, and static comps of all three full-tab Assistant directions (A thread / B split / C branch board). | Reference / catalog |
| `Prose Minion - Model Browser.html` | Sidebar-width model picker that replaces the model dropdown: search, By Provider / By Family pivots, filter chips, price + ctx badges, selected/offline states. | Designed, not implemented |
| `Prose Minion - Intake Widgets.html` | **Interactive prototype** of the Sprint 12 excerpt & context intake: excerpt card (two-button empty state, verified paste provenance, locked-state `Update text…` / `Re-read from file`), context attachment pills + aggregate budget meter, and the category-grouped Context Selector modal with explore escape hatch. Self-contained (no `pm-*` support files). | **Approved — Sprint 12 source of truth** |
| `Prose Minion - Context Bar v2.html` | Context Bar with the "In context" sources panel (per-participant manifest rows with stale dimming) and a Memory row (Compress / Compact strategy menus). Sprint 12 supplies the sources data; Compress/Compact is the post-launch compaction ADR's scope. Self-contained. | **Approved — Sprint 12 renders `sources`** |
| `Prose Minion - Context Bar.html` | Context Bar v1 — the per-participant context gauge as shipped by Sprint 11B (expandable details grid, unmeasured state, amber/red thresholds). Kept for reference; superseded by v2. | Implemented (11B) / superseded |
| `Prose Minion - Persona Schematic.html` | **Interactive prototype** of the Workshop persona browser → persona configuration schematic: a persona grid ("More info" opens a read-only schematic in the same modal shell) and a nine-panel schematic (Identity hub, Trait tensions, Turn-taking signature, Personal aperture, Verbal palette, Lexical gravity, Communication gradients, Trait pressure, Signature floor) with clickable hub navigation. Demoed with Margot (maximal spec) and Penny (near-empty spec, reads as tuned not broken); Jill/Quinn shown as spec-pending stub cards. Every field is laid out as a dashed, not-yet-wired `edit` affordance for a future persona config utility. Self-contained (no `pm-*` support files). | **Implemented (read-only) 2026-07-21** — see [ADR](../adr/2026-07-21-persona-schematic-read-model.md) & [feature](../../.todo/features/feature-workshop-persona-schematic/README.md) |
| `Prose Minion - Notice Modal.html` | **Spec sheet + interactive prototype** for the first-run Workshop notice, redesigned wide and with pictures. Three parts: the published copy of all six notices beside annotated screenshots of the control each one points at; the full **How to configure your project** walkthrough referenced by notice 2 (three steps, a well-aligned example project beside the settings pane, and the field → glob mapping table); and a clickable prototype of the widened notice widget (media well left, copy right, docked footer). Loads `pm-mock.css` + `uploads/`. The shipped notice itself is `pm-wk-notify.js` + the notice block of `pm-wk-pins.css`. | **Implemented 2026-07-27** — `WorkshopNoticeModal` + `WorkshopConfigureGuide`; notice version `v3` |

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

**Workshop editor tab (Sprint 10):**

- `pm-workshop.css` / `pm-workshop.js` — **the Workshop tab** (`wk-` prefix,
  `window.PMW`): app shell, header host/persona + model cluster, excerpt /
  context-budget / tools / to-do rail, empty + restored-transcript center,
  composer, toasts, and the host-picker / conversation-settings /
  choose-from-project modals. Uses `pm-mock.css` tokens + the `pm-widgets.js`
  modal shell.
- `pm-sessions.css` / `pm-sessions.js` — **session persistence** UI
  (`window.PMSessions`): the Sessions dropdown (New / Save / Open prior /
  Recent), the **Save session** dialog (editable title, path preview, and
  "included in this snapshot" manifest), and the **session browser** (search that greps
  content, group by Date/Excerpt, per-row hover-revealed
  rename/duplicate/reveal/delete actions). Needs `pm-widgets.js` +
  `pm-workshop.js`.
- `pm-wk-modals.css` — shared Workshop modal chrome: sheet head,
  conversation-settings segmented cards + toggles, host-picker grid,
  choose-from-project file browser.
- `pm-widgets.css` / `pm-widgets.js` — the **shared modal shell**
  (`cwOpen`/`cwClose`/`cwXBtn` overlay) + the Conversation Widgets browser and
  Gesture Playground. The 2026-07-26 drop adds `cwSheetBrowser()` (`cwx-*`
  classes): a shared 940×780 sheet with locked head/foot and a categorized
  selectable card grid, now backing both the Tools and Widgets browsers; the
  widget registry is regrouped into Playgrounds / Explorers / Influences /
  Learners / Resources. Load-bearing for both the Workshop session modals and
  the next-epic widget spreads (see "Not pulled yet").
- `pm-wk-notify.js` — **startup beta notices** (`window.PMNotify`): a six-page
  dismissible "Workshop · beta" modal opened 400ms after load (welcome, project
  folder setup, hosts & guests, conversation controller, tools, agents), with
  prev/next arrows, dot pager, and a "Don't show again" checkbox persisted to
  `localStorage` (`pm-wk-notice-dsa-v1`). **The 2026-07-27 drop widens it to
  `min(1040px, 100%)`** and adds the media well: each page declares its
  screenshots with a max width, an `aspect-ratio`, an optional crop width (a
  percentage over 100 shows only the figure's top-left region), and call-out
  boxes given as `[left, top, width, height, label]` percentages paired with a
  legend. The notice's own styles live in `pm-wk-pins.css`, not here.
- `pm-wk-pins.css` / `pm-wk-pins.js` — **standing-pins scaffold**
  (`window.PMPins`): a two-row rail above the composer — Standing influence
  chips (Lexical Gravity, Prose Controller, Genre position) and a "Pinned
  decisions" fan whose decision modal shows original/updated/reasoning/notes —
  plus "Talking to" host chips. Display scaffolding only: actions fire toasts;
  the functionality is deliberately unwired (next epic).
- `assets/` — logo images. **Copied from
  [`apps/vscode-extension/assets/`](../../apps/vscode-extension/assets/)**
  (same files the extension ships) rather than pulled from the design project,
  to avoid duplicating binaries through the API.
- `uploads/` — the sixteen 2026-07-27 screenshots
  `Prose Minion - Notice Modal.html` and `pm-wk-notify.js` render. Committed as
  of the 2026-07-27 pull: they stopped being reference input the moment the
  notice design started *displaying* them, and without them that page opens
  full of broken images. The older reference sets are still left on the remote
  (see "Not pulled").

### Persistence reconciliation (2026-07-23)

The session-browser prototype copy has been aligned with the locked T3
contract (2026-07-23): normal restore continues retained persona
conversations, and the transcript-only "memory not retained" treatment is
reserved for corrupt/incompatible-history recovery, so the prototype no longer
shows a per-row honesty note. Its slug-only filename examples remain design
shorthand only: named files use a collision-safe timestamped storage identity
while the design's editable session name is stored as title metadata.

The Save dialog, included-items manifest, Sessions menu, search, Date/Excerpt
grouping, and rename/duplicate/reveal/delete browser actions are approved
interaction scope. See the amended
[session persistence ADR](../adr/2026-07-14-workshop-session-persistence.md)
and [Sprint 10](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md)
for behavioral truth. Do not hand-edit the synced prototype to erase this
historical delta; update the remote design and re-pull when its copy catches up.

**Delta reopened by the 2026-07-26 re-pull:** the remote design now shows a
per-row amber `.sb-note` ("memory not retained on restore") and browser subcopy
saying "Room memory from a saved session isn't retained — the persona starts
fresh". That contradicts the locked T3 contract above (normal restore continues
retained persona conversations; transcript-only restore is reserved for
degraded recovery). **Resolved at Sprint 14 kickoff (2026-07-26): shipped
behavior + the ADR remain truth; the note is not ported.** Update the remote
design and re-pull when its copy catches up — see
[Sprint 14](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/14-design-catchup-release-candidate.md).

### Notice-copy reconciliation (2026-07-27)

The comp's notice 4 says only that personas "research the live web when it
helps". The **shipped** copy keeps an extra sentence the comp omits — "search
queries may use active room context and run through OpenRouter and search
providers, so enable it only for material you are comfortable sharing" — which
mirrors the disclosure on the Conversation Controller's own Advanced tab. A
privacy disclosure is not a design detail to be lost in a re-pull, so
`WorkshopNoticeModal.test.tsx` pins that phrase. Everything else on the six
pages is the comp's copy verbatim. Update the remote design when convenient;
until then, do not "fix" the delta in either direction.

### Notice-layout reconciliation (2026-07-27)

One **layout** delta, for the same reason and with the same fence. Notice 2
sizes its two screenshots **180px / 340px**, not the comp's 216 / 400. At the
comp's widths the two do not both fit the media well's height cap — and that
page points at two separate places (the VS Code File menu *and* the sidebar
gear), so pushing the second below a scroll defeats the picture. Also pinned by
a test, because "an inline comment is not a fence against a re-pull" (PR #94
review, Bria). Adjust the remote comp when convenient; do not silently widen
these back.

## Present on remote, not pulled yet (next epic)

The design project also holds the **Conversation Widgets** epic spreads — the
epic that follows Workshop Editor Tab. They share only `pm-widgets.*` (already
pulled above) and are deliberately left out of this snapshot until that epic
starts. Re-pull with `DesignSync get_file` when it does:

- `Prose Minion - Conversation Widgets.html` — Spread 01: the widget lifecycle
  (play → commit → chip → clone-and-recommit), Gesture Playground live.
- `Prose Minion - Lexical Gravity.html` + `pm-gravity.css` / `pm-gravity.js` —
  Spread 02: the standing prose-directive rail.
- `Prose Minion - Prose Controller.html` + `pm-controller.css` /
  `pm-controller.js` — Spread 03: the seven-chapter craft control surface.
- `Canvas.dc.html` + `support.js` — Claude Design's canvas-runtime scratch
  frame, not a standalone prototype.

## Not pulled

The design project also contains reference images that are inputs to the design,
not outputs of it — they are not needed to render any `.html` here:

- `uploads/` **except the 2026-07-27 set** — screenshots of earlier extension
  builds (the 2026-06-16 set, the 2026-07-16 → 07-26 sets, frame minion
  references) the design was drawn from. The repo's own
  [`screenshots/`](../../screenshots/) folder is the canonical home for app
  screenshots. Only the 2026-07-27 screenshots are committed, because the
  notice design renders them rather than merely referencing them.
- `screenshots/mb-panel.png`, `screenshots/mb-bottom.png`,
  `screenshots/behavior-scrolled.png`, `screenshots/parts.png` — renders of
  design surfaces.
- `.thumbnail`, `assets/pixel-minion-icon.png` duplicates of shipped assets.

Re-pull them with `DesignSync get_file` if ever needed.

## Viewing

```bash
open "docs/design/Prose Minion - Assistant Tab.html"      # Workshop editor tab + session persistence
open "docs/design/Prose Minion - Notice Modal.html"       # first-run notices + project-configuration guide
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
