# PR #244 review: main into Persona File Edits

## Verdict

**Written code approval of the synchronization at `0eb931c9032509d2b4bc70459f92cb05267ca247`. No blocking integration finding.** This is not acceptance of the Persona File Edits live pass or approval of Slice 4c (#236).

- PR: [#244](https://github.com/okeylanders/prose-minion-vscode/pull/244).
- Head branch: `epic/workshop-persona-file-edits-sync-main`.
- Epic parent/base: `893b86bdb09141624dc00de3b4c34060547cdab1`.
- Imported main parent: `859517b6`.
- Merge base of those parents: `b4ca7b86a03887436cfb6f2b32870074e0807b8b`.
- Reviewed: 2026-11-07.
- Existing-work check: no #244 review, conversation comment, or report at the start. Prior #239 and #242 reports were read as earlier evidence, not reissued or substituted for this integration review.

## Merge reconstruction and ownership

`git show --remerge-diff` independently reconstructs exactly the 13 declared conflict paths. The reviewed head has the two declared parents. Both parents changed 23 common paths: all 13 conflict resolutions and the other 10 auto-merged paths were inspected.

1. **Both services survive composition.** The extension constructs the file-edit staging/gateway and the helper, and `CoreServices` carries all three. `MessageHandler`, `WorkshopRoomHandler`, the slice contracts/composition and the four constructor test sites agree on `bookmarkBrowser, fileEditStaging, fileEditApply, memoryDrafts`. The helper does not acquire the file-edit port.
2. **Both settings survive.** The manifest retains `workshop.fileEdits` and `workshop.memory.helperDrafts`; each has its own setting handling. This pass does not resume the separate #236 settings-race review.
3. **Route counts are recomputed, not selected from a parent.** From the common base's 86 routes, file edits add one mutation and one direct route, and Helper adds three direct routes: **91 total, 48 mutation / 43 direct**. The ownership ledger and seams test retain both features' route assertions. File actions remain behind the mutation gate; helper drafts remain direct and read-only. Helper disposal remains wired.
4. **Both webview controllers survive.** `WorkshopApp` supplies the live `roomRevision` to project memory and file edits. The message router retains both file-edit result handlers and both helper result/setting handlers. The two sets do not overwrite one another.
5. **Auto-merged seams are coherent.** The composition root, exported services, message enum/unions/barrels and budget interface/value/test additions contain both features. The shared reasoning reader is imported from orchestration, with no code import of `DraftEditReasoningSupport`. Core remains free of host `vscode` imports.

## Combined per-turn budgets

The larger imported budgets remain sensible beside the file-edit ceilings, with the existing limits below understood as independent bounds rather than promises to consume every maximum in one reply.

- **One shared 15-call allowance.** `AgentRunEngine` increments its round count before fulfilling a call and stops fulfillment at the shared limit. Transcript, memory, resource, dictionary and analysis requests all spend that same allowance. Rejected calls also consume a shared round. Host and capability-bearing guest policies use this limit.
- **Nested family limits, not extra allowances.** Transcript reads allow 10 attempts and memory reads 5, within those same 15 rounds. Full dictionary entries allow 3 and analysis side passes 2. The prompts, fresh-turn reminder and refusal wording agree with the constants.
- **Recall still shares a character allowance.** Ten recall reads do not each receive a fresh turn-wide allowance. They share 300,000 characters when the context window is known, with at most 150,000 per read and half the available window per result. An unknown window shares one read's worth, 150,000 characters.
- **File-edit proposals are final-reply trailers, not capability calls.** They remain limited to 5 proposals, 24,000 characters per frame, and the existing operation/field bounds. They neither spend nor expand the 15-call allowance. The memory and file-edit trailer kinds can occupy the same tail in either order, with separate proposal caps and shared structural parsing. Rejected or incomplete frames do not apply changes.
- **Helper stays separate.** Its policy retains zero capability and correction rounds, no capability catalog, and discarded history. Its memory task still bounds the input to 8,000 characters and response to 4,000 characters, with a 1,000-token output allowance plus the existing light reasoning allowance only for models requiring reasoning. It drafts fields; it never applies a file edit.

### Known limits retained by the sync

The [planned read-window work](../../.todo/features/feature-workshop-reads-fit-the-window/README.md) remains unimplemented here, as recorded in the earlier #239 review. Resource and memory reads do not use the available-window fit. Five maximum-sized memory reads can contribute about 200,000 characters, and 15 maximum-sized resource reads about 960 KiB, before framing. The next preflight can therefore fail with `context-window-exceeded`; the sync does not add the proposed evidence-replacement backstop.

Also, 15 capability calls is not a cap of 15 provider requests. Initial/completing responses, a protocol correction and the forced-final retry can add requests; returned usage is accumulated by the engine. A model's output/context allowance may prevent five maximum-sized file-edit frames from fitting into one response. These are existing capacity/cost limits, not new merge regressions or reasons to weaken the file-edit parser.

## Independent integration witness

Two additional mocked integration cases drive the real router, room handler, slice composition and completion path with **both** a file-edit gateway and a helper supplied. A reply stages a sentinel-bearing file-edit card, then requests a memory draft from that same reply as either a bubble or a preview.

Both cases verify that:

- The helper receives only the displayed reply text, not the proposal's path, reason, quote, replacement, appended passage or private URI.
- The single-turn transcript projection used by recall omits those proposal fields too.
- Drafting leaves the card unchanged and calls no Apply port.
- A later explicit file-edit action still reaches the file-edit gateway, settles the card, and does not call the helper again.

**2/2 passed.** Reproducible source is retained as [a non-discovered probe](probes/pr-244-combined-routes.test.ts.txt); it is not added to the normal Jest inventory. All provider/host write seams in this witness are test doubles.

A third independent [mixed-budget probe](probes/pr-244-combined-budgets.test.ts.txt) uses the real persona adapter, agent engine, session aggregate, recall service/store, memory library/store and trailer extractor with mocked provider responses. In each of two turns of one retained conversation, 10 transcript reads and 5 memory reads succeed, a sixteenth resource request is not fulfilled, and the forced final preserves both trailer kinds. Direct over-limit transcript/memory attempts do not reach their services. A new adapter on the next writer turn resets both nested counters and the engine limit. All 17 mocked provider responses per turn are accounted for in usage. **1/1 passed.** This probe uses small inputs and an unknown context window; existing recall tests cover the window clamp.

## Verification

Independent local checks on the reviewed source head, with no production or checked-in test changes:

- `npm run typecheck`: all three targets passed.
- `npm test -- --runInBand`: **793 suites / 11,126 tests / 59 snapshots passed** (445.082 seconds). The three external review probes are not included in these totals.
- Focused budget run: **5 suites / 170 tests passed** (`AgentRunEngine`, `WorkshopTranscriptRecallCapability`, `WorkshopProjectMemoryCapability`, `promptBudgets`, `fileEditProposalPromptSync`). These overlap the full suite and are not added to its count.
- External integration probes: **2 suites / 3 tests passed**, as detailed above.
- `npm run lint`: **0 errors / 1,165 warnings**, matching exact-head CI.
- `npm run build`: both bundles and `verify:bundle` passed, with the existing three webview size/performance warnings.
- No static `vscode` imports in core and no code import of the old `DraftEditReasoningSupport` path.
- `git diff --check HEAD^1 HEAD -- apps packages`: passed. The unrestricted diff reports only two inherited documentation EOF blank lines (`.todo/archive/epics/epic-helper-agent-2026-11-05/README.md` and `docs/pr-reviews/pr-225-helper-agent-spec-review.md`); neither is a code defect or changed by this review.
- Dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/pr244-npm-cache`, after the default cache path was unavailable. Lockfile unchanged. Local Node was **24.22.1**; CI uses **18**.

To reproduce the additional witnesses without changing Jest's ordinary inventory, copy their `.test.ts.txt` sources to `.test.ts` files under a temporary `__tests__` directory. From the repository root, run `npm test -- --runInBand --roots <temporary-directory> --runTestsByPath <first-test> <second-test>`.

### Exact reviewed-head CI

[CI run 42341016738](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42341016738), job `verify`, succeeded. Its recorded head is `0eb931c9` and base is `893b86bd`; the checkout log verifies synthetic merge `c34568b045f1518debc247dad2baebb16d11e200`.

- All three typechecks passed.
- **793 suites / 11,126 tests / 59 snapshots passed.**
- Lint: **0 errors / 1,165 warnings**.
- Both webpack bundles and `verify:bundle` passed; the existing three webview size/performance warnings remain.

Publishing this report creates a later documentation-only head. Its CI is a separate run and is not covered by the above result; publication-head status belongs in the PR conversation.

No native Extension Development Host visual/undo/Refactor Preview pass or live/billable provider request was made. Persona File Edits' own live-pass checklist and #236 remain outside this sync verdict. #205 was not reviewed. Only review documentation and reproducible probe text are published: no production fix, merge, auto-merge, deployment or epic acceptance.
