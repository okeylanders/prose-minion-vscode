# Slice 4I: Run controls

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D6, and its **addendum of 2026-10-23, a call can run on its own**
**Writer decisions:** 41–45 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Built on `epic/lightbox-run-controls`, from `epic/lightbox-reading-tolerance` (Slice 4H, PR #165) at `4dcdb2b`, with its review corrections merged in at `467950d` and its re-review's at `bdec17f`. PR to come.

## Why

The writer, after using the Lightbox on real chapters, asked for three
things, in their words:

1. "Can we change the wording of 'Read The Chapter' > 'Run AI Analyses' and
   keep the orange blaring color when it switches to 're-analyze' or
   'finish'"
2. "On the individual widgets switch to 'Analyze' and make it a button that
   kicks off the call(s) associated with that widget. The call may include
   more widgets, that's okay. Also, make the widget allow for a re-run of
   that call."
3. "The lenses 'Call A,B' should be buttons that can Run, ReRun that call."

And decided two details: a widget's Analyze runs **its call**, reading the
lenses of that call that are checked plus the widget's own lens even if it
is unchecked; and **the Opinion's** Analyze runs only the Opinion call (F)
over whatever is on the board, saying why instead of running when nothing
it needs has been read.

## 1. The run vocabulary (decision 41)

| Where | Before | Now |
|---|---|---|
| Run line, before any run | Read the chapter (orange) | **Run AI analyses** (orange, sparkle) |
| Run line, a call with a lens on not back yet | Read the rest (grey, refresh icon) | **Finish** (orange, sparkle), with its cost |
| Run line, every call landed | Re-read (grey, refresh icon) | **Re-analyze** (orange, sparkle), with its cost |
| Run line, while running | Reading… 2 of 7 lens groups back | **Analyzing… 2 of 7 calls back** (the Opinion alone, or last: "Weighing the board for the Opinion…") |
| A widget | the "READ" badge | **Analyze** / **Re-analyze** / **Analyzing…** |
| A counted-read widget | "COUNTED · READ" | **COUNTED** chip + the button |
| The Lenses panel | "call A" on each lens row | a header per call with **Run A** / **Rerun A** / **Running A…** |
| A reading's placeholder | Not read yet. Runs with the next press. | **Not analyzed yet.** |
| Its shimmer | Reading… | **Analyzing…** |
| The ribbon's read lanes before a reading | … is a reading. Not read yet. | … is a reading. **Not analyzed yet.** |
| The tension line before a reading | … its lane fills when the chapter is read. | … its lane fills **once call A is analyzed.** |
| A failed call | … Read the rest to try again. | … **Press Finish or Analyze to try again.** |
| Rate limited | … Read the rest in about 30 seconds. | … **Try again** in about 30 seconds. |
| A group set aside for changed text | … Read the rest to read the new text. | … **Press Finish or Analyze** to read the new text. |
| No API key | … to read the chapter. | … **to run AI analyses.** |
| A stale reading | … Re-read to read it fresh. | … **Re-analyze** to read it fresh (and the tension and endings lanes, and the freshness basis) |
| The Opinion stale, or its Bring refused | … Re-read the Opinion … | … **Re-analyze the Opinion** … |
| The Opinion with nothing to weigh | … Read the chapter, then the Opinion. | … **Analyze another call first, then the Opinion.** |
| The Lenses caption | Readings run only when you press Read, as up to 7 grouped calls … | Readings run only when you ask: **Run AI analyses** makes up to 7 calls, the Opinion last, on the checked board; **a call's Run, or a widget's Analyze**, makes that call alone … |
| A press refused while one runs (webview) | A reading is running. Stop it, or wait for it to finish. | **An analysis is running.** Stop it, or wait for it to finish. |

**Kept:** "reading" where it means the register (a reading versus a
count: "Tension is a reading", "nothing here is a reading", "a reading, not
a measurement", the Opinion's "read and current"), the host's own
"This board is already being read. Stop that run first.", which names no
button, and two re-reads that are not AI runs: the inspector's **Re-read
this tile** (the per-lens re-read, unchanged) and the source's **Re-read
file** / **Read the current text**.

## 2. Per-call runs on the host (decision 42)

`LightboxRunScope` gains `{ mode: 'group'; group: LightboxReadingGroupId;
lens?: LightboxLensId }`. The webview never names a list of lenses.

- **What it reads** (`lightboxGroupCallLenses`, through the one planner
  `lightboxPlannedCalls`): the call's lenses that are on, in rail order,
  with `lens` added even when it is off; the call's other lenses that are
  off stay out. Every lens off and no `lens`: refused, "Every lens of call
  B is off, so it has nothing to read."
- **Validated before anything is reserved or sent**
  (`application/handlers/domain/LightboxPressScope.ts`, split from
  `LightboxReadingHandler`, which stays at 488 lines): a lens of another
  call ("Theme & motif is read in call A, not call B."), a group that is no
  model call ("Only calls A to G can be analyzed. Counting (Measure) is
  free and makes no call."), an unknown lens, a list of lenses where a lens
  belongs, or an unknown mode ("That is not a reading this board can run.").
- **A re-run replaces the call.** A call run on its own is a full run of
  its group: `startLightboxGroups` clears it and marks its lenses pending,
  and its outcome replaces it whole, as in a full run. Its other calls keep
  their readings (and their tile ids). The per-lens re-read (`mode: 'lens'`)
  is unchanged.
- **Group F alone** reads the board as it stands. While nothing on the
  board is read and current it is refused, with nothing reserved, in the
  Opinion's own words (`LIGHTBOX_OPINION_NOTHING_TO_WEIGH`, now in
  `shared/constants/lightboxOpinion.ts`). The rule,
  `lightboxOpinionNothingToWeigh`, asks `lightboxOpinionItems` whether any
  tile the digest would hold is current (a chapter group's tile, not a
  spark, its lens neither stale nor being read again), so the host's
  refusal, the webview's disabled button and the digest cannot disagree;
  the call's own check when it opens on the digest stays the last word. A
  board whose readings are all stale is refused the same way.
- **Group G alone needs nothing read first.** Its task names each figure by
  the board's measured counts (`lightboxSteeringTaskLines(numbers)`), and
  every board measures them, lens on or off. A run of G alone on a fresh
  board lands (tested).
- **Estimates.** No new shape: `LightboxRunEstimate.groups` already prices
  one call per group with its lenses that are on, which is exactly what a
  call's Run sends and what a widget's Analyze sends for a lens that is on.
  A widget of a lens that is off is not drawn (a lens that is off is not on
  the board), so no other price is needed; the host still fit-checks the
  exact call at the press, whatever its lenses.
- **Ownership is unchanged.** A group press takes the press snapshot and
  reserves the board before its first await, checks the estimate key, the
  model, the board's adoption and the run's ownership after its prompts
  load, and lands through `LightboxPressRun`. One run of a board at a time:
  a call pressed while another run is going is refused, and Stop works as
  before.

## 3. Widgets get an Analyze button (decision 43)

`hooks/domain/lightbox/lightboxCallControls.ts` (pure) words every call's
control from the board, the estimate, the lenses off and the run line's
state; `components/lightbox/LightboxCallButton.tsx` draws it.

- **Where.** Every reading frame's header (motifs, gravity, palette,
  characters, voice, subtext, genre, lineage, stock, rhythm, numbers,
  steering, template, pressure, artifacts, summary and the Opinion), the
  Spark lane's head, the tension line under the ribbon (beside it, outside
  its pin) and the headline's row once its lens has been asked for: while
  call A reads it, once it lands, and when it was withheld, failed or
  stopped (the plain heading of a board whose headline was never asked for
  is no widget). The row keeps one shape through all of these, so a
  focused Re-analyze keeps the focus through its own rerun: it reads
  "Analyzing…", disabled, then "Re-analyze" or, after a failure,
  "Analyze" (PR #166 N-02). The frames
  read it from `LightboxCallControlsProvider`, a context around the board,
  so the renderer map and the tile components pass nothing new.
- **It replaces the bare "read" badge.** A counted-read widget keeps a
  "COUNTED" chip beside it; a measured tile has no button and keeps
  "MEASURED". The headline keeps "a reading" beside its button, so a read
  headline never passes for the board's title.
- **States:** **Analyze** before its lens has a reading; **Re-analyze**
  after (its group's latest readings came from it); **Analyzing…** while
  the call reading it is in flight (a tile's re-read of another lens of the
  same call leaves it waiting, not Analyzing…); disabled with a reason
  while any run of the board is in flight or starting ("An analysis is
  running. Stop it, or wait for it to finish."), without a key, while the
  cost is estimated, or when the call would not fit the window.
- **Disabled, not gone.** The button stays focusable with `aria-disabled`
  and its reason as its description (`aria-describedby`); a press does
  nothing. A reason that is the call's own (the Opinion with nothing to
  weigh, a call too large, every lens of the call off) is also shown under
  it; a run in flight is only described, so the board does not fill with
  the same sentence.
- **Cost:** inside the button, small, after the label: "Analyze ≈ $0.04";
  "< $0.01" for a call that rounds to nothing; nothing without live
  pricing. Every price is an approximate total, the Opinion's too
  ("≈ $0.05"), never a cap (PR #166 F-01): a call's input is priced as sent
  (the Opinion's at its digest's whole bound) and its output at what such
  a reply typically runs to, so a reply under the call's 12,000-token
  output ceiling can cost more. It reads cleanly at 500 px, where the
  header wraps.
- **Accessible name and tooltip:** the visible label first, then the
  call, its lenses and the price (PR #166 N-01): "Analyze, call B:
  Characters, Voice, Subtext · ≈ $0.04", "Analyzing…, call A: Headline,
  …". The Opinion's adds what its input is priced at, apart from the
  price: "Re-analyze, call F: Opinion · ≈ $0.05 · input at digest limit".
  A disabled control's tooltip is its reason.

## 4. The Opinion's Analyze (decision 44)

It sends `{ mode: 'group', group: 'F', lens: 'opinion' }`: the Opinion call
alone, over the board as it stands. While nothing on the board is read and
current, it is disabled and shows "Nothing on the board is read and
current, so the Opinion has nothing to weigh. Analyze another call first,
then the Opinion." under it; the host refuses the same press with the same
words. Its price reads "≈ $0.05", approximate like every call's; its name
and tooltip add "input at digest limit", the one thing its estimate does
differently (PR #166 F-01).

It replaces the tile's own **Re-read the Opinion** at its foot, which ran
the same call (as the per-lens re-read); the Bring row stays. The two
differed only in that a per-lens re-read keeps the old Opinion until the new
one lands and on a failure, and a call's run clears it first, as the writer
decided for every call's re-run. The inspector's **Re-read this tile**, on a
pinned Opinion, still makes the per-lens re-read.

## 5. Lens panel: one Run per call (decision 45)

The Lenses panel lists the lenses under a small header per call, in run
order (A, B, C, D, E, G, F): "CALL A" on the left, its Run on the right,
then the call's lens checkboxes. One button per call, not per lens, so the
list stays a list of lenses and the call's button never reads as a lens's
own. Each header is a labelled group ("Call A"), and each checkbox still
names its call to a screen reader ("Palette · call A"), visually hidden.

- **Run A** before the call holds a reading, **Rerun A** after, **Running
  A…** while it is in flight; disabled with a reason as the widgets are, and
  "Every lens of call G is off. Turn one on to run it." shown when none is
  on. It reads the call's lenses that are on (`{ mode: 'group', group }`).
- **Tooltip and accessible name:** the label first (PR #166 N-01): "Run A,
  call A: Headline, Theme & motif, Tension arc, Lexical gravity, Palette ·
  ≈ $0.07"; "Rerun B, call B: …" and "Running A…, call A: …" likewise;
  "Run F, call F: Opinion · ≈ $0.05 · input at digest limit".

## Implementation notes

- **New modules:** `application/handlers/domain/LightboxPressScope.ts` (127
  lines: the scope's parse, the calls a press makes, what an estimate
  prices), `presentation/webview/hooks/domain/lightbox/lightboxCallControls.ts`
  (257, pure, transport-free), `presentation/webview/components/lightbox/LightboxCallButton.tsx`
  (the button, the provider, the widget's Analyze). All three join
  `boundaries.test.ts`'s Lightbox module list, the hook its transport-free
  list.
- **Changed:** `lightboxRuns.ts` (the scope), `shared/constants/lightbox.ts`
  (`isLightboxReadingGroupId`, `lightboxGroupCallLenses`, the planner's
  `group` case), `shared/constants/lightboxOpinion.ts` (the reason and its
  rule), `LightboxReadingHandler` (488 lines, as before),
  `LightboxOpinionCall`, the run line's model and component, the tile
  frame (an `action` slot), the reading frame, the placeholder, the
  headline, the tension line, the spark lane, the Opinion, the Lenses
  panel, `LightboxApp`, and copy in the host's failure words. CSS in
  `tiles.css` (the control), `rail.css` (the call headers), `ribbon.css`
  (the tension row) and `board.css` (the run press's cost on orange); all
  of it passes `webviewCssFloor.test.ts`. `LightboxReadingRunner` keeps 498
  lines (two strings changed).
- **Test harnesses:** `lightboxBoardsHarness` gains `run(scope)`, beside
  `press(lens)`.

## Tests

New suites:
- `LightboxRunControls.test.ts` (21): the scope refused for a lens of
  another call, Measure, an unknown group, no group, an unknown lens, a list
  of lenses and an unknown mode, with nothing reserved; a call with every
  lens off; one call read alone and landed, the others untouched; the
  widget's off lens added and the call's other off lenses left out; a re-run
  cleared first and replaced, the other calls' tile ids kept; G alone on a
  fresh board; F refused with nothing on the board, and with every reading
  stale; F alone once B landed, on B's readings; a call pressed while
  another runs refused and Stop still stopping; the press guards (a lens
  turned off, a price changed, another board adopted while preparing; a
  stale estimate key before any prompt is read); the estimate's entry equal
  to the call sent.
- `lightboxCallControls.test.ts` (22): every control state and reason,
  names and prices, the Opinion's reason and its stale case, the panel's
  Run/Rerun and its every-lens-off reason; the Opinion's price never a
  maximum, its input bound said apart, with and without live pricing and
  at a tiny price (F-01); every name led by its label, in four moments of
  the board (N-01).
- `LightboxAppRunControls.test.tsx` (15): the run line in each label state
  (orange, sparkle, cost), Analyzing… with Stop; a widget's Analyze in its
  header in place of the read badge and the press it sends; COUNTED +
  Analyze; a measured tile with none; Re-analyze; Analyzing… and the other
  controls disabled but focusable, with their description, and a press
  that sends nothing; the estimate pending; the spark lane, the tension
  line and the headline; the Opinion's shown reason and its press once a
  call landed; the Lenses panel's headers, Run and Rerun, one run at a
  time, and a call with every lens off; the Opinion's "≈" price, name and
  tooltip on its Analyze and on Run F (F-01); label and name for every
  call button, Run, Rerun and Running among them (N-01); the headline's
  focused Re-analyze held through its rerun's start, landing, failure and
  stop, and absent on a fresh board (N-02). 19 tests.

Changed: `LightboxBoardAdoptions.test.ts` (a call's Run, a widget's Analyze
and the Opinion's Analyze refused when a saved snapshot of the same board
is opened while they prepare, and a control), `lightboxRunLine.test.ts`
(labels, Finish after one call, the Opinion weighing alone), the App tests
that named the old copy, `boundaries.test.ts` (the module lists), and the
host tests that pinned the old failure words.

In all, 3 new suites (62 tests, 51 before the PR #166 corrections) and 6
more tests in changed suites.

**Which tests fail on `d255b8e`.** The 24 new and changed suites, as
committed at `f21b0626` (before the 4H corrections were merged), copied
onto an export of `d255b8e`:
- **Typed, as CI runs them:** 23 of the 24 fail. Six do not compile there:
  `LightboxRunControls`, `lightboxCallControls` and `LightboxAppRunControls`
  (new modules and the shared reason), `LightboxOpinionRun` and
  `LightboxLongParagraph` (the reason moved to
  `shared/constants/lightboxOpinion`), and `LightboxBoardAdoptions` (the
  `group` scope is not a `LightboxRunScope` there). Seventeen fail by test,
  48 tests in all: the run line (11), the App's estimates (7), runner (8),
  readings (4), model selection (3), boundaries (2: the module lists),
  Opinion (2), gravity (2), and one each in the reading handler, the
  steering run, run completion, the App, the App's story lenses, the plot
  lanes, the craft lanes, stale tension and the rail's steering toggle
  (the old words, or the call headers). One passes there:
  `LightboxHeadlineWithheld`, whose failure words are the test's own.
- **With type checking off** (to see each test): 71 tests fail in the
  suites that load, among them all 15 of `LightboxAppRunControls` and the 4
  new adoption cases; `LightboxRunControls` and `lightboxCallControls`
  cannot load at all (their modules do not exist there).

## Verification

See the epic's progress note for the gates on the final head. Visual
evidence in
[`docs/pr-reviews/evidence/lightbox-slice-4i-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4i-visual/README.md):
39 captures, `errors.txt` empty; against the reviewed head's bundle
(`28a977e`) the corrected harness writes 273 errors, among them each of
the three review findings, and 189 against the base bundle (`d255b8e`).

## PR #166 review corrections (2026-10-23)

Astra's review ([report](../../../docs/pr-reviews/pr-166-lightbox-run-controls-review.md))
asked for one correction and two nonblocking follow-ups; all three are made.

- **F-01 (P2): the Opinion's price was shown as a cap.** "up to $0.05"
  priced its input at the digest's bound but its output at the typical
  1,440 tokens, not the 12,000 the call may use, so a permitted reply could
  cost more. It now reads "≈ $0.05" like every call's, on its Analyze and
  on Run F, and the name and tooltip add "input at digest limit". No
  budget is imposed and the estimate itself is unchanged
  (`lightboxCallCost`, `LIGHTBOX_DIGEST_INPUT_NOTE`).
- **N-01 (P3): names now start with the visible label**, "Run A, call
  A: …", "Rerun B, call B: …", "Running A…, call A: …", "Analyze, call B: …",
  keeping the call, lenses and price.
- **N-02 (P3): the headline's Re-analyze keeps the focus through its own
  rerun.** The row with the button stays while call A reads the headline,
  in one shape for every state, so the button is never replaced; it says
  "Analyzing…", disabled, and then "Re-analyze", or "Analyze" after a
  failure or stop. A board whose headline was never asked for still shows
  the plain heading alone.

## For the writer to decide

- **The Opinion's re-run clears it first.** A call's Re-analyze clears its
  readings when it starts, as the writer decided; for the Opinion that
  means the old Opinion is gone while the new one is weighed, and stays
  gone if the call fails. The removed "Re-read the Opinion" kept the old
  one until the new one landed (the inspector's "Re-read this tile" still
  does). If the Opinion should keep its old reading until the new one
  lands, its Analyze could send the per-lens re-read instead.
- **A widget whose lens is off.** A lens that is off is not drawn on the
  board, so no widget's Analyze can name an off lens today; the host honours
  one (the decision), but no button reaches it. If off lenses should still
  show their widget with an Analyze, that is a board change.
- **"Re-read this tile"** in the inspector keeps its words, since it is the
  per-lens re-read and differs from a call's Re-analyze. It could become
  "Re-analyze this tile" if one verb is wanted.
- **The headline's Analyze** appears once the headline has been asked
  for (while it is read, once it lands, or a state of it), not beside the
  plain heading of a board whose headline was never asked for, where it
  would compete with "Run AI analyses".

**Answered:** *Label in name.* The accessible names said "Run call A: …"
while the button showed "Run A", so a speech user saying "click Run A" might
not reach it. They now start with the visible label, "Run A, call A: …"
(PR #166 N-01).
