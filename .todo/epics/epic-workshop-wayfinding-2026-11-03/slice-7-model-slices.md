# Slice 7: Model Slices

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D8 and D10 (models)
**Design:** `Main.dc.html` and `Slices.dc.html` in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** In progress, on `epic/workshop-wayfinding-slice-7-model-slices`, cut from the epic at `4a180ab` (Slices 5 and 6 merged).

## Outcome

The thread shows a slice, "Model · Claude Sonnet 5 → GPT-5", where the room's
model changed. It looks like the session divider. When the provider served a
different model than the one requested, the bubble says so in its meta line, and
the participant label's title names the ids. Transcript export shows the same
slices, because the thread and export use one function. JSON export carries each
turn's `model`.

## Since Slices 5 and 6

Slice 6 (PR #185) wrote the stamps this slice reads. Slice 5 (PR #189) was
the last change to the bubble and the export before this one.

### What a stamp is

- **Shape.** `WorkshopTurn.model` is `{ scope, requestedModelId,
  servedModelIds }`. The codec lives in
  `application/services/workshop/WorkshopTurnModel.ts`.
- **Which turns carry one.** Only `role: 'assistant'` turns, and the codec
  refuses one anywhere else. The stamped turns are:
  - host, guest and tool-sidecar replies;
  - the writer's tool reports and syntheses;
  - persona-run analysis cards (`assistant` scope);
  - persona dictionary lookups and full entries (`dictionary` scope).
- **Which turns don't.** A host-written stand-in (`replySource:
  'host-fallback'`), a failed or cancelled run, and resource and recall cards
  are unstamped. They are "unknown", never a switch.
- **Served ids** are distinct and in request order, provider-reported only.
  `[]` means the provider named no model.
- **Never in prompts.** Stamps never enter prompts, room frames or provider
  history, and tests already pin that. Keep slices and served-by notes out of
  them too.

### Scopes interleave

A dictionary lookup (`dictionary`) can sit between two host replies
(`assistant`). The per-scope comparison is exactly what keeps that from
drawing a false slice. Test it with real interleavings: a persona analysis
card, then a dictionary card, then a reply.

### Where code can live

- **The derivation is shared code.** The webview can't import `application/`
  (`boundaries.test.ts`; Slice 5's preview hit the same wall). Put
  `deriveWorkshopModelSlices` under `shared/`, as the doc says.
  - It reads only the turn fields it needs: `id`, `role`, `participant`,
    `kind`, `model`.
  - The host's `projectWorkshopTranscript` and the webview's thread both call
    it.
- **Seeding the window.** `modelsBeforeWindow` comes from the same window the
  snapshot sends: `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200) in
  `WorkshopSessionService.getSnapshot()`. That file is 2,600 lines, so keep
  the calculation in a pure function beside the derivation and call it from
  `getSnapshot()`.

### One function, the same slices

Thread and export must show the same slices.

- **The same room, inside the window.** Thread and export produce identical
  slices.
- **A truncated window.** The thread's slices, seeded from
  `modelsBeforeWindow`, equal the export's slices restricted to the window's
  turns. Add a parity test for both cases.
- **Omitted turns.** Export can omit or merge turns the thread shows, and the
  thread can hide what export prints. Check `projectWorkshopTranscript`'s
  include and omit rules.
  - If a slice's `beforeTurnId` names a turn export doesn't print, place the
    slice before the next printed turn. Never drop it.
  - Derive from the full turn list in both places, never from what one side
    happens to render.
  - Private exchanges follow the same rule: a slice is placed by turn order,
    whoever heard the turn.

### Display names

- **The webview** already has the model options: `modelsSettings.modelOptions`
  in `WorkshopApp`. `ContextBudget` already resolves a display name by id, so
  reuse that lookup rather than writing a second one.
- **The host's export** needs names too. Find what the host already holds,
  such as the catalog the estimate and settings read, and use the raw id as
  the fallback.
  - If the two sides can resolve different names for the same id, say so in
    the slice doc.
  - Pin that slice placement is identical even when the names differ.

### The bubble

`WorkshopTurnBubble.tsx` is 782 lines and `WorkshopApp.tsx` is 1,738. They
grow only by a seam:

- The slice divider is its own component.
- The served-by note and the label's `title` come from a small pure function,
  for example in `presentation/webview/utils/workshop/`.
- The divider follows the session divider's markup and its accessible name.
  Check how `pm-ws-session-divider` is announced today, and match it.

### Export styles

The HTML export mirrors thread CSS verbatim, and a test pins it
(`WorkshopTranscriptHtmlStyles.ts`).

- If the slice divider reuses the session divider's rules, those are probably
  already mirrored. Check before adding any.
- Any new rule the thread and export share goes in the mirror, and the pin
  test is regenerated.
- Export-only rules stay in the page layer, as Slice 4's
  `WorkshopTranscriptHtmlBookmarkStyles.ts` does.
- JSON export already carries `bookmarked` (Slice 4). It gains `model` the
  same way, with `formatVersion` unchanged.

### Recall and preview

- **Recall** reads turns only through `projectWorkshopTranscriptTurn`. Keep
  `model` and slices out of it, and pin that with a test, as Slice 4 did for
  bookmarks.
- **The turn preview** (Slice 5, `WorkshopTurnPreview`) is a named subset.
  Whether it shows a served-by note is out of scope unless it's free. If you
  add it, add it from the same pure function.

### What Astra checks

- thread/export parity, including window seeding;
- the mirror test;
- host-private data on every path;
- the separator's accessible name;
- that a turn with no stamp never draws a slice;
- exact-head verification.

See the PR #185 and #189 reports in `docs/pr-reviews/`.

## Build

### Derivation (pure, shared)

`packages/core/src/shared/workshop/workshopModelSlices.ts` (new directory)
exports:

```ts
deriveWorkshopModelSlices(
  turns: readonly WorkshopTurn[],
  options?: { modelsBeforeWindow?: Partial<Record<ModelScope, string>> }
): Array<{ beforeTurnId: string; scope: ModelScope; fromModelId: string; toModelId: string }>
```

- Walk the turns in order. For each stamped assistant turn, compare its
  `requestedModelId` with the last stamped value **in the same scope**, seeded
  from `modelsBeforeWindow`.
- If they differ, place a slice before the writer turn that prompted that
  reply: the nearest preceding writer turn with no assistant reply between
  them. If there is no such turn, place it before the reply.
- An unstamped turn is unknown, never a switch, and doesn't reset the last
  value.
- It's pure and deterministic, with no display names; labels are resolved at
  render.

### Snapshot

`WorkshopSessionSnapshot` gains `modelsBeforeWindow?`: for each scope, the last
stamped `requestedModelId` before the window. The host computes it in
`getSnapshot()`, and only when the window truncates.

### Thread

- `WorkshopThread` (or whichever component maps turns to bubbles) inserts a
  slice divider before `beforeTurnId`.
  - It uses `role="separator"` and the `pm-ws-revision-divider` /
    `pm-ws-session-divider` classes, with the chip icon.
  - The copy is `Model · {from} → {to}`. Display names come from the model
    options the webview already has (`MODEL_DATA`), with the raw id as the
    fallback.
- **Bubble meta:** when `servedModelIds` is non-empty and differs from
  `[requestedModelId]`, show "{requested label} · served by {served labels}".
- **Title:** the participant label's `title` attribute names the requested and
  served ids.

### Export (D10)

- `projectWorkshopTranscript` calls the same derivation. Markdown and HTML
  render slices as dividers; JSON turns gain `model`, with `formatVersion`
  unchanged.
- The HTML export mirrors the slice divider's thread CSS verbatim. Update the
  mirror and its sync test.
- Recall's renderers don't show `model`; a test pins this.

## Tests

- **Derivation:**
  - no stamps;
  - one model throughout;
  - one switch;
  - a switch back;
  - an unstamped history followed by stamped turns;
  - two scopes interleaved without false slices;
  - a reply with no prompting writer turn;
  - seeding from `modelsBeforeWindow`;
  - the shape after a rewind across a switch, with a cut list.
- **Snapshot:** `modelsBeforeWindow` is present only when the window truncates,
  and is correct per scope.
- **Thread:** the divider renders at the right place with display names and the
  id fallback; the served-by note and the title appear.
- **Export:** Markdown and HTML slices match the thread; JSON carries `model`;
  the mirror test passes; recall omits `model`.

## Completion Criteria

- [ ] The thread and export show identical slices from one function.
- [ ] Unstamped sessions show no slices.
- [ ] Served-by notes appear only on a mismatch.
- [ ] The epic's per-slice verification passes. Counts are recorded.
