# PR #271 review: composer file mentions

- Reviewed code: `5c5fa7599d2d0e9b8064ae9943dfd1129593aa8d`
- Base: `3f99e73399b490cbfd6be34e40811a31ab65e8aa`
- Date: 2026-11-17
- Verdict: **Changes recommended: one P2 correctness finding.** No merge performed.

## F-01 (P2): wait for the picked attachment before allowing the next send

Location: `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopComposerMentions.ts:208-211`; composer send handling at `WorkshopComposer.tsx:205-234`.

Picking a non-staged row closes the list, fires the void `onAttach` callback, and immediately inserts its token. Enter is now a send key again, with no pending-attachment guard. The host attachment route awaits opening the catalog and reading the file before staging the pill. A second Enter (or Send click) during that I/O can therefore send the token without the file. When the load finishes, the file is staged for a later, unrelated message instead.

The host's mutation registrar only rejects session save/replacement conflicts; it does not serialize these routes. This is an existing limitation in the shared attachment route, newly exposed directly by the keyboard-first mention flow. The existing composer test even verifies immediate second-Enter submission while the attachment callback has not supplied a pill.

### Reproduction verified

Using the real `createWorkshopRouteTestHarness`:
1. Choose open-chat scope.
2. Hold `resourceProviderFactory.createProvider` behind a deferred promise.
3. Dispatch `WORKSHOP_ATTACH_MESSAGE_RESOURCES` for `Characters/raven.md`, without awaiting it.
4. Dispatch and await `WORKSHOP_SEND_MESSAGE` with `compare with @raven.md`.
5. Verify `startWorkshopPersonaConversation` was called once, its arguments contain the token but not the file contents, and there is no pending pill.
6. Release the catalog promise and await attachment. The file now appears in pending attachments, after the message was sent.

A local review-only Jest witness passed these assertions. The witness was not committed as production test coverage. The feature's own component test separately establishes the pick → immediate send sequence.

**Requested correction:** track an in-flight mention attachment until host success or refusal and prevent/defer Send for that interval, or coordinate attach-and-send atomically through the host. Do not infer success merely from inserting prose. On failure, unblock the composer and retain the existing visible error. Add a delayed-catalog/file-read integration test proving the intended message gets its attachment and no file leaks to the next message.

## Architecture and scope

- Declared: A1 keeps the pill as truth and the token as ordinary prose; A2 keeps file tokens distinguishable by a dot or slash.
- Observed: pure trigger/token/filter/edit rules feed a presentation controller with injected callbacks. The composer owns draft/caret state; the app wires the existing catalog and configured-resource attach routes. No direct filesystem or VS Code dependency was added to the webview.
- Observed: attachment labels, removal, selected-text pills and host refusal handling reuse existing owners. The shared project picker is unchanged.
- Observed: controller tests cover trigger suppression, bounded filtering, already-staged picks, keyboard navigation, Browse, IME and stale-draft protection. Component and app tests cover insertion/caret behavior and canonical IPC payloads.
- Unknown/unverified: real Extension Development Host layout, narrow widths/theme rendering, actual IME, screen-reader announcements, and persona interpretation of duplicate-basename tokens.

## Verification

- Four feature suites: **70 tests passed**.
- Existing composer + composed context-route suites and the extra delayed-attachment witness: **42 tests passed** across 3 suites.
- `npm run typecheck`: **passed** (core, webview, extension).
- ESLint on changed production TypeScript/TSX: **0 errors, 5 naming-convention warnings**.
- `git diff --check`: **passed**.
- GitHub Actions CI for reviewed code SHA: **success**, run [44090043933](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44090043933).
- Full repository Jest suite/build and live VS Code QA were not rerun in this review. The author's full-suite result is not represented as reviewer execution.

Only this review report is published by this review; no application code changes.
