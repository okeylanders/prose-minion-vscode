# Slice 7b: The Model in the Bubble Header

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), the [2026-11-04 amendment](../../../docs/adr/2026-11-03-workshop-wayfinding.md#amendment-2026-11-04-the-model-in-the-bubble-header) to D8 and D10
**Status:** In progress on `epic/workshop-wayfinding-slice-7b-model-in-header`, cut from the epic at `6c12df5` (Slice 7 merged).

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

- [ ] Every stamped reply's header names its model by the table above, and
      unstamped turns name none.
- [ ] The under-body served-by note is gone.
- [ ] Markdown and HTML export headers match the thread's. JSON is unchanged.
- [ ] Recall, prompts and the turn preview still carry no model.
- [ ] The epic's per-slice verification passes. Counts are recorded in this
      doc's Built section.
