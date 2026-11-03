# Slice 7: Model Slices

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), D8 and D10 (models)
**Design:** `Main.dc.html` and `Slices.dc.html` in [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md)
**Status:** Planned (after Slice 6)

## Outcome

The thread shows a slice, "Model · Claude Sonnet 5 → GPT-5", where the room's
model changed. It looks like the session divider. When the provider served a
different model than the one requested, the bubble says so in its meta line, and
the participant label's title names the ids. Transcript export shows the same
slices, because the thread and export use one function. JSON export carries each
turn's `model`.

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
