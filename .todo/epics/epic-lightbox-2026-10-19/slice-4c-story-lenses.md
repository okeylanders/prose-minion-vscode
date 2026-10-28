# Slice 4C: Story Lenses (Group E)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3, D4, D6, D7 (and its 2026-10-20 addendum), D11
**Design:** [`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html) sections 1, 4, 5 and 7 (draft, 2026-10-20)
**Writer decisions:** 10, 11 and 14 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented, awaiting review (`epic/lightbox-slice-4c-story`). Stacked on Slice 4B (it joins the freshness basis to 4B's tier counts); 4B's PR #155 fixes are merged in.
**Before:** Slice 5.

## Outcome

A fifth reading group, **Group E · Story**, reads four lenses in one call:

- **Template & freshness.** The template the chapter rides (a name and a
  brief description), where it aligns and where it subverts, each item
  quoted; **engagement** Low/Medium/High per movement, a reading of pull kept
  apart from the tension lane because pull and tension can disagree; and a
  **freshness reading** on a three-step scale, Familiar · Mixed · Fresh,
  labelled "a reading, not a grade" (ADR D7 addendum). Under it, a counted
  **basis line**, for example "12 of 51 classified beats signature (24%) ·
  2 of 4 template beats subverted".
- **Pressure.** What is building and whether it resolves: threads, each with
  a planted quote, escalation quotes, and a resolution quote or "still
  open", plus a dormant flag. Code computes each thread's paragraph span and
  an "open threads per ribbon column" lane.
- **Artifacts.** The objects present in the scene. The reading names each
  object and its terms; **code counts mentions and the first paragraph**.
  The reading gives an arc of state changes, each step quoted, and may flag
  "planted, unused".
- **Summary & movements.** A short synopsis citing at least two verified
  quotes, and named **movements** over ¶ ranges, each starting with a
  boundary quote verified inside its first paragraph. Code checks the
  movements are contiguous, do not overlap and cover the chapter.
- **A measured Sections lane**, detected by code only, no model.

## Groups and lenses

- `LightboxReadingGroupId` gains `'E'`. Lenses, in rail order: `template`,
  `pressure`, `artifacts`, `summary`. Keys `"template"`, `"pressure"`,
  `"artifacts"`, `"summary"`.
- **Engagement** is part of the template block, from the same call, keyed by
  movement title. It needs the summary lens on: with summary off, the
  template prompt asks for no engagement and the tile says engagement needs
  the movements.
- **Never restate another group's numbers.** The freshness basis line is a
  deterministic host join, never asked of a model:
  - the signature share is Group D's `stock-tiers` counts (its `tiers` and
    `classified`, as found beats);
  - the subversion count is Group E's found template beats (`subverts` over
    all);
  - it is shown only when both tiles are on the board and neither is stale;
    otherwise the line says which half is missing ("Read Stock & signature
    to count the signature share").
- Prompts: `60-template.md`, `61-pressure.md`, `62-artifacts.md`,
  `63-summary-movements.md`, and `44-example-group-e.md` on the same *Alice*
  paragraphs, decoding through the production codec and verifier. Bounds in
  `PROMPT_BUDGETS.lightbox` (template beats 6, threads 6, escalations per
  thread 3, artifacts 8, arc steps 5, movements 8, synopsis quotes 2–3),
  pinned by the sync test. Typical output tokens are labelled guesses.

## Host and codec rules

- `strictObject`, host-owned reasons, undefined fields counted, friction
  required, model gives no counts; the 4B rules apply unchanged.
- **Template.** `name` and `description` bounded; beats `{ stance: aligns |
  subverts, note, evidence }`; `freshness: familiar | mixed | fresh` and a
  one-line note; `engagement: [{ movement, level: low | medium | high }]`.
  An engagement entry must name a movement the same response's summary
  block draws (case-folded title): the host checks it after the summary is
  assembled, and an entry naming no drawn movement is withheld by host
  words. A movement with no entry has no engagement mark, never a guessed
  one.
- **Pressure.** A thread `{ question, planted, escalations, resolution |
  null, dormant }`. Gate: the planted quote is found; escalations and the
  resolution, when given, are found at or after the planted paragraph; a
  dormant thread has no escalation and no resolution (the flag is read, the
  consistency is checked). The host computes the span (planted ¶ to the
  resolution ¶, or to the last paragraph when still open) and the lane:
  for each ribbon column, how many drawn threads are open across it.
- **Artifacts.** An object `{ name, terms, arc: [{ step, para, quote }],
  plantedUnused }`. The host counts the terms' mentions and first paragraph
  (the term counter); an object none of whose terms is in the chapter is
  withheld. Arc steps must be found and in paragraph order; a step whose
  quote fails is withheld by its position and the arc keeps the rest. The
  board's summary line ("7 objects · 3 change state") counts drawn tiles.
- **Summary & movements.** `synopsis` (≤ 320 characters) with 2–3 quotes,
  at least two of them found, or the synopsis is withheld. Movements
  `{ title, from, to, gist, boundary: { para, quote } }`: each boundary is
  found in paragraph `from`; the set is checked as a whole (sorted by
  `from`, first starts at ¶1, each starts the paragraph after the previous
  one ends, the last ends at the final paragraph). A set that fails is
  withheld whole with the rule it broke; a single movement failing its
  boundary withholds the set, because the ranges would no longer tile the
  chapter.
- **Sections lane (measured, `LightboxSections`).** Run on the paragraph
  model when the board is built:
  - Markdown ATX (`#`…`######`) and setext headings: the highest level that
    yields at least two sections;
  - scene-break lines: `***`, `* * *`, `#`, `§`, alone on a line;
    `---` alone is ambiguous (a setext underline when the line above is
    text, a thematic break after a blank line) and is decided by that rule;
  - plain chapter lines: "Chapter 12", "CHAPTER TWELVE", "Chapter XII"
    (roman numerals), alone on their line;
  - first match in that order wins; with none, the lane says "No headings,
    scene breaks or chapter lines found" and the ribbon stays in paragraphs.
  - It is measured, so it recomputes with every board and is never stale.

## Gates and stale carry

| Kind | Gate (fresh and carried alike) | Carry |
|---|---|---|
| `template` (name, description, freshness) | a found quote | evidence re-verified; freshness kept as read, stale-labelled |
| `template-beat` | a found quote | re-verified |
| `engagement` | its movement is a drawn movement of this board | follows its movement by title; dropped with the movement |
| `pressure-thread` | planted found; order and dormancy rules | each quote re-found; span and lane recomputed from where the quotes now stand; an order violation withholds |
| `artifact` | counted at least once | terms recounted, first ¶ recomputed; arc steps re-found, out-of-order steps withheld |
| `synopsis` | at least two found quotes | re-verified |
| `movement` (the set) | boundaries found in their first ¶, contiguous, covering | each movement starts where its boundary quote now stands, ends before the next; the set is re-checked as a whole and withheld whole if it no longer tiles the chapter. No old range is projected onto changed paragraphs |

The engagement lane and the pressure lane are positional; they follow
content (movement boundaries and thread quotes), never column positions.

## Bring to Workshop

Every new reading can be brought (ids only, the existing tile handoff).
Points: a template beat's stance; a thread's planted/escalation/resolution
paragraphs and open or resolved; an artifact's counted mentions and first
paragraph; a movement's ¶ range and engagement. The movement set brings one
movement at a time. Freshness travels with its label "a reading, not a
grade" and its basis line only when both halves are current.

## Webview

- **Tiles:** Summary & movements (full width), Template & freshness,
  Pressure, Artifacts, as the design draws them, with register chips.
- **Ribbon lanes:** Sections (measured), Movements and Engagement (read,
  hatched), Pressure (counted from read threads, neutral). Hovering a
  movement, a thread or an artifact lights its paragraphs.
- **Inspector:** each kind's fields and checks (the boundary check, the
  thread's span, the artifact's counts), stale notes, Bring.
- The two-level ribbon collapse above 96 paragraphs is **out of scope**:
  [feature note](../../features/feature-lightbox-ribbon-structure/README.md).

## Tests

- Codec and prompts as in 4B; the Group E example decodes with every quote
  exact.
- Movements: contiguous, a gap, an overlap, not covering, a boundary in the
  wrong paragraph; carried after an insertion that moves a boundary, and
  after an edit that deletes one (the set withheld).
- Engagement naming a movement not drawn; summary lens off.
- Pressure spans and the lane per column; dormant consistency; order.
- Artifacts counted by terms; out-of-order arc steps.
- Sections detector: ATX levels, setext, scene breaks, `---` both ways,
  chapter lines with roman and spelled numbers, none found.
- The freshness basis join: both present, one stale, one missing, never sent
  to a model.
- Parity sweep and every-kind test include group E.

## Implementation notes (2026-10-20)

What landed, and where it differs from the plan above. Where the
coordinator's brief added detail to this spec, the brief was followed; each
such point is marked *(brief)*.

**Contracts and files**

- **Prompt files are 53–56** *(brief)*, after group D's 50–52, not 60–63:
  `53-template.md`, `54-pressure.md`, `55-artifacts.md`,
  `56-summary-movements.md`, with `44-example-group-e.md`. The shared prompt
  names sentinel `E`.
- **Splits to stay under 500 lines.** Run messages moved from
  `lightboxReadings.ts` to `lightboxRuns.ts`, and Slice 2B's lens cases from
  `LightboxReadingTiles.ts` to `LightboxFirstReadingTiles.ts`. Group E is
  `LightboxPlotWire`, `LightboxPlotCodec`, `LightboxPlotGates`,
  `LightboxPlotTiles`, `LightboxPlotCarry`, `LightboxPlotHandoff` and
  `LightboxSections` on the host, `shared/constants/lightboxPlot.ts` shared,
  and `lightboxPlot.ts` plus five components in the webview; all joined
  `LIGHTBOX_MODULES` and the boundary lists.
- **Typical output tokens** are guesses from the worked example's length,
  labelled so: template 1,100, pressure 1,100, artifacts 1,300, summary 900.

**Template and engagement**

- **A third stance, `departs`** *(brief)*: a beat the template has no beat
  for. The basis counts `subverts` over all found beats, `departs` included.
- **Engagement is keyed by movement id, not title** *(brief)*. Each movement
  carries an `id` (1–12 letters, digits or hyphens, unique in the block),
  and engagement entries name it. The host checks every entry names a
  movement the same response drew, and each drawn movement has exactly one
  entry; otherwise the whole engagement is withheld (one claim,
  "Engagement", with the rule), never a partial set. This is stricter than
  the plan's "a movement with no entry has no mark": a missing entry
  withholds the engagement.
- **Engagement lives on the template tile** (`engagement:
  LightboxEngagementMark[]`), keyed by the movement's **tile id**, not a kind
  of its own. A re-read movement set never inherits old marks; a carry keeps
  them, since carried movements keep their tile ids, and a withheld set
  takes engagement with it.
- **Template and summary are read together.** Engagement needs the same
  response's movements, so a single-lens re-read of either is one call with
  both (`LIGHTBOX_READ_TOGETHER`, `lightboxRereadLenses`), and the estimate
  prices re-reads that way. With Summary & movements off, the template is
  read alone, its task asks for an empty engagement list, and the tile and
  lane say engagement needs the movements; the template tile hides
  engagement while that lens is off, as the lane does. A template re-read
  alone with summary off leaves the board's movements without engagement:
  that reading saw no movements.
- **The freshness basis is a shared pure join**, `lightboxFreshnessBasis`
  in `shared/constants/lightboxPlot.ts`, computed from the board's tiles by
  the webview (tile, inspector) and by the host (Bring). No protocol field
  carries it, so it cannot drift from the tiles. It counts only found beats,
  is shown only when both halves are on the board, current and not being
  read again, and otherwise says which half is missing or stale (both, when
  both are). The tier mix is **referenced, not repeated**: the tile links to
  Stock & signature, where it was counted.

**Pressure**

- **Order** *(brief)*: planted ≤ every escalation ≤ resolution, in
  paragraph order, else the thread is withheld (`threadOrder`). A thread
  whose resolution is not found is withheld rather than shown open.
- **Dormant consistency is checked by the codec** (no escalation, no
  resolution), so an inconsistent thread is withheld as malformed under its
  question. "No quote after the plant" is exactly that check.
- **Span** is planted ¶ to resolution ¶, or to the last paragraph while
  open. A thread is open in a paragraph from its plant up to, not
  including, the paragraph that resolves it, and open across a column when
  it is open in some paragraph of the column. A thread planted and resolved
  in one paragraph is open in none, so it adds nothing to any column,
  however many paragraphs the column holds (PR #156 F-01).

**Artifacts**

- **Mentions and first paragraph** use the gravity lens's field counter
  (each occurrence once, under its longest term), so they agree with the
  term counter everywhere else. The rabbit-hole's first mention is the
  chapter heading; it counts.
- **The arc needs 1–5 steps.** A step whose quote fails, or that stands
  before the step it follows, is withheld at its paragraph with a new quote
  failure, `out-of-order`; the arc keeps the rest.
- **"Planted, unused" is defined in code**: kept only when every mention and
  every arc step stands within 2 paragraphs after the first
  (`LIGHTBOX_UNUSED_REACH`). Otherwise the flag is not shown and the
  inspector gives the host's reason; carried back onto text where it holds,
  it stands again.
- **No quote-holds-term rule.** The artifact's gate is "counted at least
  once" by the shared counter, so 4B's `lightboxTermSpans` and
  `lightboxPhraseHeld` (PR #155 F-03) were not needed.

**Summary and movements**

- **Synopsis**: at most 320 characters and 4 sentences (the codec counts
  with the prose sentence splitter), with 2–3 quotes; fewer than two found
  withholds it.
- **The movement set** is gated as a set, fresh and carried alike: a
  malformed movement, a boundary not found, a boundary outside its first
  paragraph, not starting at ¶1, a range ending before it starts, an
  overlap, a gap, not ending at the last paragraph. Fresh, movements are
  sorted by `from`; carried, each keeps its place and starts where its
  boundary quote now stands, ending before the next. A set that fails is
  withheld as one claim, "Movements", with the rule it broke (a malformed
  movement also under its own title). There is one tile per movement,
  numbered by the host (I, II, III); the reading's ids are never shown.

**Sections (measured)**

- Read per paragraph of the board's model (blank-line split). ATX headings
  take up to three leading spaces, one to six `#` and a space, closing
  hashes dropped; setext needs an underline of three or more `=` or `-`
  under text in the same paragraph.
- **Front matter** is metadata, never structure, even when blank lines
  split it across paragraphs (PR #156 F-02): `---` as the chapter's first
  line, then YAML-shaped lines (a `key:` with no space in the key, a list
  item, a comment, an indented continuation), up to `---` or `...` alone on
  a line. Lines after the closing delimiter in its paragraph are read as
  that paragraph's start. Paragraph addresses do not change. A block never
  closed, or with a line that isn't YAML-shaped, is not front matter.
- Scene breaks: three or more `*`, `-` or `_` (spaces allowed), a lone `§`,
  or `#` alone or repeated with spaces (`# # #`, the manuscript break,
  taken before the ATX rule), as a paragraph's first line. `---` after a
  blank line is a break; under text in the same paragraph it is a setext
  underline. A break that ends the chapter or follows another opens
  nothing.
- Chapter lines: "Chapter" (any case) and a number in digits, roman numerals
  or words up to ninety-nine, alone or with a title after `.`, `:` or a
  spaced dash, at most 80 characters. "Chapter 12 was where…" is prose.
- Headings at the highest level that divides the chapter in two or more,
  then scene breaks, then chapter lines; text before the first marker is an
  "Opening" section. What fired is reported for every signal, used or not.
- **Not detected**, as the module states: a break or heading that is not a
  paragraph's first line (except right after front matter's closing line),
  `⁂`, ornaments, blank-line runs, "Part"/"Book"/"Prologue"/"Epilogue"
  lines, numbers alone, setext underlines shorter than three. Front matter
  is recognised by line shape, not parsed: a continuation that opens a
  paragraph loses its indentation, and `---` followed only by `Word:` lines
  up to a later `---` is taken for front matter.

**Webview**

- The Sections note sits beside Summary & movements and in the ribbon's
  Sections lane; the lane keeps it when the lens is off.
- The ribbon's paragraph lanes and story lanes share one plain CSS grid,
  one label track and one column track, so a column index is one place in
  both (PR #156 F-03). Every label block and track is a direct child,
  placed by column, with no `subgrid`, so it holds on Chromium 102, the
  floor VS Code 1.75 sets (F-04).
- The two-level ribbon above 96 paragraphs stays out of scope (feature
  note above).

**Limits, stated.** A maximal group E response can exceed the per-group
response cap: 39,853 characters at every bound against 32,000, artifacts the
long block
([tech debt](../../archive/tech-debt/2026-10-20-lightbox-group-e-response-ceiling.md)).

**Verification.** The counts are in the epic's progress note. Typecheck;
the full jest suite; lint identical per file and rule to `8b930fb` (0 errors
/ 1,133 warnings); the production build with `verify:bundle`; the diff
whitespace check. Visual evidence:
[`lightbox-slice-4c-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4c-visual/README.md).
No live or billable call.

**After the PR #156 review (2026-10-21).** Astra found three defects and a
nonblocking tally gap. Each is fixed in its own commit. The
[review's author response](../../../docs/pr-reviews/pr-156-lightbox-story-lenses-review.md#author-response-2026-10-21)
gives root cause, fix and tests for each.

- **F-01, a same-paragraph thread on a bucketed ribbon (`30047f0`).** The
  lane's predicate assumed a nonempty plant-to-resolution interval, so a
  thread planted and resolved in one paragraph counted as open in a
  multi-paragraph column. The thread now counts only when it is open in
  some paragraph of the column, fresh, carried and in the webview's lane.
- **F-02, front matter split by a blank line (`1a82d29`).** Metadata
  became a measured section. The detector now finds the leading block
  across paragraphs and skips it, and the body's own markers stand. `# # #`
  is now a scene break (the review's note).
- **F-03, one ribbon grid (`3caadaa`).** The story lanes drew their
  columns on a separate flex row, 4.8px off fresh and 19.44px off stale.
  Both parts now share one CSS grid's label and column tracks.
  - The visual harness measures the edges and commits them (`facts.json`,
    `errors.txt`): 0px at every width, fresh and stale.
  - The evidence was rebuilt from a clean install. The first run's bundle
    hash differed because its `node_modules` was linked from another
    checkout, which changes webpack's path-derived module ids.
- **N-01, the fresh tally (`3f9126c`).** An arc step withheld for its order
  now counts as withheld, once.
- **F-04, found in the re-review: the F-03 grid needed subgrid
  (`9fadf6d`).** Subgrid is Chrome 117; VS Code 1.75 runs Chromium 102,
  which stacks each label block above its chart.
  - The ribbon is now one plain grid with no row wrappers.
  - A new guard, `webviewCssFloor.test.ts`, keeps webview CSS within
    Chromium 102. It inventories older uses outside this PR, mainly
    `color-mix()` in the theme tokens, as
    [tech debt](../../archive/tech-debt/2026-10-21-webview-css-above-chromium-102.md)
    (resolved 2026-10-21 by raising the floor to VS Code 1.82).
  - The harness now checks that each label is beside its track, and
    simulates the floor by dropping subgrid. `e7e1536` fails those floor
    states (54 faults) and the fix passes.

Verification after the fixes:
- Full `npx jest`: 420 suites / 5,815 tests / 59 snapshots; after F-04,
  421 / 5,821 / 59. The F-04 evidence bundle is `webview.js` SHA-256
  `c016b535…`, from a clean install.
- `npm run lint`: identical per file and rule (0 errors / 1,133 warnings).
- `npm run typecheck`, `npm run build` with `verify:bundle`, and
  `git diff --check` pass.
- Each of the 11 new witnesses fails at its assertion on `797e166`'s
  sources. The new controls pass there.

## Done when

On the *Alice* fixture, one press reads five groups. Movements tile the
chapter from verified boundary quotes, engagement sits on them apart from
tension, threads and artifacts carry counted spans and mentions, the
freshness reading shows its counted basis from Groups D and E, and the
Sections lane says what code found.
