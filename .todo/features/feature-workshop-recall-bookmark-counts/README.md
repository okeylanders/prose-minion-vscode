# Feature: Bookmark Counts in the Session Catalog

**Date Identified:** 2026-11-05
**Status:** Idea, for after the [bookmark recall epic](../../epics/epic-workshop-bookmark-recall-2026-11-05/README.md). Okey: "write this as something we add later. I think it's worthwhile" (ADR 2026-11-05, Q4).
**Priority:** Low
**Related:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md) (D5 left this out); [ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) (`transcript.catalog` reads no session file)

## Problem

A persona looking for bookmarks has to call `transcript.bookmarks` to learn which sessions hold any. `transcript.catalog` lists sessions but can't say "3 bookmarks", because the session listing (`WorkshopStoredSessionSummary` in `infrastructure/storage/WorkshopSessionSearchIndexV1.ts`) holds no counts. By design, the catalog reads no session file.

## Shape

- **The index.** Add `bookmarkCount` to the search index's per-session summary, written when a session saves. Follow the index's own format rules: a new index version, or an optional field with its fixture, depending on how the index evolves.
- **The catalog.** `transcript.catalog` shows the count on each session line. The prompt and its sync test follow.
- **Old entries.** An index entry written before this has no count. The catalog then says nothing for that session, and never "0". A rebuild or the next save fills it in.
- **Optional: the Bookmarks screen.** It could use the counts to say which sessions have bookmarks before reading them.

## Completion Criteria

- [ ] The search index carries a per-session bookmark count, written on save, and old entries read unchanged.
- [ ] `transcript.catalog` shows the count where it's known, and nothing where it isn't.
- [ ] The prompt and its sync test match.
