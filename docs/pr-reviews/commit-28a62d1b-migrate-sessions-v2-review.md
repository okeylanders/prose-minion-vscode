# Commit Review — fix(workshop): migrate persisted sessions to v2

**Author:** Okey Landers · Commit `28a62d1b` on `release/v2.2.0`

Scope note: the untracked `Prose Minion.zip` in the working tree was not part of the commit and was not reviewed.

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟡 Standard | V2 envelope wraps an aggregate still named `WorkshopSessionStateV1`; the split-clock rationale lives only in the runway doc, not the code | Marcus, Parker | 🎯 | **Open** — one-line comment (or unversioned rename) where the confusion surfaces |
| 2 | 🟡 Standard | Remove→reinstall standing-directive lifecycle has zero direct test coverage (passes empirically today); store-level `writeCurrent(v1)` rejection also unmirrored | Sam, Cal | 🎯 | **Open** — normal writer behavior for the first widget release |
| 3 | 🟡 Standard | Beta widget checkpoints consume their only V1 migration handle when opened + autosaved under v2.2.0 (become schemaVersion 2, surviving only via retirable dev normalization) | Blake | — | **Open** — no code change; add "repair beta files before opening under v2.2.0" note to the ADR |
| 4 | 🟡 Standard | Frozen released-v1 fixture is empty (0 turns/conversations) — migration proves default-initialization, never content preservation | Cal | — | **Open** — this is the release-gate witness; add a content-bearing fixture or inline case |
| 5 | 🟡 Standard | `coherentStandingTurn`'s ~6-clause conjunction has only one negative-mutation test (action flip); mismatched ID/revision variants untested | Cal | — | **Open** — a dropped AND clause would accept corrupted state silently |
| 6 | 🟡 Standard | Dangling `passed.` fragment left in docs/CHANGELOG-DETAILED.md "Release validation" — ships in the public v2.2.0 changelog | Stan | — | **Open** — fix before release |
| 7 | 🟡 Standard | Migration provenance (`migrations=v1-to-v2`) is logged only after successful hydration; a hydration failure discards the one fact that narrows diagnosis | Oliver | — | **Deferred** — diagnostic quality; safe post-release, but cheap and high-leverage in launch week |
| 8 | 🟡 Standard | `invalid config linkage` now fronts ~11 distinct failure clauses with one string; sibling checks split by category | Oliver | — | **Deferred** — error granularity, post-release |
| 9 | 🟡 Standard | New strict `removedLinkage` arm sits beside the looser pre-existing `activeLinkage` arm with no comment explaining the asymmetry | Parker | — | **Open** — one-line comment alongside #1 |
| 10 | 🟢 Nit | Identical "Unsupported Workshop session schema" message for unknown-version vs known-but-not-current | Parker | — | **Deferred** — cosmetic |
| 11 | 🟢 Nit | `WorkshopSessionSearchIndexV1` stays V1 while consuming V2 with no file-top rationale (codebase habit) | Stan | — | **Deferred** — cosmetic |
| 12 | 🟢 Nit | Third full-tree clone pass on v1 reads (one-time per file, size-capped) | Tim | — | **N/A** — accepted; only matters if caps grow orders of magnitude |
| 13 | 🟢 Nit | Migration log line repeats on every open of a never-resaved named v1 file | Oliver | — | **Deferred** — noise-floor awareness only |
| 14 | 🟢 Praise | Migration module keeps its "must not know" boundary honestly narrow; no premature registry abstraction | Marcus | — | **N/A** |
| 15 | 🟢 Praise | Terminal-removal arm verified adversarially across lifecycles; single envelope writer confirmed; 120 workshop suites green | Blake | — | **N/A** |
| 16 | 🟢 Praise | `logSchemaMigrations` mirrors `logCheckpointNormalizations` exactly, per the ADR's separate-reporting requirement | Stan | — | **N/A** |
| 17 | 🟢 Praise | ADR criteria verified in code: migration matches the V2 gate field-for-field; changelog claims literally true; predicate implements the risk register | Bria | — | **N/A** |
| 18 | 🟢 Praise | No new perf regressions: validator complexity unchanged; store/search-index path adds no re-parse | Tim | — | **N/A** |

---

## Blast Radius

- 17 files changed · +781 / −83 lines
- New files: 3 (planning runway doc, `WorkshopPersistedSessionV1ToV2Migration.ts`, frozen v1 fixture) · Migrations: **yes — this commit IS the persisted-JSON schema migration (v1 → v2)** · New services/controllers: none
- The public compatibility-clock commit for the first Marketplace widget release: released pre-widget sessions migrate on read, writes emit v2 only, and standing-directive removal now round-trips.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | A |
| 🧪 Tests | B− |
| 📖 Quality | B |
| ⚡ Performance | B+ |
| 🎯 Domain | A |

---

## Executive Briefing

**No 🔴 Blocking or 🟠 High findings.** Ten reviewers, including an adversarial pass that empirically attacked the migration and the terminal-removal predicate, found no traceable failure path. The panel's material output is nine Standard findings — two with consensus — clustered around documentation-of-decisions, test-witness depth, and diagnosability:

🟡 **[Marcus + Parker 🎯]** The V1-aggregate-inside-V2-envelope naming split is deliberate but written down only in the runway doc — put one line where a future reader will doubt it.

🟡 **[Sam + Cal 🎯]** Remove→reinstall is normal writer behavior and ships untested (it passes today — Sam probed it through three generations).

🟡 **[Blake]** Opening a beta checkpoint under v2.2.0 permanently consumes its V1 migration handle — document repair-before-open in the ADR.

🟡 **[Cal]** The release-gate fixture is empty; it witnesses default-initialization, not content preservation — the actual fear a migration exists to address.

🟡 **[Stan]** A dangling "passed." fragment sits in the public detailed changelog — fix before the release goes out.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — The compatibility clock advanced to V2 but the aggregate it wraps is still named V1 [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersistedSession.ts:75` — The envelope rename is honest and complete (`WorkshopPersistedSessionV1` retained as migration input only; no stray V1 writer paths). But the nested aggregate carrying the very fields this release adds is still typed `WorkshopSessionStateV1`, and `assertWorkshopPersistedSessionStateV2` is bolted on beside it to enforce that "V1" fields are mandatory once the envelope claims V2. The runway doc names this tension; the code doesn't. The next V2→V3 author will grep for version symbols and find the aggregate frozen at "V1" meaning "current" — inviting either a duplicated `WorkshopSessionStateV2` or silent reuse. If the aggregate is deliberately unversioned (defensible), say so explicitly — e.g. `WorkshopSessionAggregateState` — so "V1" stops silently meaning "current."

### 🟢 Praise — The migration module keeps its "must not know" boundary honestly narrow

`packages/core/src/application/services/workshop/WorkshopPersistedSessionV1ToV2Migration.ts:24` — Exactly the five structural defaults the ADR names; spreads rather than reconstructs so untouched fields survive verbatim; explicitly refuses to repair malformed input ("A migration is not a repairer"). No generalized migration registry was built for the one transition that exists, matching the ADR's own defer-until-V2→V3 call. Ninety-nine lines to move a compatibility clock is proportionate.

> *"The clock got rewound honestly and the walls between rooms stayed where they belong — I'd just put a fresh sign on the room still labeled 'V1' before the next tenant moves in confused."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🟡 Standard — Beta checkpoints inherit the public V2 version number, losing their only migration handle

`packages/core/src/application/services/workshop/WorkshopPersistedSession.ts:150` — The dispatcher branches on `schemaVersion` alone, and both released pre-widget files and local beta checkpoints claim `1`. Open a decodable beta checkpoint → migration preserves its dev fields → dev normalization repairs the unreleased widget shape → next autosave writes `schemaVersion: 2`. From then on the file is version-indistinguishable from genuine released V2, surviving only because a normalization the ADR classifies as retirable dev repair keeps repairing it. When that normalization retires, those files fail closed with no adjacent migration able to target them. Smallest fix is documentation, not code: record in the ADR's V2 section that beta files must be manually repaired *before* being opened under v2.2.0, since opening consumes the V1 handle permanently.

### 🟢 Praise — The terminal-removal arm is exact, and it holds across every reachable lifecycle

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:554` — I tried to break this and could not. Install→shift→remove, reinstall generations, and the reopen-then-autosave path all round-trip. The one variant that would break the predicate (re-applying onto the retired config id) is refused upstream by the edit-conflict guard. The arm can't launder corruption either: a "removed" claim can't coexist with an active rail entry pointing at the same config. A realistic content-bearing v1 shape migrates with content intact; `capture()` emits all five gated fields; grep confirms one envelope writer remains. Core typecheck clean, 120 workshop suites / 1,475 tests green.

> *"I came looking for the goblin and found the door already locked — ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard — Remove→reinstall lifecycle has no regression test [🎯 Consensus]

`packages/core/src/__tests__/application/services/workshop/WorkshopStandingDirectiveService.test.ts:170-219` — The suite exercises install→remove and stops. It never exercises install→remove→reinstall→remove — the multi-generation scenario where an old retired config and a new active config must independently satisfy `removedLinkage`/`activeLinkage` without colliding. I traced the ledgers by hand (counters never reset; reinstall always mints fresh `pd-N`/`wc-N`) and confirmed with a throwaway probe through three generations: it passes cleanly today. But a writer toggling Lexical Gravity off and back on mid-session is normal usage, and the CHANGELOG explicitly claims regression coverage here. A future ledger-counter change could silently break this with no test noticing.

> *"Went looking for the trapdoor in the remove-then-reinstall lifecycle, built a throwaway probe to spring it myself, and watched three generations of `pd-N`/`wc-N` walk through cleanly — the logic's solid, it's just that nobody in the test suite ever knocked on that door."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `assertWorkshopPersistedSessionStateV2` takes a `WorkshopSessionStateV1` [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersistedSession.ts:252-254` — The name promises V2; the parameter type says V1. The split-versioning decision is deliberate, but the reasoning lives in the memory-bank runway doc, not the code. A reader who hasn't seen that doc will read this signature as a type error waiting to happen. Cheapest fix: one doc comment on the function (or on `WorkshopSessionStateV1`'s declaration) stating the inner aggregate keeps its historical name while only the outer envelope's schemaVersion advances.

### 🟡 Standard — `activeLinkage` and `removedLinkage` validate at different strictness with no comment explaining why

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:545-557` — `removedLinkage` requires the full `coherentStandingTurn` match; `activeLinkage` (the untouched original check) only checks the directive ledger entry and never inspects the committed turn's contents, even though both turn shapes are identical. Preserved behavior, not a bug — but a strict new arm beside a looser unexplained one reads as oversight rather than decision, and the next lifecycle-arm author may copy the wrong strictness. One line of "why" fixes it.

### 🟢 Nit — Duplicated "Unsupported Workshop session schema" string across two assert functions

`packages/core/src/application/services/workshop/WorkshopPersistedSession.ts:177,217` — Identical message for "not a known version at all" vs "known-but-not-current at the strict write boundary." A v1 file handed to the writer gets the same wording as an unknown v3 file. Factor into a shared helper so the wordings can't silently diverge.

> *"The logic holds together, but two of these three read like decisions no one wrote down — future-you shouldn't have to reverse-engineer intent from a memory-bank file to trust a one-line function signature."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — Migration only proven against an empty fixture — no content-preservation witness

`packages/core/src/__tests__/fixtures/workshop-session-v1-released.json:41-54` — The fixture (the only call site exercising `migrateWorkshopPersistedSessionV1ToV2` in the entire suite; no dedicated unit test exists) has `turnCount: 0` and empty turns/conversations/writerSources. It proves the migration *initializes* V2 defaults; it never proves it *carries forward* a real user's turns, todos, or conversation archive unmutated. A regression that dropped `turns` during the spread would pass this suite. One content-bearing fixture with an exact deep-equality assertion closes it.

### 🟡 Standard — New `removedLinkage` integrity arm has only one negative-mutation witness

`packages/core/src/__tests__/application/services/workshop/WorkshopStandingDirectiveService.test.ts:206-219` — `coherentStandingTurn` is six ANDed equality checks plus the action check; the suite only flips `action`. None of the ID/revision mismatch variants are tested, so a dropped AND clause (or an `||` typo) would accept corrupted linkage silently. The runway doc itself calls for those variants — this is the gap I'd bump toward High if it ships un-widened, since a narrowed predicate here means corruption gets accepted rather than rejected.

### 🟡 Standard — No install→remove→reinstall round trip, and no store-level `writeCurrent(v1)` rejection mirror [🎯 Consensus]

`packages/core/src/__tests__/application/services/workshop/WorkshopStandingDirectiveService.test.ts:170-204` — Every remove-path test removes once and stops (see Sam's finding). Separately, the strict-write v1 rejection is verified at the codec-unit level but never mirrored at the store level — `WorkshopSessionStore.test.ts` never calls `writeCurrent` with a `schemaVersion: 1` payload.

> *"Happy path only. I've seen this movie — the coherent linkage check has six ANDs and we tested one of them, and the sequel where somebody reinstalls after removal is the one nobody wrote a ticket for."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — Dangling "passed." fragment left in Release validation bullet

`docs/CHANGELOG-DETAILED.md:146-148` — The edit rewrote the first sentence of the Jest bullet and appended a second, but the original trailing `passed.` line survived as its own fragment. Every other bullet in the section reads as one coherent sentence. This ships as the public detailed changelog for v2.2.0 — worth a clean pass before release.

### 🟢 Nit — `WorkshopSessionSearchIndexV1` doesn't explain why it stays V1 while consuming V2

`packages/core/src/infrastructure/storage/WorkshopSessionSearchIndexV1.ts:1` — The ADR spells out the reasoning ("the regenerable browser index has not changed its own contract"), but the codebase's habit for looks-like-a-mismatch-but-isn't situations is a file-top rationale comment — see `WorkshopSessionCheckpointNormalization.ts:1-7` and the new migration module's own header. A cold reader next to a sibling that just bumped to V2 will wonder why this one didn't.

### 🟢 Praise — `logSchemaMigrations` mirrors `logCheckpointNormalizations` exactly

`packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:965-974` — Same guard clause, same `[WorkshopSessionPersistence]` prefix, same trailing format, placed right next to its sibling. Exactly the ADR's intent that migrations be reported separately from development normalizations; reads like it always lived there.

> *"The CHANGELOG bullet is the only place in this commit where the seams show — everywhere else, the new migration slotted in like it always lived there."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Nit — v1 migration adds a third full-tree clone pass on top of two pre-existing ones

`packages/core/src/application/services/workshop/WorkshopPersistedSessionV1ToV2Migration.ts:22` — A v1 read now walks `workshop` twice and `conversations` twice (migration clone + the codec's pre-existing clones); a steady-state v2 read skips the migration branch entirely. O(n) in JSON nodes, files capped at 25 MiB exact-read, fires once per v1 file on first open, never again after re-save. Low tens of milliseconds worst case. Not worth restructuring — would only matter if the byte caps grew by orders of magnitude or migration became recurring.

*(Also verified as praise: the linkage validator's O(configs × turns) scan is unchanged by this commit — `some` → `find` at the same call site, O(1) field comparisons added — and the store/search-index path adds no new re-parse or re-validation; v1 files pay the extra clone only when actually opened, never during browser listing.)*

> *"One extra full-tree walk on a file that's capped at 25 MiB and migrated exactly once per lifetime — I'll spend my outrage budget elsewhere."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

**Zero findings.** Three vectors chased and each closed with evidence: (1) prototype pollution via the migration's spreads — `Object.fromEntries`, object spread, and `JSON.parse` all write own data properties via `CreateDataProperty`, never `[[Set]]`, so a crafted `"__proto__"` key becomes an inert own property and `exactKeys` rejects it downstream anyway; (2) the `removedLinkage` arm smuggling resurrected widget state into prompts — every prompt-building path resolves configs through the live `standingDirectives` ledger, and a config accepted via `removedLinkage` is by definition absent from that ledger, so it's structurally unreachable; (3) new unbounded attacker-content echo in errors — searched the diff, none found beyond the bounded `String(value.schemaVersion)`.

> *"The spreads look dangerous until you check which internal slot they actually write to — here, none of them touch `[[Prototype]]`."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Migration provenance is only logged on the happy path, not on failure

`packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:684-699` — `logSchemaMigrations` fires only after `hydrateCommittedState` returns successfully. If hydration throws downstream of a successful decode, the catch rethrows and the user-visible failure ("Current session restore failed; rolling autosave paused: …") says nothing about the file being a v1 migration candidate. A writer reports "my old session won't open after the update"; the one fact that would immediately narrow the search — this is a migration-path failure, not ordinary corruption — is discarded exactly when it's most useful.

### 🟡 Standard — `invalid config linkage` now hides two structurally different failure classes behind one string

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:554-567` — The diff replaces a 5-condition check with two ~6-clause predicates — roughly tripling the distinct ways this branch fires — while funneling every failure into the same message. A corrupt active directive and a corrupt removal marker produce identical strings; sibling branches in the same function split by failure category. Diagnosing a real user's file means obtaining the full session JSON and manually re-deriving which clause tripped.

### 🟢 Nit — Migration log line repeats indefinitely for a v1 named session that's opened but never re-saved

`packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:965-975` — `openNamed` promotes only `current.json` to v2; the named file itself is rewritten only by update/rename. A writer who repeatedly reopens an old v1 named checkpoint read-only re-triggers the line on every open — the noise floor is per-open-of-that-file, not per-file-lifetime. Harmless at this volume; worth knowing.

> *"The migration succeeded and nobody will ever know it — right up until it doesn't, and then nobody will know that either."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟢 Praise — The plan's acceptance criteria are implemented line by line

Three checks, all clean: (1) `WorkshopPersistedSessionV1ToV2Migration.ts:30-48` initializes exactly the five fields `assertWorkshopPersistedSessionStateV2` requires — a migrated session can never fail the gate the migration exists to satisfy; (2) the CHANGELOG's "the next successful save writes V2" is literally true, not just plausible — reads never write back, and every write path routes through the strict v2-only parser, so an opened-but-unsaved file genuinely stays v1 on disk; (3) the `removedLinkage` predicate implements the planning doc's own "corrupt config passes as retired" prevention spec exactly (rail, IDs, and revision matched on both the commit and the change record), with the tampered-action negative test the criterion required.

> *"I went in looking for the gap between the plan and the code and mostly found the plan's own risk register, implemented line by line — which is either excellent engineering or an extremely well-disguised crime, and at some point those start looking the same from the outside."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Decision Stays Where It Was Made

Illuminated by: Marcus #1, Parker #1, Stan #2

When we work through a genuinely hard call — "the envelope advances, the aggregate name doesn't" — the reasoning tends to settle wherever the thinking happened: a runway doc, a memory-bank entry, an ADR. But the person who trips over that decision later isn't reading the planning doc; they're staring at `assertWorkshopPersistedSessionStateV2(state: WorkshopSessionStateV1)` at 11pm, sure they've found a type error. A decision only counts as documented if it's discoverable at the exact coordinate where it will look wrong.

→ Carry forward: before closing out a deliberate-but-surprising design choice, ask "where will a stranger first doubt this?" — then put one sentence of rationale there, not just in the doc where you resolved your own doubt.

### Lesson 2 — The Front Door Gets the Deadbolt, the Side Door Gets a Glance

Illuminated by: Blake #1, Sam #1, Cal #3

The path you were explicitly asked to fix — open a v1 file, migrate, write v2 — earned real rigor: empirical adversarial testing, a green suite, a refused-upstream guard. Paths that merely route through the same code because they share a shape (a beta checkpoint that also claims `schemaVersion: 1`; toggling a widget off and back on) got verified by checking that today's behavior looks fine, not by anything that would notice if tomorrow's didn't.

→ Carry forward: when you finish testing the path you meant to test, ask "what else touches this code by accident, not by design?" — then either give it the same protection or write down, explicitly, that it's out of scope and why.

### Lesson 3 — The Fixture Should Contain the Thing You're Afraid to Lose

Illuminated by: Cal #1

A migration's entire reason for existing is "don't lose the user's stuff." The frozen fixture proves the migration can manufacture correct defaults from nothing — true, and also not the risk anyone was worried about. It's easy to reach for the cleanest fixture that exercises the code path and quietly drift away from the fixture that exercises the actual fear.

→ Carry forward: before freezing a compatibility fixture, finish the sentence "the one thing this migration must not lose is ___" — and make sure that thing is literally present in the fixture's data, not just in the schema shape.

### Lesson 4 — Logs Written for the Historian Aren't Written for the Detective

Illuminated by: Oliver #1

`migrations=v1-to-v2` gets logged right after successful hydration — a natural instinct, since that's when you know it happened. But the one person who'd actually want that fact is the future engineer staring at a hydration *failure*. We tend to log to record what succeeded, when the more valuable discipline is logging to arm whoever has to investigate what didn't.

→ Carry forward: for any fact worth logging on success, ask "would this fact also help someone if this step had thrown?" — if yes, capture it before the point of failure, not after the point of success.

### Lesson 5 — New Code Inherits the Shape It Sits Next To, Not the Rigor

Illuminated by: Parker #3, Oliver #2

The new `removedLinkage` arm sits beside the older `activeLinkage` arm at a different strictness, and the new error path collapses eleven failure clauses into one string while its siblings split by category. Neither is wrong alone — but both quietly break the established granularity of the family they joined. When we extend a pattern under the pressure of "make this one case work," we match its outward shape and skip auditing whether we matched its internal conventions too.

→ Carry forward: when adding a new arm to an existing family (validators, error branches, checks), diff it against its nearest sibling on purpose — strictness, granularity, message specificity — not just against the requirement that made you write it.

> *"The runway doc and the code are two drafts of the same decision — and only one of them ships with the software, so that's the one that has to carry the reasoning."* — Sensei

---

## The Closer

### 🐾 Animal

If this commit were an animal, it would be a **hermit crab** — because it moves the entire soft body of a writer's session into a bigger shell (v2) without losing a single limb, leaves the old shell (v1 files on disk) intact until the owner actually moves in, and flatly refuses to occupy any shell that doesn't fit (unsupported versions fail closed). The only note from the panel: it forgot to mention that its beta-hermit cousins, once they crawl into the new shell, can never go back for their things.

---

## Summary

Merge-ready. Zero blocking and zero high-severity findings across ten reviewers, including an adversarial pass that empirically attacked the migration and the terminal-removal predicate and came back with praise. The nine Standard findings cluster into pre-release polish (the dangling changelog fragment, two one-line rationale comments, an ADR note on beta-file repair ordering) and test-witness depth (a content-bearing migration fixture, negative linkage mutations, the reinstall round trip) — all cheap relative to the confidence they buy for a first public schema migration. Fix the changelog fragment before the release goes out; the rest can land as fast follow-ups on the release branch.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
