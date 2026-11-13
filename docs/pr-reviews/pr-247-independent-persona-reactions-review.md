# PR #247 independent review: persona reactions

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/247
- Reviewed implementation: `b7c9419f05fc1d2b5b2256cb3e962afc51998421`
- Base: `98641f20c1cf9023ebecc3f376b9bb0f01f1090b` (`epic/workshop-message-reactions`)
- Date: 2026-11-07
- Verdict: **Approve with nonblocking follow-ups.** No new merge-blocking defect found in this slice. This is a review recommendation, not a merge or a claim about unrun live-model validation.

## Existing review reconciled

Read the committed [coordinator's review and resolution ledger](workshop-message-reactions-slice-3-persona-reactions-review.md) before reviewing the implementation. GitHub's review submissions, inline threads, and PR discussion were empty when checked.

- **M1:** Confirmed the live commit now names only a reaction that actually lands. Reactions-off, unknown, no-target, and session-full paths produce the neutral no-message turn when nothing else remains. `noMessage` and `reactionOnly` are excluded by the writer's shared reactability predicate; a no-message turn cannot carry a persona reaction in persisted integrity checks.
- **M2:** Confirmed the announcer compares room revisions and the previous snapshot's turn ids, clears pending live replies on the next snapshot, and does not announce an Open that reuses a turn id. The real-App tests exercise these cases.
- **L1/L3/L4/N1/N2/N4:** Confirmed the ledger outcome is logged rather than guessed, the prompt quotes retention's host line, the line names the writer's message, optional marks are absent when unused, commit types follow imports, and a guest's target uses the guest's author identity.
- **L2:** Still a product decision: Hide removes the chip, but the reaction-only line keeps its glyph. This is explicitly allowed by the current ADR and codec. This review does not choose a different behavior on Okey's behalf.
- **N3:** `STREAM_COMPLETE` does not overwrite the streaming bubble with the host line. No new host-line flash was found in that path.

## Integration and persistence inspected

- The extension's composition root binds the live persona-reactions setting into `AssistantToolService`; the shared prompt-path builder includes the permission for host and guest only while enabled. `MessageHandler` routes external setting changes through the serialized settings service.
- Host messages, guest joins/continuations, and tool syntheses use the production completion boundary. The reaction targets the run's own writer turn, commits with the reply through the reaction ledger, and uses that reply's id as `viaTurnId`. Syntheses have no target. Stopped, superseded, and rejected zombie completions do not add a reaction.
- The single trailer extractor handles reactions alongside memory and file-edit trailers. The same grammar drives redaction, retained-history stripping and streaming suppression; the reserved-frame neutralizer covers the new tag. Mixed trailer orders, malformed/unknown ids, and the one-reaction cap are tested.
- The new optional turn fields are admitted by the persisted shape validator and checked against allowed participant/artifact combinations. Clone/export/hydration paths preserve them. Rewind uses the existing shared transform that prunes a reaction when either its target or carrying reply is removed. The reaction-only host line remains available to transcript projection.
- The new slim line retains the turn identity and bookmark/Rewind/Branch actions while omitting the reaction palette. The announcer is a separate polite live region, keyed for repeated identical announcements.
- The widget-rejection extraction was checked against the base implementation; the copied messages and decisions are unchanged. The architecture guards remain in the test gate.

## Nonblocking finding F-01: last persona-chip Hide loses keyboard focus

**Severity:** Low / P3. **Scope:** inherited from Slice 1, now exercised by Slice 3's generated persona reactions. The fallback is identical on this PR's base, so this is not a new implementation regression and does not block this slice.

**Location:** [`WorkshopTurnReactions.tsx:85-102`](https://github.com/okeylanders/prose-minion-vscode/blob/b7c9419f05fc1d2b5b2256cb3e962afc51998421/packages/core/src/presentation/webview/components/workshop/reactions/WorkshopTurnReactions.tsx#L85-L102).

When the focused Hide button removes the last persona reaction on a writer message, the next snapshot removes the chips container. Focus recovery first looks for another chip, then for that turn's Add reaction button. Writer messages intentionally have no Add reaction button, so neither target exists and focus remains on `document.body`. Keyboard users lose their place in the thread.

A focused real-`WorkshopApp` characterization test reproduced the sequence:

1. Deliver a snapshot containing a writer turn, its reaction-only reply, and Jill's heart on the writer turn.
2. Focus and activate `Hide Jill's heart`.
3. Deliver the same room with no reaction summaries.
4. Assert that the writer turn has no Add reaction button and `document.activeElement === document.body`.

**Recommended follow-up:** fall back to the same writer bubble (already programmatically focusable) or one of its stable actions after the last chip disappears, while continuing to avoid stealing focus if the user moved it meanwhile. Cover the last persona chip and a remaining neighboring chip in the regression test. Tracked in [.todo](../../.todo/tech-debt/2026-11-07-persona-reaction-hide-focus.md).

## Verification

**Exact reviewed implementation, GitHub CI:** both push and pull-request `verify` checks succeeded on `b7c9419f`. Inspected the completed job and its logs, not just the PR summary.

- [PR CI run 42404262795](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42404262795): typecheck, tests, lint, and both webpack bundles completed successfully.
- Jest: **815 suites, 11,411 tests, 59 snapshots passed**.
- Lint: **0 errors, 1,171 warnings**. The build succeeded with three webpack warnings; this is not a warning-free claim.
- [Push CI run 42404258394](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42404258394) also succeeded.

**Independent local checks, Node 24.22.1:**

- `npm run typecheck`: passed.
- `npm run lint`: passed with the same 0 errors / 1,171 warnings.
- The real-App persona-reaction tests plus the F-01 characterization: 6 tests passed.
- Two extra aggregate-hydration witnesses passed: enabled reaction-only replies preserve their reaction and mark; disabled replies preserve `noMessage` with no reaction. Hide followed by export, JSON decode and hydration preserves the absent chip and the existing reaction-only mark.
- The temporary characterization tests were not committed as assertions that the focus defect is desired behavior.

No live model calls, visual Extension Development Host pass, or screen-reader session was run. Reaction frequency and tone tuning remain Slice 4's explicitly deferred live pass. This review publishes no runtime changes and does not merge the PR. Any CI started by the documentation-only review commit is separate from the verified implementation checks above.
