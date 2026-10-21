# Slice 4C: Story Lenses (Group E)

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3, D4, D6, D7 (and its 2026-10-20 addendum), D11
**Design:** [`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html) sections 1, 4, 5 and 7 (draft, 2026-10-20)
**Writer decisions:** 10, 11 and 14 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Planned. Stacked on Slice 4B (it joins the freshness basis to 4B's tier counts).
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

## Done when

On the *Alice* fixture, one press reads five groups. Movements tile the
chapter from verified boundary quotes, engagement sits on them apart from
tension, threads and artifacts carry counted spans and mentions, the
freshness reading shows its counted basis from Groups D and E, and the
Sections lane says what code found.
