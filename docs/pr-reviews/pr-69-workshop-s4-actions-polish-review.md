# MR Review — feat(workshop): Sprint 04 actions and polish

**Author:** okeylanders · PR #69 · `feat/workshop-s4-actions-polish` → `epic/workshop-editor-tab`

> Diff exceeds the ~800-line focus threshold — reviewer context centered on the highest-change code files, with the `.todo` docs summarized. All ten reviewers read the full code diff plus the post-PR source of `WorkshopHandler`, `WorkshopSessionService`, `useWorkshop`, `WorkshopApp`, `FileOperationsHandler`, and the composition-root wiring.

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Save fires two competing toasts; copy/save toast triggers substring-match free-text STATUS prose | Parker, Blake, Sam, Oliver | 🎯🎯 Strong | **Addressed** — Workshop now listens to structured `COPY_RESULT_SUCCESS` / `SAVE_RESULT_SUCCESS`; save STATUS no longer clobbers the toast |
| 2 | 🟠 High | `makeActions` picks prompts by sniffing display labels — load-bearing for the 7 fallback tools, zero invariant tests | Parker, Cal | 🎯 | **Addressed** — fallback prompts are explicit and map invariants are covered |
| 3 | 🟠 High | `openWorkshop` crosses the boundary as three anonymous type shapes while a `prose-minion.openWorkshop` command already does the same call | Marcus, Stan | 🎯 | **Addressed** — kept adapter-owned execution but replaced anonymous shapes with named `WorkshopUiActions` |
| 4 | 🟠 High | Stale-turn quick-action chips send an old tool's lens prompt into the current (different-tool) conversation | Bria | — | **Addressed** — stale tool bars still render as provenance, but disable when their tool differs from `session.selectedToolId` |
| 5 | 🟠 High | A failed Workshop save/copy leaves no durable trace once the 2.2s toast fades (no log line, no banner) | Oliver | — | **Addressed** — file-ops errors now write to the output channel before posting the error toast |
| 6 | 🟠 High | `WorkshopThread`'s `currentToolId` walk goes blind past the 100-turn snapshot window — quick actions vanish, saves mislabeled `editor-*` | Sam | — | **Addressed** — action tool lookup falls back to reload-safe `session.selectedToolId`; `null` no longer fabricates `writing_tools_editor` |
| 7 | 🟡 Standard | `OPEN_WORKSHOP` / `handleOpenWorkshop` untested on both branches; the `>=` route-count assertion silently tolerates it | Marcus, Cal | 🎯 | **Addressed** — happy and fallback branches covered; route count pinned exactly |
| 8 | 🟡 Standard | `parseVariations` — the gate on the sprint's headline variation-cards feature — has zero tests | Cal | — | **Addressed** — parser and variation-card copy/save wiring covered |
| 9 | 🟡 Standard | Save `toolName` wire contract now lives in three places; `FILE_PREFIX_MAP` curates only half the 14 tools; `null` fabricates a `writing_tools_editor` identity | Marcus, Bria | 🎯 | **Addressed** — shared result tool-name/prefix contract covers all 14 Workshop tools |
| 10 | 🟡 Standard | `SAVE_RESULT.toolName` reaches an unvalidated `path.join` host-side (traversal verified) — contained today only by the webview CSP | Patricia | — | **Addressed** — host-side save prefix selection is now a closed allowlist |
| 11 | 🟡 Standard | Empty-state quick-start list is a second, inline, uncommented tool list that can drift from `RAIL_TOOL_IDS` (the four tools do match the prototype — the gap is the missing name/rationale) | Parker | — | **Addressed** — hoisted to `EMPTY_STATE_TOOL_IDS` with prototype rationale |
| 12 | 🟡 Standard | `WorkshopToolsModal` skips the `open`-prop contract both existing modals follow (`AllToolsModal`, `ModelBrowserModal`) | Stan | — | **Addressed** |
| 13 | 🟡 Standard | All three new components skip the file-header doc-comment convention every sibling carries | Stan | — | **Addressed** |
| 14 | 🟡 Standard | `quickActionsDisabled` (whole-list boolean) punches the PR #67 memo boundary twice per run; `parseVariations` recomputed uncached | Tim | — | **Addressed** — `parseVariations` is memoized per turn content; stale-turn disabling is per tool |
| 15 | 🟡 Standard | Completion notes claim a "strict" variation format; the parser is deliberately permissive (`##`–`####`, `-` or `:`) | Bria | — | **Addressed** — sprint notes now describe prompted format plus tolerant parsing |
| 16 | 🟢 Nit | Variation-card React key uses the model-supplied variation number — a repeated "Variation 1" collides | Blake, Sam | 🎯 | **Addressed** — key and visible number are positional |
| 17 | 🟢 Praise | Label-vs-prompt split threaded correctly through conversation history, pinned by tests | Blake | — | **N/A** |
| 18 | 🟢 Praise | Quick-action labels validated against a closed, host-owned map — the "model never invents an affordance" guarantee holds at the boundary | Patricia | — | **N/A** |
| 19 | 🟢 Praise | The PR #67 token-clock memo boundary holds — this PR adds zero per-token render cost | Tim | — | **N/A** |
| 20 | 🟢 Nit | `WORKSHOP_QUICK_ACTIONS_BY_TOOL` build/lookup confirmed O(1) — no action needed | Tim | — | **N/A** |

---

## Blast Radius

- 34 files changed · +1349 / −85 lines
- New files: 4 code (`WorkshopQuickActionBar`, `WorkshopToast`, `WorkshopToolsModal`, `workshopQuickActions.ts`) + 5 `.todo` parked-item docs · Migrations: n/a · New services/controllers: none (1 new workshop message route, 1 new UI route)
- Draft PR into the epic integration branch — the last sprint before `epic/workshop-editor-tab → main`

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | B |
| 🧪 Tests | C |
| 📖 Quality | C |
| ⚡ Performance | B+ |
| 🎯 Domain | C |

**No blockers.** The grades reflect consensus-backed High findings in four categories — all of them seams and verification gaps, none of them broken behavior on the happy path.

---

## Executive Briefing

🟠 **[Parker · Blake · Sam · Oliver] 🎯🎯 The toast seam is double-wired and string-matched** — every save fires two competing toasts (structured `SAVE_RESULT_SUCCESS`, then a free-text `STATUS` matched via `text.includes('Saved result')`) that visibly swap mid-air; copy success has *only* the substring match (`text.includes('copied')`) against an English sentence in another file — reword it and the toast silently dies.

🟠 **[Parker · Cal] 🎯 Quick-action prompts are routed by sniffing button text** — `makeActions` infers each label's prompt strategy from `label.includes('variation')`; dead code for the 7 bespoke tools, load-bearing for the 7 fallback tools, and a label rename silently sends the wrong prompt to the model. No invariant tests on the map.

🟠 **[Marcus · Stan] 🎯 The `openWorkshop` seam is a second bridge to the same island** — an anonymous `{ openWorkshop?: () => void }` re-declared in three shapes across three files, while `extension.ts` already registers `prose-minion.openWorkshop` doing the identical call three lines away.

🟠 **[Bria] Stale chips cross lenses** — a quick-action chip on an old `dialogue` turn stays clickable after a `gestures` run replaced the conversation; clicking it sends a dialogue-lens prompt into the gestures-primed conversation. Nothing scopes a chip to the conversation it belonged to.

🟠 **[Oliver] A failed save vanishes without a trace** — `FileOperationsHandler.sendError` never logs to the output channel, the Workshop error banner filters out `file_ops.*` sources, and the error toast self-dismisses in 2200ms. A "my save didn't work" report has nothing to point to.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — `uiActions` is a second, unnamed DI channel competing with the Platform port pattern [🎯 Consensus]

`apps/vscode-extension/src/application/providers/ProseToolsViewProvider.ts:34` — Every existing capability crossing the extension→core boundary goes through a named seam: the `Platform` port bundle or the `MessageTransport` alias. `uiActions: { openWorkshop?: () => void }` is neither — an anonymous inline object type re-declared verbatim in `MessageHandler.ts`, then torn apart into a bare positional `openWorkshop?: () => void` in `UIHandler.ts`. Three shapes for one concept, zero shared type name. The capability is legitimate composition-root orchestration, but it deserves a named, exported type (e.g. `WorkshopUiActions` beside `MessageHandlerContracts.ts`); as written, the next contributor adding a second UI action has no established shape to extend.

### 🟡 Standard — `toolNameForResult` re-derives a wire contract that already lives (twice) elsewhere [🎯 Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:91` — The `toolName` strings (`dialogue_analysis`, `prose_analysis`, `writing_tools_<id>`) are the exact literals `AnalysisTab.tsx` already sends and `FileOperationsHandler`'s `FILE_PREFIX_MAP` treats as its routing contract. This PR adds a *third* independent site that must agree on the spelling instead of extracting the contract into `@shared/constants` — where this PR itself just added a module. The `null` fallback silently mints a fabricated `'writing_tools_editor'` identity for saved-file provenance rather than surfacing that the turn's tool was unknown.

### 🟡 Standard — The new `OPEN_WORKSHOP` seam has no test coverage on either branch [🎯 Consensus]

`packages/core/src/application/handlers/domain/UIHandler.ts:230` — `UIHandler.test.ts` asserts only `handlerCount >= 4` and never references `OPEN_WORKSHOP`. Neither the happy path (delegates to the injected callback) nor the fallback (`sendError('ui.workshop', …)`) is exercised — and the fallback is the actual runtime shape of the Workshop surface today.

> *"A clean new load-bearing wall for the Workshop's prompts, but the doorway you cut to reach it got framed three different ways on three different floors."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

No must-fix correctness, data-integrity, or contract defect survived tracing. Two bounded nits and one thing done right.

### 🟢 Nit — Save success fires two toasts (`SAVE_RESULT_SUCCESS` + file_ops `STATUS`) [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:134` — Both messages land on every save; two `setToast` calls, two different strings, timer resets on the second. Not a bug — last-write-wins collapses it to one visible toast, no data loss, no exception. Pick one source (`SAVE_RESULT_SUCCESS` is the structured one) and drop the `'Saved result'` STATUS branch.

### 🟢 Nit — Variation card React key collides if the model repeats a variation number [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:117` — `key={`${turn.id}-${variation.number}`}` trusts the model's captured digits; two "### Variation 1" headings collide. Bounded: duplicate-key warning, possible mis-reconciliation of stateless cards, content still correct. Key on the map index instead.

### 🟢 Praise — Display-label vs sent-prompt split is threaded correctly — no conversation-history corruption

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:316` — The diff's riskiest data path, done right: `handleQuickAction` sends the full template to `continueConversation` (the orchestrator records the real instruction) while `beginMessageRun` stores the short label for display. The model never sees the truncated label; the thread never leaks the verbose template. Both new tests pin the behavior.

> *"This one's clean — I'd merge it and actually sleep tonight; the two nits won't page anyone."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — `currentToolId` goes blind once the tool-run turn ages out of the 100-turn snapshot window

`packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx:31-40` — In a single-tool conversation exactly ONE turn in the whole thread carries `toolId` (the first tool-run user turn; follow-up assistant turns have `toolId: undefined`). `getSnapshot()` ships only the last 100 turns — so once a thread crosses 100 turns and the webview reloads, that one toolId-bearing turn falls outside the window. `currentToolId` never seeds, and two things break silently: the quick-action bar stops rendering for every visible turn (indistinguishable from "nothing to suggest"), and variation Copy/Save flows `toolId=null` into `toolNameForResult` → saved dialogue variations written under the generic `editor-` prefix. The fix is sitting unused one prop away: `session.selectedToolId` is the windowless, reload-safe authoritative selection.

### 🟡 Standard — Saving a variation always fires two overlapping, differently-worded toasts [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:134-135` — `SAVE_RESULT_SUCCESS` posts before the `openFileInEditor` await, the `'Saved result to …'` STATUS after it: every "Save to notes" click renders a toast, then silently swaps it for a textually different one. 100% reproducible on the shipped happy path; final state accurate; reads as a bug.

### 🟡 Standard — A repeated "Variation N" heading collides on the React key *and* the visible label [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:117` — Slicing is positional, so content stays correct, but both cards render the identical "Variation 1" header — the user can't tell which card's Copy/Save maps to which content. Requires the model to deviate from the requested numbering (plausible, not default).

> *"Turns out the empty-list case wasn't the trap here — it was the 'list has exactly one tool-tagged turn, and reload just walked past it' case, and it quietly rewires both the quick-action bar and the save filename at the same time."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟠 High — Save produces two competing toasts, wired through a prose-sniffing string match [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:132` — `handleSaveResultSuccess` already owns the save toast honestly via the typed message; the `text.includes('Saved result')` STATUS branch clobbers it a beat later. The copy branch is worse from the other direction: no `COPY_RESULT_SUCCESS` exists, so the toast's only signal is `text.includes('copied')` against `'Result copied to clipboard.'` — a hardcoded English sentence in a different file with no compile-time link and no test. Delete the `'Saved result'` branch; add a `COPY_RESULT_SUCCESS` mirroring the save contract (or at minimum share the status string as a constant).

### 🟠 High — `makeActions` infers prompt intent from button text instead of reading config [🎯 Consensus]

`packages/core/src/shared/constants/workshopQuickActions.ts:43` — `label.toLowerCase().includes('variation')` → variation template. For the seven bespoke tools the branch is provably dead (explicit `prompts[label]` overrides exist); for the seven fallback tools it is load-bearing: rename `'Generate 3 variations'` to `'Generate three options'` and those tools silently stop producing the `### Variation N` markdown the cards need — no type error, no test. `FALLBACK_LABELS` is a fixed 4-element array; give it an explicit prompts map like every other tool and delete the inference ternary.

### 🟡 Standard — Empty-state quick starts are a second, uncommented tool-id list that can drift from the rail

`packages/core/src/presentation/webview/WorkshopApp.tsx:460` — `RAIL_TOOL_IDS` is named and heavily commented ("the APPROVED Direction B prototype… PR #66 review, Bria"); the empty-state list `['dialogue', 'gestures', 'choreography', 'cliche']` is inline, unexplained, and re-does the `.find` lookup per item in JSX. (Bria cross-checked: the four tools *do* match the prototype's `welcome()` exactly — the gap is the missing name and rationale, not the choice.) Hoist as `EMPTY_STATE_TOOL_IDS` with a one-line why.

> *"The save toast literally changes its mind mid-air — that's not polish, that's two code paths that don't know about each other, and the next person to touch either one won't find out until a user files a 'flickering toast' bug."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — `parseVariations` has zero coverage for the exact markdown contract it depends on

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:41-45` — Searched the diff and `__tests__` — no test touches `parseVariations`, `WorkshopTurnBubble`, or `WorkshopThread`. The three shipped tests cover the prompt/state *plumbing*; the *rendering* the sprint headline depends on is unverified: the happy 3-variation path, the fallback for ordinary responses, malformed output (1 variation, mixed heading depths, whitespace-only sections — note `.filter(v => v.content.length > 0)` can shrink 2 matches below the threshold). A prompt-template tweak or model drift would silently degrade variation cards, and nothing would fail. Cheapest: a unit test file over `parseVariations` (0/1/2/3 matches, mixed levels) + one component test asserting card count and Copy/Save wiring.

### 🟡 Standard — `UIHandler.handleOpenWorkshop`: both branches untested, despite being a Sprint-04 acceptance criterion [🎯 Consensus]

`packages/core/src/application/handlers/domain/UIHandler.ts:230-236` — The route-registration test's `handlerCount >= 4` silently tolerates the new route. Neither path — injected callback invoked, or `ERROR` with `source: 'ui.workshop'` when absent — is asserted. A regression leaves the sidebar Workshop button doing nothing with no test and no crash. Two cheap cases in the existing describe block cover it.

### 🟡 Standard — The quick-actions map has no invariant tests, and its label routing is a silent substring match [🎯 Consensus]

`packages/core/src/shared/constants/workshopQuickActions.ts:33-47` — Nothing asserts: every one of the 14 tools resolves to a non-empty action list (7 fall through to `FALLBACK_LABELS` silently), exactly one `primary` per list, and `workshopQuickActionPrompt` returns `undefined` for unknown labels but a real prompt for every actual label. Riskiest untested piece: a future label like "Show variation in pacing" silently matching `.includes('variation')` and shipping the wrong template — a silent-wrong-prompt bug no typecheck or existing test catches. A table-driven test over `WORKSHOP_TOOL_CATALOG` locks all three invariants.

> *"Three tests shipped, five new components and a dispatch table didn't — that's not 'focused,' that's a confidence gap wearing a passing test suite as a disguise."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟠 High — The `uiActions` callback bag duplicates the pre-existing `prose-minion.openWorkshop` command and bypasses the established seam [🎯 Consensus]

`apps/vscode-extension/src/extension.ts:178` — `extension.ts` already registers `vscode.commands.registerCommand('prose-minion.openWorkshop', () => workshopPanelProvider?.openOrReveal())` — the *exact same call* — for the command palette. The PR builds a second, parallel injection mechanism (`uiActions` bag → `MessageHandler` → `UIHandler` positional param) to the same effect, with no precedent in `MessageHandler`'s pre-PR constructor. Compare `openSettings`'s established sibling shape in `ProseToolsViewProvider.ts:125-135`: one seam both callers invoke. If `openOrReveal`'s contract changes, it's easy to update one path and miss the other.

### 🟡 Standard — `WorkshopToolsModal` skips the codebase's `open`-prop contract for modals

`packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx:13` — Both existing modals — `AllToolsModal` (`tabs/AllToolsModal.tsx:51-58`) and `ModelBrowserModal` (`shared/ModelBrowserModal.tsx:7-15`, rendered by the very `ModelSelector` this file uses) — take `open: boolean` and self-guard with `if (!open) return null;`. `WorkshopToolsModal` is conditionally mounted instead. Harmless today (no internal state), but it breaks the contract the next dev will assume when they add search state the way `ModelBrowserModal` has.

### 🟡 Standard — New workshop components skip the file-header doc-comment convention

`packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx:1` — `ExcerptPanel`, `WorkshopComposer`, `WorkshopThread`, `WorkshopTurnBubble` all open with a `/** ComponentName — WHY … */` header. All three new components jump straight into imports — three-for-three, right as the pattern was supposed to be the default. `WorkshopToolsModal` in particular is a near-verbatim port of `AllToolsModal`, whose own 9-line header ("no invented tools") is exactly the provenance note now missing.

> *"We already registered a VS Code command that does this exact thing three lines down — we just built a second bridge to the same island instead of using the one that's already there."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — `quickActionsDisabled` punches a hole in the documented token-clock memo boundary — twice per run, not per token

`packages/core/src/presentation/webview/WorkshopApp.tsx:489` — `WorkshopThread` was built (PR #67 #6/#11) so `turns.map(...)` skips STREAM_CHUNK renders. `!workshop.canFollowUp` flips twice per run (session-state broadcasts, never mid-stream), but as a shared prop it forces every rendered `WorkshopTurnBubble` through a failed shallow-compare, re-running uncached `parseVariations()` for unchanged turns; `saveVariation`'s `[vscode, workshop.excerpt]` dep destabilizes `onSaveVariation` on the same cadence. Math: N turns × O(content) regex, 2×/run — low single-digit milliseconds today, and `MarkdownRenderer`'s own `useMemo` on the content string means no markdown re-parse. Doesn't matter now; matters if sessions become long-lived. `useMemo(() => parseVariations(turn.content), [turn.content])` is cheap insurance.

### 🟢 Praise — The suspected token-clock regression isn't real — traced it, the memo boundary holds

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:173` — `useVSCodeApi()` is a `useMemo` singleton, so `post`/`quickAction`/`copyVariation` are stable for the component's lifetime; `turns` never changes identity mid-stream; `streamingContent` is debounced to 100ms by the pre-existing `useStreaming`. Per-token cost of this PR's additions on the thread: zero.

### 🟢 Nit — `WORKSHOP_QUICK_ACTIONS_BY_TOOL`: built once at module load, O(1) lookups — confirmed fine, no action needed.

> *"Someone already fought this exact battle in PR #67 and left a memo boundary with a docstring explaining itself — this PR mostly respects it, and the one crack lets microseconds through, not the token clock."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — `SAVE_RESULT`'s `toolName` still reaches an unvalidated path-join — contained today only by CSP, not by an allowlist

`packages/core/src/presentation/webview/WorkshopApp.tsx:269` — `handleSaveResult` destructures `toolName` straight from the payload; an unmatched `writing_tools_*` name falls to the `` `${toolName.replace(/_/g, '-')}-` `` prefix and into `path.join`. Verified live: `writing-tools-../../../../tmp/pwned-1.md` resolves outside the target dir — a genuine write-outside primitive. Under the sanctioned UI flow `toolName` can never be attacker-chosen (`toolNameForResult` is closed over host-validated `WorkshopToolId`s), and the CSP (`script-src` nonce, no `unsafe-inline`) blocks the classic webview-compromise route — hence STANDARD, not HIGH. But `FileOperationsHandler` is the one handler in this chain without `WorkshopHandler`'s allowlist discipline; if the CSP or sanitization assumption ever regresses, this becomes a silent arbitrary file write.

### 🟢 Praise — Quick-action labels are matched against a closed, host-owned map — the model never gets to invent a prompt

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:301` — The webview sends only `{ toolId, label }`; the handler validates `toolId` via `isWorkshopToolId` and resolves the label against the static code-owned table, rejecting anything unrecognized before `continueConversation` is called — with a test pinning the rejection. The "model never invents a UI affordance" guarantee holds at the boundary, not just in the UI layer.

> *"A closed map stopped the label; an open path.join is still waiting on the same discipline."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — A Workshop save/copy failure has no trace anywhere after the toast fades

`packages/core/src/presentation/webview/WorkshopApp.tsx:146-147` — This PR is the first time `file_ops.*` errors can originate from the Workshop surface. When a save throws (disk full, no workspace), `FileOperationsHandler.sendError` — unlike `WorkshopHandler.sendError` — never writes to the output channel; the webview's persistent `pm-ws-error` banner drops the message (`useWorkshop` guards on `source.startsWith('workshop')`); and the error toast self-destructs after 2200ms. No log line, no banner, toast gone. A user who steps away mid-save gets a failure with nothing a bug report can point to. The sidebar, by contrast, surfaces every error source through its generic handler.

### 🟡 Standard — Copy-success toast has exactly one signal path, and it's a substring match on prose [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:132-133` — Save has the structured `SAVE_RESULT_SUCCESS` as a wording-independent second signal; copy has nothing but `text.includes('copied')` against `'Result copied to clipboard.'`. A wording pass silently kills the toast — the copy still works, it just goes from "confirmed" to "did that even do anything?" with zero code signal of the drift, and no test references the string.

> *"The save failed, the toast faded, and the output channel never heard a thing — see you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — A quick-action chip on a stale turn sends its old tool's prompt into whatever conversation is currently live

`packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx:40` — The acceptance criterion says "each assistant turn shows the **correct** per-tool quick-action chips; clicking one runs a templated follow-up in the same conversation." But `quickActionsDisabled` is one global flag, not scoped to the live turn. Run `dialogue`, then run `gestures` (which discards the old conversation and retains a new one) — the old dialogue chip stays clickable, and clicking it resolves the dialogue-lens prompt ("…stay in the Dialogue & Beats lens") into the *gestures*-primed conversation. Neither `handleQuickAction` nor `executeFollowUp` validates the chip's `toolId` against the conversation's origin tool. Is "any chip from any turn is always live" the intent, or should stale-turn bars disable once the conversation moves on?

### 🟡 Standard — Save-to-notes filenames are only "curated" for half the tools the new Save action exposes [🎯 Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:91` — `FILE_PREFIX_MAP` recognizes 8 names; `gestures`/`choreography` — two of the four empty-state quick-start tools this PR ships — fall to the generic `writing-tools-gestures-1.md` fallback while `dialogue`/`cliche` get polished `excerpt-assistant-dialog-beats-1.md` / `cliche-analysis-1.md` names. Sprint 04 is the first time Save-to-notes runs from *every* tool's cards: was extending the map in scope, or is the inconsistency an accepted gap?

### 🟡 Standard — Completion notes claim a "strict" variation format; the parser is deliberately looser than what's demanded

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:41` — Prompts demand exactly `### Variation N - [label]`; the regex accepts `##`–`####` and `-` or `:` (or neither). The permissiveness is probably the right engineering call (tolerates model drift) — but "strict" in the completion notes doesn't describe the code. Imprecise phrasing, or was a format-matching parser the intent?

> *"The chips all look correct on screen — it's only the conversation quietly listening on the other end that might be a completely different tool."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Prose Is Not Protocol

Illuminated by: Parker, Blake, Sam, Oliver, Cal, Bria (ledger #1, #2, #15, #16)

Text written for human eyes is the most rewrite-prone material in any codebase — and in a tool built *for writers*, it will be polished relentlessly. When code dispatches on a display label, matches an English sentence from another file, or keys React children on model-supplied numbering, it has quietly promoted decoration to load-bearing structure, and nothing will announce the promotion when the words change. The trap is perceptual: a string that is visible right there *feels* like stable data, but visibility is the opposite of stability — visible words attract editors.

→ Carry forward: Every time you write `.includes(` or `===` against something a human will read, pause and ask: "what is the identifier underneath this sentence?" Ship the identifier alongside the words, so the words stay free to change.

### Lesson 2 — Ask the Owner, Not the Neighborhood

Illuminated by: Sam, Bria, Marcus (ledger #4, #6, #9)

These bugs share one move — reconstructing a fact from surrounding circumstance (walking turns to find the one carrying `toolId`, assuming a chip belongs to whatever conversation is current, fabricating an identity when `toolId` is null) when the authoritative owner of that fact was one prop away. We write code in the present tense, where the context is obviously right there; the code runs in the future tense, after windows slide, conversations are replaced, and sessions reload. Truth derived from proximity expires with the moment; truth carried as explicit provenance survives it.

→ Carry forward: For any derived value, ask: "Who *owns* this fact, and will my derivation survive a reload, a replacement, or a sliding window?" If not, stamp provenance on the data when it is born, not when it is needed.

### Lesson 3 — The Second Bridge

Illuminated by: Marcus, Stan, Bria, Parker (ledger #3, #9, #11)

An anonymous inline capability three lines from an existing command doing the same thing; a wire contract declared in three files; a tool list hand-copied beside its heavily-documented original — each is a second bridge built beside a first one, agreeing with it only by coincidence. The mechanism is fluency: we go looking for existing abstractions when we feel confused, and sprint momentum is precisely the state in which we feel least confused and declare fastest. Duplicated knowledge is nearly invisible in a diff, because every copy looks complete on its own.

→ Carry forward: Before creating any cross-boundary shape — message type, capability, constant list — spend two minutes on one question: "Who already crosses this boundary, and who else already knows this fact?" If someone does, extend or name their crossing rather than pouring a new footing.

### Lesson 4 — Success Is Designed; Failure Is Inherited

Illuminated by: Oliver, Marcus, Cal, Patricia (ledger #5, #7, #8, #10)

The sprint's happy paths received real craftsmanship — chips, cards, toasts, a ticker — while its failure paths received whatever the defaults happened to be: an unlogged error, a banner that filters it out, evidence that evaporates in 2.2 seconds, the one handler without its siblings' validation, the headline parser with no tests. This is not carelessness; it is optics. A demo exercises success, so success feels verified — failure stays invisible until a user is standing inside it, and in a polish sprint, "polish" quietly narrows to what the happy user sees.

→ Carry forward: For every new affordance, narrate the failure story aloud: "The save fails at 4:03 — what does the user see at 4:03, and what can *we* see at 4:13?" If either answer is "nothing," that is unfinished design, not an edge case.

### Lesson 5 — Culture Remembers; Only Structure Protects

Illuminated by: Parker, Patricia, Stan, Tim — read against the panel's praise (ledger #2, #10, #12, #13, #14)

This codebase has a rare, genuine review culture — comments cite prior findings by reviewer and number, and old lessons are visibly absorbed. Yet the PR #67 memo boundary got punched through, one handler missed the validation discipline its siblings model, and new components skipped conventions every neighbor follows — because those lessons live in memory and prose, transmitted by copying whichever sibling happened to be open, and osmosis fails at sprint speed. A lesson is not fully learned until it lives somewhere that can say no without you: an invariant test on the label map, a type that refuses to compile, a named constant with its rationale attached.

→ Carry forward: When a review lesson lands, ask one more question: "Where does this lesson live besides our memory?" Then promote it — from citation to fixture, from folklore to something that can fail a build.

> *"A sentence can be beautiful and still not be load-bearing — the craft is knowing which of your words are for people, and which ones the machine is quietly standing on."* — Sensei

---

## The Closer

### 🔮 Fortune cookie

*Your greatest fragility lives in the string you matched instead of the message you owned.*

---

## Summary

**Nearly there — no blockers, merge after the seams are tightened.** The correctness core of Sprint 04 is genuinely solid: Blake traced the riskiest path (label-vs-prompt through conversation history) and praised it, Patricia confirmed the quick-action boundary holds, and Tim verified the token-clock discipline from PR #67 survived intact. What the panel found instead is a consistent pattern: informal seams (string-matched toasts, label-sniffed prompt routing, a three-shape anonymous injection bag beside an existing command) and a verification gap around the sprint's headline rendering path (`parseVariations`, `handleOpenWorkshop`, the quick-actions map). One product-semantics question needs an explicit decision before the epic lands on `main`: what a stale turn's quick-action chip should do. All of it is tractable within the branch; none of it should page anyone.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
