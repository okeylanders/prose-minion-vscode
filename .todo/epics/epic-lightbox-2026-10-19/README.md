# Epic: Lightbox

**Status:** Spec (Slice 0) 2026-10-19. No code yet; the ADR awaits the writer's review
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

## Slices

| # | Slice | Outcome | Status |
|---|---|---|---|
| 0 | Spec | ADR, this epic, design snapshot | In review |
| 1 | [Shared full-tab shell](slice-1-shared-full-tab-shell.md) | Workshop header, banner and rail frame extracted into a shared shell with slots, a full-tab style scope, and an exhaustive surface map; the Workshop renders through it with no behavior change | Planned |
| 2A | [Lightbox tab and the counted board](slice-2a-tab-and-counted-board.md) | Panel and serializer, command, `lightbox` surface in the shared bundle, `lightbox` message domain, source panel, paragraph model, measured tiles, ribbon, inspector, word ceiling | Planned |
| 2B | [First readings](slice-2b-first-readings.md) | Prompt bundle, reading codec, quote verifier, press with preflight and cost, streaming groups, cancellation; genre, motifs, characters, voice | Planned |
| 3 | [Lexical gravity and palette](slice-3-lexical-gravity-and-palette.md) | Borrowed-field detection with counted hits, degrees, collisions and literal set-asides; palette clusters and swatches; **Build as a lens** handoff to Lexical Gravity | Planned |
| 4 | [Lineage, subtext, Spark, Bring to Workshop](slice-4-lineage-subtext-spark-bring.md) | The remaining readings, the Spark lane, and the host-mediated handoff that stages tiles in the Workshop composer | Planned |
| 5 | [Saved boards and draft compare](slice-5-saved-boards-and-compare.md) | `prose-minion/boards/` files with their own `formatVersion`, the Boards rail, and Compare | Planned (last, by decision 5) |
| 6 | Verify live | Extension Development Host pass on real chapters; ADR → Accepted | Pending (needs a human with VS Code) |

Slice 1 must land first: Slice 2A renders inside the shell. Slice 2A defines
the board contract and paragraph model that every later slice extends. Slices
3 and 4 are independent of each other once 2B exists. Slice 5 goes last on
purpose, so the board's shape has been reviewed on real chapters before it
becomes a file format.

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
