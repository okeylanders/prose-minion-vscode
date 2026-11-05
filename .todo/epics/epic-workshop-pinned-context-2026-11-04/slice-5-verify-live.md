# Slice 5: Verify Live

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md)
**Status:** Ready. Slices 1–4 are merged, and the epic is code complete at
`b668782` (728 suites / 10,239 tests green). It needs a human with VS Code
(Extension Development Host).

**Most worth a careful look.** No reviewer could check these here:
- item 16, the native Windows file-name checks;
- native focus and visuals in the Extension Development Host. Astra's
  reviews ran in jsdom, and native Chromium was blocked in the review
  environment.

## Outcome

Okey runs the feature against a real project. The ADR moves to Accepted,
with any changes the pass forces. A memory-bank entry records the pass.

## Checklist

Use a test project with *Alice*-style files, never a manuscript in progress.

1. **Pin ten files** with Add from project…, then reorder two. Open
   `prose-minion/pinned-context.json`: the order matches, and it reads
   cleanly.
2. **Pin what's attached now** in a room that has three unpinned file
   attachments: the three join the list.
3. **New session: full reset.** The room starts with exactly the pinned
   files, in order, with no thread turns. The result line names the count
   and words.
4. **New session: full reset, empty context.** The room starts with no
   excerpt and no context, and nothing pinned is attached. Unpin everything:
   the item disappears from the menu, and the full reset's copy is today's.
5. **New session** after removing one pinned pill: it comes back. A carried
   pinned file edited on disk comes back with its new text.
6. **First room.** Delete `prose-minion/sessions/current.json` with VS Code
   closed, then reopen. The first room has the pinned files.
7. **Open, Branch and Rewind** a session: none of them gains a pinned file.
8. **Missing file.** Rename a pinned file, then start a New session. The room
   starts; the result names the file as not found; the tab says "Not found".
9. **Over budget.** Pin a large file until the meter is over. New attaches
   the files that fit, in order, and names the rest.
10. **Hand edit.** Break the JSON. The tab shows the unreadable notice with
   only Open file enabled, and New attaches nothing from it. Fix it, and
   everything returns.
11. **Two windows** on the same folder: pin in one, then unpin in the other
    without refreshing. The second is refused with "changed in another
    window", and shows the current list.
12. **Multi-root and no folder:** the tab's unavailable notice, and New
    seeds nothing.
13. **The prompt cache.** Send the first message after a seeded New, then a
    second one. The cache indicator shows the second turn reading from the
    cache. A settings change mid-room doesn't resend the pinned files.
14. **Timing.** Time New with ten pinned files against New with none. Record
    both. If the difference is more than about half a second on a local
    disk, raise it with Okey.
15. **Tune the bound** (`files: 20`) from what Okey actually pins.
16. **On Windows, if one is to hand** (PR #204 F-03; no reviewer had one).
    - Pin `Notes/σ.md`, then try `Notes/ς.md`. It's refused as already
      pinned: one name on NTFS.
    - Pin a file whose name holds `ß`. It stays itself, and isn't matched to
      an `SS` name.
    - Rename a pinned file's case in Explorer. The tab still finds it, and a
      New session attaches it once.

## Close-out

- Mark the ADR Accepted, with any amendment the pass forces.
- Add `AGENTS.md`'s **Workshop Pinned Context** rules section, if Slice 3
  didn't, and update its tree and the test inventory.
- Write the memory-bank entry: facts, decisions, the verification run, and
  follow-ups.
- Archive the epic under `.todo/archive/epics/` with an `ARCHIVE.md`, after
  splitting any live follow-ups into new `.todo` entries.

## Progress

- **2026-11-04.** Checklist written with the spec.
- **2026-11-05. Live pass, finding 1.** Pin what's attached now, with 22
  file attachments in the room, said "That request couldn't be read. Nothing
  was changed." The host log read `pin refused (malformed ids)`.
  - **Cause:** the handler used the list's 20-file bound as its message-shape
    check, so any request naming more than 20 items was refused as unreadable
    before the list's own bound could say why. The catalog-key route (Add from
    project…) had the same check.
  - **Fix** (`epic-pinned-context-slice-5-live-fixes`):
    - the message shape caps a request at 1,000 items, a size no room reaches;
    - the writes' bound refuses in words that name the count: "Pinned context
      holds at most 20 files, and this would make 22. Pin fewer, or unpin some
      first.";
    - regressions in `WorkshopPinnedContextLivePass.test.ts`. The two bug
      cases fail on the old code; the exact-bound and malformed controls pass.
  - **For item 15:** the room Okey tested holds 22 files to pin, past the
    20-file bound.
