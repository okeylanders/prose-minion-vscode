# PR Review — Lightbox Carried Subtext Evidence Consistency

**Author:** okeylanders · **PR:** [#153](https://github.com/okeylanders/prose-minion-vscode/pull/153) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4-followups` → `epic/lightbox`
**Reviewed implementation head:** `efc9e15db6aa4ffd7e2a46ef45c1e9ca307b4bd9`
**Verified base / merge-base:** `1532a465d3090d9c0edbe1ab9020d83d06b6b71d` (merged PR #151)
**Scope:** 9 files · +234 / −18 · 3 commits; production changes confined to three Lightbox modules
**Reviewed:** 2026-10-20 · **Reviewer:** Astra
**Mode:** independent source/spec review; production codec/assembly/carry counterexamples and exact-base negative controls; rebuilt-production-bundle DOM checks; regenerated evidence states; full base/head tests, typechecks, builds and normalized lint comparison

## Summary

**Verdict: No new actionable findings. PR #151 F-07 is Addressed.** The carried Subtext pair now leads its evidence with the same dialogue-filtered quote used by its said line. The inspector therefore displays the selected speech and its actual match label instead of an earlier narration copy. Distinct retained context remains after the said line, and missing-said accounting is preserved.

This closes the narrow nonblocking consistency finding, not every possible difference between fresh provider-wire assembly and carrying retained verified text. The existing moved-speech and provenance limits below are independently reproduced on both base and head. They are not upgraded into regressions or release blockers.

This is code-review clearance within the stated evidence, not a merge instruction, native VS Code acceptance, live-provider quality validation, or writer acceptance. The real-chapter output checkpoint before Slice 5 remains required.

## Resolution ledger

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| PR #151 F-07 | Low / P3 · nonblocking | Carried Subtext inspector evidence can select equivalent narration instead of the selected said span | **Addressed** at `efc9e15` |
| New findings | — | No actionable new defect established by this review | **None** |

The original [PR #151 review and appended author response](pr-151-lightbox-lineage-subtext-spark-review.md) remain unchanged by this report. Its historical F-07 ledger describes that earlier review; this report records the follow-up disposition.

## Scope and design

Read the original PR #151 findings, independent re-review and complete appended F-07 author note before reviewing this change. Repository `AGENTS.md`, Lightbox ADR D3/D4/D7/D11, the updated Slice 4 notes and new moved-speech debt record informed the review. No checkout-local `.agents/skills` directory was present.

- [`lightboxSameQuote` and `lightboxSaidLedEvidence`](https://github.com/okeylanders/prose-minion-vscode/blob/efc9e15db6aa4ffd7e2a46ef45c1e9ca307b4bd9/packages/core/src/infrastructure/lightbox/LightboxDialogueAnchor.ts#L40-L56) centralize paragraph/text identity and said-first composition. Identity deliberately uses exact retained chapter text and paragraph, not fuzzy equality or the match label. The helper removes repeats of said; general context deduplication remains with each caller.
- [Fresh assembly](https://github.com/okeylanders/prose-minion-vscode/blob/efc9e15db6aa4ffd7e2a46ef45c1e9ca307b4bd9/packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts#L283-L295) delegates the existing composition rule to that helper. Its verifier, dialogue filter and quote-check tally are not replaced.
- [Stale carry](https://github.com/okeylanders/prose-minion-vscode/blob/efc9e15db6aa4ffd7e2a46ef45c1e9ca307b4bd9/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L178-L207) skips the original said quote in the generic evidence loop, independently re-finds it through the dialogue filter, then prepends the selected quote. A genuinely missing said line is recorded once and first in the lost list. The existing kind-specific gate still decides whether the tile survives.
- The [inspector projection](https://github.com/okeylanders/prose-minion-vscode/blob/efc9e15db6aa4ffd7e2a46ef45c1e9ca307b4bd9/packages/core/src/presentation/webview/hooks/domain/lightbox/controllers/useLightboxInspector.ts#L231-L240) remains a direct view of the host's evidence. No frontend workaround, duplicate matching algorithm, new host dependency, persisted schema or provider behavior is introduced. The three changed production modules are 90, 368 and 275 lines.

## Independently verified behavior

### F-07 reproduction and complete evidence

Starting with `"Don't go back," Ada said.`, assemble a Subtext pair whose said quote is `Don't go back`, then carry it onto:

> Don't go back was scribbled in the margin. “Don’t go back,” Ada said.

At the base, said correctly selects the curly speech but the sole evidence entry selects the straight-apostrophe narration as exact. At this head, both said and evidence are `{ paragraph: 1, text: 'Don’t go back', match: 'normalized' }`. The production inspector reports “found with typography folded”, equal to fresh assembly for this reproduction.

Independent probes cover eight normalization families: apostrophe, whitespace, dash, NFKC ligature, fullwidth characters, combining accents, ellipsis, and supplementary characters beside apostrophes. They check the entire evidence array, said value, inspector projection, stale marks and non-mutation of the original group. Additional cases establish:

- Context order survives; duplicate context and repeats of said are removed appropriately. The same words in a different paragraph remain distinct evidence. Multiple narration copies cannot eclipse the selected speech; exact speech retains precedence over normalized speech.
- Missing said plus missing/surviving context produces the correct loss order and exact tally without counting said twice. Repeated carry does not add the same loss again. Narration-only words are withheld as not dialogue, not falsely counted as absent.
- Speech that moves with no competing matching narration follows to its new paragraph; evidence and paragraph addresses follow it. Notes, deeply frozen old groups, repeated typography edits and the original stale hash are preserved.
- The new helper returns a fresh array for absent said and does not mutate its inputs. Its API-only checks are excluded from the base negative control rather than counting missing exports as behavioral failures.

### Production frontend witness

The exact rebuilt production webview was run in JSDOM with a host board containing the independently generated carried group. **14 assertions passed:** the card and pinned inspector show the curly speech; only that quote appears, with the normalized label; the stale Bring button remains disabled and emits no handoff; a fresh replacement retains the same evidence and label while clearing the stale gate. Inspection triggers no reading run or Workshop send.

A retained **49-assertion** Lightbox/Workshop DOM replay also passes against this bundle: pin/Escape, overlay dismissal, host-confirmed Spark dismiss/undo, IDs-only Bring, repeated/foreign-result guards, tray changes, stale gating and pill removal. These are DOM/protocol witnesses under controlled transport, not browser-layout or native-host acceptance.

## Bounded parity and pre-existing limits

Four diagnostic tests pass on both exact base and head. They assert existing behavior, not safe-behavior fixes:

1. **Moved speech behind narration.** Matching narration in the old paragraph can prevent following speech to another paragraph. If the old paragraph has no match, a nearer narration-only paragraph can likewise mask more distant speech. The tile is withheld as not dialogue. This PR does not change nearest-match relocation; the new [Low-priority debt record](../../.todo/tech-debt/2026-10-20-lightbox-carried-said-line-moved-speech.md) captures the original case.
2. **An omitted duplicate wire cannot be reconstructed.** If an initially identical context wire is deduplicated against said, carry retains no separate copy of that wire. After narration and speech acquire different typography, fresh original-wire assembly can show both, while carry shows one. The base's one quote is narration; this head's one quote is correctly the selected speech. F-07's said-led invariant is fixed, but universal original-wire/fresh/carry equality is not established.
3. **Match labels describe the comparison actually performed.** An ASCII provider quote may initially match curly source text through normalization. An unchanged carry rechecks the retained curly source text and labels it exact; fresh original-wire assembly still labels it normalized. The actual source words agree. This retained-source provenance difference predates the PR.

The author's worked-example sweep is useful coverage of every drawn tile's evidence/said/witness across its selected edits. It is not a proof for all possible edits or provider inputs. No request to broaden this small cleanup is implied by the limits above.

## Fresh verification and negative controls

All runs used isolated base/head checkouts without tracked implementation edits. Runtime: Node `v24.19.0`, npm `11.9.0`; repository CI separately uses Node 18. Independent scratch suites and the evidence builder are excluded from the ordinary repository totals.

| Check | Independently observed result |
| --- | --- |
| Base `npm test -- --runInBand` | **385 suites / 5,457 tests / 2 snapshots passed**, 186.348 seconds |
| Head full Jest suite | **385 suites / 5,461 tests / 2 snapshots passed**, 175.646 seconds |
| Base and head `npm run typecheck` | **All three stages passed** on each: core, webview, extension |
| Base and head `npm run build`, including `verify:bundle` | **Passed**; three existing webpack size/performance warnings |
| Base and head ESLint JSON comparison | **0 errors / 1,133 warnings** each; file/rule/severity/message multiset identical |
| `git diff --check 1532a46..efc9e15` | **Passed** |
| Independent synthetic codec/assembly/carry/inspector suite | **28/28 passed**; includes four pre-existing-limit diagnostics and four helper-API tests |
| Same independent assertions against archived exact base | **14 behavioral failures / 10 passing controls and diagnostics**; four new-helper API tests intentionally skipped |
| Head's complete authored carry-parity suite against exact base | **3 failed / 7 passed**; the two F-07 evidence cases and narration-first portion of the full projection sweep fail; lost-said control and prior cases pass |
| Regenerated Slice 4 host evidence builder | **Passed**; chapter, Workshop and log files byte-identical to committed evidence |
| Rebuilt-production-bundle DOM | **14 new F-07 assertions + 49 retained assertions passed** |
| Exact implementation-head CI | Both [PR verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39369423883/job/118453674664) and [branch verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39369351880/job/118453451160) passed install, typecheck, tests, lint and build |

The first head full-suite attempt was killed with exit 137 while base/head gates ran concurrently; no assertion failure preceded the kill. It is not counted as a pass. The completed head rerun above used `NODE_OPTIONS=--max-old-space-size=4096` and ran without a concurrent full suite. Cross-version independent probes disable type diagnostics to compare behavior; they do not replace the successful repository typechecks. The author-suite negative control retains type diagnostics and redirects only the two relative test-fixture imports to equivalent base aliases.

## Evidence provenance and acceptance limits

- The production `webview.js` built with dependencies materialized inside the head checkout has SHA-256 **`dc53b9eaaf02eec6c7ac6e9225c9a6b5abb94445956745c130d68ef1d2b691a4`**, identical to the prior independently verified PR #151 bundle. Both DOM replays used that exact artifact. Initial builds through an external dependency symlink produced the same alternate hash on base and head; materializing dependencies restored the recorded bundle hash. This was build-path provenance, not a frontend code change.
- The committed evidence directory, including all **33 supplied PNGs**, has no diff from the base. Screenshots were not recaptured or claimed as newly inspected pixels. The author-supplied historical visual evidence and its known narrow Workshop clipping remain historical evidence.
- Unlike the preceding re-review, this review independently reran the complete committed host evidence builder. Its only scratch adaptation was the resource-root path. The public-domain Alice fixture was regenerated with the repository's script from the `word_cloud` 1.9.3 source text; the resulting chapter, Workshop and log state bytes all match the committed files. The builder exercises production services/handlers/session/seed delivery with a stub provider, not a live model.
- Fresh Chromium was not retried after the previously verified sandbox socket/`bwrap` denial in this same environment. No denied access was bypassed. JSDOM's unsupported-CSS parsing warnings are excluded from its runtime-error check; it does not establish layout, clipping, native focus or native IPC ordering.
- No live or billable provider calls, writer-manuscript assessment, user-computer access, implementation changes, PR comments/formal reviews, merges or deployments were performed. Report-only publication and exact report-head CI are checked separately after publication; the reviewed implementation remains `efc9e15`.

## Next step

The F-07 follow-up is clear. Preserve the separate native VS Code acceptance and writer real-chapter output checkpoint before freezing Slice 5's board file format. Green CI, deterministic fixtures and unchanged screenshots do not substitute for those decisions.
