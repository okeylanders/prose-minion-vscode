# Lightbox Slice 4C visual evidence: the story lenses

Lightbox Slice 4C adds group E: template and freshness, pressure,
artifacts, and summary and movements, with a measured Sections lane (ADR
2026-10-19 D4, D7 and its 2026-10-20 addendum). This folder shows those
tiles, the ribbon's Sections, Movements, Pressure and Engagement lanes, the
inspector on a thread, a movement brought to the Workshop, and a stale
board, from real host output. The harness is adapted from
[`../lightbox-slice-4b-visual/`](../lightbox-slice-4b-visual/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox at 1440, 1000 and 500 px |
| `workshop/workshop-composer-<width>.png` | The Workshop with the movement staged above its composer, at 1440, 1000 and 500 px |
| `states/chapter.json` | The host's Lightbox messages: `idle` (the board, measured, before any reading), `done` (groups D and E read), `bound` (the tray, then the answer, for the movement brought), `stale` (the board rebuilt after the chapter changed on disk). `lensesOff` holds groups A–C's lenses, off for this evidence; `estimates` and `estimatesStale` are the host's estimate answers before and after the change, which the harness answers the tab's own estimate requests with, echoing each request's id (PR #149 F-03) |
| `states/workshop.json` | `composer`: the Workshop session state after the movement was staged, as its real session snapshots it; `handoff`: everything the Workshop's tile handler and the seed delivery posted to the Workshop webview |
| `states/log.txt` | Every line the host logged while the states were made |
| `harness.js` | Renders a built `webview.js` as the Lightbox and the Workshop surfaces behind a stubbed VS Code API, replays each state's messages, screenshots it once two consecutive frames match, measures the ribbon's grid, and writes `facts.json` and `errors.txt` |
| `facts.json` | What each state's page shows, from the final run, with `ribbonGrid`: the ribbon's measured column, track and band edges and clipped labels (PR #156 F-03) |
| `errors.txt` | Page errors and ribbon misalignments from the final run: empty |
| `errors-797e166.txt` | The same harness against the bundle built from `797e166`, before the F-03 fix: the misalignments it measured |
| `tools/build-story.test.ts` | How `states/` was made |

**States:**
- `sections-measured`: before any reading. The ribbon's Sections lane is
  measured by code at no cost: the excerpt's one heading (¶1) opens the
  chapter but divides nothing, and the lane says so. The read lanes say they
  are not read yet.
- `template`: the template ("Portal descent") with its description and
  quote; five beats, each quoted (Departs, Aligns, Aligns, Subverts,
  Subverts); engagement by movement (I low, II high, III medium), "a reading
  of pull, not the tension score"; freshness on the three-step scale, Fresh,
  labelled "a reading, not a grade", over the counted basis line; and a link
  to the tier mix where it was counted.
- `pressure`: four threads, each with its track across the ribbon (planted,
  builds, resolved, still open), the counts code made (4 threads, 1 resolved
  here, 3 carried out, 1 dormant), and the dormant thread's check.
- `artifacts`: four objects with code's first paragraph and mentions, each
  arc as read, and "planted, unused" on the two code bears out.
- `summary`: the Sections note (measured), the synopsis with its three
  quotes, and the three movements with their ¶ ranges, boundary quotes and
  engagement.
- `ribbon`: the ribbon with its story lanes: Sections (measured), Movements
  and Engagement (read, hatched), Pressure (open threads per paragraph,
  counted from the threads read). At 500 px it is scrolled into view, below
  the stacked rail.
- `inspector`: "Will the fall ever end?" pinned: its plant and escalation
  found verbatim, its span ¶6–¶8 counted by code, the order check, where the
  reading strains, and **Bring to Workshop →**.
- `bound`: movement II pinned and brought. The webview posted
  `lightbox_hand_off` naming only the board and the tile. The Workshop's tile
  handler staged it after the delivery granted the claim; the host's tray
  message and its answer are replayed.
- `stale`, `stale-pressure`, `stale-ribbon`: on disk, a scene break (`* * *`)
  went in before ¶6, and the jar in ¶7 is no longer empty ("but to her
  great disappointment it was empty" → "and it was full"); the file was
  re-read. The board is rebuilt from the new text and groups D and E carried
  over: each tile says "Stale"; the Sections lane, measured afresh, now
  draws Scene 1 (¶1–¶5) and Scene 2 (¶6–¶9); each movement starts where its
  boundary quote now stands (II ¶4–¶6, III ¶7–¶9) and engagement follows
  them; the jar's thread is withheld because its resolution is gone, and
  the Pressure lane counts where the other threads now stand; the jar's
  arc keeps its two steps still in the chapter; the basis line names both
  stale halves instead of counting.
- `workshop-composer`: the Workshop with the movement waiting above the
  composer: "Lightbox Movement: The chase · from the Lightbox · 1 quote",
  removable, "rides the next message only". Nothing was sent.

**How the states were made.** `tools/build-story.test.ts` drives the
production `LightboxService` (measuring the numbers against the MG preset
through the real `StandardsService`, and the Sections lane),
`LightboxHandler` (with its handoff route and the Workshop tray port over the
real session), `LightboxReadingHandler`, `LightboxReadingRunner`, prompt
builder, codec, quote verifier and term counter, and the Workshop's own
`WorkshopLightboxTileHandler` over a real `WorkshopSessionService` behind the
real `WorkshopSeedDelivery`, as the Slice 4B builder does. Only the provider
is played.

- **Groups D and E** answer with the prompt bundle's worked examples,
  verbatim; every quote is the chapter's own and the host checks each one
  (group D: 39 checked; group E: 29 checked; none withheld). Group D is read
  because its tier counts are half of the freshness basis.
- **Groups A, B and C are off**, so this evidence spends two calls.
- **The writer's average is a stub**: the test fixture's synthetic counts
  (`WRITER_AVERAGES`), since the evidence has no project folders.
- **The model is a stub**, `provider/reader-model`, with a 200,000-token
  window and stub prices of $3 and $15 per million input and output tokens.
  No provider was called.
- The builder also asserts the Sections lane before and after the change,
  the carried movement ranges, the withheld thread, that the handoff port
  received a tile only, and that no log line carries the chapter's or a
  reading's words.

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's Adventures in
Wonderland" (1865), public domain: the worked examples' own excerpt, as
their request blocks hold it. The stale state's scene-break line and
"and it was full" are edits written for this evidence. Boards use the
Middle Grade publishing-standards preset.

**Limitations:**
- This is headless Chromium, not the VS Code webview host. Theme variables
  are stubbed, and fonts come from the system.
- The Workshop does not reflow at 500 px (tech debt
  `.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md`), so
  `workshop-composer-500` shows the pill's left half; `facts.json` records
  it.
- At 1000 px the inspector opens over the rail, as it did before this slice.

## Results

From the committed `facts.json` and `errors.txt` of the final run, after
the PR #156 review fixes, against a bundle from a clean `npm ci` and
`npm run build` (`webview.js` SHA-256
`9493dfce5941aeccbbab03366f2905e6b0a91c24803176141098df849442415b`). Every
fact below is unchanged from the first run; only `ribbonGrid` is new:

| State | What the page shows (1440, 1000 and 500 alike) |
|---|---|
| `sections-measured` | Sections lane: "Found one heading (¶1), which does not divide the chapter into two or more sections, so the ribbon stays in paragraphs."; Movements "Summary & movements is a reading. Not read yet." |
| `template` | Register `read`; "Portal descent"; engagement rows "Movement I, The bank: engagement low", "Movement II, The chase: engagement high", "Movement III, The well: engagement medium"; scale "Freshness, as read: Fresh"; "Basis, counted: 8 of 16 classified beats signature (50%) · 2 of 5 template beats subverted." |
| `pressure` | Register `counted-read`; "¶4 · builds ¶4 → still open", "¶5 · dormant, never touched again", "¶6 · builds ¶7 → still open", "¶7 → resolved ¶7"; "4 threads · 1 resolved here · 3 carried out of the chapter · 1 dormant" |
| `artifacts` | Register `counted-read`; book first ¶2 ×2 (planted, unused), watch ¶4 ×2, rabbit-hole ¶1 ×3 (the chapter heading counts), marmalade jar ¶7 ×3 (planted, unused); "4 objects · 4 change state · 2 planted, unused." |
| `summary` | Register `read`; synopsis with ¶3, ¶5, ¶7 quotes verbatim; I ¶1–3, II ¶4–5, III ¶6–8, each boundary verbatim with its engagement |
| `ribbon` | Movement bands ¶1–¶3, ¶4–¶5, ¶6–¶8; engagement low, high, medium; Pressure 0, 0, 0, 1, 2, 3, 3, 3 open threads; run line "68 quotes checked · 0 withheld · 2 calls" |
| `inspector` | "Will the fall ever end?", ¶6 and ¶7 found verbatim, Planted ¶6, Builds ¶7, Ends "Still open: carried out of the chapter", Span ¶6–¶8 counted by code, the order check, **Bring to Workshop →** |
| `bound` | Posted `lightbox_hand_off {"kind":"tile","boardId":"board-alice-1","tileId":"lbt-run-1-ev-E-17"}` and nothing else about the tile; **Bound for Workshop** disabled, **Open Workshop →**; header "1 tile bound for Workshop · Open Workshop →" |
| `stale`, `stale-pressure`, `stale-ribbon` | Run line "68 quotes checked · 2 withheld · 2 calls · 7 lenses stale"; seven "Stale" notes; Sections "Section 1: Scene 1, ¶1–¶5", "Section 2: Scene 2, ¶6–¶9"; movements ¶1–¶3, ¶4–¶6, ¶7–¶9, engagement following them; Pressure 0, 0, 0, 1, 2, 2, 3, 3, 3; "What is in the jar she takes down?" withheld: "Its resolution is no longer in the chapter, so the board cannot show it resolved."; jar arc "taken down → put away"; basis "Stock & signature and Template & freshness were read against an earlier version of this chapter, so the basis is not counted. Re-read them to count it." |
| `workshop-composer` | One pill, "Lightbox Movement: The chase", "from the Lightbox · 1 quote", tooltip "Movement from the Lightbox's reading of Drafts/alice-chapter-1-opening.md: the claim and the quotes found in the chapter", "Remove … from this message", hint "rides the next message only" |
| Horizontal overflow (document) | none, in any state or width |
| Ribbon grid (`ribbonGrid`) | In every Lightbox state at every width: the paragraph lanes' and story lanes' column tracks share both edges (0 px apart); each of the 8 (fresh) or 9 (stale) paragraph columns has the same left and right edge as the story lanes' column of that index, 0 px apart; every section, movement and engagement band starts and ends on the edges of the paragraph columns it spans, 0 px apart; both parts' label blocks are one width, 78.8 px fresh and 121.8 px with the stale badges; no lane label is clipped |

- No page errors in any state or width, and no misalignment: `errors.txt`
  is empty.
- `states/log.txt` names paths, counts, attachment ids and outcomes only.

**Before the F-03 fix.** The same harness against the bundle built from
`797e166` (on the same clean install) recorded 93 misalignments
(`errors-797e166.txt`): the story lanes' columns sat 4.8 px right of the
paragraph columns in every fresh state and 19.44 px right in every stale
state, at 1440, 1000 and 500 px alike, as the review measured from the
screenshots.

**The bundle hash.** The first run's recorded hash (`97658a69…`) came from a
build whose `node_modules` was a symlink to another checkout's install:
webpack resolved those modules to paths outside this checkout, and
production module ids are hashed from paths, so the bundle differed from a
clean checkout's in its module ids only. The installed versions matched the
lockfile. On a clean `npm ci` here, `797e166` builds to `65228e9a…`, the
hash the review rebuilt, and this run's bundle comes from the same clean
install.

**Fixed while making it.** The first run showed two things worth changing:
with both halves stale, the basis line named only Stock & signature (it now
names both); and the Sections note repeated the break marks the tile already
lists. The ribbon states at 500 px showed only the stacked rail, so the
harness now scrolls the ribbon into view there.

## Rerunning it

Build the bundle from a clean install (a `node_modules` linked from another
checkout changes the bundle's module ids, so its hash) and copy it out:

```sh
npm ci
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/lightbox-4c/webview.js
```

Render the states, from this folder:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node harness.js /tmp/lightbox-4c/webview.js /tmp/lightbox-4c/visual
```

To rebuild `states/`: copy `tools/build-story.test.ts` into
`packages/core/src/__tests__/`, run it with
`LIGHTBOX_EVIDENCE_DIR=$DIR npx jest packages/core/src/__tests__/build-story.test.ts`,
delete the copy, and copy `$DIR/states/*` here. `$DIR` defaults to
`/tmp/lightbox-4c`; keep it outside the repository. No fixture file is
needed: the text is the worked examples'.

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then
from `/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`.
