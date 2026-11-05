# PR #203 review: Pinned Context starts and seed port

- Reviewed implementation: `3feab7588ff8aab6902205eae33d3f7482acb4c2`.
- Base at review: `6fe9bf1c7afd5295884190abf84d7de145a14356` (`epic-pinned-context`).
- Date: 2026-11-05.
- Verdict: **Changes required.** One high-priority correctness finding. No formal GitHub approval or merge performed.
- Scope: all 39 changed files, epic README, ADR D2/D5/D7/D9, Slice 2a and its Slice 2b handoff, real coordinator/store probes, UI/contract/result tests.

## F01 · High · Revalidate the accepted workspace after asynchronous seed preparation

**Location:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:899–903` (new `await this.roomSeed.prepare(...)`), then the promotion at lines 923–925.

`serializeSessionOperation` checks `assertAcceptedWorkspace()` before invoking the operation. The new seed read then awaits. On resumption, `resetSession` immediately resets the room and eventually calls `store.writeCurrent(promoted)`, which resolves its destination from the workspace that is current *then*. Nothing rechecks that this is the workspace accepted by the live room.

This crosses the workspace-identity rule already stated in this class and ADR D5. It is not repaired by Slice 2b dropping a foreign seed plan: the coordinator still replaces and writes the room even when `install` correctly attaches nothing.

**Deterministic reproduction through the real coordinator, aggregate and store:**

1. Initialize project A and give its current room the made-up excerpt `Alice private project A passage.`.
2. Put an existing `project-b-room` checkpoint at project B's `current.json`.
3. Start either `carry` or `full-reset` with a seed whose `prepare` awaits a deferred promise.
4. Switch the store's live workspace availability to project B while preparation is pending.
5. Resolve preparation. The seed's synchronous `install` is a no-op, modeling the required foreign-plan rejection.
6. Both reset requests resolve successfully, replace B's existing checkpoint with `room-2`, and change the live room. **Carry also copies A's excerpt into B.** Full reset replaces B's checkpoint with an empty room.

The expected-behavior probe below fails both rows at `expect(resetting).rejects`: the promise resolves. A separate observation run confirmed the changed B checkpoint and the excerpt copied by carry; both observation rows passed.

**Required correction:** recheck the accepted workspace after preparation and before any room replacement. Keep the destination protected through the remaining awaited capture/promotion work as well, so a later identity change cannot commit into a different project. On refusal, retain A's prior live room and leave both projects' checkpoints unchanged. Add regression coverage for carry/full-reset, with a seed that installs nothing after an identity change, and a workspace change before promotion.

The no-op production seed makes today's wait short, but this PR establishes the exact asynchronous boundary the real file-reading seed will use. The port contract allows asynchronous preparation and does not permit it to reject on workspace changes, so the coordinator must own this guard.

## Verified behavior

- Missing, unknown and legacy-only reset payloads are refused.
- Carry, full reset and empty map correctly; empty never calls the seed.
- Seed installation occurs before the start marker/checkpoint. Failed promotion rolls the aggregate back.
- First-room seeding and non-seeding of hydrate/Open/Duplicate/Rewind/Branch are covered.
- Zero pinned files retain existing menu behavior. Positive count adds the ordered empty-context action with matching disabled state.
- Result text covers complete/partial/all-left-out reports, and seed log metadata does not include left-out labels.
- The explicitly deferred full-reset confirmation wording is not a current-slice blocker: production injects the no-op seed and `WorkshopApp` supplies count zero. Reword it when the real count/seed become visible.

## Verification

- Source and test files under `packages/` and `apps/` were materialized from GitHub and checked against the exact head's Git blob hashes.
- Local runtime: Node 24.22.1; existing lockfile-compatible dependencies reused.
- `npm run typecheck`: **pass** (core, webview and extension).
- `npm run lint`: **pass**, 0 errors / 1,165 warnings, matching the stated baseline.
- Independent UI/contract/result subset: **5 suites / 57 tests passed**.
- Independent F01 expected-behavior probes: **2 failed**, both requests incorrectly resolved.
- Independent F01 observed-behavior probes: **2 passed**, confirming B overwritten and A's excerpt copied on carry.
- Local production build was attempted and killed by the environment (exit 137); no local bundle pass is claimed. Exact-head CI above includes the build.
- First full local Jest attempt was killed by the environment before completion. A memory-bounded full retry is in progress; no full local pass is claimed yet.
- Exact implementation-head GitHub CI `verify`: **success**, [run 41945500995](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41945500995), finished 2026-11-05 01:06:36 UTC. This does not cover the new F01 probe.
- No Extension Development Host/manual visual pass was performed.

## F01 expected-behavior probe

To reproduce at the reviewed head, temporarily save this under
`packages/core/src/__tests__/application/services/workshop/pinnedContext/WorkshopRoomSeed.review-probe.test.ts`
and run `npx jest --runInBand --runTestsByPath <that path>`. This report intentionally does not add a known-failing test to the production suite.

```ts
import { setupCoordinator, scriptedCheckpoint } from '../session/WorkshopCoordinatorHarness';
import type { WorkshopRoomSeed, WorkshopRoomSeedKind } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('PR #203 independent seed boundary probe', () => {
  it.each(['carry', 'full-reset'] as const)('refuses %s if the workspace changes while seed preparation waits', async (start) => {
    const entered = deferred();
    const release = deferred();
    const seed: WorkshopRoomSeed = {
      prepare: async (kind: WorkshopRoomSeedKind) => {
        if (kind !== 'first') {
          entered.resolve();
          await release.promise;
        }
        return { kind };
      },
      // Conforming foreign-plan behavior: install nothing after a workspace change.
      install: () => ({ pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [] })
    };
    const { coordinator, store, session, fs } = setupCoordinator({ roomSeed: seed });
    await coordinator.initialize();
    session.setExcerpt({ text: 'Alice private project A passage.', source: { kind: 'manual' } });
    coordinator.markDirty('review fixture');
    await coordinator.flush();
    const before = session.exportCommittedState();
    const bPath = '/workspace/other/prose-minion/sessions/current.json';
    const bCurrent = scriptedCheckpoint('project-b-room');
    fs.setJson(bPath, bCurrent);
    const originalB = fs.files.get(bPath);

    const resetting = coordinator.resetSession({ start });
    await entered.promise;
    jest.spyOn(store, 'availability').mockReturnValue({
      available: true,
      rootPath: '/workspace/other',
      sessionsDirectory: '/workspace/other/prose-minion/sessions',
      currentPath: bPath
    });
    release.resolve();

    await expect(resetting).rejects.toThrow('workspace changed');
    expect(fs.files.get(bPath)).toEqual(originalB);
    expect(session.exportCommittedState()).toEqual(before);
  });
});
```

## Review boundaries

Only this review report is committed. No production fixes, formal approval, merge, provider calls, or deployment were performed. Findings and verification are tied to the implementation SHA above; correction commits require re-review.
