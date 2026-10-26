# Slice 4M: Design fixes

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D4 (the ribbon) and D6 (the run line); no addendum: neither fix changes what the host reads or keeps
**Writer decision:** 53 in the [epic table](README.md#writer-decisions-2026-10-19); it amends decision 41. The ribbon fix is a bug fix and has no decision row
**Status:** Built on `epic/lightbox-design-fixes`, from `epic/lightbox` at `daec95d` (Draft Edit Slice 2, PR #172). PR to come. Nothing here touches the Draft Edit work also merging into `epic/lightbox`.
**Priority:** High (the ribbon fix: the board was hard to use on a long chapter or at a larger font)

## Why

The writer reported two design problems, in their words.

1. **The ribbon's "chaos" mode.** "The top bar graphic goes into 'chaos' mode
   when the mouse is hovering over a section and the paragraph labels increase
   the height. The mouse unhovers because height moved things, then it removes
   the labels and the mouse rehovers, causing the whole cycle to repeat rapidly
   on loop." They suggested reserving more height and showing "and more" after
   so many, or restricting the line to one line and clipping the overflow, and
   noted that font size affects it.
2. **No way to re-run every call while Finish shows.** "If you read chapter 8
   and one call failed, the button indicates finish last calls. But if you want
   to just reload the file and re-run all you can't do that. Reloading the same
   file keeps the 'finish remaining calls' even if you go to another file and
   back… So you have to finish remaining and then click re-read all to
   effectively accomplish that."

## 1. The ribbon's focus line (bug fix)

### The cause, confirmed

The ribbon's top row (`LightboxRibbon.tsx`) held the eyebrow ("The text · 320 ¶
· 96 columns") and the focus line: the hovered item's title, then up to 14 `¶n`
references and `+N`. `.pm-lb-ribbon-top` was `display: flex; flex-wrap: wrap`,
and the focus line `nowrap` with an ellipsis but `max-width: 100%`. A flex item
is placed on a line by its content width, so a focus line too long to sit
beside the eyebrow wrapped onto a second row of its own, and only then clipped.
The ribbon grew by that row (about 22 px), everything under it moved, the hovered
element slid out from under the pointer, the line went back to the idle hint,
which fits beside the eyebrow, the ribbon shrank, the element came back under
the pointer, and so on.

Reproduced in Chromium against the base bundle (`daec95d`), on a 320-paragraph
board at its top, the pointer held still 3 px inside a section's band on the
Sections lane at 1440 px (the writer's "hovering over a section"): the focus
line changed 34 times in 1.2 s and the ribbon's height alternated 284.25, 306,
284.25, 306 … px. Elsewhere the same wrap moved items out from under the
pointer, or, where the idle hint itself already wrapped (1000 and 500 px), a
short line shrank the ribbon and moved the board up (see Evidence). The
Lightbox's type is set in CSS pixels, so a larger font is VS Code's zoom: the
same window at fewer CSS pixels, where the eyebrow and the line meet sooner.

### The fix

- **The focus line has a row of its own**, under the eyebrow
  (`.pm-lb-ribbon-top` is a column). The eyebrow never changes on hover.
- **Exactly one line tall in every state**: idle, hovered, pinned, an item in
  no single paragraph. `.pm-lb-ribbon-focus` has a fixed `height` and
  `line-height` of 16 px and `overflow: hidden`, so not even a glyph drawn from a
  fallback font can grow it. The idle hint and a 240-paragraph word's line have
  the same box.
- **Two parts.** The text (`.pm-lb-ribbon-focus-text`: `white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; min-width: 0`) names the item and
  its paragraphs. The tail (`.pm-lb-ribbon-focus-tail`, `flex: none`) never
  shrinks and always says how many paragraphs the item touches, "· 240 ¶", or
  "· in no single paragraph". Clipping can hide where an item stands, never how
  much of the text it touches.
- **Ranges.** Consecutive paragraphs are written as one range, in the board's
  own range form: "down · ¶1 ¶4–¶9 ¶12–¶17 …", where the old line spelled out
  "¶1 ¶4 ¶5 ¶6 ¶7 ¶8 ¶9 ¶12 …". Far more fits.
- **No hard cap of 14.** CSS clips the line; the DOM keeps at most 60 ranges
  (`LIGHTBOX_FOCUS_RANGES`), then "…", for an item that touches much of a long
  text.
- **The full list** stays in the inspector when the item is pinned. The line is
  still no live region: hover changes it constantly.

The words are a pure module, `hooks/domain/lightbox/lightboxFocusLine.ts`
(`lightboxFocusLine`, `lightboxParagraphRanges`, `lightboxParagraphRangeLabel`):
each paragraph once, in order, whatever the item gives.

### Audit: hover never changes layout

The rule: hover and keyboard focus change paint only (color, opacity, a
shadow, an outline), never a size, a border width, padding, text length or
what is drawn.

- **CSS.** Every rule in the Lightbox's sheets, the full-tab frame's and the
  Workshop's, whose selector carries `:hover`, `.is-hot`, `:focus`, `.is-dim`,
  `.is-lit`, `:active` or `.is-sel`, read for properties other than paint. In the
  Lightbox's own sheets there are none. Outside them: the frame's saved-board
  browser row turns `pointer-events` on for its actions (no box changes), and the
  Workshop's and sidebar's transforms (paint).
- **Code.** Only the ribbon reads the hovered item (`focusedItem`); every other
  component gets `is-hot` / `is-sel` classes from `LightboxItemButton`, and the
  inspector shows the pinned item only, never the hovered one. So the focus line
  was the one hover-driven layout change.
- **In Chromium**, every control in the board's column (427 at full width) was
  hovered in turn at three widths and at 125% zoom, and the box of every element
  of the Lightbox compared before and during: no change on this branch (see
  Evidence). On the base bundle the same audit flags 378 to 381 of 426: the old
  focus line's box changed with its words on every hover that named an item,
  and on some it took a second row.

## 2. Re-analyze all beside Finish (decision 53)

A board keeps its paid readings per file (decision 46), so reloading or
revisiting a file rightly keeps the board and its Finish. What was missing is a
way to run every call while Finish shows.

| State | Before | Now |
|---|---|---|
| Before any run | Run AI analyses | unchanged |
| A call landed, another not (failed, stopped, never run) | **Finish** (orange, sparkle, its cost) | **Finish**, and right beside it **Re-analyze all** (secondary, refresh icon, its own cost) |
| No call landed yet (every call failed or stopped) | Finish | unchanged: Finish already runs every call, so a second press would repeat it |
| Every call landed | Re-analyze | unchanged |
| Running | Analyzing… and Stop | unchanged |

- **The view model** (`buildLightboxRunLine`) gains `secondaryAction`:
  `{ label: 'Re-analyze all', scope: { mode: 'all' }, cost:
  lightboxCallsNote(planned) }`, in the Finish state once a planned call is `ok`.
  The host already runs `{ mode: 'all' }` (Run AI analyses, Re-analyze); nothing
  on the host changes.
- **Each press has its own reason.** No API key disables both, and the one
  reason is said once, both presses described by it. A call too large disables
  the press that would make it: when only a call that landed is too large (the
  model or the context changed since), Re-analyze all is disabled and Finish still runs. When
  only one press cannot run, or the two cannot for different reasons, each
  reason is led by its press's label ("Re-analyze all: Group A would send
  about …"), with its own id (`pm-lb-run-reason-all`), so it never reads as the
  other press's (`lightboxRunLineReasons`).
- **Finish's reason is its own.** The host's estimate names the largest call
  that does not fit. A press that makes every such call says the host's words,
  as before; Finish, which can leave one out, otherwise names its own call in
  the call controls' words ("Call B would send about …"), now shared as
  `lightboxCallTooLargeReason`.
- **Style.** Finish keeps the primary (orange, the sparkle), as the writer asked
  for Run, Finish and Re-analyze. Re-analyze all is a `pm-lb-button`, refresh
  icon (a re-run, as a widget's Re-analyze), its cost inside it the way Finish
  carries its own. The two sit in one group (`.pm-lb-run-presses`): side by side
  when the run line has room for both, and when they do not fit beside the run
  note they wrap together onto a line of their own. Where even that line is too
  narrow for both (the board between both rails at 1440 px, when Re-analyze
  all's cost carries "· the Opinion up to its digest bound"), Re-analyze all
  sits directly under Finish; at 500 px each wraps its cost under its label
  (`.pm-lb-run .pm-lb-button`).
- **Accessibility.** Each press's accessible name is its content, which starts
  with its visible label ("Finish 1 call · est. $0.12", "Re-analyze all 7 calls
  · est. $0.88 · the Opinion up to its digest bound"), as Slice 4I's rule asks.
- **Readings (decision 49), through the host.** Re-analyze all sends the scope
  Re-analyze sends, so decision 49 applies unchanged: every landed reading stays
  on the board while its call runs again and until a usable new one replaces it,
  and the failed call is retried with the rest. A call that fails in the re-run
  keeps its earlier readings, marked earlier, and the line offers Finish and
  Re-analyze all again (`LightboxReanalyzeAll.test.ts`).

## Files

**New:**
- `presentation/webview/hooks/domain/lightbox/lightboxFocusLine.ts` (pure): the
  focus line's words. It joins `boundaries.test.ts`'s Lightbox module list and
  its transport-free list (ADR D13 requires every Lightbox module listed; those
  two lines are the slice's only change to that file).

**Changed:**
- `components/lightbox/LightboxRibbon.tsx`: the focus line's row, text and tail;
  the old `focusLine` and its 14-reference cap removed.
- `styles/lightbox/ribbon.css`: the top area as a column; the one-line focus
  line.
- `hooks/domain/lightbox/lightboxRunLine.ts`: `secondaryAction`, each press's
  too-large reason, `lightboxRunLineReasons`, `lightboxCallTooLargeReason`
  (365 lines).
- `hooks/domain/lightbox/lightboxCallControls.ts`: uses the shared too-large
  sentence (the same words).
- `components/lightbox/LightboxRunLine.tsx`: the presses in one group, the
  secondary press, each reason once.
- `styles/lightbox/board.css`: the presses' group; a disabled secondary press's
  cost dimmed.

Not touched: Draft Edit, `MessageHandler.ts`, `extension.ts`, `package.json`, the
message barrel, the host, saved boards, the AGENTS.md test inventory.
`extension.js` builds byte for byte as at the base.

## Tests

New suites:
- `presentation/webview/hooks/domain/lightbox/lightboxFocusLine.test.ts` (6,
  pure): the idle hint with no tail; ranges and singletons ("¶3–¶7 ¶12
  ¶40–¶44", "· 11 ¶"); each paragraph once whatever the order; an item in no
  single paragraph; the DOM cap (60 ranges, then "…", the whole count in the
  tail; none at exactly 60); a long run as one range, thousands grouped.
- `presentation/webview/LightboxAppFocusLine.test.tsx` (4, jsdom, a
  300-paragraph board): the line on its own row under the eyebrow, idle, not a
  live region; a hovered lane's 150 paragraphs, capped at 60 ranges, count
  whole, back to idle on leave; a column's run as one range; the same element
  and shape when an item is pinned and the pointer leaves.
- `presentation/webview/LightboxAppReanalyzeAll.test.tsx` (9): Finish orange
  with the sparkle and Re-analyze all secondary, right beside it, each with its
  cost; each named by its visible label first; Re-analyze all sends `{ mode:
  'all' }`, Finish `{ mode: 'rest' }`; Run AI analyses alone, Re-analyze alone,
  Stop alone; no key disables both with one reason said once; a landed call too
  large disables only Re-analyze all, with its own reason, and Finish still runs.
- `application/handlers/domain/LightboxReanalyzeAll.test.ts` (4, the real
  handlers, service, runner, store and library, stubbed engine): on a board whose
  every call landed but B (failed), the run line built from the host's own board
  and estimate offers Finish (1 call) and Re-analyze all (7 calls); Re-analyze
  all's scope starts every planned call, B with the rest, while every landed
  reading stays tile for tile, then every reading is replaced and B is read; a
  call that fails in the re-run keeps its readings, marked earlier, and the
  board the webview last received holds them; control, Finish starts only B.

Changed:
- `lightboxRunLine.test.ts` (+8, 3 changed). The tests that pinned the run
  line's single action now say it: Re-analyze alone once every call landed; the
  two Finish tests (after a stop, after one call ran on its own) pin Re-analyze
  all beside Finish with its cost. New: the Finish state's two presses; idle,
  estimating, starting and every-call-landed with one press or none; Finish
  alone while no call has landed; no key, both disabled, one reason; a landed
  call too large, only Re-analyze all disabled, its reason led by its label;
  Finish naming its own call when the host's reason names another; the host's
  reason kept when Finish makes that call, said once; a single press's reason
  under the run line's old id.
- `boundaries.test.ts`: the new module in the two Lightbox lists.

In all, 4 new suites (23 tests) and 8 new tests in a changed suite.

### Which tests fail on `daec95d`

The 4 new and 2 changed suites, copied onto an export of `daec95d` and run
there under Node 18.20.8:
- **As CI runs them (type-checked), all 6 fail.** Three do not compile:
  `lightboxFocusLine` (its module does not exist there), `lightboxRunLine`
  (`lightboxRunLineReasons`) and the host's `LightboxReanalyzeAll`
  (`secondaryAction`). The other three fail 12 tests: the App's focus line
  (all 4), the App's Re-analyze all (5 of 9) and the boundary lists (3: the new
  module is not on disk there). **Controls that pass there:** in the App's
  suite, Finish sending `{ mode: 'rest' }`, Run AI analyses alone, Re-analyze
  alone, and Stop alone while a run is in flight.
- **With type checking off**, to see each test: `lightboxFocusLine` cannot
  load; 23 tests fail in the other 5. `lightboxRunLine` fails 8 of its 26 (the
  two Finish tests and 6 of the 8 new ones); its earlier 16 tests and two new
  controls (one press in the other states, Finish alone while nothing has
  landed) pass. The host suite fails 3 of 4: its control, Finish starting only
  the failed call, passes.

## Evidence

[`docs/pr-reviews/evidence/lightbox-slice-4m-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4m-visual/README.md):
real host output (the production handlers, service, runner, store and
library, a stubbed engine with call B failing) for a 320-paragraph board,
public-domain *Alice* forty times over, checked with a real pointer in
Chromium at 1440, 1000 and 500 px and again at 125% zoom (VS Code's zoom,
with the root and VS Code font sizes at 18 px). 48 captures, `errors.txt`
empty:
- six items (the word in 240 of 320 paragraphs, a ribbon column, the Dialogue
  and Sections lanes, a section's band, a read motif) hovered 3 px inside
  their top edge and held for 1.2 s: the ribbon's, its top area's, the focus
  line's and the item's boxes the same before and during, the line changed
  once, the ribbon's height never (302.75 px in every config), the item still
  hovered, the line ending with its count;
- every control in the board's column (427) hovered in turn: no element of
  the Lightbox moves;
- the run line: Finish and Re-analyze all, each with its cost, named by its
  label first, inside the toolbar; without a key both disabled, one reason.

Against the base bundle the same harness writes 117 errors, among them the
writer's loop (34 focus-line changes in 1.2 s, the ribbon's height
alternating), items moved out from under the pointer, 378 to 381 of 426
controls changing the layout on hover, and no Re-analyze all.

## Verification

All under Node 18.20.8 (CI's and VS Code 1.82's extension host), after `npm ci`:

| Gate | `daec95d` | This branch |
|---|---|---|
| Jest, full suite | 549 suites / 7,681 tests / 59 snapshots, all passing | 553 suites / 7,712 tests / 59 snapshots, all passing |
| `npm run lint` | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings, identical per file, rule and severity |
| `npm run typecheck` | passes | passes |
| `npm run build` (with `verify:bundle`) | `webview.js` `25398905…`, `extension.js` `94bb04d9…` | `webview.js` `9509f3a2…` (two builds alike), `extension.js` `94bb04d9…` (unchanged) |
| `git diff --check` | | clean |

No `from 'vscode'` in `packages/core/src`; every changed module is under 500
lines (`lightboxRunLine.ts` 365, `lightboxFocusLine.ts` 84); no new `any`.
No live or billable call: every engine is stubbed. *Alice* only; model ids
are placeholders.

## Follow-ups

- **Hover elsewhere.** The audit found no other hover- or focus-driven layout
  change on the Lightbox board. Outside it (not a Lightbox file, left as it is):
  the saved-board browser row in the shared full-tab frame turns on
  `pointer-events` for its actions on hover, which changes no box.
- **The focus line's tooltip.** A clipped line has no tooltip: an item's line
  cannot be hovered without leaving the item. A pinned item's whole list is in
  the inspector.
- **4J's row in the slices table** still reads "PR #170 open"; PR #170 merged
  at `31edcfd`. Left for the coordinator, who keeps that table's merge states.

## For the writer to decide

- **The range form.** The focus line writes ranges as the rest of the board
  does, "¶4–¶9", rather than the shorter "¶4–9". One character a range.
- **Re-analyze all while nothing has landed.** When every call failed or was
  stopped, Finish runs every call, so Re-analyze all is not shown: the two
  would do the same thing at the same price. Say if it should show anyway, so
  the pair never changes shape.
- **The secondary's words and icon.** "Re-analyze all", with the refresh icon a
  widget's Re-analyze uses, and its cost inside it as Finish carries its own.
- **Beside, or under.** With both rails open at 1440 px, Re-analyze all's cost
  ("7 calls · est. $0.88 · the Opinion up to its digest bound") is too long
  for the pair to share a line, so it sits directly under Finish (side by
  side on a wider board). Dropping "· the Opinion up to its digest bound"
  from the button, leaving it to the run note and the Lenses panel, would
  keep it beside Finish there; the Re-analyze press carries the same words
  today, so the slice keeps them.
