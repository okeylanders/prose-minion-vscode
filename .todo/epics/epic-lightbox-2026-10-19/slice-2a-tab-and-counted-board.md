# Slice 2A: The Lightbox Tab and the Counted Board

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D1, D3, D4, D5, D8 (ceiling), D10, D12 (ephemeral)
**Status:** In review ([PR #148](https://github.com/okeylanders/prose-minion-vscode/pull/148); review fixes pushed, awaiting re-review)
**Prerequisite:** [Dialogue % misses curly quotes](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md) is fixed, so the headline figure and the per-paragraph lane agree.

## Outcome

"Prose Minion: Open Lightbox" and "Open Selection in Lightbox" open an editor
tab built on the Slice 1 shell. The writer picks a file or sends a selection,
and the board shows the counted tiles with no model call: headline stats,
the standards comparison, top words, parts of speech, repeated phrases and the
paragraph ribbon (rhythm and dialogue lanes). Hovering a word, phrase or
ribbon column lights the paragraphs it touches. Clicking pins it in the
inspector. The reading tiles render as "not read yet" placeholders, and the
Read button is present but disabled until Slice 2B.

## Host

- **Provider:** `apps/vscode-extension/src/application/providers/LightboxPanelProvider.ts`
  - a `WebviewPanelSerializer`, view type `prose-minion.lightbox`,
    `retainContextWhenHidden`;
  - `attachPanel` mirrors the Workshop's and constructs only
    `new MessageHandler(this.coreServices, …)`;
  - `seedSource({ text?, sourceUri?, relativePath? })` routes a synthetic
    `LIGHTBOX_SET_SOURCE` through its own handler, the `seedExcerpt`
    pattern.
- **Composition root** (`extension.ts`):
  - construct the provider with `CoreServices`;
  - register its serializer (the `providerAssembly.test.ts` count goes from 1
    to 2);
  - add the commands `prose-minion.openLightbox` and
    `prose-minion.lightboxSelection` (editor context menu, `editorHasSelection`);
  - add `uiActions.openLightbox` so the sidebar can open it later.
- **Manifest:** commands, the context-menu entry, and the activation events
  `onWebviewPanel:prose-minion.lightbox`, `onCommand:…`.
- **Contracts:** `shared/types/messages/lightbox.ts`
  - `LightboxBoard`, `LightboxSource`, `LightboxParagraphMetric`,
    `LightboxMeasuredSet`, `LightboxReadingGroup` (status `not-run` only in
    this slice), and the `LightboxTileKind` union (empty for reading kinds
    until 2B);
  - routes `LIGHTBOX_REQUEST_BOARD`, `LIGHTBOX_SET_SOURCE`,
    `LIGHTBOX_PICK_SOURCE_FILE`, `LIGHTBOX_REFRESH_SOURCE`,
    `LIGHTBOX_BOARD`, `LIGHTBOX_SOURCE_REFUSED`, with `MessageType` members
    in `base.ts`.
- **Constants:** `PROMPT_BUDGETS.lightbox = { sourceWords: 50_000, chapterWords: 12_000, ribbonColumns: 96 }`,
  pinned in the prompt-budget test.
- **Paragraph model:** `infrastructure/lightbox/LightboxParagraphs.ts` (pure)
  - `splitLightboxParagraphs(text)` uses the `/\n\s*\n/` rule and returns
    index (from 1), text, offsets and word count;
  - per-paragraph sentences, average sentence length and dialogue share
    (straight and curly quotes);
  - `lightboxContentHash(text)`;
  - `bucketParagraphs(count, columns)` for the ribbon.
- **Service:** `infrastructure/lightbox/LightboxService.ts`
  - builds the measured set from the three measurement services plus
    `StandardsService.enrichWithStandards`;
  - enforces the ceiling (a refusal carries the word count and a
    suggestion);
  - keeps the latest board per source in memory (D12).
  - It is built in `extension.ts` and added to `CoreServices`.
- **Handler:** `application/handlers/domain/LightboxHandler.ts`
  - registers the routes above;
  - resolves sources through `TextSourceResolver`;
  - posts `LIGHTBOX_BOARD`.
  - It is constructed in `MessageHandler` as the thirteenth domain.

## Webview

- `LightboxApp.tsx` on `FullTabShell`:
  - brand: eyebrow "Prose Minion · Inspiration & Mood Board", title
    "Lightbox", and the source as subtitle;
  - the chrome from `useFullTabChrome` with `source: 'webview.lightbox'`.
- `hooks/domain/useLightbox.ts` (tripartite): board, source, refusal, and the
  persisted UI preferences (filter, selected item, lens toggles).
- Presentation controllers under `hooks/domain/lightbox/controllers/`:
  - `useLightboxFocus` (hover and selection, the focused paragraph set);
  - `useLightboxInspector` (the pinned item's view model).
  - Both are free of `useVSCodeApi`, `MessageType` and `postMessage`.
- Components under `components/lightbox/`: `LightboxSourcePanel` (rail),
  `LightboxRibbon`, `LightboxStatRow`, `LightboxTopWords`,
  `LightboxPartsOfSpeech`, `LightboxInspector`, `LightboxReadingPlaceholder`.
  The tile map is an exhaustive `Record<LightboxTileKind, …>`.
- Styles: `styles/lightbox/*.css`, scoped to `[data-pm-surface="lightbox"]`.
  The register tokens are measured (solid, accent), read (dashed, periwinkle)
  and counted-read (neutral), taken from the design. The import list is
  pinned in `workshopStyles.test.ts` (or its renamed successor).

## Tests

- Paragraph model:
  - the split agrees with `PassageProseStats.paragraphCount` on fixtures;
  - dialogue share with straight, curly and mixed quotes;
  - the hash is stable;
  - bucketing at 1, 96, 97 and 1,500 paragraphs.
- Service: ceiling refusal at 50,001 words; measured set shape; board cache
  per source.
- Handler: routes registered; a refused source posts `LIGHTBOX_SOURCE_REFUSED`.
- Provider and assembly: serializer count 2; `new MessageHandler(this.coreServices…`
  only; activation event present.
- Webview:
  - the focus controller lights the right ribbon columns for a word and for a
    bucketed range;
  - the inspector view model for a measured item;
  - the tile map is exhaustive (a type-level test).
- Architecture: Lightbox modules on the boundary lists (ADR D13).

## Done when

- Opening a 3,000-word chapter shows the counted board with no network call.
- A 60,000-word file is refused with its count before anything runs.
- Hover and pin work for words, phrases and ribbon columns.
- The Workshop is untouched apart from the shared shell.

## Implementation notes (2026-10-19)

Built on `epic/lightbox-slice-2a-board` from the approved Slice 1 head. Where
the build differs from the plan above, or the plan left a choice open:

**Board contract** (`shared/types/messages/lightbox.ts`)

- The board carries D3's fields plus three additions:
  - `ribbon`: the host buckets the paragraphs into ribbon columns
    (`bucketParagraphs`, pooled rhythm and dialogue per column). The renderer
    only draws, so there is one bucketing implementation, and the paragraph
    model (which hashes with `node:crypto`) never enters the webview bundle.
  - `source` also has `kind` (file or selection), the selection's lines and a
    short `preview`, so the writer can see what was boarded.
  - Each paragraph metric also has `dialogueWords`, so ranges pool exactly.
- `LightboxTileKind` is the measured kinds (`stats`, `top-words`,
  `parts-of-speech`) plus the reading kinds, which are `never` until 2B. D3's
  union lists reading kinds only, but its register table needs the measured
  kinds to mean anything. `LIGHTBOX_TILE_REGISTER` (in
  `shared/constants/lightbox.ts`) and the renderer map are exhaustive over the
  union, with a type-level test.
- `LIGHTBOX_BOARD` carries the host's current outcome,
  `{ board: LightboxBoard | null, refusal: LightboxSourceRefusal | null }`,
  so the mount request always gets an answer and replays a refusal the
  webview missed (review F-02). `LIGHTBOX_DISMISS_REFUSAL { refusalId }` is
  the fifth inbound route; refusals carry a host-minted `id`.
- `LIGHTBOX_SOURCE_REFUSED` covers every failure, not just the ceiling:
  `over-ceiling` (with the count, the ceiling and a suggestion), `empty`,
  `unreadable` and `not-refreshable`. The Lightbox has one failure surface and
  routes no generic `ERROR`.
- `LightboxLensId` (the six 2B lenses) and the lens catalog
  (`LIGHTBOX_LENSES`, with each lens's group) are shared, for 2B's toggles.

**Paragraph model and measured set** (`infrastructure/lightbox/`)

- `LightboxParagraphs.ts` is pure. Paragraph text and offsets are trimmed;
  words are whitespace tokens; sentences use the prose-stats rule, now
  exported as `countProseSentences`; dialogue uses `countDialogueWords` per
  paragraph. Tests check the split against `PassageProseStats` on eleven
  fixtures and the dialogue words against the whole-text count.
- The hash is SHA-256 over the text with line endings folded, NFC applied and
  outer whitespace trimmed.
- `LightboxMeasures.ts` maps the tools' outputs into the contract and places
  each counted word and phrase in its paragraphs with the word-frequency
  tool's own tokenizer (now exported as `extractFrequencyWords`). A phrase
  that only spans a paragraph break lights nothing. Parts of speech are
  counted and placed from the tagger's own occurrence stream instead (review
  F-03, below).
- The word-frequency options are fixed for boards rather than read from the
  Metrics settings, so every board has the same shape: POS (with its
  occurrence stream) and n-grams on, 24 top words, six words per part of
  speech. They live beside the measured-set builder
  (`LIGHTBOX_WORD_FREQUENCY_OPTIONS` in `LightboxMeasures.ts`). Repeated phrases come from the
  tool's ranking (a new optional `ngramLimit`, default 20 as before, set to
  120 here) and keep those with two or more occurrences and at least one
  non-stopword (the tool's stopword set, now exported).

**Service** (`LightboxService`)

- The ceiling check counts words before anything is measured.
- Boards are kept per source (the document's URI, plus lines for a
  selection; the display path only as a fallback), most recent 12.
  Re-reading unchanged text keeps the board's id (and, from 2B, its
  readings) but measures again, so a changed setting such as the standards
  preset still shows.
- The service owns source requests (review F-01): each request takes a
  ticket before any read or build is awaited, and only the newest may adopt
  a board or publish a refusal; anything older is `superseded`.
- The re-read path is host-private and never on the board.

**Host**

- File picking reuses `ShellService.pickFile`, the Workshop's "Pin from file…"
  seam. The port gained an optional `openLabel` (the dialog says "Open"; the
  Workshop keeps "Pin"). No new platform port.
- Files resolve through `TextSourceResolver` by absolute path only: a picked
  file's `fsPath`, or a `file:` URI converted host-side. The resolver keeps
  reads inside an open workspace folder. Relative paths are avoided because
  the resolver silently falls back to the active editor when one matches
  nothing ([tech debt](../../tech-debt/2026-10-19-text-source-active-editor-fallback.md)).
  An unsaved document is refused with a suggestion.
- `prose-minion.lightboxSelection` seeds the selection or, with none, the
  active file (ADR D1). Its context-menu entry shows on `editorHasSelection`.
- The panel re-asks for the board when it becomes visible, as the Workshop
  re-asks for its session; the answer is the service's current outcome.
- Handlers post only what the service publishes, subscribing on their
  webview's first `LIGHTBOX_*` message and unsubscribing on dispose (review
  F-01).
- Logs carry paths, counts and refusal reasons, never text (a handler test
  checks this).

**Webview**

- The rail has a **Lenses** card the plan did not list. The hook persists lens
  toggles as the plan says, and a persisted preference with no control would
  be dead state. Turning a lens off hides its placeholder now; 2B will leave
  it out of its group's call. The card states that readings arrive in the
  next update instead of showing a cost.
- Measured items are words, tagged words, repeated phrases, the rhythm and
  dialogue lane labels, and ribbon columns. The rhythm lane lights paragraphs
  that run at 1.5× the text's average words per sentence or longer; the
  dialogue lane lights paragraphs with any dialogue. The tension lane label
  is static and its lane is drawn empty and dashed.
- Clicking a pinned item again unpins it. The inspector's ¶ chips pin that
  paragraph, and a single paragraph offers the measured items that touch it.
  The chips render 48 at a time behind a pager with a jump to a paragraph
  number (review F-04).
- The design's display and serif faces cannot load in a webview (the CSP
  allows no font hosts), so the stacks fall back to system faces.

**Styles**

- Six sheets under `styles/lightbox/` (tokens, board, ribbon, tiles, rail,
  inspector), imported by `LightboxApp.tsx` and pinned by
  `workshopStyles.test.ts`, which also checks that every Lightbox rule is
  scoped to `[data-pm-surface="lightbox"]`.
- The rail cards (`.pm-ws-block`, `-grow`, `-head`) moved to the frame with
  unchanged declarations.
- The aside is tuned: `300px | main | 340px`. `FullTabShell` stamps
  `.pm-ws-with-aside` on the frame root when it renders an aside, because the
  engine floor (VS Code 1.75, Chromium 102) predates `:has()`. At 1240px and
  below the tab scrolls as one page with the inspector under the rail (it
  sticks); at 760px everything stacks, with the inspector below the board.
  The Workshop has no aside, so its DOM and layout are unchanged.

**Verification**

| Check | Before | After |
|---|---|---|
| Jest | 321 suites, 4,776 tests, 2 snapshots | 329 suites, 4,881 tests, 2 snapshots |
| Lint | 0 errors, 1,140 warnings | 0 errors, 1,140 warnings (same per rule and per file) |
| `npm run typecheck` | Passes | Passes |
| `npm run build` | Passes | Passes |

- Every Lightbox module is under 500 lines (a boundary test lists them all).
  `extension.ts` (652 lines) and `MessageHandler.ts` (909) were already over.
- Visual evidence in headless Chromium:
  [`docs/pr-reviews/evidence/lightbox-slice-2a-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md).
  It shows the empty, counted (one word pinned) and refused states at 1440,
  1000 and 500 px from real host output, and the Workshop's DOM and pixels
  matching the Slice 1 bundle.

**Review fixes (PR #148, 2026-10-19)**

Astra's [review](../../../docs/pr-reviews/pr-148-lightbox-counted-board-review.md)
found four defects; each has its own commit and regressions (the author
response at the end of the review maps them):

- **F-01, source ownership.** `LightboxService.beginSourceRequest()` mints a
  ticket when the writer's choice is concrete: a selection, seeded file or
  re-read when its request arrives; a picked file when the picker returns it
  (opening the picker is not a choice, and a dismissal mints nothing). Only
  the newest ticket adopts or refuses. Outcomes are published to subscribed
  handlers (`addOutcomeListener`), so a request that outlives its panel lands
  in the replacement and the sidebar and Workshop receive no boards.
- **F-02, refusal replay.** The service keeps the refusal of the newest
  request beside the current board until it is dismissed (by id) or a board
  replaces it; `LIGHTBOX_BOARD` carries both. A refusal over a retained board
  names the refused source and the one still shown.
- **F-03, parts-of-speech provenance.** The word-frequency tool exposes the
  stream its POS counts come from (`tagPartsOfSpeech`: each counted tagged
  word with its token's offset; `rankPartsOfSpeech`), and `analyze` counts
  from it, unchanged for the Metrics tab (byte-identical output on twelve
  chapters). The board counts and places each POS word from those
  occurrences, keyed by word and part of speech. It keeps the whole-text
  tagging: tagging per paragraph changes tags where a heading without
  punctuation runs into the next paragraph, so counts would diverge from
  Metrics. On all twelve Alice chapters the board's POS lists equal the
  Metrics tab's and every count equals its occurrences in its paragraphs.
- **F-04, inspector addresses.** 48 chips per page; previous/next, a
  "¶a–¶b (i–j of N)" label, and a jump that focuses the address it lands on;
  paging never changes the pin.
- **Nonblocking: source identity.** Retained boards are keyed by URI, so two
  roots' `chapter.md` keep separate boards.
- **Visual evidence:** a `paged` state in the
  [evidence folder](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md#pr-148-review-fixes-2026-10-19).
- **Verification** (review head → fix head): Jest 329 suites / 4,881 tests →
  333 suites / 4,921 tests (2 snapshots); lint 0 errors / 1,140 warnings →
  0 / 1,135 (−5 `curly` where the word-frequency tool's inline POS block was
  replaced; no file gained a warning); typecheck and build pass. Every
  Lightbox module stays under 500 lines.

**Follow-ups**

- **Slice 2B:** reading kinds join `LightboxTileKind`, the register table and
  the renderer map; lens toggles reach the host; the Read button, the tension
  lane and the run line.
- **Slice 6:** check the commands, the context-menu entry, serializer restore,
  the picker and the narrow layouts in the Extension Development Host.
- **Narrow widths:** at 760px and below the rail (source and lenses) comes
  before the board; consider collapsing the Lenses card there.
- **Tech debt:**
  [the resolver's active-editor fallback](../../tech-debt/2026-10-19-text-source-active-editor-fallback.md);
  [contraction fragments in part-of-speech lists](../../tech-debt/2026-10-19-pos-tagger-token-fragments.md);
  [the frame class prefix](../../tech-debt/2026-10-19-fulltab-frame-class-prefix.md)
  now also covers the rail cards and the aside classes.
