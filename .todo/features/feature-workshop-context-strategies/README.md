# Feature: Context Strategies Beyond Compaction

**Date Identified:** 2026-11-11
**Status:** Idea. A survey and a set of next steps, each small enough to be its own item.
**Priority:** Medium
**Origin:** Okey, 2026-11-11

## In Okey's words

> File context management and other compact strategies: think of other
> strategies. Ensure that we are managing attached context well, like not
> sending whole blasts of all files if a single one changes.

## What already holds

- **Only what changed is sent.** [ADR 2026-10-03: Context Delta
  Delivery](../../../docs/adr/2026-10-03-workshop-context-delta-delivery.md)
  (Accepted) keeps a host-private baseline of each attachment's id and
  fingerprint. A context change sends only added and changed bodies and the
  ids of removed ones, and unchanged files are never sent again. It's
  persisted with the room and honest under Rewind. **Okey's example is
  already handled.**
- **Reads fit the window** is planned: [Reads That Fit the
  Window](../feature-workshop-reads-fit-the-window/README.md) (High), with an
  engine backstop.
- **Release, Compress and Compact** are planned in [ADR
  2026-07-18](../../../docs/adr/2026-07-18-workshop-thread-artifacts-and-context-compaction.md)
  (the compaction epic). See also [Compaction That Keeps the Whole
  History](../feature-workshop-compaction-keeps-history/README.md).
- **Provider prompt caching** for Claude and Qwen turns
  ([feature](../feature-provider-conversation-prompt-cache/README.md)), and the
  context budget's cache and compression readouts.

## The gap that remains

**A changed file is re-sent whole, and every version stays in history.**
Delta delivery sends a changed attachment's *entire* new body, and "earlier
versions remain honest history". So a 6,000-word chapter attached to a room
and edited ten times leaves ten copies in the retained conversation, and
each is paid for on every later turn, cache misses included. Deltas solved
"all files when one changes", but not "the whole file when one line
changes".

## Strategies

| # | Strategy | What it saves | Cost |
|---|---|---|---|
| 1 | **Send a changed file as a diff** of the paragraphs that changed, quoted with enough context to anchor, when the diff is much smaller than the file | Most of a re-sent body | The persona reads a patch, not prose. Above some share changed, send it whole as today. |
| 2 | **Release superseded versions.** When a newer version of an attachment is delivered, the older body becomes a tombstone ("chapter 3, version 2, replaced by version 3 at turn 41") | Every stale copy | ADR 2026-07-18 says no release runs automatically. A deterministic "superseded" trigger is a different case from token pressure, so it needs that rule amended. |
| 3 | **Outlines for large files.** Attach a long reference (series bible, research) as an outline or summary, with `resource.read` for the rest | A large standing body | A helper call per file version, with provenance. The persona must know it holds an outline. |
| 4 | **A per-room context manifest.** Show the writer what is occupying the window, by source and version, with Release beside each row. This is ADR 2026-07-18's "Phase 7 manifest". | Writer awareness | UI only |
| 5 | **Cache-friendly order.** Keep stable context (pinned files, persona, writer profile) ahead of volatile context, so provider caches keep their prefix | Provider price | An ordering rule, pinned by a test |
| 6 | **Excerpt revisions get the same treatment** as attachments: diffs (1) and supersession (2) | The same | Excerpt revision frames have their own path |

**Leaning:** 1 and 2 together are the biggest win for Okey's case (a
chapter being worked over and over), then 4, so the writer can see it
working.

## Open questions

- **The diff threshold.** At what share of change does a diff stop being
  cheaper or clearer than the whole body?
- **Superseded release.** Do the writer and the persona see a tombstone line
  each time, or only in the manifest?
- **Guests and tool sidecars.** Do they follow the same supersession rule
  for their own retained copies?

## Completion Criteria

- [ ] A decision on each strategy: built, filed as its own item, or dropped.
- [ ] For whichever of 1 and 2 is built: a test where one chapter is edited
      ten times shows the retained history growing by the changes, not by
      ten whole copies.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopContextDelivery.ts`
  (the delta collaborator from ADR 2026-10-03; its baseline is
  `hostContextDelivery` on the room's state)
- `packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts`
  and `WorkshopPromptBuilder.ts`
- `packages/core/src/presentation/webview/components/shared/ContextBudget.tsx`
