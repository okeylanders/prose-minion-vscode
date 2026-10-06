# PR Review — Workshop session recall to-dos (Slice 2B)

**Author:** okeylanders · **PR:** [#127](https://github.com/okeylanders/prose-minion-vscode/pull/127) (open at review)
**Branches:** `claude/workshop-recall-todos` → `epic/workshop-session-recall`
**Verified base / merge-base:** `5eede3218cc2a282c2e8a8f115ae113320f8327a`
**Reviewed code head:** `6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081`
**Scope:** 26 files · +2,226 / −168 · 10 commits
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review, with three independent specialist passes (projection/matching/domain semantics; renderer/bounds/provenance; service/scope/concurrency), integration review, adversarial reproductions, and full automated verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | The to-do renderer claims every `<match>` term matched while silently ignoring terms after the eighth | A valid 54-character request returns three tasks from a session that does not match `lighthouse`, then describes the complete nine-word request as “every term” | **Open**. Fixed by the author in `f6c3bef` (see the author response below); awaiting re-review |
| F-02 | 🔵 Nit | Sessions whose matching tasks were omitted by the item limit are counted as having no to-do to show | Four scanned sessions with 60 newer tasks and five older tasks produce “3 scanned sessions had no to-do to show” alongside the five-item omission notice | **Open**, nonblocking. Fixed by the author in `84b1977` (see the author response below); awaiting re-review |

**Verdict at `6ea1f0c`: Request changes for F-01 before integrating Slice 2B.** Its result text overstates the session-selection guarantee for an ordinary valid request, violating the explicit disclosure contract. F-02 is lower-priority misleading omission wording. No Blocking or High finding, newly demonstrated privacy breach, data corruption, scope regression, or output-cap failure was established. This remains a **dormant core**, not a claim about a currently enabled persona capability.

## Author response (`f6c3bef`, `84b1977`)

These are the author's claims, offered for re-review. They are not verified findings.

**F-01 ([`f6c3bef`](https://github.com/okeylanders/prose-minion-vscode/commit/f6c3bef)).** Disclosure only; D8's matching rule is unchanged.

- The filters line now names the terms `<match>` was evaluated on and, when there are more than eight, the terms it never evaluated. It mirrors search's wording:

  > Filters: title or excerpt label matching “alpha beta gamma delta epsilon zeta eta theta lighthouse” (terms: alpha, beta, gamma, delta, epsilon, zeta, eta, theta; every evaluated term matched; not evaluated, past the eight-term limit: lighthouse).

- With overflow, all-terms reads “every evaluated term matched”. Without it, “every term matched”. The any-term and no-match wordings gain the same terms and overflow parts.
- **Witnesses.** The review's reproduction runs through the real store: `store.renameNamed()` to eight words, then a 54-character, nine-term match. It covers all-terms, any-term fallback, and no match, and each must name `lighthouse` as not evaluated. A fourth witness pins the no-overflow wording.
- **Bounds.** Each term list is bounded at 300 characters with a count of the rest. The cap sweep now carries forty distinct 300-character terms. At every cap it asserts that the output stays within the cap and that the filters line survives whole, overflow disclosure included, never “[filters shortened]”.
- **Header cap unchanged.** The 1,500-character cap stays because the measured worst case is about 1,310 characters. That case has every filter at the largest its type allows: `<source>` and `<persona>` are closed-list ids. Lowering the cap to 1,200 fails the sweep.

**F-02 ([`84b1977`](https://github.com/okeylanders/prose-minion-vscode/commit/84b1977)).**

- `WorkshopRecallTodosBounds` gains `sessionsWithoutMatchingTodos`. Selection counts it before `todoItems` applies: a scanned session none of whose to-dos the source and status filters admitted.
- The footer uses that count and reads “had no to-do matching the filters”. `omittedByItemLimit` stays separate.
- **Witness.** It follows the review's normal-use reproduction at the default budgets. A newer room promotes 60 findings from 20 real host replies beside the corpus's five open to-dos, saved through the real coordinator and store. The service reports `sessionsScanned: 4`, `omittedByItemLimit: 5`, `sessionsWithoutMatchingTodos: 0`. The default-cap rendering shows 60 to-dos with no character omission and says only “5 more to-dos past the 60-item limit.” With `status: completed`, three sessions really have none and are reported as such.

**Mutation check.** Each fix was reverted against the new witnesses:

- F-01: dropping the overflow disclosure fails four witnesses, and printing “every term matched” despite overflow fails one.
- F-02: putting back the derived count fails two, and counting after the cap instead of before fails two.

**Verification at `84b1977`:**

- Full suite on Node 22.22.0 and Node 18.20.8: **256 suites / 3,271 tests** (3,265 at the reviewed head, plus six witnesses).
- `npm run typecheck`, `npm run build` (including `verify:bundle`), ESLint on the six changed TypeScript files, and `git diff --check` are all clean.

## F-01 — Disclose ignored `<match>` terms

**Evidence:** [WorkshopRecallTodoList.ts:169–177](https://github.com/okeylanders/prose-minion-vscode/blob/6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081/packages/core/src/application/services/workshop/recall/WorkshopRecallTodoList.ts#L169-L177), [query parsing at WorkshopTranscriptRecallSearch.ts:104–115](https://github.com/okeylanders/prose-minion-vscode/blob/6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallSearch.ts#L104-L115). **Confidence: High.**

`<match>` deliberately shares search's tokenizer and eight-term ceiling. The parser returns the retained `terms` and the omitted `overflowTerms`; the service preserves both in `result.match.query`. The new renderer quotes the complete request and prints “every term” when the retained eight match, but never discloses overflow. The existing [search renderer at :138–141](https://github.com/okeylanders/prose-minion-vscode/blob/6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallRenderer.ts#L138-L141) already states which terms were not searched.

Independently reproduced using the real saved-session fixture, store, service, and renderer:

1. Create the ordinary `saveTodoCorpus()` fixture and rename its first saved session through `store.renameNamed()` to `alpha beta gamma delta epsilon zeta eta theta`.
2. Call `todos({ match: 'alpha beta gamma delta epsilon zeta eta theta lighthouse' })`. This request is **54 characters**, comfortably inside `todoMatchCharacters: 200`; no malformed input or edited checkpoint is required.
3. The result contains that session's three open to-dos, `mode: 'all-terms'`, and `overflowTerms: ['lighthouse']`.
4. Rendering produces:

   > Filters: title or excerpt label matching “alpha beta gamma delta epsilon zeta eta theta lighthouse” (every term).

   Neither the title nor the excerpt label contains `lighthouse`, and the output never says that this term was ignored.

The issue is **disclosure, not the accepted eight-term matching policy**. Once this evidence is wired to a persona, it can confidently attribute tasks to a session-selection condition that was never evaluated. An independent regression assertion requiring an ignored-term notice fails at this head; the same probe verifies the selected session and overflow metadata first.

**Suggested correction:** expose the effective terms and any ignored terms in the to-do result text, bounded consistently with the header. Qualify “every term” as every evaluated term when overflow exists. Reuse the established search disclosure semantics without changing D8's matching rule. Carry the same rule into the forthcoming catalog `<match>` consumer.

**Regression witness:** more than eight distinct non-stopword terms, still below 200 characters, with the ninth word absent from all session labels. Cover all-terms, any-term fallback, and no-match outcomes, and retain the complete-output cap assertions.

## F-02 — Separate item-cap omissions from empty filtered sessions

**Evidence:** [WorkshopRecallTodoList.ts:241–255](https://github.com/okeylanders/prose-minion-vscode/blob/6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081/packages/core/src/application/services/workshop/recall/WorkshopRecallTodoList.ts#L241-L255), [WorkshopRecallCorpusSelection.ts:212–236](https://github.com/okeylanders/prose-minion-vscode/blob/6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081/packages/core/src/application/services/workshop/recall/WorkshopRecallCorpusSelection.ts#L212-L236). **Confidence: High; priority: Low.**

`result.sessions` includes only sessions that retain a to-do **after** the global 60-item limit. Subtracting its length from `sessionsScanned` therefore combines genuinely empty/source-or-status-filtered sessions with sessions whose matching tasks were removed only by the cap. The footer labels the whole difference “had no to-do to show.”

The stronger independent reproduction uses only normal domain operations: start with the three real saved sessions in `saveTodoCorpus()` (five open tasks altogether), create a newer room, promote **60 distinct findings from 20 real host replies**, and save it through the real coordinator/store. No persisted JSON is edited. The service correctly reports `sessionsScanned: 4` and `omittedByItemLimit: 5`. At the **default 16,000-character cap**, rendering is **11,701 characters**, shows all 60 newer tasks, and has **zero character omissions**, but says both:

> 3 scanned sessions had no to-do to show.
>
> 5 more to-dos past the 60-item limit.

Querying each older session directly returns its open tasks. The same accounting defect was first isolated with an accepted edited-file fixture; the normal aggregate/coordinator witness establishes that no external checkpoint editing is necessary.

**Suggested correction:** count genuinely empty filtered sessions before applying the item cap, or use wording that states these sessions contributed no items to this bounded response. Keep `omittedByItemLimit` separate. Add a cross-session cap witness rather than relying only on a hand-built result object.

This is a nit because the adjacent five-item limit notice still discloses that the answer is incomplete, and the items remain available to a narrower session request. It is not data loss or a hidden live failure.

## Review observations and strengths to preserve

- **Explicit visibility projection.** Each recalled to-do is constructed field by field. `findingKey`, `findingText`, and `writerEdit` do not enter the data object or rendered evidence. Current wording, status, priority, source kind and label, tool/persona identity, source turn ID/ledger position, excerpt version, staleness, and creation time follow D5. The tests use real promotion, editing, completion, dismissal, persistence, and rewind paths. Their hidden-field and transcript sentinels passed independently.
- **Formal to-dos have clear semantics.** Open includes stale items under D7. Staleness compares the promotion version with the saved session's final excerpt version, including after rewind; ledger positions count omitted transcript entries. Source filtering precedes status filtering, then the item limit, so per-item omission counts are mutually attributable. Session/persona/match narrowing precedes `<recent>`, and sessions without selected tasks still spend that session allowance, as documented.
- **Matching and indexing stay deliberately narrow.** The shared matcher uses listing title and excerpt label, never context bodies or transcript text. Unicode folding, prefix matching, all-terms preference, fallback, and input ordering agree with the existing search policy in the inspected paths. Tool replies add their visible speaker to indexed text; persona names do not become ubiquitous reply matches. Snippets remain visible body text.
- **Scope and read-only seams survive the extension.** `todos()` runs through the same `withCorpus`, listing checks, pre/post cold-read validation, cache generations, and final scope validation. It has no mutation port and does not initialize or flush the room. Focused adversarial probes confirmed cross-operation cache sharing, `updatedAt` refresh, cached live-room exclusion, invalidation on a failed read plus scope change, and rejection of old-generation cache publication.
- **Read costs remain honestly bounded under the accepted model.** Failed reads spend the existing conservative 25 MiB charge; cached documents remain free even after the cold-byte budget is exhausted. Projected to-dos join the serialized cache-character charge. The service refactor from individual cost fields to one record preserves search accounting in the inspected diff and passing tests.
- **Output caps and provenance held.** The renderer reserves bounded header/footer space and admits each item's text and metadata together. Every shown item carries its session/to-do ID pair, and returned `shown`/`notShownForSpace` accounting matched the text. Existing tests exercise oversized persisted metadata and the 5,505-character minimum; the independent packing sweep covered supported caps from 5,505 through 29,913 with no cap or progress failure. The shared-copy extraction preserves prior framing, dates, and refusals, with the intended refusal-ID clipping improvement.
- **Architecture remains contained.** The twelve recall production modules stay below the repository's 500-line threshold. The new modules join the boundary guards; no composition-root wiring, capability operation, persistence-enum widening, prompt enablement, or provider call was added.

## Verification actually run

All production-code checks target **`6ea1f0c6e624e444b8bbf03f63e1b8dbc400a081`**, before this documentation-only report. Local runtime: **Node v24.19.0 / npm 11.9.0**. Installed dependencies were copied from the existing cloud checkout after a byte-identical lockfile comparison; no fresh local `npm ci` was run.

| Check | Result |
| --- | --- |
| Live PR metadata, local merge-base, and remote refs | Matched the reviewed base/head; open, non-draft, mergeable, targeting the epic branch |
| Existing PR discussion/review timeline | No comments or reviews returned at review start |
| Full Jest suite | **256 suites / 3,265 tests / 2 snapshots passed**, 87.288 seconds; independent `.probe.ts` files excluded |
| `npm run typecheck` | Core, webview, and extension passed |
| ESLint over all 21 changed TypeScript files | **0 errors / 0 warnings** |
| Full repository ESLint, excluding review probes | Exit 0; **0 errors / 1,097 warnings**; baseline branch lint was not rerun, so no warning-delta claim |
| `npm run build` | Both production bundles and `verify:bundle` passed; three webpack size/performance warnings, 1.24 MiB webview bundle |
| `git diff --check 5eede321...6ea1f0c` | Passed |
| Independent domain/projection/search pass | Five focused suites / 87 tests passed; F-01 regression expectation fails on missing disclosure, independently rerun during consolidation |
| Independent renderer pass | Both F-02 actual-output probes passed, including normal promotion/save at default cap; 217 supported-budget renders passed bounds, progress, and item-accounting checks |
| Independent service/concurrency pass | Seven adversarial checks passed, including six cross-operation/scope/cache cases and one characterization of an unchanged base cancellation edge; no new service defect established |
| Exact reviewed-head GitHub CI | Both CI runs successful: [PR run 37395546473](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37395546473), [push run 37395542364](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37395542364) |

Focused suites overlap the full suite. A probe that asserts the observed defect is a reproduction, not proof that the defect is fixed. F-01's desired-behavior assertion fails; the unmodified repository suite passes. Review probes and generated bundles are not part of the report commit.

The author's Node 18/22 local runs and mutation-test counts were not independently repeated. Current GitHub CI uses Node 18 and passed on the exact reviewed code head. No paid provider calls, Extension Development Host interaction, visual/UX pass, VSIX packaging, release, merge, or branch deletion was performed.

## Scope boundaries and next verification

Governing material included `AGENTS.md`, repository engineering guidance, the full production/test delta, the [recall ADR](../adr/2026-10-05-workshop-session-transcript-recall.md), [epic](../../.todo/epics/epic-workshop-session-recall-2026-10-05/README.md), [Slice 2B plan](../../.todo/epics/epic-workshop-session-recall-2026-10-05/slice-2b-transcript-todos.md), real store/codec/ledger paths, nearby transcript consumers, house-format review examples, and CI configuration. No checkout-local `.agents/skills` directory was present. Prior PR verdicts were not used as evidence for this review.

This slice supplies the **formal saved to-do** half of questions such as “what's left from chapter 6-7.” It does not infer tasks from arbitrary chat prose. `<match>` is lexical title/excerpt-label discovery; a tool pass mentioned only in a transcript still needs search and a session-targeted to-do request. Catalog matching, multi-session/fair-share transcript reads, discussion-detail summaries, and the 150K read budgets are explicitly **Slice 2C**. Codec/persistence/capability wiring and model-window accounting are Slice 3; prompt enablement is Slice 4; live acceptance is Slice 5. Their absence is not a defect against 2B.

The known guest-to-do save failure is inherited and separately tracked in [the new tech-debt record](../../.todo/tech-debt/2026-10-06-workshop-guest-todo-unsavable.md). The guest source witness remains synthetic; this review does not claim guest-promotion/save round-trip acceptance. The prior slice's documented legacy-listing work, approximate cold-byte accounting/one-file overshoot, and host-lifecycle scope limitations also remain qualifications, not newly introduced findings.

**Next action:** correct F-01 with a bounded overflow-disclosure regression, consider F-02's omission wording, then rerun verification at the new head. This review publishes only this report under `docs/pr-reviews`. Publication changes the PR head, so its resulting report-only commit requires a separate exact-commit CI check before any integration; no implementation fix or merge is part of this review.
