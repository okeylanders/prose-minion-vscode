# PR #209 review: several memory suggestions and supersession confirmation

- **Reviewed:** 2026-11-05
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/209
- **Implementation head:** `0081503c3eb99af7728f1150f9e76faf352400fa`
- **Base:** `4d74ac0454a118feb99eb38f3d59e98a0db8ea05` (`epic/workshop-project-memory`)
- **Verdict:** **Approved. F-01 is closed; no open review finding.** This is a written review verdict, not a formal GitHub approval or merge.

## Re-review at `b9d6408eaf6c983d84ea98bae6a17fcb81aabc53` (2026-11-05)

**F-01 closed.** Read the complete three-file correction and verified the exact updated tree. The parent now filters automatic saves before choosing the zero/one/many presentation, carrying each original index through the filter. All-auto produces nothing; a single remaining card has no plural wrapper; multiple remaining cards have the right count. The original independent failing assertions now pass, along with the receipt-body and three-card request-correlation controls (**two independent suites / four tests**). The production card suite passes **19 tests**, including nonzero-index Save/Edit/Dismiss and a writer-saved settled-line control. All three typechecks pass again. No further product change was introduced.

Implementation-head CI [41961001529](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41961001529) completed successfully: verified logs show **694 suites / 9,768 tests / 59 snapshots**, 0 lint errors / 1,165 warnings, and successful typechecks/build. The correction head's [CI 41962610670](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41962610670) was running at re-review; it and the resulting report head are being watched. No manual Extension Development Host or live provider pass is claimed.

## F-01 · P3 · Closed at `b9d6408e`: count visible cards after removing automatic saves from the source reply

**Location:** [WorkshopTurnMemory.tsx:61–71](https://github.com/okeylanders/prose-minion-vscode/blob/0081503c3eb99af7728f1150f9e76faf352400fa/packages/core/src/presentation/webview/components/workshop/memory/WorkshopTurnMemory.tsx#L61-L71). The child hides each automatically saved card at [88–90](https://github.com/okeylanders/prose-minion-vscode/blob/0081503c3eb99af7728f1150f9e76faf352400fa/packages/core/src/presentation/webview/components/workshop/memory/WorkshopTurnMemory.tsx#L88-L90).

The parent counts every original proposal, builds the stack and “N suggestions” heading, and only then renders children that return `null` for automatic saves. Those saves correctly move to their own receipt, but their source wrapper remains.

**Executed component witnesses with the actual receipt mapper:**

1. Give one reply two saved proposals, with two corresponding automatic receipts. Render `WorkshopTurnMemoryCards` with `autoSaved: workshopAutoSavedMemories([reply, ...receipts])`.
2. The result is an otherwise empty `role="group" aria-label="2 memory suggestions"` containing the visible text **“2 suggestions”** beneath the reply. There is no card inside it.
3. Give the reply one automatically saved proposal and one pending/held proposal. Exactly one card is visible, but the heading still says **“2 suggestions.”**

Both corrected-behavior assertions fail at this head. A control test expands the second receipt and correctly finds only the second memory's body, so this is the source-stack count/visibility problem, not crossed receipt contents.

**Requested correction:** determine which proposals render at the parent before selecting the zero/one/many-card presentation. If none remain, render nothing; if one remains, avoid a plural stack; otherwise count only the visible cards. Preserve each item's **original proposal index** when filtering so Save/Edit/Dismiss do not target another card. Add regressions for all-auto, mixed auto/held, and an action on a surviving nonzero index.

This is a low-severity presentation defect; the saved files and receipts are correct.

## Scope and source integrity

Reviewed all 45 changed files against Slice 6b and its ADR addendum, including independent examination of:

- extraction, stripping, retention, logging, streaming and tool-correction privacy;
- current and legacy checkpoint shapes, strict validation, normalization, cloning, reopen, Branch and Rewind;
- ordered automatic saves, synchronous reservations, per-card permission and writer-save coalescing;
- supersession holds, cap accounting, per-card routes, errors, sheet identity and receipt mapping.

Materialized the complete implementation head and verified **3,835 tracked blobs** against their Git blob hashes. Removed unrelated inherited files from the review copy before the final typecheck; all tracked blobs remained unchanged after testing. No implementation source was edited. The installed dependency lockfile matches this head.

## Verified privacy and parser behavior

Independent probes loaded SHA-validated production modules rather than a substitute parser.

- **156 malformed/multiple-frame forms, 56,168 streaming prefixes and 936 completed-output checks passed.** Frame bodies remain absent from public output, retained output and redacted diagnostics across the tested closed, malformed, nested, misplaced, duplicate, overflow and unclosed cases.
- A real `AgentRunEngine` + persona-capability correction path with **12 frames** rejected as mixed content retained no private payload in its correction request, retained history or debug logs.
- Actual `StreamingContent`/`MarkdownRenderer` output exposed only the public prose.
- The ten-proposal limit counts accepted, well-formed proposals as documented; malformed frames do not consume a place. Exact-title duplicates are case-folded. Over-cap frames are dropped whole.
- The documented unclosed-frame behavior remains conservative: its remainder, including later apparent good frames, is swallowed rather than disclosed.
- With a withheld personal-inference proposal followed by valid ones, the surviving automatic-save indexes compact correctly to `[0, 1]`.
- Supersession routing uses the original trailer ids before missing ids are dropped from the displayed card. A proposed replacement therefore remains held even when its named old id is unavailable. Web-research holds precede supersession holds, which precede the cap.

These checks test deterministic fences and protocol privacy; they do not prove a live model will never propose inappropriate content outside those fences.

## Verified checkpoint and persistence behavior

- Ten mixed pending/dismissed/saved/held cards round-trip byte-exact through the current session shape.
- Actual store/coordinator reopen preserves all ten items and indexes. Branch and Rewind retain the cards belonging to their retained turns without mixing item identities.
- **Nine legacy single-card state/hold variants** normalize to a one-item `memoryProposals` list with `proposes: 'new'` and the named normalization. Dual old/new shapes and old fields on an ineligible role are refused.
- The pre-memory fixture remains byte-exact. Transcript export and recall exclude private proposal bodies.
- Keeping the current session version while naming and testing this unfinished-epic checkpoint normalization follows the repository's development-shape rule. This is not a claim that an older build can read the new multi-proposal shape.

## Verified automatic-save and coalescing behavior

Six additional real-router/session/completion/library/store witnesses passed:

1. Hold the first create in a three-card batch, then issue a writer Save for card index 2 **before it reaches the store**. No early reply or write occurs; releasing the first save produces exactly three files and three automatic receipts, and the writer joins card 2's id.
2. Submit a distinct edit for card index 1 during that held batch. It is accurately refused while the run tail settles, rather than falsely acknowledged. Retrying afterward updates only card 1's saved file and leaves the other files intact.
3. Switch Auto to Off before the first commit of a five-card batch. Nothing writes; all reservations are released, and a subsequent Auto batch can use all five places.
4. Replace the room while the first create is held. The entire queued batch is withdrawn with no file or receipt.
5. Refuse the first card's save as busy. Later cards still save; the failed reservation is released, and a later batch fills exactly the remaining cap places.
6. Delay the post-commit version listing of a batch behind two earlier saves. A newer reply counts both committed-but-unreceipted and queued reservations, is held at the cap, and never creates a sixth automatic file.

The existing production race suites also pass, including commit-time permission checks, edit preservation, run ownership and post-commit cap accounting. The independent overlap test above deliberately holds the store: merely awaiting a finished Send before clicking Save would not demonstrate joining an in-flight later card.

## Verified UI identity

Apart from F-01, independent hook/component controls pass:

- Three simultaneous card actions settle out of order without crossing busy/error state.
- Editing the third card retains its original index and submitted draft after a failed save.
- Duplicate result messages are ignored after the owning request settles.
- Automatic receipts map to the correct individual proposal bodies.

These are rendered-component/JSDOM checks. No manual Extension Development Host or live provider pass was performed.

## Verification summary

- **Local typechecks:** core, webview and extension passed on the cleaned exact-head source tree.
- **Local lint:** 0 errors / 1,165 warnings.
- **Focused production Jest:** **46 suites / 694 tests passed**.
- **Independent concurrency Jest:** **1 suite / 6 tests passed**.
- **Independent privacy/persistence/streaming probes:** passed as detailed above.
- **Independent UI/hook probes:** receipt mapping and per-card state controls passed; the two intentional corrected-behavior assertions reproduce F-01.
- **CI at publication:** [run 41961001529](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41961001529) on implementation head `0081503c` had passed typechecks and tests, with lint/build still finishing. Its final result and any corrections are being watched.
- The unrelated Lightbox wall-clock flake was not reproduced by these focused runs and is not treated as a new finding.
- No formal GitHub approval or merge performed.
