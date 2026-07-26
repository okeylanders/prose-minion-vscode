# MR Review — feat(workshop): persona-chosen analysis inputs (Sprint 13B)

**Author:** okeylanders · PR #88 · Base: `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | Persona local-input run hijacks and destroys the writer's tool sidecar | Blake | — | **Addressed** — isolated runs are transcript evidence only; they never adopt a sidecar |
| 2 | 🟠 High | Per-turn analysis budget spent before semantic validation; rejection invites a foreclosed retry | Blake, Sam | 🎯 | **Addressed** |
| 3 | 🟠 High | `prepend` ceiling collides with the pinned-excerpt trim cap — a max-size room can never prepend | Sam | 🎯🎯 Strong (word-limit gate) | **Addressed** |
| 4 | 🟠 High | Word-count-only ceiling is bypassable by whitespace-free payloads | Patricia | 🎯🎯 Strong (word-limit gate) | **Addressed** — independent character ceilings added |
| 5 | 🟠 High | Oversized-resolved-input rejection has zero test coverage at either layer | Cal | 🎯🎯 Strong (word-limit gate) | **Addressed** |
| 6 | 🟠 High | `chosenBy` attributes writer-pinned material to the persona in `inherit` mode | Bria | — | **Addressed** |
| 7 | 🟠 High | Prefill can credit a guest persona's suggestion to the host by name | Bria | — | **Addressed** |
| 8 | 🟠 High | The one structured log line for `analysis.run` emits `resourceMetrics=none` | Oliver | — | **Addressed** |
| 9 | 🟡 Standard | Provenance `material` embeds a word count the UI then prints again | Marcus, Parker | 🎯 | **Addressed** |
| 10 | 🟡 Standard | Analysis input resolution not extracted the way its `resource.*` sibling was | Marcus, Stan | 🎯 | **Addressed** — extracted to `WorkshopAnalysisInputs` |
| 11 | 🟡 Standard | `inherit` against absent material silently runs the tool on an empty passage | Blake | — | **Addressed** |
| 12 | 🟡 Standard | 16-pairing test content-verifies only the diagonal; off-diagonal proven "didn't reject" only | Cal | — | **Addressed** |
| 13 | 🟡 Standard | `prepend`-against-absent-material proven for the excerpt slot only, never context | Cal | — | **Addressed** |
| 14 | 🟡 Standard | Three parallel ternary cascades on the same mode discriminant | Parker | — | **Addressed** |
| 15 | 🟡 Standard | Bespoke `T \| { error }` union beside the codec's established `kind` discriminant | Parker | — | **Addressed** |
| 16 | 🟡 Standard | Inherited-input description logic duplicated across the direct and persona paths | Marcus | — | **Addressed** |
| 17 | 🟡 Standard | New frame builder placed in `@/utils` by resemblance, not by the layering rule it cites | Stan | — | **Addressed** |
| 18 | 🟡 Standard | Shared rejection log omits which capability and which field failed | Oliver | — | **Addressed** |
| 19 | 🟢 Praise | Prompt-cache invariant verified structurally, not just claimed | Tim | — | **N/A** |
| 20 | 🟢 Nit | Excerpt word-counted twice per persona turn | Tim | — | **Deferred** — ~ms against an LLM round trip; revisit if the excerpt budget is bumped |
| 21 | 🟢 Nit | Reserved-tag regex and prefill array copy both checked clean | Tim | — | **N/A** |

### Follow-up raised by the fix review

Found while verifying the fixes above, not by the original panel. Handed to the
dev agent; validation was green when these were filed (typecheck, lint 0 errors,
128 suites / 1373 tests).

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 22 | 🟡 Standard | `context: inherit` now rejects in any room with zero context attachments — the guard at `WorkshopAnalysisInputs.ts:163-173` covers `inherit`, and `buildWorkshopContextAttachmentsFrame([])` returns `undefined` with `words: 0`. In a passage room with a pinned excerpt and no attachments, the natural `excerpt=inherit, context=inherit` call is refused, while the writer's own rail run in that same room succeeds. The prompt states "The underlying material must exist" for `prepend` only, so a compliant persona cannot know. Recoverable (budget uncharged, visible reason, retry with `omit` works) — costs a correction round-trip, not the turn. **Suggested:** keep the rejection for excerpt, where absence is a real mistake; degrade `context: inherit` with no attachments to `omit` and record `mode: 'omit'` in the provenance. Alternatively, add the existence caveat to `inherit` in the prompt. | **Open** |
| 23 | 🟢 Nit | The character ceiling is measured on raw `supplied` before neutralization, which can expand matched reserved tags by roughly a third. Fine as a backstop against whitespace-free payloads rather than a tight buffer — noted for the measurement point only. | **Deferred** |
| 24 | 🟢 Nit | `prepend` builds `` `${safeSupplied}\n\n${inherited.text}` `` without verifying `safeSupplied` exists. The codec guarantees it today, but `resolveWorkshopPersonaAnalysisInputs` is now exported and standalone, so a future caller would get a literal `"undefined"` in the prompt. | **Open** |

### Implementation resolution

The sidecar blocker was resolved by keeping persona-requested analyses isolated
all the way through lifecycle handling. Their reports remain visible,
attributed transcript artifacts, but no retained conversation is created or
adopted and no “Talking to” chip is added. A same-tool writer sidecar therefore
keeps both its label and its conversation.

Input resolution now lives in `WorkshopAnalysisInputs`, validates before the
per-turn run allowance is charged, uses a single closed-mode switch, shares
inherited provenance descriptions with direct runs, and enforces both word and
character ceilings on persona-supplied text. Focused regression coverage
includes all 16 mode pairings, absent inherited inputs in both slots,
max-sized inherited inputs plus a prefix, parser and capability oversize
boundaries, sidecar preservation, guest-tail prefill attribution, and
structured rejection metrics.

---

## Blast Radius

- 29 files changed · +1205 / −248 lines
- New files: 3 (`analysis-capability.md` system prompt, `workshopToolAskPrefill.ts`, its test) · Migrations: n/a · New services/handlers: none
- Diff is ~2,460 lines including tests — above the 800-line threshold; reviewers worked from the full diff plus source files read at HEAD
- Touches the persona capability contract, the XML codec, session-state persistence shape, and the webview transcript

---

## Report Card

| Category | Grade |
| --- | --- |
| 🔥 Correctness | F |
| 🏛️ Architecture | B− |
| 🛡️ Security | C |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | A |
| 🎯 Domain | C |

---

## Executive Briefing

🔴 **[Blake]** Persona `replace`/`omit` run hijacks the writer's tool sidecar — the writer's own conversation for that tool is adopted over and discarded unrecoverably, and the source manifest then claims material the run never received. Falsifies the sprint's headline "the room is never mutated" invariant.

🟠 **[Sam + Patricia + Cal]** The word-limit gate is too strict, too loose, and untested at once — `prepend` rejects any addition to a max-size room, a whitespace-free blob counts as one word and sails through into a billed call, and the oversized-input rule named in the sprint's exit criteria has no test at either layer.

🟠 **[Blake + Sam]** The turn's single analysis allowance is spent before session-state validation, so a rejected request burns it — and the rejection text says "Use replace or omit instead," inviting a retry the budget gate will refuse.

🟠 **[Bria]** Two provenance honesty gaps in a feature built for provenance honesty: `chosenBy` credits the persona for writer-pinned material in `inherit` mode, and the composer prefill can credit a guest persona's suggestion to the host by name.

🟠 **[Oliver]** The only structured log line for an analysis run emits `resourceMetrics=none` and never carries the rejection reason — a run that resolved to near-empty text is indistinguishable in the log from a correct one.

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🔴 Blocking — A persona-chosen local-input run hijacks the writer's tool sidecar and destroys the prior conversation

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:507`

Trace a passage room where the writer already ran Continuity from the rail — `completeToolReport` → `adoptToolSidecar('continuity', 'writer-conv', …)` left a retained sidecar the writer can talk to directly.

Now the host emits `analysis.run` with `toolId=continuity, excerptMode=replace, excerptText="<invented paragraph>", contextMode=omit`. Validation passes — this is the feature. `runWithInputs` returns `persona-conv`, and `recordCompletedTurn` → `adoptPersonaReport` → `recordCapabilityArtifact` → `adoptToolSidecar` (`WorkshopSessionService.ts:2083`). That method is unconditional:

1. `participants.toolSidecars.continuity` now points at a conversation seeded with persona-invented prose the writer never saw.
2. It returns the replaced `'writer-conv'`, and `WorkshopAnalysisSidePass.adoptPersonaReport:253` calls `discardConversation('writer-conv')`. The writer's real thread is gone. Not recoverable.
3. `toolWriterSources.continuity = [pinEntry(), ...contextAttachments]` (`WorkshopSessionService.ts:2101`), whose own comment reads *"its writer-origin rows are exactly the pin + standing attachments its run received."* With `replace`/`omit` it received **neither**. That feeds `activeContextBudget()` and ships to the webview manifest, so the writer is shown "pinned excerpt v1 + 3 attachments" for a conversation holding none of them.

**Verified independently:** `adoptToolSidecar` and its call site are untouched by this PR — `grep` across the diff returns nothing. That code was correct when every persona analysis run inherited the pin and attachments. The new modes made a previously-true assumption false at a distance.

**Coverage:** the 16-pairing test asserts only `getExcerpt()` / `getContextAttachments()` and mocks `adoptPersonaReport`, so the sidecar path never executes. No test exercises adoption after a `replace`/`omit`/`prepend` run.

**Fix:** don't adopt (and don't discard the replacement) when the run didn't receive the inherited excerpt — or pass `conversationId: undefined` for non-inherit excerpt modes so the sidecar is discarded rather than promoted. Either way `toolWriterSources` must reflect what the run actually got.

### 🟠 High — The single per-turn analysis budget is burned before semantic validation [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:438`

`dispatch` increments `this.analysisCalls += 1` and only then calls `runAnalysis`, which is where `resolveAnalysisInputs` performs every semantic check.

Open room, host sends `excerptMode=prepend`. `analysisCalls` → 1. Rejection: *"Cannot prepend excerpt text because this room has no inherited excerpt material. **Use replace or omit instead.**"* That evidence goes back to the model. The host complies and emits `excerptMode=replace` — and now hits `analysisCalls >= 1`: *"Only one analysis side pass is allowed per user turn."* The writer's turn ends with no analysis at all, having been told twice one was coming.

Parser-level rejections behave correctly (they never reach `dispatch`), so the asymmetry is invisible in testing — the existing budget test covers success-then-second-call, never rejection-then-retry.

**Fix:** increment after `resolveAnalysisInputs` succeeds, or route resolution failure through `invalidRequest` so it consumes a correction turn rather than the run budget.

### 🟡 Standard — `inherit` against absent material silently runs the tool on an empty passage

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:752`

`prepend` against absent material rejects visibly. `inherit` against absent material does not. In an open room `inheritedText` is `undefined`, `totalWords` is 0, the limit gate passes, and `resolveAnalysisInputs` returns `excerptText: excerpt.text ?? ''`. `analyzeWritingTools('', context, …)` then issues a real, billed request with an empty passage — burning the turn's single run to produce a report about nothing.

`inherit`/`inherit` is the cheapest default for a model that hasn't carefully read the scope frame, and it's the exact call the removed open-room guard used to refuse. `omit`/`omit` being legal is not the same thing: that's a deliberate vacuum run the persona chose. Either reject it with the reason `prepend` gets, or normalize it to `omit` in the provenance so the record doesn't read "inherit."

> *"You removed the guard and kept the door — the sidecar it walks off with belonged to the writer."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — `prepend`'s word limit measures a total the system prompt says it doesn't [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:664,739-744`

`totalWords = suppliedWords + input.inheritedWords`, checked against `wordLimit = PROMPT_BUDGETS.personaExcerpt.words = 10_000`. But `personaExcerpt.words` is the *same number* as `fileExcerpt.words = 10_000` — the cap a pinned excerpt is actively **trimmed to** in `WorkshopHandler.ts:2308`. So any room whose excerpt sits at that legitimate maximum makes `prepend` reject *any* non-empty supplied text, down to a single word: `10,000 + 1 > 10,000`.

Compare what the persona is told, in `analysis-capability.md:23`: *"Persona-supplied excerpt text may contain at most 10,000 words… `prepend` is the only way to add run-specific framing or instructions above existing material."* That scopes the ceiling to the persona's own text and says nothing about inherited material sharing the budget. A persona following the documented contract gets *"The resolved excerpt input is 10,001 words, above the 10,000-word limit"* — which from its side of the contract reads as a host malfunction.

Same mechanics for context via `contextAttachments.words = 35_000`, a ceiling the "Sprint 12 interim bump" comment confirms is real and intentionally supported.

### 🟡 Standard — The one-analysis-per-turn budget is spent before session-state validation [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:434-439`

Same seam Blake traced, reached independently. Sam's addition: the codec *can't* catch these earlier — it has no visibility into `this.turn.excerpt` or the attachments, so shape validation correctly happens pre-dispatch and correctly doesn't burn budget, while state-dependent validation necessarily lands downstream of the meter.

Downgraded from High under Rule B: increment-before-failure is shared with `dictionary.full-entry` in the same `dispatch` and is evidently house pattern, not a novel defect. But this PR is what gives `analysis.run` its first easy-to-trigger, session-state-only failure mode — the pattern now bites in a way it effectively couldn't when the field was free-text `instructions`.

> *"Found the trap door — it's not in the `omit`/`omit` vacuum run everyone circled, it's that `prepend` quietly can't prepend once a room's excerpt is exactly as big as the system is designed to let it get, and the persona doesn't even get a second guess."* — Sam

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟠 High — Persona-supplied text ceilings are word-count-only and trivially bypassable [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:350`

The persona controls `<excerptText>` / `<contextText>` in `prepend`/`replace` mode. Both the codec gate and the capability layer's re-check enforce the 10,000/35,000-word ceilings using `countWords`, which is `text.trim().split(/\s+/).filter(w => w.length > 0).length` — pure whitespace splitting.

A payload with no whitespace at all — 200,000 characters — counts as **1 word**, passes both checks, and flows into `analyzeWritingTools(excerptText, …)`, a real billed OpenRouter completion.

This is a regression, not a pre-existing gap: the sibling dictionary fields keep explicit character ceilings in the same file, and the field this PR replaces had `instructionsCharacters: 1_000` — deleted outright with no character-based successor. **Verified:** the diff removes that constant and adds no replacement.

The controlling attacker is whatever gets the persona to emit such a call — most plausibly prompt-injected content from a project-resource file or pasted prose read earlier in the same turn. Blast radius is real but bounded: the persona's own completion is still capped by the turn's `maxTokens` (default 10,000), so achievable payload size tracks roughly the intended ceiling's order of magnitude. That's why this is High, not Blocking.

**Fix:** add a character/byte ceiling alongside the word check, mirroring `wordCharacters`/`contextCharacters` two functions above it in the same file.

> *"The word count says 'one,' the invoice will say otherwise."* — Patricia

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The oversized-resolved-input rule has zero coverage at either layer [🎯🎯 Strong Consensus]

The sprint's exit criteria names oversized resolved inputs as a case that must reject visibly. Two independent checks implement it — the codec's raw-text gate (`WorkshopCapabilityXmlCodec.ts:350`) and the capability layer's combined-total gate (`WorkshopPersonaCapability.ts:772`).

Searched both `WorkshopCapabilityXmlCodec.test.ts` and `WorkshopPersonaCapability.test.ts` in full: `PROMPT_BUDGETS.personaExcerpt.words` and `PROMPT_BUDGETS.contextAttachments.words` are never referenced in either file, and no test exercises either oversized branch for `excerptText`/`contextText`. The codec's own oversized-input `it.each` block covers only the dictionary's `word`/`context`/`purpose` fields — the old `instructions` case was deleted with the field and nothing replaced it.

An off-by-one (`>` vs `>=`), a limit swapped into the wrong slot, or a change to the `prepend` combined-total math would all ship undetected. That this is exactly the guard Sam and Patricia found wrong in *opposite directions* is the point.

### 🟡 Standard — The 16-pairing test content-verifies only the diagonal

`packages/core/src/__tests__/application/services/workshop/WorkshopPersonaCapability.test.ts:322-333`

The test genuinely calls `.fulfill()` for all 16 combinations and confirms 16 `runWithInputs` calls with `analysis.run:success` — real confidence nothing rejects wrongly across the matrix, which is the sprint's headline claim.

But the `resolvedRuns` assertions pin only `omit/omit`, `prepend/prepend`, and `replace/replace` — the diagonal. `resolveAnalysisInput` is a private method invoked per-slot with different parameters (`wordLimit`, `inheritedText`, `inheritedMaterial`, `chosenBy`), reachable only through this heavier seam. A bug crossing the wires between slots — passing the context `wordLimit`/`inheritedText` into the excerpt call — produces identical, passing results on every diagonal combo and surfaces only off-diagonal, e.g. `excerpt=replace/context=inherit`. 13 of 16 pairings are proven "not rejected" but not proven "correct."

### 🟡 Standard — `prepend` against absent material is proven for the excerpt slot only

`packages/core/src/__tests__/application/services/workshop/WorkshopPersonaCapability.test.ts:150-161`

The excerpt case is covered and legible. The identical context guard — same `resolveAnalysisInput` branch, parameterized by `slot` — is never exercised: the 16-pairing test always seeds a context attachment first, so context is never absent anywhere in the suite. Shared implementation lowers the residual risk, but a parameter-order mistake across the two call sites (`:684` vs `:707`) would only be caught on the untested side.

> *"Sixteen pairings ran, sixteen pairings said 'success' — but only three of them ever got asked what they actually resolved to, and the word-limit guard the sprint promised in writing never got asked anything at all."* — Cal

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — `inherit` mode attributes the writer's own material to the persona

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:665`

The sprint is explicit that provenance must state *who chose it* as a distinct fact. The direct path gets this right — `WorkshopAnalysisSidePass.run` hardcodes `chosenBy: 'Writer'` for both slots, because inherit-mode material there really is the writer's pinned excerpt.

But `resolveAnalysisInputs` passes `chosenBy: personaLabel` unconditionally (`:665` excerpt, `:688` context) — including when `selection.mode === 'inherit'`, exactly the case where the persona is using the room's existing writer-pinned material unchanged and supplying nothing. The rendered row reads *"Excerpt · inherit · pinned excerpt v3 · chosen by Jill"*, telling the writer the persona chose their own passage.

Is misattributing writer-pinned material intentional — is `chosenBy` meant as "who is the acting party in this run" rather than "who selected this material"? Or should inherit-mode fall back to `'Writer'` the way the direct path does?

### 🟠 High — The prefill can credit the wrong persona's suggestion

`packages/core/src/presentation/webview/utils/workshopToolAskPrefill.ts:15-16`

The sprint: *"point at a persona turn when there is one to point at… and stay target-neutral otherwise. A prefill that misdescribes the thread is worse than a generic one."*

The check asks only whether the tail turn is `role === 'assistant'` with a truthy `personaId` — never that `personaId` matches the persona being addressed. **Verified:** `WorkshopSessionService.ts:1344-1348` stamps `personaId` for host turns (`participants.host.personaId`) and guest turns (`active.guestPersonaId`) identically. The call site, `WorkshopApp.tsx:681`, always passes the **host's** label — `activePersona` derives from `selectedPersonaId`, never from `chatTarget`.

So if a persona guest (say Quinn) gave the last suggestion, the seeded ask reads *"Hey Jill! Run Stock & Signature on **your** last suggestion"* — attributing Quinn's work to Jill by name. The new test file covers empty, writer-tail, and tool-tail cases; a guest tail is not among them.

> *"The `chosenBy` field never lies about who ran the tool — it just quietly lies about who picked what the tool ran on."* — Bria

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — The one structured log line for `analysis.run` says "none"

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:830-832`

This PR adds 16 mode pairings, three runtime rejection paths, and a rich `resolved.provenance` object. All of it reaches the turn metadata and the transcript UI; none of it reaches `outputChannel`.

The one `appendLine` that fires for every analysis run logs `requestLogSummary` (the *requested* modes only) plus `resultLogSummary(result)` — which, for anything not `resource.*`, is the hardcoded `'resourceMetrics=none'`. It also never includes `result.error`, so a runtime rejection produces `capabilityOutcome=rejected` with no indication why.

Worse: because only the *requested* mode is logged and never the *resolved* word count, a bug where `inherit` silently resolves to near-empty text is indistinguishable from a correct run — both read `excerptMode=inherit … capabilityOutcome=success`. A developer chasing "the report came back useless" has the requested mode, a duration, and `resourceMetrics=none`; to learn what was actually delivered they must reopen the transcript and expand that exact turn.

### 🟡 Standard — The shared rejection log can't tell you it was `analysis.run` that failed

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:750-752`

This is the cross-cutting site that logs every schema-level rejection, so it does fire for the six new `analysis.run` reasons. But it logs `capability.catalog` — a constant `'workshopPersona'` shared by dictionary, analysis, and resource calls — and `inspection.reason`, never `inspection.field` or which operation triggered it. For the "persona repeatedly emits an invalid `analysis.run` and burns its budget" scenario, the channel shows a run of `Rejected workshopPersona capability request … reason=input-mode-text-mismatch` with no way to grep for the capability or learn which field mismatched.

> *"The provenance block is a lovely artifact for the writer's transcript — I just wish it phoned home to the Output Channel too, because right now the log says 'none' the instant I need it to say something."* — Oliver

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — Analysis-family resolution wasn't extracted the way its `resource.*` sibling was [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:650-778`

This class demonstrates the convention in its own constructor: `resource.*` got a 482-line collaborator, `WorkshopResourceCapability`, leaving `WorkshopPersonaCapability` a thin dispatcher for that family. The `analysis.run` family got no equivalent — ~130 lines of mode resolution, word-budget arithmetic, and provenance construction that touch neither `this.turn.events` nor turn-recording were folded directly in, pushing the class to 850 lines and mixing protocol dispatch with input-resolution business logic. With the sibling pattern sitting one page above in the same file, this reads as inconsistency rather than choice.

### 🟡 Standard — Inherited-input description duplicated across both run paths

`packages/core/src/application/services/workshop/WorkshopAnalysisSidePass.ts:96-118`

`WorkshopAnalysisSidePass.run()` and `WorkshopPersonaCapability.resolveAnalysisInputs()` independently compute the same "describe the room's current excerpt/context as human-readable provenance" logic: identical `pinned excerpt v${version}` template, identical `no context attachments` / `${count} context attachment(s) (labels)` phrasing, identical truncation `.filter().map().join('; ')` with the same `toLocaleString('en-US')` calls. That's the same domain knowledge encoded twice in two service classes, not superficial text similarity.

### 🟡 Standard — Provenance's `material` embeds a count the UI displays again [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:106-110`

For `replace`, `material` is `persona-supplied excerpt (240 words)` and `words` is `240`. The row template renders both: *"Excerpt · replace · persona-supplied excerpt (240 words) · 240 words · chosen by Jill."* `WorkshopAnalysisInputProvenance` mixes a machine-checkable fact with a pre-formatted locale-aware sentence built in the application layer, and the presentation layer has no way to render one without restating the other.

> *"The bones are sound and the seam between codec and capability is real, but the provenance type is moonlighting as a sentence writer, and two files are quietly agreeing on the same paragraph without ever being introduced to each other."* — Marcus

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — Three parallel ternary cascades keyed on the same four modes

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:737-765`

`resolveAnalysisInput` dispatches on `selection.mode` three separate times — for `totalWords`, `text`, and `material` — each re-deriving the same four-way branch. A maintainer adding a fifth mode must hunt three chains and update them in lockstep or silently desync them (`text` gets the branch, `material`'s description doesn't). The sibling in `WorkshopAnalysisSidePass.execute` dispatches on `toolId` *once*; this is a different shape. A single `switch` computing all three fields per case would put "what happens for `replace`" in one place instead of three.

### 🟡 Standard — A second "did it fail" convention beside the codec's established one

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:652,671,693,725`

The resolver invents `T | { error: string }`, narrowed by structural `'error' in x`. But the type it feeds — `WorkshopCapabilityInspection` in the codec — already establishes the house convention for exactly this resolved-or-rejected shape in the same pipeline: a `kind` discriminant, not shape-sniffing. A maintainer reading `runAnalysis` holds two narrowing idioms for two halves of one request's lifecycle.

### 🟡 Standard — `material` duplicates the `words` field beside it, visibly [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:108`

Same finding Marcus reached independently. Parker's fix: make `material` a bare label with no embedded count (`"persona-supplied excerpt"`, `"pinned excerpt v3"`) and let the single `words` field own the number everywhere — which also drops the `toLocaleString()` calls from `resolveAnalysisInput`.

> *"I had to read `resolveAnalysisInput` three times to be sure `text`, `material`, and `totalWords` actually agree on what `replace` means — and then the transcript told me the word count twice just to make sure I got the message."* — Parker

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — New frame builder placed by analogy, but its own layering rule doesn't apply

`packages/core/src/utils/workshopPromptFrames.ts:60`

The file's doc comment on the sibling directly above (`buildWorkshopOpenConversationFrame`) explains why frame builders live in `@/utils` rather than `WorkshopPromptBuilder.ts`: *"the INITIAL envelope is assembled in the infrastructure layer, which must not import the application layer."* That reason genuinely holds for that function — it's called from `AssistantToolService.ts:969`, infrastructure.

`buildWorkshopAnalysisScopeFrame` has exactly one caller: `WorkshopPersonaCapability.ts:638` — application-layer code in the same directory as `WorkshopPromptBuilder.ts`, which already holds the two nearest siblings, `buildWorkshopExcerptSourceFrame` and `buildWorkshopContextAttachmentsFrame`. And `WorkshopPromptBuilder.ts` already imports the neutralizer from `@/utils` for exactly this kind of escaping, so nothing technical forced the placement.

### 🟡 Standard — This file keeps absorbing Workshop features — the pattern already filed as tech debt [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:716`

`.todo/tech-debt/2026-07-25-workshop-god-files.md` — filed the same day as this PR, from the PR #86 review — tracks exactly this failure mode on `WorkshopSessionService.ts` (~2,500 lines) and `WorkshopHandler.ts` (~2,700), and names the fix already proven here: `RunWorkshopToolSidePass.ts` was extracted from `WorkshopHandler.ts` as a cohesive unit.

`WorkshopPersonaCapability.ts` was already past 500 lines before this PR (687) and gains ~165 more, reaching 850 — the same trend, on a third file that ticket doesn't yet name. The new resolution logic is self-contained and independently testable: closer in spirit to `RunWorkshopToolSidePass` than to inline dispatch.

> *"We already filed the 'god files keep eating Workshop features' tech debt on the two big ones — nobody told this file it wasn't invited to the party."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — The prompt-cache claim holds, verified against the code

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:85`

This is the sprint's headline claim, so it got checked structurally rather than taken on faith. `createWorkshopCapabilityInstruction()` used to take a `WorkshopCapabilityAvailability` param and branch its body on `excerptAvailable` — two different instruction bodies depending on room state. That branch is gone; the signature dropped the argument entirely. The closed grammar moved to a static `analysis-capability.md` that `workshopPersonaSystemPromptPaths()` appends **unconditionally**, not gated on excerpt presence, scope, or room state.

The only thing that varies per turn is `buildWorkshopAnalysisScopeFrame()` — a handful of lines of *facts* injected into the user-turn contract, not the system prompt. A provider's cache keys on the system-prompt prefix; that prefix is now byte-identical across open rooms, passage rooms, and turns within a room. The test at `WorkshopCapabilityXmlCodec.test.ts:267-273` locks it in. This matters at any scale — it's the point of the sprint — and it's real.

### 🟢 Nit — Excerpt word-counted twice per persona turn

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:642`

`analysisScopeFrame()` runs on every user turn to report the word-count fact whether or not `analysis.run` is called; if it is, and the excerpt slot is `inherit`/`prepend`, `resolveAnalysisInputs` counts the same string again. `countWords` is linear with no backtracking risk. At the 10,000-word ceiling (~60-70KB) each call is low single-digit milliseconds — under 10ms total, noise against a multi-second LLM round trip. Doesn't matter at current scale. If the excerpt budget is ever bumped an order of magnitude the way `contextAttachments` already was (10k → 35k), compute it once per turn and pass the number down.

### 🟢 Nit — Regex and array-copy risks both checked out clean

`packages/core/src/utils/workshopPromptFrames.ts:6`

Closing these out explicitly rather than dropping them silently. (1) `RESERVED_PERSONA_FRAME`: all fixed literal tag names, no nested quantifiers, and `[^>]*>` can't backtrack ambiguously since `[^>]` excludes the terminator it hunts — the standard safe "match to next `>`" idiom, not the `(a+)+` shape. It only ever runs on bounded inputs. (2) `buildWorkshopToolAskPrefill`'s `[...turns].reverse()` does copy the full array, but runs once on a user click, never in a render path — sub-millisecond even at a thousand turns.

> *"Two `countWords` passes on a 10k-word ceiling is microseconds against a multi-second LLM round trip — I did the math so you don't have to pretend to."* — Tim

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Action at a Distance

Illuminated by: Blake's sidecar hijack; the tech-debt note filed the same day for two sibling files widened the same way.

The most dangerous class of defect leaves no fault line in any diff — the code doing the acting was already correct, for a world where every persona run inherited the pin. When this sprint widened what a run could receive, it quietly rewrote the meaning of "a persona run happened" for every downstream reader of that fact, including code that had no reason to be reopened and so wasn't. A contract's true audience isn't the functions that call it — it's every function that ever trusted its old shape.

→ Carry forward: When you widen what a message, event, or state transition can mean, grep for every consumer of that fact, not just the ones you touched, and ask each: *"does my old assumption about you still hold now that you can arrive looking different?"*

### Lesson 2 — The Guard No One Watched Leans Both Ways

Illuminated by: Sam's too-strict read, Patricia's too-loose read, and Cal's zero-coverage read — of the same check.

A boundary check with no test pressing on it from either side doesn't settle near "correct" — it drifts, because nothing holds either edge in place. This gate rejected legitimate requests at the exact number the system itself already permits, while waving through a payload with no spaces at all because it counted by whitespace. Untested isn't a calm middle ground between too-strict and too-loose; it's the absence of the force that would have caught either one.

→ Carry forward: For any numeric guard, write the two tests a linter would never suggest — an input that should just barely pass and currently doesn't, and one that should obviously fail and currently doesn't — chosen adversarially, not shaped by the happy path you had in mind when you wrote the check.

### Lesson 3 — The Feature That Promised Honesty Owes Itself an Audit

Illuminated by: `chosenBy` crediting the persona for the writer's material; the prefill crediting the wrong persona; `material` stating its count twice; the log that says nothing.

When a system's entire purpose is to narrate the truth of an event, every field in it is a claim — and claims default to the shape of the one case you were picturing, not the full space of cases that actually visit them. `chosenBy` was accurate for the case the author had in mind (a persona actively choosing) and quietly inaccurate for the case sharing its exact code path. Provenance bugs are unusually hard to notice this way: a wrong label doesn't crash anything, it just speaks fluently in the voice a correct one would use.

→ Carry forward: For any field whose job is describing an event to a human, write out its full state space — every mode, every actor — and ask of each cell: *"if I only ever exercised this against one of these, would I know if this cell were false?"*

### Lesson 4 — The Prompt Is Code You Forgot to Review

Illuminated by: the system prompt scoping the word limit to persona-supplied text while the validator counts supplied-plus-inherited against it.

When a model reads your documentation and a validator enforces your rule, you've written one contract in two languages, by two disciplines, with nothing forcing them into the same review the way two functions calling each other would get. The prompt writer and the validator writer were each faithful to a rule that exists nowhere as a single source of truth — the gap was visible only by holding both texts up together and asking what a compliant persona would actually experience.

→ Carry forward: When a limit is described to the model in prose and enforced in code, keep both in the same review, and write a test that starts from the prompt's literal promise and checks the validator honors exactly that promise — not a neighboring one that felt equivalent while you were writing it.

### Lesson 5 — Meter After the Gate, Not Before

Illuminated by: the per-turn budget spent in `dispatch` before `runAnalysis` validates — so a rejection burns the allowance, then invites a retry it has already foreclosed.

Any system that charges a cost — a budget slot, a rate-limit token, a retry count — before confirming the request was legitimate will eventually tell someone to do the one thing it just made impossible. This pattern felt safe because it mirrors precedent already living in the codebase, but "we already do it this way" describes a habit, not a proof — it just means the same seam is waiting to be noticed a second time.

→ Carry forward: Trace every side effect in a handler back to the checks that can still fail after it fires. If a spend or mutation sits upstream of a possible rejection, ask whether that rejection's message could suggest an action the side effect has already foreclosed.

> *"The most honest systems aren't the ones that never lie — they're built by people who keep asking each field, quietly, 'and is that still true in the case I haven't imagined yet?'"* — Sensei

---

## The Closer

### 🎬 Movie tagline

> **In a world where the host chooses what the tools may see…**
>
> *one conversation was never asked for its consent.*
>
> She pinned the passage. She ran the tool. She trusted the record.
>
> **THE SIDECAR** — this summer, provenance has a story of its own.
>
> *Rated H, for handled unconditionally.*

---

## Summary

This is strong, carefully-reasoned work — the two-input mode grammar is a genuinely elegant way to widen the analysis engine without touching it, and the prompt-cache split was verified to hold exactly as designed. The sprint's own exit criteria are unusually well-specified, which is precisely why the panel could check them.

One blocker stands between this and merge: a persona run using `replace`/`omit` adopts the writer's tool sidecar unconditionally, discards their conversation, and then records a source manifest describing material the run never received — falsifying the sprint's own "the room is never mutated" invariant. The adopting code is untouched by this PR; the new modes made a previously-safe assumption false at a distance. Alongside it, the word-limit gate needs attention from three directions at once (too strict for `prepend`, bypassable by whitespace-free text, untested at either layer), and two provenance fields tell the writer something untrue in a feature built specifically to tell them the truth.

None of these are structural — they're a boundary that needs one more conditional, a ceiling that needs a character check and a rethink of whose budget it is, and two labels that need to distinguish the actor from the chooser. Fix the blocker and items 3-7, and this merges comfortably.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
