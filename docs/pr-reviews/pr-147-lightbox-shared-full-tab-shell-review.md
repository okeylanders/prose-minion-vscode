# PR Review — Lightbox Slice 1: Shared Full-Tab Shell

**Author:** okeylanders · **PR:** [#147](https://github.com/okeylanders/prose-minion-vscode/pull/147) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-1-shell` → `epic/lightbox`
**Initial base / merge-base:** `df50039a432b80906f893625e8828856378aef22`
**Final base / merge-base:** `bfdd07cd664de7c06c211a985649a1075e2765d7`
**Initially reviewed implementation head:** `55d88c3b07b24cee048506238cb19776031581d8`
**Final reviewed head:** `bca5b4cc46ae9d71e552e473fa14b3fa14529bbc` (adds visual evidence and merges the already-reviewed PR #146 prerequisite)
**Initial scope:** 36 files · +2,451 / −949 · 6 commits
**Final PR diff:** 72 files · +2,820 / −951 · 8 commits, including the 36 visual-evidence files
**Reviewed:** 2026-10-19 · **Reviewer:** Astra · **Mode:** independent source/spec review, normalized CSS comparison, real-bundle JSDOM lifecycle comparison, exhaustive-map compiler probe, supplied-image pixel inspection, and deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| — | — | No actionable new implementation defect found | Source/spec inspection, selector/declaration comparison, real-bundle lifecycle parity, and the checks below | **N/A** |

**Verdict: Conditional code-review approval for merge into `epic/lightbox`, pending required CI on the exact report-only head.** No functional correction is requested. The supplied before/after image review is clean within its documented scope; an independent browser rerun and native VS Code acceptance were not performed. This verdict does not claim native acceptance or report-head CI has passed, and it is not authorization to merge or release the feature.

## Scope and independently checked behavior

### Shell, chrome, and ownership

- Read the complete production delta, changed tests, repository guidance, [ADR D1–D2](../adr/2026-10-19-lightbox-inspiration-board.md), the [slice specification and implementation record](../../.todo/epics/epic-lightbox-2026-10-19/slice-1-shared-full-tab-shell.md), and the epic. The small documented API/placement deviations are consistent with the extraction: the balance-title helper belongs to the status component; region objects pass labels and content; overlays remain children after the split.
- `FullTabShell` owns layout, not session or provider state. The Workshop retains its persona and Sessions controls, excerpt/context/tool/todo blocks, banners, composer/thread boundaries, and overlays. `FullTabRail` preserves the labeled `aside`, local error boundary, error reporting, and retry/reset path. Existing Workshop, excerpt, and context assertions were not weakened.
- `FullTabHeaderStatus` preserves assistant-scope model selection, refresh-on-browser-open, processed-token copy, credit formatting, status-dot selection, and the unavailable/no-key tooltip branches. The provider-paused banner preserves its copy and settings action.
- `useFullTabChrome` preserves the three persisted keys: `modelsSettings`, `modelSelections`, and `tokenTracking`. Account balance and API-key status remain ephemeral. The six generic inbound routes retain their original owners and do not overwrite Workshop-specific handlers when composed.
- The parameterized direct messages retain `webview.workshop` in the Workshop. Startup-notice request/dismiss and settings opening use the caller's source. Existing nested-hook sources are intentionally unchanged: model messages still use `webview.hooks.useModelsSettings`, and account requests use `webview.account`. This is not a claim that every future Lightbox message is already retagged.
- The independent bundle probe confirms the one documented mount-order difference: `REQUEST_API_KEY` now precedes `REQUEST_STARTUP_NOTICE`. The request multiset, payloads, and sources are otherwise identical. The changed order does not alter the independent API-key and startup-notice handlers; no synchronous host-response assumption was used to invent a race.

### Surface selection and host HTML

- The host's title/root map, webview root-component map, and recognized-stamp map are exhaustive over `WebviewSurface`. The unstamped sidebar keeps its previous fallback; unknown stamps and inherited property names cannot accidentally select a root.
- An independent, in-memory compiler probe added a fourth union member, `review_probe`, without changing any repository file. The webview compilation rejected both the recognized-stamp and root-component maps; the extension compilation rejected the recognized-stamp and document maps. This establishes actual type-level exhaustion rather than relying only on the source-text test.
- The existing sidebar HTML snapshot remains unchanged. Full-tab roots receive both surface and frame stamps. CSP, nonce generation, script/API acquisition, asset mapping, and error forwarding remain shared and unchanged. The Lightbox root is explicitly a placeholder; no new provider, command, persistence, or paid-generation path is introduced in this slice.

### CSS scope, cascade, and transcript export

- A PostCSS comparison covered **656 baseline token/shell selector instances**, retaining media-query context and normalizing only the moved scope. Every prior declaration is accounted for. The exceptions are the documented token split and the provider banner's equivalent merged base/override; four added selector instances implement the unused optional aside.
- Replacing one attribute selector with another preserves specificity. Frame imports precede root imports and therefore Workshop's sheets. The 1100 px and 520 px header breakpoint rules retain their conditions and declarations. Workshop-specific participant colors, panels, session controls, and thread rules remain surface-scoped; the shared frame remains absent from the unstamped sidebar.
- A second normalized comparison covered **122 prior mirrored-export selector instances**. No old selector or declaration is lost beyond the token-rule split. The export body gains the required frame stamp, and the verbatim-mirror, renderer, and route witnesses pass. The two changed export expectations reflect that necessary stamp rather than changed transcript content.
- The export's `index.css`-first mirror order predates this PR and is separately documented in [existing debt](../../.todo/tech-debt/2026-10-19-transcript-export-mirror-cascade-order.md). No new equal-specificity rendering conflict was established here. The retained `pm-ws-*` class prefix is likewise [recorded naming debt](../../.todo/tech-debt/2026-10-19-fulltab-frame-class-prefix.md), not a functional regression.
- The optional aside adds a fixed 340 px trailing column beside the existing 372 px rail. Neither current root supplies that slot. Narrow-screen behavior for a populated three-column Lightbox remains a Slice 2A acceptance concern; this review does not claim that unused layout is already responsive.

## Independent before/after lifecycle witness

Both exact commits were built locally. Their actual production `webview.js` bundles were mounted in separate JSDOM documents with the same synthetic VS Code API, fixed clock/random source, and synthetic session/model/balance messages. No source hook or root component was replaced with a mock. The only intended host-markup difference was the new `data-pm-frame` attribute, outside the compared root contents.

At **nine checkpoints**, the probe asserts byte-identical root DOM, identical persisted state, and identical outbound-message multisets after excluding timestamps:

1. Initial session loading.
2. Empty session/path chooser after host hydration.
3. A file-sourced pinned excerpt.
4. Provider paused after the host reports no saved key.
5. Add API key followed by the self-healed-key message; the settings request is still `webview.workshop`, and the banner disappears.
6. Widgets open → close → reopen, including the mounted dialog.
7. Tools open → close, then the Sessions menu.
8. Repeated API-key status delivery.
9. A fresh bundle mount seeded from the previous persisted state.

All **27 parity assertions** passed. The probe compares message multisets deliberately: the documented mount-order change is recorded above, not hidden as ordering parity. The key-status pair in checkpoint 8 was delivered together, so it does not independently prove two separate rendered transitions. The committed hook tests separately cover configured-key refresh and pause/self-heal.

JSDOM reported the same stylesheet-parser limitation in both bundles. It provides no pixel layout, native focus, or real-browser cascade evidence. Those conclusions come only from source comparison here, not from this DOM witness.

## Verification actually run

The initial implementation checks below target **`55d88c3b07b24cee048506238cb19776031581d8`**, before this report-only commit. Final integrated-head checks are recorded separately below. Runtime: Node **24.19.0** / npm **11.9.0**, isolated cloud worktree, existing lockfile dependencies copied without changing dependencies or source.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **320 suites / 4,736 tests / 2 snapshots passed**, 152.650 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,140 warnings**; the per-file/per-rule histogram exactly matches the available baseline log across 223 buckets |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; all three bundle sentinels verified |
| Exact-base `npm run build` | Passed; used by the independent before/after bundle witness |
| Focused style/export rerun | **4 suites / 61 tests passed**: stylesheet assembly, verbatim mirror, transcript renderers, export routes |
| Independent real-bundle DOM/lifecycle probe | **9 checkpoints / 27 parity assertions passed** |
| Fourth-surface compiler mutation | Both compilations rejected exactly the missing map members expected; repository files untouched |
| Production-source `git diff --check` | Passed |
| Whole-PR `git diff --check` | Two documentation-only blank lines at EOF in the epic README and slice record; no production-source whitespace issue |
| Exact report-head required CI | **Pending separate post-publication verification** |

The previously recorded baseline test result is 315 suites / 4,702 tests / 2 snapshots. This review independently reran the head suite and both builds; it does not present an earlier baseline test run as a newly executed check.

## Final-head and visual-evidence re-review

While publication was held for actual screenshots, `7581bab55952a26873b97b047e39f83e0e46d2b9` added 36 evidence files. `bca5b4cc46ae9d71e552e473fa14b3fa14529bbc` then merged the updated `epic/lightbox` base at `bfdd07cd664de7c06c211a985649a1075e2765d7`. That base contains the separately reviewed PR #146 dialogue-counting prerequisite. The merge delta was inspected, the new base/merge-base was verified, and the shell, chrome, styles, entrypoint, surface contract, and host-HTML source remain unchanged. This review does not reopen PR #146 or count its changes as new PR #147 scope.

### Checks rerun on final head `bca5b4cc`

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **321 suites / 4,776 tests / 2 snapshots passed**, 105.263 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,140 warnings** |
| `npm run build`, including `verify:bundle` | Passed; the same three webpack size/performance warnings; all three sentinels verified |
| Rebuilt final bundle against the original baseline in JSDOM | All **9 checkpoints / 27 parity assertions passed** again |
| Production-source `git diff --check` against the new base | Passed; the same two documentation-only EOF blank lines remain in the whole-PR check |

### Supplied artifacts actually inspected

The [committed evidence](evidence/pr-147-visual/README.md) now provides 24 PNGs, eight DOM snapshots, the harness, comparison script, and stylesheet-order script. The documented provenance is **baseline `df50039` → result `53e5303`**. The next `55d88c3` commit is documentation-only, and the relevant shell/style source is still identical at the final integrated head. The captures are therefore relevant to this extraction, but are not mislabeled as freshly rendered evidence of the later merge commit.

- Visually inspected all 12 result screenshots: initial loading, empty/path chooser, pinned excerpt, and provider paused, at 1440, 1000, and 500 px. Also viewed the baseline image for each of the two nonidentical pairs; the other ten pairs have identical decoded pixels.
- Read the supplied harness and ran its comparison script. A separate Pillow/NumPy RGBA comparison independently reproduced the counts below. All dimensions match.
- All four 1440 px DOM pairs are byte-identical after removing only ` data-pm-frame="fulltab"` from the result root.

| Committed image pair | Independently measured difference |
| --- | --- |
| `empty-1440` | 32 pixels; maximum channel difference **1/255**, confined to header controls |
| `excerpt-1000` | 6 pixels; maximum channel difference **1/255**, confined to the header-control edge |
| Other 10 state/width pairs | **0 differing pixels** |

No meaningful changed layout, color, typography, banner wrapping, or header/rail placement was observed in these artifact pairs. The 500 px shots retain the pre-existing offscreen main-column content; the 1000 px empty/paused shots retain existing chooser clipping. Pixel parity is not a claim that the pre-existing narrow layout is good or newly fixed.

The README's three-run noise table, including its separate `excerpt-500` delta of 7/255, is still **author-reported**: only one baseline/result run is committed. The committed `excerpt-500` pair itself is exactly identical. The same distinction applies to the reported browser `document.styleSheets` output: its script is available, but that browser run was not independently repeated here.

The harness uses a stub VS Code API and theme variables, empty asset mappings, disabled screenshot animations, and synthetic host messages. Its noncanonical conversation-behavior/writer-profile fixtures exercise the existing fail-closed defaults, not nondefault profile settings. The paused case supplies a synthetic positive balance alongside a missing-key response; it demonstrates banner/layout parity, not live account-status accuracy. No native-host, motion, actual-provider, long-thread, or populated-aside acceptance is implied.

### Remaining execution limits

An independent Chromium rerun was prepared but did not render a page: the shell sandbox blocked Chromium's local process socket, the escalation path failed during environment setup, and the supported cloud browser denied local-file navigation. No denied path was bypassed. The subsequently committed images were inspected directly from the repository, so the earlier missing-artifact gap is closed without claiming an independent browser execution.

The native Extension Development Host pass remains unperformed. No live/billable provider call, native-computer operation, functional edit, merge, deployment, notification change, comment, or formal GitHub review was performed. The only repository publication from this review is this report; required CI must be evaluated on its exact resulting head.
