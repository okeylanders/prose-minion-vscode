# PR #195 review: Workshop Wayfinding Slice 7b

## Latest implementation verdict (2026-11-04)

**APPROVE from code review; no blocking implementation finding.** This written
recommendation applies to `3e0b172eca60dffda028d0e6ffb770c911838702` against
`6c12df5bece661912504ae5125928cf9afc904d0`. It is not a GitHub approval submission
or merge authorization. CI is still running, and the in-editor visual and
accessibility pass remains Slice 8 work.

The implementation review and its verification limits are recorded below.
The earlier plan review and author response are retained as history.

## Review target and verdict

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/195
- Reviewed head: `12d1791025f1bce35844a29558492e10fefc4b34`.
- Base: `epic/workshop-wayfinding` at `6c12df5bece661912504ae5125928cf9afc904d0`.
- Head branch: `epic/workshop-wayfinding-slice-7b-model-in-header`.
- Reviewed on: 2026-11-04.
- Actual scope: **Wayfinding**, not Project Memory. The three changed files are the
  epic README, the new Slice 7b specification, and the Wayfinding ADR amendment.
  There are no runtime or test changes at this head.
- **Verdict: no blocking defect found in this documentation-only plan.**
  Implementation review remains pending. This is not approval of the feature's
  runtime behavior or readiness to merge, and no GitHub approval was submitted.

The PR explicitly says it was opened at the first documentation commit while
implementation continues. Missing implementation and unchecked completion
criteria are therefore not reported as regressions.

## What was reviewed

Read the complete diff, the ADR and slice specification, the epic's acceptance
criteria and verification requirements, and the repository's relevant agent
guidance. Inspected the existing implementation at the exact reviewed head:

- `WorkshopTurnBubble.tsx` and `workshopTurnModelNote.ts`;
- `WorkshopTranscript.ts`, the Markdown and HTML renderers, and the JSON
  renderer;
- `WorkshopTranscriptExportService.ts`;
- `WorkshopRecallDocument.ts` and the existing model/recall/preview pin.

Also inspected the base's real-App model-slice parity fixture and export tests
to identify the paths the implementation review must exercise.

## Plan assessment

1. **The five-row formatting rule is implementable and preserves provenance.**
   It distinguishes no stamp, an empty served list, a matching served model,
   only different served models, and a served set containing both requested and
   other models. It retains distinct served IDs in request order and uses the
   requested label only when the provider named no model.

2. **The shared formatter is at the correct boundary.** Putting model text
   under `shared/workshop/` lets the webview and host renderers use one pure
   rule without export importing presentation. The raw-ID fallback and
   dictionary-scope coverage are explicit.

3. **Recall and preview remain separate from display decoration.** The current
   `projectWorkshopTranscriptTurn` is deliberately unstamped. Whole-transcript
   projection adds stamps afterward. Adding the display text in renderers, not
   the single-turn projection or its speaker/event text, preserves that
   boundary. The existing recall test covers service data, rendered text,
   search, and previews.

4. **The label does not replace model slices.** The per-reply header describes
   the served model, while slices continue to describe requested-model
   transitions within the same scope. Keeping both is coherent.

5. **Layout and export constraints are explicit.** The spec retains raw-ID
   tooltips, requires the participant name not to shrink, gives the model span
   ellipsis behavior, keeps the Chromium 114 floor, and requires the HTML CSS
   mirror and its pin to change together.

6. **The acceptance matrix is appropriately broader than a helper test.**
   It calls for real-App headers, all formatting cases, Markdown/HTML parity,
   JSON byte stability, and unchanged recall/prompt/preview guards.

## Non-blocking specification note

### N-01: make the ADR's mixed-served case as precise as the slice table

The amendment says that when the provider served a model other than the
requested model, the label adds `via {requested}`. Taken literally, that also
covers `served = [requested, another]`. The slice table explicitly gives that
case **no** `via`, which is the more precise rule and the one used for this
review.

Before marking the ADR accepted, qualify the amendment's `via` condition as
“the served list is nonempty and does not include the requested model,” or link
directly to the full decision table. This is a wording clarification, not a new
product decision or a blocking implementation finding.

## Implementation watchpoints

These are review targets, not defects claimed against an unbuilt feature.

### W-01: stamped capability cards are export events, not reply entries

At this head, `projectWorkshopTranscriptTurn` turns a capability into
`kind: 'event'` (`WorkshopTranscript.ts:240–244`). Whole-transcript
`withModel` then adds its model. Both Markdown and HTML dispatch those entries
through the **event** branch.

Dictionary cards and persona-run analysis cards therefore will not gain model
text if implementation changes only Markdown's `case 'reply'` and HTML's
`renderReply`. Their model-bearing event line must use the same formatting
rule without exporting the host-private capability body or altering recall's
event text. Include both card families in real thread/export parity coverage.

### W-02: carry the host label lookup all the way to the renderers

The current export service passes `modelLabel` into transcript projection for
slice labels, but invokes each renderer with only the transcript. The new
per-turn formatting needs that lookup at render time, including on the real
export-service route. Do not append it to the shared projection to avoid
changing recall or JSON. Test a missing catalog name and the actual service
path, rather than only renderer calls with hand-built arguments.

### W-03: preserve output safety and ancillary metadata

Model names and raw-ID fallbacks are strings, not trusted markup. Exercise
labels containing HTML and Markdown syntax through the production renderers.
Keep private-exchange labels, bookmark marks, truncation text, usage indicators,
and the participant's accessible text intact. Confirm that removing the
under-body note does not leave a second duplicate model label.

### W-04: test both orders of a mixed served list

Test `[requested, other]` and `[other, requested]`, as well as multiple served
models with no requested model. All preserve request order, and only the last
case adds `via`. A check of the first served ID alone would be incorrect.

### W-05: distinguish structural layout pins from live layout verification

A DOM/class or CSS-text assertion can establish which span is intended to
shrink. It cannot establish actual ellipsis, name preservation, or accessible
reading in a narrow VS Code webview. Keep that part of the Slice 8 live pass
explicit unless a browser/layout check actually executes it.

## Verification record

- Fetched current PR metadata, complete changed-file list, diff, and discussion:
  one commit, three Markdown files, no runtime changes.
- Fetched relevant source files pinned to the full reviewed commit SHA, not an
  unpinned branch.
- Checked relative link targets in the new slice and ADR against the review
  overlay and the existing checkout at the exact base; no missing local target
  was found. This was a filesystem target check, not an external link crawler.
- Reviewed the production call graph and existing privacy/export tests.
- **Typecheck, lint, Jest, and live VS Code checks were not run for this
  documentation-only review.** No runtime-test pass is claimed.
- The exact-head CI workflow was queued when inspected:
  https://github.com/okeylanders/prose-minion-vscode/actions/runs/41863759681.
  Queued is not a passing result.

## Next review gate

When implementation reaches the branch, review its exact new head, run the
affected real-App/export/recall/architecture tests and the epic's aggregate
checks, verify the five formatting cases plus the watchpoints above, and append
an implementation verdict here. Keep the draft status and live-validation
requirements honest until those results exist.

## Author response

Implementation is on the branch above `0d8cede`. Commits and file locations
are in the slice doc's Built section.

- **N-01.** In the 2026-11-04 amendment, "via" now appears only when the
  provider named models and none of them is the requested one. A served list
  that includes the requested model names them all, in order, without "via".
  The amendment links the slice table. A capability-card bullet records W-01.
- **W-01.** A stamped dictionary or persona-run analysis card's one-line
  Markdown and HTML event now ends with the shared rule's text (in HTML, the
  thread's `pm-ws-turn-model` span). The event's text in the projected entry
  is unchanged, so recall reads it without the model, and no capability body
  is exported. Both families are in `WorkshopModelHeaderParity.test.tsx`; a
  mutation dropping a card's model fails it.
- **W-02.** The service passes its host label port to the Markdown and HTML
  renderers as `{ modelLabel }`. The projection doesn't carry it, and JSON
  ignores it (byte-identical with and without labels). Tested on the real
  export route and through `WorkshopTranscriptExportService` with an id the
  catalog lacks, which falls back to its raw id.
- **W-03.** Labels carrying HTML and Markdown syntax go through the
  production renderers and the real App, and come out inert:
  - HTML is escaped, and no `img` or `script` element appears;
  - Markdown syntax is backslash-escaped;
  - whitespace collapses, so a heading stays one line.

  Tests keep the private label, bookmark, truncation notice, usage figure
  and speaker name intact beside the model. The model text appears exactly
  once per reply in the thread, Markdown and HTML.
- **W-04.** `[requested, other]` and `[other, requested]` keep their order
  without "via". Several served ids without the requested one get "via".
  A repeated served id is named once. Tested in
  `workshopTurnModelLabel.test.ts`.
- **W-05.** The jsdom assertions pin intent only, and the Built section says
  so. One interim browser check was run on the HTML export in Playwright's
  Chromium at 260px:
  - the header stays on one line;
  - the name is whole;
  - the model is cut with an ellipsis.

  It also caught the icon shrinking to 0px, now fixed with
  `flex-shrink: 0` and pinned. The real check in the editor's webview remains
  in Slice 8's live pass.

## Implementation review at 3e0b172e

### Target and result

- Reviewed head: `3e0b172eca60dffda028d0e6ffb770c911838702`.
- Base: `6c12df5bece661912504ae5125928cf9afc904d0`.
- Initial implementation/probe target:
  `b53b6a3c301d9a6d3f15cdc3767be01cd57bd234`.
- Verified the complete delta from the probe target to the reviewed head:
  documentation plus two metadata-preservation tests only, with **no production
  code change**.
- **Result: approve from code review.** No actionable implementation defect was
  found. No formal GitHub approval was submitted and nothing was merged.

### Findings and watchpoint disposition

- **N-01 resolved.** The ADR now states the nonempty-served-list condition and
  excludes a served list containing the requested model from `via`. The
  mixed-served wording agrees with the slice table.
- **W-01 resolved.** Both export event branches format stamped dictionary and
  persona-analysis cards. Their projected event text stays unchanged; capability
  evidence remains absent from Markdown and HTML. The new parity fixture
  includes both card families.
- **W-02 resolved.** The real export service forwards its existing label port
  as renderer options. Only rendering computes the per-turn label. The JSON
  renderer ignores these options, and no new model field is introduced into
  the single-turn projection.
- **W-03 resolved within the tested paths.** React retains model strings as
  text. HTML escapes the new text, Markdown escapes inline syntax, and the
  shared helper collapses whitespace. Private labels, bookmarks, truncation
  copy, usage markup, speaker text, and raw-ID tooltips are retained. The old
  served-by block and helper are removed.
- **W-04 resolved.** The rule keeps first occurrence order, deduplicates served
  IDs, handles requested-first and requested-last mixtures without `via`, and
  adds `via` only when no served ID matches the request. Blank/missing lookup
  results fall back to the ID.
- **W-05 remains the stated live gate, not a hidden pass.** The name remains
  anonymous text in the no-wrap flex eyebrow; the model span alone receives
  shrink/ellipsis styling, and the icon has `flex-shrink: 0`. All three new
  rules are mirrored exactly. The author's 260px Chromium measurement is
  documented as interim evidence, not as VS Code or screen-reader validation.
  The reviewer could not independently execute browser layout in this
  environment; see limits below.

### Independent verification performed

**Source identity.** Materialized the complete PR diff over the existing
checkout at the exact base. Compared the Git blob SHA-1 of **all 21 changed
files** with SHA-pinned GitHub file reads at `b53b6a3c`: all matched. Compared
the subsequent two commits through `3e0b172e` and read their changed tests and
documentation. No production code changed after the executable probes' target.

**Production-source Node probe: 104 assertions passed, 89 actual source
modules loaded.** TypeScript was transpiled without rewriting its behavior;
React 18.3.1 and marked 16.4.1 were loaded from an existing bundle and match
the repository lockfile. The probe exercised:

- The production HTML renderer for all five rule rows, both mixed-served
  orders, multiple different served models, duplicate IDs, and missing names.
- Dictionary and analysis event labels, while withholding both capability
  bodies.
- The production export service's HTML, Markdown, and JSON writes through a
  controlled file port, equal to each corresponding direct renderer.
- Private-exchange text, bookmark and truncation markers, unchanged input
  projection after rendering, JSON equality with and without display names,
  and model exclusion from single-turn projection and turn previews.
- The actual memoized React bubble function's returned header element tree:
  the same model phrases, one model span per stamped bubble, no retired
  under-body note, and raw requested IDs retained in tooltips. Its `useMemo`
  callback was evaluated by a small probe dispatcher; this is **not** a
  browser DOM, React lifecycle, or real-App integration test.
- Hostile HTML/Markdown strings and line separators through the production
  renderers; no executable HTML was introduced and a model could not create
  another Markdown heading.
- Exact equality of each newly mirrored CSS rule with its thread source.

**Independent provenance probe: 26 assertions passed, 69 actual source
modules loaded.** A separate review pass exercised the helper decision table,
mixed-order/dedup/blank-label/whitespace cases, real projection and Markdown
reply/card output, recall exclusion, JSON stability, input immutability, and
hostile IDs. It found no additional issue.

**Static checks.** Read every changed production module and the new/updated
test paths, including real-App headers, real-App/export parity, formatter
readers, output safety, and the later ancillary-metadata tests. The unchanged
recall pin and model-slice derivation were preserved. A source scan found no
runtime `vscode` imports in core. The helper (55 lines) and export adapter
(36 lines) preserve the shared/presentation/application boundaries. The large
bubble shrinks overall; the existing oversized HTML CSS mirror grows only by
the new rules.

### Verification limits and outstanding gates

- **No independent full Jest, TypeScript, or ESLint run is claimed.** This
  executor's dependency links target an unavailable shared checkout. The
  source-level and focused executable probes above are not a replacement for
  the aggregate checks.
- The author records **641 suites / 9,011 tests / 59 snapshots**, clean
  typecheck, and zero lint errors at the later head. These are author-reported
  results, not counts produced by this review. The PR description still
  records the earlier 9,009-test run at `b53b6a3c`; the two added tests explain
  the difference.
- The independent Chromium attempt failed **before page execution** because
  the executor disallows `socket()`; an escalation did not change that.
  Therefore no independent browser/layout/accessibility pass is claimed.
- CI for reviewed head `3e0b172e` was **in progress**, not green, when checked:
  https://github.com/okeylanders/prose-minion-vscode/actions/runs/41867666324.
  Check the final current branch head's CI before merging.
- Keep Slice 8's actual VS Code webview check for narrow-column truncation,
  full participant name, model hierarchy/contrast, tooltip, and accessible
  reading. This recommendation does not mark the epic's live pass complete.
