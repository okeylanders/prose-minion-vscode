# Slice 1: Shared planner

**Status:** Built, in review.
**Branch:** `epic/workshop-persona-file-edits-slice-1-planner`
**Decision:** [ADR 2026-11-05](../../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D3

## Scope

- `packages/core/src/utils/textEdits/`, pure and feature-free:
  - `textEditOperations.ts`: `TextEditOperation` (`rewrite`, `replace`,
    `append`, `prepend`), `TextEditRules`, `TextEditFault`
    (`not-found`, `ambiguous`, `overlapping`, `conflicting-operations`,
    `not-allowed`), and the plan's shapes;
  - `findExactlyOnce.ts`: the one anchoring rule, moved from
    `WorkshopMemoryEditAnchor` unchanged;
  - `planTextEdits.ts`: `planTextEdits(text, operations, rules)` and
    `applyTextEdits(text, edits)`.
- Memory edits plan their summary and body through it. Their trailer
  decoding stays in `workshopMemoryEditProtocol.ts`; title and kind are set
  whole, as before. `WorkshopMemoryEditAnchor` re-exports `findExactlyOnce`.

## Tests

- `__tests__/utils/textEdits/planTextEdits.test.ts`: quotes at the start and
  end, missing, repeated and empty; replaces that overlap and that touch;
  rewrite alone, refused, and with others; a second append; joining passages
  (empty text included); front matter and surrounding whitespace kept; an
  insertion and a quote at one place; a passage inside a quote; an empty
  replace-with; surrogate pairs; CRLF.
- `boundaries.test.ts`: `utils/textEdits/` imports only itself.
- Every memory-edit test runs unchanged (none was touched).

## Implementation note

- **The content span.** A rewrite replaces, and a prepend and append stand
  around, the text after `skipLeading` without the whitespace around it, so
  a file keeps its front matter and its last line break. A memory body is
  trimmed before planning, so for memory the span is the whole field, as
  before.
- **Joining passages** is `joinPassages`' rule, exactly: a prepend takes the
  separator only when content stands after the replaces; an append when
  content stands or a prepend was made. `separator` defaults to a blank
  line; the gateway can pass the file's own line ending.
- **Touching ranges are joined** into one `PlannedTextEdit`, which names the
  operations it carries; `operations` gives each operation's own range, for
  Slice 2's report by operation.
- **Faults are all reported**, by operation index. Memory maps them to its
  own reasons in its old order: the first quote not found exactly once (in
  the order written), then any overlap. `conflicting-operations` joins the
  memory anchor's fault names for completeness; the decoder refuses it first.
- **One tightening, flagged for review:** a match that would split a
  surrogate pair is `not-found`. It can only differ from before for a quote
  that starts or ends with a lone surrogate, which a decoded trailer does not
  carry in practice.
