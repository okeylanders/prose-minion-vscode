# PR Review — VS Code Engine Floor 1.82

**Author:** okeylanders · **PR:** [#158](https://github.com/okeylanders/prose-minion-vscode/pull/158) (open, unmerged at review)
**Branches:** `epic/lightbox-vscode-floor` → `epic/lightbox`
**Reviewed head:** `81abdf5781598514b92df3d438fd9e13ea63d276`
**Exact base / merge-base:** `20775cf969f273bde2dc15cb5426b48516113eb3`
**Scope:** 14 changed files · +231 / −74 · 1 implementation commit
**Reviewed:** 2026-10-21 · **Reviewer:** Astra
**Mode:** independent manifest/source/ADR review; primary runtime-version sources; actual CSS inventory and guard probes; package/type integrity and head verification gates

## Summary

**Code-review disposition: no blocking finding in the reviewed floor change.** The manifest and lockfile agree on `^1.82.0`, and the stated VS Code → Electron → Chromium mapping is correct. The newly supported features used by the existing stylesheets fit Chromium 114; the remaining eight declarations are bounded, nonessential enhancements. The earlier ribbon fix remains plain grid and is not undone.

There is one **nonblocking P3** in the revised guard: the selective `text-wrap` rules miss newer shorthand forms that Chromium 114 cannot parse. No shipped stylesheet uses those missed forms, so this is a prevention-gap finding, not a reproduced regression in the present UI.

This review assesses the proposed support contract. The author/ADR's statement that the writer chose it is an **author-authored acceptance claim**, not independently authenticated writer approval. Code review does not establish native VS Code 1.82 acceptance, live-provider quality, the wider real-chapter checkpoint, Slice 5 readiness, saved-board-format approval or permission to merge.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| N-01 | Low / P3 · nonblocking | The revised `text-wrap` detector admits post-floor shorthand syntax | **Open; no current stylesheet occurrence** |

## N-01 — Keep the pre-130 `text-wrap` grammar distinct from the modern shorthand

**Location:** [`webviewCssFloor.test.ts:79–82`](https://github.com/okeylanders/prose-minion-vscode/blob/81abdf5781598514b92df3d438fd9e13ea63d276/packages/core/src/__tests__/architecture/webviewCssFloor.test.ts#L79-L82).

The old blanket `text-wrap` detector is replaced by checks for `pretty`, `stable` and the two longhand property names. This correctly permits single-keyword `wrap`, `nowrap` and `balance`, but it also returns an empty above-floor inventory for each of these valid modern declarations:

```css
.a { text-wrap: wrap balance; }
.a { text-wrap: nowrap balance; }
.a { text-wrap: auto; }
```

The exact [Chromium 114.0.5735.289 property definition](https://github.com/chromium/chromium/blob/114.0.5735.289/third_party/blink/renderer/core/css/css_properties.json5#L5969-L5981) defines `text-wrap` as a single primitive keyword with only `wrap`, `nowrap` and `balance`, not the modern two-component shorthand. The [Chromium syntax-update shipping discussion](https://groups.google.com/a/chromium.org/g/blink-dev/c/x4x_38sJhbk) places the newer grammar in Chrome 130. The broad property-level version in browser-compat-data must not be read as approval of every later value/combination.

**Independent witness:** executing the checked-in detector against all three snippets returns `{}`; they therefore do not alter the stylesheet ratchet and require no `GRACEFUL` entry. The base detector caught all three as `text-wrap`. The supported single-keyword controls also return `{}`, while `pretty`, `stable`, `text-wrap-mode` and `text-wrap-style` are caught as intended. Chromium 114 ignoring `nowrap balance` would not preserve its requested no-wrap behavior.

**Suggested correction:** explicitly distinguish supported pre-130 single-keyword syntax from the later shorthand/`auto` forms, with positive and negative controls. Handle CSS-wide keywords and any deliberately supported custom-property cases intentionally rather than treating every unrecognized declaration as floor-safe. No broad CSS-parser rewrite is necessary for this narrow fix.

All four actual `text-wrap` declarations are `pretty` and remain in `KNOWN`; none of the three witness forms occurs in production CSS. That limits this finding to P3. More generally, this selected-feature regex ratchet is not an exhaustive CSS compatibility validator; the wording that it fails on *any* new above-floor CSS should be read or qualified accordingly.

## Runtime floor and support contract

The version mapping was independently checked against primary sources, not inferred solely from the PR description or third-party tables:

- The exact [VS Code 1.82.0 `.yarnrc`](https://github.com/microsoft/vscode/blob/1.82.0/.yarnrc) pins Electron **25.8.0**. Both the [1.82 release notes](https://code.visualstudio.com/updates/v1_82#_electron-25-update) and [Electron 25.8.0 release](https://releases.electronjs.org/release/v25.8.0) identify Chromium **114.0.5735.289** and Node **18.15.0**.
- The immediately preceding [VS Code 1.81.1 source](https://github.com/microsoft/vscode/blob/1.81.1/.yarnrc) still pins Electron **22.3.18**; the 1.82 notes describe the Electron 25 promotion to stable. The floor is not accidentally relying on a later 1.82 patch release.
- The historical [VS Code 1.75.0 source](https://github.com/microsoft/vscode/blob/1.75.0/.yarnrc) pins **19.1.9**, whose [Electron release](https://releases.electronjs.org/release/v19.1.9) carries Chromium **102.0.5005.167**. The ADR's comparison entries for [1.78](https://code.visualstudio.com/updates/v1_78#_electron-22-update) and [1.86](https://code.visualstudio.com/updates/v1_86#_electron-27-update) also agree with their official release notes.
- [VS Code's extension-publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#visual-studio-code-compatibility) confirms that `engines.vscode` controls which clients can install the extension. The proposed release excludes 1.75–1.81. It does not uninstall an already installed compatible extension or magically upgrade the user's VS Code.

The engine floor is a minimum compatibility choice, not a recommendation to remain on a 2023 runtime or a security-support endorsement. This change introduces no installation/update procedure and makes no Marketplace publication.

The extension README, current agent guidance and dated Slice 2A note consistently state 1.82. The archived Chromium-102 debt retains historical context and adds an explicit resolution; its updated relative links resolve. Historical review text and previous implementation notes need not be rewritten to pretend that they originally targeted 114. A release note saying **Requires VS Code 1.82** remains an explicitly disclosed shipping follow-up, not a completed part of this PR.

## CSS inventory and graceful allowances

Read the complete live PR body and discussion, `AGENTS.md` / its `.ai/central-agent-setup.md` target, the new ADR, changed support/debt/epic notes, the original floor guard and relevant final #156/#157 house-review appendices. No checkout-local `.agents/skills` directory was present.

The npm-published **MDN browser-compat-data 6.1.5** was obtained separately and inspected at the stated `css.*` keys. Its relevant versions agree with the decision: `color-mix()` 111, `:has()` and size-container queries/units 105, individual transforms 104, `text-wrap: balance` 114, `pretty` 117, scrollbar properties 121, and full nesting grammar 120. `lh` is 109 and `rlh` 111; both are safely below 114 even though their old combined detector used 109. Chrome's own [balance](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance) and [pretty](https://developer.chrome.com/blog/css-text-wrap-pretty) documentation corroborates their respective milestones. This is source-based compatibility evidence, not a claim to have executed every feature in the old engine.

An independent parse/inventory of all **26 webview stylesheets** finds the documented **99 `color-mix()` uses**, one `@container` rule, two individual `translate` declarations and exactly the two remaining per-file allowance entries. Actual mixes use supported color-mix syntax. No production rule depends on the newly missed shorthand forms in N-01.

- **Four `text-wrap: pretty` uses:** ordinary Workshop introductory/descriptive text and the text-sheet preview. Ignoring the unsupported value leaves normal wrapping, with the preview retaining its independent overflow/wrapping rules. It does not remove content or suppress an essential control.
- **Four scrollbar declarations:** the two Lexical Gravity scrolling regions each declare `scrollbar-width` and `scrollbar-color`. Their `overflow-y: auto` behavior is independent. Importantly, each already has adjacent `::-webkit-scrollbar` / thumb rules, which are supported at the floor. The ADR/guard's phrase “default scrollbars” is therefore imprecise: the standard declarations are ignored, but the existing WebKit styling still applies. This strengthens the graceful-fallback rationale; it is not a rendering blocker. [Chrome's scrollbar guidance](https://developer.chrome.com/docs/css-ui/scrollbar-styling#supporting_older_browser_versions) explicitly describes that fallback technique.
- **Ribbon:** both component changes and the stylesheet change are comments only; removing block comments makes each identical to base. Labels/tracks remain direct children of one ordinary grid. Raising the floor to 114 does not allow `subgrid` 117 or undo #156 F-04.

The `GRACEFUL`/`KNOWN` relationship is checked, exact per-file counts are retained, and adding either a new `subgrid` use or a new `pretty` use changes the detected inventory. Nesting remains conservatively disallowed despite partial support in 112–119. The inline guard intentionally covers subgrid only; it is not a general TSX-style compatibility scanner.

## Manifest, dependency and host API integrity

The entire lockfile is byte-for-byte the same after normalizing its one workspace `engines.vscode` value. No package version, integrity hash, dependency resolution, runtime entry point or activation contribution changes. `@types/vscode` remains declared `^1.75.0` and resolved **1.105.0**, exactly as at base.

The installed vsce validator compares the declared lower version, not the resolved lockfile's types version. Its acceptance of this manifest must not be confused with proof that ordinary typecheck enforces the 1.82 API surface. The author explicitly identifies that pre-existing caret/pinning debt; this PR does not introduce it.

An independent compiler-API run maps the `vscode` import to the separately obtained **1.82.0** declaration file, explicitly excludes automatic inclusion of installed 1.105 declarations, and verifies the program loaded exactly that one VS Code file. It produces the same **four TS2322 `Thenable` → `PromiseLike` mismatches**: the Lightbox, main-tools and Workshop webview transports, plus the Lightbox open-document adapter. There are no missing-API diagnostics in that run. This corroborates the author's static API check but is **not a passing floor typecheck** or proof about dynamically named commands/runtime behavior. Neither installed types nor source were changed.

The actual vsce validation function accepts declared `^1.75.0` and `^1.82.0` against the new engine and rejects `^1.83.0` in a negative control. Semver boundary probes reject 1.75.0/1.81.1 and accept 1.82.0/1.82.3/current 1.x as intended.

## Independent verification

| Check | Independent result at `81abdf5` |
| --- | --- |
| Full Jest | **430 suites / 5,917 tests / 59 snapshots passed**, 308.554 s |
| Ordinary typecheck | All three stages passed with the locked 1.105 declarations |
| Exact 1.82 declaration check | **Four known TS2322 declaration mismatches**, no other diagnostics; not counted as a pass |
| Lint | **0 errors / 1,133 warnings**; exact normalized file/rule/severity/message parity with the independently checked base implementation |
| Production build / `verify:bundle` | Passed through the local packaging command; the same three webpack size/performance warnings |
| Local VSIX | Packaging passed, 244 files; both `extension/package.json` and the VSIX XML engine property are **`^1.82.0`**; packaged README states 1.82 |
| Guard controls | **33 assertions passed**, including actual per-file inventory, all retained feature categories, supported controls and three N-01 witnesses; all three witnesses are caught by the base detector |
| Manifest / vsce controls | Correct accept/reject boundaries for engine and declared types; lockfile has only the engine delta |
| Diff integrity | `git diff --check` passed; only this review report was prepared, with no implementation/test/lockfile delta |
| Exact-head PR CI | [CI run 39634114606](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39634114606) completed successfully |

The packaged production webview SHA-256 is `68ce9f0f30497f12805c904f5979a7ea26e0a85e50509bef371014ef130decb6`. Its only byte difference from the independently built base webview is the updated Chromium/VS Code version in the CSS comment embedded by style-loader; replacing that exact comment makes the bundles identical. The local VSIX was inspected, not installed or published. Live PR metadata was rechecked after the gates: the reviewed head/base are unchanged, open/unmerged, and GitHub reports mergeable.

The previously completed independent checks at `889e69f4` were reused for the baseline after verifying that the exact PR base `20775cf` differs from it **only in three review reports**. That verified baseline has 430 suites / 5,916 tests / 59 snapshots, successful typecheck/build and 0 lint errors / 1,133 warnings. It is implementation-equivalent evidence, not a claim of a new full run on the merge commit.

Head verification used Node **24.19.0**, npm **11.9.0**, isolated disk-backed dependencies matching the unchanged lockfile, one Jest worker, a 2 GiB heap, a 1,000 MB idle-worker limit and a separate disk-backed Jest cache. The checks are sequential. External probes do not inflate repository test totals, and a passing witness of N-01 records the detector gap rather than approving that syntax.

## Acceptance boundaries

No implementation, repository test or lockfile was edited. The review deliverable is this report only. No formal GitHub review/comment, merge, deployment, Marketplace publication, paid/provider call, private manuscript processing or user-computer operation was performed.

No native VS Code 1.82/Chromium 114 instance was launched. The primary-source mapping, package metadata, compiler checks and static CSS witnesses do not establish native layout/hit-testing, old-host activation or every browser feature's rendered behavior. No previously denied browser route was retried. Inherited visual evidence is not relabelled as fresh minimum-runtime testing.

The prior cleared ribbon defect remains cleared within its earlier evidence boundary. The author-recorded writer floor decision and real-chapter checkpoint remain distinct from independent authentication; the latter, live model-quality assessment and Slice 5's persistence/basis decisions are not closed by this build/support change.

## Author response (2026-10-21)

The review text above is unchanged. This section records how its findings were handled.

| ID | Resolution | Commit | Proof |
| --- | --- | --- | --- |
| N-01 · P3 | **Fixed.** The guard now reads each `text-wrap` declaration's value (case-insensitive, without `!important`). It allows only one keyword of Chromium 114's grammar (`wrap`, `nowrap`, `balance`) or a CSS-wide keyword. `pretty` alone is counted as `text-wrap: pretty` (117). Any other value counts toward the Chrome 130 entry, which is renamed "text-wrap beyond one 114 keyword, text-wrap-mode, text-wrap-style". Those values include the two-value shorthand, `auto` and a `var()` the guard cannot check. | This commit | New controls: `wrap balance`, `nowrap balance`, `auto`, `wrap pretty` and `var(--pm-wrap)` count 5. `pretty !important` and an upper-case `TEXT-WRAP: Pretty` count as `pretty`. The single keywords and all five CSS-wide keywords count nothing. The detector at `81abdf5` returns `{}` for the first three, as the review showed. The four production `text-wrap: pretty` declarations still match `KNOWN` exactly. |
| Scrollbar wording | **Corrected.** "Default scrollbars" is wrong: the Lexical Gravity sheet's own `::-webkit-scrollbar` rules still style both regions on Chromium 114 to 120. The guard's `GRACEFUL` entry, the ADR's table and the archived debt note now say so. | This commit | Wording only. |

The ADR's Decision section now limits the allowed `text-wrap` to one 114 keyword. The guard test (7 tests) passes, typecheck passes, lint stays at 0 errors / 1,133 warnings, and `git diff --check` is clean.
