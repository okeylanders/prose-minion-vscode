# MR Review — refactor(workshop): extract widget state architecture

**Author:** Okey Landers · PR #97
**Branch:** `sprint/conversation-widgets-02a-widget-state-architecture` → `epic/conversation-widgets`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Widget-config clone moved inside hydration's "must not throw" assignment block | Blake, Sam | 🎯 | **Addressed** — `prepareState` clones before mutation; `installPreparedState` only assigns; atomicity is regression-tested |
| 2 | 🟠 High | "Generic" ledger hard-imports the one widget codec it has | Marcus | — | **Addressed** — clone/summary operations are injected by `WorkshopSessionService` |
| 3 | 🟡 Standard | `assertJsonValue`'s load-bearing "why" (the `endLine` incident) lost in the move | Parker, Oliver, Sam | 🎯🎯 Strong | **Addressed** — restored the two-sided persistence policy and incident context |
| 4 | 🟡 Standard | `WorkshopSessionShapeGrammar` duplicates `exactKeys` from `persistedValidation.ts` — already diverged | Stan | — | **Addressed** — consolidated the grammar into the existing `persistedValidation` module |
| 5 | 🟡 Standard | Two `…CheckpointNormalizationResult` types, nine words apart, in sibling files | Parker, Bria | 🎯 | **Addressed** — renamed to `GesturePlaygroundDraftHydrationDefaults` |
| 6 | 🟡 Standard | ADR claims the ledger owns "validated hydration replacement"; `replaceState` validates nothing | Bria | — | **Addressed** — ADR now says the ledger installs pre-validated, prepared state |
| 7 | 🟡 Standard | ADR's "codec tests only where the decoder doesn't cover it" is false for 5 menu/selection rules | Cal | — | **Addressed** — added direct codec witnesses for all five rule families |
| 8 | 🟡 Standard | "Without leaking mutable references" test only proves `replaceState`'s clone, not `exportState`'s | Cal | — | **Addressed** — the test now mutates an export and rechecks the source ledger |
| 9 | 🟡 Standard | `workshop/widgets/` conflates a stateful collaborator with a stateless codec (1-to-N shape illegible) | Marcus | — | **Deferred** — revisit when the second codec lands |
| 10 | 🟡 Standard | `WorkshopSessionShapeGrammar.ts` PascalCase breaks the directory's camelCase-for-function-modules rule | Stan | — | **Addressed** — duplicate module removed; functions live in camelCase `persistedValidation.ts` |
| 11 | 🟡 Standard | `widgetConfigs` has no length cap | Patricia | — | **Deferred** — pre-existing and identical pre-refactor; fold into the tracked `turns` retention debt |
| 12 | 🟢 Nit | Unused `boundedStringAt` import left in `WorkshopSessionStateV1Shape.ts` | Parker | — | **Addressed** — import removed |
| 13 | 🟢 Nit | `get(id)` linear scan — correct call at this N, no Map warranted | Tim | — | **N/A** — confirmed non-issue |
| 14 | 🟢 Nit | Double full-shape validation on hydrate — pre-existing, not worsened | Tim | — | **N/A** — confirmed non-issue |
| 15 | 🟢 Praise | `WorkshopSessionShapeGrammar` genuinely earns its existence as a two-caller module | Marcus | — | **N/A** — superseded by consolidation into the existing persistence module |
| 16 | 🟢 Praise | Clone counts bit-for-bit identical across the extraction — no round-trips added | Tim | — | **N/A** |
| 17 | 🟢 Praise | Prototype-pollution guard, JSON depth guard, and anchored `ctx-` regex survived byte-identical | Patricia | — | **N/A** |
| 18 | 🟢 Praise | `create()`/`get()` defensive-clone test would actually catch the regression it names | Cal | — | **N/A** |
| 19 | 🟢 Praise | Import aliases and barrel-export decisions match the house pattern | Stan | — | **N/A** |

---

## Blast Radius

- 15 files changed · +1014 / −477 lines
- New source files: 3 · New test files: 1 · Migrations: none · New services at the composition root: none
- Behavior-preserving extraction refactor, executed deliberately *before* the next feature (Lexical Gravity) rather than during it. ADR-first, sprint-doc'd, with one gap explicitly filed as tech debt rather than silently closed.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | B+ |
| 🧪 Tests | B− |
| 📖 Quality | B− |
| ⚡ Performance | A− |
| 🎯 Domain | B− |

---

## Executive Briefing

🟠 **[Blake + Sam · 🎯 Consensus]** **The defensive clone crossed a safety line.** `hydrateCommittedState()` has a two-phase shape — prepare-and-clone, then a synchronous assignment block whose own comment promises *"after every validation/clone/remap step."* The widget-config clone used to sit in phase one. It now runs inside `ledger.replaceState()`, called 22 assignments deep into phase two. Not reachable today; no test guards it; the next widget codec inherits the seam.

🟠 **[Marcus]** **The ledger's name promises generality its body doesn't deliver.** `WorkshopWidgetConfigLedger` takes a `widgetId` and reads as widget-agnostic, but five of its methods hard-call `cloneGesturePlaygroundDraft`/`summarizeGesturePlaygroundDraft` unconditionally. Widget #2 needs surgery on all five, not extension beside them — a different cost than the ADR's framing implies.

🟡 **[Parker + Oliver + Sam · 🎯🎯 Strong Consensus]** **A comment lost its incident.** `assertJsonValue`'s doc-comment used to name the bug that produced its rule. The relocated version keeps the rule and drops the cause — the one place in the diff where docs were rewritten rather than moved.

🟡 **[Stan]** **The new shared-primitives module has an older twin, and they've already diverged.** `persistedValidation.ts` exists in the same directory, chartered for exactly this job, and already exports `exactKeys`. The new one differs in required-key semantics and error punctuation.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — The "generic" ledger is not generic; it hard-imports the one widget codec it has

`packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts:15-18, 41, 96-100`

```ts
import { cloneGesturePlaygroundDraft, summarizeGesturePlaygroundDraft } from '.../GesturePlaygroundConfigCodec';
...
draft: cloneGesturePlaygroundDraft(input.draft)
```

`create()`, `get()`, `exportState()`, `replaceState()`, and the module-level `widgetConfigSummary()` all call the Gesture codec unconditionally, regardless of `input.widgetId`. The public signature (`widgetId: WorkshopWidgetId`) and the class's stated job read as widget-agnostic lifecycle mechanics; the implementation is Gesture-specific throughout.

The ADR frames this as giving Lexical Gravity "an explicit sibling location… without enlarging the two Workshop god files." But when the second widget lands, every one of those five methods grows a dispatch-by-`widgetId` branch — or takes an injected codec. That's a structural change *to the ledger itself*, not an addition beside it, and it's a larger cost than "cheap arrival" implies for this specific collaborator.

Two honest resolutions: constructor-inject the clone/summarize functions as strategies (making the ledger genuinely widget-agnostic today, with `WorkshopSessionService` supplying the Gesture codec), or amend the ADR to say plainly that the ledger is Gesture-shaped for now and will need surgery, not just extension, at Sprint 02.

### 🟡 Standard — `workshop/widgets/` conflates a stateful collaborator with a stateless codec

`packages/core/src/application/services/workshop/widgets/`

The directory holds `WorkshopWidgetConfigLedger.ts` (stateful, session-lifetime class with mutable `configs`/`counter`) and `GesturePlaygroundConfigCodec.ts` (stateless module of pure functions) as flat siblings. By the architecture's own design this asymmetry is permanent, not incidental: the ledger stays singular while codecs multiply one-per-widget. Nothing in the directory shape signals that a reader should expect exactly one ledger and N codecs. A `workshop/widgets/codecs/` subfolder would make the 1-to-N shape legible without anyone having to read the ADR first.

### 🟢 Praise — `WorkshopSessionShapeGrammar` is the extraction that earns its keep

Unlike the ledger, this one does exactly what it says: a verbatim relocation of the exact-object/bounded-string/JSON-shape primitives, now genuinely shared by two callers, carrying zero widget rules. Its placement at the `workshop/` root rather than under `widgets/` correctly reflects that it serves the top-level aggregate codec too. The "does the abstraction earn its existence" test, passing cleanly.

> *"The bones are good, but the ledger is wearing a 'generic collaborator' name tag while doing one widget's laundry — ask it to fold a second widget's shirts and it'll need new hands, not just a bigger basket."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🟠 High — Widget-config clone moved inside the atomic assignment block [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:2243`

```ts
    this.widgetConfigLedger.replaceState({
      configs: normalized.widgetConfigs ?? [],
```

This is where "behavior-preserving" stops being true. Before this PR, line 2127 did `const widgetConfigs = (normalized.widgetConfigs ?? []).map(cloneWidgetConfig);` in the *preparation* phase, alongside every other clone, and the assignment was a bare field write. The contract is stated twice in the file, and both statements are now false:

- Method doc, line 2093: *"Validation and defensive cloning finish before the first assignment, so callers never observe a half-hydrated room."*
- Line 2219: *"// Synchronous field replacement after every validation/clone/remap step."*

`replaceState` clones (`state.configs.map(cloneWidgetConfig)` → `cloneGesturePlaygroundDraft`), and it is now called at line 2243 — twenty-two assignments deep into the replacement block, after `this.excerpt`, `this.turns`, `this.participants`, and every counter have already been overwritten. It is the only throwing operation inside that block. If the clone raises on `draft.sourceReferences.map` / `draft.menu.map` / `[...draft.selections]`, the session is left with the checkpoint's turns and participants but the *previous* session's widget configs, todos, and behavior. Every `wc-N` reference in the newly-installed turns then dangles, and the next autosave writes that mixed state to disk. Integrity validation rejects it on the *next* load — the writer loses the session, not just the widget.

Reachable today? No. `normalizeGesturePlaygroundDraftForHydration` defaults `sourceReferences` on every config before the strict revalidate, and the shape assert makes `menu`/`selections` required arrays. That's why this is High and not Blocking. But the guarantee is now positional rather than structural, and this refactor exists specifically to hand `replaceState` to Lexical Gravity's second codec — whose clone will have its own optional-field seams, and whose author will read the line-2219 comment and believe it.

The fix is one hoist: build the cloned state above the assignment block, restoring throw-before-mutate. Searched the diff and the workshop test directory for a hydration-atomicity test — not found; nothing would catch this regression.

**Traced and dismissed** (so they don't get re-litigated):
- *`toPersistedState` no longer clones* — false alarm. `exportState()` returns a fresh array with deep draft clones. Byte-identical to the old inline `.map(cloneWidgetConfig)`.
- *Duplicate `wc-N` from a trailing counter* — blocked upstream at `WorkshopSessionStateV1Integrity.ts:243`; a checkpoint with `wc-5`/counter `2` never reaches `replaceState`.
- *`new WorkshopWidgetConfigLedger(this.now)` in the constructor* — safe. `now` is a parameter property assigned before the body runs, and it's a free function reference with no `this` capture.
- *Unguarded `sourceReferences` deref in `cloneGesturePlaygroundDraft`* — character-identical to the deleted `cloneGestureDraft`; both live paths are guarded (`WorkshopWidgetHandler.validateSourceReferences` gates `create()`, normalization gates hydration). Carried over, not new.

> *"The comment on line 2219 says every clone is done by the time we start assigning. It's now a lie by twenty-two lines, and the next widget is the one that'll find out."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard — The clone crossed from before the "nothing here can throw" sign to after it [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:2219, 2243`

Okay, but what happens if the clone throws *after* we've already started mutating `this`? In the deleted code, `widgetConfigs` was cloned up front, sitting right alongside `turns`/`todos`/`threadArtifacts` in the pre-flight batch, *before* the line that says "Synchronous field replacement after every validation/clone/remap step." That comment is a real invariant: everything below it is supposed to be pure assignment so a mid-hydration throw can't leave `this` half old-session, half new.

I traced it down: `normalizeGesturePlaygroundDraftForHydration` defaults `sourceReferences` before the second `validateWorkshopSessionStateV1(normalized)` at line 2114, so by the time `replaceState` runs the `.map()` calls won't throw in practice. Not exploitable *today* — but the code no longer visually enforces the contract the comment promises. The next person who adds any throwing step to `replaceState` or `cloneGesturePlaygroundDraft` gets no local signal that they've reopened a partial-mutation window the rest of the method was carefully built to avoid.

Suggested fix: pre-clone in the batch above the comment — `const widgetConfigState = { counter: normalized.counters.widgetConfig ?? 0, configs: (normalized.widgetConfigs ?? []).map(cloneWidgetConfig) };` (exposing a pure clone helper from the ledger module) — then call `replaceState(widgetConfigState)` inside the synchronous block as a non-throwing assignment.

### 🟢 Nit — `assertJsonValue`'s reachability comment dropped in the move

`packages/core/src/application/services/workshop/WorkshopSessionShapeGrammar.ts:170`

Checked whether this changed meaning — it didn't. Both call sites still behave as before: the array branch recurses unconditionally per item, and the object-member loop is still guarded by `if (nested === undefined) { continue; }`. So the `value === undefined` branch is still only reachable via an array item, exactly as before. Purely a doc loss.

> *"Found the trap door — it's not in the validation logic at all, it's in the assignment order. Somebody moved the clone from before the 'nothing here can throw' sign to after it, and the only reason nobody's fallen through yet is that normalization quietly defaults the one field that could have made it throw."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — The load-bearing "why" on `assertJsonValue` didn't survive the move [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionShapeGrammar.ts:140-146`

The old comment said three things this one drops: (1) this function runs on *both* sides of the persistence boundary — reading a `JSON.parse` result and validating a live in-memory object — which is *why* `undefined` needs different handling in each direction; (2) it cross-referenced `clonePersistedJson`'s policy, so the two don't drift out of sync silently; (3) it named the actual incident — rejecting an undefined object member *"used to fail every save of a session containing a `resource.read` without an explicit `endLine`."*

That's not decoration, it's the reason the object-member/array-item asymmetry exists at all. Strip it and the next person who finds this "inconsistent" has every reason to "fix" it and reintroduce the bug it was written to prevent. `CLAUDE.md` is explicit that this comment class — explaining *why*, anchored to a real incident — is exactly what must survive a refactor. Restore the full comment on the moved function.

### 🟡 Standard — Two `CheckpointNormalizationResult` types in sibling files [🎯 Consensus]

`packages/core/src/application/services/workshop/widgets/GesturePlaygroundConfigCodec.ts:28`

`WorkshopSessionCheckpointNormalization.ts` already exports `WorkshopSessionCheckpointNormalizationResult` (session-level: `{ state, normalizations }`). This PR adds `GesturePlaygroundCheckpointNormalizationResult` (draft-level: `{ draft, defaultedDictionarySharing, defaultedSourceReferences }`). Within the checkpoint file itself, the union type is `WorkshopSessionCheckpointNormalization`, the result interface is `…Result`, and the new call it makes is to a same-named-but-different-widget function one prefix away. I read both files twice to convince myself these were four distinct names, not two typo'd into four. `GesturePlaygroundDraftHydrationDefaults` — matching what it actually returns — reads faster and can't be confused at a glance.

### 🟢 Nit — Unused `boundedStringAt` import left behind

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts:32`

Grepped for `\bboundedStringAt\b` — one hit, the import itself. Every call site moved to the Gesture codec; the import wasn't pruned. Typechecks clean, so it's presumably one of the 869 pre-existing lint warnings — but it's a warning *this PR introduced*, not one it inherited. `optionalBoundedStringAt` was correctly dropped, so this looks like a stray miss rather than a pattern. One-line delete.

> *"It works, but I had to read `assertJsonValue`'s new three-line comment, remember the six-line version had a bug's name in it, and go check the diff to be sure I wasn't misremembering — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — The "no leaking mutable references" test only proves the ingestion side

`packages/core/src/__tests__/application/services/workshop/widgets/WorkshopWidgetConfigLedger.test.ts:89-95`

Trace the boundary. `source.exportState()` already returns a deep clone — `exported` is detached the moment it's returned. `replaceState(exported)` clones *again* on ingestion. So mutating `exported` *after* `replaceState` only exercises `replaceState`'s own defensive clone; it says nothing about whether `exportState()` is safe for a caller to mutate against the *live* ledger. Nobody in this test — or in `WorkshopWidgetConfigs.test.ts`, which mutates `exportCommittedState()` results but never re-checks the live session afterward — asserts that.

I read the implementation and it's correct; `exportState()` does clone. This is a coverage gap, not a bug: the claim in the test's own name is half-proven. One added line (`expect(source.get('wc-1')?.draft.selections).toHaveLength(1)` right after mutating `exported`, before `replaceState`) closes it.

### 🟡 Standard — The ADR's test-scoping claim doesn't hold for five shape rules

`packages/core/src/application/services/workshop/widgets/GesturePlaygroundConfigCodec.ts:111-151`

Searched the diff for `GesturePlaygroundConfigCodec.test.ts` — not found; zero codec-local tests were added. I then checked whether `WorkshopWidgetConfigs.test.ts` (the cited decoder witness) exercises these rules via `parseWorkshopSessionStateV1`: it covers source-reference budget/dup/malformed-id/unknown-field (lines 270–346) and recommendation-seed budgets (210–268) well, but has **no case** for menu-group count bounds, options-per-group bounds, duplicate menu options, the "selections drawn from menu" cross-check, or the 1..N/no-duplicate rule on `selections`. `WorkshopSessionPersistence.test.ts` has zero gesture content at all — it isn't a witness despite being adjacent. The only "duplicate options" test (`GesturePlaygroundService.test.ts:412`) checks the LLM-generated-menu parser, a different validator entirely.

Per Rule D this logic moved verbatim, so it's not a new bug. But the ADR's explicit decision — *"add codec tests only where behavior is not already exercised through the V1 session decoder"* — reads as a coverage audit that was performed, and for these five rules the stated precondition is false: the behavior isn't exercised, and no codec test was added either.

### 🟢 Praise — The `create()`/`get()` defensive-clone test earns its keep

`WorkshopWidgetConfigLedger.test.ts:37-52` mutates the *input* draft after `create()` **and** mutates the *returned* config, then re-fetches via `get()` and checks neither landed. Both halves of the boundary in one test — if `create()` stopped cloning either side, this fails. Exactly the kind of "would this catch the regression" test I want more of.

> *"Happy path only for exportState — mutate the export before you hand it back, not after, and I bet the assertion changes. I've seen this movie; the trapdoor is always one hop earlier than the test walks."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — The new grammar module has an older twin two doors down, and they've already diverged

`packages/core/src/application/services/workshop/WorkshopSessionShapeGrammar.ts:36`

`persistedValidation.ts` sits in the same directory with this docstring: *"Shared primitives for strict Workshop persistence codecs… Keeping them here prevents the durable formats from drifting on timestamps, timezones, or **exact-key rules**."* That module already exports `exactKeys`. The PR added a second `exactKeys` to a second shared-codec-primitives module in the same directory — and the two have **already drifted**: the new one additionally rejects required keys whose value is `undefined`, and its error strings drop the trailing period the old one uses.

That's precisely the drift the older file's docstring exists to prevent. Either the new grammar module should absorb `persistedValidation.ts`'s primitives (one home, one `exactKeys`), or `exactKeys` should be imported from the existing module rather than reimplemented.

Separately, the file-naming: `WorkshopSessionShapeGrammar.ts` exports nothing but free functions — same shape as its directory-mates `persistedJson.ts` and `persistedValidation.ts`, both camelCase. Compare the PascalCase file that legitimately earns it: `WorkshopCapabilityXmlCodec.ts`, which exports an actual class. The directory's pattern reads as PascalCase-for-a-class-or-primary-type, camelCase-for-a-function-bag. Both new modules land on the wrong side of that line.

### 🟢 Praise — Alias usage and barrel decisions are consistent

I went looking for a reason to flag the imports and came up empty in the PR's favor. The full `@/application/services/workshop/...` alias is already the dominant house style here (19 of 29 pre-existing workshop files); the outliers are *older* files still doing `from './X'`. All three new modules use the full alias. The barrel (`packages/core/src/index.ts`) is untouched — the three new modules stay unexported, exactly like their closest analog `WorkshopThreadArtifactFrame.ts`. Consistent both ways.

> *"We've got a function called `exactKeys` two doors down in `persistedValidation.ts`, same job, camelCase file. This one just didn't get the memo — right next door, same drawer, different label font."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — Clone count is bit-for-bit identical across the extraction

Traced every clone site before and after. `create()` still does exactly two deep clones per call — one to own the input, one for the defensive return — matching the pre-refactor inline code clone-for-clone. `exportState()` does one N-pass, called once from `toPersistedState()`, which now hands the result straight through with zero additional cloning. `replaceState()` does the same single N-pass on hydrate. `summariesFor()` never clones. The extraction added an indirection layer and **zero new deep-clone passes**. At realistic N (tens of configs per session), autosave and hydration stay O(N) allocations, unchanged.

### 🟢 Nit — `get(id)` stays a linear scan, and should

Same `Array.prototype.find` the pre-refactor code used. `wc-N` ids are minted one per widget commit — realistic N is tens. A Map would trade sub-microsecond `find` for mutation-site bookkeeping across `create`/`replaceState`/`reset` for no measurable win. Crossover is probably four figures of configs in one session, a regime this feature has no path to reach: each config is a deliberate, UI-gated authoring action, not a generated row. Leave it.

### 🟢 Nit — Double full-shape validation on hydrate is pre-existing

`hydrateCommittedState` already ran `validateWorkshopSessionStateV1` before and after normalization prior to this PR — no diff hunk touches lines 2102–2114. The extraction relocated the source-reference Set/accumulator work between files; same cost, same call count. Hydration is a session-load event, not a per-message path. Two full passes over a session sized in the tens-to-low-hundreds is single-digit milliseconds. Flagging only to confirm this PR didn't make it worse, which it didn't.

> *"Linear at this scale, exponential only in the sense that I had to check three files to confirm nobody snuck in a third clone — they didn't, so I'll let the allocation counts speak for themselves."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — Widget-config ledger has no length cap (pre-existing, carried over unchanged)

`packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts:76-79`

`replaceState()` accepts an arbitrary-length array straight from a persisted checkpoint with no upper bound, and `create()` never rejects growth. A hand-edited or corrupted checkpoint with 500,000 entries hydrates and clones the whole thing on every subsequent round-trip.

I traced this forward and back: it is **not new**. The pre-extraction `this.widgetConfigs = widgetConfigs;` had the identical absence of a cap — the ledger just relocated the field. It's also not an asymmetry this PR introduced: `state.turns` is *also* unbounded today (already tracked in `.todo/tech-debt/2026-07-11-workshop-session-turn-retention.md`, Low). `WORKSHOP_TODO_BOUNDS.items = 200` is the one capped collection, and that predates this diff too. Recommend folding a `widgetConfigs` cap into whatever resolves the turn-retention debt rather than opening a new item — same root cause, same fix shape.

### 🟢 Praise — Prototype-pollution and JSON-depth guards survived byte-identical

I diffed `objectAt`'s prototype check and `assertJsonValue`'s recursion guard against their deleted twins line-by-line: same starting depth (0), same comparison operator, same rejection of non-plain-objects. Every object-shaped field in the Gesture codec still routes through it — `assertGesturePlaygroundSourceReferencesShape` calls `objectAt` *before* branching on `reference.kind`, so a `context-attachment` reference can't smuggle an array or exotic prototype past the switch. The `/^ctx-[1-9]\d*$/` regex is fully anchored with a single bounded digit class — no catastrophic backtracking — and moved unmodified. This was the attack surface that mattered most in this diff, and it held.

> *"Passes the scanner. Doesn't pass the attacker — except this time, the code did too. Every bound I could trace against its deleted twin came back identical; the one open door (`widgetConfigs` has no cap) was propped open long before this PR walked in."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — The extracted `assertJsonValue` comment drops the regression story [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionShapeGrammar.ts:140-146`

The pre-extraction comment explained *why* the undefined-object-member-vs-array-item distinction exists, with a specific incident. That sentence is the forensic trail — it tells a future engineer tempted to "tighten" this rule exactly what broke last time and why the asymmetry is deliberate. The rewritten comment states the rule but not its cause. This is the one place in the diff where the extraction rewrote documentation instead of relocating it verbatim; every other grammar primitive kept its original text.

**Traced and all-clear** — worth saying rather than manufacturing findings:
- The recommendation-seed path (`${path}.seed` → `${path}.targetPhrase` inside the codec) resolves to the exact same string as before (`${path}.seed.targetPhrase`).
- `assertWidgetConfig`'s `arrayOf` still produces `widgetConfigs[N].draft…` per-index paths, so a bad config #7 of 12 still names itself.
- `recordCommit`'s bare `Error('Unknown widget config …')` is the moved-verbatim original, and bare `throw new Error` **is** the house pattern for internal invariant violations across this directory. Named error classes are reserved for domain refusals a caller branches on.
- The ledger carrying no `LogSink` matches its sibling `WorkshopThreadArtifactFrame`, which also has none. Logging is the coordinator's job, not every collaborator's.
- `logCheckpointNormalizations` still receives and logs both `defaulted-widget-*` tags unchanged (`WorkshopSessionPersistenceCoordinator.ts:659, 879, 902-909`), and both tags are regression-tested (`WorkshopWidgetConfigs.test.ts:403, 423`). ADR 2026-07-30's "logged and regression-tested" requirement survived intact.

> *"Ninety-nine percent of this refactor left no fingerprints — the one percent that did was a comment that used to tell you a war story, and now just tells you a rule."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — The ADR claims the ledger owns "validated hydration replacement." It validates nothing.

`packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts:76-80`

ADR 2026-07-31's Decision section lists *"atomic reset and validated hydration replacement"* as something the ledger owns. `replaceState()` does neither: it clones and assigns unconditionally — no shape check, no non-negative/finite check on `counter`, no rejection path at all. The actual validation happens entirely upstream, in `hydrateCommittedState()` via `validateWorkshopSessionStateV1(normalized)` (line 2114), before `replaceState` is called (line 2243).

That's a legitimate existing global mechanism, so this isn't a safety bug — the counter-integrity gap is already tracked separately. But the ADR's own bullet list attributes "validated" to the wrong module: read in isolation, `WorkshopWidgetConfigLedger` is exactly as trusting of its input as a plain setter. The test suite matches this — it only ever calls `replaceState()` with data round-tripped through the ledger's own `exportState()`, never with a hand-built invalid state, so nothing proves the ledger guards anything. Either rename the bullet to "hydration replacement of pre-validated state," or move a defensive check into the ledger so the ADR's word choice becomes true rather than aspirational.

### 🟡 Standard — "Checkpoint normalization" vocabulary now lives inside a widget codec [🎯 Consensus]

`packages/core/src/application/services/workshop/widgets/GesturePlaygroundConfigCodec.ts:28-33`

ADR 2026-07-30 assigns "narrowly named, deterministic, logged, and regression-tested" development-checkpoint repairs to `WorkshopSessionCheckpointNormalization`. The mechanics still check out — the normalization union and the logging call both still live in the session-level module untouched, so the *contract* is intact. What moved is the *policy*: what counts as "needs defaulting," and what the safe default is (`includeDictionaryInCommit: false`, `sourceReferences: []`), into a function whose return type is literally named `…CheckpointNormalizationResult` but sits in a widget-local codec.

ADR 2026-07-31 explicitly sanctions the split, so this isn't a violation. But the type name borrows the session module's exact vocabulary, which will read as confusing the moment Lexical Gravity's codec needs its own `…CheckpointNormalizationResult`-shaped return. A widget-scoped name keeps "checkpoint normalization" a term of art the session module alone owns.

> *"The ledger says it does 'validated hydration replacement' — technically correct, in the sense that hydration gets validated somewhere on the way in. Whether it's correct correct is a different question."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Beam Moves, the Calculation Doesn't

Illuminated by: Blake + Sam's clone crossing the "nothing past here may throw" line; Parker + Oliver + Sam's `assertJsonValue` comment losing its cause

When you extract code, the compiler verifies that the *text* moved correctly. Nothing verifies that the *reasoning* moved with it. A two-phase function's safety wasn't really guaranteed by the code — it was guaranteed by a shape: everything risky happens before the point of no return. Once the risky call lives inside something invoked twenty-two lines into the safe phase, the guarantee is still true today, by luck of upstream normalization, but it is no longer *legible* — a future reader has to trace call graphs to rediscover what a glance at the old structure told them for free. The comment tells the same story from the other side: the rule survived the move, but the incident that taught you the rule didn't, and a rule without its origin story reads as an opinion someone can overrule.

→ Carry forward: When code crosses a phase or safety boundary during a move, ask *"what made this position true before, and does the new position still make it true — structurally, not by accident?"* When moving a comment, ask *"what question was this answering?"* before condensing it to *"what does this assert?"*

### Lesson 2 — A Name Is a Promise to the Grep

Illuminated by: Parker + Bria's `GesturePlaygroundCheckpointNormalizationResult` beside the session module's existing one; Stan's `WorkshopSessionShapeGrammar` landing beside `persistedValidation.ts`, both exporting a now-diverging `exactKeys`

A codebase's vocabulary is a shared resource, and extraction is the moment that resource gets spent, well or poorly. When a new module reaches for a term another module already owns, it isn't a style nit — it's a claim of kinship the reader will believe. Two functions with the same name are read as one concept with two call sites, right up until someone discovers they have already diverged in behavior. The danger isn't the collision itself; it's that the collision is invisible from inside either file. You only see it by searching for your own name before you claim it.

→ Carry forward: Before naming a newly extracted concept, grep the term you're about to use. If it already exists, either the new thing genuinely *is* that concept — share the implementation — or it isn't, and it needs a name distinct enough that the two are never mistaken for siblings.

### Lesson 3 — The ADR Is a Hypothesis, Not a Receipt

Illuminated by: Marcus's ledger — parameterized by `widgetId`, hard-wired to one widget in every method; Bria's observation that "validated hydration replacement" validates nothing

Writing the design document before the code is real discipline, and this PR did it right. But a document written first describes an *intention*, and code written after tends to satisfy the intention's letter while quietly missing its spirit — especially under the reasonable pressure of "make the next widget cheap." A ledger that takes a `widgetId` parameter *looks* general; whether it *is* general is a fact about its five method bodies, not its constructor signature. A doc that says "validated" is a promise the tests need to independently earn, not restate. The gap doesn't show up as a bug today — it shows up as a surprise for whoever arrives believing the document.

→ Carry forward: After implementation, reread the design document's claims one sentence at a time against the code, asking *"is this describing what's here, or what I meant to build?"* Where a doc claims a property — generality, validation, isolation — find the specific line that would break if the claim were false. If you can't find one, the claim is aspirational, and the doc should say so.

### Lesson 4 — A Test's Name Is Also a Claim

Illuminated by: Cal's "without leaking mutable references" test, which only exercises one direction; the ADR's scoping claim that codec tests were added "only where behavior is not already exercised," unverified for five shape rules

A round-trip has two halves, and it is natural — almost gravitational — to write the half that's easiest to assert and let the test's name quietly claim the whole. The same thing happens at the level of a whole audit: *"I added tests only where coverage was missing"* is itself an empirical claim, and like any claim in this PR it deserved the scrutiny given to the code. An audit performed with good intent and not actually checked line-by-line isn't dishonest, but it isn't verified either — and the difference matters exactly at the moment someone relies on it.

→ Carry forward: When a test name asserts symmetry — "round-trips," "preserves," "without leaking" — point at the specific two lines, one per direction, that would fail if either half broke. When an audit claim like "already covered elsewhere" appears in a design doc, list the covering tests by name; if you can't, it needs a red flag, not a bullet point.

> *"The parts of a system that never announce themselves — the phase a value can't yet be in, the sentence a comment was really answering, the noun two files quietly agree to share — are exactly the parts a refactor can carry off without anyone noticing they were load-bearing."* — Sensei

---

## The Closer

### 🎋 Haiku

```
Old rules move houses—
the reason stays in the yard,
buried, still holding.
```

---

## Summary

This is a good refactor, done in the right order, for the right reason: the seams were extracted *before* the second widget rather than during it, with an ADR first and a deliberately filed tech-debt item for the gap the author chose not to close. Nothing here is a blocker — Blake independently traced and dismissed three suspected ones, and the security, performance, and persistence-contract guards all came back byte-identical.

Two things deserve attention before merge. The first is real: the widget-config clone migrated across `hydrateCommittedState`'s "nothing past here may throw" line, leaving a comment that now promises a guarantee the structure no longer enforces — a one-line hoist fixes it, and the next widget codec is precisely the thing that would find it. The second is a truth-in-advertising cluster: the ledger's name and the ADR's language both promise more generality and more validation than the code delivers, and the new grammar module duplicates an `exactKeys` that already exists two doors down and has already drifted.

Fix #1, decide whether to align the ledger with its name or the ADR with the ledger, resolve the duplicate `exactKeys`, restore the `endLine` comment, and this merges clean.

## Remediation — 2026-07-31

All ten actionable findings were addressed. Hydration now prepares cloned widget
state before any live assignment and installs it through a non-throwing phase;
the ledger receives widget-specific clone/summary operations rather than
importing Gesture Playground. Persistence grammar was consolidated into the
existing `persistedValidation` module, including the restored `resource.read`
incident comment, and the draft-default result received a widget-local name.

Focused tests now cover hydration atomicity, both defensive-clone directions,
menu and option bounds, duplicate menu options, selection membership, and
selection cardinality/uniqueness. Findings #9 and #11 remain explicitly
deferred: codec directory shape waits for the second codec, while widget-config
bounding is folded into the existing session-retention debt with referential
integrity requirements recorded there.

Verification: all three TypeScript projects, 149 Jest suites / 1,702 tests,
lint (0 errors; 869 existing warnings), production build, bundle sentinel, and
`git diff --check` pass.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
