# Slice 3: Lexical Gravity and Palette

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3 (kinds), D7, D11; [ADR 2026-08-01](../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md)
**Status:** In review (PR pending). Built on `epic/lightbox-slice-3-gravity`; see [Implementation notes](#implementation-notes-2026-10-19).

## Outcome

Group A gains two lenses.

**Lexical gravity** detects the borrowed metaphor fields the prose already
leans on. Each field has:

- a governing metaphor;
- a pull, drawn hatched and labeled a claim;
- terms the reading names and code counts;
- a 1° / 2° / 3° degree split, using the Lexical Gravity widget's vocabulary;
- a recurrence strip and a drift note.

The tile also shows collisions, where two fields share a sentence, and fields
set aside because they are literal in the scene. An orbit view places fields
by pull.

**Palette** groups counted words into diction clusters and names the colors
the text uses as swatches.

Pinning a gravity field offers **Build as a lens in Lexical Gravity**. That
opens the Workshop with the widget's Build lens filled in, through the
Workshop's own message path.

## Host

- Prompts:
  - `13-lexical-gravity.md`: borrowed versus literal, degrees, collisions,
    a required set-aside list;
  - `14-palette.md`;
  - updated worked example for group A.
- Codec kinds: `gravity-field`, `gravity-collision`, `gravity-literal`,
  `palette-cluster`, `swatch`.
- Counted support:
  - field terms are counted by the host per paragraph, giving hits, the
    paragraph set and the drift note (first and last paragraph, where the
    field is densest);
  - degree assignment is the reading's;
  - a field under a minimum hit count is drawn below the gravity line rather
    than dropped.
- **Handoff (ADR D11):**
  - `LIGHTBOX_HAND_OFF` with `{ kind: 'lexical-gravity-seed', field, metaphor, terms }`;
  - `LightboxHandler` re-verifies against the current source hash and calls
    `uiActions.handOffToWorkshop`;
  - `extension.ts` implements it with a new
    `WorkshopPanelProvider.seedLexicalGravityBuild(seed)`. That method routes
    a synthetic `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD` through the Workshop
    panel's own `MessageHandler`, and the widget opens Build lens with
    `originQuery` prefilled.
  - Nothing is built or installed without the writer pressing Build.
- Architecture: the new Workshop route joins the ledger in
  `boundaries.test.ts`. Lightbox files that name Lexical Gravity join the
  approved feature-surface list.

## Webview

- `LightboxLexicalGravity`: the orbit (rings at strong, moderate and the
  gravity line), field rows, degree bars, the collision row and the literal
  set-aside.
- `LightboxPalette`: cluster rows and swatches.
- The inspector shows degree rows ("By degree") and Build as a lens.

## Tests

- Codec: gravity and palette blocks, missing set-aside list, a degree out of
  range.
- Counting: hits and paragraph sets for field terms, including multi-word
  terms and case folding.
- Handoff:
  - a seed reaches the Workshop only through the panel's handler (an
    assembly test in the style of `seedExcerpt`);
  - a stale source refuses the handoff.
- Prompt example decodes through the production codec.

## Done when

On a public-domain fixture with an obvious borrowed field, the field appears
with counted hits, and a literal field is set aside with its reason. Build as
a lens opens Lexical Gravity in the Workshop with the subject filled in.

## Implementation notes (2026-10-19)

Built on `epic/lightbox-slice-3-gravity`, from the Slice 2B branch, with the
PR #149 review fixes and then `epic/lightbox` merged in. Where the build
differs from the plan above, or the plan left a choice open:

**Stale readings first (D4)** ([resolved debt](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md))

- A board built from changed text (a new hash) carries the latest board's
  readings, so nothing paid for vanishes after an edit and no reading looks
  current when it is not. `LightboxStaleReadings.carryLightboxReadings` does
  it, before any handoff could read them:
  - each lens that had a reading is marked stale with the hash it was read
    against (`LightboxReadingGroup.staleLenses`), and re-reading that lens,
    or a full run, clears its mark;
  - every quote is checked again against the new paragraphs: kept where it
    still stands, moved to the nearest paragraph that now holds it, or
    withheld as `no-longer-in-chapter` ("No longer in the chapter: the text
    changed after this was read, and these words are gone.");
  - a claim left with no quote is withheld; a motif left in one paragraph is
    withheld;
  - counted support, field hits, degrees and drift are recounted on the new
    text (`LightboxTileCounts`), so a count is never one the text no longer
    has.
- The run line adds "N lenses stale", each stale lens says so above its
  tiles, and the inspector repeats it for a pinned reading.
- A group still being read when the text changes is carried as `cancelled`
  ("The chapter changed while this group was being read, so that reading was
  set aside."). Its result, when it lands, is dropped: a follow-up
  ([tech debt](../../tech-debt/2026-10-19-lightbox-forward-in-flight-readings.md)).

**Contracts**

- `messages/lightboxGravity.ts` holds the five new tile shapes:
  `gravity-field` (metaphor, claimed `pull`, terms with their degree and the
  host's counts, `hits`, `degreeHits`, `belowLine`, `drift`),
  `gravity-collision` (the two field names), `gravity-literal` (`hits`),
  `palette-cluster` and `swatch` (`hex` as `#RRGGBB`). The register: field,
  literal, cluster and swatch are `counted-read`; a collision is `read`.
- Group A's lenses are headline, motif, tension, gravity and palette, in that
  rail order. `PROMPT_BUDGETS.lightbox` gains the gravity and palette bounds
  (5 fields of up to 8 terms, 3 collisions, 1–4 set-asides, 4 clusters of
  2–6 words, 6 swatches of 1–3 words), pinned to the prompt text by the sync
  test.

**Prompts and the codec**

- `13-lexical-gravity.md`: borrowed versus literal, the governing metaphor,
  pull as a claim, the three degrees, collisions, the required set-aside
  list, and the boundary: describe the borrowing, never tell the writer to
  strengthen, extend, resist, cut or replace a field. `14-palette.md`:
  clusters built from the counted words (the task line lists the board's top
  content words), and only colors the text names, with the hex as the
  reading's choice. The shared rules say a lens may set its own number of
  terms. Group A's worked example reads both lenses on ¶1–¶8 and decodes
  through the production codec and verifier (tests).
- The gravity and palette blocks decode in `LightboxGravityCodec.ts`;
  `LightboxReadingCodec.ts` gains only their two cases, so the 2B codec's
  review fixes merge cleanly. The field decoders they share were copied into
  `LightboxReadingFields.ts` for now
  ([tech debt](../../tech-debt/2026-10-19-lightbox-codec-shared-field-decoders.md)).
- Enforced in code, not only asked for: a gravity block needs at least one
  literal set-aside (else the block is withheld); a degree other than 1, 2
  or 3 withholds its field; field names are unique; a set-aside never shares
  a field's name; a collision names two different fields the block draws; a
  swatch's color is `#RRGGBB`.

**Counting** (`LightboxGravityCounts`, `LightboxGravityTiles`)

- The model never supplies a count. Each term is counted by the host's term
  counter (the word-frequency tokenizer; multi-word terms and case folding
  included), per paragraph.
- A field's hits count each occurrence once, attributed to the longest term
  that covers it, so "like a telescope" and "telescope" are not counted
  twice. The terms keep their own raw counts in the support list, and
  `degreeHits` splits the hits by the reading's degrees.
- A field under `LIGHTBOX_GRAVITY_LINE_HITS` (3) hits is drawn below the
  gravity line, not dropped, even with no hit at all ("None of its terms is
  in the chapter."): the board shows what it decided not to call gravity.
- The drift note is the first and last paragraph and the densest run of
  `max(1, ceil(paragraph count / 10))` paragraphs, trimmed to the
  paragraphs the field is in.
- A collision is drawn only when both fields are drawn and a quote the
  verifier found holds a term of each. A set-aside's hits are counted the
  same way. Cluster words and swatch words are counted; a cluster or swatch
  none of whose words is in the chapter is withheld.

**Build as a lens (D11)**

- `LIGHTBOX_HAND_OFF` carries `{ kind: 'lexical-gravity-seed', boardId,
  fieldId }`, not the field, metaphor and terms the plan named: the webview
  only names a board item, and everything that leaves is resolved by the
  host. `LightboxHandler` checks that the board is the one on screen and,
  for a file, that the file on disk still has the board's hash; the pure
  `LightboxHandoff` refuses a stale field, one being read again, a withheld
  one (it has no tile to name) and one whose quotes are all gone, re-checks
  its quotes, recounts its terms and bounds the seed (field, metaphor, up to
  12 counted terms, the source label). One handoff runs at a time per tab,
  and a tab closed while its file is re-read hands nothing over. The answer
  is `LIGHTBOX_HAND_OFF_RESULT`: opened, or refused with its reason. It waits
  for the Workshop's own answer (below), so "opened" means a visible
  Workshop opened the field (PR #150 F-03).
- `uiActions.handOffToWorkshop(handoff)` is the composition root's port.
  `extension.ts` implements it with
  `WorkshopPanelProvider.seedLexicalGravityBuild(seed)`, which opens or
  reveals the Workshop and routes a synthetic
  `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD` through the Workshop panel's own
  `MessageHandler`, as `seedExcerpt` does. The seed is not session state, so
  it belongs to the panel that accepted it (PR #150 F-03): the provider
  delivers it once, only when that panel's webview has sent its first
  message and its tab is visible, and ignores late events from an older
  panel. A newer seed settles the pending one as `replaced`; closing the
  panel settles it as `closed`. The Workshop webview answers with
  `WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER { seedId, opened, reason? }`
  (it refuses as `busy` over an open sheet or editor); the provider takes
  that answer itself, and the port's promise settles with it, or with
  `timeout` after 20 seconds.
- `WorkshopLexicalGravityHandler` owns the new route. It validates the seed
  (exact keys, bounds), composes Build lens's subject and answers with
  `WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED`; it calls no model. **The route is
  direct, not a mutation:** opening the sheet changes no session state, and
  Lexical Gravity's own build is direct too; only saving a lens is gated.
  It joins the route ledger in `boundaries.test.ts` (57 routes, 20 direct).
- **Build lens takes one subject, not seed vocabulary.** Its build contract
  (`WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS { token, query }`, query of at most
  100 characters) has no field for terms, and this slice does not change it.
  So the counted terms ride in the subject, after the field's name, as many
  whole terms as fit ("Telescope: shutting, size, telescopes, shut up,
  shrink"), and a banner above the sheet shows the full seed: the field, its
  metaphor, every counted term with its count, the source, and "Nothing is
  built, saved or installed until you press Build lens." The writer can edit
  the subject first.
- The Workshop opens the sheet on Build lens, prefilled, once. It never
  replaces a sheet that is already open; it says "Close the open widget
  sheet, then build the field from the Lightbox again."

**Webview**

- The gravity tile (`LightboxGravity.tsx`, `LightboxGravityOrbit.tsx`): an
  orbit of positioned buttons (rings at strong, moderate and the gravity
  line; nearer the center the more pull claimed; a field below the line on
  it, hollow; the dot grows with hits), field rows with the pull hatched and
  labeled a claim, terms and hits, a degree bar, a paragraph strip and the
  drift note, then collisions and set-asides. Every item is a board item:
  hover lights its paragraphs, a click or Enter pins it.
- The palette tile (`LightboxPalette.tsx`): clusters with each word's count,
  and swatches with their words' counts; the footnote says the color is the
  reading's choice.
- The components are named `LightboxGravity*`, not `LightboxLexicalGravity`:
  `boundaries.test.ts` treats any path naming Lexical Gravity as that
  widget's feature file. The Lightbox files that do name it
  (`LightboxReadingPrompts.ts`, `LightboxHandoff.ts`, and the two
  `lightboxHandoff.ts` modules) join the approved feature-surface list.
- The inspector shows "By degree" rows for a pinned field and **Build as a
  lens in Lexical Gravity**, disabled with its reason while the field is
  stale, being read again or being sent. The answer shows as a status line.
- The rail's lens toggles include both lenses in group A, and the call count
  and estimate follow them. Typical output per lens is a fixed guess
  (gravity 1,500 tokens, palette 760) until Slice 6 measures it.

**After PR #149's fixes** (merged in before review)

- The palette's counted words ride in the press snapshot
  (`LightboxPressSnapshot`), so the estimate key that names a press's
  inputs covers them through the board's content hash; gravity and palette
  join the key through `LIGHTBOX_LENSES`.
- A carried group keeps its per-lens `quoteChecks`, and each quote now gone
  counts as withheld in its lens, so the tally stays honest on a stale
  board.
- The gravity and palette decoders use `strictObject`: a field the format
  does not define is counted, never named, and every withheld reason they
  write is host-owned (a collision or set-aside never echoes a model's
  names in its reason).
- The handoff's logs name paths, counts and host-owned refusals only; a
  failed file check logs no resolver text.

**Not built here**

- A group in flight when the chapter changes still loses its result
  ([tech debt](../../tech-debt/2026-10-19-lightbox-forward-in-flight-readings.md)).
- At 280 px the inspector's kind label ("Lexical gravity · Borrowed field")
  wraps over several lines beside the register chip; cosmetic, left as is.
- Live-provider checks of the two lenses: Slice 6.
