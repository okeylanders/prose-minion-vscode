# Draft Edit: Slice 3b, part 3 — quotation marks and consistency

**Date:** 2026-10-27
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`1b2b3ac9` (PR #181, reasoning levels, merged).
**Decision record:** ADR 2026-10-21, "Amendment 2026-10-26: Slice 3b",
part 3, and its "As built (part 3)" note.
**Slice doc:** `.todo/epics/epic-draft-edit-2026-10-25/slice-3b-proofread-coverage.md`,
"Part 3: as built".

## Why now

The writer asked what 3b part 3 was, then: "Go ahead and knock it out. That
feels like a better stopping point", before the 2.12.0 release.

## Built

- **`quotation`** (`utils/proofread/quotationMarks.ts`). Double marks are
  read paragraph by paragraph, a mark's role taken from its place, then its
  shape.
  - Flagged, once per mark:
    - still open at its paragraph's end;
    - still open where the next quotation opens;
    - closing with nothing open;
    - a curly mark of the wrong shape.
  - A paragraph opening with a quotation mark continues the speech before it.
  - No replacement.
- **`consistency`** (`utils/proofread/spellingConsistency.ts`, table
  `variantSpellings.ts`: 61 words, 195 inflection pairs).
  - Flags the less used spelling, or the named convention's other, but only
    where the convention clearly spells one way. A tie flags nothing.
  - The *Replace with* is the same inflection, case kept.
  - A capitalized word mid-sentence is a name, and is skipped.
  - A listed word counts, but is never flagged.
- **Wiring.** Both join `PROOFREAD_HOST_CATEGORIES` and `draftEditHostRead`.
  `followsMidSentence` is now exported from `nameConsistency.ts`. The
  prompt is unchanged.

## Measured (Node 18)

On 124,800 words, quotation marks take 6 ms and consistency 118 ms. Of the
118, 94 go to `proofreadWords`, the same split the name check does. A first
version took 328 ms: per-word key normalization and an object per use.
Now a word is lowered only when its first letter is a capital, and uses are
stored as flat numbers.

## Verified

Mutations: 24, each failing a test. Two had survived the first run, and a
case was added for each:
- a straight mark its place leaves undecided closing an open quotation;
- "all right" across a line, where the old test was a tie.

## Limits stated

- An inch mark reads as a quotation mark.
- A word capitalized only after its first letter is not read.
- "all right" meaning "all correct" is flagged where "alright" is the more
  used.
- "the Rabbit" and "the rabbit" are not in the table.

## PR #182 review (Astra, `069e76b5`)

Three P2 findings, fixed with witnesses failing on `4ff69dde`:
- **F-01:** a hyphenated word's parts were placed by the lowered word; "İ"
  lowers to two code units, shifting the flag and its *Replace with*. Parts
  are now placed as written.
- **F-02:** a listed compound ("grey-green") had its part flagged. Each use
  keeps the word holding it (five numbers a use); a listed compound's part
  counts but is never flagged.
- **F-03:** emphasis beside a mark (`*“...and then?”*`) misplaced it. Places
  are read past `*` and `_`; the next-paragraph check asks the same rule.

Re-review (`ca04dae7`): F-01–F-03 resolved; **F-04**, quadratic work on a
long compound. The F-02 fix reparsed the whole compound per flagged part,
and `isName` uppercased it per part. Both are now once a word; an empty list
is never asked. Measured on a 2,000-part compound (10,012 characters): the
word scanner is handed 10,012 characters (28,011 with an unrelated list),
against 20,016,012 before.

## Next

The PR into `epic/lightbox`, then release prep (2.12.0) on the writer's
go-ahead, then the fixture run.
