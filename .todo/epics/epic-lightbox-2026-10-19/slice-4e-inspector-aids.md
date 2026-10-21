# Slice 4E: Reading Aids in the Inspector

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D4, D5, D10, D12
**Writer decisions:** 17, 18 and 19 in the [epic table](README.md#writer-decisions-2026-10-19)
**Status:** Planned (`epic/lightbox-slice-4e-inspector`, from `epic/lightbox` at `20775cf`). Built beside Slice 4F (craft steering), which takes the decisions after 19.
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
  stays at the Chromium 102 floor (`webviewCssFloor.test.ts`).
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

## Done when

On the *Alice* fixture, pinning a paragraph shows its text, lit when
reached from a term; pinning any listed word, part of speech, phrase,
hapax word or instance-counted flag lists its sentences with exactly as
many lit instances as the board counts; the Top Words panel lists exactly
as many hapax words as the stats row counts; and no chapter text is
persisted.
