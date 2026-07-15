# MR Review — feat(workshop): add bounded persona file access

**Author:** okeylanders · PR #77 · base `epic/workshop-editor-tab` ← `sprint/workshop-editor-tab-11-persona-file-access`

Reviewed by a 10-persona panel + Sensei. Draft PR; Sprint 11 of the Workshop epic — the capability boundary learns to read the writer's shelves.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | A filename/label search hit silently suppresses all content search across the group — result still says `success`, and neither persona nor writer is told prose was never scanned | Sam, Bria | 🎯 | **Open** — decide the semantics explicitly; at minimum surface the mode + a follow-up path, and pin the cross-file suppression case in a test |
| 2 | 🟠 High | CRLF files: `bytes` measured on the LF-rejoined window vs `totalBytes` on the raw file — a complete read renders as "X of Y bytes read" partial | Sam | — | **Open** — compute both numbers on the same basis |
| 3 | 🟠 High | Read-truncation recount (`returnedLineCount`/`endLine`) tested only with one unbroken line — a "Lines: X–Y of Z" provenance regression passes CI | Cal | — | **Open** — add multi-line + CRLF truncation fixtures |
| 4 | 🟠 High | Fail-closed `catch` in the symlink-ancestor walk has zero coverage — a fail-open regression would silently admit paths to the model-visible catalog | Cal | — | **Open** — add a stat-throws fixture |
| 5 | 🟠 High | Byte budgets bound the *output*; nothing bounds the *input* — whole-file read/decode/split before any cap, plus a full re-encode in `sliceUtf8`; no stat-size pre-guard | Tim | — | **Open** — cheap `stat().size` pre-bound + `Buffer.byteLength` check before `Buffer.from` *(filed Blocking; normalized to High — traced consequence is latency/memory pathology, not corruption)* |
| 6 | 🟡 Standard | ~15 op-specific metadata keys ride an untyped `Record<string, unknown>` across three layers; two readers duck-type them back out — renames vanish silently instead of failing the build | Marcus, Parker | 🎯 | **Deferred** — typed per-operation union + per-family row formatters; no correctness gap today, do it before a third duck-typed reader appears |
| 7 | 🟡 Standard | Codec reimplements path-safety (`isSafeResourcePath`) in parallel with `pathContainment.ts` — one trust decision, two independently-tested owners | Marcus | — | **Deferred** — consolidation refactor; the resolver gate is still the real barrier, nothing unguarded today |
| 8 | 🟡 Standard | Landing on exactly the 20-match cap sets `truncated: true` + "may not have been shown" even when nothing was omitted; `status`/`truncated` semantics differ across the three catalog/search paths | Sam | — | **Open** — cheap boundary fix (strict `<` against a known total, or probe-one-more) |
| 9 | 🟡 Standard | Four capability dispatchers share an if-chain shape but not the same implicit final case; none call `assertNever` | Parker | — | **Open** — mechanical switch + `assertNever`, same as `dispatch()` two pages up *(filed High; normalized to Standard — no wrong behavior today)* |
| 10 | 🟡 Standard | New artifact-mapping switch in `WorkshopSessionService` skips the `assertNever` default this same PR writes twice elsewhere | Stan | — | **Open** — two-line default arm |
| 11 | 🟡 Standard | Codec comment claims parity with `ResourceReadXmlCodec`, but the sibling gates preamble by *length* (500 chars, content-blind) while the new codec gates by *content* (`<`/`>`) | Stan | — | **Open** — fix the comment to describe the actual (stricter) behavior; Patricia verified the divergence is in the safe direction |
| 12 | 🟡 Standard | Per-turn O(N×D) uncached ancestor-stat discovery; provider memoized per turn only; all 8 groups rediscovered per request | Tim | — | **Deferred** — matters at catalog scale (N≈1200 → seconds); memoize stats by ancestor dir + cache provider per session *(filed High; normalized to Standard — sub-second at today's N)* |
| 13 | 🟡 Standard | TOCTOU between catalog-build symlink check and later same-turn read — no re-stat before `readFile` | Patricia | — | **Deferred** — theoretical under this threat model (a prompt injector has words, not filesystem writes); re-stat is free when next touching the resolver |
| 14 | 🟡 Standard | Anchors survive the DOMPurify html profile — click-gated exfil channel remains (the passive image beacon is closed) | Patricia | — | **Deferred** — not a regression; consider an anchor/URI policy as a deliberate UX+security decision |
| 15 | 🟡 Standard | Redacted catalog-miss log carries zero attributable signal; the one caller for which it's load-bearing is the pre-existing `ContextFileCapability` path | Oliver | — | **Open** — log catalog size (already in scope, zero security cost) |
| 16 | 🟡 Standard | `availability()` exception and true-zero-catalog produce byte-identical "unavailable" instructions — diagnosis is absence-based log matching | Oliver | — | **Deferred** — diagnosable via requestId-keyed line; add distinct wording opportunistically |
| 17 | 🟡 Standard | Immutable `base.md` claims unconditional resource access; only the per-turn instruction is catalog-aware — prompt honesty rests on the later message winning | Bria | — | **Open** — one-line wording change ("when the turn contract advertises them") |
| 18 | 🟡 Standard | Instruction advertises two proactive research workflows (continuity + six-group bible search) inside a shared 3-call budget with no prioritization guidance | Bria | — | **Deferred** — model-behavior tuning; observe live sessions before re-wording |
| 19 | 🟢 Nit | Dead `Math.min(Number.MAX_SAFE_INTEGER, …)` guard for a case made impossible two lines earlier | Parker | — | **Open** — delete or comment the invariant |
| 20 | 🟢 Praise | Resource-provider port is textbook ports-and-adapters: domain owns the interface, infrastructure adapts inward, composition root injects | Marcus | — | **N/A** |
| 21 | 🟢 Praise | Resolver reuses `isPathWithinRoot` + ancestor symlink walk instead of minting a competing containment primitive | Stan | — | **N/A** |
| 22 | 🟢 Praise | Beacon-markdown/CSP rejection coverage is exact — negative assertions on both surfaces | Cal | — | **N/A** |
| 23 | 🟢 Praise | Every evidence field XML-escaped before entering the model prompt; codec relaxation provably stricter than its sibling; quoted-excerpt injection test unchanged and passing | Patricia | — | **N/A** |
| 24 | 🟢 Praise | Single fulfillment log line (searchMode, counts, bytes, truncated, keyed by requestId) answers the 2am "search came up empty" question outright | Oliver | — | **N/A** |

---

## Blast Radius

- **35 files changed · +2,102 / −105**, 3 commits
- New files: **3** — `WorkshopResourceCapability.ts` (450-line capability service), its 295-line test suite, and a memory-bank completion record
- New capability operations: **3** (`resource.catalog` / `resource.search` / `resource.read`) · new artifact kinds: 3 · new domain port: `ContextResourceProviderFactory` · new engine hooks: `handleInvalidRequest` / `handleCapabilityLimit`
- New dependency: `dompurify` (shared renderer sanitization) · webview CSP `img-src` drops bare `https:` · new budgets namespace `PROMPT_BUDGETS.workshopResource` (10 ceilings, honoring the Sprint 06C invariant)
- DB migrations: none (VS Code extension). Diff exceeds ~800 lines — agent context was weighted to the load-bearing files (`WorkshopResourceCapability.ts` +450, `WorkshopCapabilityXmlCodec.ts` +221, `WorkshopPersonaCapability.ts` +200, resolver/renderer/CSP).
- Character: security-first feature work where the boundary held everywhere the panel pushed. The soft spots are provenance honesty at the edges — byte counts, truncation flags, search-mode visibility — and the two fail-safe paths that ship untested.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | B |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | C |
| 🎯 Domain | C |

---

## Executive Briefing

🔴 **None.** Blake traced the codec preamble relaxation, the containment stat-walk, the read/search window math, and the engine artifact hooks end to end and filed nothing: *"the boundary fails closed, the parser is caught, and nothing here is going to page me."*

🟠 **[Sam · Bria 🎯 Consensus]** Filename match cancels content search — one file named `raven.md` means chapters mentioning Raven in prose are never scanned; the result says `success` and nobody is told. The ticket promised "term/phrase search across one group or all groups."

🟠 **[Tim]** The budgets bound the receipt, not the work — whole files are read, UTF-8-decoded, and line-split before any byte cap applies, and `sliceUtf8` re-encodes entire contents just to measure them; no stat-size pre-guard exists.

🟠 **[Sam]** CRLF provenance — a complete read of any Windows-authored file reports `bytes < totalBytes` with `truncated: false`, rendering in the UI as a partial read.

🟠 **[Cal]** The two promised fail-safe behaviors — the truncation recount and the symlink-walk fail-closed catch — are the two places with zero test coverage; regressions in either pass CI silently.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — Untyped resource metadata rides three layers with no shared contract [🎯 Consensus with Parker]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:94` — `WorkshopCapabilityResult.metadata` is a pre-existing `Record<string, unknown>`, but this PR is what stress-tests it: `WorkshopResourceCapability` stamps in roughly 15 operation-specific keys (catalog: `group`/`fileCount`/`matchingFiles`/`truncated` · search: `searchMode`/`catalogEntriesScanned`/`filesScanned`/`bytesScanned`/`matchCount` · read: `startLine`/`endLine`/`totalLines`/`bytes`/`totalBytes`/`windowBytes`), each shape implicit in the object literal that builds it. Two independent readers then duck-type the same keys back out with `typeof` guards: `resultLogSummary` in the application layer and `capabilityMetadataRows` in presentation. Nothing throws today — every read is defensively guarded — so a field rename means a UI row or log field silently vanishes rather than the build catching it. `capability`/`searchMode` already give this data a natural discriminant; a typed union would let presentation switch exhaustively instead of guess. Parker's complementary remedy: split the flat row function into per-family formatters so each function's rows are visibly scoped to one capability.

### 🟡 Standard — Path-safety validation reimplemented in the codec beside the established containment boundary

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:417` — `isSafeResourcePath` rejects traversal/absolute/URI/backslash paths using raw `path.posix`/`path.win32` checks the codec invented for itself, while `pathContainment.ts` exists to own exactly this threat model (its docstring names the prompt-injected `../../etc/passwd` case) and the sprint doc's test plan says containment tests should "extend `pathContainment` suites." Searched the diff for `pathContainment`/`isPathWithinRoot` in the codec — not found; the codec ships a second, parallel test table instead. The resolver's gate is still the real barrier before any byte is read, so nothing is unguarded today — but the same trust decision now has two independently-implemented, independently-tested owners, and the next evasion fix only has to be remembered in one of them.

### 🟢 Praise — Resource-provider access is a clean domain port with infrastructure adapting inward

`packages/core/src/domain/models/ContextGeneration.ts:39` — Domain owns `ContextResourceProviderFactory`; infrastructure's `ContextResourceResolver` implements it; application depends only on the domain-typed port and never imports the concrete resolver; the composition root is the sole place that names the concrete class. No layer reaches sideways or outward. This is the shape the rest of the resource-access surface should be judged against, and it holds.

> *"The dependency arrows all point the right way here — it's what travels along them, a path checked twice by two strangers and metadata typed by no one, that still needs proper documentation."* — Marcus

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — A filename/label match silently hides every content match elsewhere [🎯 Consensus with Bria]

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:127` — In `search()`, when any configured file's path or label tokenizes to overlap the query's non-stop-word terms, `catalogMatches.length > 0` returns catalog-only matches immediately — the content-scanning loop is never reached for any file, matched or not. A search for "Raven" when `characters/raven.md` exists returns only "Matched configured path or label term(s): raven" and never touches chapter prose. Status is `success` whenever the hits fit the budget, and `searchMode: 'catalog'` in metadata is the only machine-readable signal that no file body was opened. Bria anchors the product side: the ticket's Locked Decisions promise "term/phrase search across one group or all groups," and the instruction text says search checks names *"before"* file contents — it never says a name hit *cancels* content scanning, and the model has no parameter to force content mode. The added test confirms `loadResources` is deliberately skipped in catalog mode, but no test pairs a name-matching file with a genuine content-only match in a different file, so the cross-file suppression is unpinned. Decide the semantics explicitly; at minimum, say the mode out loud in the result and give the persona a follow-up path.

### 🟠 High — CRLF files make "bytes read" look partial on a full, untruncated read

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:303` — `loadResources` performs no CRLF normalization (searched the diff for line-ending handling — not found). `read()` splits on `/\r?\n/`, stripping every `\r`, and rejoins the selected window with bare `\n` — so `bytes`/`windowBytes` measure a string systematically shorter than the source by the file's `\r` count, while `totalBytes` is computed from the untouched raw content. For any CRLF file with more than one line, reading the *entire* file (`Lines: 1–N of N`, `truncated: false`) still reports `bytes < totalBytes`, and `WorkshopTurnBubble` renders that pair as "X of Y bytes read" — a partial-read claim on a complete read. The test diff contains zero `\r` fixtures. Compute both numbers on the same basis.

### 🟡 Standard — Content search claims "may not have been shown" when nothing was left out

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:206` — The content loop stops the instant `matches.length` hits the cap without checking whether another match exists, then sets `truncated` via `matches.length >= budgets.searchMatches` unconditionally — landing on exactly 20 matches flags `truncated: true` and appends "Search results were bounded; additional configured matches may not have been shown" even when the scan was exhaustive. Contrast `catalog()` and catalog-mode search, which both use strict `<` against a fully-known total and get the boundary right. Meanwhile `status` is computed independently (`filesScanned < matchingResources.length`), so the same result object can say `success` and "bounded" at once. The exact-cap case has no test and no assertion on `status`. *(Filed High; normalized to Standard at compile — narrow trigger, hedged user-facing text, cheap fix.)*

> *"Found the trap door: ask for exactly twenty mentions of Raven and the capability hands over all twenty while insisting, in the very same breath, that some might be missing."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — Four capability dispatchers share an if-chain shape but not a fallthrough case

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:512` — `statusMessage`, `statusTicker`, and `requestLogSummary` each check `analysis.run`, then `dictionary.*`, then the resource ops, letting the bare final `return` implicitly cover `resource.read`. `requestSummary` checks everything else explicitly and lets its final `return` implicitly cover `analysis.run` — the one case its three siblings never leave implicit. A reader pattern-matching across the four will misidentify what the last line covers three times out of four, and none of them call `assertNever`, so a 7th capability won't force a compile error. Simpler: switch on `request.capability` with one explicit case per operation and `default: return this.assertNever(request)` — exactly like `dispatch()` two pages up. *(Filed High; normalized to Standard at compile — no wrong behavior today, and the fix is mechanical.)* Also see Marcus's consensus finding on the metadata readers — Parker's remedy there: per-family formatters so each function's rows are visibly scoped to one capability.

### 🟢 Nit — Dead `Number.MAX_SAFE_INTEGER` guard in read()'s default-window math

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:291` — By this point `startLine` has already passed `if (startLine > totalLines) return failure`, so it's bounded by a real file's line count — nowhere near 2⁵³. The `Math.min` can never select its first argument; it reads like overflow protection for a scenario the code made impossible two lines earlier. Write `startLine + budgets.readDefaultLines - 1`, or state the invariant in a comment instead of encoding it as arithmetic that never fires.

> *"Four sibling dispatch methods share the same if-chain shape but not the same fallthrough case, so pattern-matching across them teaches you the wrong lesson three times out of four — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — Read truncation math never exercised against multi-line content

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:299` — The suite proves the default window, explicit inclusive windows, and that the 64KiB ceiling truncates and reports `truncated: true` — but the only byte-ceiling test feeds `'a'.repeat(readBytes + 50)`, a single unbroken line, so `sliced.content.split(/\r?\n/).length` is trivially 1 no matter whether the recount is right, and that test never asserts `startLine`/`endLine`/`totalLines`. A regression in the `returnedLineCount`/`endLine` recompute would silently misreport the "Lines: X–Y of Z" provenance shown to the writer — breaking the sprint guardrail that "truncation is stated, never silent" — and pass CI clean. CRLF content, `startLine == totalLines`, and `sliceUtf8`'s multi-byte U+FFFD-strip behavior are equally unpinned. Searched the test diff for CRLF, FFFD, and multi-line-plus-readBytes fixtures — not found.

### 🟠 High — Fail-closed catch in the new symlink-ancestor walk has zero coverage

`packages/core/src/infrastructure/context/ContextResourceResolver.ts:242` — The suite proves the walk rejects a symlinked intermediate directory and a lexical-traversal match — solid coverage of the sprint's containment checklist. But the `catch` branch (stat throwing on a broken symlink, permission error, or racing deletion) is never triggered: the fake filesystem's throwing stat fallback is never reached by any candidate in the one test that models an unreadable path. A regression flipping this catch to fail *open* — a plausible "let it through if we can't classify it" mistake — would let unclassifiable paths into the model-visible catalog undetected, undermining the acceptance criterion that containment violations "die at containment… exfiltrate nothing." Searched the test diff for "Skipped unreadable" and a rejected/thrown stat — not found.

### 🟢 Praise — Beacon-markdown rejection coverage matches the acceptance criteria exactly

`apps/vscode-extension/src/__tests__/application/providers/webviewHtml.test.ts:86` — Rejection-path coverage done right: the CSP test asserts the policy literally *lost* `https:` (not just gained `data:`) on both surfaces in one loop, and `MarkdownRenderer.test.tsx` backs it at the DOM level — script/img/svg-image/inline-style/onclick/javascript-href all proven stripped, plus the parser-failure fallback proven sanitized instead of dropping to raw HTML. Exactly the loop the sprint flagged as pulled forward from the epic gate, closed with exact-string and negative assertions.

> *"The byte ceiling and the symlink catch block are the two places this feature promised to fail safely under pressure, and they're the two places nobody applied any."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — New capability-artifact switch skips the assertNever guard this PR uses twice elsewhere

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:489` — See how `WorkshopResourceCapability.ts` closes its capability switch with `default: return this.assertNever(request)` and `WorkshopPersonaCapability.ts` does the same — both new or touched in this very diff; that's the established idiom for an exhaustive switch over the closed capability union. `recordCapabilityArtifact`'s new switch over the identical six-member union has no `default` arm: exhaustiveness is enforced only by TypeScript's inference colliding with the annotation. That protects today's statically-typed callers, but unlike its siblings it has no runtime guard — if the switch and union drift, it fails by quietly producing `undefined` for a required field instead of throwing like its siblings do. Grepped the diff: `assertNever`/`default:` appear only in the two capability services.

### 🟡 Standard — Preamble check doesn't match the ResourceReadXmlCodec behavior its own comment cites

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:155` — The comment says the relaxation matches "the established ResourceReadXmlCodec behavior." The sibling never inspects preamble *content* — it slices from the marker and parses the tail unconditionally ("a valid tail call is accepted regardless of preamble length"), with a 500-char *length* heuristic used only to classify malformed tails. The new codec gates on *content*: any `<`/`>` in a non-fence preamble rejects as `mixed-content`, with no length fallback. Concretely: benign narration like "if x < y then…" ahead of a well-formed call is rejected here but accepted by the sibling, and there's no long-preamble "treat as prose" reclassification. Patricia verified the divergence is in the *safe* direction — but the comment will send the next person debugging a rejected call straight to `ResourceReadXmlCodec.ts` expecting identical behavior, and it isn't there. Grepped the diff for `MAX_TOLERATED_PREAMBLE_CHARS` — never reused. Fix the comment to describe the actual, stricter contract.

### 🟢 Praise — Symlink/traversal guard reuses pathContainment's isPathWithinRoot instead of reinventing it

`packages/core/src/infrastructure/context/ContextResourceResolver.ts:222` — `isSafeWorkspaceResource` imports and calls `isPathWithinRoot` directly rather than hand-rolling a second `path.relative`/`..` check — exactly the containment idiom that file exists to centralize, paired with the added ancestor-chain symlink stat loop. Easy to miss in a 2,100-line diff, and exactly the kind of reuse that keeps this boundary trustworthy.

> *"We wrote assertNever twice in this very diff and then let a third switch slip out the back without it."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟠 High — read()/search() decode and split the whole file before any byte cap runs

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:273` — `loadResources` always reads and UTF-8-decodes the entire target file; `read()` then splits the whole content into lines before `startLine`/`endLine` windowing or the 64KiB cap ever run. `search()`'s content fallback does the same full-load for up to 100 candidates, and `sliceUtf8` re-encodes each one's *entire* content via `Buffer.from` just to check it against a 256KiB cap. Searched the diff and the resolver for a pre-read size guard (`stat().size`, MAX_FILE_SIZE) — not found: all four byte budgets gate the *output*, none gate the *source read*. The math: a 2MB single-file manuscript entry (~350k words — squarely this app's use case) costs a 2MB read + decode + ~40k-line split to serve a 400-line/~20KB window, ~100× overshoot, repeated on every call since there's no content cache; a pathological 500MB glob catch costs ~1GB of transient allocation to extract a 256KB prefix. Cheaper shape: reuse the stat already taken during discovery to skip/pre-bound oversized files before `readFile`, and have `sliceUtf8` check `Buffer.byteLength` (no allocation) before paying for the full encode. *(Filed Blocking; normalized to High at compile — the traced consequence is latency/memory pathology on oversized inputs, not corruption or an exception.)*

### 🟡 Standard — Uncached O(N×D) ancestor-stat discovery reruns on every resource-touching turn

`packages/core/src/infrastructure/context/ContextResourceResolver.ts:235` — `isSafeWorkspaceResource` stats every path segment of every glob match sequentially with no shared-ancestor memoization, and `provider()` always rediscovers all 8 groups regardless of the request's single group. `providerPromise` is scoped to one per-turn capability instance, and the handler builds a fresh capability on every host message send — so discovery reruns on turn 1 via `appendContract → availability()`, and again from scratch on any later resource-touching turn, which `base.md`'s new "proactively look through configured resources" instruction makes the expected case. At N=150 files, D=3: 450 sequential stats — fine. At N=1,200, D=5 (a multi-book series with per-scene files): 6,000 sequential awaits — low-single-digit seconds of pure discovery latency, several times per session. The shape is what's wrong, not today's number. Cheaper: memoize stat by unique ancestor directory (O(uniqueDirs+N)) and cache the provider for the session, not the turn. *(Filed High; normalized to Standard — sub-second at today's realistic N, and repeat-frequency is model-dependent.)*

> *"Every cap in this PR bounds what the model receives, not what the disk and the UTF-8 codec pay to produce it — at 500MB or 6,000 stat calls, that gap is the whole finding."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — Read-time TOCTOU on the new symlink containment check

`packages/core/src/infrastructure/context/ContextResourceResolver.ts:222` — `isSafeWorkspaceResource` runs once per turn at catalog build; `loadResources` later reads the memoized path with no re-stat, and a turn can span multiple LLM round-trips, so the check-to-read gap is real rather than instantaneous. Practical vs theoretical: exploiting it needs an actor with independent filesystem write access racing the extension's own turn — nothing in this diff gives a prompt-injection attacker (text only) that capability, and the stated threat model is single-user/local. Theoretical under the actual attacker model, not a live hole — but the docstring's claim is scoped to catalog build, not to every later read of that key, and a re-stat immediately before `readFile` closes the gap for free.

### 🟡 Standard — Anchor tags survive sanitization; click-through exfil remains

`packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx:21` — `FORBID_TAGS` closes the passive auto-load beacon this PR targets, but the DOMPurify html profile still permits `<a href>`, and no `ALLOWED_URI_REGEXP` or anchor restriction was added (grepped the diff — not found). Injected file content that a persona echoes as a markdown link renders as a live, clickable link carrying whatever the persona was steered into embedding. Weaker, click-gated cousin of the fixed image-beacon risk — and not a regression, since the pre-PR renderer had no sanitization at all. Residual to close as a deliberate policy decision, nothing to block on.

### 🟢 Praise — Resource evidence is XML-escaped, and the preamble relaxation doesn't reopen disguised-call injection

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:548` — Every field of the result (content, requestSummary, metadata, error) runs through `escapeXml` before concatenation into `<workshop-capability-result>`, so a configured file containing a literal `<prose-minion-tool-call>` payload reaches the model as inert entities, not live markup. The codec's narration tolerance still hard-rejects any preamble containing `<`/`>` outside a bare fence — provably *stricter* than the sibling codec it cites — and the pre-existing quoted-excerpt injection test (`<pinned-excerpt>${dictionaryCall()}</pinned-excerpt>` → `mixed-content`) is unchanged and still passing. The relaxation buys narration UX without buying an injector anything new.

> *"What's left to exploit here needs a filesystem race or a willing click — and this attacker only has words."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Catalog-miss log redacted to zero attributable signal

`packages/core/src/infrastructure/context/ContextResourceResolver.ts:59` — Writer says "the persona can't find my character sheet." For Workshop reads this line is redundant defense-in-depth — `WorkshopResourceCapability.read()` already catches the real miss and logs `request=/persona=/capability=/rejected=` before `loadResources` ever runs. It stops being redundant for the resolver's *other* caller: the pre-existing `ContextFileCapability` path feeds gate-approved paths into the same `loadResources`, and its own log carries no requestId either. So the one place this branch is load-bearing now logs nothing distinguishing — not even a candidate count, which costs zero security (`resourceMap.size` is in the same scope) and would tell a 2am reader whether the whole catalog was empty or just this one key missed, without re-leaking the path the redaction rightly protects.

### 🟡 Standard — availability() exception and true-zero-catalog share one silent instruction

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:107` — Two different root causes produce byte-identical "resource access is unavailable" instruction text: `availability()` throwing (caught and logged with requestId) and a genuinely empty catalog (no exception, nothing logged at this layer). Telling them apart from the output channel means checking whether the requestId-keyed "Resource catalog unavailable" line *exists* — an absence-based diagnosis — then eye-matching the resolver's un-keyed "Indexed 0 context resource(s)" line by timestamp. Diagnosable, but only by someone who already suspects this exact seam.

### 🟢 Praise — resourceMetrics log line answers the zero-match search question outright

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:145` — "The search came up empty but the term is in chapter 3" is the scenario this PR's logging nails: one fulfillment line carries request/persona/capability/input plus `searchMode` (catalog vs content), `catalogEntriesScanned`, `filesScanned`, `matchCount`, `bytes`, and `truncated`, all grep-able by requestId. No reproduction needed to know whether the search short-circuited on a filename match or scanned content and came up dry. Exactly the "request id, capability, group, sizes, truncation, budget state" line the sprint checklist asked for — delivered as one line instead of five.

> *"resourceMap.size was sitting right there in the closure when the redaction shipped, and nobody spent it."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

*(Bria's top finding — the catalog-shadow search suppression — is the 🎯 consensus item written up in Sam's section; her ticket anchor: Locked Decisions promise "term/phrase search across one group or all groups," and nothing tells the persona a name hit cancels the content scan.)*

### 🟡 Standard — Immutable persona prompt claims unconditional resource access; only the per-turn message is catalog-aware

`packages/core/resources/system-prompts/workshop-personas/base.md:11` — The ticket's Locked Decisions: "Prompt honesty: the persona prompt advertises file access only when… the workspace actually has configured context paths; catalog-empty states say so." The catalog-empty gating lives entirely in the per-turn instruction ("Project resource access is unavailable because no configured files matched"). But `base.md` — the persistent system-level prompt — states unconditionally that the host may "autonomously search and read configured project resources" and separately instructs it to proactively inspect neighboring chapters and search six groups, with no catalog-empty caveat anywhere in the file (Rule A grep confirmed). The PR's own `workshopPersonas.test.ts` locks in the unconditional wording. On a zero-config turn the model reads one always-on instruction saying "go look" and one per-turn instruction saying "don't" — acceptance criterion 4 rests entirely on the later message winning. A one-line conditional wording ("when the turn contract advertises them") closes the gap.

### 🟡 Standard — Advertised proactive continuity + project-bible search may not fit the shared 3-call budget

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:103` — The same instruction block that discloses "at most 3 capability calls" also tells the host, unconditionally, to run two separate proactive workflows before treating context as missing: inspect current *and neighboring* chapters for continuity, *and* search six named bible groups for facts. A single question needing both could spend the whole budget on half the instruction. There is a graceful fallback — the engine forces a final response and the host is told to state missing evidence honestly — so nothing breaks outright, but no text tells the persona how to prioritize between the two workflows it was asked to run inside one shared budget. Confidence MEDIUM: real behavior is model-dependent; observe live sessions before re-wording.

> *"The ticket promised a librarian who searches the shelves; the code built one who reads the spines, calls it done, and never mentions the books it left closed."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Diet Starts After the Feast

Illuminated by: Tim's two findings

A budget that caps only what leaves the building isn't a budget on the building's work — it's a budget on the receipt. Every workshopResource limit governs the response the model finally sees, while the read, decode, and line-split happen in full beforehand, at whatever size the file actually is; the same shape appears a level up, where all eight groups are rediscovered per turn regardless of which one the request needs. Any time a system claims to be "bounded" by capping its output, ask where the cost was actually paid — the meter you're proud of may sit downstream of all the real work.

→ Carry forward: when you find a cap, a `min()`, a slice, or a truncate, walk backward to where the data first entered memory and price the worst case between that point and the cap. If the cost is proportional to input size regardless of the cap, the boundary is decorative.

### Lesson 2 — Clean Isn't the Same as Complete

Illuminated by: Sam (all three findings), Oliver's indistinguishable-unavailable

"success," "truncated," and a byte count are cheap to produce and easy to trust on sight — which is exactly why they must mean what they say, in every direction. Here the error runs both ways: a `success` that quietly covered less ground than it implied, and a truncation flag and byte pair that each implied less was delivered than actually was — plus two genuinely different situations collapsing into one indistinguishable message. A feature whose entire identity is honest provenance is judged on exactly these small fields before anyone reads the logic behind them.

→ Carry forward: for every status flag or count you emit, finish the sentence "this value tells me ___ actually happened" from the caller's chair — then hunt the input (an exact boundary, a line ending, an early return) that makes the value technically defensible but practically misleading.

### Lesson 3 — The Map That Stopped Matching the Territory

Illuminated by: Stan's codec-comment finding, Bria's base.md finding, Marcus's duplicate path-check

A comment claiming to match a sibling's behavior, a prompt claiming unconditional access, and a hand-rolled safety check living beside the primitive it duplicates are three shapes of one problem: a single trust decision described or implemented in two places, with nothing forcing the two to agree. None had drifted into something unsafe yet — one was even provably stricter than what it claimed to match — but the thing holding each description true is a maintainer's memory of two files at once, not the structure of the code. Comments and prompts are the one part of a system the compiler never checks.

→ Carry forward: when you write "matches X" or "same as X," ask whether you can make it true by construction — call the same function, reuse the same primitive. If you can't, document the actual *difference* rather than the claimed sameness; a described difference survives the next change, a claimed sameness just goes stale.

### Lesson 4 — The Guardrail on Three of Four Doors

Illuminated by: Parker's dispatchers, Stan's artifact switch

`assertNever` earns its keep by being everywhere a switch claims to be exhaustive — its value is turning a future silent miscategorization into a compile error, and that value is all-or-nothing per call site. This diff writes the guard twice and then leaves it off four structurally similar dispatchers and a new switch: less a statement about any single omission than about where the pattern was reached for on reflex and where it was skipped because the surrounding code merely looked handled. A discipline applied inconsistently within one diff isn't a rule yet; it's a preference that happened to show up that day.

→ Carry forward: the moment you apply a defensive idiom once, search the rest of your own diff for its siblings — same shape, same risk — before moving on.

### Lesson 5 — The Fire Drill Nobody Ran

Illuminated by: Cal's two findings

A catch block that fails closed and a recount that corrects the numbers after truncation are both promises about what happens on the bad day — and a suite can stay green while never once forcing the bad day to arrive. Tellingly, the two places this PR explicitly promised to protect the model's view of the filesystem when something goes wrong are the two places where "goes wrong" was never simulated.

→ Carry forward: for every defensive branch — catch, fallback, cap-triggered recalculation, fail-closed default — name the test that forces execution down it and what it asserts about the world afterward. A branch that exists only for the bad day deserves one test that makes the bad day happen.

> *"A librarian earns trust shelf by shelf, never by the catalog's promise — and code earns it the same way, one actually-tested branch at a time."* — Sensei

---

## The Closer

### ⭐ Yelp Review

**★★★★☆ (4/5)** — Ordered the Bounded Librarian tasting menu: the catalog starter, the search main, and a 64-kilobyte read for dessert — and I'll say this for the kitchen: nothing left it that wasn't on the menu, and every rejected order came back with a written note instead of silence, which is more than most establishments manage. Would absolutely return — the security table is the best seat in the house, and the staff logs every course by ticket number. One complaint, offered with love: I asked for everything with Raven in it and the waiter proudly brought the one dish *named* Raven while never mentioning the seven chapters she's simmering in — and the bill swears I ate fewer bytes than the kitchen plated, because someone counts carriage returns as garnish.

---

## Summary

No blockers — Blake and Patricia independently traced the new trust boundary end to end and it fails closed everywhere it was pushed; the ports-and-adapters seam, evidence escaping, and beacon/CSP closure are genuinely strong work. What stands between this draft and merge is honesty-of-provenance at the edges: one deliberate-but-undersignaled search semantics decision (the 🎯 consensus catalog-shadow), two provenance-math fixes (CRLF bytes, exact-cap truncation), an input-side size guard, and the two cheap tests that make the promised fail-safe paths provable. Nearly there — the librarian just needs to stop reading only the spines and start itemizing the bill correctly.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
