# MR Review — feat(workshop): Sprint 01 — the Workshop editor-tab shell

**Author:** okeylanders · PR #66 · `claude/sprint-01-workshop-editor-tab-u49fd5` → `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded · **Noted** = praise; no action required.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Architecture witnesses live in `packages/core` but `fs`-read `apps/vscode-extension` source — relocate to the app-side jest root reserved for them | Marcus | — | **Open** |
| 2 | 🟠 High | "Byte-identical sidebar HTML / no leak" headline claim has zero automated witness (shared vscode mock lacks `Uri.joinPath`; add mock method + snapshot both surfaces) | Cal | — | **Open** |
| 3 | 🟡 Standard | `webview_error` seam: new host consumer logs unvalidated/unbounded webview text, and the event now has two divergent parsers/prefixes — the sidebar's is the broken one today | Patricia, Oliver | 🎯 | **Open** |
| 4 | 🟡 Standard | New witnesses prove less than their comments claim: dead `(?!MessageHandler\b)` lookahead ("Handler" never in suffix list → Sprint 2's `new WorkshopHandler` uncaught); 300-char "argument window" overshoots the constructor | Cal | — | **Open** |
| 5 | 🟡 Standard | Surface stamp `"workshop"` is two hand-synced string literals across packages — no shared symbol in `@shared/types`; ditto bare `'webview_error'` vs `MessageType.WEBVIEW_ERROR` | Marcus | — | **Open** |
| 6 | 🟡 Standard | `[Workshop] Panel opened (services wired: 13, platform: ok)` is a compile-time constant dressed as a runtime health check | Parker, Oliver | 🎯 | **Open** |
| 7 | 🟡 Standard | `viewType = 'proseMinion.workshop'` breaks the kebab-case id convention (`prose-minion.*`); camelCase `proseMinion.*` is the settings-key namespace | Stan, Parker | 🎯 | **Open** |
| 8 | 🟡 Standard | Rail's "first six" tools reproduce the static comp (`pm-frames-fulltab.js`), not the approved Direction B rail override (`pm-direction-b.js` swaps in Choreography + Show & Tell) | Bria | — | **Open** |
| 9 | 🟡 Standard | Sprint doc's `Branch:` field names a never-pushed branch; the memory-bank note in the same commit has the real one | Bria | — | **Open** |
| 10 | 🟡 Standard | `WorkshopApp` has zero `ErrorBoundary` coverage (sidebar `App.tsx` wraps every major section) | Sam | — | **Deferred** — static tree verifiably can't throw; must land with (not after) Sprint 2's dynamic content |
| 11 | 🟡 Standard | `WorkshopPanelProvider` behavior (reveal-if-exists, dispose lifecycle) untested — the new witnesses are DI-shape checks only | Cal | — | **Deferred** — no provider-test harness exists repo-wide; needs a small fake-panel fixture first |
| 12 | 🟡 Standard | `retainContextWhenHidden` doubles idle webview heap; watch item: Sprint 2 must reuse the one `coreServices`, never construct a second polling service | Tim | — | **Deferred** — by ADR design for v1; add a witness when Sprint 2 wires the panel's MessageHandler |
| 13 | 🟢 Nit | `onDidReceiveMessage` listener not captured/disposed in the sibling's explicit `(handler, undefined, [])` shape | Stan | — | **Open** |
| 14 | 🟢 Nit | `workshop.css` has no `:focus` rules — Sprint 2's enabled composer inherits the sidebar's unscoped focus ring and looks right only by token-inheritance coincidence | Sam | — | **Deferred** — moot while the composer is disabled; add scoped focus styles with the Sprint 2 composer work |
| 15 | 🟢 Nit | Nonce still `Math.random()` — pre-existing and moved verbatim, but one weak-nonce site now underwrites two surfaces | Patricia | — | **Deferred** — swap to a CSPRNG before Sprint 2 renders real content |
| 16 | 🟢 Praise | The PR's claims verified true under independent inspection: byte-identical sidebar HTML, identical CSP, fully-scoped CSS, bundle delta exact to the byte | Marcus, Parker, Sam, Patricia, Tim | 🎯🎯 Strong | **Noted** |
| 17 | 🟢 Praise | The "React never mounted" failure trail is diagnosable end-to-end — and better than the sidebar's own equivalent path | Oliver | — | **Noted** |
| 18 | 🟢 Praise | Panel-tab title vs HTML `<title>` kept correctly distinct; the AC's "titled 'Workshop'" met verbatim | Bria | — | **Noted** |
| 19 | 🟢 Praise | New witnesses reuse the established `collectSourceFiles` + regex + empty-offenders idiom rather than inventing a parallel one | Stan | — | **Noted** |
| 20 | 🟢 Praise | Render and CSS costs are *checked* non-issues, not assumed ones ("loaded" vs "matched" distinguished) | Tim | — | **Noted** |

---

## Blast Radius

- 11 files changed · +915 / −79 lines
- New files: 5 (`WorkshopPanelProvider.ts`, `webviewHtml.ts`, `WorkshopApp.tsx`, `workshop.css`, memory-bank note) · Migrations: n/a · New providers: 1, new services: 0
- Almost entirely additive — existing behavior touched only in `ProseToolsViewProvider` (HTML extraction) and `index.tsx` (surface branch); deliberately inert Sprint-1 shell

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | B |
| 🧪 Tests | C− |
| 📖 Quality | B |
| ⚡ Performance | A− |
| 🎯 Domain | B− |

Zero blocking findings. Blake (critical path) returned a clean bill. The two Highs are both about the *guardrails*, not the product code.

---

## Executive Briefing

🟠 **[Marcus]** Boundary witness inverts the boundary — the two new architecture tests live in `packages/core`'s suite but `fs.readFileSync` into `apps/vscode-extension` source, hard-coding the adapter's layout into core's "am I platform-agnostic" suite. `jest.config.js` already reserves an app-side test root for exactly this; the missing vscode mock was routed around instead of closed.

🟠 **[Cal]** The PR's headline claim is unwitnessed — byte-identical sidebar HTML is true today (verified by hand, three times over by this panel), but no automated test pins it, and the shared Jest vscode mock can't run one (`Uri.joinPath` missing). Two small fixes convert a one-time manual claim into a durable regression guard.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — boundaries.test.ts reaches out of packages/core into apps/vscode-extension, inverting the split it exists to guard

`packages/core/src/__tests__/architecture/boundaries.test.ts:65` — `const APP_SRC_ROOT = path.resolve(SRC_ROOT, '..', '..', '..', 'apps', 'vscode-extension', 'src');`

This file's own docstring frames its charter as keeping `packages/core` vscode-free, and both pre-existing witnesses only ever walk `SRC_ROOT`. The two new witnesses break that pattern: they `readFileSync`/`readdirSync` three directories out into the VS Code adapter, hard-coding its folder names and filenames (`application/providers`, `WorkshopPanelProvider.ts`, `extension.ts`, the literal `'new WorkshopPanelProvider('`) into core's test suite. This isn't a forced move — `jest.config.js` (untouched by this PR) already reserved the correct home: `apps/vscode-extension/src` is a jest root specifically for "future app-side adapter tests," blocked only by that side lacking a vscode mock. Rather than standing up the mock and placing the wiring test next to the adapter it verifies, the PR routed around the gap via raw fs reads from the wrong side of the boundary. Relocate the two `it` blocks to `apps/vscode-extension/src/__tests__/architecture/`, same scan idiom, scoped to its own package. Left as-is, every future reorg inside the adapter — which core is supposed to not care about — risks red-herring failures in core's suite. Same drift ADR 2026-06-18 diagnosed in `MessageHandler`, recurring one layer down, in the tests.

### 🟡 Standard — the surface stamp is a cross-package contract carried by two hand-synced string literals, not a shared type

`packages/core/src/presentation/webview/index.tsx:25` — `const surface = root.getAttribute('data-pm-surface');`

Searched diff for a shared surface-stamp symbol reachable from both sides — not found. `WebviewSurface` lives app-side only (correctly — core importing it would invert ADR 2026-06-16), but nothing was placed in the layer both sides already share for exactly this purpose: `@shared/types`, the mechanism this same PR relies on for the tool-catalog wire contract (`WritingToolsFocus`). The host writes the literal `"workshop"` into the HTML (`webviewHtml.ts:43`); `index.tsx:28` compares its own independently-typed copy — no compiler link. The pattern repeats one file over: `WorkshopPanelProvider.ts:61` checks `message?.type === 'webview_error'` as a bare string with `MessageType.WEBVIEW_ERROR` one import away in the same barrel. Nothing is broken today, but this is the one new host↔webview protocol the PR introduces, and it's the only piece of it left untyped. Worth a `SURFACE_ATTR`/`WebviewSurface` literal in `@shared/types` before Sprint 2 adds a second thing that must agree on it.

### 🟢 Praise — webviewHtml.ts earns its keep

The old private `getHtmlForWebview`/`getNonce` pair was duplicated *knowledge* waiting to happen — CSP policy, nonce generation, asset wiring — exactly what forks quietly the first time someone edits only one provider. Both providers now call the identical function with only a `surface` discriminant, and the sidebar's HTML is verifiably byte-identical. One CSP/nonce policy, two callers, no second copy to drift — "extend the generator" read correctly as one generator, not two.

> *"The HTML shell earns its keep and the surface stamp mostly holds, but the file whose entire job is proving core doesn't know about the VS Code shell just reached across the monorepo and read the VS Code shell's files off disk to save itself a mock — the guard is fraternizing with the thing it's supposed to be guarding against."* — Marcus

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard — WorkshopApp has zero ErrorBoundary coverage — App.tsx's fault-isolation pattern isn't carried over

`packages/core/src/presentation/webview/WorkshopApp.tsx:58` — `export const WorkshopApp: React.FC = () => {`

Traced what happens if anything in this tree throws during render. `App.tsx` wraps each major section (AnalysisTab, WordFrequencyPanel, StyleFlagsPanel, WordSearchPanel, ProseStatsPanel, CategorySearchPanel, UtilitiesTab) in its own `<ErrorBoundary>`, so one panel's crash degrades to a local "Something went wrong / Try Again" fallback. `WorkshopApp` imports nothing from that module and nests header, rail, palette, thread, and composer under one plain function component — no boundary anywhere. Today that's genuinely moot: `WORKSHOP_TOOLS` is a hardcoded 14-item array and `Icon`'s `PATHS` is a compiler-enforced exhaustive `Record` — nothing can throw. But the moment Sprint 2 wires real session/model data into this tree, a single bad render propagates out of `createRoot().render()` and is caught only by `index.tsx`'s top-level try/catch, which replaces the ENTIRE `#root` with plain "Webview init error: …" text — wiping rail, thread, and composer alike instead of losing one section. Add boundaries before Sprint 2 lands dynamic content, not after.

### 🟢 Nit — workshop.css ships with no `:focus` rule of its own — today's visual harmony is coincidence, not a guarantee

`packages/core/src/presentation/webview/workshop.css:370` — `[data-pm-surface="workshop"] .pm-ws-comp-input {`

Searched the full 411-line file for `:focus` — not found anywhere. Once Sprint 2 removes `disabled` from the composer input, the only `:focus` rule that will ever apply is index.css's **unscoped** `input[type="text"]:focus { border-color: var(--pm-accent); box-shadow: 0 0 0 3px var(--pm-accent-soft); }` — and it wins not by out-specifying a workshop rule but because there is no competing workshop rule at all. It will likely look correct by accident: custom properties resolve by DOM inheritance, so the global rule picks up the Workshop's own coral tokens. That's convention holding the rope, not a rule enforcing it. Zero impact today since the input is unfocusable.

### 🟢 Praise — the "no cross-surface leak" and "byte-identical sidebar HTML" claims both check out under direct inspection

Didn't take the headless-Chromium verification on faith: diffed `getWebviewHtml(…, 'sidebar')` output against the deleted method character by character — title, root div, both inline scripts, bundle tag match exactly; only the always-random nonce differs (already true pre-PR). And all ~60 selectors in workshop.css are prefixed with `[data-pm-surface="workshop"]` — read the full file — so nothing can bleed onto `.app-container`. Good seam.

> *"Went hunting for the empty-list bug and found a blast-radius problem instead — WorkshopApp has zero ErrorBoundaries, so 'one tool misbehaves' and 'the entire panel goes blank' are, for now, the exact same incident."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — "services wired: N" diagnostic can never report a problem — it's a constant dressed up as a check [🎯 Consensus]

`apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts:71-73`

`CoreServices` has 13 required, non-optional fields — `Object.keys(this.coreServices).length` will print `13` on every successful boot, forever, until someone edits the interface. A broken bundle fails typecheck long before this line runs; it can't show up as a different number here. Same for `platform: ${this.platform ? 'ok' : 'missing'}` — a required constructor param, so `'missing'` is unreachable through typed construction. A log that looks diagnostic but restates a compile-time guarantee. `'[Workshop] Panel opened'` says the truthful part with none of the fake precision.

### 🟢 Nit — new viewType breaks the kebab-case convention its own sibling and its own command use [🎯 Consensus]

`WorkshopPanelProvider.ts:23` — `public static readonly viewType = 'proseMinion.workshop';`

Every other identifier this PR touches is kebab-case `prose-minion.*` — the sibling's `'prose-minion.toolsView'` and this PR's own `prose-minion.openWorkshop`. `proseMinion.*` camelCase visually collides with the *unrelated settings-key* namespace (`proseMinion.includeCraftGuides`…), inviting a "wait, is this a setting?" double-take. `'prose-minion.workshop'` would actually deliver the ADR's "following every existing pattern."

### 🟢 Praise — webviewHtml.ts extraction: the doc comment's promise and the diff match

The comment claims the extraction prevents CSP/nonce/asset drift and preserves the sidebar byte-for-byte — and it checks out. No hand-waving, no "should be equivalent" — a comment that describes what the code does. Rarer than it should be.

> *"The panel-opened log dresses up `Object.keys().length` on a 13-field required interface as a health check — it's going to say '13' until the heat death of the universe, so let's just say what we mean."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — the PR's headline claim — "byte-identical sidebar HTML, no cross-surface leak" — has zero automated witness, and the shared vscode mock can't run one yet

`apps/vscode-extension/src/application/providers/webviewHtml.ts:19-20`

Checked the claim by hand: extracted the `'sidebar'` output and diffed it character-for-character against the removed literal — byte-identical today. But that fact is proven nowhere except a one-time, non-committed manual pass described in prose. Searched the diff for a test exercising `getWebviewHtml` or either rendered surface — not found. And it's not just "nobody got to it": the shared `jest.mock('vscode', …)` in `packages/core/src/__tests__/setup.ts` implements `Uri.file`/`Uri.parse` but not `Uri.joinPath` — which `getWebviewHtml` calls three times. Run the obvious test today and it throws before the first assertion. Once this function is the single source for two surfaces, a Sprint-2 edit that silently breaks the sidebar's exact markup has no CI signal at all. Cheap fix: extend the mock with `joinPath`, pin the sidebar branch's output with a snapshot, assert the workshop branch stamps `data-pm-surface="workshop"`. Two small assertions convert a one-time manual claim into a durable regression guard for the exact thing this sprint says it verified.

### 🟡 Standard — WorkshopPanelProvider's reveal-if-exists idempotency and dispose lifecycle are entirely unverified — the two new tests check wiring shape, not behavior

`WorkshopPanelProvider.ts:38-40`

The actual new behavior this sprint ships — reveal-if-exists, the diagnostics bridge, `onDidDispose` reset, explicit `dispose()` — has no test. The two new witnesses are DI-shape checks; they'd pass even if `openOrReveal` always created a second panel. Weighed against scope honestly: the sibling provider has never had a test either (confirmed — zero files under `apps/vscode-extension/src/__tests__`, for any provider, ever), so this is precedent, not regression — and a real test needs a small fake-panel fixture the harness doesn't have yet. Proportionate to note, not block on — but don't let the two DI-shape tests read as "the provider is tested."

### 🟡 Standard — the two new architecture witnesses prove narrower claims than their own comments say they do

`boundaries.test.ts:70-71`

Ran both assertions against inputs they claim to guard. (1) The `(?!MessageHandler\b)` lookahead is **dead code** — "Handler" isn't in the forbidden-suffix list, so `new MessageHandler` never matched anyway. Real consequence: `new WorkshopHandler(...)` — the ADR's own planned Sprint-2 class — slips through uncaught, along with `new SomeAdapter()`, `new SomeCache()`, `new SomeGateway()`, `new SomeFactory()` (suffix must land at the identifier's exact end). The guard's real reach is today's 7-word naming convention, not "any service-shaped construction" as the comment claims. (2) Witness 3's `slice(constructionIdx, constructionIdx + 300)` + `toContain('coreServices')` is a substring search whose window runs ~250 characters past the constructor's closing `);` into `context.subscriptions.push`, `focusToolsView`, and part of `getSelectionPayload` — it would pass if "coreServices" appeared anywhere in that trailing unrelated code. Neither gap breaks anything today; both stop being harmless the moment a second provider or a same-dir test fixture arrives (`collectSourceFiles` doesn't skip a hypothetical `providers/__tests__/` — a fake named `FakeAccountBalanceService` would trip witness 2 as a false failure).

> *"Two tests that pass are not the same as two invariants that are enforced — I checked, and one of them is guarding a word that was never in danger."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — viewType breaks the kebab-case contribution-id convention [🎯 Consensus]

`WorkshopPanelProvider.ts:23` — `public static readonly viewType = 'proseMinion.workshop';`

Every VS Code contribution id in this codebase is kebab-case `prose-minion.*` — the direct sibling's own viewType (`'prose-minion.toolsView'`), the activitybar container id (`"prose-minion"`), and all five command ids including this PR's own `"prose-minion.openWorkshop"`. camelCase `proseMinion.*` exists for exactly one thing: `contributes.configuration` settings keys (`proseMinion.assistantModel`, `proseMinion.ui.sidebarTheme`, …). A view-type id is the same category as the sibling's, not a setting — per the split this codebase actually uses: `'prose-minion.workshop'`.

### 🟢 Nit — onDidReceiveMessage listener isn't captured/disposed the way the sibling's is

`WorkshopPanelProvider.ts:60`

`ProseToolsViewProvider` registers `onDidReceiveMessage(handler, undefined, [])` and explicitly tears down in `onDidDispose`, with a comment explaining the hazard. The new provider passes neither `thisArgs` nor a disposables array and never stores the returned `Disposable`. Functionally harmless today — the reveal-if-exists guard means one registration per live panel, and `panel.dispose()` tears down its own emitters — but adopt the sibling's explicit-capture shape so "how a webview listener gets registered/disposed" stays one shape across both providers instead of two.

### 🟢 Praise — architecture witnesses extend the existing pattern instead of inventing a second one

The new witnesses reuse the exact `collectSourceFiles` + regex-filter + `expect(offenders).toEqual([])` shape the pre-existing test established, down to relative-pathing offenders for readable failures. Same instinct as the PR's own `webviewHtml.ts` extraction — extend the one mechanism rather than stand up a parallel one.

> *"viewType is 'proseMinion.workshop' next to a sibling field, three lines of git-blame away, that's been 'prose-minion.toolsView' since the sidebar was born — we really do have the correctly-cased example right next door."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — bundle delta verified byte-for-byte — negligible parse cost, cleanly attributed [🎯🎯 Strong Consensus: claims-verified]

Rebuilt production at PR head: `webview.js` = 528,443 bytes — matches the claim **to the byte**. Stats attribute it cleanly: workshop.css → 11 KiB raw text via style-loader, the rest is compiled JSX; no accidental deps, no duplicated React, prod React confirmed. Local disk load, so the only real cost is V8 parse of 16KB more minified JS: low single-digit ms, dwarfed by VS Code's own ~100ms+ panel scaffolding. At ~16KB/sprint you'd need another 15–20 sprints before parse time turns perceptible. The ADR is right to defer entry-splitting.

### 🟡 Standard — retainContextWhenHidden doubles idle heap, not backend cost — keep it that way in Sprint 2

`WorkshopPanelProvider.ts:51` — `retainContextWhenHidden: true`

With the panel open, two surfaces each parse and execute their own copy of the full 528KB bundle (webviews don't share a JS realm) — the Workshop pays to mount React and the entire existing `App.tsx` tree a second time to render ~160 lines of static markup, then holds that idle heap indefinitely. What doesn't double: `coreServices` — including `AccountBalanceService`'s live refresh timer — is one instance shared by reference, and the new architecture test makes a second instance structurally hard to introduce. Fine now: zero timers in the shell, panel created lazily, non-users pay nothing. Watch when Sprint 2 wires a `MessageHandler` into this panel — the risk isn't "two panels," it's "two independently-polling services." Worth a boundary-test assertion then, not now.

### 🟢 Praise — render and CSS costs are checked non-issues, not assumed ones

Zero state/effects/props; mounted once by a top-level `createRoot().render()` that never re-invokes — nothing to reconcile for the shell's lifetime. All 48 workshop.css rules are `[data-pm-surface="workshop"] .foo`-shaped; browsers bucket-reject non-matching class selectors in O(1), so the sidebar's DOM pays zero recalculation. It *is* unconditionally loaded on both surfaces (static top-level import, style-loader inserts at module-eval either way) — but "loaded" and "matched" are different costs, and only the first is real here: ~11KB parse, once, per boot.

> *"Rebuilt it myself — 528,443 bytes on the nose; the only thing actually doubling here is an idle React heap, and the architecture tests are already standing between Sprint 2 and the version of this where it'd be a second polling timer."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — unvalidated free-text webview payload logged verbatim to the output channel [🎯 Consensus: webview_error seam]

`WorkshopPanelProvider.ts:62`

New, not moved-verbatim — traced the sidebar's equivalent to be sure: `MessageRouter.route` looks `message.type` up in a `Map<MessageType,…>`; `'webview_error'` isn't registered, so `route()` throws before logging and the original free text was previously *discarded*. `WorkshopPanelProvider` is the first code in this repo to deliberately pull a webview-supplied free-text field out and write it, unsanitized and unbounded, into a log sink. The TS annotation `{ type?: string; message?: string }` is compile-time-only — `onDidReceiveMessage` crosses the IPC boundary, so at runtime the value is whatever the webview posts. Practical reach today is narrow: only the extension's own CSP-gated bundle can run in that webview, and the sole caller is `window.onerror`. But the sink validates nothing and truncates nothing — embedded `\n[Workshop] …` text would render as forged log lines, and it inherits whatever the webview becomes capable of emitting once Sprint-2 content or a compromised dependency can drive `postMessage` directly. Cheap to close now — cap the length, validate the shape — before Sprint 2 uses this file as its starting template.

### 🟢 Nit — nonce still generated with Math.random() — pre-existing, but now underwrites two webview surfaces instead of one

`webviewHtml.ts:95`

Pre-existing, moved character-for-character. `Math.random()` isn't a CSP-grade CSPRNG (V8's PRNG state has been reconstructed in published research). Practical risk today: purely theoretical — a guessable nonce needs an injection primitive to pair with, and Sprint 1 has none (static JSX, no `dangerouslySetInnerHTML`, no dynamic script construction). What the PR changes is scope, not strength: one weak-nonce site now backs both surfaces, and Sprint 2 is explicitly bringing session/thread content — exactly where a markdown-render slip becomes plausible. Swap to `crypto`'s CSPRNG while `webviewHtml.ts` is still small, ideally before Sprint 2 content, not after.

### 🟢 Praise — CSP/nonce extraction verified byte-identical across both surfaces — no drift

Diffed the actual cross-cutting security surface rather than trusting the description: CSP string, nonce mechanism, and script wiring identical for both surfaces; only per-surface branches are `<title>` text and `#root` markup — static literals gated by an internal union, never interpolated from external input. `default-src 'none'` with no `connect-src` denies fetch/XHR/WebSocket equally on both surfaces — the right default for a zero-AI shell. One policy to audit going forward instead of two that could silently diverge.

> *"Passes the scanner. Doesn't pass the attacker — though today's attacker would mostly just be admiring how boring and well-fenced the room is."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — "services wired: N, platform: ok" is a constant dressed as a health check [🎯 Consensus]

`WorkshopPanelProvider.ts:72`

Traced both halves against their types: `CoreServices` declares exactly 13 required fields — `Object.keys(...).length` is 13 for any object satisfying the interface, whether `accountBalanceService` initialized cleanly, the API key is missing, or OpenRouter is unreachable. It counts property names, not liveness. `platform` is built as an unconditional object literal in `extension.ts` — `'missing'` is dead prose. This line reads byte-identical on a healthy activation and on one where something upstream quietly failed. A user pastes it into a bug report and it looks like a passed health check; it verified nothing. Name it honestly ("provider constructed") rather than as something that reads like telemetry.

### 🟡 Standard — webview_error has forked into two parsers with two prefixes, and nothing keeps them in sync [🎯 Consensus: webview_error seam]

`WorkshopPanelProvider.ts:61`

This handler expects the flat `{ type, message }` — exactly what the shared inline script and `index.tsx`'s catch post — and logs `[Workshop] Webview error: …`. The sidebar's "real" handler for the same event — `UIHandler.handleWebviewError` — expects the nested envelope (`message.payload.message`) and logs `[WEBVIEW ERROR]`. The flat wire shape never has `.payload`, so **the sidebar's path throws today**; `MessageHandler`'s catch surfaces it as `[MessageHandler] ✗ Error routing webview_error … Cannot read properties of undefined (reading 'message')` — the real browser error text is gone, replaced by a meta-error about the reporter failing to report. One bridge, three producers, two consumers, two prefixes: a support thread grepping an output-channel dump for `WEBVIEW ERROR` — the string that has existed since before this PR — will never find a Workshop boot failure filed under `[Workshop]`. The shape mismatch predates this PR, but the new handler codifies a second, divergent parser for the same event instead of unifying one. Whoever routes Workshop through a real `MessageHandler` in Sprint 2 needs to know these two paths aren't unified today.

### 🟢 Praise — the "React never mounted" case is actually diagnosable — rarer than it should be

Traced the worst case end to end: `WorkshopApp` throws synchronously during first render → `index.tsx`'s catch (1) replaces the loading placeholder with visible "Webview init error: …" text in the panel, (2) `console.error`s it, and (3) posts the flat shape — which this new handler reads directly and correctly, landing a real, readable line in the output channel. On-screen text + devtools console + output channel: a genuinely diagnosable trail, and per the finding above, currently *more* informative than the sidebar's own equivalent path. Sprint 1 got this exact scenario right before Sprint 2 starts routing real traffic through it.

> *"The bridge holds — just don't grep for the wrong half of it at 2am."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — rail's "first six" reproduces the static reference comp, not the actually-approved Direction B prototype

`WorkshopApp.tsx:24-25` (catalog comment) and `:55-56` (`WORKSHOP_TOOLS.slice(0, RAIL_TOOL_COUNT)`)

`docs/design/README.md` is explicit: `Prose Minion - Assistant Tab.html` backed by **pm-direction-b.js** is the "Approved direction — to implement"; `pm-frames-fulltab.js` backs the static A/B/C reference comps. The two files disagree on exactly what this component needed: the static comp does a naive `TOOLS.slice(0,6)` (→ dialogue, prose, gestures, cliché, repetition, decision-points), while the approved interactive layer explicitly overrides the rail — `const railTools = ['dialogue','prose','gestures','choreography','cliche','showtell']` (pm-direction-b.js:353), swapping in **Choreography** and **Show & Tell**. The shipped `slice(0, 6)` is the former. May be an acceptable Sprint-1 simplification since everything is disabled — but the code's own comment claims fidelity to "the approved" prototype, and for the rail selection that's not the file it matches. Either reorder the catalog/rail to the approved six, or amend the comment to say the static comp's order was chosen deliberately.

### 🟡 Standard — sprint doc's own Branch field is stale — contradicted by a doc this same PR adds

`.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/01-shell.md:5` — `**Branch**: `feat/workshop-s1-shell``

Actual head branch is `claude/sprint-01-workshop-editor-tab-u49fd5` — and this PR's own new memory-bank note records that correctly. The diff edits 30+ lines of this exact sprint doc — ticking 8 boxes, adding a whole Verification section — without touching the stale header, so the sprint doc now disagrees with its sibling introduced in the same commit. Whoever opens the sprint doc to find the branch gets sent to one that was never pushed.

### 🟢 Praise — panel-tab title vs HTML `<title>` — correctly kept distinct, AC met to the letter

AC: "opens an editor-tab panel titled 'Workshop'." That's the `createWebviewPanel` title argument — verbatim `'Workshop'`, exactly what VS Code renders on the tab. Easy to conflate with `webviewHtml.ts`'s `<title>Prose Minion Workshop</title>` (a near-invisible document title for the same surface) — the two were kept intentionally distinct and the one the AC cares about is correct.

> *"The doc-comment cites its prototype file by name and everything — it's just the file's other, unshipped sibling that actually got approved."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Precise Claim Is an Unwritten Test

Illuminated by: Cal #1, Tim #1, Sam #3

A claim stated precisely enough to verify by hand — byte-identical, exact to the digit — is already a test specification; leaving it in prose means the proof expires with the next commit, and every careful reader must re-perform the ritual, as three reviewers independently did. Manual verification establishes that something *was* true; only an executable witness keeps it true. The hard part — precision — was already done; the test was ninety percent written and simply never transcribed.

→ Carry forward: When you write a measurable claim in a PR description, read it back as the name of a test that does not yet exist, and ask: "What notices when this stops being true?" If the answer is "nobody," transcribe the claim into the suite before you merge it.

### Lesson 2 — The Detour Becomes the Road

Illuminated by: Marcus #1, Cal #1 (shared root cause)

Both of this review's highest-severity findings trace to a single small pothole — a missing test shim — and to the moment work bent around it rather than filling it: witnesses took up residence across a package boundary, and proof retreated into prose. Infrastructure gaps rarely block work; they redirect it, and each redirection lends the next one the authority of precedent. We price the detour per trip and the repair as a project, when it is usually the reverse — the repair is minutes and amortizes forever; the detour is paid again by every traveler who follows the first set of tire tracks.

→ Carry forward: The next time you feel yourself routing around missing infrastructure, pause and price the pothole before committing to the detour: "Am I building this where it belongs, or where it is currently possible?"

### Lesson 3 — An Alarm That Cannot Ring Is Decoration

Illuminated by: Parker #1, Oliver #1, Cal #2, Cal #3

A log that can only ever print one number, a lookahead excluding a suffix that was never on the list, a witness that would pass under the very failure it names — these wear the costume of verification while being structurally unable to fail. We judge a check by what it says rather than by what it can catch, because writing it produces the same feeling of safety either way. The worth of any guard is exactly the set of broken worlds in which it fires; a smoke detector without a battery looks identical from the hallway.

→ Carry forward: Before trusting any check — log line, assertion, regex, alert — run the mutation in your head: picture the specific failure it exists to catch and trace whether it would actually fire. If you cannot describe a world in which it fails, you have written reassurance, not verification.

### Lesson 4 — A Fact With Two Homes Is Already Drifting

Illuminated by: Marcus #2, Oliver #2, Bria #1, Bria #2 — with Marcus #3 as the cure, demonstrated

Everywhere one truth was given two homes — a stamp in two literals, an error contract in two parsers, a branch name in two documents — the panel found divergence not as a future risk but as a present condition: one parser already mangling real errors, one document disagreeing with itself within a single commit. Sync is not a resting state; it is manufactured continuously by structure, or not at all. The most illuminating part: this PR carries its own cure — the HTML generator was extracted precisely so no second copy could drift. The principle was honored at file scale and invisible at the scale of strings, prefixes, and sentences. Duplicated knowledge is not a size problem; it hides best in the smallest facts.

→ Carry forward: Each time you type a literal that something elsewhere must match, ask "who else knows this?" — then give the fact one importable home, or acknowledge that you have just scheduled a disagreement.

### Lesson 5 — Wire the Walls Before the Drywall

Illuminated by: Sam #1, Sam #2, Patricia #1, Patricia #2, Tim #2, Cal #3 (the Sprint-2 clause)

Half the panel's notes share one closing clause — "fine today, before Sprint 2" — which is the sound of failure-structure being deferred alongside features, as though the two age the same way; they do not. Deferred capability stays cheap to add later, but error boundaries, focus rules, input limits, and strong nonces are cheapest at precisely the moment they appear least necessary — while nothing can throw, nothing flows, and no behavior can regress. A deliberately static shell is the open-wall phase of construction: the day the drywall goes up — real data, real deadlines — every omitted wire becomes a retrofit.

→ Carry forward: When scoping a shell or skeleton sprint, sort every deferral into two piles — capability, which can wait, and failure-structure, which cannot — by asking of each: "When the real load arrives, is adding this a safe edit or a risky retrofit?"

> *"Craft is not how carefully you checked — it is how little the future depends on your having been careful."* — Sensei

---

## The Closer

### 🐾 Animal

If this MR were an animal, it would be a **hermit crab's upgrade shell** — meticulously selected, structurally sound, measured to the byte, and uninhabited *on purpose*. The crab (Sprint 2's session spine) hasn't moved in yet; every chamber is deliberately sealed until it does, and reveal-if-exists guarantees there's only ever one shell on the beach. Just remember before the crab arrives: wire the smoke detectors (ErrorBoundaries) and agree on one language for shouting "help" (`webview_error`) — shells are easiest to plumb while they're still empty.

---

## Summary

Zero blocking findings — Blake walked every classic new-webview failure path (disposal, null-deref, asset, CSS bleed) and went back to bed: *"the surface is actually sealed."* Five reviewers independently re-verified the PR's headline claims (byte-identical HTML, identical CSP, fully-scoped CSS, bundle delta exact to the byte) and all of them held — this is an unusually honest PR description. The two High findings are both about the *guardrails rather than the product*: the new architecture witnesses live on the wrong side of the monorepo boundary, and the byte-identical claim has no automated witness because the shared vscode mock is missing one method. Recommend: land the cheap Opens before merge (viewType rename, honest log line, sprint-doc branch line, rail order or comment fix, webview_error typing/validation), fold the two High test-infrastructure items into this PR or an immediate follow-up, and carry the Deferred pile into Sprint 2's definition of done. Nearly there — and the shell itself is genuinely good.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
