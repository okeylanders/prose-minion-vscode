# ADR 2026-07-29: Workshop Personas May Run Deterministic Measurement

**Status:** Proposed
**Date:** 2026-07-29
**Extends:** [ADR 2026-07-10 — Agent Run Engine and Resource Catalogs](2026-07-10-agent-run-engine-and-resource-catalogs.md), [ADR 2026-07-09 — Workshop Persona-Hosted Conversations](2026-07-09-workshop-persona-hosted-conversations.md), and [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
**Implementing sprint:** TBD

## Context

Workshop personas currently hold four capability families: `dictionary.lookup`,
`dictionary.full-entry`, `analysis.run`, and the `resource.*` triplet. Every one
of them is either a nested model call or untrusted file content. The room has no
door to a *measured fact*.

That gap shows in the personas' actual work. Cliff reports repetition by
impression. Felix judges sentence-length variation by ear. Wren estimates
weak-verb and filter-word density from a reading. The extension already computes
all three deterministically and for free:

- [`PassageProseStats`](../../packages/core/src/tools/measure/passageProseStats/index.ts) —
  sentence/paragraph counts, average sentence length, dialogue percentage,
  lexical density, TTR, hapax, readability grade, word-length distribution.
- [`StyleFlags`](../../packages/core/src/tools/measure/styleFlags/index.ts) —
  adverb, passive-voice, weak-verb, filler, repetition, and cliché counts with
  examples.
- [`WordFrequency`](../../packages/core/src/tools/measure/wordFrequency/index.ts) —
  top words, stopwords, hapax, POS buckets, bigrams/trigrams, length histogram.

A persona guessing at a number the process already knows is a hybrid-system
failure: deterministic work is being delegated to a probabilistic component. The
codebase's own principle is the opposite — code counts, the model judges.

Three properties separate measurement from every existing capability and are the
reason it warrants its own decision rather than an extra `toolId` on
`analysis.run`:

1. **It costs nothing.** No provider call, no tokens, no latency worth budgeting.
   `analysis.run`'s `analysisRunsPerTurn: 1` exists to bound spend; measurement
   does not need that bound and should not inherit it.
2. **Its output is ground truth.** Existing evidence framing tells the persona
   "use only what it actually contains." Measured figures deserve a stronger and
   *differently shaped* instruction, because the failure mode is not
   fabrication — it is rhetorical rounding and over-reach.
3. **Its natural subject is larger than a passage.** The high-value question is
   corpus-scale ("which crutch words escalate across chapters 1–12"), which no
   excerpt-bound capability can answer.

**Category search is deliberately out of scope.** Despite living beside the
metrics tools in the Search tab,
[`CategorySearchService`](../../packages/core/src/infrastructure/api/services/search/CategorySearchService.ts)
is an AI-powered capability — it batches up to 400 words per model call through
`getAIMatches`. It belongs to `analysis.run`'s cost class, not this one, and it
carries a live precondition documented in §7.

## Decision

### 1. One new capability operation: `measure.run`

`WorkshopCapabilityOperation` gains `measure.run`. It covers the deterministic
measure tools only:

```
type WorkshopMeasureToolId = 'prose-stats' | 'style-flags' | 'word-frequency';
```

`measure.run` is granted uniformly to every persona, host and guest alike.
Differentiation belongs in persona schematics and prompt framing — Cliff reaches
for `word-frequency` because his brief tells him to. Per-persona capability
grants would add a new axis through the schematics, the XML contract, and the
tests, and buy nothing this decision needs.

### 2. Measurement takes one closed subject, never a glob

A glob supplied by a model is a new containment surface, and this codebase has
already settled the question of what a persona may see: a `ContextPathGroup`
plus a validated workspace-relative path. `measure.run` reuses that answer rather
than re-deriving it.

The request carries exactly one `<subject>`, from a closed union:

| Subject | Meaning | Validation |
|---|---|---|
| `excerpt` | The pinned excerpt | Rejected when the session has no excerpt |
| `resource` | One configured file (`group` + `path`) | The same containment and byte ceilings as `resource.read` |
| `corpus` | Every configured file in one `group` | Bounded by `corpusItems` and `corpusWords` |
| `text` | Persona-supplied local material | Bounded by `subjectTextCharacters` |

No other subject form is legal. Paths are never absolutized or traversed;
`resource` and `corpus` resolve through the existing configured-resource
provider, so measurement can never read a file the persona could not already
`resource.read`. `text` mirrors `analysis.run`'s `replace` mode and exists for
the same reason — a persona measuring material it has assembled locally — and its
provenance is recorded as persona-chosen so the artifact never implies the
writer supplied it.

The excerpt subject is excerpt-gated and therefore unavailable in an open room,
consistent with ADR 2026-07-25 and ADR 2026-07-26. `resource`, `corpus`, and
`text` remain available in an open room, because none of them fabricates a
passage the room does not have.

### 3. Evidence is a bounded digest, not the sidebar report

The measure tools' outputs are shaped for a human reading a formatted panel.
`WordFrequencyOutput` alone carries Top 100 entries, a full hapax list, four POS
buckets, bigrams, trigrams, and a character-length histogram. Delivering that
verbatim is both a token bonfire and a behavioural hazard: a persona handed a
hundred rows recites the table instead of using it.

A new core-side `WorkshopMeasurementDigest` renderer projects each tool output
into a compact, decision-shaped frame — the same discipline `workshopResource`
applies to catalogs and search snippets. The digest reports rates alongside raw
counts (occurrences per 1,000 words) so figures stay comparable across subjects
of different lengths, and it names the measured subject and its word count.

The renderer lives beside the capability in
`application/services/workshop/`, **not** in
`presentation/webview/utils/formatters/`. Its audience is a model, not the
webview, and coupling it to the sidebar's formatters would make every display
tweak a prompt change.

### 4. Measured evidence is its own trust class

`formatEvidence` currently distinguishes two classes: untrusted project-file
content, and separately-attributed capability output. Measurement is a third,
and its framing states three things the other classes do not need:

- **Cite figures exactly.** These are computed facts; do not round them into
  rhetoric or restate a count as an impression.
- **Do not extrapolate.** A figure describes the measured subject only, and
  never the manuscript beyond it.
- **Absence from the digest is not absence from the text.** The digest is
  truncated by design. A word missing from a bounded Top-N list has not been
  shown to be unused, and must never be reported as unused.

The third is the one that would otherwise manufacture confident falsehoods out
of a presentation bound.

### 5. Budgets are separate from the model-call budgets

`PROMPT_BUDGETS` gains a `workshopMeasure` block:

```
workshopMeasure: {
  runsPerTurn: 2,
  subjectTextCharacters: 20_000,
  corpusItems: 50,
  corpusWords: 200_000,
  topItems: 15,
  flagExamples: 3,
  digestCharacters: 4_000
}
```

`measure.run` still consumes the shared `workshopCapability.callsPerTurn: 5`, so
a persona cannot crowd out its own reasoning with measurement. But its own
per-turn ceiling is independent of `analysisRunsPerTurn`, because the two bound
different resources: one bounds provider spend, the other bounds context volume.

`corpusItems` and `corpusWords` bound fan-out for the corpus subject the way
`workshopResource.searchFiles` bounds search. When a corpus run is bounded, the
digest says so explicitly and reports how many files were measured out of how
many matched — a silently truncated corpus reads as a complete one.

### 6. Recording, accounting, and status reuse existing machinery

A completed run records through `session.recordCapabilityArtifact` with
`operation: 'measure.run'`, carrying the same principal, request-id, and
excerpt-version correlation as every other artifact. Room-ledger audience rules
are unchanged: the artifact is private until published transactionally with a
participant reply.

`WorkshopCapabilityResult.usage` is **absent** for measurement. A deterministic
run reports no token usage, and must not contribute a zero-valued usage record
that would dilute the run's inference accounting
([ADR 2026-07-16](2026-07-16-inference-context-observability.md)).

Status and ticker copy follow the established persona-voiced pattern
("Cliff is measuring word frequency across 12 chapters…").

### 7. Category search is deferred behind a concurrency precondition

`measure.run` deliberately excludes category search. Before any persona-facing
door to it is opened, `CategorySearchService` must stop holding run state on the
instance.

The service keeps a single `private abortController` and, per its own
constructor comment, is built once at the composition root and shared across
webviews. Today the Search tab is its only caller, so single-flight is a
property of the UI rather than of the service. A second concurrent run
overwrites the first run's controller; `cancelSearch()` then aborts only the
survivor while the orphaned run continues to completion and continues to bill.
Giving a persona an independent trigger removes the accident that currently
hides this.

The fix — a per-run controller or a keyed run registry — is a prerequisite, not
part of this decision. It is worth tracking in `.todo/tech-debt/` regardless of
whether persona category search is ever built, because the sidebar is one
multi-webview scenario away from the same collision.

## Consequences

- Personas stop estimating quantities the process already computes, and their
  claims about repetition, density, and rhythm become checkable.
- Corpus-scale measurement becomes available to the room for the first time, at
  zero token cost, in both excerpt and open sessions.
- `WorkshopCapabilityOperation` gains a member. It is persisted inside capability
  artifacts, so `WorkshopSessionStateV1` integrity and migration tests must
  accept the new value; no schema version bump is required, and existing sessions
  remain readable.
- The XML codec gains a fourth operation shape with its own closed-schema
  validation, rejection reasons, and instruction block. The capability
  instruction grows, which the `promptBudgets` architecture test will measure.
- A new digest renderer becomes the single place where measurement volume is
  bounded — and therefore a place where a careless change silently widens every
  persona's context.
- Tests must cover: subject-union validation and each rejection reason, excerpt
  gating in open scope, corpus bounding and its disclosure, digest ceilings,
  absent-usage accounting, and artifact recording under both host and guest
  principals.
- Category search remains sidebar-only until its run state is per-run.

## Open questions for review

1. **Operation name.** `measure.run` names the tool family
   (`packages/core/src/tools/measure/`) and parallels `analysis.run`. But the
   message layer, handler, and hook all call this domain *metrics*
   (`MetricsHandler`, `useMetrics`, `MetricsResult`). `metrics.run` would match
   the message vocabulary a maintainer greps for; `measure.run` matches the tool
   vocabulary a persona is told about. Pick one and be consistent in both.
2. **Is the `text` subject worth the risk?** It is consistent with
   `analysis.run`'s `replace` mode, but it is also the one subject where a
   persona can measure material it composed rather than material the project
   contains — real numbers computed over invented prose. Dropping it costs
   little; keeping it needs the provenance line in §2 to be load-bearing.
3. **Should `style-flags` ship examples at all?** Its output carries up to five
   verbatim example strings per flag. That is the most useful part for Wren and
   the most quotable-out-of-context part for everyone else. `flagExamples: 3` is
   a guess.
4. **Corpus subject granularity.** Group-level corpus is the simplest bound, but
   the escalation question ("which words rise across chapters 1–12") really wants
   *per-file* series, not a single aggregate. Aggregating loses the signal;
   per-file series multiplies digest volume by file count. This may deserve a
   distinct digest shape rather than a wider budget.
