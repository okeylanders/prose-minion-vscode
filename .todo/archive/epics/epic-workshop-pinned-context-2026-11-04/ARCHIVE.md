# Workshop Pinned Context Epic Archive

**Archive prepared:** 2026-11-05
**Effective:** the epic's PR to `main`, merged after Project Memory's (Okey,
2026-11-05)
**Integration branch:** `epic-pinned-context`
**Decision:** [ADR 2026-11-04: Workshop Pinned Context](../../../../docs/adr/2026-11-04-workshop-pinned-context.md) (Accepted 2026-11-05)
**Design:** [`docs/design/workshop-pinned-context/`](../../../../docs/design/workshop-pinned-context/README.md) (approved by Okey, 2026-11-05)

## Summary

A writer names, once per project, the files most Workshop conversations need,
and every new conversation starts with them.

- **The list.** It lives in `prose-minion/pinned-context.json` and is managed
  from a **Pinned context** tab in Conversation settings: add from project,
  pin what's attached now, reorder, unpin, open the file, attach missing.
- **Room starts.** The first room, New session and New session: full reset
  attach the pinned files as ordinary context attachments. New session: full
  reset, empty context starts with none. Open, Branch, Rewind and reload never
  seed.
- **The context sheet.** A pinned pill shows a pin mark, an unpinned file pill
  offers Pin, and the header counts the pinned pills.

The list is a template. Each conversation's context stays its own.

## Slices, PRs and reviews

Every code slice was built on its own named branch and reviewed by Astra.
Each merged only after Astra's clear verdict, with CI green.

| Slice | PR | Merged as | Review |
|---|---|---|---|
| [0d: tab design](slice-0d-tab-design.md) | (docs only) | on the epic | Approved by Okey, 2026-11-05 |
| [1: format and store](slice-1-format-and-store.md) | [#204](https://github.com/okeylanders/prose-minion-vscode/pull/204) | `deeac5d3` | F-01 to F-04 and N-01 fixed over two rounds: the directory lock that fences a stale owner, bounded recovery reads, NTFS-style keys, C1 controls |
| [2a: starts and seed port](slice-2a-starts-and-seed-port.md) | [#203](https://github.com/okeylanders/prose-minion-vscode/pull/203) | `d356d38e` | F01 fixed: the workspace rechecked after the seed's `prepare` |
| [2b: room seed](slice-2b-room-seed.md) | [#208](https://github.com/okeylanders/prose-minion-vscode/pull/208) | `c52821b5` | F01 to F04 fixed. F01 took two corrections: every seed read bound to the captured root's own files, nested roots included |
| [3: settings tab](slice-3-settings-tab.md) | [#210](https://github.com/okeylanders/prose-minion-vscode/pull/210) | `207dc701` | F01 to F07 and N01 fixed over two rounds: one source rule, Attach missing as a room operation, answers ordered by store observation, one path bound |
| [4: context sheet marks](slice-4-context-sheet-marks.md) | [#213](https://github.com/okeylanders/prose-minion-vscode/pull/213) | `f102f759` | F01 and N01 fixed: a pill's outcome bound to its room and attachment, and focus returned only when Pin held it |
| [5: live pass](slice-5-verify-live.md) | [#217](https://github.com/okeylanders/prose-minion-vscode/pull/217) | `fa10e8db` | Clear. The bound tuned to 50; N-01 deferred |

Project Memory's epic merged in four times: `17d52cf`, `25c9443c`, `29fe3fc7`,
and its final round, `b668782b`.

## Verification at close

- At `b668782b` (code complete): typecheck passes; `npx jest -w 3` runs 728
  suites / 10,239 tests / 59 snapshots, all passing; lint is 0 errors / 1,165
  warnings.
- After #217 (`dfa108d5`): 729 suites / 10,244 tests / 59 snapshots, all
  passing.

## Follow-ups split out

- [Reconcile the byte and path bounds](../../../tech-debt/2026-11-05-pinned-context-utf8-byte-bound.md)
  (PR #217 N-01, low).
- [Record the live checks not yet reported](../../../tech-debt/2026-11-05-pinned-context-live-checks-to-record.md):
  New-session timing (item 14) and the native Windows file-name checks
  (item 16), low.
