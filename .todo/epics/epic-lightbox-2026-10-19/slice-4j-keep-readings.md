# Slice 4J: Keep readings until they're replaced

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D6 and D12, and their **addendum of 2026-10-24, keep, lens by lens, until replaced**
**Writer decisions:** 49 (supersedes 42, generalizes 47) and 52 in the [epic table](README.md#writer-decisions-2026-10-19); decisions 50 and 51 are Slices 4K and 4L's
**Status:** Built on `epic/lightbox-keep-readings`, from `epic/lightbox` at `cf7f260` (Slices 4H, 4I and 5A.2 merged), with `epic/lightbox` at `f75ed80` (Slices 4K and 4L, PRs #168 and #169) merged in. PR #170 is open; its re-review closed F-01 and N-01, and F-02's remaining case is corrected.

## Why

The writer, in their words: **"every re-run keeps the old readings until the
new ones land. A failed or stopped run must never cost a reading the writer
already paid for."**

Before this slice, a call run on its own was cleared first (decision 42), and
so was every call of Run AI analyses, Re-analyze and Finish. A failure or a
Stop then left the widget empty, and the board saved after it no longer held
the earlier reading. Decision 47 had kept the Opinion's reading only when its
call ran on its own. PR #167's re-review named the boundary this left: an
owed save wrote the landed reading, but the board on screen showed it cleared,
and a later run's save dropped it.

Then, while this slice was being built, the writer approved a second change
to the same widgets (decision 52): **"Show a failed call's error once, at the
call level, not repeated in every widget."** A failed call's message, with
the place its paid reply was saved, used to repeat in every widget of the
call.

## 1. The rule (decision 49)

`LightboxReadingState` applies one rule, lens by lens, in every run scope:
`all` (Run AI analyses, Re-analyze), `rest` (Finish), `group` (a widget's
Analyze, a call's Run or Rerun) and `lens` (the inspector's Re-analyze this
tile). The scopes differ only in which calls run and which lenses each reads.

| A lens of the call… | While it runs | When the call settles |
|---|---|---|
| has a reading (at least one tile) | keeps it on screen, `pending` | **replaced** by a usable new block (one that drew a tile); otherwise **kept**, with an earlier mark and the reason |
| has none | cleared of what an earlier call left (a withheld block, its friction, its quote checks), so it shows "Analyzing…" as a first read does | takes the new state as before: nothing after a failure or a stop; the withheld block, or the empty answer, otherwise |

**What keeps the earlier reading:** the call failed; it was stopped; the
reply was cut off inside or before the lens's block; the block was withheld
(a real fault); the block came back with no usable tile (every claim withheld,
or none given). The earlier reading keeps its own standing, stale mark,
withheld notes, friction, quote checks and provenance, and gains an
**earlier mark**: `{ lens, reason }`, the reason in host words.

**Each lens is decided on its own:** one call can replace the headline and
keep the motif. **One unit is decided together:** template and summary
(`LIGHTBOX_KEPT_TOGETHER`), because engagement in the template block sits on
the movements of the same reply (Slice 4C). When one of them keeps its
earlier reading, the other keeps its earlier reading too, if it has one; a
partner with none takes the new block, whose engagement then sits on no
earlier movement.

**The Opinion follows the same rule in every scope**, in a run of every call
and in Finish as when run on its own: decision 47 is now its special case.
Its citation basis rule moves to this build's only when a new Opinion lands,
so a call that keeps an Opinion cited under an earlier rule leaves it stale
for that reason. While other calls of the run are read, the Opinion's
standing reads them as they stand: a cited reading pending, or replaced,
makes it stale, which is honest.

**Lenses the call does not read are untouched**, earlier marks included. A
lens turned off and its call run keeps its reading, hidden while the lens is
off.

**Stop.** Every pending lens with a reading is marked earlier with the stop's
reason ("Stopped before this group came back."). **The text changing under a
run:** the group is set aside, carried with its earlier readings, stale, each
marked earlier with "The chapter changed while this group was being read…".

**Guards hold.** The press, adoption and observation checks and one run of a
board at a time are unchanged, and the runner still drops a result for a run
that is no longer the board's active one, so a late reply of an older run
never replaces a newer reading (tested in both orders).

`lightboxPressKeptLens` is gone: `lightboxPressLens` names a tile's lens for
the run's progress and log only.

## 2. Provenance

A group gains two optional fields (`shared/types/messages/lightboxProvenance.ts`):

- **`provenance`**: per lens whose state is on the board, `{ lens, run,
  model?, at }`: the run's host-minted token, the provider-reported model of
  its call, and the ISO time it landed, from the service's clock
  (`LightboxService.clock()`). A lens a call replaces, or shows fresh, gets
  the new entry; a kept lens keeps its own. When a later call of its group
  settles, a reading with no entry of its own gets one (PR #170 F-02):
  - **from a board read before this slice** (its group has no `provenance`
    field at all): `{ lens, model? }`, the model its group named then, taken
    before the group's model becomes the new call's, and never a run or
    time the board did not hold; nothing at all when the group named no
    model;
  - **from a group that has the field** (even empty), whose entry for it
    did not read or was left out: `{ lens }` alone. Its origin is lost and
    stays unknown through every later call, never the group's model, which
    is the latest call's (PR #170's re-review).

  `run` and `at` are both present or both absent, and the codec drops an
  entry with one and not the other. The field, once present, stays present
  through every transition, empty or not, and is written and read back as
  an empty list, so a lost origin never reads as a board from before this
  slice.
- **`earlierLenses`**: `{ lens, reason }` for each lens showing an earlier
  reading.

The group's own fields keep their meaning: `model` and `error` are the latest
call's; `usage` sums every call the group made on the board, whichever
readings landed, so a board's cost is what was paid. `frictions`,
`quoteChecks`, `withheldBlocks`, `withheldClaims` and `staleLenses` are
per-lens entries, so each lens keeps or takes its own.

**The models named are those of the readings on screen**
(`lightboxBoardModels`, `lightboxLensModel` in
`shared/constants/lightboxProvenance.ts`): the Boards browser's row and the
inspector. A call whose reading replaced nothing (it failed, was stopped, or
every lens it read kept its earlier reading) is not named. Only a board read
before this slice has no `provenance` field at all, and its readings are its
group's model; a present field, even empty, never falls back. Once a call of
a group settles, every reading the group shows has an entry, so a lens
without one has lost it (an entry that did not read, or one left out): its
model is unknown, never the group's latest call's (PR #170 F-02 and its
re-review).

**The inspector** names the model and time of the pinned reading ("Read by
model-v1 · Oct 24, 2026, 9:08 AM", in the viewer's zone; "Read by model-v1"
alone for a reading from before this slice), and says when it is an earlier
one, or being read again.

## 3. Saved boards

- **Format 1 gains the two optional fields.** It has not shipped, so no
  version moves; `board-v1.json` and `board-v1-named.json` read unchanged and
  write back byte for byte. A provenance entry that does not read is left out
  and counted, and the board opens; an earlier mark that does not read leaves
  the file unread, as a stale mark does, because a dropped one would show an
  earlier reading as the latest.
- **A save writes what its run landed** (`owedBoard`, unchanged in code). No
  run clears first now, so the board a later landing run saves holds every
  kept reading. PR #167's stated boundary is closed: B lands, B is re-run and
  stopped with nothing back, then C lands; C's save writes the kept B
  (cancelled, earlier, its tiles as they landed) and C, and a reload restores
  both (`LightboxBoardOwedSaves.test.ts`).
- **A failed call lands its group**, so its save rewrites the board's one
  file in place with the earlier readings, their marks and provenance; a
  reload restores them exactly.
- **A Stop still earns no save of its own** (decision 36): the file stays as
  the last landing left it, byte for byte, and nothing the Stop touched is
  lost, since the readings it kept are the ones on disk.
- Revision ownership, fallback files, queued name and spark edits and the
  reload pointer are untouched; their suites run unchanged.

## 4. The webview

`lightboxLensView` gives every renderer three things (Slice 4J):

- **`reanalyzing`**: the lens's reading stays on show while its call reads it
  again. Its phase is `ok`, not `reading`, so every frame, lane and count
  that draws a reading keeps drawing it. A widget's Analyze says
  "Analyzing…" (it is in flight) and keeps the focus.
- **`earlier`**: the reason its latest call did not replace it.
- **`callNote`**: the note of its call that did not land, when what the lens
  shows is that note's message (decision 52).

`LightboxKeptNote` draws the first two in every reading frame, the headline,
the tension line and the Spark lane; the frame is described by the note
(`aria-describedby`), so a screen reader hears it with the frame's name. The
run line counts them: "… · 5 earlier readings kept".

### Copy

| Where | Words |
|---|---|
| A lens read again over its earlier reading | **Analyzing… This is the earlier reading until the new one lands.** (the spinner beside it; a status) |
| The Opinion read again | Analyzing… This is the earlier Opinion until the new one lands. (decision 47's, unchanged) |
| A reading kept for a reason of its own | **EARLIER READING** The re-analysis did not replace it. *{the host's reason}* |
| The Opinion kept for a reason of its own | **EARLIER READING** The new Opinion did not land, so the earlier one stays. *{reason}* |
| A kept reading whose reason is its call's note | **EARLIER READING** · this call failed: *see its note* by the run line. (or "was stopped", "was cut off") |
| A lens with nothing to keep, its call's note standing | Call E failed: *see its note* by the run line. Analyze to try again. ("was stopped", "was cut off at the output ceiling") |
| The headline, the tension line, with nothing to keep | The headline did not come back. Call A failed: *see its note* by the run line. Analyze to try again. |
| The tension line's badge over a kept arc | earlier |
| No usable tile | The new reading drew no tile: its 3 claims were withheld. / its one claim was withheld. |
| An empty block | The new reading came back with nothing to draw. |
| Template and summary kept together | Summary & movements was not replaced, and the two are kept together, since engagement sits on the movements. |
| The run line | … · 5 earlier readings kept |
| The inspector | Read by model-v1 · Oct 24, 2026, 9:08 AM (a reading from before this slice: Read by model-v1) |
| Two notes of one call (two cut replies, or a failure and an older cut) | Call A · cut off (Theme & motif) / Call A · cut off (Tension arc) |

"Earlier reading" keeps the register honest: it is still a reading, not a
count, and its badge is neutral, never in the measured register's colors.
"The re-analysis did not replace it" stays true in every case, a block that
came back withheld included, where "did not land" would not be.

## 5. A call's failure, said once (decision 52)

**Where:** a note per call **under the run line**, in the board's toolbar
area. I chose it over the Lenses panel's call header and the call's first
widget because:
- it is where the writer acts on a call that did not land: Finish, the run's
  progress and Stop all live there;
- it is on screen whichever rail panel is open (the Lenses panel may be
  closed, and at 500 px the rail stacks above the board);
- it sits above every widget but the headline, and a call's widgets are
  scattered (call A's headline, its tension line under the ribbon, three tiles
  in the grid), so "the first widget of the call" has no stable place.

**What it says:** "CALL A · FAILED" and the host's whole message, the place
the paid reply was saved included, once. A failure or a cut is an alert; a
stop, which the writer asked for, is a status. Calls that did not land in the
same words share one note ("CALLS A, B, C, D, E, G, F · STOPPED"), so a
whole board's Stop is one line.

**Each widget** shows the short line in its place, and is described by the
note. "see its note" is a button named "see its note: Call A · failed"; it
scrolls the note into view and moves the focus there (the note takes focus,
`tabIndex={-1}`).

**Stopped and cut-off calls get the same treatment.** A reply cut off at the
output ceiling withholds the block it was cut inside with the cut's reason and
the saved reply's place (decision 40); the blocks it never reached now say
"The reply reached the output ceiling before this block began." with the same
place (`LightboxGroupReply`; they said "The reading returned no … block."),
so the note gathers the cut once and each widget the cut touched points
there. A block withheld for its own fault, and a reason an older call left
(no note stands for it now), are still said in the widget.

**A note is one call or one cut reply, never a group's every reason** (PR
#170 F-01). Readings are kept until replaced, so one group can hold the
reasons of several calls: the motif kept by one cut reply, the tension by
the next, each saved in its own place. A cut is known by where its reply was
saved, which every reason the cut wrote carries after its first sentence
(`lightboxCutEvent`): one reply cut off is one note however many lenses it
touched, and two replies are two notes, "Call A · cut off (Theme & motif)"
and "Call A · cut off (Tension arc)", the second with its own id
(`pm-lb-call-note-A-2`). Each widget points to the note its own reason is
(`lightboxBoardCallNote(board, group, reason)`), so its link brings the focus
to its own reply's place and the frame is described by that note only. A
failure or a stop is the group's latest call, matched by its whole message,
and stands beside any older cut whose reasons the group still shows. Two cut
replies that could not be saved say the same words, so they share one note,
which says exactly what each would.

**A failure is its own lenses'** (PR #170 N-01). A lens the failed or stopped
call kept says why in its earlier note, pointing to the call's note; a lens
it left with nothing points to the note too. A lens the call never asked for
(a sibling of a lens run on its own) says nothing of it: its reading is not
an earlier one, and the message is the note's alone. A whole-call failure
still says its message once.

## Implementation notes

**New modules:**
- `shared/types/messages/lightboxProvenance.ts` (46): `LightboxLensProvenance` (a landing's, or a model-only one from before this slice), `LightboxEarlierLens`.
- `shared/constants/lightboxProvenance.ts` (130): the keep words, the keep reasons, `LIGHTBOX_KEPT_TOGETHER`, and the per-lens and per-board readers (`lightboxLensHasReading`, `lightboxLensModel`, `lightboxEarlierReason`, `lightboxBoardModels`, `lightboxEarlierLensCount`, `lightboxLensWasRead`).
- `shared/constants/lightboxCallNotes.ts` (26): the ceiling's words, shared by the host and the webview; a test pins the cut's to the reading wire's `LIGHTBOX_CUT_OFF_REASON`.
- `presentation/webview/hooks/domain/lightbox/lightboxCallNotes.ts` (171, pure): each call's failure or stop and each cut reply's note, merged when alike, the note a reason points to, and the short lines.
- `presentation/webview/components/lightbox/LightboxCallNotes.tsx` (83): the notes, the pointer and the call line.

**Changed:** `LightboxReadingState` (288; the rule, `cancelLightboxGroup`, a legacy reading's model carried),
`LightboxPressRun` (the landing's provenance; the basis rule only for a new
Opinion), `LightboxPressScope` (`lightboxPressLens`), `LightboxReadingHandler`
(488, as before), `LightboxService` (495: `clock()`), `LightboxStaleReadings`
(`settledCarry`), `LightboxGroupReply` (never-reached blocks),
`LightboxBoardCodec` (the two fields), `LightboxBoardFiles` (the row's
models), the reading frame, tile frame, headline, tension line, spark lane,
Opinion, inspector and its controller (485), the lens view, the call controls,
the run line, the board's main column, and CSS in `readings.css` and
`board.css` (plain, on the Chromium 114 floor). `LightboxReadingRunner` is
untouched (498 lines; Slice 4L changes its model scope).

The new modules join `boundaries.test.ts`'s Lightbox list, and the pure hook
its transport-free list.

## Tests

New suites:
- `infrastructure/lightbox/LightboxKeepReadings.test.ts` (20): the pure rule.
  Start keeps readings and clears a lens with none; a usable block replaces
  and records provenance; failure, cut, withheld, no tile and empty each keep
  the earlier reading with its standing, stale mark and provenance and the
  reason; one call replacing the headline and keeping the motif; usage adds
  up; a lens with no earlier reading as a first read; lenses outside the call
  untouched; Stop; the mark cleared when a new one lands; the Opinion;
  template and summary together, and the partner with no reading; the
  ceiling words pinned to the wire's; the board's models, with the fallback.
- `application/handlers/domain/LightboxKeepReadings.test.ts` (37), through
  the real handlers, service, runner, store and library: **every scope** (Run
  AI analyses, Run A, the Motifs widget's Analyze, Re-analyze this tile)
  replaces on success and keeps on a failure, a Stop, a cut, a withheld block
  and no usable tile; **Finish** after a failure, the same; **mixed outcomes**
  in one call (the headline replaced, the motif, tension, gravity and palette
  kept), with per-lens model and time, usage over both calls, and the row's
  models and cost; a failed call's model never named; **the Opinion** kept in
  a run of every call and in Finish, replaced when it lands, its basis rule
  moved only then; **saves**: a failed call's save rewrites the one file with
  the earlier readings, marks and provenance, and a reload restores them; a
  Stop saves nothing and loses nothing; **late replies** of a stopped run,
  while the next reads and after it lands, ignored; **stale marks** kept
  through a failure and a Stop, and on the arc a new reply cannot score.
- `infrastructure/storage/LightboxBoardProvenance.test.ts` (5): both format-1
  fixtures read unchanged, byte for byte, their models the groups'; a board
  with the fields reads back whole; a bad provenance entry dropped and
  counted; a bad earlier mark leaves the file unread.
- `presentation/webview/hooks/domain/lightbox/lightboxCallNotes.test.ts` (10,
  pure): the lens view re-analyzing, earlier, an earlier mark with no reading
  ignored; the notes for a failed, stopped and cut-off call, merged when
  alike; the pointer and its words; own withheld blocks apart from the cut's;
  an older call's reason in the widget; the run line's count.
- `presentation/webview/LightboxAppKeepReadings.test.tsx` (9): the earlier
  readings on show while a call reads again (frames, headline, tension line,
  Spark lane), never a skeleton, and a first read's skeleton; the earlier
  label, the note once with its path, each widget pointing there and
  described by it, "see its note" moving the focus; a first failure's short
  lines; a stopped call as a status, merged; a cut-off call; a reason of the
  widget's own; the inspector's provenance and earlier note; **focus
  continuity**: the Motifs widget's focused Analyze through its call's rerun
  over earlier readings, the landing, a failure and a stop.

Changed, from clear-first to keep: `LightboxReadingState.test.ts`,
`LightboxStaleReadings.test.ts` (the stale marks kept through a run of the
whole call; the carried group's earlier mark), `LightboxRunControls.test.ts`
(a re-run keeps its readings while it runs), `LightboxOpinionRerun.test.ts`
(its control flipped: every call keeps, the Opinion in a run of every call
too), `LightboxBoardOwedSaves.test.ts` (B kept on screen through the rerun and
the Stop; **new:** a later C's save holds the kept B), `lightboxCraft.test.ts`
(the endings lane keeps the earlier endings), `LightboxReadingRunner.test.ts`
(the never-reached block's words), `LightboxAppOpinion.test.tsx` and
`LightboxHeadlineWithheld.test.tsx` (the call note), and `boundaries.test.ts`
(the module lists).

**Which tests fail on `cf7f260`.** The 5 new and 10 changed suites, copied
onto an export of `cf7f260` and run there:
- **As CI runs them (type-checked), all 15 fail.** Seven do not compile,
  since what they import or the fields they read are new: both
  `LightboxKeepReadings` suites, `LightboxAppKeepReadings`,
  `lightboxCallNotes`, `LightboxBoardProvenance`, `LightboxReadingState` and
  `LightboxStaleReadings`. The other eight fail 13 tests: the runner's
  never-reached block (1), the module lists (2), a re-run keeping its
  readings (1), the owed saves (4), the Opinion in a run of every call (1),
  the endings lane (1), the headline's call note (1) and the Opinion's
  (2).
- **With type checking off**, to see each test: 5 suites cannot load (the
  new modules are missing), and 10 fail 19 tests: the module lists (2), the
  runner (1), run controls (1), owed saves (4), stale readings (2), the
  reading state (4), the endings lane (1), the Opinion re-run (1), the
  headline (1) and the App's Opinion (2).

## Verification

- **Tests:** 510 suites / 7,091 tests / 59 snapshots, all passing under
  Node 22 (505 / 7,009 / 59 at `cf7f260`). Under Node 18.20.8 a first run
  beside other work missed two wall-clock bounds in suites this slice does
  not touch (`WorkshopApp.showVsTellPassageIntake`'s 5 s test timeout and
  `beingVerbs`' 5,000 ms bound); both pass alone and on the rerun.
- **Lint:** 0 errors, 1,133 warnings, identical per file, rule and severity
  to `cf7f260`.
- **Typecheck** under Node 22 and Node 18.20.8.
- **Builds:** `npm ci` into a real `node_modules`, then `npm run build` with
  `verify:bundle` twice under each Node: `webview.js` `a9aa1ba9…` and
  `extension.js` `2c3ff466…` all four times.
- `git diff --check` is clean. No live or billable call; *Alice* only;
  model ids are placeholders.
- **The guard this slice tripped:** `promptBudgets.test.ts` reads any
  constant named `…_CEILING…` as a prompt budget, so the cut reply's
  words are `LIGHTBOX_CUT_REPLY_PREFIX`, `LIGHTBOX_CUT_INSIDE_REASON` and
  `LIGHTBOX_CUT_BEFORE_REASON`.

## PR #170's review corrections (2026-10-24)

Astra's review asked for changes: two P2 findings and one P3, all made,
after `epic/lightbox` at `13aff89` (Slice 4K, PR #168) was merged in. See
the [author response](../../../docs/pr-reviews/pr-170-lightbox-keep-readings-review.md).

- **F-01: a note is one call or one cut reply** (section 5). Two lens
  reruns of call A, each cut off and saved in its own place, used to share
  the older reply's note: the tension's link focused it, and the newer
  place was nowhere on the board. Each cut reply is now its own note, known
  by where it was saved, and each widget points to the note its own reason
  is.
- **F-02: a reading from before this slice keeps its model** (section 2).
  A format-1 board saved before per-lens provenance, partly re-read under
  another model, named the new model for the readings it kept. Each such
  reading now takes a model-only provenance entry before its group's model
  moves on.
- **N-01: a failure is its own lenses'** (section 5). After a lens run on
  its own failed, its untouched siblings repeated the whole message. They
  now say nothing of it.

**Tests added:** `LightboxKeptReadingSources.test.ts` (5, through the real
host: the two cut lens reruns through a save and a reload, and the
whole-call control; the format-1 fixture opened, partly re-read under
another model, saved and restored, its inspector and row naming both
models, and the failed-rerun control; the single-lens failure's siblings),
`LightboxAppCallNoteEvents.test.tsx` (4: each link focusing its own reply's
note, both places once; the same-event control; a message once after a
single-lens failure and after a whole-call one), and in the pure suites:
`lightboxCallNotes.test.ts` (+6), `LightboxKeepReadings.test.ts` (+6, the
model carried, with a failed rerun, a group that named none and a lost
entry as controls), `LightboxBoardProvenance.test.ts` (+3, the model-only
shapes and a half entry dropped). `lightboxReadings.test.ts`'s failed
re-read case now builds the board 4J writes (the kept lens marked earlier).

**Which tests fail on the reviewed head `bbbc47a`.** The 2 new and 4
changed suites, copied onto an export of `bbbc47a`:
- **As CI runs them, all 6 fail.** Two do not compile (`lightboxCallNotes`,
  which reads the per-event API, and `LightboxBoardProvenance`, which writes
  a model-only entry); the other four fail 12 tests: the pure model
  transitions (5), the host witnesses (4 of 5: F-01, both F-02 and N-01;
  the whole-call cut control passes), the failed re-read (1) and the App's
  F-01 and N-01 cases (2 of 4; both controls pass).
- **With type checking off**, 21 tests fail in the same 6 suites, the two
  that did not compile adding 6 and 3 (two of the 6 are earlier tests that
  now call the per-event API; the other 4 are F-01 and N-01 cases). Every
  control passes there.

**Verification:** 515 suites / 7,196 tests / 59 snapshots, all passing
under Node 18.20.8 (513 / 7,172 / 59 after the merge, before the
corrections, under Node 22, the one time-bound miss passing alone); lint
0 errors and 1,133 warnings, identical per file, rule and severity to
`13aff89`; typecheck under Node 22 and Node 18; `npm run build` with
`verify:bundle` under each Node, `webview.js` `2ffd7bcd…` and
`extension.js` `556346ba…` both times; `git diff --check` clean. The
evidence's states rebuild byte for byte, and the corrected bundle gives the
same `facts.json` and an empty `errors.txt`.

## PR #170's re-review correction (2026-10-25)

Astra's re-review closed F-01 and N-01 and narrowed F-02 to unknown
origins, after `epic/lightbox` at `f75ed80` (Slice 4L, PR #169) was merged
in. The F-02 correction gave every reading without an entry its group's
model at the next settle, as if it came from a board saved before this
slice; in a group that records provenance, such a reading has lost its
origin (an entry the codec dropped, or one left out), and the group's
model is its latest call's. A headline-only rerun under a third model then
wrote the second model onto the motif, and the inspector and the row named
it; a present but empty list read as a board from before this slice at
once.

**The field's presence decides** (section 2): only a group whose
`provenance` is absent is from before this slice. A group with the field,
even empty, gives a reading with no entry `{ lens }` alone, unknown
through every later call. `lightboxLensModel` falls back only when the
field is absent. Once present, the field stays present through every
transition, and an empty list is written and read back as one.

**Tests added:** in `LightboxKeptReadingSources.test.ts`, the three
sequences through the real host (the motif's entry made half so the codec
drops it, left out of a well-formed list, every entry malformed), each
with a headline-only rerun under a third model, a save and a fresh host's
restore, the motif unknown in the board, the inspector and the row, and a
failed whole-call rerun as a control; in `LightboxKeepReadings.test.ts`,
an unrelated rerun (twice), a present but empty list, a failed call and a
cleared lens; in `LightboxBoardProvenance.test.ts`, an empty list written
and read back present, and every entry dropped. **On `bc3ab1c` all 10 fail**
(typed or not: they compile there), and the 39 earlier tests in those files
pass, the ordinary legacy cases included.

**The merge's one semantic conflict:** the webview now reads the
Lightbox's own model selection, so this slice's App tests and the evidence
harness name it in their model data.

**Verification:** 519 suites / 7,257 tests / 59 snapshots, all passing
under Node 18.20.8 (519 / 7,247 / 59 on the merged tree before the fix);
lint 0 errors and 1,133 warnings, identical per file, rule and severity to
`f75ed80`; typecheck under Node 22 and Node 18; `npm run build` with
`verify:bundle` under each Node, `webview.js` `55feaac0…` and
`extension.js` `e060a472…` both times; `git diff --check` clean. The
evidence's states rebuild byte for byte; the merged bundle gives the same
`facts.json` and an empty `errors.txt`, and the captures were rendered
again, since 4L's header changed the page.

## Visual evidence

[`docs/pr-reviews/evidence/lightbox-slice-4j-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4j-visual/README.md):
real host output for eight moments of one board, eleven states at 1440,
1000 and 500 px, each widget and call note checked against the host's board.
`errors.txt` is empty, and two renders give the same `facts.json`; against
`cf7f260`'s bundle the same states fail with 906 errors (a skeleton or
nothing over each earlier reading, no earlier note, the call's message in
every widget and no call note).

## For the writer to decide

- **An empty answer.** A new block that drew no tile keeps the earlier
  reading, including a block that legitimately found nothing ("no recurring
  motif"). Should an empty answer replace an earlier non-empty one? Today it
  does not; the earlier reading stays, labelled, with "The new reading came
  back with nothing to draw."
- **Template and summary together.** When the new summary is withheld, a new
  template that stood is set aside with it, so the template's engagement
  never sits on movements of another reply. The alternative is to show the new
  template without engagement beside the earlier movements.
- **A lens turned off, then its call run.** Its earlier reading is not read
  again, so it stays, hidden while the lens is off and back when it is turned
  on. Clear-first used to drop it.
- **Never-reached blocks of a cut reply** are all said to be cut off ("before
  this block began"), even one the model skipped before the cut; the codec
  cannot tell the two apart.
- **The inspector's Re-analyze this tile** is still a `disabled` button while a
  run is in flight, so its focus drops when pressed (a widget's Analyze keeps
  it). Making it `aria-disabled` like the widgets' is a small follow-up.
- **The note's place.** Under the run line, as above; the Lenses panel's call
  header could also carry a small "failed" mark.
