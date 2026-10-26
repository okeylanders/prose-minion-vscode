# PR Review — Draft Edit Slice 3c, part 1: Craft Flags and cliché

**Disposition: Changes requested before integration into `epic/lightbox`. Three P2 findings remain.**

**Author:** okeylanders · **PR:** [#177](https://github.com/okeylanders/prose-minion-vscode/pull/177) · **Reviewer:** Astra · **Reviewed:** 2026-10-26

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Implementation head:** `8e72326ffa518c9ae34250a836b8eb62fcb98a14`

**Base and merge-base:** `fd145a6a44f3bd725c3c9f5ca9602c600906918d`

**Scope:** 75 files · +3,621 / −372 · complete tree `177d770453b9e88ee969e0b40fcdfe04e2a338d9`

## Summary

The flag-only boundary, separate annotation family and model-setting plumbing are sound in the checks below: Craft takes no applier, replies cannot supply a replacement, its annotations contain no fix, and its host instance exposes neither Replace nor Fix all. Shared Proofread frame/speech/issue-moving refactors preserve the sampled existing behavior.

The new priced-confirmation flow does not preserve the identity of either the priced model or the gesture's document lifetime. Separately, the new leave-speech policy is checked against the original raw text rather than the protected-aware live text. These are reproducible new Craft defects, not objections to the accepted native Refactor Preview limit from PR #172. This is source, automated and controlled-host verification, **not native VS Code or live-model quality acceptance**.

## Findings

### F-01 · P2 · The approved model and price do not bind the call

**Location:** [`craftFlagsCommands.ts:84–95`](../../apps/vscode-extension/src/application/commands/craftFlagsCommands.ts#L84), [`CraftFlagsService.ts:133–175`](../../packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsService.ts#L133).

The command gets a plan and presents its model/price, but execution receives only `target` and `pass`. `estimate` reads the model before awaiting prompts/pricing; `flag` later resolves the current engine independently. The supported model hot-swap, including Craft following the Workshop, can therefore change which model receives the chapter after the price was calculated. A slow catalog lookup can make the confirmation stale **before it even appears**.

**Independent reproduction:** production command → use case → service, with distinct engines bound to synthetic `test/cheap-model` and `test/expensive-model`. Change selection while pricing is awaiting, or while confirmation is awaiting. The only confirmation names **cheap-model, < $0.01**; approval dispatches to the expensive-model engine at **1,000× the synthetic token rates**. No second confirmation occurs. These are deliberately separated fake prices, not a claim about live catalog prices or expected output length.

**Requested correction:** execution must use the concrete model/request identity the writer approved, or invalidate/reprice/reconfirm on drift. Preserve that invariant across asynchronous preparation up to dispatch. Merely retaining the engine object is insufficient: the manager also supports in-place `setModel` updates. Cover explicit Craft changes and changes to its followed Workshop model during pricing, confirmation and prompt preparation. The estimate need not become a hard spending cap; it must describe the model actually authorized.

### F-02 · P2 · Pricing and confirmation lose the gesture's document lifetime

**Location:** [`craftFlagsCommands.ts:73–95`](../../apps/vscode-extension/src/application/commands/craftFlagsCommands.ts#L73), [`CraftFlagsUseCase.ts:89–109`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts#L89).

The target is captured synchronously, but `plan` awaits pricing without watching that document. The first watch starts only in `run`, after pricing/confirmation/progress awaits. `VsCodeDocumentEditor.watch(uri, version)` then binds whichever document is open under those values. As the adapter's existing contract states, a URI/version pair does not identify a lifetime: reopen and language changes can retain or reuse the version.

**Independent reproduction:** production command/service/use case and the actual `VsCodeDocumentEditor`, with controlled document close/open events. Both during pending pricing **before the modal** and during pending confirmation:

| Change after the gesture | Actual result after approval |
| --- | --- |
| Close/reopen, same URI/version/language | Old target sent; a flag shown on the new lifetime |
| Markdown → plaintext, same version | Old target sent; a flag shown |
| Reopen with different text but same version | Old text sent; only the later placement check drops the mismatched quote |
| Plaintext → Markdown, with a synthetic fenced marker | The now-protected fenced content is sent **unmasked**, using the old plaintext preparation |
| Markdown → JavaScript | Old target still sent and flagged despite the now-unsupported language |

Controls — an ordinary versioned edit, a close without reopen, or reopening at a different version — correctly return `changed` without a call. Thus the defect is lifetime identity, not absence of the normal version check. No private text or live provider was used.

**Requested correction:** establish and carry an opaque gesture-lifetime/watch ticket before the first asynchronous planning step. Invalidate it on close, reopen or language change, refuse dispatch after invalidation, and release it on decline, cancellation, errors and completion. Test these held-promise cases through the actual document adapter seam. Do not solve this by reopening the URI or merely comparing text/version/language at the end: a same-text reopen is still a different lifetime.

**Not the accepted PR #172 risk:** this flow has no native preview and does not write. The new pre-call ownership gap is under application control; the previously accepted preview race remains unchanged and not fixed.

### F-03 · P2 · The leave-speech rule can place new cliché flags inside dialogue

**Location:** [`CraftFlagsUseCase.ts:117–147`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts#L117), [`craftFlagsPlacement.ts:86–90`](../../packages/core/src/application/services/draftEdit/craftFlagsPlacement.ts#L86).

Speech is computed only from the gesture's **raw** text. Placement checks those spans, then moves the flags through live edits and checks live protected regions, but never checks live speech.

**Held-reply witness:** start with `Alice said time stood still. Then she left.` and a returned flag on `time stood still`. While the reply is held, insert `“` immediately before the phrase and `”` after its sentence stop. The phrase itself is untouched. The result is `Alice said “time stood still.” Then she left.`, yet the run shows one cliché flag inside the speech and reports `dialogue: 0`. Single-quoted `‘…’` behaves the same. A matching inline-code insertion correctly drops the flag as protected; editing the phrase itself drops it as stale. This isolates the missing live speech gate.

There is also a static protected-delimiter case: in `` “She typed `"` and time stood still,” said Alice. ``, the inline-code quote is correctly masked in the provider passage, but the raw speech scanner consumes it as the closing dialogue mark. The returned phrase is flagged (`flagged: 1`, `dialogue: 0`) even without an intervening edit. Protected syntax must not terminate the speech used by the new Craft policy.

**Requested correction:** apply the category's leave-speech rule against a protected-aware view with source-aligned offsets, and revalidate it against the settled live document before showing findings. Drop/count a phrase that has become speech without changing its characters. Cover straight/curly double and single speech, protected embedded quote marks, and unchanged-narration controls; preserve the established shared dialogue/counting rule rather than silently changing its saved-board fingerprint.

## Nonblocking notes

### N-01 · P3 · A new flag's repeat statement can already be stale

[`CraftFlagsUseCase.ts:118,138–152`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts#L118) retains counts from the gesture snapshot through settlement. Starting with `Alice thought time stood still. Later, time stood still.`, return a flag on the first occurrence and delete the second while the reply is pending. The new flag still says **“This phrase appears 2 times in this document.”** although the live document has one. Consider deriving the host-owned count from the settled narration, or explicitly labelling it as a count in the earlier reading. This does not imply the model's contextual advice can be automatically refreshed after every edit.

### N-02 · P3 · Eager repeat folding stalls selection-only runs on large files

[`CraftFlagsUseCase.ts:118`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts#L118) eagerly folds the **entire** document for repeats before the first model await, including when the provider reads only a tiny selection and returns no findings. [`phraseRepeats.ts:38–39,78–99`](../../packages/core/src/utils/craftFlags/phraseRepeats.ts#L38) creates per-character arrays/source offsets and performs locale conversion per code unit.

On Node 18, a fabricated ordinary 250,000-word manuscript with a 43-character selection synchronously blocked approximately **2.86 seconds before the model stub**. Replacing only this eager counter with an inert scratch stub reduced the same path to **127 ms**. This is an attribution experiment, not a repository modification or a universal latency guarantee. Consider lazy construction after accepted findings, cheaper normalization, and an explicit bound/conservative outcome for expensive whole-document host work. The 25,000-word provider ceiling does not bound this path.

## Independent verification

Read relevant agent guidance, the changed production/test surfaces, Draft Edit ADR and Slice 3c decisions, shared contracts and previous review conventions. No `.agents/skills` directory or dedicated review template exists in this checkout. An isolated cloud checkout matches the exact GitHub head/tree; the base is its merge-base. Dependencies were reused only after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; workspace aliases point to this checkout.

- **Host/consent:** 18 independent production-path scenarios, including the two mutation windows and negative controls described above. Existing focused host/model/annotator tests: 6 suites / 75 tests pass.
- **Live placement:** seven independent production-use-case scenarios cover ordinary placement, new double/single speech, newly protected inline code, touched-text staleness, document close and the stale repeat witness. No scenario calls `applyEdits`.
- **Shared frame differential:** 585 old/base-versus-new production-reader cases have identical roots/repairs/refusals (intentional error-class rename excluded), including framing, truncation, repair, fences and line endings.
- **Shared speech refactor:** 60 old/base-versus-new narration-baseline outputs agree across nested, unclosed, single/double/curly speech and paragraph endings. This verifies preservation, not perfect natural-language classification.
- **Contracts:** separate craft scope/following/default/manifest/settings/watchers are connected; own annotator source/collection and absent write commands preserve family separation; response kinds, replacement ignoring, note fences, output ceiling/recovery and capability-free policy were inspected and exercised by repository/focused tests. No new broad document-write route was found.

Runtime: **Node 18.20.8**. Typecheck/lint/build were also rerun using npm 10.8.2. The full typed Jest run used Node 18 with the environment's npm 11 launcher; its compatibility warning is a launcher warning, not an omitted test stage.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest | Pass: **571 suites / 7,981 tests / 59 snapshots**, 557.611 s, exit 0 |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40410805238](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40410805238), every verify step passed |
| Exact implementation-head PR CI | [Success, 40410941933](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40410941933), every verify step passed |

Scratch probes/logs remain outside the checkout at `../pr177-review-evidence/`. Only this review report is published: no reviewer source fixes, repository-test changes, dependencies, formal GitHub reviews/comments, merges, connected-Mac access or provider calls.

## Integration and remaining acceptance

**Hold for F-01–F-03, then independently re-review the corrected head.** Exact report-head CI is checked after publication, separately from the implementation CI above. A changed implementation/base requires a delta/integration recheck.

Native VS Code confirmation/Problems UI and live cliché hit/false-positive fixture acceptance remain separate and unrun. The ADR explicitly makes this command the initial opt-in; later categories and their defaults are not implementation-approved here. PR #172's accepted native-preview lifetime race remains **not fixed**; no global preview-discard mechanism was reintroduced.
