# Slice 7b: The Model in the Bubble Header

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), the [2026-11-04 amendment](../../../docs/adr/2026-11-03-workshop-wayfinding.md#amendment-2026-11-04-the-model-in-the-bubble-header) to D8 and D10
**Status:** Built and verified on `epic/workshop-wayfinding-slice-7b-model-in-header` (draft PR #195), cut from the epic at `6c12df5` (Slice 7 merged). Awaiting review.

## Outcome

Every stamped reply's header names the model that served it, after the
participant: "Jill · Opus 5.5". When the provider served a model other than
the one requested, it reads "Jill · Claude Sonnet 5 via Auto router", and
the under-body served-by note is gone. Markdown and HTML export headers read
the same, built by the same function. The model slices from Slice 7 stay.

Okey decided this at the Slice 8 decision review (2026-11-04).

## The rule

One pure function in `shared/` turns a turn's stamp and a label lookup into
the header's model text. Call it `workshopTurnModelLabel(model, modelLabel)`
or similar; it returns `undefined` when the turn has no stamp.

Let `served` be the stamp's `servedModelIds` (distinct, in request order), and
`requested` its `requestedModelId`.

| Stamp | Model text | Example |
|---|---|---|
| none (writer turn, host fallback, pre-epic turn) | nothing | "You", "Jill" |
| `served` is empty (the provider named no model) | the requested label | "Jill · Opus 5.5" |
| `served` is exactly `[requested]` | the requested label | "Jill · Opus 5.5" |
| `served` doesn't include `requested` | served labels, then "via" the requested label | "Jill · Claude Sonnet 5 via Auto router" |
| `served` includes `requested` and others | served labels, no "via" | "Jill · Opus 5.5, Sonnet 5" |

- **Separator.** The middle dot " · " that the thread already uses. Several
  served labels join with ", ".
- **Labels.** Labels come from the side's own lookup: the webview's
  `modelOptionLabel`, and the host's model-label port (Slice 7). The raw id
  is the fallback.
- **Scope.** The function doesn't care about scope. Dictionary and analysis
  cards are stamped and follow the same rule.

## Build

- **The function.** It lives under `shared/workshop/`, beside
  `workshopModelSlices.ts`, because export can't import `presentation/`.
  - Move whatever of `utils/workshop/workshopTurnModelNote.ts` both sides
    need into it.
  - The tooltip (`workshopTurnModelTitle`) stays.
  - The served-by note (`workshopServedByNote`) is removed with its call
    site. It's dead code once the header carries "via".
- **Thread.** In `WorkshopTurnBubble`, the participant label (`.pm-ws-eyebrow`,
  which already carries the tooltip) gains the model text in its own span.
  - That file is 782 lines, so it grows only by the call and the span.
  - **Style:** muted and smaller than the name.
  - **Narrow columns:** the model span is the one that shrinks
    (`min-width: 0`, ellipsis); the name never does.
  - **CSS floor:** stay on the Chromium 114 floor (`webviewCssFloor.test.ts`).
  - **Screen readers:** the label reads "Jill · Opus 5.5" as one phrase.
  - Check how the eyebrow is named today, and keep it at least as good.
- **Export.** Markdown and HTML turn headers append the same model text,
  rendered from each entry's `model` (Slice 7's projection already carries
  it).
  - The label must be added by the Markdown and HTML renderers, never in
    `projectWorkshopTranscriptTurn`'s entry. Recall reads that entry, and
    recall never carries a model. Slice 7's pin test must keep passing
    unchanged.
  - The HTML export mirrors any new thread rule verbatim. Update the mirror
    and its pin test.
  - JSON is unchanged.
- **The turn preview** (Slice 5) still carries no model. That stays out of
  scope, and the Slice 7 pin stays.

## Tests

- **The function.** One case per table row, plus:
  - the raw-id fallback;
  - a writer turn;
  - a dictionary-scope stamp;
  - several served ids, in order.
- **Thread, through the real App:**
  - the header text for each case;
  - no under-body note anywhere;
  - the tooltip unchanged;
  - nothing after the name on an unstamped turn;
  - the model span is the one marked to shrink.
- **Export:**
  - Markdown and HTML headers for each case;
  - an unstamped turn's header unchanged;
  - JSON byte-identical to before for the same room.
- **Parity.** Extend `WorkshopModelSliceParity.test.tsx`, or add a sibling.
  For every turn of the same room, the thread's header model text equals the
  HTML export's, given the same label lookup.
- **Recall and prompts.** The existing pins still pass. No header label
  reaches recall's data or text, room frames, or provider history.

## Completion Criteria

- [x] Every stamped reply's header names its model by the table above, and
      unstamped turns name none. `workshopTurnModelLabel.test.ts` (each row);
      `WorkshopApp.modelHeader.test.tsx` ("names each stamped reply's model…",
      "names nothing after the participant…").
- [x] The under-body served-by note is gone. `WorkshopApp.modelHeader.test.tsx`
      ("draws no under-body served-by note anywhere"); `workshopServedByNote`
      and its call site are deleted.
- [x] Markdown and HTML export headers match the thread's. JSON is unchanged.
      `WorkshopModelHeaderParity.test.tsx` (thread vs HTML, named and raw);
      `WorkshopTranscriptModelHeaders.test.ts` (Markdown, HTML, unstamped
      headers unchanged, "leaves JSON byte-identical whatever the labels").
- [x] Recall, prompts and the turn preview still carry no model.
      `WorkshopTranscriptRecallModels.test.ts` passes unchanged;
      `WorkshopTranscriptModelHeaders.test.ts` ("is never in the per-turn entry
      recall reads"); `workshopTurnModelLabelReaders.test.ts` (only the bubble
      and the export's header helper compute the label).
- [x] The epic's per-slice verification passes. Counts are recorded in this
      doc's Built section.

## Built

**Commits.** `b1c66ab` the shared rule; `e3be337` the bubble header and the
note's retirement; `0c7ac13` export headers and the mirror; `fe8bce0` header
parity and the readers pin; `8028f68` a test's lint cleanup; after the plan
review (`0d8cede`): `2b734e9` capability cards' export lines (W-01) and
`0a6ea38` the header icon held in a narrow column (found by the W-05 layout
check). The ADR amendment's "via" wording is tightened (N-01) in the commit
that records this.

**Where each piece lives.**

| Piece | Where |
|---|---|
| The rule | `shared/workshop/workshopTurnModelLabel.ts` (`workshopTurnModelLabel`, `WorkshopModelLabelLookup`) |
| Tooltip | `utils/workshop/workshopTurnModelNote.ts` keeps `workshopTurnModelTitle` and `workshopRawModelId`; `workshopServedByNote` is deleted |
| Thread | `WorkshopTurnBubble`: one call, and `<span className="pm-ws-turn-model">· …</span>` inside the participant label (`.pm-ws-eyebrow`); the under-body note block is removed |
| Style | Three rules after `.pm-ws-turn-head` in `styles/workshop/shell.css`: `.pm-ws-turn-head > .pm-ws-eyebrow` (`min-width: 0; white-space: nowrap`), its `> svg` (`flex-shrink: 0`), and `.pm-ws-turn-model` (`min-width: 0`, ellipsis, 10px, normal case) |
| Export | `export/WorkshopTranscriptModelHeader.ts` (`WorkshopTranscriptRenderOptions`, `workshopTranscriptEntryModel`); Markdown and HTML renderers take the options; the service passes its model-label port to them. A reply names the model after its speaker; a stamped capability card's one-line event ends with it |
| Mirror | The three rules, verbatim, in `WorkshopTranscriptHtmlStyles.ts` after `.pm-ws-turn-head` |
| JSON | Unchanged; its renderer ignores the options |

**Tests.**

- The rule: `__tests__/shared/workshop/workshopTurnModelLabel.test.ts`. One
  case per table row, the raw-id and blank-label fallbacks, a writer turn, a
  dictionary-scope stamp, several served ids in order (and a repeated one),
  and whitespace in a hostile id or label.
- Thread, through the real App: `WorkshopApp.modelHeader.test.tsx`. Header
  text for every row, a guest and a dictionary card; raw ids before
  `MODEL_DATA`; nothing after the name on an unstamped reply or writer turn;
  no served-by note anywhere; the tooltip unchanged; a hostile id inert; the
  model span (not the name) carrying the shrink rules, read from `shell.css`.
- Export: `WorkshopTranscriptModelHeaders.test.ts`. Markdown and HTML headers
  for every row, with the bookmark and private suffixes; raw ids without a
  lookup; a stamped dictionary card's and analysis card's event line ending
  with its model, an unstamped card's unchanged, and no card evidence; unstamped rooms rendering
  identically with and without labels; hostile ids escaped, and a Markdown
  heading kept to one line; the mirror; JSON byte-identical with and without
  labels; nothing in the per-turn entry; the real export route.
- Parity: `WorkshopModelHeaderParity.test.tsx`, a sibling of the slice parity
  test on an extended room. For every reply and capability card (dictionary
  and persona-run analysis) the HTML export prints, the thread's header model
  text equals the export's, with names and with raw ids. Two mutations fail
  both cases: the thread ignoring served ids, and the export dropping a
  card's model.
- Readers: `architecture/workshopTurnModelLabelReaders.test.ts`. Only the
  bubble and the export's header helper import the rule, and only the
  Markdown and HTML renderers and the service import the helper.
- Updated: `workshopTurnModelNote.test.ts` loses the note's cases;
  `WorkshopApp.modelSlices.test.tsx` keeps "a served-by difference draws no
  slice" without the note; one Markdown slice test passes the header lookup.
  Slice 7's recall pin and the mirror test pass unchanged.

**Deviations and choices.**

- **Capability cards in export (plan review W-01).** A dictionary or
  analysis card names its model in the thread's header. In Markdown and HTML
  it is a one-line event, so the line ends with the same text
  ("Writer's Dictionary · liminal · requested by Jill · success · Model B"),
  the model in the thread's span in HTML. The event's text in the projected
  entry is unchanged, so recall reads the line without it. The ADR amendment
  now says so.
- **Whitespace.** The rule reads every run of whitespace in an id or label as
  one space, on both sides. Served ids come from the provider, and a newline
  would otherwise break a Markdown heading.
- **"Muted".** The eyebrow is already `--pm-dim`; the model keeps that color
  (a dimmer token failed contrast on the warm-dark surface) and is muted by
  size (10px against 11px), normal case and tighter tracking, so the real
  label shows ("Opus 5.5", not "OPUS 5.5").
- **The shrink.** The name stays a text node; held to one line by
  `white-space: nowrap`, its min-content is its whole width, so only the
  model span (`min-width: 0`) shrinks. No wrapper span for the name, so the
  bubble grows by the call and the span alone. The icon needs its own
  `flex-shrink: 0`: the layout check below showed it squeezed to nothing
  without it.
- **Layout, measured (plan review W-05).** The HTML export of a reply named
  "Jill Longername" with a 484px model text, loaded in Playwright's Chromium
  at a 260px viewport: the header is one line (17px); the name is whole
  (119px, one 14px line); the icon keeps 12px; the model span is 51px wide
  with a 484px scroll width and `text-overflow: ellipsis`, 10px against the
  name's 11px, `text-transform: none`. The export runs the thread's mirrored
  rules, so this stands for the thread's CSS too. It is not the webview inside
  VS Code, and that Chromium is newer than the 114 floor (the rules use only
  long-standing features, and `webviewCssFloor.test.ts` passes); Slice 8's
  live pass still looks at it in the editor.
- **Screen readers.** The label had no accessible name before (a span with a
  tooltip); its text now reads "Jill · Opus 5.5" as one run, with the dot and
  a space in the DOM text.
- **Separator.** Each side writes " · " itself, as the surrounding headers
  already do; the rule returns only the model text.
- **Renderer options.** Markdown and HTML take a second, optional argument
  instead of reading labels off the transcript, so the label never sits in a
  projected entry.

**Counts and sizes.**

- Before (`6c12df5`): 636 suites / 8,977 tests / 59 snapshots; lint 1,153
  warnings. After: 641 suites / 9,009 tests / 59 snapshots; lint 0 errors,
  1,155 warnings (two new, each the `PmLogo` mock name the sibling App tests
  already carry). Typecheck clean; no `from 'vscode'` in `packages/core/src`
  outside tests' boundary strings.
- `WorkshopTurnBubble.tsx` 792 → 789 (the doc's 782 was stale).
  `workshopTurnModelLabel.ts` 55, `WorkshopTranscriptModelHeader.ts` 36,
  `WorkshopTranscriptHtml.ts` 237 → 252, `WorkshopTranscriptMarkdown.ts` 95 → 111,
  `WorkshopTranscriptExportService.ts` 115 → 120, `workshopTurnModelNote.ts` 46 → 31.
  `WorkshopTranscriptHtmlStyles.ts` 645 → 660 (already over 500; it grows by
  the mirrored rules only). Tests: parity 301, App header 271, export headers
  281, rule 76, readers 45.

**Follow-ups.**

- Slice 8's live pass: the header in the editor's webview at a narrow width,
  and the model's weight beside the name (the color is the writer's eye).
