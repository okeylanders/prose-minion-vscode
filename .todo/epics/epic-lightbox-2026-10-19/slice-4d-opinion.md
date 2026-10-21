# Slice 4D: Opinion (Group F)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D6, D7 **addendum (2026-10-20)**, D11
**Design:** [`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html) section 8 (draft, 2026-10-20)
**Writer decisions:** 14, 15 and 16 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented, awaiting review (`epic/lightbox-slice-4d-opinion`). Stacked on Slice 4C (`797e166`).
**Before:** Slice 5.

## Outcome

**Opinion** is the one evaluative tile on the board, and the fenced
exception to "describe, never grade" (ADR D7 addendum). One call returns:

- a shared list of **observations**, each citing tiles or checked quotes on
  the current board;
- three **views** of those same observations, which the writer clicks
  between: **Enthusiastic** (what is working), **Neutral** (weighed evenly)
  and **Blunt** (what costs the most). Each has a headline, a short
  paragraph and a "Why" list whose points are weighted Strength, Even or
  Concern and cite observations.

Same facts, three temperaments: the views may weigh only the shared
observations, and code rejects a view that cites anything else. The default
view is **Neutral**. Blunt diagnoses the work, never the writer, and gives
no rewrites. The observations are shown under the views. The writer can
ignore the tile, and ignoring it changes nothing else.

## Group and run order

- `LightboxReadingGroupId` gains `'F'`, with one lens, `opinion`, key
  `"opinion"`, prompt `70-opinion.md`, example `45-example-group-f.md`.
- **It runs last.** In a press whose plan includes F, the runner starts F
  only after every other group of that press has settled (ok, failed or
  stopped); a stopped press never starts F. It uses whatever verified tiles
  exist then. "Re-read this tile" runs F alone on the current board.
- **Input: the board's verified digest, never the chapter.** The host builds
  `LightboxOpinionDigest` from the board as it stands: each current
  (non-stale) reading tile by host id, kind, lens, title and claim, its
  found quotes (¶ and the chapter's own text) and its host counts; the
  measured standouts and headline stats. No raw paragraph text, no context
  file, no withheld claim's words. It is bounded
  (`PROMPT_BUDGETS.lightbox.opinionDigestCharacters`), tiles in lens order,
  and states what it left out. Because quotes reach the model only as
  verified spans with ids, Opinion cannot invent a quote: it cites, it never
  quotes.
- **Estimate.** At estimate time the digest of the eventual board is not
  known, so F is priced at the digest's bound ("up to"), and the run line
  says so. Its key covers the lens set, the model and prices; the digest is
  built at F's start and logged by size only.

## Wire format and codec rules

```
"opinion": {
  "observations": [{"id": "O1", "text": "...", "cites": [{"tile": "lbt-…-3"}, {"tile": "lbt-…-7", "quote": 0}]}],
  "views": {
    "enthusiastic": {"headline": "...", "body": "...", "why": [{"weight": "strength", "text": "...", "observations": ["O1"]}]},
    "neutral":      {...},
    "blunt":        {...}
  },
  "friction": "..."
}
```

- `strictObject`, host-owned reasons, friction required, no counts.
- **Observations.** 2–6; ids are `O1`…`O6`, unique. Each cites 1–3 board
  items: a tile id that is a current reading on the board (never a stale or
  withheld one), optionally one of its found quotes by index. An observation
  citing anything else is withheld by its id; its text never quotes the
  chapter (no quotation marks around chapter words; the citation carries the
  quote).
- **Views.** All three are required. Each `why` has 1–4 points, weights in
  `strength | even | concern`, each citing 1–3 observation ids from this
  response's drawn observations. **A view citing an observation that is not
  drawn is withheld whole** ("A view may weigh only the observations below").
- **Blunt.** Diagnosis only: a directive or rewrite word list
  (`LIGHTBOX_OPINION_REWRITE_WORDS`: rewrite, replace with, change it to,
  try, should, cut, …) and a writer-directed list ("you are", "you always",
  "your writing") withhold the Blunt view. The limit is stated, as Spark's
  is: a word list, not a parse.
- **Neutral** must exist for the tile to draw: without it the tile is
  withheld, since it is the default view.

## Gates and stale carry

- Fresh and carried alike: an observation stands while every tile it cites
  is on the board, current, and (for a quote citation) still holds that
  quote; a view stands while every observation it cites stands.
- **Stale.** The tile goes stale when any tile it cites changes: re-read,
  carried stale, withheld or gone. It is not carried onto changed text
  beyond that mark: the Opinion's lens is stale when any cited lens is, and
  re-reading it builds a new digest.
- Ignoring it changes nothing: no other tile reads the Opinion.

## Bring to Workshop

The shown view can be brought (ids only): its headline and paragraph as the
claim, its Why points as points (weight and text, up to three), and the
quotes its observations cite, re-checked like any tile's. A stale Opinion is
refused, as any stale tile is.

## Webview

- A full-width tile with its own register chip ("The one evaluative tile")
  as the design draws it: three view buttons (Neutral pressed by default),
  the view's headline, paragraph and Why list with weight chips and cited
  observation ids, and the shared observations under them, each with what it
  cites. Hovering an observation lights the cited tiles' paragraphs.
- Its foot says it runs last on the checked board, goes stale when a cited
  lens changes, and that ignoring it changes nothing.
- The chosen view is a webview preference (persisted like the filter); the
  host never stores which view the writer looked at.

## Tests

- Codec: three views required; a view citing an undrawn observation; an
  observation citing a stale, withheld or unknown tile; Blunt's word lists
  and stated limits; Neutral missing.
- Run order: F waits for A–E to settle; a stopped press never starts F; a
  re-read runs F alone; F's digest holds no paragraph text (a test searches
  it for every paragraph's words beyond the cited quotes).
- Stale: re-reading a cited lens marks the Opinion stale; an uncited lens
  does not.
- Webview: Neutral by default; switching views; the observations shown.

## Implementation notes (2026-10-21)

This section records what landed and where it differs from the plan above.
Where the coordinator's brief added detail to this spec, the brief was
followed, and each such point is marked *(brief)*.

### Contracts and files

- **Prompt files are 57 and 45** *(brief: the next free numbers)*, not 70:
  `57-opinion.md` and `45-example-group-f.md`.
  - The Opinion's system message is only those two files. It does not
    include `00-lightbox-shared.md`, which is the chapter groups'
    protocol: paragraph markers, quoting the chapter, counts.
  - The Opinion's lens file states its own frame, ceilings and text
    rules.
  - The worked example is the real request the host built for the *Alice*
    board, with groups A–E read from their own worked examples and eight
    lenses on. Its response decodes and passes every gate whole.
- **New modules**, all in `LIGHTBOX_MODULES` and the boundary lists.
  - Host: `LightboxOpinionWire`, `LightboxOpinionCodec`,
    `LightboxOpinionPhrasing`, `LightboxOpinionGates`,
    `LightboxOpinionDigest`, `LightboxOpinionReply`, `LightboxOpinionCall`
    and `LightboxOpinionHandoff`.
  - Shared: `shared/types/messages/lightboxOpinion.ts`,
    `shared/constants/lightboxOpinion.ts` (views, labels, standing) and
    `shared/constants/lightboxOpinionItems.ts` (what can be cited, and how
    the digest words it).
  - Webview: `lightboxOpinion.ts`, `useLightboxOpinionView.ts`,
    `LightboxOpinion.tsx` and `opinion.css`.
  - `LightboxReadingHandler` was at 497 lines, so the press's listener and
    landing moved to `LightboxPressRun.ts`.
  - `LightboxReadingRunner` is at 498 lines, with F's call in
    `LightboxOpinionCall`.
- **Typical output** for the Opinion is a guess of 1,400 tokens, labelled
  as one.

### The digest

- **Bounded in the engine's estimated tokens**, not characters:
  `PROMPT_BUDGETS.lightbox.opinionDigestTokens`, 9,000. The estimate
  prices F's call "up to" that bound, and the fit check reserves the same
  number. The worked example's digest is about 3,000 tokens.
- **What is in it:**
  - the measured headline;
  - each figure that stands out (`standout:<stat>`);
  - the first 24 sections (`section:<n>`, `opinionSections`);
  - then every current reading tile in board order, each under its host id
    with its label, its claim, its kind's own fields in host words, its
    counted terms, and up to three of its found quotes, numbered `q0`–`q2`.
- **How it is worded.** Shares are "per 100 words", and the writer's
  average is "the other chapters' average"; the digest never says "your".
  A section is named by its range and marker, never by its heading's words.
  No paragraph text enters it except found quotes and counted terms, and no
  context file or path does either. A test searches it for every 7-word run
  of the chapter.
- **Left out, and named in a closing note:**
  - lenses stale or being read again;
  - readings past the bound, in board order
    ([tech debt](../../tech-debt/2026-10-21-lightbox-opinion-digest-board-order-cut.md));
  - sections past 24.
- **Never in the digest:** sparks, the Opinion itself, and withheld
  claims. Measured items are never dropped for the bound.
- **Sparks are left out** (a deviation). A spark is an offer the writer may
  set aside, not a reading of what the chapter does.
- **The key** is a SHA-256 over:
  - the board id and its content hash;
  - its **measurement context**: the preset's comparison, where the
    writer's average came from, and every figure row with its value, range,
    average and standout;
  - each held item's key and basis;
  - the keys left out.

  The same text measured again under another average is another key, even
  when no item the digest shows changed. A test fails without the
  measurement context.

### Run order

- Chapter calls run first, concurrently. F starts after every one has
  settled, only while the run still owns its board.
- The press owner builds the digest by board id, through
  `lightboxOpinionPort`, from the board as those calls left it.
- A stopped run never starts F.
- With no current reading, nothing is sent and F fails in host words:
  "Nothing on the board is read and current…".
- Failure stages are the host's own: `digest` (building the board's digest)
  and `weigh` (checking F's reply).
- A re-read of the Opinion runs F alone.
- The run line says "Weighing the board for the Opinion…" while F is the
  only group out. The lens card says "up to six grouped calls".

### Codec

- **The block** is a `strictObject` of `observations`, `views` and
  `friction`, and friction is required. Reasons are host-owned. Undefined
  fields are counted, never named.
- **Observations:** 2–6, ids `O1`–`O6` (a duplicate is withheld by
  position). Each has text of at most 200 characters and 1–3 cites.
- **Cites.** A cite is exactly `{tile, quote?}` (quote a whole-number
  index) or `{measured}`. Keys are at most 120 characters with no
  whitespace.
- **Measured refs can be cited** (a deviation; the brief says "measured
  refs"): `headline`, `standout:<stat>` for a figure that stands out, and
  `section:<n>`.
- **Views.** All three keys are required; a missing view withholds the
  block. Each view decodes on its own, so a format fault withholds that
  view alone, by name. A view has a headline of at most 120 characters, a
  body of at most 320, and 1–4 Why points. Each point has a weight
  (`strength`, `even` or `concern`), text of at most 120 characters, and
  1–3 observation ids.

### Gates and text rules

These are fresh and carried alike, in `LightboxOpinionGates`.

**An observation is withheld by its id when:**
- it cites an item that is not on the board it read. Fresh, that means an
  item of the digest, which holds only current, drawn readings; carried, an
  item of the rebuilt board;
- it cites a quote of a measured item;
- it cites a quote its tile does not hold. Fresh, the quote is checked by
  the digest's number; carried, by its words, followed to where they now
  stand;
- its text breaks a text rule.

**A view is withheld whole when:**
- it weighs an observation that is not drawn;
- any of its texts breaks a text rule.

**The tile.** It joins `LightboxTileGates` (`opinionViews`) and is withheld
only when **no** view stands *(brief)*. The spec had "Neutral must exist".
The tile opens on Neutral when it stands, otherwise on the first view that
does, and its claim is that view's headline.

**The text rules** (`LightboxOpinionPhrasing`) apply to **every**
observation and every view, not only Blunt (a deviation, stricter):
- **no double quotation marks.** It cites; it never quotes;
- **no writer words**: you, your, yours, yourself, you're, you've, you'd,
  you'll, the writer('s), the author('s);
- **no rewrite words** (`LIGHTBOX_OPINION_REWRITE_WORDS`): rewrite,
  rework, revise, replace, change it/this to, cut, trim, tighten, shorten,
  delete, remove, fix, try, consider, should, shouldn't, ought, must,
  needs to, need to, would be better, would read better, make sure. Also no
  clause that opens with an instruction (Spark's check, shared);
- **no `%` or "percent"**;
- **no figure the cited items do not show.** An observation may state only
  figures its cited items show. A view may state only figures the items of
  its observations show. `O1`–`O6` are not figures; paragraph numbers are.

**Stated limits** (also in the module):
- the checks are English word lists, not a parse;
- a prescription phrased without a listed word passes, for example "the
  chase would gain from shorter sentences";
- "twice" and "half" are not figures;
- a number any cited item shows passes, even when the observation ties it
  to another measure;
- apostrophes and single quotation marks are not checked.

### Staleness and carry

- **Standing is derived, never stored** (`lightboxOpinionStanding`, one
  shared function for the webview, Bring and the landing log). This
  differs from the plan's "the Opinion's lens is stale when any cited lens
  is": no host write is needed when a cited tile changes. The Opinion is
  stale when:
  - its own lens was read against an earlier text (D4); or
  - any item it cites is gone, not current, or says something else (its
    basis changed).

  It stays current when an uncited lens is read again.
- **Carry** re-gates the Opinion against the rebuilt board, after the other
  groups. A cite must still exist, a quote is followed by its words, and
  figures are checked again. It is marked stale, and a running F is
  cancelled. Each cite keeps the basis it was read with.
- **A late F** whose cited items changed while it was out (a same-text
  rebuild under another average) lands stale, never current. The log
  compares digest keys by prefix.
- **The basis** hashes the item's digest wording; Slice 5 must decide what
  a saved basis means
  ([tech debt](../../tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md)).

### Bring to Workshop

The decision: **the view on show can be brought, by name, and nothing else
of the Opinion.**

- The webview sends ids and the view's name (`view` on the tile payload),
  and the host resolves both.
- The host refuses:
  - a withheld view;
  - an Opinion whose standing is stale, not only one with a stale mark;
  - a view none of whose observations' quotes is found again.
- The item carries:
  - the headline as its title and the body as its claim;
  - up to three Why points (weight and text);
  - the quotes its observations cite, checked again and bounded;
  - the kind label "Opinion · Blunt view".
- Never sent: the other views, the observations' words, the digest or its
  key.

### Webview

- The tile is drawn last, full width, after the Spark lane
  (`LIGHTBOX_READING_LAYOUT.last`).
- **The chip and tabs.** It carries the chip "The one evaluative tile" and
  three `aria-pressed` buttons. A withheld view's tab says "withheld", and
  pressing it shows only the host's reason.
- **Observations and hover.** Under the views it lists the observations
  with their cites. Hovering one lights the paragraphs its cited items
  touch.
- **Notes and controls:**
  - a stale note naming the observations that changed;
  - the digest note ("Read 33 board items.");
  - its own re-read, priced "up to its digest bound";
  - Bring for the view on show.
- **The chosen view** is a webview preference, `lightboxOpinionViews`,
  kept per board for the newest 12 boards. The host never learns it except
  through Bring.
- **Ignoring it changes nothing.** A test compares every other frame
  with and without an Opinion.

### Limits

- **No ceiling debt.** F's largest response, with every field at its
  ceiling, is 8,031 characters against the 32,000 cap.
- **Font.** In the evidence's monospace system font, observation ids
  ("O1") look like "01".

### Verification

- The counts are in the epic's progress note.
- Checks run: typecheck; the full jest suite; lint identical per file and
  rule to `797e166` (0 errors / 1,133 warnings); the production build with
  `verify:bundle`; the diff whitespace check.
- Visual evidence:
  [`lightbox-slice-4d-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4d-visual/README.md).
- No live or billable call.

## Done when

One press reads every group and then the Opinion, whose three views weigh
the same observations, each citing the board; a view that cites anything
else is withheld; the tile goes stale when a cited lens changes.
