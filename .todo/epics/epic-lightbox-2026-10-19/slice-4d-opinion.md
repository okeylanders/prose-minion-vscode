# Slice 4D: Opinion (Group F)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D6, D7 **addendum (2026-10-20)**, D11
**Design:** [`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html) section 8 (draft, 2026-10-20)
**Writer decisions:** 14, 15 and 16 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Planned. Stacked on Slice 4C.
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

## Done when

One press reads every group and then the Opinion, whose three views weigh
the same observations, each citing the board; a view that cites anything
else is withheld; the tile goes stale when a cited lens changes.
