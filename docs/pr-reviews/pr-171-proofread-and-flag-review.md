# PR Review — Draft Edit Proofread and Flag, Slice 1

**Author:** okeylanders · **PR:** [#171](https://github.com/okeylanders/prose-minion-vscode/pull/171)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `0edaf6914ef22a5541916e4808a368cea3235378`

**Base and merge-base:** `31edcfdfda7ebe2cab89a121cfdba5655dbd170a`

**Scope:** 81 changed files · +6,134 / −78

**Reviewed:** 2026-10-25 · **Reviewer:** Astra

**Mode:** independent source/contracts review; real use-case, adapter, manager, engine, client and recovery-store witnesses with synthetic inputs; serial local gates

## Summary

**Request changes. Six P2 findings remain open:** standalone Proofread can miss model/key changes; valid protected Markdown reaches the provider-bound payload; live re-anchoring can transfer a stale finding to different or protected text; a late reply can restore flags after document close; wholly missing usage makes a partial cost look complete; and a failed recovery write is reported as saved.

These are findings against the read-and-flag implementation. **No document modification, actual protected-text transmission, live paid provider request, or native VS Code failure was performed or observed.** Provider-bound requests were intercepted locally. The adapter findings execute production adapters against a controlled native-API test double, not an Extension Development Host.

The ADR's Accepted status and reported writer decisions are author-supplied design context, not independently verified user acceptance. This review does not answer the PR's questions about severity, selection replacement or confirmation wording for the writer. Selection runs replacing all prior flags, indented Markdown remaining prose, and cancellation leaving prior flags unchanged are reviewed as the stated policy, not treated as defects.

This report is scoped to the stated head/base. It is not a formal GitHub review, merge authorization, native accessibility acceptance, or clearance to enable the future document-write side.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | Standalone Proofread has no lifetime-owned model/key refresh subscriptions |
| F-02 | P2 | Open, blocking | Valid protected Markdown is included in provider-bound text and can be flagged |
| F-03 | P2 | Open, blocking | Live re-anchoring can move an obsolete finding to another occurrence or code |
| F-04 | P2 | Open, blocking | Closing a document does not invalidate its pending diagnostic result |
| F-05 | P2 | Open, blocking | A completely missing usage record makes a partial cost look like the run total |
| F-06 | P2 | Open, blocking | Recovery persistence failure is presented as a successful save |

## F-01 — Own model and key refresh outside webview lifetimes

**Locations:** [`extension.ts:418–429`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/apps/vscode-extension/src/extension.ts#L418-L429), [`ProofreadService.ts:86–88`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/infrastructure/api/services/proofread/ProofreadService.ts#L86-L88).

The new editor command can run without opening a Prose Minion webview, but the initialized AI manager's configuration and secret refreshes still depend on a `MessageHandler`. The sidebar creates that handler and its configuration listener only in `resolveWebviewView`; Workshop and Lightbox do so only when attaching a panel. Registering the providers does not instantiate those handlers. `ensureInitialized()` does not refresh an already initialized manager.

Independent witness uses the actual unopened sidebar provider, secret-storage service, AI manager, engine, OpenRouter client, Proofread service and real concurrency limiter. HTTP is stubbed only at `global.fetch`; unused webview/capability dependencies are isolated. No handler, configuration listener or secret listener is registered by the unopened provider.

1. Initialize with placeholder key A and Proofread model A; complete one synthetic call.
2. Change the fixture’s configuration to model B and delete key A through the real secret-storage service over its synthetic store, delivering the corresponding synthetic events with no webview open.
3. The next intercepted request still has model A and the old Authorization value.
4. In a separate six-chunk run, hold the first three requests, delete the key, then release them. **All six requests are dispatched with the old key**, all six chunks become `read`, and no key-change interruption is reported.
5. Control: invoke the missing `manager.refreshConfiguration()` after deletion and before release. Only three requests are dispatched; the results are three `read` and three `unsent`, with `key-changed`. The next run is unconfigured.

Thus the retirement mechanism works when called; production ownership of its event trigger is missing for this new standalone route. The key scenario can occur with a secret change delivered from another window, not only the settings UI that itself opens a webview. Full `extension.activate` was inspected, not dynamically executed in a native host. Existing retirement tests manually call refresh and cannot establish the subscription boundary.

**Requested correction:** give the shared manager's model/key subscriptions an extension-lifetime owner independent of webview resolution/disposal. Avoid duplicate refresh races with existing handlers. Add cold command activation, native model change, external key removal/replacement, and queued-chunk retirement coverage without opening any webview.

## F-02 — Recognize complete protected Markdown constructs before slicing

**Locations:** [`protectedRegions.ts:27–43`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/utils/draftEdit/protectedRegions.ts#L27-L43), [`protectedRegions.ts:81–92`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/utils/draftEdit/protectedRegions.ts#L81-L92).

Scanning the whole document before applying the selection is correct, but the scanner recognizes only a subset of the promised constructs. Raw-line fence parsing misses container prefixes, and the destination regex stops at the first closing parenthesis or refuses a newline. The inline patterns also miss email autolinks and multiline reference targets.

The real use case reproduced all of these with a synthetic spelling response for `teh`:

| Source (`\n` denotes a newline) | Actual result |
| --- | --- |
| `> ~~~txt\n> teh\n> ~~~` | Selecting only `teh` makes one provider-bound chunk containing `teh` and flags offsets 11–14 |
| `- ~~~txt\n  teh\n  ~~~` | Selecting only `teh` likewise sends it to the local stub and flags 11–14 |
| `[chapter](chap(one)/teh.md)` | Masked payload is `[chapter]⟦protected⟧/teh.md)`; the destination's `teh` is flagged |
| `[chapter](\n  secret/teh.md\n)` | Destination is not masked and its `teh` is flagged |
| `[chapter]:\n  secret/teh.md\n\nA chapter.` | Only the definition's first line is masked; the target remains and is flagged |
| `Contact <teh@example.invalid>.` | Email autolink remains in the payload and is flagged |

The repository's installed Markdown parser independently recognizes these as fenced code, link/reference targets or an email autolink. These are not the deliberately excluded indented-code case. Additional pure-scanner witnesses show inline-code leakage after a mismatched earlier backtick run, and attributes leaking after `>` inside a quoted HTML attribute. All observations are of **locally captured provider-bound payloads**, with no actual external transmission.

A simple link-label control passes: `[teh](chapter.md)` permits the label's flag while excluding its target.

**Requested correction:** scan complete supported Markdown constructs, including container-aware fences, balanced/escaped and multiline destinations, multiline definitions, email autolinks, and quoted HTML attributes, with reliable source offsets. Preserve the explicit indented-prose policy. Retain full-document and selection-inside-construct regressions asserting both payload exclusion and no annotation, rather than relying on the prompt to ignore leaked syntax.

## F-03 — Revalidate the same occurrence and its live protection status

**Locations:** [`DraftEditUseCase.ts:251–274`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/application/services/draftEdit/DraftEditUseCase.ts#L251-L274), [`anchorEdits.ts:71–86`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/utils/draftEdit/anchorEdits.ts#L71-L86).

The live re-anchor supplies surrounding context, but the generic model-quote matcher progressively discards it and can fall back to the quote alone anywhere in the document. Exact equality with `issue.original` proves the same characters, not the same occurrence. The live path also never recomputes protected regions.

Independent real-use-case witnesses, holding the provider reply while changing the live buffer:

1. Start with `Alice saw teh rabbit. Elsewhere teh bird sang.` and a response specifically identifying the first `teh` with context. Correct the first occurrence to `the`. The result incorrectly flags the second `teh` at 32–35, reporting zero stale drops.
2. Start with `Alice saw teh rabbit.` and wrap it in a `text` fenced code block before the reply lands. The result flags 18–21 inside the live protected range 0–33.
3. Put a second `teh` in an already existing fenced block and correct the prose occurrence during the held call. The finding relocates into that code block, again with zero stale drops.

A control inserting `One day, ` before an unchanged issue correctly moves the flag. The problem is not all movement; it is accepting a different occurrence or a newly ineligible one as the original finding.

**Requested correction:** distinguish permissive model-quote placement from same-occurrence live validation. Preserve occurrence identity through changes or require sufficient evidence and drop stale results when identity cannot be established. Recompute live protected regions and refuse protected placement before showing the result. Retain corrected-duplicate, newly fenced, existing-code duplicate and harmless-prefix controls, with accurate drop counts.

## F-04 — Invalidate pending flags when the document lifetime ends

**Locations:** [`VsCodeDocumentEditor.ts:14–18`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L14-L18), [`VsCodeIssueAnnotator.ts:44–63`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/apps/vscode-extension/src/platform/vscode/VsCodeIssueAnnotator.ts#L44-L63), [`DraftEditUseCase.ts:156–164`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/application/services/draftEdit/DraftEditUseCase.ts#L156-L164).

Close clears annotations currently stored in the adapter, but does not invalidate an in-flight run. On landing, `snapshot` loads a closed resource with `openTextDocument`; `show` then accepts that newly open document. A numeric version does not identify a document lifetime.

Independent production-use-case plus production-adapter sequence against a controlled VS Code API double:

1. Start a held run on version 1 of `Alice saw teh rabbit.`.
2. Deliver `onDidCloseTextDocument` and remove it from `workspace.textDocuments`.
3. Complete the provider reply. `openTextDocument` is called once and a diagnostic at 10–13 is republished, undoing the close clear.
4. Separately, close and reopen the same URI with a new version-1 document containing `0123456789NOT A TYPO.` before release. The version-equality shortcut skips re-anchoring and draws the old spelling diagnostic on `NOT`.

The second case is a controlled lifetime/version-collision witness, not a claim that a native reopen was exercised. The first does not require a version collision. VS Code documents version progression within a document and treats closed document objects as closed rather than reusable; URI plus version alone is not a lifetime token. See the official [TextDocument API](https://code.visualstudio.com/api/references/vscode-api#TextDocument).

**Requested correction:** bind a run to a document lifetime/invalidation generation and refuse late annotations after close, including after reopen or language change. Do not reload a closed editor-command target solely to place an old reply. Keep any intentionally open-by-URI behavior needed by future Workshop callers separate. Add both held-close and close/reopen regressions. This is not a request to change the separately specified user-cancellation policy.

## F-05 — Keep wholly absent telemetry in the completeness calculation

**Location:** [`tokenUsage.ts:14–29`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/utils/tokenUsage.ts#L14-L29).

`sumTokenUsage` removes `undefined` records before checking whether every call reported cost/cache values. That handles a missing field in an existing usage record, but not a call with no usage record at all.

The actual OpenRouter client and Proofread service consumed two successful synthetic replies: the first reported 10 prompt tokens, 10 completion tokens, 20 total tokens, cost `0.1` and 3 cached tokens; the second omitted `usage`. Both chunks were read and two HTTP-boundary calls completed. The final usage nevertheless contained `costUsd: 0.1`, `cachedTokens: 3` and `requestCount: 1`. The summary would display `$0.1000` as the run's cost even though the second call's cost is unknown.

**Requested correction:** retain whole-record absence when determining completeness of aggregate cost/cache fields; do not promote a known subtotal to a complete total. Represent the number of completed calls separately or count it truthfully rather than counting only telemetry-bearing replies. Do not invent the unreported cost or conflate absent usage with a reported zero. Add `[reportedUsage, undefined]` and all-missing controls through the real client/service mapping. The separate Lightbox/Dictionary adoption debt need not expand this fix's scope.

## F-06 — Do not claim a rejected response was saved when persistence failed

**Locations:** [`ProofreadService.ts:174–181`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/infrastructure/api/services/proofread/ProofreadService.ts#L174-L181), [`draftEditSummary.ts:43–44`](https://github.com/okeylanders/prose-minion-vscode/blob/0edaf6914ef22a5541916e4808a368cea3235378/packages/core/src/application/services/draftEdit/draftEditSummary.ts#L43-L44).

The service discards the receipt returned by `persistRejectedModelResponse` and returns only `kind: 'rejected'`. The summary therefore cannot distinguish saved responses from failed storage and always says “saved for recovery”.

Independent witness uses the actual recovery store, with no workspace and an extension-storage filesystem whose `writeFile` throws a synthetic EACCES. The store attempts one write, catches/logs the failure and returns no receipt. No recovery editor is presented. The actual service → use case → summary still produces:

> Proofread synthetic.txt: no issues found · 1 part unreadable, saved for recovery

This falsely assures the writer that the rejected paid response remains available. It is not deletion or corruption of a previously saved response.

**Requested correction:** carry persistence success/failure through the chunk and run outcome and use truthful summary wording, with a useful failure indication when no receipt exists. Preserve the intended once-per-run presentation and independent captures per rejected chunk. Test successful persistence, failed persistence and mixed outcomes; existing callers' receipt-aware recovery wording is a useful precedent.

## Positive coverage and boundaries

- The flag command has no document-write path. The new ports remain host-independent; core boundary tests constrain access to the use case, and the diagnostic adapter owns movement/removal and native code actions. Future apply/edit/undo behavior is not implemented or cleared by this review.
- Selection/full-file capture, language refusal, long-file confirmation before calling, same-URI busy exclusion and cancellation were inspected and are covered by the passing repository suite. Cancellation intentionally leaves existing flags unchanged; key/provider interruption retains already completed chunks. The real retirement/concurrency control confirms the latter when refresh is delivered.
- An independent adapter control moves a shown flag after prefix insertion, matches its copied diagnostic to the shifted code action, dismisses it by ID and clears on close after completion. The late-close finding concerns unfinished work, not that normal control.
- Exact/normalized anchor matching, ambiguity rejection, UTF-16 positions with astral characters, protected-offset boundary mapping, multi-change range shifting and exact chunk slices were inspected and exercised. One nonblocking future-write-side hardening case remains: `anchorQuote('Wait…', { quote: 'Wait.' })` returns the whole source span even though its normalized text is `Wait...`, not `Wait.`. Require valid boundaries in one-to-many normalization expansions before using those spans to apply edits. Likewise, the current guard's line-break-count comparison permits moving a newline without changing its count; a future write-side gate must enforce the stronger no-line-break-change policy. Neither path edits a document in Slice 1.
- Proofread has an own model selection, manifest default, settings row and capability-free run policy. Scope isolation works when manager refresh runs; F-01 is the missing standalone subscription, not a failure of the scope map or retired engine check.
- The shared tolerant parser remains in use. Cut-off replies are rejected before parsing with no salvage; malformed individual issues are dropped, unknown fields are counted without exposing their names, and root/frame failures reject the chunk. The existing deep/truncated repair regression suite is included in the full run.
- The recovery registry refactor preserves existing persisted IDs/protocols and updates runtime Lightbox/widget imports; no compatibility regression was established. The once-only presenter sets its guard synchronously, so racing rejected chunks do not each open an editor. F-06 concerns the lost persistence result, not duplicate presentation.

## Verification

All local execution used an isolated cloud checkout with matching lockfile and verified checkout-local workspace links. Required gates ran serially under task-local Node `18.20.8` / npm `10.8.2`, without changing the system runtime. Full Jest used `NODE_OPTIONS=--max-old-space-size=2048`, one worker, a 1,000 MB idle limit and a disk-backed cache. An additional full suite ran under ambient Node `24.19.0`. All provider evidence uses synthetic text and locally intercepted HTTP; no paid call, private manuscript or implementation edit was made.

| Check | Independent result |
| --- | --- |
| Full repository Jest, Node 18 | Pass; 531 suites / 7,378 tests / 59 snapshots |
| Typecheck, Node 18 | Pass; core, webview and VS Code adapter |
| Lint, Node 18 | Pass; 0 errors / 1,133 warnings |
| Production build + `verify:bundle`, Node 18 | Pass; existing webpack bundle-size warnings |
| Full repository Jest, Node 24 | Pass; 531 suites / 7,378 tests / 59 snapshots |
| Independent lifecycle/protection regressions, Node 18 and 24 | 11 expected-behavior assertions fail at F-02/F-03/F-04; 3 controls pass; 14 tests total |
| Real manager/client/service/store witnesses, Node 18 and 24 | F-01/F-05/F-06 reproduced; retirement control prevents queued sends after explicit refresh |
| Pure anchor/masking/chunk/shift probes | Invariants above pass; documented expansion-boundary and scanner cases reproduced |
| `git diff --check` | Clean for the implementation delta and report |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40151113492) at `0edaf691` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40151174514) at `0edaf691` |

Independent regression failures are deliberately failing desired-correctness assertions, not failures of the repository's committed suite. They were run outside the checkout; this publication adds only this report. Source and actual adapter execution do not substitute for native command activation, context-menu interaction, editor squiggle/F8 presentation, focus, cancellation notification behavior or screen-reader validation. **The native Extension Development Host was not exercised.** Cloud/Jest timings are not predictions of editor latency or model quality. The proposed human host pass and seeded-fixture false-positive evaluation remain outstanding.

---

## Author response — 2026-10-25

**Implementation head:** `ad33ecbd` (base `31edcfdf`, unchanged since the review). All six findings are fixed with regression tests; the decisions are recorded in the ADR's new "Amendment 2026-10-25: PR #171 review (Slice 1)" section.

| ID | Status | Commits |
| --- | --- | --- |
| F-01 | Fixed | `03dfd83e`, `ad33ecbd` |
| F-02 | Fixed | `4f3c5859` |
| F-03 | Fixed | `32203d3a` |
| F-04 | Fixed | `32203d3a` |
| F-05 | Fixed | `09d2a815` |
| F-06 | Fixed | `32203d3a` |

### F-01 — `AIResourceRefresh` owns the manager's subscriptions

- `orchestration/AIResourceRefresh.ts` is built once in `extension.ts`, before any provider or command is registered, and disposed with the extension.
- **Key changes.** It subscribes to the secret store's change event and rebuilds the manager, which retires every engine a run still holds (PR #169 F-01).
- **Model and legacy-key settings.** One extension-lifetime `onDidChangeConfiguration` registration feeds it. A model setting hot-swaps in place; a legacy-key setting rebuilds.
- **Duplicate refreshes.** Every surface that hears a key change now asks the owner through `refreshKey()`: the owner's own listener, each webview's `MessageHandler`, and the Settings overlay's Save and Clear (`ConfigurationHandler`). It compares a SHA-256 fingerprint of the stored key (never the key itself) with the one its last rebuild read. The first caller to read a new key starts the rebuild; the rest join it, and a caller that finds the key unchanged builds nothing. One key change is therefore one rebuild, and no second rebuild retires a run that began after the change.
- **Overlay.** `ConfigurationHandler` still awaits the rebuild before it answers, so `LightboxKeyRetirement` holds unchanged.
- **Unchanged.** `AIResourceManager.refreshConfiguration()` still rebuilds unconditionally, as its own tests pin, and model hot-swaps stay idempotent.
- **Tests:**
  - `ProofreadColdRefresh.test.ts` runs with no handler at all, through the production `SecretStorageService` (over a store that fires its change event), manager, engine, `OpenRouterClient` and `ProofreadService`. HTTP is stubbed at `fetch`.
  - It covers a native model change, a key removed from another window, a key replaced, and the six-chunk run: three held, the key deleted, three dispatched, `read ×3, unsent ×3`, `key-changed`, the next run unconfigured. It also checks one rebuild when two surfaces ask.
  - Each scenario waits for the rebuild that the change event alone starts. With the owner's subscriptions disabled, all four scenarios fail.
  - Also: `AIResourceRefresh.test.ts` (unit rules), `MessageHandler.test.ts` and `ConfigurationHandler.test.ts` (refresh through the owner, never the manager directly), and `providerAssembly.test.ts` (wiring before any webview or command).

### F-02 — complete constructs

- **Blocks.** `utils/draftEdit/markdownBlockRegions.ts` takes block structure from `marked`'s block lexer (`new Lexer(getDefaults()).blockTokens`).
  - It finds fenced code, link reference definitions and raw `<script>`/`<style>` blocks inside block quotes and list items, nested or not.
  - Each container keeps its source lines one for one (verified against marked 16.4.1 for quotes, lists, nested containers, tab-indented items and lazy lines), so each region is whole source lines. Every protected block is also checked line by line against the source.
  - It fails closed: a child that does not continue its container's content, a misaligned block, a lexer error, or nesting past any manuscript (33 quote markers, or a list marker past 64 columns) protects the whole top-level block, or the whole document.
  - A conservative line rule still protects definition-shaped lines Markdown would read as paragraph text, and the line after a bare `[label]:`.
- **Inline.** `utils/draftEdit/markdownInlineRegions.ts` is one left-to-right pass in CommonMark precedence:
  - backslash escapes;
  - maximal backtick runs (an unmatched run is literal and never takes a later span's opener; spans stop at a paragraph break or a line that definitely starts a new block);
  - URI autolinks of any scheme, and email autolinks;
  - raw HTML read by its grammar (quoted attributes may hold `>`), comments, processing instructions, declarations, CDATA;
  - link destinations with balanced or escaped parentheses, `<…>`, or a line break before the destination or title, including inside a block quote.

  GFM bare URLs, `www.` links and email addresses are protected in their own pass.
- **Policy and performance.** Indented paragraphs stay prose. The inline lexer is skipped deliberately: on 40,000 backticks the full `marked.lexer` took 3.7 s, while block tokens plus this pass take about 40 ms. A 438 KB chapter takes 45 ms.
- **Tests:** every row of your table, plus the mismatched-backtick and quoted-attribute cases, with controls (a label stays prose; a blank line ends a destination; two list items share no span). They are covered in the scanner, and through the use case for a whole document (the payload holds none of it, `unanchored: 1`, nothing flagged) and for a selection inside the construct (`empty`, nothing sent). The 24 new assertions fail on the previous scanner.

### F-03 — same occurrence, live protection

- **Following edits.** Findings now follow their own occurrence through the edits recorded while the model worked (`shiftRanges`, the arithmetic the annotator uses for shown flags). An edit that touches a finding drops it as `stale`, and nothing is searched for again. The permissive model-quote matcher is used only to place a reply in its chunk.
- **Live protection.** Protected regions are found again on the live text, and a finding now inside one is dropped as `protected`.
- **Tests:** the use case covers your three cases and the control: the corrected duplicate (`stale: 1`, no flag), the newly fenced text (`protected: 1`), the existing-code duplicate (`stale: 1`), and the harmless prefix (moved to 19–22). The production adapters cover the corrected duplicate and the prefix.

### F-04 — one document lifetime

- **A watch, not a snapshot.** `DocumentEditor.snapshot(uri)` is now `watch(uri, version)`. The use case starts it on the open document at the gesture's version before anything is awaited. `VsCodeDocumentEditor` collects each change event, and settles `closed` on the document's close event or `isClosed`.
- **Lifetimes.** A language change (VS Code closes and reopens the same object) and a close followed by a reopen (a new object, versions restarting) are both another lifetime. Only open documents are watched, so nothing is reopened through `openTextDocument`.
- **Outcomes.** A run whose document closed returns `closed` and shows nothing ("… was closed before Proofread finished, so no flags were shown"). One whose document moved before it could start returns `changed` and sends nothing. Any future Workshop caller that needs open-by-URI behavior will get its own path.
- **Tests:** `draftEditDocumentLifetime.integration.test.ts` runs the production `VsCodeDocumentEditor`, `VsCodeIssueAnnotator` and `DraftEditUseCase` against a controlled VS Code double with a held reply. It covers the open control, a held close (no diagnostic, `openTextDocument` never called), close and reopen at version 1 with different text, and a language change.

### F-05 — wholly missing usage

- `sumTokenUsage` now keeps a call with no usage record in the completeness check: cost and cache totals need every call's record and field. `requestCount` counts every call.
- **Tests:** pure, and through the production manager, engine and `OpenRouterClient` with `fetch` stubbed.
  - `[reported, missing]` gives `{ promptTokens: 10, completionTokens: 10, totalTokens: 20, requestCount: 2 }`, with no cost or cache.
  - All-missing gives no usage, while the chunks still report both reads.

### F-06 — truthful recovery wording

- **What a chunk carries.** A rejected chunk carries `saved` (whether `persistRejectedModelResponse` returned a receipt). The outcome's `rejectedChunks` is `{ saved, unsaved }`.
- **Wording.** The summary says "saved for recovery" only for saved parts. Otherwise: "1 part unreadable and not saved for recovery (see the Prose Minion output)", or for a mix, "3 parts unreadable: 2 saved for recovery, 1 not saved (see …)". The once-per-run presenter and the per-chunk captures are unchanged.
- **Tests:** `DraftEditRecovery.test.ts` runs the production recovery store, whose file system fails writes on cue, through the service, use case and summary. It covers saved, failed and mixed. The presenter opens once when anything was saved, and never otherwise.

### Nonblocking notes

The ellipsis-expansion boundary in `anchorQuote` and the stronger no-line-break-change rule are recorded as required write-side hardening in `slice-2-write-side-and-fix.md`, to land before anything is applied.

### Verification at `ad33ecbd`

| Check | Result |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass |
| Full Jest, Node 18.20.8 | Pass; 537 suites / 7,452 tests / 59 snapshots |
| Lint, Node 18.20.8 | Pass; 0 errors / 1,133 warnings (baseline unchanged) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass |
| Full Jest, Node 22 | Pass; 537 suites / 7,452 tests / 59 snapshots |

No live provider call was made. Fixtures are public-domain *Alice* or synthetic. The Extension Development Host pass remains the writer's.
