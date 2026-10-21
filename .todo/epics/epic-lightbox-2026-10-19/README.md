# Epic: Lightbox

**Status:** In progress. Slice 0 (spec) is on `epic/lightbox`; the writer approved the plan on 2026-10-19. The dialogue-quote prerequisite merged (PR #146), Slice 1 merged (PR #147), Slice 2A merged (PR #148), Slice 2B merged (PR #149), Slice 3 merged (PR #150), Slice 4 merged (PR #151), and the launch entry points and shared project picker merged (PRs #152–#154). The writer's real-chapter checkpoint passed on 2026-10-20; Slices 4B–4D (new lenses) come before Slice 5: 4B merged (PR #155), 4C is awaiting review (PR #156), and 4D is implemented and awaiting review, stacked on 4C.
**Priority:** Medium
**Created:** 2026-10-19
**Integration branch:** `epic/lightbox` once the writer approves it. Slice 0 was written on `claude/friendly-volta-g1gmgc` (from `main` at `d1f25db`, v2.11.0).
**Decision:** [ADR 2026-10-19: Lightbox](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) (Proposed)
**Design:** [`docs/design/lightbox/`](../../../docs/design/lightbox/README.md), a snapshot of the Claude Design canvas (interactive prototype)

## Goal

A writer opens a chapter in a **Lightbox** editor tab and sees it laid out as
an inspiration and mood board. Counted facts appear at once and cost nothing:
headline stats, top words, parts of speech, repeated phrases, and a
paragraph-by-paragraph ribbon. One explicit press adds **readings**: genre
neighborhood, motifs, characters, voice, palette, lexical gravity, lineage,
subtext, and a Spark lane of open questions. Every reading quotes the chapter
with a paragraph address that code has checked, and names where it strains.
Hovering anything lights the paragraphs it touches. Any tile can be pinned and
carried into the Workshop.

```
┌ Prose Minion · Inspiration & Mood Board ─────────────────────────────────┐
│ Lightbox   Drafts/chapter-6.12.md · v4 · 3,087 words                     │
├──────────┬───────────────────────────────────────────────┬───────────────┤
│ Excerpt  │ A basement, a voice, and three boys…  [reading]│ Inspector     │
│ Context  │ [All|Measured|Read]  legend   3 calls · $0.04 ▶│ READ · Motif  │
│ Lenses   │ ▁▃▅▂▇▁▃  rhythm   ░▒ ░ dialogue  ┆┆┇ tension │ Walking beside│
│ Boards   │ [stats ×6]                                     │ ¶14 ¶29 ¶47   │
│          │ [top words] [palette] [lexical gravity]        │ “…walked      │
│          │ [motifs] [characters] [lineage] [genre] …      │  beside him” ✓│
│          │ [Spark · open doors]                           │ [Bring ▸]     │
└──────────┴───────────────────────────────────────────────┴───────────────┘
```

## Writer decisions (2026-10-19)

| # | Question | Decision |
|---|---|---|
| 1 | Name | **Lightbox**, with "Inspiration & Mood Board" as the header subtitle |
| 2 | Surface | **Its own editor tab**, a sibling of the Workshop tab |
| 3 | Shell | **Extract** the Workshop header and rail into a shared full-tab shell first |
| 4 | Order | Counted board and first readings, then lexical gravity and palette, then the rest and Bring to Workshop |
| 5 | Saved boards | **Yes, but as the last slice**, so the output can be reviewed before the file format is fixed |
| 6 | Model | The **existing assistant model** setting |
| 7 | Input | **One file or excerpt per board** for now, with a word ceiling (ADR D8) |
| 8 | Launch entry points (2026-10-20) | **All three**: a Lightbox button beside Workshop in the sidebar, **Open File in Lightbox** in the Explorer and editor context menus, and an editor-title icon, each for **Markdown and plain text** |
| 9 | Choosing a source and context (2026-10-20) | **The Workshop's "Choose from project" modal**, shared: the source panel opens it to pick one file, and the Context list opens it in attach mode, as the Workshop does |
| 10 | Freshness (2026-10-20) | Shown as **a reading with its counted basis**, never a number: a three-step scale, Familiar · Mixed · Fresh, labelled "a reading, not a grade", over a host-counted basis line (Slice 4C) |
| 11 | Engagement (2026-10-20) | **Kept separate from tension**: a read Low/Medium/High per movement, because pull and tension can disagree (Slice 4C) |
| 12 | Echoes (2026-10-20) | **"Echoes" replaces provenance**: aphoristic lines that "sound reminiscent of …", always with an accuracy callout (the quote is checked, the resemblance is not), never a percentage (Slice 4B) |
| 13 | Number standouts (2026-10-20) | A **measured standout plus "how it's used"**: code flags a figure outside its range or far from the writer's own average, a reading says how it works here, and nothing says "fix" or "cut" (Slice 4B) |
| 14 | Order (2026-10-20) | **The new lenses land before Slice 5** (saved boards), so the saved format holds them |
| 15 | Opinion views (2026-10-20) | **Neutral is the default view**; **Blunt is diagnosis only**, of the work, never the writer, with no rewrites (Slice 4D) |
| 16 | Opinion's place (2026-10-20) | The Opinion is an explicit, fenced **exception to "describe, never grade"**, recorded with the freshness label in a dated ADR addendum to D7 |

## Slices

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Spec | ADR, this epic, design snapshot | In review |
| 1 | [Shared full-tab shell](slice-1-shared-full-tab-shell.md) | Workshop header, banner and rail frame extracted into a shared shell with slots, a full-tab style scope, and an exhaustive surface map; the Workshop renders through it with no behavior change | Merged (PR #147) |
| 2A | [Lightbox tab and the counted board](slice-2a-tab-and-counted-board.md) | Panel and serializer, command, `lightbox` surface in the shared bundle, `lightbox` message domain, source panel, paragraph model, measured tiles, ribbon, inspector, word ceiling | Merged (PR #148) |
| 2B | [First readings](slice-2b-first-readings.md) | Prompt bundle, reading codec, quote verifier, press with preflight and cost, streaming groups, cancellation; genre, motifs, characters, voice | Merged (PR #149) |
| 3 | [Lexical gravity and palette](slice-3-lexical-gravity-and-palette.md) | Borrowed-field detection with counted hits, degrees, collisions and literal set-asides; palette clusters and swatches; **Build as a lens** handoff to Lexical Gravity | Merged (PR #150) |
| 4 | [Lineage, subtext, Spark, Bring to Workshop](slice-4-lineage-subtext-spark-bring.md) | The remaining readings, the Spark lane, and the host-mediated handoff that stages tiles in the Workshop composer | Merged (PR #151) |
| 4B | [Craft lenses (Group D)](slice-4b-craft-lenses.md) | Stock & signature (tiers counted from classified beats, familiar phrasing counted, air-locks, echoes), Rhythm & handoffs (measured sentence lengths, read endings, adjacent-sentence handoffs), What stands out in the numbers (measured standouts against ranges and the writer's own average, with how each is used) | Implemented, awaiting review (`epic/lightbox-slice-4b-craft`) |
| 4C | [Story lenses (Group E)](slice-4c-story-lenses.md) | Template & freshness (with engagement per movement and a counted basis), Pressure, Artifacts, Summary & movements, and a measured Sections lane | Implemented, awaiting review (`epic/lightbox-slice-4c-story`) |
| 4D | [Opinion (Group F)](slice-4d-opinion.md) | The one evaluative tile: three views over one set of observations that cite the board, run last on the verified digest | Implemented, awaiting review (`epic/lightbox-slice-4d-opinion`) |
| 5 | [Saved boards and draft compare](slice-5-saved-boards-and-compare.md) | `prose-minion/boards/` files with their own `formatVersion`, the Boards rail, and Compare; the format holds every tile kind through 4D, the Sections layer and a list of sources | Planned (last, by decisions 5 and 14) |
| 6 | Verify live | Extension Development Host pass on real chapters; ADR → Accepted | Pending (needs a human with VS Code) |

Slice 1 must land first: Slice 2A renders inside the shell. Slice 2A defines
the board contract and paragraph model that every later slice extends. Slices
3 and 4 are independent of each other once 2B exists. Slice 5 goes last on
purpose, so the board's shape has been reviewed on real chapters before it
becomes a file format.
Slices 4B, 4C and 4D are stacked in that order (4C joins 4B's tier counts
for the freshness basis; 4D reads every other group's tiles), and all three
land before Slice 5 (decision 14).

## Verification (every slice)

- `npm run typecheck`, `npm run lint` (no new warnings), `npx jest` (full suite)
- `packages/core/src` has no `from 'vscode'` (the architecture tests guard this)
- New modules stay under 500 lines, and new Lightbox modules join the
  boundary lists in `boundaries.test.ts` (ADR D13)
- Slices 2B–4: prompt and codec tests run against public-domain fixture prose.
  No manuscript text is committed.

## Completion criteria

- Opening a chapter shows the counted board without a model call or a cost.
- One press, with its call count and estimated cost stated first, adds the
  readings in three groups. Cancelling keeps the groups already back.
- Every reading claim shows at least one quote with a paragraph address, and
  code has verified each quote against that paragraph. A claim whose quote
  fails is withheld, by name. Every lens shows where it strains.
- Text over the word ceiling, or too large for the model's context window, is
  refused with a reason before anything is sent. Nothing is silently
  truncated or chunked.
- Hovering any tile lights the paragraphs it touches on the ribbon.
- Bring to Workshop and Build as a lens open the Workshop with the item
  staged, through the Workshop's own message path.
- Boards save to and reopen from `prose-minion/boards/`, and Compare shows
  what moved between two boards of the same file.
- Each behavior above has a focused test.

## Progress notes

- **2026-10-19. Slice 0.** Brainstorm, then an interactive design on a Claude
  Design canvas (copied to `docs/design/lightbox/`). The writer made the
  decisions in the table above and asked for a word ceiling ("something like
  50K words"); see ADR D8. Lexical gravity was added to the design at the
  writer's request and lands in Slice 3 with the handoff to the existing
  Lexical Gravity widget.
  - **Research findings that changed the plan:**
    - **No new entry bundle.** The Lightbox is a third surface in the shared
      bundle (ADR 2026-07-03), and the binary surface branches become
      exhaustive maps (D1).
    - **Own routes for excerpt and context.** The Workshop's excerpt and
      context panels are views over the one Workshop session, so the Lightbox
      gets its own `LIGHTBOX_*` routes (D10).
    - **Handoffs reuse `seedExcerpt`.** Both handoffs follow its pattern:
      through the Workshop panel's own handler (D11).
    - **Dialogue % ignores curly quotes.** It is now a prerequisite of Slice
      2A ([tech debt](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md)).
    - **Tracked as tech debt:** every webview builds every domain
      ([tech debt](../../tech-debt/2026-10-19-per-surface-message-handler-routes.md)).
  - **Word ceiling:** 50,000 words. It matches the existing
    `sourceDocument` and `contextFiles` budgets. There is a 12,000-word
    "book-sized" cost warning, a context-window fit check before the press,
    and no silent truncation (D8).
- **2026-10-19. Prerequisite: dialogue % and curly quotes.** Fixed on
  `epic/lightbox-prereq-dialogue-quotes`. Astra approved it with no
  findings, and it merged as PR #146
  ([tech debt](../../tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md)).
  - **One matcher:** `@/utils/dialogueSpans` (`findDialogueSpans`,
    `countDialogueWords`) matches straight `"…"` and curly `“…”` double
    quotes, mixed freely. No span crosses a paragraph break, so a stray quote
    mislabels at most the rest of its paragraph, and per-paragraph counts sum
    to the whole-text count. `PassageProseStats` now uses it. Slice 2A's
    per-paragraph dialogue share must call the same functions.
  - **Not matched:** single-quoted dialogue (`‘…’`) collides with apostrophes
    and elisions, so it is split into
    [its own tech debt](../../tech-debt/2026-10-19-dialogue-single-quote-convention.md).
  - **Effect:** a curly-quoted test scene went from 0% to 59.1% dialogue.
    Straight-quoted text whose quotes balance within each paragraph reports
    exactly what it did before; tests check this against the old regex.
  - **Verification:** `npm run typecheck` clean; `npx jest` 316 suites /
    4,742 tests / 2 snapshots (baseline 315 / 4,702 / 2); `npm run lint`
    0 errors / 1,140 warnings (unchanged); `npm run build` OK.

- **2026-10-19. Slice 1 (shared full-tab shell).** Built on
  `epic/lightbox-slice-1-shell` in four commits:
  1. **`useFullTabChrome`** (`hooks/fulltab/`). The generic frame state
     moves here: models, tokens, balance, API-key status, the two mount
     requests and the settings opener. It comes with
     `buildFullTabChromeRoutes`, which the Workshop router now merges.
     The envelope source is a parameter, and so is `useStartupNotice`'s.
  2. **The shell components** (`components/fulltab/`): `FullTabShell`,
     `FullTabRail`, `FullTabHeaderStatus` and `ProviderPausedBanner`. The
     Workshop renders through them with an identical DOM.
  3. **An exhaustive surface map.** `WebviewSurface` gains `lightbox`, and
     `Record<WebviewSurface, …>` maps replace the branches in
     `webviewHtml.ts` and `index.tsx`. Full tabs also stamp
     `data-pm-frame="fulltab"`. A placeholder `LightboxApp` renders on the
     shell.
  4. **The frame styles move** to `styles/fulltab/`, rescoped to
     `[data-pm-frame="fulltab"]`. `index.tsx` imports them ahead of every
     root.
  - **Verification.** Before → after:

    | Check | Before | After |
    |---|---|---|
    | Jest | 315 suites, 4,702 tests, 2 snapshots | 320 suites, 4,736 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,140 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - The lint warnings match per file and per rule. New React components
      carry the existing "React components are PascalCase" disable.
    - `WorkshopApp.tsx` went from 1,822 to 1,736 lines.
    - Headless Chromium against the built bundles, with the loading, empty,
      excerpt-pinned and provider-paused states at 1440, 1000 and 500 px:
      - The Workshop DOM is identical to the pre-slice bundle, apart from the
        frame stamp on #root.
      - The screenshots match within run-to-run raster noise.
      - At runtime the frame sheets load before the Workshop's, and
        `index.css` stays last.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-1-shared-full-tab-shell.md#implementation-notes-2026-10-19)):
    - **Transcript export.** The HTML export mirrors thread CSS verbatim
      (ADR 2026-10-05), so its mirror was regenerated with two frame layers,
      and its `<body>` now also stamps `data-pm-frame="fulltab"`. Two export
      tests and the mirror's layer-order test changed their expectations to
      match.
    - **Balance title.** The derivation lives in `FullTabHeaderStatus`
      (`fullTabBalanceTitle`), as the slice says, rather than in the hook,
      as D2 lists.
    - **Shell props.** The shell also takes overlays as `children` and an
      `onBoundaryError`.
    - **Tokens.** The Workshop's participant identity tokens stay
      Workshop-scoped.
    - **New aside CSS.** An optional aside column was added and is unused
      until Slice 2A.
  - **Follow-ups:**
    - **Slice 2A rail cards.** The rail section cards (`.pm-ws-block*`) are
      still Workshop-scoped. Move them to the frame when the Lightbox rail
      needs them.
    - **Slice 2A aside.** Tune the aside column for the inspector.
    - **`AGENTS.md`.** Done in this PR: the presentation tree lists
      `hooks/fulltab/`, and a convention note covers the shell, the
      `data-pm-frame` scope and the surface map.
    - **Slice 6.** Recheck the Workshop header, banners, Sessions menu and
      model browser in the Extension Development Host.
    - **Tech debt:**
      - [the transcript export mirror's cascade order](../../tech-debt/2026-10-19-transcript-export-mirror-cascade-order.md);
      - [the frame classes' `pm-ws-` prefix](../../tech-debt/2026-10-19-fulltab-frame-class-prefix.md).

- **2026-10-19. Slice 2A (the Lightbox tab and the counted board).** Built
  on `epic/lightbox-slice-2a-board` from the approved Slice 1 head:
  1. **Contracts and the paragraph model.** `messages/lightbox.ts`, six
     `LIGHTBOX_*` routes, `PROMPT_BUDGETS.lightbox` (50,000 / 12,000 / 96),
     and the pure splitter, per-paragraph metrics, content hash and ribbon
     buckets in `infrastructure/lightbox/`.
  2. **`LightboxService`.** The counted board from the three measurement
     services and the standards enrichment, the ceiling refusal, and boards
     kept in memory per source.
  3. **The domain and the tab.** `LightboxHandler` as the thirteenth domain,
     `LightboxPanelProvider` with its serializer, the two commands, the
     context-menu entry, activation events and `uiActions.openLightbox`.
  4. **The frame.** The rail cards move to the frame scope, and the aside is
     tuned for the inspector, including narrow widths.
  5. **The webview.** `LightboxApp` on the shell, `useLightbox`, the focus
     and inspector controllers, the tiles behind an exhaustive renderer map,
     the ribbon, the inspector, and reading placeholders with the Read button
     disabled.
  - **Verification.** Before → after:

    | Check | Before | After |
    |---|---|---|
    | Jest | 321 suites, 4,776 tests, 2 snapshots | 329 suites, 4,881 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,140 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-2a-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md).
      The Workshop's DOM is identical to the Slice 1 bundle, and every
      Workshop shot has a pixel-identical pair across the two bundles.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-2a-tab-and-counted-board.md#implementation-notes-2026-10-19)):
    - The board also carries host-bucketed `ribbon` columns, the source's
      kind, lines and preview, and per-paragraph dialogue words.
    - `LightboxTileKind` includes the measured kinds; the reading kinds are
      `never` until 2B.
    - Every refusal (not only the ceiling) goes through
      `LIGHTBOX_SOURCE_REFUSED`.
    - A Lenses rail card holds the persisted lens toggles.
    - The picker reuses `ShellService.pickFile`, which gained an optional
      `openLabel`.
    - Files resolve by absolute path only, to avoid the resolver's
      active-editor fallback.
    - The frame root gains `.pm-ws-with-aside`; the Workshop has no aside and
      is unchanged.
  - **Follow-ups:** 2B (reading kinds, lens toggles to the host, the Read
    button), Slice 6 (commands, context menu, restore and narrow layouts in
    the Extension Development Host), and two tech-debt items:
    [the resolver's active-editor fallback](../../tech-debt/2026-10-19-text-source-active-editor-fallback.md)
    and [contraction fragments in part-of-speech lists](../../tech-debt/2026-10-19-pos-tagger-token-fragments.md).

- **2026-10-19. Slice 2A review fixes (PR #148).** Astra's
  [review](../../../docs/pr-reviews/pr-148-lightbox-counted-board-review.md)
  requested changes for four medium findings; each is fixed in its own
  commit on `epic/lightbox-slice-2a-board`, with regressions, and the author
  response at the end of the review maps them. Ledger statuses stay with
  Astra.
  1. **F-01, source ownership.** The shared `LightboxService` owns source
     intent: a ticket per request, minted before any await (a picked file
     when the picker returns it), and only the newest ticket adopts or
     refuses. Handlers subscribe to the service's outcomes on their
     webview's first `LIGHTBOX_*` message and post only what it publishes,
     so a pending request lands in a replacement panel and a closed panel's
     older request cannot win.
  2. **F-02, refusal replay.** The service keeps the current outcome (the
     board and any undismissed refusal); `LIGHTBOX_BOARD` carries both, and
     `LIGHTBOX_DISMISS_REFUSAL` (by host-minted id) stops a refusal
     returning.
  3. **F-03, POS provenance.** The word-frequency tool exposes its tagged
     occurrence stream with offsets; the board counts and places parts of
     speech from it, keyed by word and part of speech. Metrics' output is
     byte-identical; on all twelve Alice chapters the board's POS lists
     equal Metrics' and every count equals its placed occurrences.
     Per-paragraph tagging was rejected: it changes tags where a heading
     runs into the next paragraph.
  4. **F-04, inspector addresses.** 48 chips per page behind a keyboard
     pager with a jump to a paragraph number; paging never changes the pin.
  - **Nonblocking:** retained boards are keyed by the document URI.
  - **Verification.** Review head (`23c3f47`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 329 suites, 4,881 tests, 2 snapshots | 333 suites, 4,921 tests, 2 snapshots |
    | Lint | 0 errors, 1,140 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint: no new warning in any file; `curly` falls by five where the
      word-frequency tool's inline POS block was replaced.
    - Visual evidence: a `paged` state (a 347-paragraph pin, jumped to its
      last address) at 1440, 1000 and 500 px in
      [`lightbox-slice-2a-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2a-visual/README.md#pr-148-review-fixes-2026-10-19);
      the earlier Lightbox shots re-render unchanged.

- **2026-10-19. Slice 2B (first readings).** Built on
  `epic/lightbox-slice-2b-readings` from the Slice 2A branch; the PR #148
  review fixes and then `epic/lightbox` were merged in, conflicts resolved in
  favor of the fixed 2A behavior.
  1. **Contracts.** `messages/lightboxReadings.ts` (reading tiles, groups,
     withheld quotes, claims and blocks, the estimate, runs, context files),
     nine `LIGHTBOX_*` message types, and the remaining `PROMPT_BUDGETS.lightbox`
     numbers.
  2. **Prompts, codec, verifier.** The `lightbox/` prompt bundle (shared
     rules, six lens files, a worked example per group), a per-block codec,
     the quote verifier and the host term counter.
  3. **Runs.** `LightboxReadingRunner` (three groups in parallel on the
     assistant model, a timeout per group, quarantine), the fit and cost
     estimate, the context shelf, and `LightboxReadingHandler` beside
     `LightboxHandler`. Results attach to the service's board id and reach
     webviews only as the service's `readings` outcomes for the current
     board.
  4. **The webview.** The run line, the reading tiles, the tension lane,
     skeletons, the inspector's evidence with "Re-read this tile", the rail's
     context list, and lens toggles that drive the estimate.
  5. **PR #148 review F-05 (Low, nonblocking): addressed.** Every explicit
     "Go to ¶" jump focuses its landing chip, a repeated jump to the same
     chip included; a board update moves no focus. Both repeat cases are
     tests.
  - **Verification.** `epic/lightbox` (`3e6eba3`) → this branch:

    | Check | Before | After |
    |---|---|---|
    | Jest | 333 suites, 4,921 tests, 2 snapshots | 344 suites, 5,058 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - No live or billable call was made: every reading test plays the
      provider with the worked examples.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-2b-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2b-visual/README.md)
      (idle with the estimate, running with group A back, done with a pinned
      motif's verified and withheld quotes and friction, and too large, at
      1440, 1000 and 500 px). No page errors and no horizontal overflow.
  - **Decisions** (details in the
    [slice doc](slice-2b-first-readings.md#implementation-notes-2026-10-19)):
    - Open question 3: tension is scored per ribbon column. The whole Alice
      book would need 815 scores per paragraph against 96 per column.
    - Open question 1: not measured (no live calls); the groups run in
      parallel, and the measurement moves to Slice 6.
  - **Beyond or unlike the plan:**
    - A seventh reading kind, `reader-promise`, holds the genre lens's
      promise with its own evidence.
    - Groups also carry withheld claims and each lens's friction, so an
      empty lens still says where it strains.
    - Context has its own add, remove and list routes; the estimate carries
      the board's active run.
    - The estimate against the processed chip ("Done when") is not recorded,
      for the same reason as open question 1.
    - Progress now carries the streamed characters through each group and
      the finish, and a rejected frame's logged reason names unknown fields
      briefly.
- **2026-10-19. Slice 2B: PR #149 review fixes.** All eight findings of the
  [review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  are fixed on `epic/lightbox-slice-2b-readings`, one commit each; the
  author response at the end of the review maps commits to tests.
  1. **F-02, a press owns what was priced.** The estimate carries a key
     naming every input it priced (board and content hash, lenses on,
     context shelf revision, model, window, prices); the press names it.
     The runner reserves the board under a minted token before the prompt
     files load; closing the tab releases it, and the engine starts only if
     the reservation holds and the live key is unchanged. Otherwise nothing
     is sent and the webview re-estimates.
  2. **F-03, correlation.** Estimates answer webview-minted request ids;
     only the latest reply for the board asked about is usable, and the
     host never posts one unasked. Runs and progress are kept per board and
     token, and Stop names the board's own run.
  3. **F-01, quote spans.** The fold maps every UTF-16 code unit, units
     follow whole-string NFKC, and a match must land on unit boundaries and
     fold back to what matched.
  4. **F-04, withheld headline.** Shown under the plain heading with its
     reason, as are a withheld headline block and a failed call.
  5. **F-05, diagnostics.** Output and the board carry host-owned words
     only: call failures are closed categories, undefined fields are
     counted; field names reach only the recovery store, beside the body.
  6. **Nonblocking F-06–F-08.** A near miss needs its explanation; the
     tally counts every quote checked, per lens; a tile's re-read is
     disabled with its reason when it cannot run.
  - **Verification.** Review head (`9ad4e34`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 344 suites, 5,058 tests, 2 snapshots | 349 suites, 5,115 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: `headline-withheld` and `reread-off` at 1440, 1000
      and 500 px in
      [`lightbox-slice-2b-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-2b-visual/README.md#pr-149-review-fixes-2026-10-19);
      the earlier shots re-render unchanged (anti-aliasing only).
  - **Unchanged on purpose:** D4 stale readings and the live-provider pass
    stay deferred as recorded; the Slice 2B scope is otherwise unchanged.
  - **Follow-ups:** Slice 6's live pass (cache reads, the estimate ratio,
    contract adherence) and stale readings on a changed chapter (D4), in
    [the live-provider pass](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md)
    and [stale readings](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md) (resolved in Slice 3).

- **2026-10-19. Slice 2B: PR #149 re-review fixes.** The
  [re-review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  kept F-03 open for the model selection and added F-09; both are fixed on
  `epic/lightbox-slice-2b-readings`, and the author response to the
  re-review maps them to commits and tests.
  1. **F-03, the selected and confirmed model.** An estimate is usable
     only when it priced the model the writer selected and the host has
     confirmed that selection (`MODEL_DATA`); Read waits while it saves.
     A reply that priced another model is refused even when it answers the
     latest request, every confirmation asks again (price-only refreshes
     included), and a press names its model, which the host checks.
  2. **F-09, whole-string NFKC.** Quote units are built within runs cut
     before code points below U+0300; a run whose pairwise units disagree
     with its own NFKC is kept whole.
  3. **Recorded, not changed:** the engine's verbatim provider
     `error_type` log after an interrupted stream, in
     [tech debt](../../tech-debt/2026-10-19-agent-run-engine-provider-error-log.md).
  - **Verification.** Re-review head (`b5350a1`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 349 suites, 5,115 tests, 2 snapshots | 350 suites, 5,123 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: the recorded states rebuild byte-identical and all
      twenty shots re-render pixel-identical, so none changed.
- **2026-10-19. Slice 2B: PR #149 second re-review fix.** The
  [second re-review](../../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md)
  found F-01 to F-09 addressed and one new blocking finding, F-10, from the
  F-09 repair; it is fixed on `epic/lightbox-slice-2b-readings`, and the
  author response to the second re-review maps it to commits and tests.
  1. **F-10, long runs.** Quote units are appended one by one, never
     spread into a call, so a long CJK paragraph no longer throws while
     the verifier is built.
  2. **F-10, every started run finishes.** A setup failure fails every
     group with nothing sent, a reply check that throws fails its group
     alone, a throwing listener is logged; the run is released and
     finished, and `done` never rejects.
  3. **Recorded, not changed:** word frequency's part-of-speech tokenizer
     is quadratic on a long unbroken run of ASCII word characters, in
     [tech debt](../../tech-debt/2026-10-19-pos-tagger-long-token-backtracking.md).
  - **Verification.** Second re-review head (`b1200f0`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 350 suites, 5,123 tests, 2 snapshots | 352 suites, 5,135 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file, rule and message.
    - No live or billable call: every test plays the provider.
    - Visual evidence: `webview.js` is byte-identical and the recorded
      states rebuild byte-identical, so no shot changed.

- **2026-10-19. Slice 3 (lexical gravity and palette).** Built on
  `epic/lightbox-slice-3-gravity` from the Slice 2B branch; the PR #149
  review fixes and then `epic/lightbox` were merged in, conflicts resolved in
  favor of the fixed 2B behavior.
  1. **Stale readings first (D4).** A board rebuilt from changed text keeps
     its readings, each lens marked stale with the hash it was read against;
     every quote is checked again (kept, moved with its paragraph, or
     withheld as no longer in the chapter), every count recounted, and the
     tally counts each quote now gone as withheld. Re-reading a lens clears
     its mark. The
     [tech debt](../../archive/tech-debt/2026-10-19-lightbox-stale-readings.md)
     is archived as resolved.
  2. **Two group A lenses.** `13-lexical-gravity.md` and `14-palette.md`,
     group A's worked example extended to both, five new tile kinds through
     `LIGHTBOX_TILE_REGISTER`, their bounds pinned to the prompts. The host
     counts every term, hit, degree split and drift; the model gives none.
     A field under three hits is drawn below the gravity line, not dropped.
  3. **Build as a lens (D11).** `LIGHTBOX_HAND_OFF` names a board item; the
     host checks the board and the file's hash, refuses a stale, re-reading
     or withheld field, re-checks its quotes, recounts its terms and hands a
     bounded seed to `uiActions.handOffToWorkshop`. `extension.ts` routes it
     through the Workshop panel's own `MessageHandler` as a synthetic
     `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD`, a direct route of the Lexical
     Gravity handler; the Workshop opens Build lens prefilled and builds
     nothing until the writer presses Build.
  4. **The webview.** The gravity tile (orbit, field rows, degree bars,
     collisions, set-asides), the palette tile, the inspector's "By degree"
     rows and Build as a lens, lens toggles in the rail.
  - **Verification.** Slice 2B with its PR #149 fixes (`bf8f1ca`) → this
    branch:

    | Check | Before | After |
    |---|---|---|
    | Jest | 349 suites, 5,115 tests, 2 snapshots | 357 suites, 5,175 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule.
    - No live or billable call: every reading test, and the evidence, plays
      the provider with worked examples.
    - Visual evidence from real host output in headless Chromium:
      [`lightbox-slice-3-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-3-visual/README.md)
      (gravity, palette, a pinned field, the handoff's answer and a stale
      board at 1440, 1000 and 500 px, and the Workshop with Build lens
      prefilled). No page errors and no horizontal overflow.
  - **Beyond or unlike the plan** (details in the
    [slice doc](slice-3-lexical-gravity-and-palette.md#implementation-notes-2026-10-19)):
    - The handoff names only `{ boardId, fieldId }`; the host resolves the
      field, metaphor and terms.
    - Build lens takes one subject, so the counted terms ride in it, and a
      banner shows the full seed. The build contract is unchanged.
    - The new Workshop route is direct: opening the sheet changes no
      session state.
  - **Follow-ups:**
    [a reading in flight when the chapter changes](../../tech-debt/2026-10-19-lightbox-forward-in-flight-readings.md)
    and [one home for the codec's field decoders](../../tech-debt/2026-10-19-lightbox-codec-shared-field-decoders.md),
    both Low; the two lenses join Slice 6's live pass.

- **2026-10-19. Slice 3: PR #150 review fixes.** Astra's
  [review](../../../docs/pr-reviews/pr-150-lightbox-lexical-gravity-review.md)
  requested changes with six Medium/P2 findings; all six are fixed on
  `epic/lightbox-slice-3-gravity`, one commit each, and the author response
  maps them to commits and tests. Every new test fails on the reviewed head.
  1. **F-01, no implicit lens.** A Build opening handed over from the
     Lightbox has no lens until the writer adds a built take or picks a
     library lens; Preview and Install wait for that choice, and the banner
     says what building, saving and installing each take. A production-root
     test drives Apply through the real standing-directive handler, service
     and session.
  2. **F-02, never over an open sheet.** Workshop overlays form one stack:
     Escape closes only the top one, and a seed that arrives while any is
     open is refused and dropped, never covering Add text, the editors or
     the browsers.
  3. **F-03, seeds bound to their panel.** The provider delivers a seed
     once, to the panel that accepted it, listening and visible; a newer
     seed replaces it and closing cancels it. The Workshop answers opened
     or busy, and the Lightbox says "Opened" only on that answer, with a
     20-second timeout.
  4. **F-04, the shared sentence.** A collision is drawn only when one
     sentence of a found quote (the prose-stats sentence rule) holds a term
     of each field, and the card shows that sentence.
  5. **F-05, one set of gates.** Fresh assembly and stale carry share
     `LightboxTileGates`, with host-owned reasons, so a carried collision
     without a witness and palette tiles whose words are gone are withheld
     as a fresh reading would withhold them.
  6. **F-06, tension by paragraph.** Tension scores are keyed by each
     column's text as read; a carried score stays on unchanged paragraphs
     only, and the headline, tension caption and lane say they are stale.
  - **Merged:** `epic/lightbox` at `c6d4411` (PR #149), with Slice 3's
    column keys re-applied in 2B's split runner.
  - **Verification.** Reviewed head (`4150c8c`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 357 suites, 5,175 tests, 2 snapshots | 367 suites, 5,237 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `c6d4411` per file and per rule.
    - No live or billable call: every test, and the evidence, plays the
      provider.
    - Visual evidence regenerated at the merged head:
      [`lightbox-slice-3-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-3-visual/README.md).
  - **Follow-up:** [Lightbox run accounting on its exceptional paths](../../tech-debt/2026-10-19-lightbox-exceptional-path-accounting.md)
    (Low), from PR #149's third re-review.

- **2026-10-20. Launch entry points.** On
  `epic/lightbox-launch-entry-points`, from `epic/lightbox` at `9e5363c`. The
  writer chose all three entry points, and the editor-title icon, for both
  Markdown and plain-text files (decision 8); see ADR D1.
  1. **Sidebar.** A **Lightbox** button beside **Workshop** in the Analysis
     tab posts `OPEN_LIGHTBOX`. `UIHandler` calls `uiActions.openLightbox`,
     or reports a `ui.lightbox` error on a surface without it.
  2. **Open File in Lightbox.** `prose-minion.openFileInLightbox` boards a
     menu's URI, or the active editor's file, as the selection command's
     payload without text, through the same `seedSource`. It appears in the
     Explorer and editor context menus and, as a `$(layout)` icon, in the
     editor title, for saved Markdown and plain-text files. The selection
     command with nothing selected takes the same path.
  3. **Edge cases.** An untitled document is refused, pointing to Open
     Selection in Lightbox. A dirty file boards its saved copy, which is what
     Re-read file and the D4 hash read, and the writer is told. Non-disk,
     non-text, and other-language sources are refused before anything is
     sent. A file over the ceiling gets the Lightbox's existing refusal.
  4. **Copy.** The empty source card and the board's welcome name the new
     entry points.
  - **Verification.** Base `9e5363c` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 370 suites, 5,257 tests, 2 snapshots | 373 suites, 5,284 tests, 2 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `9e5363c` per file and per rule.
    - Evidence:
      [`lightbox-launch-entry-points/`](../../../docs/pr-reviews/evidence/lightbox-launch-entry-points/README.md).
      Native VS Code menus cannot be captured; manifest witnesses pin them.
  - **Follow-up:** the Marketplace README describes neither the Workshop's nor
    the Lightbox's launch commands. The Lightbox's release notes should name
    these entry points.
  - **PR #152 F-01 fix.** The
    [review](../../../docs/pr-reviews/pr-152-lightbox-launch-entry-points-review.md)
    found that a file launch took its source-request ticket only after VS Code
    loaded the document, so an older, slower launch could replace a newer
    source. The launch now takes the ticket before the load and boards under
    it, and a seed whose ticket was overtaken opens nothing. The report's
    author response lists the tests and verification.

- **2026-10-20. Slice 3: PR #150 re-review fixes.** The
  [re-review](../../../docs/pr-reviews/pr-150-lightbox-lexical-gravity-review.md)
  found F-01, F-02, F-04, F-05 and F-06 addressed, kept an F-03 residual
  open and added F-07 (nonblocking); both are fixed, and the author
  response to the re-review maps them to commits and tests.
  1. **F-03, claim before opening.** The Workshop webview holds an arriving
     seed and claims it; the panel provider grants the claim only while
     that delivery is still the one it waits on, so a seed whose message
     was already sent when it timed out, was replaced or lost its panel
     never opens. A grant cannot be revoked, so a newer seed waits for the
     granted one's answer. The protocol is generic over the seed kind
     (`WorkshopSeedDelivery`, `useWorkshopSeedClaim`) for Slice 4's Bring
     to Workshop.
  2. **F-07, the Model Browser in the overlay stack.** It registers with
     `useOverlayDismiss`, so a seed never opens over it and Escape closes
     only the top surface; focus returns to its opener, nested or not.
  - **Verification.** Re-reviewed head (`524a961`) → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 367 suites, 5,237 tests, 2 snapshots | 370 suites, 5,257 tests, 2 snapshots |
    | Lint | 0 errors, 1,135 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match per file and per rule, except two fewer `curly`
      warnings in `ModelBrowserModal.tsx`, whose own Escape listener is gone.
    - No live or billable call; the evidence follows the claim protocol and
      no shot changed.

- **2026-10-20. Slice 4 (lineage, subtext, Spark, Bring to Workshop).** On
  `epic/lightbox-slice-4-lineage`, merged with `epic/lightbox` at `9e5363c`;
  see the [slice notes](slice-4-lineage-subtext-spark-bring.md#implementation-notes-2026-10-20).
  1. **Readings.** Subtext (group B), lineage and Spark (group C), with the
     B and C worked examples extended, their bounds pinned, and every gate
     shared by fresh assembly and stale carry. A said line must sit inside
     dialogue; a spark must be a question.
  2. **The Spark lane.** Its own lane under the grid; "Not for me" and Undo
     are host-owned marks on the board's own spark.
  3. **Bring to Workshop.** The webview names a tile by id; the host checks
     it and offers it through Slice 3's claim-before-open delivery as a
     second seed kind, `lightbox-tile`. The Workshop stages it as a pending
     attachment above the composer (a `lightbox-tile` thread-artifact frame,
     persisted, removable, sent only with the writer's message). The
     Lightbox shows **Bound** only while the Workshop holds it, and the
     header tray counts confirmed stages.
  4. **PR #150 F-08.** Each Workshop mount announces a receiver id; a
     reloaded webview releases what was granted to the old one as `reset`,
     and the queue moves on.
  - **Verification.** Base `9e5363c` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 370 suites, 5,257 tests, 2 snapshots | 383 suites, 5,412 tests, 2 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` | Passes | Passes |

    - Lint warnings match `0b03f1e` per file and per rule.
    - No live or billable call; the evidence plays the provider:
      [`lightbox-slice-4-visual/`](../../../docs/pr-reviews/evidence/lightbox-slice-4-visual/README.md).
  - **Follow-ups:** [Workshop narrow-width reflow](../../tech-debt/2026-10-19-workshop-narrow-width-reflow.md)
    and [a refused seed offer only times out](../../tech-debt/2026-10-19-workshop-refused-seed-offer-times-out.md)
    (both Low); the [single-quote dialogue](../../tech-debt/2026-10-19-dialogue-single-quote-convention.md)
    item now covers subtext too.

- **2026-10-20. Source and context from the shared project picker.** On
  `epic/lightbox-source-picker`, from `epic/lightbox` at `59b57b6`. The writer
  asked: "Can you make the open excerpt trigger the same modal we use in the
  workshop." The scope later widened to the Context list. See ADR D1, D9 and
  D10.
  1. **One picker.** The Workshop's "Choose from project" modal is now
     `components/fulltab/ProjectResourcePickerModal`, with
     `ProjectResourceAttachFooter` for attach mode.
     - `WorkshopContextSelectorModal` wraps it for the attach, excerpt and
       message modes.
     - Its catalog contracts are neutral (`messages/configuredResources.ts`),
       and its rules and the modal chrome's moved to `styles/fulltab/modal.css`.
     - The content search moved, unchanged, to `ConfiguredResourceContentSearch`.
     - The Workshop is unchanged: parity witnesses were recorded against the
       original modal first (57 snapshots of markup, focus, callbacks and
       posted messages), and the evidence's before and after shots differ by
       0 pixels.
  2. **Source.** The source panel's and the welcome's **Choose from project…**
     open the picker in single selection.
     - `LIGHTBOX_REQUEST_PROJECT_CATALOG` and `LIGHTBOX_SEARCH_PROJECT_CATALOG`
       answer from the same catalog and search, Markdown and plain text only.
       Anything else is left out, not shown disabled.
     - `LIGHTBOX_CHOOSE_PROJECT_SOURCE` names a catalog key. The host takes the
       ticket on arrival, before the catalog opens, then resolves the key
       inside the workspace and boards it as a file source.
     - "Explore project folders…" is the old system picker.
     - A file chosen either way is one board: `lightboxSourceKey` compares
       file URIs by their decoded path.
  3. **Context.** The Context list's **Add from project…** opens the picker in
     attach mode, as the Workshop does: the shelf's files show as attached,
     with the running ~estimate.
     - `LIGHTBOX_ADD_PROJECT_CONTEXT` goes through `LightboxContextIntake`
       under the shelf's own rules. A file is refused if it is the board's own
       source, unreadable, empty, a duplicate by absolute path, or over
       `PROMPT_BUDGETS.contextFiles.words` counted in order. The rail names
       every refusal.
     - An add moves the shelf's revision, so a stale press is refused and the
       webview re-estimates.
     - A test pins that a quote from a context file is withheld.
  4. **Copy.** The empty source card and the welcome name the project route
     first, then the right-click and selection routes.
  - **Verification.** Base `59b57b6` → head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 389 suites, 5,516 tests, 2 snapshots | 395 suites, 5,587 tests, 59 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Lint warnings match `59b57b6` per file and per rule.
    - No live or billable call; the evidence plays the host with a stub model:
      [`lightbox-source-picker/`](../../../docs/pr-reviews/evidence/lightbox-source-picker/README.md).
      Its first run found the source panel's two buttons overflowing the
      rail. `f959b29` wraps them.
  - **Follow-up:** [the shared picker still leans on Workshop-named seams](../../tech-debt/2026-10-20-shared-picker-workshop-named-seams.md)
    (Low): the modal shell's folder and the catalog service's name.

- **2026-10-20. Shared project picker: PR #154 review fixes.** Astra's
  [review](../../../docs/pr-reviews/pr-154-lightbox-shared-project-picker-review.md)
  of `2cf1f97` requested changes for two Medium findings and one Low note;
  the author response at its end maps each to commits and tests.
  1. **F-01, answers correlated.** Catalog and search requests carry a
     webview-minted `requestId` (per webview, opening and operation) that
     the host echoes. `useLightboxProjectFiles` takes only the answer still
     pending; opening, closing and clearing drop pending answers, and a new
     query takes down the old query's answer and bound note at once.
  2. **F-02, host file identity.** Catalog rows and shelf files carry
     `fileKey`, a session-keyed HMAC of the absolute path the shelf dedupes
     by (`LightboxFileKey`). The Context picker compares keys, so a second
     workspace folder's same-named file no longer disables the first's row.
     The resolver's older cross-folder collapse is
     [recorded](../../tech-debt/2026-10-20-context-catalog-cross-root-collapse.md)
     (Low).
  3. **N-01, backdrop evidence.** The harness now takes the Workshop at
     500 px and records, per shot, that the backdrop is the top element
     outside the dialog and spans the window: true in all 24 dialog shots.
  - **Verification.** Reviewed head `2cf1f97` → fix head:

    | Check | Before | After |
    |---|---|---|
    | Jest | 395 suites, 5,587 tests, 59 snapshots | 397 suites, 5,597 tests, 59 snapshots |
    | Lint | 0 errors, 1,133 warnings | 0 errors, 1,133 warnings |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - The ten new tests failed against `2cf1f97`'s sources, each at its
      behavioral assertion.
    - The Workshop parity snapshots are unchanged; lint warnings match
      `59b57b6` per file and per rule.
    - No live or billable call.

- **2026-10-20. The writer's real-chapter checkpoint is passed.** The
  checkpoint Slice 5 waits on (its "Before starting" section, and every
  review since PR #149) is the writer's review of Slices 2B–4 on real
  chapters. The writer ran real-chapter passes and said the board "is
  working great", then asked for new sections instead of changes to the
  existing ones. The new sections come first (decision 14), so the saved
  format holds them.
  - **The new sections** (writer, 2026-10-20), drawn as a draft on the
    design canvas ([`NewLenses.dc.html`](../../../docs/design/lightbox/NewLenses.dc.html)):
    Template & freshness, Stock & signature, Rhythm & handoffs, Pressure,
    Artifacts, What stands out in the numbers, Summary & movements, and the
    Opinion. Each draws on a Writing Tools focus prompt's concepts (Fresh,
    Stock & Signature, Craft Steering, Cliché), adapted into the board's
    quoted, checked JSON rather than copied.
  - **Plan.** Three stacked slices: [4B](slice-4b-craft-lenses.md) (Group D,
    craft), [4C](slice-4c-story-lenses.md) (Group E, story, with the
    Sections lane) and [4D](slice-4d-opinion.md) (Group F, the Opinion, run
    last). Decisions 10–16 above; the ADR's D7 has a dated addendum for the
    Opinion and the freshness label; Slice 5's format now holds every tile
    kind, the Sections layer and a list of sources.
  - **Left out on purpose:** the two-level ribbon above 96 paragraphs,
    multi-file boards and movements as a ribbon overlay, in a
    [feature note](../../features/feature-lightbox-ribbon-structure/README.md).

- **2026-10-20. Slice 4B (Group D, craft) is implemented** on
  `epic/lightbox-slice-4b-craft`. A press now reads four groups; group D
  reads stock and signature, rhythm and handoffs, and the numbers, from one
  call with a worked example (*Alice* ch. I, ¶1–¶8) that decodes through the
  production codec and verifier with every quote exact.
  - **Host.** Eight tile kinds, all through `LightboxTileGates`, fresh and
    carried. A handoff's quotes must be adjacent sentences of one paragraph
    (`LightboxSentencePairs`, through the verifier's span filter). A numbers
    reading names a figure the board measured as standing out, and each of
    its quotes holds an instance by the detector that counted it
    (`LightboxNumberInstances`). The tier mix and familiar phrases are
    counted by the host. Endings follow their column's text on a stale
    carry.
  - **Measured.** Per-paragraph sentence lengths, and six figures against
    the preset's ranges and the writer's own average
    (`LightboxWriterBaseline`: the configured chapters, else manuscript,
    files, the board's own left out; bounded, cached, no model; absent with
    a host note). Style Flags' detectors are exported unchanged; being verbs
    is a new detector.
  - **Webview.** Stock, rhythm and numbers tiles with register chips, the
    Endings lane on the ribbon, inspector details and Bring for every kind.
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4b-craft-lenses.md#implementation-notes-2026-10-20);
    one item went to [tech debt](../../tech-debt/2026-10-20-lightbox-group-d-response-ceiling.md).
  - **Verification.**

    | Check | `eca952a` | Slice 4B head |
    |---|---|---|
    | `npx jest` | 397 suites / 5,597 tests / 59 snapshots | 407 suites / 5,693 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4b-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4b-visual/README.md).
    - No live or billable call.
  - **PR #155 review (2026-10-20).** Astra requested changes (F-01 to F-04,
    N-01). Fixed in `fc4c564`: number usages belong to the measurement they
    were read against and are withheld when it changes, on a same-text
    rebuild and on landing; Bring keeps both sentences of a handoff; a
    familiar phrase is witnessed by a whole occurrence in a quote's span;
    standouts are decided from counts and rounded only for display; a
    relocated pair reads "no longer adjacent". The three nonblocking notes
    were taken. After the fixes: 411 suites / 5,712 tests / 59 snapshots;
    lint identical. See the review's
    [author response](../../../docs/pr-reviews/pr-155-lightbox-craft-lenses-review.md#author-response-2026-10-20).

- **2026-10-20. Slice 4C (Group E, story) is implemented** on
  `epic/lightbox-slice-4c-story`, stacked on 4B with its PR #155 fixes
  (`16e85b1`) merged in. A press now reads five groups; group E reads
  template and freshness, pressure, artifacts, and summary and movements,
  from one call with a worked example (*Alice* ch. I, ¶1–¶8) whose request is
  the builder's byte for byte and which decodes through the production codec
  and verifier with every quote exact.
  - **Host.** Six tile kinds (template, template beat, pressure thread,
    artifact, synopsis, movement), all through `LightboxTileGates`, fresh and
    carried. Movements are gated as a set (boundaries in their first
    paragraphs, contiguous, covering) and withheld whole when they do not
    tile the chapter; carried, each starts where its boundary quote now
    stands. Engagement sits on the template tile, keyed by movement tile id,
    one level per movement or none. Threads keep paragraph order and get
    host spans; artifacts get host mentions and first paragraphs, and
    "planted, unused" only where code bears it out. Template and summary
    are read together on a re-read.
  - **Measured.** The Sections lane (`LightboxSections`): headings, then
    scene breaks, then chapter lines, recomputed with every board.
  - **Joined.** The freshness basis, D's signature share and E's subverted
    beats, a shared pure join shown only while both halves are current,
    never sent to a model.
  - **Webview.** Template & freshness, Pressure, Artifacts and Summary &
    movements tiles with register chips; Sections, Movements, Pressure and
    Engagement lanes on the ribbon; inspector details and Bring by id for
    every kind.
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4c-story-lenses.md#implementation-notes-2026-10-20);
    one item went to [tech debt](../../tech-debt/2026-10-20-lightbox-group-e-response-ceiling.md).
  - **Verification.**

    | Check | `8b930fb` (4B) | `16e85b1` (4B, PR #155 fixes) | Slice 4C head |
    |---|---|---|---|
    | `npx jest` | 407 suites / 5,693 tests / 59 snapshots | 411 / 5,712 / 59 | 419 suites / 5,802 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4c-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4c-visual/README.md).
    - No live or billable call.
  - **PR #156 review (2026-10-21).** Astra requested changes (F-01 to F-03,
    N-01). Each is fixed in its own commit:
    - F-01 `30047f0`: a thread planted and resolved in one paragraph no
      longer counts as open in a bucketed ribbon column.
    - F-02 `1a82d29`: front matter split by a blank line is no longer
      measured as a section. `# # #` is now a scene break.
    - F-03 `3caadaa`: the ribbon's paragraph and story lanes share one
      grid. The harness now measures and commits their edges: 0 px apart
      at every width, fresh and stale.
    - N-01 `3f9126c`: a fresh arc step withheld for its order is counted.

    After the fixes: 420 suites / 5,815 tests / 59 snapshots; lint
    identical. The evidence was rebuilt from a clean install, and its
    bundle hash is recorded with the reason the first one differed. See the
    review's
    [author response](../../../docs/pr-reviews/pr-156-lightbox-story-lenses-review.md#author-response-2026-10-21).

- **2026-10-21. Slice 4D (Group F, the Opinion) is implemented** on
  `epic/lightbox-slice-4d-opinion`, stacked on 4C (`797e166`). A press now
  reads the chapter groups and then the Opinion: one call over the board's
  checked digest, never the chapter.
  - **The Opinion** returns a shared list of observations, each citing
    board items by host key (tile ids, a tile's quote by number, measured
    figures). It also returns three views of them, Enthusiastic, Neutral
    and Blunt, each with a headline, a body and weighted Why points.
  - **The worked example** (*Alice* ch. I, ¶1–¶8, read with groups A–E's
    own examples) is the builder's request byte for byte. Its reply is drawn
    whole through the production codec and gates.
  - **Host.**
    - F runs only after the press's chapter groups settle, while the run
      still owns its board, and a stopped run never starts it.
    - Its digest is built through the press owner's port by board id. It is
      bounded in estimated tokens, priced "up to" that bound, and keyed over
      the board's measurement context and every item's content.
    - Code checks every citation against the digest. A view that weighs an
      undrawn observation is withheld whole, and the tile only when no view
      stands.
    - The text rules apply to every observation and view: no quotation
      marks, no writer words, no rewrite or instruction words, no
      percentages, and no figure the cited items do not show.
    - The Opinion joins `LightboxTileGates` and the carry, re-gated against
      the carried board.
  - **Standing.** It is derived, never stored, by one shared function. The
    Opinion is stale when anything it cites is gone, not current or changed.
    An uncited lens read again leaves it current, and a late F lands stale,
    never current.
  - **Bring.** The view on show travels by name, ids only, and the host
    refuses a withheld view or a stale Opinion.
  - **Webview.** The tile is last and full width, labelled "The one
    evaluative tile". It has three `aria-pressed` view tabs, Neutral by
    default, with the choice kept per board in webview state, and its
    observations light their paragraphs. It shows stale and withheld notes,
    and its own re-read is priced "up to its digest bound".
  - **Deviations and limits** are in the slice's
    [implementation notes](slice-4d-opinion.md#implementation-notes-2026-10-21).
    Two items went to tech debt: the
    [citation basis](../../tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md)
    (decide before Slice 5) and the
    [digest's board-order cut](../../tech-debt/2026-10-21-lightbox-opinion-digest-board-order-cut.md).
  - **Verification.**

    | Check | `797e166` (4C) | Slice 4D head |
    |---|---|---|
    | `npx jest` | 419 suites / 5,802 tests / 59 snapshots | 426 suites / 5,874 tests / 59 snapshots |
    | `npm run lint` | 0 errors / 1,133 warnings | Identical per file and rule |
    | `npm run typecheck` | Passes | Passes |
    | `npm run build` (with `verify:bundle`) | Passes | Passes |

    - Visual evidence at 1440, 1000 and 500 px from real host output with a
      stub model: [`lightbox-slice-4d-visual`](../../../docs/pr-reviews/evidence/lightbox-slice-4d-visual/README.md).
    - No live or billable call.
  - **PR #157 review fixes (2026-10-21).** Astra requested changes for one
    finding (F-01) and one nonblocking note (N-01); both are fixed.
    - **F-01.** Digits inside a host-minted tile id, or a quote's
      q-number, no longer count as figures an Opinion may state. An item's
      figures now come only from its label, lines and quotes. The witness
      and its id-only control are covered fresh, on carry, through Bring
      and through a real-handler run under UUID-shaped tokens.
    - **N-01.** The no-quotation rule shares the quote verifier's
      double-quote set, so fullwidth and CJK marks are withheld too.
    - **Evidence.** It was re-rendered from the fixed bundle, with
      `facts.json` and `errors.txt` now committed. The slice notes record a
      saturated-digest result.
    - **Verification.** 427 suites / 5,887 tests / 59 snapshots (from 426 /
      5,874 / 59); lint identical per file and rule; typecheck and build
      with `verify:bundle` pass.
    - See the review's
      [author response](../../../docs/pr-reviews/pr-157-lightbox-opinion-review.md#author-response-2026-10-21).
