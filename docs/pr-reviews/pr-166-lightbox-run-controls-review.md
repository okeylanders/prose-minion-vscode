# PR Review — Lightbox Run Controls, Slice 4I

**Author:** okeylanders · **PR:** [#166](https://github.com/okeylanders/prose-minion-vscode/pull/166) (open, unmerged at review)  
**Branches:** `epic/lightbox-run-controls` → `epic/lightbox`  
**Reviewed implementation head:** `28a977e12653d525574a0b6e5ff071d13f38c7f9`  
**Base:** `08b0d22600fe97c7941adcc464d06b1cb77d6e28` · **verified merge-base:** `bdec17f05561c9130f35881c2918a4ec3b3b5ae3`  
**Scope:** 98 files · +7,415 / −225 (PR / merge-base diff)  
**Reviewed:** 2026-10-23 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; stub-provider production-host probes; retained saved-board regressions; regenerated host evidence; exact rebuilt-bundle DOM execution; supplied pixel inspection; fresh full gates

## Summary

**Verdict: Request changes for F-01.** The new group scope is narrow and host-owned, and its controls reuse the established press and saved-board ownership paths. The fresh repository gates, independent host controls and retained #163/#164 regressions pass. One new paid-action presentation defect remains: the Opinion's button presents a typical-output estimate as a dollar upper bound, although a permitted response can cost more. Two smaller accessibility/state issues are recorded separately as nonblocking follow-ups.

The disclosed choice to clear the old Opinion before a group rerun, including losing that reading if the rerun fails, is **not** reported as an undeclared regression. It remains the author's explicit policy question for the writer. Decisions 41–45 and the reported real-chapter experience are design context, not independently verified acceptance.

This disposition is not a formal GitHub review, merge instruction, native VS Code/accessibility acceptance, real-chapter checkpoint, approval for Slice 5B or authorization to publish the extension.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Opinion's “up to $…” claims a total upper bound that the priced output does not support | **Open** |
| N-01 | Low / P3 · nonblocking | The call buttons' accessible names omit the contiguous visible “Run A” / “Rerun A” label | **Open; already disclosed by author** |
| N-02 | Low / P3 · nonblocking | The headline's focused Re-analyze action disappears when its group starts | **Open** |

## F-01 — Keep the Opinion's approximate price distinct from its input bound

**Location:** [`lightboxCallControls.ts:217–225`](https://github.com/okeylanders/prose-minion-vscode/blob/28a977e12653d525574a0b6e5ff071d13f38c7f9/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxCallControls.ts#L217-L225), using [`LightboxRunEstimate.ts:175–205`](https://github.com/okeylanders/prose-minion-vscode/blob/28a977e12653d525574a0b6e5ff071d13f38c7f9/packages/core/src/infrastructure/lightbox/LightboxRunEstimate.ts#L175-L205).

For `inputBound: 'digest'`, the new formatter changes `costUsd` directly into `up to $…`. Only the **input digest** is priced at its bound. The output part of `costUsd` still prices 1,440 expected tokens, not the 12,000 tokens the production request permits.

An independent production-host probe first reads B, obtains the current estimate, then presses `{ mode: 'group', group: 'F', lens: 'opinion' }`. The provider is a stub throughout:

| Fact | Observed value |
| --- | --- |
| F estimated input, including the digest bound | 9,125 tokens |
| F expected / reserved output | 1,440 / 12,000 tokens |
| Fixture input / output prices | $0.000003 / $0.000015 per token |
| `costUsd` and rendered wording | $0.048975 → **“up to $0.05”** |
| Production request's `maxTokens` | **12,000** |
| Accepted synthetic usage | 1,000 input + 4,000 output = **$0.063** |

The last row is explicitly synthetic provider usage, not a live charge or a claim that this fixture normally needs that output. It is below the actual output ceiling. At these rates, 4,000 output tokens alone cost $0.06, so even a smaller digest cannot make the displayed $0.05 a total upper bound. The separate desired-behavior assertion fails at exactly `$0.05 >= $0.063`; the host witness and other controls pass. The exact rebuilt production DOM shows the same wording on both the Opinion widget and Run F.

**Why this is new:** the previous Opinion control used the existing note, “est. $… · up to its digest bound”. This PR removes the approximation/qualification from the new button, tooltip and accessible name. The pre-existing choice to estimate typical output, rather than show the maximum possible spend, is not itself reopened as a defect.

**Requested correction:** keep this a visibly approximate total and explain separately that its input is estimated at the digest limit. If an upper-bound amount is desired instead, calculate it from conservative input and the whole permitted output, and do not imply an enforced spending cap. Apply the same meaning to both button variants, tooltip and accessible name. Cover a below-ceiling response whose output cost exceeds the typical estimate, alongside absent-pricing and tiny-price controls.

## N-01 — Include the visible call label in its accessible name

**Locations:** [`lightboxCallControls.ts:134–165`](https://github.com/okeylanders/prose-minion-vscode/blob/28a977e12653d525574a0b6e5ff071d13f38c7f9/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxCallControls.ts#L134-L165), applied by [`LightboxCallButton.tsx:51–70`](https://github.com/okeylanders/prose-minion-vscode/blob/28a977e12653d525574a0b6e5ff071d13f38c7f9/packages/core/src/presentation/webview/components/lightbox/LightboxCallButton.tsx#L51-L70).

Across all 28 call controls in the four recorded board moments, the production DOM displays labels such as `Run A` but computes `Run call A: Headline, …`; similarly `Rerun B` becomes `Rerun call B: …`. The inserted word interrupts the visible label. This is the author's disclosed issue, independently confirmed rather than a newly discovered surprise. [W3C's Label in Name guidance](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html) explains why a visible label should be contained in the accessible name and why `aria-label` takes precedence over the visible text. The adjacent “Call A” group heading does not repair the button's name.

**Suggested correction:** start with the actual visible label, for example `Run A, call A: …` and `Rerun B, call B: …`, retaining scope and price information. Assert label/name parity for Run, Rerun and Running states. This is a DOM/accessibility-name finding; no native speech engine or screen reader was exercised.

## N-02 — Preserve the headline action's focus through its rerun

**Location:** [`LightboxHeadline.tsx:38–51`](https://github.com/okeylanders/prose-minion-vscode/blob/28a977e12653d525574a0b6e5ff071d13f38c7f9/packages/core/src/presentation/webview/components/lightbox/LightboxHeadline.tsx#L38-L51).

Start from a read board, focus the headline's Re-analyze button and activate it. When the production running-A board update arrives, the group has correctly cleared its old headline. The no-headline branch retains the action only for a withheld or failed/cancelled state, not `reading`, so it unmounts the focused control instead of showing the disabled Analyzing state. The exact-bundle DOM probe records the old button disconnected and focus on `BODY`; the other A widget controls remain and say “Analyzing…”.

**Suggested correction:** preserve a stable headline action during its active rerun, or deliberately move focus to a suitable persistent run control. Keep the intentional absence of a headline action on a never-run fresh board. Add a focus-continuity check through start, completion and failure. This does not claim native focus/geometry verification or a paid-scope failure.

## Verification and evidence boundaries

| Check | Independent result on `28a977e` |
| --- | --- |
| Full repository Jest, cloud workspace Node 24.19.0 | **494 suites / 6,886 tests / 59 snapshots pass**, 385.787 s reported by Jest |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical to the retained #165 baseline by relative file, rule and severity |
| Production build, including `verify:bundle` | **Pass**, existing webpack size warnings only |
| Independent host scope/ownership/storage controls | **20 tests pass**, 4.905 s |
| Desired price-upper-bound regression | **1 expected failure**, actual asserted ceiling $0.05 below valid synthetic usage $0.063 |
| Retained #163/#164 independent regressions | **18 suites / 99 tests pass**, 22.896 s |
| Regenerated production-host evidence | **1 builder test passes**; `run-controls.json` and `log.txt` are byte-identical to the committed evidence |
| Exact freshly built production webview in JSDOM | **390 checks pass**, plus the independently recorded findings above |
| Diff whitespace / implementation scope | **Clean**; no implementation changes |
| Exact implementation-head configured CI | **Both events success**; inspected PR job uses Node 18.20.8 and reports 494 / 6,886 / 59 |

CI: [pull-request run 40002689477](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40002689477), [push run 40001730279](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40001730279). The inspected PR test job reports 221.869 s. That CI duration and local Jest duration are separate contexts, not native UI latency measurements.

Rebuilt SHA-256 values both match the author evidence:

- `webview.js`: `478dbd9b19ebcb8ce2aab5e50a74ba99f6919117d8decf289a95631d094b978f`.
- `extension.js`: `0b1af8b7332bbb5f2ea3dd5a46b0f070e599dcac5d0b0507b271e3128445ccae`.

Heavy jobs were serialized. Disk-backed dependencies were reused only after the unchanged lockfile was verified, with current-workspace links. External probe setup errors (a missing required Delete payload field, retained tests resolving older dependency identities / missing external type resolution, and a DOM reply sent before its current estimate request) were corrected before the final counts above; no production code was changed to make a probe pass.

Independently inspected six supplied captures: the fresh Opinion at 1000 and 500 px, analyzing widgets at 500 px, one-call lenses at 1440 px, and the read-board run line at 1440 and 500 px. In these captures, the new controls and disabled Opinion reason are legible and the narrow run line wraps; no additional clipping defect was established. Supplied pixels and JSDOM do not establish native VS Code geometry, real keyboard default actions, screen-reader behavior or writer acceptance. No denied browser route was retried. Only public-domain *Alice* and synthetic data were used; no private manuscript, live/billable model call, formal review, merge, deployment or extension publication occurred. Only this report is published.

## Contracts retained and boundaries not promoted to findings

- **Host paid scope:** all combinations of enabled lenses within each call, the optional named own lens, and foreign group/lens pairs are checked. E's template/summary task dependency follows the actual chosen lenses. Only the chosen call is fit-checked; an oversized unrelated F does not block a fitting B.
- **Ownership:** reservation before prompt awaits; cross-tab contention; dispose; model/context/price/lens changes; same-ID saved-board adoption; cancellation and older late responses retain their established guards. Group reruns clear only their group; sibling readings and identities remain.
- **Saved data:** new snapshots, earlier file bytes, reload pointers, deletion interleavings, observation ordering, naming, Spark edits and format-1 fixture behavior retain the independent guards. The authentic prior fixture is byte-identical to this checkout's fixture. The acknowledged #164 tied-clock recovery debt is not reopened as a new #166 finding.
- **UI state:** controls distinguish a missing estimate from absent pricing, preserve per-call fit reasons, reject stale/other-board/model/lens estimates, disable during pending/in-flight work, recover after refusal, and do not initiate provider calls merely from replaying a board. A repeated click after the pending render emits one run message. Two synthetic clicks inside one JavaScript task emit two messages, but this is neither a native double-click test nor evidence of duplicate paid work; the independently tested host reservation remains authoritative.
- **Opinion policy:** group F's replacement semantics are disclosed; its per-lens inspector reread remains the different preserve-until-success path. Whether to retain the old Opinion during a group rerun is for the writer to decide. Fresh-board/no-current-reading refusal and standalone G are not blocked by this review.
- **Off-lens widget reachability:** the host honors an explicitly named unchecked own lens, but that lens's widget is currently hidden. This is documented reachability, not an undeclared scope defect.
- **History:** the direct base-to-head endpoint comparison lacks the base's newer #165 review appendix, but the clean three-way merge retains it. Expected ancestry is not a deletion finding.

## Correction handoff

Correct F-01's cost meaning without changing the chosen call scope or imposing an unrequested budget policy. N-01 and N-02 are separate nonblocking follow-ups. Preserve the passing ownership, saved-data and failure-recovery controls, and rerun the discriminating checks, full gates and both exact-head CI events on the final correction. Native/writer validation remains separate.

## Author response (2026-10-23)

**F-01 fixed; N-01 and N-02 fixed as well.** One commit, `c11bb439`,
sits on top of your report's commit `50aa9b5`. Then `590b7a08` merges
`epic/lightbox`, which now holds PR #165 and its review's closing notes
(one documentation file, no code). The commit that adds this response
records the verification. Nothing above this section was edited.

The new and changed tests discriminate. I restored the four corrected
source files to your reviewed head `28a977e` and ran the changed suites
with type checking off, so every test reports. **33 tests fail there:**
- `lightboxCallControls`: 14 of 22;
- `LightboxAppRunControls`: 14 of 19;
- `LightboxAppGravity`: 2;
- `LightboxAppOpinion`, `LightboxAppReadings` and `LightboxAppSteering`:
  1 each (their names and the Opinion's price).

With only `LightboxHeadline.tsx` restored, the N-02 focus test fails at
the start: the button it focused is gone (`Received: null`).

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | **An approximate total, its input bound said apart.** `lightboxCallCost` no longer turns `inputBound: 'digest'` into "up to": the Opinion's price reads "≈ $0.05", like every call's ("< $0.01" when it rounds to nothing; nothing without live pricing).<br>The name and tooltip of the Opinion's Analyze and of Run F add "· input at digest limit" after the price (`LIGHTBOX_DIGEST_INPUT_NOTE`), e.g. "Analyze, call F: Opinion · ≈ $0.05 · input at digest limit". The visible button stays "Analyze ≈ $0.05", which reads cleanly at 500 px.<br>The estimate itself, the call's scope and its output ceiling are unchanged, and no budget is imposed. The run line keeps Slice 4D's note, "est. $… · the Opinion up to its digest bound", the qualified form your report cites | `lightboxCallControls.test.ts`:<br>• **Your figures:** 9,125 input tokens with the digest bound, 1,440 expected and 12,000 reserved output, $0.000003 / $0.000015. `costUsd` is $0.048975, shown "≈ $0.05" on both controls. A permitted reply of 1,000 in and 4,000 out, under the 12,000 ceiling, spends $0.063, more than shown. No label, price, name or tooltip says "up to", "at most", "max", "cap", "ceiling" or "≤"<br>• Run F says the same as the Analyze<br>**Your controls:** absent pricing (no price, no note, no reason) and a tiny price ("< $0.01 · input at digest limit")<br>`LightboxAppRunControls.test.tsx`: the Opinion's Analyze and Run F in the DOM show "≈ $0.05", their name and `title` carry the note, and the page holds no "up to $"<br>`LightboxAppOpinion.test.tsx`: the header's Re-analyze, by name and tooltip | `c11bb439` |
| N-01 | Low / P3 | **Fixed** | **The visible label first.** Every call control's name starts with exactly what its button shows, then the call, its lenses and its price: "Run A, call A: …", "Rerun B, call B: …", "Running A…, call A: …", "Analyze, call B: …", "Re-analyze, call B: …", "Analyzing…, call B: …". This answers the slice notes' "label in name" question, now recorded there as answered | `lightboxCallControls.test.ts`: in four board moments (fresh, one call landed, a call running, all read), every control's name starts with "label, call X" and contains its price; together they cover all six labels<br>`LightboxAppRunControls.test.tsx`: every `.pm-lb-call-button` on a board with A read and B running. Its visible label is the name's start, the button text is label plus price, and Run, Rerun and Running are each reached by role and name ("Rerun A, call A: … · ≈ $0.07" shows "Rerun A≈ $0.07") | `c11bb439` |
| N-02 | Low / P3 | **Fixed** | **One row, one button.** `LightboxHeadline` keeps the headline row, with its Analyze, once the headline lens has been asked for: while call A reads it, once it lands, and when it was withheld, failed or stopped. The row has one shape (heading, an optional "a reading" badge, the button), so React keeps the same button through every change.<br>When a group run clears the old headline, the focused button stays and reads "Analyzing…" (`aria-disabled`, its reason described). It then reads "Re-analyze" when the new headline lands, or "Analyze" after a failure, with the failure under the plain heading.<br>A board whose headline was never asked for still shows the plain heading alone. One change follows from the rule: on a fresh board's first run, the heading now shows the disabled "Analyzing…" while call A reads it, as call A's other widgets do | `LightboxAppRunControls.test.tsx`: from a read board, the headline's Re-analyze is focused and pressed (`{ mode: 'group', group: 'A', lens: 'headline' }`).<br>• **Start:** A's readings cleared and running; the same element is focused, "Analyzing…", disabled<br>• **Landing:** the new headline is drawn; still focused, "Re-analyze", enabled<br>• **Failure:** pressed again, A fails; still focused, "Analyze", the failure shown<br>• **Stop:** pressed again, A cancelled; still focused<br>**Control:** a fresh board has no headline row and no headline Analyze | `c11bb439` |

### Evidence

The visual evidence is regenerated
(`docs/pr-reviews/evidence/lightbox-slice-4i-visual/`).
- **New host moments.** The production-host builder records four more:
  the headline's Analyze with A held, then landed, then pressed again,
  then failed. Each moment that ends a run carries the host's `finished`
  progress for it. The first four moments rebuilt byte-identical, and
  `log.txt` only gained the new runs' lines.
- **New checks.** The harness now checks:
  - F-01: every price is "≈ $…" or "< $0.01", nothing says "up to", the
    Opinion's name ends "· input at digest limit", and the tooltip is the
    name or the reason;
  - N-01: every name starts with "label, call X";
  - N-02 (`headline-rerun.js`): it focuses the read headline's
    Re-analyze, presses Enter and replays the host's moments. The same
    button must hold the focus at each step and say what the board says.
- **Corrected bundle** (`4eb8932c…`): 0 errors, 39 captures.
- **Your reviewed head's bundle** (rebuilt byte for byte, `478dbd9b…`):
  273 errors, in `errors-28a977e.txt`.
  - F-01: 27, "up to $0.05" on both Opinion controls.
  - N-01: 204.
  - N-02: 42, the button replaced and the focus on `BODY` at every step
    and width, as your exact-bundle probe found.
- **Base bundle:** 189 errors (186 before).
- **Repeat renders:** three renders of the corrected bundle gave
  byte-identical `facts.json`.
- **Captures inspected:** the Opinion at 500 px ("Analyze ≈ $0.05",
  disabled, its reason under it) and the headline's Analyzing… and failed
  steps at 500 and 1440 px.

### Verification at the correction head

Every gate ran on the head that adds this response: the corrections
(`c11bb439`), the `epic/lightbox` merge (`590b7a08`), and this commit, which
adds documentation and rewraps one doc comment in `lightboxCallControls.ts`.

| Check | Result |
| --- | --- |
| Full Jest, Node 22.22.0 | **494 suites / 6,897 tests / 59 snapshots** (494 / 6,886 / 59 at `28a977e`: 7 tests added in `lightboxCallControls`, 4 in `LightboxAppRunControls`) |
| Full Jest, Node 18.20.8 (CI's engine) | **494 suites / 6,897 tests / 59 snapshots** |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to the `d255b8e` baseline |
| `npm ci` into a real `node_modules`, then `npm run build` with `verify:bundle`, twice | **Pass** both times, same hashes: `webview.js` `4eb8932c0555ecfc80b1a2f7b00c413656a858c415a10b24a0bd9244db3cef97` (the bundle the evidence renders), `extension.js` `0b1af8b7332bbb5f2ea3dd5a46b0f070e599dcac5d0b0507b271e3128445ccae` (unchanged: the corrections are webview-only) |
| `git diff --check` | **Clean** |
| Modules | `lightboxCallControls.ts` 257 lines, `LightboxHeadline.tsx` 81; the harness 498 and `headline-rerun.js` 88. Core imports no `vscode`; no new `any` |

No live or billable call: the provider is a stub, the prices are
synthetic, the text is public-domain *Alice*, and the model id is the
placeholder `provider/model-v1`.

### Left as it was

- **The writer's open questions are untouched:** whether a group re-run
  of the Opinion should keep the old one until the new one lands, and
  whether "Re-read this tile" should become "Re-analyze this tile".
- **The run line's note** keeps Slice 4D's words: "est. $… · the Opinion
  up to its digest bound". If one vocabulary is wanted, it could read
  "· the Opinion's input at digest limit", a copy change outside this
  finding.

### What changes in the PR body's claims

- **Cost:** "The Opinion shows 'up to $0.05'" becomes: the Opinion shows
  "≈ $0.05", and its name and tooltip add "input at digest limit".
- **Accessible names:** the example becomes "Analyze, call B:
  Characters, Voice, Subtext · ≈ $0.04"; names start with the visible
  label.
- **For the writer:**
  - item 4 (accessible name) is done;
  - item 3: the headline's button now also appears, as Analyzing…, while
    call A reads it, including a fresh board's first run.
- **Verification:** the counts and the `webview.js` hash below
  (`extension.js` is unchanged).
- **Visual evidence:**
  - 39 captures (ten states and three rerun steps), from eight host
    moments;
  - 189 errors against the base bundle (was 186);
  - new: 273 errors against the reviewed head's bundle.
