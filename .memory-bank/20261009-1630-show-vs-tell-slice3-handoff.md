# Show vs. Tell — Slice 3 Review-Gate Handoff (authoring surface)

**Date:** 2026-10-09 16:30 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-3-authoring`, cut from
`epic/conversation-widgets` at `7cdfb77` (the Slice 2 merge). One PR into the
epic. Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 2 handoff](20261009-1343-show-vs-tell-slice2-handoff.md)

**Current gate:** Slice 3 is ready for review. Do not start Slice 4 until the PR
merges. **The epic must not merge into `main` until Slice 4 lands:** the catalog
is live and commit is disabled.

## What landed

By layer, in commit order (each commit green on its own):

1. **`ShowVsTellArtifact.ts`** (`application/services/workshop/widgets/showVsTell/`).
   The pure, webview-safe projection. `buildShowVsTellArtifact(draft)` returns
   the counted body; `showVsTellArtifactLength(draft)` is its `.length`;
   `encodeShowVsTellArtifactValue(value)` is the `↵` rule. It imports only
   `@messages`, the Derivations, and (through them) the Continuum: no codec, no
   integrity, no workup-id module, nothing from `node:`. Plus
   `showVsTellWordCount(prose)` in Derivations. Slice 1's fit test now runs on
   the real projection of a worst-case draft and keeps the exact 585 pin
   (`[168, 51, 134, 97, 131]`).
2. **Authoring surface.**
   - `workshop_show_vs_tell_beat` selection target (`ui.ts`) and the
     `dispatchWorkshopSelectionData` arm.
   - `useShowVsTell` (transport) and `useShowVsTellAuthoring` (controller).
   - `WorkshopShowVsTellModal` plus six focused components and `showVsTell.css`.
   - Wiring in `WorkshopApp`, `useWorkshopAppMessageRouter`,
     `useWorkshopWidgetOpening` (fresh draft only).
   - The `boundaries` approved-token regexes at the four generic files touched
     (WorkshopApp, opening, selection dispatch, router) and `ui.ts`;
     `minimumSourceFiles` 9 → 20; the `workshopStyles` cascade list. **No new
     generic surface was approved**, so the Prose Controller seam inventory is
     unchanged; every touched file was already classified.
   - `showVsTellPresentationBoundaries.test.ts`.
3. **Catalog flip.** `show-vs-tell` is `live: true`, tag `Sprint 05`, with the
   neutral blurb. The four unavailable-widget tests now use `topic-relationship`.
   A route test in `WorkshopRoomHandler.seams` proves generation runs through
   `WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY`, and the old "refuses while not
   live" handler test became "runs through the production policy" plus a
   `topic-relationship` refusal. The Host-preparation door stays explicitly
   deferred: `workshopWidgetAskPrefill` has no builder, and a test asserts the
   deferred set is exactly `['show-vs-tell']`.

Untouched, as scoped: commit, the host 600 re-check, warning lines, the
neutralizer, the chip, reopen, clone, recommendation, prefill, POV custody, any
editor write, and Creative Variations code beyond sibling arms.

## Decisions (Ada; the writer may override)

### The three orchestrator readings

1. **Projection lands here: agreed.** The meter must call the host's function,
   and that function must exist before Slice 4 can call it. It is the only
   feature service the webview imports.
2. **`↵` encoding: agreed**, and it is strictly never lengthening: `\r\n`
   collapses to one `↵`, so even that case shrinks. A test proves a one-for-one
   or shorter result for every line-break sequence, and that every artifact line
   still starts with a frozen key. The 585 ≤ 600 fit guarantee therefore holds
   for any content.
3. **Neutral blurb with the flip: agreed.** The catalog test also asserts the
   blurb does not mention recasting, alternatives, fixing, or improving.

### Contract question needing a writer decision (not blocking this slice)

**"Direction-only carry always lowers the count" is not guaranteed by the
frozen rules.** `keep: "<prose>"` costs `prose + 8`; `direction: <dir>` costs
`dir + 11`. The Slice 1 integrity rule only requires direction strictly shorter
than prose, so a direction 1–2 characters shorter can raise the count by up to
2. `ShowVsTellArtifact.test.ts` proves the property holds whenever the margin is
at least 3 and documents the 2-character edge. Real directions are far shorter
(the fixture runs 0.36–0.66), so this is theoretical, but it is a stated
completion criterion. Recommended fix: tighten the shared rule to
`direction + 3 <= prose` (one line in the integrity gate, the prompt wording,
and their tests; the projection needs no change). Tracked in
[`.todo/tech-debt/2026-10-09-show-vs-tell-direction-margin.md`](../.todo/tech-debt/2026-10-09-show-vs-tell-direction-margin.md).
I did **not** change the Slice 1/2 rule, since it was Opus-reviewed.

### Other decisions

- **Terminal phases.** The Slice 2 handoff says a terminal phase ends the
  attempt, but the host posts `completed` *before* the result (on success and on
  failure). Dropping the token at `completed` would discard the result. So
  `cancelled` ends the attempt outright (no result follows), and `completed`
  ends the progress/busy display while the token stays latched for exactly one
  result. A second result for the token, or any result for another token or
  workup id, is ignored. Tested.
- **Beat intake.** Line breaks collapse to single spaces. A selection longer than
  160 characters is shortened to 160 *with a visible notice* (no silent
  truncation) pointing at Creative Variations for passages.
- **Surrounding passage.** The panel shows the active excerpt with the beat
  highlighted (the webview already holds the excerpt text). A context attachment
  shows a label only: its text stays host-side and never reaches the webview or
  the commit. The source choice is single-select (none or one), matching Q1's
  0–1 reference.
- **Room change.** The controller takes a `roomKey` (excerpt version plus
  attachment ids). A change while the sheet is open cancels an in-flight attempt
  and discards its reply; it also clears a settled workup only when a source
  reference grounded it.
- **Commit blockers.** `commit-not-wired` is always the last entry, so the
  button is always disabled and always names why. The over-ceiling blocker
  outranks it, so the fix shows when that is the real problem.
- **Card naming.** Variants are "Variant N" (workup ordinal), never "Take"
  (Creative Variations' vocabulary) and never a rank.
- **Variant keep control** is a `role="checkbox"` button (`aria-checked`), the
  carry toggle a two-button `aria-pressed` group, the continuum and length budget
  `role="radiogroup"`.
- **Modal split.** Seven focused files under 430 lines each; the CSS was derived
  from Creative Variations' mechanics (renamed prefix) with the readout, chips,
  and passage panel feature-owned.

## Verification

- `npm run typecheck`: core, webview, ext clean.
- `npm run lint`: 0 errors (warnings are the repo's existing naming-convention
  pattern for components).
- `npm test`: **282 suites / 3,919 tests / 2 snapshots, all passing** (Slice 2
  tip: 277 / 3,788 / 2).
- `npm run build`: compiled; `verify-bundle` OK.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits.
- Rendered the modal in headless Chromium through a throwaway webpack harness
  (scratchpad only, not committed): fresh and generated states match the design
  reference's layout: one-accent readout, grouped cards, kept-card carry toggle,
  the payload strip at 508 / 600 on the fixture, and the editor footer.

## What Slice 4 needs

- **Projection API.** `buildShowVsTellArtifact(source)` where `source` is
  `Pick<WorkshopShowVsTellDraft, 'beat' | 'position' | 'invariants' | 'workup' |
  'kept' | 'note'>`; it throws when a kept variant is not in the workup (the
  controller already maps that to `artifact-compilation-failed`). The host's
  re-check calls the same function on the **host-held** draft and compares
  `.length` to `PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters`.
  Warning lines are not counted: append them after this body, host-side.
- **The `↵` rule.** Every line break sequence inside a value becomes one `↵`
  (U+21B5) after trimming. A multi-line `direction:`, `keep:`, invariant, or note
  stays on its own line, so the host never needs a continuation grammar. If the
  neutralizer or the frame renderer wants to restore line breaks it can split on
  `↵`, but nothing requires it.
- **Controller seams for commit.** Add `commit`, `commitPending`,
  `commitOutcome`, `clearCommitResult`, `resetCommitState`, `onCommitAccepted`
  options (copy Creative Variations). Remove `'commit-not-wired'` from
  `ShowVsTellCommitBlocker` and from `commitBlockers`, add
  `commit-in-flight` / `room-run-active` / `tool-target` blockers, thread
  `roomRunActive` and `toolTargetActive`, and make the modal's Commit button
  enabled when `commitBlockers.length === 0` with `onCommit`. `commitBlockers[0]`
  already drives `aria-describedby`. The modal's `COMMIT_BLOCKER_COPY` has the
  copy for every current blocker.
- **Busy predicate.** `WorkshopOneShotWidgetId` gains `show-vs-tell` when the
  commit payload union does; narrow `Record<WorkshopOneShotWidgetId |
  'show-vs-tell', …>` in `WorkshopSliceComposition` back to
  `Record<WorkshopOneShotWidgetId, …>`.
- **Clone banner and reopen.** `WorkshopShowVsTellOpening` is `{ kind: 'new' }`
  today. Add `{ kind: 'clone'; config }`, a `banner` prop on the modal
  (`none` | `clone` with `committed-turn` | `rewound-message`; the design copy is
  in the sprint doc), seed `seededCloneConfigIdRef` from the config id in the
  controller's open effect, and replace the `useWorkshopWidgetOpening` clone
  branch that currently says "can't be opened in this version" for
  `show-vs-tell`. The controller's open effect is the one place a draft is
  seeded; a clone must restore channels, budget, POV, invariants, the workup, and
  kept variants with their carry modes exactly.
- **Chip.** Presentation-only; `workshopWidgetIcons` already maps
  `show-vs-tell: 'eye'`. `WorkshopTurnBubble` needs a Show vs. Tell arm.
- **Neutralizer.** `widget:show-vs-tell` registers with the prompt-delimiter
  neutralizer in the same change that ships the frame.
- **Direction-margin decision** (above) before wiring commit if the writer wants
  the "always lowers" guarantee to be literally true.
