# PR #260 review: file-backed Continue and re-read

- Reviewed implementation: `3000f9c13325f1db2216e8e4169fd780f611b63c`.
- Date: 2026-11-14.
- Verdict: **changes requested (one P2 correctness finding)**. This is a technical review, not merge/release approval.

## F-01 — P2: Keep Continue pending until its automatic read finishes

Location: `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts:443–447`.

`continueWithExcerpt` posts the scope choice and the read without awaiting an acknowledged completion. The scope handler immediately posts a ready passage-session state, but the read awaits authorization and disk I/O. There is no read-in-progress gate on sends. A writer can press Continue and send a prepared message while the read is pending; the model receives the **old carried passage**, and the read then fails its mid-run guard instead of applying the edited file. Thus the new composite Continue action does not reliably take the file's current text as promised by item E/default 14. Ordered IPC starts are not ordered completion.

This was reproduced deterministically with the real composed route harness, not a timer:

1. Pin `OLD PASSAGE` from a file; reset the room, retaining the excerpt.
2. Route `WORKSHOP_SET_SESSION_SCOPE` with `excerpt`, followed by `WORKSHOP_REREAD_EXCERPT`.
3. Hold the fake filesystem's read promise after the read starts.
4. Route `WORKSHOP_SEND_MESSAGE` and hold the fake model response.
5. Observe `startWorkshopPersonaConversation` called with `OLD PASSAGE`.
6. Resolve disk I/O with `NEW PASSAGE`: the reread emits an error and the active excerpt remains `OLD PASSAGE`.

The local witness passed its assertions. The existing focused tests also pass because they await both scope/read operations before inspecting the room, and never interleave a send.

Please make Continue/read one acknowledged operation (or otherwise block/queue sends until its read settles), including explicit failure handling, and add a regression test with a deferred file read and an immediate send. The read should not be fixed by bypassing the mid-run guard. This finding concerns the newly composed automatic Continue flow; the underlying manual reread concurrency behavior predates this PR.

## Coverage

Inspected all six changed files, the excerpt/scope host route, mutation registrar, panel dispatch, send gate, and the feature/epic contract. The source-kind restriction and synchronous scope-before-read ordering are correct for the happy path. Existing locked-card markup is preserved. The pre-existing large hook is not a newly created oversized file.

## Verification

- Typecheck (core/webview/extension): passed.
- Changed-test suites: 3 passed, 97 tests passed.
- Deferred-read race witness: 1 test passed, demonstrating F-01 (not proving a fix).
- Lint: 0 errors; 1,172 warnings with the local witness present. One warning belongs solely to that local witness, leaving 1,171 in the PR tree. Base lint was not run, so no baseline comparison is claimed.
- Build/bundle verification: passed with webpack size warnings.
- GitHub PR CI on reviewed head: success, run 43604335734.
- Full local suite: 845 suites, 11,959 tests, 59 snapshots passed (includes the one local race-witness suite/test; the PR tree itself contains 844 suites and 11,958 tests).
- No live Extension Development Host, visual UI or real model/provider exercise was performed.

Only this report is committed. The local witness is described above, not an implementation change. No merge or production-code edit was performed.
