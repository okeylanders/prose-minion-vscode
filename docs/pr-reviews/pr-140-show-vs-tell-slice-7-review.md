# PR Review — Show vs. Tell design edits (Slice 7)

**Author:** okeylanders · **PR:** [#140](https://github.com/okeylanders/prose-minion-vscode/pull/140) (open, unmerged at review)  
**Branches:** `epic/conversation-widgets-sprint-05-slice-7-design-edits` → `epic/conversation-widgets`  
**Verified base / merge-base:** `16320d61aa96d69380009b35aafe7900dffa3bb8`  
**Initial implementation head:** `73b939f6fb62ee5e2e30ca150714d4b5cddd2283`  
**Additional reviewed D2a head:** `4b6e936b1f566c25b39f772c7f15b043a27bf1ac`  
**Additional reviewed checkpoint-extraction head:** `f225884c71e66a372b673261d4424bdcf782de93`  
**Current scope:** 56 files · +2,747 / −660 · 6 implementation/docs commits  
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent source/spec review, full-app deferred-intake witnesses, host boundary probes, screenshot inspection, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | A stale passage-selection reply can replace a newer draft and discard its completed workup | Real `UIHandler` deferred clipboard response delivered through the full `WorkshopApp`; multiple lifecycle witnesses below | **Open** |

**Verdict: Changes requested before merge into `epic/conversation-widgets`.** The new D1–D4 and D2a design decisions are the review contract: optional must-survive, zero channels, editable passage, multiple context sources, and a five-row source well are intentional. The blocker is the lifetime of the new passage intake, not those decisions. Existing tests and all full deterministic gates pass, but do not cover this stale-reply failure.

## F-01 — Correlate passage intake with the request and the draft lifetime

**Location:** [`useShowVsTellIntake.ts:130–143`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellIntake.ts#L130-L143), with the uncorrelated request at [`useShowVsTell.ts:118–120`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/presentation/webview/hooks/domain/workshop/widgets/showVsTell/useShowVsTell.ts#L118-L120).

`requestPassageSelection()` sends only its selection target. The reply handler accepts any message for that target whenever the sheet is currently open and neither generation nor commit is currently pending. It cannot tell whether the response belongs to this opening, the latest request, or the writer's current passage revision.

This is reachable through the production host: [`UIHandler.handleSelectionRequest`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/application/handlers/domain/UIHandler.ts#L321-L372) awaits the clipboard when there is no active editor selection, then posts the original target without a correlation token.

**Independent full-app reproducer:**

1. Open Show vs. Tell, add a beat, and click passage **Use selection** with no active selection. Hold the host clipboard promise unresolved.
2. Type a newer surrounding passage, generate a workup, receive a valid generated response, and keep a variant.
3. Resolve the original clipboard read with the older passage.
4. The passage is replaced with the old clipboard text, the generated/kept work disappears, and the sheet says the workup was cleared because the surrounding passage changed. The expected behavior is to preserve the newer draft and its workup.

Additional independent witnesses: a reply requested before **Cancel → reopen** overwrites the newly opened sheet; two requests fulfilled in reverse order leave the **older** selection in the box. A stale reply can also cross a room replacement and overwrite passage text copied from the replacement excerpt. The probes invoke the real `UIHandler` with an injected, deferred clipboard port and deliver its response to the real `WorkshopApp`; they do not merely call the intake hook with a fabricated timing assumption.

The existing beat-selection lane has a similar older limitation. This finding is limited to the newly introduced passage target and handler in this PR; it does not require unrelated selection consumers to be redesigned. The subsequent D2a source-well and checkpoint-extraction commits leave these intake/transport files unchanged.

**Requested change:** Bind passage replies to their initiating request and authoring lifetime. Accept only the current request for the current opening/room and passage revision; invalidate outstanding requests when superseded by another request, a writer edit or **Use excerpt**, closure/reopening, room replacement, or a generation/commit transition. Rejection must remain permanent after generation or commit settles. Preserve valid current intake, and add full-app regressions for the witnesses above, including delayed real-host clipboard completion and reversed replies. An optional selection correlation field echoed by the host is one possible bounded approach; the implementation choice remains with the author.

## Verified behavior outside the finding

- **Current decisions, not superseded rules.** The new fields and UI match D1–D4 and D2a. Both committed rendered screenshots were inspected directly: constraints and channels/budget sit above the full-width passage and context list; the zero-channel copy and optional must-survive presentation are present. The D2a update adds the inset five-row well without another tab stop; its CSS, tests, docs, and updated screenshot were reviewed. Header extraction retains the existing opening banners and close behavior.
- **Host boundaries.** Independent probes accept exactly 250,000 characters across writer text plus eight sources and reject one extra before engine access. They cover source order mismatch, numeric canonicalization across all 24 permutations of excerpt plus three attachments, duplicate references, recommendation text at 20,000/20,001, and non-mutating sorting.
- **Checkpoint safety.** Mixed old/current draft hydration preserves current context, adds only the missing writer-text field to old drafts, names the repair, and repairs nothing on the next round trip. Five wrong-typed writer-text values are refused rather than normalized. This is correctly a development-checkpoint repair, not a released schema migration. The complete `f225884c` extraction into the named `ShowVsTellCheckpointNormalization` sibling was inspected; it moves the same implementation, retargets its consumers and guards, and keeps the codec below 500 lines.
- **Optional invariants and privacy.** Blank/whitespace must-survive omits the artifact line. Context persists in the private draft but is absent from the artifact, writer room message, and config summary; recommendation surrounding text is removed from retained provider history. Protocol-looking text stays JSON string data. Zero-channel and blank-invariant authoring reach generation and commit.
- **Retained interactions.** Independent full-app controls verify the eight-source cap and canonical ordering, unavailable-reference visibility/removal, invalidation on selected-source removal, copied-excerpt independence, and passage/source freezing during a pending commit followed by refusal. Replies arriving while closed or actively generating are already dropped; F-01 concerns replies that outlive those states.

## Verification actually run

The initial full gates ran at **`73b939f6fb62ee5e2e30ca150714d4b5cddd2283`** (298 suites / 4,247 tests / 2 snapshots in 117.643 seconds). All full gates and independent probes were repeated after reviewing the complete D2a delta at **`4b6e936b1f566c25b39f772c7f15b043a27bf1ac`** (298 suites / 4,249 tests / 2 snapshots in 84.511 seconds). All full gates, the host probes, and the desired-safe lifecycle witnesses were repeated again at **`f225884c71e66a372b673261d4424bdcf782de93`** after the checkpoint extraction. Results below are at that latest head unless noted. Runtime: Node **24.19.0** / npm **11.9.0**; clean isolated checkout and lockfile-installed dependencies.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **298 suites / 4,249 tests / 2 snapshots passed**, 84.173 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,115 warnings**; three new naming-convention warnings, disclosed by the author |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check 16320d61..f225884c` | Passed |
| Independent host-boundary probes | **16 tests passed**, including the enumerated permutations/boundaries above |
| Independent full-app intake/lifecycle probes | **12 tests passed** at `4b6e936b`, 16.47 seconds: four reproduce the incorrect behavior explicitly; eight are passing controls, including successful current asynchronous intake. These are not twelve correctness passes. |
| Same witnesses with desired-safe assertions | **4 failed / 8 passed**, 16.034 seconds at `f225884c`. All four failures demonstrate F-01; this is the regression suite to make green. |

The author's production-bundle screenshot is visual evidence, not an independent interactive run. The supported cloud browser could not reach this executor's loopback preview (`ERR_CONNECTION_REFUSED`); its URL policy also refused local `file:` navigation, and that restriction was respected. No independent native rendering, keyboard traversal, oversized native paste, VS Code Extension Development Host, or live/billable provider run is claimed. JSDOM does not establish visual fidelity or native textarea truncation behavior. The existing interactive smoke-test, provider-quality, dedicated canon-witness, and future Prose Controller-consumer follow-ups remain open.

This review makes no functional edit, real-room commit, editor/clipboard access, merge, or release. All test data and clipboard responses are synthetic. Required CI on a later report/fix head is a separate final check; green CI alone does not resolve F-01.
