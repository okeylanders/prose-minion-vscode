# PR Review — Sprint 02B-A: agent-prepared widgets and interaction polish

**Author:** okeylanders · **PR:** [#99](https://github.com/okeylanders/prose-minion-vscode/pull/99) (Open)
**Branches:** `sprint/conversation-widgets-02b-a-assists-and-polish` → `epic/conversation-widgets`
**Base:** `9ec3bd6` · **Head:** `50b5065` · **Scope:** 73 files · +1,984 / −463
**Reviewed:** 2026-08-01 · **Mode:** `/pr-review-ts-react-vsce` — PR mode, Forge crew (10 specialists)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Signal | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | 🔴 Blocker | A failed gesture commit discards the writer's paid draft; the toast promises "your selections are kept" and no UI door exists | Marcus, Sam, Oliver, Bria, Cal | 🎯 5 independent | **Addressed** — modal closes only after host acceptance |
| F-02 | 🔴 Blocker | Commit during a session save is dropped by the mutation gate — no action result, no log, modal already closed | Oliver (Ada verified) | ✅ Verified | **Addressed** — widget-owned rejection result keeps Draft open |
| F-03 | 🔴 Blocker | The preview quote-stripper eats the outer quotes of dialogue prose and persists the mangled text | Sam (Ada verified), Cal | ✅ Verified | **Addressed** — destructive stripping removed |
| F-04 | 🟠 High | A throw before the `try` in `handleCommit` routes to `source: 'unknown'`, which the Workshop webview shows nowhere | Oliver | 1 independent | **Addressed** — staging moved under the widget failure boundary |
| F-05 | 🟠 High | Deleting the `commitPending` freeze re-opened the re-entrant commit path; the second commit preempts the first, which half-landed | Blake | 1 independent | **Addressed** — UI freeze plus backend active-run guard |
| F-06 | 🟠 High | The "bounded raw response" in the log has no bound — `frame_too_long` dumps the largest responses in full | Oliver, Patricia, Bria, Blake, Sam | 🎯 5 independent | **Addressed** — shared bounded head/tail logger |
| F-07 | 🟠 High | `WorkshopApp.tsx` now owns two writer-visible failure behaviors and has no test file; one covering test was deleted to get there | Cal | 1 independent | **Addressed** — ownership returned to hook/modal and covered there |
| F-08 | 🟡 Standard | Raw widget frames are retained in conversation history and re-sent every request — including rejected frames the writer never saw | Tim | 1 independent | **Addressed** — retain sanitized assistant content, preserve raw diagnostics |
| F-09 | 🟡 Standard | `reasoning: { effort: 'low' }` against a 1,200-token ceiling can burn the budget and fail every preview after billing | Tim, Blake, Bria | 🎯 3 independent | **Open** |
| F-10 | 🟡 Standard | `preview.sourceText` skips the checkpoint-normalization seam that `proactiveAssistance` uses correctly in the same PR | Stan, Marcus, Patricia, Blake | 🎯 4 independent | **Open** |
| F-11 | 🟡 Standard | The "Ready now" row duplicates `item.id`, so one selection lights two cards and reports two pressed toggles | Stan, Marcus, Parker, Sam, Tim, Blake | 🎯 6 independent | **Open** |
| F-12 | 🟡 Standard | The `try` in `LexicalGravityModelService.preview` wraps the happy path, blaming the model for a config-key throw | Parker, Marcus | 🎯 2 independent | **Addressed** — config key resolved outside provider validation |
| F-13 | 🟡 Standard | `invalid_field` collapses four distinct, high-information failures into one opaque reason | Oliver | 1 independent | **Addressed** — field and reason remain discriminated through logs/copy |
| F-14 | 🟡 Standard | A non-error rides the `ERROR` channel and is intercepted by a shell early-return; the next soft failure costs five edits | Marcus, Stan, Cal | 🎯 3 independent | **Open** |
| F-15 | 🟡 Standard | `PROMPT_BUDGETS.workshopWidgets` is unpinned while every boundary test derives from it — the numbers are now a model-facing contract | Cal | 1 independent | **Addressed** — exact model-facing table pinned |
| F-16 | 🟡 Standard | The `frame_too_long` six-term sum is never pinned; it gates all five well-tested field boundaries | Cal | 1 independent | **Addressed** — derived 15,300-character ceiling pinned |
| F-17 | 🟡 Standard | `menu` set with an empty dictionary renders no generation controls at all — the refactor lost the old chain's total coverage | Sam | 1 independent | **Addressed** — Regenerate remains available; More disables honestly |
| F-18 | 🟡 Standard | Empty provider content becomes a silent, billed, blank turn with no guard | Sam, Oliver | 🎯 2 independent | **Open** |
| F-19 | 🟡 Standard | `askHostToConfigureWidget` switches the chat target (and persists it) before the writer acts, and seeds even when the switch is refused | Bria, Sam | 🎯 2 independent | **Open** |
| F-20 | 🟡 Standard | A 2,200 ms single-slot toast is the entire writer-facing lifetime of every widget failure | Oliver | 1 independent | **Partially addressed** — commit failures are persistent inline; recommendation notice unchanged |
| F-21 | 🟡 Standard | The checkpoint repair stamps historical turns `proactiveAssistance: true` — a fabrication in the audit ledger — with a literal, not the constant | Blake, Parker | 🎯 2 independent | **Addressed** — historical turns stamp the behavior actually used (`false`) |
| F-22 | 🔵 Nit | Non-gesture commit failures fall through the `else if` and produce nothing at all | Blake, Bria | 🎯 2 independent | **Open** |
| F-23 | 🔵 Nit | `previewVisible` latches true; a lens switch leaves stale framing around an empty result | Sam, Parker | 🎯 2 independent | **Open** |
| F-24 | 🔵 Nit | The preview-source-override rule is stated three times and the opening→draft chain twice | Parker, Stan | 🎯 2 independent | **Partially addressed** — override rule named once; opening→draft cleanup deferred |
| F-25 | 🔵 Nit | One rejection concept carried by three variables, with the notice copy written twice | Parker | 1 independent | **Open** |
| F-26 | 🔵 Nit | New log lines dropped the `requestId` their siblings in the same file carry; no `widgetId` either | Oliver | 1 independent | **Open** |
| F-27 | 🔵 Nit | `outputChannel?: LogSink` is optional against the house rule; the advertised diagnostic is structurally allowed not to exist | Oliver | 1 independent | **Open** |
| F-28 | 🔵 Nit | `sourceText` crosses the wire unguarded while the draft beside it gets a codec | Patricia, Blake | 🎯 2 independent | **Open** |
| F-29 | 🔵 Nit | Duplicated rejected-body log block; four copies of the substitution-key list; `metaTag` name crossing; Title Case drift | Parker | 1 independent | **Open** |
| F-30 | 🔵 Nit | Missing accept-side boundary tests (`gestureSourceReferences` = 8, `…Characters` = 500) and untested `sourceText` bounds | Cal | 1 independent | **Open** |
| F-31 | 🔵 Nit | A malformed settings submission silently resets all five axes and logs the coerced values as if intended | Oliver | 1 independent | **Open** |
| F-32 | 🔵 Nit | `WorkshopConversationBehavior` costs ~12 files per boolean axis; this is the fourth | Marcus | 1 independent | **Deferred** — worth a `.todo` entry, not this sprint |
| F-33 | 🔵 Nit | `WorkshopLexicalGravityModal.tsx` +119 lines at 658, 22 `useState`, 5 effects; three seams already visible in the markup | Marcus, Parker | 🎯 2 independent | **Deferred** |
| F-34 | 🔵 Nit | `package.json` lists `proactiveAssistance` as `required` under `additionalProperties: false`, so existing settings objects show a schema squiggle the runtime handles fine | Bria | 1 independent | **Open** |
| F-35 | 🔵 Nit | The null-content normalization landed on the non-streaming path only; streaming keeps the old `content: string` assumption | Bria | 1 independent | **Open** |
| F-36 | 🔵 Nit | The PR description credits "generated project lenses remain reusable" to this PR; it shipped in #98 | Bria | 1 independent | **Open** |
| F-37 | 🟢 Praise | The persona→host boundary holds end to end; the six-slug `lensSlug` allowlist is the sharpest control in the PR | Patricia | 1 independent | N/A — preserve |
| F-38 | 🟢 Praise | Budget ceilings are consistent in both directions — no `<`/`<=` skew, and the frame ceiling has real headroom | Sam | 1 independent | N/A — preserve |
| F-39 | 🟢 Praise | Default-on is a genuine default across all three hydration paths, not a new-sessions-only default | Bria | 1 independent | N/A — preserve |
| F-40 | 🟢 Praise | ADR 2026-07-31 delegated ownership honored — `WorkshopHandler` grew six lines, all event wiring; the codec split arrived on schedule with no escape hatch | Marcus | 1 independent | N/A — preserve |
| F-41 | 🟢 Praise | Alpha discipline exemplary: `costNote` → `lifecycleNote` with zero leftovers, and the commit-reconciliation state fully deleted rather than deprecated | Stan, Parker | 🎯 2 independent | N/A — preserve |
| F-42 | 🟢 Praise | Token races are correctly gated; a late reply cannot paint into a reopened sheet | Sam | 1 independent | N/A — preserve |

---

## Verification actually run

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | ✅ 157 suites / 1,786 tests, 1 snapshot, exit 0 (37.94 s; fix pass) |
| `npm run lint -- --quiet` | ✅ exit 0, zero diagnostics, no `--max-warnings` fudge |
| `npm run typecheck` | ✅ core + webview + ext, all exit 0 |
| `packages/core` imports `vscode` | ✅ none — invariant intact |
| Composition root touched | ✅ `extension.ts` / `MessageHandler.ts` unchanged; no infrastructure `new`'d in business logic |
| New dependencies | ✅ zero |

The PR description's validation claims hold. They were re-run, not taken on trust.

---

## Blockers

### F-01 — A failed commit discards the writer's paid draft, and the toast says it doesn't

**Files:** [WorkshopGesturePlaygroundModal.tsx:409](../../packages/core/src/presentation/webview/components/workshop/WorkshopGesturePlaygroundModal.tsx#L409) · [WorkshopApp.tsx:271-281](../../packages/core/src/presentation/webview/WorkshopApp.tsx#L271-L281) · [WorkshopWidgetHandler.ts:349-363, 393-430](../../packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts#L349-L430)

Five reviewers arrived here from five different directions. That is the strongest signal in this review.

`commit()` dispatches `onCommit(...)` then calls `onClose()` in the same tick. `gestureOpening` goes null, the modal unmounts, and `menu` / `dictionaryMarkdown` / `selections` / `note` / all four prose fields go with it — the product of one deliberate, billed generation call.

The host does the right thing on its side. It persists the config before sending, with the intent written out loud:

```ts
// WorkshopWidgetHandler.ts:377
// "persist it even if the send below fails, so the Draft survives a reload as the retry token."
this.options.markDirty('widget config created');
...
message: 'The room did not accept the commit. Your selections are kept — try again.'
```

The config is real, durable, and returned as `widgetConfigId`. But the only two doors into `openWidgetConfig` are a widget chip on a **committed** turn and the standing-directive rail (Lexical Gravity only). A failed commit produces neither. `postSessionState()` is called on success only, so the webview's `widgetConfigs` is stale — and no component renders it anyway. The retry token exists, is promised to the writer in plain English, and has no door.

The pre-`createWidgetConfig` guards at `:349-363` are worse: they reject before the config is minted, so there is no token at all. The easiest trigger needs no bug — click *Talk directly* on a tool, then open Widgets (the pill is gated on `sessionReady` only), generate, curate, commit. `target.kind === 'tool'` → rejected → draft gone.

**Fix:** in the `ok === false` branch, when `widgetConfigId` is present, call `openWidgetConfig(message.payload.widgetConfigId)` alongside the toast — [WorkshopApp.tsx:548](../../packages/core/src/presentation/webview/WorkshopApp.tsx#L548) already reopens it as a clone with the draft intact. For the pre-creation guards, either validate those three conditions in the modal before dispatching, or mint the config before the guards so every failure returns a token. Failing both, stop shipping a message that promises recovery the UI cannot deliver.

### F-02 — A commit during a session save vanishes entirely

**Files:** [WorkshopWidgetHandler.ts:106](../../packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts#L106) · [WorkshopHandler.ts:371-382, 2574-2588](../../packages/core/src/application/handlers/domain/WorkshopHandler.ts#L371-L382)

Verified directly:

```ts
// WorkshopWidgetHandler.ts:106 — no sessionAction argument
registerMutation(MessageType.WORKSHOP_COMMIT_WIDGET, this.handleCommit.bind(this));
```

`registerMutation` wraps every route in `rejectRoomMutationDuringSessionOperation(sessionAction)`. With `sessionAction` undefined, a pending session operation takes the `sendError('workshop', …)` branch and returns `true` — so `handleCommit` **never runs**. No `WORKSHOP_WIDGET_ACTION_RESULT` is posted. No log line names the widget.

Meanwhile the modal has already closed unconditionally. The writer gets a room-level banner reading *"Wait for the current session save or replacement to finish before changing the room"* — which does not mention the widget, does not mention their commit, and does not tell them their generation is gone. Before this PR the sheet stayed open and frozen and the race cost a second's wait.

**Fix:** pass a real `sessionAction`, or have the gate post `{ action: 'commit', widgetId, ok: false, message: 'A session save is finishing — commit again in a moment.' }` so the existing toast path fires. Structurally, F-01 and F-02 are the same wound: closing the sheet before the host accepts means every rejection must carry a recovery path, and two of them carry none.

### F-03 — The quote-stripper eats dialogue and persists the damage

**File:** [LexicalGravityModelService.ts:149-159](../../packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts#L149-L159)

```ts
/** Remove only a single whole-response wrapper, preserving prose-internal dialogue. */
private stripEnclosingDoubleQuotes(content: string): string {
  const quotePairs = [['"', '"'], ['“', '”']] as const;
  const pair = quotePairs.find(([opening, closing]) =>
    content.startsWith(opening) && content.endsWith(closing)
  );
  return pair && content.length >= 2
    ? content.slice(pair[0].length, -pair[1].length).trim()
    : content;
}
```

The docblock promises to preserve prose-internal dialogue. The implementation never inspects the interior. In a fiction tool, a passage that opens *and* closes on dialogue is ordinary — and then the first character is an opening quote and the last is the closing quote of a **different utterance**. Both get sliced off.

```
"Hold the light steady," she said. "I can't see the grain."
  →  Hold the light steady," she said. "I can't see the grain.
```

Smart quotes fail identically. And this is not cosmetic: the mangled string is returned as `preview.text`, flows into `WorkshopLexicalGravityPreview`, and is persisted into the draft by `LexicalGravityConfigCodec`. Corrupted prose in the checkpoint.

**Fix:** only strip when the interior is genuinely quote-free —

```ts
const pair = quotePairs.find(([opening, closing]) =>
  content.startsWith(opening)
  && content.endsWith(closing)
  && content.length > opening.length + closing.length
  && !content.slice(opening.length, -closing.length).includes(opening)
  && !content.slice(opening.length, -closing.length).includes(closing)
);
```

Or delete the stripper — `01-preview.md` already forbids the model from quoting, and the length check does the rest. Add the dialogue case as a regression test either way.

---

## High

### F-04 — A pre-`try` throw reaches no writer-visible surface

[WorkshopWidgetHandler.ts:365-366](../../packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts#L365-L366) — `createWidgetConfig` and `mintWidgetArtifactId` sit outside the `try` at `:381`. Anything they throw propagates to `MessageHandler`, which emits `sendError('unknown', …)`. In the Workshop webview that source matches no toast branch, and `useWorkshop.handleErrorMessage` returns early on `!source.startsWith('workshop')`. The modal has closed. The writer sees **nothing** — no turn, no pill, no toast, no banner — and will reasonably assume they misclicked and do it again.

Move both calls inside the `try`, and give `WorkshopApp` a floor for `source === 'unknown'`.

### F-05 — Re-entrant commit, now unguarded

The commit's user turn is minted before inference, so the `wc-N` re-open pill paints in the transcript while the assistant reply is still streaming. Clicking it → clone → "Commit as new turn" reaches `executeMessage`, which calls `preemptActiveRun()` unconditionally and aborts the first. The first `handleCommit` then posts `ok: false` — *"your selections are kept — try again"* — for a commit whose `wc-N`, user turn, and `ta-N` artifact are permanently in the session. The room ends with an assistant-less widget turn.

The `commitPending` freeze this PR deletes is exactly what made that unreachable. Keep the immediate close (it is the UX win) but refuse re-entry host-side: preempting a *widget commit* is not the same as preempting a composer message, because the widget commit has already written durable state.

### F-06 — "Bounded raw response" is unbounded

[WorkshopRunCompletion.ts:203](../../packages/core/src/application/services/workshop/WorkshopRunCompletion.ts#L203) — `input.log(\`Rejected widget recommendation response (${label}):\n${result.content}\`)`. No slice, no cap. Bounded only by the user's `maxTokens` (default 10,000 ≈ 40,000 characters), and `frame_too_long` rejects *precisely because the response was enormous* — so the largest responses are the ones logged in full. The content is routinely verbatim manuscript prose, in the channel writers copy-paste into bug reports.

The length is the diagnostic; the other 36,000 characters are not. Slice to ~4,000 with an explicit `(truncated, N chars total)` marker, and use the same helper for the duplicated block in `LexicalGravityModelService`.

### F-07 — The webview's new failure owner has no tests

`WorkshopGesturePlaygroundModal.test.tsx` **removed** *"surfaces a failed commit and keeps the draft editable"* and replaced it with *"closes immediately after dispatching a valid commit."* The behavior moved to [WorkshopApp.tsx:272](../../packages/core/src/presentation/webview/WorkshopApp.tsx#L272) — and there is no `WorkshopApp` test file anywhere under `__tests__/presentation/webview/`.

Delete the `!message.payload.ok` toast branch today and a failed commit closes the modal, discards the draft, and says nothing, with a fully green suite. That coverage existed before this PR. It is a net loss disguised as a refactor — and it happens to guard the exact path F-01, F-02, and F-04 all land on.

---

## Standard

Condensed; each was reported with a full trace.

- **F-08** — [AgentRunEngine.ts:430](../../packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L430) commits raw `visibleContent` to retained history; the control-frame strip happens later and only for display. A ≤15,300-character frame then re-ships on every subsequent request, rejected frames included. This PR raises the emission rate three ways (proactive default-on, the explicit "never suppresses a fresh recommendation" clause, and "ask again" on rejection). Strip before retention and the whole concern caps.
- **F-09** — `reasoning: { effort: 'low' }` shares a 1,200-token ceiling with output. The rewrite target is ≤800 source characters (~200 tokens); low-effort reasoning can consume the rest, trip the new `finishReason === 'length'` guard, and hand the writer *"did not return a usable preview"* after billing — every time, on a reasoning-heavy widget model the modal lets them pick. Raise `lexicalPreviewOutputTokens`, or pass `exclude: true` (the type already supports it), or use `'minimal'`.
- **F-10** — `proactiveAssistance` walks the full ADR 2026-07-30 seam: optional in the V1 shape, defaulted in normalization, logged as `defaulted-proactive-assistance`, regression-tested. `preview.sourceText`, in the same PR, is made permanently optional on the *public message contract* with a comment and no repair — so the optionality leaks forward into three `!== undefined` branches in the modal. The next widget author will read the wrong file as the template.
- **F-11** — Six reviewers. `WORKSHOP_WIDGET_GROUPS` prepends live widgets as a "Ready now" row carrying the **same `item.id`**, and `WorkshopSheetBrowser` selects on id with no group scoping. Two cards render `aria-pressed="true"` for one selection; clicking the second *deselects*. The tell is in the diff: a test had to move from `getByRole` to `getAllByRole(...)[0]`. Prefix the shortcut ids (`ready:${id}`) and strip on select.
- **F-12** — The `try` in `LexicalGravityModelService.preview` wraps the happy-path `return`, so a throw from `lexicalGravityConfigKey` is reported as *"the selected widget model did not return a usable preview."* The model did nothing wrong, and a misattributed error costs more debugging time than the bug it hides.
- **F-13** — `invalid_field` covers four distinct failures: an empty required field, the model paraphrasing instead of copying, an invented `ctx-N` id, and a bad Lexical Gravity config value. These are the *high-information* rejections — "it paraphrased" is a one-line prompt fix, "it invented ctx-9" means the attachment roster isn't reaching the model. The `.some()` at `:292` should be a `.find()`, exactly like the one written one line below it.
- **F-14** — A succeeded turn's rejected recommendation travels as `MessageType.ERROR` with a sentinel source, and `WorkshopApp.handleErrorMessage` early-returns to divert it before the hook can raise the room banner. That early return is a workaround for the message's own type being wrong. Every future `ERROR` consumer must now know this one source isn't an error, and `widgetRecommendationRejected` duplicates `error`'s signature across five wiring sites.
- **F-15 / F-16** — `promptBudgets.test.ts` pins `workshopCapability` and `workshopResource` with `toEqual` but not `workshopWidgets`, while every boundary test derives its expectation from the table. Since this PR interpolates those numbers into the model instruction, they are a published contract now: change `gestureContextCharacters` to 100 and the prompt, the parser, and the whole suite agree while the feature is useless. Separately, the six-term `frame_too_long` sum is asserted with `expect.any(Number)` — the highest-blast-radius check has the weakest assertion, and it gates all five field boundaries beneath it.
- **F-17** — The old `if / else-if / else` chain always rendered a Generate button. Splitting it into two independent guards left `menu && !dictionaryMarkdown` matching neither, so a `{ ok: true, menu: [...], dictionaryMarkdown: '' }` payload strands the writer with no Generate, no Regenerate, no Cancel, and a disabled Commit.
- **F-18** — `toAssistantContent` correctly stops a `TypeError` on null content, but its comment says orchestration will "report an empty response" and nothing does. The `''` flows through every guard, persists via `stringAt`, and lands as a blank assistant bubble plus a token bill.
- **F-19** — The completion criterion says *"no message/widget state changes until the writer acts."* `askHostToConfigureWidget` posts `WORKSHOP_SET_CHAT_TARGET` immediately, which reaches `markDirty`. Chat target is neither message nor widget state, so the letter holds — but a writer mid-conversation with a guest is moved to the Host with no notice, and the Tools browser's equivalent path deliberately does *not* switch. Worth confirming the asymmetry is intended. Separately, when the switch is refused during a session operation the composer is still seeded, aimed at whoever is actually selected.
- **F-20** — 2,200 ms, single-slot, is the whole lifetime of every widget failure signal — including a ~150-character rejection notice, in a sidebar, to someone looking at their manuscript. And when the persona wrote prose *and* a malformed frame (the common case) the turn renders normally, so the failure exists for 2.2 seconds and then never happened.
- **F-21** — The checkpoint repair stamps historical turns `proactiveAssistance: true`. Those turns ran with no proactive-assistance instruction in the frame at all; the honest stamp is `false`. Its sibling `defaulted-capability-principal` has a written justification that its default *records the truth*; this one records the opposite. Audit-only today, but it's a fabrication in the ledger — and it hardcodes the literal where `coerceWorkshopConversationBehavior` correctly reads the constant.

---

## What holds — verified, not assumed

**The host boundary.** Patricia traced the persona→host path end to end and it closes. An accepted recommendation is only *attached to a turn* — it never opens a surface, applies a directive, or commits state. `lensSlug` is allowlisted to six built-ins, which is the sharpest control in the PR: a persona can never name an arbitrary project lens whose body would be injected into a system prompt. Weight/reach/metaphor-pull are range-checked, source references are regex-pinned and then checked against session-minted addresses, and both commit paths are re-validated host-side. The immediate close removes a *UI* wait, not an authorization check. CSP is unchanged and still has no `connect-src`. Path handling holds — model output never reaches a path segment.

**The budget ceilings.** Sam checked both directions and found no skew: the model is told "Maximum 300 characters," the parser rejects on `> 300`, and both read the same constant. The frame ceiling has ~1,800 characters of genuine headroom, so an obedient model filling every field cannot be rejected for obeying. Pulling `sourceReferences` into the shared `fields` table is a strict improvement — it used to fall out as a bare `invalid_field`.

**Default-on is a real default.** Bria audited all three hydration paths — new session, pre-02B-A settings object, pre-02B-A persisted session — and `true` arrives in each. Not a new-sessions-only default. Toggling only this axis correctly does *not* rebuild persona prompts.

**The architecture held its line.** `packages/core` still imports no `vscode`. The composition root is untouched. ADR 2026-07-31's delegated ownership was honored to the letter — `WorkshopHandler` grew **six lines**, all event wiring, with the new behavior going into the widget handlers. The widget-config codec split arrived on schedule, dispatching by `widgetId` with a `shapeError` on any third and no `Record<string, unknown>` escape hatch.

**Alpha discipline was exemplary.** `costNote` → `lifecycleNote` renamed across the descriptor, both modals, and every catalog entry with zero leftovers. `widgetActionResult` / `consumeWidgetActionResult` / `commitPending` / `commitError` fully deleted rather than deprecated — and `useWorkshop.ts` came out 23 lines lighter for it, which is also a render win. No compatibility flags, no "legacy" comments. `.todo` hygiene correct on both sides of the archive.

**Token races are properly gated.** Both modals discard stale replies on a minted token, and the reopen effect clears `pendingWidgetConfigId` before it can re-fire. A late reply cannot paint into a reopened sheet.

**Two tests worth copying.** The recommendation parser's boundary pairs keep the evidence-containment invariant satisfied while pushing length, so the length assertion can't pass for the wrong reason. And the normalization fixture *throws* if it ever stops containing a behavior-stamped turn — it cannot rot into a vacuous pass.

---

## Recommended order

1. **F-03** — one function, plus a dialogue regression test. Data corruption, cheapest fix in the review.
2. **F-01 + F-02 + F-04 together** — they are one wound. The sheet now closes before the host accepts, so every rejection path needs a recovery door or an honest message. The `openWidgetConfig` seam already exists.
3. **F-07** — add `WorkshopApp.test.tsx` covering the failure branches from step 2. Write it as part of the fix, not after.
4. **F-05, F-06** — re-entry guard, log bound.
5. **F-09, F-08** — both small, both cost real money.
6. **F-10, F-11, F-12, F-14** — cheap now, calcified later. F-10 and F-14 in particular will be copied by the next widget.
7. Everything else to follow-ups.

Nothing here points the dependency graph the wrong way, and the sprint's stated boundary — personas prepare, writers commit — genuinely holds in code. The concentrated risk is one design decision, made deliberately and made well, whose failure paths weren't finished with it: the sheet closes optimistically, and on three of its rejection routes the writer's paid work has nowhere to land.
