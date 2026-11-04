# PR #200 review: Project Memory Slice 3 write path

- **Reviewed:** 2026-11-04
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/200
- **Implementation head:** `5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8`
- **Comparison base:** `2b4aaba90013a88f3f183214b244021c7661abb6` (PR #197)
- **Verdict:** **Changes requested: F-01 through F-05.** This is a written review verdict, not a formal GitHub approval, merge, or changes-requested review submission.

## Scope and assessment

Reviewed the 93-file stacked diff, the memory ADR and Slice 3 acceptance criteria, the trailer/retention integration, writer routes, library/store boundaries, session codecs, receipt flow, webview hook/card/sheet, and shutdown. Production TypeScript and relevant tests/configuration were materialized and checked against this head's Git blob hashes; no live provider was called.

The main shape is sound: one composed route owner, host-filled provenance, optional strict persistence fields, writer actions available with memory off, supersession without rewriting older files, and a shared estimator for full-load decisions. The existing focused tests pass. The gaps below concern paths those tests do not exercise.

**Known unfinished work is not a surprise finding:** this PR deliberately waits for #198 before integrating receipts with the D14 delivered-view fold. The shared version implementation and the test for a newly delivered receipt suppressing a duplicate update note still belong on this PR. The later merge with #199 also needs the two non-overlapping sections of `memory.css` combined and rechecked.

## Findings

### F-01 · P2 · Correction turns bypass proposal retention and diagnostic redaction

**Changed integration:** [AssistantToolService.ts:618](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts#L618), also lines 685 and 743. **Underlying paths:** [AgentRunEngine.ts:417–421](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L417-L421), lines 565–569 and 1083–1087.

The new sanitizer is applied only to the final visible assistant response. An earlier response that enters capability correction is appended to `pendingMessages` as raw `previous.content`. It is sent in the correction request and subsequently committed to conversation history. Rejected-capability diagnostics also print the raw response when debug logging is enabled.

**Executed reproduction:** use the real engine, real Workshop persona capability and codec, and a mocked provider. Its first response contains a `memory.catalog` tool-call followed by a valid memory proposal with a private sentinel in its title/summary/body. The codec rejects this as mixed content. The provider's correction response is ordinary clean prose. Nevertheless:
- the second provider request includes the sentinel in the previous assistant response;
- committed retained assistant history includes the sentinel;
- with `debugLogging: true`, the rejected-response log includes it;
- the clean final reply does not include it.

This violates D6's stripped retained history and D9's no-memory-payload diagnostics even when final completion behaves correctly. It also retains a personal-inference proposal that the final card fence never evaluates.

**Requested correction:** apply the Workshop control/privacy boundary to every intermediate assistant response before it is replayed, retained, or logged, while preserving the capability correction protocol. Use a separately redacted copy for diagnostics. Add engine-level sentinel tests for rejected mixed-control responses, correction history and archive retention, with debug logging both on and off.

### F-02 · P2 · The live streaming bubble exposes proposal text before completion

**Location:** [WorkshopApp.ts:497–499](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/presentation/webview/WorkshopApp.tsx#L497-L499), consumed by the streaming component at lines 1296–1304.

`visibleStreamingContent` still calls only `stripWorkshopWidgetRecommendationControl`. A normal prose reply followed by a valid memory trailer therefore reaches the live Markdown renderer without memory extraction.

**Executed reproduction:** render the actual production `StreamingContent` and `MarkdownRenderer` with that pipeline's output. The rendered visible text includes the proposal kind, summary and body, including “You seem anxious about PRIVATE_SENTINEL_71bb.” The completion extractor hides the same frame, but only after it has already appeared on screen. A proposal later withheld by the personal-inference fence is exposed in the meantime.

**Requested correction:** remove memory controls before streamed text is rendered, including partial/opening delimiters split across chunks and an unfinished frame. Test the actual streaming component through normal completion, rejection and cancellation, rather than only the settled bubble.

### F-03 · P2 · Nested malformed frames leave outer payload in display, logs and retention

**Location:** [workshopReplyControls.ts:149–162](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/utils/workshopReplyControls.ts#L149-L162).

The scanner pairs an opening marker with the next closing marker without accounting for another opening marker inside it. That inner close ends the redacted region prematurely; the remainder of the outer body is treated as ordinary prose, and the outer close is removed as stray debris.

**Executed reproduction:**

```text
Public
<prose-minion-memory-proposal><body><prose-minion-memory-proposal>x</prose-minion-memory-proposal>PRIVATE</body></prose-minion-memory-proposal>
```

The proposal is rejected as misplaced, but `PRIVATE` remains in all three of `rest`, `redacted` and `sanitizeWorkshopReplyForRetention(...)`. It can therefore reach the bubble, retained history and the widget-rejection dump. Rejecting the proposal does not establish the promised privacy boundary.

**Requested correction:** reject nested proposal syntax while consuming the entire affected outer region, conservatively through the end if it cannot be closed safely. Add sentinel tests with inner/outer suffix payloads, nested unclosed frames, memory off, and multiple levels.

### F-04 · P2 · Concurrent writes in one window bypass the full-load budget

**Location:** [ProjectMemoryWrites.ts:108–141](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L108-L141); the update path has the same list/check/write separation at lines 155–194.

The store serializes individual operations, but the library does not serialize the entire list → budget check → write transaction. Two saves in the same library can each list the old folder and pass their check before either queued create commits. The store's queue does not re-evaluate their budgets.

**Executed reproduction:** one `libraryHost()`, two concurrent `library.save` calls, each with a valid pinned canon memory whose body is 2,200 occurrences of “a” separated by spaces. Both return `written`. The real frame estimator then reports:

```json
{"memories":2,"pinned":2,"pinnedLoaded":1,"pinnedTokens":6612,"pinnedOver":true}
```

The budget is 5,000 tokens. This is one window and one store, not the explicitly accepted cross-window race in D5.

**Requested correction:** serialize the library's full budget-sensitive mutation, or otherwise make its check and commit coherent within one window. Keep reads, shutdown draining and failures safe. Add concurrent create/create, create/update and update/update tests proving that the second growing operation is checked against the first completed write.

### F-05 · P2 · Escape during an edited-card save permits duplicate files and drops one receipt

**Host location:** [WorkshopProjectMemoryHandler.ts:154–170](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryHandler.ts#L154-L170), with the post-write check at lines 323–326. **UI path:** [useWorkshopProjectMemory.ts:273–304](https://github.com/okeylanders/prose-minion-vscode/blob/5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopProjectMemory.ts#L273-L304) and `WorkshopMemorySheet.tsx:88–105`.

A sheet save does not mark its source card busy. The sheet disables its Close and Cancel buttons while saving, but its unguarded `onClose` still responds to Escape/backdrop dismissal. The writer can return to the pending card and press Save again before the first answer arrives. The host checks `saved` only before awaiting storage, so both requests create files.

**Executed reproduction in two layers:**
1. Real hook plus sheet: Edit card → submit → Escape while saving → Save card. The sheet closes despite its disabled Close button, the card is not busy, and two `WORKSHOP_MEMORY_PROPOSAL_ACTION` save requests are emitted for the same turn.
2. Real router/room/composition/library: overlapping saves for one pending proposal create **two Markdown files and one receipt**. The second response is `ok: true` with a different memory id plus “The room changed before this could be recorded here.” The room did not change; the first save settled the card. The second file is left without the receipt required by D7.

**Requested correction:** reserve or coalesce an in-flight save for the proposal before any file write, and keep the pending card state coherent across the sheet and card actions. All dismissal paths must honor the intended saving policy, or retain the pending operation and its eventual outcome if dismissal is allowed. Add the Edit → Save → Escape/backdrop → Save sequence and overlapping-route regression tests; assert one file, one receipt and an accurate answer.

## Verification

Independently executed against the reviewed implementation:
- **Typecheck:** core, webview and extension all pass.
- **Focused production tests:** **13 suites / 181 tests passed**, covering write routes, library writes, session memory turns, completion, reply controls, cards, sheet/hook, room seams, model stamps, side-pass integration, widget recommendations and shutdown.
- **Adversarial witnesses:** two Jest suites / three tests confirm the budget race, duplicate-file/one-receipt outcome and Escape re-entry. Separate real-engine and real-renderer probes confirm F-01 through F-03. These witnesses assert the current broken behavior and were kept out of production tests.
- **CI:** implementation head `5dcc8d02` has a successful [CI run 41889888750](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41889888750).
- No direct `from 'vscode'` imports found in production core.
- The author reports 661 suites / 9,375 tests / 59 snapshots and lint with 0 errors / 1,158 warnings. This review did **not** independently rerun the entire suite or lint, and did not run a live VS Code/provider pass.

## Re-review gates

Fix and regress F-01 through F-05 on the new exact head. Complete the explicitly deferred #198 receipt fold with the shared version implementation and real delivery tests. Then rerun focused and aggregate checks, recheck the final stacked/base diff after retargeting, and inspect the combined stylesheet when #199 lands. No merge or formal GitHub approval was performed.
