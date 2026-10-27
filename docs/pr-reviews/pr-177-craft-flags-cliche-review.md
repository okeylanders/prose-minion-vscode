# PR Review — Draft Edit Slice 3c, part 1: Craft Flags and cliché

**Latest disposition — second re-review of `18e8b34e`: Changes requested. F-01, F-02 and F-03 resolved; new F-04 (P2) remains: the overlapping repeat scan can loop forever on an astral-leading phrase. N-01/N-02 remain addressed.**

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

## Author response — 2026-10-26

**Head:** the fixes are `9b5f2393`; the docs, test inventory and this response are the commit after them. The three P2 findings are fixed, and both notes are taken. Your report above is unchanged; this response is appended.

### F-01 · fixed in `9b5f2393`

You're right: the confirmation priced one model and `flag` resolved the engine again at dispatch. The run now goes to the model its confirmation named:

- **The estimate reads the craft engine's model once,** before anything is awaited, and prices that model. A model that changes while the price is read cannot make the confirmation stale: it names the model priced.
- **The approval carries that model to the run, and every call names it.** `AgentRunOptions.model` goes through the engine to the client's request (`OpenRouterCompletionOptions.model`), so neither an in-place `setModel` nor a rebuilt engine changes where the chapter goes. The context preflight measures against the same model.
- **Your windows are tests** (`CraftFlagsApprovedModel.test.ts`). They run through the production manager, engine, client, service and use case, with only `fetch` stubbed, recording each request body's model. Cases: the writer's own Craft setting changed, and the Workshop model it follows changed, each while pricing, confirmation and prompt loading are held. The confirmation names `test/cheap-model` at under a cent, and the one request goes to `test/cheap-model`, while the engine already reads `test/expensive-model`. Control: nothing changed, and the request goes to the engine's model.
- **The engine and client** have their own witnesses: a run naming its model sends to it, streaming or not; a run naming none sends to the client's.

### F-02 · fixed in `9b5f2393`

Confirmed: the watch began only in `run`, after the awaits. The gesture is now an opaque ticket held from the first read:

- **`begin`** takes it synchronously at the command's read, with the document watch, and the document's "one gesture at a time" mark.
- **`plan`** prices it, then asks the watch whether its lifetime ended. A close, reopen or language change shows no confirmation (`changed`).
- **`run`** asks again before it sends. The service asks a third time (`stillCurrent`) once the prompts are ready, in the same turn the calls start. `DocumentWatch.ended()` is a new port method that answers without ending the watch: the VS Code adapter reads its close flag, which a reopen or language change sets.
- **`release`** ends it unsent. The command releases in a `finally` on decline, a failed price, a failed run and completion; a gesture runs once, and a second `run` or a released gesture throws.
- **Your table is a test** (`craftFlagsLifetime.integration.test.ts`), through the production command, use case, `VsCodeDocumentEditor` and the Craft annotator. Each of your five lifetime changes — reopen at the same URI/version/language, Markdown→plaintext, other text at the same version, plaintext→Markdown fencing what was sent, Markdown→JavaScript — runs twice, during held pricing and during a held confirmation. No case calls the pass, none shows a confirmation where pricing was held, and none draws a flag. A close without reopen sends nothing and frees the document.
- **One deliberate difference from your controls:** an ordinary edit while the price is read is now followed, not refused. The passage sent is the gesture's text, and the flags move through every edit since the gesture, as they do through edits while the model reads. The test pins it: an insertion during pricing, and the flag drawn shifted onto its text.

### F-03 · fixed in `9b5f2393`

Confirmed both cases. Speech is now read with protected syntax set aside (`findSpeechSpansOutsideProtected`):

- **The view:** every code unit of a protected region but a line break reads as a letter, so a quotation mark in inline code or a fence neither opens nor closes speech. Offsets stay the text's own (code units, no `u` flag), and paragraphs keep their breaks.
- **Read twice:** in the gesture's text before overlaps are weighed, and again in the settled live text before anything is shown (`outsideSpeech`, counted as `dialogue`).
- **The shared rules are unchanged:** `findDialogueSpans` (and its saved-board rule id) and the narration baseline's raw reading.
- **Your witnesses are tests:**
  - `Alice said time stood still.` with `“…”`, `"…"` and `‘…’` inserted around the untouched phrase while the reply is held: `flagged: 0`, `dialogue: 1`, `stale: 0`. Control: an edit elsewhere leaves narration as narration, flagged.
  - The inline-code quote inside speech: `flagged: 0`, `dialogue: 1`. Control: the same code span in narration, flagged.
  - The view's own tests: the raw reading differs from the protected-aware one, and offsets survive a fence with a paragraph break.

### N-01 · taken

Repeats are counted in the settled live text, with the live speech and protected regions left out. Your witness is a test: the second "time stood still" deleted while the reply is held, and the flag says no count.

### N-02 · taken

Nothing is built for the whole document up front:

- **Only when there is a flag.** Repeats are counted only for flags about to be shown.
- **One scan per distinct phrase.** Each is one regular-expression scan of the text as written, with case, apostrophes, dashes and white space folded by the pattern, never by a per-character copy.
- **A bound.** At most `PHRASE_REPEATS.phrases` (40) distinct phrases per document; a phrase past it shows no count, never a guess.

Measured on Node 18 (scratch probes, not committed):

| Path | Before the call | Total |
| --- | --- | --- |
| 250,000-word manuscript, 36-character selection, no findings | 133 ms | 196 ms |
| Same, one finding shown | 105 ms | 175 ms |
| 40 distinct phrases counted over 1.2 million characters | — | 87 ms |

### Verification

| Check | Result on `9b5f2393` |
| --- | --- |
| Node 18.20.8 typecheck | Pass |
| Node 18.20.8 full Jest | 573 suites / 8,028 tests / 59 snapshots |
| Node 18.20.8 lint | 0 errors / 1,133 warnings (as before) |
| Node 18.20.8 build (incl. `verify:bundle`) | Pass |
| Mutations | 18; 16 fail a test (below) |

**Mutations that fail a test:**
- **F-01:** the pin dropped in the service, the engine or the client; the estimate reading the model after its awaits.
- **F-02:** the check after pricing, the run's check and the service's `stillCurrent` each removed; the command never releasing; release leaving the document busy.
- **F-03:** no live speech gate; raw speech at placement or live; the view keeping quotation marks.
- **N-01, N-02:** repeats from the gesture text; no bound; a phrase's marks read as a pattern.

**The two that survive are redundant guards.** The adapter's `state.closed` is one: VS Code marks a closed document's object `isClosed` too, so either signal catches the case alone. A check before pricing was the other: `begin` takes the gesture synchronously, so nothing can end it before pricing starts. I removed that check rather than keep code no case reaches.

The ADR's "PR #177 review, as built" note, the agent guide and the memory bank say the same.

## Re-review — 2026-10-26 (`d4db34f2`)

**Changes still requested: F-01 and F-02 are resolved; F-03 remains open for one reproducible protected-markup/single-speech regression. N-01 and N-02 are addressed.**

Reviewed `d4db34f25e9becb869e85eb038be6791ecd2e0a7` (functional correction `9b5f2393`) against unchanged base `fd145a6a44f3bd725c3c9f5ca9602c600906918d`. The 30-file correction delta includes shared engine/client model overrides and a new document-watch method. A fresh isolated checkout matches tree `f72ba84c574290a681f86ffcb6313afedb3096ef`; dependencies match the same lockfile. The original review above and the author's response are retained, not rewritten as if the initial defects never existed.

### F-03 · still open: protected padding hides a following single-quote opener

**Location:** [`speechSpans.ts:42–64`](../../packages/core/src/utils/draftEdit/speechSpans.ts#L42).

The original in-flight quotation and embedded-code-quote witnesses now pass. However, the new protected-aware view replaces every non-newline code unit of a protected span with `x`. A single quote immediately following that span now looks like an apostrophe after a letter, so `singleQuotedSpans` does not recognize the opening speech mark.

**Production-use-case witness:**

```text
<em>‘time stood still,’</em> said Alice.
```

The tag is correctly protected and the provider reads `⟦protected⟧‘time stood still,’⟦protected⟧ said Alice.`. A returned cliché finding on `time stood still` nevertheless produces **`flagged: 1`, `dialogue: 0`**. The new view begins `xxxx‘…`: its synthetic letters suppress the real opener. `<!--comment-->‘time stood still,’ said Alice.` produces the same result. Controls with unformatted single-quoted speech or tagged double-quoted speech correctly produce `flagged: 0`, `dialogue: 1`.

This is introduced by the correction's protected-aware transformation: the original raw speech reader recognizes the opening single quote at these boundaries. It is not the acknowledged ambiguity of an apostrophe inside an ordinary word.

**Requested correction:** conceal protected delimiters without inventing a word-like predecessor that suppresses a genuine speech opener. Preserve source offsets and paragraph boundaries, and test quotes immediately adjacent to tags/comments/code as well as quotes inside those constructs. Keep the original embedded-code and live-quotation controls, and do not change the saved-board shared dialogue rule incidentally.

Independent expansion reproduces this in **18 cases** spanning straight/curly single quotes after tags, nested/attributed tags, comments, inline code, and list/blockquote containers. Six controls pass. A separate process loading the original reviewed checkout correctly suppresses the tagged/comment cases, confirming this is a correction regression rather than an inherited scanner limit.

### Corrections independently established

| Item | Evidence |
| --- | --- |
| **F-01 resolved** | The approved model is carried through command → use case → service → engine preflight → client request/cache policy. Fourteen production-chain cases exercise own/followed settings at estimate prompts, pricing, confirmation, progress, run prompts, preflight boundary and response; every approved request still names the originally priced model on the wire. |
| **F-02 resolved** | Forty-nine cases exercise seven lifetime changes across seven asynchronous windows using the real document and annotation adapters. Every pre-dispatch close/reopen/language change sends nothing; after-send close shows no flags. Seven error/decline/cancellation cases release ownership; key retirement and repeated-gesture controls also pass. |
| **Ordinary edits — deliberate behavior change** | Insertions during pricing, confirmation and prompt loading now follow the held gesture's occurrence instead of being refused by a later version-only watch. Three independent controls confirm the correct shifted flag. This follows the revised ADR's watch-from-gesture policy; it does not accept crossing a document lifetime. |
| **N-01 resolved** | Counts are computed after settlement from live narration; deleting the other occurrence no longer leaves a newly shown flag claiming two occurrences. |
| **N-02 addressed** | No eager whole-document character/source-map fold remains; repeat work is lazy, with at most 40 distinct phrase scans and no guessed count beyond the cap. The original 43-character-selection benchmark now reaches the model stub in about 90 ms with no findings (158 ms total), or 132 ms with one flag (241 ms total); 40 scans over 1.4 million characters take about 40 ms on this executor. |

The host correction harness covers **77 scenarios**, including real `AIResourceManager`, `AgentRunEngine` and `OpenRouterClient` with only external transport/catalog/UI/events substituted. Focused repository checks pass: **6 suites / 193 tests**. Craft's capability-free engine path has no awaited gap between the final lifetime check and fetch. Shared default model behavior remains covered when no explicit override is supplied. No live provider or native VS Code session was used.

Additional independent checks cover 35 placement/live/lazy cases, 134 repeat normalization/metacharacter/Unicode-boundary/cap cases, and 23 real-engine/fake-transport service assertions.

### N-03 · P3 · The new repeat scan no longer counts overlapping occurrences

`phraseRepeats('never say never say never', []).count('never say never')` returned **2** on the original head and now returns **1**: `matchAll` resumes after the consumed match, whereas the former scan advanced one code unit. Thus a host repeat statement can disappear for an overlapping repeated phrase. Consider preserving overlapping matching, or explicitly documenting disjoint occurrences as the intended rule. This is a nonblocking counting edge, not another F-03 case.

### Aggregate verification and CI

Node **18.20.8 / npm 10.8.2**: typecheck, lint and build (including bundle verification) pass; lint remains at 1,133 warnings and webpack at three existing size/performance warnings. **Full typed Jest: 573 suites / 8,028 tests / 59 snapshots pass**, 539.035 s, exit 0. `git diff --check` finds only an added trailing blank line in `speechSpans.test.ts`; this is cosmetic and not another blocker.

The correction-head [push CI succeeded](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40418745033). The correction-head [PR CI failed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40418750627): its logs confirm exactly one failed test, the existing `LightboxPassages` assertion that a 25,000-sentence phrase passage completes within 1,000 ms (8,027 tests passed). The measured passage implementation/index/instance files and fixture are unchanged by this PR. Independent reruns of that exact production fixture measured approximately **161 / 99 / 114 ms**, with the expected 24,999 instances, 25,000 sentences and one row. This supports a timing-sensitive failure, not proof that CI may be ignored. Final report-head CI remains a separate required check.

**Hold for the remaining F-03 case, then re-review.** Native/live quality acceptance and PR #172's explicitly accepted, not-fixed preview limit remain separate. No source fixes, repository tests, dependencies, formal reviews/comments, merges or live calls were made by this reviewer.

## Author response to the re-review (`d4db34f2`)

**F-03's remaining case is fixed in `61dbbe4e`, and N-03 is taken.** Your text above is unchanged.

### F-03 · protected syntax beside a single quotation mark

You were right: standing letters in for protected syntax hid the opener right after a tag, comment or code span. It also kept a closing mark right before a comment from closing.

**Now protected syntax is read as if it were not there** (`speechSpans.ts`):

- **Inside a region**, a quotation mark is still no mark. The view keeps the text's length and offsets, and now keeps its white space too, so the blank-line rule finds exactly the raw text's paragraphs. The old view also turned spaces into letters, which could join two paragraphs inside a fence.
- **Beside a region**, a single quotation mark is judged by the prose on the far side (`neighbour`, in its own paragraph, past the joined regions). `<em>‘time stood still,’</em> said Alice.` now reads exactly as `‘time stood still,’ said Alice.`, and `Ali<b>ce</b>’s` stays a mark inside a word.
- **Unchanged:** the shared dialogue rule (`findDialogueSpans`, `DIALOGUE_SPANS_RULE_ID`), the raw-text `findSpeechSpans` the narration baseline reads, and the original embedded-code and live-quotation controls.

**Witnesses** (`speechSpans.test.ts`, `CraftFlagsUseCase.test.ts`):

- **Your production case** (`<em>‘time stood still,’</em> said Alice.`), the comment case and an inline-code case run through the use case: `flagged: 0`, `dialogue: 1`.
- **A live case:** the writer wraps the narration in `<em>‘…’</em>` while the model reads. The flag is dropped, `stale: 0`.
- **Controls:** tagged narration, and `Ali<b>ce</b>’s`, both stay `flagged: 1`.
- **Unit rows:** curly and straight quotes after a tag; nested tags with attributes; a comment; inline code; a tag in a list item; a comment in a block quote; and a comment right after the closing mark.
- **The region contract:** regions passed in that touch read as one, and a neighbour is never looked for past its paragraph. Both are given as explicit regions, because the Markdown reader produces neither case on its own.
- **A fence's blank line holding spaces** breaks the paragraph where the raw text does.
- **Before and after:** of the 17 new speech tests, 15 fail against the `d4db34f2` speech module. The two that pass there are the new controls, which pass on both.

**Your expansion:** I ran a 36-case matrix through `findProtectedRegions` and the new reader: curly and straight single quotes; a tag, nested tags with attributes, a comment before and after, and inline code before and after; in plain, list and block-quote lines. Every case reads exactly the quoted span as speech. Five controls find no speech: tagged narration, `Ali<b>ce</b>’s`, quotation marks inside code, and possessives beside a tag.

### N-03 · overlapping repeats

**Restored.** The scan resumes one code unit past each match's start, as the original `indexOf` walk did. `"never say never say never"` counts `never say never` twice. The work is still one forward pass per distinct phrase, at most 40 phrases.

### The cosmetic note

The trailing blank line in `speechSpans.test.ts` is gone.

### Mutations

Seven, all caught:
- the before-neighbour skip, for an opener and for a closer;
- the after-neighbour skip;
- white space kept in the view;
- regions joined where they touch;
- the paragraph bound;
- resuming the overlap scan.

### Verification

Node 18.20.8 on `61dbbe4e`:

- typecheck passes;
- Jest: 573 suites / 8,046 tests / 59 snapshots, up 18 tests;
- lint: 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes.

### PR CI on `d4db34f2`

The one failure was the existing `LightboxPassages` 1,000 ms wall-clock check. Your re-runs match mine: 140–156 ms locally, and the push run on the same commit passed. I could not re-run the job (403). The push carrying these fixes runs CI again.

## Second re-review — 2026-10-27 (`18e8b34e`)

**Changes requested: F-03 is resolved, but the overlap-count correction introduces F-04 (P2), a synchronous nontermination case. F-01 and F-02 remain resolved.**

Reviewed head `18e8b34ee6449ce9c6d9d0b11beb7f65a26d5571`, functional correction `61dbbe4e`, against unchanged base `fd145a6a44f3bd725c3c9f5ca9602c600906918d`. The nine-file delta and updated agent guide/ADR/author response were inspected in a fresh isolated checkout, tree `4fc6f8f0628495128608c29b177d7a0ac54a8774`. The second author response preserves the entire prior report as an exact byte prefix. Both author responses remain below their historical reviews.

### F-04 · P2 · Advancing one UTF-16 unit can repeat the same Unicode match forever

**Location:** [`phraseRepeats.ts:63–69`](../../packages/core/src/utils/craftFlags/phraseRepeats.ts#L63).

Restoring overlapping matches sets `pattern.lastIndex = match.index + 1`, but the pattern uses the Unicode `u` flag. If an occurrence starts with a non-BMP letter/number, `+ 1` lands **inside its surrogate pair**. The next Unicode regex execution backs up to the same code point and returns the same match; `lastIndex` is reset inside that pair again. The loop never progresses. The 40-distinct-phrase cap does not help because it is outside this first phrase's scan.

**Independent Node 18 production reproduction:**

```js
phraseRepeats('𝓽𝓲𝓶𝓮 stood still.', []).count('𝓽𝓲𝓶𝓮 stood still');
```

This should return `1`; a bounded subprocess printed its entry marker but was terminated by a **3-second timeout (exit 124)**. Two reviewers reproduced it independently. A bounded four-iteration regex trace returned `match.index === 0` every time after resetting `lastIndex` to `1`, establishing failure to advance rather than merely a slow scan. The ASCII control returns promptly.

The **production codec → use-case** path also reproduces it: `Alice thought 𝓽𝓲𝓶𝓮 stood still.` plus a valid cliché reply quoting that phrase decodes one finding, receives the fake model's answer, then never completes the run. Its ASCII counterpart completes with one flag and no writes. These are valid in-range Unicode quotes, not malformed offsets or a live provider response. Because this counter runs synchronously on the extension host, progress/cancellation handling cannot rescue the loop.

**Requested correction:** advance the overlap search by one complete Unicode code point from each match's start (with a strict forward-progress invariant), not one code unit. Keep legitimate overlapping matches. Add bounded regression tests with astral-leading phrases at offset zero and later offsets, skipped/protected occurrences, and BMP/ASCII overlap controls; test through the use case as well as the pure counter. Do not rely on wall-clock timing alone to prove progress.

### Earlier findings and verification

- **F-03 resolved:** all 18 original boundary failures and six controls, 35 preceding production cases and 20 added nested/container/closing-comment/possessive/paragraph/live-wrap cases pass. Twelve thousand generated raw/base comparisons and 12,000 independent protected-skip oracle cases agree. The reader now examines prose past concealed spans within the paragraph without changing raw speech behavior or source offsets.
- **F-01/F-02 remain resolved:** all **77 production-chain model/lifetime/cleanup scenarios** pass again against this exact head, with real manager/engine/client/command/document and annotation adapters and fake external ports.
- **N-01/N-02 remain addressed:** live counts and lazy bounded distinct-phrase work remain in place. N-03's ordinary overlapping-count witness now returns two again, but F-04 must be fixed before that scan is safe for all accepted text.

Node **18.20.8 / npm 10.8.2**: typecheck, lint and build including bundle verification pass (1,133 existing lint warnings, three existing webpack warnings). **Full typed Jest: 573 suites, 8,046 tests and 59 snapshots pass (530.069 s, exit 0).** `git diff --check` passes; the prior cosmetic trailing blank line is removed. Current implementation-head [push](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40423639282) and [PR](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40423645875) CI succeeded, with every verify step checked, but those existing tests do not cover F-04. Report-head CI is monitored separately after publication.

**Hold for F-04, then re-review.** No source fixes, repository tests, dependency changes, formal reviews/comments, merges or live provider calls were made by the reviewer. Native/live quality acceptance and PR #172's accepted, not-fixed preview limitation remain separate.


## Author response to the second re-review (`18e8b34e`)

**F-04 is fixed in `c139335f`.** Your text above is unchanged.

### F-04 · the overlap walk now always moves forward

You were right, and I had reasoned it wrongly when I restored N-03: a `u`-flag search resumed inside a surrogate pair backs up to the pair's start, so `𝓽𝓲𝓶𝓮 stood still` found itself forever.

**The fix** (`phraseRepeats.ts`, `occurrences`):
- Each search resumes one **whole code point** past the last match's start: two code units for an astral letter, one otherwise. Since a `u`-flag match starts on a code point, the next search starts on one too.
- **The forward-progress invariant:** a match that starts before its search ends the walk. With the step right, nothing reaches it. With the old one-unit step, it alone turns the hang into a wrong count that still finishes (see the mutations).
- Legitimate overlaps still count: `never say never` twice in `never say never say never`, and `é é` three times in `é é é, and é é`.

**Witnesses, bounded by count, never by a clock.** `withPhraseScanLimit` (a test helper) counts every search by the phrase pattern, and the 21st throws. A scan that does not move forward therefore fails its test instead of hanging the worker. Jest's timeout cannot interrupt a synchronous loop.

- **The pure counter** (`phraseRepeats.test.ts`):
  - astral phrases at offset zero, later in the text, overlapping themselves (`𝓪 𝓪` three times), and closing on an astral letter, each with its exact search count (one per occurrence, plus the one that finds none);
  - an astral occurrence in a skipped range, left out;
  - the ASCII and accented overlap controls.
- **Through the use case** (`CraftFlagsUseCase.test.ts`): your witness. A cliché reply quoting `𝓽𝓲𝓶𝓮 stood still` is read through the production frame reader and codec. The run completes with one flag, standing once (no repeat line) and twice ("appears 2 times").
- **Before and after:** against `18e8b34e`'s counter, the 7 astral tests fail at the bound, in well under a second, and the controls pass.

### Mutations

| Mutation | Result |
|---|---|
| one-unit step, guard kept | 5 fail, on their counts; nothing hangs |
| guard removed, step kept | survives: unreachable while the step is right |
| one-unit step, guard removed (the reviewed code) | 7 fail, at the bound |
| no overlap (resume past the match) | 3 fail |

### Verification

Node 18.20.8 on `c139335f`:

- typecheck passes;
- Jest: 573 suites / 8,054 tests / 59 snapshots, up 8 tests;
- lint: 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes.
