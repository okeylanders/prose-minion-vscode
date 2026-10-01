# Workshop session browser lists a session whose file no longer reads

**Date Identified**: 2026-10-01
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (a browser-side read check or an "unreadable" badge, with tests)
**Found by**: [PR #120 review](../../docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md), F-01 probe table (an observation, not a finding); confirmed by a probe on 2026-10-01

## Problem

When a named session's JSON is corrupted outside Prose Minion, for example by a bad Git merge, the session browser still lists it. The listing comes from the session's search index, which still describes the old file.

Opening the session fails honestly with `WorkshopSessionFileReadError` ("Could not read Workshop session …: Unexpected end of JSON input"). Nothing is lost or overwritten. The writer just meets the problem on Open rather than in the list.

This is pre-existing store behavior, not part of Rewind or Branch. Branch itself is safe: since the PR #120 review fix, it reads its source back and refuses one that no longer decodes.

## Recommendation

Decide what the browser should say about a file it can no longer read:

- **Badge it:** keep the row and mark it "can't be read", with the read error on hover, so the writer can find and repair the file; or
- **Hide it:** drop the row and surface one browser-level notice that a session file could not be read.

Badging seems kinder: hiding a writer's session, even a broken one, reads like data loss.

## Related Files

- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts` (browser listing and search index use)
- `packages/core/src/infrastructure/storage/WorkshopSessionSearchIndexV1.ts`
- `packages/core/src/presentation/webview/components/workshop/` (session browser rows)

## Completion Criteria

- A session whose file no longer decodes is either badged as unreadable or hidden with a notice, by a deliberate product decision.
- A store test corrupts a listed session's file and asserts the chosen listing behavior.
