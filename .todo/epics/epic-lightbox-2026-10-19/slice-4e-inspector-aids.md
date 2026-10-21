# Slice 4E: Reading Aids in the Inspector

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D4, D5, D10, D12
**Writer decisions:** 17, 18 and 19 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Implemented; the PR #159 review fixes are in, awaiting re-review (`epic/lightbox-slice-4e-inspector`, from `epic/lightbox` at `20775cf`, merged with `e8389bf`). Built beside Slice 4F (craft steering), which takes the decisions after 19.
**Before:** Slice 5.

## Outcome

Three reading aids, all measured by code. No model is called, and nothing
changes the reading estimate or the cost line.

1. **Paragraph text.** Pinning a paragraph (a ribbon column, a ¶ chip, or a
   sentence's address in a well) shows its whole text in the inspector, in
   a scrollable well. When the writer got there from a counted word,
   phrase, part of speech, hapax word or style flag, that item's instances
   in the paragraph are lit, with a way back to the item.
2. **Sentences for an item.** Pinning a top word, a part-of-speech entry, a
   repeated phrase, a hapax word or a style flag that counts instances adds
   a well at the bottom of the inspector: every sentence holding an
   instance, with its ¶ address, the instances lit, under a header such as
   "28 instances in 26 sentences".
3. **The hapax list.** The Top Words panel lists the words used once, below
   the cloud, in the space the panel already has beside Parts of speech.
   Its length is the stats row's "hapax" count, exactly. Each word lights
   its paragraph on hover and pins on click, showing its one sentence.

And one fix: the inspector's count strings agree in number ("1 word per
sentence", not "1 words per sentence"), and so do the word panels'.

## What the webview holds today

The board carries counts and paragraph addresses, never paragraph text
(`LightboxSource` keeps only a short preview, and `LightboxService` keeps
the paragraph texts host-private). So both wells need the host.

## Contracts

- **One correlated route pair**, following the project picker's (PR #154
  F-01) and the estimate's (PR #149 F-03) rules:
  - `LIGHTBOX_REQUEST_PASSAGE` (webview → host), owned by a new
    `LightboxPassageHandler` beside `LightboxHandler`, which is at its
    500-line limit: `{ requestId, boardId, contentHash, item }`.
  - `LIGHTBOX_PASSAGE` (host → webview): `{ requestId, boardId,
    contentHash, passage }`.
  - `item` is a paragraph range (with the measured term it was reached
    from, if any) or a measured term's instances. Terms are named as the
    board names them: a top word, a part of speech and its word, a phrase,
    a hapax word, a style flag's id.
  - `passage` is the paragraphs' text in segments, the instance rows, or a
    refusal: `changed` (the board named is no longer held, or holds other
    text) or `not-on-board` (the item is not listed on that board).
  - Contracts live in `shared/types/messages/lightboxPassages.ts`, through
    the `@messages` barrel; bounds in `shared/constants/lightboxPassages.ts`.
- **Correlation.** The webview mints each request id (a per-webview prefix
  and a count). It takes only the reply to the request still pending, and
  only when that reply's board id and content hash are the board on
  screen's. A new board (a new id or hash) drops the pending request and
  asks again; until the answer lands, the well says the text changed
  rather than show the old text as current.
- **Persistence.** None. Chapter text never enters `vscode.setState`. The
  pin stays ids only: a paragraph pin may carry the term it was reached
  from (a word, never text).
- **The board** gains:
  - `measured.hapax`: each word used once, as the stats row counts it, with
    how it is written and its paragraph, in order of first appearance;
  - on each style flag, `paragraphs` and, for the four flags that count
    instances, a stable `id`.
- **Item refs** gain `hapax` and `flag`, and a paragraph ref may carry
  `via`, the term it was reached from. `via` is not part of the pin's
  identity: the ribbon's own column for that paragraph shows as pressed.

## Counts agree by construction

Each well finds instances with the rule that made the figure it shows:

| Figure | Rule |
|---|---|
| Top words | The word-frequency tokenizer over the whole text, lower-cased: en and em dashes split words; letters, hyphens and apostrophes are kept; edge apostrophes are trimmed |
| Repeated phrases | Consecutive tokens of that same stream over the whole text, so an occurrence across a paragraph break counts, as the tool counts it |
| Parts of speech | The tagger's occurrence stream as the board placed it (PR #148 F-03): its tokens, such as `do`, `n't` and `'s`, which can sit inside a contraction |
| Hapax | The prose-stats tokenizer the stats row counts with: whitespace-split, lower-cased, letters and apostrophes kept, nothing trimmed |
| Style flags | Style Flags' own detectors (adverbs, passive voice, filler words, and weak verbs, whose detector is exported for this) |

- The two tokenizers are the tools' own functions. The prose-stats one is
  exported for this, and the tool counts through it, unchanged.
- **Spans.** A token's span runs from the first to the last character it
  keeps, so "window." lights "window" and "don't" lights "n't" for the
  tagger's token. A POS token's span is the tagger's token, so the tool
  records each token's length beside its offset.
- **Sentences** are each paragraph's `proseSentenceSpans`, the board's own
  per-paragraph sentence rule. An instance that runs across a sentence or
  paragraph break joins the sentences it touches into one row.
- **Not clickable:** Repetitive Words and Clichés. Their counts are words
  and phrases found, not instances, so no well could agree with them.

## UI

- **Paragraph well.** Under the claim, "The text · as counted", then the
  paragraph in a scrollable well, labelled for assistive tech and
  focusable for keyboard scrolling. A range pin (a bucketed ribbon column)
  shows its first paragraphs, each with its ¶ number, up to a stated bound.
  When reached from a term: "Lit: “alice”, 2 instances here" and a button
  back to the term.
- **Sentences well.** At the bottom of the inspector: "Sentences", the
  header ("28 instances in 26 sentences"), and the rows in an ordered list
  inside a scrollable, labelled, focusable well. Each row's ¶ address is a
  board item: hover lights the paragraph, click pins it with the term lit.
  Rows are bounded; past the bound a note says how many sentences and
  instances are not listed.
- **Loading and refusals** say what is happening in host words: finding
  the sentences, the text changed, not on this board.
- **Hapax list.** Below the cloud: "Used once · 552 words, in order of
  appearance", then the words as written, as board items, in a scrollable
  well that fills the panel's spare height and keeps a minimum height when
  the panels stack.
- **Style flags** with an id become board items (hover and pin); the other
  two stay plain counts.
- **Hover** stays as the Top Words footnote says: "Hover a word to light
  its paragraphs. Click to pin it."
- CSS joins `inspector.css` and `tiles.css`, uses the `--pm-…` tokens, and
  stays at the webview CSS floor (`webviewCssFloor.test.ts`): Chromium
  102 when planned, Chromium 114 since PR #158.
- The live inspector does not read a well's text out (`aria-live="off"`).

## Tests

- **Count agreement over every listed entry** on the public-domain
  fixtures (the worked examples' *Alice* ¶1–¶8, and the opening with
  curly, straight and mixed quotes): top words, the four part-of-speech
  lists, bigrams, trigrams, the hapax list and the clickable flags. For
  each, the instances found equal the board's count, and so do the
  distinct instances lit in the rows. A few carry literal expected counts,
  checked by hand.
- **Hapax:** the list's length equals the stats row's count on each
  fixture, with a literal count; first-appearance order; the tokenizer's
  edges (apostrophes kept, hyphens and dashes dropped, `İ`, digits).
- **Tokenizer spans** agree with the tools' token lists on edge text.
- **Route:** the handler answers by board id and content hash, refuses a
  changed board and an item not on the board, ignores a request with no
  id, and logs no chapter text.
- **Correlation in the webview:** a stale request id, another board's
  reply and a changed hash are dropped; a new board re-asks and shows the
  text changed until its reply lands.
- **Persistence:** after a passage lands, no `setState` holds its text.
- **Plurals:** each fixed string fails before its fix and passes after.
- **UI:** the wells' roles, labels, keyboard focus, bounds and notes; the
  hapax list's hover and pin; style flags as items; `via` lit in the
  paragraph with the way back.
- Every new module joins `LIGHTBOX_MODULES`, the transport-free list where
  it is pure, and the route ledger.

## Implementation notes (2026-10-21)

This section records what landed and where it differs from the plan above.

### Contracts and files

- **The route pair is as planned.**
  - `LIGHTBOX_REQUEST_PASSAGE` is owned by the new
    `LightboxPassageHandler` (182 lines). `MessageHandler` constructs it
    with the one `LightboxService` and registers its route.
  - `LIGHTBOX_PASSAGE` answers it.
  - `item` is `{ kind: 'paragraphs', from, to, via? }` or
    `{ kind: 'instances', term }`. A term is a `word`, a `pos` (part of
    speech and word), a `phrase`, a `hapax` word or a `flag` (one of four
    ids).
  - `passage` is one of:
    - `paragraphs`: each paragraph's text in segments, how many more
      paragraphs the range holds, and, with `via`, what is lit;
    - `instances`: the instance and sentence totals, the rows, and
      `more: { rows, sentences, instances }` past the bound;
    - a refusal, `changed` or `not-on-board`.
  - A segment is `{ text, instances? }`. Each instance has one id across
    the passage, so an instance split by a sentence or paragraph break
    lights as one.
  - **Bounds** (`LIGHTBOX_PASSAGE_BOUNDS`): 50 rows, 10 paragraphs, and 200
    characters for any name in a request.
- **The host.**
  - It checks each request's shape. It answers from the text it measured
    for that board id and hash.
  - It refuses with `changed` when it holds no such board, or holds the id
    with another hash.
  - It ignores a request with no request id, board id or hash.
  - It logs kinds and counts, never a term or text. If the instances it
    finds ever differ from the board's count, it logs "✗ a top word: N
    instances found, but the board counts M."
- **Host modules**, all in `LIGHTBOX_MODULES` and the boundary lists:
  - `LightboxInstances`: each figure's token spans and instance finders,
    the hapax words, and the paragraph lookups.
  - `LightboxPassageIndex`: built with each board. It holds the text,
    paragraph spans and the placed part-of-speech occurrences. Sentences
    and token streams are built on the first request that needs them.
  - `LightboxPassages`: a passage from a board and its index, and a term's
    count on the board.
  - `LightboxService` keeps the index beside each board it holds and
    exposes `passageSource(boardId)`. It is at 486 lines.
  - `LightboxMeasures` exports its part-of-speech placement
    (`placeLightboxPosOccurrences`). The board and the well place the
    tagger's tokens with that one function.
- **Tools.** Three small exports, with no change to what the tools count:
  - `proseStatsWords`, the prose-stats tokenizer, which the tool now calls;
  - `findWeakVerbs` and `STYLE_FLAG_WEAK_VERBS`, which `checkWeakVerbs` now
    calls. A test pins it to the old implementation's results;
  - `length` beside each part-of-speech occurrence's offset, so the
    tagger's `n't` lights three characters, not the whole word.
- **Shared.**
  - `shared/types/messages/lightboxPassages.ts` and
    `shared/constants/lightboxPassages.ts` (bounds, flag ids and rules).
  - `lightbox.ts` gains `measured.hapax` (`{ term, written, paragraph }`),
    and each style flag gains `paragraphs` and, for four flags, `id`.
- **Webview.**
  - `lightboxTerms.ts`: term refs, keys, labels and their inspector items,
    moved out of `lightboxItems.ts`, which is now 423 lines.
  - `lightboxPassages.ts` (pure): a pin's passage item, the request key,
    and the well's view and notes.
  - `useLightboxPassages.ts`: the transport hook, with request ids, the
    pending and answered requests, and `requestPassageForPin`.
  - `LightboxPassageWell.tsx` and `LightboxHapaxList.tsx`.
  - Updated: `LightboxInspector`, `LightboxTopWords`,
    `LightboxPartsOfSpeech`, `LightboxApp`, `inspector.css` and
    `tiles.css`.

### What the webview holds

- **Only the answer for the pin on screen, in memory.**
  `useLightboxPassages` persists `{}`. The pin stays ids: a paragraph
  pin's `via` is a term (a word), never text. A test reads every
  `setState` after a passage lands and finds none of its text.
- **Request ids** are `lbx-psg-<random>-<n>`. A reloaded webview never
  takes an answer meant for the one before it.
- **A new board** (a new id or hash) under the same pin asks again. Until
  the answer lands, the well says "The text changed since this was shown.
  Reading it again from the board as it stands…" and shows none of the
  old text.

### Counts agree

- **Every listed entry, on six public-domain fixtures.**
  - The fixtures: the worked examples' ¶1–¶8; the opening with curly,
    straight and mixed quotes, and with wrapped lines; and 6,000 words of
    the opening's vocabulary, long enough to pass the row bound.
  - The entries: every top word, every entry of the four part-of-speech
    lists, every bigram and trigram, every hapax word and every clickable
    flag.
  - For each, the instances found equal the board's count. So do the
    distinct instances lit in the rows plus those past the bound.
- **Literal counts** on ¶1–¶8, checked with grep:
  - alice 7; the verb "was" 13; the adverb "very" 8; "she had" 3;
  - Weak Verbs 28; Filler Words 11; Adverbs (-ly words) 7;
  - hapax 139, the stats row's count.
  - Both of ¶2's "sister"s are in its first sentence.
  - The list opens Chapter, beginning, tired, sitting, bank.
- **Mutations fail it.** Finding top words with the prose-stats tokenizer,
  or part-of-speech words with the word tokenizer, fails the agreement
  test.
- **In Chapter I** (the [evidence](../../../docs/pr-reviews/evidence/lightbox-slice-4e-visual/README.md)):
  - alice 27 in 26 sentences; was 53 in 32; she had 8 in 6; Weak Verbs
    119 in 48;
  - hapax 340, as the stats row says;
  - in the whole book, alice 385 in 378 sentences: 50 rows with 51 lit,
    and 334 past the bound.

### The hapax list

- **What it counts.** The words the stats row's "N hapax" counts: the
  prose-stats tokenizer (split at whitespace, lower-cased, letters and
  apostrophes kept, nothing trimmed), each used once.
  - So "daisy-chain" counts as "daisychain".
  - The list shows each word as the text writes it. Its tooltip gives the
    counted form when that differs: "Used once, in ¶3; counted as
    “daisychain”".
- **In order of first appearance.** The board is laid out along the
  chapter, so the list reads with the chapter and walks the ribbon left
  to right. The Metrics tab already lists hapax alphabetically. If the
  writer prefers another order, only the list's sort changes, not its
  count.
- **Paged at 300 words**, then "Show N more · N not shown yet". The whole
  book has 1,284. The plan did not mention paging.
- **Its height.** At the wide layout it fills the panel's spare height
  beside Parts of speech, out of flow, so the row does not grow. Stacked,
  it keeps a minimum height (174 px for the well in the evidence).
- Pinning a word lists its one sentence.

### Plurals

- **Eight strings.** Each is pinned literally by
  `lightboxCountWords.test.tsx`, with a plural control. All eight cases
  failed before the fix.
  - a paragraph's claim: "1 word in 1 sentence · 1 word per sentence";
  - a standout: "1 paragraph holds";
  - Sections: "1 heading", "1 scene break", "1 chapter line";
  - Pressure: "1 thread";
  - Rhythm: "1 paragraph runs at";
  - Dialogue: "1 paragraph of 2 carries dialogue";
  - the stock tier mix: "0 of 1 beat";
  - the stats row: "1 word", "1 paragraph", "1 sentence".
- **Dialogue copy changed.** "1 of 2 paragraphs carry dialogue" became "1
  paragraph of 2 carries dialogue".
- **Left alone:** the numbers row's instance labels ("being verbs") are
  host nouns with no singular form. They belong to the numbers lens
  (Slice 4F).

### Decisions and deviations

- **Style flags.** Weak Verbs, Filler Words, Adverbs (-ly words) and
  Passive Voice are items. Repetitive Words and Clichés stay plain counts,
  as planned.
- **A paragraph pin keeps its term.** Pinning a ¶ address from a well
  keeps the term as `via`, and the paragraph opens lit. Pinning from the
  ribbon drops it. One `useLightboxInspector` test changed on purpose,
  with a control beside it.
- **A range pin** (a bucketed ribbon column) shows up to 10 paragraphs,
  with a note past that.
- **The sentences are the board's.** The well's header and rows follow
  the board's sentence rule, including its closing-quote quirk (see
  Limits).
- **The hapax list pages**, as above.

### Limits and follow-ups

- **The board's sentence rule.** A closing quotation mark after a
  sentence's end starts the next sentence, so `“Oh dear!”` is "2 words in
  2 sentences" and a row can begin with "”". This is the writer's two-word
  case. It is recorded as
  [tech debt](../../tech-debt/2026-10-21-prose-sentences-closing-quote.md)
  (Medium), not patched in the well, so the well and the board count the
  same sentences.
- **Past 50 rows** the well counts what is not listed, but cannot page to
  it.
- **Phrases across a paragraph break.** The tool counts them, so the well
  lists them. Hover still lights only the paragraphs that hold a whole
  occurrence.
- **Tagger fragments** such as `ll` and `s` light where the tagger split
  them
  ([tech debt](../../tech-debt/2026-10-19-pos-tagger-token-fragments.md)).
- **Readings.** A paragraph reached from a reading's quote does not light
  the quote.
- **Standout figures and the numbers row** do not open a well. That is
  the numbers lens's ground (Slice 4F).

### Review fixes (PR #159, 2026-10-21)

Astra's review requested changes for one finding and noted one
nonblocking optimization. Both are fixed. Her report, with the author
response and resolution ledger, is
[`pr-159-lightbox-inspector-reading-aids-review.md`](../../../docs/pr-reviews/pr-159-lightbox-inspector-reading-aids-review.md).
- **F-01: going back to a held passage (`86d269a`).**
  - **The bug.** Going back to a pin whose answer the webview held left
    another pin's request pending. Its late answer replaced the held one,
    and the well read "Finding the sentences…" with nothing more asked.
    Through the UI: "alice", then a row's ¶2, then Back before ¶2
    answers, then ¶2's answer.
  - **The fix.** `useLightboxPassages` keeps pending only the request for
    the pin on screen. Going back to a held pin or board asks nothing and
    drops what was pending, so that answer is never taken. The dropped pin,
    pinned again, asks again under a new id.
  - **Tests.** All four fail on `058feb5`; the earlier controls pass on
    both.
    - The held ¶2 → Back sequence runs through `LightboxApp` with the real
      host handler.
    - Three hook cases cover a held pin, a held board, and the dropped pin
      asked again.
  - **Evidence.** A tenth state, `back-late`, holds ¶2's answer and
    releases it after Back. Against the bundle the review read, it fails
    at every width and every other state passes.
- **N-01: one long row (`31a4550`).**
  - **The cost.** The row bound limits rows, not what one row holds.
    - Each segment scanned every instance, and each of a row's sentences
      did the same.
    - So one sentence of 25,000 instances, or a phrase across 25,000
      sentence breaks, took seconds on the extension host.
  - **The fix.** One walk matches sentences, or a range's paragraphs, to
    the instances that touch them. One sweep over where instances open and
    close cuts each into segments. Overlapping instances keep their own
    numbers, and nothing is dropped.
  - **Proof of sameness.** Before the change was kept, a throwaway
    differential check compared it with `058feb5`'s cutting and found
    7,077 passages identical:
    - every listed entry on the agreement fixtures, as instances;
    - each paragraph lit by each entry;
    - overlapping, cross-paragraph and long texts.

    Rebuilt, the evidence's host states are byte-identical.
  - **Tests.** "One long row" in `LightboxPassages.test.ts` pins literal
    counts on both shapes, under a coarse 1 s ceiling.
    - On `058feb5` the counts pass and the ceilings fail, at about 2 to
      4 s a passage.
    - Now each passage takes about a tenth of the ceiling.
- **Merged with PR #158 (`6d63a6e`).** The floor is now VS Code 1.82
  (Chromium 114). Slice 4E's stylesheets pass the retargeted guard as they
  are, with nothing added to its lists.

### Verification

| Check | `20775cf` (base) | `058feb5` (reviewed) | Head (fixes, merged with `e8389bf`) |
|---|---|---|---|
| `npx jest` | 430 suites / 5,916 tests / 59 snapshots | 440 / 6,012 / 59 | 440 / 6,019 / 59 |
| `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule | Identical per file and rule |
| `npm run typecheck` | Passes | Passes | Passes |
| `npm run build` (with `verify:bundle`) | Passes; `webview.js` `0f6624f4…` | Passes; `8d0545de…` | Passes; `2f86917e…` |
| Diff whitespace check | | Clean | Clean |

- Every bundle was built from an empty `dist/`, after `npm ci` into a real
  `node_modules`. Each head bundle built twice gave the same hash.
- The head's 6,019 tests are:
  - the reviewed 6,012;
  - the six review tests;
  - one test from PR #158's floor guard.
- Visual evidence:
  [`lightbox-slice-4e-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4e-visual/README.md).
- No live or billable call.

## Done when

On the *Alice* fixture, pinning a paragraph shows its text, lit when
reached from a term; pinning any listed word, part of speech, phrase,
hapax word or instance-counted flag lists its sentences with exactly as
many lit instances as the board counts; the Top Words panel lists exactly
as many hapax words as the stats row counts; and no chapter text is
persisted.
