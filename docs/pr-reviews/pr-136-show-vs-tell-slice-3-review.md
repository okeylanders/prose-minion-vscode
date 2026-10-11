# PR Review — Show vs. Tell authoring surface, artifact projection, and catalog (Slice 3)

**Author:** okeylanders · **PR:** [#136](https://github.com/okeylanders/prose-minion-vscode/pull/136) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-3-authoring` → `epic/conversation-widgets`
**Verified base / merge-base:** `7cdfb7792b78a4c50cbd7093b9d44ec88ba40a67`
**Initial reviewed code head:** `3dda78a0b11115094a9d2e39fe0002c6aee7d900`
**Final re-review head:** `233f2c669c6785653d40542a9afdd70317a2841d`
**Initial scope:** 41 files · +5,623 / −53 · 5 commits
**Fix-round scope:** 29 files · +1,259 / −436 · 5 commits after the first report `684df7bf`
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, full application/hook/component regression probes, artifact-boundary probes, and full deterministic verification; full fix-delta re-review with independent lifecycle/transaction, encoded-cost, and keyboard/controller challenges

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf. This ledger records the independently verified state at `233f2c66`; original evidence below remains pinned to `3dda78a0`.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Room/source fingerprint misses replacements and in-place context edits, retaining stale work | Original witnesses now assert corrected behavior; 29 independent full-app, aggregate, and coordinator checks pass | **Addressed** at `233f2c66`; fix `2bd040a8` |
| F-02 | 🟡 Standard | Direction carry can increase the exact payload from 600 to 603 characters | Both integrity gates reject the original witness; corrected case projects 600→599; 49 named and 2,593 cross-encoding cases pass | **Addressed** at `233f2c66`; fix `28813109` |
| F-03 | 🟡 Standard | Custom radio groups omit expected keyboard navigation and single-tab-stop behavior | Both groups pass keyboard/focus/tab-eligibility checks; integrated controller retains work across position changes | **Addressed** at `233f2c66`; fix `68bb2c75` |
| N-01 | 🟢 Nit | New authoring controller exceeds the repository's explicit file-size review guard | Controller is 486 lines; pure-rule module is 309 lines; ownership and tripartite interface preserved | **Addressed** at `233f2c66`; refactor `52a68b1b` |

**Verdict: Approved for merge into `epic/conversation-widgets`.** F-01–F-03 and N-01 are independently verified addressed at `233f2c66`. No open Blocking, High, Standard, or Nit finding remains. The full deterministic gates and code-head CI pass. Approval remains subject to required checks on the final report-only branch head. This report does not merge the PR. **The epic must remain off `main` until Slice 4 has landed**, because Commit is intentionally disabled in this slice.

## Final re-review at 233f2c66

The entire five-commit fix delta was inspected, including shared snapshot contracts, host lifecycle changes, webview state, validation/prompt alignment, radio presentation, helper extraction, tests, architecture guards, and documentation. The [developer response](https://github.com/okeylanders/prose-minion-vscode/pull/136#issuecomment-6084055321) was checked against independent execution rather than treated as evidence by itself.

### F-01 is addressed

- `WorkshopSessionService` now mints a process-unique live room revision at construction, reset, and successful hydration. Snapshots also expose the existing authoritative context revision. `useWorkshopRoom` delivers both to the actual `WorkshopApp` authoring key; no attachment body is added to that snapshot contract or the persistence codec.
- All three original full-app witnesses now pass with protective assertions: same-version room replacement clears grounded work; same-id/same-word-count file refresh clears grounded work; in-place text edits cancel pending generation and reject its late result.
- The independent matrix passes **15 full-application lifecycle cases and 14 aggregate/coordinator cases**. It covers settled and in-flight work, source changes/removal, unchanged snapshots, ungrounded work, original token/reopen controls, and authoritative revision behavior.
- Real New, Open, Rewind, and Branch operations mint fresh identities. Injected write failures restore the exact committed source state under a fresh identity, so rollback does not reuse a potentially stale authoring key. Invalid hydration and rejected attachment operations preserve the installed state/revisions.
- Context add/edit/refresh/remove advance the source revision. The invalidation is deliberately conservative: even a change to another attachment clears source-grounded work. Ungrounded generation does not depend on these room sources and remains intact. This is a documented tradeoff, not an unresolved stale-source gap.

### F-02 is addressed

- A single shared encoder now serves both projection and the shared integrity rule. The required encoded margin is derived from the frozen line keys and equals **4**. Both generation decoding and persisted-draft integrity call that same rule.
- The original CRLF witness is rejected through both gates. Reducing its direction from 120 to 116 encoded characters makes it valid; the actual artifact and live controller now change **600→599**, with only `commit-not-wired` remaining.
- **49 named cases and 2,593 cross-encoding cases** passed through both gates with actual projection arithmetic. Coverage includes insufficient/exact/surplus margins, CRLF/LF/CR/U+2028/U+2029, mixed line breaks, and trimming. Every accepted matrix case strictly reduces the body when changed to direction carry.
- The prompt, current sprint, and resolved/archived debt record agree on the encoded four-character rule. The separate 585-character absolute fit guarantee remains intact.

### F-03 and N-01 are addressed

- Both controls use the same controlled custom-radio implementation: forward/backward horizontal and vertical arrows wrap, move focus, and select; Home/End select the endpoints; only the selected option is a tab stop. Tab/Shift+Tab and modified shortcuts are not captured. Disabled length controls ignore interaction and expose no eligible tab stops; re-enabling restores the selected stop.
- Independent integrated keyboard/controller checks preserve the current workup, keeps, and carry modes when moving position. An in-flight attempt also remains current and accepts its matching reply after a position change.
- The controller is now **486 lines**, with **309 lines** of coherent pure rules extracted beside it. Inspection found no additional transport ownership or changed persistence behavior from the extraction.
- Keyboard probes used JSDOM, including focus updates, tab eligibility, and event passthrough. **Native browser Tab traversal and visual rendering were not independently verified.** The earlier browser limitation below is not converted into a passing test.

### Final re-review verification

All checks below target **`233f2c669c6785653d40542a9afdd70317a2841d`**, before this report-only update. Runtime: Node **24.19.0** / npm **11.9.0**; unchanged lockfile from the initial review.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **284 suites / 3,955 tests / 2 snapshots passed**, 131.146 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,104 warnings** |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check` over the fix delta and complete PR delta | Passed |
| Independent lifecycle/transaction regressions | **2 suites / 29 tests passed**, 51.832 seconds |
| Independent encoded-cost matrix | **49 named + 2,593 cross-encoding cases passed** through response decoding and persisted integrity |
| Independent keyboard/controller probes | Both radio groups, disabled/re-enabled state, workup/in-flight retention, and 600→599 corrected ceiling case passed |
| Fix-head GitHub CI | **Success**, [PR run 37952595726](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37952595726) |

No live/billable provider call, real-manuscript transmission, interactive VS Code Extension Development Host test, functional repository edit, widget commit, merge, or release was performed by this review. The original findings and initial verification below are retained as historical evidence, not claims about the fixed head.

## Original findings at 3dda78a0

## F-01 — Invalidate on actual room/source changes, not reused ids

**Evidence:** [WorkshopApp.tsx:302–317](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/presentation/webview/WorkshopApp.tsx#L302-L317), consumed by [useShowVsTellAuthoring.ts:466–489](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts#L466-L489). **Confidence: High; priority: P2.**

The new `roomKey` contains only `excerpt.version` and attachment ids. Neither is a complete identity for the text sent to generation:

- Two different sessions can each have an excerpt at version 1.
- [`updateContextAttachmentText`](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L550-L579) edits prompt-bearing text without changing the attachment id.
- [`refreshContextFileAttachments`](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L587-L626) replaces file content while deliberately preserving that id. An edit can preserve the word count and every displayed source descriptor too.

The controller returns early when this incomplete key remains equal. The displayed source may therefore have changed while the old workup, kept choices, or in-flight generation is still treated as current.

### Independent reproduction

The probe mounted the **full `WorkshopApp`**, launched the real widget through its browser, delivered snapshots produced by real `WorkshopSessionService` instances, and exercised the real transport/controller:

1. Generate with an active excerpt at v1. Deliver another session whose different excerpt is also v1. The old grounded workup stays visible.
2. Generate against file source `ctx-1` containing `A peaceful kitchen.`. Refresh that same attachment to `A hostile battlefield.` with the same three-word count. The old workup stays visible.
3. Begin generation against a text attachment `ctx-1`. Change its text through `updateContextAttachmentText`, then deliver the new snapshot. **No cancellation message is sent**, and the old result subsequently settles into the current UI.

Two controls pass: a genuine excerpt-version increment clears the grounded workup; closing sends cancellation exactly once, and reopening resets the draft and rejects the late result. This isolates the failure to source/room identity rather than general token correlation.

### Requested correction

Use an authoritative room/source revision or equivalent identity that changes for room replacement and every prompt-bearing source-content change. Keep attachment bodies host-private; a display label, word count, or set of ids is not a substitute for a revision. Cancel/discard in-flight work and clear dependent settled work when its source changes. Add the three integration regressions above, retaining the close/reopen and version-change controls. This is a Slice 3 stale-authoring issue; it does not depend on the future commit route.

## F-02 — Measure the direction guarantee after artifact encoding

**Evidence:** [ShowVsTellArtifact.ts:79–82](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact.ts#L79-L82), [encoder:38–47](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact.ts#L38-L47), and [raw-length predicate](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations.ts#L43-L52). **Confidence: High; priority: P2.**

The PR correctly discloses that the longer `direction:` prefix can defeat the raw “strictly shorter” rule. The actual gap is broader than the handoff/debt record's “up to two characters,” and its proposed raw `+3` correction does not establish the required strict reduction.

For the counted lines:

- Prose costs `encode(prose).length + 8`.
- Direction costs `encode(direction).length + 11`.
- Therefore strict reduction requires `encode(direction).length + 4 <= encode(prose).length`. An encoded margin of 3 only produces equality.
- The new encoder collapses each CRLF pair into one character. A sufficient-looking **raw** margin can disappear when the prose has more CRLF pairs than its direction.

### Independent reproduction and user-visible consequence

A synthetic variant with the following values passes both the persisted draft gates and production provider-response decoding:

```typescript
prose = 'p'.repeat(24) + '\r\n'
  + 'p'.repeat(23) + '\r\n'
  + 'p'.repeat(23) + '\r\n'
  + 'p'.repeat(23) + '\r\n'
  + 'p'.repeat(23);
direction = 'd'.repeat(120);
```

The raw lengths are 124 and 120; the encoded lengths are both 120. With beat 160, must-survive 120, must-not-change 80, Hinge, one kept variant, and an 11-character note, the real authoring controller reports:

| Carry | Exact body | Blockers |
| --- | ---: | --- |
| Prose | 600 | `commit-not-wired` |
| Direction | 603 | `over-artifact-budget`, `commit-not-wired` |

Thus a control advertised as the budget-reduction remedy introduces the over-budget blocker. This is visible in Slice 3's meter even though actual commit is intentionally disabled.

### Requested correction

Resolve the completion criterion explicitly and make the shared validation, generation prompt, artifact encoding, and tests agree. For the current “always lowers” contract and line keys, enforce the guarantee against encoded values, including the four-character minimum difference. Keep a single shared semantic rule for generation and persistence. Cover raw margins 1/3/4, CRLF versus LF/CR/U+2028/U+2029, whitespace trimming, and the 600→603 controller witness. Correct the debt/handoff explanation; do not retain “never raises by more than two” as a bound for the current accepted inputs.

The separate **585 ≤ 600** one-direction/no-note fit guarantee remains sound: each independently bounded value only shrinks under encoding. F-02 is about the relative cost of switching an existing kept variant, not failure of that absolute bound.

## F-03 — Implement the keyboard contract for the custom radio groups

**Evidence:** [ShowVsTellContinuumControl.tsx:35–47](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/ShowVsTellContinuumControl.tsx#L35-L47) and [ShowVsTellChannelsBudget.tsx:87–103](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/ShowVsTellChannelsBudget.tsx#L87-L103). **Confidence: High; priority: P2.**

Both groups render ordinary buttons with `role="radio"`, but supply neither arrow-key handling nor roving `tabIndex`. The independent component probe found all five continuum choices and all four length choices at `tabIndex=0`. ArrowRight from selected Hinge or “same length” invokes no change callback and leaves focus where it was. Clicking Evidence / “+1 sentence” immediately invokes the expected callback.

Users are told these are radio groups, but their expected directional navigation does nothing and Tab walks every option. The [W3C radio-group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/#keyboardinteraction) specifies a group entry/exit tab stop and arrow-key movement/selection. Tab and Space still work as ordinary buttons here, so this is not a claim that the controls are completely keyboard-inaccessible.

**Requested correction:** use styled native named radio inputs, or implement the complete custom-radio keyboard pattern, including wraparound, focus movement, and a single tab stop. Test both groups, forward/backward arrows, wraparound, Tab entry, and the disabled length-budget state. Preserve the position-change exception: choosing another continuum position must retain the current workup.

## N-01 — Keep the authoring owner within the repository's size guard

The new [`useShowVsTellAuthoring.ts`](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts) is **663 lines**. The [agent guide's pre-approval checklist](https://github.com/okeylanders/prose-minion-vscode/blob/3dda78a0b11115094a9d2e39fe0002c6aee7d900/.ai/central-agent-setup.md#L908-L919) explicitly flags files above 500 lines and calls for architecture review.

This is a maintainability nit, not evidence of runtime failure or a request for a generic widget framework. Extract coherent pure helpers/derived-state calculations or document an explicit architecture exception, while keeping one transport-free feature owner and the existing tripartite interface. Addressing F-01 is an opportunity to keep the lifecycle logic easier to audit.

## What is sound

- The previous slice is merged, the branch is cut from that epic tip, and the catalog flip is intentionally scoped to authoring. Commit is unconditionally disabled; Host preparation, recommendation, chip reopen, and clone/commit remain deferred to their specified slices.
- The neutral catalog copy and deterministic one-accent readout preserve both showing and telling as choices. Frozen position copy, the non-monotonic readout rows, channels, POV field, and length options are reused rather than reinvented.
- The transport latches token/workup identity, accepts at most one matching result, retains the token across terminal `completed` progress for that result, and rejects stale mismatched results. Regeneration clears workup/kept/carry atomically. The tested close/reopen path cancels and resets correctly.
- Position changes retain workup and selections. Other explicit input actions invalidate them; the missing source-identity cases are isolated in F-01.
- The meter calls the same pure projection intended for the host. It excludes source text, unkept cards, craft notes, warnings, readout, and envelope; kept output follows workup order.
- Gains/costs render as escaped text. Flags are passive, and new keeps default to direction carry. Selection intake visibly reports truncation and drops the raw editor URI.
- The tested 585-character bound, fixed line keys, and nonexpanding line-break encoding are correct.

## Initial verification actually run

All checks target **`3dda78a0b11115094a9d2e39fe0002c6aee7d900`**, before this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**; fresh lockfile-based `npm ci` after cloud execution recovery. GitHub CI uses Node 18.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **282 suites / 3,919 tests / 2 snapshots passed**, 146.744 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,100 warnings** |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check 7cdfb779..3dda78a0` | Passed |
| Full-`WorkshopApp` lifecycle probes | Seven bug-witness/control tests passed; three confirm F-01 and four establish working controls |
| Artifact/protocol probes | Seven raw/encoded length cases plus the exact ceiling witness; accepted through draft gates and response decoding |
| Component/controller probes | Both radio keyboard gaps and the live 600→603 blocker transition reproduced |
| Throwaway UI harness compilation | Passed |
| Actual browser rendering | **Not completed:** direct Chromium launch was blocked by required local socket access; the available cloud browser could not reach the temporary local harness |
| Code-head GitHub CI | **Success**, [PR run 37948012608](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37948012608) |

A passing bug-witness test above means the test confirmed the undesirable behavior; it does not mean that regression is fixed. The existing green suite lacks these protective assertions. The author's reported Chromium render was not counted as independent visual verification.

The initial review performed no live/billable provider calls, real-manuscript transmission, interactive VS Code Extension Development Host test, functional repository edits, widget commit, merge, or release. The final re-review above supersedes the original changes-requested verdict.
