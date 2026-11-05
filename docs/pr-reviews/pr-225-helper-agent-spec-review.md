# PR #225 review: Helper Agent specification

## Verdict

**Approved at specification level at `a02d785daa902f0af84b18163e07fcd9c548b044`. No blocking finding.**

The proposed separation is compatible with the repository: a capability-free helper proposes bounded data, Workshop owns the source and sheet lifecycle, and the existing memory writer remains the only path that saves it. The implementation must still prove the acceptance checks below. This is not approval of unimplemented code, a formal self-APPROVED GitHub review, or permission to merge.

- PR: [#225](https://github.com/okeylanders/prose-minion-vscode/pull/225)
- Head branch: `epic/helper-agent-slice-0-spec`
- Base: `epic/helper-agent`, `b4ca7b86a03887436cfb6f2b32870074e0807b8b`
- Reviewed: 2026-11-05
- Scope: both changed documents, 243 added lines; model-scope integration, composition boundaries, source privacy, memory validity, asynchronous ownership, and verification requirements against the existing implementation.
- Duplicate-review check: the PR had no review submissions or conversation/inline comments when this review began, and no report for this PR existed in the checkout.

## What reviewed cleanly

1. **One engine, task-specific policies.** D1 keeps prompts, codecs and budgets with each policy rather than branching the engine. The prompt/example/production-codec sync test is the right contract. A new task still needs its own validation and budget; the registry is not permission to accept arbitrary task names or arbitrary model output.
2. **The helper cannot save a memory.** D2 and D4 explicitly deny tools, capabilities, file access and imports from the Workshop, Lightbox and Draft Edit implementations. Construction in `extension.ts`, delivery through `CoreServices`, and a boundary test match the existing composition-root rule. `PROJECT_MEMORY_KINDS` and field bounds already live in shared definitions; consuming those does not require importing a Workshop handler or memory store.
3. **The selected model can follow Proofread.** `ModelScopeSelections` already resolves a followed scope until an explicit selection exists. Adding `helper` to that path, its resource bundle, watcher and Settings row is consistent with the current architecture. The epic also requires `MODEL_DATA` selections end to end. No change to persisted `TokenUsage` fields or a reasoning setting is requested.
4. **The host is the source authority.** A request identifies a turn rather than submitting arbitrary text. Saved turns can be read through recall's existing `savedTurn` seam, which refuses an ambiguous saved-session identity. The proposed safe projection avoids expanding the helper into a workspace reader.
5. **Writer control remains visible.** Automatic drafting is the stated product choice, not automatic saving. Drafted title, summary and kind remain editable; touched fields win, the body is not replaced, and failure leaves manual completion possible. Proposal-card Edit is explicitly excluded. The disabled setting must make zero provider calls.
6. **The future task is correctly deferred.** D6 does not authorize a v1 workspace scan, setting change or model capability. A later project-locations slice will need its own containment, symlink, budget and preview tests before it is built.

## Implementation acceptance checks

These are concrete checks for Slices 1 and 2, not demonstrated failures in this documentation-only PR. The proposed design has enough seams to satisfy them without changing its direction.

### A-01: preserve the safe source, eligibility and exact input bound

**Spec:** [ADR D2 and D5](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L55-L62), [D5.1–2](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L92-L101).

- Read live sources through the host's safe turn projection, and saved sources through recall's `savedTurn` plus the same named preview fields. Do not hand the helper a raw `WorkshopTurn`, saved session document, attachment body, widget payload, capability evidence or conversation archive.
- `projectWorkshopTranscriptTurn` deliberately projects a capability card to a safe **event**, and `WorkshopRecallSavedTurn.bookmarkable` carries the original turn's eligibility. Admit an eligible capability bookmark using that fact; do not resurrect PR #219's event-kind rejection or admit every session event.
- Bound the **input** as well as the reply. `workshopMemoryNoteFromTurn` trims and caps the sheet body at `PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters` (8,000 UTF-16 code units). Prove the actual provider request matches the bounded source intended by D5, including the out-of-window live bookmark path.
- Test forged/unknown IDs, ambiguous/unreadable saved sessions, non-bookmarkable markers, a saved source that becomes live during the read, and private-field sentinels. All refusals must produce no model call and no write.

### A-02: bind reads and answers to the originating sheet and room

**Spec:** [D5.1–4](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L92-L106).

- A request ID correlates an answer but does not identify a room lifetime. Preserve the room revision for live sources, including a bookmark outside the window, rather than silently resolving a stale turn against a replacement room. Existing preview handling checks the request's `roomRevision`; existing saved-memory writes capture a revision before their first awaited source read.
- Test same-ID reopen and Rewind, not only a change to another session ID. Test an awaited saved-turn read across workspace/room changes and reject stale work before dispatch where possible.
- In the UI, give every sheet opening a fresh draft request owner. A late or duplicate result after Close, another opening of the same turn, switching to New/Edit, successful Save, or unmount must change nothing. Decide explicitly how an in-flight Save freezes the draft so the shown fields cannot diverge from the submitted snapshot.
- A preview arriving late for an out-of-window bookmark must not overwrite helper fields already accepted or restart a request for a displaced sheet.

### A-03: treat touched fields as history, and retain the current Save rules

**Spec:** [D5.4–5](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L105-L111).

- Track title, summary and kind independently. Typing and then deleting back to empty still counts as touched; changing kind and returning to its default still counts as touched. Programmatic helper fills must not mark untouched fields as writer edits.
- Apply a result against current state, not a state captured before the model awaited. Pin simultaneous typing/result delivery and partial fills.
- Keep the body, supersession list, pin toggle and source/provenance unchanged. Also test a body edited while drafting: the answer must never restore the original body.
- “Save stays available” means drafting adds no new lock; it must not bypass `checkWorkshopMemoryDraft`, pinned-budget refusal, loading, or an in-flight save. The existing sheet deliberately disables Save while required fields are empty or invalid.

### A-04: validate the whole output contract, not only lengths

**Spec:** [D1's codec](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L43-L53), D2, D5.2.

- Require the exact title/summary/kind shape and a known kind. Title and summary must satisfy the existing nonempty, single-line and character rules, including controls and Unicode line/paragraph separators, as well as the 120/280 UTF-16 limits.
- Keep the prompt's allowed kinds, limits and worked example synchronized with production validation. Do not duplicate a different set of numbers in the helper.
- Distinguish the repository's structural `parseModelJson` decoding from semantic invention or truncation of rejected field values. Malformed/out-of-bounds answers should take the promised failure path, not become a silently repaired memory suggestion.

### A-05: own the timeout, cancellation, usage and following-model lifecycle

**Spec:** D3, D4 and [D5.6](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L112-L117).

- Set a finite timeout explicitly. `AgentRunEngine.abortSignal` has no default timeout; it only starts a timer when `timeoutMs` is supplied. Merely ignoring a late result does not stop the paid transport request.
- Define ownership on Close, replacement, disposal and duplicate requests. Use the supported abort signal and prevent avoidable overlapping work; test a stalled transport deterministically. A timeout must end the placeholder and permit manual editing without waiting for the provider forever.
- Use a capability-free, discarded run policy: no tools, correction rounds, retained conversation or reasoning setting. Bound the output, report actual usage once, and avoid provider/raw-output text in success, failure and debug logs. The current engine's capability-specific text dump exits for capability-free calls, which supports the design.
- Test unpicked helper following a Proofread change, a picked helper staying independent, clearing it restoring following, `MODEL_DATA.following`, and retirement after an API-key/model refresh. Existing bundle retirement prevents **new** calls through an old engine; it deliberately permits an already-sent call to settle.

## Nonblocking documentation notes

### N-01 — Token-cost wording is too definite

[ADR line 116](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/docs/adr/2026-11-05-helper-agent.md#L115-L117) says the call costs “a few hundred tokens.” That may describe a small response, but not necessarily the whole call: the existing body bound allows 8,000 UTF-16 code units, plus the system/task prompt. Proofread's model is also configurable. Prefer “a bounded model call; cost depends on source length and the selected model,” or qualify the figure as output only. This does not invalidate the chosen automatic behavior.

### N-02 — The sibling epic link is not present in this tree

The [epic's sibling link](https://github.com/okeylanders/prose-minion-vscode/blob/a02d785daa902f0af84b18163e07fcd9c548b044/.todo/epics/epic-helper-agent-2026-11-05/README.md#L9) targets `../epic-workshop-persona-file-edits-2026-11-05/README.md`, which does not exist at this head. A verified sibling PR/branch link can serve until that document lands. The four other local file links in the two new documents resolve.

## Verification and limits

- Exact-head checkout inspected. Base-to-head comparison confirms **two Markdown files only**, 243 insertions; no executable, test, manifest, lockfile or persisted-format changes.
- Local `git diff --check b4ca7b86a03887436cfb6f2b32870074e0807b8b a02d785daa902f0af84b18163e07fcd9c548b044` passed. Local link inspection found only N-02.
- Inspected the existing memory hook, sheet and pure sheet builders; live preview and saved-memory handlers; safe transcript/preview projection; recall saved-turn result; memory bounds and draft validator; model selections, resource retirement, agent policies and transport timeout/logging behavior; related regression tests and PR #219's resolved findings.
- Exact spec-head PR CI [run 42118309030](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42118309030) / job `verify` **passed**. The log explicitly checks out merge candidate `26b70ed8a392055e2d7995c0e979628a8cf1880c`, merging reviewed head `a02d785daa902f0af84b18163e07fcd9c548b044` into base `b4ca7b86a03887436cfb6f2b32870074e0807b8b`.
- CI evidence: all three typechecks passed; **753 suites / 10,481 tests / 59 snapshots passed**; lint **0 errors / 1,165 warnings**; both webpack bundles and bundle-sentinel verification passed, with three webview size/performance warnings.
- No duplicate local full-suite run was made for this documentation-only review. No live provider call or native VS Code acceptance pass was made; the helper is not implemented in this PR. A-01–A-05 are future acceptance requirements, not tests claimed as passing now.
- The report-only publication head needs its own CI result. That result will be recorded in the PR conversation without an endless series of CI-only report commits.
- No product edits, merge or deployment were performed. PR #205 remains deferred.

## Ledger

| Item | Severity | Disposition |
|---|---|---|
| Blocking findings | — | None at specification level |
| A-01–A-05 | Implementation acceptance | Carry into Slices 1 and 2 verification |
| N-01 | Low | Nonblocking wording correction |
| N-02 | Low | Nonblocking link correction |

