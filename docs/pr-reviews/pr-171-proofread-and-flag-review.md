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

---

## Astra re-review — 2026-10-25

**Reviewed correction head:** `fae86e9a7cba134d7b243eb65d8c66fd95d834b5`

**Base:** `31edcfdfda7ebe2cab89a121cfdba5655dbd170a`, unchanged. Reviewed all eight commits after report commit `19ff80df`, including the appended author response: 44 files, +2,454 / −241. The original review and author response above are preserved unchanged.

### Updated disposition

**Request changes. F-03, F-04, F-05 and F-06 are closed; F-01 and F-02 remain open at P2.** The original straightforward refresh and Markdown cases now pass, but the new refresh owner admits an out-of-order key-read race, and the new inline scanner still crosses real Markdown parsing boundaries. These are narrower follow-up witnesses of the original contracts, not a rejection of the occurrence-tracking/lifetime design.

| ID | Disposition at this head | Independent evidence |
| --- | --- | --- |
| F-01 | P2, still open | Normal standalone changes and duplicate requests work; an older held fingerprint can retire a newer run and suppress a subsequent real key deletion |
| F-02 | P2, still open | Original examples pass; code across numbered-item/blockquote boundaries and multiline HTML in a blockquote still enter the locally captured payload and can be flagged |
| F-03 | Closed | Findings follow recorded edits, not a fresh quote search; corrected duplicates drop and newly fenced text is excluded |
| F-04 | Closed | Held close, close/reopen at version 1 and language-change close show nothing and never call `openTextDocument`; a stale starting version sends nothing |
| F-05 | Closed | Mixed reported/missing usage omits cost/cache totals and counts both calls; all-reported and all-missing controls pass |
| F-06 | Closed | Actual store/service/use-case paths distinguish saved, failed and mixed captures; presentation remains once per run when a receipt exists |

### F-01 remains open — Sequence the key observation before deduplicating rebuilds

**Location:** [`AIResourceRefresh.ts:53–61`](https://github.com/okeylanders/prose-minion-vscode/blob/fae86e9a7cba134d7b243eb65d8c66fd95d834b5/packages/core/src/infrastructure/api/orchestration/AIResourceRefresh.ts#L53-L61).

The new composition-root owner repairs the missing lifetime subscription. However, `refreshKey` awaits an unsequenced fingerprint read and then asks the manager to read the key again. `builtFor` is the first read's fingerprint, not necessarily the key that the rebuild adopted. An older fingerprint can arrive last and become the newest manager rebuild. The manager's existing rebuild-order guard cannot reject it because this stale operation enters the manager **after** the newer one.

Independent Node 18 witness uses the real owner, secret-storage service, manager, engines, OpenRouter client, Proofread service and real concurrency limiter. The secret store/event source is synthetic, with one asynchronously returned key snapshot held; HTTP is intercepted at `fetch`.

1. Initialize with placeholder key A.
2. Delete A. Hold the owner's event-triggered read after it captured the empty value.
3. Store key B and let that newer event rebuild the manager with B.
4. Start a fresh six-chunk Proofread run with B, holding its first three requests.
5. Release the older empty read. The owner sets `builtFor` to the empty fingerprint, while the manager's separate current read finds B. A redundant B rebuild retires the fresh run's engine.
6. Release the three replies. The run returns three `read`, three `unsent`, and `key-changed`, despite having started on the newer B key.
7. Delete B and await `refreshKey`, the same owner method the overlay's Save/Clear now awaits. The empty fingerprint matches the stale `builtFor`, so no rebuild occurs.
8. The store is empty, but the next intercepted Proofread request still uses B. The actual Lightbox and assistant engines also still report a provider attached. Those last two checks inspect manager state; they are not full Lightbox/Workshop inference witnesses.

Normal-order controls pass: the model changes on the next request; replacing a key with duplicate refresh callers builds once; ordinary deletion leaves the next Proofread unconfigured. Thus the ownership change is useful, but the asynchronous observation/deduplication boundary is not safe. `MessageHandler` and `ConfigurationHandler` now both use this owner, making the defect relevant to the shared manager rather than only the new editor command. A pending key read also still initiates a rebuild after the owner is disposed; this is an observed lifecycle boundary to cover in the same correction, not a separate blocker.

**Required correction:** establish operation ordering before the first await and make the cached identity describe the key actually adopted by the authoritative rebuild. Obsolete observations must neither retire fresh engines nor poison the next change's deduplication. Preserve single-rebuild behavior for duplicate listeners and overlay acknowledgment semantics. Add the held-old-read → newer replacement → fresh run → old completion → final deletion witness, plus disposal while a read is pending, alongside the existing ordinary-change controls.

### F-02 remains open — Use actual inline scopes and container-aware source mapping

**Locations:** [`markdownInlineRegions.ts:69–76`](https://github.com/okeylanders/prose-minion-vscode/blob/fae86e9a7cba134d7b243eb65d8c66fd95d834b5/packages/core/src/utils/draftEdit/markdownInlineRegions.ts#L69-L76), [`markdownInlineRegions.ts:231–243`](https://github.com/okeylanders/prose-minion-vscode/blob/fae86e9a7cba134d7b243eb65d8c66fd95d834b5/packages/core/src/utils/draftEdit/markdownInlineRegions.ts#L231-L243).

The block lexer repairs the original fenced/container and reference cases. The inline pass nevertheless runs across unprotected raw-source stretches using a small block-start heuristic rather than the actual parser's inline scopes. An unmatched backtick in one block can consume a genuine opener in the next. Separately, the raw HTML reader treats a blockquote's continuation marker as the tag's closing angle bracket.

The production scanner and use case reproduce the following, both for a whole-document run and a selection containing only `teh`:

| Source (`\n` denotes a newline) | Incorrect masking |
| --- | --- |
| ``1. One `unclosed\n2. `teh` end`` | The first item's unmatched tick consumes the second item's code opener; the code word remains exposed |
| ``Before ` unclosed\n> `teh` after`` | The prose tick consumes the new blockquote's code opener; the code word remains exposed |
| `> <a\n> href="teh.html">label</a>` | The tag is masked only through the continuation `>`; its `href` attribute remains exposed |

For each case, the installed Markdown parser independently renders `teh` as code or as part of the HTML attribute, not ordinary prose. Each selection run still plans one word/one chunk, sends `teh` to the local pass stub and shows a flag. Whole-document runs also contain the word in their captured payload and flag it. **No protected text was transmitted to an actual provider.**

Further pure-scanner witnesses find the same code-boundary error across nested quotes, a thematic break, a setext heading, GFM table cells/rows and standalone-CR paragraph breaks. A valid empty-destination link with a title, `[label]( "hidden title")`, is also left unmasked. The primary blocking evidence is the code and HTML-attribute cases above, not a disagreement about indented prose.

**Required correction:** derive inline parsing scopes from the real block/container structure and map them back to raw source, or use another equivalently complete bounded approach. Container prefixes must not be interpreted as HTML syntax. Merely recognizing every numbered marker would break valid lazy paragraph continuations, so extend regressions beyond the three examples. Assert both full/selection payload exclusion and no diagnostics; retain label-as-prose, ordinary multiline code and container controls.

### Confirmed closures and retained boundaries

- **F-03/F-04:** independently reran the original occurrence and close witnesses against the changed ports. The production-adapter controls additionally cover unordered simultaneous edits followed by another event, correction followed by undo, language-change close and a stale starting version. Closing/reopening never reloads the resource or republishes flags. A harmless prefix still moves the same occurrence, and shown flags still support shifted Dismiss/Clear. The live protection recheck is correct; its coverage remains limited by the separate F-02 scanner defect.
- **F-05:** through the actual client/service mapping, two known costs sum correctly, one whole missing record yields only the reported token subtotal with `requestCount: 2` and no cost/cache total, and two missing records leave usage absent while both chunks are read.
- **F-06:** actual recovery-store paths under real chunk concurrency cover two saved captures, two refused writes and one of each. Counts and summary wording agree with receipts; the presenter runs once if any capture is saved and zero times otherwise. No claim of disk durability beyond the controlled filesystem witness is made.
- **Markdown controls:** the original failure matrix now passes. A separate block/source-offset matrix covered 2,535 container/EOL variants, including 2,427 recognized protected fence/definition/script cases, with no leak. Indented code was deliberately excluded. Quoted-prefix depth 33 and list indentation 65 fail closed, while their 32/64 controls remain readable.
- The shared registry's persisted IDs and parser behavior are unchanged by this correction delta. Full-suite coverage includes Lightbox key retirement, model selection, retained readings and Workshop behavior. The new shared-owner ordering issue above is not cleared by those passing ordinary-order tests.
- The author has recorded the original ellipsis-expansion and no-line-break-change requirements in the Slice 2 plan. They remain prerequisites before any write-side clearance; this re-review still concerns diagnostics only.

### Nonblocking scanner hardening

The malformed-input work bound still needs hardening. Each unmatched `](` can rescan the remaining suffix in [`linkDestinationEnd`](https://github.com/okeylanders/prose-minion-vscode/blob/fae86e9a7cba134d7b243eb65d8c66fd95d834b5/packages/core/src/utils/draftEdit/markdownInlineRegions.ts#L310-L354). A bounded cloud Node 24 probe of `](x` repeated 2,000 / 4,000 / 8,000 times measured approximately 33 / 88 / 303 ms in the inline function alone, consistent with the quadratic loop; these are not native editor latency predictions. Avoid retrying complete suffix scans and retain a bounded adversarial-input regression. Separately, the prefix-only nesting guard misses mixed containers: `'> - '.repeat(65) + 'Prose sentinel'` produces 130 nested quote/list containers in the installed parser but is not refused by the scanner. Cover mixed nesting in the guard, rather than only contiguous quote markers or indentation. Neither observation is counted as an additional blocking finding here.

### Re-review verification

Required gates were rerun independently on the correction head under task-local Node `18.20.8` / npm `10.8.2`, serially with the same 2 GiB heap, one Jest worker, 1,000 MB idle limit and disk-backed cache. Lockfile equality and current-checkout workspace links were rechecked before dependency reuse.

| Check | Independent result |
| --- | --- |
| Full repository Jest, Node 18 | Pass; 537 suites / 7,452 tests / 59 snapshots |
| Typecheck, Node 18 | Pass; core, webview and adapter |
| Lint, Node 18 | Pass; 0 errors / 1,133 warnings |
| Production build and `verify:bundle`, Node 18 | Pass; existing webpack size warnings |
| Independent use-case/adapter regressions, Node 18 | 20 pass; 6 desired-correctness tests fail at the remaining F-02 cases; 26 total |
| Real refresh/manager/client/service witnesses, Node 18 | Remaining F-01 race reproduced; ordinary model/key/deduplication controls pass |
| Recovery/usage closure witnesses, Node 18 | All six saved/failed/mixed and usage cases pass |
| Correction-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40157691154) at `fae86e9a` |
| Correction-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40157693796) at `fae86e9a` |
| `git diff --check`; original report/author response preservation | Clean; existing report bytes preserved as an exact prefix |

No implementation edit, live/billable call, private manuscript, formal GitHub review, merge or deployment was made. Adapter tests remain controlled native-API doubles, not a real editor session. **The native Extension Development Host and screen-reader/editor interaction pass remain unexercised.** The ADR's status and author response are not substituted for writer acceptance, and green CI does not close F-01/F-02.

---

## Author response to the re-review — 2026-10-25

**Correction head:** `3441e185` (base `31edcfdf`, unchanged). F-01 and F-02 are fixed in `acc58a05` and `749b3393`; docs are in `3441e185`. Both of your nonblocking scanner notes are fixed too. The ADR amendment's F-01 and F-02 rows record the changes.

### F-01: observations are ordered, and the identity compared is the identity built

- **Ordering.** `refreshKey()` numbers each request when it is made, before anything is awaited. Only the newest request's reading of the key counts. An older request whose read answers later joins the newest and builds nothing, so it can neither retire a run started on a newer key nor leave a stale identity behind.
- **Identity.** The newest request compares its reading with `AIResourceManager.adoptedKeyFingerprint()`, the key the current resources were actually built with. A failed build or a dispose clears it. When they differ, it calls `refreshConfiguration({ apiKey })`, and the manager builds with exactly that key instead of reading again. The owner never keeps its own copy of the identity, and the manager keeps only a SHA-256 fingerprint.
- **Disposal.** A request still reading when the owner is disposed builds nothing.
- **Unchanged.** Duplicate listeners still produce one rebuild. The overlay's Save and Clear still await the rebuild before answering, and `LightboxKeyRetirement` passes unchanged. The manager's unordered `refreshConfiguration()` still rebuilds unconditionally for any other caller.
- **Tests:**
  - `ProofreadColdRefresh.test.ts` runs your sequence through the production secret storage service, manager, engines, `OpenRouterClient`, real limiter and `ProofreadService`:
    1. Hold the deletion's read after it saw no key.
    2. Store B, which rebuilds.
    3. Start a fresh six-chunk run with three requests held.
    4. Release the old read: no rebuild.
    5. Release the replies: six `read`, no interruption, every request on B.
    6. Delete B and await `refreshKey()`: unconfigured, with the assistant engine's provider detached.
  - It also covers disposal while a read is pending (no rebuild).
  - Both cases fail on the previous owner.
  - `AIResourceRefresh.test.ts` pins the ordering rules on a stand-in manager.

### F-02: inline constructs are read in the parser's own scopes

- **Scopes.** `readMarkdownBlocks` now yields inline scopes alongside the protected blocks, taken from marked's block tokens:
  - each paragraph, heading, tight list item's text, HTML block, and indented code block (still prose);
  - each table cell, split on unescaped pipes as GFM splits rows.

  A scope's text is its container content: prefixes stripped, lines one for one with the source. It maps back column by column, setting aside the spaces a tab became. A line that does not end its computed source line fails closed and protects the top-level block.
- **The inline pass.** `markdownInlineRegions` reads each scope alone, so nothing pairs across blocks and no container prefix reaches the tag reader. Its only break inside a scope is a blank line, which matters only for indented code. The old block-start heuristic is gone, so lazy continuations such as ``Prose `a\n1999. teh` more`` stay one paragraph, as the parser reads them.
- **Tests:**
  - **Scanner:** your three cases, nested quotes, a thematic break, a setext heading, table cells and rows, a lone carriage return, and `[label]( "hidden title")`.
  - **Use case:** the three code and tag cases, for a whole document (`teh` absent from the payload, `unanchored: 1`, nothing flagged) and for a selection of `teh` alone (`empty`, nothing sent).
  - **Controls:** a label stays prose, a multiline code span is protected, and a lazy paragraph continuation stays one span. Prose in a quote, nested list items, a tab-indented item, a quoted list item and a two-item numbered list are left whole.
  - Sixteen of these assertions fail on the previous scanner.

### Nonblocking notes, fixed

- **Unmatched `](`.** A destination's parentheses nest at most 32 deep (`MAX_LINK_PAREN_DEPTH`, far deeper than any link a manuscript holds). An unmatched `](` therefore reads a bounded stretch and never rescans the rest of a scope. `'](x'` repeated 40,000 times now takes about 24 ms in the whole scanner, and 20,000 repetitions sit under a test bound.
- **Mixed nesting.** The depth guard counts quote and list markers in any mix. `'> - '.repeat(65) + 'Prose sentinel'` is protected whole, while eight levels are read.
- **Also found and fixed:** the list walker recounted every earlier item's lines for each item. 20,000 tight items now take about 0.2 s instead of 2.6 s, under a test bound.

### Verification at `3441e185`

| Check | Result |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass |
| Full Jest, Node 18.20.8 | Pass; 537 suites / 7,475 tests / 59 snapshots |
| Lint, Node 18.20.8 | Pass; 0 errors / 1,133 warnings (baseline unchanged) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass |
| Full Jest, Node 22 | Pass; 537 suites / 7,475 tests / 59 snapshots |

No live provider call was made. Fixtures are public-domain *Alice* or synthetic. The Extension Development Host pass remains the writer's.

---

## Astra second re-review — 2026-10-25

**Reviewed head:** `f1ba770f8445407cb9fe0a891a6764fb7471444d`. **Base:** `31edcfdfda7ebe2cab89a121cfdba5655dbd170a`, unchanged.

Reviewed all five commits after the prior report commit `ef9e4599`: 17 files, +615 / −201, including `acc58a05`, `749b3393`, the documentation changes and the full appended author response. The latest `f1ba770f` change is response-only. All preceding review and response text is preserved unchanged.

### Updated disposition

**Request changes: F-02 remains P2. F-01 is now closed; F-03 through F-06 remain closed.** The retained key-ordering witness and all six previous inline-scope assertions pass. Two narrower protected-text cases remain: an omitted final table cell and fail-open behavior at the new destination-depth limit. There is also a nonblocking P3 malformed-legacy-key normalization note below.

### F-01 closed — Ordered observations preserve the newer run and honor deletion

The retained witness now passes through the real refresh owner, secret-storage service, manager, engines, OpenRouter client, Proofread service and real concurrency limiter, with synthetic storage and an intercepted HTTP boundary:

- Hold the deletion's empty-key observation, adopt B, and start six fresh chunks on B with three replies held.
- Release the obsolete observation: generation stays at 2, the fresh engine remains attached, and all six chunks finish `read` on B with no interruption.
- Delete B and await the owner: generation advances to 3, the next Proofread is `unconfigured`, and both Lightbox and assistant provider states are detached. The shared-scope checks inspect actual manager state, not complete Lightbox/Workshop inference runs.

Additional independent controls pass: normal model/key changes, one rebuild for duplicate callers, three out-of-order observations joining the newest without hanging, an older initial manager read overlapping a newer observed-key build and model changes, retrying the same key after a failed build, and disposal while a read is pending. The disposed owner also performs no subsequent key read. The cache identity now belongs to the manager and the authoritative build receives the observed key; the prior stale-read retirement/deletion defect is closed.

### F-02 remains open — Flush the last table cell and fail closed at the depth bound

**A. A terminal backslash drops the entire final GFM cell's inline scope.**

**Location:** [`markdownBlockRegions.ts:280–293`](https://github.com/okeylanders/prose-minion-vscode/blob/f1ba770f8445407cb9fe0a891a6764fb7471444d/packages/core/src/utils/draftEdit/markdownBlockRegions.ts#L280-L293).

A valid table with no trailing pipe:

```text
Column | Other
--- | ---
plain | `teh` \
```

At the last backslash, the escape branch increments the index, then the loop increments it again. That skips `index === row.length`, the only final-cell flush. The whole final cell has no scope, including the code span before the backslash. The installed Markdown parser renders that span as code, but the protection scan returns no region for it. A final newline does not cure the omission; two terminal backslashes are a passing control.

The production use case independently reproduces both paths: a full-file run includes the code word in its locally captured payload and shows a flag at offsets 34–37; a selection of `teh` plans one word/one chunk, sends it to the local pass stub and shows the same flag.

**Required correction:** always flush the final cell independently of escape-loop termination. Add odd/even terminal-backslash controls, with and without a final newline/trailing pipe, and full-file/selection assertions that code, targets and tag attributes in that cell are excluded and never flagged.

**B. Exceeding the deliberate destination bound is treated as ordinary prose.**

**Location:** [`markdownInlineRegions.ts:307–330`](https://github.com/okeylanders/prose-minion-vscode/blob/f1ba770f8445407cb9fe0a891a6764fb7471444d/packages/core/src/utils/draftEdit/markdownInlineRegions.ts#L307-L330), propagated through [`linkDestinationEnd`](https://github.com/okeylanders/prose-minion-vscode/blob/f1ba770f8445407cb9fe0a891a6764fb7471444d/packages/core/src/utils/draftEdit/markdownInlineRegions.ts#L283-L293).

Build the synthetic source as `'[chapter](' + '('.repeat(33) + 'teh' + ')'.repeat(33) + ')'`. On the 33rd nested parenthesis, `linkDestination` returns `undefined`; the caller interprets this as no destination and proceeds through the target as prose. The installed parser recognizes these as links at depths 33 and 64. The depth-32 control is protected.

At depth 33, both production-use-case paths expose the target: the full-file payload contains it, and the selection plans one word/one chunk and sends `teh`; both show a flag at offsets 43–46. This is a failure to exclude at the limit, **not a request for unbounded parsing or a higher limit**.

**Required correction:** retain a bounded approach, but distinguish “not a construct” from “cannot safely classify within the bound.” Conservatively exclude the uncertain target/scope on overflow rather than treating it as prose. Pin limit−1/limit/limit+1 cases with both payload and diagnostic assertions.

**Evidence boundary:** these four desired-correctness tests fail for the stated application behavior, not harness errors. All payloads and findings are synthetic and local; no protected text was transmitted to an actual provider.

### Confirmed protections and retained closures

- All 26 previously retained use-case/adapter tests now pass, including the prior six F-02 failures. The new suite totals **31 pass / 4 fail** after adding the two new witnesses, depth-32 controls and Unicode/EOL label-offset controls.
- The previous block matrix again passes: 2,535 container/EOL variants, including 2,427 recognized protected fence/definition/script cases, with no leak. A new 168-case Unicode, surrogate-pair, container, scope and LF/CRLF/CR mapping matrix has no mapping failure or protected-word leak. Ordinary labels remain readable, including tab-indented containers. Indented code remains deliberately treated as prose.
- F-03/F-04 occurrence tracking, shifted flags, Dismiss/Clear, corrected duplicates, newly fenced text, close/reopen, language-change close and stale starting versions remain passing in controlled adapter/use-case probes. These are not native editor interactions.
- F-05/F-06 usage and saved/failed/mixed recovery witnesses were independently rerun under Node 18 and all pass, including once-per-run presentation only when a receipt exists.
- The original unmatched-destination rescan witness is resolved: bounded Node 24 executions at 2,000 / 4,000 / 8,000 markers took approximately 14 / 14 / 13 ms in the inline function, without hitting their three-second worker limits. These are scoped cloud timings, not native-editor predictions. The repository's long-list regression also passes.
- The original mixed-marker example now protects the document whole. One nonblocking budget gap remains: incrementally nested lists inside a blockquote (`'> ' + '  '.repeat(level) + '- prose'`, one line per level) bypass the raw-line indentation check. Bounded 33/40-level cases parsed at depths 34/41 without refusal. No resulting latency failure or protected-content leak was established, so this is guard hardening, not another blocker.

### Nonblocking P3 — Fingerprint and transport should use the same key representation

**Location:** [`apiKeyFingerprint.ts:9–10`](https://github.com/okeylanders/prose-minion-vscode/blob/f1ba770f8445407cb9fe0a891a6764fb7471444d/packages/core/src/infrastructure/api/orchestration/apiKeyFingerprint.ts#L9-L10), compared with [`OpenRouterClient.ts:130–131`](https://github.com/okeylanders/prose-minion-vscode/blob/f1ba770f8445407cb9fe0a891a6764fb7471444d/packages/core/src/infrastructure/api/providers/OpenRouterClient.ts#L130-L131).

The fingerprint trims the key, but the client adopts and sends its raw representation. In a narrow synthetic legacy-key case with a leading newline, an initial raw-key build is followed by the migration's normalization operations: store the trimmed value and clear the legacy setting. The fingerprint is unchanged, so neither that change nor a repeated normalized Save rebuilds. Local WHATWG `Headers` validation rejects the stale raw Authorization value, and Proofread remains `unsent` with a provider interruption. An explicit build with the same clean stored key succeeds in the intercepted transport control.

Normalize consistently before both comparison and transport adoption, or fingerprint the exact adopted transport representation. This is a malformed-legacy-key recovery edge, not evidence that ordinary surrounding spaces fail authentication, not an actual provider rejection, and not a native activation/migration run. It does not reopen the now-fixed F-01 ordering defect.

### Second re-review verification

All required gates were independently rerun at this head with task-local Node `18.20.8` / npm `10.8.2`, the 2 GiB heap, one Jest worker, 1,000 MB idle limit and disk-backed cache. Lockfile equality and workspace links into this checkout were rechecked before dependency reuse. Heavy gates and independent probes were serialized.

| Check | Independent result |
| --- | --- |
| Full repository Jest, Node 18 | Pass; 537 suites / 7,475 tests / 59 snapshots |
| Typecheck, Node 18 | Pass; core, webview and adapter |
| Lint, Node 18 | Pass; 0 errors / 1,133 warnings |
| Production build and `verify:bundle`, Node 18 | Pass; existing three webpack size warnings |
| Independent use-case/adapter regressions, Node 18 | 31 pass / 4 fail; failures are the remaining F-02 full/selection witnesses |
| Refresh/manager/client/service controls, Node 18 | All six groups pass; original F-01 race closed |
| Recovery/usage controls, Node 18 | All saved/failed/mixed and usage controls pass |
| Correction-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40160592342) at `f1ba770f` |
| Correction-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40160596774) at `f1ba770f` |
| Report-only diff and previous text preservation | `git diff --check` clean; preceding report and all author responses preserved as an exact byte prefix |

No implementation edit, live/billable call, private manuscript, formal GitHub review, merge or deployment was made. **The native Extension Development Host and screen-reader/editor interaction pass remain unexercised.** The ADR/author response does not establish independent writer acceptance, and passing CI does not close the remaining F-02 protection defect.

---

## Author response to the second re-review — 2026-10-25

**Correction head:** `3aa8b175` (base `31edcfdf`, unchanged). The fixes are in `96418bfe`; the verification record and test inventory are in `3aa8b175`. Both open F-02 cases are fixed, along with your nonblocking guard note and the P3 key normalization. The ADR amendment's F-01 and F-02 rows, the slice document and the memory bank record the changes.

### F-02 A: a row's last cell is taken however the row ends

- **Fix.** `tableCellStretches` no longer flushes the final cell from inside the loop. The loop only splits on unescaped pipes; the last cell is then taken once, after the loop, whatever the escape branch did to the index. A row ending in an odd number of backslashes keeps its last cell's scope, code span and all.
- **Scanner tests** (`protectedRegions.test.ts`), each asserting the exact masked text:
  - a code span before one terminal backslash, with no trailing pipe and with a final newline;
  - a code span before an escaped trailing pipe (`\|`);
  - a code span before two terminal backslashes (your passing control);
  - a link target and a tag attribute before one terminal backslash.
- **Use-case tests** (`DraftEditUseCase.test.ts`): code before one terminal backslash, with and without a final newline; code before an escaped trailing pipe; and a link target and a tag attribute before one terminal backslash. Each runs both ways:
  - whole document: `teh` is absent from the payload, `unanchored: 1`, nothing flagged;
  - selection of `teh` alone: `empty`, nothing sent, nothing shown.
- **Against the previous scanner,** eight of these use-case assertions fail: the four odd-backslash entries on both paths. The escaped-pipe entry passes there too; it is a control.

### F-02 B: what cannot be classified within the bound is not prose

- **Fix.** `linkDestination` now tells two answers apart: `undefined` ("not a destination") and `TOO_DEEP` ("nested past `MAX_LINK_PAREN_DEPTH`; not classified"). On `TOO_DEEP`, `linkDestinationEnd` protects everything from the destination's opening parenthesis to the end of the scope. The bound stays at 32 and the work stays bounded.
- **The cost.** Prose after the overflow in the same leaf block or table cell is not proofread. Other blocks are unaffected. A link nested 33 parentheses deep is not manuscript prose, so the trade is the right one.
- **Pinned at 31, 32 and 33** (limit−1, limit, limit+1):
  - **Scanner:** the masked text never contains `teh` and opens with the protected destination after `[chapter]`.
  - **Use case:** your synthetic source at each depth, whole document and selection, with the same payload, flag and outcome assertions as above.
  - Depth 33 fails on both paths against the previous scanner; 31 and 32 are controls.
- **The rescan witness changed meaning.** `'](x'` repeated 20,000 times now nests past the bound at its 33rd `(`, so everything after the first `]` is protected. The test now says so and still holds the scan under its time bound.

### Nonblocking: list indentation inside block quotes

`nestsTooDeeply` now strips a line's leading quote markers before it reads list indentation, so a list nested line by line inside a block quote is held to the same 64-column bound as one outside. The space after `>` counts as indentation, so the quoted case is one column stricter, erring toward protection. Measured with your shape (`'> ' + '  '.repeat(level) + '- prose'`, one line per level):

- inside a quote, 33, 34 and 40 levels are protected whole, and eight levels are read;
- outside a quote, 33 levels are read and 34 are protected whole.

The test pins 40 and 8 inside a quote.

### P3: the key sent is the key fingerprinted

`AIResourceManager.rebuildResources` trims the key it adopts, observed or read from secret storage or the legacy setting, before it fingerprints it and before it builds any client. Both `OpenRouterClient` construction sites take that trimmed key, so the Authorization value and `adoptedKeyFingerprint` always describe one string, and a whitespace-only key is no key. In your legacy-key sequence, the first build already sends the trimmed key. The migration's trimmed store then changes nothing, correctly.

- **Test** (`AIResourceManager.test.ts`):
  1. Built from `'\nsk-placeholder '`: the Proofread engine's client holds `sk-placeholder`, and the fingerprint is `sk-placeholder`'s.
  2. Rebuilt with `' sk-placeholder\n'`: still `sk-placeholder`.
  3. Rebuilt with `'  '`: unconfigured.
- **Not covered:** this is a manager-level test, not a rerun of your migration and `Headers` sequence.

### Verification at `3aa8b175`

| Check | Result |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass; core, webview and adapter |
| Full Jest, Node 18.20.8 | Pass; 537 suites / 7,501 tests / 59 snapshots |
| Lint, Node 18.20.8 | Pass; 0 errors / 1,133 warnings (baseline unchanged) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass |
| Full Jest, Node 22 | Pass; 537 suites / 7,501 tests / 59 snapshots |

No live provider call was made. Fixtures are public-domain *Alice* or synthetic. The Extension Development Host pass remains the writer's.

---

## Astra third re-review — 2026-10-25

**Reviewed head:** `0ebf3c80b67f2415c4b5f4f4fc6697f83a0ca977`. **Base:** `31edcfdfda7ebe2cab89a121cfdba5655dbd170a`, unchanged.

Reviewed all three commits after report commit `8be89444`: implementation `96418bfe`, documentation `3aa8b175` and author response `0ebf3c80`; 11 files, +179 / −23. Every preceding report and author response is preserved unchanged.

### Final disposition

**F-02 is closed. F-01 and F-03 through F-06 remain closed. The P3 key-normalization note and the quoted-list guard note are also closed. No new blocking finding was established on this head.** This supersedes the earlier request-changes dispositions. It is an independent code-review conclusion, not a formal GitHub approval, permission to merge, or clearance for future document writes.

### F-02 closure and bounded behavior

- **Final table cell:** the unconditional post-loop flush now preserves the last cell regardless of escape-loop termination. Both retained full-document/selection witnesses pass: the code word is absent from the locally captured payload, produces no diagnostic, and a selection of it is empty with no pass call. An independent 180-case matrix covers one through five trailing backslashes, newline/pipe endings, code/link/tag contents and LF/CRLF/CR, retaining ordinary labels with no exclusion failure.
- **Destination overflow:** a distinct overflow result now protects from the destination's opening parenthesis to the end of its inline scope. Both retained depth-33 full-document/selection witnesses pass; depth 32 remains protected and permits following prose. The bound stays at 32.
- **The conservative tradeoff is explicit:** prose after an overflow in the **same** leaf block/table cell is intentionally not proofread. The correction does not mask subsequent independent scopes. The 126-case depth/scope matrix passes at depths 0/1/31/32/33/64 across paragraphs, quoted paragraphs, list items, table cells/rows and headings with all three line-ending forms. Visible labels remain prose. Nine additional production-use-case controls verify preceding/label prose, following paragraphs/cells, same-scope exclusion, code precedence, angle-bracketed destinations and escaped parentheses, including exact diagnostic offsets.
- **Retained protections:** the original 2,535-case block/container/EOL matrix passes again, including 2,427 recognized protected constructs. The 168-case Unicode/surrogate-pair/container/inline-scope mapping matrix has no mapping failure or protected-word leak. All earlier concrete F-02 witnesses remain fixed. Indented code remains deliberately treated as prose.
- **Depth guard:** quoted-list 33/34/40-level witnesses now protect the document whole; 8/32 remain readable. Unquoted 33 remains readable and 34/40 protect whole, consistent with the documented indentation limit and conservative extra quote-space count.
- **Bounded work:** the retained unmatched-destination workers finish inside their three-second limits and now produce one conservative protected region. The repository's long-list regression passes. These are scoped cloud checks, not native editor latency predictions.

### Other findings remain closed

- **F-01:** all six independent ordering/lifecycle groups pass again through the real owner, manager, engines, client and Proofread service with synthetic storage and intercepted transport. The obsolete empty read neither retires the fresh six-chunk B run nor hides final deletion. Duplicate callers rebuild once; obsolete promises settle with the newest; initialization/model overlap, failed-build retry and pending-read disposal remain correct. Shared Lightbox/assistant checks are actual manager provider-state checks, not complete native inference runs.
- **P3 normalization:** the retained newline-padded legacy-key witness now starts with a clean transport key. Initial use, simulated migration, repeated Save, explicitly observed padded key, padded-secret deduplication and direct secret-read rebuild all complete `read`; all six captured Authorization values are clean and local `Headers` validation reports zero errors. A whitespace-only observation leaves Proofread unconfigured and shared providers detached. This exercises the actual manager/client/service paths with synthetic migration operations, not native activation or a live provider.
- **F-03/F-04:** unchanged-occurrence tracking, shifted flags/Dismiss/Clear, corrected duplicates, newly fenced text, stale starting versions, close/reopen and language-change close all remain passing in the retained controlled use-case/adapter probes.
- **F-05/F-06:** the independent known/missing-usage and saved/failed/mixed recovery witnesses pass again, including truthful summary wording and once-per-run presentation only when an actual receipt exists.

### Fresh independent verification

Dependency reuse was rechecked against the unchanged lockfile and workspace links into this checkout. Required gates ran serially under task-local **Node 18.20.8 / npm 10.8.2**, with a 2 GiB heap, one Jest worker, a 1,000 MB idle limit and a disk-backed cache. Independent probes ran afterward, without heavy-job overlap.

| Check | Independent result |
| --- | --- |
| Full repository Jest, Node 18 | Pass: **537 suites / 7,501 tests / 59 snapshots** |
| Typecheck, Node 18 | Pass: core, webview and adapter |
| Lint, Node 18 | Pass: 0 errors / 1,133 warnings |
| Production build and `verify:bundle`, Node 18 | Pass; existing three webpack size warnings |
| Independent use-case/adapter Jest, Node 18 | **44/44 pass**, including all formerly failing witnesses |
| Refresh and normalization probes, Node 18 | All retained and extended controls pass |
| Usage/recovery probes, Node 18 | All controls pass |
| Pure scanner probes, Node 24 | Retained matrices, 126 scope-retention controls and 180 final-cell controls pass |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40162991036) at `0ebf3c80` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40162993569) at `0ebf3c80` |
| Report-only diff / preservation | `git diff --check` clean; all existing report bytes preserved as an exact prefix |

**Remaining evidence limits:** the native Extension Development Host, editor/screen-reader interaction and live model-quality/false-positive pass remain unexercised. Controlled adapter tests do not replace native menu, Problems/F8, progress cancellation, long-file confirmation or diagnostic interaction acceptance. The ADR's status and the author's writer-decision claims are not independently accepted on the writer's behalf. This is Slice 1 diagnostics-only clearance; the previously documented write-side anchoring/line-break requirements remain prerequisites for later slices.

No implementation edit, paid/live provider call, private manuscript, formal GitHub review/comment, merge or deployment was used. Only this append-only report is published; remote bytes, sole parent, single report path and both exact-head CI events are verified separately. Later implementation changes require their own delta check.
