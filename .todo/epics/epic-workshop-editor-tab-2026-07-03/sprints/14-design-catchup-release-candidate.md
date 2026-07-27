# Sprint 14: Design Catch-up & Release Candidate

**Status**: In Progress — kicked off 2026-07-26
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-14-design-catchup-release-candidate` -> PR into `epic/workshop-editor-tab`
**Depends on**: Sprint 13D_2 / PR #91
**Design source**: [Prose Minion - Assistant Tab.html](../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) — **2026-07-26 re-pull** (carded intake rail, `cwx-*` sheet browsers, `pm-wk-notify.js`, `pm-wk-pins.*`)
**Design load**: High — this sprint exists to bring the shipped Workshop visually and structurally in line with the latest design drop
**Intent**: The last planned sprint before the Workshop release. 🚀

## Goal

Apply the 2026-07-26 design drop to the real Workshop tab: card the intake
rail, rebuild the Tools and Widgets browsers on the shared sheet pattern, add
the six-page startup beta notices with real host-side plumbing, refresh the
model catalog, and ship the Widgets browser as an honest "coming soon"
preview. When this sprint lands, the Workshop should look like the mock and be
release-ready.

## Scope

### 1. Carded intake rail (sidebar depth)

Port the rail/section carding rework from `pm-workshop.css`:

- `.wk-sec` becomes a card: `border: 1px solid var(--border-soft)`,
  `background: var(--inset)`, `border-radius: 10px`, `padding: 12px`.
- The rail flips from translucent (`rgba(0,0,0,.16)`, 22px padding/gap) to
  `background: var(--surface)` with 16px padding and 12px gap — sections read
  as inset cards on a raised rail.
- Inner surfaces bump one level for contrast: excerpt preview, to-do items,
  and to-do empty state move to `--surface-2`; `.bigbtn:hover` stays
  `--surface-2`.
- Verify the full-width button patterns hold inside the new cards: `.btnstack`
  stacks full-width dashed `.bigbtn` cards; paired intake buttons
  ("Paste or type" / "From project…") split the rail via
  `.sbtnrow` + `.sbtn.grow { flex: 1 }`; "Generate directions" (`.cw-gen`)
  stays `width: 100%`. Buttons take up all their available space, per the
  design screenshots.

Do **not** sync any individual widget UI in this pass — carding is rail-level
only.

### 2. Shared sheet browser (`cwSheetBrowser` pattern)

Implement the Invite-Guest-pattern sheet as a shared webview component:
locked head + locked foot, categorized selectable card grid with circular
check, group headers with descriptions, footer summary + Cancel + primary
action. Modal geometry: `width: min(940px, 100%)`,
`height: min(780px, calc(100vh - 70px))`, zero padding; grid
`repeat(auto-fill, minmax(252px, 1fr))` with a two-column breakpoint at
700px.

Rebuild on it:

- **Tools browser** — kicker "Prose Excerpt Assistant", title "Writing
  tools", sub "Each runs once on your excerpt with the context briefs
  attached — the result lands in the thread as a visible event, in ⟨host⟩'s
  voice." Groups with descriptions: Primary ("The daily passes — the six the
  rail keeps at hand."), Craft & Voice ("How it sounds and how it's built."),
  Technical ("Mechanics, continuity, and fresh eyes."). Launch verb "Run";
  per-tool cost note "one run on the excerpt · lands in the thread". All 14
  tools.
- **Widgets browser** — see §4. The composer "Widgets" button
  (`.wk-abtn.wk-wbtn`, sparkle icon) keeps its current look; it now opens the
  sheet instead of the old 460px narrow modal.

### 3. Wider conversation controller

The conversation-settings sheet (mode / expression / depth) renders at the
wide-sheet width (`min(940px, 100%)`) so the controller cards breathe, per
the design's wider view. Confirm the shipped modal matches; port width and
any spacing deltas if it is still narrower.

### 4. Widgets browser as a "coming soon" preview

Ship the regrouped widget registry — **Playgrounds / Explorers / Influences /
Learners / Resources** with per-group taglines — as a static preview inside
the sheet browser, with two deliberate copy overrides from the mock:

- **Top subtext**: replace the mock's lifecycle copy with a line saying this
  is **a preview of what's coming soon**.
- **Bottom primary button**: always reads **"Coming soon"** and stays
  disabled — no widget opens, regardless of selection. (Mock behavior —
  "Open a widget" / "Open ⟨Widget Name⟩" / "Not in this spread" — is next
  epic's scope.)

Cards remain browsable/selectable so writers can see what's coming; none of
the individual widget UIs are wired or synced. Keep the registry honest:
cards may keep their concept/one-shot/resource tags.

### 5. Startup beta notices + plumbing

Port `PMNotify` into the extension as a real feature, not a mock transplant:

- Six-page "Workshop · beta" notice modal on Workshop open (welcome; works
  best with a project folder configured; hosts & guests; the conversation
  controller; tools — one run, one visible result; agents can do real work).
  Narrow modal (`min(520px, 100%)`), page counter ("1 / 6"), prev/next
  arrows, dot pager.
- Footer: "Don't show again · applies to all 6 notices in this box" checkbox
  + primary "Dismiss"; suppression persists **only when checked**.
- **Plumbing**: persistence lives host-side (Memento via the platform
  `SettingsStore`/storage seam — not webview `localStorage`), with typed
  messages following the envelope + domain-handler patterns (UI domain unless
  review argues otherwise). Webview asks "should I show the notice?"; host
  answers and records dismissal. Notice content is deterministic and lives in
  code/resources, not model output.
- **Persistence scope (decided)**: suppress per machine (global storage — the
  notice is about the product, not a workspace), keyed by a notice content
  version (e.g. `workshopNotice.dismissedVersion`). Revising the notice
  content bumps the version and legitimately re-shows the box.

#### Amended by the 2026-07-27 design drop

The narrow text-only box above shipped first and is now superseded. The
[re-pulled design](../../../../docs/design/README.md) widens it and gives the
tour pictures, because "the diamond chip in the composer bar" is a sentence a
new writer cannot act on without knowing which chip:

- **Wide format** — `min(1040px, 100%)`, two columns: an annotated media well
  (screenshots of the real controls, numbered call-out boxes, matching legend)
  beside the copy, over a docked footer holding the checkbox, pager, and
  Dismiss. Call-outs are positioned in percentages, so re-shooting a screenshot
  at the same crop keeps its annotations.
- **Shipped screenshots** — ten PNGs in
  `apps/vscode-extension/assets/workshop-notices/`, named for what they show.
  The host resolves one webview URI per name (`WORKSHOP_NOTICE_SHOTS` →
  `window.proseMinonAssets.noticeShots`) because a webview cannot mint
  `vscode-webview://` URIs itself.
- **Full-surface configuration guide** — notices 2 and 6 link to "How to
  configure your project": the three setup steps, a worked example layout
  beside the settings pane that consumes it, and the field → glob mapping.
  It takes the whole surface rather than a nested dialog because both of its
  screenshots are tall enough to be unreadable in a box.
- **Notice version → `v3`.** Copy and layout both changed, so every machine
  sees the tour once more. That is the versioning rule working, not a bug.
- **One shipped-copy delta is deliberately NOT reverted**: notice 4 keeps the
  web-research privacy sentence ("search queries may use active room context
  and run through OpenRouter and search providers, so enable it only for
  material you are comfortable sharing"), which the comp omits and which
  mirrors the Advanced tab's own disclosure. A test pins it so a future
  re-pull cannot quietly drop it.

### 6. Model catalog refresh

Ensure the model catalog and the Workshop model picker include these five
entries (official ids from Okey; details verified against OpenRouter
2026-07-26):

| Slug | Display name | Context / max out | $/M in · out | Released |
| ---- | ------------ | ----------------- | ------------ | -------- |
| `anthropic/claude-opus-5` | Claude Opus 5 | 1M / 128K | $5 · $25 | 2026-07-24 |
| `anthropic/claude-opus-5-fast` | Claude Opus 5 (Fast) | 1M / — | $10 · $50 | 2026-07-24 |
| `moonshotai/kimi-k3` | MoonshotAI: Kimi K3 | 1M / — | $3 · $15 | 2026-07-16 |
| `google/gemini-3.6-flash` | Google: Gemini 3.6 Flash | 1M / 64K | $1.50 · $7.50 | 2026-07-21 |
| `sakana/fugu-ultra` | Sakana: Fugu Ultra | 1M / 128K | $5 · $30 | ~2026-06-24 |

Picker bios (plain language, for writers):

- **Claude Opus 5** — Anthropic's most capable model; careful, sustained work
  on a long manuscript: deep revision passes, structural analysis, feedback
  that holds together across a whole chapter. Slower and pricier, strongest
  judgment.
- **Claude Opus 5 (Fast)** — the same brain tuned to answer noticeably
  faster, at double the price. For iterating live on a scene when tempo
  matters as much as the notes.
- **Kimi K3** — Moonshot AI's big open-weight reasoner; punches near the
  frontier at a lower price and handles very long documents well. A solid
  mid-cost pick for whole-manuscript analysis.
- **Gemini 3.6 Flash** — Google's fast, inexpensive workhorse; quick answers,
  long context, low cost. Best for rapid line checks, summaries, and
  dictionary-style lookups. (Already selected in shipped screenshots —
  verify presence rather than duplicating.)
- **Fugu Ultra** — Sakana's trained conductor: routes your request across a
  pool of underlying models and assembles the best answer. Strong on complex
  multi-step work; slower, and orchestration tokens make cost less
  predictable.

The additions are **additive**: no existing entries are replaced and the
default model does not change. Tasks: confirm slugs/pricing against the live
catalog at implementation time (`$PROSE_MINION_API_KEY` is exported in
`~/.zshrc` for catalog audits); update `OpenRouterModels.ts` and any
scoped-model settings enums; confirm the picker renders and persists the new
entries.

### 7. Instrument-thread audience clarity

Make the existing room-ledger boundary visible rather than relying on the
active instrument chip alone:

- While an instrument is the composer target, show a persistent scope note
  naming the thread as private to the writer and that instrument.
- State both directions of isolation: Jill and guests do not receive direct
  instrument follow-ups, and the instrument does not receive Jill/guest
  conversations.
- State that instruments use their own analysis instructions; persona voice,
  Writer Profile, and Conversation Controller settings do not apply.
- Keep the initial commissioned tool report explicitly distinct: it remains
  Room-visible and available to the host for synthesis.
- Label both the writer and instrument bubbles in a direct exchange with their
  private audience. Do not mark ordinary tool reports private.

## Out of scope (explicit)

- **The second rail (standing pins / pinned decisions / `pm-wk-pins.*`)** —
  display scaffolding in the mock only; the functionality is not wired and is
  next epic's work. Do not port.
- **Set-aside / "shelve the excerpt" in a started chat** — this behavior has
  been removed from the product contract. Do not port the mock's shelving
  flow; if any lingering set-aside affordance exists in a started chat,
  remove it.
- **Individual widget UIs** (Gesture Playground, Lexical Gravity, Prose
  Controller, the Explorers, Learners, Show vs. Tell, …) — preview cards
  only.
- **Session-browser restore-copy regression** — the 2026-07-26 mock
  reintroduces a per-row "memory not retained on restore" note that
  contradicts the locked T3 restore contract (normal restore continues
  retained persona conversations). **Decided: shipped behavior + the
  [session persistence ADR](../../../../docs/adr/2026-07-14-workshop-session-persistence.md)
  are truth; do not port the note.** Update the remote design and re-pull
  when its copy catches up.
- **Already shipped, no work needed**: the "New session: full reset" menu
  item, the "Session started / Session resumed" transcript dividers, and the
  no-excerpt-removal-in-a-started-conversation rule are all live in the
  extension (confirmed via 2026-07-26 screenshots) — the mock caught up to
  the product, not the other way around.

## Exit criteria

- [ ] Intake rail sections render as inset cards on a raised rail, matching
  the 2026-07-26 mock; intake buttons fill their available width.
- [ ] Tools browser opens as a 940×780 sheet with locked head/foot,
  categorized grid, group descriptions, and the new copy; launching a tool
  still behaves exactly as before.
- [ ] Widgets button opens the Widgets browser sheet; top subtext reads as a
  preview of what's coming soon; the primary button reads "Coming soon" and
  is disabled; no widget UI is reachable.
- [ ] Conversation controller renders at the wide-sheet width.
- [ ] Beta notices show on Workshop open, page through all six, and
  "Don't show again" (checked + Dismiss) suppresses them via host-side
  persistence that survives reload and restart.
- [ ] The model picker offers the refreshed catalog with verified OpenRouter
  ids; selection persists.
- [x] Direct instrument mode states both directions of conversation isolation,
  states that persona/controller attributes do not apply, distinguishes the
  Room-visible original report, and labels both sides of private follow-ups.
- [ ] No standing-pins rail, no set-aside affordance in a started chat, and
  no restore-copy regression ships.
- [ ] Focused tests, typecheck, lint, architecture checks, and the full suite
  pass; Extension Development Host smoke covers rail carding, both sheets,
  notices, and model selection.

## Verification

Automated (2026-07-26, implementation + PR review resolution complete):

- Full Jest suite: 1,472 tests passed across 137 suites (23 new tests across
  Tools/Widgets sheet browsers, notice modal and hook, UIHandler notice
  contract/failure behavior, and instrument audience rendering);
  snapshot passed; architecture guards green.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: passed with the repository's existing warnings, no errors.
- `npm run build`: production bundles compiled; bundle sentinel passed;
  webpack reported only its existing size warnings.
- `git diff --check`: passed.

Pending:

- Extension Development Host smoke with screenshots against the mock (rail
  carding, both sheets, wide controller, notices show/dismiss/persist across
  restart, model picker).

## Resolutions (Okey, 2026-07-26)

1. **Restore copy conflict** — shipped behavior is truth. The mock's "memory
   not retained" note is not ported.
2. **Full reset** — already shipped (visible in multiple places in the
   product screenshots); no sprint work. Excerpts cannot be removed from
   already-started conversations — that rule stands.
3. **Model catalog** — "Opus 5.0 + Fast" is two entries; additions are
   additive with no default change.
4. **Notice persistence** — versioned: revised notice content may trigger a
   new modal. Stored globally (per machine).
5. **Session start/resume dividers** — already shipped; dropped from scope.
