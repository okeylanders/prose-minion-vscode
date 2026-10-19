# Slice 2B: First Readings

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D6, D7, D8 (fit and cost), D9
**Status:** Planned

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
