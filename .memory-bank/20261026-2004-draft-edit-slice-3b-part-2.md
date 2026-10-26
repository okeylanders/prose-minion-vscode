# Draft Edit Slice 3b, part 2: the word list and name consistency

**Date:** 2026-10-26 20:04 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox`
at `57489816` (the PR #174 merge), into `epic/lightbox`
**Decision record:** [ADR 2026-10-21](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-26: Slice 3b", part 2, and its "As built (part 2)" note
**Slice doc:** [slice-3b-proofread-coverage.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-3b-proofread-coverage.md),
"Part 2: as built"

## What changed

- `proseMinion.proofread.wordList` (array of strings):
  - read at the gesture and normalized by `proofreadWordList`;
  - carried on the pass in `ProofreadSettings` beside the convention;
  - sent per chunk as `acceptedWords`, only the words the chunk holds;
  - the backstop in `draftEditPlacement` drops a spelling or wrong-word
    finding on a listed word, counted as `accepted` (never "not placed").
- `utils/proofread/nameConsistency.ts` (`findNameVariants`): a rare
  spelling of a common name, over the whole document.
  - Its category is `name`, in `PROOFREAD_HOST_CATEGORIES`.
  - It is flag-only, and its *Replace with* is never preferred.
  - Its issues join the model's at placement, and win where they overlap.
- `draftEditHostRead` holds what host code reads of the whole document:
  narration, accepted words and name variants. `narrationOf` moved there
  from the use case, which is now 471 lines.

## Decisions

- **Host categories are their own list.** A model reply naming one is
  malformed, so a model can never forge a host check's flag.
- **Evidence of a name** is a capitalized word after a letter, digit, comma
  or semicolon on its line. That rules out sentence starts, opening quotes,
  colons and dashes. A misspelling only ever at a sentence's start is
  missed: the stated limit.
- **False-positive guards beyond the ADR:**
  - a variant also written in lower case is a word;
  - a plural is not a variant;
  - a tie offers nothing;
  - headings, words in capitals, words under three letters and the forms
    of "I" are not read as names.
- **Bounded on the extension host.**
  - The first version compared every pair and took 24 s on 8,000 rare
    names under one initial.
  - Now a deletion index (up to two letters deleted) means only close names
    are compared.
  - **PR #176 F-01 (Astra):** the first budget charged only index entries
    visited, so one 501-letter word made 125,711 deletions for free. Now:
    - a word over 20 letters is never a name;
    - every deletion made, entry visited and pair compared is charged
      before it is done, to `workBudget` (250,000);
    - past it the check stops, finds nothing and logs it;
    - the result reports the work, and a test pins a small chapter's work
      exactly (42).
  - **Measured on Node 18:** a novel's 4,500 distinct names in 70,500 words
    spend 121,845 (139 ms). A stopped document spends at most 0.6 s beyond
    reading, and reading is linear (0.1 s for 120,000 words).
- **Headings come from the Markdown block reader** (PR #176 F-02): ATX or
  setext, in block quotes and lists, via `readDocumentRegions`, the same
  reading as the protected regions. A line pattern missed setext and
  nested headings.
- **N-01:** a hyphenated name is accepted by the word list's own rule.
  **N-02:** a host issue's overlaps go before model issues are weighed
  against each other.

## Verification

- Node 18.20.8 mirror of CI: typecheck, test, lint (0 errors / 1,133
  warnings, as before) and build all pass. Inventory: 562 suites / 7,846
  tests / 59 snapshots (base 559 / 7,780); after the PR #176 review
  fixes, 562 / 7,870.
- 19 mutations: 17 fail tests. The 2 that survive change only speed:
  indexing every name, and a looser early exit.
- On the 992 words of real *Alice* in the repository's fixtures, no
  variant is found. The Gutenberg text could not be fetched here (the
  network policy refused the host).

## Follow-ups

- The fixture run, recorded in the slice doc, before any new category may
  write.
- Part 3: quotation marks and consistency, also host checks. Keep them
  bounded, as the name check is.
- Slice 3c (craft flags), queued before the Workshop slices.
