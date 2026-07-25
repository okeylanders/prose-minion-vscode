# MR Review — Sprint 13A: Open Chat — explicit session scope

**Author:** Okey Landers · PR #86 · `sprint/workshop-editor-tab-13a-open-chat` → `epic/workshop-editor-tab`
**Reviewed:** 2026-07-25

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | Pinning over a shelved passage takes the "first pin" branch — stale sidecars survive and the host is told it has never seen a passage | Blake | — | **Addressed** — `replaceExcerpt` branches on `excerpt ?? shelvedExcerpt`; delivery reason derived from `hostWriterSources`, not presence |
| 2 | 🟠 High | A fresh pin silently destroys the shelved passage; unrecoverable for pasted text | Blake, Sam | 🎯 | **Addressed** — discard made loud: named in the divider, returned to the caller, logged, confirmed for `manual` source, and re-pin added to the strip |
| 3 | 🟠 High | Shelving drops an undelivered revision; the later re-pin tells the host "unchanged" | Blake | — | **Addressed** — reason compares against the delivered version; `repinned` no longer hardcoded |
| 4 | 🟠 High | Preview pane re-parses full Markdown on every keystroke; both tabpanels always mounted | Tim | — | **Addressed** — preview renders only while selected; both panels carry `hidden` |
| 5 | 🟠 High | The "both slots occupied" checkpoint integrity guard has no test | Cal | — | **Addressed** — plus the pending-delivery-vs-withdrawal contradiction |
| 6 | 🟠 High | The `analysis.run` no-excerpt refusal (the defense-in-depth half) is never exercised | Cal | — | **Addressed** — new `openChatCapability()` fixture can express an excerpt-free room |
| 7 | 🟡 Standard | Two already-oversized files keep absorbing the feature instead of shedding it | Marcus, Parker, Stan | 🎯🎯 Strong | **Deferred** — tracked in [`.todo/tech-debt/2026-07-25-workshop-god-files.md`](../../.todo/tech-debt/2026-07-25-workshop-god-files.md) with named seams |
| 8 | 🟡 Standard | `WorkshopScopeStrip` infers its branch from excerpt presence and has no `scope` prop | Marcus | — | **Addressed** — takes `scope`; renders nothing rather than mislabel a non-open session |
| 9 | 🟡 Standard | Full-reset log records that a wipe happened, not what was wiped | Oliver | — | **Addressed** — working set captured pre-wipe and returned as `WorkshopResetSummary` |
| 10 | 🟡 Standard | Highest-frequency new IPC handler has no logging and bypasses `sendError` | Oliver | — | **Addressed** — logs both paths; the miss now routes through `sendError` |
| 11 | 🟡 Standard | Double-negative icon ternary derives the one case that matters from its complement | Parker | — | **Addressed** |
| 12 | 🟢 Nit | One bare `#33362f` border among 16 tokenized neighbors | Stan | — | **Addressed** — same `color-mix` expression as the card's own icon |
| 13 | 🟢 Praise | Capability gate genuinely enforced host-side, not just omitted from the prompt | Patricia | — | **N/A** |
| 14 | 🟢 Praise | `WorkshopTextSheet` earns its "one sheet, five modes" claim | Parker | — | **N/A** |
| 15 | 🟢 Praise | Late-reply-discard and `undefined`-array-item tests are real boundary tests | Cal | — | **N/A** |
| 16 | 🟢 Praise | Per-open attachment fetch verifiably avoids the broadcast | Tim | — | **N/A** |
| 17 | 🟢 Praise | Scope-vs-excerpt separation honored everywhere it is claimed | Bria | — | **N/A** |

---

## Blast Radius

- 46 files changed · +5338 / −486 lines
- New files: 5 webview components (`WorkshopTextSheet`, `WorkshopPathChooser`, `WorkshopScopeStrip`, `WorkshopOpenChatStart`) + 2 test suites · Migrations: none (but a one-time **persisted checkpoint** migration at the hydration boundary) · New services: none
- Diff is 7,574 lines — reviewers worked from the diff plus full source reads in their lane
- Three commits: the 13A feature, a pre-existing save-bug fix, and an added-beyond-scope full reset

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🔥 Correctness | F |
| 🛡️ Security | A |
| 🧪 Tests | C |
| 📖 Quality | B |
| ⚡ Performance | C+ |
| 🎯 Domain | A |

The split is unusual and worth reading carefully: **spec conformance and security are excellent**, and the correctness failure is not a sloppy one — it is the sprint's own principle surviving one layer below where it was fixed.

---

## Executive Briefing

🔴 **[Blake]** Pinning a new passage while one is shelved takes the `!previous` "first pin" branch — stale tool sidecars survive, `chatTarget` is never pulled back, and the host is told *"This is the FIRST passage you have been given here"* while its own transcript still holds the earlier one. Untested. **Verified line by line by the orchestrator.**

🟠 **[Blake + Sam]** 🎯 A fresh pin silently destroys the shelved passage. For a hand-pasted excerpt the shelf is its only home — no confirmation, no divider naming it, and the scope strip offers "Add excerpt" with no re-pin affordance and a blank seed.

🟠 **[Blake]** Shelving discards an undelivered excerpt revision; the later re-pin hardcodes `repinned` and tells the host the passage is back *"unchanged"* when the host is holding a superseded version.

🟠 **[Cal]** Both halves of this sprint's deliberate defense-in-depth are untested: the checkpoint "both slots occupied" guard has never been asked to throw, and the `analysis.run` no-excerpt refusal has no test because every fixture builds an adapter with an excerpt already set.

🟠 **[Tim]** The Edit/Preview sheet keeps both panes permanently mounted — the tab only toggles a CSS class — so a full `marked()` + DOMPurify pass runs over the entire draft on every keystroke, in a tab the writer isn't looking at.

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🔴 Blocking — Adopting a new passage while one is shelved takes the "first pin" branch

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:527`

`replaceExcerpt` branches on `const previous = this.excerpt`. Shelving sets `this.excerpt = undefined` (line 392) while leaving the passage in `shelvedExcerpt`, so a subsequent pin in an open room falls into the `!previous` branch and skips every staleness protection the real branch provides.

Failure path, all reachable from the open-conversation card this PR adds:

1. Writer pins passage A → v1, scope `excerpt`.
2. Writer runs the Prose tool → `participants.toolSidecars.prose` retains a conversation that read A.
3. Writer sends a host message → the host's retained history now contains `<pinned-excerpt version="1">` with A's text.
4. Writer clicks "Set this aside" → A goes to the shelf, `pendingExcerptWithdrawal = true`, sidecars deliberately untouched.
5. Writer clicks "Paste or type" and saves passage B → `previous` is `undefined` → `!previous` branch.

Consequences at step 5:

- `disposedConversationIds: []` and `retiredSidecarCount: 0` — the `prose` sidecar whose conversation only ever read A survives, and `chatTarget` is not pulled back to `host` (the real branch does both, lines 549–557). The writer can continue a tool conversation about A while the room reports it is about B.
- `replacementCount` never increments, so the excerpt-revision cost warning never fires on this path.
- `setExcerpt` clears `pendingExcerptWithdrawal` and the branch queues `excerptChange: 'added'`, shipping the host: *"This is the FIRST passage you have been given here — you have not seen it or any other before now."* The withdrawal frame is never delivered either, so the host is never told A left. That is a false assertion contradicting the model's own history — exactly the distinction the reason tags were introduced to protect.

**Coverage checked:** `WorkshopSessionScope.test.ts`. The nearest case, *"adopts a NEW excerpt mid-open-chat as an addition"* (line 178), calls `setSessionScope('open')` on a room that was **never** pinned — `v1` in its assertion confirms it — so the shelf is empty and the host has read nothing. Every `setSessionScope` call site under `__tests__` was checked; none is followed by `setExcerpt`/`replaceExcerpt` with a populated shelf.

**Fix direction:** derive the reason and the retirement decision from what the host actually holds (`activeHostPin?.excerptVersion` / `shelvedExcerpt`) rather than from `this.excerpt` being momentarily empty.

### 🟠 High — A fresh pin silently destroys the shelved passage [🎯 Consensus with Sam]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:515`

The comment says *"A fresh pin supersedes anything on the shelf; nothing silently lingers"* — but nothing silently *lingering* is not the same as nothing silently *vanishing*. The contract the UI sells is "shelved, not deleted" (the `setSessionScope` doc, the ExcerptPanel "Re-pin {title} v{n}" button, the divider "same session, conversation retained"). Then one click on "Paste or type" in the same card deletes it.

Path: pin a hand-pasted passage (`source.kind === 'manual'` — text that exists nowhere else, no file on disk, not in the transcript) → "Set this aside" → shelf holds it → "Paste or type" a different passage → `setExcerpt` drops `shelvedExcerpt` on the floor. No confirm dialog; the divider says only "Excerpt added · … — same session, conversation retained" and never mentions the discarded passage; the "Re-pin" affordance simply disappears.

Contrast the destructive `reset({clearWorkingSet:true})`, which the author correctly put behind `sessionConfirm.kind === 'new-full'` **with a dialog that states what survives**.

Either preserve the shelf, or make the discard visible: name the dropped passage in the divider and confirm before throwing away a `manual`-source excerpt. Note that preserving both slots collides with the integrity rule forbidding both — so this needs a decision, not just a patch.

### 🟠 High — Shelving drops an undelivered excerpt revision

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:396`

`setSessionScope('open')` discards `pendingRevisionVersion`/`pendingExcerptChange` unconditionally — including a revision the host was queued to receive but never got. Nothing records that the host still holds an older version, and `adoptShelvedExcerpt` hardcodes `'repinned'` on the way back.

Sequence: host reads A v1 → writer revises to v2 (`pendingRevisionVersion = 2`, `'revised'`) → writer shelves before sending anything → the v2 delivery is dropped → writer re-pins → the host gets the `repinned` lead: *"You have it again, **unchanged**, at the version below."* The host never saw v2 and never receives the `revised` lead's operative instruction, *"Earlier versions in this conversation are superseded."* It has v1's wording in history, is told the passage is unchanged, and will keep treating its v1 analysis and quotations as current.

The aggregate already knows the answer — `activeHostPin?.excerptVersion` is the version the host was actually handed. Choose the reason by comparing against it rather than by which method was called.

> *"The shelf is only 'not a deletion' until someone pastes over it, and telling a model it has never seen a passage sitting in its own transcript is how you get an assistant that argues with its own history."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — "Add excerpt" on the scope strip silently destroys a shelved passage instead of restoring it [🎯 Consensus with Blake]

`packages/core/src/presentation/webview/components/workshop/WorkshopScopeStrip.tsx:62-80`

The UI half of finding #2, traced independently from the other end. `WorkshopScopeStrip`'s "open, no excerpt" branch renders both when nothing has ever been pinned *and* when scope is `open` with a `shelvedExcerpt` present — `withdrawalPending` only changes the caption text, not the button. Its one action, `onAddExcerpt`, wires straight to `openPasteSheet` (`WorkshopApp.tsx:1076`, `1253`), whose seed is `workshop.excerpt?.text ?? ''` — note it reads `workshop.excerpt`, **not** `shelvedExcerpt`, so in this exact state the sheet always opens blank.

A writer who shelved a passage and later uses the strip's own "Add excerpt" button — rather than the "Re-pin" affordance that lives only in the rail's `ExcerptPanel` — gets a blank sheet, types something, hits Apply, and the shelved passage is gone: no divider, no confirmation, and nowhere to look for it, because the shelf is one slot and holds no history.

Worth noting against the spec: sprint §4 reads *"'Add excerpt' in the scope strip, rail card, and composer, plus **Re-pin title vN** when something is shelved."* The rail got the re-pin. The strip didn't.

> *"Found the trap door — shelve a passage, then hit the strip's own 'Add excerpt' button instead of the rail's 'Re-pin,' and your set-aside chapter vanishes with no divider, no confirmation, and nowhere left to look for it."* — Sam

---

## 🧪 Cal · Test Advocate

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The "both slots occupied" checkpoint integrity guard has no test anywhere

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:29`

`WorkshopSessionScope.test.ts` gives real confidence that the *aggregate* never produces a state with both slots filled — every shelve/pin/re-pin path is exercised and always clears one slot when setting the other. But that is confidence in the **writer**, not the **reader**.

`validateWorkshopSessionStateV1` runs on every `hydrateCommittedState` and is this sprint's stated boundary for "reject a checkpoint holding both slots" — the guard against a disk-corrupted or hand-edited pre-13A checkpoint. Searched the full diff and the entire `__tests__` tree for `validateWorkshopSessionStateV1`, `WorkshopSessionStateV1Integrity`, and the error string itself — no test constructs a state with both `excerpt` and `shelvedExcerpt` populated and asserts the throw.

If this condition were inverted, dropped, or short-circuited by a future edit, nothing would fail red; a malformed checkpoint would hydrate silently with `versionedExcerpt = state.excerpt ?? state.shelvedExcerpt` quietly picking one slot and ignoring the version mismatch on the other — exactly the staleness-truth failure this sprint exists to prevent.

### 🟠 High — The persona-facing `analysis.run` refusal is never exercised

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:479`

The sprint doc is explicit that this is defense-in-depth: `analysis.run` is removed from the capability *instruction*, **and** refused with a reason if a non-compliant persona emits the call anyway. `workshopPromptFrames.test.ts` and `WorkshopCapabilityXmlCodec.test.ts` cover the instruction-removal half well.

But `WorkshopPersonaCapability.test.ts` builds its adapter through one shared `capability()` helper fed by a `beforeEach` that unconditionally calls `session.setExcerpt(...)` and passes `excerpt: session.getExcerpt()!`. There is exactly one `.create(...)` call site in the file, and it always carries a real excerpt. The only "rejected" `analysis.run` test exercises the *budget* guard at dispatch, not the *no-excerpt* guard inside `runAnalysis` — a different branch behind a different condition.

The fixture cannot express the state the guard exists for.

### 🟢 Praise — The late-reply discard and `undefined`-array-item tests are genuine boundary tests

`packages/core/src/__tests__/presentation/webview/hooks/domain/useWorkshop.test.ts:1077`

This is the kind of test worth naming. It doesn't assert the happy path — it constructs the exact race the code comment warns about: request `ctx-2`, deliver a reply stamped for `ctx-1`, assert the stale payload is dropped rather than painted over the pill the writer is now looking at. Same discipline in `WorkshopSessionPersistence.test.ts:230` (*"still refuses an undefined ARRAY item, which JSON would write as null"*) — it isolates the one asymmetric case a less careful pass would have conflated into a single assertion.

> *"The integrity check that throws on a corrupted checkpoint has never once been asked to throw — a guard nobody has watched fire is just a comment with delusions of enforcement."* — Cal

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟠 High — Preview pane re-parses full Markdown (and re-derives word count) on every keystroke

`packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx:328-343`

Both the Edit pane (line 294) and the Preview pane (line 328) are mounted unconditionally — `tab` only toggles a CSS class (`pm-ws-text-sheet-pane-on`), it never removes either subtree from the DOM. `MarkdownRenderer` memoizes its `marked()` + `DOMPurify.sanitize()` work on its `content` prop, but that memoization buys nothing here because `content={draft}` and `draft` is the textarea's own controlled-input state — it changes on literally every keystroke. So every character typed re-runs a full markdown parse and sanitize pass over the entire draft, plus an unmemoized `countWords(draft)` (line 221) — **while the writer sits in the Edit tab looking at neither pane's output.**

This deviates from a sibling in the same codebase: `WorkshopConversationBehaviorModal.tsx` gates its two-tab body with `{tab === 'behavior' ? (...) : (...)}`, actually unmounting the inactive tab.

Math: the sheet's own copy caps excerpts at "Head-sliced past 10,000 words" (~60KB). Parsing and sanitizing a document that size on every keystroke is tens of milliseconds of main-thread work per character — well past a 16ms frame budget, and it will read as input lag during exactly the primary interaction this component exists for. **This matters at the sprint's own stated scale**, not at some hypothetical larger N.

**Orchestrator addendum:** both `<div role="tabpanel">` elements sit in the DOM with no `hidden` attribute, so a screen reader is offered **both** panels regardless of the selected tab. Rendering the pane's children only when active closes the input lag and the accessibility defect in one change.

### 🟢 Praise — Per-open attachment fetch actually avoids the broadcast, and the late-reply race is closed correctly

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:475-483`

Verified end to end. `WorkshopApp.tsx:538` only calls `requestContextAttachment` when `attachment.content === undefined` — the file-kind case; text notes reuse the body already on the snapshot rather than round-tripping. The request/response pair carries one id and one body, not the whole attachment list, so the claimed ~200KB-per-snapshot avoidance is real, not aspirational. And the discard-on-close guard only applies a reply whose `id` still matches the pending marker.

> *"The preview pane does a full markdown parse on every keystroke you make in a tab it isn't showing — memoized against a value that changes on every keystroke is not memoized at all."* — Tim

---

## 🏛️ Marcus · Architect

"The Cartographer of Layer Boundaries"

### 🟡 Standard — The aggregate and its handler keep absorbing responsibility instead of delegating it [🎯🎯 Strong Consensus with Parker and Stan]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts`

`WorkshopSessionService.ts` is 2,446 lines (+409 this sprint) and `WorkshopHandler.ts` is 2,680 (+256). Every other file in the same directory tops out under 1,000 — including the side-cars the sprint's own convention points to (`WorkshopAnalysisSidePass.ts` 211, `RunWorkshopToolSidePass.ts` 305, `WorkshopContextResourceService.ts` 117). Every sibling domain handler is a fraction of `WorkshopHandler`'s size (`ConfigurationHandler.ts` 557, `AnalysisHandler.ts` 400, `WorkshopSessionMessageHandler.ts` 303). CLAUDE.md's own anti-pattern checklist flags "any file > 500 lines."

This sprint had a natural seam — the scope/shelf state machine (`setSessionScope`, `repinShelvedExcerpt`, `adoptShelvedExcerpt`, `scopeTransition`, `recordScopeChange`, ~140 new lines) is a cohesive, independently-testable concern, much as `RunWorkshopToolSidePass` was pulled out for tool runs — and instead it landed inside the two files the checklist already calls the worst offenders.

Both files were already past the threshold *before* this PR, so this is flagged as pre-existing debt with a worsening trend line, not as a blocker on 13A.

### 🟡 Standard — `WorkshopScopeStrip` infers its display branch from excerpt presence, not from a `scope` prop it doesn't have

`packages/core/src/presentation/webview/components/workshop/WorkshopScopeStrip.tsx:41`

The sprint's stated rule is *"every surface keys off scope. Nothing may infer 'open conversation' from a missing excerpt"* — and its own new sibling components honor that literally: `ExcerptPanel.tsx:46-47` takes `scope: WorkshopSessionScope` with the comment *"this block's three states key off it, not off `excerpt`,"* and `WorkshopComposer.tsx:44` takes the same prop.

`WorkshopScopeStrip` is the third new component in this batch and has no `scope` prop at all — it decides "passage treatment" vs. "open conversation" purely from whether `excerptTitle`/`excerptVersion` are defined. It renders correctly today only because `WorkshopApp.tsx:1067` mounts it solely when `scope === 'open'`. But the component's public contract no longer states the invariant it depends on: an `'excerpt'`-scope caller would silently get "Passage session" copy. Either add `scope` as an explicit prop or pin the contract in a comment, so a future caller doesn't reuse it in the passage-scope rail without noticing.

> *"The shelf is a real aggregate concept and the ports hold clean — the thing that gives me pause is that two files are quietly becoming the load-bearing wall for the whole feature, and one new component just went shopping for the old 'infer from excerpt' habit the rest of the sprint worked hard to retire."* — Marcus

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — `WorkshopHandler.ts` keeps growing past the file's own documented escape valve [🎯🎯 Strong Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:337`

2,680 lines after this PR — nearly 5× the next-largest sibling domain handler. The interesting part is that this codebase **already proved the fix on this exact file**: `WorkshopSessionMessageHandler.ts` (303 lines) was carved out as a sibling that owns session lifecycle routes and is wired via `this.sessionMessageHandler.registerRoutes(router, registerMutation)`.

The new session-scope routes (`WORKSHOP_SET_SESSION_SCOPE`, `WORKSHOP_REPIN_EXCERPT`, the context-attachment trio) went straight into the god file instead of a new `WorkshopScopeMessageHandler.ts` following that same pattern — even though the PR's own doc comments group them under a clearly separable *"Session scope (Sprint 13A §2/§4)"* banner at line 1368.

### 🟢 Nit — One-off hardcoded hex breaks the `--pm-*` token vocabulary

`packages/core/src/presentation/webview/workshop.css:3351`

Every other border-color in this +849-line addition resolves through a token — `var(--pm-border)`, `var(--pm-border-2)`, or a `color-mix(in srgb, var(--pm-green) …)` expression, as seen two lines later on `.pm-ws-path-card-chat .pm-ws-path-icon`. `#33362f` is a bare literal with no named token backing it, so a future theme pass will silently miss this one border.

> *"The file already has a working escape hatch sitting right next to it — `WorkshopSessionMessageHandler.ts` proved decomposition ships fine here, it just didn't get invited to this sprint."* — Stan

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — Double-negative boolean expression for a single icon choice

`packages/core/src/presentation/webview/WorkshopApp.tsx:818`

```
<Icon name={workshop.excerpt || workshop.scope !== 'open' ? 'doc' : 'dialogue'} size={12} />
```

True (→ `doc`) whenever an excerpt exists *or* scope isn't `'open'`, and false (→ `dialogue`) only in the one case that actually matters — open scope with no excerpt. The `||` plus `!==` forces a double negation to find that case. Say it directly: `workshop.scope === 'open' && !workshop.excerpt ? 'dialogue' : 'doc'`. Same truth table, but it names the actual condition ("open chat with nothing read yet") instead of deriving it from its complement.

### 🟡 Standard — Two already-oversized files keep absorbing new logic [🎯🎯 Strong Consensus]

See Marcus and Stan above. Parker's addition: the webview side has the same shape — the scope-transition callbacks (`startOpenConversation`, `continueWithExcerpt`, `hasWorkingSet`, the three session-confirm branches) at `WorkshopApp.tsx:426-478` are self-contained enough to be a `useWorkshopSessionBoundary`-style hook, following the Tripartite Hook pattern the sibling `useAnalysis`/`useContext` hooks already use to keep the app a thin orchestrator.

### 🟢 Praise — `WorkshopTextSheet` actually earns its "one sheet, five modes" claim

`packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx:82`

Went in expecting a mode switch wearing a trench coat; didn't find one. `sheetCopy()` isolates the only thing that actually varies per mode — copy, labels, the `readOnly` flag — into one exhaustively-typed function, and `WorkshopTextSheetMode` is a proper discriminated union, so a sixth case would be a compile error rather than a silent fallthrough. Everything downstream reads `copy.readOnly` and stays a single code path. That's the honest way to unify five call sites: one branch point, not five.

> *"The icon ternary and the two-file weight gain are worth ten minutes now; the text sheet is proof this PR knows how to unify five things into one without cheating."* — Parker

---

## 🌙 Oliver · Observability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Full-reset discard log records that a wipe happened, not what was wiped

`packages/core/src/application/handlers/domain/WorkshopSessionMessageHandler.ts:100-103`

The only trail a destructive full reset leaves is a fixed string: *"(full reset: excerpt and context cleared)."* No excerpt title, no attachment count, no labels. If a writer later reports "it deleted my context" and disputes what was in the room, there is nothing to check the claim against — the log can neither confirm nor refute it.

The frustrating part: the data was sitting right there and got thrown away one call earlier. `WorkshopSessionPersistenceCoordinator.resetSession()` calls `captureRollback()` *before* `session.reset(options)` mutates the aggregate, and that snapshot holds the full `excerpt` and `contextAttachments` array pre-wipe. It's discarded once rollback is no longer needed. Fixing this needs no new plumbing beyond forwarding a field that's already computed a few lines up, or logging inside the coordinator where the pre-wipe snapshot is still in scope.

### 🟡 Standard — The highest-frequency new IPC handler is the one with no log line, on either path

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1304-1329`

`handleRequestContextAttachment` fires on every pill click in the new per-open fetch flow — by design the most frequently invoked of the three new attachment handlers. It has zero `appendLine` calls on any path, including the "attachment no longer attached" branch, which embeds its error directly in the response payload rather than going through `sendError` (the pattern every sibling handler uses for webview-visible errors).

This stands out because its two neighbors, added in the same commit, both log: `handleUpdateContextText` logs success, and `handleOpenContextAttachmentFile` logs both success and failure. The writer isn't blind — the sheet renders `payload.error` inline — but a reported silent-error pill, or a race between two sheets where one removes an attachment the other is mid-fetch on, has nothing to correlate against.

> *"The rollback snapshot had the excerpt's name in it a heartbeat before we threw it away — now the log just says 'gone,' and gone isn't a diagnosis."* — Oliver

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

**No risk findings.** Clean review.

### 🟢 Praise — Excerpt-scoped capability gate is genuinely enforced host-side, not just omitted from the prompt

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:471-483`

Traced the way an attacker would: assume the persona ignores the instruction text entirely — `createWorkshopCapabilityInstruction` with `excerptAvailable: false` merely omits the `analysis.run` example block, and nothing stops a malicious or confused completion from emitting the XML call anyway. If it does, `dispatch()` routes to `runAnalysis()`, which reads `this.turn.excerpt` — **a value the model never controls** — and refuses before touching `analysisSidePass.run`. Cross-checked the caller: `beginPersonaMessage` → `requireHostSubject()` independently gates the turn, so there is no path where a turn without an excerpt reaches this code with a spoofed excerpt. Two independent host-side checks, not one instruction-level door. Also confirmed `resource.read` resolves against a pre-enumerated allowlisted catalog rather than touching the filesystem with a persona-supplied path.

**Orchestrator verification:** the new Preview tab's sanitization claim was checked directly rather than accepted. `WorkshopTextSheet:340` uses the shared `<MarkdownRenderer content={draft} />`, which runs `marked` output through DOMPurify with an explicit `FORBID_TAGS` list including `img`, carrying this rationale: *"Images are deliberately forbidden: even a harmless-looking Markdown image can become an automatic network beacon carrying prompt-injected data."* The failure path re-sanitizes rather than falling back to raw input. A malicious project file or LLM-authored note rendering into the new Preview tab is genuinely contained.

> *"The prompt tells the model what it may ask for; the dispatcher — not the prompt — decides what it actually gets, and here those two layers agree."* — Patricia

---

## 🎯 Bria · Domain Logic

"Does This Code Actually Do What the Ticket Asked?"

**No divergence found.** Clean review.

### 🟢 Praise — Scope-vs-excerpt separation is honored everywhere it's claimed to be

Walked all 11 scope items, the Exit criteria, the locked product decisions, the non-goals, and the added-beyond-scope full reset against the diff and source. Grepped the full diff for `excerpt !== undefined`-style scope inference outside the hydration boundary — **found none**. `requireHostSubject`, `setSessionScope`, the tool-gating `hasExcerpt` check, and the `ExcerptPanel` rendering all key off explicit `scope`, or off excerpt-presence-for-*gating* (not for scope) — §1's "nothing infers scope from excerpt presence" and §9's "tools disabled until an excerpt exists" implemented as two genuinely distinct rules, which is the subtle thing this sprint could most easily have collapsed.

Also verified: the four clears and two retains at the session boundary are correct; all three reversals shelve rather than delete; the shared sheet's wizard edits never touch disk; tool gating is `aria-disabled` and toast-announced through the existing `aria-live` infrastructure; the §10 status copy matches verbatim in all three places; the full reset zeroes `revisions.excerpt` and rolls back completely on a failed promotion.

The one place scope is derived from excerpt — `state.scope !== undefined ? state.scope : excerpt ? 'excerpt' : null` at hydration — is exactly the documented one-time migration.

> *"I came in ready to find the trapdoor where excerpt presence quietly became scope — and instead found the migration boundary doing exactly the one job the spec allowed it to do, nothing more."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Presence Is Not History

Illuminated by: Blake's blocker; Blake's shelved-revision finding

Current state can tell you what *is*; it cannot tell you what *was delivered*. The aggregate asked "is a passage pinned right now?" and used the answer to decide what the host had already seen — two different questions that happen to agree in the common case and diverge exactly when it matters. Whenever you must reason about what another party knows, that knowledge is its own fact and needs its own field. The truth was already sitting there in `activeHostPin.excerptVersion` — the record existed; the code just preferred the nearer question.

→ Carry forward: When a branch decides what to *tell* someone, ask — am I comparing against what they hold, or against what I hold? If those can ever differ, branch on the comparison, never on the presence.

### Lesson 2 — A Reasoning Error Has an Altitude; Fix It at All of Them

Illuminated by: Blake's blocker and shelved-revision finding, read against the sprint's own governing principle

This sprint was written to abolish one specific mistake — inferring scope from excerpt presence — and it succeeded at the UI and scope layers with real rigor. Then the identical inference survived one floor down in the aggregate, wearing different words. This is the most common shape of an incomplete fix: we patch where the symptom was *observed* rather than everywhere the *reasoning* lives, because the principle feels handled once the visible instance stops hurting.

→ Carry forward: When a fix is important enough to name in a spec, treat the name as a search term. Before closing, hunt for the same question asked in other vocabulary at other layers — "is it pinned," "does it have one," "is it non-null" are all the same question wearing hats.

### Lesson 3 — The Contract Is What You Promised, Not What You Commented

Illuminated by: The shelved-passage consensus finding; the reset-confirmation contrast

`setExcerpt` carries a comment that reads like considered policy — *"A fresh pin supersedes anything on the shelf; nothing silently lingers"* — and it is internally coherent, defensible, and in direct contradiction to what the entire UI told the writer: **shelved, not deleted**. A comment certifies that a decision was made; it cannot certify that the decision matched the promise made upstairs. Notice too the asymmetry in care: the *loud* destructive action got a confirmation dialog naming what survives, while the *quiet* one — reachable through a button labeled "Add excerpt" — got nothing. We instinctively guard the actions that feel destructive, and the dangerous ones are precisely those that don't.

→ Carry forward: For every line that discards user-authored data, ask two questions in order — what did the interface lead them to believe would happen, and is this path guarded as well as the scariest-sounding path in the same feature?

### Lesson 4 — A Guard Is Only Depth If Something Makes It Fire

Illuminated by: Cal's checkpoint-integrity guard; Cal's `analysis.run` refusal

Both guards were written for a world the test suite cannot construct — a hand-edited checkpoint, a model that requests what the prompt never offered. They are the *second* layer of a deliberate defense-in-depth design, and the second layer is the entire point. The subtle culprit isn't discipline, it's the fixture: every test builds its adapter through one helper that unconditionally sets an excerpt, so the invalid state isn't merely untested — it is *unexpressible* by the tooling. A test helper that can only produce valid worlds silently defines the boundary of what you are able to worry about.

→ Carry forward: When you write a check for "this can never happen," write the test that makes it happen — and if your builder won't let you, treat that resistance as the finding.

### Lesson 5 — Hidden Is Not Absent

Illuminated by: Tim's preview-pane finding and its accessibility tail

A CSS class that hides an element changes what the eye receives; it changes nothing about what the machine does or what the accessibility tree reports. The preview pane re-parses and sanitizes the entire draft on every keystroke typed in a different tab — and its `useMemo` is honest, it just memoizes against a value that changes every keystroke, which is memoization performing the gesture of caching without the substance. Visibility and existence are separate axes; conflating them costs work you never see and exposes structure you never meant to offer.

→ Carry forward: Every time you hide something, say out loud which you meant — "don't show this" or "this shouldn't exist right now." If it's the second, unmount it.

> *"You had the truth on hand the whole time — the version the host was holding, the snapshot taken just before the wipe, the passage sitting on the shelf — and nearly every finding here is a small moment where the code chose the nearer question over the true one."* — Sensei

---

## The Closer

### 🚪 Knock Knock

> **Knock knock.**
> *Who's there?*
> **Your excerpt.**
> *Your excerpt who?*
> **Exactly. You pasted over me, and now the host swears we've never met.**

---

## Summary

This is strong, unusually self-aware work — the spec conformance is clean (Bria found no divergence across 11 scope items), the security boundary is genuinely enforced rather than merely advertised, the shared text sheet earns its abstraction, and the PR fixed a pre-existing save bug it did not cause. The sprint doc's candor about where the comp and product disagreed is exactly the right instinct.

It is not merge-ready. One blocking correctness bug — `replaceExcerpt` taking the "first pin" branch when a passage is shelved — lets a stale tool sidecar survive and tells the host it has never seen a passage that sits in its own transcript, which is precisely the honesty guarantee this sprint was built to make. It shares a root cause with two of the three HIGH findings: the sprint abolished "infer from presence" at the layer where it was noticed, and the same reasoning survived one layer below. Fix the aggregate's reason-derivation (compare against `activeHostPin.excerptVersion`), decide what a fresh pin should do to the shelf, and gate the preview pane's render. The two untested guards should get tests in the same pass — they are the cheapest items here and they protect the exact invariants that just proved fragile.

---

## Resolution notes — 2026-07-25

All findings except #7 are addressed. Highlights of how, since several fixes
share one root cause:

**The root fix (#1, #3).** The aggregate now answers "what does the host hold?"
from the delivery record rather than from current state. `hostWriterSources`
retains every pin row it ever shipped — including superseded ones, kept for
Phase 7's dimmed history — so `hostDeliveredExcerptVersion()` reads the last
version actually handed over, and `excerptDeliveryReason()` names the delivery
by comparing against it: no record → `added`, same version → `repinned`,
otherwise → `revised`. Every path that queues an excerpt frame now routes
through one `queueExcerptDelivery()`, so no call site chooses its own tag.

This closed two cases beyond the two reported:

- A pin queued for the host but never shipped, then revised, previously
  reported `revised` to a host holding nothing. It now reports `added`.
- Shelving queued a withdrawal even when the host had never received the
  passage. It now only withdraws what was actually delivered.

**The shelf decision (#2).** One-slot integrity is kept — the alternative
required relaxing the V1 invariant across persistence, hydration, and the
guard. The discard is made loud instead, at four levels: the divider names the
displaced passage (`set-aside “one” v1 discarded`), `replaceExcerpt` returns it
as `discardedShelvedExcerpt`, the handler logs it as the only surviving record,
and a `manual`-source shelf confirms before it can be replaced — the same care
the full reset already had. `WorkshopScopeStrip` also gained the `Re-pin` the
rail already had, so the destructive action is no longer the only one there.

**Tests.** 17 added across 4 suites (1,322 → 1,330 passing, plus a new suite):
the two guards Cal named, the blocking path and both HIGH aggregate paths, and
a first `WorkshopScopeStrip` suite covering the new branch and the scope
contract. One existing test changed: `WorkshopTextSheet` "keeps the source
visible but not editable" was reaching into the inactive tabpanel, which the
`hidden` fix correctly hides from accessible queries — it now clicks through to
the Source tab, which is also what a writer does.

Verified: `tsc --noEmit` clean on both core and webview projects, `npm run
lint` 0 errors, full suite green.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
