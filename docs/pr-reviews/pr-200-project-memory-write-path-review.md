# PR #200 review: Project Memory Slice 3 write path

- **Reviewed:** 2026-11-04
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/200
- **Implementation head:** `5dcc8d02adfc3db64d33dc1cb5f915df7b021ed8`
- **Comparison base:** `2b4aaba90013a88f3f183214b244021c7661abb6` (PR #197)
- **Verdict:** **Changes requested: F-01 through F-05.** This is a written review verdict, not a formal GitHub approval, merge, or changes-requested review submission.

## Re-review at `f87b38c85566590736b6696be83bf95d74db5826` (2026-11-04 19:39 UTC)

**Current verdict: changes requested for F-03 only.** F-01, F-02, F-04, F-05 and F-06 are independently verified as fixed. The ordinary nested-frame case of F-03 is also fixed, but its new tag scanner introduces the overlapping-token regression below. Earlier verdicts and the author's resolution ledger remain historical records.

Verified corrections:
- Intermediate persona/tool capability responses are sanitized before replay, retention and diagnostic output. Original well-formed and nested real-engine witnesses now contain no private sentinel in correction requests, retained history or logs.
- The actual streaming renderer hides the original trailer; 3,287 streamed prefixes across 15 case/whitespace/attribute/nesting variants passed the additional privacy probe.
- Concurrent saves in one library now yield one write and one budget refusal, with 3,306 tokens loaded and no overflow.
- Overlapping proposal saves return the same memory id and produce one file/receipt; a saving sheet marks the card busy and ignores Escape.
- Both digest-reversal witnesses now emit the bounded update note, and the new regressions cover receipt agreement.

### F-03 remains open: overlapping marker inside an opening tag ends redaction early

**Location:** [workshopReplyControls.ts:200–208](https://github.com/okeylanders/prose-minion-vscode/blob/f87b38c85566590736b6696be83bf95d74db5826/packages/core/src/utils/workshopReplyControls.ts#L200-L208), consumed at lines 178–185.

The nesting fix collects opening and closing regex matches independently and sorts them. It permits a closing-token match to overlap the opening-token match that already consumed those bytes. The fold therefore closes a frame before its `innerStart`, then exposes the suffix as prose.

**Executed malformed-trailer witness:**

```text
<prose-minion-memory-proposal data-x="</prose-minion-memory-proposal>">PRIVATE_MEMORY_SENTINEL_71bb</prose-minion-memory-proposal>
```

The opening tag is malformed; this is a redaction test, not a request to accept it as a valid proposal. The shared extractor nonetheless recognizes its opening marker and must keep its payload out of the sinks covered by D6/D9.

With this trailer after a `memory.catalog` capability call, the real engine/capability probe at this head reports:
- inspection: invalid/mixed-content;
- correction request contains private payload: **true**;
- retained history contains private payload: **true**;
- debug log contains private payload: **true**;
- final reply: clean.

This is a regression introduced by the new independent token collection. Ordinary depth tracking does not fix it because the token spans themselves overlap. Ensure that recognized tag tokens do not overlap before depth pairing, and conservatively redact the whole affected frame. Regress this exact case through extractor, streaming, correction replay, retained history and logs, with memory on/off.

### Verification at this head

- Core/webview/extension typechecks pass.
- **21 focused production suites / 339 tests pass.**
- **Three independent Jest suites / five fixed-behavior witnesses pass**, covering F-04/F-05/F-06.
- **Lint: 0 errors / 1,158 warnings**, matching the baseline.
- The entire tracked tree was materialized with source/blob verification (the three repository instruction links preserved as symlinks). An independent full-suite run is in progress; it is not yet a pass claim.
- GitHub reports the new base `94fcabb7` mergeable. [CI run 41898362354](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41898362354) was still running at this check.
- No formal approval, merge or deployment performed.

## Re-review at `edc5a6cb69cecb410e80861bbe1db4998eec99aa` (2026-11-04 19:08 UTC)

**Current verdict: changes requested, F-01 through F-06.** The original review below remains a record of `5dcc8d02`.

- The deferred receipt/D14 fold is now implemented. Receipts use the shared `ProjectMemoryVersion`; the fold is bounded by the participant's prepared/committed room-delivery point; the new tests cover the host, separate guest offsets, re-invitation, Rewind/Branch and digest records.
- **F-01 is partly corrected:** `AgentCapability.redactForLog` now removes a well-formed proposal from rejected-capability diagnostics. The actual engine still sends that proposal in the correction request and commits it in intermediate assistant history. F-01 remains open for replay/retention. Nested malformed frames still leak through the new log hook because of F-03.
- **F-02 and F-03 are unchanged and reproduced again.** Their production files are byte-identical to the original review. **F-04 and F-05 are reproduced again** against the new real library/routes/hook/sheet.
- **New verification:** core, webview and extension typechecks pass; **17 production suites / 294 tests pass**. The original three adversarial Jest witnesses still confirm the open faults, and two new digest-reversal witnesses confirm F-06. Real engine and renderer probes independently reconfirm the privacy cases. No full-suite, lint or live-provider result is claimed for this re-review.
- GitHub reported this exact head as conflicting with the unchanged PR #197 base (`2b4aaba9`). Recheck the final base/merge result after the stack is reconciled.

### F-06 · P2 · Digest equality ignores a newer receipt and hides a restore or revert

**Location:** [ProjectMemoryUpdateNote.ts:59–64](https://github.com/okeylanders/prose-minion-vscode/blob/edc5a6cb69cecb410e80861bbe1db4998eec99aa/packages/core/src/application/services/workshop/memory/ProjectMemoryUpdateNote.ts#L59-L64), in the receipt-fold integration.

Above 4,096 memories, the delivered view has a digest plus later `receipted` overrides. The renderer returns “current” as soon as the folder matches the old digest, without checking whether those later receipts told this participant a different state.

**Executed reproduction:** start with a 4,100-memory snapshot/digest containing memory A at version V1. Fold a delivered Forget receipt for A (`receipted[A] = null`). Restore A outside this room before the next turn, returning the folder to the original digest. The renderer returns no note and `changed: 0`, even though this participant's latest information says A is forgotten. The same failure occurs after an in-room edit receipt at V2 and an external revert to V1. Both cases were independently run through the production renderer.

The next turn can receive the Forget receipt in its catch-up and no correcting restore note, or continue believing a previously delivered Forget. This is specific to the new receipt-aware digest view; the ordinary map path would recognize the mismatch.

**Requested correction:** only accept digest equality when every later receipt is consistent with the current snapshot, or otherwise account for those overrides before concluding that nothing changed. Keep the bounded fallback: a contradictory or unverifiable receipt can produce one count-line update and record a fresh snapshot. Regress Forget→external Restore and Edit→external revert, for receipts already delivered and receipts arriving in the current catch-up.

## Author resolution ledger

Each fix's test was confirmed to fail with that fix reverted. Head after the fixes: `4844239c`.

| ID | Priority | Finding | Status |
|---|---|---|---|
| F-01 | P2 | Correction turns bypass proposal retention and diagnostic redaction | Fixed in `1a00b6d0`. **Hook:** `AgentCapability.redactPrivateControls`, optional; it was `redactForLog`. The engine stays feature-agnostic and imports no Workshop code. **Where it runs:** on every intermediate response before it is replayed (correction turn, capability round, forced-final turn), retained, or written to the debug dump; the final response still goes through `retainedAssistantContentSanitizer`. **Implemented by:** the Workshop persona capability and `WorkshopToolContextCapability`; capability calls are left exactly as written. **Tests:** an engine sentinel test checks provider messages, retained history and logs (debug on) through a rejected call with a proposal and a capability round; a separate case covers debug off; the tool-context capability has its own case. |
| F-02 | P2 | The live streaming bubble exposes proposal text before completion | Fixed in `443d2126`. **Fix:** `stripWorkshopMemoryProposalForStreaming` runs before the widget strip in `WorkshopApp`. It removes frames as `rest` does, an unclosed one through to the end of the reply, and holds back a trailing fragment that could still become an opening or closing tag. **Tests:** every prefix of four replies (whole frame, attributes, nested, after the widget section); `WorkshopApp.memoryStreaming.test.tsx` through the real App and `StreamingContent`, one character at a time, through completion, cancellation, a rejected proposal, and a frame left open. |
| F-03 | P2 | Nested malformed frames leave outer payload in display, logs and retention | Fixed in `443d2126`. **Fix:** `findFrames` pairs tags by depth. A frame ends only where its own depth closes, otherwise at the end of the reply. A closed nested frame is rejected as `malformed:nested`. **Tests:** sentinels for one-level, two-level, outer-unclosed and fully unclosed nesting, each with memory on and off, and prose after a nested frame. |
| F-04 | P2 | Concurrent writes in one window bypass the full-load budget | Fixed in `3ece36f0`. **Fix:** `ProjectMemoryWrites` runs one write at a time in a window: list, check, commit. Reads stay concurrent. Shutdown still drains every owed write, and a failed write releases the queue. **Tests:** create/create, create/update and update/update; each write fits alone but not together, and exactly one is written. |
| F-05 | P2 | Escape during an edited-card save permits duplicate files and drops one receipt | Fixed in `3ece36f0`. **Host:** the handler holds a proposal's save in flight by turn id before the first await. A second Save joins it: one file, one receipt, and the same answer under its own request id. A Dismiss sent meanwhile waits, then is refused once the card is saved. **Webview:** a sheet save marks the card busy; close, Escape and the backdrop do nothing until the answer lands; opening another sheet mid-save does nothing. **Tests:** the routes for Edit → Save overlapping a card Save, and for Dismiss during a save; the hook; the sheet's Escape. |
| F-06 | P2 | Digest equality ignores a newer receipt and hides a restore or revert | Fixed in `5be80151`. **Fix:** digest equality, or a save the receipts explain, counts as "nothing changed" only when every receipt folded after the digest names the state the folder holds now. Otherwise the count line goes out once and records a fresh digest. **Tests:** Forget then an outside Restore, and an edit then an outside revert, both give the count line. A Forget then a Restore in the room gives no note. The receipt reads the same whether it was delivered earlier or arrives in this turn's catch-up. |

**Verification at `4844239c`:**
- 2a's `94fcabb7` is merged in; the one conflict, in `listProjectMemories`, keeps 2a's links and adds 2b's `version`.
- Typecheck is clean; lint is at the 1,158-warning baseline.
- Jest: **668 suites / 9,452 tests / 59 snapshots**, all passing.

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
