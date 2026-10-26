# Feature: EPUB Preparation

**Date Identified**: 2026-10-26
**Source**: Brainstorm with Okey (parked until the active epics land)
**Status**: Idea / Parked
**Priority**: Medium

> This note captures the idea, not a plan. When the work starts, it moves to an
> epic with an ADR, because it adds a new domain, a new output format, and a
> writer-data contract (the book manifest).

## Problem

Writers keep their manuscript in a folder of Markdown or text files, one file per
chapter. Prose Minion can already measure that folder (per-chapter prose stats,
word frequency, search) and compare it against print standards. It can't help
with the step after the draft: turning the folder into an ebook that passes
validation and reads well on real devices.

Today that step means Pandoc, Vellum, Atticus, Calibre, or hand-written XHTML.
Each tool fails in its own way. Pandoc produces valid files with odd styling.
Paid tools expect you to paste the book into their editor. Hand-rolled packages
fail EPUBCheck over things like an unescaped `&` or a missing `dcterms:modified`.

## The Core Split: Code Owns Correctness, the Model Owns Judgment

It should mix model and code, but the split is lopsided on purpose. About 80% of
the feature is deterministic code. The model handles the cases where the text is
ambiguous.

**Pipeline rule:** code finds the candidates, the model judges them, the writer
decides, and code applies the decision.

| Concern | Owner | Why |
|---|---|---|
| Scan the folder, order files, split chapters | Code | Must be reproducible; same folder → same book |
| Markdown → XHTML, escaping, void elements, IDs | Code | One stray `&nbsp;` makes the package invalid |
| OPF package doc, spine, manifest, `nav.xhtml`, NCX | Code | Spec-shaped; a model can only get this *almost* right |
| ZIP packaging (`mimetype` first, stored uncompressed) | Code | Binary format rule |
| Typography rules (curly quotes, dashes, ellipses) | Code, with lexicon | Rules cover about 95% of cases |
| Validation (well-formedness, manifest ↔ spine ↔ files) | Code | A verdict needs to be reproducible |
| "Is `ch-final-v2.md` chapter 12 or an outtake?" | Model proposes | Needs judgment about meaning |
| Classify front/back matter (dedication, epigraph, acknowledgments) | Model proposes | Needs judgment about meaning |
| Leading-apostrophe leftovers (`'Twas`, `'em`, `rock 'n' roll`) the lexicon misses | Model proposes | Needs context to decide |
| Is this `***` a scene break or a censored word? Is this `--` deliberate? | Model proposes | Needs context to decide |
| Book description draft, image alt text | Model drafts | Generated text, and the writer approves it |
| Review pass: "chapter 7 has no heading; scene break lands mid-dialogue" | Model reviews | Critique of the built book |

Two rules keep this honest:

1. **The model never writes package files.** It returns typed proposals (JSON,
   decoded by a codec, like the Workshop protocols) that refer to positions in
   the projection. Code checks each proposal and applies it. If you let the
   model write OPF or XHTML, you get packages that look plausible and fail
   validation.
2. **The model never rewrites prose.** Its proposals are limited to structure,
   typography, and metadata, and each one shows up as a reviewable diff with its
   provenance. This matches the trust model of the rest of Prose Minion.

**It must work offline.** Like Metrics, a valid EPUB should build with no API
key: ambiguous items get conservative defaults and land in a "needs a human
look" list. The model makes the build smarter, but the build never depends on it.

## Proposed Shape (one projection, many renderers)

This follows the transcript-export precedent
([ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-transcript-export.md)):
one projection decides what the book contains, and every output only renders it.

```
manuscript/**/*.md ──► scan + order ──► BookProjection ◄── book manifest (writer-owned)
                                             │              ▲
                         model proposals ────┘              │ approved decisions
                                             │
             ┌───────────────┬───────────────┼────────────────┐
             ▼               ▼               ▼                ▼
       XHTML chapters    OPF + nav      Webview preview    Readiness report
             └───────┬───────┘          (same CSS, so it    (code lint +
                     ▼                   can't drift)        model review)
               ZIP packager ──► validator ──► book.epub
```

- **Book manifest** (for example `prose-minion/book.json`): title, author,
  language, identifier, chapter order, front/back matter assignment, cover image,
  scene-break style, theme. It is deterministic config the writer owns. The model
  can *draft* it from the folder, and the writer confirms. This is the main
  handoff from model to code, and it is a persisted contract, so it needs a codec
  with a `schemaVersion` from day one.
- **Build-time transforms by default.** Curly quotes, dashes, and scene-break
  ornaments apply when the book is built, and source files stay as written.
  Fixes that belong in the source (a missing chapter heading, three
  scene-break spellings) are offered as source edits through the same
  safe write-back design that
  [feature-workshop-apply-to-draft](../feature-workshop-apply-to-draft/README.md)
  needs.
- **Host-agnostic.** All of this lives in `packages/core` behind the existing
  `FileSystem` port, so the desktop shell adapter gets it for free.

## "Looks Right": Details That Separate a Good Ebook From a Valid One

Notes for the build and the readiness lint:

- **Scene breaks need a visible glyph** (`* * *`, `⁂`, or an ornament), not
  blank space. E-readers reflow, so a blank-line break that falls on a page
  boundary disappears.
- **No indent on the first paragraph** after a chapter heading or scene break,
  and indents on the rest. This is the classic fiction convention, done with a
  CSS class added at build time, not in the source.
- **One XHTML file per chapter.** It gives clean page breaks and better reader
  performance, and Kindle prefers it.
- **Defensive CSS.** Use `em` instead of `px`, don't force a body font, and
  don't fight the reader's settings. E-reader CSS support is uneven, so a few
  curated themes beat open-ended styling.
- **Typography lint:** straight quotes, `--` or ` - ` used as dashes, `...` vs
  `…`, double spaces, unbalanced `*`/`_` emphasis, mixed scene-break spellings,
  stray HTML.
- **Cover:** manifest item with `properties="cover-image"`, plus a size and
  aspect-ratio check against retailer guidance.
- **Accessibility metadata** (`schema:accessMode`, `accessibilitySummary`, alt
  text). Retailers increasingly expect it, and the EU Accessibility Act makes it
  matter for ebooks sold in the EU. Alt text is a good model-drafts,
  writer-approves job.
- **Target EPUB 3** with an NCX fallback. KDP, Apple Books, Kobo, Google Play,
  and Draft2Digital all accept EPUB 3.

## Phasing Sketch

1. **Readiness audit (code only, offline).** Scan the manuscript glob and report
   ordering ambiguity, heading inconsistency, typography issues, and missing
   assets. It's useful on its own and works like a Metrics tool.
2. **Book manifest + projection.** The writer-owned config, with a codec. The
   model can draft the first manifest from the folder.
3. **Build + validate.** XHTML/OPF/nav renderers, a small ZIP writer, and
   structural validation (`saxes` is already a dependency for well-formedness
   checks).
4. **Preview.** A webview reader rendering the same projection and CSS at a few
   widths and font sizes.
5. **Model review pass.** A semantic critique of the built book, plus
   resolution of leftover ambiguities. Visual review from preview screenshots
   could follow once multimodal input is mature.

## Open Questions

- **Scope of "prepare":** normalize the source folder for an outside tool
  (Vellum, Pandoc), produce the `.epub` directly, or both? Current lean: produce
  the `.epub`, and offer source fixes as reviewed edits.
- **Domain name:** extend `PublishingHandler` (today it's print standards and
  trim sizes) or add a new domain (`EbookHandler` / `BookBuildHandler`)? Current
  lean: a new domain, since "compare against standards" and "build an artifact"
  change for different reasons.
- **ZIP:** a hand-written STORED-only writer (about 150 lines, valid EPUB, a
  novel is about 1 MB uncompressed), Node `zlib` deflate (a Node built-in, fine
  for VS Code and desktop hosts), or a small dependency like `fflate`?
- **EPUBCheck:** structural validation in-house, plus an optional
  "run EPUBCheck if Java + epubcheck are installed" path (same posture as the
  optional-Chromium idea in
  [feature-workshop-transcript-pdf-export](../feature-workshop-transcript-pdf-export/README.md))?
- **`.txt` sources:** paragraph inference (blank-line vs indented paragraphs) is
  a heuristic. Is it enough to detect the style per file and flag mixed files?
- **Parts / multi-level TOC:** support `Part One` groupings in the first cut, or
  keep the TOC flat?
- **Workshop tie-in:** could a "production editor" persona walk a writer through
  the readiness report? It would be nice but optional, and should wait until the
  plain feature works.

## Related Files

- `apps/vscode-extension/package.json`: `proseMinion.contextPaths.manuscript`
  glob (default `manuscript/**/*,Manuscript/**/*`, `.md`/`.txt` only)
- `packages/core/src/infrastructure/text/TextSourceResolver.ts`: existing
  manuscript/chapter resolution through platform ports
- `packages/core/src/application/handlers/domain/MetricsHandler.ts`:
  `perChapterStats` (today one file = one chapter)
- `packages/core/src/application/handlers/domain/PublishingHandler.ts`: print
  standards domain (candidate neighbor or home)
- `packages/core/src/application/services/workshop/export/`: projection →
  renderer precedent
- `packages/core/src/platform/FileSystem.ts`: the port all I/O goes through

## Completion Criteria (for the eventual first release)

- A manuscript folder builds to an EPUB 3 file with no API key configured.
- The produced package passes EPUBCheck with zero errors on a fixture novel
  (front matter, 20+ chapters, scene breaks, italics, a cover image).
- The same `BookProjection` drives the package and the preview, and a test pins
  the shared CSS.
- Every model-proposed change is typed, validated, shown as a diff, and applied
  only after the writer approves.
- The book manifest has a versioned codec and fixture tests.
- No `vscode` imports in the new core modules (architecture guard).
