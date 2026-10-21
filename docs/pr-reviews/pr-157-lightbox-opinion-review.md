# PR Review — Lightbox Opinion (Slice 4D)

**Author:** okeylanders · **PR:** [#157](https://github.com/okeylanders/prose-minion-vscode/pull/157) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4d-opinion` → `epic/lightbox-slice-4c-story`
**Reviewed implementation head:** `f5e14514e06c297103bed1a773c945b3bf3478fa`
**Exact base / verified merge-base:** `797e1663ce534207d4086b032d8fd4caef55c14e` (PR #156)
**Scope:** 134 files · +6,522 / −243 · 3 commits
**Reviewed:** 2026-10-21 · **Reviewer:** Astra
**Mode:** independent source/spec review; deterministic production codec/digest/gates/carry/Bring and lifecycle probes; rebuilt production DOM checks; supplied visual evidence inspection; exact-base/head gate comparison

## Summary

**Verdict: Request changes.** Group F waits for the chapter calls, reads a bounded checked-board digest, derives standing from its citations and brings only the selected view. The exercised ownership, cancellation, partial-reread, text-change and measurement-race paths preserve those boundaries. Full head gates pass, with exact normalized lint parity against the stacked base.

One new deterministic P2 remains: **digits in opaque tile identifiers become permitted numeric evidence**. An invented count appearing only in a routing key passes the Opinion's figure rule, appears current in the production UI and can be brought to Workshop. A separate uncommon-double-quotation-mark gap is nonblocking P3. Neither conclusion is a judgement of live model quality.

The writer checkpoint and product decisions 15/16 remain **author-authored claims**. No authenticated writer acceptance was independently established. This is not native VS Code/live-provider acceptance, Slice 5 readiness or approval to freeze the saved-board format. No implementation change is made by this review.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Opaque host-ID digits authorize unsupported Opinion figures | **Open** |
| N-01 | Low / P3 · nonblocking | Fullwidth/CJK double quotation marks bypass the no-quotes rule | **Open** |

## F-01 — Do not derive numeric authority from routing identifiers

**Primary location:** [`lightboxOpinionItems.ts:330–332`](https://github.com/okeylanders/prose-minion-vscode/blob/f5e14514e06c297103bed1a773c945b3bf3478fa/packages/core/src/shared/constants/lightboxOpinionItems.ts#L330-L332), with the identifier rendered at [`106–110`](https://github.com/okeylanders/prose-minion-vscode/blob/f5e14514e06c297103bed1a773c945b3bf3478fa/packages/core/src/shared/constants/lightboxOpinionItems.ts#L106-L110).

`item()` builds `figures` by scanning the entire serialized digest block. That block includes `[item.key]` and the `q0`, `q1`, … addressing labels, not just the item's label, readings, host counts, paragraph addresses and quotes. The number matcher consequently treats decimal runs inside an opaque host token as figures the cited item shows.

Production reading IDs use the first eight characters of the run token, normally a UUID, plus group and ordinal (`LightboxGroupReply.ts:103`; `LightboxReadingRunner.ts:136`). Digits in those tokens have no evidentiary meaning. This is not a malformed external ID that normal host generation would rule out.

**Independent production reproduction:**

1. Start with the worked-example board. Give its existing headline tile the valid host-ID shape `lbt-87654321-A-1`. Leave its human-facing label, lines, counts and found quotes unchanged. None contains `87654321`.
2. Submit a strict, bounded Opinion whose O1 cites that tile's q0 and says: **“The image appears 87654321 times in the passage.”** Give Neutral the same body and a Why point referencing O1. Other required observations/views remain valid controls.
3. The real digest → frame/Opinion codec → assembly/gates path draws O1 and Neutral. The selected-view handoff preparer accepts the Opinion and transfers the invented count as its claim.
4. Change **only** the source tile ID and corresponding citation to `lbt-abcdefab-A-1`, preserving the human-readable evidence byte for byte. O1 is now withheld for an unsupported figure, and its dependent views are withheld.

The fresh production bundle independently confirms the impact: the witness board renders the sentence as both O1 and Neutral's body, without a stale warning and with Bring enabled. Clicking Bring posts the proper Neutral IDs-only request; the production-prepared handoff contains the same unsupported sentence. On the paired ID-only control, O1 and dependent views are withheld, the default falls back to a surviving view, and Neutral Bring is disabled. The UI is faithfully showing an incorrectly accepted host result, not introducing a separate rendering error.

The cited item's actual evidence is an ordinary headline about following a hurried white rabbit and falling, with small host counts and found chapter quotes. The huge number exists only in routing metadata. The stated conservative limitation permits a real displayed number to be attached to the wrong meaning; it does **not** make opaque identifier digits evidence. Smaller accidental token fragments have the same problem. Quote-index labels are also scanned by this construction.

**Requested correction:** Separate numeric-content authority from serialized identity. Extract supported figures from the intended evidence fields and allowed paragraph addresses, excluding host keys and q-index labels; retain the serialized text for digest/basis identity if desired. Add fresh, carry and selected-view Bring regressions with host-minted UUID digit fragments and ID-only negative controls. Preserve legitimate displayed counts, measured figures and paragraph numbers.

## N-01 — Recognize the supported double-quotation variants consistently

**Location:** [`LightboxOpinionPhrasing.ts:61,76–77`](https://github.com/okeylanders/prose-minion-vscode/blob/f5e14514e06c297103bed1a773c945b3bf3478fa/packages/core/src/infrastructure/lightbox/LightboxOpinionPhrasing.ts#L61-L77).

The module promises no double quotation mark of any kind, but its literal character class omits fullwidth `＂` and double quotation marks `〝〞`. The existing [`LightboxQuoteVerifier.ts:83`](https://github.com/okeylanders/prose-minion-vscode/blob/f5e14514e06c297103bed1a773c945b3bf3478fa/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L83) already recognizes these variants.

The synthetic sentence `The image says ＂the stone remembers＂.` passes as both an observation and Neutral body, and reaches the selected-view handoff even though those supposedly quoted words are absent from the source. The corresponding `〝…〞` case also passes. Exact straight-double-quote and ordinary-curly-quote controls are correctly withheld.

Normalize or share the recognized double-quote set, with paired tests. This is a bounded lexical coverage gap, not a claim that any finite phrasing check can prove intent or prevent all invented quotation. Single quotation marks/apostrophes are explicitly outside the current check. Because these variants are uncommon in ordinary English output, this is a nonblocking P3 rather than an additional P2.

## Scope, architecture and plan

Read the complete PR body; repository `AGENTS.md` / `.ai/central-agent-setup.md`; architecture guide; Lightbox ADR and D7 addendum; Slice 4D's original plan **and implementation notes**; epic progress/product-decision record; Slice 5 plan; both new debt records; and the relevant independent #155/#156 house reviews. No checkout-local `.agents/skills` directory was available. The implementation notes explicitly supersede several original-plan details; those declared deviations are not silently treated as regressions.

- **Contracts and composition:** F/opinion/opinion are registered in group, lens and tile-kind contracts, prompt/estimate planning, response dispatch, carry, UI and handoff. F's system request contains prompts 57 and 45, not the chapter protocol in `00-lightbox-shared.md`. The host's worked-example request regenerates byte-identically and its response draws all six observations and three views. Typical output is labelled a 1,400-token guess, not a measured provider result.
- **Execution:** A–E remain concurrent; F follows their settled outcomes, including validation/rejected-response recovery, rather than merely their network returns. Current-run checks bracket digest preparation and the F call. The digest is fetched by the press's retained board ID, not whichever unrelated board happens to be visible. A missing/evicted board or stopped owner cannot start F. Opinion-only reread requests one F call.
- **Digest and privacy:** Current measured/reading items are rendered explicitly; sparks, Opinion itself and withheld claims are not included. Found quotes and counted terms intentionally reach F, so “never the chapter” means no unsolicited chapter/context/path payload, **not zero manuscript-derived text**. Section heading words are not copied. Stale and pending lenses are omitted and named; length omissions and sections beyond 24 are separately disclosed. Logs record IDs, paths, sizes/key prefixes and outcomes, not the reading/Opinion/chapter wording. This is not a general no-paths-in-local-logs promise.
- **Strict decoding:** Unknown keys at block, views map, observation, citation, view and Why-point levels are counted in host-owned reasons without echoing their supplied names/values. All three view keys are required, but invalid individual views are withheld independently. Citations cannot borrow another tile's quote or quote a measured item. A view relying on a withheld observation is withheld whole.
- **Text and view rules:** Every observation and every view's headline/body/Why text receives the writer/rewrite/instruction/quotation/percentage/figure checks. Neutral is preferred, not mandatory for the whole tile to survive: any standing view can keep it drawn. This is an explicit implementation-note change from the original plan. Valid diagnosis controls pass alongside the rejecting controls; F-01 and N-01 are the exceptions described above.
- **Derived standing:** A shared function drives UI, Bring and landing logs. It checks the Opinion's own stale mark and each cited item's existence, currentness and original basis. Uncited rereads or unrelated digest-key changes do not automatically stale it. A cited pending reread makes it stale; a failed/cancelled reread that restores unchanged evidence can restore standing, while successful replacement keeps it stale. Carry follows quote words rather than blindly rebinding the old quote index and retains the original basis.
- **Transfer:** The webview sends board/tile/view identifiers, never replacement Opinion text. The host resolves the named view, refuses stale/withheld/quote-free selections, re-verifies selected citations and applies title/body/Why/quote bounds. It brings only that view's headline/body, up to three Why points and up to four unique verified quotes. Other views, observation prose, friction and digest/key do not travel. A missing selected quote cannot be borrowed from another view. Overlong normalized quotes are dropped whole, not cut.
- **UI:** The Opinion is last, full-width, with shared observations, three named pressed-state buttons and observation-specific focus/inspection. View preference is webview-only per board, bounded to twelve boards. Switching views, filtering or hiding/ignoring Opinion does not mutate another frame or cause an engine call. The tray's existing board-plus-tile identity intentionally represents one staged version, not all three views; switching the selected view after staging can still show Bound. Other tile kinds explicitly ignore the optional view field.
- **Module boundaries:** The press listener/landing was extracted into `LightboxPressRun`, and F's call/reply/gates have separate modules. New Lightbox modules remain below the house ceiling; the runner is 498 lines. The shared prompt-budget file is 607 lines versus 573 at base and was already outside `LIGHTBOX_MODULES`. Boundary/type/build gates pass; no new core `vscode` dependency is introduced.

## Digest bound and adversarial ownership evidence

The production bound is **9,000 tokens estimated by the engine's estimator**, not characters and not an exact provider-token promise. The initial whole-item loop reserves note space; a final render/estimate loop removes trailing readings until the full section fits. Measured items remain, with a first-24-sections cap. A reading too large for the remaining space ends the prefix; later smaller readings are not packed around it.

Independent valid codec/assembler boards stress this beyond the short worked example:

- A 64-reading ASCII-claim control fits at **7,122 estimated tokens**, with no omitted readings.
- Legal multibyte claim text at the field ceilings forces the default bound: **44 readings, 8,664 estimated tokens, 20 readings omitted**. The last held item is D-14; D-15 and all following readings are excluded. No item is cut in half, the board is unchanged and the disclosed omission count agrees with the retained prefix.
- **257 bound transitions** from 1,500 through 10,972 tokens preserve the final estimated bound and exact prefix/accounting invariants for the exercised board. This is not a claim that an arbitrary caller-supplied bound below the fixed measured payload can always fit; production uses 9,000.
- Synthetic path/context/raw-source/withheld/heading sentinels do not enter the digest. Forty measured sections contribute only the first 24 plus a 16-more note; allowed found quotes/count terms remain. Making stock stale and characters pending excludes twelve corresponding items while leaving current Voice evidence and does not misclassify those omissions as length cuts.

Fourteen additional production handler/service/runner lifecycle tests use held promises rather than timing-sensitive sleeps. They cover mixed success/failure/timeout/malformed chapter outcomes; asynchronous rejected-response capture; cancellation exactly at the last-settlement boundary; repeated presses and wrong-token cancellation; old F after replacement; close/reopen during F and during preparation; retained-board switching and eviction; changed text during F; cited versus uncited rereads; quote relocation; and both measurement-race orders. A cited changed standout makes a late or already-landed Opinion stale, while a changed average unrelated to its cited readings does not. No new lifecycle defect was found in those cases.

Source-change evidence proves cancelled carried state and rejection of a late response, **not immediate transport abortion on source rebuild**. Normal Stop and tab-close signal abortion were verified. This distinction follows the existing run lifecycle rather than expanding “cancelled” into an untested provider guarantee.

## Documented limits and inherited findings

- **Rendered-text citation basis:** The new medium debt correctly records that digest rewording changes a basis. Decide canonical data hashing or explicit basis versioning before saving boards in Slice 5. Current in-memory behavior is not falsely promoted to a saved-format compatibility guarantee.
- **Board-order truncation:** The new low debt explicitly records that trailing Group E readings are lost first. The independent saturated case confirms that bias and the accurate omission note. It is a declared design limitation, not a newly undisclosed correctness defect.
- **Conservative English heuristics:** Unlisted advice can pass; listed words in ordinary diagnosis can be over-withheld; spelled numbers such as “twice” are not checked; a genuine cited numeric value can be attached to the wrong measure; single quotes are not checked. Those limits are plainly documented. Five ordinary diagnosis controls passed. They are not recast as new findings merely because the gates are not a semantic parser.
- **Response ceiling:** F's declared 8,031-character maximum is below the existing 32,000-character response cap, unlike the already recorded Group E ceiling debt. Repository budget synchronization tests pass. No live completion-rate, tone, quality or cost conclusion follows from stub outputs.
- **Inherited #156 issues:** The compressed-column same-paragraph pressure count, blank-line leading YAML producing false Sections, independent-flex story-ribbon grid misalignment and fresh artifact order-withholding tally remain separate #156 findings. #157 does not materially fix or redefine them, and this report does not duplicate them as new Opinion findings. The known 500px Workshop composer clipping remains pre-existing debt.

## Independent verification

All new probes use synthetic or public-domain text and deterministic providers. A passing defect-witness test means the bad behavior and its control were reproduced, not that the implementation is approved. Probe files stayed outside normal repository collection; no tracked source/test/lockfile was modified.

| Check | Independent result |
| --- | --- |
| Exact-base full Jest | **419 suites / 5,802 tests / 59 snapshots passed** (263.908 s), completed independent #156 run at exact `797e166` |
| Head full Jest | **426 suites / 5,874 tests / 59 snapshots passed** (272.152 s) |
| Exact-base/head typecheck | All three stages passed on both |
| Exact-base/head lint parity | **0 errors / 1,133 warnings** on both; normalized file/rule/severity/message multiset identical, no additions/removals |
| Exact-base/head production build and `verify:bundle` | Passed; same three known webpack size/performance warnings |
| Head bundle identity | SHA-256 **`22c285aae56d6ae65d12e394336e0d6618be6334295fc8eadca21d4623882a6a`**, exactly matching the supplied evidence README |
| `git diff --check 797e166..f5e1451` | Passed |
| Independent codec/gates/carry/Bring | **54 tests passed** (4.38 s), including F-01/N-01 witnesses and rejecting controls, strict keys, field ceilings, valid diagnosis, quote identity and bounded selected-view isolation |
| Independent F lifecycle/ownership | **14 tests passed**, including the settlement, cancellation, reopen, text/measurement and cited/uncited races above |
| Independent digest/host-state regeneration | **5 tests / 2 suites passed** (10.806 s): four digest tests, including 257 bound transitions, plus the real host-state builder |
| Corrected #155 number-lifecycle controls at head | **15/15 passed**; every assertion retained, with the narrow legacy-fixture adaptation below |
| Corrected #155 phrase/pair controls at head | **19/19 passed**, including repeated-sentence pair transfer, source-span phrase witnesses, carry and transfer limits |
| Other #155 number controls at head | Rounding controls passed; **119 exact-threshold cases + 4 display controls** passed; **11 baseline/detector controls**, including 300 deterministic base-parity fixtures, passed; 360,000-word soft-cap control passed |
| Supplied host-state regeneration | `chapter.json`, `workshop.json` and `log.txt` **byte-identical** to committed evidence |
| Rebuilt production DOM | **274 assertions passed**: 260 Opinion/Workshop semantics/protocol checks, plus 14 F-01 witness/control assertions |
| Exact-head PR CI | [CI run 39530376969](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39530376969) completed successfully |

The exact-base completed full-suite/typecheck/build logs and lint JSON from the independent #156 review were inspected and reused rather than rerunning that identical base. Head gates were run independently here. Runtime: Node `v24.19.0`, npm `11.9.0`. The full head suite passed on its first complete attempt using `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB --cacheDirectory=<disk-backed-review-cache>`. Typecheck/build used the package scripts; lint used the repository ESLint CLI over `packages apps --ext ts,tsx` with JSON output. Initial digest-probe setup attempts needed module-resolution and stress-fixture corrections before the final passing run; they are not reported as product failures or hidden as successful tests.

The replay of the older fifteen number-lifecycle controls initially passed 11/15. Four legacy held-D cases compare every non-D group before/after D finishes; with this PR that set now includes F, which correctly changes from pending to settled after D. Those four fixtures were adapted only to turn the new Opinion lens off. Every original assertion and all A–E behavior remain unchanged; the other eleven controls needed no behavioral adaptation. F's new dependency is independently covered by the fourteen dedicated lifecycle tests above.

## Visual evidence and acceptance limits

All **24 supplied PNGs** were inspected as actual pixels: Neutral, Enthusiastic, Blunt, observation-hover, Bound-for-Workshop, withheld and stale Lightbox states, plus Workshop composer, each at 1440, 1000 and 500px. The wide/medium cards show readable view text and multi-column observations; the narrow card stacks view controls and observations. The known narrow Workshop composer exposes only the pill's left portion. The existing story-ribbon alignment issue is not reclassified as a new #157 defect.

Coverage is not overstated: the fresh 500px view captures stop around O4/partial O5, while the hover/Bound captures expose more lower-card content; the stale 500px capture does not show the entire observation list and Bring area. DOM checks establish their semantic states separately, not unseen screenshot pixels.

The PR body lists “the digest at its bound,” but the supplied `bound` state is **Bound for Workshop**, as its README, host state and actual image show. The committed example digest is about 2,988 estimated tokens, not 9,000. There is no supplied saturated-digest screenshot; the independent digest stress probes above cover the actual size bound. This is an evidence-description correction, not a missing runtime mechanism.

The freshly rebuilt bundle's exact hash matches the author's recorded bundle, and regenerated host states are byte-identical. The builder exercises real services, handlers, runner, codec, prompt construction, Workshop session and seed delivery behind controlled filesystem/baseline/model/provider fixtures. It runs A, B, D, E and then F; C is disabled. Its source is the first eight paragraphs of the public-domain *Alice's Adventures in Wonderland* opening, and `WRITER_AVERAGES` is synthetic. It does not establish writer-average correctness on a private project or real model quality.

The original `facts.json` and `errors.txt` are not committed. No-page-error/no-document-overflow claims therefore remain author reports, not fresh reviewer browser measurements. A document-width check would not by itself rule out inner clipping. The 274 production-bundle DOM assertions cover rendering, focus/pin/Escape, observation-specific inspection, view persistence/eviction, filtering, pending/correlation/tray behavior, IDs-only transfer, stale/withheld blocks and the Workshop pill. They do not establish CSS geometry, browser hit-testing, native keyboard activation or native VS Code IPC.

No previously denied local-file browser route, sandbox-blocked browser launch or unauthorized user computer was retried. No live/billable provider call or private manuscript was used. The author-reported real-chapter checkpoint and decisions 15/16 remain separate from the independently verified code and fixture evidence.

The review's final remote check at **02:32 UTC** confirmed the same open, unmerged PR, implementation head `f5e1451`, stacked base `797e166` and successful exact-head CI. The **03:48 UTC prepublication fetch** again confirmed those exact head/base commits. The local merge-base is exactly `797e166`; no retargeted-base result is implied. The report's findings and verification evidence are unchanged for publication.

## Next step

Correct F-01 with content-versus-identity regression controls, then re-review the changed head. N-01 is a small nonblocking quote-class consistency correction. Keep #156's open findings, the native/live writer checkpoint and the pre-Slice-5 basis decision visible as separate work. Recheck head/base and CI if either branch moves.

Publication is limited to **this review report only**. No implementation edit, GitHub comment/formal review, merge or deployment accompanies it. Post-publication CI is checked separately against the exact report commit, not assumed from the implementation-head result above.


## Author response (2026-10-21)

**F-01: fixed. N-01: fixed.** Both fixes are in `a35d4b9`. The docs commit
on top of it reruns the visual evidence and records the review in the
slice notes, the epic README and the agents guide. Nothing above this
section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | An item's allowed figures come only from what it shows as evidence: its label, lines and quotes, with their paragraph addresses. Never its key, never its quotes' q-numbers. | `LightboxOpinionIdentityDigits.test.ts` (9); `LightboxOpinionRun.test.ts`, the host-minted id cases (2) | `a35d4b9` |
| N-01 | Low / P3 · nonblocking | **Fixed** | The phrasing check uses the quote verifier's own double-quote set, now exported as `LIGHTBOX_DOUBLE_QUOTATION_MARKS` | `LightboxOpinionReadings.test.ts`, the N-01 case (1) | `a35d4b9` |
| PR body | Evidence description | **Corrected** | The `bound` evidence state is "Bound for Workshop", not the digest at its bound. The evidence README now says so, and the slice notes record a saturated-digest result | The new digest case in `LightboxOpinionDigest.test.ts` (1) | docs commit |
| Evidence | Evidence completeness | **Corrected** | `facts.json` and `errors.txt` are committed beside the screenshots, with the clean-build bundle hash | — | docs commit |

### How each new test was checked against `f5e1451`

**F-01.** I reverted the fix's one line in place, so `item()` again scans
the whole digest block, as at `f5e1451`. Then I ran the 11 new F-01 tests.
- **Failed:** the 5 digit witnesses (items, fresh, carry, Bring, and the
  real-handler run), each at its behavioral assertion. Bring prepared
  Neutral with the claim "The image appears 87654321 times in the
  passage.", as you found.
- **Passed:** the 4 id-only controls, the run-level control and the 2
  displayed-figure controls.

With the fix restored, all 11 pass.

**N-01.** I ran the paired test with the verifier's set exported, which is
a behavior-neutral refactor (all 37 Lightbox infrastructure suites pass),
and with `f5e1451`'s phrasing class. It failed at the first fullwidth case:
the observation was drawn. With the shared set, it passes.

**The saturated-digest case** in `LightboxOpinionDigest.test.ts` is a new
bound check, not a fix witness. It passes on `f5e1451` too. The message of
`a35d4b9` lists it with the tests that fail there, which overstates it.

### F-01: an id is identity, never evidence

**Root cause.** The finding is correct. `item()` in `lightboxOpinionItems.ts`
used one string for two jobs:
- **Identity.** The `basis` that standing compares.
- **Numeric authority.** The `figures` an Opinion citing the item may
  state.

That string is the item's digest block. Its first line is `[key] label`,
and each quote line starts `qN ¶n:`. A host id carries the first eight
characters of the run token, and a quote line carries its own index, so
digits that mean nothing became figures the item "shows". On the fixed
`5b1e09c4` prefix, `5`, `1`, `09` and `4` were already allowed this way.

**Fix.**
- **Figures come from the item's evidence.** `item()` now builds `figures`
  from `evidenceText(label, lines, quotes)`: the label, each line, and each
  quote as `¶n text note`. The digest block and `basis` are unchanged, so
  no digest, key or standing moves.
- **Documented.** The module note and the `figures` field say so
  ("Numeric authority is narrower than identity").
- **Carry and Bring are covered by the same fix.** Carry gates against the
  rebuilt board's items. Bring sends only views that passed those gates.

**Tests.** Each case is read on two boards that differ only in their ids'
run prefix: `87654321` (the witness) and `abcdefab` (the id-only control).
The run-level cases mint UUID-shaped tokens through the real handler.

| Test | Witness and control | On `f5e1451` |
| --- | --- | --- |
| Item figures | Every item has the same figures whatever digits its key holds, and every allowed figure is one its label, lines or quotes show | The digit board's items allowed `87654321`, and every quoted item allowed its q-numbers |
| Displayed figures (both prefixes) | The worked example still draws whole: its stated figures are 29.9, 14.3, 12.2 and 30, ¶5 and ¶7. "The watch is mentioned 2 times, first in ¶4." still stands on the watch's host counts | Passed (a control) |
| Fresh (both prefixes) | O1 cites the headline's q0 and says "The image appears 87654321 times in the passage."; Neutral's body says the same. O1 is withheld for its figure; Enthusiastic and Neutral are withheld for weighing it; Blunt stands | On digit ids, O1 and Neutral were drawn |
| Carried (both prefixes) | An Opinion drawn on the headline, with O1 then stating the invented count, is carried onto changed text. The headline carries under the same id, and O1 is withheld for its figure | On digit ids, O1 stayed drawn |
| Selected-view Bring (both prefixes) | Neutral is refused as withheld. Blunt travels, and its title, claim, points and quotes never state the digits (its ids do, as every id of the run does) | Neutral was brought with the invented count as its claim |
| Real handler, host-minted tokens `87654321-4c1d-…` and `abcdefab-4c1d-…` | A press through `LightboxReadingHandler`, the runner and `LightboxOpinionReply`: O1 is withheld for its figure, only Blunt stands, and Bring of Neutral is refused | On the digit token, O1 and Neutral were drawn |

### N-01: one double-quote set

**Root cause.** Correct as found. The phrasing check kept its own class,
`["“”„‟«»]`. The verifier's set also holds `″`, `〝`, `〞` and `＂`.

**Fix.** `LightboxQuoteVerifier` exports its set as one string,
`LIGHTBOX_DOUBLE_QUOTATION_MARKS`, and builds its own pattern from it. The
phrasing check builds its pattern from the same string, so the two cannot
drift. The verifier's behavior is unchanged. The phrasing module's note
lists the set.

**Tests.** In `LightboxOpinionReadings.test.ts`, one case covers all of
this:
- **Paired.** ＂…＂ and 〝…〞, then straight and curly as controls, each
  withheld in an observation and in Neutral's body, with the host's
  quotation reason.
- **The whole set.** Every mark in `LIGHTBOX_DOUBLE_QUOTATION_MARKS`
  withholds a part.
- **The verifier still folds.** A quote the model wrapped in fullwidth
  marks is still found.

Single quotation marks stay outside the check, as the module states.

### Evidence and the PR body

- **The `bound` state.** It is "Bound for Workshop", as your report
  found. The evidence README now says no state shows a saturated digest.
- **A saturated-digest result** is in the slice's limits, from a new case
  in `LightboxOpinionDigest.test.ts`:
  - **The board.** Every chapter reading of the every-lens *Alice* board,
    copied four times under new ids, makes 256 readings.
  - **What the default bound holds.** 80 of them (all of group A's copies
    and part of group B's) in 8,606 estimated tokens. The other 176 are
    counted by lens in the closing note.
  - **The invariants.** Every held item is whole, the measured items stay,
    and the held readings are the board-order prefix.
  - **The bias** is the one the board-order tech debt records.
- **Regenerated.** `states/` came out byte-identical. The screenshots were
  re-rendered from the clean-build bundle, SHA-256
  `3e3573eda7651fecab4180b8bedffb6f3599448d1094b521b5e131946ca31d50`.
  - `facts.json` is identical to the first run's, and `errors.txt` is
    empty. Both are now committed.
  - 20 of the 24 screenshots are byte-identical. The other four differ in
    4 to 19 pixels of the 1440 px header strip beside the model picker,
    which is rendering noise, not content.
  - The README now notes that the overflow fact is a document-width
    check.

### Contract changes

- **New export.** `LIGHTBOX_DOUBLE_QUOTATION_MARKS`, in
  `LightboxQuoteVerifier`.
- **Narrower figures.** `LightboxOpinionItem.figures` is now only the
  numbers an item shows as evidence.
- **Unchanged:** the digest's wording, the digest key, every basis, the
  worked example, and every protocol shape.

### Verification

| Check | Result |
| --- | --- |
| `npx jest` | 427 suites / 5,887 tests / 59 snapshots (from 426 / 5,874 / 59 at `f5e1451`) |
| `npm run lint` | 0 errors / 1,133 warnings, identical per file and rule to `797e166` |
| `npm run typecheck` | Passes |
| `npm run build` (with `verify:bundle`) | Passes; `webview.js` SHA-256 `3e3573eda7651fecab4180b8bedffb6f3599448d1094b521b5e131946ca31d50` |
| `git diff --check` | Passes |

No live or billable call was made. #156's open findings are not touched
here: the 4C branch carries them, and its fixed head will be merged into
this one when it lands.

## Independent re-review (2026-10-21)

**Reviewed correction head:** `40a9317e07dccb07ba7190d29d9e416f9e370aaf`
**Delta:** `e4400cd4145fd87608ffe5a44a59a7cf3998c751..40a9317` (fix `a35d4b9` plus its documentation/evidence commit; 18 files, +2,385 / −20). The original implementation comparison remains `f5e1451`; `e4400cd` added only this report. The original report and the complete author response above are preserved verbatim.

**Current verdict: Request changes. F-01 is partially fixed, but remains open at P2. N-01 is fixed.** The original random-ID witness is now rejected, and the double-quote variants are blocked. However, a real Subtext item's inline `q0` annotation still becomes numeric authority, so the promised quote-index exclusion is incomplete. This is the remaining part of F-01, not a new unrelated finding. Full repository gates pass despite the residual counterexample.

| ID | Current disposition | Independently established result |
| --- | --- | --- |
| F-01 · P2 | **Partially fixed; open** | Host-ID digits and ordinary quote-prefix labels no longer authorize figures. Subtext's inline `q0` still authorizes an unsupported zero, fresh and on carry; fresh Bring transfers it. |
| N-01 · P3 | **Fixed** | Opinion uses the verifier's shared double-quote set; fullwidth/CJK witnesses and straight/curly controls are withheld. Existing verifier behavior is preserved. |
| Evidence description/completeness | **Corrected, with the limits below** | The PR body/README now identify Bound for Workshop correctly; `facts.json` and empty `errors.txt` are committed. No saturated-digest screenshot or fresh native/browser acceptance is claimed. |

### F-01 residual — Subtext's inline q0 is still treated as evidence

**Locations:** [`lightboxOpinionItems.ts:254–255`](https://github.com/okeylanders/prose-minion-vscode/blob/40a9317e07dccb07ba7190d29d9e416f9e370aaf/packages/core/src/shared/constants/lightboxOpinionItems.ts#L254-L255), [`343`](https://github.com/okeylanders/prose-minion-vscode/blob/40a9317e07dccb07ba7190d29d9e416f9e370aaf/packages/core/src/shared/constants/lightboxOpinionItems.ts#L343) and [`352–353`](https://github.com/okeylanders/prose-minion-vscode/blob/40a9317e07dccb07ba7190d29d9e416f9e370aaf/packages/core/src/shared/constants/lightboxOpinionItems.ts#L352-L353).

The new `evidenceText(label, lines, quotes)` correctly excludes the item's key and the generated q-prefixes before each quote. But `kindLines` also renders this Subtext annotation inside `lines`:

```text
speaker: White Rabbit · the said line is q0; the claim is what it is read as meaning
```

`evidenceText` scans every line unchanged, including that routing annotation. On the actual every-lens Alice worked-example board, the item `Subtext · Said / meant: White Rabbit` therefore has allowed figures **`0` and `4`**. Four is a legitimate paragraph address. Zero appears nowhere in the title, claim, speaker or source quotes; it comes only from `q0`.

**Production reproduction:** Enable Subtext, cite that tile's first quote from O1, and give O1 and Neutral's body the sentence **“The passage contains 0 spoken lines.”** Keep a second valid observation and the required views. The real digest/codec/gates draw O1 and Neutral, and selected-view Bring prepares the unsupported sentence as its claim alongside the verified ¶4 quote **“Oh dear! Oh dear! I shall be late!”**. A separate run through the real reading handler/runner reproduces the same acceptance after enabling Subtext; this is not merely a hand-built item-map result.

The freshly rebuilt production webview renders the zero claim as current in O1 and Neutral, displays the Rabbit's actual speech beneath it, and enables Bring. Clicking sends the correct Neutral IDs-only request; the prepared host handoff contains both the unsupported zero claim and the verified speech. As before, rendering is faithful to the incorrectly accepted host result.

**Controls and carry:**

- A matched fixture retaining the same ID/title/claim/found quotes but using the ordinary headline kind removes the Subtext-specific annotation. It no longer allows zero: O1 is withheld for its figure, dependent views are withheld and Neutral Bring is refused. Adding an actual displayed `0` to that control's title restores numeric eligibility, as the documented rule permits.
- An ordinary three-quote reading excludes `q0`, `q1`, `q2`, its ordinal and its eight-digit ID fragment while retaining genuine counts and ¶11/¶13/¶17. This confirms the correction works outside the inline annotation path.
- Carry onto changed text retains the false-zero observation. Its Opinion correctly becomes stale, and **stale Bring correctly refuses it**. The transfer failure is demonstrated on the fresh/current board, not misrepresented as a stale-ownership bypass.

The cited zero is an expressly excluded quote address, not a genuine displayed count reused with the wrong meaning. The conservative semantic-limit caveat therefore does not dispose of this witness. The added item-level regression derives its expected figures from the same `item.lines`, so it inadvertently accepts this annotation too.

**Remaining correction:** Keep host-authored quote-routing annotations outside numeric authority even when they appear within a descriptive line. Use semantic evidence fields or otherwise distinguish those annotations, preserving genuine numeric content and paragraph addresses. Add the real Subtext witness, its paired annotation-free/displayed-zero controls, host execution, carry and fresh selected-view Bring to the regression set. Do not globally strip legitimate source text merely because it resembles a quote key.

### What is independently fixed

The original 54-probe suite was first replayed with its old bad-acceptance assertions intact: 52 passed, and only the two former bug witnesses failed because the bad behavior was rejected. Changing only those expectations to require rejection, while retaining the controls, makes all 54 pass. In particular, `87654321` in a host ID no longer authorizes that invented count or its Bring payload, and the same-content letter-ID control still rejects it. The original valid diagnosis and bounded-transfer cases remain passing.

For N-01, all eleven characters in `LIGHTBOX_DOUBLE_QUOTATION_MARKS` are prohibited in Opinion. Direct old/new verifier comparisons preserve results for the recognized typography and 84 normalized/missing-span cases; the independent 19 phrase/pair controls, including 93 term-span cases, also pass. One initial probe assumed stronger double-prime wrapper handling than the old verifier provides; it was corrected to compare old/new behavior rather than manufacture a regression. Single quotation marks and the other documented English heuristic limits are unchanged. **N-01 is closed.**

### Re-review verification

| Check | Independent corrected-head result |
| --- | --- |
| Full Jest | **427 suites / 5,887 tests / 59 snapshots passed** (195.407 s) |
| Typecheck | All three stages passed |
| Lint | **0 errors / 1,133 warnings**; exact normalized file/rule/severity/message multiset parity with the original reviewed head, and transitively the unchanged implementation base |
| Production build / `verify:bundle` | Passed; same three known webpack size/performance warnings |
| Rebuilt bundle | SHA-256 **`3e3573eda7651fecab4180b8bedffb6f3599448d1094b521b5e131946ca31d50`**, exactly matching the refreshed evidence |
| Independent gate/correction probes | **70 passed / 2 failed** in the final 72-test run: both failures are required-rejection assertions for the residual Subtext q0 issue, at item/gate and real-handler boundaries. The adapted original 54 are included and pass. |
| Lifecycle / digest / host-state replay | **14/14 lifecycle tests; 5/5 digest/builder tests** passed, with original assertions unchanged |
| Phrase/pair regression replay | **19/19 checks** passed, including 93 term-span cases |
| Production DOM | **303 assertions passed**: 260 original plus 43 correction/residual/control assertions against the new bundle; original ID-digit rejection, current Subtext-zero acceptance and its annotation-free rejection control reach their expected UI states |
| Host-state and digest provenance | `chapter.json`, `workshop.json`, `log.txt`, the independent digest texts and their summary are byte-identical to the original independent regeneration; host states also match the current committed evidence |
| Delta whitespace | `git diff --check e4400cd..40a9317` passed |
| Correction-head PR CI | [Run 39542996143](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39542996143) succeeded |

Full gates used the same Node/npm environment and disk-backed, one-worker commands as the original review; the suite passed on its first full attempt. The independent required-rejection failures are not hidden by the green repository suite. No implementation, tracked test or lockfile was edited. The old head/base gates were reused, not falsely reported as rerun. Only the two-commit correction delta and affected boundaries were re-reviewed; #156's unchanged findings were not reopened or presumed fixed.

### Refreshed visual evidence and remaining acceptance boundaries

All four changed PNGs were inspected as actual pixels and compared with the earlier committed images. **Twenty of 24 are byte-identical.** Blunt, Enthusiastic and stale at 1440px each change exactly four pixels in bounding box `(1007,22,1009,24)`; Workshop at 1440px changes nineteen pixels in `(735,22,1009,28)` (right/bottom edges exclusive). Those are header-control pixels, consistent with minor rendering variation; the card/observation/composer content is unchanged. The earlier inspection of the twenty identical images remains applicable. Existing narrow clipping and the inherited ribbon alignment issue remain outside this correction's closure.

The newly committed `facts.json` contains 24 state/width entries, all reporting `horizontalOverflow: false`; `errors.txt` is zero bytes. These are now inspectable author capture artifacts rather than missing files. Their claimed identity to an uncommitted first-run facts file cannot be independently established. The exact rebuilt-bundle hash and regenerated host-state parity are verified, but the captured overflow/error results are still **not a fresh reviewer browser or native VS Code run**. Document-width measurements do not exclude inner clipping.

The PR body and README now explicitly say `bound` means Bound for Workshop and no screenshot shows a saturated digest. The new saturated-digest test is a bound control, not an old-head failing fix witness, as the author response now acknowledges. The original independent default-bound/257-transition probes still pass unchanged. No live/provider-quality, private-manuscript, authenticated writer-decision or Slice 5 saved-format acceptance is inferred.

**Next step:** finish F-01's quote-address exclusion for Subtext, then re-review that targeted change. N-01 needs no further correction. Report-only publication preserves the original review and author response; it does not authorize implementation changes, comments/formal review, merge or deployment. Exact post-publication CI is checked separately.


### Author response to the re-review (2026-10-21)

The F-01 residual is fixed in `57ebfd7`. Slice 4C's PR #156 fixes are
merged in, and everything was verified again. Nothing above this section was
edited.

| Item | Disposition | Commit | Proof |
| --- | --- | --- | --- |
| F-01 residual · P2 (Subtext's inline `q0`) | **Fixed** | `57ebfd7` | Run against `40a9317`'s `lightboxOpinionItems.ts`, the 6 new witnesses failed and the controls passed; with the fix, all pass. Details below |
| Slice 4C merge (PR #156 fixes, `e7e1536`) | **Merged and verified again** | `9585609` (merge), `3a2e507` (Opinion re-check) | No conflicts in code. The digest's sections now follow 4C's front-matter fix, with a new case that fails before the merge. The 4D harness measures 4C's ribbon grid: 0 px apart in every state and width |

**What was wrong.** Your finding is correct. `kindLines` writes
host-authored routing inside a line, and `evidenceText` read whole lines.
- I audited every branch and found one more of the same kind: a gravity
  field's degree labels "1°, 2°, 3°". They lent 1, 2 and 3 to every field.
  On the every-lens board, the Fire field allowed 3 with only 2 hits.
- Every other number a line writes is the reading's or the board's own
  value: a count, a share, a claimed pull or affinity, a ¶ address, a
  measured figure, a section's number and how many there are, or a unit.
  Movement numbers are Roman numerals.

**Fix.**
- **Annotated lines.** A line with routing or labels in it is now
  `annotated(shown, evidence)`. `shown` is rendered exactly as before, so
  no digest, key or basis moves. Only `evidence`, the line without the
  routing or labels, feeds the item's figures. Subtext's evidence is its
  speaker; a gravity field's is its hits by degree, without the labels.
- **No global stripping.** Nothing strips q-like text from real content: a
  title or quote that shows a 0 still allows it.

**Tests.** Expected figures are literal values read off the board's data.
- **Literal figures** (`LightboxOpinionAnnotations.test.ts`): the White
  Rabbit's said/meant tile allows {4}, and Fire allows
  {0, 0.18, 1, 2, 4}. Ledger, the headline tile and the measured headline
  are unchanged.
- **The digest's wording**, pinned line for line: the `q0` note still reads
  as before.
- **Your witness**, "The passage contains 0 spoken lines.", is withheld in
  three places:
  - fresh: Neutral and Enthusiastic go with it, and Blunt stands;
  - on carry: the said line carries under its id, and O1 is withheld for
    its figure;
  - through fresh selected-view Bring: Neutral is refused, and Blunt
    travels without it.
- **The degree witness.** "borrowed 3 times" is withheld, and the field's
  own "2 times" stands.
- **Controls.** The same tile as an ordinary kind withholds the zero too. A
  displayed zero in the title stands, on either kind.
- **Through the real handler and runner** (`LightboxOpinionRun.test.ts`):
  every lens on, a press whose F cites the said line. The zero is withheld
  and Bring of Neutral is refused. The control, "The Rabbit speaks once, in
  ¶4.", is drawn and brought.
- **My earlier item-level test** now asserts literal figures, as you
  noted, instead of deriving them from the lines under test.
- **Against `40a9317`.** The witnesses failed at their behavioral
  assertions: an extra `0` in the figures; O1 drawn, fresh and carried;
  Neutral brought with the zero claim; the real-handler O1 drawn. Restored,
  all pass.

**Verification at this head.**
- Checks: full `npx jest` passes, with 429 suites / 5,910 tests / 59
  snapshots; lint is 0 errors / 1,133 warnings, identical per file and
  rule to `797e166`; `npm run typecheck` passes; `npm run build` with
  `verify:bundle` passes; `git diff --check` passes.
- The bundle was built after `npm ci` into the worktree's own (non-symlinked)
  `node_modules`, from an empty `dist/`. `webview.js` SHA-256:
  `55276cadc0548dbb8af861bf14614b2bdb6d9976c4bee21692b36154ba3276fd`.
- The evidence was rerendered from that bundle. `states/` was
  byte-identical, and `facts.json` is identical apart from the new
  `ribbonGrid` entries. `errors.txt` is empty.
- No live or billable call was made.
