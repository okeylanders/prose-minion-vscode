# PR #226 review: Persona File Edits specification

**Latest disposition: five of six blocking contracts are closed at specification level. F-04 remains open after independent re-review of `494a17d3`; see the final section below.**

**Initial disposition at `0ed3ba75`: six blocking contracts required correction.** This reviews a documentation-only design, not an implemented feature or permission to merge.

- PR: [#226](https://github.com/okeylanders/prose-minion-vscode/pull/226)
- Reviewed head: `0ed3ba75ec9feea84c491e73a3510619556890c7` (`epic/workshop-persona-file-edits-slice-0-spec`)
- Base: `b4ca7b86a03887436cfb6f2b32870074e0807b8b`
- Reviewed: 2026-11-05
- Scope: all five changed documents, resource identity/containment, approval and concurrency, memory-edit precedent, document/applier contracts, persistence and the proposed autonomy seam.
- Before beginning, the PR had no existing review/comment and its tree had no #226 review report. Only review artifacts are added by this review.

## F-01 (P1): A whole-file rewrite needs a reviewed baseline

**Anchor:** [D2 rewrite](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L68-L76) and [D4 live planning / D7 stale](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L113-L118).

The only stale test is an exactly-once quote match, but `rewrite` contains no quote. The request and persisted proposal contain target/operations/source, not the before-image or fingerprint of the file being replaced. Applying against whatever happens to be live makes the applier's `original` equal to the writer's latest buffer; its version check protects only the short apply interval.

Example: a card proposes rewriting a character note about Paris. The writer changes the note to London while the card waits. Apply rereads London, plans a whole-body replacement, and the unchanged applier accepts Paris. The card explicitly shows only the rewrite's new text, so the writer does not review the loss of the intervening change.

This is the guard the memory-edit path already has: [staging records both before and an edit token](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/workshop/memory/WorkshopReplyMemoryEdit.ts#L80-L94), and [update rejects a changed token](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L205-L229). Reusing only its grammar drops that protection.

**Required correction:** bind a destructive rewrite to a host-captured baseline at staging/review, persist its fingerprint or equivalent expected body, and refuse if the overwritten content changed before commit. Show its before/after diff. Specify the baseline for proposals made without a complete file read and the freshness rule for append/prepend, which also have no `find`. Do not reject unrelated edits outside a replacement quote unless that is the chosen product rule.

**Acceptance:** pending rewrite + unsaved edit, save/reopen, and imported/reopened session cannot overwrite a changed body without a new review. The attached contract probe demonstrates the current applier accepts a rewrite when the gateway supplies only the live original; this is a missing upstream precondition, not an existing applier defect.

## F-02 (P1): Fresh catalog lookup must not retarget the proposal to another workspace file

**Anchor:** [D4.2](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L106-L112) and [D8 target storage](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L174-L178).

`{group,path}` is a display/catalog address, not a durable document identity. The [resolver iterates roots but deduplicates by relative path alone](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L100-L153); its [key also folds case](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L216-L217). With roots A and B both containing `characters/alice.md`, only the first root's candidate survives. Remove or reorder A before Apply and the prescribed fresh lookup can now name B. An append/rewrite needs no quote; even a replace can find the same sentence in both copies. The version guard starts after the target has already changed.

**Required correction:** resolve and retain a host-owned workspace/document identity when the proposal is staged. At Apply, refresh authorization/catalog membership but require the same identity. Reject ambiguous targets instead of inheriting a first-root winner. Bind `excerpt` to the excerpt/document identity and revision that produced the proposal, rather than whichever excerpt the room has later. Recheck identity across catalog/open awaits and immediately before dispatch. Root-qualified identity must survive session storage without trusting a model/webview URI.

**Acceptance:** equal relative paths in two roots, root removal/reordering, nested roots, context-path changes, room/excerpt replacement and session reopen must either edit the original authorized document or refuse. They must never select a different file because its contents happen to match.

Containment is not absent: the current resolver checks lexical containment and rejects symlink segments below the workspace root ([existing implementation](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L225-L259)). Preserve those checks; they do not solve identity drift.

## F-03 (P1): Select prose protection by file identity and all memberships, not the chosen group

**Anchor:** [D5 policy table](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L126-L138).

The read catalog does not establish mutually exclusive semantic classes. [Its first matching group wins](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/infrastructure/context/ContextResourceResolver.ts#L102-L153), and [characters/locations/themes/things precede chapters/manuscript](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/shared/types/context.ts#L5-L13).

With characters configured as `**/*.md` and chapters as `chapters/*.md`, `chapters/one.md` is retained as a character resource. D5 then permits whole rewrites, Markdown changes and unlimited replacement of a chapter. There is also a physical-file alias with nested roots: roots `/book` and `/book/chapters` can expose the same file as chapter `chapters/one.md` and general `one.md`. Selecting the general address must not remove prose safeguards. An excerpt document reached through a note alias has the same problem.

**Required correction:** aggregate configured memberships by the host-resolved document identity, retaining information the read catalog currently discards. If any membership is chapters/manuscript, or the file is the protected excerpt target, the prose policy wins for every alias. Alternatively, explicitly reject ambiguous classifications. Do not let the trailer's selected group determine destructive permissions.

**Acceptance:** overlapping notes/prose globs, nested-root aliases, and excerpt aliases cannot obtain note-policy rewrite/structure permissions. Normal note-only files still get their intended operations.

## F-04 (P2): Define the host apply claim, duplicate behavior and uncertain outcomes

**Anchor:** [D7 actions, states and correlation](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L157-L170) and [Slice 4 contract](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/.todo/epics/epic-workshop-persona-file-edits-2026-11-05/README.md#L28-L30).

A webview request id matches an answer to a UI action; it does not make a mutation run once. An append remains valid after it has already landed. Two Apply requests can both observe `pending`, await catalog/open work, then plan sequentially against live text and append twice. Discarding an old-room answer also cannot undo a write already dispatched after a room change.

The existing [memory handler takes a per-card in-flight claim before the first await](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryHandler.ts#L120-L126) and joins duplicate requests. [Memory writes separately bind the workspace through the commit point](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/workshop/memory/ProjectMemoryWrites.ts#L442-L466). Those are distinct from #221's reply correlation.

The proposed states also omit an uncertain write: [the applier returns `unknown`](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L113-L138), and a closed Refactor Preview lifetime can still write under the [documented VS Code limitation](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L30-L43). Such a result must not become a safely retryable `refused` card.

**Required correction:** specify a host-owned claim keyed by room/proposal identity before any await, joined duplicate requests, terminal-state replay behavior, ordering with Decline and room/session replacement, and shutdown/in-flight settlement. Resolve operations from the host's stored proposal. Recheck current authority at the last dispatch boundary. Define partial and unknown outcomes per operation, with no blind retry after uncertain application; preserve the existing preview-lifetime limitation explicitly.

**Acceptance:** double Apply (same and different request ids), Apply/Decline races, room replacement while catalog/open is paused, partial preview selection, close during preview, and reopening an applied/unknown card produce one truthful receipt and no duplicate edit.

## F-05 (P2): The unchanged Markdown guard rejects the paragraph operations D5 allows

**Anchor:** [D4 unchanged checks](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L116-L118) and [D5 line-break/structure policy](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L130-L134).

`allowsNewlineChanges: true` does not make `editsChangingStructure` permit paragraph changes. The [shape comparator preserves paragraph and whitespace token structure](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/utils/draftEdit/markdownStructure.ts#L130-L181), in addition to headings, lists and links.

Running the exact-head production function on synthetic Alice text gave:
- split one paragraph with a blank line: refused;
- merge two paragraphs: refused;
- append a new paragraph: refused;
- prepend a new paragraph: refused;
- replace a space with a single newline inside one paragraph: allowed.

Therefore the principal append/prepend and paragraph-revision behavior cannot be built by passing the advertised two booleans into the unchanged guard.

**Required correction:** decide precisely which Markdown structures file edits preserve. Add an explicit policy/validator seam that permits the intended prose paragraph changes while retaining the required heading/list/link/protected-content invariants, or narrow the product contract. Keep Proofread's existing strict behavior unchanged. Put this work and tests in Slice 2, not an unspecified later fix.

**Acceptance:** each intended paragraph edit succeeds; transformations into headings/lists/code/links and target changes remain refused as specified; existing Draft Edit tests retain their expectations.

## F-06 (P2): The rewrite ceiling must be checked again on a direct retry

**Anchor:** [D4 planner then unchanged applier](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L113-L118) and [D5 rewrite ceiling](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/docs/adr/2026-11-05-workshop-persona-file-edits.md#L134-L138).

The applier's policy currently [contains only newline and Markdown-structure booleans](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L56-L64). Its [direct retry](https://github.com/okeylanders/prose-minion-vscode/blob/0ed3ba75ec9feea84c491e73a3510619556890c7/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L142-L147) reruns its own checks without returning to the gateway or shared planner. A ceiling enforced only in step 4 does not cover the actual retry.

Exact-head probe: an 18-character quoted sentence is 18% of a 100-character paragraph. While the first apply is in flight, the writer deletes the other 82 characters without touching the quote. The applier retries at version 4 and replaces the remaining sentence in full. It reports applied, although the edit now rewrites essentially the entire touched paragraph, above D5's 60% ceiling.

**Required correction:** every actual write attempt must rerun all live-text-dependent file policies, including the ceiling and relevant size limits. Supply a policy validation seam to the applier, or disable its internal retry for this gateway and handle retries through the full validation path. Define the ceiling's numerator/denominator, aggregation across operations and paragraphs, insertion treatment, and exact word-count bound so the policy is testable.

**Acceptance:** pause the first apply, shrink a touched paragraph outside the quote, and verify the over-ceiling retry writes nothing. Include a control where unrelated edits leave the ceiling valid.

## Other corrections and explicit limits

- **N-01: D8 does not yet record enough for D10 Revert.** It retains the new text, not the old body of a rewrite. A deletion also produces an empty new-text anchor, which cannot be found exactly once. Before freezing the persisted shape, either record before/after text plus a bounded contextual anchor and target identity for each landed operation, or explicitly narrow the future Revert promise. Partial application and protected-region/policy changes need refusal semantics. This is a persistence decision now; it does not ask for autonomous editing or Revert in this epic.
- **N-02: Notes rewrite is conditional under the existing protected-region guard.** A whole-body replacement spanning inline code/link targets is refused even if that syntax is unchanged in the replacement. The probe retains `tea` verbatim as inline code and still receives `protected`. State this limit, or define minimal non-overlapping edits that preserve protected bytes. Never weaken the protection to make rewrite pass.
- **N-03: Correct the shared-write-path summary.** D3 correctly migrates only memory's pure planner with no behavior change. Existing project-memory writes use `ProjectMemoryWrites` and the claimed storage path, not `DocumentEditor`. The epic goal and Consequences currently say memory edits also share the single unsaved document write path. Say shared operation/planner vocabulary, separate memory persistence, and a shared document applier for Draft Edit and persona file edits. Do not accidentally migrate memory saves to dirty buffers.
- **Preview is not direct Apply.** Keeping both actions is reasonable, but the card state/receipt must reflect the ticked subset and the known VS Code close/language-change limitation. No unsafe global preview-discard command should be introduced.
- **Approval remains explicit in v1.** The `auto` seam is acceptable as future scope only. Keep it unavailable to model/webview inputs; the later feature must choose its authorization policy independently.
- **Bounded input and logging:** name limits for target bytes, replacement/frame bytes, operations and `why`, including malformed/disabled trailers, and test error logging with synthetic text sentinels. A five-file cap alone does not bound work.

## Validation and publication scope

- Reviewed the full five-file PR patch and relevant exact-head source. No product file was changed.
- Ran the production `editsChangingStructure`, `DraftEditApplier`, and `FakeDocuments` fixture code fetched at the reviewed SHA, using TypeScript transpilation and the existing dependency installation (Node 24.22.1, marked 16.4.1).
- Eight compatibility/precondition witnesses passed their expected assertions: four rejected paragraph operations; a permitted single-newline control; the ceiling-bypassing retry; a live-original-only rewrite; and protected-region refusal for a broad rewrite. These establish current contracts, not tests of a file-edit implementation that does not exist yet.
- [Probe source](probes/pr-226-persona-file-edits-contract-probe.cjs.txt) and [observed output](probes/pr-226-persona-file-edits-contract-results.txt) are committed beside this report.
- Remote CI for reviewed head `0ed3ba75`: [run 42118334704](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42118334704), completed successfully when checked.
- Full repository typecheck/lint/Jest and live Extension Development Host acceptance were **not rerun** for this documentation-only review. Green existing CI does not establish the new design contracts.
- Publication adds only this report and probe evidence. No merge, product implementation, or work on deferred #205 is part of this review.

## Implementation handoff

Resolve F-01–F-06 in the ADR and slice acceptance criteria first. Slice 1's pure planner extraction can preserve existing memory behavior independently, but Slices 2–4 must not invent different answers to identity, approval, freshness or retry rules. The repair should be re-reviewed as a spec change; implementation and live acceptance remain separate gates.

## Resolution ledger (coordinator, 2026-11-05)

| Item | Disposition |
|---|---|
| F-01 | **Settled in ADR D6.** A content SHA-256 baseline is taken at staging and checked on every attempt; the rewrite's before/after is served by the host only while the baseline holds; append and prepend are fresh by rule and land once under D8's claim. Acceptance: Slice 2 (gateway) and Slice 4 (session reopen). |
| F-02 | **Settled in ADR D4 and D7.** The resolver gains an every-candidate read; ambiguity is refused as `ambiguous-target`; the identity is a host-written `documentUri` (the excerpt-source precedent), re-authorized at Apply and checked at the last dispatch boundary; an excerpt is bound to the document it was staged from. |
| F-03 | **Settled in ADR D5.** The class is decided by every membership through every root, plus excerpt documents, and recomputed at Apply; the trailer's group only locates the file. |
| F-04 | **Settled in ADR D8.** A host claim keyed by `(liveSessionId, turnId, index)` is taken before any await; duplicates join; Decline and terminal states replay; `applying` is flushed before dispatch and read as `unknown` on reopen; `partial` and `unknown` states; no blind retry; no preview command; shutdown does not await claims. |
| F-05 | **Settled in ADR D5.** The applier gains `structure: 'strict' \| 'prose-paragraphs' \| 'free'` in place of `preservesMarkdownStructure`. `strict` is unchanged for Proofread and Craft Flags. Built and tested in Slice 2, against this review's four paragraph witnesses. |
| F-06 | **Settled in ADR D5 and D7.** The ceiling is defined exactly (replaced characters over touched blank-line paragraphs, a 300-character floor, insertions excluded and bounded by words), and the applier runs `revalidate` on every attempt, its retry included. Acceptance: this review's shrink-the-paragraph witness writes nothing. |
| N-01 | **Settled in ADR D10 and D12.** Bounded `landed` records (before, after, 80-character context, `versionAfter`); oversized operations record hashes only and are not revertible; Revert's refusals are stated. |
| N-02 | **Settled in ADR D5.** A notes rewrite over protected syntax is refused with a reason asking for replace edits; minimal-edit conversion is deferred. |
| N-03 | **Settled in ADR D3, Consequences and the epic Goal.** The vocabulary is shared; memory persistence is separate; the document write path is shared by Draft Edit and persona file edits only. |
| Preview, `auto`, bounds and logs | **Settled in ADR D8, D11, D12, D2 and D13.** |

## Independent re-review at `494a17d3` (2026-11-05)

**Disposition: five of six blocking findings are closed at specification level. F-04 remains open with a narrower lifecycle correction.** The coordinator's ledger above describes the intended repair; this section records the independent review of that repair.

### Closed contracts

- **F-01 closed:** D6 establishes a host baseline, a stale rewrite refusal and a host-served before/after review. Append/prepend freshness is now an explicit product rule, with duplicate prevention delegated to the claim.
- **F-02 closed:** D4 retains every resolver candidate, rejects ambiguity, binds the host-owned document identity and excerpt source, and D7 reauthorizes that same identity. Persisted target identity no longer depends on a new display-key lookup.
- **F-03 closed:** D5 derives prose rules from all memberships and excerpt identity, then recomputes at Apply. The selected trailer group no longer grants the permission.
- **F-05 closed:** D5 adds explicit strict/prose-paragraphs/free modes, preserving Proofread's strict behavior and assigning the new validator to Slice 2.
- **F-06 closed at contract level:** D7 requires the live policy callback on every attempt. D5 now defines the numerator, denominator and insertion bounds. **Update the acceptance fixture:** the newly chosen 300-character floor means the original 18-character witness should now be allowed. Use a quote over 300 characters for the shrink-the-paragraph refusal test, and retain a below-floor control. The coordinator ledger's claim that the original witness must write nothing contradicts the new floor.
- **N-01–N-03 closed:** bounded before/after/context receipts and narrow Revert scope are specified; notes rewrite explicitly refuses protected syntax; memory's persistence remains separate.

These close design contracts, not implementation verification. No claim is made that the new services, validators or durable receipt logic exist yet.

### F-04 remains open: a claim needs a verified durable checkpoint and a complete per-attempt authority fence

**ADR anchors:** [D7 dispatch and retry](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/docs/adr/2026-11-05-workshop-persona-file-edits.md#L260-L271), [D8 applying flush and checks](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/docs/adr/2026-11-05-workshop-persona-file-edits.md#L297-L308).

The in-flight claim, joined duplicates, terminal replay, partial/unknown states and no-preview-discard rule address the original core concerns. Three precise details still matter at the existing seams:

1. **Awaited `flush()` does not prove that `applying` was saved.** [`WorkshopSessionPersistenceCoordinator.flush`](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L607-L619) returns `Promise<void>`. Its queued autosave can [skip an unavailable store, defer at an active run, or catch a write failure and resolve](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L558-L602). With those behaviors, the proposed handler can await flush, dispatch an append, then reload an older `pending` checkpoint and offer Apply again. The durable `applying` marker that is supposed to prevent this never existed.

   **Correction:** give the pre-dispatch checkpoint an explicit success result bound to this session, room generation, proposal and required revision. Refuse dispatch unless that exact `applying` state is known durable. A caught error, unavailable store, deferred capture or unresolved revision must not count as success. Specify which recoverable checkpoint carries the marker, including named/current mirror failures.

2. **A session id and matching turn are not the room's lifetime.** Reopening or importing the same saved session preserves those ids. The repository already has [`readRoomRevision()`](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1292-L1295); [reset](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L2049-L2052) and [import](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L2363-L2366) mint a new generation. D8's enumerated checks only require the same session id and a turn still in the ledger, so an old action waiting on catalog/open/flush can continue into a newly opened copy of that session.

   **Correction:** capture the room generation at the action, use it in `stillCurrent` and claim/outcome ownership, and reject after any replacement even when session/turn/card ids happen to match.

3. **The authority check must cover the applier's second dispatch.** D7.5 checks the handler's `stillCurrent` before calling the applier. D7.6's `revalidate` enumerates only text freshness, ceiling, insertion bounds and structure. The first `applyEdits` awaits the host; the room, setting or authorization can change before the [applier's internal direct retry](https://github.com/okeylanders/prose-minion-vscode/blob/494a17d380976a5796b64e395d420bb7eddf22d6/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L122-L147). Revalidating text alone can still dispatch another write after the user turned the feature off or replaced the room.

   **Correction:** repeat the synchronous current-authority predicate immediately before every actual `applyEdits` attempt, including the retry, alongside the live-text checks. It should cover the claim, captured room generation, current setting and the authorized identity/class epoch. Preserve the already documented limit for an existing Refactor Preview; this does not authorize cancelling someone else's preview.

**Acceptance cases to add to Slices 2 and 4:** fail/defer the `applying` checkpoint and assert zero document writes; reopen the same session while catalog/open/flush is paused and assert zero old-action writes; return `stale` from the first document attempt after switching the setting off or replacing the room and assert no second attempt. Include successful checkpoint/current-room controls.

### Re-review verification

- Read the complete revised ADR, epic acceptance criteria and coordinator resolution ledger at `494a17d380976a5796b64e395d420bb7eddf22d6`.
- Inspected the exact-head persistence implementation, room-generation mechanism and unchanged applier retry path to verify the remaining lifecycle contract.
- This revision is documentation-only. No product edits, implementation tests or live-host acceptance were performed.
- CI for `494a17d3` was still in progress when this re-review was prepared: [run 42122262687](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42122262687). Its eventual result is separate from the specification disposition.

**Concurrent amendment checked:** `34d14985` clarifies that emphasis may change and counts changed characters after a common-prefix/suffix trim for the ceiling. It does not change the remaining F-04 lifecycle issue. CI for `494a17d3` subsequently completed successfully (run 42122262687).
