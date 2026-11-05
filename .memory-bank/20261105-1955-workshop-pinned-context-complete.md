# Workshop Pinned Context: complete

**Date:** 2026-11-05
**Epic:** [archive](../.todo/archive/epics/epic-workshop-pinned-context-2026-11-04/ARCHIVE.md)
**Decision:** [ADR 2026-11-04](../docs/adr/2026-11-04-workshop-pinned-context.md), Accepted 2026-11-05
**Branch:** `epic-pinned-context`, which merges to `main` after Project
Memory's epic (Okey, 2026-11-05)

## Facts

- **What it is.** A per-project list of files,
  `prose-minion/pinned-context.json`, that every new Workshop conversation
  starts with. It is managed in a **Pinned context** tab of Conversation
  settings, and pinned pills are marked in the context sheet.
- **How it was built.** Five code PRs, each reviewed by Astra and merged on a
  clear verdict:
  - #203: the three room starts and the seed port;
  - #204: the format and the store;
  - #208: the room seed;
  - #210: the settings tab;
  - #213: the pill marks.

  Then #217, from the live pass.
- **Project Memory** merged in four times. Its coordinator did the final merge
  (`b668782b`) on this coordinator's go.

## Decisions

- **Room starts:** `carry`, `full-reset` and `empty`. An ordinary New tops
  up, a full reset attaches the pinned files, and the empty start leaves them
  out.
- **"Pinned" is derived from the list,** never stored in the session, so the
  session codec did not change.
- **The bound is 50 files, and the list file's byte bound 256 KiB.** Okey
  tuned it from 20 in the live pass: the first real project had 22.

## Lessons the reviews taught

- **Bind a read to its source's identity, not its containment.** Twice a
  check of "under the captured root" let a nested workspace's file through
  (#208).
- **Fence a stale lock owner's commit.** A lease alone doesn't stop an owner
  stalled past it. Staging inside the lock directory does (#204).
- **Order list answers by the store's own observation,** not by request or
  reply order (#210 F03, as the Lightbox's saved boards do).
- **Keep message-shape checks apart from domain bounds.** A domain bound used
  as a shape check turned a clear refusal into "couldn't be read" (#217).

## Verification

At `b668782b`: 728 suites / 10,239 tests / 59 snapshots, typecheck clean,
lint at 0 errors / 1,165 warnings. After #217: 729 / 10,244 / 59.

## Follow-ups

- `.todo/tech-debt/2026-11-05-pinned-context-utf8-byte-bound.md`: the byte
  bound's fit is proved only for ASCII paths (low).
- `.todo/tech-debt/2026-11-05-pinned-context-live-checks-to-record.md`:
  New-session timing and the native Windows checks (low).
