# PR Review — Show vs. Tell authoring surface, artifact projection, and catalog (Slice 3)

**Author:** okeylanders · **PR:** [#136](https://github.com/okeylanders/prose-minion-vscode/pull/136) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-3-authoring` → `epic/conversation-widgets`
**Verified base / merge-base:** `7cdfb7792b78a4c50cbd7093b9d44ec88ba40a67`
**Reviewed code head:** `3dda78a0b11115094a9d2e39fe0002c6aee7d900`
**Scope:** 41 files · +5,623 / −53 · 5 commits
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, full application/hook/component regression probes, artifact-boundary probes, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. A handoff calling an issue nonblocking does not establish the writer's acceptance of a deferral.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Room/source fingerprint misses replacements and in-place context edits, retaining stale work | Three full-`WorkshopApp` witnesses with real session snapshots; version-change and close/reopen controls pass | **Open** |
| F-02 | 🟡 Standard | Direction carry can increase the exact payload from 600 to 603 characters | Codec-valid CRLF variant; real controller adds `over-artifact-budget` after changing carry | **Open** |
| F-03 | 🟡 Standard | Custom radio groups omit expected keyboard navigation and single-tab-stop behavior | ArrowRight changes neither focus nor selection in both groups; click controls work | **Open** |
| N-01 | 🟢 Nit | New authoring controller exceeds the repository's explicit file-size review guard | 663-line controller versus the 500-line checklist | **Open** |

**Verdict: Changes requested before merge into `epic/conversation-widgets`.** The existing automated suite and CI are green, but F-01–F-03 are independently reproduced behavior gaps in the authoring surface now made live. No functional correction or merge was performed by this review. The epic must remain off `main` until Slice 4 has landed.

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

## Verification actually run

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

No live/billable provider calls, real-manuscript transmission, interactive VS Code Extension Development Host test, functional repository edits, widget commit, merge, or release occurred. After the developer's fixes, rerun the witness cases as corrected-behavior regressions and all affected/full gates, then update this ledger and check CI for the exact final report head.
