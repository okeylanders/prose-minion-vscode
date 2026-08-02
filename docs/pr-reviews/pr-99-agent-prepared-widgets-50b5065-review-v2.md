# MR Review v2 — Sprint 02B-A: agent-prepared widgets and interaction polish

**Author:** okeylanders · **PR:** [#99](https://github.com/okeylanders/prose-minion-vscode/pull/99) (Open)
**Branches:** `sprint/conversation-widgets-02b-a-assists-and-polish` → `epic/conversation-widgets`
**Base:** `9ec3bd6` · **Head:** `50b5065`
**Reviewed:** 2026-08-01 · **Mode:** Full (Semantic Runway + 4 scouts + 10 specialists + Sensei)

> A separate, independently-run review of this same head exists at
> [pr-99-agent-prepared-widgets-review.md](pr-99-agent-prepared-widgets-review.md)
> (`/pr-review-ts-react-vsce`). This review was run **clean of it** — no specialist
> saw those findings — so any agreement between the two documents is independent
> corroboration rather than an echo. Both ledgers are live; neither supersedes the other.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🔴 Blocking | Gesture commit closes at dispatch; the Draft is destroyed and the "selections are kept" promise reaches no surface | Blake, Sam, Marcus, Oliver, Bria | 2 independent · 3 runway-prompted | 🎯 Consensus | **Addressed** — close on durable room acceptance; rejection keeps the live Draft |
| F-02 | 🟠 High | The quote-stripper eats the outer marks of any preview that opens and closes on dialogue, and persists the damage | Blake, Bria, Sam, Cal, Parker | 2 independent · 3 runway-prompted | 🎯 Consensus | **Addressed** — wrapper stripping removed; dialogue regression added |
| F-03 | 🟠 High | Raw widget frames stay in retained model history and replay on every later request — and may be causing the suppression this PR treats with prose | Tim | 1 independent | — | **Addressed** — Workshop retention sanitizer strips private control frames |
| F-04 | 🟠 High | Two commit-failure tests were deleted; the behavior moved to the one Workshop file with no suite | Cal | 1 independent | — | **Addressed** — host, hook, and modal failure contracts covered |
| F-05 | 🟠 High | `reasoning: { effort: 'low' }` shares a 1,200-token ceiling with the prose it must produce | Tim (Blake dissents) | 1 runway-prompted | — | **Open** — Medium confidence; one live call settles it |
| F-06 | 🟡 Standard | The "bounded raw response" is unbounded, against two existing precedents | Oliver, Patricia | 0 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — shared bounded head/tail diagnostic helper |
| F-07 | 🟡 Standard | The widget action-result channel lost its domain owner and now dispatches on a hardcoded id | Marcus, Stan | 0 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — `useWorkshop` owns Gesture action results again |
| F-08 | 🟡 Standard | The ask-prefill fallback degrades silently, and nothing watches a `live` flip | Stan | 1 runway-prompted | — | **Addressed** — explicit builders plus live-registry architecture test |
| F-09 | 🟡 Standard | The browser ask retargets *and persists* session state before the writer acts | Marcus (Bria dissents) | 1 independent | — | **Open** — see dissent |
| F-10 | 🟡 Standard | An app-authored first-person apology is published under the persona's byline | Bria | 1 runway-prompted | — | **Addressed** — system-authored third-person fallback |
| F-11 | 🟡 Standard | Provider-null content normalizes to `''` and nothing reports it; a paid turn lands blank | Sam | 1 independent | — | **Open** |
| F-12 | 🟡 Standard | The vanished-source branch gained two behaviors and kept a test that predates both | Cal | 1 independent | — | **Addressed** — clone/source disappearance regression added |
| F-13 | 🟡 Standard | The preview-source override rule is written three times, named nowhere, and diverges on the third | Parker | 1 independent | — | **Addressed** — named one normalization helper used at all three sites |
| F-14 | 🟡 Standard | `lifecycleNote` is true in the widget catalog and false at the Tools consumer it renamed | Parker | 1 independent | — | **Addressed** — shared browser slot renamed `selectionNote` |
| F-15 | 🔵 Nit | Gesture copy/save restates the `copyTurn`/`saveTurn` envelope forty lines up | Stan | 1 independent | — | **Open** |
| F-16 | 🟢 Praise | The model-output-to-host-action boundary holds across every surface this PR widens | Patricia | 1 runway-prompted | — | N/A — preserve |
| F-17 | 🟢 Praise | Save Gesture Dictionary lands *on* the closed filename allowlist rather than around it | Patricia | 1 independent | — | N/A — preserve |
| F-18 | 🟢 Praise | Routing the recommendation rejection around the room error banner is correct | Oliver | 1 independent | — | N/A — preserve |
| F-19 | 🟢 Praise | The Gesture Dictionary Save path is tested end-to-end; coverage moved with the behavior | Cal | 1 independent | — | N/A — preserve |
| F-20 | 🟢 Praise | `lifecycleNote` derives from registry constants; `proactiveAssistance` reproduces its ancestor's six-step wiring faithfully | Stan | 1 independent | — | N/A — preserve |

## Review coverage

**Read fully:** `CLAUDE.md`; the sprint spec `02b-a-agent-prepared-widgets-and-polish.md`; the epic; ADRs 2026-07-22, 2026-07-29, 2026-07-30, 2026-07-31, 2026-07-20 (amended here); `.todo/tech-debt/` entries for prompt assembly, god files, and turn retention; the archived widget-local-codecs debt; PR #98's review and resolution ledger; all 31 changed production source files; all 23 changed test files.

**Diff reviewed:** complete unified diff, 73 files (+1,984 / −463).

**Sampled:** `docs/design/*.html|css|js` — read for intent on the "Ready now" row and the Lexical Gravity layout; not audited line by line.

**Not reviewed:** provider-side behavior of OpenRouter's `reasoning.effort` translation (drives F-05's Medium confidence); whether Workshop widget configs have shipped to Marketplace (unresolved across two consecutive sprints; decides which ADR 2026-07-30 regime governs both new optional fields).

**Verified, not quoted** — the PR description's validation claims were re-run against this head:

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | 157 suites / 1,786 tests, 1 snapshot, exit 0 (37.94 s; fix pass) |
| `npm run lint -- --quiet` | exit 0, zero diagnostics, no `--max-warnings` fudge |
| `npm run typecheck` (core + webview + ext) | exit 0 |
| `packages/core` imports `vscode` | none — invariant intact |
| Composition root | `extension.ts` / `MessageHandler.ts` unchanged |
| New dependencies | zero |

**Scope correction applied throughout.** `packages/core/src/shared/constants/promptBudgets.ts` and `packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts` are **not modified by this PR** (verified: `git diff --stat origin/epic/conversation-widgets...HEAD -- <path>` → empty). `WorkshopWidgetHandler` owns the host-side commit path whose failure branches this PR makes newly reachable. Findings touching it are labelled inherited risk with the reachability change stated.

---

# Part I — Semantic Runway


**PR:** [#99](https://github.com/okeylanders/prose-minion-vscode/pull/99) · **Author:** okeylanders
**Branches:** `sprint/conversation-widgets-02b-a-assists-and-polish` → `epic/conversation-widgets`
**Base:** `9ec3bd6` · **Head:** `50b5065` · **Evidence date:** 2026-08-01
**Blast radius:** 73 files, +1,984 / −463. Production source ~951 added / ~300 removed across 31 files; tests ~715 / ~104 across 23. Zero new dependencies. `apps/vscode-extension/src` untouched; only its `package.json` `contributes.configuration`. No `schemaVersion` bump. No new message types — the change rides existing envelopes.

**Thesis.** This PR is filed as six bullets of last-mile polish, but underneath them it makes one coherent move twice: it **narrows what the model is asked to be responsible for, and moves the residue into deterministic host code.** The Lexical Gravity preview stops being a protocol and becomes prose. The recommendation contract stops being ask-for-quality and becomes ask-for-quality-within-stated-bounds, with the bounds interpolated from the same constants the parser enforces. A third move rhymes with those two but runs the opposite way: the Gesture commit stops being a synchronously confirmed handoff and becomes an asynchronous dispatch — narrowing what the *writer* is asked to wait for, and moving the residue into a toast.

> **Scope correction, verified.** `packages/core/src/shared/constants/promptBudgets.ts` and `packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts` are **not modified by this PR** (`git diff --stat origin/epic/conversation-widgets...HEAD -- <path>` → empty). They are inherited from the epic base. `WorkshopWidgetHandler` owns the host-side commit path whose failure branches this PR makes newly reachable by removing the modal's waiting posture. Reviewers must label that as inherited risk and state precisely what changed about its reachability.

---

## 1. Working Definition & Real Job

**Literal code change.** Six clusters: (1) a `secondary*` action slot on `WorkshopSheetBrowser`, filled by the Widgets browser with "Ask agent to configure, then open," backed by a new pure builder `workshopWidgetAskPrefill.ts`; (2) a new `proactiveAssistance` boolean on `WorkshopConversationBehavior`, default `true`, threaded to VS Code settings schema, both prompt frames, the composer chip, persisted turn stamps, and a checkpoint normalization; (3) design-sync copy and layout changes, including a `costNote` → `lifecycleNote` vocabulary rename and a synthetic "Ready now" group; (4) the Lexical Gravity preview converted from a sentinel-framed envelope to plain prose, with an editable **Before** textarea, provider-null normalization at the API boundary, `reasoning: { effort: 'low' }`, and loading skeletons; (5) Gesture Playground result-workflow polish — control ordering, Copy/Save on the dictionary via the closed result-tool contract, and immediate commit dismissal; (6) a hardened recommendation contract with budget-interpolated ceilings and a discriminated-union rejection type carrying field name and actual/maximum lengths.

**Functional capability.** A writer can now ask a persona to *prepare* a widget rather than configuring it themselves, and can turn that initiative off. A rejected preparation explains itself instead of leaving a blank bubble. A preview can be run against the writer's own prose instead of a canned lens sample. A Gesture Dictionary can leave the room by Copy or Save rather than only by commit.

**Business / operational problem.** **[Declared]** Testing the first standing widget exposed four recurring failures, each of which cost a paid turn and left a confused writer: personas would not re-emit a recommendation once a chip existed; the prompt demanded richness it then silently punished; a rejected frame produced an unexplained empty bubble; and structured preview envelopes were brittle across providers.

**What the wording emphasizes and suppresses.** The PR description and sprint doc both foreground *polish* — "bounded follow-up," "not a second standing-rail architecture sprint." That framing is accurate about blast radius and misleading about consequence. Three of the six clusters set precedent a third widget must follow: the commit posture, the failure channel, and the per-widget dispatch idiom. **[Inferred]**

**What must survive any valid alternative.** The host boundary: a persona may compose a *proposal*; only a writer may open, edit, apply, or commit. Every alternate construction below preserves it.

**Competing interpretation, tested.** One could read this PR as primarily a *design-sync* change — the largest single file groups are `docs/design/*` and copy edits, and the sprint doc leads with the refreshed spreads. That reading is defensible for clusters 3 and 5 but fails for 2, 4, and 6, which alter persisted contracts, prompt economics, and the parser's type surface. The design-sync reading also cannot explain the commit-posture change, which no spread describes. The narrowing-model-responsibility thesis explains all six; the design-sync thesis explains three.

> This PR is not merely interaction polish. Its real job is **moving correctness out of model compliance and into deterministic host code — and moving latency out of the writer's way — while preserving the invariant that only a writer commits.**

---

## 2. Declared Intent, Observed Behavior & Open Meaning

**Aligned.** The budget interpolation is real and complete: all five Gesture prose ceilings are read from `PROMPT_BUDGETS.workshopWidgets` into the instruction text, so guidance and enforcement cannot drift **[Observed]**. `sourceReferences` was pulled into the bounded-field list, closing a gap where it was extracted but never length-checked **[Observed]**. The default-on claim holds across all three hydration paths — new session, pre-02B-A settings object, pre-02B-A persisted session **[Observed]**. The "chips never suppress a recommendation" claim is honest in a specific sense worth stating: there was never a host-side suppression to remove, and `stripWorkshopWidgetRecommendationControl` means a persona genuinely cannot see an earlier frame in the transcript. The change is prompt language addressing a model behavior **[Observed]**.

**Gap — "no message/widget state changes until the writer acts."** The sprint's completion criterion says that verbatim. `WorkshopApp.askHostToConfigureWidget` posts `WORKSHOP_SET_CHAT_TARGET`, a registered *mutation* reaching `session.setChatTarget` and `markDirty` **[Observed]**. Chat target is neither a message nor widget state, so the letter may hold; the twin `buildWorkshopToolAskPrefill` path deliberately does not retarget **[Observed]**. Whether the asymmetry is intentional is a question, not a defect.

**Gap — "the bounded raw response in the local output log."** Both new diagnostic paths write the complete body: `WorkshopRunCompletion` logs all of `result.content`, and `LexicalGravityModelService` logs the rejected body between BEGIN/END markers **[Observed]**. The only bound is whatever `maxTokens` allowed. The word "bounded" describes an intent the code does not implement.

**Gap — one PR-description claim is not in this PR.** "Generated project lenses remain reusable rather than being regenerated each time" describes `builtInLexicalGravityLens(slug) ?? repository.findForQuery(query)`, which shipped in PR #98 **[Observed]**. This PR only adds skeleton assertions to the pre-existing test.

**Ambiguity — "at most one assist per response."** The activation frame says *"for this turn"*; the sprint says *"per response."* For a guest round or a post-tool synthesis turn these may not be the same unit **[Observed]**.

**Unknown — sprint status metadata.** The sprint doc on this branch still reads **Status: In progress** while the epic describes 02B-A as the active follow-up **[Observed]**.

---

## 3. Business Story & Rulebook

**Actors.**
- **The writer** — sole decision-maker and sole beneficiary. Every commitment gesture is theirs.
- **The Host persona** (and guests) — may propose at most one assist per response, emit at most one validated recommendation frame, and prefill an editable draft. May not open UI, run a tool invisibly, install a directive, or commit anything.
- **Widgets** — pre-commit surfaces. Gesture Playground is one-shot (commit posts one turn); Lexical Gravity is standing (a directive rides every turn until unpinned).
- **The host** (extension) — owns validation, persistence, provider calls, and the ledger.
- **Excluded:** deterministic tools and direct tool sidecars receive no behavior frame **[Declared]**. Non-`live` widgets are parser-rejected and render disabled with a "Coming soon" badge.

**Rules newly introduced.**
- `proactiveAssistance` defaults `true`; when on, one activation sentence licenses *at most one* assist per turn and enumerates prohibitions negatively. When off, the sentence is simply absent — the pre-existing discretionary behavior remains, and the widget grammar stays in the prompt regardless **[Declared, and deliberately so per the tracked debt]**.
- A rejected recommendation produces three artifacts: a structured log reason, the raw body, and a `workshop.widget_recommendation` error rendered as a toast — deliberately routed *around* the room error banner because the run itself succeeded **[Observed]**.
- Where stripping the control frame leaves nothing, an app-authored first-person sentence substitutes for the persona's content.
- A preview is valid iff: `finishReason !== 'length'`, content is a string, and after CRLF-normalization, trim, and a single enclosing-quote-pair strip it is 1–1,200 characters.
- Gesture commit closes the sheet at dispatch; host-side validation and the room send continue asynchronously.

**Thresholds, stated once.** `gestureTargetPhraseCharacters` 300 · `gestureWriterInstructionsCharacters` 1,000 · `gestureContextCharacters` 10,000 · `gestureCharacterNotesCharacters` 1,500 · `gestureSourceReferences` 8 · `gestureSourceReferenceCharacters` 500 · `gestureRecommendationFrameAllowanceCharacters` 2,000 → derived section ceiling **15,300**. Lexical: `lexicalSampleCharacters` 800 (the editable Before) · `lexicalPreviewCharacters` 1,200 (the After) · `lexicalPreviewOutputTokens` 1,200. UI: `PREVIEW_SOURCE_MIN_HEIGHT` 74 · `PREVIEW_SOURCE_HEIGHT_CAP` 240.

**Value created.** The recurring cost removed is *a wasted paid turn plus a puzzled writer*. **Harm prevented:** the persona becoming an actor on the room.

**Exceptional-but-legitimate states.** A recommendation accepted but whose cited sources have since vanished. A preview run against writer-edited prose that no longer matches any lens sample. A commit dispatched while the room is mid-save. A persona that answers an explicit widget request with prose and a malformed frame.

---

## 4. Narrative Flow: Beginning, Development, Turn & Ending

Two stories share this PR, and they resolve differently.

**Story A — the recommendation.**
*Beginning:* the writer asks the Host to prepare a widget, or simply converses with proactive assistance on. *Development:* the run streams; the persona composes prose plus a reserved control frame; the provider returns; `completeWorkshopRun` strips the frame and inspects it. *Turn:* `session.completeRun(..., recommendation)` — after this the turn and its stamped recommendation are session truth, and the chip is the writer's door. *Ending:* on the accepted path, a chip and a clean transcript. On the rejected path, a log reason, a full raw body in the output channel, a transient toast, and — if the persona wrote nothing else — an app-authored apology persisted as the assistant's content.

That last detail is the story's most interesting unresolved thread. `stripWorkshopWidgetRecommendationControl` exists precisely to keep machine debris out of persisted prose; the fallback sentence puts *app-authored first-person text into the persona's mouth*, where it becomes durable and re-enters later prompt history as though the persona said it **[Observed]**.

**Story B — the commit.**
*Beginning:* the writer opens the sheet, generates (one deliberate paid call), curates, and clicks Commit. *Development:* the modal validates locally and dispatches. *Turn — and here the story now has two candidate commitment points.* The **webview's** commitment is `onCommit(...); onClose()` in the same tick: local Draft state is discarded and the host has validated nothing yet. The **host's** commitment is `createWidgetConfig` + `markDirty('widget config created')`, deliberately *before* the room send, with the inherited comment naming it the retry token. *Ending:* on success, turn linkage, artifact delivery, chip. On failure, a toast reading "Your selections are kept — try again."

**Unresolved thread, stated as structural ambiguity rather than verdict.** The two commitment points are no longer adjacent. Between them the Draft exists in neither place: the modal has discarded it and the host may not yet have minted a config. And `getSnapshot()` derives `visibleWidgetConfigIds` only from windowed turns' `widgetCommit` links and standing directives **[Observed]** — so a `wc-N` created for a commit whose send failed is persisted, promised to the writer in the copy, and has no chip. Whether any surface reaches it is the runway's single most consequential open question.

---

## 5. Codebase Genealogy & Controlling Precedent

**Closest ancestors.** `workshopToolAskPrefill.ts` is the direct twin of the new builder — same directory, same alias, same register, same "the writer still sends it" docblock. `WorkshopToolsModal`'s `requestViaPersona` *mode* is the ancestor of the Widgets browser's *secondary button*: same UX problem, two shapes. `carryCuesThroughSession` is the ancestor of `proactiveAssistance`, and its full path is reproduced faithfully. `defaulted-capability-principal` is the ancestor of `defaulted-proactive-assistance`, the fourth member of an existing normalization family. The `tools` (web-search) threading through `OpenRouterClient` → `AgentRunOptions` → `AgentRunEngine` is the exact ancestor of the new `reasoning` thread.

**Controlling precedent.** `CLAUDE.md` on aliases, barrels, tripartite hooks, domain mirroring, and alpha no-backward-compat — all held **[Observed]**. ADR 2026-07-30 controls both new optional persisted fields. ADR 2026-07-31 controls *where* widget field rules live, and `sourceText`'s bound correctly lands in `LexicalGravityConfigCodec` rather than the top-level shape. ADR 2026-07-20 is amended in place with a dated section rather than superseded. The tracked debt at `.todo/tech-debt/2026-07-31-...-prompt-assembly.md` pre-emptively forbids the obvious shortcut — *"hiding the grammar behind that switch would be a false optimization"* — and the PR honors it **[Declared/Observed]**.

**Conflicting authority this PR creates in a single change.** These are the genealogy's real product, and each is a question rather than a charge:

1. **Two live widgets, two commitment postures.** Gesture drops `commitPending`/`locked` for fire-and-close; Lexical Gravity keeps `applying` + `actionResult` reconciliation **[Observed]**. Only Gesture's docblock records the change.
2. **Two homes for widget action-result state.** `useLexicalGravity` owns `actionResult` in tripartite form; Gesture's equivalent was deleted and inlined into `WorkshopApp`.
3. **Two idioms for per-widget-id dispatch, one file apart.** `WORKSHOP_WIDGET_ICONS: Readonly<Record<WorkshopWidgetId, IconName>>` fails to compile on a new id; `buildWorkshopWidgetAskPrefill` is an if-chain with a generic fallback that silently degrades **[Observed, verified]**.
4. **Two treatments of a development-checkpoint field.** `proactiveAssistance` gets a named, logged, regression-tested normalization; `preview.sourceText` gets a permanently optional slot and a doc comment **[Observed]**.
5. **Two channels for widget-domain failure.** The new `ErrorSource` for recommendation rejections; the existing `WORKSHOP_WIDGET_ACTION_RESULT.ok:false` for commits. Both terminate in a toast.
6. **Two `proactiveAssistance` defaulting sites.** The ADR-sanctioned normalization, and a silent inline default inside `coerceWorkshopConversationBehavior` with a comment but no name, log, or ledger entry.

**New precedent, ranked by copy probability.** Prose Controller is already `live: false` in the catalog and tagged Sprint 03, so "the next author" is a real near person. They will most likely copy, in order: `workshopWidgetAskPrefill.ts`; the fire-and-close commit posture (because it lives on the *reference* widget); `reasoning: { effort: 'low' }` as a per-call-site literal with no entry in the existing `AGENT_RUN_POLICIES`; the discriminated rejection-inspection type; and `WorkshopApp.handleWidgetActionResult`'s hardcoded `widgetId ===` discriminator inside a family-generic handler.

---

## 6. Structural & Causal Map

```
(a) RECOMMENDATION
writer send / guest invite / tool side-pass
  → AssistantToolService: widget grammar appended to EVERY retained persona system message (unconditional)
  → provider → completeWorkshopRun
      ├ strip control frame (always)
      └ inspectWorkshopWidgetRecommendation  [fail-closed, exactly-once]
            ├ accepted + sources resolve → session.completeRun(recommendation)  ◀ COMMITMENT
            ├ accepted + source vanished  → log + widgetRecommendationRejected
            ├ rejected                    → log reason + FULL raw body + widgetRecommendationRejected
            │                                 └ if stripped content empty → app-authored apology persisted
            └ absent                      → pass through
  → ErrorSource 'workshop.widget_recommendation'
  → WorkshopApp.handleErrorMessage EARLY-RETURNS before workshop.handleErrorMessage  → toast only

(b) GESTURE COMMIT
modal.commit() → onCommit(...) ; onClose()   ◀ WEBVIEW COMMITMENT (Draft discarded, nothing validated)
  → [inherited] WorkshopWidgetHandler.handleCommit
      ├ pre-config guards (target kind, widget availability, draft validity) → ok:false, NO config
      ├ createWidgetConfig(wc-N) + markDirty   ◀ HOST COMMITMENT (retry token)
      └ sendRoomMessage → recordWidgetCommit + postSessionState (success only)
  → WorkshopApp: toast iff action==='commit' && widgetId==='gesture-playground' && !ok

(c) LEXICAL GRAVITY PREVIEW
modal Before textarea (seeded from lens.sample, editable, maxLength 800)
  → mint token, clear prior preview, post {token, draft(preview stripped), sourceText}
  → handler: abort in-flight, validateLexicalGravityDraft(draft), sourceText passed through unguarded
  → service: trim+bound 1..800 → engine.run(maxTokens 1200, reasoning effort low)  ◀ MONEY SPENT
  → validate: finishReason!=='length' → string → CRLF norm → trim → strip ONE quote pair → 1..1200
  → return {configKey, sourceText, text}   ← association is now LOCAL, not model-supplied
  → Apply → draft.preview into widget config → LexicalGravityConfigCodec  ◀ writer prose becomes durable

(d) BROWSER ASK
secondary action → close browser → setChatTarget({kind:'host'})  ◀ SESSION MUTATION at browse time
  → seedComposerDraft(buildWorkshopWidgetAskPrefill(...))  → local, append-once, nothing sends

(e) BEHAVIOR
settings ↔ coerce (silent inline default) ↔ session ↔ turn stamp (normalized: defaulted-proactive-assistance)
  → <workshop-interaction proactive-assistance="…"/> + activation sentence (only when true)
  → deliberately absent from assertLastCommittedBehavior → no system-message rebuild
```

---

## 7. Contracts, Invariants & Negative Space

**Invariants the implementation must preserve.**
- Only a writer opens, edits, applies, or commits. A persona proposal is inert data attached to a turn.
- A persona may name only host-owned lens starters — a closed six-slug allowlist — so no persona-chosen text enters a system prompt.
- The recommendation parser is fail-closed and exactly-once; the control frame never reaches persisted display content.
- `packages/core` imports no `vscode`; the composition root is the only place infrastructure is constructed.
- The top-level session codec is the public version boundary; development checkpoints normalize, released codecs migrate.
- Model guidance and parser enforcement read the same constants.

**Postconditions worth naming.** After a successful commit the writer may believe a turn, an artifact, and a chip exist. After a *failed* commit the copy tells them their selections are kept — what the writer may then safely believe is exactly the open question in §4.

**Negative space — deliberately not in scope.** Sprint 02C's scope/context IPC extraction. The F-19 prompt-assembly decomposition (tracked, with "before a third live widget" as its trigger). The Workshop god-file extraction (explicitly forbidden by the sprint's own boundary). Persona auto-commit of a standing directive (permanently out of scope per ADR 2026-07-22 §12). A `schemaVersion` bump (correctly declined while pre-release).

---

## 8. Forces, Tensions & Design Tradeoffs

- **Provider variance vs. parse strength.** Plain-prose previews remove a class of provider failure and put association in local code — the right side of the deterministic/probabilistic seam. Exchanged cost: any 1–1,200-character string is now structurally valid, so a "Here's the rewritten passage:" preamble is indistinguishable from prose. `finishReason` and the quote strip are the compensating guards.
- **Waiting honestly vs. not trapping the writer.** Blocking made the sheet honest and the retry obvious. Closing at dispatch respects the writer's next move and matches "the durable config is the retry token." Exchanged cost: the local Draft no longer survives a host-side rejection, and a toast becomes the only channel for four distinct `ok:false` reasons.
- **Single source of truth vs. standing prompt size.** Interpolating budgets kills the guidance/enforcement drift class outright. It also lengthens an instruction already measured at ~1,024 recurring input tokens — the exact debt this sprint declines to solve, and files openly rather than hiding.
- **Diagnosability vs. writer content in logs.** Both new log paths can contain copied manuscript prose. For a single-user local extension that is a defensible trade; it is still a new place writer prose lands, and the output channel is what a writer pastes into a bug report.
- **Prompt-carried initiative vs. code-enforced ceiling.** "At most one assist" is model guidance; the parser structurally enforces at most one *widget frame*, not one *assist*. Tool suggestions have no counter.

**Credible alternate constructions.**
1. *One minimal sentinel line* on the preview instead of full prose — recovers preamble detection, re-exposes provider brittleness. Robustness traded for detectability.
2. *Two-phase commit acknowledgement* — emit `accepted-for-dispatch` after host-side validation and close on that; the room send stays async. The writer never waits on the model, but pre-persist rejections still reach a live sheet holding the Draft. Costs one message shape.
3. *Don't retarget from the browser* — disable or relabel the secondary action when the target isn't Host. Costs one writer click, buys zero session mutation at browse time.
4. *Structurally count assists*, not just widget frames — costs a second parser surface and argues with ADR 2026-07-22 §7 unless registered properly.
5. *Durable rejection marker* attached to the turn instead of a toast — costs a codec field, buys a record that lives where the writer is already looking.

---

## 9. Failure, Recovery & Operational Truth

**The operator is the writer.** No telemetry, no remote logging, no on-call. The VS Code output channel is the only durable diagnostic; toasts are transient and unpersisted.

**Business rejection vs. technical failure.** The PR draws this line well in one place and leaves it blurred in another. Well: a rejected recommendation is routed *around* the room error banner because the run succeeded — that is a correct distinction, implemented as a deliberate early return. Blurred: a rejected recommendation nonetheless travels on the `ERROR` message type with a sentinel source, so every present and future `ERROR` consumer must know this one source is not an error.

**Silent wrongness vs. visible failure.** Three paths deserve scrutiny, all phrased as questions. `OpenRouterClient.toAssistantContent` normalizes provider-null to `''` — a correct crash fix; what does the empty string become downstream on a *persona turn*, where the recommendation reads as `absent` rather than `rejected`? A commit result for any widget id other than `gesture-playground` falls past the toast branch — is that reachable, and is silence intended? A `field_too_long` uses `.find`, so a model overrunning three fields is told about one — is partial diagnosis the intent?

**Recovery.** The retry token exists by design and is persisted before the send. Whether the UI reaches it after the sheet closes is §4's open question.

**Diagnostic fidelity.** New log lines carry the persona label but not `requestId`, which their siblings in the same file do carry **[Observed]**.

---

## 10. Security, Trust & Misuse Surface

**Assets:** the OpenRouter API key; the writer's manuscript; the persona system prompts; the session file. **Trust boundaries:** webview ↔ host; model output ↔ host; host ↔ filesystem.

**The central trust question of this epic is whether model output can become host action.** The structural controls are: an inert recommendation attached to a turn; a closed six-slug lens allowlist so no persona-named text enters a system prompt; regex-pinned source references checked against session-minted addresses; host-side re-validation on both commit paths; and a writer click at every commitment. Reviewers should verify these hold rather than assume it.

**New or widened surface to examine.** `sourceText` crosses the wire without a type guard while the draft beside it gets a codec. The Lexical Gravity After pane now renders model prose through `MarkdownRenderer` (DOMPurify-sanitized) rather than as a text node — a genuine widening of the sink. Up to 800 characters of writer manuscript prose become durable inside session JSON, which gives session export a content-sensitivity dimension it did not have when previews demonstrated only built-in samples. Both new log paths can carry manuscript prose.

**Reachability discipline.** This is a single-user local extension with no tenancy and no remote attacker. The realistic vector is *the writer's own pasted content plus a model echo*, which bounds most of the above to Low unless a concrete path is traced.

---

## 11. Data, Time, Scale & Concurrency Horizon

**Concurrency is thin by construction** — single-slot `AbortController`s for preview and build, single-slot Gesture generation, no queue, no fan-out. Token-guarded results discard stale replies.

**Cost is the real scale axis.** Every persona turn carries the widget grammar as recurring input whether or not proactive assistance is on. The activation frame rides retained *user* messages, so its contribution is quadratic in turn count. A rejected preview still bills. And the interaction between `reasoning: { effort: 'low' }` and a 1,200-token combined ceiling deserves arithmetic: if reasoning tokens are billed against `max_tokens` on a given provider, a preview can exhaust the budget before prose arrives and trip the new `finishReason === 'length'` rejection — paid for, and failing.

**Retention.** Session JSON grows by one boolean per behavior-stamped turn and up to 800 characters per Lexical Gravity config. Worth asking what the retained *conversation* holds: whether the raw control frame is retained in history alongside the stripped display content, and if so what it costs on every subsequent request.

**Freshness.** `preview.configKey` hashes only the four control values. The preview now also depends on the editable `sourceText`, so one key can describe previews of two different Before passages; freshness rests entirely on the modal's local invalidation **[Observed]**.

---

## 12. The Change Genome: Variation & Reproduction

**Cousin: Decisions** — the append-only decision record already in the catalog under Resources, `live: false`, `lifecycleNote: 'durable · persists across sessions'`.

**Varied axis: state durability and storage ownership.** Gesture writes one turn into the session; Lexical Gravity writes a directive standing inside the session. Both are *session-scoped*. Decisions varies only that: its committed state is project-durable, append-only, and outlives every session. Everything else — writer-owns-the-commit, persona-may-prepare, one pre-commit sheet, one chip — is held constant deliberately.

**Contact points.**

| Surface | Classification |
| --- | --- |
| `WorkshopWidgetId`, `'resource'` rail, `RESOURCE_LIFECYCLE` | **Reuse** — the registry already anticipates it |
| `WorkshopWidgetRecommendation.seed` union | **Extension** — the third member is where the union stops being incidental |
| `WorkshopGestureDraft` / `WorkshopLexicalGravityDraft` (no supertype) | **Fork**, or the first honest abstraction. Unifying at n=3 is the **premature-generalization risk** |
| `WORKSHOP_COMMIT_WIDGET` (gesture-shaped end to end) | **Fork** for an append |
| `APPLY/REMOVE_STANDING_WIDGET` ("one active per family") | **Contradiction** — append-only has no swap |
| `WorkshopApp.handleWidgetActionResult` `widgetId ===` branch | **Copy pressure**, immediately |
| Session `schemaVersion` as *the* version boundary | **Contradiction** — a durable file is a second versioned writer-data artifact with its own clock, which ADR 2026-07-30 does not yet cover |
| `WorkshopSessionCheckpointNormalization` | **Fork** — a file no session owns has no checkpoint |
| Six-slug `builtIns` allowlist | **Reuse** as the model for "what a persona may propose into durable data" |
| Monolithic recommendation instruction + single 15,300 section ceiling | **Contradiction** if taken as-is — this is the debt's own "before a third live widget" trigger |
| `buildWorkshopWidgetAskPrefill` if-chain | **Reuse** with **copy pressure**; degrades silently rather than failing |
| Fire-and-close commit posture | **Contradiction** for a durable write — the writer may believe a decision was recorded when it was not |

**Verdict.** The PR creates a **generative pattern for one-shot, session-scoped widgets** and a **deliberately narrow special case** everywhere else. Narrowness is not penalized here; the question is whether the narrow cases are *marked* as narrow. Two are (the debt file, the ADR amendment). Three are not (commit posture, dispatch idiom, failure channel).

---

## 13. Comparative Models & Borrowed Vocabulary

**Internal parallel — the strongest one.** `workshopToolAskPrefill.ts` vs. `workshopWidgetAskPrefill.ts`, and `WorkshopToolsModal`'s `requestViaPersona` mode vs. the Widgets browser's secondary button. The repository has now answered "let the writer ask the persona instead of doing it themselves" twice, differently, in adjacent files. *Question contributed:* which is canonical, and does the widget builder's lack of conversation-state awareness matter when its copy asserts "the beat we're discussing"?

**[Analogy] Two-phase commit.** The commit path now has a *prepare* (host persists `wc-N`, deliberately before the send) and a *commit* (room send + linkage), but no participant holds the transaction and no coordinator can drive recovery — the webview has already left. Classical 2PC would call the state after prepare-succeeds-but-commit-fails *in-doubt*, and would require the resource to remain discoverable until resolved. *Question contributed:* what plays the recovery-coordinator role here, and how is an in-doubt `wc-N` discovered?

**[Analogy] Aviation handoff and the sterile-cockpit rule.** Closing the sheet at dispatch is a handoff of responsibility from one party (the modal, holding the Draft) to another (the host, holding the config) — and handoffs are where operational state is classically lost, which is why aviation checklists make the receiving party *acknowledge* before the transferring party releases. *Question contributed:* is there an acknowledgement point, or does the modal release before anyone has accepted? This maps precisely onto alternate construction #2.

**[Analogy] Journalism and attribution.** The app-authored apology is published under the persona's byline and enters the archive as though the persona wrote it. A newsroom would call that an attribution error regardless of how helpful the sentence is. *Question contributed:* should app-authored fallback content be visually and structurally distinguishable from persona content, given it re-enters prompt history?

Discarded as decorative: biology/evolvability (the Change Genome table already carries the work), manufacturing platforms (no variant-cost story this PR changes).

---

## 14. Creative Counterfactuals

**Inversion — the writer prepares for the persona.** Reverse the arrow: the writer half-fills a Gesture draft and asks the persona to complete two fields. This is impossible today, and the reason is structural rather than cosmetic — the frame grammar is strictly model→app, the parser has no partial-frame concept (all five fields required or reject), and no message carries writer-entered widget state into a request. The one-way arrow is baked into the grammar, not merely the UI. Worth knowing whether that was chosen for the trust boundary or because serializing a partial draft was expensive.

**Deletion — remove `proactiveAssistance` entirely.** Drop the field, the schema entry, the normalization, the frame attribute, the activation sentence. What irreducible need remains? Only *the writer's ability to stop unsolicited assists* — nothing else in the behavior object serves it. Critically, the widget grammar stays in the prompt either way (the debt note forbids hiding it behind the switch), so deleting the field removes the off-ramp while keeping the standing token cost. **That asymmetry is the field's real justification, and it is a better one than the PR description offers.** The feature is not prompt economy; it is consent.

**Time-lapse — the third live widget.** Prose Controller collides, in order, with: the monolithic instruction, the single 15,300 section ceiling applied *before* widget-id extraction, the flat budget object, the ask-prefill branch chain, `handleWidgetActionResult`'s id branch, and — benignly — the exhaustive icon record, which is the only one that will tell them. Two years out: the six-slug allowlist drifts further from a lens library the writer keeps growing, and the apology sentence accumulates across transcripts as an artifact of parser strictness rather than model behavior.

**Boring alternative.** Keep the sentinel frame, keep the blocking commit, add only the budget interpolation and the field-specific rejection copy. That satisfies the two failures the PR's *evidence* most strongly supports (drifting guidance, opaque rejections) and touches neither commitment posture nor provider parsing. It is meaningfully smaller, and it is worth asking what the other four clusters buy that this does not.

---

## 15. Evidence Confidence & Unresolved Questions

**Repository-grounded.** All file, line, and constant claims above were read from the working tree at `50b5065`. The tooling baseline (157 suites / 1,772 tests, lint, typecheck — all exit 0) was re-run, not quoted. The scope correction on `promptBudgets.ts` and `WorkshopWidgetHandler.ts` was verified by empty `git diff --stat`.

**Material inferences.** That the PR's real job is narrowing model responsibility (§1) is an interpretation, tested against a design-sync reading and retained because it explains six clusters to that reading's three. That the two commitment points in Story B are "no longer adjacent" is inference from code shape, not a declared design statement.

**Competing interpretations preserved.** The commit-posture change is either (a) a deliberate, spec-locked UX improvement whose failure paths are simply unfinished, or (b) the newest and therefore controlling answer to "what happens when a widget commits," which Lexical Gravity has not yet adopted. The sprint's Locked Contracts support (a) **[Declared]**; the genealogy supports (b) being how it will be *read*.

**Missing artifacts / unknowns.**
- Whether a persisted `wc-N` from a failed commit is reachable by any UI surface.
- Whether `docs/design/pm-*.js|css` were re-pulled from Claude Design or hand-edited, which the design README's sync policy distinguishes.
- Whether OpenRouter drops, errors on, or bills `reasoning: { effort: 'low' }` for non-reasoning models.
- Whether `lexicalPreviewOutputTokens: 1,200` was re-measured against a reasoning model's combined budget.
- Whether Workshop widget configs have shipped to Marketplace — this decides which ADR 2026-07-30 regime governs both new optional fields, and it is now unresolved across two consecutive sprints.
- Whether `menu` can arrive without `dictionaryMarkdown` through the menu-result contract.
- Toast dwell time, and whether a rejection can be missed while the writer reads the reply that just landed.

**Needs author or product confirmation.** The retarget-on-ask decision; whether the apology sentence is a contract or a placeholder; whether "turn" and "response" are the same unit for the one-assist rule.

---

## 16. Past → Present → Horizon Synthesis

**Past.** The epic built a widget host in Sprint 01, split widget state ownership in 02A, and shipped the first standing widget in 02B. Each sprint left a precedent: the PendingApply posture from the interaction-modes work; the fail-closed exactly-once parser; the six-slug allowlist praised in PR #98's ledger; the checkpoint-normalization family; ADR 2026-07-30's release gate. This PR inherits a codebase that has already decided most of its questions once.

**Present.** Testing the first standing widget produced four failures that shared a root: *the system was trusting the model to be responsible for things deterministic code could own.* The response is coherent — interpolate the limits so guidance cannot drift, delete the protocol so provider variance cannot break parsing, name the rejected field so the failure is legible. Alongside that, a second and structurally unrelated decision: stop making the writer wait for a commit round trip. The first two moves tighten the deterministic/probabilistic seam. The third loosens a different seam — the one between dispatch and confirmation — and the forces it resolves (writer flow) and the ones it leaves tense (recoverability of a discarded Draft) are not the same forces.

**Horizon.** Prose Controller arrives in Sprint 03 and will read this PR as precedent. It will find one seam explicitly marked for decomposition (the prompt monolith, with a written trigger), one vocabulary correction that generalizes cleanly (`lifecycleNote`), one exhaustive dispatch idiom that will catch its mistakes (the icon record), and three unmarked forks that will not (commit posture, prefill dispatch, failure channel). Further out, the first Marketplace release with widgets forces ADR 2026-07-30's gate on both optional fields at once — and by then `preview.sourceText` will have been carrying writer manuscript prose into durable session JSON for several sprints without a normalization entry to describe it.

---

## 17. Runway Synthesis Brief

**Invariants.** Only a writer commits. Personas propose inert data. No persona-named text enters a system prompt. The parser is fail-closed and exactly-once. `packages/core` imports no `vscode`. Model guidance and parser enforcement read one constant. Development checkpoints normalize; released codecs migrate.

**Anchors.** `workshopWidgetRecommendation.ts` (instruction + parser + the discriminated union) · `WorkshopRunCompletion.ts:87-244` (the four-branch decision, the notice/reason pair, the fallback sentence, the raw-body log) · `WorkshopGesturePlaygroundModal.commit()` · `WorkshopApp.handleWidgetActionResult` + `handleErrorMessage`'s early return · `WorkshopWidgetHandler.handleCommit` **(inherited)** · `LexicalGravityModelService.preview` / `validatePreviewText` / `stripEnclosingDoubleQuotes` · `LexicalGravityConfigCodec` (`sourceText`) · `WorkshopSessionCheckpointNormalization` (`defaulted-proactive-assistance`) · `workshopWidgetIcons.ts` (the "Ready now" group) · `workshopWidgetAskPrefill.ts` · `getSnapshot`'s `visibleWidgetConfigIds` rule.

**Tensions (real tradeoffs, not disguised defects).** Robustness vs. detectability in prose previews. Writer flow vs. recoverability at commit. Single-source-of-truth vs. standing prompt size. Diagnosability vs. manuscript prose in logs. Prompt-carried initiative vs. code-enforced ceilings.

**Unknowns.** Listed in §15. The two that most change the review: whether an orphaned `wc-N` is reachable, and whether widget configs have shipped to Marketplace.

**Legitimate variation points.** Per-widget prompt fragments; per-widget section ceilings; per-widget commit posture *if marked*; per-widget prefill copy; the reasoning-posture policy seam that `AGENT_RUN_POLICIES` already models.

**Predicted pressures.** *Near:* a third widget forces a choice among three unmarked forks. *Middle:* the prompt monolith hits its own written trigger; the "Ready now" duplication scales linearly. *Far:* ADR 2026-07-30's release gate lands on both optional fields at once; durable writer prose gives session export a sensitivity dimension.

**Questions for the panel.** *(neutral; investigate, don't assume)*
1. After a commit whose host send fails, what does "Your selections are kept" point the writer at? Trace `getSnapshot`'s `visibleWidgetConfigIds` and every chip-rendering path before answering.
2. Are the pre-config guards in the inherited `handleCommit` reachable now that the modal closes at dispatch, and what happens to a Draft rejected before any config is minted?
3. Should the two live widgets share a commitment posture? If not, what marks the boundary for Sprint 03?
4. Does the retarget in `askHostToConfigureWidget` satisfy the sprint's own "no message/widget state changes until the writer acts"?
5. Is "the bounded raw response" bounded? If not, what is the right bound, and does manuscript prose belong in the output channel at all?
6. Is the app-authored apology, persisted as assistant content and re-entering prompt history in the persona's voice, a contract or a placeholder?
7. With the preview envelope removed, what distinguishes valid rewritten prose from a preamble, a refusal, or an echo? Is `stripEnclosingDoubleQuotes` safe for a passage that opens and closes on dialogue?
8. Does `reasoning: { effort: 'low' }` fit inside a 1,200-token combined ceiling on providers that bill reasoning against `max_tokens`?
9. Should `preview.configKey` cover `sourceText` now that the preview depends on it?
10. Why does `proactiveAssistance` get a named normalization while `preview.sourceText` gets permanent optionality? Which is the pattern?
11. Does the "Ready now" row's shared `id` produce two `aria-pressed` cards for one selection, and is that the design's intent?
12. Which per-widget-id dispatch idiom is canonical — the exhaustive record or the fallback if-chain?
13. Is a commit result for a widget id other than `gesture-playground` reachable, and is silence intended?
14. Does the recommendation's *raw* control frame persist into retained conversation history, and if so what does it cost per subsequent request?

**Do not overread.**
- Do not treat the retained `WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` as this PR's invention or as hideable behind the new switch — the tracked debt explicitly forbids that, with a reason.
- Do not report `WorkshopWidgetHandler.ts` or `promptBudgets.ts` as changed. They are not.
- Do not treat the file-size growth in `WorkshopApp.tsx` or `WorkshopLexicalGravityModal.tsx` as a violation of the sprint's boundary; the sprint explicitly forbids the god-file extraction here.
- Do not assume the design HTML is authoritative for runtime selection semantics without reading it.
- Do not treat "the suite is green" as evidence a *prompt-language* change worked; several claims in this PR are model-behavior claims no test can witness.
- Narrowness is not a defect. Ask whether narrow cases are marked, not whether they are general.
---

# Part II — The Review

## Executive Briefing

**Verdict:** Needs rework — the architecture, the security boundary, and two of the three core moves are sound, but one reachable path destroys a writer's paid work while telling them it was saved.

- 🔴 **F-01 · Gesture commit closes at dispatch and the Draft has nowhere to land** `🎯 Consensus` — The modal unmounts in the same tick as the dispatch, destroying a paid generation. The host persists `wc-N` as a retry token and returns its id; the webview discards it, and `visibleWidgetConfigIds` can never surface a config with no committed turn. The trigger is a button: pressing Stop makes `committed: false` even when the user turn landed. Close on an acknowledgement, or make the token reachable, or stop promising it.
- 🟠 **F-02 · The quote-stripper corrupts dialogue and the damage persists** `🎯 Consensus` — `startsWith(open) && endsWith(close)` without a same-pair check. `"Get out," she said. "Now."` loses both outer marks; curly quotes fail identically and are the likelier form in manuscript prose. Validation accepts it, the After pane renders it, and `LexicalGravityConfigCodec` persists it.
- 🟠 **F-03 · Every widget frame stays raw in retained history and replays** — `toVisibleContent` strips only capability tool calls; the widget strip runs later and only on display paths. ~85k wasted input tokens in a 30-turn room, rejected frames included. Tim's corollary is the more interesting half: the persona can see its own prior frames verbatim, which is a plausible *cause* of the self-suppression this PR treats with prompt language.
- 🟠 **F-04 · The deleted tests' behavior landed in the one Workshop file without a suite** — Delete the `if (!message.payload.ok)` block today and all 1,772 tests still pass. This guards the exact path F-01 travels.
- 🟠 **F-05 · The preview's reasoning budget may not leave room for prose** — Medium confidence, and one live call against the default model settles it. If it holds, every preview on the default configuration is a paid dead end at N=1.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | **B−** | Layering, composition root, and ADR 2026-07-31's delegated ownership all held; the commit handoff released the Draft before anyone accepted it, and the action-result channel lost its domain owner. |
| Critical Correctness — Blake | **D** | One reachable data-loss path with its regression test deleted in the same change, plus silent corruption of prose that persists. |
| Edge Cases — Sam | **C** | The dialogue-bounded passage and the Stop-button commit are both ordinary inputs, unguarded; the empty-provider path reproduces the symptom the PR set out to remove. |
| Code Quality — Parker | **B** | Genuinely clean work — no stray debug code, comments that explain why — undercut by a docblock that promises what its predicate never checks. |
| Tests — Cal | **C+** | Parser boundary discipline is above this repo's bar and the Save path is exemplary; a coverage migration stopped halfway. |
| Codebase Fit — Stan | **B** | Aliases, barrels, alpha discipline, and the `carryCuesThroughSession` wiring reproduced faithfully; three unmarked forks the next widget will read as precedent. |
| Performance — Tim | **C+** | Render side clean and correctly sized; one real retained-history cost this PR actively multiplies, one probable paid dead end. |
| Security — Patricia | **A−** | The host-action boundary holds across every widened surface; the filesystem path is the pattern to copy. Log minimization is the only gap, and one claimed control needed correcting. |
| Observability — Oliver | **C+** | The business-rejection vs technical-failure distinction is correct and hard-won; the commit failure ending leaves no durable trail and the toast can't carry what it's given. |
| Domain Logic — Bria | **C** | Every deliverable lands and default-on is a real default across three hydration paths; the one sentence the writer reads after a failure is the one that isn't true. |

## Findings

### F-01 · 🔴 Blocking — Gesture commit closes at dispatch; the Draft is destroyed and the retry token reaches no surface `🎯 Consensus`

**Raised by:** Blake, Sam, Marcus, Oliver, Bria
**Discovery:** 2 independent · 3 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/WorkshopGesturePlaygroundModal.tsx:409` — `    onClose();` (immediately after `onCommit(...)`, replacing the deleted commit-reconciliation effect)
**Affected contract:** data — writer-authored state and a paid model artifact, plus the recovery promise in `WorkshopWidgetHandler.ts:399`

`commit()` posts `WORKSHOP_COMMIT_WIDGET` and calls `onClose()` in the same tick. `closeGesture` sets `gestureOpening = null`, unmounting the modal and discarding `dictionaryMarkdown`, `menu`, `selections`, `contextText`, `characterNotes`, and `note` — the product of one deliberate, billed generation call plus the writer's curation.

**The trigger is ordinary.** `sendRoomMessage` returns `{ committed: assistantTurn !== undefined, userTurnId }` (`WorkshopHandler.ts:1322`), and its catch returns `committed: false` on `AbortError` and any provider failure (`:1352`). The commit guard is `if (!outcome.committed || !outcome.userTurnId)` — so **a user turn that landed perfectly still trips the failure branch whenever the assistant reply doesn't arrive**, including the writer pressing Stop.

**The promised recovery does not exist.** The host does its half correctly: `createWidgetConfig` mints `wc-N` and `markDirty` persists it *before* the send, with the inherited comment naming it the retry token, and both failure branches return `widgetConfigId`. But `WorkshopApp.handleWidgetActionResult` reads only `message.payload.message` and drops the id; neither failure branch calls `postSessionState()`; and `WorkshopSessionService.getSnapshot():2378-2383` builds `visibleWidgetConfigIds` solely from windowed turns' `widgetCommit` links and standing directives, while `recordWidgetCommit` runs only on success. Marcus grepped the webview for `widgetConfigs`: four hits, all inside `useWorkshop`, consumed by no component. The config is persisted, promised, handed to the webview, and reachable by nothing.

The two pre-config guards are worse — `'Switch to a persona target before committing a widget…'` fires before any config is minted, and `launchWidget` does not check the chat target, so a writer conversing with a tool sidecar can generate, curate, commit, and lose everything with no token at all.

**Scope.** The handler and the ledger rule are **inherited** and unmodified. What this PR changed is that `ok:false` used to arrive at a live modal that still held the Draft and rendered it in a persistent inline alert — the deleted docblock said verbatim *"The Draft survives either way."* The inherited copy's promise was true under the old posture and is false under the new one.

**Recommendation:** Close on an acknowledgement rather than on the click. Have `handleCommit` post an early result once the pre-config guards pass and `createWidgetConfig` succeeds, and keep the sheet mounted (non-blocking) until then; the room send stays asynchronous and the writer never waits on the model. If fire-and-close must stand this sprint, then carry `widgetConfigId` from the failure into a "Reopen" action — `handleRequestConfig` already serves a config by id and the clone opening already reconstructs a Draft from one — and gate Commit on a non-tool chat target. Failing both, change the two strings so they stop promising a Draft the writer cannot reach.

### F-02 · 🟠 High — The whole-response quote stripper eats dialogue, and the damage is durable `🎯 Consensus`

**Raised by:** Blake, Bria, Sam, Cal, Parker
**Discovery:** 2 independent · 3 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts:150-155` — `/** Remove only a single whole-response wrapper, preserving prose-internal dialogue. */` … `const pair = quotePairs.find(([opening, closing]) => content.startsWith(opening) && content.endsWith(closing));`
**Affected contract:** data — model output returned to the writer and persisted into a durable widget config

The predicate tests the first and last characters and calls that a wrapper. It never checks the two quotes are the same pair, so a passage that opens *and* closes on dialogue satisfies it:

```
'"Get out," she said. "Now."'   →  'Get out," she said. "Now.'
'“Get out,” she said. “Now.”'   →  'Get out,” she said. “Now.'
```

The curly form is the likelier one in manuscript prose. The result is non-empty and under 1,200 characters, so `validatePreviewText` accepts it; it renders through `MarkdownRenderer` in the After pane, and on Apply rides `draft.preview` into the widget config, where `LexicalGravityConfigCodec` accepts `preview.text` as any bounded string. The writer then judges whether the lens is right from prose the host quietly broke, and that broken text rehydrates when they reopen the sheet.

This PR introduced the stripper — it did not exist under the sentinel envelope — and this PR is also what makes it reachable, because the Before pane is no longer a canned lens sample but an editable textarea the writer fills with their own prose, and the rewritten prompt instructs the model to *"Preserve the sample's basic situation, meaning, approximate length, and sentence count."* A dialogue-bounded Before yields a dialogue-bounded After. Both new tests use single-sentence wrappers, so the fixtures cannot reach the case.

**Recommendation:** Only strip when the interior contains no further occurrence of either quote character — an unstripped wrapper is a cosmetic blemish, a mis-stripped one is corrupted prose, so fail toward leaving the text alone. Or drop the stripper entirely; the prompt already forbids quoting and the length and `finishReason` guards cover the failures that matter. Add `'"Hello," she said. "Goodbye."'` to the existing `it.each` — three lines, and it is the only test that distinguishes "strip a wrapper" from "strip the first and last character."

### F-03 · 🟠 High — Widget frames stay raw in retained model history and replay on every later request

**Raised by:** Tim
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:430` — `pendingMessages.push({ role: 'assistant', content: visibleContent });`
**Affected contract:** retained persona conversation — replayed in full on every subsequent request

`toVisibleContent` (`:729-738`) strips only *capability* tool calls and collapses newlines. `stripWorkshopWidgetRecommendationControl` has three non-test call sites, all display paths — `WorkshopRunCompletion.ts:207` (feeding `session.completeRun` and the webview) and `WorkshopApp.tsx:484`. Nothing strips the copy already handed to `ConversationManager`, and `getMessages` returns the whole array with no windowing.

A Gesture frame is bounded at 15,300 characters; one that obeys the instruction to *"copy a generous, consecutive stretch of the supplied prose"* realistically lands at 4,000–8,000 — of the writer's own manuscript. A frame emitted at turn *t* of an *N*-turn session re-ships (N − t) times: four frames across a 30-turn room ≈ 85k wasted input tokens, and none of it buys anything, since an accepted recommendation is already durable on the turn and a rejected one was discarded.

**This PR multiplies exactly the thing that replays** — `workshopWidgetRecommendation.ts:31` now tells the persona that earlier chips never suppress a fresh recommendation, and `WorkshopPromptBuilder.ts:263` adds a default-on sentence inviting an assist every turn.

The corollary deserves its own attention: **the persona can see its own prior frames, verbatim, in retained history.** That is a plausible cause of the self-suppression this PR is treating with prose. The runway's claim that a persona "genuinely cannot see an earlier frame" holds for the session transcript and not for the provider conversation.

**Recommendation:** Commit the stripped content to retained history — pass the already-computed `strippedDisplayContent` down, or strip inside `toVisibleContent`. One change removes the replay cost, shrinks the persisted archive, and tests the suppression hypothesis for free. Keep the prompt sentence either way; it just stops being the only defense.

### F-04 · 🟠 High — Two commit-failure tests were deleted and their behavior landed in the one Workshop file with no suite

**Raised by:** Cal
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:275-277` — `if (!message.payload.ok) {\n  showToast({ message: message.payload.message ?? 'Gesture Playground did not reach the room.',`
**Affected contract:** test — a gesture commit the host rejects must still tell the writer something

`WorkshopGesturePlaygroundModal.test.tsx` deleted `surfaces a failed commit and keeps the draft editable` and `closes only when the host confirms the commit landed`, replacing them with `closes immediately after dispatching a valid commit`. That replacement is *correct* for the new modal contract — the modal genuinely no longer owns the failure. But the failure surfacing moved to `WorkshopApp.tsx`, and `find . -iname '*WorkshopApp*'` returns exactly one file: the source. Twenty-five sibling components under `__tests__/presentation/webview/components/workshop/` have suites.

So the suite proves the modal dispatches and closes, and `WorkshopWidgetHandler.test.ts` proves the host emits `ok: false`. Nothing proves the two ends meet. Delete the `if (!message.payload.ok)` block and 1,772 tests still pass — a rejected commit would close the sheet, discard the Draft, and say nothing. The same hole covers the `'workshop.widget_recommendation'` sentinel, which appears at three `WorkshopHandler` sites and `WorkshopApp.tsx:236` and in no test: a typo on either side silently converts the rejection toast into a room error banner, the exact distinction this PR describes itself as drawing.

**Recommendation:** One `WorkshopApp` message-routing test file, two cases: *a rejected gesture commit raises an error toast*, and *a widget-recommendation error toasts instead of reaching the room error banner*. Render `WorkshopApp`, dispatch the two envelopes through the window listener, assert on the toast. Write it as part of the F-01 fix, not after.

### F-05 · 🟠 High (Medium confidence) — The preview's reasoning budget may leave no room for prose

**Raised by:** Tim · **Blake dissents**
**Discovery:** 1 runway-prompted
**Confidence:** Medium
**Evidence:** `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts:104-105` — `maxTokens: BUDGET.lexicalPreviewOutputTokens,` / `reasoning: { effort: 'low' },`
**Affected contract:** operational — one deliberate, writer-initiated, billed call

`OpenRouterClient.ts:141` sends `max_tokens: 1200` and the `reasoning` object side by side with no clamping. The default widget model is `anthropic/claude-sonnet-5`, which carves thinking *out of* `max_tokens` rather than beside it. If OpenRouter translates `effort: 'low'` to roughly 20% of `max_tokens`, that is 240 tokens — below Anthropic's 1,024-token minimum thinking budget. Either it clamps to 1,024, leaving ~176 tokens for prose against a rewrite that needs ~200–300, so the response truncates and the *new* `finishReason === 'length'` branch hard-rejects it after billing; or the provider 400s on a below-minimum budget. Secondary: `temperature: 0.55` rides the same request, and Anthropic requires temperature 1 with extended thinking.

**Dissent:** Blake declined this for lack of a traced provider path and no evidence of the translation. Tim marks it Medium for that reason. The disagreement is about evidence available *in this repository*, not about the arithmetic.

**Recommendation:** One live preview call against the default model settles it — the PR description lists no such run. If it reproduces, either drop `reasoning` (a bounded 800-character rewrite is not a reasoning task) or raise `lexicalPreviewOutputTokens` so the prose budget survives the thinking budget. If the posture is kept, it belongs in `AGENT_RUN_POLICIES` beside the run policy rather than as a per-call-site literal, so the next widget inherits the arithmetic instead of the number.

### F-06 · 🟡 Standard — The "bounded raw response" is unbounded, against two precedents the codebase already set `🧭 Corroborated Runway`

**Raised by:** Oliver, Patricia
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:203` — `      input.log(\`Rejected widget recommendation response (${label}):\n${result.content}\`);`
**Affected contract:** operational diagnostics; data minimization

`result.content` is the entire persona response, bounded only by `maxTokens`, and it fires precisely on the rejections most likely to be enormous — `frame_too_long` means the frame already exceeded budget, and the interpolated instruction invites up to 10,000 characters of copied manuscript in `surrounding-context` alone. The same shape appears at `LexicalGravityModelService.ts:123-127`, where this PR changed what flows through it: the preview source used to be a canned lens sample and is now up to 800 characters of the writer's own prose.

Two precedents were available and neither was followed. `WorkshopRunCompletion.ts:147` — three sections up in the same file — logs `${result.content.length} chars discarded`, a length, deliberately. And `GesturePlaygroundService.logRejectedResponse:519-541`, in the same widget family, logs the length plus a 200-character head and tail.

The output channel is an in-memory `vscode.window.createOutputChannel` with no file and no telemetry, so there is no attacker and the manuscript is already on the writer's disk. The realistic exposure is entirely voluntary and entirely likely: it is what a writer pastes into a bug report, which is the workflow the PR description points them toward.

**Recommendation:** Route both new paths through the head/tail bound `GesturePlaygroundService` already uses. The diagnostic value of a rejected frame lives at its edges — the missing marker, the truncated tail — not in the middle 9,000 characters of someone's chapter.

### F-07 · 🟡 Standard — The widget action-result channel lost its domain owner `🧭 Corroborated Runway`

**Raised by:** Marcus, Stan
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:271-273` — `message.payload.action === 'commit'` / `&& message.payload.widgetId === 'gesture-playground'`
**Affected contract:** maintenance — Domain Mirroring and the Tripartite Hook Interface, both named in `CLAUDE.md`

`useWorkshop` deleted `widgetActionResult`, `handleWidgetActionResult`, and `consumeWidgetActionResult`. `WORKSHOP_WIDGET_ACTION_RESULT` now has one registered consumer, `WorkshopApp.tsx:317`, which fans `apply-standing` to `useLexicalGravity.handleActionResult` — still properly tripartite one file over — and handles the commit branch inline in the orchestrator. Every other request in `useWorkshop` pairs its send with its receive in the same file (`generateWidgetMenu` ↔ `handleWidgetMenuResult`, `requestWidgetConfig` ↔ `handleWidgetConfigData`), and the hook's own docstring still claims it "keeps the tripartite hook shape every sibling hook honors."

Structurally, a `commit` result for any widget id other than `gesture-playground` matches the outer `if`, skips the toast, and never reaches the `remove-standing` branch. Not reachable today — the id is hardcoded at the call site and rejected host-side.

Stan's refinement is worth carrying: Sprint 03's Prose Controller is `rail: 'standing'`, so it will copy `useLexicalGravity`'s correct shape. The cost lands on whoever ships widget #4 as a one-shot, and on every reader of an already-tracked god file who finds the widget domain answering to two authorities.

**Recommendation:** Restore `handleWidgetActionResult` in `useWorkshop` as a `commit`-filtered pass-through and let the component keep the toast — or, if the deletion was deliberate now that nothing awaits it, say so in one line where `commitWidget` posts, noting that `apply-standing` belongs to `useLexicalGravity`. Either resolves it; leaving it unmarked is the part that costs.

### F-08 · 🟡 Standard — The ask-prefill fallback degrades silently, and nothing watches a `live` flip

**Raised by:** Stan
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/utils/workshopWidgetAskPrefill.ts:20` — `  return \`Hey ${hostLabel}! Please prepare ${widgetLabel} for what we’re discussing, then offer it for me to review and open.\`;`
**Affected contract:** maintenance — the per-widget registry fan-out

Two per-widget dispatch sites landed in `presentation/webview` and they fail in opposite directions. `WORKSHOP_WIDGET_ICONS: Readonly<Record<WorkshopWidgetId, IconName>>` refuses to compile on an unknown id, matching `WORKSHOP_RESULT_TOOL_NAMES` and `WORKSHOP_QUICK_ACTIONS_BY_TOOL`. `buildWorkshopWidgetAskPrefill` is an if-chain with a generic tail, and its test asserts only the two live branches.

**The sharp part, which corrects the runway:** the icon record already contains `'prose-controller': 'sliders'`. It is complete over all thirteen catalog ids, live or not. Sprint 03's actual event is not *adding an id* — it is flipping `live: false → true`, and **no exhaustiveness check in this codebase watches that flag.** The record will not catch it either.

What then ships: `WorkshopWidgetsModal.tsx:77` enables the secondary button on `selectedIsLive` alone, so the moment the flag flips, "Ask agent to configure, then open" sends the generic sentence for Prose Controller — and the receiving persona has no frame to answer with, because `workshopWidgetRecommendation.ts:30` opens *"The writer has two interactive widgets you may recommend"* and defines exactly two. The writer clicks a live button, pays for a turn, and gets prose the parser reads as `absent`. That is the failure class this PR's own description says it set out to remove.

**Recommendation:** Make the copy registry-shaped rather than branch-shaped — a `Readonly<Record<WorkshopWidgetId, string>>` of seed clauses interpolated into one sentence, the shape `WORKSHOP_WIDGET_ICONS` uses one directory over. Better still for the live-flip case: assert in the widget-catalog test that every `live: true` id has both an icon and a prefill clause. That is the only check that fires on the event that actually happens.

### F-09 · 🟡 Standard — The browser ask retargets *and persists* session state before the writer acts

**Raised by:** Marcus · **Bria dissents**
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:860` — `    workshop.setChatTarget({ kind: 'host' });`
**Affected contract:** business — the sprint's completion criterion

`WORKSHOP_SET_CHAT_TARGET` is a registered mutation: `WorkshopHandler.handleSetChatTarget` calls `session.setChatTarget`, then `markDirty('chat target changed')` and `postSessionState()`. A writer mid-conversation with a guest or a tool who clicks "Ask agent to configure, then open," reads the seeded draft, and decides not to send has had their conversation target moved and persisted.

**The dissent, reported rather than resolved.** The sprint's completion criterion says *"no message/widget state changes until the writer acts."* Its Locked Contract says the ask *"targets the current Host conversation, seeds a widget-specific request into the composer, and closes the browser."* Bria reads the retarget as ticket-declared and calls the finding not material. Marcus notes the adjacent `selectTool` path seeds `buildWorkshopToolAskPrefill` with **no** retarget at all — the same UX problem, the same "the writer still sends it" docblock on the twin builder, zero session mutation — so the repository answers the same question two ways in one file.

Both readings survive the Locked Contract. The residue neither reading requires is the **persistence**: `markDirty` + `postSessionState` on a browse-time button.

**Recommendation:** Decide and mark it. Either drop the retarget and disable or relabel the secondary action when the target isn't the Host — matching the twin, costing one writer click — or keep it and say so in the docblock and the criterion. An unmarked divergence from the precedent sitting twenty lines away is what Sprint 03 will copy.

### F-10 · 🟡 Standard — An app-authored first-person apology is published under the persona's byline

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:209-211` — `'I could not prepare a usable widget setup on that pass. Please ask me to try again.'`
**Affected contract:** business — persisted writer data and transcript fidelity

The completion criterion is satisfied in the letter: no empty bubble. The question is what replaced it. `displayContent` flows into `session.completeRun`, which stamps it as `turn.content` on an assistant turn carrying `personaId` and `personaLabel` — durable in session JSON, rendered under the persona's name, riding any export. The whole reason `stripWorkshopWidgetRecommendationControl` exists is to keep machine artifacts out of persisted persona prose; this puts a different one back, in the first person, in a voice the persona did not write. Note the asymmetry: the sibling notice two lines down is carefully third-person and app-voiced.

**The runway was rejected here, twice, and correctly.** Marcus and Bria both traced the claim that this "re-enters prompt history as though the persona said it" and found it unsupported: `AgentRunEngine.ts:430` retains the model's own content, `WorkshopPromptBuilder` never rebuilds history from turns, and `AgentRunEngine.ts:425` already substitutes app-authored assistant prose one layer down. The harm is confined to the transcript and export — still real, and narrower than framed.

**Recommendation:** Author's or product's call, but make it. Either mark the fallback as app-authored — a notice-kind turn, or third-person (*"No usable widget setup came back on that pass."*) — or record in the ADR that app-authored persona speech is an accepted contract. It should not remain an unmarked placeholder in durable writer data.

### F-11 · 🟡 Standard — Provider-null content normalizes to `''` and nothing reports it

**Raised by:** Sam
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts:183-188` — `private toAssistantContent(content: unknown): string {` … `return '';`
**Affected contract:** operational — the PR's own goal of eliminating unexplained empty bubbles

The normalization is a correct crash fix; the reporting half its docblock promises was never written. Trace `''` through `completeWorkshopRun`: not aborted, not an api-key warning, findings absent, `inspectWorkshopWidgetRecommendation('')` returns `absent` — so `recommendationRejected` is false and the new apology, gated on that flag rather than on emptiness, does not apply. `session.completeRun(requestId, '')` has no empty-content guard and mints the turn. The writer gets a blank persisted assistant bubble, no toast, no error, and a billed request; the only trace is one output-channel line.

Two paths that should be equivalent are not: a rejected recommendation that strips to nothing now gets an app-authored sentence *and* a toast, while a provider that returns no content at all gets neither and produces the identical symptom. The author added a regression test for provider-null content, so this is observed behavior rather than hypothetical.

**Recommendation:** Extend the fallback condition to cover any empty `displayContent` with copy naming the actual cause, and fire a matching `events.error`, so an empty paid turn is as legible as a rejected frame.

### F-12 · 🟡 Standard — The vanished-source branch gained two behaviors and kept a test that predates both

**Raised by:** Cal · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:238-241` — `} else if (unavailableWidgetSource) {`
**Affected contract:** test

`rejects a well-formed source id the current session did not mint` still passes but asserts only the log line. This PR gave the branch a `widgetRecommendationRejected` notice with distinct copy and inclusion in `recommendationRejected`, which means a frame-only response with a vanished `ctx-N` now also gets the apology substitution. Neither is asserted. Its siblings in the same file are held to a higher bar — `invalid_frame` and `field_too_long` both assert exact notice text, and the latter asserts the apology replaces the blank bubble. Delete the whole `else if` and the suite stays green, while a writer whose attachment was removed mid-session gets a chip that never appears and no explanation.

**Recommendation:** Extend the existing test with the two assertions its siblings already carry — same fixture, four added lines.

### F-13 · 🟡 Standard — The preview-source override rule is written three times, named nowhere, and diverges on the third

**Raised by:** Parker · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/WorkshopLexicalGravityModal.tsx:117-122` — `initialDraft?.preview?.sourceText !== undefined && initialDraft.preview.sourceText !== initialDraft.resolvedLens.sample ? initialDraft.preview.sourceText : undefined`
**Affected contract:** maintenance

The design is sound — `previewSourceOverride` is `undefined` while the writer hasn't diverged from the lens's own sample, so the Before box follows a lens switch instead of stranding them on the previous lens's text. The cost is that the rule defining that sentinel is a bare comparison repeated verbatim at three sites (117-122, 155-161, 226-232) and named nowhere. The third compares against `lens?.sample` *at result time* — a different lens from the two comparing against `draft.resolvedLens.sample` — and nothing says whether that difference is deliberate.

**Recommendation:** One named helper adjacent to the `previewSource` derivation it serves, with the sentinel's meaning in its docblock. All three sites collapse to a call, and the divergence becomes a visible choice of argument rather than a discrepancy hidden inside a repeated expression.

### F-14 · 🟡 Standard — `lifecycleNote` is true in the widget catalog and false at the Tools consumer it renamed

**Raised by:** Parker · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx:59-61` — `lifecycleNote: requestViaPersona ? 'prefills an editable ask · nothing sends until you do' : …`
**Affected contract:** maintenance — the shared `WorkshopSheetItem` contract

`costNote` → `lifecycleNote` is a genuine accuracy win where it originated: all fourteen catalog values really do state how a widget joins the room and how long its committed state lives. But the field lives on the *shared* browser, documented as *"Footer note shown while this item is selected (e.g. its room lifetime),"* and the rename swept its other consumer along mechanically. `'prefills an editable ask · nothing sends until you do'` is a consent-and-send statement, not a lifetime. The old name was wrong for widgets but loosely covered both; the new one is precisely right for one consumer and precisely wrong for the other, and will prompt the next person adding a tool row to invent a lifetime for something that has none.

**Recommendation:** Keep `lifecycleNote` on `WorkshopWidgetDescriptor` where it is honest, and name the shared slot for what it structurally is — `selectionNote`. `workshopWidgetIcons.ts` then maps `selectionNote: widget.lifecycleNote`, the catalog's vocabulary stays sharp, and the Tools browser stops claiming a lifetime.

### F-15 · 🔵 Nit — Gesture copy/save restates the `copyTurn`/`saveTurn` envelope forty lines up

**Raised by:** Stan · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:991-1010` — the `SAVE_RESULT` metadata object, identical to `saveTurn:957-980` but for `toolName`, `context`, and `source`
**Affected contract:** maintenance

The choice of `GESTURE_DICTIONARY_RESULT_TOOL_NAME` is right and consistent — it sits beside `WORKSHOP_PERSONA_RESULT_TOOL_NAME` with its `ASSISTANT_RESULT_FILE_PREFIXES` entry, exactly how a non-catalog result name is added here. Only the wiring is restated, in a file already tracked as a god file, and `CLAUDE.md`'s anti-pattern checklist names this shape directly.

**Recommendation:** One `postResultAction(kind, toolName, content, context)` in `WorkshopApp`, used by all four call sites. A net line reduction now, and the third savable artifact becomes three arguments rather than eighteen lines.

### Praise — worth preserving

**F-16 · The model-output-to-host-action boundary holds across every surface this PR widens** *(Patricia, runway-prompted).* Traced rather than assumed, across six controls: the six-slug lens allowlist stays fail-closed, so a persona can never name an arbitrary project lens whose body would enter a system prompt; `LexicalGravityDirective` builds the standing frame from lens fields only, so neither `preview.text` nor the new `sourceText` rides a later request; every lens string passes `neutralizeReservedPersonaPromptDelimiters` and a hard slice; the After-pane `MarkdownRenderer` is a pane-level widening of a sink the turn bubble already uses under the same sanitizer and `default-src 'none'` CSP with no `enableCommandUris`; and `sourceReferences` *gained* a length check it never had — a security-positive tightening on a model-controlled field. *One of her six claims — that the control frame does not become recurring input — was verified wrong and became F-03; the other five stand.*

**F-17 · Save Gesture Dictionary lands on the closed filename allowlist rather than around it** *(Patricia, independent).* This PR opens a new sink — model-authored markdown reaching the workspace filesystem — and does it correctly. `GESTURE_DICTIONARY_RESULT_TOOL_NAME` is registered as a *key* in `ASSISTANT_RESULT_FILE_PREFIXES` rather than passed through as a path segment; `targetDir` is the fixed `prose-minion/assistant`; the filename comes from a sequential counter; and the webview-supplied `metadata.relativePath` — the one crossing value that *looks* like a path — is consumed only as body text. No model- or webview-controlled string reaches the filesystem as a path component. This is the pattern the third widget should copy.

**F-18 · Routing the recommendation rejection around the room error banner is correct** *(Oliver, independent).* The early return at `WorkshopApp.tsx:244` keeps a rejected recommendation out of `workshop.handleErrorMessage`, which would have set the persistent room banner and cleared `statusMessage`/`tickerMessage`. The run *succeeded*; letting it fall through would announce damage that did not happen. Distinguishing business rejection from technical failure is the hard part, and this PR got it.

**F-19 · The Gesture Dictionary Save path is tested end-to-end** *(Cal, independent).* Asserted at the `FileOperationsHandler` boundary including the `gesture-dictionary-1.md` prefix — what it looks like when coverage moves *with* the behavior. The direct counter-example to F-04, in the same PR.

**F-20 · Registry-derived vocabulary and faithful settings wiring** *(Stan, independent).* The `lifecycleNote` rename derives from `ONE_SHOT_LIFECYCLE`/`STANDING_LIFECYCLE`/`RESOURCE_LIFECYCLE` and is applied to both browser consumers — PR #98's F-04 ruling honored rather than re-litigated. The `proactiveAssistance` path reproduces `carryCuesThroughSession`'s six-step wiring end to end, and the key-driven architecture guard picks up the new key automatically. Alpha discipline is exemplary throughout: `costNote` renamed with zero leftovers, and the commit-reconciliation state fully deleted rather than deprecated.

## What the Panel Changed About the Runway

**Affirmed.** The thesis held: two of the three moves narrow model responsibility into deterministic code, and the panel found them well made — Patricia's six-control trace and Cal's read of the budget-derived tests both support it. The runway's structural claim that the commit path now has two non-adjacent commitment points was confirmed by five reviewers, and Marcus sharpened it: the problem is not the gap between them but that the in-doubt `wc-N` has *zero* UI surface. Stan tested the six conflicting-authority pairs and confirmed three.

**Refined.** Blake, Marcus, Sam, and Bria each independently traced the runway's central open question — is an orphaned `wc-N` reachable? — and answered **no**. What the runway held as structural ambiguity is a reachable regression with a deleted test. Sam refined the trigger from "provider error" to "the writer presses Stop." Tim refined the retention question into the finding that pays. Oliver refined `requestId` to **not material** (the new line matches its nearest sibling; two of three carrying it is mixed precedent, not a violated one).

**Rejected.** Six runway claims did not survive contact with the code, and each rejection improved the review:

- The app-authored apology does **not** re-enter prompt history — `AgentRunEngine` retains the model's own content, `WorkshopPromptBuilder` never rebuilds from turns, and app-authored assistant prose already exists a layer down *(Marcus, Bria)*. The runway's borrowed "attribution" lens is struck with it.
- The missing `sourceText` type guard is **inert** — the length bound sits downstream in the service, and the only sender is our own bundle under CSP *(Patricia)*.
- The After-pane markdown sink is a **pane-level** widening of an existing system-level sink, not a new one *(Patricia)*.
- `menu` with an empty `dictionaryMarkdown` is **unreachable**, and the 15,300 section ceiling is harmless for Lexical Gravity frames, which run an order of magnitude under it *(Sam)*.
- The quadratic activation-frame cost is **noise** — 118 tokens per retained user message, ~$0.16 over a 30-turn session *(Tim)*.
- The exhaustive icon record does **not** protect Sprint 03 — it already contains `prose-controller`, so it catches a new id but never a `live` flip, which is the event that actually happens *(Stan)*. This correction made F-08 worse, not better.

One claim the panel made was itself corrected: Patricia's control that the reserved frame never becomes recurring input was verified against `toVisibleContent` and found wrong — it strips capability tool calls only. That became F-03, and Tim reached the same conclusion independently.

**Still unknown.** Whether OpenRouter's `effort → budget` translation behaves as F-05 predicts. Whether Workshop widget configs have shipped to Marketplace, which decides the ADR 2026-07-30 regime for both new optional fields and is now unresolved across two consecutive sprints. Whether the `docs/design/pm-*` files were re-pulled or hand-edited, which the design README's sync policy distinguishes.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A promise the system makes must be reachable by some surface, or it isn't a promise

**Illuminated by:** F-01 (Blake, Sam, Marcus, Oliver, Bria), F-11 (Sam)

The host persists `wc-N` *before* the room send precisely so a failed commit has a retry token, and both failure branches faithfully return `widgetConfigId` — but no view derives visibility from that id, so the record exists and is unreachable. F-11 is the same shape from the other end: `toAssistantContent` normalizes null to `''` and its docblock promises the caller will report it; no caller does. In both cases the producing layer did its job correctly and the contract died in the gap where nobody owned the other half. Four reviewers had to trace the id independently to answer a question the code could have answered in one grep — that difficulty *is* the finding.

**Carry forward:** When a layer returns an id, token, or sentinel "so the caller can recover," open the caller and point at the line that recovers. If you can't, the return value is decoration and the docblock is fiction.

### Lesson — When you narrow what one party is responsible for, name where the residue lands

**Illuminated by:** F-01 vs. F-02/F-03 (the PR's own thesis), F-05 (Tim)

This PR's best instinct and its riskiest change look identical in silhouette: both take responsibility away from one party and push the remainder elsewhere. The preview and the recommendation contract move correctness *out* of model compliance and *into* deterministic host code — the residue lands somewhere that can be tested, and the budget-derived boundary tests prove it. The Gesture commit moves confirmation out of the writer's wait — and the residue lands in a toast, which holds no state, retains no Draft, and cannot be retried. Same move, opposite resolution, because the receiving surface differs in what it can be trusted to hold. F-05 is the same question at the provider boundary: shrinking `effort` to `low` doesn't shrink the floor Anthropic enforces, so the residue lands as a billed rejection.

**Carry forward:** For any "this doesn't need to block / doesn't need to be confirmed" change, finish the sentence: *the thing formerly held here is now held by ___, which survives ___ and can be retried by ___.* If any blank is a toast, a log line, or a prompt instruction, you moved the risk rather than the work.

### Lesson — A guard that checks the shape of a thing has not checked the identity of a thing

**Illuminated by:** F-02 (Blake, Bria, Sam, Cal, Parker), F-08 (Stan), F-12 (Cal)

`stripEnclosingDoubleQuotes` asks "does this start with an opener and end with a closer?" — a shape question — and calls the answer "this is one quoted span," an identity claim. For `"Get out," she said. "Now."` — a *typical* line of fiction, not an exotic one — the shape holds and the identity doesn't, so both outer marks vanish into a durable widget config that validation happily accepts because it's non-empty and under the cap. F-08 is the same slip a level up: the icon `Record` proves the *set of ids* is exhaustive, which reads like protection but says nothing about whether a widget's `live` flag flipped — and Sprint 03 is a live flip. F-12 completes the trio: the surviving test asserts the log line's shape while two new behaviors on that branch go unwitnessed.

**Carry forward:** After writing a predicate, state aloud the claim the *caller* will make from it, then hunt one input where the predicate is true and the claim is false. For a matched-pair check, that input is almost always the two-span case — and it belongs in the test file before the function is done.

### Lesson — The tests should move where the behavior moved

**Illuminated by:** F-04 (Cal), F-12 (Cal), and the praise for the Gesture Dictionary Save path (F-19)

Two real tests died with the old commit posture, and the behavior they guarded didn't die — it relocated to `WorkshopApp.tsx`, the one Workshop file among twenty-six with no suite. That's not a coverage gap; it's a coverage *migration* that stopped halfway, and the tell is precise: delete the `if (!message.payload.ok)` block and 1,772 tests still pass. The counter-example is in the same PR — the Gesture Dictionary Save path is asserted end-to-end at the `FileOperationsHandler` boundary including the file prefix, and the budget-derived boundary tests prove guidance and enforcement read one constant, which is exactly the claim the PR makes. The same PR shows both what it looks like when coverage follows behavior and what it looks like when it doesn't.

**Carry forward:** When you delete a test because its subject moved, write the replacement in the destination file *in the same commit* — and if the destination has no suite, that absence is the finding, not a reason to skip.

### Lesson — Two answers to the same question in one file is a decision nobody has made yet

**Illuminated by:** F-07 (Marcus, Stan), F-09 (Marcus, Bria), F-13 and F-14 (Parker), F-06 (Oliver, Patricia)

`useWorkshop` dropped its tripartite slice for an inline `widgetId === 'gesture-playground'` branch while `useLexicalGravity` keeps the proper shape one file over — and `useWorkshop`'s docstring still claims it honors the pattern every sibling honors. `askHostToConfigureWidget` retargets the chat; its tool-ask twin in the same file deliberately doesn't. F-06 logs unbounded content while two siblings — one three sections up, one in the same widget family — already bound theirs. F-13 writes the same override rule three times unnamed, and the third compares against a different lens with no note saying whether that's on purpose. None of these are style; each is a place where the repo now gives a reader two credible answers and no way to tell which is intended. F-14 shows the honest version of the same tension: a good rename swept a consumer where the word means something else, because the field is shared and nobody asked what it meant *there*.

**Carry forward:** When your change makes a file disagree with its own docstring or with the function forty lines above it, that's the reviewable unit — fix it, or leave one line saying which one is right and why.

> The panel corrected its own runway on six points and answered its central open question in the negative — which is the same discipline these lessons ask of the code: hold the claim loosely, then go look.

## Horizon Watchlist

Not merge blockers. Real pressures the runway and panel surfaced that belong in `.todo` rather than in this PR.

- **The `live` flip has no guard.** Every per-widget registry in the codebase is exhaustive over *ids*, and Sprint 03's event is a flag change. A catalog test asserting that every `live: true` id has an icon, a prefill clause, and a recommendation frame is the fitness function this family is missing.
- **The prompt monolith's own trigger is approaching.** `.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md` names "before a third live widget" as its deadline, and this PR interpolated five budget numbers *into* the string that must eventually be split. Decomposition got slightly harder, deliberately and with the debt filed.
- **The Marketplace release gate lands on two optional fields at once.** ADR 2026-07-30 will force a classification for `proactiveAssistance` and `preview.sourceText` simultaneously. Whether widget configs have shipped is unresolved across two consecutive sprints and should be answered before it becomes urgent.
- **Writer manuscript prose is now durable in session JSON.** Up to 800 characters per Lexical Gravity config via `preview.sourceText`. Session export acquires a content-sensitivity dimension it did not have when previews demonstrated only built-in lens samples.
- **Two live widgets, two commit postures.** Stan's read is that Sprint 03 is standing and will copy Lexical Gravity's, so the fork's cost is deferred to widget #4 — which means the decision can be made deliberately rather than under pressure, if it is made at all.
- **`WorkshopApp.tsx` at 1,800 lines took another +72** while `useWorkshop` shed 23. The tracked god-file debt names this file as candidate seam #3; this PR moved logic toward it under a sprint boundary that explicitly forbids the extraction. Worth recording in the debt entry so Sprint 02C starts from the true trend line.

## The Closer

🔮 **Fortune cookie**

> *The token you saved for the retry was real. The door to it was the part you imagined.*

## Final Assessment

**Needs rework**, on one finding. F-01 is a reachable path — the writer presses Stop — that destroys a paid artifact while the copy tells them it was kept, and the test that used to catch it was deleted in the same change. It is not a deep problem: the recovery seam already exists, the config is already persisted, and its id is already on the wire and merely discarded. Fix that, add the `WorkshopApp` routing test alongside it (F-04), and land the three-line quote-strip guard (F-02).

Everything structural is sound. The layering held, the composition root is untouched, ADR 2026-07-31's delegated ownership was honored to six lines of event wiring, and Patricia's six-control trace found the epic's central invariant — personas prepare, writers commit — intact across every surface this PR widens. Two of the three core moves are genuinely well made and worth copying.

The third move is the one to think about again. Narrowing what the writer waits for was the right instinct; the residue just landed somewhere that cannot hold it. That is a smaller correction than it sounds like, and the PR has already built most of the machinery it needs.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
