# Two windows minting the same memory id for different titles both succeed

**Status:** Open
**Priority:** Low
**Found in:** PR #221 integration review (Astra's N-01), Workshop Project Memory

## Problem

`ProjectMemoryStore.create` checks a new memory's id against the folder
listing it read earlier, then catches a late collision only when the final
**file name** is already taken. The file name holds both the title's slug and
the id. So two windows that save at the same moment, and happen to mint the
same random six-hex id for notes with *different* titles, both report
`created`. The next listing then finds two files with one id. It marks them as
a duplicate-id conflict and leaves both out of the readable memories, and
`read(id)` returns `conflict`.

No bytes are lost: both files stay, and the manager shows the conflict for
the writer to resolve. The overlap is unlikely, about one in 16.8 million for
a given pair of draws inside the race window.

The existing same-id race test uses equal titles, so the no-overwrite rename
catches it. Astra's review keeps a deterministic witness with distinct titles,
and a sequential control (`docs/pr-reviews/probes/pr-221-memory-id-collision.test.ts.txt`).

## Related files

- `packages/core/src/infrastructure/storage/ProjectMemoryStore.ts` (create, around the commit)
- `packages/core/src/__tests__/infrastructure/storage/` (the store's race tests)
- `docs/pr-reviews/pr-221-project-memory-integration-review.md` (N-01)

## Completion criteria

Do both of these:

- Extend the race test to two different title slugs with one id.
- Either reserve or check the id independently of the slug at commit, or
  state the narrower guarantee in the store's contract and the ADR. A re-read
  just before the rename doesn't give an atomic guarantee across windows on
  its own.
