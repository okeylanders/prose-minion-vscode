# PR Review — Dictionary Chromatic Palettes

**Author:** okeylanders · **PR:** [#142](https://github.com/okeylanders/prose-minion-vscode/pull/142) (open, unmerged at review)
**Branches:** `claude/busy-curie-9x9nw7` → `main`
**Verified base / merge-base:** `37a1d06a9536f96086841bc127a19ddaf683e887`
**Reviewed implementation head:** `c5f7b0b702aebcf67f807277277a301e87d09e14`
**Independently re-reviewed correction head:** `a3a18687ac15f71ed11a71f4215c6081ec12e8ba` (fix `f44250f5114ec4c4ae09d8a1cb49c15d517563c9`, followed by documentation)
**Scope:** 34 files · +2,497 / −206 · 9 commits
**Reviewed:** 2026-10-11 · **Reviewer:** Astra · **Mode:** independent source/spec review, real service/renderer boundary witnesses, synthetic component/lifecycle and adversarial parser probes, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | An unfinished Fast palette fence silently hides the independently successful Topic & Related Lexicon appendix | All eight original desired-safe witnesses pass after `f44250f`; independent Standard recovery, security, and streaming probes also pass | **Addressed** |
| F-02 | Medium / P2 | The correction adds a spurious fence after valid list/HTML-contained code, turning subsequent Fast sections into one code block | Four valid-Markdown service→renderer witnesses fail at `a3a18687`, including palettes-off requests | **Open** |

**Verdict: Changes requested.** F-01's original failure is independently resolved. The correction introduces F-02 by applying a line-only fence reader to every Fast block without Markdown container context. Resolve F-02 before merging; it affects valid pre-existing Markdown even when Chromatic Palettes is off. Full repository gates and correction-head CI pass but do not cover this regression.

## F-01 — Preserve the next Fast block when a palette fence is unfinished (addressed)

**Changed-code location:** [`MarkdownRenderer.tsx:179–188`](https://github.com/okeylanders/prose-minion-vscode/blob/c5f7b0b702aebcf67f807277277a301e87d09e14/packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx#L179-L188), which hands the whole `code.text` to the palette renderer. The new [palette registry](https://github.com/okeylanders/prose-minion-vscode/blob/c5f7b0b702aebcf67f807277277a301e87d09e14/packages/core/src/presentation/webview/components/dictionary/ChromaticPaletteBlock.tsx#L97-L103) replaces that code token whenever at least one swatch parses.

**Related boundary:** [`DictionaryService.ts:640–674`](https://github.com/okeylanders/prose-minion-vscode/blob/c5f7b0b702aebcf67f807277277a301e87d09e14/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L640-L674) concatenates successful, independently generated blocks. The new palette block precedes Topic. A block with a nonempty response is counted as successful even when its last palette fence has no closing delimiter; [`generateBlock`](https://github.com/okeylanders/prose-minion-vscode/blob/c5f7b0b702aebcf67f807277277a301e87d09e14/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L483-L501) retains its content without using `finishReason` to establish that boundary.

**Trigger and consequence:** Enable both optional sections and let the Fast palette request return a named, valid swatch in an unclosed `pm-palette` fence. This can be a token-limited response or simply an omitted closing delimiter. The separately successful Topic block is then appended inside that fence. `marked` correctly lexes one code token through the end of the combined entry. The palette parser keeps the valid swatch and skips the Topic heading/body as unrecognized lines; the React replacement removes those skipped lines from the visible result. There is no warning, and metadata still reports **17/17 successful blocks** with no partial failure.

Minimal palette response, deliberately ending immediately after the swatch:

````text
# 🎨 Chromatic Palettes

```pm-palette
title: Warm Copper
kind: literal
Copper | #B87333 | The reddish-orange of polished copper
````

Give the independent `dictionary-fast-topic-related-lexicon` request this completed response:

```markdown
# 📂 Topic & Related Lexicon

A COMPLETE INDEPENDENT TOPIC APPENDIX MUST REMAIN VISIBLE.
```

**Independent reproduction:** A mocked `AgentRunEngine` supplies these responses through the actual `DictionaryService.generateParallelDictionary('copper', undefined, { includePalettes: true, includeEncyclopedia: true })`, loading the real prompt files. Render its returned `result` through the actual `MarkdownRenderer` with `DICTIONARY_FENCED_BLOCKS`. For both `finishReason: 'stop'` and `'length'`:

- `metadata` is `{ successCount: 17, totalBlocks: 17, partialFailures: [] }`.
- Raw result contains the complete Topic heading and body.
- A valid palette appears, but the rendered DOM contains neither the Topic heading nor its body.
- The desired-safe assertion that the Topic body remains visible fails. The expanded witness also exercises three- and four-character backtick and tilde delimiters: **all eight desired-safe cases fail**. These failures reproduce the defect; they are not passing correctness tests.

Nine controls pass: correctly closed fences of all four delimiter variants keep Topic visible; zero-valid-swatch unfinished fences of all four variants retain Topic as readable fallback code; disabling palettes leaves Topic visible and makes no palette request. A further actual `UtilitiesTab` characterization reproduces the invisible Topic section while proving both Copy and Save keep its full raw source.

This is **display loss, not deletion of the raw result**. Separate real-component Copy/Save probes verify that the raw Markdown remains in their message payloads. Without the opt-in replacement, `marked` leaves the swallowed text readable in an ordinary code block; the new renderer changes that malformed-input outcome into silent omission.

**Requested change:** Keep independently generated Fast blocks from consuming their siblings when a palette fence is unfinished, using a well-defined assembly boundary or a non-lossy rendering fallback. Do not simply reject every open fence: progressive Standard streaming is an explicit feature requirement. Add a regression through the real Fast service and real renderer, with a closed-fence control, malformed/unclosed fences, token-limit and normal-stop responses, and a successful following Topic block. The following section must remain visible without weakening color validation or the sanitizer. Preserve the raw-Markdown Copy/Save behavior.

**Resolution verified at `a3a18687`:** The Fast assembler adds a matching closer to an unfinished block, and the opt-in renderer splits a palette body at a following heading/fence so the remainder can render normally in Standard output. All eight original desired-safe cases now pass. Eighteen additional independent renderer probes cover both delimiter characters and lengths, heading levels 1/3/6, a second palette, reference links spanning recovered sections, sanitization of recovered hostile markup, and partial-name streaming. The original 21 parser/Dictionary lifecycle probes, four repeated-render/component probes, and 68 host contract probes still pass. Copy/Save carry the assembled Markdown; for a repaired Fast response, that includes the inserted closing delimiter. This addresses F-01, while the new generic closure reader has the separate F-02 regression below.

## F-02 — Do not repair an already well-formed container fence

**Locations:** [`markdownFences.ts:40–50`](https://github.com/okeylanders/prose-minion-vscode/blob/a3a18687ac15f71ed11a71f4215c6081ec12e8ba/packages/core/src/utils/markdownFences.ts#L40-L50) and its new unconditional use in [`DictionaryService.ts:719–733`](https://github.com/okeylanders/prose-minion-vscode/blob/a3a18687ac15f71ed11a71f4215c6081ec12e8ba/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L719-L733).

The reader checks each line as though it were top-level Markdown. It misses a fenced-code opener following a list marker, then reads that same block's indented closing delimiter as a new opener. `closeUnterminatedFence` consequently appends a delimiter to an already valid block. In the combined entry, that added delimiter is actually a new top-level opener, which consumes the remaining independent sections. This applies to **all** Fast blocks, not just the new palette block.

Give the Fast Definition request this valid Markdown, and let every remaining block succeed:

````markdown
# 📕 Definition

A quoted code sample.

- ```text
  hello world
  ```
````

With `{ includePalettes: false, includeEncyclopedia: true }`, the helper appends one extra top-level three-backtick line. The production renderer displays the list sample normally but puts Pronunciation through Topic & Related Lexicon into a single plain code block. Their headings and other Markdown formatting are no longer rendered. Metadata still says **16/16 successes**, and the service logs that it closed an unterminated Definition fence even though the original block was complete. The original unmodified block followed by Topic renders correctly with the real `marked`/Dictionary renderer.

**Independent evidence:** Four desired-safe service→renderer witnesses fail: an unordered-list backtick fence, an ordered-list backtick fence, an unordered-list tilde fence, and a `<pre>` HTML container containing literal backticks. Each first verifies that the original Markdown renders the Topic heading normally, then drives the real Fast service with synthetic completed responses and verifies that the Topic heading disappears into code after the new repair. The raw Topic text remains readable as code; this is a new formatting/boundary regression, not the silent text omission in F-01.

**Requested change:** Identify an actually unterminated fence in its Markdown container context before appending a closer, or otherwise limit the repair so already well-formed Markdown is unchanged. Add real assembly/rendering regressions for closed list-contained fences and raw HTML code containers, with palettes both disabled and enabled. Retain the passing F-01 cases, shorter/longer-delimiter handling, valid raw output, and progressive Standard rendering. Avoid treating a line-level delimiter matcher as a complete CommonMark block parser.

## Initial independently verified behavior outside F-01

- **Current product contract:** The base already contains the merged Show vs. Tell feature and the three Chromatic Palettes spec commits. Names and short definitions are first-class. The implementation uses the spec's recommended placement, default-on UI switch, tooltip/accessible RGB, and model-chosen evocative palettes; those recommendations remain explicitly identified in the PR rather than presented as newly resolved user decisions.
- **Architecture and scope:** One closed, opt-in fenced-block registry is used only by the Dictionary result and streaming views. Other Markdown surfaces and Workshop transcript/export semantics are unchanged. The pure palette parser has no React dependency. The switch extraction keeps `UtilitiesTab` below 500 lines; the two larger touched services were already over that guideline.
- **Security:** The DOMPurify configuration and original sanitization test are byte-identical to the base. Independent style-injection probes reject CSS declarations, URLs, functions, alpha/shorthand hex, embedded NULs, full-width digits, and invalid hex while keeping valid neighboring swatches. Headers, names, definitions, and notes remain escaped text nodes. Accepted inline styles contain only the validated background color. No real external network request is used in these probes.
- **Parser and replacement behavior:** Independent checks cover every character prefix of a mixed entry, 2,000 deterministic noisy inputs, Unicode code-point caps, the eight-row ceiling, mixed nested/invalid/valid fences, reference links across Markdown runs, and removing the opt-in registry. Forty repeated multi-palette rerenders keep unique accessible figure labels and correct row counts without stale nodes.
- **Real Dictionary components:** Copy and Save preserve the complete raw fence bytes in mocked host-message payloads. Actual hook/component streaming renders the palette, disables the option switch, preserves a canceled partial entry, restores the switch, and replaces the palette with a later plain result. Actual `StreamingContent` also passes character-boundary rendering and near-black/near-white color-value probes. These are DOM/component checks, not native visual evidence.
- **Retained dictionary behavior:** Independent host probes cover all nine `undefined`/`false`/`true` option combinations through Standard, handler-backed streaming, and Fast; exact-boolean palette opt-in; real prompt-loader missing/empty resource fallbacks; numbering/final-Topic placement; raw content; sparse Standard/streaming diagnostics; out-of-order Fast completion; usage/progress aggregation; and failure/retry isolation. UI persistence, auto-run payloads, and persona exclusion also pass the committed tests and were inspected at their actual call sites. Independent byte comparisons confirm the original 15 Fast block files, original blueprint entries, and reference example are unchanged; the Topic block is a byte-identical rename to `17-topic-related-lexicon-block.md`.

## Initial verification actually run

All checks below target **`c5f7b0b702aebcf67f807277277a301e87d09e14`**, before this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**; fresh isolated cloud checkout and lockfile dependencies installed with lifecycle scripts disabled. No dependency or lockfile change was made.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **304 suites / 4,377 tests / 2 snapshots passed**, 125.031 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,121 warnings**; the five added warnings are naming-convention warnings |
| `npm run build`, including `verify:bundle` | Passed; webpack size/performance warnings remain |
| `git diff --check 37a1d06a..c5f7b0b7` | Passed |
| Independent parser/renderer and real Dictionary lifecycle probes | **21 passed**, 4.946 seconds, including 2,000 noisy inputs and the full character-prefix sweep |
| Independent repeated-render, actual StreamingContent, and switch probes | **4 passed**, 3.819 seconds |
| Independent host contracts and fallback probes | **68 passed** |
| Expanded F-01 service→renderer/UtilitiesTab witnesses | **8 desired-safe assertions failed / 9 controls passed / 1 defect characterization passed**; together with the 68 host probes, **86 tests** ran in 3.549 seconds on independent rerun |
| Implementation-head GitHub CI | **Success**, [run 38161316078](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38161316078) at `c5f7b0b7` |

## Re-review verification at `a3a18687`

The full correction delta from report commit `3b937d1a` is eight files, +388/−19. The shared fence reader, host normalization, renderer recovery, new regressions, and the two documentation changes were independently inspected. No functional change was made by the reviewer.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **306 suites / 4,425 tests / 2 snapshots passed**, 91.558 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,122 warnings**, one new mock naming-convention warning |
| `npm run build`, including `verify:bundle` | Passed; webpack size/performance warnings remain |
| `git diff --check 3b937d1a..a3a18687` | Passed |
| Original F-01 desired-safe cases | **8 passed** |
| Retained independent host contracts | **68 passed** |
| Retained parser/Dictionary lifecycle probes | **21 passed**, 4.512 seconds |
| Retained repeated-render/streaming/switch probes | **4 passed**, 3.508 seconds |
| New independent Standard recovery/security probes | **18 passed**, 3.725 seconds |
| F-02 desired-safe container witnesses | **4 failed**, 2.941 seconds on independent rerun; all reproduce F-02 |
| Correction-head GitHub CI | **Success**, [run 38164319975](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38164319975) at `a3a18687` |

The initial report-only head `3b937d1a` also passed [CI run 38163248577](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38163248577). Neither green CI run settles the new independent regression.

### Verification limits

A synthetic preview built successfully from the actual components and production CSS. The supported cloud browser could not reach it: navigation to the local preview returned **`net::ERR_CONNECTION_REFUSED`**. No rendered-feature screenshot was obtained, and no restricted alternate route was attempted. JSDOM does not establish narrow/wide visual layout, theme contrast, native keyboard traversal, tooltip presentation, screen-reader behavior, or streaming paint quality. The spec's Extension Development Host checklist remains open.

No live or billable provider calls were made. Generated grammar compliance, plausible palettes for real words, and the factual accuracy/etymology of generated color definitions remain unverified. Green mocked tests do not establish those qualities. No secrets or real manuscript were used.

This review commits only this report. It makes no functional edit, merge, branch deletion, release, or deployment. Required CI on the next report-only branch head is a separate check; F-01 is addressed and F-02 remains open at `a3a18687`.
