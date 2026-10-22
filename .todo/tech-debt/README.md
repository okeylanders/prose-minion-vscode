# Technical Debt

This directory contains active, concrete maintenance concerns that are not part
of the current feature scope. Resolved items belong in
`.todo/archive/tech-debt/`.

## What Belongs Here

A debt item should identify:

- A specific design or maintenance problem
- Current evidence in the repository
- The smallest credible improvement
- Risks and tradeoffs
- Related files or tests
- A status and review date

Feature requests, speculative redesigns, and completed sprint plans belong
elsewhere.

## Document Template

```markdown
# Descriptive Title

**Date Identified**: YYYY-MM-DD
**Reviewed**: YYYY-MM-DD
**Status**: Identified | In Progress | Deferred | Resolved
**Priority**: High | Medium | Low
**Estimated Effort**: ...

## Problem

## Recommendation

## Related Files

## Completion Criteria
```

## Workflow

1. Confirm the problem still exists in the current codebase.
2. Update stale paths, assumptions, and scope before scheduling work.
3. Prefer a focused debt item over a broad “clean up this area” instruction.
4. Implement on an isolated branch with relevant verification.
5. Mark the document resolved and move it to `.todo/archive/tech-debt/`.

## Active Inventory

| Priority | Item | Status |
|---|---|---|
| Medium | [Settings integration tests](2025-11-06-settings-integration-tests.md) | Deferred |
| Low | [Large-file responsibility review](2025-11-19-large-file-review-needed.md) | Deferred |
| Low | [AIResourceOrchestrator loop duplication](2025-11-25-ai-resource-orchestrator-loop-duplication.md) | Identified |
| Medium | [Streaming lifecycle duplication](2025-12-05-streaming-hook-duplication.md) | Identified |
| Low | [AI service refresh duplication](2026-06-26-ai-service-refresh-duplication.md) | Identified |
| Low | [Secret-change key filtering](2026-06-26-secret-change-key-filtering.md) | Identified |
| Low | [MessageHandler self-heal cleanup](2026-06-26-messagehandler-self-heal-cleanup.md) | Identified |
| Low | [Word Search defaults product decision](2026-06-29-word-search-defaults-product-decision.md) | Deferred |
| Low | [TypeScript project references](2026-06-29-typescript-project-references.md) | Deferred |
| Low | [Logging and AI alias modernization](2026-06-29-logging-and-ai-alias-modernization.md) | Deferred |
| Low | [App-side VS Code Jest mock](2026-06-29-app-side-vscode-jest-mock.md) | Deferred |
| Low | [Manuscript read and boundary guard performance](2026-06-29-manuscript-read-and-boundary-guard-performance.md) | Deferred |
| Low | [Build command gate semantics](2026-06-29-build-command-gate-semantics.md) | Deferred |
| Low | [Workshop bounded turn packer](2026-07-14-workshop-bounded-turn-packer.md) | Deferred |
| Medium | [Persona prompt/validator contract drift](2026-07-26-persona-prompt-validator-contract-drift.md) | Open |
| Was critical | [Workshop god files](2026-07-25-workshop-god-files.md) | Resolved — freeze decision pending |
| Medium | [Widget recommendation prompt assembly](2026-07-31-workshop-widget-recommendation-prompt-assembly.md) | Deferred |
| Low | [Filesystem missing-file error contract](2026-07-27-filesystem-missing-error-contract.md) | Partially mitigated |
| Low | [Widget-config counter integrity validation](2026-07-31-widget-config-counter-integrity.md) | Identified |
| Low | [Persistence coordinator ownership](2026-10-01-workshop-persistence-coordinator-ownership.md) | Deferred |
| Low | [Browser lists an unreadable session](2026-10-01-workshop-browser-lists-unreadable-session.md) | Identified |
| Medium | [Dictionary suggested-book reliability](2026-10-02-dictionary-suggested-book-reliability.md) | Identified |
| Low | [Writing Tools overview image](2026-10-02-writing-tools-overview-image.md) | Identified |
| Medium | [Release dependency audit](2026-10-02-release-dependency-audit-follow-up.md) | Deferred |
| Low | [Mark grouping allocation](2026-10-02-workshop-mark-grouping-allocation.md) | Identified |
| Low | [Rewind and Branch notice screenshot](2026-10-01-workshop-rewind-and-branch-notice-screenshot.md) | Identified |
| Low | [Session preview can show capability evidence](2026-10-05-workshop-session-preview-may-show-evidence.md) | Identified |
| High | [A guest's to-do makes the room unsavable](2026-10-06-workshop-guest-todo-unsavable.md) | Identified |
| High | [Show vs. Tell interactive smoke test](2026-10-09-show-vs-tell-interactive-smoke-test.md) | Open |
| Medium | [Show vs. Tell live-provider quality pass](2026-10-09-show-vs-tell-live-provider-quality-pass.md) | Open |
| Low | [Persona pronoun metadata](2026-10-09-persona-pronoun-metadata.md) | Open — writer decision |
| Medium | [Thread artifacts replay on every later turn](2026-10-11-workshop-thread-artifact-history-replay.md) | Identified |
| Low | [Transcript export mirror misstates the cascade order](2026-10-19-transcript-export-mirror-cascade-order.md) | Identified |
| Low | [Shared full-tab frame classes keep the Workshop prefix](2026-10-19-fulltab-frame-class-prefix.md) | Identified |
| Medium | [A missing relative path silently measures the active editor's file](2026-10-19-text-source-active-editor-fallback.md) | Identified |
| Low | [Part-of-speech lists count contraction fragments](2026-10-19-pos-tagger-token-fragments.md) | Identified |
| Medium | [Lightbox readings have not met a live provider](2026-10-19-lightbox-live-provider-pass.md) | Deferred (Lightbox Slice 6) |
| Low | [A Lightbox reading in flight when the chapter changes is dropped](2026-10-19-lightbox-forward-in-flight-readings.md) | Identified |
| Low | [One home for the Lightbox reading codec's field decoders](2026-10-19-lightbox-codec-shared-field-decoders.md) | Identified |
| Low | [The engine logs a provider's error type verbatim after an interrupted stream](2026-10-19-agent-run-engine-provider-error-log.md) | Identified |
| Medium | [A long unbroken run of word characters stalls word frequency for minutes](2026-10-19-pos-tagger-long-token-backtracking.md) | Identified |
| Low | [Lightbox run accounting on its exceptional paths](2026-10-19-lightbox-exceptional-path-accounting.md) | Identified |
| Low | [Dialogue % ignores single-quoted dialogue](2026-10-19-dialogue-single-quote-convention.md) (also withholds Lightbox subtext pairs in single-quoted text) | Identified |
| Low | [The Workshop does not reflow at narrow widths](2026-10-19-workshop-narrow-width-reflow.md) | Identified |
| Low | [A seed offer the Workshop refuses only times out](2026-10-19-workshop-refused-seed-offer-times-out.md) | Identified |
| Low | [A carried said line does not follow speech that moved past narration](2026-10-20-lightbox-carried-said-line-moved-speech.md) | Identified |
| Low | [The shared project picker still leans on Workshop-named seams](2026-10-20-shared-picker-workshop-named-seams.md) (the modal shell's folder, the catalog service's name) | Identified |
| Low | [The configured catalog lists only one of two same-named files across workspace folders](2026-10-20-context-catalog-cross-root-collapse.md) (older than PR #154; found in its F-02 review) | Identified |
| Low | [A maximal group D response can exceed the per-group response cap](2026-10-20-lightbox-group-d-response-ceiling.md) (Lightbox Slice 4B) | Identified |
| Low | [A maximal group E response can exceed the per-group response cap](2026-10-20-lightbox-group-e-response-ceiling.md) (Lightbox Slice 4C; artifacts is the long block) | Identified |
| Low | [The Opinion's digest leaves readings out in board order](2026-10-21-lightbox-opinion-digest-board-order-cut.md) (Lightbox Slice 4D; a board over the bound loses group E first) | Identified |
| Low | [The word-pattern figures miss a form wrapped in underscore emphasis](2026-10-21-lightbox-word-patterns-miss-underscore-emphasis.md) (Lightbox Slice 4F; `_was_` counts nowhere, consistently) | Identified |
| Low | [Craft steering's construction breakdown is a next-word heuristic](2026-10-21-lightbox-steering-construction-heuristics.md) (Lightbox Slice 4F) | Identified |
| Medium | [Several Lightbox modules sit just under the 500-line limit](2026-10-21-lightbox-modules-near-size-limit.md) (Lightbox Slice 4F, with 4E merged; reviewed after 5A.1, which split the barrel and the store's rewrites out) | Identified |
| Low | [A reopened board's passages are found by today's rules](2026-10-22-lightbox-reopened-passages-use-todays-rules.md) (Lightbox Slice 5A; matters once a rule id changes) | Identified |
| Low | [A steering example of one short form cannot anchor, and its reason misleads](2026-10-21-lightbox-steering-short-example-forms.md) (PR #160 review) | Identified |
| Low | [Craft steering's counts do not open the inspector's sentence well](2026-10-21-lightbox-steering-sentence-well.md) (a follow-up from merging Slice 4E into 4F) | Identified |
| Low | [A lone straight quote counts as a word in the vocabulary figures](2026-10-21-prose-stats-punctuation-only-words.md) (PR #161 N-01; inherited; the sentences well now shows such a word outside any sentence) | Identified |
| Low | [The numbers lens's sentence and dialogue filters recompute per candidate span](2026-10-21-lightbox-numbers-filters-per-span.md) (found fixing PR #162 F-01; older than it; not on craft steering's path) | Identified |

## Review Guidance

- Review active debt when nearby code changes, not merely on a calendar.
- Archive completed and superseded documents promptly.
- Do not treat line count, abstraction count, or test coverage percentage as a
  defect without a concrete failure mode.
- When a broad item produces a specific actionable concern, split out the
  focused concern and narrow the parent document.

## Recently resolved

- [A spark set aside is saved only with the board's next save](../archive/tech-debt/2026-10-22-lightbox-spark-set-aside-saves-later.md): a set-aside, and its Undo, now rewrite the file that holds the board in place, with no new file (epic decision 35; Lightbox Slice 5A.1, 2026-10-22).

- [The Boards rail drops focus after a confirmed delete](../archive/tech-debt/2026-10-22-lightbox-boards-rail-focus-after-delete.md): focus moves to the next row's Delete, or the head's Name or Rename, once the row goes; a restore whose file is gone forgets the reload pointer (Lightbox Slice 5A.1, 2026-10-22).

- [The Opinion's citation basis hashes the digest's wording](../archive/tech-debt/2026-10-21-lightbox-opinion-basis-is-rendered-text.md): a citation's basis now hashes the cited item's canonical data, and every board records the basis rule's id (epic decision 25; Lightbox Slice 5A, 2026-10-22).

- [A closing quotation mark after a sentence's end counts as a sentence](../archive/tech-debt/2026-10-21-prose-sentences-closing-quote.md): a sentence now keeps the closing marks written directly after its end, and a lower-case speech tag continues its speech's sentence ([ADR 2026-10-21](../../docs/adr/2026-10-21-sentence-closing-marks.md); `epic/lightbox-sentence-rule`, 2026-10-21).

- [Webview CSS uses features above the declared Chromium 102 floor](../archive/tech-debt/2026-10-21-webview-css-above-chromium-102.md): the writer raised the floor to VS Code 1.82 (Chromium 114); scrollbar styling and `text-wrap: pretty` stay as graceful exceptions ([ADR 2026-10-21](../../docs/adr/2026-10-21-vscode-engine-floor.md), 2026-10-21).

- [Lightbox readings vanish when the chapter changes](../archive/tech-debt/2026-10-19-lightbox-stale-readings.md): readings carry onto the changed chapter, stale and re-checked (Lightbox Slice 3, 2026-10-19).

- [Rewind and Branch main smoke](../archive/tech-debt/2026-10-01-workshop-rewind-and-branch-main-smoke.md): all checks confirmed by Okey on 2026-10-02.

- [Rewind and Branch release preparation](../archive/tech-debt/2026-10-01-workshop-rewind-and-branch-release-preparation.md): v2.7.0 published on 2026-10-02.
