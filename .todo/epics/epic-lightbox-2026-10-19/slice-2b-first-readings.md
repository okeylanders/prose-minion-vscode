# Slice 2B: First Readings

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D6, D7, D8 (fit and cost), D9
**Status:** In review (PR pending), on `epic/lightbox-slice-2b-readings`

## Outcome

The Read button states its call count and estimated cost, then runs up to
three grouped calls on the assistant model. Group A returns the headline,
motifs and tension arc. Group B returns characters and voice. Group C returns
the genre neighborhood. Tiles arrive group by group. Every claim shows quotes
that code has verified against a numbered paragraph, failed quotes and claims
are shown as withheld, and each lens names where it strains. Cancel keeps the
groups already back. The rail gains Context (project files) and Lenses
(per-lens toggles that change the call count and cost).

## Host

- **Prompt bundle:** `resources/system-prompts/lightbox/`
  - `00-lightbox-shared.md`: the boundary, evidence and friction rules from
    ADR D7, and the paragraph marker format;
  - one file per lens: `10-headline.md`, `11-motifs.md`, `12-tension.md`,
    `20-characters.md`, `21-voice.md`, `30-genre.md`;
  - one worked example per group.
  - The service assembles a group's system prompt from the shared file plus
    the lenses that are on.
- **Codec:** `infrastructure/lightbox/LightboxReadingCodec.ts` (pure)
  - sentinel frame per group (`===LIGHTBOX_GROUP_A_V1===`);
  - `JSON.parse`;
  - per-block validation with the `persistedValidation.ts` helpers (exact
    keys, bounded strings and arrays, enums);
  - host-minted ids;
  - a required `friction` per block;
  - a block that fails is returned as `withheldBlocks` and its siblings
    survive.
- **Verifier:** `infrastructure/lightbox/LightboxQuoteVerifier.ts` (pure)
  - exact, then normalized match within the named paragraph only;
  - undeclared paragraph numbers fail;
  - returns the match kind or the reason.
  - Claims with no verified quote are withheld by title.
- **Counted support:** the host counts terms that readings name (motif
  terms, character names) with the paragraph model, and never trusts a
  model-supplied count.
- **Run:** `LightboxReadingRunner`
  - fans out the groups (`pLimit`, a timeout per call, partial failure,
    summed usage) on `getEngine('assistant')` with
    `assistantWithoutResources`;
  - one active run per board with a host-minted token and an
    `AbortController`;
  - stale results are dropped;
  - `finishReason === 'length'` fails the group;
  - undecodable bodies are quarantined via `persistRejectedWidgetResponse`
    with the location notice.
- **Fit and cost:** `LightboxRunEstimate`
  - estimates each group's request with `estimateTextTokens` and
    `measureContextWindow` against `OpenRouterModels.getCachedContextLength`;
  - prices it from the catalog;
  - results: fits, too-large with the largest size that fits, or unknown;
  - cost: an estimate or "unavailable".
  - It is recomputed when the source, context, lens toggles or model change.
- **Context:** `LIGHTBOX_ADD_CONTEXT_FILES` and `LIGHTBOX_REMOVE_CONTEXT_FILE`
  (project files through the existing file picker port), bounded by
  `PROMPT_BUDGETS.contextFiles`. Context follows the chapter in the user
  message as a labeled section, and the verifier never searches it.
- **Routes:** `LIGHTBOX_SET_LENSES`, `LIGHTBOX_RUN_ESTIMATE`, `LIGHTBOX_RUN`,
  `LIGHTBOX_CANCEL_RUN`, `LIGHTBOX_RUN_PROGRESS`, `LIGHTBOX_GROUP_RESULT`.

## Webview

- Run line states: idle with the estimate, book-sized warning, too large
  (disabled, with reason), running with groups back, done with quotes checked
  and withheld counts, cancelled.
- Tiles: `LightboxHeadline`, `LightboxMotifs`, `LightboxCharacters`,
  `LightboxVoice`, `LightboxGenre`, and the tension lane on the ribbon.
  Skeletons appear while a group runs.
- The inspector gains evidence (quote, ¶ address, match kind), withheld
  quotes and claims, counted support, friction, and "Re-read this tile" (one
  group call restricted to that lens).
- Rail: `LightboxContextList`, `LightboxLensToggles`.

## Tests

- Codec:
  - the worked examples decode through the production codec;
  - a malformed block is withheld while its siblings survive;
  - a missing friction note fails the block;
  - a sentinel missing or duplicated fails the group.
- Verifier: exact, curly vs straight, dash and whitespace variants; a quote
  from the wrong paragraph; an undeclared paragraph; a quote taken from a
  context file.
- Runner:
  - one group fails and the others land;
  - cancel mid-run keeps the finished groups;
  - a stale result is dropped;
  - a `length` finish fails its group;
  - an undecodable body is quarantined.
- Estimate: fits, too large, unknown context length, no live pricing.
- Prompt budgets: the bundle's numbers match `PROMPT_BUDGETS.lightbox`.
- Fixtures: public-domain prose only.

## Open question to settle here

ADR open question 1 (prime then fan out). Run the three groups on a
public-domain chapter with an Anthropic assistant model, both in parallel and
primed. Record the cache reads, then decide. Amend the ADR either way.

## Done when

- One press on a chapter yields the four reading kinds with verified quotes,
  and at least one withheld item shows on a fixture built to provoke it.
- The estimate shown before the press is within a reasonable margin of the
  processed chip afterward. Record the observed ratio in the progress notes.

## Implementation notes (2026-10-19)

Built on `epic/lightbox-slice-2b-readings`, from the Slice 2A branch, with
the PR #148 review fixes and then `epic/lightbox` merged in. Where the build
differs from the plan above, or the plan left a choice open:

**Contracts** (`shared/types/messages/lightboxReadings.ts`)

- The reading contract is its own module beside `lightbox.ts` (which would
  pass 500 lines otherwise), exported from `@messages`.
- Reading tile kinds are D3's six plus `reader-promise`: the genre lens's
  "what the chapter promises so far" is its own claim with its own evidence,
  drawn inside the genre tile. Voice is `counted-read`; the rest are `read`.
- A group also carries `lenses` (what it was asked), `pending` (lenses still
  out), `withheldClaims` (a claim with no verified quote, by title and
  reason, with its failed quotes' reasons), `frictions` (so an empty lens
  keeps its friction) and `error`.
- A withheld quote carries its paragraph and reason (`undeclared-paragraph`,
  `not-in-paragraph` with where the words do stand, `not-in-chapter`,
  `too-short`), never the quote text: a paraphrase is not shown as if it
  were the writer's words.
- Three inbound routes beyond the plan's six: `LIGHTBOX_ADD_CONTEXT_FILES`,
  `LIGHTBOX_REMOVE_CONTEXT_FILE` and the outbound `LIGHTBOX_CONTEXT_FILES`.
  The estimate message also carries the board's active run, so a reopened
  tab can offer Stop.

**Prompts and the codec**

- `00-lightbox-shared.md` holds the boundary (describe, never grade;
  resemblance is not quality; never write toward a genre, convention or
  myth), the evidence rules (verbatim, one paragraph, never a marker or a
  context file, at most three quotes), the no-counts rule, friction, empty
  results and the frame. Each lens file adds its own shape. Each group's
  worked example reads ¶1–¶8 of Alice Chapter I; its request block is the
  production prompt builder's output, byte for byte (a test pins it).
- The bundle's numbers (`PROMPT_BUDGETS.lightbox`: quote, claim, friction,
  label and note lengths, quotes per claim, terms, motifs, characters,
  neighbors, peaks, the response size) are pinned to the prompt text by a
  sync test.
- The codec rejects a group (frame or root failures: missing or repeated
  sentinels, invalid JSON, unknown root keys, a wrong version, an oversized
  body) or withholds a block (missing friction first, then shape). A block
  for a lens that was not asked is ignored. An item that fails its shape is
  withheld by title while its block's other items survive.
- Rules the codec enforces in code, not only in the prompt: tension has
  exactly one integer score from 0 to 9 per column; genre has at least two
  neighbors and at least one at affinity 0.40 or below, with its near miss;
  a motif needs verified quotes from at least two paragraphs.
- The verifier needs four letters in a quote, so "the" cannot anchor a claim.

**Runs** (`LightboxReadingRunner`, `LightboxReadingHandler`)

- Groups run in parallel (concurrency 3, temperature 0.4, a 5-minute timeout
  per group, the group's output budget of 8,000 tokens).
- The chapter is the leading content of every group's user message;
  context follows; the task (lenses, frame, tension columns) comes last.
- A run's results attach to the board id `LightboxService` owns, and reach
  webviews only through the service's outcome listener, as `readings`
  outcomes published for the current board only; a run for a board that is
  no longer current updates its retained board silently. A source switch
  does not cancel a run; closing the tab does.
- One press per board at a time. Stop keeps the groups already back
  ("Stopped before this group came back."). "Read the rest" runs only the
  groups that are not `ok`.
- "Re-read this tile" is one call for that lens alone, in its group. It
  replaces only that lens's tiles, withheld items and friction; a failed
  re-read keeps the earlier reading beside its notice.
- Context files: one file per "Add file" press through
  `ShellService.pickFile`, resolved like a source. The shelf refuses the
  board's own source, a duplicate, an empty file and anything past
  `PROMPT_BUDGETS.contextFiles.words` in total. It is in memory and shared
  by the tab's boards.
- The estimate is recomputed on lens toggles, context changes, a new board,
  a model change and after a run. Expected output per lens is a fixed
  typical figure (tension adds two tokens per column); the reply reserve is
  the group output budget. `OpenRouterModels.getCachedPricing` is new, and
  reads live catalog prices only.

**Webview**

- The run line's states are estimating, idle, running ("Reading… 1 of 3
  lens groups back", Stop), done ("25 quotes checked · 1 withheld · 3
  calls"), stopped and disabled-with-reason (too large, no API key). The
  cost is on the press and in the Lenses card.
- Readings render through `LIGHTBOX_READING_LAYOUT`: the headline replaces
  the board's title, the tension arc's note sits under the ribbon, and
  motifs, characters, genre and voice join the grid. Every reading kind is
  placed exactly once (a test pins it).
- The inspector's evidence, withheld quotes, details, counted support and
  friction are lists of their own, apart from the paged addresses.
- PR #148 review F-05 (Low, nonblocking) is addressed here: each explicit
  "Go to ¶" jump carries its own number, so repeating a jump that lands on
  the same mounted chip (¶812 twice, or ¶100 then ¶101 on a sparse list)
  focuses it again; a board update keeps the number and moves no focus.

**Open question 3: tension scale at book length.** Tension is scored per
ribbon column: one score per paragraph up to 96 paragraphs, and one per
column above that, where a column takes its tensest paragraph. On the
fixtures, Alice Chapter I (31 paragraphs) gets 31 scores either way; the
whole book (815 paragraphs) would need 815 scores per paragraph against 96
per column, about 8.5 times the output; a source at the 50,000-word ceiling
runs to about 1,540 paragraphs, about 16 times. Per paragraph also widens
the failure: the codec needs the array's exact length, and one miscount
withholds the whole tension block. The task line names each column's
paragraph range, so the model scores the same buckets the ribbon draws, and
the inspector still addresses exact paragraphs.

**Open question 1: prime then fan out.** Not measured. This container has no
API key, and the slice made no live or billable calls, so the cache-read
comparison, and the estimate against the processed chip that "Done when"
asks for, move to Slice 6's live pass
([tech debt](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md)).
Until then the groups run in parallel, with no caching intent (ADR
2026-10-03 gives one-off runs none). One finding for that measurement: each
group's system prompt is the shared rules plus its own lens files and
example, so the three calls share no leading prefix today; a cross-group
cache read would need the chapter ahead of the lens-specific text.

**Not built here**

- Readings on a changed chapter are dropped, not kept and labeled stale as
  D4 describes: a changed text gets a new board id and empty readings
  ([tech debt](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md), resolved in Slice 3).
- Live-provider checks: Slice 6, above.
