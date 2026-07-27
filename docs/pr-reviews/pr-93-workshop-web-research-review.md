# MR Review — Workshop web research setting

**Author:** Okey Landers · PR [#93](https://github.com/okeylanders/prose-minion-vscode/pull/93) · `feat/workshop-web-research` → `epic/workshop-editor-tab`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status` column as
findings are addressed so this file stays a living record. Legend: **Open** = act before merge ·
**Deferred** = real issue, safe to punt for a stated reason (track it) · **Addressed** = fixed ·
**Partially addressed** = fixed with a noted remainder · **N/A** = out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | `npm test` is red — modal suite fails to compile, `MessageHandler` test throws `getWebResearch is not a function` | Cal, Bria | 🎯🎯 | **Addressed** |
| 2 | 🔴 Blocking | `[open, webResearch]` dep array wipes half-typed Conversation Settings drafts on every session-state push | Blake, Tim, Bria | 🎯🎯 | **Addressed** |
| 3 | 🔴 Blocking | `assertCitation` accepts any string as a URL; `new URL()` in render then takes out the whole thread pane | Sam, Patricia, Blake | 🎯🎯 | **Addressed** |
| 4 | 🔴 Blocking | `webResearch` skips the pending-persistence guard PR #83 added — failed write silently reverts | Marcus, Stan | 🎯 | **Addressed** |
| 5 | 🟠 High | `citations: last.citations` drops every source found before the final turn of a multi-turn run | Blake | — | **Addressed** |
| 6 | 🟠 High | `RunWorkshopToolSidePass` host tool-synthesis turn never receives `webResearch` | Bria | — | **Addressed** |
| 7 | 🟠 High | No session-level cap on web-search spend or latency; attached to every persona turn | Tim | — | **Deferred** |
| 8 | 🟠 High | `scope: "application"` on a network capability — no per-workspace opt-out, syncs across machines | Patricia | — | **Addressed** |
| 9 | 🟠 High | Disclosure names latency and provider charges, never the second data recipient | Patricia | — | **Addressed** |
| 10 | 🟠 High | First-wins citation merge silently discards a richer duplicate's title | Sam | — | **Addressed** |
| 11 | 🟠 High | Pill numbers can disagree with the model's own inline `[n]` markers | Sam | — | **Deferred** |
| 12 | 🟠 High | `WorkshopConversationSettingsService` web-research logic untested — and the existing mock would mask a backwards wiring | Cal | — | **Addressed** |
| 13 | 🟠 High | The default-off case — the whole point of the feature — is never asserted | Cal | — | **Addressed** |
| 14 | 🟠 High | Citation parse failures are indistinguishable from "the model cited nothing" | Oliver | — | **Addressed** |
| 15 | 🟠 High | `createAnalysisResult` reaches 8 positional params; 3 call sites pad slot 7 with a literal `undefined` | Parker | — | **Addressed** |
| 16 | 🟡 Standard | `readWebResearchSetting` drops the rejection-logging convention its writer-profile sibling adopted | Stan, Oliver | 🎯 | **Addressed** |
| 17 | 🟡 Standard | Nothing logs that a turn attached the web-search tool; a research-only toggle logs nothing at all | Oliver | — | **Addressed** |
| 18 | 🟡 Standard | Dedicated-service pattern not extended — web research is a bare private field on the coordinator | Marcus | — | **Deferred** |
| 19 | 🟡 Standard | `changed: result.changed \|\| webResearchChanged` spelled out 3×, plus a rename that never diverges | Parker | — | **Addressed** |
| 20 | 🟡 Standard | One feature, four names — Advanced / Research / `webResearch` / "live web research" | Parker | — | **N/A** |
| 21 | 🟢 Nit | `UrlCitation` forks the `TokenUsage` precedent for where cross-cutting provider types live | Marcus | — | **Addressed** |
| 22 | 🟢 Nit | New `coerce`/`equal` pair ships without the doc comments both siblings carry; lone optional param | Stan | — | **Addressed** |

---

## Resolution notes — 2026-07-27

- Findings **1–6**, **8–10**, and **12–17** now have direct regression coverage. Citation URLs are validated at provider ingestion and persisted-state restoration; the renderer also has a safe fallback.
- Finding **7** is deferred to `.todo/tech-debt/2026-07-27-workshop-web-research-budget-and-citation-contract.md`: OpenRouter's current response does not provide an authoritative server-tool invocation count, so a session cap needs an explicit product/accounting contract rather than a misleading arbitrary limit.
- Finding **11** is deferred in the same tracked item. The UI intentionally retains the user-requested independently numbered, clickable source pills; it does not claim an unprovable mapping to model-authored inline markers.
- Finding **18** is deferred with that expansion path: the current single enablement toggle has the coordinator's guarded persistence contract, while any budget/control expansion must extract a dedicated web-research settings service.
- Finding **20** is **N/A**: **Advanced** is the user-directed tab location, while **live web research** is the capability label and `webResearch` remains the precise internal setting name.
- Findings **21–22** move `UrlCitation` into the cross-cutting messages barrel and align the web-research coercion API with sibling documentation/default-parameter conventions.

---

## Blast Radius

- 26 files changed · +524 / −55 lines · 6 commits
- New files: 1 (`shared/types/citations.ts`) · Migrations: no · New services: 0
- New settings triple: 1 (`proseMinion.workshop.webResearch`, application-scoped)
- New persisted field on the `WorkshopSessionStateV1` turn shape: `citations`
- New provider capability: `openrouter:web_search` server tool — **this PR opens a new outbound network path for manuscript-derived content**
- Reviewer-run verification: `npx jest` → **2 suites failed, 135 passed** · **1 test failed, 1467 passed**

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | D |
| 🛡️ Security | D |
| 🧪 Tests | F |
| 📖 Quality | C |
| ⚡ Performance | C+ |
| 🎯 Domain | D |

---

## Executive Briefing

🔴🎯🎯 **[Cal + Bria]** **`npm test` is red on this branch.** `WorkshopConversationBehaviorModal.test.tsx` fails to *compile* (TS2322 — `webResearch` became a required prop and the sibling suite was never updated), and `MessageHandler.test.ts` throws `getWebResearch is not a function` because `sendSessionState` now calls a method the test's settings-service stub doesn't define. Confirmed by running the suite. Note that `npm run typecheck` **deliberately excludes** `src/__tests__`, and the PR's stated validation was a *targeted* 60-test run — so both green checks were honest and both were blind to this.

🔴🎯🎯 **[Blake + Tim + Bria]** **The Conversation Settings modal now eats in-progress drafts.** The reset effect's dep array went from `[open]` to `[open, webResearch]`, but `webResearch` is a freshly-allocated object on every push (`getWebResearch()` spreads; `postSessionState()` has 34 call sites; `coerceWorkshopWebResearchSettings` allocates in both branches). Leave the modal open during a live turn and a 900-word writer-profile bio is silently replaced and the user is snapped back to the Behavior tab. `writerProfile` has the identical churn and was deliberately kept *out* of that array.

🔴🎯🎯 **[Sam + Patricia + Blake]** **A malformed persisted citation takes out the entire conversation, permanently.** `toUrlCitations` enforces `/^https?:\/\//` on the provider path; `assertCitation` — the gate for untrusted on-disk state — checks only `typeof url === 'string'`. Verified: `"anthropic.com"` passes `assertCitation`, and `citationLabel`'s unguarded `new URL()` throws during render, escalating to the thread-level ErrorBoundary. The bad row is on disk, so it survives reloads.

🔴🎯 **[Marcus + Stan]** **This is PR #83's blocker #2, reborn on the third setting in the same file.** `applyFromWebview` commits `this.webResearch` *before* attempting persistence, but unlike behavior and profile it records no pending-persistence value — so a failed write plus any later config change silently reverts the user's toggle. The fix for the other two settings is nine lines up.

🟠 **[Patricia]** **The disclosure describes the invoice, not the second recipient.** All three user-facing strings frame this as OpenRouter latency and provider charges. None say that manuscript excerpts and the writer profile become search queries executed against infrastructure beyond the LLM provider — and `scope: "application"` means a toggle flipped on a hobby project is already on when an NDA'd manuscript opens elsewhere.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🔴 Blocking — Web-research setting reintroduces the exact persistence-echo revert bug PR #83 fixed [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:166`

```ts
this.webResearch = this.readWebResearchSetting();
```

Trace it: `applyFromWebview` sets `this.webResearch = nextWebResearch` (line 94) *before* attempting `settings.update(...)` for it (lines 128–138). If that write throws — the same failure mode already mocked and asserted for behavior/profile in this file's own test suite — `persistenceErrors.webResearch` is set but the in-memory value is left holding the applied-but-unpersisted state.

So far this mirrors `apply()`'s optimistic commit for behavior and profile. But those two then get `pendingBehaviorPersistence`/`pendingProfilePersistence` recorded on failure (lines 110–113, 122–125), and every `syncFromSettings`/`flushDeferredSettingsSync` resolves through `resolveBehaviorSetting`/`resolveProfileSetting` (lines 290–314), which re-apply the pending value instead of the stale disk value. `webResearch` has no such guard — both sync methods unconditionally call `this.readWebResearchSetting()`, discarding the applied value the very next time *any* of the three watched keys fires `onDidChangeConfiguration`.

This is the literal shape of Blake's confirmed blocking finding #2 in `docs/pr-reviews/pr-83-writer-profile-settings-review.md` — *"Partial persistence failure silently reverts the applied value… the successful key's `onDidChangeConfiguration` fires `syncFromSettings()`, which re-reads the key that just failed to save and commits the stale value back over the live one"* — which that PR's remediation explicitly closed by adding the pending-persistence tracking this new setting doesn't have.

Concretely: toggle web research on, hit a transient settings-write failure, then merely change the Behavior tab in the same session — the sync it triggers quietly turns research back off, with no error and no signal, after the modal told the user it applied. Give `webResearch` the same `pendingWebResearchPersistence` + `resolveWebResearchSetting` treatment.

### 🟡 Standard — The dedicated-service pattern that would have prevented the above wasn't extended

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:59`

```ts
private webResearch: WorkshopWebResearchSettings;
```

`WorkshopWriterProfileService` exists for a stated reason, and this class's own docstring frames the arrangement: *"Behavior remains session-owned while the injected profile service owns the separate global Writer Profile; this class gives their live prompt effects one serialized, guarded commit boundary."* That's a real seam — the profile service owns read/coerce/commit/persist, and the coordinator only orchestrates timing.

Web research gets neither a session-model home nor a dedicated service. It's a bare private field the coordinator reads, coerces, and writes inline, duplicating — and under-implementing — machinery the profile service already encapsulates. That isn't abstract taste; it's the direct mechanism behind the blocking finding above. Extending the discipline to a new setting currently means hand-copying three call sites' worth of guard logic rather than composing something that already carries it. A fourth setting arriving the same way grows another parallel field and another near-identical trio of sync edits.

### 🟢 Nit — `UrlCitation` skips this codebase's own precedent for cross-cutting provider types

`packages/core/src/shared/types/citations.ts:2`

`TokenUsage` is the closest existing precedent — a provider-response-derived fact that flows through message payloads (`WorkshopTurn.usage`), domain models, and infra contracts alike — and it lives in `shared/types/messages/tokenUsage.ts`, explicitly grouped under "Cross-cutting concerns" in the messages barrel. `UrlCitation` has an identical footprint (`WorkshopTurn.citations`, `AnalysisResult.citations`, `ExecutionResult.citations`) but gets a brand-new top-level sibling file instead of joining `tokenUsage.ts` at its established address. Low stakes — both locations are defensible, and `WorkshopWebResearchSettings` correctly followed the `messages/workshop.ts` SETTING-triple pattern right next to it — but it quietly forks the answer to "where does a cross-cutting provider-fact type live" one file over from where that answer already sat.

> *"The room-settings coordinator already has a scar from this exact wound — behavior and profile both carry the stitches — and the new setting walked in without checking the chart."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🔴 Blocking — Adding `webResearch` to the draft-reset effect wipes half-typed drafts on every session-state push [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:133`

```tsx
  }, [open, webResearch]);
```

The dep array was `[open]` on purpose. `webResearch` is a fresh object on every host push, so this effect now refires while the modal is open and blows away everything the user typed.

Trace it:

1. `WorkshopHandler.postSessionState()` is called from 34 sites — run completion, todo edits, context attach, excerpt swap, guest invite.
2. It sends `webResearch: this.conversationSettingsService.getWebResearch()`, and `getWebResearch()` returns `{ ...this.webResearch }` — a new object every call.
3. `useWorkshop.ts:711` does `setWebResearch(coerceWorkshopWebResearchSettings(message.payload.webResearch))`. **Both** branches of that coercer construct a new object literal, so `Object.is` is always false and the prop identity always changes.
4. Dep comparison fails → effect body runs → `open` is true → `setTab('behavior')`, `setBehaviorDraft`, `setProfileDraft`, `setWebResearchDraft`, `setPending(null)`, `setConfirmClear(false)`.

The user is on the "About you" tab, 900 characters into the bio textarea. A persona run finishes in the background. `postSessionState` fires. Their bio is silently replaced by the host's stored profile and they're yanked back to the Behavior tab with no indication anything happened. No confirm, no undo, no local persistence — the text is gone.

`writerProfile` has the *exact same* identity churn (`coerceWorkshopWriterProfile` also returns a fresh object) and was deliberately kept out of this array. Adding `webResearch` reintroduces the bug for all three drafts at once.

This isn't theoretical for the mid-run case: the existing test *"locks Apply during a response while leaving inspection and drafts available"* asserts as a contract that drafts stay editable during a run — `editingLocked` is `pending !== null` only; `isRunning` disables Apply, not the textarea. The codebase explicitly promises "type while it runs," and this change breaks that promise at the moment the run lands.

Fix: revert the dep array to `[open]`. If the modal must notice an external `settings.json` edit that lands while open, gate on the *value*, not the identity — a separate effect keyed on `webResearch.enabled` that touches nothing else.

### 🟠 High — `citations: last.citations` silently drops every source found before the final turn

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:462`

```ts
        citations: last.citations,
```

`last` is reassigned on every capability round — `last = await runInstructedTurn(last, evidence)` (line 372), `last = await recoverInvalidRequest(last)` (line 382), and again in the forced-final block. Only the surviving `last` contributes citations.

Failure path: research is enabled, a persona turn searches the web and the provider returns `url_citation` annotations on turn 1. The persona then emits a capability request (fetch a source, read an excerpt). The engine runs an instructed turn 2 to consume the evidence. Turn 2 is a plain synthesis reply with no annotations, so `last.citations` is `undefined`. Every source from turn 1 is discarded before it reaches `createAnalysisResult` → `completeWorkshopRun` → `WorkshopTurn.citations`.

The user-visible result is worse than "no pills." This PR's own comment on `WorkshopTurn.citations` says *"model-authored [n] markers remain ordinary text"* — so the reply renders with `[1]`, `[2]` inline and no "Web sources" block underneath. Dangling reference markers pointing at nothing, silently. The forced-final path is the worst case: a re-prompt to stop calling tools and answer will essentially never carry annotations, so a run that hits its capability limit reliably loses all of its citations.

Look two lines up in the same return object for the pattern this file already uses: `usage: totalUsage` is accumulated across turns; `usedGuides` and `requestedResources` are deduped unions. Citations are the only per-turn signal read off the last turn alone. Hoist a `runCitations: UrlCitation[]` beside `totalUsage` and merge each turn's citations into it.

### 🟠 High — `assertCitation` accepts any string as a URL, but the renderer calls `new URL()` on it [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:52`

Two validators for the same field, and the one guarding untrusted input is the weaker one. See Sam's and Patricia's write-ups below for the full trace — the short version is that `WorkshopSessionStateV1Shape.ts` exists specifically to validate untrusted on-disk JSON, and for `citation.url` it validates only that the value is a string.

> *"Every one of these ships fine on a quiet laptop and then eats a user's 900-word bio the first time a run lands mid-edit — I've cleaned up this exact incident, and the dep array was `[open]` for a reason."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🔴 Blocking — A bare `https://` citation URL crashes the entire turn thread, not just one pill [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:52`

```ts
return title && !/^\d+$/.test(title) ? title : new URL(citation.url).hostname;
```

I traced the validation gap between where citation URLs are accepted and where they're rendered. `toUrlCitations` only checks `/^https?:\/\//.test(value.url)` — a prefix test, not a well-formedness test.

Confirmed in Node:

| input | passes producer regex | `new URL()` |
| --- | --- | --- |
| `"https://"` | ✅ | 💥 `TypeError` |
| `"https:///path"` | ✅ | `hostname=path` |
| `"anthropic.com"` | ❌ | 💥 `TypeError` |

A string like `"https://"` passes the regex and throws when constructed. It flows untouched through `mergeUrlCitations`, into `completeRun`, into the persisted turn, and into `WorkshopTurnBubble`'s `citations` memo — which only dedupes by URL and does nothing to validate. When such a citation has no title (or a numeric-only one, e.g. a year), `citationLabel` falls through to `new URL(...).hostname` and throws during render.

There's no local error handling and no ErrorBoundary around just the pills — the nearest boundary wraps the whole thread panel in `WorkshopApp.tsx`. So one malformed citation doesn't break its own pill; it replaces the *entire visible conversation* with "Something went wrong," for every turn, until the user hits Try Again. None of the new tests exercise a URL without an authority — searched the diff, not found; the fixtures are all well-formed. Tighten the ingestion check to attempt `new URL()` in a try/catch rather than relying on a loose regex that a rendering-side `new URL()` implicitly trusts.

### 🟠 High — First-wins citation merge silently discards a richer duplicate

`packages/core/src/infrastructure/api/providers/OpenRouterClient.ts:353`

```ts
if (!merged.some((existing) => existing.url === citation.url)) {
  merged.push(citation);
```

`mergeUrlCitations` dedupes purely on `url`, first-occurrence wins, with no reconciliation of fields on a later match. This runs both within a single non-streaming response and across streaming frames. If the model cites the same URL twice — extremely ordinary for a grounded answer referencing one source at two points — and the first annotation arrives without a `title` while a later one for the same URL carries it, the title is silently dropped forever. The user sees a bare hostname pill instead of the actual source title, even though the richer data was in the same payload.

The new `'accumulates citations reported across streaming frames'` test only exercises two *different* URLs, so this path is untested. Merge field-by-field — keep the first `startIndex`/`endIndex`, prefer whichever occurrence has a non-empty `title` — or at minimum backfill a missing title when a duplicate arrives with one.

### 🟠 High — Citation pill numbers can disagree with the model's own `[n]` markers

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:437`

```tsx
<span className="pm-ws-turn-citation-number">{index + 1}</span>
```

The pill number is the post-dedup array index, entirely disconnected from the `[n]` markers the model writes inline in `turn.content` — the OpenRouterClient test literally produces `'Grounded answer [1]'` as plain text, and nothing in this diff parses or links those markers. In the common case the two happen to line up by coincidence. But because `mergeUrlCitations` collapses same-URL annotations, the moment a model re-cites a source it already used — text reads `…as noted [1]… confirms this [2]… circling back [3]` where `[1]` and `[3]` are the same URL — the merged array has two entries. The reader sees an inline `[3]` with no pill numbered 3.

The notice modal's new copy promises replies "show each source as a clickable citation pill," which reads as an implicit numbering contract this code doesn't maintain. Either don't render a number at all, or parse and renumber against the model's markers so the two schemes can't diverge.

> *"Found the trap door: cite the same source twice in one reply, and the pill numbers stop matching the brackets in the text — the second citation gets deduped right out of existence."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟠 High — `createAnalysisResult` grows to 8 positional params; three call sites pad with a meaningless `undefined`

`packages/core/src/domain/models/AnalysisResult.ts:29`

```ts
static createAnalysisResult(toolName: string, content: string, usedGuides?: string[], usage?: TokenUsage, finishReason?: string, conversationId?: string, requestedResources?: string[], citations?: UrlCitation[]): AnalysisResult {
```

This factory was already six positional params deep; it's now eight. The new `citations` slot lands after `requestedResources`, so every Workshop call site that wants citations but has no `requestedResources` writes a literal `undefined` just to hold the seventh slot open — `AssistantToolService.ts` lines 567–576, 629–638, and 685–694, each ending `executionResult.conversationId, undefined, executionResult.citations`.

A reader has to count commas against the declaration to know what that bare `undefined` means, and the next person adding a ninth field will either repeat the trick or silently shift someone else's argument into the wrong slot — there's no compiler check tying field names to call-site position.

Convert to an options object: `createAnalysisResult(toolName, content, { usedGuides, usage, finishReason, conversationId, requestedResources, citations })`. Migration is mechanical and bounded — 16 call sites in `AssistantToolService.ts`, all constructible from locals already in scope, and TypeScript flags anything missed. Worth doing before a ninth field shows up.

### 🟡 Standard — `changed: result.changed || webResearchChanged` repeated three times, plus a rename that adds nothing

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:92-142`

`persistWebResearch` is assigned `webResearchChanged` and never diverges from it anywhere in the method — unlike `persistBehavior`/`persistProfile`, which fold in genuinely different pending-persistence logic. The rename buys nothing but an extra name to chase down and confirm is really just the other name.

Meanwhile `changed: result.changed || webResearchChanged` is spelled out identically at the early return and at both branches of the persistence-errors check — three chances to drift if someone edits one and not the others. Drop `persistWebResearch`, and compute the merged `changed` once right after `webResearchChanged` is derived.

### 🟡 Standard — One feature, four names — Advanced / Research / `webResearch` / "live web research"

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:256`

The tab is labeled **Advanced**, the footer note under it calls the same thing **Research** (twice), the toggle says "Allow live web research," the wire setting is `webResearch`, and `WorkshopNoticeModal.tsx` tells the user to look "In **Advanced**… research the live web." A user reads three different words for one on/off switch and has to infer they're the same thing.

"Advanced" is also weak on its own merits — it says nothing about what's inside, and if a second unrelated setting lands in that tab the name becomes actively misleading about scope. Rename the tab to **Research** so the label, the footer copy, and the setting name all say the same word; reserve "Advanced" for a tab that's genuinely a junk drawer, if that ever happens.

> *"One setting, four aliases — I had to cross-reference the tab, the footer, and the wire type just to convince myself they weren't three different features."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🔴 Blocking — The modal test suite doesn't compile; Advanced tab, Switch, and tab navigation are entirely unverified [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:95`

```ts
webResearch: WorkshopWebResearchSettings;
```

Searched diff for `WorkshopConversationBehaviorModal.test.tsx` — not found. The diff makes `webResearch` a required prop and a required third argument on `onApply`, but the test file is untouched. Its `renderModal` helper builds `props` typed as `React.ComponentProps<typeof WorkshopConversationBehaviorModal>` and never sets `webResearch`.

**Confirmed by running the suite:**

```
FAIL packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.test.tsx
  ● Test suite failed to run
    TS2322: Type '{ … webResearch?: WorkshopWebResearchSettings | undefined … }'
    is not assignable to type 'WorkshopConversationBehaviorModalProps'.
```

Every test in that file — tab navigation, profile clearing, pending-apply reconciliation — now fails to compile. `packages/core/tsconfig.json` explicitly excludes `src/__tests__`, so `npm run typecheck` never sees it; ts-jest type-checks by default, so `npm test` does.

Set the compile question aside and the coverage gap is just as real: nothing renders the Advanced tab, clicks the `Switch`, asserts the new three-tab wraparound (Home→behavior, End→advanced, ArrowLeft/Right modulo 3), or exercises `submittedWebResearch` in the pending-apply reconciliation. I'd write *"cycles through Behavior → About you → Advanced on ArrowRight from the last tab"* and *"keeps the modal open when the applied webResearch echo doesn't match the submitted draft"* — mirroring the existing behavior/profile pending-apply tests, which have no webResearch analog.

### 🟠 High — The settings service's new logic has zero coverage, and the existing mock would mask it

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:247`

Searched diff for `WorkshopConversationSettingsService.test.ts` — not found. This file gained the constructor read, `getWebResearch()`, `readWebResearchSetting()`, the `applyFromWebview` persist branch, the `settings.update` failure branch, and changed-detection in *both* external-sync methods. None of it is driven.

It's worse than a coverage gap. The existing `settings.get` mock (`key === 'workshop.writerProfile' ? configuredProfile : configured`) returns the *behavior* fixture for any other key, including `workshop.webResearch`. That object has 4 keys, so `coerceWorkshopWebResearchSettings`'s `Object.keys(raw).length === 1` guard silently falls back to the default — meaning if someone wired the new logic backwards, this suite would still pass green.

Add a `describe('webResearch')` block: `applyFromWebview(behavior, profile, { enabled: true })` calls `settings.update('proseMinion', 'workshop.webResearch', { enabled: true })` and `getWebResearch()` reflects it; a rejected `settings.update` populates `persistenceErrors.webResearch`; and `syncFromSettings()` reports `changed: true` when only the research setting moved underneath it.

### 🟠 High — The default-off case — the entire point of this feature — is never asserted

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:697`

Searched `AssistantToolService.test.ts` for `webResearch` / `web_search` / `tools:` — not found, and the diff doesn't touch that file. `workshopWebSearchTools` is the single gate deciding whether `openrouter:web_search` ever reaches a request; it returns `undefined` for `false` and — critically — for `undefined`, which is what every call site that doesn't thread the option sends.

The new OpenRouterClient tests prove the *enabled* case forwards the tool object unchanged, but that's a different seam: it starts from an already-built `OpenRouterWebSearchTool[]`, so it can't catch a regression where `workshopWebSearchTools` starts returning a tool for the false branch. Add a test that calls the Workshop entry points with `webResearch` omitted and separately `false`, and asserts the engine received `tools: undefined`. Without it, "default-off" is a comment and a `package.json` default, not a verified behavior.

> *"Happy path only, again — you tested that the light turns on, never that it stays off when nobody flips the switch."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🔴 Blocking — `webResearch` skips the pending-persistence guard PR #83 added specifically to prevent this [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:128`

This is the same class, the same method, nine lines below a working example of how to do it correctly. When `persistBehavior`'s `settings.update` throws, the catch sets `this.pendingBehaviorPersistence = { storedValue, appliedValue }`; same for the profile catch. That pending record exists so the sync methods can call `resolveBehaviorSetting`/`resolveProfileSetting` and keep serving the *applied* value instead of the stale one still in the settings store.

The webResearch catch does none of that, and `this.webResearch = nextWebResearch` is applied optimistically before the persistence attempt even runs. Toggle research on, the write throws, the live room correctly keeps running with research enabled — until any other config change fires `syncFromSettings()` (it watches all three keys together, per `MessageHandler.ts`'s `affects(…) || affects(…) || affects(…)`), which calls `this.webResearch = this.readWebResearchSetting()` with no pending check and silently reverts the user's toggle.

This is pr-83's blocker #2 reborn on the third setting, in the same file, after the fix for the first two landed right there for reference. `WorkshopConversationSettingsService.test.ts` has zero `webResearch` occurrences — I grepped it — so this branch shipped with no coverage, same as pr-83's finding #4 flagged before the fix.

### 🟡 Standard — `readWebResearchSetting` drops the rejection-logging convention pr-83 explicitly added [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:247`

pr-83 finding #9 (*"Coercion fails closed with no trail"*) flagged that `WorkshopWriterProfileService` had no `LogSink`, so a hand-edited over-limit bio silently reset to disabled with nothing logged. It was addressed — `readSetting()` now logs `'[WorkshopWriterProfileService] Rejected invalid writer profile setting; using the disabled default'`.

`readWebResearchSetting` has no such check, even though `this.outputChannel` is already a constructor dependency of this exact class and already carries two other log lines in this file. A stray key in a hand-edited `settings.json`, or a future field added without updating the coercer, silently resets the whole object to `{ enabled: false }` — indistinguishable in the logs from the writer deliberately turning research off. Same failure mode pr-83 already named and fixed one setting over; the fix didn't travel with the pattern it should have informed.

### 🟢 Nit — The new triple doesn't read like a sibling of the other two in the same file

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:72`

`rawBehavior` and `rawWriterProfile` are required `unknown` params on this signature; `rawWebResearch` is the only one marked `?`, despite its coercer degrading `undefined` to the default exactly as its peers do. `WorkshopSetConversationSettingsPayload` declares `webResearch` **required**, matching its siblings — so the optional marker exists only on this one call boundary, for no functional reason.

Same story in `shared/types/messages/workshop.ts`: `coerceWorkshopWriterProfile` and `coerceWorkshopConversationBehavior` both carry doc comments explaining the fail-closed contract. `coerceWorkshopWebResearchSettings` and `workshopWebResearchSettingsEqual`, added directly beneath them, get none — a future reader skimming for "how do we validate a settings triple here" hits two documented examples and one undocumented one, side by side.

> *"We already fixed this exact revert-on-partial-failure bug in PR #83, in this exact file, nine lines above where it just happened again — like watching someone re-lay a landmine right next to the sign that says where the last one went off."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟠 High — Bounded web-search tool is offered on every persona turn, with no session-level spend or latency cap

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:697-702`

```ts
private workshopWebSearchTools(enabled: boolean | undefined): OpenRouterWebSearchTool[] | undefined {
  return enabled ? [{ type: 'openrouter:web_search', parameters: { engine: 'auto', max_uses: 2, max_total_results: 10 } }] : undefined;
}
```

Called from `startWorkshopPersonaConversation`, `startWorkshopGuestConversation`, and `continueConversation` — so it's attached to *every* host turn, guest turn, and continuation for the life of the room, driven by nothing but a boolean. No per-turn opt-out, no session counter, no budget. Searched the diff for a session-level cap or running-cost counter — not found.

The math: `max_uses: 2, max_total_results: 10` with `engine: 'auto'`. Per OpenRouter's published pricing, generic web-search billing is $4/1000 results — up to $0.04/turn at the ceiling — while the Parallel-Turbo path is ~$0.001/request for the first 10 results, ~$0.002/turn at 2 uses. Because `engine: 'auto'` leaves resolution to OpenRouter, the code can't even predict which it's paying per turn.

At N=1 turn this is a rounding error. At N=100 turns in a long multi-persona room — exactly what Workshop rooms are *for* — that's silent, undifferentiated spend of roughly $0.20 to $4, plus real wall-clock latency: two search round-trips is not free, and it's now stacked onto every exchange, not just the ones needing current information. That directly undercuts the responsive `conversational` mode this same PR is trying to preserve.

To be fair to the design: `TokenUsage.costUsd` (via `toTokenUsage`, reading `raw.cost`) does fold OpenRouter's total per-request cost — including tool charges — into the number already surfaced through `emitUsage`, so this isn't invisible to the money pipeline. But nothing distinguishes "this turn cost more because research fired" from ordinary token cost, and nothing bounds how many turns in a row pay the tax.

### 🟠 High — Reset effect now fires on every session-state broadcast [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:124-133`

Worth stating what is *not* the problem here: the render cost of the identity churn in isolation is nothing to worry about. This modal is unmemoized and re-renders on every `WorkshopApp` pass regardless, and the pre-existing `writerProfile` prop has the identical churn pattern via `getProfile()`'s own spread — it simply wasn't in the dep array.

The defect is what the *effect* does with that churn. At N=1 broadcast while closed: free. At N=1 broadcast while open, mid-edit: it's already the incident. You don't need scale for this one, you need the modal open during a live turn, which is an ordinary Workshop room. Drop `webResearch` from the array and diff its *value* via `workshopWebResearchSettingsEqual` — object-literal identity is not a substitute for value equality upstream of a dependency array.

> *"Two search calls times every turn in a growing room is not a rounding error, it's a metered API with the meter turned toward the wall — and an effect array keyed on a freshly-allocated object is just a scheduled amnesia attack with extra steps."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🔴 Blocking — Persisted citations bypass URL validation entirely [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts:399-401`

```ts
function assertCitation(value: unknown, path: string): void {
  const citation = exactObject(value, path, ['url'], ['title', 'startIndex', 'endIndex']);
  stringAt(citation.url, `${path}.url`);
```

The live path validates twice — `toUrlCitations` rejects anything failing `/^https?:\/\//`. But `assertCitation`, the gate for citations read back off disk, only checks `typeof url === 'string'`. `"not-a-url"`, `"javascript:alert(1)"`, `"file:///etc/passwd"`, and `""` all pass.

That matters because this isn't a throwaway parse — it's the shape validator for the persisted session state file, a trust-sensitive boundary: session docs survive reloads, get hand-edited during debugging, can be truncated by an interrupted write, and in a shared project can be committed and pulled by a teammate.

A corrupted citation with no title and a non-well-formed URL reaches `citationLabel`, whose `new URL(...)` throws a `TypeError` during render — uncaught, and only caught by the coarse region ErrorBoundary wrapping the whole thread pane. One bad citation in one turn takes down the entire conversation view.

Separately, a well-formed-but-non-http(s) URL that *has* a title skips the `new URL()` call entirely and lands straight in `href={citation.url}` with no scheme check. The CSP's nonce-only `script-src` likely blocks `javascript:` execution, but nothing stops `file://` or an arbitrary protocol handler being handed to VS Code's external-open flow. Give `assertCitation` the same `/^https?:\/\//` check the producer already has, and make `citationLabel` total.

### 🟠 High — A network capability is scoped like a personal profile setting

`apps/vscode-extension/package.json:408-424`

`webResearch` copies `"scope": "application"` from `proseMinion.workshop.writerProfile`. But they aren't the same kind of thing. `writerProfile` is inert data you author once; application scope for it means "my bio travels with me," which is reasonable. `webResearch` is a live switch determining whether manuscript excerpts, room context, and the writer profile get formulated into search queries and sent off-machine on every persona turn.

Application scope means User-settings-only — no workspace or folder override is possible — and it syncs to every machine via Settings Sync. Concretely: a writer turns this on for a low-stakes hobby project, then opens an embargoed manuscript or an NDA'd client project in a different workspace on the same or a synced machine. Research is silently already on, with no per-workspace way to turn it off. `conversationBehavior` deliberately has no `scope` override and stays window-scoped for exactly this reason. A capability deciding what leaves the machine should get at minimum `window` scope.

### 🟠 High — Disclosure names OpenRouter and cost, not the second destination for manuscript content

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:467-469`

> Persona conversations may search current web information when it helps. This can add latency and provider charges; Grok can also search X when supported.

Every user-facing description — the `package.json` description, this modal copy, and the notice-modal copy — frames the consequence as "OpenRouter" plus latency and cost. None say that the model formulates search queries seeded by conversation content that per this PR's own description includes manuscript excerpts, the About You profile, and room context, and that those queries execute against search infrastructure that is *not* the LLM provider the user already implicitly trusts. OpenRouter's `web_search` tool proxies to a third-party search backend for models without native search — that's a second data recipient, not a detail of "provider charges."

Compare the bar this codebase already sets: `writerProfile`'s description explicitly warns *"Stored globally; do not include sensitive information"* precisely because that data leaves the machine. `webResearch` creates a strictly larger exposure — not opt-in text carefully written once, but live conversation content turned into search queries every turn — and gets a weaker warning than the feature it's more dangerous than.

> *"You put a regex on the front door and left the disk-read path wide open — the attacker doesn't care which one you forgot, they just walk in through the other."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — Citation parsing failures are indistinguishable from "model found nothing"

`packages/core/src/infrastructure/api/providers/OpenRouterClient.ts:329-344`

`toUrlCitations` silently drops every annotation failing its shape check or the `https?://` test — no log, no counter. Searched the diff for any log statement in this function or its call sites — not found. The only `appendLine` added in the entire 1,469-line diff is the persistence-error branch in `WorkshopHandler`.

Walk the failure: the model returns prose with `[1] [2] [3]` markers plus three annotations. If OpenRouter emits a `url_citation` with a relative path, a non-`url_citation` type, or a shape OpenRouter changes upstream, that entry vanishes with `return []`. The user sees a reply with three markers and one or zero pills — a broken-looking, half-grounded answer. When they report "the citations were wrong," the author has nothing: no way to tell *"the model didn't cite anything"* (working as intended) from *"we're mis-parsing OpenRouter's payload"* (a real bug, possibly an upstream schema change). Log at debug level when `raw.length > 0` but the filtered result is shorter, including the annotation `type` values seen — enough to separate the two cases from a bug report alone.

### 🟡 Standard — The web-research setting reads and commits silently, unlike its writer-profile sibling [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts:247-252`

See Stan's write-up for the pr-83 lineage. Worth adding a second gap in the same file: the one commit log line for this service (`apply()`: `'[WorkshopConversationSettingsService] Conversation settings committed (mode=…, profileEnabled=…)'`) fires only when `behaviorChanged || profileChanged`. Because `webResearch` is applied *outside* `apply()`, a research-only toggle — the common case, since it's a standalone Advanced-tab switch — produces no log line at all, even on a fully successful persist. Add `researchEnabled=${nextWebResearch.enabled}` to the existing commit log.

### 🟡 Standard — No record that a persona turn ever requested web search

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:697-701`

Searched the diff for any log tied to attaching or using `openrouter:web_search` — not found. `workshopWebSearchTools` decides per turn whether to attach the tool, and the client passes it straight through, but nothing logs that it was attached, and nothing logs the finish reason or citation count when the response returns. The only observable side effect is the pills.

A user reports "the web research thing didn't work" with a screenshot. The Output Channel — this project's stated diagnostic surface per `AGENTS.md` — has nothing: no line confirming research was enabled for that turn, no line confirming the tool was sent, no citation count. The author is reduced to asking the user to re-enable a setting and try again while watching. One `appendLine` recording persona id, enabled state, and resulting citation count turns a guessing game into a two-line diagnosis.

> *"Three ways to fail — bad settings, no search, or dropped citations — and every single one of them fails the same way: silently. See you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🔴 Blocking — Making `webResearch` a required modal prop breaks the untouched sibling suite [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:95`

I ran the suite directly rather than guess — see Cal's section for the output. The point I'd add is about the *validation claim*: the PR description lists `npm run typecheck` and "Targeted Workshop/OpenRouter Jest tests (60 tests)." `packages/core/tsconfig.json` explicitly excludes `src/__tests__` from typecheck, and this pre-existing suite for the exact component being changed apparently wasn't in the targeted set. Both checks were honest; neither could see this.

### 🟠 High — Host tool-synthesis turn never gets `webResearch` — the settings service isn't even injected

`packages/core/src/application/services/workshop/RunWorkshopToolSidePass.ts:228`

The PR description claims it "threads the enabled state through Workshop host and guest turns." `workshopWebSearchTools` reads `streamingOptions.webResearch` at exactly three call sites, and `WorkshopHandler.ts` passes the setting into all three of *its* calls (guest ~line 700, continuation ~1083, new-persona ~1103).

But `RunWorkshopToolSidePass` — the class running the host's turn synthesizing a just-completed deterministic tool's report, `owner: { kind: 'host' }` — calls `continueConversation` (line 228) and `startWorkshopPersonaConversation` (line 233) with no `webResearch` option at all. Its constructor holds `writerProfileService` but no `WorkshopConversationSettingsService`, so this call site structurally *cannot* know the room's setting. That's a legitimate host turn by the PR's own language, and a user who flips the toggle would reasonably expect the host's tool-report synthesis to research too. Instead it silently never gets the tool, regardless of the setting.

### 🟠 High — New `webResearch` dependency wipes in-progress drafts and snaps the tab back [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConversationBehaviorModal.tsx:133`

See Blake's trace. The domain angle I'd add: the modal can be opened *while a run is active* — the Conversation Controller trigger isn't gated on `roomMutationLocked` — and `postSessionState()` is wired into the streaming-progress callback. So leaving the modal open during a streaming persona turn refires this effect on essentially every token. The deliberate contract a few lines below (*"the old mode stays visible"* until the next `WORKSHOP_SESSION_STATE`) says in-flight edits were meant to survive incoming prop updates.

> *"'Threads the enabled state through host and guest turns' — true for two of the three host code paths; the one where the host actually synthesizes a tool's report never got the memo. Technically correct. Whether it's correct correct is a different question."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Ask the Siblings Before You Move In

Illuminated by: Blake/Tim/Bria #1, Marcus & Stan #4, Patricia (scope + disclosure), Blake (last-turn citations), Stan/Oliver (logging), Marcus (service pattern)

Nearly every blocking finding here is the same shape: a third sibling added beside two existing ones, differing from them in a way nobody chose. `webResearch` gained a dep-array slot `writerProfile` was deliberately denied; it lacked the pending-persistence guard both peers carry; it inherited `scope: "application"` from a setting that never touches the network; `citations` was read off the last turn while `usage` and `usedGuides` — two lines above, in the same return literal — were accumulated. A cabinetmaker fitting a fourth door to a run of three doesn't measure from the wall; they measure from the doors already hanging. Existing siblings are not just precedent, they are accumulated decisions, and some of those decisions are scar tissue — PR #83 had already fixed #4 for the other two settings in that exact file.

→ Carry forward: When adding the Nth case beside N−1 existing ones, diff yours against a sibling line by line and write a one-word reason for every difference. If a difference has no reason, it's a bug in one direction or the other. And run `git log -p` on the sibling first — an *absence* in old code is often a fix you're about to undo.

### Lesson 2 — Green Is a Scope, Not a Verdict

Illuminated by: Cal, Bria #2, Cal (default-off untested), Cal (the fixture mock)

Two checks reported success over a red suite, and neither lied — `npm run typecheck` deliberately excludes `src/__tests__`, and a targeted 60-test run is by definition targeted. The danger isn't a false green; it's a true green whose scope you've quietly stopped tracking, so its confidence spends further than it earns. The same drift runs deeper into the tests themselves: the enabled path is asserted, the default-off path is only a comment and a JSON default; and a `settings.get` stub that returns the behavior fixture for any key will answer every question the same way, which makes it a yes-man, not a witness. A test that cannot fail is a decoration in the shape of a proof.

→ Carry forward: When you cite a passing check as validation, say in the same breath what it structurally *cannot* see — and before merging, run the unscoped thing once. Then for each new branch ask: "which assertion goes red if I invert this condition?" If the answer is none, you've tested the presence of a feature, not its behavior.

### Lesson 3 — A Field's Invariant Is Its Weakest Gate

Illuminated by: Sam, Patricia, Blake #3, Oliver

Two validators guarded `citation.url`; the producer enforced `^https?://`, the persisted-load path checked only `typeof === 'string'`. When one field has two gates, its real invariant is whichever gate is weakest — and the weak one is almost always on the path you think of as "ours." Data on disk is data from a stranger: past-you wrote it, but past-you had different bugs. Note too that even the strong gate was shape-checking, not parsing — `"https://"` satisfies the regex and still throws in `new URL()` — which is how an unguarded `new URL()` inside a render function takes down an entire conversation, permanently, from a bad row on disk. And when a boundary does reject something, silence is its own defect: Oliver's bare `return []` makes "the schema changed upstream" indistinguishable from "nothing was found."

→ Carry forward: For any field with more than one entry path, list every path and validate at the weakest, not the friendliest. Prefer parsing over shape-checking — construct the real object at the boundary and carry *that* inward, so no render function is ever the first code to learn the value was malformed. And when you drop something, log that you dropped it.

### Lesson 4 — A Toggle Is a Doorway, Not a Preference

Illuminated by: Patricia (scope + disclosure), Tim (no budget), the feature's framing

This setting was built with the ergonomics of a preference — copied scope, copied coercer shape, copied UI slot — but what it actually does is open a door in a wall. Once it's on, manuscript excerpts and the writer profile leave as search queries to infrastructure beyond the LLM provider, unmetered, for the life of the room. Every knob that changes *who is in the room* or *what the room costs* needs three things a cosmetic preference doesn't: a scope that matches the blast radius (`application` means a hobby-project toggle is already on when the NDA'd manuscript opens elsewhere), a disclosure naming the second recipient rather than the invoice, and a ceiling. Telling a user "this may add latency and cost" when the true consequence is "your draft becomes a search query" isn't understatement — it's the wrong sentence entirely.

→ Carry forward: Before shipping any user-facing toggle, finish this sentence in plain words: "When this is on, ______ can now see or spend ______, until ______." If the answer names another party, a recurring cost, or has no natural end, the design isn't done — scope, warning text, and budget all need to say so.

> *"Code written beside other code is always in conversation with it, and most bugs are simply the moment it stopped listening."* — Sensei

---

## The Closer

### 🔮 Fortune Cookie

*You built a door to let the world in, and forgot that doors swing both ways.*

---

## Summary

This is a well-shaped feature with a genuinely careful spine — the setting is default-off, the tool config is deliberately bounded, deterministic Workshop tools stay offline, citations get a normalized type and a persisted shape, and the `SETTING`/`coerce`/`equal` triple follows the house pattern faithfully. The intent is right and most of the plumbing is right with it.

It is not merge-ready. Four blocking issues stand: `npm test` is red on two suites (verified, not inferred); the modal's new effect dependency silently destroys in-progress user drafts; a malformed persisted citation permanently takes out the entire conversation pane; and the web-research setting skips the pending-persistence guard that PR #83 added to this exact file for exactly this failure. Three of those four were flagged independently by two or three reviewers, which is the strongest signal this panel produces.

The through-line worth sitting with is Sensei's first lesson: almost every serious finding is a third sibling that quietly differs from the two beside it. Fix the four blockers, thread `RunWorkshopToolSidePass`, accumulate citations across turns, and revisit the scope and disclosure on what is — despite its "preference" ergonomics — a network capability. Then this ships well.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
