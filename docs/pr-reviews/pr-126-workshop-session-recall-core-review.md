# PR Review — Workshop session recall core

**Author:** okeylanders · **PR:** [#126](https://github.com/okeylanders/prose-minion-vscode/pull/126) (open at review)
**Branches:** `claude/workshop-recall-core` → `epic/workshop-session-recall`
**PR-reported base / verified merge-base:** `e5277bd0e23c22ebb094107674e2a14b47a8ad14`
**Observed integration-branch tip at publication:** `72762615ee485e1d2108f7d3b8c583685ced9993` (documentation-only advance; see verification)
**Initial reviewed code head:** `b209080588a5d8615521cfca3878b0d7a179ff3b`
**Fix re-review head:** `c4527f4f585a082d0fc545888ea7c5b90dd62369`
**Initial scope:** 20 files · +3,897 / −17 · 8 commits
**Fix-round scope:** 18 files · +1,092 / −367 · 8 commits after the first review commit `5f7d0c9`
**Reviewed:** 2026-10-05 · **Mode:** thorough review with three independent specialist passes (service/state and resource bounds; document/search and visibility; renderer/window/provenance), followed by integration review, adversarial reproduction, and full automated verification

## Resolution ledger

Status legend: **Open** = recommended before integration · **Deferred** = explicitly accepted follow-up · **Addressed** = verified fix · **N/A** = no action. This review does not accept deferrals on the author's behalf. The ledger records the verified state at `c4527f4`. Initial evidence below remains pinned to `b209080`; the fix re-review uses explicit current-head links.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Read metadata can exhaust the output allowance | Original 152,617-character case now fits at 47,779; a separately accepted participant-list case still produces 60,451 / 48,000 characters | **Partially addressed** in `f3779af`; remaining bound gap independently verified at `c4527f4` |
| F-02 | 🟡 Standard | Failed cold parses never spend the search byte budget | One failed file now spends the disclosed 25 MiB charge; the next two cold files are skipped | **Addressed**, independently verified at `c4527f4`; fix `b4cab1b` |
| F-03 | 🟡 Standard | Cached citation URLs are omitted from cache-size accounting | The 8,222-character URL no longer becomes warm under the 1,000-character limit | **Addressed**, independently verified at `c4527f4`; fix `65ea614` |
| F-04 | 🟡 Standard | The accepted scope is sampled before asynchronous work and never revalidated | Original copied-root and warmed multi-root races now refuse; generation/publication probes pass | **Addressed**, independently verified at `c4527f4`; fixes `cce3889`, `970ed75`; documented host-lifecycle residual retained |
| F-05 | 🔵 Nit | Lineage equality uses normalized search text rather than exact visible text | Original café/punctuation case now returns two hits, with no duplicate | **Addressed**, independently verified at `c4527f4`; fix `3b5b6e5` |

**Current verdict at `c4527f4`: Request changes for the remaining F-01 bound gap.** F-02 through F-05 are independently verified addressed, and the cancellation observation is fixed. The original F-01 failure is repaired, but the complete read-output guarantee still fails on accepted externally edited participant metadata. This is one remaining Standard finding, not a new High-severity live incident. No additional independent Blocking, High, or Standard finding was established in the fix round.

## Fix re-review at c4527f4

The eight follow-up commits were reviewed against the first report commit `5f7d0c9`, with three new independent passes covering rendering/provenance, service/cache/scope, and search/contracts/architecture. The whole current suite was rerun. Fix claims in the author-updated ledger were treated as claims to verify, not as the reviewer's prior approval.

### F-01 is partially addressed

The original real aggregate/coordinator/store reproduction now produces **47,779 characters**, below the default **48,000-character** allowance. It delivers a **45,172-character** head of turn 2 and correctly continues at turn 3. `headOf()` now handles nonpositive capacity and a missing word boundary, and a first entry without room for a readable head remains undelivered. The independent renderer pass also ran **3,000 renders across 100 fixtures**, checking bounds, delivery/continuation accounting, and turn-ID provenance without finding another normal-window defect.

**The remaining path is the participant list.** [WorkshopTranscriptRecallRenderer.ts:212–220](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts#L212-L220) still joins every participant name at line 217 before computing the remaining window. [WorkshopRecallDocument.ts:159–160](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopRecallDocument.ts#L159-L160) copies the entire persisted participant list. The existing [persisted codec at :117–120 and :134–136](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/WorkshopPersistedSession.ts#L117-L136) checks that each ID is valid, but does not reject duplicates or bound the count.

Reproduction, independently rerun against the fixed head:

1. Save an ordinary open-scope room with a normal title, a short writer question, and a short reply through the real coordinator/store.
2. Keep its normal sidecar index. Edit only the authoritative full file's `summary.participantPersonaIds` to 10,000 valid `jill` entries.
3. Read it through the real `store.readNamed()`, then through `recall.read({ sessionId, turns: [{ from: 2, to: 3 }] })` and the default renderer.

The **72,419-byte** file passes decoding. The read emits **60,451 characters**, delivers no entries, and offers continuation `2–3`; repeating that continuation cannot reduce the same oversized header. This requires externally edited accepted session data. Normal coordinator saves deduplicate participants, so this is not a claim that the ordinary participant picker creates the case. The renderer's complete-output invariant still needs to hold for data its actual persistence boundary accepts.

**Remaining correction:** deduplicate and bound the participant metadata, and enforce the complete header/window/footer allowance rather than assuming every metadata path has a small fixed size. Add the accepted-file reproduction above before marking F-01 addressed. Preserve the fixes to entry truncation and truthful provenance.

Two related caveats are lower priority and are not additional merge-blocking findings:

- A custom `readCharacters` smaller than the irreducible header/footer still overflows: an independent one-character-budget probe emits 457 characters. The added bound sweep begins at that floor. Define/reject a minimum supported override, or make the complete-output contract explicit for smaller values; the remaining F-01 finding above uses the production default and does not depend on this caveat.
- Reply speaker/private-tool labels still bypass the new clipping helpers in [the search renderer at :330–335](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts#L330-L335). A real saved file edited to contain a 100,000-character `personaLabel` yields a 100,573-character search result. This is pre-existing, requires edited metadata, and violates no explicit whole-search character cap. It is a hardening opportunity and a qualification to the new “every saved-file label” wording, not a separate Standard finding.

### F-02 through F-05 are verified addressed

- **F-02 (`b4cab1b`):** [Service:372–382](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L372-L382) now checks successful parse bytes plus conservative failed-read charges. The original three-file unsupported-schema case with a 64 KiB test budget reads one full file, records `unreadableBytesCharged: 26_214_400`, and leaves two cold files unsearched. Cached documents remain free, and mixed cached/failed/healthy ordering is covered. The 25 MiB charge is pinned to the store's exact-read ceiling. This verifies the reported failed-file defect; it does not turn the separately documented legacy listing work into measured bytes.
- **Cancellation observation (`689f96e`):** both original read-error-plus-abort probes now reject with `AbortError`, including the real filesystem-error path. The cancellation check runs before the unreadable-session fallback.
- **F-03 (`65ea614`, cache extraction `cce3889`):** [Document:87–90](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopRecallDocument.ts#L87-L90) computes a conservative serialized charge for retained header/entry data, including citation URLs. The original 8,222-character URL remains readable but never becomes a cache hit under a 1,000-character limit. Existing LRU, invalidation, and oversize-document tests pass.
- **F-04 (`970ed75`):** [Service:299–310](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L299-L310) rechecks scope after listing and before publishing; [cold reads:397–415](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L397-L415) check on both sides of the await. The copied-root and warm multi-root original races now refuse. Additional overlapping-call tests show an old-generation read cannot repopulate an invalidated cache or overwrite a newer-generation entry, and a final-publication scope change discards a warmed result. The ADR's away-and-back observation limit and the VS Code restart qualification remain explicit; no live cross-project exposure was demonstrated. Host lifecycle validation stays in Slice 3.
- **F-05 (`3b5b6e5`):** [Search:255–257](https://github.com/okeylanders/prose-minion-vscode/blob/c4527f4f585a082d0fc545888ea7c5b90dd62369/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallSearch.ts#L255-L257) keys equality on the exact projected entry. The original café/punctuation expectation now passes: two hits and zero lineage duplicates. Additional probes preserve differences in speaker, timestamp, citations, truncation, and private attribution; hidden-only differences still fold when the visible projection is identical.

The extracted corpus-selection helpers are behavior-preserving in the inspected diff and independent probes. Both new modules join the architecture witness, all nine production recall modules remain below 500 lines, and the service/renderer remain dormant. No capability enabling, mutation port, or live-provider call was added by the fixes.

### Fix-round verification actually run

All checks in this section target **`c4527f4f585a082d0fc545888ea7c5b90dd62369`**, before the re-review documentation commit. Local runtime remains **Node v24.19.0 / npm 11.9.0**. `AGENTS.md` and dependency manifests/lockfile are unchanged in the fix round; installed dependencies were reused. No fresh local `npm ci` was run.

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | **253 suites / 3,200 tests / 2 snapshots passed**, 82.647 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| ESLint over all 21 changed TypeScript files versus the epic base | **0 errors / 0 warnings** |
| `npm run lint` | Exit 0; **0 errors / 1,097 warnings** |
| `npm run build` | Both production bundles and `verify:bundle` passed; three webpack size/performance warnings, 1.24 MiB webview bundle |
| `git diff --check e5277bd...c4527f4` | Passed |
| Independent renderer/window checks | 36 existing tests passed; original aggregate regression repaired; 3,000 property-sweep renders passed; residual accepted-participant-file overflow reproduced |
| Independent service/cache checks | Six adapted original witnesses passed with current service/document tests (50 tests total); three further generation/publication probes passed |
| Independent search/contract checks | 66 existing tests across document/search/visibility/architecture passed; original F-05 probe passed; nine further probes passed, including assertions documenting residual edited-metadata behavior |
| Exact reviewed-head GitHub CI | Both `verify` runs passed: [PR run 37382855080](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37382855080), [push run 37382850210](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37382850210) |

Before publication, the remote integration branch advanced to `72762615` with only `.todo/epics/epic-workshop-session-recall-2026-10-05/slice-2b-transcript-todos.md` added. The implementation is unchanged by that target-branch advance, the merge-base remains `e5277bd`, and the reviewed PR head remains `c4527f4`. No source re-review was needed for that separate planning document.

Focused counts overlap the full suite; they are not additional unique production tests. Review probes were isolated from the publication checkout. The author's dual-runtime local runs and mutation-test counts were not independently repeated. No interactive VS Code, paid-provider, packaging, or release pass was performed.

**Next action:** finish the participant-metadata part of F-01, retain the now-passing regressions for F-02 through F-05, and recheck the complete rendered-output invariant. This re-review publishes only this report; the new documentation SHA needs its own exact-commit CI check. No implementation edit or merge is authorized by this review.

## Initial review evidence retained for history

The following narrative records what was observed at `b209080`, before the fixes. Its original verdict, verification, and requested actions are historical; the current ledger and fix-round verdict above supersede them.

**Initial verdict at `b209080` (historical): Request changes before integrating Slice 2.** F-01 through F-03 break the bounds this core promises, and F-04 breaks its explicit fail-closed scope contract. The existing suite and CI are green, but do not cover these counterexamples. There is no Blocking or High finding: recall remains dormant, and these are boundary-condition defects rather than evidence of a current writer-facing outage. F-05 is a lower-probability contract mismatch.

## F-01 — Enforce the composite read-output bound

**Evidence:** [WorkshopTranscriptRecallRenderer.ts:174–184](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts#L174-L184), [context-label header at :203–212](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts#L203-L212), and [WorkshopRecallReadWindow.ts:203–209](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopRecallReadWindow.ts#L203-L209). **Confidence: High.**

The header includes every context label before its cost is subtracted from the read allowance. There is no bound on that metadata block. When it exhausts the allowance, the packer passes a nonpositive number to `headOf()`. That helper clamps the number to zero, but `lastIndexOf(' ', 0)` returns `-1`; `-1 > -40` succeeds, so `slice(0, -1)` returns almost the entire entry. A zero-capacity window can therefore deliver far more text than a normal one.

This does not require bypassing the title limit or supplying a malformed session. The independent probe used the real aggregate, coordinator, store, and recall service over `MemoryFileSystem`:

1. Initialize a normal room and set open scope.
2. Add 1,300 accepted one-word text notes with 38-character labels. The total is 1,300 context words, below the 100,000-word allowance.
3. Add a 100,000-character writer message and a short reply, then save with the 12-character title `Normal title`.
4. Read the saved session through the real codec/store, reset the live room, and recall turns 2–3 with the default renderer options.

The persisted named-session file is 450,339 bytes. The rendered read is **152,617 characters**, against `readCharacters: 48_000`; `truncatedEntry` records **100,027 of 100,028** entry characters shown. A whole-session read also exceeds the allowance at **52,713 characters**, largely from the header. The oversized metadata case remains valid even without the negative-index defect, so fixing only `headOf()` is insufficient.

**Suggested correction:** budget and visibly truncate metadata as part of the complete result, reserving the framing, footer, and truncation notices. Return an empty head when capacity is zero, and require `space >= 0` before using a word boundary. If no entry text can be delivered, do not mark it delivered or advance its continuation past it.

**Regression witness:** cover metadata alone exceeding the default allowance, remaining entry capacity of 0–4 characters, and the aggregate/store round-trip above. Assert the complete `content.length`, not only the entry substring, and check `delivered`/`continuation` alongside it.

## F-02 — Charge failed cold parses to the search budget

**Evidence:** [WorkshopTranscriptRecallService.ts:297–315](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L297-L315) and [the read-error return at :328–342](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L328-L342). The real store reads, scans, and parses the file before a codec rejection in [WorkshopSessionStore.ts:664–700](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L664-L700). **Confidence: High.**

`parsedBytes` is increased only after `loadDocument()` produces a document. A read/decode failure returns an empty result, increments `unreadableSessions`, and continues without any charge. Files that retain healthy browser sidecars but have damaged or unsupported full envelopes therefore remain listed and consume parsing work without consuming the new budget.

The real-store probe saved three named sessions normally, preserved their indexes, and replaced each full file with valid JSON containing an unsupported schema version and 128 KiB of padding. With only `searchSourceBytes` reduced to 64 KiB for the test, one search read all three full files, consuming more than 384 KiB, and reported:

```text
sessionsSearched: 0
unreadableSessions: 3
parsedBytes: 0
notSearchedByByteBudget: 0
```

The session-count cap still limits attempts to 50, but the 64 MiB cold-parse bound no longer constrains failed files. This differs from the ADR's accepted one-file overshoot and from the separately disclosed legacy parsing inside `list()`: these are indexed files being read by recall itself. At default limits, repeated failures can consume many full-file reads before a successful document ever spends a byte of the budget.

**Suggested correction:** account for attempted cold-read work even when decoding fails. Prefer bounded byte metadata from the read boundary; if the store interface must remain unchanged in this slice, use an explicit conservative failure charge or stop further cold reads when their cost cannot be bounded. Preserve the unreadable count and make estimated versus measured accounting clear.

**Regression witness:** retain valid sidecars, corrupt or make the authoritative files unsupported, and assert that failed reads stop spending work once the budget has been reached. Include mixed healthy/corrupt files and cached documents; the latter should retain their zero cold-parse cost.

## F-03 — Count all retained strings in the document cache

**Evidence:** [WorkshopRecallDocument.ts:74–89](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopRecallDocument.ts#L74-L89), [reply search text at :104–105](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopRecallDocument.ts#L104-L105), and [cache admission/eviction at WorkshopTranscriptRecallService.ts:358–373](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L358-L373). **Confidence: High.**

`characters` counts search-visible text and its normalized copy, but the cached entry also retains each citation's complete `url`. Search text contains the citation label only. Those URLs are later rendered by a read and can dominate a document's retained text without affecting its cache charge. Attribution and identity strings are also outside the estimate; citation URLs provide the clearest large-field counterexample.

The real codec accepts a complete HTTP(S) URL without a length cap ([WorkshopSessionStateV1Shape.ts:670–678](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts#L670-L678)). The independent real-store test added a citation with the short title `Source` and an **8,222-character** URL to an ordinary saved reply, then constructed recall with `maximumCachedCharacters: 1000`. The first read was cold; the second returned `cacheHit: true` and retained the full URL. The small injected limit isolates the accounting error without allocating a production-sized corpus.

This is more than normal object-overhead approximation: an arbitrarily large retained string is charged as zero. The same formula governs the default 32 Mi-character cap. The document-count cap and 25 MiB source-file limit still apply, but do not enforce the promised text-memory bound across cached sessions. No production heap measurement is claimed here.

**Suggested correction:** conservatively count every retained string in the projected document, including citation URLs and metadata, separately from the text selected for lexical search. Avoid double-counting shared strings where practical, but prioritize an honest upper bound. A document larger than the cache allowance should remain readable without being retained, as the existing oversized-document policy intends.

**Regression witness:** exercise citation-heavy and metadata-heavy documents with a small injected limit and assert that oversized documents do not become cache hits; also retain existing LRU eviction/update tests.

## F-04 — Revalidate scope across asynchronous reads and cache publication

**Evidence:** [WorkshopTranscriptRecallService.ts:260–283](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L260-L283), [load and cache publication at :328–342](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L328-L342), and [cache identity at :345–363](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L345-L363). **Confidence: High for the core contract; current interactive VS Code cross-project exposure is not established.**

`recallCorpus()` captures the coordinator's scope before awaiting `list()`, then trusts it for the rest of the operation. Neither a returned catalog nor a later cold/cached read rechecks that the accepted workspace is still valid. The core [Workspace port explicitly requires live folder lookup](../../packages/core/src/platform/Workspace.ts), and the store resolves the current workspace again when `readNamed()` begins. An entry-point check alone is not a stable read scope.

Two real-store/core-port probes demonstrate the mismatch:

1. Warm a document, then add a second folder while the real listing is pending. When listing completes, store availability is `multi-root` and coordinator scope is `workspace-changed`, but recall returns `outcome: 'read', cacheHit: true`.
2. Prepare roots A and B with the same saved-session ID, as in copied working trees, but divergent visible text. Switch the dynamic workspace port from accepted A to B after A's listing completes. The subsequent real `readNamed()` reads B, and recall returns B's title/text despite `recallScope()` now refusing access. With equal `updatedAt`, restoring A still returns B's document from recall's cache.

**Important adapter limitation:** [VS Code documents](https://code.visualstudio.com/api/references/vscode-api#workspace.onDidChangeWorkspaceFolders) that changing the first workspace folder restarts executing extensions; `updateWorkspaceFolders` also documents possible restarts for workspace-mode transitions. Those restarts normally destroy this service/cache. The dynamic-port probes establish a host-agnostic core-contract defect, not a demonstrated current VS Code cross-project leak. No interactive host transition was performed. This qualification is why the finding is Standard rather than a claimed live High-severity privacy incident.

**Suggested correction:** capture a read scope and revalidate it after the listing, before/after asynchronous named reads, and before publishing results or inserting documents into the cache. Discard in-flight results when scope is no longer accepted. A stable workspace generation/token can make this explicit; do not solve it by flushing, initializing, or joining the mutation gate. Ensure invalidated in-flight reads cannot repopulate a cleared cache.

**Regression witness:** a deferred real-store listing/read whose scope becomes unavailable before completion, including a warm-cache read. Cover the copied-root case at the core port and separately validate actual host lifecycle behavior when the capability is wired.

## F-05 — Use exact visible content for lineage equality

**Evidence:** [WorkshopTranscriptRecallSearch.ts:243–267](https://github.com/okeylanders/prose-minion-vscode/blob/b209080588a5d8615521cfca3878b0d7a179ff3b/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallSearch.ts#L243-L267), especially the key at line 254. **Confidence: High; practical priority: Low.**

The ADR's refinement and the module comment promise that equal IDs are folded only when visible text is also equal. The implementation keys on `turnId` plus `searchText`, which has already discarded punctuation, accents, case, and some apostrophe distinctions. An independent test with same-ID turns `The café ending?` and `The cafe ending!` expects two hits and no lineage duplicate; it gets one hit and `lineageDuplicates: 1`.

This requires an ID collision or an externally edited copied session; normal immutable copies and branches still deduplicate correctly. It is not evidence that ordinary independent sessions routinely share IDs.

**Suggested correction:** compare exact projected visible text, and consider attribution-sensitive fields if they are part of the intended equality contract. Keep search normalization for matching/ranking only. Add a same-ID/different-punctuation-or-accent test beside the existing different-words collision test.

## Review observations and strengths to preserve

- **Visibility ownership is sound in the inspected paths.** Recall calls the same per-turn projection as export. The real saved-session sentinels remain absent from data and rendered output for attachment bodies, capability evidence, preview, retained provider archives, context bodies, excerpt text, and excerpt identity. The visible labels survive. Private instrument exchanges are marked according to the accepted policy; “private” does not mean excluded from recall under D4.
- **The core remains dormant.** There is no production caller of the new service or renderer, no new capability grammar or enabled prompt, and no persistence-enum widening in this delta. Missing Slice 3/4 wiring is not a finding against Slice 2.
- **The ports preserve the intended read-only direction.** The service has no write method, calls `list(undefined, signal)`, and validates requested IDs against the listing before an exact read. It does not call coordinator initialization, flush, or the session mutation gate. The concrete store's existing internal `current.json` browser summary remains a documented caveat, rather than a new direct recall read.
- **Coordinator behavior is preserved.** The extracted accepted-workspace predicate matches the prior assertion's conditions. `not-ready` prevents exposure under a provisional identity until initialization completes; focused coordinator tests cover the change.
- **Normal search semantics hold.** Unicode normalization, stop-word-only queries, prefix matching, all-terms preference and fallback, phrase/whole-word ranking, recency and turn ordering, per-session/total caps, and ordinary lineage deduplication agree with the documented rules in the inspected and executed cases.
- **Read addressing and provenance are thoughtfully separated.** The service retains 1-based ledger positions, including projection gaps, validates ranges, sorts/merges overlaps and adjacency, and leaves text packing to the renderer. Normal-budget reads report the delivered first/last turn IDs and continuation ranges. Timezone validation is upstream, and the renderer uses the saved session's timezone for its dates and day boundaries.
- **Architecture witnesses are stronger than string-only import matching.** The new compiler-API classifier covers static imports, re-exports, dynamic imports, and `require` in its pinned cases. Recall modules join the capability boundary and avoid value imports of the store/coordinator and the forbidden room-frame renderers. This is useful protection, not proof of every possible indirect dependency.
- **Diagnostic text is generally restrained.** Search logs counts, budget/cache data, and elapsed time rather than query/transcript bodies. Unreadable-session diagnostics include the ID and error message, following the existing store-error surface.

## Verification actually run

All production-code checks below target `b209080588a5d8615521cfca3878b0d7a179ff3b`, before this documentation-only report. Local runtime: **Node v24.19.0 / npm 11.9.0**. The cloud checkout reused installed dependencies after comparing the lockfile and package declarations with the earlier verified checkout: the relevant differences were workspace version metadata, not dependency versions. A fresh local `npm ci` was not run.

| Check | Result |
| --- | --- |
| Live PR metadata, branch tips, and local checkout | Matched reviewed head and base; PR open, non-draft, and mergeable |
| PR discussion and submitted review timeline | No existing comments/reviews returned at review start |
| `npm test -- --runInBand` | **252 suites / 3,176 tests / 2 snapshots passed**, 79.896 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| ESLint over the 18 changed TypeScript files | **0 errors / 0 warnings** |
| `npm run lint` | Exit 0; **0 errors / 1,097 warnings**. Baseline lint was not rerun, so no warning-delta claim is made |
| `npm run build` | Passed both production bundles and `verify:bundle`; three webpack size/performance warnings, 1.24 MiB webview bundle |
| `git diff --check e5277bd...b209080` | Passed |
| Independent document/search/visibility pass | 34 existing tests passed; isolated lineage expectation fails as expected (`lineageDuplicates: 1` instead of `0`) |
| Independent renderer/visibility pass | 36 existing tests passed; aggregate/store default-budget overflow reproduced and independently rerun |
| Independent coordinator/service pass | 71 existing tests plus 6 isolated adversarial witnesses passed; witnesses assert the observed defects rather than pretend they are fixed |
| GitHub CI for the exact reviewed head | Both `verify` runs successful: [pull-request run 37377811517](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37377811517), [push run 37377747219](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37377747219) |

The focused passes overlap the full suite and are not additional unique production-test counts. Experimental probes lived outside the publication checkout; no probe, source fix, dependency change, or generated bundle is included in this review commit. The read-output counterexample uses default production limits; the cache and failed-parse probes deliberately reduce their respective limits to demonstrate the same accounting defects without large allocations.

The author's local Node 18/22 dual-runtime and mutation-testing claims were not independently repeated. Current GitHub CI uses Node 18 and passed. No paid provider calls, live-model acceptance, Extension Development Host interaction, visual/accessibility pass, VSIX packaging, or release validation was performed.

## Scope boundaries and next verification

Governing material included `AGENTS.md`, the complete production/test delta, the [recall ADR](../adr/2026-10-05-workshop-session-transcript-recall.md), [epic](../../.todo/epics/epic-workshop-session-recall-2026-10-05/README.md), recent PR #122/#124/#125 house reports, the store/codec/workspace implementations, transcript projection, existing capability/run cancellation seams, and CI configuration. No checkout-local `.agents/skills` directory or review template was present.

The following are intentional later-slice work or accepted design choices, not new defects:

- Codec ownership of query length, session-ID shape, and range count; the core rejects malformed numeric ranges rather than repairing them
- The `resultLogSummary` exhaustive recall case carried forward from PR #125
- Capability/persistence/contract wiring, prompts, publication policy, and save-and-reopen acceptance
- The documented approximate source-byte accounting and one-file overshoot, uncounted legacy parses inside the browser listing, and legacy files above its 5 MB limit being omitted
- Live-corpus latency and budget tuning, model session-ID reliability, and default-window product acceptance

Cancellation concurrent with a final read error also returned `unreadable` rather than `AbortError` in a real-filesystem-error probe. It is not a separate requested-change finding here: the planned caller is not wired, and the existing agent-run layer has further abort checks before committing history. Preserve cancellation coverage when integrating the adapter.

The initial review requested: resolve F-01 through F-04 with regression witnesses, rerun the full checks, and refresh the reviewed head. F-05 can be considered separately as a low-priority exactness fix. This review changes only this file under `docs/pr-reviews`; the resulting documentation commit has a new SHA and its exact-commit CI must also pass before any merge. No merge, branch deletion, or implementation change is part of this review.
