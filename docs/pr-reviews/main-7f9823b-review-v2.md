# Main Release Review v2 — Workshop cuts, Craft Steering, and Dictionary topics

**Author:** okeylanders · **Ref:** `main` · **Head:** `7f9823bea23fd7a1e4571f0be856faa20b2ac5f9`
**Baseline:** `v2.6.2` · **Reviewed:** 2026-10-02, America/Chicago
**Mode:** Full ten-lane Forge panel after four runway scout passes, followed by Sensei; focused causal coverage of a large release delta.

## Resolution ledger

Open means act before publication; Deferred names an existing or recorded follow-up. These are release review observations, not two new code defects.

| ID | Severity | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | High | Required Workshop smoke evidence remains unrecorded | Oliver | Runway-prompted | — | **Addressed** — Okey confirmed all checks performed on 2026-10-02; memory-bank and plans updated |
| F-02 | Standard | Mark verification recopies each growing participant bucket | Tim | Independent | — | **Deferred** — no current-scale user latency established; Low-priority follow-up recorded |

## Review coverage

Release delta: 163 files, +14,558/-423. Untracked v2.2.1 memory-bank records and `Prose Minion.zip` were excluded and preserved. No source, version, branch, or release-state mutation was performed.

- Reviewed causal paths: retained mark recording/validation, scalar rewind policy, pure room/archive transform, coordinator export/install/rollback and persistence authority, atomic store commitment seam, mutation routing, composer/widget restoration, nested titles, Craft Steering registrations/prompts/fallback/save names, Dictionary option forwarding/prompt composition/block selection/accounting/diagnostics.
- Reviewed tests: canonical room oracle and non-vacuity rules, real-engine multi-round history integration, fault-injected Rewind/Branch transactions and late source races, policy/mark integrity and hydration, feature wiring/selection/fallback/transport tests. Remaining test/document/resource diff content was sampled; the whole test suite was executed.
- Resource coverage: all 172 packaged core resource files checked byte-for-byte, with no missing/mismatched files. Source-text evaluation concentrated on new/changed prompts, not every unchanged craft guide.
- Intent/history: governing project instructions, rewind/codec ADRs, feature plans, prior PR #117/#118/#119/#120/#122 reviews and their recorded resolutions. The complete changed-file manifest is included below.
- Not established: interactive Extension Host behavior, live provider output quality, visual/theme/accessibility smoke. Repository records remain pending and an asynchronous user question has no answer at report time.

## Verification actually run

| Check | Result |
| --- | --- |
| GitHub CI, exact reviewed main head | Passed — [run 37066531150](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37066531150) |
| `npm run typecheck` | Passed: core, webview, extension |
| `npm test -- --runInBand` | Passed: 230 suites / 2,784 tests / 2 snapshots |
| `npm run lint` | Passed: 0 errors / 1,037 warnings; no baseline warning delta claimed |
| `npm run build` | Passed: production bundles and Tailwind sentinels; 3 webpack size warnings and aged Browserslist data |
| `git diff --check v2.6.2..main` | Passed |
| VSIX packaging | Passed: 197 files / 11.3 MB; review-only artifact `/tmp/prose-minion-main-review.vsix` |
| ZIP resource/source inspection | 172 resources identical; no `.ts`, `.tsx`, or `.map` files; Craft Steering included |

Local Node v23.10.0 / npm 10.9.2; existing dependencies used. CI uses Node 18. The review VSIX still carries 2.6.2 because version preparation was outside this review; it is not a newly versioned release artifact. Initial sandboxed GitHub access failed; an authorized read-only retry verified current CI. No dependencies installed, billable provider requests, commits, tags, PRs, or publication.

---

# Part I — Semantic Runway


Author: okeylanders. Baseline: v2.6.2. Review date: 2026-10-02 America/Chicago.
Blast radius: 163 files, +14,558/-423; new retained-memory cut workflows, one analysis focus, optional Dictionary expansion, typed transport/presentation changes, prompt resources and extensive proof. Evidence and verification are summarized above; the diff is reproducible with `git diff --find-renames v2.6.2..7f9823be` and the complete manifest is included below.

## 1. Working Definition & Real Job

[Declared] Main adds Rewind, Edit from here, and Branch from here; Craft Steering; and Dictionary Topic & Related Lexicon. The real Workshop job is allowing a writer to change conversational direction while keeping participant memory consistent with the selected point. A competing interpretation would be full workspace time travel; the ADR explicitly retains current excerpt/context, so that interpretation does not describe this product (rewind ADR §§1–2).

The release's real job is repeatable conversational exploration while preserving exact retained memory and saved source authority.

## 2. Declared Intent, Observed Behavior & Open Meaning

[Observed] The changelog, feature plans, typed routes, and UI implement the three additions. Main remains version 2.6.2 with Unreleased entries; this review precedes version preparation. Earlier PR reviews approve integration while explicitly distinguishing live-model and host evidence. Current automated verification is fresh on the integrated head. [Unknown] The repository's seven pending smoke rows may lag testing performed by Okey outside the recorded work.

## 3. Business Story & Rulebook

The writer chooses a historical bubble. Assistant cuts keep the chosen reply; writer cuts remove that message and restore an editable draft. Rewind confirms its removal count. Branch first requires a saved, clean source, then creates a new named session and opens it. Both retain current working materials. Host policy refuses busy/unproven points, earlier unsupported history, and cuts across the latest standing-directive change (WorkshopRewindPolicy.ts).

Plain writer drafts restore composer text/attachments; widget drafts reopen the released config and retain the selected addressee. Source files survive Branch unchanged. A saved branch that cannot open remains available and is named in the partial outcome. New identities/timestamps distinguish sessions; branch labels increment suffixes but do not imply lineage (WorkshopSessionTitles.ts; WorkshopSessionBranch.ts).

Craft Steering offers evidence-grounded sound/rhythm/transition critique with controlled revision experiments, preserving deliberate repetition and pauses. Dictionary's persisted switch defaults on; standard, Fast, and context-menu requests honor it, while persona capabilities explicitly omit it. Only Fast's selected Topic block receives the larger budget (feature plans; DictionaryService.ts).

## 4. Narrative Flow: Beginning, Development, Turn & Ending

Beginning: a settled live room and eligible bubble. Development: typed request, host revalidation, coherent aggregate/archive export, pure cut, installation under new runtime conversation IDs. Rewind's ordinary turn is the authoritative named/current write. Branch's first turn is the new named file; its second is replacing current.json after read-back and source verification. Ending: snapshot, draft/widget restoration, truthful action result, retirement of superseded conversations.

[Observed] Protected unreadable current.json is an explicit exception: Rewind preserves the original file, retains its cut in memory, and emits a save error (commitRewoundRoom; WorkshopSessionRewindCoordinator.test.ts). Review should distinguish that deliberately degraded state from ordinary durable success rather than silently universalize the method comment.

## 5. Codebase Genealogy & Controlling Precedent

New/Open already install an aggregate plus provider-neutral archive, preserve displaced local work, and enforce accepted named checkpoint authority. replaceLiveRoom consolidates this transaction across all four operations. Marks are recorded after completion settlement, not merely provider response completion; manifests, delivery offsets and pins must already be committed (WorkshopRetainedHistoryCommit.ts; rewind ADR implementation findings).

Craft Steering follows Fresh/Stock & Signature's focus catalog, shared analysis execution, resource/fallback and save-name conventions. Dictionary adds an optional block to its existing execution modes. Host-neutral core, one composition root, injected controllers and typed envelopes remain governing architectural precedent (CLAUDE.md; architecture tests).

## 6. Structural & Causal Map

Workshop bubble → presentation controller → useWorkshopSessions typed message → session handler bubble mapping → coordinator operation/policy → rewindWorkshopSession → installRoom/store → snapshot + restoration/action messages.

Marks originate in retained commits and hydration baselines, bind logical participants to committed history prefix counts, and are host-private. Snapshot verdicts carry only action availability. Provider messages remain opaque to the transform. Dictionary carries one explicit option from persistence through utility/service execution. Craft Steering is selected through the shared catalog rather than a parallel orchestration path.

## 7. Contracts, Invariants & Negative Space

Invariants: no active-run cut; no guessed provider boundaries; exact participant prefixes; no decreased counters; current excerpt/context; coherent artifacts and to-dos; source authority at Branch commitment; rollback before retiring old conversations; no marks/provider archives exposed to webview; optional Dictionary block absent from paid generation when off.

Deliberate scope limits: no historical filesystem restoration, no arbitrary transcript surgery, no branching graph/lineage, no crossing directive floor, no historic mark reconstruction. Legacy sessions gain baseline exactness on reopen. Optional marks leave old shapes readable by this build; old exact-key readers refuse new files. That forward-only behavior is expressly decided in rewind ADR §9, following the codec ADR's cache-counter precedent, rather than an accidental migration omission.

## 8. Forces, Tensions & Design Tradeoffs

The design spends cloning/re-import work to reuse one installation contract and preserve provider neutrality. In-file marks provide atomic archive/mark persistence but require synchronized upgrades across machines. A separate marks sidecar would preserve old-reader access but add save/mirror/rename/delete/recovery coordination. Full per-turn snapshots simplify cuts at larger storage cost. Mutable live-provider truncation reduces importing but adds provider-specific rollback. Reconstructing only visible text cannot preserve hidden tool/context exchanges.

## 9. Failure, Recovery & Operational Truth

Faults before a Branch file commits leave no new named file; faults opening that file roll back the source room and report the existing branch. Branch checks source initially and at store beforeCommit immediately before replacing current.json. Named Rewind uses accepted checkpoint comparison, while cache-copy failure is separately retryable after named success. Room replacement retains old conversations until it settles. Degraded imports remove unusable marks/memory and emit recovery notices instead of trusting invalid prefixes.

Diagnostics use counts, IDs and keys rather than manuscript bodies. Fresh verification proves deterministic and packaging boundaries; it cannot prove real persona coherence after rewind or real model adherence to the expanded Dictionary report.

## 10. Security, Trust & Misuse Surface

Writer prose and saved histories are the assets. Webview requests and provider output cross host trust boundaries; host policy and closed tool catalogs remain authority. Local Git or other processes can alter files between checks. Source authority protects the room being left at the last visible commitment seam; ordinary local filesystem concurrency assumptions still apply. New sparse Dictionary diagnostics avoid word/context/response-body output (DictionaryService.ts). Model-suggested books are further reading, not claims of source consultation.

## 11. Data, Time, Scale & Concurrency Horizon

Operations serialize room ownership and await earlier autosaves; cuts selected against pending replacement are refused rather than queued for a different room. Larger histories increase snapshot cloning, mark validation, and history slicing. Current scale is local writer sessions; this review has no workload measurement supporting a performance release block. Counters remain monotonic across cuts to prevent reused identity. Rewind retains current temporal state while deleting notices for dropped/degraded personas; Branch creates new timestamps in the source timezone.

## 12. The Change Genome: Variation & Reproduction

One cousin is Side Quest End: the changed axis is cut origin, machine-commanded instead of writer-bubble-selected. Reuse: pure cut, persisted aggregate/archives and coordinator transaction. Extension: the existing origin vocabulary already includes sideQuestEnd. Extension: quest-local state and pinned cut selection. Fork risk: hand-rolling another replacement instead of joining the transaction. Tests can share the canonical room oracle; author-specific composer restore is correctly absent. No quest state or lineage needs speculative implementation in this release.

## 13. Comparative Models & Borrowed Vocabulary

The strongest internal parallel is named Open: a checkpoint is promoted as one coherent room, not reconstructed piecemeal by UI. [Analogy] A command's durable write and its live adoption are different commitment points; this lens asks whether partial outcomes identify which point settled. [Analogy] A release checklist represents observed behavior under a host/runtime envelope; it asks what passing mocked tests cannot establish. No external factual authority is required for those comparisons, and no external-source claims are made.

## 14. Creative Counterfactuals

Inversion: letting UI derive cuts would shift authority to stale, windowed state. Deletion: removing marks leaves no exact hidden-history boundary. Time-lapse: another whole-room operation should join replacement ownership, with extraction when shared responsibilities justify it (tracked coordinator follow-up). Constraint swap: supporting downgrade would require an explicit persistence policy and different storage tradeoff. Boring alternative: Save as new plus Open still needs an exact pure cut, so it does not remove the central history problem.

## 15. Evidence Confidence & Unresolved Questions

[Observed] Current typecheck, full Jest, lint, production build, bundle sentinels, diff whitespace and VSIX/resource checks pass. GitHub CI for exact main 7f9823be also succeeds (run 37066531150). [Observed] Version/changelogs remain unreleased; manual plans remain unchecked. [Unknown] Extension Host smoke is not established here; model output quality is not established by canned transport. [Inferred] Existing regression/oracle evidence provides strong confidence in transaction and cut semantics, but that confidence is scoped to reviewed deterministic paths.

## 16. Past → Present → Horizon Synthesis

Past: append-only rooms plus named authority and released strict codecs. Present: exact retained-memory cuts, a unified room transaction, two additive analysis/report capabilities. Horizon: reusable cuts for Side Quests, optional lineage via Branch Board, coordinator extraction when another operation arrives, and explicit policy if downgrade ever becomes supported. Release evidence closes where runtime behavior has actually been observed, not where architecture appears tidy.

## 17. Runway Synthesis Brief

- Invariants: coherent ledger/memory; source preservation; current working materials; host authority; monotonic IDs; exact option-controlled generation.
- Anchors: rewind ADR; codec ADR; WorkshopRewindPolicy, WorkshopSessionRewind, WorkshopRetainedHistoryMarks, coordinator/store beforeCommit; canonical oracle; Writer tools and Dictionary catalogs.
- Tensions: provider neutrality/import cost; atomic in-file marks/older-reader access; source preservation/two-step Branch; durable success/protected rolling file.
- Unknowns: recorded interactive smoke, live Dictionary omission fix and Craft report usefulness. Remote CI was subsequently verified green for the exact reviewed head.
- Variation points: cut origin and named identity envelope, catalog analysis focus, explicitly selected Dictionary blocks.
- Predicted pressures: longer retained histories, another room operation, eventual lineage; these are horizon questions, not defects.
- Panel questions: do cut/member/artifact invariants survive integrated entry points? Do partial failures preserve recoverable files and report truth? Are released shapes handled as decided? Does packaging contain required prompts/assets? What evidence remains before publication?
- Do not overread: general alpha wording does not remove published-data promises; old-reader rejection is deliberate; unavailable manual evidence is not proof smoke failed; passing mocks do not certify creative output.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there for publication; reviewed code is suitable for release preparation.** No Blocking or High code defect survived validation. The existing explicit host smoke gate still lacks a recorded passing result.

- **F-01 · High — Required Workshop smoke evidence remains unrecorded.** Record completed testing, or run the seven scenarios and startup notice before publication. Pending records do not prove a failed test.

## Report Card

Grades describe reviewed evidence, not the author's ability or unexamined runtime behavior.

| Lane | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | A− | Shared replacement and pure cut preserve coherent ownership; concentration is an existing deferred concern |
| Critical correctness — Blake | A− | Source protection, rollback and verified archive cuts hold in traced paths |
| Edge cases — Sam | A− | Legacy baseline, directive floor, addressee repair and nested title boundaries covered |
| Code quality — Parker | A− | Explicit option selection, focus registrations and typed confirmation state are readable |
| Tests — Cal | A− | Oracle, production commit seam and fault-injected late races prove meaningful behavior; live/real-V2-session confidence remains scoped |
| Codebase fit — Stan | A− | Existing composition, hook, catalog and accepted codec precedent preserved |
| Performance — Tim | B+ | Bounded provider fan-out; avoidable quadratic grouping identified for follow-up |
| Security — Patricia | A− | Host revalidation, contained store paths, private marks and sparse diagnostics preserved |
| Observability/release — Oliver | B+ | Truthful partial failure and persistent errors; required smoke evidence outstanding |
| Domain logic — Bria | A− | Current working materials, exact memory cuts, feature selection and output contracts align with declared intent |

## Findings

### F-01 · High — Required Workshop smoke evidence remains unrecorded

**Raised by:** Oliver · **Discovery:** Runway-prompted · **Confidence:** High for missing recorded evidence
**Evidence:** `.todo/tech-debt/2026-10-01-workshop-rewind-and-branch-main-smoke.md:31` — `- All seven scenarios are recorded as passing, with the date and the build.`
**Affected contract:** The explicitly agreed Workshop publication gate.

The [seven-scenario table](../../.memory-bank/20261001-1105-workshop-rewind-and-branch.md) still says Pending, with no tested build/date. Release preparation explicitly waits on it. Automated tests establish deterministic contracts, but do not establish real host reload behavior, participant coherence after cuts, or the complete UI workflow.

This is an existing gate, not a newly discovered code defect. Okey may have completed it outside the records; this review cannot infer failure or success from that gap.

**Recommendation:** Record passing results and the tested commit/date if completed. Otherwise run the seven scenarios plus startup notice before publishing, fix failures separately, and rerun affected scenarios.

### F-02 · Standard — Mark verification recopies each growing participant bucket

**Raised by:** Tim · **Discovery:** Independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopRetainedHistoryMarks.ts:320` — `marksByKey.set(mark.conversationKey, [` followed by `...(marksByKey.get(mark.conversationKey) ?? []),`
**Affected contract:** Long-session performance and maintenance.

For each participant mark, grouping copies the entire previously accumulated bucket. N marks for one participant therefore copy O(N²) references. The new helper is used at checkpoint decoding and twice within the pure rewind transform. This is avoidable synchronous allocation as long rooms accumulate marks. There is no evidence of current user-visible latency or a release-scale failure.

**Recommendation:** Initialize each locally owned bucket once and append with `push`, preserving input immutability and ordering. Follow-up is recorded as [Low-priority debt](../../.todo/tech-debt/2026-10-02-workshop-mark-grouping-allocation.md); it does not hold this release.

## What the Panel Changed About the Runway

**Affirmed:** One pure cut, one shared replacement transaction, source authority at Branch commitment, host-private history facts, current working materials, optional Dictionary execution, and shared Craft Steering integration all match raw implementation/test evidence.

**Refined:** Cal distinguishes today's scripted no-marks fixture from a real historical v2.6.2 room. The authentic frozen released fixture is pre-widget and carries no conversation history. Those tests support optional-field and migration paths without certifying every real prior-version session. Tim identified a particular grouping allocation pattern within the runway's scale horizon; it merits a small follow-up.

**Rejected:** None of the synthesized product/ownership claims required rejection.

**Still unknown:** Off-record interactive smoke, live corrected Dictionary appendix inclusion and quality, Craft Steering usefulness/fidelity, and theme interaction. Exact-head remote CI is now verified.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

1. **Evidence has a boundary — F-01.** Automated tests establish cuts, rollback and routing. A dated host smoke establishes behavior across live models, reloads and external file changes. Record the tested commit and scenario results while testing, so confidence does not depend on one person's memory.
2. **Ownership makes the cheap operation clear — F-02.** A local grouping bucket can be appended to without violating shared immutability. Inspect growing collections for repeated prefix copying; reserve copying for actual shared boundaries. Measurement determines urgency.
3. **Historical views include historical knowledge — preserved pattern.** Visible transcript truncation cannot define what personas remember. Restore ledger and memories through one coherent transform/transaction, and distinguish durable creation from live adoption when reporting partial outcomes.

## Release preparation and product validation

These are normal preparation tasks and already-planned checks, not additional code findings:

- After the smoke gate is settled, prepare a minor release, naturally **2.7.0**, on `release/v2.7.0`. Update root/core/extension/lockfile versions and README, date/version both changelogs, and rebuild the final VSIX.
- Preserve the all-machines session-upgrade warning. Optional marks deliberately keep outer schema 2; earlier exact-key readers safely refuse new marked files, even without Rewind use. This follows an explicitly accepted forward-only policy.
- Dictionary's plan still calls for corrected enabled `copper`, standard/Fast `plosive`, contextual multi-sense `bank`, and theme/persisted/off/persona checks. Craft Steering still calls for both pickers, stream/cancel/copy/save/follow-up and a real report's craft fidelity. Their passing status was not established here.

## Horizon Watchlist

Not release blockers: Side Quests can reuse the cut origin/transaction; Branch Board may add explicit lineage; coordinator extraction is already tied to the next whole-room operation; larger histories increase validation/import work. Downgrade support would require an explicit storage/codec policy change rather than a compatibility shim.

## The Closer

Old rooms keep their words<br>
New paths leave the source intact<br>
Green lights wait for proof

## Final Assessment

The reviewed code is suitable for release preparation. CI, typechecks, 2,784 tests, lint, production bundling and review packaging all pass. Publication remains conditional on the explicitly agreed Workshop smoke evidence; routine version preparation and the feature plans' live-output checks remain. The one new code improvement is a small performance follow-up, not a release blocker.

---

Reviewed through Marcus, Blake, Sam, Parker, Cal, Stan, Tim, Patricia, Oliver and Bria lanes, followed by Sensei. Reviewer tasks ran in waves within the available concurrency limit; several sequential lanes reused agent runtimes. Only Tim's finding is labeled independent; no consensus badge is claimed. All findings were checked against raw evidence by the parent.

## Complete changed-file manifest

```text
.ai/central-agent-setup.md
.memory-bank/20260929-1335-release-v2.6.2-complete.md
.memory-bank/20260930-1347-workshop-rewind-sprint-01-marks.md
.memory-bank/20260930-1721-workshop-rewind-sprint-02-rewind.md
.memory-bank/20261001-1105-workshop-rewind-and-branch.md
.todo/archive/epics/epic-workshop-rewind-and-branch-2026-09-30/ARCHIVE.md
.todo/archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md
.todo/archive/epics/epic-workshop-rewind-and-branch-2026-09-30/sprints/01-retained-history-marks.md
.todo/archive/epics/epic-workshop-rewind-and-branch-2026-09-30/sprints/02-rewind.md
.todo/archive/epics/epic-workshop-rewind-and-branch-2026-09-30/sprints/03-branch-and-release.md
.todo/archive/tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md
.todo/archive/tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md
.todo/features/feature-craft-steering-analysis/README.md
.todo/features/feature-dictionary-topic-lexicon/README.md
.todo/features/feature-workshop-branch-board/README.md
.todo/features/feature-workshop-side-quests/README.md
.todo/tech-debt/2026-10-01-workshop-browser-lists-unreadable-session.md
.todo/tech-debt/2026-10-01-workshop-persistence-coordinator-ownership.md
.todo/tech-debt/2026-10-01-workshop-rewind-and-branch-main-smoke.md
.todo/tech-debt/2026-10-01-workshop-rewind-and-branch-notice-screenshot.md
.todo/tech-debt/2026-10-01-workshop-rewind-and-branch-release-preparation.md
.todo/tech-debt/README.md
apps/vscode-extension/CHANGELOG.md
apps/vscode-extension/README.md
docs/ARCHITECTURE.md
docs/CHANGELOG-DETAILED.md
docs/adr/2026-09-30-workshop-rewind-and-branch.md
docs/pr-reviews/pr-117-retained-history-marks-3ca270d-review.md
docs/pr-reviews/pr-118-craft-steering-analysis-review.md
docs/pr-reviews/pr-119-workshop-rewind-ca93f7e-review.md
docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md
docs/pr-reviews/pr-122-workshop-naming-dictionary-encyclopedia-review.md
packages/core/resources/system-prompts/dictionary-fast/00-base-instructions.md
packages/core/resources/system-prompts/dictionary-fast/16-topic-related-lexicon-block.md
packages/core/resources/system-prompts/dictionary-utility/00-dictionary-utility.md
packages/core/resources/system-prompts/dictionary-utility/02-encyclopedia-entry.md
packages/core/resources/system-prompts/workshop-personas/analysis-capability.md
packages/core/resources/system-prompts/writing-tools-assistant/focus/craft-steering.md
packages/core/src/__tests__/application/handlers/domain/DictionaryHandler.test.ts
packages/core/src/__tests__/application/handlers/domain/FileOperationsHandler.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoomHandler.roomAndRun.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoomHandler.seams.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoutes.branch.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoutes.retainedHistoryMarks.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoutes.rewind.test.ts
packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopRoutes.sessions.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopAnalysisSidePass.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopCapabilityXmlCodec.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopPersonaCapability.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopRunCompletion.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistence.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistenceCoordinator.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopSessionTimeService.test.ts
packages/core/src/__tests__/application/services/workshop/WorkshopSessionTitles.test.ts
packages/core/src/__tests__/application/services/workshop/session/ScriptedWorkshopRoom.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRetainedHistoryCoordinator.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRetainedHistoryEngine.integration.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRetainedHistoryLedger.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRetainedHistoryMarks.scripted.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRetainedHistoryPersistence.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRewindOracle.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopRewindPolicy.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopSessionBranchCoordinator.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopSessionRewind.oracle.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopSessionRewind.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopSessionRewindCoordinator.test.ts
packages/core/src/__tests__/application/services/workshop/session/WorkshopSessionRewindability.test.ts
packages/core/src/__tests__/architecture/boundaries.test.ts
packages/core/src/__tests__/architecture/promptBudgets.test.ts
packages/core/src/__tests__/infrastructure/api/orchestration/ConversationManager.test.ts
packages/core/src/__tests__/infrastructure/api/services/dictionary/DictionaryService.test.ts
packages/core/src/__tests__/infrastructure/storage/WorkshopSessionStore.test.ts
packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx
packages/core/src/__tests__/presentation/webview/components/tabs/AllToolsModal.test.tsx
packages/core/src/__tests__/presentation/webview/components/tabs/UtilitiesTab.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopNoticeModal.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopToolsModal.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopTurnBubble.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundModal.test.tsx
packages/core/src/__tests__/presentation/webview/components/workshop/workshopSessionConfirmCopy.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/useDictionary.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopSessionSurfaces.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopRoom.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopRoomAndSessions.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopSessions.test.ts
packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopWidgetHost.test.ts
packages/core/src/__tests__/presentation/webview/hooks/useWorkshopAppMessageRouter.test.ts
packages/core/src/__tests__/tools/assist/passageAssistantContracts.test.ts
packages/core/src/__tests__/tools/assist/writingToolsAssistant.test.ts
packages/core/src/__tests__/tools/utility/dictionaryUtility.test.ts
packages/core/src/application/handlers/domain/AnalysisHandler.ts
packages/core/src/application/handlers/domain/DictionaryHandler.ts
packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts
packages/core/src/application/handlers/domain/workshop/WorkshopSessionMessageHandler.ts
packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts
packages/core/src/application/services/workshop/RunWorkshopToolSidePass.ts
packages/core/src/application/services/workshop/WorkshopAnalysisSidePass.ts
packages/core/src/application/services/workshop/WorkshopPersistedSession.ts
packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts
packages/core/src/application/services/workshop/WorkshopRetainedHistoryCommit.ts
packages/core/src/application/services/workshop/WorkshopRunCompletion.ts
packages/core/src/application/services/workshop/WorkshopSessionBranch.ts
packages/core/src/application/services/workshop/WorkshopSessionCheckpointNormalization.ts
packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts
packages/core/src/application/services/workshop/WorkshopSessionRecoveryEquality.ts
packages/core/src/application/services/workshop/WorkshopSessionService.ts
packages/core/src/application/services/workshop/WorkshopSessionStateV1.ts
packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts
packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts
packages/core/src/application/services/workshop/WorkshopSessionTimeService.ts
packages/core/src/application/services/workshop/WorkshopSessionTitles.ts
packages/core/src/application/services/workshop/session/WorkshopRetainedHistoryLedger.ts
packages/core/src/application/services/workshop/session/WorkshopRetainedHistoryMarks.ts
packages/core/src/application/services/workshop/session/WorkshopRewindPolicy.ts
packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts
packages/core/src/application/services/workshop/session/WorkshopTurnLedger.ts
packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts
packages/core/src/infrastructure/api/orchestration/ConversationManager.ts
packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts
packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts
packages/core/src/infrastructure/storage/WorkshopSessionStore.ts
packages/core/src/presentation/webview/WorkshopApp.tsx
packages/core/src/presentation/webview/components/shared/Icon.tsx
packages/core/src/presentation/webview/components/tabs/AllToolsModal.tsx
packages/core/src/presentation/webview/components/tabs/UtilitiesTab.tsx
packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx
packages/core/src/presentation/webview/components/workshop/WorkshopPathChooser.tsx
packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx
packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx
packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx
packages/core/src/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.tsx
packages/core/src/presentation/webview/components/workshop/widgets/gesturePlayground/WorkshopGesturePlaygroundModal.tsx
packages/core/src/presentation/webview/components/workshop/workshopSessionConfirmCopy.ts
packages/core/src/presentation/webview/components/workshop/workshopToolIcons.ts
packages/core/src/presentation/webview/hooks/domain/useDictionary.ts
packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopSessionSurfaces.ts
packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts
packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts
packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopSessions.ts
packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopWidgetHost.ts
packages/core/src/presentation/webview/hooks/useWorkshopAppMessageRouter.ts
packages/core/src/presentation/webview/index.css
packages/core/src/presentation/webview/styles/workshop/session.css
packages/core/src/presentation/webview/styles/workshop/shell.css
packages/core/src/shared/constants/resultToolNames.ts
packages/core/src/shared/constants/workshopNotices.ts
packages/core/src/shared/constants/workshopRewind.ts
packages/core/src/shared/constants/workshopTools.ts
packages/core/src/shared/types/messages/analysis.ts
packages/core/src/shared/types/messages/base.ts
packages/core/src/shared/types/messages/dictionary.ts
packages/core/src/shared/types/messages/index.ts
packages/core/src/shared/types/messages/inferenceContext.ts
packages/core/src/shared/types/messages/workshop/index.ts
packages/core/src/shared/types/messages/workshop/participants.ts
packages/core/src/shared/types/messages/workshop/session.ts
packages/core/src/shared/types/messages/workshop/widgets.ts
packages/core/src/tools/assist/writingToolsAssistant.ts
packages/core/src/tools/utility/dictionaryUtility.ts
```

## Resolution update — 2026-10-02

Okey confirmed, "I've performed all the checks," and requested v2.7.0 release preparation. F-01 is Addressed: Workshop smoke, Dictionary and Craft Steering manual plans are updated on that writer-reported evidence. Earlier pending/unknown statements describe the review-time state. F-02 remains the tracked nonblocking follow-up.
