# PR #227 review: Persona File Edits shared planner

**Disposition: written approval of code head `21c994cf8545e8702732d6da1e521357f2b7a175`. No blocking or non-blocking defect found in this slice.** This is not a formal self-approval or authorization to merge. The documentation-only publication head receives its own CI check, whose terminal result is recorded in the PR conversation.

- PR: [#227](https://github.com/okeylanders/prose-minion-vscode/pull/227).
- Reviewed head: `epic/workshop-persona-file-edits-slice-1-planner`, `21c994cf8545e8702732d6da1e521357f2b7a175`.
- Reviewed base: `epic/workshop-persona-file-edits`, `b14c46b8ca1e3e37966c27eccd0eb916c590c316`.
- Reviewed: 2026-11-05.
- Scope: all eight changed files, ADR D3 and Slice 1 decisions, the pre-extraction memory anchor and unchanged memory decoder, shared-planner behavior, architecture boundaries and verification.
- Existing reviews, inline threads and conversation comments were checked first; all were empty. The merged #226 specification review was read as context, not repeated as a new implementation review.

## What reviewed cleanly

1. **One pure planner, with no feature dependencies.** The three new utility files depend only on their own types/helper. They do not know about memory, files, host ports, persistence or VS Code. The architecture test pins that boundary. New production files are 15, 78 and 186 lines; the modified memory anchor is 115 lines.
2. **Quotes are found in the original text.** Exactly-once matching counts overlapping occurrences. Missing, repeated and empty quotes refuse the plan. Ranges are not recalculated against an earlier replacement's output. Rewrite conflicts, duplicate append/prepend and forbidden rewrites are rejected before a usable plan is returned.
3. **Touching edits compose without losing operation identity.** Spatial ordering places a prepend before a replacement at the same start, joins adjacent replacements and end insertions, and keeps both the joined edit's indices and each operation's own original range. Edits returned to a host neither overlap nor touch. The application helper applies from the end.
4. **Content and separators follow the documented choice.** Rewrite/prepend/append use the content after the leading skip, excluding surrounding whitespace. Front matter and a final newline survive. When replacements remove all content, insertions join each other rather than adding a separator against the deleted content. A caller-supplied CRLF separator is honored. A quote crossing an insertion point faults instead of producing an ambiguous combined edit.
5. **The memory adapter preserves the existing valid-edit behavior exercised here.** Title and kind still set whole; summary and body plan separately; body is trimmed before anchoring; result field limits and unchanged detection remain after application. Missing/ambiguous faults still win in original operation order before overlaps, including across fields. Decoder/persistence code and existing memory tests are unchanged.
6. **The Unicode tightening is acceptable and explicit.** A replacement quote that cuts a surrogate pair now yields `not-found` instead of producing malformed text. This is deliberately not byte-for-byte compatibility for lone-surrogate quotes; it is a conservative safety change, covered by the production tests. The exported `findExactlyOnce` helper itself is unchanged.

## Independent checks

The [reproducible probe source](probes/pr-227-shared-planner-independent.cjs.txt) loads current production TypeScript and the old memory anchor from the exact reviewed base through `git show`. The [output](probes/pr-227-shared-planner-independent-results.txt) records:

- **123,640 decoder-valid memory-edit cases** match the old anchor exactly, including results and refusal reasons. The fixed input matrix varies empty/trimmed/multiline/CRLF/Unicode bodies, summaries, rewrites, one/two replacements, cross-field and overlapping quotes, empty replacements, both passage orders and missing/ambiguous matches. These are deterministic differential cases, not a proof over every possible string; malformed surrogate halves are intentionally excluded from the compatibility claim.
- **4,833 successful planner cases** have valid bounds, strictly separated joined edits, exactly one occurrence of each operation in the joined edit list, joined text matching its component operations, and an application result matching independent forward reconstruction. The generator also exercises rejected lists but does not count them as successful cases.
- A separate semantic witness combines front matter, deletion of all content, both insertions and CRLF separators and checks the exact resulting text.

Reproduce from a checkout containing the reviewed base and current code, with dependencies available:

```sh
cp docs/pr-reviews/probes/pr-227-shared-planner-independent.cjs.txt /tmp/pr-227-independent.cjs
node /tmp/pr-227-independent.cjs "$PWD"
```

## Verification

Local isolated checkout, Node `24.22.1`, npm `11.9.0`, reusing an existing dependency installation whose `package-lock.json` is byte-identical to this head. CI independently uses Node 18 and `npm ci`.

- Local core, webview and extension typechecks pass.
- Focused local planner/memory-edit/architecture selection: **6 suites / 167 tests pass**.
- Local lint: **0 errors / 1,165 existing warnings**.
- Both local webpack bundles and bundle verification pass. The three existing webview size/performance warnings remain.
- The broad local Jest run was terminated with `Killed` after 80 passing suites, before a Jest aggregate summary. It is **not** represented as a full local pass; no assertion failure appeared before termination.
- Broader bounded local memory/planner run (`NODE_OPTIONS=--max-old-space-size=2048`, `--runInBand`, test path `(textEdits|[Mm]emory)`): **59 suites / 817 tests pass**, covering memory storage, lifecycle, messages, UI and the planner.
- Exact-code-head CI [run 42126836253](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42126836253), verify job `127593068344`, passed typechecks, **754 suites / 10,499 tests / 59 snapshots**, lint, both bundles and bundle verification. The checkout log explicitly identifies merge candidate `5c79b919`: `Merge 21c994cf8545e8702732d6da1e521357f2b7a175 into b14c46b8ca1e3e37966c27eccd0eb916c590c316`.
- `git diff --check b14c46b8 HEAD` passes. No actual VS Code import was introduced in core.

## Scope limits and downstream obligations

This approves the extraction and planner only. Identity, containment, baseline freshness, Markdown/prose policy, per-attempt authority, durable claims, persisted outcomes and the writer-facing review remain the later slices' contracts. This utility intentionally does not implement those policies. The successful tests here do not establish them.

`skipLeading` is not blanket authorization protection: the contract skips that region for whole-content operations, while quote lookup still reads the entire text. The file gateway/applier must continue enforcing the separate protected-region and authorization policies described by the ADR.

No live Extension Development Host acceptance or provider calls were performed. No product code, dependency, existing production test or deferred #205 work was changed. Publication adds only this review and its probe evidence; no merge was performed.
