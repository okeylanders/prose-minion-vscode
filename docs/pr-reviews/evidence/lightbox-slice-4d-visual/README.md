# Lightbox Slice 4D visual evidence: the Opinion

Lightbox Slice 4D adds group F, the Opinion. It is the board's one
evaluative tile (ADR 2026-10-19 D7 addendum). One call reads the board's
checked digest, never the chapter, and returns observations that cite
board items, plus three views of them. Code checks every citation and
every view, withholds what breaks a rule, and marks the Opinion stale when
anything it cites changes.

This folder shows from real host output:
- each view;
- an observation lighting its paragraphs;
- the Blunt view brought to the Workshop by name;
- a view code withheld;
- the Opinion gone stale after a lens it cites was read again.

The harness is adapted from
[`../lightbox-slice-4c-visual/`](../lightbox-slice-4c-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px: seven states, and three of them again on the simulated floor (`floor-…`) |
| `workshop/workshop-composer-<width>.png` | The Workshop with the Blunt view staged above its composer, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages: `idle` (the board, measured), `done` (groups A, B, D, E and then F read), `bound` (the tray, then the answer, for the Blunt view brought), `withheld` (the Opinion read again, its Blunt view withheld), `stale` (Stock & signature read again). `lensesOff` holds the lenses group F's worked example was read without; `estimates` is the host's estimate answer, which the harness gives the tab's own estimate requests, echoing each request's id (PR #149 F-03) |
| `states/workshop.json` | `composer`: the Workshop session state after the view was staged, as its real session snapshots it; `handoff`: everything the Workshop's tile handler and the seed delivery posted to the Workshop webview |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, and writes `facts.json` and `errors.txt` |
| `facts.json` | What each state's page showed, read from the DOM by `harness.js`: the Opinion's tabs, view, observations, notes and Bring, the lit paragraphs, what was posted, whether the document overflows horizontally, and the ribbon's grid edges (`ribbonGrid`, measured as the Slice 4C harness measures them) |
| `errors.txt` | Every page error, console error and ribbon misalignment (an edge more than half a pixel out of line, or a clipped lane label), one per line; empty for this run |
| `tools/build-opinion.test.ts` | How `states/` was made |

### States

- **`neutral`.** The Opinion, last on the board, labelled "The one
  evaluative tile" beside its Read badge. It has three view buttons, with
  Neutral pressed (`aria-pressed`). The headline, body and Why list each
  carry a weight chip (Strength, Even, Concern) and the observation ids
  they weigh. The six observations all three views share sit under the
  views, each with its cited items and quotes. Then come "Read 33 board
  items.", **Bring this view to Workshop →**, and **Re-read the
  Opinion**, priced "1 call · est. $0.07 · up to its digest bound".
- **`enthusiastic` and `blunt`.** The same tile with the other views
  pressed. The observations stay the same; only the temperament changes.
- **`observation-hover`.** O2 (the long sentences) hovered. The ribbon's
  focus lane lights ¶2–¶8, the paragraphs its cited items touch, and the
  ribbon caption shows the observation.
- **`bound`.** The Blunt view chosen and brought, so it is "Bound for
  Workshop". (This is not the digest at its token bound: no state shows a
  saturated digest. The digest tests and the slice's implementation notes
  cover the bound.)
  - The webview posted `lightbox_hand_off` naming the board, the tile and
    `"view":"blunt"`, and nothing else about it.
  - The Workshop's tile handler staged it after the delivery granted the
    claim.
  - The host's tray message and its answer are replayed.
- **`withheld`.** The Opinion read again (one call, group F alone). This
  answer's Blunt view says "In the chase the sentences should be
  shorter.", which prescribes, so code withheld that view. The tab says
  "withheld". Pressed, it shows only the host's reason, never the view's
  words. Bring is disabled with the reason.
- **`stale`.** Stock & signature read again (one call, group D alone). The
  tiles that O1 and O6 cite now have new ids, so the Opinion reads stale:
  - The note says "Something it cites changed since it was read (O1, O6)".
  - O1 and O6 and their cites say "changed since".
  - Bring is disabled until the Opinion is read again.
  - Nothing else on the board changed.
- **`floor-neutral`, `floor-observation-hover`, `floor-stale`.** The same
  states on the declared floor (VS Code 1.75, Chromium 102), simulated as
  the Slice 4C harness simulates it: every `subgrid` declaration is dropped
  from the page's stylesheets before measuring. This is not a Chromium 102
  run.
- **`workshop-composer`.** The Workshop with the view waiting above the
  composer: "Lightbox Opinion · Blunt view: …", "from the Lightbox · 2
  quotes", removable, "rides the next message only". Nothing was sent.

### How the states were made

`tools/build-opinion.test.ts` drives the production `LightboxService`,
`LightboxHandler` (with its handoff route and the Workshop tray port over
the real session), `LightboxReadingHandler` and `LightboxReadingRunner`.
It also uses the real prompt builder, codec, quote verifier, term counter,
and the Opinion's digest and gates. On the Workshop side it uses
`WorkshopLightboxTileHandler` over a real `WorkshopSessionService`, behind
the real `WorkshopSeedDelivery`, as the Slice 4C builder does. Only the
provider is played.

- **The press.** Groups A, B, D and E answer with the prompt bundle's
  worked examples, verbatim. The builder asserts that group F is asked
  only after all four have answered, and that its request is group F's
  worked example's, byte for byte. Group F then answers with its worked
  example, verbatim, and every part is drawn: 6 observations and 3 views.
- **Lenses.** Group F's example's lenses are on, so the press is 5 calls;
  group C (and with it the Spark lane) is off.
- **The run token** of the first run is the worked example's
  (`5b1e09c4-…`), so the tile ids are the example's.
- **Two answers were written for this evidence.**
  - The Opinion re-read is the worked example with one sentence of its
    Blunt view replaced by a prescription.
  - The stock re-read is group D's worked example again, under new ids.
- **The writer's average is a stub**: the test fixture's synthetic counts
  (`WRITER_AVERAGES`), since the evidence has no project folders. No
  publishing-standards preset is selected, as on the worked example's
  board.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output
  tokens. No provider was called.
- **What else the builder asserts:**
  - the withheld view;
  - the standing after the stock re-read (stale; O1 and O6 changed);
  - that the handoff port received a tile only;
  - that no log line carries the chapter's, a reading's or the Opinion's
    words.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain. This is the worked
examples' own excerpt, as their request blocks hold it. The Blunt view's
prescription is a sentence written for this evidence.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system. In this monospace font the
  observation ids ("O1") look like "01".
- The Workshop does not reflow at 500 px (tech debt
  `.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md`), so
  `workshop-composer-500` shows the pill's left half.
- At 1000 px the inspector opens over the rail, as it did before this
  slice.

## Results

From the committed `facts.json`, against the bundle a clean `npm run build`
writes at this branch's head. That head has Slice 4C's PR #156 fixes and
its F-04 fix merged in, and PR #157's F-01 residual fixed (`webview.js`
SHA-256 `0f6624f4185b4aa7739c9e37b7ccd781d45788a455d9f18a958199abb90bf3f6`).
Every state reads the same at 1440, 1000 and 500 px.

**Bundle provenance.** Each bundle here was built from an empty `dist/`,
after `npm ci` into the worktree's own `node_modules`. It is a real
directory, not a symlink to another checkout: webpack's production module
ids come from file paths, so a symlinked `node_modules` gives another hash,
as Slice 4C found. The earlier hashes (`22c285aa…` at `f5e1451`,
`3e3573ed…` at `40a9317`, and `55276cad…` at `13be775`) were built the
same way. The review reproduced the first two exactly.

**Rerenders.**
- **After the PR #157 fixes (`40a9317`).**
  - `states/` was byte-identical, and `facts.json` was identical to the
    first run's.
  - 20 of 24 screenshots were byte-identical. Four differed in 4 to 19
    pixels of the 1440 px header strip, which is rendering noise.
- **After merging 4C's PR #156 fixes and fixing the F-01 residual
  (2026-10-21).**
  - `states/` regenerated byte-identical. Neither change touches what
    these states hold: the worked example's lenses include neither Subtext
    nor Lexical gravity, and the excerpt has no front matter.
  - `facts.json` is identical apart from the new `ribbonGrid` entries.
  - Every Lightbox screenshot changed, because 4C draws the ribbon above
    the Opinion as one grid (PR #156 F-03). The Opinion card itself reads
    as before.
  - Of the Workshop captures, the 1000 and 500 px ones are byte-identical,
    and the 1440 px one differs only in the header strip, as before.
- **After merging 4C's F-04 fix (the ribbon as one plain grid, no subgrid;
  2026-10-21).**
  - `states/` regenerated byte-identical.
  - For the 24 shared states, `facts.json` is identical apart from
    `ribbonGrid`, which now also checks each label block beside its track.
  - The plain grid draws the ribbon pixel for pixel as the subgrid did:
    21 of 24 screenshots are byte-identical. The other three (`neutral`,
    `blunt` and `workshop-composer`, at 1440 px) differ in 4 to 19 pixels
    of the header strip.
  - The three new `floor-` states drop no `subgrid` declaration, since none
    is left. They are pixel-identical to their twins at 1000 and 500 px,
    and differ only in the 1440 px header strip.

| State | What the page shows |
|---|---|
| `neutral` | The Opinion is the last tile, register `read`. Its chip reads "The one evaluative tile". Tabs: Enthusiastic `false`, Neutral `true`, Blunt `false`. Headline: "A distinctive voice carries a familiar descent; long sentences and scarce speech trade pace for texture." Why: Strength (O1 · O4), Even (O2 · O5), Concern (O6). Six observations, citing 2, 2, 3, 2, 2 and 2 items. "Read 33 board items." Re-read: "1 call · est. $0.07 · up to its digest bound". The lens card shows "5 calls · est. $0.25 · the Opinion up to its digest bound" |
| `enthusiastic` | Enthusiastic `true`. Headline: "A voice that sounds like no other turns a fall into a browse, and two objects quietly plot the way down." Why: three Strength points |
| `blunt` | Blunt `true`. Headline: "The pace pays for the voice: long sentences and little speech slow the chase." Why: Concern (O2 · O5), Concern (O6), Even (O3) |
| `observation-hover` | Lit paragraphs: ¶2–¶8 |
| `bound` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-5b1e09c4-F-1","view":"blunt"}` and nothing else. **Bound for Workshop** is disabled, with **Open Workshop →**. Header: "1 tile bound for Workshop · Open Workshop →" |
| `withheld` | Blunt tab shows "withheld" `[aria-pressed=true]`. "Withheld The Blunt view directs a change. The Opinion diagnoses; it never gives a rewrite or says what to do." Bring is disabled: "This view was withheld, so there is nothing of it to bring." |
| `stale` | "Stale Something it cites changed since it was read (O1, O6): a tile was read again or withheld, a lens went stale, or a figure was measured again. Re-read the Opinion to weigh the board as it stands." O1 and O6 show "· changed since". Bring is disabled: "Something this Opinion cites changed since it was read. Re-read the Opinion before bringing it." Blunt is still withheld from the re-read |
| `workshop-composer` | One pill, "Lightbox Opinion · Blunt view: The pace pays for the voice: …", "from the Lightbox · 2 quotes". Tooltip: "Opinion · Blunt view from the Lightbox's reading of Drafts/alice-chapter-1-opening.md: the claim and the quotes found in the chapter". Hint: "rides the next message only" |
| Horizontal overflow (document) | None, in any state or width (`horizontalOverflow: false` in every entry of `facts.json`; a document-width check, so it does not rule out clipping inside a scrolled region) |
| `floor-neutral`, `floor-observation-hover`, `floor-stale` | The same Opinion facts as `neutral`, `observation-hover` and `stale`; `subgridDeclarationsDropped: 0` |
| Ribbon grid (`ribbonGrid`, all 30 Lightbox captures: 10 states at 3 widths) | 8 paragraph columns against 8 Pressure cells and 3 movement bands: track, column and band edges 0 px apart. Both label blocks sit left of their tracks with full vertical overlap, no lane label falls outside its track, and none is clipped. A missing track, label block or cell count would be written to `errors.txt` |

- No page errors and no ribbon misalignment in any state or width
  (`errors.txt` is empty).
- `states/log.txt` names paths, counts, digest key prefixes and outcomes
  only, for example "group F digest: 33 items, 29 readings, 0 left out,
  about 2,988 tokens, key 6f93cb4f00b6" and "Group F landed on digest
  6f93cb4f00b6, the board it read: current".

**Fixed while making it.** At 1440 px the lens card's longer cost note ("·
the Opinion up to its digest bound") ran into the "Lenses" eyebrow. The
card head now keeps a gap and right-aligns the note (`rail.css`).

## Rerunning it

Build the bundle and copy it out:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js $DIR/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js $DIR/webview.js $DIR/visual
```

Then copy `$DIR/visual/lightbox-*.png` into `lightbox/`,
`$DIR/visual/workshop-*.png` into `workshop/`, and `facts.json` and
`errors.txt` here.

To rebuild `states/`:
1. Copy `tools/build-opinion.test.ts` into `packages/core/src/__tests__/`.
2. Run it with
   `LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-opinion.test.ts`.
3. Delete the copy. Do not run the full suite while the copy is there:
   jest collects it.
4. Copy `$DIR/states/*` here.

`$DIR` defaults to `/tmp/lightbox-4d`; keep it outside the repository. No
fixture file is needed: the text is the worked examples'.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
