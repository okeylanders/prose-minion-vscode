# PR Review — Show vs. Tell design edits (Slice 7)

**Author:** okeylanders · **PR:** [#140](https://github.com/okeylanders/prose-minion-vscode/pull/140) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-7-design-edits` → `epic/conversation-widgets`
**Verified base / merge-base:** `16320d61aa96d69380009b35aafe7900dffa3bb8`
**Initial implementation head:** `73b939f6fb62ee5e2e30ca150714d4b5cddd2283`
**Additional reviewed D2a head:** `4b6e936b1f566c25b39f772c7f15b043a27bf1ac`
**Additional reviewed checkpoint-extraction head:** `f225884c71e66a372b673261d4424bdcf782de93`
**Independently re-reviewed F-01 fix / D5 head:** `e4d3bae7b220aae219379bc94a5cf9b793b7a9b5` (F-01 fix `16f8d6cf` followed by D5)
**Independently re-reviewed F-02 correction head:** `aa725f61a0ed69bc8a6e9ee78e5454b6021a642b`
**Initial reviewed scope:** 56 files · +2,747 / −660 · 6 implementation/docs commits; fix/D5 delta from the report head: 30 files · +634 / −226
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent source/spec review, full-app deferred-intake witnesses, host boundary probes, screenshot inspection, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | A stale passage-selection reply can replace a newer draft and discard its completed workup | Corrected in `16f8d6cf`; original full-app acceptance witnesses pass at `e4d3bae7` | **Addressed** |
| F-02 | Minor / P3 | Current QA documents still require the direction-length rule intentionally removed by D5 | Both current criteria corrected in `aa725f61`; exact carry/budget witness repeated | **Addressed** |

**Verdict: Approved for merge into `epic/conversation-widgets`.** F-01 and F-02 are independently verified addressed at `aa725f61`, with no open review finding. D1–D5 and D2a are the current review contract, including the deliberate removal of the direction-versus-prose length gate. Approval remains subject to required checks on the final report-only branch head. This does not mark the broader unrun checks below complete or authorize a main merge/release.

## F-01 — Correlate passage intake with the request and the draft lifetime (addressed)

**Location:** [`useShowVsTellIntake.ts:130–143`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellIntake.ts#L130-L143), with the uncorrelated request at [`useShowVsTell.ts:118–120`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/presentation/webview/hooks/domain/workshop/widgets/showVsTell/useShowVsTell.ts#L118-L120).

At the initial reviewed head, `requestPassageSelection()` sent only its selection target. The reply handler accepted any message for that target whenever the sheet was open and neither generation nor commit was pending. It could not tell whether the response belonged to that opening, the latest request, or the writer's current passage revision.

This is reachable through the production host: [`UIHandler.handleSelectionRequest`](https://github.com/okeylanders/prose-minion-vscode/blob/73b939f6fb62ee5e2e30ca150714d4b5cddd2283/packages/core/src/application/handlers/domain/UIHandler.ts#L321-L372) awaits the clipboard when there is no active editor selection, then posts the original target without a correlation token.

**Independent full-app reproducer:**

1. Open Show vs. Tell, add a beat, and click passage **Use selection** with no active selection. Hold the host clipboard promise unresolved.
2. Type a newer surrounding passage, generate a workup, receive a valid generated response, and keep a variant.
3. Resolve the original clipboard read with the older passage.
4. The passage is replaced with the old clipboard text, the generated/kept work disappears, and the sheet says the workup was cleared because the surrounding passage changed. The expected behavior is to preserve the newer draft and its workup.

Additional independent witnesses: a reply requested before **Cancel → reopen** overwrites the newly opened sheet; two requests fulfilled in reverse order leave the **older** selection in the box. A stale reply can also cross a room replacement and overwrite passage text copied from the replacement excerpt. The probes invoke the real `UIHandler` with an injected, deferred clipboard port and deliver its response to the real `WorkshopApp`; they do not merely call the intake hook with a fabricated timing assumption.

The existing beat-selection lane has a similar older limitation. This finding is limited to the newly introduced passage target and handler in this PR; it does not require unrelated selection consumers to be redesigned. The subsequent D2a source-well and checkpoint-extraction commits leave these intake/transport files unchanged.

**Requested change:** Bind passage replies to their initiating request and authoring lifetime. Accept only the current request for the current opening/room and passage revision; invalidate outstanding requests when superseded by another request, a writer edit or **Use excerpt**, closure/reopening, room replacement, or a generation/commit transition. Rejection must remain permanent after generation or commit settles. Preserve valid current intake, and add full-app regressions for the witnesses above, including delayed real-host clipboard completion and reversed replies. An optional selection correlation field echoed by the host is one possible bounded approach; the implementation choice remains with the author.

**Resolution verified at `e4d3bae7`:** [The fix](https://github.com/okeylanders/prose-minion-vscode/commit/16f8d6cf83055047c862ba11aea6daeac5f53e54) adds an optional request id to the shared selection envelope, echoed only when supplied. Passage requests mint distinct ids; the intake accepts the live id once and invalidates it on replacement, writer edits/Use excerpt, opening/closure, room changes, and generation/commit starts. The original 12-case desired-safe suite now passes, preserving its four original failure expectations. Only obsolete uncorrelated-wire assertions and lock-control responses were adapted to the actual request ids. Valid current asynchronous intake remains supported; unrelated consumers can still omit the field. Fourteen further full-app checks pass, including replay/wrong-id refusal, same-text excerpt replacement, same-timestamp requests, room-only invalidation, generation success/failure/cancel, commit success/refusal, and the older uncorrelated beat lane.

## F-02 — Align active acceptance and provider-QA criteria with D5 (addressed)

**Locations:** [live-provider quality task, lines 16–20](https://github.com/okeylanders/prose-minion-vscode/blob/e4d3bae7b220aae219379bc94a5cf9b793b7a9b5/.todo/tech-debt/2026-10-09-show-vs-tell-live-provider-quality-pass.md#L16-L20) and [lines 52–55](https://github.com/okeylanders/prose-minion-vscode/blob/e4d3bae7b220aae219379bc94a5cf9b793b7a9b5/.todo/tech-debt/2026-10-09-show-vs-tell-live-provider-quality-pass.md#L52-L55); [Sprint 05's checked completion criterion, lines 713–719](https://github.com/okeylanders/prose-minion-vscode/blob/e4d3bae7b220aae219379bc94a5cf9b793b7a9b5/.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md#L713-L719).

D5 intentionally accepts a direction regardless of its length relative to its prose, keeping its own 120-character ceiling. The active quality-pass task still says the parser rejects a direction that misses the encoded margin of four and requires accepted responses to satisfy that rule. The checked sprint criterion still says direction-only carry **always lowers** the count and cites the retired encoded-margin guarantee. These are current pass/fail criteria, not historical descriptions; a future quality pass following them would reject correct D5 behavior or try to restore the removed gate.

**Independent evidence:** A response with prose `Go.` and a 120-character direction now decodes, hydrates, and commits when its selected artifact fits. With maximal beat/invariants and Hinge, one such direction costs 585 characters; a note of eight characters produces an accepted 600-character artifact, while a note of nine produces 601 and is refused. A multiline prose value of raw length 124 / encoded length 120 paired with a 120-character direction produces a valid 600-character prose carry that grows to 603 when switched to direction, and the host correctly refuses it. This is the intended D5 behavior and demonstrates why the old claims are false.

**Requested change:** Update both active criteria to the direction's independent 120-character ceiling, no relative-length rejection, exact per-carry meter costs (including a direction carry that saves nothing or increases the count), and the separate 600-character host gate. Keep the one-direction 585 ≤ 600 fit guarantee, which still holds. As a small consistency cleanup, the validation comment in `ShowVsTellOneShotCommit.ts:67` still names “direction margins.” Do not rewrite earlier reviews as though their then-current contract was wrong. No runtime behavior change is requested.

**Resolution verified:** [The correction](https://github.com/okeylanders/prose-minion-vscode/commit/aa725f61a0ed69bc8a6e9ee78e5454b6021a642b) updates both active QA criteria, marks the former universal-saving guarantee as superseded, and corrects the host comment. It retains the 120-character direction ceiling, the one-direction 585 ≤ 600 guarantee, and the separate host artifact gate. The complete three-file delta contains only documentation/comment changes. The committed artifact test proves the encoded **+3** carry delta; the exact **600 → 603** refusal case was also independently exercised in this review. The host/D5 and lifecycle probes and all full gates were repeated at the correction head.

## Verified behavior outside the finding

- **Current decisions, not superseded rules.** The new fields and UI match D1–D4 and D2a. Both committed rendered screenshots were inspected directly: constraints and channels/budget sit above the full-width passage and context list; the zero-channel copy and optional must-survive presentation are present. The D2a update adds the inset five-row well without another tab stop; its CSS, tests, docs, and updated screenshot were reviewed. Header extraction retains the existing opening banners and close behavior.
- **Host boundaries.** Independent probes accept exactly 250,000 characters across writer text plus eight sources and reject one extra before engine access. They cover source order mismatch, numeric canonicalization across all 24 permutations of excerpt plus three attachments, duplicate references, recommendation text at 20,000/20,001, and non-mutating sorting.
- **Checkpoint safety.** Mixed old/current draft hydration preserves current context, adds only the missing writer-text field to old drafts, names the repair, and repairs nothing on the next round trip. Five wrong-typed writer-text values are refused rather than normalized. This is correctly a development-checkpoint repair, not a released schema migration. The complete `f225884c` extraction into the named `ShowVsTellCheckpointNormalization` sibling was inspected; it moves the same implementation, retargets its consumers and guards, and keeps the codec below 500 lines.
- **Optional invariants and privacy.** Blank/whitespace must-survive omits the artifact line. Context persists in the private draft but is absent from the artifact, writer room message, and config summary; recommendation surrounding text is removed from retained provider history. Protocol-looking text stays JSON string data. Zero-channel and blank-invariant authoring reach generation and commit.
- **Retained interactions.** Independent full-app controls verify the eight-source cap and canonical ordering, unavailable-reference visibility/removal, invalidation on selected-source removal, copied-excerpt independence, and passage/source freezing during a pending commit followed by refusal. Replies arriving while closed or actively generating are already dropped; F-01 concerns replies that outlive those states.

## Verification actually run

The initial full gates ran at **`73b939f6fb62ee5e2e30ca150714d4b5cddd2283`** (298 suites / 4,247 tests / 2 snapshots in 117.643 seconds), then at D2a **`4b6e936b`** (298 / 4,249 / 2 in 84.511 seconds), and after the checkpoint extraction at **`f225884c`** (298 / 4,249 / 2 in 84.173 seconds). All full gates and independent host/lifecycle checks passed after the complete fix/D5 delta at **`e4d3bae7`** (299 / 4,249 / 2 in 113.886 seconds), and were repeated again after F-02's correction at **`aa725f61a0ed69bc8a6e9ee78e5454b6021a642b`**. Results below are at that final correction head unless noted. Runtime: Node **24.19.0** / npm **11.9.0**; isolated checkout and lockfile-installed dependencies.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **299 suites / 4,249 tests / 2 snapshots passed**, 88.924 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,116 warnings**; one additional sibling-pattern `PmLogo` mock naming warning since the first review |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check 16320d61..aa725f61`, plus this report update | Passed; the initial report's Markdown hard-break spaces were already normalized in `35cf8d4c` |
| Independent host-boundary/D5 probes | **31 tests passed**, 3.457 seconds: the original 16 plus 15 new D5 boundaries, including the 600 → 603 carry witness |
| Independent full-app intake/lifecycle probes | **12 tests passed** at `4b6e936b`, 16.47 seconds: four reproduce the incorrect behavior explicitly; eight are passing controls, including successful current asynchronous intake. These are not twelve correctness passes. |
| Same witnesses with desired-safe assertions | **4 failed / 8 passed**, 16.034 seconds at `f225884c`. All four failures demonstrate F-01; this is the regression suite to make green. |
| Original desired-safe witnesses after F-01 fix | **12 tests passed**; all four original failures resolved |
| Additional full-app intake adversaries | **14 tests passed** |
| Equal-text and shared selection-wire compatibility | **19 tests passed**; all eight older no-id targets preserve their host reply/provenance shape. **45 independent lifecycle tests passed in total**, 27.449 seconds at the correction head. |
| Latest correction-head GitHub CI | **Success**, [run 37997460972](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37997460972) at `aa725f61` |

The author's production-bundle screenshot is visual evidence, not an independent interactive run. The supported cloud browser could not reach this executor's loopback preview (`ERR_CONNECTION_REFUSED`); its URL policy also refused local `file:` navigation, and that restriction was respected. No independent native rendering, keyboard traversal, oversized native paste, VS Code Extension Development Host, or live/billable provider run is claimed. JSDOM does not establish visual fidelity or native textarea truncation behavior. The existing interactive smoke-test, provider-quality, dedicated canon-witness, and future Prose Controller-consumer follow-ups remain open.

This review makes no functional edit, real-room commit, editor/clipboard access, merge, or release. All test data and clipboard responses are synthetic. Required CI on the final report-only head remains a separate check; both findings are resolved on the reviewed implementation/documentation head.
