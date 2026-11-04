# PR #195 review: Workshop Wayfinding Slice 7b

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
