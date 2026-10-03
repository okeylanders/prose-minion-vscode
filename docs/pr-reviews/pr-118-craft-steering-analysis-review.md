# PR Review — Add Craft Steering analysis to sidebar and Workshop

**Author:** okeylanders · **PR:** [#118](https://github.com/okeylanders/prose-minion-vscode/pull/118) (Open)
**Branches:** `feature/craft-steering-analysis` → `main`
**Base / merge-base:** `fdad474fa1802fc4d05ba7fba71c809494b5c728`
**Head:** `08c53f125602c775179820eb7a2ee09099dfda8f`
**Reviewed:** 2026-10-01 · **Mode:** Full Forge panel: ten specialist reviewers, followed by Sensei's teaching pass. Reviewers used the client's available Codex model and ran in waves within its concurrency limit.

## Resolution ledger

Status is the reviewer's initial recommendation. Legend: **Open** = act before merge · **Deferred** = accepted follow-up with a stated reason · **Addressed** = fixed · **Partially addressed** = a verified improvement with a remainder · **N/A** = praise, out of scope, or superseded.

| ID | Sev | Finding | Reviewers | Consensus | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | 🟢 Praise | Controlled variations make their contract explicit | Parker | — | **N/A** — preserve |
| F-02 | 🟢 Praise | Tests protect both picker contracts and the failure fallback | Cal | — | **N/A** — preserve |
| F-03 | 🟢 Praise | Craft Steering follows the existing tool registration contract | Stan | — | **N/A** — preserve |

**Verdict:** Approve the reviewed code changes. No Blocking, High, Standard, or Nit finding survived evidence checking. Interactive Extension Development Host validation and real-model report evaluation remain pending product checks, already recorded in the feature plan.

## Blast radius

- 23 files changed · +603 / −20 lines · 3 commits, including the main merge.
- 3 new files: feature notes, the Craft Steering prompt, and the sidebar picker test.
- No database migrations, new services, transport contracts, or session-codec changes in this PR's net diff.
- The 922-line unified diff was read in full. Deeper context concentrated on prompt assembly, both pickers, persona analysis, result saving, and the shared Workshop lifecycle, with Fresh and Stock & Signature as concrete sibling baselines.

## Main merge and review scope

The current `main` SHA is an ancestor of the reviewed head and equals the merge-base. This review uses `fdad474f...08c53f1`, so the Workshop Rewind and Branch implementation brought in by merge `f65b9eff` is surrounding integration context rather than newly attributed feature work.

The inspected changelog merge resolution preserves main's Rewind/Branch entries, time-context fix, and session upgrade notes; the net changelog addition is the Craft Steering bullet. Follow-up `08c53f1` changes the TypeScript instruction/fallback wording to avoid the existing architecture guard's title-case widget-name match. The Markdown resource retains its report headings, and the fallback still retains both creative sections. The current architecture tests and CI pass.

Catalog-based validation accepts `craft-steering` in persona requests, selected tools, persisted turns and sidecars, and retained-history keys. Existing shared completion paths record tool history marks, and archive import rebuilds the focus-specific prompt. Source tracing and the existing generic tests support compatibility with the merged Workshop lifecycle; a Craft Steering-specific interactive Rewind/Branch scenario was not performed.

The three pre-existing untracked artifacts—the Anthropic prompt-cache feature directory, `Prose Minion.zip`, and `workshop-ai-service-conversation-ownership.md`—were excluded and preserved. The review publication adds only this report; the build regenerated ignored artifacts.

## Verification actually run

Checks ran against the reviewed head before adding this report. Local runtime: Node `v26.1.0`, npm `11.13.0`; the repository CI uses Node 18.

| Check | Result |
| --- | --- |
| Local HEAD and live PR head | ✅ Both `08c53f125602c775179820eb7a2ee09099dfda8f`; base and head rechecked before publication |
| GitHub `verify` | ✅ Success at the reviewed head; PR open, mergeable, merge state clean |
| `npm test -- --runInBand` | ✅ 229 suites / 2,732 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,035 warnings. No independent baseline warning comparison was performed |
| `npm run build` | ✅ Extension/webview webpack builds and `verify:bundle` passed; three webview size/performance recommendations, with a 1.22 MiB bundle |
| Source/staged resource comparisons | ✅ `cmp` passed for the Craft Steering focus prompt and persona analysis-capability prompt |
| Staged report structure | ✅ All twelve numbered Craft Steering sections present in order |
| `git diff --check fdad474f...08c53f1` | ✅ |
| Interactive VS Code host, visual/accessibility inspection, live providers | Not performed |
| VSIX packaging or Marketplace artifact verification | Not performed; this is a PR review |

All ten specialist lanes completed: Marcus (architecture), Blake (critical correctness), Sam (edge cases), Parker (quality), Cal (tests), Stan (standards), Tim (performance), Patricia (security), Oliver (observability), and Bria (domain intent). The three praise findings below were independently checked against the current source. Overlapping coverage was not counted as finding consensus. No existing PR comments or submitted reviews were present when inspected.

Governing material: `AGENTS.md` / `CLAUDE.md`, live PR description and metadata, the complete net diff, relevant production files and tests, the [feature plan](../../.todo/archive/features/feature-craft-steering-analysis/README.md), sibling prompts, and the CI workflow.

## Report card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | A |
| 🛡️ Security | A |
| 🧪 Tests | A |
| 📖 Quality | A |
| ⚡ Performance | A |
| 🎯 Domain | A |

Grades apply to the reviewed delta: A means no supported actionable finding in that lane. Performance assessment covers the execution path and bounded prompt requirements; provider latency and output quality were not measured.

## Executive briefing

No Blocking or High findings. Craft Steering reaches both picker surfaces and persona analysis through established routes, carries a complete missing-resource fallback, and uses the expected status, icon, and saved-report identities. The main merge introduces no identified integration regression for this focus.

The full prompt is larger than Fresh and Stock & Signature, and its default two sets of three variants entail generation work. That is part of the requested behavior. Compact selections, input-sensitive depth, and reduced selection size bound the request; no additional execution loop or capability budget is introduced. Whether a chosen model delivers a useful complete report within its output budget remains part of the pending model evaluation.

## 📖 Parker · Code quality

### F-01 · 🟢 Praise · Controlled variations make their contract explicit

**File:** [craft-steering.md](../../packages/core/resources/system-prompts/writing-tools-assistant/focus/craft-steering.md), lines 267–268 · **Confidence:** High.

```markdown
- **Coupled effects:** [Any secondary changes that could not be avoided; do not claim a perfectly isolated experiment when it is not]
- **Constraint check:** [Specific evidence that the declared invariants survived]
```

The controlled-variation template separates the primary changed dimension, preserved features, secondary effects, and evidence of fidelity. Its prohibition against recycling the open variants gives Bound Creative Variations a concrete purpose a writer can assess. The fallback preserves those distinctions. No actionable naming, readability, duplication, or misleading-type issue was identified.

> “The prompt names what changes and what survives, so the reader can evaluate the experiment without decoding its intentions.” — Parker

## 🧪 Cal · Test coverage and quality

### F-02 · 🟢 Praise · Tests protect both picker contracts and the failure fallback

**File:** [WorkshopToolsModal.test.tsx](../../packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopToolsModal.test.tsx), line 69 · **Confidence:** High.

```typescript
expect(onSelect).not.toHaveBeenCalled();
```

The Workshop test distinguishes card selection from launch commitment, then checks exactly one `craft-steering` callback in direct and persona modes. Separate tests prevent gated selection/launch and establish the sidebar's immediate launch-and-close contract. Profile tests compare the new focus with sibling tools; the resource-failure test inspects assembled instructions and preserved passage/context rather than relying solely on the engine's canned response. Persona XML acceptance and the named save prefix are also exercised.

Existing generic side-pass and adoption tests cover retained policies, isolation, replacement/discard, provenance, and history marks through the shared implementation. No substantive test gap justified duplicating that lifecycle suite for this additional focus. Generated critique quality remains a different kind of evidence.

> “Confidence is high in the wiring because the tests prove what launches, what stays disabled, and what survives a missing resource; the quality of the critique still needs an actual critique.” — Cal

## 🗂️ Stan · Codebase standards

### F-03 · 🟢 Praise · Craft Steering follows the existing tool registration contract

**File:** [workshopTools.ts](../../packages/core/src/shared/constants/workshopTools.ts), line 33 · **Confidence:** High.

```typescript
{ id: 'craft-steering', label: 'Craft Steering', group: 'Craft & Voice', description: 'Sound, rhythm, and how each sentence carries you into the next. Inspired by Le Guin’s Steering the Craft.' },
```

Compared with Stock & Signature and Fresh, the new focus follows the same registration pattern across `WritingToolsFocus`, role/task/fallback records, the focus guard, sidebar card, shared Workshop catalog, presentation icon map, streaming label, persona instructions, and saved-report prefix. The persona codec and result wire-name mapping already derive from the catalog, so acceptance reaches their existing consumers.

The resource follows the siblings' explicit report-override pattern; the fallback retains all twelve sections and both variation sets. The change fits the existing composition and execution seams without creating another route or persistence owner.

> “Stock & Signature already showed us the doors to wire; Craft Steering remembered the save button too.” — Stan

## 🎓 Sensei · The teacher

### Lesson 1 — Extend the contract that already carries the behavior

**Illuminated by:** Stan, F-03.

A shared registration path makes validation, retained history, and execution rules travel together. Adding a capability through that path preserves the meaning of the same tool across entry points.

**Carry forward:** Trace a new capability from every entry point and ask where those paths converge on the same validation and lifecycle.

### Lesson 2 — Test the decisions the user actually makes

**Illuminated by:** Cal, F-02.

Confidence comes from consequential transitions: immediate launch, selection followed by commitment, unavailable actions, and resource failure. These tests establish integration behavior; evaluating generated prose requires separate evidence.

**Carry forward:** Before writing an assertion, finish: “When the writer does ___ under ___ conditions, they should observe ___.”

### Lesson 3 — Give creative freedom explicit boundaries

**Illuminated by:** Parker, F-01.

A useful generative contract identifies what may change and what must survive. Naming coupled effects and requiring a concrete fidelity check makes tradeoffs inspectable and creative latitude accountable to the passage.

**Carry forward:** Before requesting a variation, name its primary change, protected properties, and the evidence that would demonstrate their preservation.

> “Good craft gives the next person something they can trust—and a clear way to check that trust.” — Sensei

## Pending product validation

These are existing unchecked completion criteria, not new review defects or accepted waivers:

- Run the Extension Development Host through both pickers, streaming/cancel, copy/save, and Workshop follow-up. Include a short rhythmic passage, a paragraph handoff, and a single sentence.
- Inspect real model reports for source fidelity, preserved intentional rhythm, exact evidence on both sides of disputed handoffs, complete distinct variation sets, and sensible length. Automated prompt assertions establish the request contract; they cannot establish model compliance or craft usefulness.

## The closer

### 🎬 Movie tagline

When the resource disappears, the rhythm stays on the page.

## Summary

Approve the code changes at `08c53f1`: the full panel found no actionable defect, and current CI plus all local automated checks pass. The two manual/model checks above remain necessary before describing the feature as fully validated.

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
