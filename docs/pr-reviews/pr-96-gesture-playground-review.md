# MR Review — feat(workshop): deliver Gesture Playground

**Author:** Okey Landers · PR #96 · reviewed 2026-07-30
**Branch:** `claude/gesture-dictionary-prompt-qgeuyq` → `main`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | Guest join stamps artifact deliveries for turns the packer dropped; the dedupe makes the false rows permanent | Blake | 🎯 | **Open** — verified; fix is `join.transcript.deliveredTurnIds` |
| 2 | 🟠 High | Cancellation is parsed as a model failure, and that failure dumps the writer's unbounded manuscript-derived response into the Output channel | Oliver, Patricia | 🎯🎯 Strong | **Open** — compound; both halves verified independently |
| 3 | 🟠 High | A cancelled or failed widget commit leaves a permanent room turn promising directions whose body was never recorded | Blake, Bria | 🎯 | **Open** — traced independently by two reviewers |
| 4 | 🟠 High | `scope: null` is silently repaired with **no** normalization tag — the `=== undefined` guard misses what `??` catches | Sam | — | **Open** — verified |
| 5 | 🟠 High | `inferred-missing-scope` is logged but never regression-tested — violates the ADR this same PR introduces | Cal, Ada | 🎯 | **Open** — proven by mutation; full suite stays green |
| 6 | 🟠 High | Temperature ships at `0.7`; the concept doc specifies `0.4–0.5` and names the gate for raising it | Bria | — | **Open** — verified against `DictionaryService` (0.4 ×4) |
| 7 | 🟠 High | `buildGestureDirective` — pure domain prompt-assembly — lives in the infra adapter and is imported back up into the application layer | Marcus | — | **Open** — only bare function export in the whole infra services tree |
| 8 | 🟠 High | Every session-state broadcast ships every widget config's full 32k dictionary; collection is uncapped and never retires | Blake | — | **Open** — 40 `postSessionState()` call sites |
| 9 | 🟠 High | The 50K-ceiling diagnosis never fires when the dictionary itself is what got truncated | Sam | — | **Open** — reproduced |
| 10 | 🟠 High | The actual Cancel route is never invoked in any test; the token guard at `:248` is unproven | Cal | — | **Open** |
| 11 | 🟡 Standard | New cancel message skips the shared `CancelRequestPayload` contract and sends an empty payload with no `requestId` | Stan | — | **Open** — factory is imported in the same file and used correctly twice |
| 12 | 🟡 Standard | New widget-config ledger inlined into an already-2,778-line service | Marcus | — | **Open** |
| 13 | 🟡 Standard | Two files named `workshopWidgets.ts` across two layers — both doc-comments name the fix neither took | Parker | — | **Open** |
| 14 | 🟡 Standard | Marker adjacency hand-enumerated a second time, disconnected from `ORDERED_MARKERS` | Parker | — | **Open** |
| 15 | 🟡 Standard | Four copy-pasted "invalidate then set" callbacks encode one domain rule four times | Parker | — | **Open** |
| 16 | 🟡 Standard | Thread-artifact integrity does O(turns × artifacts) where an id→index Map already exists in the same function | Tim | — | **Open** — fix is a rename |
| 17 | 🟡 Standard | ~10K-token system prompt, uncached, resent whole on every Generate/Regenerate; ~168K tokens at the ceiling | Tim | — | **Open** |
| 18 | 🟡 Standard | Source-reference limits tested one-past-the-boundary, never at it — against this file's own convention | Cal | — | **Open** |
| 19 | 🟡 Standard | Regenerate-triggered cancellation logs nothing, while explicit Cancel does | Oliver | — | **Open** |
| 20 | 🟡 Standard | `relativeDuration` rounds 59m30s–60m into "60 minutes" and 23h30m+ into "24 hours" | Sam | — | **Pre-existing** — not introduced here; flagged because this PR routes new content through it |
| 21 | 🟢 Nit | Relative import where the sibling that constructs this class uses the alias | Stan, Marcus | 🎯 | **Open** — one line |
| 22 | 🟢 Nit | ADR title drops the date both of its PR-mates use | Stan | — | **Open** |
| 23 | 🟢 Nit | Always-mounted, unmemoized modal re-executes its render body on every Workshop keystroke | Tim | — | **Open** |
| 24 | 🟢 Nit | Memory-bank completion record documents the pre-amendment Haiku default; code ships Sonnet 5 | Bria | — | **Open** — the code is right, the receipt is stale |
| 25 | 🟢 Praise | Widget-commit persistence spine survives a full export → JSON → parse → hydrate round trip | Ada | — | **Verified** |
| 26 | 🟢 Praise | Full suite green and all three typecheck projects clean — a real green, not a scoped one | Ada | — | **Verified** |

### Note on the one dropped finding

Oliver initially reported `inferred-missing-scope` as *never logged*, quoting a
`// TEMP-EXPERIMENT` comment. That comment was a **mutation test another reviewer left
transiently on disk** while probing the same file, not shipped code. Verified against PR
head: `WorkshopSessionCheckpointNormalization.ts:46` does push the tag, and
`WorkshopSessionPersistenceCoordinator` logs the array. No `TEMP-EXPERIMENT` string exists
anywhere in the tree. The finding is dropped per the panel's diff-first rule. The real gap
at that location is #5 (logged, but untested) and #4 (the `null` branch, which is genuinely
never tagged) — so the location was right and the mechanism was wrong.

### Verification performed for this review

Independent of the panel, run against PR head `cd7abe4`:

- **`npx jest --runInBand` → 147 suites / 1675 tests / 1 snapshot, all green** (58.6s).
- **`typecheck:core`, `typecheck:webview`, `typecheck:ext` → all exit 0.** The PR body
  claims only `typecheck:core`; all three are in fact clean.
- **Mutation test for #5:** deleting `normalizations.push('inferred-missing-scope')` leaves
  the entire suite green — 147/147, 1675/1675. The audit entry is unprotected.
- **Round-trip probe for #25:** `createWidgetConfig` → `beginPersonaMessage` → `completeRun`
  → `recordRoomThreadArtifacts` → `recordWidgetCommit` → `recordWidgetArtifactDelivery` →
  `exportCommittedState` → `JSON` → `parseWorkshopSessionStateV1` → `hydrateCommittedState`
  passes; both the widget config and the room thread artifacts survive.
- Working tree returned to a clean PR head after both experiments.

---

## Blast Radius

- **86 files changed · +10,570 / −417 lines**
- **25 new files** · 1 rename (`WorkshopSessionStateV1Migration.ts` → `WorkshopSessionCheckpointNormalization.ts`) · 0 deletions · 15 commits
- **Migrations:** none in the DB sense; the analogue is the **persisted Workshop session
  codec**, which this PR reshapes — and which holds a writer's saved work
- **New backend seams:** `WorkshopWidgetHandler` (603 lines), `GesturePlaygroundService`
  (421), `WorkshopThreadArtifactFrame` (73)
- **New frontend surface:** `WorkshopGesturePlaygroundModal.tsx` (764), `workshop.css` (+625)
- **New prompts:** 874 lines shipped into the context window (`00-gesture-dictionary.md` +
  `01-gesture-dictionary-example.md`)
- **New tests:** ~2,700 lines across 9 files
- Three ADRs added — one of which (`2026-07-30-workshop-session-codec-evolution.md`) sets
  the rule that findings #4 and #5 violate. The rulebook and its first exceptions ship together.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | C |
| 🧪 Tests | C− |
| 📖 Quality | B− |
| ⚡ Performance | B− |
| 🎯 Domain | C |

---

## Executive Briefing

🔴 **[Blake]** Guest join records artifact deliveries against the *unpacked* turn list while
the packer ships a bounded subset — and `alreadyRecorded` then blocks the correct record
forever. The same file already does this right at three other call sites.

🟠 **[Oliver + Patricia]** 🎯🎯 A cancelled generation is fed to a strict parser, fails, and
triggers a log that dumps the entire unbounded model response — up to 50,000 tokens of
manuscript-derived text — into the Output channel. Two reviewers found opposite halves of
one defect; neither saw the other's.

🟠 **[Blake + Bria]** 🎯 A widget commit whose reply fails or is cancelled leaves a permanent
room turn announcing "here are the gesture directions I want" with no artifact ever recorded.
There is no compensating removal — no such method exists.

🟠 **[Sam]** `scope: null` is silently rewritten to `'excerpt'` with no normalization tag at
all: the guard uses `=== undefined`, the assignment three lines later uses `??`. The repair
happens; the paper trail the new ADR promises does not.

🟠 **[Bria]** Temperature ships at `0.7` where the concept doc specifies `0.4–0.5` and names
fixed-fixture evaluation as the *only* license to raise it. No such evaluation exists in the
diff.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — Domain formatting lives in the infrastructure adapter, then gets imported back up

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:402`

`buildGestureDirective` is a pure function — zero dependency on `AIResourceManager`,
`PromptLoader`, or anything infrastructural — that formats the room-facing directive text
from a widget draft. That is domain-shaped prompt assembly, and this codebase already has a
home for exactly that job: `WorkshopPromptBuilder.ts` in `application/services/workshop/`,
which holds twelve sibling `buildWorkshop*()` functions doing the identical thing. Instead it
landed in the infra adapter and is imported back *across* the boundary into the application
layer at `WorkshopWidgetHandler.ts:16-20`, called at line 292.

I grepped the entire `infrastructure/api/services/` tree: `buildGestureDirective` is the
**only bare function export anywhere in it**. Every sibling service — `AssistantToolService`,
`DictionaryService`, `ContextAssistantService` — exports only its class. This is precisely the
"imports going up the layer stack" anti-pattern the project's own checklist names.

It costs nothing today. But the widget catalog lists eleven more widgets on the roadmap, and
if the next one copies this file's shape instead of `WorkshopPromptBuilder.ts`'s, the infra
layer quietly becomes a second, uncoordinated home for prompt-building. Move it now, while
it's a one-line relocation.

### 🟡 Standard — New widget-config ledger inlined into an already-2,778-line aggregate

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1008`

The PR adds a self-contained sub-aggregate — `widgetConfigs`/`widgetConfigCounter` plus
`createWidgetConfig`, `getWidgetConfig`, `recordWidgetCommit`, `mintWidgetArtifactId`,
`recordWidgetArtifactDelivery` — plus a parallel `threadArtifacts` ledger, onto a file already
six times over the project's own 500-line service ceiling.

What gives me pause is that this PR *demonstrates the correct move on the handler side* —
`WorkshopWidgetHandler` was split out of `WorkshopHandler` precisely to keep the orchestrator
from absorbing one more concern — and doesn't apply the same discipline to the service.
Unlike the old turn/persona logic, which is genuinely entangled and hard to extract
retroactively, the widget-config ledger is brand new and only reaches into `this.turns` for
validation. It is about as clean an extraction candidate as this file will ever offer.

Telling detail: the tests already treat it as its own concern —
`WorkshopWidgetConfigs.test.ts`, "the session-owned widget-config spine" — even though
production code doesn't mirror that seam. A small owned collaborator, constructed by and
serialized through `WorkshopSessionService`, satisfies the aggregate-root argument without
more inline growth.

### 🟢 Nit — Relative import where the working alias sits one directory up [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts:37`

Every other import in this file uses the semantic alias. This one drops to
`./WorkshopSessionMessageHandler`. The alias is proven working one call site up, at
`WorkshopHandler.ts:162` — the file that constructs this very class.

> *"The widget handler earns its seam by mirroring the session handler exactly, but `buildGestureDirective` packed a domain thought into an infrastructure suitcase — and that's the kind of border crossing that looks harmless right up until eleven more widgets follow it through the same unguarded door."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🔴 Blocking — Guest join stamps artifact deliveries for turns the packer dropped [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:753`

```ts
joinRoomTurns.map((turn) => turn.id),
```

`joinRoomTurns` is the *unpacked* projection from `prepareJoinSnapshot`. What actually ships
is `buildWorkshopGuestTranscript` → `packWorkshopTurnsNewestFirst`, bounded by
`guestJoinSnapshot` at 100 turns / 100,000 chars — and this PR *newly feeds artifact bodies
into that measurement* via `threadArtifactsForTurn` (`WorkshopRoomFrameRenderer.ts:158`),
which makes truncation more likely than it was before, not less.

I ran it: three turns each carrying a widget artifact, the packer delivered
`['turn-3-user-1']` and omitted two. All three ids still went to
`recordRoomThreadArtifactDeliveries`, which appends `message-attachment` rows with
`sizeChars: artifact.content.length` to `guestWriterSources` for artifacts the guest never
read.

Two things make it unrecoverable. `adoptPersonaGuest` sets `lastSeenRoomTurnId = roomHead`,
so those turns are never re-projected. And `alreadyRecorded`
(`WorkshopSessionService.ts:942`) suppresses any later *correct* recording of the same
`artifactId`. The false rows export in `writerSources.guests` and survive every reload.

The sibling that does this correctly is `WorkshopRoomDeliveryService.commit()`, which passes
the guarded `delivery.deliveredTurnIds` and whose own comment says never derive an
acknowledgement from anything but the exact shipped prefix. **And this file already agrees
with it** — `WorkshopHandler.ts` uses `roomDelivery.deliveredTurnIds` correctly at lines 996,
1223, and 1241. Only the join path at 753 reaches for the unpacked list.

Searched the test tree for `recordRoomThreadArtifactDeliveries`: **zero references.**

Fix is `join.transcript.deliveredTurnIds`.

### 🟠 High — Every session-state broadcast ships every widget config's full 32k dictionary

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:2295`

`cloneWidgetConfig` returns the complete draft — `dictionaryMarkdown` (≤32,000 chars),
`contextText` (≤10,000), the full menu, `writerInstructions`, `characterNotes`.
`getSnapshot()` windows `turns` to 200 via `WORKSHOP_SNAPSHOT_TURN_WINDOW` but sends
`widgetConfigs` whole, and `createWidgetConfig` has no cap — the header comment itself states
that clone-and-recommit "appends new entries and never retires old ones."

There are **40 `postSessionState()` call sites** in `packages/core/src/application`. It fires
on every turn completion, every capability commit, every context change. Twenty gesture
commits in one session is roughly **1MB of draft text re-serialized across the webview bridge
on every one of those events** — and the same bodies are written into each checkpoint.

The sibling projections in this same file deliberately do the opposite:
`messageAttachmentSnapshot` (2661) strips `content` unconditionally, and `attachmentSnapshot`
(2741) strips it for file-backed items, with `WORKSHOP_REQUEST_CONTEXT_ATTACHMENT` as the
on-demand read route. The clone path only needs the body when a chip is actually opened —
same shape as the attachment fetch.

### 🟠 High — A cancelled widget commit leaves a permanent room turn advertising a body that was never recorded [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1209`

Gated on `assistantTurn`, but the user turn was already pushed into the ledger at 1067/1101
with `widgetCommit = { artifactId: ta-M, selectionCount: N }`, and `abandonRun` explicitly
"keeps visible turns" (`WorkshopSessionService.ts:1952`).

Trace: writer commits → `handleCommit` mints `wc-N`/`ta-M` → `executeMessage` creates the
user turn → writer hits Stop, or the provider fails → `completeWorkshopRun` returns undefined
→ line 1209 is skipped → `settleActiveRun` calls `sessionPersistence.flush()`, so the turn
persists.

The writer is told "The room did not accept the commit" while a room-audience turn reading
*"here are the gesture directions I want"* becomes permanent history with
`getRoomThreadArtifactsForTurn(turn.id) === []`. Every subsequent guest join and room
catch-up renders that turn as a bare promise with nothing attached, and a retry mints a
second, duplicate turn beside it.

Integrity validation won't surface it: the turn-side widget check
(`WorkshopSessionStateV1Integrity.ts:245`) verifies only that `widgetConfigId` resolves, never
that `artifactId` has a body. Either drop the `widgetCommit` decoration when the run doesn't
land, or record the artifact when the turn is minted rather than when the reply arrives.

> *"The acknowledgement says the guest read it, the packer says it never shipped, and the dedupe makes sure nobody ever finds out — I've cleaned up this exact class of ledger before and it does not get easier at 3am."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — `scope: null` is silently repaired with no normalization tag

`packages/core/src/application/services/workshop/WorkshopSessionCheckpointNormalization.ts:160-161`

This module's whole premise — and the PR's own ADR — is that every checkpoint repair is
"narrowly named, logged and regression-tested." The code names and logs the case of
`scope === 'open'` coexisting with an excerpt, and the case of `scope === undefined`.

But `state.scope` has a **third legal value** per the shape grammar: `null`
(`WorkshopSessionStateV1Shape.ts:68-69`, "excerpt, open, or null"). Nothing forbids
`scope: null` while `excerpt` is defined — the only referential rule guards `'open'`.

Here's the trap. Line 161 reads `state.scope ?? (excerpt ? 'excerpt' : null)` — and `??`
treats `null` exactly like `undefined`, so the value is silently substituted with `'excerpt'`.
But the tagging guard three lines up at 45 reads `if (state.scope === undefined)` — **strict
equality, which does not catch `null`.** So the repair fires and the record doesn't.

I verified rather than inferred: built a valid state, forced `scope = null` with a real
excerpt attached, ran it through the actual `hydrateCommittedState`. No exception.
`result.normalizations` came back as `["headed-missing-room-offsets"]` only — no scope tag at
all — and the hydrated state's `scope` had become `"excerpt"`. The correction happens; the
paper trail the ADR promises does not.

### 🟠 High — The truncation-ceiling diagnosis never fires when the dictionary itself is what got cut off

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:200-201`

`truncated = result.finishReason === 'length'` is computed, then `parseCompositeResponse`
runs. The truncation-aware message is wired only into the *menu* path — `menuError: truncated
&& !parsed.menu ? '...50,000-token output ceiling...' : parsed.menuError`.

But if the model hits that same ceiling while still writing the *dictionary* body — before
`===END_GESTURE_DICTIONARY_V1===` ever appears — `extractDictionary` throws inside the first
try block, which re-throws the generic message and propagates straight out of `generateMenu`.
The `truncated` flag and the ternary are never reached, so the specific wording is silently
lost.

I confirmed with a scratch test feeding `{ finishReason: 'length' }` and an unclosed
dictionary frame. Result: *"The model returned an unusable Gesture Dictionary
(===END_GESTURE_DICTIONARY_V1=== must appear exactly once (found 0)). Try Generate again."* —
no mention of the ceiling, though `truncated` was `true` in scope moments earlier.

The existing test only covers the case where the dictionary closes cleanly and the *menu* is
missing. The symmetric case has no test — and it's very plausible, since the system prompt
explicitly tells the model "Do not be thrifty" about dictionary length, right up against a
32,000-char dictionary budget inside a 50,000-token response budget. The writer gets the
least helpful of the two possible truncation messages.

### 🟡 Standard — `relativeDuration` rounds 59m30s–60m into "60 minutes"

`packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts:49-50`

Noting up front: this function is **untouched by this PR** — confirmed via
`git diff origin/main...HEAD`. I'm flagging it because the PR now routes new thread-artifact
content through the same temporal-block renderer, so it carries more weight than it did.

The bucket is selected by `clamped < threshold` *before* rounding. For any gap in
[3,570,000ms, 3,600,000ms) the `< 60*60_000` branch is taken, then `Math.round(clamped/60_000)`
rounds up to exactly 60 — producing the literal string `"60 minutes"` instead of `"1 hour"`.
`relativeDuration(3_599_999)` → `"60 minutes"`; `relativeDuration(3_600_000)` → `"1 hour"`.
Same pattern one level up: `relativeDuration(86_399_999)` → `"24 hours"` instead of `"1 day"`.

This string lands in the `[X later]` gap markers fed to the model, so a real 59m45s pause is
announced to the persona as "[60 minutes later]". No test sits near either boundary.

> *"Found the trap door in the dictionary's own error path — hit the token ceiling mid-dictionary and the code tells you it's 'unusable,' never that you just needed more room."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — Two files named `workshopWidgets.ts` — and one's own doc-comment names the fix it didn't take

`packages/core/src/presentation/webview/components/workshop/workshopWidgets.ts:4`

This presentation module and `packages/core/src/shared/constants/workshopWidgets.ts` share an
identical basename across two architectural layers. The project already has the right
precedent for exactly this split: `shared/constants/workshopTools.ts` (catalog) pairs with
`presentation/.../workshopToolIcons.ts` (webview-only icon map) — a distinct name for the
distinct layer.

Both new files even say so out loud. This file's line 6 reads "icons (the workshopToolIcons
pattern)". The shared registry's line 8 reads "(workshopWidgetIcons pattern, mirroring
workshopTools.ts)". Two separate doc-comments name the convention that should have produced
`workshopWidgetIcons.ts`, and neither file adopted it.

The cost is small but permanent: `Cmd+P workshopWidgets` gives two hits with no clue which is
the deterministic catalog and which is the webview adapter, auto-import can offer the wrong
one, and a future presentation-side `workshopWidgets.test.ts` collides in spirit with the one
that already exists under `__tests__/shared/constants/`. Nothing about the content requires
sharing the name.

### 🟡 Standard — Marker adjacency is hand-enumerated a second time, disconnected from where it's defined

`packages/core/src/utils/workshopWidgetRecommendation.ts:172`

`ORDERED_MARKERS` (line 73) is the single declared source of truth for frame field order —
the strictly-increasing-index check at 152 reads directly from it. But the "no debris between
fields" check nine lines later is seven `onlyBlankBetween(a, b)` calls, each pair copied by
hand from the adjacency `ORDERED_MARKERS` already encodes. Same knowledge, asserted twice,
nothing tying them together.

This frame format has already grown once, from tools to widgets. Insert a field into
`ORDERED_MARKERS`, forget the matching `onlyBlankBetween` line, and stray debris is silently
accepted. Since the array already alternates START/END, the pairs are just its even-indexed
neighbors:

```ts
const boundaryGaps = ORDERED_MARKERS.flatMap((marker, i) =>
  i % 2 === 0 ? [[marker, ORDERED_MARKERS[i + 1]] as const] : []
);
if (boundaryGaps.some(([left, right]) => !onlyBlankBetween(left, right))) {
  return { outcome: 'rejected', rejection: 'invalid_frame' };
}
```

Add a field and the check covers it automatically.

### 🟡 Standard — Four copy-pasted "invalidate then set" callbacks

`packages/core/src/presentation/webview/components/workshop/WorkshopGesturePlaygroundModal.tsx:268`

`changeTargetPhrase`, `changeWriterInstructions`, `changeContextText`, and
`changeCharacterNotes` (268–286) are byte-for-byte identical in shape: call
`invalidateGeneratedArtifacts()`, then call one setter.

The domain rule underneath — *editing any pre-generation field invalidates the current
menu/dictionary* — is real and worth encoding. It's just encoded four times instead of once.
That's invisible until the fifth field arrives, gets pasted from whichever clone is nearest,
and either forgets the invalidate or wires the wrong setter. Nothing would catch it at review
time, because all four blocks look equally correct in isolation.

```tsx
const changeDraftField = React.useCallback(
  (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    invalidateGeneratedArtifacts();
    setter(value);
  },
  [invalidateGeneratedArtifacts]
);
```

One place owns the rule; adding a field becomes a one-line call.

> *"Two files named `workshopWidgets.ts`, and one's own doc-comment names the exact pattern that would've avoided it — that's not a naming gap, that's a note to self nobody acted on."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — `inferred-missing-scope` is the one normalization the new ADR's own mandate doesn't cover [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionCheckpointNormalization.ts:46`

ADR 2026-07-30, added by this PR, requires: "Each normalization must be deterministic, safe by
default, logged by name, and covered by a regression test." I checked all nine names one at a
time. `restored-undelivered-withdrawal`, `normalized-open-session-with-excerpt`,
`discarded-legacy-scope-transition`, `defaulted-capability-principal`,
`defaulted-widget-dictionary-sharing`, `defaulted-widget-source-references`,
`discarded-legacy-delivery-cursors`, and `headed-missing-room-offsets` all have a test
asserting `result.normalizations` contains that exact string.

`inferred-missing-scope` does not. Zero hits in any `.test.ts`.
`WorkshopSessionScope.test.ts:653-663` and :665 both `delete legacy.scope` and exercise this
exact branch — but they only assert `restored.getScope()`; neither captures the
`hydrateCommittedState` return value.

I proved it rather than assuming it: commenting out the push and running Scope + Persistence
+ PersistenceCoordinator still passed 110/110. *(Orchestrator note: the same mutation against
the **full** suite also stays green — 147 suites, 1675 tests.)*

To be precise about scope: the *logging* half of the ADR requirement is satisfied —
`WorkshopSessionPersistenceCoordinator` logs whatever's in the array generically. It is
specifically the regression-test half that's missing for this one name.

### 🟠 High — The actual Cancel route is never invoked in any test

`packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts:248`

`GesturePlaygroundService.test.ts` (489 lines) has zero mentions of signal/abort/cancel, which
is defensible — the service only forwards `request.signal` to `engine.runInitial`.

But the real orchestration — `WorkshopWidgetHandler.handleCancelGenerate`, wired to
`CANCEL_WIDGET_GENERATE_REQUEST`, the message the UI's Cancel button actually sends — is never
called by name anywhere in the suite. The only hit outside this handler's own test file is
`WorkshopHandler.test.ts:295`, which asserts `router.hasHandler(...)` is `true`. That's route
registration, not behavior.

The one test that touches cancellation —
`WorkshopWidgetHandler.test.ts:322`, "drops the superseded call silently when a regenerate
lands first" — triggers `cancelActiveGeneration()` indirectly via a *second* `handleGenerate()`
call. It never constructs a `CancelWidgetGenerateRequestMessage`.

So the token-matching guard at line 248, which exists specifically so a stale Cancel can't kill
a *newer* in-flight generation, has nothing proving it does its job. If that condition
regressed — dropped check, flipped comparison — a user clicking Cancel then immediately
Generate could have the delayed cancel silently kill the new request, and nothing here would go
red.

### 🟡 Standard — Source-reference limits tested one-past-the-boundary, never at it

`packages/core/src/__tests__/utils/workshopWidgetRecommendation.test.ts:203-204`

This file establishes its own boundary convention at lines 291–306 — "accepts %s at its exact
bound and rejects one character more" — for `writerInstructions` and `characterNotes`, and
again at 308–336 for `targetPhrase`/`surroundingContext`. Each proves both directions.

That convention is not applied to `gestureSourceReferences` (max 8) or
`gestureSourceReferenceCharacters` (max 500). "Too many references" only tries 9 and never
confirms exactly 8 is accepted; "over budget" uses a 500+ character id and never an
exactly-500 accepted case. `GesturePlaygroundService.test.ts:245-273` has the identical
asymmetry for the same two budgets.

Both production comparisons use `>` correctly today, so I'm not claiming a live bug. But per
the sibling convention two dozen lines away in the same file, this is exactly the off-by-one a
`>=` typo would sail straight through.

> *"The regenerate path gets a lovely regression test — the actual Cancel button has never once been pressed in this entire suite, and I've seen this movie: the race always waits for the branch nobody clicked."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — New cancel-generate message skips the shared `CancelRequestPayload` pattern

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:519`

```ts
post(MessageType.CANCEL_WIDGET_GENERATE_REQUEST, {});
```

Every other cancellable streaming op in this codebase — `CancelAnalysisRequestMessage`,
`CancelDictionaryRequestMessage`, `CancelContextRequestMessage`,
`CancelCategorySearchRequestMessage`, `CancelWorkshopRequestMessage` — extends
`MessageEnvelope<CancelRequestPayload>` (`{ requestId, domain }`,
`shared/types/messages/streaming.ts:61-65`) and is constructed through the shared
`createCancelRequestMessage(domain, requestId, source)` factory.

The new `CancelWidgetGenerateRequestMessage` (`workshop.ts:1596`) instead declares an ad hoc
`MessageEnvelope<{ token?: string }>`, and its call site sends an empty payload with no
`requestId` at all.

The kicker: `useWorkshop.ts` **already imports `createCancelRequestMessage` at line 28** and
calls it correctly twice in this very file — line 558 for `'workshop-context'`, line 665 for
`'workshop'`. The third cancel button, two functions later, just doesn't reach for the tool
sitting right there.

Not a live bug today, since there's only ever one active generation. It's a shared contract
this PR quietly opts out of.

### 🟢 Nit — Relative import where the sibling that builds this class uses the alias [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts:37`

Zero-relative-imports is stated policy. `WorkshopHandler.ts:162` — the file that *constructs*
`WorkshopWidgetHandler`, sitting in the same directory — imports this exact target correctly as
`@handlers/domain/WorkshopSessionMessageHandler`.

### 🟢 Nit — ADR title drops the date its own PR-mates use

`docs/adr/2026-07-22-conversation-widgets.md:1`

This PR adds three ADRs. The other two follow the dated-title convention that's been standard
since ADR 2026-06-18 — `# ADR 2026-07-29: ...` and `# ADR 2026-07-30: ...` — as do the
immediately preceding Workshop ADRs (07-21, -24, -25, -26). This one alone reverts to the
pre-06-18 undated style.

> *"We imported `createCancelRequestMessage` into this file, used it correctly twice, and then the third cancel button just walked past it like it wasn't even there."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — Thread-artifact integrity does O(turns × artifacts) where an id→index Map already exists in the same function

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:177`

```ts
const turn = state.turns.find((candidate) => candidate.id === artifact.turnId);
```

This sits inside `for (const artifact of state.threadArtifacts ?? [])`, new in this PR, so
every persisted thread artifact triggers a full linear scan of `state.turns`.

The function already builds `turnIndexes = new Map(state.turns.map((turn, index) => [turn.id,
index]))` at line 131 — pre-existing code, same file — for exactly this lookup, and reuses it
at 138. The new widget code ignores it and re-derives the answer the slow way, while
everywhere else in this same PR's additions (`turnIds.has(...)`, `widgetConfigIds.has(...)`,
`committedArtifactIds.has(...)`) correctly uses O(1) lookups.

The math: at this codebase's scale — turns in the tens to low hundreds, artifacts fewer —
worst case is roughly 200 × 200 = 40,000 string comparisons. Sub-millisecond, not in a render
loop. **It genuinely does not matter today.**

It's also not a one-off: validation runs once via `parseWorkshopSessionStateV1` on load
(`WorkshopSessionPersistenceCoordinator.ts:617`) and twice more in `hydrateCommittedState`
(`WorkshopSessionService.ts:2126`, `:2133`), so a single session open pays it up to 3×. Still
cheap. I'm flagging it because the fix is a rename, not a redesign:
`state.turns[turnIndexes.get(artifact.turnId)]`, using a pattern the function already
demonstrates it knows.

### 🟡 Standard — ~10K-token system prompt, uncached, resent whole on every Generate

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:76-79`

`00-gesture-dictionary.md` + `01-gesture-dictionary-example.md` total **39,960 characters**.
Using this PR's own estimator (`estimateVisibleTokens`, characters ÷ 4), that's **~10,000
tokens of static system prompt**, identical on every call, loaded fresh via
`PromptLoader.loadPrompts` with no cache and sent with zero prompt-caching — I grepped
`cache_control`, `ephemeral`, and `promptCaching` across `infrastructure/api/` and found no
hits anywhere.

On top of that fixed tax, `promptBudgets.ts` allows `gestureReferencedSourceCharacters:
420_000` (~105,000 tokens) plus `gestureOutputTokens: 50_000`. Ceiling arithmetic:

| Component | Tokens |
| --- | --- |
| System prompt | ~10,000 |
| Context | ~2,500 |
| Character notes | ~375 |
| Writer instructions | ~250 |
| Target phrase | ~75 |
| Sources | ~105,000 |
| **Input subtotal** | **~118,200** |
| Output | 50,000 |
| **Total, one click at ceiling** | **~168,000** |

This is bounded, not advisory — `validateRequest` throws before the call if sources exceed
budget, so it can't silently blow past. But even the *typical* no-source call pays the full
~10,000-token system tax against maybe a few hundred tokens of real task content. The fixed
cost dominates the marginal one by 20–30×, on every single Regenerate click.

This matches sibling behavior — `DictionaryService` also loads prompts uncached — so it isn't
a regression unique to this PR. It is real, current, recurring dollar and latency cost on the
one path explicitly billed as "quality-first… cost efficiency is secondary." Caching the
static half costs nothing in quality.

### 🟢 Nit — Always-mounted, unmemoized modal re-executes its render body on every keystroke

`packages/core/src/presentation/webview/WorkshopApp.tsx:1448`

`WorkshopGesturePlaygroundModal` is mounted unconditionally rather than gated behind
`{gestureOpening && ...}`, and exported as a plain `React.FC` rather than wrapped in
`React.memo`. `WorkshopModalShell` returns `null` for `!open` — but that check happens inside
the *child's* render. The JSX children, including `availableSources.map(...)` over up to ~100
rows each doing a `.some()` scan, are constructed by the parent before the child ever decides
to bail.

So React re-invokes this on every `WorkshopApp` re-render — every composer keystroke, every
streamed token — even if the widget was never opened this session. At today's N that's a few
hundred cheap string comparisons per wasted render: imperceptible, not a UI-thread problem.
Worth the two-character fix because the cost model changes if this modal's body grows heavier,
or if a future widget copies the always-mounted pattern with a larger list.

> *"A linear scan where an in-scope Map already had the answer, and a ten-thousand-token prompt re-billed with zero caching on every Regenerate — nothing's on fire at today's N, but I've already priced out the invoice for the version that is."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟠 High — The full, unbounded model response is logged to the Output channel on every rejected parse [🎯🎯 Strong Consensus]

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:385`

```ts
this.outputChannel?.appendLine(content);
```

`logRejectedResponse` fires every time `extractDictionary` or `extractMenu` throws in
`parseCompositeResponse` — a *designed, expected* path, given the parser is deliberately
strict and fail-closed about sentinel placement and JSON schema.

`generateMenu` can pull in up to **420,000 characters** of the writer's own referenced source
material, plus context and character notes, and the model is free to reflect large portions of
that back into its up-to-50,000-token response. On any validation miss — plausible any time
the model wraps JSON in a code fence, adds a stray sentence, or drifts on formatting — the
*entire* raw response is dumped verbatim into the "Prose Minion" Output channel
(`extension.ts:68`), with no cap.

`GesturePlaygroundService.test.ts:419` — `expect(appendLine).toHaveBeenCalledWith(malformed)`
— shows this is intentional rather than an oversight. The test *documents* the behavior
instead of guarding against it.

The sibling convention is right next door: `CategorySearchService.ts:478-481` logs response
length, first 200 chars, and last 200 chars, specifically to avoid this. This PR's new service
is the one path in the codebase that breaks it.

Let me be precise about the threat, because it isn't an attacker. There's no exfiltration off
the machine — I checked, no telemetry or crash-reporting hook reads the Output channel. The
risk is human and mundane: **Output-panel contents are exactly what a writer pastes into a
public GitHub issue when a generation "isn't working."** That turns a debug log into an
accidental publication of unpublished manuscript text, character notes, or plot details. For a
tool whose users are writers with unpublished work, that's the disclosure that matters.

Fix: truncate the logged payload the way `CategorySearchService` already does.

**Compound with Oliver's finding #2.** Oliver traced that *cancellation* routes into
`parseCompositeResponse` and throws. Patricia traced what the resulting log then dumps.
Neither reviewer saw the other's half. Together: **every ordinary Cancel or
regenerate-supersede dumps up to 50,000 tokens of manuscript-derived text into the Output
channel, mislabeled as a model failure.** That combination is the strongest single finding in
this review.

> *"The sentinel parser is fail-closed; the logger isn't — every rejected response photocopies the writer's manuscript straight into a debug panel built for pasting into GitHub issues."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — Cancelled generations are logged and re-thrown as rejected model output [🎯🎯 Strong Consensus]

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:96`

Traced end to end, and verified at every step:

1. `AgentRunEngine.executeTurn` catches `AbortError` internally and **resolves** — never
   rejects — with `cancelled: true` plus whatever partial content had streamed
   (`AgentRunEngine.ts:629` non-streaming, `:684` streaming).
2. `cancelled` is a first-class part of the result contract
   (`AgentRunContracts.ts:162`), propagated at `:467` and `:721`.
3. `GesturePlaygroundService` **never references `cancelled`** — zero occurrences in the file.
   It feeds the empty-or-partial content straight into the strict sentinel parser at line 96.
4. That fails `extractDictionary`'s marker check and lands in the catch at 197–203, which
   calls `logRejectedResponse` — the full BEGIN/END dump Patricia describes above — and throws
   *"The model returned an unusable Gesture Dictionary…"*.
5. `WorkshopWidgetHandler.handleGenerate`'s catch then sees `controller.signal.aborted === true`
   and returns silently.

So the *user* never sees an error. But the Output channel — the only trail anyone has — has
already recorded a perfectly normal user action as a garbled model failure. And this fires on
the everyday "regenerate supersedes the in-flight call" path
(`WorkshopWidgetHandler.ts:123`), not just the explicit Cancel button.

The sibling knows better. `AssistantToolService.ts:357-358` carries the comment "orchestrator
now catches AbortError internally and returns partial content / The executionResult.content
will contain whatever was received before cancellation," and treats that content as *valid
output*. The same note appears at 432 and 503. Three sibling call sites understand this; the
new service doesn't.

Confirmed untested: `GesturePlaygroundService.test.ts` has zero matches for
cancel/abort/signal.

### 🟡 Standard — Regenerate-triggered cancellation logs nothing, unlike explicit Cancel

`packages/core/src/application/handlers/domain/WorkshopWidgetHandler.ts:123`

`handleCancelGenerate` (line 250) writes `'[WorkshopWidgetHandler] Gesture generation
cancelled'` before calling `cancelActiveGeneration()`. But `handleGenerate`'s own call to the
same method at line 123 — the ordinary "click Generate again mid-stream" path — has no log
line, and `cancelActiveGeneration()` itself (488–504) never calls `appendLine`, only
`postGenerationProgress`.

Identical underlying action — abort the controller, drop the in-flight call — logged when
triggered one way, completely silent when triggered the other. The supersede case is a UI-only
event with no Output channel trace at all.

Untested in a way that's worth naming: `WorkshopWidgetHandler.test.ts` stubs `appendLine:
jest.fn()` at line 113 and never once asserts on it — including inside the existing "drops the
superseded call silently" test, which is precisely the scenario where the silence is the bug.

> *"The writer pressed Stop, and the only trail we keep wrote it down as a model failure — that's not a log, that's a false confession."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — Gesture Dictionary temperature ships at 0.7, not the documented 0.4–0.5 posture

`packages/core/src/infrastructure/api/services/widgets/GesturePlaygroundService.ts:88`

The concept doc is explicit
(`gesture-dictionary-semantic-runway.md:204-206`):

> **Temperature**: begin near the Writer's Dictionary posture (`0.4–0.5`). The semantic runway
> supplies diversity; high sampling primarily increases framing drift. **Raise only if
> fixed-fixture evaluation shows menu convergence.**

The sibling it names as the posture, `DictionaryService.ts`, does in fact run at `0.4` — in all
four of its call sites. The shipped `generateMenu` call hardcodes `0.7`. That's deliberate, not
a typo: `GesturePlaygroundService.test.ts` asserts `temperature: 0.7` directly.

What's missing is the gate. Nothing in the diff, the ADR, or the sprint doc records the
"fixed-fixture evaluation" the concept doc names as the *only* license to raise it. No eval
doc, no fixture test, no changelog note.

I'm not saying 0.7 is wrong — the author may well have tuned it by hand and liked the results.
I'm saying the ticket named a specific number *and* a specific gate for deviating from it, and
the code took the deviation without the gate. If 0.7 is right, the concept doc should say so
and say why; right now the two documents disagree and only one of them ships.

### 🟠 High — A widget commit whose reply fails or is cancelled leaves a permanent, content-less turn [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1209`

Independently traced, same conclusion Blake reached — with one detail worth adding.

`beginMessage` (`WorkshopSessionService.ts:2338,2344`) stamps `widgetCommit` onto the new turn
and unconditionally does `this.turns.push(turn)` *before* the model call runs. `executeMessage`
returns `{ committed: assistantTurn !== undefined, userTurnId }` even on failure.
`handleCommit` checks `!outcome.committed` and reports *"The room did not accept the commit"* —
but performs **no compensating removal**, and there is no such method anywhere:
I verified there's no `discardTurn`, no `removeTurn`, no `turns.splice` in
`WorkshopSessionService.ts`.

The turn defaults to `{ kind: 'room' }` audience (`WorkshopRoomAudience.ts:57`), so it sits in
`this.turns` forever, undelivered, and `formatWorkshopRoomTurn` will eventually render it to a
guest or a later host turn as *"Writer → Jill: For '<phrase>' — here are the gesture directions
I want."* with zero thread-artifact frame appended, because none was ever recorded.

This is ordinary usage, not an exotic edge: cancelling an in-flight send via the composer's
Stop affordance, or an API-key or network failure. Neither test file exercises it —
`WorkshopWidgetHandler.test.ts`'s "keeps the config as the retry token" tests mock
`sendRoomMessage` entirely and never touch real turn creation, and `WorkshopHandler.test.ts` has
no widget-commit test at all.

### 🟢 Nit — Completion record documents the pre-amendment Haiku default

`.memory-bank/20260729-2100-conversation-widgets-sprint01.md:28`

The record says the fifth `ModelScope` defaults to `anthropic/claude-haiku-4.5`. The shipped
code sets Sonnet 5 in two places — `AIResourceManager.ts:64` and
`apps/vscode-extension/package.json:206-210` — correctly matching the concept doc's explicit
"move the widget scope from Haiku to Sonnet 5" decision.

The code is right. The completion record that's supposed to be its receipt is stale, written
before the same-day amendment, and would mislead the next person who greps it for "what did we
actually ship."

> *"The concept doc says earn anything above 0.4 with fixture evidence and earn a hollow room turn never; the code just turned one dial up and let the other one drop the ball — quality-first, allegedly."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Third Sibling

Illuminated by: Blake #1, Stan #1, Oliver #2, Patricia #1, Cal #2

When a pattern already exists in a codebase, the risk is not that the newest code will
contradict it — it is that the newest code will simply not know about it. `WorkshopHandler`
uses the guarded delivered-ids at three call sites and the unpacked list at a fourth.
`useWorkshop` imports the cancel-message factory, calls it correctly twice, then hand-rolls
the third. Each of these looks perfectly reasonable in isolation, and that is exactly the
point: correctness by convention is invisible at the line you are writing. A convention that
lives only in the habits of the two files beside you is not a convention — it is a coincidence
that has held so far.

→ **Carry forward:** When you add the Nth instance of anything — a cancel path, a log call, a
delivery record — grep for the other N−1 before you write it, and read the *oldest* one. If the
siblings disagree with your draft, one of you has learned something the other hasn't; find out
which.

### Lesson 2 — The Rule and Its First Exception Arrived Together

Illuminated by: Cal #1, Sam #2, Bria #1, Bria #3

This PR wrote an ADR requiring every normalization to be logged *and* regression-tested, then
shipped `inferred-missing-scope` logged but untested, and `scope: null` repaired with no name
at all. A concept doc named a temperature and the gate for raising it; the code took the
number's freedom without the gate's cost. A completion record documented a default the code had
already moved past. The pattern underneath is that we write the rule in the register of
intention and the code in the register of execution, and nothing in the build connects them. A
rule stated in prose and enforced nowhere is a wish with a filename.

→ **Carry forward:** The moment you write "must always" in a doc, ask in the same sitting:
*what turns red when this is violated?* If the answer is "a reviewer's attention," write the
check instead — or write down honestly that it's aspirational, so the next person doesn't
mistake the doc for a guarantee.

### Lesson 3 — Cancellation Is a Kind of Success

Illuminated by: Oliver #2, Oliver #3, Blake #3, Bria #2, Stan #1, Cal #2

Five reviewers walked into the same forty lines from five directions and each found something
different, because the code models a user pressing Stop as a species of failure. The engine
resolves with `cancelled: true` and partial content — a deliberate, documented success shape —
and the new service never asks the question, feeds the fragment to a strict parser, and files a
normal human decision as a garbled model response. Downstream, a cancelled commit leaves a
permanent room turn promising content that was never recorded. Aborts are not errors; they are
the user exercising a feature you built. Code that routes them through the error path will
always be surprised by them, because the error path is written for things nobody chose.

→ **Carry forward:** For every long-running operation, name its three terminal states out loud
— succeeded, failed, *cancelled* — and check that each has its own branch, its own log line,
and its own cleanup. If cancellation shares a branch with failure, you have two behaviors
wearing one coat.

### Lesson 4 — Tests Prove Behavior; Volume Proves Effort

Illuminated by: Cal #2, Cal #3, Patricia #1, Oliver #3, Blake #1

Roughly 2,700 lines of new tests, 1,675 green, and the Cancel button is never once pressed.
`recordRoomThreadArtifactDeliveries` has zero test hits. Boundaries are checked one-past but
never *at*. And one test — `expect(appendLine).toHaveBeenCalledWith(malformed)` — pins
unbounded manuscript logging in place as the contract, documenting a behavior rather than
guarding against one. A suite grows along the paths we already believe in; the paths we haven't
imagined stay dark no matter how many lines we add. Coverage measures where the code went, not
where the user will.

→ **Carry forward:** Before merging, list the buttons and states a user can reach, and for each
one ask "which test constructs this?" Not "is this file covered" — *which test presses this*.
And when a test asserts an exact value, ask whether it would still pass if the value were
correct-but-different; if not, you may be freezing today's behavior rather than protecting
tomorrow's.

> *"The most dangerous code in any change is not the part that disagrees with the codebase — it is the part that never knew there was something to agree with."* — Sensei

---

## The Closer

### 🐾 Animal

**An octopus.**

Not for the arms count, though eleven widgets are planned and this one grew eight new seams on
its way in. For the nervous system: two-thirds of an octopus's neurons live in its arms, and
each arm solves problems locally, competently, without checking with the others. That is this
PR exactly. The handler seam is well-reasoned. The persistence spine round-trips clean. The
budget validation is genuinely bounded. The tests are numerous and mostly thoughtful. Every arm
is doing skilled work.

And then one arm records a delivery the other arm never made, a third logs a cancellation as a
failure, and a fourth writes the rule that a fifth is already breaking — all while the whole
creature insists, accurately, that it passed 1,675 tests.

Brilliant, distributed, and occasionally surprised by itself.

---

## Summary

This is a strong PR with a specific, nameable blind spot. The architecture is deliberate — the
`WorkshopWidgetHandler` seam is well-earned and mirrors the session handler faithfully. The
persistence spine survives a full disk round trip, verified. The budget ceilings are genuinely
enforced rather than advisory. Typechecks pass on all three projects and the full suite is
green at 147/1675, which is a real green, not a scoped one. Nobody on this panel found sloppy
work.

What they found instead is that **cancellation was never modeled as its own outcome**, and that
gap radiates. Five reviewers arrived at the same forty lines of `GesturePlaygroundService` from
five directions and each found a different defect there. A cancelled run gets parsed as a
malformed model response, which triggers an unbounded dump of the writer's manuscript into the
Output channel; a cancelled commit strands a permanent room turn promising content nobody
recorded; the Cancel button itself is never pressed in ~2,700 lines of new tests. Alongside
that, the one genuine blocker is a ledger recording deliveries against the unpacked turn list
while the packer ships a bounded subset — with a dedupe that makes the false rows permanent,
and three correct call sites in the very same file to compare against.

Merge after #1, #2, and #3. Those three are traced, verified, and touch a writer's saved work.
The rest — especially #4 through #6, where this PR's own ADR and concept doc are the specs being
violated — are worth a follow-up commit while the context is still warm. The through-line is
Sensei's second lesson: this PR was disciplined enough to write down its own rules, which is
rarer and better than most. It just shipped them before the checks that would keep them.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
