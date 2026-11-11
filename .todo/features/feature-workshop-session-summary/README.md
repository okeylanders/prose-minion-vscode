# Feature: A Searchable Summary for Each Workshop Session

**Date Identified:** 2026-11-11
**Status:** Idea. Small to medium: one session field, the search index, recall's catalog, and a helper task.
**Priority:** Medium
**Origin:** Okey, 2026-11-11

## In Okey's words

> In addition to the names, Workshop sessions should also have a summary
> that is searchable. When the compact runs, it goes ahead and populates
> that. If it's empty, the helper agent can populate it, etc.

## Problem

A saved session is found by its title. Nothing says what it was about:
which threads it pulled, what it settled. The session browser and a
persona's `transcript.catalog` both list sessions by title, scope and
excerpt, so "the session where we decided Ava's ending" means opening them
one by one.

## Where things stand

- **Session rows** (`WorkshopSessionSummary`, `WorkshopSessionSearchIndexV1`)
  carry a title, times, personas, turn and word counts, scope, excerpt label
  and `preview`. They have no description.
- **A naming collision to avoid.** The session file's metadata block is
  *already called* `summary` (`WorkshopPersistedSessionV2['summary']`), and
  `WorkshopSessionSummary` is the row type. Call the new field something
  else: **`description`**, or `synopsis`.
- **The browser's search** greps content, and the index is derived ("the
  full snapshot is authoritative; the compact search index is derived"), so
  a new field means a rebuilt index, not a migration of it.
- **Recall's catalog** (`WorkshopTranscriptRecallRenderer`) shows a title,
  an id, scope and the last turn per session.

## Idea

- **A `description` on each session.** A paragraph of writer-editable text,
  bounded, saved with the session.
- **Searchable everywhere a session is found:**
  - the session browser's search;
  - recall's `transcript.catalog` (so a persona sees what each session was
    about);
  - `transcript.search` matches.
- **Who fills it, in order:**
  1. **The writer**, from the Save session sheet or the browser's row. The
     writer's text always wins and is never overwritten.
  2. **Compaction** writes it from its summary, when it runs and the field
     is empty or was filled by a machine ([Compaction That Keeps the Whole
     History](../feature-workshop-compaction-keeps-history/README.md)).
  3. **The helper**, when it's still empty. This pairs naturally with the
     [session name draft](../feature-workshop-session-name-draft/README.md):
     one helper call, from the same few projected turns, can return both the
     name's 1–10 word summary and the description.
- **Provenance.** The field records who wrote it (writer, compaction or
  helper), so the "never overwrite the writer" rule is checkable, and the
  row can say "Summary drafted by the helper".

## Open questions

- **When does the helper run?** On Save with the name draft, on every
  autosave after N new turns, or only on a "Describe" action? Leaning: with
  the name draft on Save, plus a refresh action. Never on every autosave, which
  would be a paid call per turn.
- **Unsaved rooms.** Does the current room get a description too, so it's
  ready when saved?
- **The bound.** How long? A few sentences reads well in a catalog; long
  ones crowd it.
- **Is it persona-visible beyond recall?** Should a room's own description
  sit in its frame, or stay a finding aid only?

## Completion Criteria

- [ ] Sessions have an optional `description` with its provenance,
      round-tripped by the session codec (ADR 2026-07-30's rules), and
      bounded.
- [ ] The browser's search and recall's catalog and search read it (tests).
- [ ] A machine never overwrites writer text (test).
- [ ] The helper fills an empty one, sharing the name draft's sampled
      turns. The writer's typing wins.
- [ ] Logs carry counts and provenance, never the description.

## Related Files

- `packages/core/src/shared/types/messages/workshop/session.ts` (`WorkshopSessionSummary`)
- `packages/core/src/infrastructure/storage/WorkshopSessionSearchIndexV1.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopSaveSessionModal.tsx`
- `packages/core/src/infrastructure/api/services/helper/` (`HELPER_TASK_POLICIES`)
