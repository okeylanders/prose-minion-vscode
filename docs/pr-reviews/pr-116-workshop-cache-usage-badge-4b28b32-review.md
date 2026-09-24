# PR Review — Show reported cache usage on Workshop responses

**Author:** okeylanders · **PR:** [#116](https://github.com/okeylanders/prose-minion-vscode/pull/116) (Open)
**Branches:** `feat/workshop-cache-usage-badge` → `main`
**Base:** `e8b8185` · **Head:** `4b28b3294b7a3947a1d8f26ac10584cef266d440` · **Scope:** 13 files · +243 / −15 · 1 commit
**Reviewed:** 2026-09-24 · **Mode:** quick single-reviewer read (Ada Forge). No reviewer subagents were launched.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **N/A** = praise or not actionable · **Decision** = needs Okey's call.

| ID | Sev | Finding | Verdict | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | `DictionaryService.generateParallelDictionary` rebuilds usage from four fields and drops `cachedTokens`/`cacheWriteTokens`. A persona turn that runs the parallel dictionary sidecar therefore loses its cache badge, even when every provider call reported cache details | 🔎 Traced | **Open** |
| F-02 | 🟡 Standard | Sessions saved by this build contain `usage.cachedTokens`. v2.5.0's `exactObject` validator rejects unknown keys, so a writer who rolls back to the Marketplace build cannot open sessions saved by this build | 🔎 Traced | **Decision** |
| F-03 | 🔵 Nit | `aria-label` on a role-less `<span>` is not reliably announced (ARIA 1.2 disallows naming the generic role). The label also omits the write count and the "of N prompt tokens" detail that the `title` carries | — | **Open** |
| F-04 | 🔵 Nit | The epic and sprint remain in `.todo/epics/` with one unchecked criterion (narrow editor-tab legibility). That is correct if the check is still pending; record the model and response fields when you run it | — | **Open** |
| F-05 | 🟢 Praise | All-or-nothing aggregation in `addUsage` keeps an unreported call from being shown as a cache miss. The comment explains why, and a test covers it | — | N/A: keep |
| F-06 | 🟢 Praise | Absent and zero stay distinct end to end: the client parser only accepts non-negative safe integers, the persisted shape re-validates, and the UI shows `0 cached` for an explicit zero and nothing for absent | — | N/A: keep |
| F-07 | 🟢 Praise | Scope discipline: the context bar is left alone, and the ADR note explains why it still means window occupancy | — | N/A: keep |

---

## Verification actually run

| Check | Result |
| --- | --- |
| Local branch matches the PR head (`4b28b32`) | ✅ |
| `npm ci`, then the 4 touched Jest suites (`AgentRunEngine`, `WorkshopPersistedSession`, `OpenRouterClient`, `WorkshopTurnBubble`) | ✅ 4 suites / 116 tests passed (matches the PR description) |
| Full suite, typechecks, lint, build | ❌ Not run here. This review relies on the PR's stated results |
| Live OpenRouter response / narrow editor-tab visual check | ❌ Not performed |

---

## Executive briefing

This change is small, well-bounded and honest. Provider-reported cache counts go through one parser (`OpenRouterClient.toTokenUsage`), which handles both streaming and non-streaming usage. They are summed at the one place where a logical response's calls are combined (`AgentRunEngine.addUsage`), cloned by spread into Workshop turns, validated at the persistence boundary, and shown in the turn header. I found no correctness bug in the numbers the badge shows. When the badge appears, its value is right.

The two Standard findings are about when the badge disappears (F-01) and what happens to saved sessions if the writer rolls back to v2.5.0 (F-02). Neither blocks merge on its own. F-01 is a small fix in this PR's domain. F-02 is a policy call.

---

## Findings

### F-01 🟡 Parallel dictionary sidecar drops cache fields, which hides the badge for the whole turn

`packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts:550-614` rebuilds a fresh `TokenUsage` from `promptTokens`, `completionTokens`, `totalTokens` and `costUsd`. Its block results come from the same `OpenRouterClient`, so after this PR they carry `cachedTokens`/`cacheWriteTokens`. The aggregate throws them away.

Path to the writer:

```
WorkshopPersonaCapability (≈L501) → dictionaryService.generateParallelDictionary(...)
  → fulfillment.usage = entry.usage            // no cache fields
AgentRunEngine L430: totalUsage = addUsage(totalUsage, fulfillment.usage)
  → cachedTokens: total defined && usage undefined → undefined
WorkshopTurnBubble: turn.usage.cachedTokens === undefined → no badge
```

This is the honest failure direction: the badge hides instead of showing a false number. The result is still wrong. The persona's own calls reported caching and the writer sees nothing. The streaming single-lookup path (`lookupWordStreaming`) passes usage through unchanged, so only the parallel path is affected.

**Suggested fix:** in the aggregate loop, apply the same all-or-nothing rule as `addUsage`. Track `cacheReportedByAll` and sum only while every block's usage reports the field. A shared `sumReportedTokens(a, b)` helper next to `TokenUsage` would stop the rule from drifting between the two aggregators. Add one case to the dictionary service tests.

### F-02 🟡 Rolling back to v2.5.0 would reject sessions saved by this build (Decision)

`assertTokenUsage` uses `exactObject` (`persistedValidation.ts:43`), which rejects keys outside the allow-list. Adding `cachedTokens`/`cacheWriteTokens` to the allow-list is correct for this build, and old sessions still load (sprint criterion ✅). The codec is closed in both directions, though. Once this ships, v2.5.0 treats any saved turn with a cache count as malformed.

ADR 2026-07-30 does not discuss rollback, and it says a version bump is needed only when prior shapes become invalid or semantics change. Neither applies here, so **no `schemaVersion` bump is needed.** The open question is only whether you care about rollback:

- **Accept (likely right for alpha):** add a sentence to the codec ADR or changelog stating that sessions are forward-only across releases.
- **Harden later:** have the token-usage shape (and possibly other leaf records) ignore unknown numeric fields. This weakens the strict boundary, so it should be its own ADR, not part of this PR.

### F-03 🔵 `aria-label` on a generic span

`WorkshopTurnBubble.tsx:397`. Many screen readers ignore an `aria-label` on a role-less `span`, and ARIA 1.2 marks naming the generic role as prohibited. In practice the visible text `2,400 cached` is what gets read, and that text is adequate. Two options: drop `aria-label` and rely on the visible text, or put a visually hidden `<span>` with the full sentence (read and write counts) next to it. The test currently asserts the `aria-label` string. Update the test if you change this.

### F-04 🔵 Sprint bookkeeping

The sprint's last criterion (narrow editor-tab legibility and accessibility) is unchecked, and the "Manual proof" section notes the evidence gap. That is honest. When you do the check, record the model id and one sample `prompt_tokens_details` payload, redacted if needed, so the ADR's later context-bar slice has a real fixture to work from.

---

## Things I checked and found fine

- **Streaming and non-streaming normalization** share `toTokenUsage`, and the tests cover both.
- **Workshop turn cloning** uses `{ ...usage }` (`WorkshopSessionService.ts:1307/1379/1577`), so the new fields survive without codec work beyond the allow-list.
- **Estimated or cancelled usage** has no cache fields, so the badge hides. Correct.
- **`requestCount`/`costUsd` semantics** are unchanged. `isEstimate` is still dropped by `addUsage` for multi-call turns, but that behavior predates this PR.
- **CSS:** `--pm-ok` has the same `#6fc98a` fallback as its existing uses at L1206-1208. `flex-wrap` on `.pm-ws-turn-head` plus `margin-left: auto` on the group wraps cleanly without reordering the header. The hit state is not color-only, because the count text carries the meaning.
- **Tooltip wording:** "N of M prompt tokens read from provider cache" still holds for multi-call turns, because both N and M are sums over the same calls.

---

## Report card

| Dimension | Grade | Note |
| --- | --- | --- |
| Correctness | A− | Numbers are right; F-01 hides a badge that could be shown |
| Contract / persistence | B+ | Additive and validated; rollback stance undeclared (F-02) |
| Tests | A | They test behavior: absent vs zero, partial aggregation, round trip, negative rejection |
| Accessibility | B | Visible text works; `aria-label` doesn't do what it looks like (F-03) |
| Scope discipline | A | Observes caching without changing it |

**Verdict:** Approve once F-01 is fixed, or once it is tracked if you'd rather ship now. F-02 needs a one-line decision. F-03 and F-04 can go in whenever convenient.

> *The cache badge is an honest witness: it keeps silent rather than guess. Now we just need the dictionary to stop tearing up its evidence.*
