# PR Review — Being-Verb Contractions and Dialogue as Voice

**Author:** okeylanders · **PR:** [#162](https://github.com/okeylanders/prose-minion-vscode/pull/162) (open, unmerged at review)  
**Branches:** `epic/lightbox-being-contractions` → `epic/lightbox`  
**Reviewed implementation head:** `2295f9d61bf621fbdb41f9fbe5cd6721a45b199b` (including the three additions pushed during review; initial head `ab22ebd`)  
**Base / verified merge-base:** `1cb417c78a1a4b6cf0e3b9504cf4c1672635a7ed`  
**Scope:** 55 files · +5,072 / −120  
**Reviewed:** 2026-10-21 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; synthetic detector, reader, codec, voice, carry and Bring probes; direct-Node performance controls; regenerated production-host state; exact rebuilt-bundle DOM execution; supplied PNG inspection; fresh full head gates

## Summary

**Verdict: Request changes.** The ordinary contraction/count agreement and all-dialogue withholding paths work. Two P2 corrections remain in example anchoring: its narration filter introduces quadratic paragraph-wide work and repeatedly recomputes expensive detectors; and an example spanning both speech and narration can still replace the spoken words. A smaller P3 omission leaves an **Earns** dialogue note unmarked in the Opinion, UI and Bring.

All repository tests, typechecks, lint parity and the production build pass. The webview hash reproduces the author's value, and the regenerated after-state and figure evidence are byte-identical. These passing gates do not cover the two examples below.

This is a code-review disposition, not a formal GitHub review, merge instruction, writer checkpoint, native-host verification, real-chapter acceptance or Slice 5 readiness decision.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | The narration-example filter scans every dialogue span for every instance; each note repeats detector work | **Open** |
| F-02 | Medium / P2 | A mixed speech/narration example passes the narration-only guard and rewrites the spoken words | **Open** |
| N-01 | Low / P3 · nonblocking | Earns dialogue notes omit the dialogue marker from the digest, board/inspector and Bring | **Open** |

## F-01 — Index dialogue membership and reuse the paragraph's detected instances

**Primary location:** [`LightboxSteeringVoice.ts:90–95`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/infrastructure/lightbox/LightboxSteeringVoice.ts#L90-L95).  
**Repeated caller:** [`LightboxSteeringTiles.ts:165–167`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/infrastructure/lightbox/LightboxSteeringTiles.ts#L165-L167).

The new narration filter detects **all** instances in the paragraph, then calls `dialogue.some(...)` from the beginning for each one. With *n* interleaved speech spans and *n* narrated instances, a narrated instance scans all *n* spans; a spoken instance scans up to its own span. This is quadratic even when the requested example is a short phrase at the start. The filter's cache is local to one newly created filter, so subsequent notes repeat the work. Quote verification and voice classification also independently re-detect the paragraph; contractions requiring POS tagging make those repeated reads materially more expensive than the former regex detector.

This does **not** undo #160's corrected automatic measurement index. It adds a separate expensive path during synchronous reading assembly, carried-example rechecking and Bring. The new detector-only large-paragraph test does not exercise this path.

### Independent evidence and timing context

**These are sequential direct Node 24.19.0 / Linux cloud-workspace measurements, not Jest-VM times and not measured native VS Code latency.** Module loading is outside the timed sections. The long single paragraphs are bounded synthetic stress fixtures, not claims about an ordinary chapter's layout. No provider or private manuscript is involved.

Repeat `“It’s cold.” It was quiet.` in one paragraph. A valid G response contains four leaning notes on `It was quiet`, each with the six-word-bounded illustration `It was quiet → Silence filled the room`. The 50,000-word case is at, not above, the source ceiling. All notes pass in both trees.

| Source shape | Verified base: assemble four notes | Head: assemble four notes |
| --- | ---: | ---: |
| 12,000 words, one paragraph | 6.7 ms | 500.3 ms |
| 25,000 words, one paragraph | 11.4 ms | 1,186.1 ms |
| 50,000 words, one paragraph | 20.7 ms | 3,025.0 ms |
| Same 50,000 words, 1,000 paragraphs of 50 words | 10.0 ms | 20.7 ms |

The timings above include the new detector's tagging, not just the nested scan. Two separate controls distinguish them:

- **Deterministic operation count:** instrumenting only dialogue-span `start` reads on repeated `“I was.” It was quiet.` yields **93,875 → 375,250 → 1,500,500** reads at **250 → 500 → 1,000** spans. Doubling the source approximately quadruples this work. This source has no contraction needing the new detector's tagger.
- **Uninstrumented, fresh-process isolation:** one anchored example on 50,000 whole-word-only words takes a warmed median **228.1 ms**. A diagnostic-only linear membership walk, retaining the production detector and returning the identical anchored result, takes **10.2 ms**. On the contraction version the corresponding medians are **343.9 ms / 192.5 ms**. These are three timed samples after a warm-up per control; getter instrumentation was not present in the timed process. The control is not a repository edit or a proposed shipped patch.

**Requested correction:** decide instance/dialogue membership with the existing interval-index approach or an ordered merge, and reuse per-paragraph/per-figure detection within the same immutable verifier/assembly context rather than retagging for each note and check. Preserve the source-owned offsets and voice semantics. Add a deterministic operation-count regression and bounded direct-runtime controls for examples on a long mixed paragraph, plus ordinary multi-paragraph controls. Test fresh, carried and Bring callers; do not only time `findBeingVerbs` or the automatic steering measure.

## F-02 — Withhold an example that also spans the character's spoken words

**Location:** [`LightboxSteeringTiles.ts:164–167`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/infrastructure/lightbox/LightboxSteeringTiles.ts#L164-L167), using the existential predicate at [`LightboxSteeringVoice.ts:95`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/infrastructure/lightbox/LightboxSteeringVoice.ts#L95).

The distinction between a **note** and its **example** matters here. The documented mixed-note rule deliberately classifies a quote as narration if any counted instance is narrated. That permits a note/nudge about its narrated part. It does not make the spoken portion an appropriate illustration to rewrite: the new anchor explicitly promises that its example is on narration, “never on a character's line.”

The filter currently answers only whether the proposed `before` contains **at least one** narrated instance. It does not exclude dialogue from that same span.

### Independent production witness

```text
Chapter: “I’m cold,” she was crying.
Quote:   I’m cold,” she was crying
Stance:  leans
Nudge:   An action for the silence may be worth a look.
before:  I’m cold,” she was crying
after:   Warmth filled her as tears fell
```

The source, quote and illustration satisfy the actual codec, length/word, whole-span and phrasing checks. `’m` is inside speech; `was` is narrated. The latter is sufficient for the example to pass:

- **Fresh:** the assembled note keeps both the nudge and the complete example, with no withheld reason.
- **Carry/reanchoring:** adding a new opening paragraph relocates the note to ¶2 and retains the same example.
- **UI:** the exact rebuilt production bundle displays both the spoken `before` and its replacement under “One way it could go.”
- **Bring:** succeeds and includes the point `I’m cold,” she was crying → Warmth filled her as tears fell`, with no voice/withheld warning.

The control cases work: an example containing only `It’s cold` from a mixed note is withheld as voice, while an example restricted to `The hall was dark` is retained. The missing case is a **single example span crossing the speech/narration boundary**. This is not the disclosed British-single-quote limitation, an ambiguous POS decision, a forged tile or a source-edit race.

**Requested correction:** keep the valid mixed note and its narration nudge, but withhold an example whose anchored `before` overlaps spoken text, even when it also contains a narrated instance. Use the shared dialogue spans and a truthful example-only reason. Add crossing-boundary examples, in both directions and with normalized typography, to fresh/carry/Bring coverage. Do not broaden this into rejecting mixed notes altogether or changing the documented figure scope.

## N-01 — Preserve voice metadata independently of whether a nudge could exist

**Location:** [`LightboxSteeringVoice.ts:114–115`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/infrastructure/lightbox/LightboxSteeringVoice.ts#L114-L115); digest use at [`lightboxOpinionItems.ts:344–348`](https://github.com/okeylanders/prose-minion-vscode/blob/2295f9d61bf621fbdb41f9fbe5cd6721a45b199b/packages/core/src/shared/constants/lightboxOpinionItems.ts#L344-L348).

`holdLightboxSteeringVoice` immediately returns an Earns note unchanged. No `voice` marker is recorded, and every downstream surface uses that optional field as the indication of dialogue. The ADR's third addendum says the digest marks the note as the character's voice without limiting this to unfavorable stances.

For `“I’m calm tonight,” she said.`, an otherwise identical Earns note produces only `stance: Earns · figure: Being verbs` in the Opinion and only a Stance point at Bring. Leans and Compensates include the dialogue marker. Independent controls reproduce this distinction for **all three figures**; the rebuilt DOM likewise shows no “In dialogue” line on the Earns note.

**Nonblocking follow-up:** retain the actual narration/dialogue classification separately from nudge-withholding copy, or give Earns an appropriate neutral voice line. Update carry, digest, board/inspector and Bring together. An Earns note already cannot supply a nudge/example, so this is an attribution/metadata omission rather than a rewrite escape.

## Contracts, reader agreement and retained boundaries

Read the live PR and empty discussion, `AGENTS.md` (the central setup symlink), relevant architecture/testing guidance, the Lightbox ADR including D7's second/third addenda, Slice 4F/4G plans, typed messages/budgets, prompt changes and latest #159–#161 house reports. No checkout-local `.agents/skills` directory was present.

- **Detector and offsets:** independent literal controls cover whole forms, straight/curly contractions, all negated forms, *has* lookahead including *had* past adverbs/emphasis, the new next-word rule and its adjective-plus-noun/own/pronoun controls, elided forms, possessives, let's, other suffixes, ma'am, tagger failure and astral/nonbreaking-space prefixes. Returned UTF-16 slices are exact. The detector, figure counts, steering total/partition and accepted instance quote agree on these inputs. A normalized `I'm calm tonight` quote returns the source's exact `I’m calm tonight` and retains the correct voice after relocation.
- **Real baseline consumer:** two synthetic configured chapter files produce **800 being verbs over 3,000 words** through `LightboxWriterBaseline`, excluding the board's own file. A synthetic 800-word board has **400 instances**, **500 per 1,000**, and a **1.875×** ratio to that baseline; its row and steering agree. An unchanged second measure uses the cache; changing one file adds exactly one instance and rereads only that file. No real project files were read.
- **Ordinary voice behavior:** all three figures and all three stances were exercised. Supplied nudges/examples disappear on all-dialogue Leans/Compensates notes; null nudges work there and fail in narration. Moving narration into dialogue suppresses its fields; moving it back does not resurrect the old nudge. British single-quoted speech follows the stated narration behavior. A mixed note keeps its nudge but rejects an example confined to speech. F-02 identifies the cross-boundary exception.
- **Withholding and text safety:** forbidden-word, imperative, numeric and quotation-mark nudges are rejected before contextual suppression. A bad example leaves its valid note/nudge intact. The inherited word-list fence is not a semantic proof against all prescriptions or model claims. No live-model quality/safety conclusion is drawn from synthetic responses.
- **Source ownership:** current-host IDs resolve Bring; the unchanged route checks a file's content hash before preparing it, and stale/rereading tiles remain blocked. A low-level call supplied mismatched board/paragraph snapshots can lack the narration null-nudge gate, but that is not presented as a reachable user-facing defect: the real route supplies the retained board's own paragraphs and rejects changed disk text.
- **Retained fixes:** the #159 passage/navigation implementation and #161 sentence/passages implementation are unchanged; their prior independent correction evidence is reused only after verifying executable equivalence. #160's canonical-example bound still withholds an expanded soft-wrap example while retaining the nudge; current full tests cover its fresh/carry/Bring regressions. The automatic steering measurement remains indexed; F-01 is a different, new example-filter path.
- **No accidental product expansion:** no package/lockfile, schema, minimum-host floor, model routing, spending, persistence or deployment changes are part of this delta. Core remains host-agnostic. New modules fit the repository's size/boundary guidance.

## Rebuilt host evidence and presentation

The supplied state builder was copied to an external test root and run against the actual head with only its output directory selected. The generated **after message and all five fixture figure records are byte-identical** to the committed evidence. This reproduces the Tea-Party change **17 → 26** being verbs, **39.1 → 59.8** per 1,000 and **11/6 → 11/15** narration/dialogue. The worked-example Chapter I opening remains **17**. The added synthetic next-word/*had*/elision fixture has **7** instances on the final head, versus the recorded **1** at base and **3** at the first head; the former ambiguous/omitted forms are not silently treated as unchanged. The full suite also passes the prompt/builder sync and unchanged worked-response checks.

**28 independent exact-bundle DOM assertions** cover before/after counts, three dialogue markers beside one narration nudge/example, note hover's precise ¶7 focus, inspector suppression, IDs-only Bring, the mixed-note example controls, the F-02 rendering witness, N-01's omission, no provider-run message and no source text in persisted state. **349 direct functional assertions** and **11 additional baseline checks** complement the repository suite; witness assertions confirm the reported bad behavior, not approval of it.

Visually inspected the supplied wide steering, narrow steering/inspector and before/after numbers PNGs. Their text and displayed counts match the regenerated state. These are **author-supplied pixels**; the independent renderer run is JSDOM/transport evidence, not fresh browser geometry, screen-reader testing, native VS Code activation or a minimum Chromium 114 runtime pass.

## Verification

| Check | Independent result |
| --- | --- |
| Full head Jest | **458 suites / 6,329 tests / 59 snapshots passed**, 234.215 s |
| Baseline gates | Reused independent #161 integrated-head results: **456 / 6,259 / 59**, typecheck/build pass; verified `c9c9e3a1d` → `1cb417c` differs only in the #161 review report |
| Typecheck | All three projects pass |
| Lint | **0 errors / 1,133 warnings**, identical baseline/head counts by relative file, rule and severity |
| Production build | Pass, including `verify:bundle`; the existing three webpack size warnings |
| `git diff --check` | Clean |
| Host evidence regeneration | One external test passes; exact state/figure byte equality |
| Head implementation CI | [PR run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39672757996) and [push run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39672748641) both successful on `2295f9d` |

Rebuilt `webview.js` SHA-256: `20d3aed38676380185d8e6c680c37a75f33e7be6599038838d709bb95a0472aa`.  
Rebuilt `extension.js` SHA-256: `cc95e6df683f4c218c69e7236a9b9cc0ec016a9fdcc9980ba33967d6be3380ea`.

The author advanced the branch from `ab22ebd` to `2295f9d` before publication. The three-commit delta adds next-word disambiguation after names/nouns, excludes *had* as *has*, adds the elided forms, updates prompts/evidence and replaces a fixture name. It does not change F-01/F-02/N-01's guard/metadata code. The report was held for a final-head source review and fresh gates rather than published against the old implementation.

The worktree's dependency tree was copied from the independently tested #161 worktree after verifying the identical lockfile; its workspace links resolve into this worktree. No implementation, test, dependency or lockfile changes are part of this report publication. Research probes and regenerated artifacts remain outside the report-only diff. Report-head CI is checked separately after publication, not recursively committed into this report.

## Acceptance boundary

Review follows the proposed all-three-figure scope and the disclosed POS/linguistic limits; it does not silently choose the writer's answers to the PR's open questions. The final head deliberately changes the earlier noun/name `'s`, *it's had* and archaic-form decisions; those are reviewed as new behavior, not left listed as old limitations. The declared residual ambiguities (including possessive -ing/adverb phrases, a participle read as *is*, pronoun-followed `'s` and British single-quoted speech) are not promoted into defects merely because a different heuristic is possible. Context-sensitive tagger results are not universal grammatical judgments.

The author-authored decision-26 quotation and real-chapter story are design context, not independently verified writer acceptance. Wider writer checkpoints, native/real-chapter testing and Slice 5's canonical citation-basis/format work remain separate. No private manuscript, paid/live provider call, user computer, formal review/comment, merge, deployment or extension publication was used.

## Author response (2026-10-21)

**F-01: fixed. F-02: fixed. N-01: fixed.** The three fixes are one commit,
`2a1ac93`, on top of your report's commit `350a6eb`; each has its own
tests, and every new behavioural test failed first on an export of your
reviewed head `2295f9d`. The docs commit on top records this response,
the Slice 4G notes, decision 26's ADR addendum, the epic's progress and the
agents guide. Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | A new pure module, `LightboxSpanIndex`, finds each paragraph's instances of a figure (its own detector, tagging included) and its dialogue spans (`findDialogueSpans`) once per text. The index is keyed by the paragraphs array a verifier checks against, and by each paragraph's string, so a changed paragraph is indexed afresh. Every question is a binary search: "some instance inside [a, b]" over instances sorted by start with the least end from each on, and "a dialogue span holds / overlaps [a, b]" over spans with the furthest end so far (the steering measure's own `intervalReach`, moved here and shared). The quote check (`lightboxPatternInstanceFilter`), the voice (`lightboxSteeringInstanceVoice`), the example's narration filter and the anchor's quote-span test all ask it. Offsets and voice semantics are unchanged: a unit test compares every answer with the plain scan for every span of mixed paragraphs | `LightboxSteeringNoteScale.test.ts` (7): detector and matcher calls, and dialogue-span `start` reads, counted through fresh assembly, carry and Bring; linear growth from 250 to 1,000 spans; a 100-paragraph control; a 50,000-word paragraph under a coarse 2 s bound. `LightboxSpanIndex.test.ts` (6): scan equivalence for all three figures, once per text, re-indexing a changed paragraph | `2a1ac93` |
| F-02 | Medium / P2 | **Fixed** | An example's `before` must hold an instance in narration **and** share no character with a dialogue span, quotation marks included (`lightboxSteeringSpeechFilter`, the shared spans). A mixed note keeps its nudge. An example that holds narration but crosses into speech, either way, is withheld alone with a new host reason: "Its example's first part takes in words a character speaks, the character's voice, so it is not shown." At Bring: "Not brought: its first part takes in words a character speaks, the character's voice." An example confined to speech keeps the existing `voice` reason; one confined to narration stands. The prompt's example line now says the same, and the sync test pins it. Figure scope and the mixed-note rule are unchanged | `LightboxSteeringSpokenExamples.test.ts` (7): your witness and its mirror (narration into speech), with straight typography against the chapter's curly, fresh; carried when a stray closing mark becomes a pair, and carried with relocation of a crossing example held before the fix, both ways; Bring for both; controls for an example confined to narration, one confined to speech, and the same words unspoken | `2a1ac93` |
| N-01 | Low / P3 · nonblocking | **Fixed** | `holdLightboxSteeringVoice` keeps the classification apart from the withholding copy. Every note in dialogue now carries a voice line: Earns gets a neutral one, "Its instance is in dialogue, the character's voice.", and keeps its fields. In narration, no line stands, and one drawn before is dropped on carry. The digest, board, inspector and Bring already read `voice`, so all four mark an Earns note in dialogue with no code of their own changing | `LightboxSteeringVoiceRule.test.ts`: an Earns note in dialogue for all three figures, fresh; carry in and out; the digest and Bring for all three. `LightboxAppSteering.test.tsx`: the tile and the inspector. `LightboxSteeringVoice.test.ts`: the field rule | `2a1ac93` |

### How each new test was checked against `2295f9d`

The implementation at `350a6eb` is byte-identical to `2295f9d`; your report
is the only change. Each test file ran on an export of `2295f9d`, with the
worktree's `node_modules`:
- **F-01, `LightboxSteeringNoteScale` (7 tests): all 7 failed.**
  - Four leaning notes with examples on one paragraph of
    `“It’s cold.” It was quiet.` × 250: **13** detector calls and **8**
    dialogue-matcher calls, against 1 and 1.
  - Dialogue-span `start` reads at 250 / 500 / 1,000 spans:
    **376,500 / 1,503,000 / 6,006,000** (four notes; your one-example
    count was 93,875 at 250), against bounds of 1,000 and 4,000.
  - The 100-paragraph control: 13 and 8 calls, against 4 and 4.
  - 50,000 words in one paragraph, four notes: **16,065 ms** under Jest,
    against a 2,000 ms bound.
  - Carry with a new opening paragraph: 18 detector calls and 8 matcher
    calls. Bring: 3 and 2.
- **F-02, `LightboxSteeringSpokenExamples` (7 tests): 5 failed, 2 passed.**
  Fresh kept both crossing examples, and carry and Bring kept and brought
  them, as you found. The two controls passed: an example confined to the
  narration of a mixed quote, and the same words unspoken.
- **N-01: 6 failed.** Five in `LightboxSteeringVoiceRule` (the existing
  fresh test's Earns row, which now expects the line, and the four new
  Earns tests), and the new `LightboxAppSteering` test.
- **The prompt sync test** failed on the new example clause.
- **Two files do not compile there:** `LightboxSteeringVoice.test.ts`
  (it reads the new `earns` line) and `LightboxSpanIndex.test.ts` (the new
  module).

That is 19 failing tests in five files, and two files that do not compile.

### With the fix

| Measure (Jest, this workspace) | `2295f9d` | Head |
| --- | ---: | ---: |
| Detector calls, fresh, four notes, one paragraph | 13 | 1 |
| Dialogue-matcher calls, same | 8 | 1 |
| Span `start` reads at 250 / 500 / 1,000 spans | 376,500 / 1,503,000 / 6,006,000 | 748 / 1,498 / 2,998 |
| 50,000 words, whole words only, four notes | 16,826 ms | 518 ms |
| 50,000 words with `It’s` (tagging), four notes | 18,379 ms | 859 ms |
| Carry, new opening paragraph: detector · matcher calls | 18 · 8 | 1 · 1 |
| Bring: detector · matcher calls | 3 · 2 | 1 · 1 (0 · 0 on the array the reading was assembled on) |

These are Jest times in this cloud workspace, from one run each, not
direct-Node or native VS Code latency; the counts, not the times,
establish the correction. Reads now grow by three per span: one sort pass,
one copy of the starts, one binary search per question.

### F-01: what repeated, and what is now shared

Per note, the reviewed head ran the figure's detector three times (the
quote check's filter, the voice, the example's narration filter) and the
dialogue matcher twice, each filter with its own cache. The narration
filter then ran `dialogue.some` from the start for every instance. Now:
- one detection and one dialogue match per paragraph per text, shared by
  every check in fresh assembly, carry and Bring;
- every membership question is a binary search;
- the anchor's "inside one of the quote's spans" test, which scanned every
  place the quote stands, is a binary search too.

The index lives with the paragraphs array: a run's verifier, a carry's,
and Bring's each have their own text. Bring reads the board's retained
`paragraphTexts`, so repeated Brings of one board reuse it. A paragraph
changed in place is indexed afresh, never answered from its old string.

### F-02: the example takes in no speech

The question the anchor asks changed from "holds an instance in narration"
to "holds an instance in narration and overlaps no dialogue span". On a
miss, the fault says which rule failed: `speech` when a span holding
narration crossed into speech, `voice` when only a spoken instance was
held, `unanchored` otherwise. The note's classification is untouched: a
quote holding narration is a narration note, keeps its nudge, and the gate
still withholds a leaning narration note with no nudge.

### N-01: the line marks the voice

The line is the marker every surface reads, so each stance now gets one in
dialogue. For Leans and Compensates it is still the withholding copy; for
Earns it is the neutral one. Carry drops a line once the instance stands
in narration (for Leans and Compensates the gate withholds the note there
anyway, so nothing visible changes for them).

### Changed expectations

- `LightboxSteeringVoiceRule`, fresh: the Earns intensifier note in
  dialogue now shows "Its instance is in dialogue, the character's voice."
  instead of no line (N-01).
- `LightboxSteeringVoice`: the reasons gain `earns`; holding an Earns note
  in dialogue returns its fields with that line, not the same object.

### Evidence

The evidence holds no Earns note and no crossing example, so it does not
move. The state builder at the head writes `states/after.json` and
`figures-after.json` byte-identical to the committed files. `webview.js`
is unchanged (`20d3aed3…`), so the committed PNGs stand.

### Verification of the head

All gates ran on the fix after `npm ci` into the worktree's own
`node_modules`.

| Check | Result |
| --- | --- |
| Full Jest | **461 suites / 6,354 tests / 59 snapshots passed**: your reviewed head ran 458 / 6,329 / 59; this response adds 3 suites and 25 tests |
| Lint | **0 errors / 1,133 warnings**, identical per file and rule to `1cb417c` |
| Typecheck | Passed all package stages |
| Build and `verify:bundle` | Passed; the same three webpack size warnings |
| `webview.js` SHA-256 | `20d3aed38676380185d8e6c680c37a75f33e7be6599038838d709bb95a0472aa` (unchanged) |
| `extension.js` SHA-256 | `6fffedac89ad2e544aca8695353567e0461e6d7cb366bcd04c7ea8a6bd4f069d` |
| `git diff --check origin/epic/lightbox` | Clean, except your report's Markdown hard line breaks, which are its own |

No live or billable provider call; no writer's text.

### Not done here

- **Writer, native and live-provider acceptance** remain open, as you said.
- **The numbers lens's own sentence-length and dialogue filters** still
  recompute their paragraph's sentences or spans per candidate span. They
  predate this PR and are not on the steering path, so they are left as
  they are and tracked as
  [tech debt](../../.todo/tech-debt/2026-10-21-lightbox-numbers-filters-per-span.md).
